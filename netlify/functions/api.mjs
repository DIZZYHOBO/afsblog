
// netlify/functions/api.js - COMPLETE PRODUCTION BACKEND API WITH FIXES
import { getStore } from "@netlify/blobs";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Enhanced security configuration
const SECURITY_CONFIG = {
  // Environment variables (must be set in Netlify)
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
  MASTER_API_KEY: process.env.MASTER_API_KEY || "your-secret-master-key-here",
  
  // Token lifetimes
  ACCESS_TOKEN_LIFETIME: 15 * 60, // 15 minutes
  REFRESH_TOKEN_LIFETIME: 7 * 24 * 60 * 60, // 7 days
  REMEMBER_ME_LIFETIME: 30 * 24 * 60 * 60, // 30 days
  
  // Rate limiting (per IP address)
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: { max: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
    REGISTRATION: { max: 3, window: 60 * 60 * 1000 }, // 3 registrations per hour
    PASSWORD_RESET: { max: 3, window: 60 * 60 * 1000 }, // 3 resets per hour
    API_CALLS: { max: 100, window: 60 * 1000 } // 100 calls per minute
  },
  
  // Account security
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
  
  // Password requirements
  PASSWORD_MIN_LENGTH: 9,
  PASSWORD_REQUIREMENTS: {
    minLength: 9,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLength: 128
  },
  
  // Session security
  MAX_CONCURRENT_SESSIONS: 5,
  SESSION_ROTATION_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  
  // CORS settings
  ALLOWED_ORIGINS: [
    'https://your-domain.netlify.app',
    'https://localhost:3000',
    'http://localhost:8888'
  ],
  
  PROTECTED_ADMIN: "dumbass" // Protected admin that cannot be demoted
};

export default async (req, context) => {
  const store = getStore("blog-api-data");
  const blogStore = getStore("blog-data");
  const securityStore = getStore("security-data");
  
  // Enhanced CORS headers
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Parse the path more carefully
    let path = url.pathname;
    
    // Remove leading slash
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // Remove .netlify/functions/api/ prefix if present
    if (path.startsWith('.netlify/functions/api/')) {
      path = path.substring('.netlify/functions/api/'.length);
    } else if (path.startsWith('netlify/functions/api/')) {
      path = path.substring('netlify/functions/api/'.length);
    } else if (path.startsWith('api/')) {
      path = path.substring('api/'.length);
    }
    
    const clientIP = getClientIP(req);
    
    console.log('API Request - Full URL:', req.url);
    console.log('API Request - Parsed Path:', path, 'Method:', req.method);

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(securityStore, clientIP, path, req.method);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          retryAfter: rateLimitResult.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Retry-After': rateLimitResult.retryAfter.toString() 
          } 
        }
      );
    }

    // Security logging
    await logSecurityEvent(securityStore, {
      type: 'api_request',
      ip: clientIP,
      path: path,
      method: req.method,
      userAgent: req.headers.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Authentication endpoints (no auth required)
    if (path === 'auth/register') {
      return await handleSecureRegister(req, blogStore, securityStore, corsHeaders, clientIP);
    }
    
    if (path === 'auth/login') {
      return await handleSecureLogin(req, blogStore, securityStore, corsHeaders, clientIP);
    }
    
    if (path === 'auth/refresh') {
      return await handleTokenRefresh(req, store, corsHeaders);
    }
    
    if (path === 'auth/logout') {
      return await handleSecureLogout(req, store, securityStore, corsHeaders);
    }

    // IMPORTANT: Check for 'communities/following' FIRST before any other community routes
    if (path === 'communities/following' && req.method === 'GET') {
      console.log('Handling communities/following endpoint');
      // This requires authentication
      const authResult = await validateSecureAuth(req, store, blogStore);
      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: authResult.error }),
          { status: authResult.status, headers: corsHeaders }
        );
      }
      return await handleGetFollowedCommunities(blogStore, corsHeaders, authResult.user);
    }

    // Public endpoints (no auth required)
    if (path === 'communities' && req.method === 'GET') {
      return await handleGetCommunities(req, blogStore, corsHeaders);
    }
    
    // Handle community follow/unfollow endpoints BEFORE the generic community GET
    if (path.match(/^communities\/[^\/]+\/follow$/) && req.method === 'POST') {
      const communityName = path.split('/')[1];
      const authResult = await validateSecureAuth(req, store, blogStore);
      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: authResult.error }),
          { status: authResult.status, headers: corsHeaders }
        );
      }
      return await handleFollowCommunity(communityName, blogStore, corsHeaders, authResult.user);
    }
    
    if (path.match(/^communities\/[^\/]+\/unfollow$/) && req.method === 'POST') {
      const communityName = path.split('/')[1];
      const authResult = await validateSecureAuth(req, store, blogStore);
      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: authResult.error }),
          { status: authResult.status, headers: corsHeaders }
        );
      }
      return await handleUnfollowCommunity(communityName, blogStore, corsHeaders, authResult.user);
    }
    
    // Now handle other community paths
    if (path.startsWith('communities/') && req.method === 'GET') {
      const parts = path.split('/');
      const communityName = parts[1];
      
      // Double-check this isn't the 'following' endpoint
      if (communityName === 'following') {
        console.log('Following endpoint caught in generic handler - redirecting');
        const authResult = await validateSecureAuth(req, store, blogStore);
        if (!authResult.valid) {
          return new Response(
            JSON.stringify({ error: authResult.error }),
            { status: authResult.status, headers: corsHeaders }
          );
        }
        return await handleGetFollowedCommunities(blogStore, corsHeaders, authResult.user);
      }
      
      if (parts[2] === 'posts') {
        return await handleCommunityPosts(req, blogStore, corsHeaders, communityName);
      } else if (!parts[2]) {
        return await handleGetCommunity(req, blogStore, corsHeaders, communityName);
      }
    }
    
    if (path === 'posts' && req.method === 'GET') {
      return await handleGetPosts(req, blogStore, corsHeaders);
    }
    
    if (path.startsWith('posts/') && path.endsWith('/replies') && req.method === 'GET') {
      const postId = path.split('/')[1];
      return await handleGetReplies(req, blogStore, corsHeaders, postId);
    }
    
    if (path.startsWith('users/') && req.method === 'GET') {
      const username = path.split('/')[1];
      return await handleGetUserProfile(req, blogStore, corsHeaders, username);
    }

    // Protected endpoints - validate authentication
    const authResult = await validateSecureAuth(req, store, blogStore);
    if (!authResult.valid) {
      await logSecurityEvent(securityStore, {
        type: 'auth_failure',
        ip: clientIP,
        path: path,
        reason: authResult.error,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: corsHeaders }
      );
    }

    // Update user's last activity
    await updateUserActivity(store, authResult.user.username);

    // Admin endpoints (require admin privileges)
    if (path.startsWith('admin/')) {
      if (!authResult.user.isAdmin) {
        await logSecurityEvent(securityStore, {
          type: 'unauthorized_admin_access',
          ip: clientIP,
          username: authResult.user.username,
          path: path,
          timestamp: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({ error: "Admin privileges required" }),
          { status: 403, headers: corsHeaders }
        );
      }
      
      return await handleAdminEndpoints(path, req, blogStore, securityStore, corsHeaders, authResult.user);
    }

    // Security endpoints
    if (path === 'security/sessions') {
      return await handleUserSessions(req, store, corsHeaders, authResult.user);
    }
    
    if (path === 'security/change-password') {
      return await handleChangePassword(req, blogStore, securityStore, corsHeaders, authResult.user, clientIP);
    }
    
    if (path === 'security/login-history') {
      return await handleLoginHistory(req, securityStore, corsHeaders, authResult.user);
    }
    
    if (path.startsWith('security/sessions/') && req.method === 'DELETE') {
      const sessionId = path.split('/')[2];
      return await handleTerminateSession(sessionId, store, corsHeaders, authResult.user);
    }

    // Regular authenticated endpoints
    return await handleAuthenticatedEndpoints(path, req, blogStore, store, corsHeaders, authResult.user);

  } catch (error) {
    console.error("API error:", error);
    
    // Log security incident
    await logSecurityEvent(securityStore, {
      type: 'api_error',
      ip: getClientIP(req),
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        id: crypto.randomUUID() // Error tracking ID
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

// ==============================================
// USER FOLLOWS DATA MIGRATION
// ==============================================

async function migrateUserFollowsData(blogStore, username) {
  try {
    const followsKey = `user_follows_${username}`;
    const existingData = await blogStore.get(followsKey, { type: "json" });
    
    if (!existingData) {
      // No existing data, create empty structure
      const newData = {
        username: username,
        communities: [],
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await blogStore.set(followsKey, JSON.stringify(newData));
      console.log('Created new follows structure for user:', username);
      return newData;
    }
    
    // Check if data needs migration
    if (Array.isArray(existingData)) {
      // Old format: direct array of community names
      console.log('Migrating old format follows for user:', username);
      
      const newData = {
        username: username,
        communities: existingData, // Preserve the existing followed communities
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedAt: new Date().toISOString()
      };
      
      await blogStore.set(followsKey, JSON.stringify(newData));
      console.log('Migrated follows data for user:', username);
      return newData;
    }
    
    // Check if it's using 'followedCommunities' instead of 'communities'
    if (existingData.followedCommunities && !existingData.communities) {
      console.log('Normalizing follows property name for user:', username);
      
      existingData.communities = existingData.followedCommunities;
      delete existingData.followedCommunities;
      existingData.updatedAt = new Date().toISOString();
      
      await blogStore.set(followsKey, JSON.stringify(existingData));
      return existingData;
    }
    
    // Ensure communities array exists
    if (!existingData.communities) {
      console.log('Adding missing communities array for user:', username);
      existingData.communities = [];
      existingData.updatedAt = new Date().toISOString();
      
      await blogStore.set(followsKey, JSON.stringify(existingData));
      return existingData;
    }
    
    // Data is already in correct format
    return existingData;
    
  } catch (error) {
    console.error('Error migrating user follows data:', error);
    // Return a safe default
    return {
      username: username,
      communities: [],
      followedUsers: [],
      followers: [],
      blockedUsers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

// ==============================================
// ADMIN ENDPOINTS
// ==============================================

async function handleAdminEndpoints(path, req, blogStore, securityStore, headers, user) {
  const adminPath = path.replace('admin/', '');
  
  if (adminPath === 'stats' && req.method === 'GET') {
    return await handleAdminStats(blogStore, headers);
  }
  
  if (adminPath === 'pending-users' && req.method === 'GET') {
    return await handleGetPendingUsers(blogStore, headers);
  }
  
  if (adminPath === 'approve-user' && req.method === 'POST') {
    return await handleApproveUser(req, blogStore, headers);
  }
  
  if (adminPath === 'reject-user' && req.method === 'POST') {
    return await handleRejectUser(req, blogStore, headers);
  }
  
  if (adminPath === 'users' && req.method === 'GET') {
    return await handleGetAllUsers(blogStore, headers);
  }
  
  if (adminPath === 'promote' && req.method === 'POST') {
    return await handlePromoteUser(req, blogStore, headers, user);
  }
  
  if (adminPath === 'demote' && req.method === 'POST') {
    return await handleDemoteUser(req, blogStore, headers, user);
  }
  
  if (adminPath.startsWith('users/') && req.method === 'DELETE') {
    const username = adminPath.split('/')[1];
    return await handleDeleteUser(username, blogStore, headers, user);
  }
  
  if (adminPath === 'communities' && req.method === 'GET') {
    return await handleGetAllCommunities(blogStore, headers);
  }
  
  return new Response(
    JSON.stringify({ error: "Admin endpoint not found" }),
    { status: 404, headers }
  );
}

async function handleAdminStats(blogStore, headers) {
  try {
    // Get all users
    const { blobs: userBlobs } = await blogStore.list({ prefix: "user_" });
    const totalUsers = userBlobs.filter(b => !b.key.includes('follows')).length;
    
    // Get pending users
    const { blobs: pendingBlobs } = await blogStore.list({ prefix: "pending_user_" });
    const pendingUsers = pendingBlobs.length;
    
    // Get posts (only public posts for admin stats)
    const { blobs: postBlobs } = await blogStore.list({ prefix: "post_" });
    let totalPosts = 0;
    
    for (const blob of postBlobs) {
      const post = await blogStore.get(blob.key, { type: "json" });
      if (post && !post.isPrivate) {
        totalPosts++;
      }
    }
    
    // Get communities
    const { blobs: communityBlobs } = await blogStore.list({ prefix: "community_" });
    const totalCommunities = communityBlobs.length;
    
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalUsers,
          pendingUsers,
          totalPosts,
          totalCommunities
        }
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Admin stats error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load admin stats" }),
      { status: 500, headers }
    );
  }
}

async function handleGetPendingUsers(blogStore, headers) {
  try {
    const { blobs } = await blogStore.list({ prefix: "pending_user_" });
    const pendingUsers = [];
    
    for (const blob of blobs) {
      const userData = await blogStore.get(blob.key, { type: "json" });
      if (userData) {
        pendingUsers.push({
          ...userData,
          key: blob.key
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        pendingUsers
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get pending users error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load pending users" }),
      { status: 500, headers }
    );
  }
}

async function handleApproveUser(req, blogStore, headers) {
  try {
    const { username, pendingKey } = await req.json();
    
    const pendingUser = await blogStore.get(pendingKey, { type: "json" });
    if (!pendingUser) {
      return new Response(
        JSON.stringify({ error: "Pending user not found" }),
        { status: 404, headers }
      );
    }
    
    // Move to approved users
    const approvedUser = {
      ...pendingUser,
      status: 'active',
      approvedAt: new Date().toISOString()
    };
    
    await blogStore.set(`user_${username}`, JSON.stringify(approvedUser));
    await blogStore.delete(pendingKey);
    
    // Initialize user follows data
    await migrateUserFollowsData(blogStore, username);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "User approved successfully"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Approve user error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to approve user" }),
      { status: 500, headers }
    );
  }
}

async function handleRejectUser(req, blogStore, headers) {
  try {
    const { username, pendingKey } = await req.json();
    
    await blogStore.delete(pendingKey);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "User rejected"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Reject user error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to reject user" }),
      { status: 500, headers }
    );
  }
}

async function handleGetAllUsers(blogStore, headers) {
  try {
    const { blobs } = await blogStore.list({ prefix: "user_" });
    const users = [];
    
    for (const blob of blobs) {
      if (!blob.key.includes('follows')) {
        const userData = await blogStore.get(blob.key, { type: "json" });
        if (userData) {
          // Remove sensitive data
          const { passwordHash, passwordSalt, ...safeUser } = userData;
          users.push(safeUser);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        users
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get all users error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load users" }),
      { status: 500, headers }
    );
  }
}

async function handlePromoteUser(req, blogStore, headers, adminUser) {
  try {
    const { username } = await req.json();
    
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }
    
    user.isAdmin = true;
    user.promotedAt = new Date().toISOString();
    user.promotedBy = adminUser.username;
    
    await blogStore.set(`user_${username}`, JSON.stringify(user));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "User promoted to admin"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Promote user error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to promote user" }),
      { status: 500, headers }
    );
  }
}

async function handleDemoteUser(req, blogStore, headers, adminUser) {
  try {
    const { username } = await req.json();
    
    if (username === SECURITY_CONFIG.PROTECTED_ADMIN) {
      return new Response(
        JSON.stringify({ error: "Cannot demote protected admin" }),
        { status: 403, headers }
      );
    }
    
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }
    
    user.isAdmin = false;
    user.demotedAt = new Date().toISOString();
    user.demotedBy = adminUser.username;
    
    await blogStore.set(`user_${username}`, JSON.stringify(user));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin privileges removed"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Demote user error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to demote user" }),
      { status: 500, headers }
    );
  }
}

async function handleDeleteUser(username, blogStore, headers, adminUser) {
  try {
    if (username === adminUser.username) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 403, headers }
      );
    }
    
    if (username === SECURITY_CONFIG.PROTECTED_ADMIN) {
      return new Response(
        JSON.stringify({ error: "Cannot delete protected admin" }),
        { status: 403, headers }
      );
    }
    
    // Delete user data
    await blogStore.delete(`user_${username}`);
    await blogStore.delete(`user_follows_${username}`);
    
    // Delete user's posts
    const { blobs: postBlobs } = await blogStore.list({ prefix: "post_" });
    for (const blob of postBlobs) {
      const post = await blogStore.get(blob.key, { type: "json" });
      if (post && post.author === username) {
        await blogStore.delete(blob.key);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to delete user" }),
      { status: 500, headers }
    );
  }
}

async function handleGetAllCommunities(blogStore, headers) {
  try {
    const { blobs } = await blogStore.list({ prefix: "community_" });
    const communities = [];
    
    for (const blob of blobs) {
      const community = await blogStore.get(blob.key, { type: "json" });
      if (community) {
        communities.push(community);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        communities
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get all communities error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load communities" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// AUTHENTICATED ENDPOINTS
// ==============================================

async function handleAuthenticatedEndpoints(path, req, blogStore, store, headers, user) {
  // Community endpoints
  if (path === 'communities' && req.method === 'POST') {
    return await handleCreateCommunity(req, blogStore, headers, user);
  }
  
  if (path.startsWith('communities/') && req.method === 'DELETE') {
    const communityName = path.split('/')[1];
    return await handleDeleteCommunity(communityName, blogStore, headers, user);
  }
  
  // Post endpoints
  if (path === 'posts' && req.method === 'POST') {
    return await handleCreatePost(req, blogStore, headers, user);
  }
  
  if (path.startsWith('posts/') && req.method === 'DELETE') {
    const postId = path.split('/')[1];
    return await handleDeletePost(postId, blogStore, headers, user);
  }
  
  if (path.startsWith('posts/') && path.endsWith('/vote') && req.method === 'POST') {
    const postId = path.split('/')[1];
    return await handleVotePost(postId, req, blogStore, headers, user);
  }
  
  // Reply endpoints
  if (path.startsWith('posts/') && path.endsWith('/replies') && req.method === 'POST') {
    const postId = path.split('/')[1];
    return await handleCreateReply(postId, req, blogStore, headers, user);
  }
  
  if (path.match(/^posts\/[^\/]+\/replies\/[^\/]+$/) && req.method === 'DELETE') {
    const parts = path.split('/');
    const postId = parts[1];
    const replyId = parts[3];
    return await handleDeleteReply(postId, replyId, blogStore, headers, user);
  }
  
  // Profile endpoints
  if (path === 'profile' && req.method === 'PUT') {
    return await handleUpdateProfile(req, blogStore, headers, user);
  }
  
  return new Response(
    JSON.stringify({ error: "Endpoint not found" }),
    { status: 404, headers }
  );
}

// ==============================================
// COMMUNITY HANDLERS
// ==============================================

async function handleGetCommunities(req, blogStore, headers) {
  try {
    const { blobs } = await blogStore.list({ prefix: "community_" });
    const communities = [];
    
    for (const blob of blobs) {
      const community = await blogStore.get(blob.key, { type: "json" });
      if (community) {
        communities.push(community);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        communities
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get communities error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load communities" }),
      { status: 500, headers }
    );
  }
}

async function handleGetCommunity(req, blogStore, headers, communityName) {
  try {
    const community = await blogStore.get(`community_${communityName}`, { type: "json" });
    
    if (!community) {
      return new Response(
        JSON.stringify({ error: "Community not found" }),
        { status: 404, headers }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        community
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get community error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load community" }),
      { status: 500, headers }
    );
  }
}

async function handleCreateCommunity(req, blogStore, headers, user) {
  try {
    const { name, displayName, description } = await req.json();
    
    console.log('Creating community:', { name, displayName, description, user: user.username });
    
    if (!name || !displayName) {
      return new Response(
        JSON.stringify({ error: "Community name and display name are required" }),
        { status: 400, headers }
      );
    }
    
    // Validate name format
    if (!/^[a-z0-9_]+$/.test(name)) {
      return new Response(
        JSON.stringify({ error: "Community name can only contain lowercase letters, numbers, and underscores" }),
        { status: 400, headers }
      );
    }
    
    // Check if community already exists
    const existing = await blogStore.get(`community_${name}`, { type: "json" });
    if (existing) {
      return new Response(
        JSON.stringify({ error: "Community already exists" }),
        { status: 409, headers }
      );
    }
    
    const community = {
      name,
      displayName,
      description: description || '',
      createdBy: user.username,
      createdAt: new Date().toISOString(),
      members: [user.username],
      postCount: 0
    };
    
    await blogStore.set(`community_${name}`, JSON.stringify(community));
    console.log('Community created successfully:', community);
    
    // Add to user's followed communities
    const userFollows = await migrateUserFollowsData(blogStore, user.username);
    if (!userFollows.communities.includes(name)) {
      userFollows.communities.push(name);
      userFollows.updatedAt = new Date().toISOString();
      await blogStore.set(`user_follows_${user.username}`, JSON.stringify(userFollows));
      console.log('Added community to user follows:', name);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        community
      }),
      { status: 201, headers }
    );
  } catch (error) {
    console.error('Create community error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to create community: " + error.message }),
      { status: 500, headers }
    );
  }
}

async function handleFollowCommunity(communityName, blogStore, headers, user) {
  try {
    console.log(`User ${user.username} attempting to follow community: ${communityName}`);
    
    const community = await blogStore.get(`community_${communityName}`, { type: "json" });
    
    if (!community) {
      return new Response(
        JSON.stringify({ error: "Community not found" }),
        { status: 404, headers }
      );
    }
    
    // Migrate and update user's follows
    const userFollows = await migrateUserFollowsData(blogStore, user.username);
    console.log('Current user follows:', userFollows);
    
    if (!userFollows.communities.includes(communityName)) {
      userFollows.communities.push(communityName);
      userFollows.updatedAt = new Date().toISOString();
      await blogStore.set(`user_follows_${user.username}`, JSON.stringify(userFollows));
      console.log(`Added ${communityName} to user follows`);
      
      // Update community members count
      if (!community.members) {
        community.members = [];
      }
      if (!community.members.includes(user.username)) {
        community.members.push(user.username);
        await blogStore.set(`community_${communityName}`, JSON.stringify(community));
        console.log(`Added ${user.username} to community members`);
      }
    } else {
      console.log(`User already follows ${communityName}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        following: true,
        memberCount: community.members ? community.members.length : 1
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Follow community error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to follow community: " + error.message }),
      { status: 500, headers }
    );
  }
}

async function handleUnfollowCommunity(communityName, blogStore, headers, user) {
  try {
    console.log(`User ${user.username} attempting to unfollow community: ${communityName}`);
    
    const community = await blogStore.get(`community_${communityName}`, { type: "json" });
    
    if (!community) {
      return new Response(
        JSON.stringify({ error: "Community not found" }),
        { status: 404, headers }
      );
    }
    
    // Migrate and update user's follows
    const userFollows = await migrateUserFollowsData(blogStore, user.username);
    
    userFollows.communities = userFollows.communities.filter(c => c !== communityName);
    userFollows.updatedAt = new Date().toISOString();
    await blogStore.set(`user_follows_${user.username}`, JSON.stringify(userFollows));
    console.log(`Removed ${communityName} from user follows`);
    
    // Update community members
    if (community.members) {
      community.members = community.members.filter(m => m !== user.username);
      await blogStore.set(`community_${communityName}`, JSON.stringify(community));
      console.log(`Removed ${user.username} from community members`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        following: false,
        memberCount: community.members ? community.members.length : 0
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Unfollow community error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to unfollow community: " + error.message }),
      { status: 500, headers }
    );
  }
}

async function handleGetFollowedCommunities(blogStore, headers, user) {
  try {
    console.log('Getting followed communities for user:', user.username);
    
    // Migrate and get user's follows data
    const userFollows = await migrateUserFollowsData(blogStore, user.username);
    
    console.log('User follows data after migration:', userFollows);
    
    // Get the communities array
    const followedCommunityNames = userFollows.communities || [];
    
    console.log('Following communities:', followedCommunityNames);
    
    // Get full community data for each followed community
    const communities = [];
    
    for (const communityName of followedCommunityNames) {
      try {
        const community = await blogStore.get(`community_${communityName}`, { type: "json" });
        if (community) {
          communities.push(community);
        } else {
          console.log('Community not found:', communityName);
        }
      } catch (error) {
        console.error(`Error loading community ${communityName}:`, error);
      }
    }
    
    console.log('Returning', communities.length, 'followed communities');
    
    return new Response(
      JSON.stringify({
        success: true,
        communities: communities
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get followed communities error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Failed to load followed communities",
        details: error.message 
      }),
      { status: 500, headers }
    );
  }
}

async function handleDeleteCommunity(communityName, blogStore, headers, user) {
  try {
    const community = await blogStore.get(`community_${communityName}`, { type: "json" });
    
    if (!community) {
      return new Response(
        JSON.stringify({ error: "Community not found" }),
        { status: 404, headers }
      );
    }
    
    // Only creator or admin can delete
    if (community.createdBy !== user.username && !user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers }
      );
    }
    
    // Delete community
    await blogStore.delete(`community_${communityName}`);
    
    // Remove from all users' follows
    const { blobs } = await blogStore.list({ prefix: "user_follows_" });
    for (const blob of blobs) {
      const userFollows = await blogStore.get(blob.key, { type: "json" });
      if (userFollows && userFollows.communities) {
        userFollows.communities = userFollows.communities.filter(c => c !== communityName);
        await blogStore.set(blob.key, JSON.stringify(userFollows));
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Community deleted successfully"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Delete community error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to delete community" }),
      { status: 500, headers }
    );
  }
}

async function handleCommunityPosts(req, blogStore, headers, communityName) {
  try {
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const posts = [];
    
    for (const blob of blobs) {
      const post = await blogStore.get(blob.key, { type: "json" });
      if (post && post.communityName === communityName && !post.isPrivate) {
        posts.push(post);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        posts
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get community posts error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load community posts" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// POST HANDLERS
// ==============================================


async function getPosts(filter = {}) {
    try {
        const params = new URLSearchParams();
        if (filter.community) params.append('community', filter.community);
        if (filter.author) params.append('author', filter.author);
        if (filter.followed) params.append('followed', 'true');
        if (filter.private) params.append('private', 'true');
        if (filter.includePrivate) params.append('includePrivate', 'true');
        
        const url = `/.netlify/functions/api/posts${params.toString() ? '?' + params.toString() : ''}`;
        
        const response = await tokenManager.makeRequest(url, {
            method: 'GET',
            skipAuth: !filter.private && !filter.followed && !filter.includePrivate // Require auth for private/followed posts
        });
        
       async function handleGetPosts(req, blogStore, headers) {
  try {
    const url = new URL(req.url);
    const community = url.searchParams.get('community');
    const author = url.searchParams.get('author');
    const privateOnly = url.searchParams.get('private');
    
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const posts = [];
    
    for (const blob of blobs) {
      const post = await blogStore.get(blob.key, { type: "json" });
      if (!post) continue;
      
      // Filter by criteria
      if (community && post.communityName !== community) continue;
      if (author && post.author !== author) continue;
      if (privateOnly === 'true' && !post.isPrivate) continue;
      if (!privateOnly && post.isPrivate) continue;
      
      posts.push(post);
    }
    
    // Sort by timestamp (newest first)
    posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return new Response(
      JSON.stringify({
        success: true,
        posts
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get posts error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load posts" }),
      { status: 500, headers }
    );
  }
}

async function handleCreatePost(req, blogStore, headers, user) {
  try {
    const { title, type, content, url, communityName, isPrivate } = await req.json();
    
    if (!title) {
      return new Response(
        JSON.stringify({ error: "Post title is required" }),
        { status: 400, headers }
      );
    }
    
    const postId = crypto.randomUUID();
    const post = {
      id: postId,
      title,
      type: type || 'text',
      content: content || '',
      url: url || null,
      communityName: communityName || null,
      author: user.username,
      timestamp: new Date().toISOString(),
      isPrivate: isPrivate || false,
      votes: 0,
      voters: [],
      replies: []
    };
    
    await blogStore.set(`post_${postId}`, JSON.stringify(post));
    
    // Update community post count if applicable
    if (communityName) {
      const community = await blogStore.get(`community_${communityName}`, { type: "json" });
      if (community) {
        community.postCount = (community.postCount || 0) + 1;
        await blogStore.set(`community_${communityName}`, JSON.stringify(community));
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        post
      }),
      { status: 201, headers }
    );
  } catch (error) {
    console.error('Create post error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to create post" }),
      { status: 500, headers }
    );
  }
}

async function handleDeletePost(postId, blogStore, headers, user) {
  try {
    const post = await blogStore.get(`post_${postId}`, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }
    
    // Only author or admin can delete
    if (post.author !== user.username && !user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers }
      );
    }
    
    await blogStore.delete(`post_${postId}`);
    
    // Update community post count if applicable
    if (post.communityName) {
      const community = await blogStore.get(`community_${post.communityName}`, { type: "json" });
      if (community) {
        community.postCount = Math.max(0, (community.postCount || 0) - 1);
        await blogStore.set(`community_${post.communityName}`, JSON.stringify(community));
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Post deleted successfully"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Delete post error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to delete post" }),
      { status: 500, headers }
    );
  }
}

async function handleVotePost(postId, req, blogStore, headers, user) {
  try {
    const { voteType } = await req.json();
    
    const post = await blogStore.get(`post_${postId}`, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }
    
    if (!post.voters) {
      post.voters = [];
    }
    
    // Check if user already voted
    const existingVoteIndex = post.voters.findIndex(v => v.username === user.username);
    
    if (existingVoteIndex >= 0) {
      // Remove existing vote
      post.voters.splice(existingVoteIndex, 1);
    }
    
    if (voteType === 'up' || voteType === 'down') {
      // Add new vote
      post.voters.push({
        username: user.username,
        voteType,
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate total votes
    post.votes = post.voters.reduce((total, vote) => {
      return total + (vote.voteType === 'up' ? 1 : -1);
    }, 0);
    
    await blogStore.set(`post_${postId}`, JSON.stringify(post));
    
    return new Response(
      JSON.stringify({
        success: true,
        votes: post.votes
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Vote post error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to vote on post" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// REPLY HANDLERS
// ==============================================

async function handleGetReplies(req, blogStore, headers, postId) {
  try {
    const post = await blogStore.get(`post_${postId}`, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        replies: post.replies || []
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get replies error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load replies" }),
      { status: 500, headers }
    );
  }
}

async function handleCreateReply(postId, req, blogStore, headers, user) {
  try {
    const { content } = await req.json();
    
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Reply content is required" }),
        { status: 400, headers }
      );
    }
    
    const post = await blogStore.get(`post_${postId}`, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }
    
    if (!post.replies) {
      post.replies = [];
    }
    
    const reply = {
      id: crypto.randomUUID(),
      postId,
      content,
      author: user.username,
      timestamp: new Date().toISOString()
    };
    
    post.replies.push(reply);
    await blogStore.set(`post_${postId}`, JSON.stringify(post));
    
    return new Response(
      JSON.stringify({
        success: true,
        reply
      }),
      { status: 201, headers }
    );
  } catch (error) {
    console.error('Create reply error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to create reply" }),
      { status: 500, headers }
    );
  }
}

async function handleDeleteReply(postId, replyId, blogStore, headers, user) {
  try {
    const post = await blogStore.get(`post_${postId}`, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }
    
    if (!post.replies) {
      return new Response(
        JSON.stringify({ error: "Reply not found" }),
        { status: 404, headers }
      );
    }
    
    const replyIndex = post.replies.findIndex(r => r.id === replyId);
    
    if (replyIndex < 0) {
      return new Response(
        JSON.stringify({ error: "Reply not found" }),
        { status: 404, headers }
      );
    }
    
    // Only author or admin can delete
    if (post.replies[replyIndex].author !== user.username && !user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers }
      );
    }
    
    post.replies.splice(replyIndex, 1);
    await blogStore.set(`post_${postId}`, JSON.stringify(post));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Reply deleted successfully"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Delete reply error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to delete reply" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// PROFILE HANDLERS
// ==============================================

async function handleGetUserProfile(req, blogStore, headers, username) {
  try {
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }
    
    // Remove sensitive data
    const { passwordHash, passwordSalt, securityEvents, ...publicProfile } = user;
    
    return new Response(
      JSON.stringify({
        success: true,
        user: publicProfile
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get user profile error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load user profile" }),
      { status: 500, headers }
    );
  }
}

async function handleUpdateProfile(req, blogStore, headers, user) {
  try {
    const { bio, profilePicture } = await req.json();
    
    const userData = await blogStore.get(`user_${user.username}`, { type: "json" });
    
    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }
    
    // Update profile fields
    if (bio !== undefined) {
      userData.bio = bio;
    }
    
    if (profilePicture !== undefined) {
      userData.profilePicture = profilePicture;
    }
    
    userData.updatedAt = new Date().toISOString();
    
    await blogStore.set(`user_${user.username}`, JSON.stringify(userData));
    
    // Remove sensitive data from response
    const { passwordHash, passwordSalt, securityEvents, ...updatedProfile } = userData;
    
    return new Response(
      JSON.stringify({
        success: true,
        user: updatedProfile
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to update profile" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// SESSION MANAGEMENT HANDLERS
// ==============================================

async function handleUserSessions(req, store, headers, user) {
  try {
    const { blobs } = await store.list({ prefix: "session_" });
    const userSessions = [];
    
    for (const blob of blobs) {
      const session = await store.get(blob.key, { type: "json" });
      if (session && session.username === user.username) {
        userSessions.push({
          id: session.sessionId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          ip: session.ip,
          userAgent: session.userAgent,
          active: session.active
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        sessions: userSessions
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get user sessions error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load sessions" }),
      { status: 500, headers }
    );
  }
}

async function handleLoginHistory(req, securityStore, headers, user) {
  try {
    // Get recent login events for user
    const loginHistory = [];
    const { blobs } = await securityStore.list({ prefix: "security_log_" });
    
    for (const blob of blobs) {
      const event = await securityStore.get(blob.key, { type: "json" });
      if (event && 
          event.username === user.username && 
          (event.type === 'user_login_success' || event.type === 'login_attempt_invalid_password')) {
        loginHistory.push({
          timestamp: event.timestamp,
          success: event.type === 'user_login_success',
          ip: event.ip,
          userAgent: event.userAgent
        });
      }
    }
    
    // Sort by timestamp (newest first)
    loginHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit to last 50 entries
    const recentHistory = loginHistory.slice(0, 50);
    
    return new Response(
      JSON.stringify({
        success: true,
        history: recentHistory
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Get login history error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to load login history" }),
      { status: 500, headers }
    );
  }
}

async function handleTerminateSession(sessionId, store, headers, user) {
  try {
    const session = await store.get(`session_${sessionId}`, { type: "json" });
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers }
      );
    }
    
    // Verify user owns this session
    if (session.username !== user.username) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers }
      );
    }
    
    // Mark session as inactive
    session.active = false;
    session.terminatedAt = new Date().toISOString();
    await store.set(`session_${sessionId}`, JSON.stringify(session));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Session terminated successfully"
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Terminate session error:', error);
    return new Response(
      JSON.stringify({ error: "Failed to terminate session" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// AUTHENTICATION HANDLERS
// ==============================================

async function handleSecureRegister(req, blogStore, securityStore, headers, clientIP) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password, bio, email } = await req.json();

    // Input validation
    const validation = validateRegistrationInput({ username, password, bio, email });
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers }
      );
    }

    // Check for existing users
    const [existingUser, pendingUser] = await Promise.all([
      blogStore.get(`user_${username}`, { type: "json" }),
      blogStore.get(`pending_user_${username}`, { type: "json" })
    ]);

    if (existingUser || pendingUser) {
      await logSecurityEvent(securityStore, {
        type: 'registration_attempt_duplicate',
        ip: clientIP,
        username: username,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Username already exists or is pending approval" }),
        { status: 409, headers }
      );
    }

    // Hash password securely
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const salt = await bcrypt.genSalt(saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const pendingUserData = {
      id: crypto.randomUUID(),
      username,
      email: email || null,
      passwordHash,
      passwordSalt: salt,
      bio: bio || `Hello! I'm ${username}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      isAdmin: false,
      emailVerified: false,
      verificationToken,
      verificationExpiry: verificationExpiry.toISOString(),
      registrationIP: clientIP,
      failedLoginAttempts: 0,
      lockedUntil: null,
      securityEvents: [],
      settings: {
        twoFactorEnabled: false,
        sessionTimeout: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME
      }
    };

    await blogStore.set(`pending_user_${username}`, JSON.stringify(pendingUserData));

    // Log successful registration
    await logSecurityEvent(securityStore, {
      type: 'user_registration',
      ip: clientIP,
      username: username,
      email: email || null,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration submitted for admin approval",
        status: "pending",
        username: username,
        emailVerificationRequired: !!email
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({ error: "Registration failed" }),
      { status: 500, headers }
    );
  }
}

async function handleSecureLogin(req, blogStore, securityStore, headers, clientIP) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password, rememberMe = false } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password required" }),
        { status: 400, headers }
      );
    }

    // Check for account lockout
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    
    if (!user) {
      // Check if user is pending
      const pendingUser = await blogStore.get(`pending_user_${username}`, { type: "json" });
      if (pendingUser) {
        await logSecurityEvent(securityStore, {
          type: 'login_attempt_pending',
          ip: clientIP,
          username: username,
          timestamp: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({ error: "Your account is pending admin approval" }),
          { status: 401, headers }
        );
      }
      
      await logSecurityEvent(securityStore, {
        type: 'login_attempt_invalid_user',
        ip: clientIP,
        username: username,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers }
      );
    }

    // Check account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await logSecurityEvent(securityStore, {
        type: 'login_attempt_locked_account',
        ip: clientIP,
        username: username,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Account temporarily locked due to too many failed attempts",
          lockedUntil: user.lockedUntil
        }),
        { status: 423, headers }
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordValid) {
      // Increment failed attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updatedUser = { ...user, failedLoginAttempts: failedAttempts };
      
      // Lock account if too many failures
      if (failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
        updatedUser.lockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION).toISOString();
      }
      
      await blogStore.set(`user_${username}`, JSON.stringify(updatedUser));
      
      await logSecurityEvent(securityStore, {
        type: 'login_attempt_invalid_password',
        ip: clientIP,
        username: username,
        failedAttempts: failedAttempts,
        accountLocked: failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers }
      );
    }

    // Successful login - migrate user follows data
    await migrateUserFollowsData(blogStore, username);

    // Reset failed attempts and clear lockout
    const loginTime = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Generate tokens
    const tokenLifetime = rememberMe ? SECURITY_CONFIG.REMEMBER_ME_LIFETIME : SECURITY_CONFIG.REFRESH_TOKEN_LIFETIME;
    
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        sessionId: sessionId,
        type: 'access'
      },
      SECURITY_CONFIG.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME }
    );
    
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        sessionId: sessionId,
        type: 'refresh'
      },
      SECURITY_CONFIG.JWT_REFRESH_SECRET,
      { expiresIn: tokenLifetime }
    );

    // Create session record
    const sessionData = {
      sessionId: sessionId,
      userId: user.id,
      username: user.username,
      createdAt: loginTime,
      lastActivity: loginTime,
      expiresAt: new Date(Date.now() + (tokenLifetime * 1000)).toISOString(),
      ip: clientIP,
      userAgent: req.headers.get('User-Agent') || 'Unknown',
      deviceFingerprint: deviceFingerprint,
      active: true,
      rememberMe: rememberMe
    };

    // Store session
    const apiStore = getStore("blog-api-data");
    await apiStore.set(`session_${sessionId}`, JSON.stringify(sessionData));

    // Clean up old sessions and enforce session limit
    await cleanupUserSessions(apiStore, user.username, sessionId);

    // Update user record
    const updatedUser = {
      ...user,
      lastLogin: loginTime,
      loginCount: (user.loginCount || 0) + 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastIP: clientIP
    };
    
    await blogStore.set(`user_${username}`, JSON.stringify(updatedUser));

    // Log successful login
    await logSecurityEvent(securityStore, {
      type: 'user_login_success',
      ip: clientIP,
      username: username,
      sessionId: sessionId,
      deviceFingerprint: deviceFingerprint,
      rememberMe: rememberMe,
      timestamp: loginTime
    });

    // Remove sensitive data from response
    const { passwordHash, passwordSalt, securityEvents, ...userProfile } = updatedUser;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: userProfile,
        session: {
          id: sessionId,
          expiresAt: sessionData.expiresAt,
          rememberMe: rememberMe
        }
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Login failed" }),
      { status: 500, headers }
    );
  }
}

async function handleTokenRefresh(req, store, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { refreshToken } = await req.json();
    
    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: "Refresh token required" }),
        { status: 400, headers }
      );
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, SECURITY_CONFIG.JWT_REFRESH_SECRET);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid refresh token" }),
        { status: 401, headers }
      );
    }

    if (decoded.type !== 'refresh') {
      return new Response(
        JSON.stringify({ error: "Invalid token type" }),
        { status: 401, headers }
      );
    }

    // Check session exists and is active
    const session = await store.get(`session_${decoded.sessionId}`, { type: "json" });
    
    if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired or invalid" }),
        { status: 401, headers }
      );
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { 
        userId: decoded.userId,
        username: decoded.username,
        sessionId: decoded.sessionId,
        type: 'access'
      },
      SECURITY_CONFIG.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME }
    );

    // Update session activity
    session.lastActivity = new Date().toISOString();
    await store.set(`session_${decoded.sessionId}`, JSON.stringify(session));

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: newAccessToken,
        expiresIn: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Token refresh error:", error);
    return new Response(
      JSON.stringify({ error: "Token refresh failed" }),
      { status: 500, headers }
    );
  }
}

async function handleSecureLogout(req, store, securityStore, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { sessionId, logoutAll = false } = await req.json();
    const authHeader = req.headers.get("Authorization");
    
    let targetSessionId = sessionId;
    
    // If no sessionId provided, try to get from token
    if (!targetSessionId && authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
        targetSessionId = decoded.sessionId;
      } catch (error) {
        // Invalid token, continue with logout anyway
      }
    }

    if (targetSessionId) {
      const session = await store.get(`session_${targetSessionId}`, { type: "json" });
      
      if (session) {
        if (logoutAll) {
          // Logout from all sessions for this user
          await logoutAllUserSessions(store, session.username);
        } else {
          // Logout from specific session
          session.active = false;
          session.loggedOutAt = new Date().toISOString();
          await store.set(`session_${targetSessionId}`, JSON.stringify(session));
        }

        // Log logout event
        await logSecurityEvent(securityStore, {
          type: logoutAll ? 'user_logout_all' : 'user_logout',
          username: session.username,
          sessionId: targetSessionId,
          ip: getClientIP(req),
          timestamp: new Date().toISOString()
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: logoutAll ? "Logged out from all devices" : "Logged out successfully" 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Logout error:", error);
    return new Response(
      JSON.stringify({ error: "Logout failed" }),
      { status: 500, headers }
    );
  }
}

async function handleChangePassword(req, blogStore, securityStore, headers, user, clientIP) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Current password and new password required" }),
        { status: 400, headers }
      );
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers }
      );
    }

    // Get current user data
    const userData = await blogStore.get(`user_${user.username}`, { type: "json" });
    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }

    // Verify current password
    const currentPasswordValid = await bcrypt.compare(currentPassword, userData.passwordHash);
    if (!currentPasswordValid) {
      await logSecurityEvent(securityStore, {
        type: 'password_change_failed_verification',
        username: user.username,
        ip: clientIP,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Current password is incorrect" }),
        { status: 401, headers }
      );
    }

    // Check if new password is different from current
    const samePassword = await bcrypt.compare(newPassword, userData.passwordHash);
    if (samePassword) {
      return new Response(
        JSON.stringify({ error: "New password must be different from current password" }),
        { status: 400, headers }
      );
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    const newSalt = await bcrypt.genSalt(saltRounds);

    // Update user with new password
    const updatedUser = {
      ...userData,
      passwordHash: newPasswordHash,
      passwordSalt: newSalt,
      passwordChangedAt: new Date().toISOString(),
      passwordChangedBy: user.username,
      passwordChangeIP: clientIP
    };

    await blogStore.set(`user_${user.username}`, JSON.stringify(updatedUser));

    // Log password change
    await logSecurityEvent(securityStore, {
      type: 'password_changed',
      username: user.username,
      ip: clientIP,
      timestamp: new Date().toISOString()
    });

    // Invalidate all sessions except current one (force re-login)
    const apiStore = getStore("blog-api-data");
    await invalidateUserSessions(apiStore, user.username, user.sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password changed successfully. Please log in again on other devices."
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Change password error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to change password" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// VALIDATION AND SECURITY UTILITIES
// ==============================================

function validateRegistrationInput({ username, password, bio, email }) {
  // Username validation
  if (!username || typeof username !== 'string') {
    return { valid: false, error: "Username is required" };
  }
  
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: "Username must be 3-20 characters long" };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }

  // Password validation
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  // Bio validation
  if (bio && bio.length > 500) {
    return { valid: false, error: "Bio must be 500 characters or less" };
  }

  // Email validation (optional)
  if (email && !isValidEmail(email)) {
    return { valid: false, error: "Please provide a valid email address" };
  }

  return { valid: true };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: "Password is required" };
  }

  const config = SECURITY_CONFIG.PASSWORD_REQUIREMENTS;
  
  if (password.length < config.minLength) {
    return { valid: false, error: `Password must be at least ${config.minLength} characters long` };
  }
  
  if (password.length > config.maxLength) {
    return { valid: false, error: `Password must be less than ${config.maxLength} characters long` };
  }
  
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  
  if (config.requireNumbers && !/\d/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  
  if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)" };
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456789', 'qwertyuiop', 'password123', 
    'admin', 'letmein', 'welcome', 'monkey', '1234567890'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: "Password is too common. Please choose a more secure password" };
  }

  return { valid: true };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function validateSecureAuth(req, store, blogStore) {
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("X-API-Key");

  // Master API key authentication
  if (apiKey) {
    if (apiKey === SECURITY_CONFIG.MASTER_API_KEY) {
      return { 
        valid: true, 
        user: { 
          username: "system", 
          permissions: ["read", "write", "admin"], 
          isAdmin: true,
          sessionId: "master"
        },
        authType: "apikey"
      };
    }
    return { valid: false, error: "Invalid API key", status: 401 };
  }

  // JWT token authentication
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
      
      if (decoded.type !== 'access') {
        return { valid: false, error: "Invalid token type", status: 401 };
      }

      // Check session exists and is active
      const session = await store.get(`session_${decoded.sessionId}`, { type: "json" });
      
      if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
        return { valid: false, error: "Session expired", status: 401 };
      }

      // Get user profile
      const userProfile = await blogStore.get(`user_${decoded.username}`, { type: "json" });
      
      if (!userProfile) {
        return { valid: false, error: "User not found", status: 404 };
      }

      // Check if account is locked
      if (userProfile.lockedUntil && new Date(userProfile.lockedUntil) > new Date()) {
        return { valid: false, error: "Account locked", status: 423 };
      }

      return { 
        valid: true, 
        user: { 
          ...userProfile, 
          sessionId: decoded.sessionId 
        },
        authType: "jwt"
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: "Token expired", status: 401 };
      } else if (error.name === 'JsonWebTokenError') {
        return { valid: false, error: "Invalid token", status: 401 };
      } else {
        return { valid: false, error: "Authentication error", status: 500 };
      }
    }
  }

  return { valid: false, error: "Authentication required", status: 401 };
}

// ==============================================
// RATE LIMITING AND SECURITY UTILITIES
// ==============================================

async function checkRateLimit(securityStore, clientIP, path, method) {
  const now = Date.now();
  const rateLimitKey = `rate_limit_${clientIP}_${path}_${method}`;
  
  try {
    const rateLimitData = await securityStore.get(rateLimitKey, { type: "json" }) || {
      count: 0,
      windowStart: now,
      blocked: false
    };

    // Determine rate limit for this endpoint
    let limit = SECURITY_CONFIG.RATE_LIMITS.API_CALLS;
    
    if (path.includes('auth/login')) {
      limit = SECURITY_CONFIG.RATE_LIMITS.LOGIN_ATTEMPTS;
    } else if (path.includes('auth/register')) {
      limit = SECURITY_CONFIG.RATE_LIMITS.REGISTRATION;
    } else if (path.includes('forgot-password')) {
      limit = SECURITY_CONFIG.RATE_LIMITS.PASSWORD_RESET;
    }

    // Reset window if expired
    if (now - rateLimitData.windowStart > limit.window) {
      rateLimitData.count = 0;
      rateLimitData.windowStart = now;
      rateLimitData.blocked = false;
    }

    // Check if blocked
    if (rateLimitData.blocked || rateLimitData.count >= limit.max) {
      rateLimitData.blocked = true;
      await securityStore.set(rateLimitKey, JSON.stringify(rateLimitData));
      
      const retryAfter = Math.ceil((limit.window - (now - rateLimitData.windowStart)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment counter
    rateLimitData.count++;
    await securityStore.set(rateLimitKey, JSON.stringify(rateLimitData));

    return { allowed: true };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request if rate limiting fails
    return { allowed: true };
  }
}

async function logSecurityEvent(securityStore, event) {
  try {
    const eventId = crypto.randomUUID();
    const logEntry = {
      id: eventId,
      ...event,
      severity: getEventSeverity(event.type)
    };
    
    await securityStore.set(`security_log_${eventId}`, JSON.stringify(logEntry));
    
    // Also maintain a daily log index for easier querying
    const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
    const dailyLogKey = `daily_security_log_${dateKey}`;
    
    const dailyLog = await securityStore.get(dailyLogKey, { type: "json" }) || [];
    dailyLog.push(eventId);
    
    // Keep only last 100 events per day to prevent storage bloat
    if (dailyLog.length > 100) {
      dailyLog.splice(0, dailyLog.length - 100);
    }
    
    await securityStore.set(dailyLogKey, JSON.stringify(dailyLog));
    
  } catch (error) {
    console.error('Security logging error:', error);
  }
}

function getEventSeverity(eventType) {
  const highSeverity = [
    'login_attempt_invalid_password',
    'login_attempt_locked_account',
    'unauthorized_admin_access',
    'password_change_failed_verification'
  ];
  
  const mediumSeverity = [
    'login_attempt_invalid_user',
    'login_attempt_pending',
    'auth_failure'
  ];
  
  if (highSeverity.includes(eventType)) return 'high';
  if (mediumSeverity.includes(eventType)) return 'medium';
  return 'low';
}

// ==============================================
// SESSION MANAGEMENT UTILITIES
// ==============================================

async function cleanupUserSessions(store, username, currentSessionId) {
  try {
    // Get all sessions for user
    const { blobs } = await store.list({ prefix: "session_" });
    const userSessions = [];
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active) {
          userSessions.push({ key: blob.key, session });
        }
      } catch (error) {
        // Clean up corrupted sessions
        await store.delete(blob.key);
      }
    }
    
    // Sort by last activity (newest first)
    userSessions.sort((a, b) => new Date(b.session.lastActivity) - new Date(a.session.lastActivity));
    
    // Keep only the most recent sessions (including current)
    const sessionsToKeep = SECURITY_CONFIG.MAX_CONCURRENT_SESSIONS;
    const sessionsToRemove = userSessions.slice(sessionsToKeep);
    
    for (const { key } of sessionsToRemove) {
      // Don't remove current session
      if (!key.includes(currentSessionId)) {
        await store.delete(key);
      }
    }
    
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}

async function logoutAllUserSessions(store, username) {
  try {
    const { blobs } = await store.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active) {
          session.active = false;
          session.loggedOutAt = new Date().toISOString();
          await store.set(blob.key, JSON.stringify(session));
        }
      } catch (error) {
        console.error(`Error logging out session ${blob.key}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Logout all sessions error:', error);
  }
}

async function invalidateUserSessions(store, username, exceptSessionId) {
  try {
    const { blobs } = await store.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active && session.sessionId !== exceptSessionId) {
          session.active = false;
          session.invalidatedAt = new Date().toISOString();
          await store.set(blob.key, JSON.stringify(session));
        }
      } catch (error) {
        console.error(`Error invalidating session ${blob.key}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Invalidate sessions error:', error);
  }
}

async function updateUserActivity(store, username) {
  try {
    // Update all active sessions for user
    const { blobs } = await store.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active) {
          session.lastActivity = new Date().toISOString();
          await store.set(blob.key, JSON.stringify(session));
        }
      } catch (error) {
        console.error(`Error updating session activity ${blob.key}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Update user activity error:', error);
  }
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

function getClientIP(req) {
  // Check various headers for real IP
  return req.headers.get('cf-connecting-ip') || 
         req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         req.headers.get('x-client-ip') || 
         'unknown';
}

function generateDeviceFingerprint(req) {
  const userAgent = req.headers.get('User-Agent') || '';
  const acceptLanguage = req.headers.get('Accept-Language') || '';
  const acceptEncoding = req.headers.get('Accept-Encoding') || '';
  
  const fingerprint = crypto
    .createHash('sha256')
    .update(userAgent + acceptLanguage + acceptEncoding)
    .digest('hex')
    .substring(0, 16);
    
  return fingerprint;
}

function getCorsHeaders(req) {
  const origin = req.headers.get('Origin');
  const allowedOrigin = SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
}
//end of file

