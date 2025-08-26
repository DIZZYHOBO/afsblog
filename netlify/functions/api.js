// netlify/functions/api.js
import { getStore } from "@netlify/blobs";

// API configuration
const API_CONFIG = {
  MASTER_API_KEY: process.env.MASTER_API_KEY || "your-secret-master-key-here",
  JWT_SECRET: process.env.JWT_SECRET || "your-jwt-secret-here",
  RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour
  RATE_LIMIT_MAX_REQUESTS: 1000,
  SESSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export default async (req, context) => {
  const store = getStore("blog-api-data");
  const blogStore = getStore("blog-data");
  
  const headers = {
    "Access-Control-Allow-Origin": "https://feeds.afsapp.lol",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/api/')[1] || '';

    // Handle authentication endpoints
    if (path === 'auth/login') {
      return await handleLogin(req, blogStore, headers);
    }
    
    if (path === 'auth/register') {
      return await handleRegister(req, blogStore, headers);
    }

    if (path === 'auth/logout') {
      return await handleLogout(req, store, headers);
    }

    // Validate authentication for protected endpoints
    const authResult = await validateAuth(req, store, blogStore);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers }
      );
    }

    // Route authenticated requests
    switch (path) {
      case 'feeds/public':
        return await handlePublicFeed(req, blogStore, headers, authResult.user);
      case 'feeds/private':
        return await handlePrivateFeed(req, blogStore, headers, authResult.user);
      case 'posts':
        return await handlePosts(req, blogStore, headers, authResult.user);
      case 'profile':
        return await handleProfile(req, blogStore, headers, authResult.user);
      case 'profile/update':
        return await handleProfileUpdate(req, blogStore, headers, authResult.user);
      default:
        return await handleDefault(req, headers);
    }

  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers }
    );
  }
};

// Authentication handlers
async function handleLogin(req, blogStore, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password required" }),
        { status: 400, headers }
      );
    }

    // Get user from blog store
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    
    if (!user || user.password !== password) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers }
      );
    }

    // Create session token
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    const sessionData = {
      token: sessionToken,
      username: user.username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + API_CONFIG.SESSION_DURATION).toISOString(),
      active: true
    };

    const apiStore = getStore("blog-api-data");
    await apiStore.set(`session_${sessionToken}`, JSON.stringify(sessionData));

    // Remove password from response
    const { password: _, ...userProfile } = user;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        token: sessionToken,
        user: userProfile,
        expiresAt: sessionData.expiresAt
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

async function handleRegister(req, blogStore, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password, bio } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password required" }),
        { status: 400, headers }
      );
    }

    if (username.length < 3 || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Username must be 3+ chars, password 6+ chars" }),
        { status: 400, headers }
      );
    }

    // Check if user exists
    const existingUser = await blogStore.get(`user_${username}`, { type: "json" });
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Username already exists" }),
        { status: 409, headers }
      );
    }

    // Create new user
    const newUser = {
      username,
      password,
      bio: bio || `Hello! I'm ${username}`,
      createdAt: new Date().toISOString(),
      postCount: 0,
      replyCount: 0
    };

    await blogStore.set(`user_${username}`, JSON.stringify(newUser));

    // Auto-login after registration
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    const sessionData = {
      token: sessionToken,
      username: newUser.username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + API_CONFIG.SESSION_DURATION).toISOString(),
      active: true
    };

    const apiStore = getStore("blog-api-data");
    await apiStore.set(`session_${sessionToken}`, JSON.stringify(sessionData));

    // Remove password from response
    const { password: _, ...userProfile } = newUser;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration successful",
        token: sessionToken,
        user: userProfile,
        expiresAt: sessionData.expiresAt
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

async function handleLogout(req, store, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      // Invalidate session
      const sessionData = await store.get(`session_${token}`, { type: "json" });
      if (sessionData) {
        sessionData.active = false;
        await store.set(`session_${token}`, JSON.stringify(sessionData));
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Logged out successfully" }),
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

// Validate authentication
async function validateAuth(req, store, blogStore) {
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("X-API-Key");

  // Check for API key authentication (for external integrations)
  if (apiKey) {
    if (apiKey === API_CONFIG.MASTER_API_KEY) {
      return { 
        valid: true, 
        user: { username: "admin", permissions: ["read", "write", "admin"] },
        authType: "apikey"
      };
    }
    return { valid: false, error: "Invalid API key", status: 401 };
  }

  // Check for session token authentication
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    try {
      const sessionData = await store.get(`session_${token}`, { type: "json" });
      
      if (!sessionData) {
        return { valid: false, error: "Invalid session token", status: 401 };
      }

      if (!sessionData.active) {
        return { valid: false, error: "Session expired", status: 401 };
      }

      if (new Date() > new Date(sessionData.expiresAt)) {
        return { valid: false, error: "Session expired", status: 401 };
      }

      // Get full user profile
      const userProfile = await blogStore.get(`user_${sessionData.username}`, { type: "json" });
      
      return { 
        valid: true, 
        user: userProfile,
        authType: "session"
      };

    } catch (error) {
      console.error("Session validation error:", error);
      return { valid: false, error: "Authentication error", status: 500 };
    }
  }

  return { valid: false, error: "Authentication required", status: 401 };
}

// Feed handlers
async function handlePublicFeed(req, blogStore, headers, user) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const posts = [];

    for (const blob of blobs) {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post && !post.isPrivate) {
          posts.push(post);
        }
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
      }
    }

    const sortedPosts = posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return new Response(
      JSON.stringify({
        success: true,
        feed: "public",
        posts: sortedPosts,
        total: sortedPosts.length,
        user: user.username
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Public feed error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load public feed" }),
      { status: 500, headers }
    );
  }
}

async function handlePrivateFeed(req, blogStore, headers, user) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const posts = [];

    for (const blob of blobs) {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post && post.isPrivate && post.author === user.username) {
          posts.push(post);
        }
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
      }
    }

    const sortedPosts = posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return new Response(
      JSON.stringify({
        success: true,
        feed: "private",
        posts: sortedPosts,
        total: sortedPosts.length,
        user: user.username
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Private feed error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load private feed" }),
      { status: 500, headers }
    );
  }
}

// Post handlers
async function handlePosts(req, blogStore, headers, user) {
  if (req.method === 'POST') {
    // Create new post
    try {
      const { title, content, isPrivate = false } = await req.json();

      if (!title || !content) {
        return new Response(
          JSON.stringify({ error: "Title and content required" }),
          { status: 400, headers }
        );
      }

      const post = {
        id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        content: content.trim(),
        author: user.username,
        timestamp: new Date().toISOString(),
        isPrivate: Boolean(isPrivate),
        replies: [],
        createdViaAPI: true
      };

      await blogStore.set(post.id, JSON.stringify(post));

      return new Response(
        JSON.stringify({
          success: true,
          message: "Post created successfully",
          post: post
        }),
        { status: 201, headers }
      );

    } catch (error) {
      console.error("Create post error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create post" }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers }
  );
}

// Profile handlers
async function handleProfile(req, blogStore, headers, user) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    // Get user's posts for stats
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const userPosts = [];
    let totalReplies = 0;

    for (const blob of blobs) {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post && post.author === user.username) {
          userPosts.push(post);
          totalReplies += post.replies ? post.replies.length : 0;
        }
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
      }
    }

    const publicPosts = userPosts.filter(post => !post.isPrivate);
    const privatePosts = userPosts.filter(post => post.isPrivate);

    // Remove password from user data
    const { password: _, ...profileData } = user;

    const profile = {
      ...profileData,
      stats: {
        totalPosts: userPosts.length,
        publicPosts: publicPosts.length,
        privatePosts: privatePosts.length,
        totalReplies: totalReplies
      },
      recentPosts: userPosts
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
    };

    return new Response(
      JSON.stringify({
        success: true,
        profile: profile
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Profile error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load profile" }),
      { status: 500, headers }
    );
  }
}

async function handleProfileUpdate(req, blogStore, headers, user) {
  if (req.method !== 'PUT') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { bio } = await req.json();

    if (bio && bio.length > 500) {
      return new Response(
        JSON.stringify({ error: "Bio must be 500 characters or less" }),
        { status: 400, headers }
      );
    }

    // Update user profile
    const updatedUser = {
      ...user,
      bio: bio || user.bio,
      updatedAt: new Date().toISOString()
    };

    await blogStore.set(`user_${user.username}`, JSON.stringify(updatedUser));

    // Remove password from response
    const { password: _, ...profileData } = updatedUser;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Profile updated successfully",
        profile: profileData
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Profile update error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update profile" }),
      { status: 500, headers }
    );
  }
}

// Default documentation endpoint
async function handleDefault(req, headers) {
  const docs = {
    message: "Blog API v2.0 - Now with Authentication!",
    endpoints: {
      // Authentication
      "POST /api/auth/login": "Login with username/password",
      "POST /api/auth/register": "Register new account",
      "POST /api/auth/logout": "Logout (invalidate session)",
      
      // Feeds (requires auth)
      "GET /api/feeds/public": "Get public posts feed",
      "GET /api/feeds/private": "Get user's private posts",
      
      // Posts (requires auth)
      "POST /api/posts": "Create new post",
      
      // Profile (requires auth)
      "GET /api/profile": "Get user profile with stats",
      "PUT /api/profile/update": "Update user profile"
    },
    authentication: {
      session: {
        method: "Bearer token",
        header: "Authorization: Bearer <session-token>",
        obtain: "POST /api/auth/login",
        duration: "7 days"
      },
      apiKey: {
        method: "API key (for external integrations)",
        header: "X-API-Key: <your-api-key>"
      }
    },
    usage: {
      "1. Register": "POST /api/auth/register {username, password, bio?}",
      "2. Login": "POST /api/auth/login {username, password}",
      "3. Use token": "Include 'Authorization: Bearer <token>' header",
      "4. Access feeds": "GET /api/feeds/public or /api/feeds/private"
    }
  };

  return new Response(
    JSON.stringify(docs),
    { status: 200, headers }
  );
}
