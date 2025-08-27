// netlify/functions/api.js
import { getStore } from "@netlify/blobs";

// API configuration
const API_CONFIG = {
  MASTER_API_KEY: process.env.MASTER_API_KEY || "your-secret-master-key-here",
  JWT_SECRET: process.env.JWT_SECRET || "your-jwt-secret-here",
  RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour
  RATE_LIMIT_MAX_REQUESTS: 1000,
  SESSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50
};

export default async (req, context) => {
  const store = getStore("blog-api-data");
  const blogStore = getStore("blog-data");
  
  const headers = {
    "Access-Control-Allow-Origin": "*",
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

    // NEW: Media detection endpoint for frontends
    if (path === 'media/detect') {
      return await handleMediaDetection(req, headers);
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
      case 'posts/create':
        return await handleCreatePost(req, blogStore, headers, authResult.user);
      case 'replies/create':
        return await handleCreateReply(req, blogStore, headers, authResult.user);
      case 'profile':
        return await handleProfile(req, blogStore, headers, authResult.user);
      case 'profile/update':
        return await handleProfileUpdate(req, blogStore, headers, authResult.user);
      default:
        // Handle dynamic routes like /posts/{postId}
        if (path.startsWith('posts/') && path !== 'posts/create') {
          return await handlePostOperations(req, blogStore, headers, authResult.user, path);
        }
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

// NEW: Handle individual post operations (GET, DELETE)
async function handlePostOperations(req, blogStore, headers, user, path) {
  const postId = path.split('/')[1];
  
  if (!postId) {
    return new Response(
      JSON.stringify({ error: "Post ID required" }),
      { status: 400, headers }
    );
  }

  if (req.method === 'GET') {
    // Get specific post
    try {
      const post = await blogStore.get(postId, { type: "json" });
      
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers }
        );
      }

      // Check permissions for private posts
      if (post.isPrivate && post.author !== user.username && !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          post: post
        }),
        { status: 200, headers }
      );

    } catch (error) {
      console.error("Get post error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve post" }),
        { status: 500, headers }
      );
    }
  }

  if (req.method === 'DELETE') {
    // Delete specific post
    try {
      const post = await blogStore.get(postId, { type: "json" });
      
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers }
        );
      }

      // Check permissions (only author or admin can delete)
      if (post.author !== user.username && !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: "Only the author or admin can delete this post" }),
          { status: 403, headers }
        );
      }

      // Delete the post
      await blogStore.delete(postId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Post deleted successfully",
          postId: postId,
          deletedBy: user.username
        }),
        { status: 200, headers }
      );

    } catch (error) {
      console.error("Delete post error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to delete post" }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers }
  );
}

// NEW: Media detection helper for any frontend
async function handleMediaDetection(req, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL required" }),
        { status: 400, headers }
      );
    }

    const mediaInfo = detectMediaType(url);
    const embedHtml = mediaInfo.embed ? createMediaEmbed(url, mediaInfo.type) : null;

    return new Response(
      JSON.stringify({
        success: true,
        url: url,
        mediaType: mediaInfo.type,
        canEmbed: mediaInfo.embed,
        embedHtml: embedHtml,
        metadata: mediaInfo
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Media detection error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Invalid URL or detection failed",
        url: req.body?.url || null,
        canEmbed: false 
      }),
      { status: 400, headers }
    );
  }
}

// NEW: Detect media type from URL (reusable for any frontend)
function detectMediaType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let videoId = '';
      if (hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.substring(1);
      } else {
        videoId = urlObj.searchParams.get('v');
      }
      return { 
        type: 'youtube', 
        embed: true, 
        videoId: videoId,
        platform: 'YouTube',
        title: `YouTube Video: ${videoId}`
      };
    }
    
    // Vimeo
    if (hostname.includes('vimeo.com')) {
      const videoId = pathname.split('/')[1];
      return { 
        type: 'vimeo', 
        embed: true, 
        videoId: videoId,
        platform: 'Vimeo',
        title: `Vimeo Video: ${videoId}`
      };
    }
    
    // Image extensions
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const imageExt = imageExts.find(ext => pathname.endsWith(ext));
    if (imageExt) {
      return { 
        type: 'image', 
        embed: true, 
        format: imageExt.substring(1),
        platform: 'Direct Image',
        title: `Image (${imageExt.substring(1).toUpperCase()})`
      };
    }
    
    // Video extensions
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    const videoExt = videoExts.find(ext => pathname.endsWith(ext));
    if (videoExt) {
      return { 
        type: 'video', 
        embed: true, 
        format: videoExt.substring(1),
        platform: 'Direct Video',
        title: `Video (${videoExt.substring(1).toUpperCase()})`
      };
    }
    
    // Audio extensions
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    const audioExt = audioExts.find(ext => pathname.endsWith(ext));
    if (audioExt) {
      return { 
        type: 'audio', 
        embed: true, 
        format: audioExt.substring(1),
        platform: 'Direct Audio',
        title: `Audio (${audioExt.substring(1).toUpperCase()})`
      };
    }
    
    // Twitter/X
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return { 
        type: 'twitter', 
        embed: false, // Could be implemented with Twitter API
        platform: 'Twitter/X',
        title: 'Twitter/X Post'
      };
    }

    // Instagram
    if (hostname.includes('instagram.com')) {
      return { 
        type: 'instagram', 
        embed: false,
        platform: 'Instagram',
        title: 'Instagram Post'
      };
    }

    // TikTok
    if (hostname.includes('tiktok.com')) {
      return { 
        type: 'tiktok', 
        embed: false,
        platform: 'TikTok',
        title: 'TikTok Video'
      };
    }
    
    // Default web link
    return { 
      type: 'link', 
      embed: false, 
      platform: hostname,
      title: `Link to ${hostname}`
    };
    
  } catch (error) {
    return { 
      type: 'invalid', 
      embed: false, 
      error: 'Invalid URL format',
      title: 'Invalid URL'
    };
  }
}

// NEW: Create media embed HTML (for any frontend)
function createMediaEmbed(url, mediaType) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let videoId = '';
      if (hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.substring(1);
      } else {
        videoId = urlObj.searchParams.get('v');
      }
      
      if (videoId) {
        return `<iframe src="https://www.youtube.com/embed/${videoId}" width="100%" height="315" frameborder="0" allowfullscreen loading="lazy"></iframe>`;
      }
    }
    
    // Vimeo
    if (hostname.includes('vimeo.com')) {
      const videoId = pathname.split('/')[1];
      if (videoId) {
        return `<iframe src="https://player.vimeo.com/video/${videoId}" width="100%" height="315" frameborder="0" allowfullscreen loading="lazy"></iframe>`;
      }
    }
    
    // Direct images
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    if (imageExts.some(ext => pathname.endsWith(ext))) {
      return `<img src="${url}" alt="Linked image" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;" loading="lazy" onerror="this.style.display='none';">`;
    }
    
    // Direct videos
    const videoExts = ['.mp4', '.webm', '.ogg'];
    if (videoExts.some(ext => pathname.endsWith(ext))) {
      const format = pathname.split('.').pop();
      return `<video controls style="width: 100%; height: auto;" loading="lazy"><source src="${url}" type="video/${format}">Your browser does not support the video tag.</video>`;
    }
    
    // Direct audio
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a'];
    if (audioExts.some(ext => pathname.endsWith(ext))) {
      const format = pathname.split('.').pop();
      return `<audio controls style="width: 100%; margin: 8px 0;"><source src="${url}" type="audio/${format}">Your browser does not support the audio element.</audio>`;
    }
    
    return null; // No embed available
    
  } catch (error) {
    return null;
  }
}

// Helper function to get pagination parameters with validation
function getPaginationParams(url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(API_CONFIG.MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get('limit')) || API_CONFIG.DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

// Helper function to sort posts by timestamp
function sortPostsByTimestamp(posts) {
  return posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Helper function to create pagination metadata
function createPaginationMeta(totalItems, page, limit) {
  const totalPages = Math.ceil(totalItems / limit);
  const hasMore = page < totalPages;
  
  return {
    page,
    limit,
    total: totalItems,
    totalPages,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null
  };
}

// Authentication handlers (unchanged)
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
      replyCount: 0,
      isAdmin: false
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

// Feed handlers with improved pagination and REPLIES INCLUDED
async function handlePublicFeed(req, blogStore, headers, user) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = getPaginationParams(url);
    const includeReplies = url.searchParams.get('includeReplies') !== 'false'; // Default true

    // Get all post keys
    const { blobs } = await blogStore.list({ prefix: "post_" });
    
    if (blobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          feed: "public",
          posts: [],
          pagination: createPaginationMeta(0, page, limit),
          user: user.username
        }),
        { status: 200, headers }
      );
    }

    // Load all posts to filter and sort them
    const postPromises = blobs.map(async (blob) => {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        // Only include public posts
        if (post && !post.isPrivate) {
          // Ensure replies array exists and add reply count
          post.replies = post.replies || [];
          post.replyCount = post.replies.length;
          
          // If includeReplies is false, don't send the full replies array
          if (!includeReplies) {
            const replyCount = post.replies.length;
            delete post.replies;
            post.replyCount = replyCount;
          }
          
          return post;
        }
        return null;
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
        return null;
      }
    });
    
    const loadedPosts = await Promise.all(postPromises);
    const publicPosts = loadedPosts.filter(Boolean);

    // Sort posts by timestamp (newest first)
    const sortedPosts = sortPostsByTimestamp(publicPosts);
    
    // Apply pagination
    const paginatedPosts = sortedPosts.slice(skip, skip + limit);
    const paginationMeta = createPaginationMeta(sortedPosts.length, page, limit);

    return new Response(
      JSON.stringify({
        success: true,
        feed: "public",
        posts: paginatedPosts,
        pagination: paginationMeta,
        user: user.username,
        includeReplies: includeReplies
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
    const url = new URL(req.url);
    const { page, limit, skip } = getPaginationParams(url);
    const includeReplies = url.searchParams.get('includeReplies') !== 'false'; // Default true

    // Get all post keys
    const { blobs } = await blogStore.list({ prefix: "post_" });
    
    if (blobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          feed: "private",
          posts: [],
          pagination: createPaginationMeta(0, page, limit),
          user: user.username
        }),
        { status: 200, headers }
      );
    }

    // Load posts and filter for user's private posts
    const postPromises = blobs.map(async (blob) => {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        // Only include user's private posts
        if (post && post.isPrivate && post.author === user.username) {
          // Ensure replies array exists and add reply count
          post.replies = post.replies || [];
          post.replyCount = post.replies.length;
          
          // If includeReplies is false, don't send the full replies array
          if (!includeReplies) {
            const replyCount = post.replies.length;
            delete post.replies;
            post.replyCount = replyCount;
          }
          
          return post;
        }
        return null;
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
        return null;
      }
    });
    
    const loadedPosts = await Promise.all(postPromises);
    const privatePosts = loadedPosts.filter(Boolean);

    // Sort posts by timestamp (newest first)
    const sortedPosts = sortPostsByTimestamp(privatePosts);
    
    // Apply pagination
    const paginatedPosts = sortedPosts.slice(skip, skip + limit);
    const paginationMeta = createPaginationMeta(sortedPosts.length, page, limit);

    return new Response(
      JSON.stringify({
        success: true,
        feed: "private",
        posts: paginatedPosts,
        pagination: paginationMeta,
        user: user.username,
        includeReplies: includeReplies
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

// UPDATED: Post handlers with media support
async function handlePosts(req, blogStore, headers, user) {
  if (req.method === 'GET') {
    // Get user's posts with pagination
    try {
      const url = new URL(req.url);
      const { page, limit, skip } = getPaginationParams(url);

      const { blobs } = await blogStore.list({ prefix: "post_" });
      
      if (blobs.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            posts: [],
            pagination: createPaginationMeta(0, page, limit),
            user: user.username
          }),
          { status: 200, headers }
        );
      }

      // Load user's posts
      const postPromises = blobs.map(async (blob) => {
        try {
          const post = await blogStore.get(blob.key, { type: "json" });
          return (post && post.author === user.username) ? post : null;
        } catch (error) {
          console.error(`Error loading post ${blob.key}:`, error);
          return null;
        }
      });
      
      const loadedPosts = await Promise.all(postPromises);
      const userPosts = loadedPosts.filter(Boolean);

      // Sort posts by timestamp (newest first)
      const sortedPosts = sortPostsByTimestamp(userPosts);
      
      // Apply pagination
      const paginatedPosts = sortedPosts.slice(skip, skip + limit);
      const paginationMeta = createPaginationMeta(sortedPosts.length, page, limit);

      return new Response(
        JSON.stringify({
          success: true,
          posts: paginatedPosts,
          pagination: paginationMeta,
          user: user.username
        }),
        { status: 200, headers }
      );

    } catch (error) {
      console.error("Get posts error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve posts" }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers }
  );
}

// NEW: Create reply/comment handler
async function handleCreateReply(req, blogStore, headers, user) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { postId, content } = await req.json();

    if (!postId || !content) {
      return new Response(
        JSON.stringify({ error: "Post ID and content are required" }),
        { status: 400, headers }
      );
    }

    if (content.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Reply content must be 2,000 characters or less" }),
        { status: 400, headers }
      );
    }

    // Get the original post
    const post = await blogStore.get(postId, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }

    // Create the reply
    const reply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      author: user.username,
      timestamp: new Date().toISOString(),
      postId: postId
    };

    // Add reply to post
    post.replies = post.replies || [];
    post.replies.push(reply);

    // Update post in database
    await blogStore.set(postId, JSON.stringify(post));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reply created successfully",
        reply: reply,
        postId: postId,
        totalReplies: post.replies.length
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Create reply error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create reply" }),
      { status: 500, headers }
    );
  }
}
async function handleCreatePost(req, blogStore, headers, user) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { title, content, type = "text", url, description, isPrivate = false } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        { status: 400, headers }
      );
    }

    if (title.length > 200) {
      return new Response(
        JSON.stringify({ error: "Title must be 200 characters or less" }),
        { status: 400, headers }
      );
    }

    // Validate based on post type
    if (type === "text") {
      if (!content) {
        return new Response(
          JSON.stringify({ error: "Content is required for text posts" }),
          { status: 400, headers }
        );
      }
      if (content.length > 10000) {
        return new Response(
          JSON.stringify({ error: "Content must be 10,000 characters or less" }),
          { status: 400, headers }
        );
      }
    } else if (type === "link") {
      if (!url) {
        return new Response(
          JSON.stringify({ error: "URL is required for link posts" }),
          { status: 400, headers }
        );
      }
      
      // Validate URL format
      try {
        new URL(url);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL format" }),
          { status: 400, headers }
        );
      }
      
      if (description && description.length > 2000) {
        return new Response(
          JSON.stringify({ error: "Description must be 2,000 characters or less" }),
          { status: 400, headers }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Post type must be 'text' or 'link'" }),
        { status: 400, headers }
      );
    }

    const post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      title: title.trim(),
      author: user.username,
      timestamp: new Date().toISOString(),
      isPrivate: Boolean(isPrivate),
      replies: [],
      createdViaAPI: true
    };

    // Add type-specific fields
    if (type === "text") {
      post.content = content.trim();
    } else if (type === "link") {
      post.url = url.trim();
      if (description) {
        post.description = description.trim();
      }
      
      // Add media detection metadata
      const mediaInfo = detectMediaType(url);
      post.mediaType = mediaInfo.type;
      post.canEmbed = mediaInfo.embed;
      post.platform = mediaInfo.platform;
    }

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

// Profile handlers (unchanged)
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
    const textPosts = userPosts.filter(post => (post.type || 'text') === 'text');
    const linkPosts = userPosts.filter(post => post.type === 'link');

    // Remove password from user data
    const { password: _, ...profileData } = user;

    const profile = {
      ...profileData,
      stats: {
        totalPosts: userPosts.length,
        publicPosts: publicPosts.length,
        privatePosts: privatePosts.length,
        textPosts: textPosts.length,
        linkPosts: linkPosts.length,
        totalReplies: totalReplies
      },
      recentPosts: sortPostsByTimestamp(userPosts).slice(0, 5)
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

// UPDATED: Default documentation endpoint
async function handleDefault(req, headers) {
  const docs = {
    message: "Blog API v3.1 - Complete CRUD Support",
    endpoints: {
      // Authentication
      "POST /api/auth/login": "Login with username/password",
      "POST /api/auth/register": "Register new account",
      "POST /api/auth/logout": "Logout (invalidate session)",
      
      // Media Detection (NEW)
      "POST /api/media/detect": "Detect media type and generate embed HTML",
      
      // Feeds (requires auth) - Enhanced pagination
      "GET /api/feeds/public": "Get public posts feed (supports ?page=N&limit=N&includeReplies=true/false)",
      "GET /api/feeds/private": "Get user's private posts (supports ?page=N&limit=N&includeReplies=true/false)",
      
      // Posts (requires auth) - COMPLETE CRUD
      "POST /api/posts/create": "Create new post (text or link)",
      "GET /api/posts": "Get user's posts with pagination (supports ?includeReplies=true/false)",
      "GET /api/posts/{postId}": "Get specific post by ID",
      "DELETE /api/posts/{postId}": "Delete specific post (owner or admin only)",
      
      // Replies/Comments (requires auth) - NEW
      "POST /api/replies/create": "Create reply to a post",
      
      // Profile (requires auth)
      "GET /api/profile": "Get user profile with stats",
      "PUT /api/profile/update": "Update user profile"
    },
    newFeatures: {
      deletePost: {
        description: "Delete posts with proper authorization",
        endpoint: "DELETE /api/posts/{postId}",
        authorization: "Only the post owner or admin can delete posts",
        response: {
          success: true,
          message: "Post deleted successfully",
          postId: "post_id_here",
          deletedBy: "username"
        }
      },
      mediaSupport: {
        description: "Full support for text and link posts with media embedding",
        supportedTypes: ["youtube", "vimeo", "image", "video", "audio", "twitter", "instagram", "tiktok", "link"],
        embeddableTypes: ["youtube", "vimeo", "image", "video", "audio"]
      }
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
      "4. Create post": "POST /api/posts/create {title, content, type: 'text'}",
      "5. Delete post": "DELETE /api/posts/{postId} (requires ownership or admin)",
      "6. Access feeds": "GET /api/feeds/public?page=1&limit=10&includeReplies=true"
    }
  };

  return new Response(
    JSON.stringify(docs, null, 2),
    { status: 200, headers }
  );
}
