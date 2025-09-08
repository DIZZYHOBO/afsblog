// netlify/functions/migrate-to-secure-auth.js - Clean, complete migration
import { getStore } from "@netlify/blobs";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export default async (req, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { migrationKey } = await req.json();
    const expectedKey = process.env.MIGRATION_KEY || "your-secret-migration-key";
    
    if (!migrationKey || migrationKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Invalid migration key" }),
        { status: 401, headers }
      );
    }

    console.log('Starting complete migration...');
    
    const blogStore = getStore("blog-data");
    const apiStore = getStore("blog-api-data");
    const securityStore = getStore("security-data");
    
    const results = await performMigration(blogStore, apiStore, securityStore);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Migration completed successfully",
        results
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

async function performMigration(blogStore, apiStore, securityStore) {
  const migrationId = crypto.randomUUID();
  const startTime = Date.now();
  
  const results = {
    migrationId,
    startTime: new Date().toISOString(),
    users: { processed: 0, errors: [] },
    pendingUsers: { processed: 0, errors: [] },
    posts: { processed: 0, private: 0, errors: [] },
    communities: { processed: 0, errors: [] },
    follows: { processed: 0, errors: [] },
    backups: 0
  };

  try {
    // Step 1: Create backups
    console.log('Creating backups...');
    await createBackups(blogStore, migrationId);
    results.backups++;

    // Step 2: Migrate users
    console.log('Migrating users...');
    await migrateUsers(blogStore, results.users);

    // Step 3: Migrate pending users
    console.log('Migrating pending users...');
    await migratePendingUsers(blogStore, results.pendingUsers);

    // Step 4: Migrate posts (including private)
    console.log('Migrating posts...');
    await migratePosts(blogStore, results.posts);

    // Step 5: Migrate communities
    console.log('Migrating communities...');
    await migrateCommunities(blogStore, results.communities);

    // Step 6: Migrate user follows
    console.log('Migrating user follows...');
    await migrateFollows(blogStore, results.follows);

    // Step 7: Clean old sessions
    console.log('Cleaning sessions...');
    await cleanSessions(apiStore);

    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;
    results.success = true;

    console.log('Migration completed:', results);
    return results;

  } catch (error) {
    results.error = error.message;
    results.success = false;
    throw error;
  }
}

// Create backups of all data
async function createBackups(blogStore, migrationId) {
  const prefixes = ['user_', 'pending_user_', 'post_', 'community_'];
  
  for (const prefix of prefixes) {
    const { blobs } = await blogStore.list({ prefix });
    console.log(`Backing up ${blobs.length} ${prefix} records`);
    
    for (const blob of blobs) {
      if (blob.key.includes('backup_')) continue;
      
      const data = await blogStore.get(blob.key, { type: "json" });
      if (data) {
        await blogStore.set(
          `backup_${migrationId}_${blob.key}`,
          JSON.stringify(data)
        );
      }
    }
  }
}

// Migrate regular users
async function migrateUsers(blogStore, results) {
  const { blobs } = await blogStore.list({ prefix: "user_" });
  
  for (const blob of blobs) {
    if (blob.key.includes('backup_') || blob.key.startsWith('user_follows_')) continue;
    
    try {
      const user = await blogStore.get(blob.key, { type: "json" });
      if (!user) continue;

      // Skip if already migrated
      if (user.passwordHash && !user.password) {
        console.log(`User ${user.username} already migrated`);
        continue;
      }

      if (!user.password) {
        results.errors.push(`User ${user.username} has no password`);
        continue;
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

      // Update user object
      const migratedUser = {
        ...user,
        id: user.id || crypto.randomUUID(),
        passwordHash,
        passwordSalt: await bcrypt.genSalt(SALT_ROUNDS),
        emailVerified: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        securityEvents: [],
        settings: {
          twoFactorEnabled: false,
          sessionTimeout: 900
        },
        migratedAt: new Date().toISOString()
      };

      // Remove plain password
      delete migratedUser.password;

      await blogStore.set(blob.key, JSON.stringify(migratedUser));
      results.processed++;
      console.log(`Migrated user: ${user.username}`);

    } catch (error) {
      console.error(`Error migrating ${blob.key}:`, error);
      results.errors.push(`${blob.key}: ${error.message}`);
    }
  }
}

// Migrate pending users
async function migratePendingUsers(blogStore, results) {
  const { blobs } = await blogStore.list({ prefix: "pending_user_" });
  
  for (const blob of blobs) {
    if (blob.key.includes('backup_')) continue;
    
    try {
      const user = await blogStore.get(blob.key, { type: "json" });
      if (!user) continue;

      // Skip if already migrated
      if (user.passwordHash && !user.password) {
        console.log(`Pending user ${user.username} already migrated`);
        continue;
      }

      if (!user.password) {
        results.errors.push(`Pending user ${user.username} has no password`);
        continue;
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

      // Update pending user object
      const migratedUser = {
        ...user,
        id: user.id || crypto.randomUUID(),
        passwordHash,
        passwordSalt: await bcrypt.genSalt(SALT_ROUNDS),
        status: 'pending',
        emailVerified: false,
        verificationToken: crypto.randomBytes(32).toString('hex'),
        verificationExpiry: new Date(Date.now() + 86400000).toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        securityEvents: [],
        settings: {
          twoFactorEnabled: false,
          sessionTimeout: 900
        },
        migratedAt: new Date().toISOString()
      };

      // Remove plain password
      delete migratedUser.password;

      await blogStore.set(blob.key, JSON.stringify(migratedUser));
      results.processed++;
      console.log(`Migrated pending user: ${user.username}`);

    } catch (error) {
      console.error(`Error migrating ${blob.key}:`, error);
      results.errors.push(`${blob.key}: ${error.message}`);
    }
  }
}

// Migrate all posts including private ones
async function migratePosts(blogStore, results) {
  const { blobs } = await blogStore.list({ prefix: "post_" });
  
  for (const blob of blobs) {
    if (blob.key.includes('backup_')) continue;
    
    try {
      const post = await blogStore.get(blob.key, { type: "json" });
      if (!post) continue;

      // Skip if already migrated
      if (post.migratedAt) {
        console.log(`Post ${post.id} already migrated`);
        continue;
      }

      // Ensure all fields exist
      const migratedPost = {
        ...post,
        id: post.id || crypto.randomUUID(),
        title: post.title || 'Untitled',
        content: post.content || '',
        author: post.author || 'unknown',
        type: post.type || 'text',
        isPrivate: post.isPrivate || false,
        communityName: post.communityName || null,
        timestamp: post.timestamp || new Date().toISOString(),
        createdAt: post.createdAt || post.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        upvotes: post.upvotes || 0,
        downvotes: post.downvotes || 0,
        viewCount: post.viewCount || 0,
        replies: post.replies || [],
        replyCount: (post.replies || []).length,
        migratedAt: new Date().toISOString()
      };

      await blogStore.set(blob.key, JSON.stringify(migratedPost));
      results.processed++;
      
      if (migratedPost.isPrivate) {
        results.private++;
        console.log(`Migrated private post: ${post.id}`);
      } else {
        console.log(`Migrated public post: ${post.id}`);
      }

    } catch (error) {
      console.error(`Error migrating ${blob.key}:`, error);
      results.errors.push(`${blob.key}: ${error.message}`);
    }
  }
}

// Migrate communities
async function migrateCommunities(blogStore, results) {
  const { blobs } = await blogStore.list({ prefix: "community_" });
  
  for (const blob of blobs) {
    if (blob.key.includes('backup_')) continue;
    
    try {
      const community = await blogStore.get(blob.key, { type: "json" });
      if (!community) continue;

      // Skip if already migrated
      if (community.migratedAt) {
        console.log(`Community ${community.name} already migrated`);
        continue;
      }

      // Ensure all fields exist
      const migratedCommunity = {
        ...community,
        id: community.id || crypto.randomUUID(),
        name: community.name || blob.key.replace('community_', ''),
        displayName: community.displayName || community.name,
        description: community.description || '',
        createdBy: community.createdBy || 'unknown',
        members: community.members || [community.createdBy || 'unknown'],
        moderators: community.moderators || [community.createdBy || 'unknown'],
        isPrivate: community.isPrivate || false,
        memberCount: community.members?.length || 1,
        createdAt: community.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rules: community.rules || [],
        bannedUsers: community.bannedUsers || [],
        migratedAt: new Date().toISOString()
      };

      await blogStore.set(blob.key, JSON.stringify(migratedCommunity));
      results.processed++;
      console.log(`Migrated community: ${community.name}`);

    } catch (error) {
      console.error(`Error migrating ${blob.key}:`, error);
      results.errors.push(`${blob.key}: ${error.message}`);
    }
  }
}

// Migrate user follows
async function migrateFollows(blogStore, results) {
  const { blobs } = await blogStore.list({ prefix: "user_follows_" });
  
  for (const blob of blobs) {
    if (blob.key.includes('backup_')) continue;
    
    try {
      const follows = await blogStore.get(blob.key, { type: "json" });
      if (!follows) continue;

      // Skip if already migrated
      if (follows.migratedAt) {
        console.log(`Follows ${blob.key} already migrated`);
        continue;
      }

      const username = blob.key.replace('user_follows_', '');
      
      // Handle both array and object formats
      const migratedFollows = {
        username,
        followedCommunities: Array.isArray(follows) ? follows : (follows.followedCommunities || []),
        followedUsers: follows.followedUsers || [],
        followers: follows.followers || [],
        blockedUsers: follows.blockedUsers || [],
        createdAt: follows.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedAt: new Date().toISOString()
      };

      await blogStore.set(blob.key, JSON.stringify(migratedFollows));
      results.processed++;
      console.log(`Migrated follows for: ${username}`);

    } catch (error) {
      console.error(`Error migrating ${blob.key}:`, error);
      results.errors.push(`${blob.key}: ${error.message}`);
    }
  }
}

// Clean old sessions
async function cleanSessions(apiStore) {
  const { blobs } = await apiStore.list({ prefix: "session_" });
  let cleaned = 0;
  
  for (const blob of blobs) {
    try {
      const session = await apiStore.get(blob.key, { type: "json" });
      if (!session || !session.sessionId) {
        await apiStore.delete(blob.key);
        cleaned++;
      }
    } catch (error) {
      await apiStore.delete(blob.key);
      cleaned++;
    }
  }
  
  console.log(`Cleaned ${cleaned} old sessions`);
}
