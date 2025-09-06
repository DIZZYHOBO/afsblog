// migrate-to-secure-auth.js - DATA MIGRATION SCRIPT
// Migrates existing insecure data to new secure authentication system

import { getStore } from "@netlify/blobs";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const MIGRATION_CONFIG = {
  SALT_ROUNDS: 12,
  BACKUP_PREFIX: 'backup_migration_',
  MIGRATION_BATCH_SIZE: 10,
  MAX_MIGRATION_TIME: 30 * 60 * 1000, // 30 minutes
  PROTECTED_ADMIN: "dumbass"
};

export default async (req, context) => {
  // Only allow POST requests for security
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify migration key for security
  const { migrationKey } = await req.json();
  const expectedKey = process.env.MIGRATION_KEY || "MIGRATION_NOT_CONFIGURED";
  
  if (!migrationKey || migrationKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Invalid migration key" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const blogStore = getStore("blog-data");
    const apiStore = getStore("blog-api-data");
    const securityStore = getStore("security-data");
    
    const migrationResult = await performSecureMigration(blogStore, apiStore, securityStore);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Migration completed successfully",
        results: migrationResult
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Migration error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Migration failed",
        details: error.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

async function performSecureMigration(blogStore, apiStore, securityStore) {
  const startTime = Date.now();
  const migrationId = crypto.randomUUID();
  
  console.log(`Starting secure authentication migration: ${migrationId}`);
  
  // Log migration start
  await logMigrationEvent(securityStore, {
    type: 'migration_started',
    migrationId,
    timestamp: new Date().toISOString()
  });

  const results = {
    migrationId,
    startTime: new Date().toISOString(),
    usersProcessed: 0,
    pendingUsersProcessed: 0,
    sessionsCleaned: 0,
    backupsCreated: 0,
    errors: []
  };

  try {
    // Step 1: Create backups of existing data
    console.log('Creating backups of existing data...');
    await createDataBackups(blogStore, migrationId);
    results.backupsCreated++;

    // Step 2: Migrate approved users
    console.log('Migrating approved users...');
    const userMigrationResult = await migrateApprovedUsers(blogStore);
    results.usersProcessed = userMigrationResult.processed;
    results.errors.push(...userMigrationResult.errors);

    // Step 3: Migrate pending users
    console.log('Migrating pending users...');
    const pendingMigrationResult = await migratePendingUsers(blogStore);
    results.pendingUsersProcessed = pendingMigrationResult.processed;
    results.errors.push(...pendingMigrationResult.errors);

    // Step 4: Clean up old sessions
    console.log('Cleaning up old sessions...');
    const sessionCleanupResult = await cleanupOldSessions(apiStore);
    results.sessionsCleaned = sessionCleanupResult.cleaned;

    // Step 5: Verify migration integrity
    console.log('Verifying migration integrity...');
    const verificationResult = await verifyMigrationIntegrity(blogStore);
    if (!verificationResult.valid) {
      throw new Error(`Migration integrity check failed: ${verificationResult.errors.join(', ')}`);
    }

    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;
    results.success = true;

    // Log migration completion
    await logMigrationEvent(securityStore, {
      type: 'migration_completed',
      migrationId,
      results,
      timestamp: new Date().toISOString()
    });

    console.log('Migration completed successfully:', results);
    return results;

  } catch (error) {
    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;
    results.success = false;
    results.error = error.message;

    // Log migration failure
    await logMigrationEvent(securityStore, {
      type: 'migration_failed',
      migrationId,
      error: error.message,
      results,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
}

async function createDataBackups(blogStore, migrationId) {
  const backupTimestamp = new Date().toISOString();
  
  // Backup all user data
  const { blobs: userBlobs } = await blogStore.list({ prefix: "user_" });
  for (const blob of userBlobs) {
    try {
      const userData = await blogStore.get(blob.key, { type: "json" });
      if (userData) {
        const backupKey = `${MIGRATION_CONFIG.BACKUP_PREFIX}${migrationId}_${blob.key}_${Date.now()}`;
        await blogStore.set(backupKey, JSON.stringify({
          originalKey: blob.key,
          migrationId,
          backupTimestamp,
          data: userData
        }));
      }
    } catch (error) {
      console.error(`Error backing up ${blob.key}:`, error);
    }
  }

  // Backup all pending user data
  const { blobs: pendingBlobs } = await blogStore.list({ prefix: "pending_user_" });
  for (const blob of pendingBlobs) {
    try {
      const pendingData = await blogStore.get(blob.key, { type: "json" });
      if (pendingData) {
        const backupKey = `${MIGRATION_CONFIG.BACKUP_PREFIX}${migrationId}_${blob.key}_${Date.now()}`;
        await blogStore.set(backupKey, JSON.stringify({
          originalKey: blob.key,
          migrationId,
          backupTimestamp,
          data: pendingData
        }));
      }
    } catch (error) {
      console.error(`Error backing up ${blob.key}:`, error);
    }
  }

  console.log('Data backups created successfully');
}

async function migrateApprovedUsers(blogStore) {
  const { blobs } = await blogStore.list({ prefix: "user_" });
  const userBlobs = blobs.filter(blob => 
    blob.key.startsWith('user_') && 
    !blob.key.startsWith('user_follows_')
  );
  
  const results = {
    processed: 0,
    errors: []
  };

  for (const blob of userBlobs) {
    try {
      const oldUserData = await blogStore.get(blob.key, { type: "json" });
      
      if (!oldUserData || !oldUserData.username) {
        console.warn(`Skipping invalid user data: ${blob.key}`);
        continue;
      }

      // Check if already migrated (has passwordHash instead of password)
      if (oldUserData.passwordHash && !oldUserData.password) {
        console.log(`User ${oldUserData.username} already migrated, skipping`);
        continue;
      }

      if (!oldUserData.password) {
        results.errors.push(`User ${oldUserData.username} has no password field`);
        continue;
      }

      // Generate new secure user data
      const saltRounds = MIGRATION_CONFIG.SALT_ROUNDS;
      const passwordHash = await bcrypt.hash(oldUserData.password, saltRounds);
      const salt = await bcrypt.genSalt(saltRounds);

      const newUserData = {
        id: oldUserData.id || crypto.randomUUID(),
        username: oldUserData.username,
        email: oldUserData.email || null,
        passwordHash: passwordHash,
        passwordSalt: salt,
        bio: oldUserData.bio || `Hello! I'm ${oldUserData.username}`,
        profilePicture: oldUserData.profilePicture || null,
        createdAt: oldUserData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: oldUserData.lastLogin || null,
        loginCount: oldUserData.loginCount || 0,
        isAdmin: oldUserData.isAdmin || false,
        emailVerified: false, // Will need to be verified
        failedLoginAttempts: 0,
        lockedUntil: null,
        securityEvents: [],
        settings: {
          twoFactorEnabled: false,
          sessionTimeout: 15 * 60 // 15 minutes in seconds
        },
        // Migration metadata
        migratedAt: new Date().toISOString(),
        migrationSource: 'legacy_plaintext'
      };

      // Remove old insecure password field
      delete newUserData.password;

      // Store the updated user data
      await blogStore.set(blob.key, JSON.stringify(newUserData));
      
      results.processed++;
      console.log(`Migrated user: ${oldUserData.username}`);

    } catch (error) {
      console.error(`Error migrating user ${blob.key}:`, error);
      results.errors.push(`Failed to migrate user ${blob.key}: ${error.message}`);
    }
  }

  return results;
}

async function migratePendingUsers(blogStore) {
  const { blobs } = await blogStore.list({ prefix: "pending_user_" });
  
  const results = {
    processed: 0,
    errors: []
  };

  for (const blob of blobs) {
    try {
      const oldPendingData = await blogStore.get(blob.key, { type: "json" });
      
      if (!oldPendingData || !oldPendingData.username) {
        console.warn(`Skipping invalid pending user data: ${blob.key}`);
        continue;
      }

      // Check if already migrated
      if (oldPendingData.passwordHash && !oldPendingData.password) {
        console.log(`Pending user ${oldPendingData.username} already migrated, skipping`);
        continue;
      }

      if (!oldPendingData.password) {
        results.errors.push(`Pending user ${oldPendingData.username} has no password field`);
        continue;
      }

      // Generate new secure pending user data
      const saltRounds = MIGRATION_CONFIG.SALT_ROUNDS;
      const passwordHash = await bcrypt.hash(oldPendingData.password, saltRounds);
      const salt = await bcrypt.genSalt(saltRounds);
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const newPendingData = {
        id: oldPendingData.id || crypto.randomUUID(),
        username: oldPendingData.username,
        email: oldPendingData.email || null,
        passwordHash: passwordHash,
        passwordSalt: salt,
        bio: oldPendingData.bio || `Hello! I'm ${oldPendingData.username}`,
        createdAt: oldPendingData.createdAt || new Date().toISOString(),
        status: 'pending',
        isAdmin: false,
        emailVerified: false,
        verificationToken: verificationToken,
        verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        registrationIP: 'migrated',
        failedLoginAttempts: 0,
        lockedUntil: null,
        securityEvents: [],
        settings: {
          twoFactorEnabled: false,
          sessionTimeout: 15 * 60
        },
        // Migration metadata
        migratedAt: new Date().toISOString(),
        migrationSource: 'legacy_plaintext'
      };

      // Remove old insecure password field
      delete newPendingData.password;

      // Store the updated pending user data
      await blogStore.set(blob.key, JSON.stringify(newPendingData));
      
      results.processed++;
      console.log(`Migrated pending user: ${oldPendingData.username}`);

    } catch (error) {
      console.error(`Error migrating pending user ${blob.key}:`, error);
      results.errors.push(`Failed to migrate pending user ${blob.key}: ${error.message}`);
    }
  }

  return results;
}

async function cleanupOldSessions(apiStore) {
  const results = {
    cleaned: 0
  };

  try {
    // Get all old session keys
    const { blobs } = await apiStore.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const sessionData = await apiStore.get(blob.key, { type: "json" });
        
        // If it's an old format session (no JWT structure), remove it
        if (sessionData && !sessionData.sessionId) {
          await apiStore.delete(blob.key);
          results.cleaned++;
        }
      } catch (error) {
        // If we can't parse it, it's probably old format - delete it
        await apiStore.delete(blob.key);
        results.cleaned++;
      }
    }

    // Also clean up old current_user keys
    try {
      await apiStore.delete('current_user');
    } catch (error) {
      // Ignore if it doesn't exist
    }

  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
  }

  return results;
}

async function verifyMigrationIntegrity(blogStore) {
  const results = {
    valid: true,
    errors: []
  };

  try {
    // Verify all users have been migrated properly
    const { blobs: userBlobs } = await blogStore.list({ prefix: "user_" });
    const actualUserBlobs = userBlobs.filter(blob => 
      blob.key.startsWith('user_') && 
      !blob.key.startsWith('user_follows_')
    );

    for (const blob of actualUserBlobs) {
      try {
        const userData = await blogStore.get(blob.key, { type: "json" });
        
        if (!userData) {
          results.errors.push(`User data missing: ${blob.key}`);
          continue;
        }

        // Check required fields for migrated users
        const requiredFields = ['id', 'username', 'passwordHash', 'passwordSalt'];
        for (const field of requiredFields) {
          if (!userData[field]) {
            results.errors.push(`User ${userData.username || blob.key} missing required field: ${field}`);
          }
        }

        // Check that old insecure password field is removed
        if (userData.password) {
          results.errors.push(`User ${userData.username} still has insecure password field`);
        }

        // Verify password hash format
        if (userData.passwordHash && !userData.passwordHash.startsWith('$2')) {
          results.errors.push(`User ${userData.username} has invalid password hash format`);
        }

      } catch (error) {
        results.errors.push(`Error verifying user ${blob.key}: ${error.message}`);
      }
    }

    // Verify pending users
    const { blobs: pendingBlobs } = await blogStore.list({ prefix: "pending_user_" });
    for (const blob of pendingBlobs) {
      try {
        const pendingData = await blogStore.get(blob.key, { type: "json" });
        
        if (!pendingData) {
          results.errors.push(`Pending user data missing: ${blob.key}`);
          continue;
        }

        // Check that password is migrated
        if (pendingData.password) {
          results.errors.push(`Pending user ${pendingData.username} still has insecure password field`);
        }

        if (!pendingData.passwordHash) {
          results.errors.push(`Pending user ${pendingData.username} missing password hash`);
        }

      } catch (error) {
        results.errors.push(`Error verifying pending user ${blob.key}: ${error.message}`);
      }
    }

    if (results.errors.length > 0) {
      results.valid = false;
    }

  } catch (error) {
    results.valid = false;
    results.errors.push(`Verification error: ${error.message}`);
  }

  return results;
}

async function logMigrationEvent(securityStore, event) {
  try {
    const eventId = crypto.randomUUID();
    const logEntry = {
      id: eventId,
      ...event,
      category: 'migration'
    };
    
    await securityStore.set(`migration_log_${eventId}`, JSON.stringify(logEntry));
  } catch (error) {
    console.error('Failed to log migration event:', error);
  }
}

// Rollback function for emergencies
async function rollbackMigration(migrationId, blogStore) {
  console.log(`Starting rollback for migration: ${migrationId}`);
  
  try {
    // Find all backups for this migration
    const { blobs } = await blogStore.list({ prefix: `${MIGRATION_CONFIG.BACKUP_PREFIX}${migrationId}_` });
    
    for (const blob of blobs) {
      try {
        const backupData = await blogStore.get(blob.key, { type: "json" });
        
        if (backupData && backupData.originalKey && backupData.data) {
          // Restore original data
          await blogStore.set(backupData.originalKey, JSON.stringify(backupData.data));
          console.log(`Restored: ${backupData.originalKey}`);
        }
      } catch (error) {
        console.error(`Error restoring ${blob.key}:`, error);
      }
    }
    
    console.log('Rollback completed');
    return { success: true, message: 'Migration rolled back successfully' };
    
  } catch (error) {
    console.error('Rollback error:', error);
    return { success: false, error: error.message };
  }
}

// Export rollback function for manual use
export { rollbackMigration };
