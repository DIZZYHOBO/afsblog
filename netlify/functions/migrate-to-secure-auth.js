// netlify/functions/migrate-to-secure-auth.js - Complete Production-Ready Migration Function
import { getStore } from "@netlify/blobs";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Migration configuration constants
const MIGRATION_CONFIG = {
  SALT_ROUNDS: 12,
  BACKUP_PREFIX: 'backup_migration_',
  MIGRATION_BATCH_SIZE: 10,
  MAX_MIGRATION_TIME: 30 * 60 * 1000, // 30 minutes
  PROTECTED_ADMIN: "dumbass"
};

// Main handler function for Netlify
export default async (req, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // Only allow POST requests for security
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers }
    );
  }

  // Verify migration key for security
  const { migrationKey } = requestBody;
  const expectedKey = process.env.MIGRATION_KEY || "your-secret-migration-key";
  
  if (!migrationKey || migrationKey !== expectedKey) {
    console.log('Invalid migration key attempt');
    return new Response(
      JSON.stringify({ error: "Invalid migration key" }),
      { status: 401, headers }
    );
  }

  console.log('Migration request authorized, starting migration...');

  try {
    // Initialize Netlify Blob stores
    const blogStore = getStore("blog-data");
    const apiStore = getStore("blog-api-data");
    const securityStore = getStore("security-data");
    
    // Perform the migration
    const migrationResult = await performSecureMigration(blogStore, apiStore, securityStore);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Migration completed successfully",
        results: migrationResult
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Migration error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Migration failed",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
};

// Main migration orchestration function
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
    console.log('Step 1: Creating backups of existing data...');
    await createDataBackups(blogStore, migrationId);
    results.backupsCreated++;

    // Step 2: Migrate approved users
    console.log('Step 2: Migrating approved users...');
    const userMigrationResult = await migrateApprovedUsers(blogStore);
    results.usersProcessed = userMigrationResult.processed;
    results.errors.push(...userMigrationResult.errors);

    // Step 3: Migrate pending users
    console.log('Step 3: Migrating pending users...');
    const pendingMigrationResult = await migratePendingUsers(blogStore);
    results.pendingUsersProcessed = pendingMigrationResult.processed;
    results.errors.push(...pendingMigrationResult.errors);

    // Step 4: Clean up old sessions
    console.log('Step 4: Cleaning up old sessions...');
    const sessionCleanupResult = await cleanupOldSessions(apiStore);
    results.sessionsCleaned = sessionCleanupResult.cleaned;

    // Step 5: Verify migration integrity
    console.log('Step 5: Verifying migration integrity...');
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

// Create backups of all user data before migration
async function createDataBackups(blogStore, migrationId) {
  const backupTimestamp = new Date().toISOString();
  
  try {
    // Backup all user data
    const { blobs: userBlobs } = await blogStore.list({ prefix: "user_" });
    console.log(`Backing up ${userBlobs.length} user records...`);
    
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
    console.log(`Backing up ${pendingBlobs.length} pending user records...`);
    
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
  } catch (error) {
    console.error('Error creating backups:', error);
    throw new Error(`Backup creation failed: ${error.message}`);
  }
}

// Migrate approved users to secure password storage
async function migrateApprovedUsers(blogStore) {
  const results = {
    processed: 0,
    errors: []
  };

  try {
    const { blobs } = await blogStore.list({ prefix: "user_" });
    const userBlobs = blobs.filter(blob => 
      blob.key.startsWith('user_') && 
      !blob.key.startsWith('user_follows_') &&
      !blob.key.includes('backup_migration_')
    );
    
    console.log(`Found ${userBlobs.length} users to migrate`);
    
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
          console.error(`User ${oldUserData.username} has no password field`);
          continue;
        }

        console.log(`Migrating user: ${oldUserData.username}`);

        // Generate new secure user data
        const saltRounds = MIGRATION_CONFIG.SALT_ROUNDS;
        const passwordHash = await bcrypt.hash(oldUserData.password, saltRounds);
        const salt = await bcrypt.genSalt(saltRounds);

        const newUserData = {
          // Core fields
          id: oldUserData.id || crypto.randomUUID(),
          username: oldUserData.username,
          email: oldUserData.email || null,
          passwordHash: passwordHash,
          passwordSalt: salt,
          
          // Profile fields
          bio: oldUserData.bio || `Hello! I'm ${oldUserData.username}`,
          profilePicture: oldUserData.profilePicture || null,
          
          // Timestamps
          createdAt: oldUserData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: oldUserData.lastLogin || null,
          loginCount: oldUserData.loginCount || 0,
          
          // Permissions
          isAdmin: oldUserData.isAdmin || false,
          
          // Security fields
          emailVerified: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          securityEvents: [],
          
          // Settings
          settings: {
            twoFactorEnabled: false,
            sessionTimeout: 15 * 60 // 15 minutes in seconds
          },
          
          // Migration metadata
          migratedAt: new Date().toISOString(),
          migrationSource: 'legacy_plaintext'
        };

        // Ensure password field is removed
        delete newUserData.password;

        // Store the updated user data
        await blogStore.set(blob.key, JSON.stringify(newUserData));
        
        results.processed++;
        console.log(`Successfully migrated user: ${oldUserData.username}`);

      } catch (error) {
        console.error(`Error migrating user ${blob.key}:`, error);
        results.errors.push(`Failed to migrate user ${blob.key}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in migrateApprovedUsers:', error);
    results.errors.push(`Migration failed: ${error.message}`);
  }

  console.log(`User migration complete: ${results.processed} processed, ${results.errors.length} errors`);
  return results;
}

// Migrate pending users to secure password storage
async function migratePendingUsers(blogStore) {
  const results = {
    processed: 0,
    errors: []
  };

  try {
    const { blobs } = await blogStore.list({ prefix: "pending_user_" });
    const pendingBlobs = blobs.filter(blob => !blob.key.includes('backup_migration_'));
    
    console.log(`Found ${pendingBlobs.length} pending users to migrate`);
    
    for (const blob of pendingBlobs) {
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
          console.error(`Pending user ${oldPendingData.username} has no password field`);
          continue;
        }

        console.log(`Migrating pending user: ${oldPendingData.username}`);

        // Generate new secure pending user data
        const saltRounds = MIGRATION_CONFIG.SALT_ROUNDS;
        const passwordHash = await bcrypt.hash(oldPendingData.password, saltRounds);
        const salt = await bcrypt.genSalt(saltRounds);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newPendingData = {
          // Core fields
          id: oldPendingData.id || crypto.randomUUID(),
          username: oldPendingData.username,
          email: oldPendingData.email || null,
          passwordHash: passwordHash,
          passwordSalt: salt,
          
          // Profile
          bio: oldPendingData.bio || `Hello! I'm ${oldPendingData.username}`,
          
          // Status
          createdAt: oldPendingData.createdAt || new Date().toISOString(),
          status: 'pending',
          isAdmin: false,
          
          // Verification
          emailVerified: false,
          verificationToken: verificationToken,
          verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          
          // Security
          registrationIP: oldPendingData.registrationIP || 'migrated',
          failedLoginAttempts: 0,
          lockedUntil: null,
          securityEvents: [],
          
          // Settings
          settings: {
            twoFactorEnabled: false,
            sessionTimeout: 15 * 60
          },
          
          // Migration metadata
          migratedAt: new Date().toISOString(),
          migrationSource: 'legacy_plaintext'
        };

        // Ensure password field is removed
        delete newPendingData.password;

        // Store the updated pending user data
        await blogStore.set(blob.key, JSON.stringify(newPendingData));
        
        results.processed++;
        console.log(`Successfully migrated pending user: ${oldPendingData.username}`);

      } catch (error) {
        console.error(`Error migrating pending user ${blob.key}:`, error);
        results.errors.push(`Failed to migrate pending user ${blob.key}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in migratePendingUsers:', error);
    results.errors.push(`Pending user migration failed: ${error.message}`);
  }

  console.log(`Pending user migration complete: ${results.processed} processed, ${results.errors.length} errors`);
  return results;
}

// Clean up old session data
async function cleanupOldSessions(apiStore) {
  const results = {
    cleaned: 0
  };

  try {
    // Get all old session keys
    const { blobs } = await apiStore.list({ prefix: "session_" });
    
    console.log(`Found ${blobs.length} sessions to check`);
    
    for (const blob of blobs) {
      try {
        const sessionData = await apiStore.get(blob.key, { type: "json" });
        
        // If it's an old format session (no sessionId field), remove it
        if (sessionData && !sessionData.sessionId) {
          await apiStore.delete(blob.key);
          results.cleaned++;
          console.log(`Deleted old format session: ${blob.key}`);
        } else if (!sessionData) {
          // Delete null/corrupted sessions
          await apiStore.delete(blob.key);
          results.cleaned++;
          console.log(`Deleted corrupted session: ${blob.key}`);
        }
      } catch (error) {
        // If we can't parse it, it's probably corrupted - delete it
        try {
          await apiStore.delete(blob.key);
          results.cleaned++;
          console.log(`Deleted unparseable session: ${blob.key}`);
        } catch (deleteError) {
          console.error(`Failed to delete session ${blob.key}:`, deleteError);
        }
      }
    }

    // Also clean up old current_user keys if they exist
    try {
      await apiStore.delete('current_user');
      console.log('Deleted old current_user key');
      results.cleaned++;
    } catch (error) {
      // Ignore if it doesn't exist
    }

  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
  }

  console.log(`Session cleanup complete: ${results.cleaned} sessions cleaned`);
  return results;
}

// Verify the migration was successful
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
      !blob.key.startsWith('user_follows_') &&
      !blob.key.includes('backup_migration_')
    );

    console.log(`Verifying ${actualUserBlobs.length} users`);

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

        // Verify password hash format (bcrypt hashes start with $2)
        if (userData.passwordHash && !userData.passwordHash.startsWith('$2')) {
          results.errors.push(`User ${userData.username} has invalid password hash format`);
        }

      } catch (error) {
        results.errors.push(`Error verifying user ${blob.key}: ${error.message}`);
      }
    }

    // Verify pending users
    const { blobs: pendingBlobs } = await blogStore.list({ prefix: "pending_user_" });
    const actualPendingBlobs = pendingBlobs.filter(blob => !blob.key.includes('backup_migration_'));

    console.log(`Verifying ${actualPendingBlobs.length} pending users`);

    for (const blob of actualPendingBlobs) {
      try {
        const pendingData = await blogStore.get(blob.key, { type: "json" });
        
        if (!pendingData) {
          results.errors.push(`Pending user data missing: ${blob.key}`);
          continue;
        }

        // Check required fields
        const requiredFields = ['id', 'username', 'passwordHash', 'passwordSalt'];
        for (const field of requiredFields) {
          if (!pendingData[field]) {
            results.errors.push(`Pending user ${pendingData.username || blob.key} missing required field: ${field}`);
          }
        }

        // Check that old password field is removed
        if (pendingData.password) {
          results.errors.push(`Pending user ${pendingData.username} still has insecure password field`);
        }

      } catch (error) {
        results.errors.push(`Error verifying pending user ${blob.key}: ${error.message}`);
      }
    }

    if (results.errors.length > 0) {
      results.valid = false;
      console.log(`Verification found ${results.errors.length} errors`);
    } else {
      console.log('Migration verification passed - all users migrated successfully');
    }

  } catch (error) {
    results.valid = false;
    results.errors.push(`Verification error: ${error.message}`);
  }

  return results;
}

// Log migration events for audit trail
async function logMigrationEvent(securityStore, event) {
  try {
    const eventId = crypto.randomUUID();
    const logEntry = {
      id: eventId,
      ...event,
      category: 'migration'
    };
    
    await securityStore.set(`migration_log_${eventId}`, JSON.stringify(logEntry));
    console.log(`Logged migration event: ${event.type}`);
  } catch (error) {
    console.error('Failed to log migration event:', error);
    // Don't throw - logging failures shouldn't stop migration
  }
}
