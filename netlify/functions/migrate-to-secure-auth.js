// netlify/functions/migrate-to-secure-auth.js - COMPLETE MIGRATION INCLUDING ALL DATA
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

  console.log('Migration request authorized, starting COMPLETE migration...');

  try {
    // Initialize Netlify Blob stores
    const blogStore = getStore("blog-data");
    const apiStore = getStore("blog-api-data");
    const securityStore = getStore("security-data");
    
    // Perform the COMPLETE migration
    const migrationResult = await performCompleteMigration(blogStore, apiStore, securityStore);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Complete migration successful",
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

// COMPLETE migration orchestration function - handles ALL data
async function performCompleteMigration(blogStore, apiStore, securityStore) {
  const startTime = Date.now();
  const migrationId = crypto.randomUUID();
  
  console.log(`Starting COMPLETE data migration: ${migrationId}`);
  
  // Log migration start
  await logMigrationEvent(securityStore, {
    type: 'complete_migration_started',
    migrationId,
    timestamp: new Date().toISOString()
  });

  const results = {
    migrationId,
    startTime: new Date().toISOString(),
    usersProcessed: 0,
    pendingUsersProcessed: 0,
    postsProcessed: 0,
    privatePostsProcessed: 0,
    communitiesProcessed: 0,
    repliesProcessed: 0,
    followsProcessed: 0,
    sessionsCleaned: 0,
    backupsCreated: 0,
    errors: []
  };

  try {
    // Step 1: Create backups of ALL data
    console.log('Step 1: Creating complete backups of ALL data...');
    await createCompleteBackups(blogStore, migrationId);
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

    // Step 4: Migrate ALL posts (public and private)
    console.log('Step 4: Migrating all posts...');
    const postsMigrationResult = await migrateAllPosts(blogStore);
    results.postsProcessed = postsMigrationResult.publicProcessed;
    results.privatePostsProcessed = postsMigrationResult.privateProcessed;
    results.repliesProcessed = postsMigrationResult.repliesProcessed;
    results.errors.push(...postsMigrationResult.errors);

    // Step 5: Migrate communities
    console.log('Step 5: Migrating communities...');
    const communitiesMigrationResult = await migrateCommunities(blogStore);
    results.communitiesProcessed = communitiesMigrationResult.processed;
    results.errors.push(...communitiesMigrationResult.errors);

    // Step 6: Migrate user follows/relationships
    console.log('Step 6: Migrating user follows and relationships...');
    const followsMigrationResult = await migrateUserFollows(blogStore);
    results.followsProcessed = followsMigrationResult.processed;
    results.errors.push(...followsMigrationResult.errors);

    // Step 7: Clean up old sessions
    console.log('Step 7: Cleaning up old sessions...');
    const sessionCleanupResult = await cleanupOldSessions(apiStore);
    results.sessionsCleaned = sessionCleanupResult.cleaned;

    // Step 8: Verify complete migration integrity
    console.log('Step 8: Verifying complete migration integrity...');
    const verificationResult = await verifyCompleteMigrationIntegrity(blogStore);
    if (!verificationResult.valid) {
      throw new Error(`Migration integrity check failed: ${verificationResult.errors.join(', ')}`);
    }

    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;
    results.success = true;

    // Log migration completion
    await logMigrationEvent(securityStore, {
      type: 'complete_migration_completed',
      migrationId,
      results,
      timestamp: new Date().toISOString()
    });

    console.log('COMPLETE migration successful:', results);
    return results;

  } catch (error) {
    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;
    results.success = false;
    results.error = error.message;

    // Log migration failure
    await logMigrationEvent(securityStore, {
      type: 'complete_migration_failed',
      migrationId,
      error: error.message,
      results,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
}

// Create backups of ALL data including posts, communities, etc.
async function createCompleteBackups(blogStore, migrationId) {
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

    // Backup all posts
    const { blobs: postBlobs } = await blogStore.list({ prefix: "post_" });
    console.log(`Backing up ${postBlobs.length} post records...`);
    
    for (const blob of postBlobs) {
      try {
        const postData = await blogStore.get(blob.key, { type: "json" });
        if (postData) {
          const backupKey = `${MIGRATION_CONFIG.BACKUP_PREFIX}${migrationId}_${blob.key}_${Date.now()}`;
          await blogStore.set(backupKey, JSON.stringify({
            originalKey: blob.key,
            migrationId,
            backupTimestamp,
            data: postData
          }));
        }
      } catch (error) {
        console.error(`Error backing up ${blob.key}:`, error);
      }
    }

    // Backup all communities
    const { blobs: communityBlobs } = await blogStore.list({ prefix: "community_" });
    console.log(`Backing up ${communityBlobs.length} community records...`);
    
    for (const blob of communityBlobs) {
      try {
        const communityData = await blogStore.get(blob.key, { type: "json" });
        if (communityData) {
          const backupKey = `${MIGRATION_CONFIG.BACKUP_PREFIX}${migrationId}_${blob.key}_${Date.now()}`;
          await blogStore.set(backupKey, JSON.stringify({
            originalKey: blob.key,
            migrationId,
            backupTimestamp,
            data: communityData
          }));
        }
      } catch (error) {
        console.error(`Error backing up ${blob.key}:`, error);
      }
    }

    console.log('Complete data backups created successfully');
  } catch (error) {
    console.error('Error creating backups:', error);
    throw new Error(`Backup creation failed: ${error.message}`);
  }
}

// Migrate ALL posts including private posts and replies
async function migrateAllPosts(blogStore) {
  const results = {
    publicProcessed: 0,
    privateProcessed: 0,
    repliesProcessed: 0,
    errors: []
  };

  try {
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const postBlobs = blobs.filter(blob => 
      blob.key.startsWith('post_') && 
      !blob.key.includes('backup_migration_')
    );
    
    console.log(`Found ${postBlobs.length} posts to migrate`);
    
    for (const blob of postBlobs) {
      try {
        const postData = await blogStore.get(blob.key, { type: "json" });
        
        if (!postData) {
          console.warn(`Skipping invalid post data: ${blob.key}`);
          continue;
        }

        // Check if already migrated
        if (postData.migratedAt) {
          console.log(`Post ${postData.id} already migrated, skipping`);
          continue;
        }

        console.log(`Migrating post: ${postData.id} (${postData.isPrivate ? 'private' : 'public'})`);

        // Ensure post has all required fields
        const migratedPost = {
          // Core fields
          id: postData.id || crypto.randomUUID(),
          title: postData.title || 'Untitled',
          content: postData.content || '',
          author: postData.author || 'unknown',
          
          // Type and visibility
          type: postData.type || 'text',
          isPrivate: postData.isPrivate || false,
          
          // Community association
          communityName: postData.communityName || null,
          
          // Media/link fields
          url: postData.url || null,
          description: postData.description || null,
          mediaType: postData.mediaType || null,
          
          // Timestamps
          timestamp: postData.timestamp || new Date().toISOString(),
          createdAt: postData.createdAt || postData.timestamp || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          
          // Engagement
          upvotes: postData.upvotes || 0,
          downvotes: postData.downvotes || 0,
          viewCount: postData.viewCount || 0,
          
          // Replies - migrate structure
          replies: [],
          replyCount: 0,
          
          // Migration metadata
          migratedAt: new Date().toISOString(),
          migrationSource: 'legacy_format'
        };

        // Migrate replies if they exist
        if (postData.replies && Array.isArray(postData.replies)) {
          console.log(`  Migrating ${postData.replies.length} replies for post ${postData.id}`);
          
          migratedPost.replies = postData.replies.map(reply => ({
            id: reply.id || crypto.randomUUID(),
            postId: postData.id,
            content: reply.content || '',
            author: reply.author || 'unknown',
            timestamp: reply.timestamp || new Date().toISOString(),
            createdAt: reply.createdAt || reply.timestamp || new Date().toISOString(),
            upvotes: reply.upvotes || 0,
            downvotes: reply.downvotes || 0,
            edited: reply.edited || false,
            editedAt: reply.editedAt || null,
            migratedAt: new Date().toISOString()
          }));
          
          migratedPost.replyCount = migratedPost.replies.length;
          results.repliesProcessed += migratedPost.replies.length;
        }

        // Store the migrated post
        await blogStore.set(blob.key, JSON.stringify(migratedPost));
        
        // Update counters
        if (migratedPost.isPrivate) {
          results.privateProcessed++;
          console.log(`  ✓ Migrated private post: ${migratedPost.id}`);
        } else {
          results.publicProcessed++;
          console.log(`  ✓ Migrated public post: ${migratedPost.id}`);
        }

      } catch (error) {
        console.error(`Error migrating post ${blob.key}:`, error);
        results.errors.push(`Failed to migrate post ${blob.key}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in migrateAllPosts:', error);
    results.errors.push(`Post migration failed: ${error.message}`);
  }

  console.log(`Post migration complete: ${results.publicProcessed} public, ${results.privateProcessed} private, ${results.repliesProcessed} replies, ${results.errors.length} errors`);
  return results;
}

// Migrate communities with member lists
async function migrateCommunities(blogStore) {
  const results = {
    processed: 0,
    errors: []
  };

  try {
    const { blobs } = await blogStore.list({ prefix: "community_" });
    const communityBlobs = blobs.filter(blob => 
      blob.key.startsWith('community_') && 
      !blob.key.includes('backup_migration_')
    );
    
    console.log(`Found ${communityBlobs.length} communities to migrate`);
    
    for (const blob of communityBlobs) {
      try {
        const communityData = await blogStore.get(blob.key, { type: "json" });
        
        if (!communityData) {
          console.warn(`Skipping invalid community data: ${blob.key}`);
          continue;
        }

        // Check if already migrated
        if (communityData.migratedAt) {
          console.log(`Community ${communityData.name} already migrated, skipping`);
          continue;
        }

        console.log(`Migrating community: ${communityData.name}`);

        // Ensure community has all required fields
        const migratedCommunity = {
          // Core fields
          id: communityData.id || crypto.randomUUID(),
          name: communityData.name || blob.key.replace('community_', ''),
          displayName: communityData.displayName || communityData.name || 'Unnamed Community',
          description: communityData.description || '',
          
          // Creator and members
          createdBy: communityData.createdBy || 'unknown',
          members: communityData.members || [communityData.createdBy || 'unknown'],
          moderators: communityData.moderators || [communityData.createdBy || 'unknown'],
          
          // Settings
          isPrivate: communityData.isPrivate || false,
          isArchived: communityData.isArchived || false,
          
          // Stats
          memberCount: communityData.memberCount || (communityData.members ? communityData.members.length : 1),
          postCount: communityData.postCount || 0,
          
          // Timestamps
          createdAt: communityData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastActivity: communityData.lastActivity || communityData.createdAt || new Date().toISOString(),
          
          // Rules and settings
          rules: communityData.rules || [],
          bannedUsers: communityData.bannedUsers || [],
          
          // Migration metadata
          migratedAt: new Date().toISOString(),
          migrationSource: 'legacy_format'
        };

        // Store the migrated community
        await blogStore.set(blob.key, JSON.stringify(migratedCommunity));
        
        results.processed++;
        console.log(`  ✓ Migrated community: ${migratedCommunity.name} with ${migratedCommunity.memberCount} members`);

      } catch (error) {
        console.error(`Error migrating community ${blob.key}:`, error);
        results.errors.push(`Failed to migrate community ${blob.key}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in migrateCommunities:', error);
    results.errors.push(`Community migration failed: ${error.message}`);
  }

  console.log(`Community migration complete: ${results.processed} processed, ${results.errors.length} errors`);
  return results;
}

// Migrate user follows and community memberships
async function migrateUserFollows(blogStore) {
  const results = {
    processed: 0,
    errors: []
  };

  try {
    // Migrate user_follows_* data
    const { blobs } = await blogStore.list({ prefix: "user_follows_" });
    const followBlobs = blobs.filter(blob => !blob.key.includes('backup_migration_'));
    
    console.log(`Found ${followBlobs.length} user follow records to migrate`);
    
    for (const blob of followBlobs) {
      try {
        const followData = await blogStore.get(blob.key, { type: "json" });
        
        if (!followData) {
          console.warn(`Skipping invalid follow data: ${blob.key}`);
          continue;
        }

        // Check if already migrated
        if (followData.migratedAt) {
          console.log(`Follow record ${blob.key} already migrated, skipping`);
          continue;
        }

        const username = blob.key.replace('user_follows_', '');
        console.log(`Migrating follows for user: ${username}`);

        // Ensure follow data has proper structure
        const migratedFollowData = {
          username: username,
          followedCommunities: followData.followedCommunities || followData || [],
          followedUsers: followData.followedUsers || [],
          followers: followData.followers || [],
          blockedUsers: followData.blockedUsers || [],
          
          // Timestamps
          createdAt: followData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          
          // Migration metadata
          migratedAt: new Date().toISOString(),
          migrationSource: 'legacy_format'
        };

        // Store the migrated follow data
        await blogStore.set(blob.key, JSON.stringify(migratedFollowData));
        
        results.processed++;
        console.log(`  ✓ Migrated follows for ${username}: ${migratedFollowData.followedCommunities.length} communities`);

      } catch (error) {
        console.error(`Error migrating follow data ${blob.key}:`, error);
        results.errors.push(`Failed to migrate follow data ${blob.key}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in migrateUserFollows:', error);
    results.errors.push(`Follow migration failed: ${error.message}`);
  }

  console.log(`User follows migration complete: ${results.processed} processed, ${results.errors.length} errors`);
  return results;
}

// [Include the existing user migration functions - migrateApprovedUsers and migratePendingUsers from previous code]
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

// Verify the COMPLETE migration was successful
async function verifyCompleteMigrationIntegrity(blogStore) {
  const results = {
    valid: true,
    errors: []
  };

  try {
    // Verify users
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
      } catch (error) {
        results.errors.push(`Error verifying user ${blob.key}: ${error.message}`);
      }
    }

    // Verify posts
    const { blobs: postBlobs } = await blogStore.list({ prefix: "post_" });
    const actualPostBlobs = postBlobs.filter(blob => !blob.key.includes('backup_migration_'));
    
    console.log(`Verifying ${actualPostBlobs.length} posts`);
    
    let privatePostCount = 0;
    let publicPostCount = 0;
    
    for (const blob of actualPostBlobs) {
      try {
        const postData = await blogStore.get(blob.key, { type: "json" });
        
        if (!postData) {
          results.errors.push(`Post data missing: ${blob.key}`);
          continue;
        }
        
        if (!postData.migratedAt) {
          results.errors.push(`Post ${postData.id || blob.key} not migrated`);
        }
        
        if (postData.isPrivate) {
          privatePostCount++;
        } else {
          publicPostCount++;
        }
      } catch (error) {
        results.errors.push(`Error verifying post ${blob.key}: ${error.message}`);
      }
    }
    
    console.log(`Verified ${publicPostCount} public posts and ${privatePostCount} private posts`);

    // Verify communities
    const { blobs: communityBlobs } = await blogStore.list({ prefix: "community_" });
    const actualCommunityBlobs = communityBlobs.filter(blob => !blob.key.includes('backup_migration_'));
    
    console.log(`Verifying ${actualCommunityBlobs.length} communities`);
    
    for (const blob of actualCommunityBlobs) {
      try {
        const communityData = await blogStore.get(blob.key, { type: "json" });
        
        if (!communityData) {
          results.errors.push(`Community data missing: ${blob.key}`);
          continue;
        }
        
        if (!communityData.migratedAt) {
          results.errors.push(`Community ${communityData.name || blob.key} not migrated`);
        }
      } catch (error) {
        results.errors.push(`Error verifying community ${blob.key}: ${error.message}`);
      }
    }

    if (results.errors.length > 0) {
      results.valid = false;
      console.log(`Verification found ${results.errors.length} errors`);
    } else {
      console.log('COMPLETE migration verification passed - all data migrated successfully');
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
