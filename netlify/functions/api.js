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

    // Media detection endpoint
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

    // Admin endpoints (require admin privileges)
    if (path.startsWith('admin/')) {
      if (!authResult.user.isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin privileges required" }),
          { status: 403, headers }
        );
      }
      
      switch (path) {
        case 'admin/pending-users':
          return await handlePendingUsers(req, blogStore, headers, authResult.user);
        case 'admin/users':
          return await handleAllUsers(req, blogStore, headers, authResult.user);
        case 'admin/approve-user':
          return await handleApproveUser(req, blogStore, headers, authResult.user);
        case 'admin/reject-user':
          return await handleRejectUser(req, blogStore, headers, authResult.user);
        case 'admin/delete-user':
          return await handleDeleteUser(req, blogStore, headers, authResult.user);
        case 'admin/stats':
          return await handleAdminStats(req, blogStore, headers, authResult.user);
      }
    }

    // Regular authenticated routes
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
      // NEW: Like endpoints
      case 'likes/toggle':
        return await handleToggleLike(req, blogStore, headers, authResult.user);
      case 'profile':
        return await handleProfile(req, blogStore, headers, authResult.user);
      case 'profile/update':
        return await handleProfileUpdate(req, blogStore, headers, authResult.user);
      default:
        // Handle dynamic routes like /posts/{postId} and /posts/{postId}/likes
        if (path.startsWith('posts/') && path !== 'posts/create') {
          if (path.endsWith('/likes')) {
            return await handlePostLikes(req, blogStore, headers, authResult.user, path);
          }
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

// NEW LIKE FUNCTIONALITY

// Toggle like/unlike on a post
async function handleToggleLike(req, blogStore, headers, user) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { postId } = await req.json();

    if (!postId) {
      return new Response(
        JSON.stringify({ error: "Post ID is required" }),
        { status: 400, headers }
      );
    }

    // Get the post
    const post = await blogStore.get(postId, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }

    // Check if user can access this post (private posts)
    if (post.isPrivate && post.author !== user.username && !user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers }
      );
    }

    // Initialize likes array if it doesn't exist
    if (!post.likes) {
      post.likes = [];
    }

    // Check if user already liked this post
    const likeIndex = post.likes.findIndex(like => like.username === user.username);
    let action = '';
    
    if (likeIndex !== -1) {
      // User already liked - remove like (unlike)
      post.likes.splice(likeIndex, 1);
      action = 'unliked';
    } else {
      // User hasn't liked - add like
      post.likes.push({
        username: user.username,
        timestamp: new Date().toISOString()
      });
      action = 'liked';
    }

    // Save the updated post
    await blogStore.set(postId, JSON.stringify(post));

    return new Response(
      JSON.stringify({
        success: true,
        action: action,
        postId: postId,
        likesCount: post.likes.length,
        userLiked: action === 'liked'
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Toggle like error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to toggle like" }),
      { status: 500, headers }
    );
  }
}

// Get likes for a specific post
async function handlePostLikes(req, blogStore, headers, user, path) {
  const postId = path.split('/')[1];
  
  if (!postId) {
    return new Response(
      JSON.stringify({ error: "Post ID required" }),
      { status: 400, headers }
    );
  }

  if (req.method === 'GET') {
    try {
      const post = await blogStore.get(postId, { type: "json" });
      
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers }
        );
      }

      // Check if user can access this post (private posts)
      if (post.isPrivate && post.author !== user.username && !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers }
        );
      }

      const likes = post.likes || [];
      const userLiked = likes.some(like => like.username === user.username);

      return new Response(
        JSON.stringify({
          success: true,
          postId: postId,
          likesCount: likes.length,
          userLiked: userLiked,
          likes: likes.map(like => ({
            username: like.username,
            timestamp: like.timestamp
          }))
        }),
        { status: 200, headers }
      );

    } catch (error) {
      console.error("Get post likes error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to get post likes" }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers }
  );
}

// ENHANCED FEED HANDLERS (now include like info)

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
    const includeReplies = url.searchParams.get('includeReplies') !== 'false';

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

    const postPromises = blobs.map(async (blob) => {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post && !post.isPrivate) {
          // Add like information
          post.likes = post.likes || [];
          post.likesCount = post.likes.length;
          post.userLiked = post.likes.some(like => like.username === user.username);
          
          post.replies = post.replies || [];
          post.replyCount = post.replies.length;
          
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
    const sortedPosts = sortPostsByTimestamp(publicPosts);
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
    const includeReplies = url.searchParams.get('includeReplies') !== 'false';

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

    const postPromises = blobs.map(async (blob) => {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post && post.isPrivate && post.author === user.username) {
          // Add like information
          post.likes = post.likes || [];
          post.likesCount = post.likes.length;
          post.userLiked = post.likes.some(like => like.username === user.username);
          
          post.replies = post.replies || [];
          post.replyCount = post.replies.length;
          
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
    const sortedPosts = sortPostsByTimestamp(privatePosts);
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

// ENHANCED POST HANDLERS (now include like info)

async function handlePosts(req, blogStore, headers, user) {
  if (req.method === 'GET') {
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

      const postPromises = blobs.map(async (blob) => {
        try {
          const post = await blogStore.get(blob.key, { type: "json" });
          if (post && post.author === user.username) {
            // Add like information
            post.likes = post.likes || [];
            post.likesCount = post.likes.length;
            post.userLiked = post.likes.some(like => like.username === user.username);
            
            return post;
          }
          return null;
        } catch (error) {
          console.error(`Error loading post ${blob.key}:`, error);
          return null;
        }
      });
      
      const loadedPosts = await Promise.all(postPromises);
      const userPosts = loadedPosts.filter(Boolean);
      const sortedPosts = sortPostsByTimestamp(userPosts);
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

async function handlePostOperations(req, blogStore, headers, user, path) {
  const postId = path.split('/')[1];
  
  if (!postId) {
    return new Response(
      JSON.stringify({ error: "Post ID required" }),
      { status: 400, headers }
    );
  }

  if (req.method === 'GET') {
    try {
      const post = await blogStore.get(postId, { type: "json" });
      
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers }
        );
      }

      if (post.isPrivate && post.author !== user.username && !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers }
        );
      }

      // Add like information
      post.likes = post.likes || [];
      post.likesCount = post.likes.length;
      post.userLiked = post.likes.some(like => like.username === user.username);

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
    try {
      const post = await blogStore.get(postId, { type: "json" });
      
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers }
        );
      }

      if (post.author !== user.username && !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: "Only the author or admin can delete this post" }),
          { status: 403, headers }
        );
      }

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

// ENHANCED CREATE POST (initialize likes)
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
      likes: [], // Initialize likes array
      createdViaAPI: true
    };

    if (type === "text") {
      post.content = content.trim();
    } else if (type === "link") {
      post.url = url.trim();
      if (description) {
        post.description = description.trim();
      }
      
      const mediaInfo = detectMediaType(url);
      post.mediaType = mediaInfo.type;
      post.canEmbed = mediaInfo.embed;
      post.platform = mediaInfo.platform;
    }

    await blogStore.set(post.id, JSON.stringify(post));

    // Add like information for response
    post.likesCount = 0;
    post.userLiked = false;

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

// UPDATED PROFILE HANDLER (include like stats)
async function handleProfile(req, blogStore, headers, user) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { blobs } = await blogStore.list({ prefix: "post_" });
    const userPosts = [];
    let totalReplies = 0;
    let totalLikesReceived = 0;
    let totalLikesGiven = 0;

    // Get all posts to calculate user's like activity
    const allPostPromises = blobs.map(async (blob) => {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post) {
          // Count likes given by this user
          if (post.likes) {
            const userLikedThis = post.likes.some(like => like.username === user.username);
            if (userLikedThis) {
              totalLikesGiven++;
            }
          }
          
          // If this is user's post, count stats
          if (post.author === user.username) {
            userPosts.push(post);
            totalReplies += post.replies ? post.replies.length : 0;
            totalLikesReceived += post.likes ? post.likes.length : 0;
          }
        }
        return post;
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
        return null;
      }
    });

    await Promise.all(allPostPromises);

    const publicPosts = userPosts.filter(post => !post.isPrivate);
    const privatePosts = userPosts.filter(post => post.isPrivate);
    const textPosts = userPosts.filter(post => (post.type || 'text') === 'text');
    const linkPosts = userPosts.filter(post => post.type === 'link');

    const { password: _, ...profileData } = user;

    const profile = {
      ...profileData,
      stats: {
        totalPosts: userPosts.length,
        publicPosts: publicPosts.length,
        privatePosts: privatePosts.length,
        textPosts: textPosts.length,
        linkPosts: linkPosts.length,
        totalReplies: totalReplies,
        totalLikesReceived: totalLikesReceived,
        totalLikesGiven: totalLikesGiven,
        averageLikesPerPost: userPosts.length > 0 ? (totalLikesReceived / userPosts.length).toFixed(1) : 0
      },
      recentPosts: sortPostsByTimestamp(userPosts).slice(0, 5).map(post => ({
        ...post,
        likesCount: post.likes ? post.likes.length : 0,
        userLiked: post.likes ? post.likes.some(like => like.username === user.username) : false
      }))
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

// UPDATED ADMIN STATS (include like statistics)
async function handleAdminStats(req, blogStore, headers, admin) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    // Get all blobs to calculate stats
    const [userBlobs, postBlobs, pendingBlobs] = await Promise.all([
      blogStore.list({ prefix: "user_" }),
      blogStore.list({ prefix: "post_" }),
      blogStore.list({ prefix: "pending_user_" })
    ]);

    let totalPublicPosts = 0;
    let totalPrivatePosts = 0;
    let totalReplies = 0;
    let totalLikes = 0;
    let postsWithLikes = 0;

    // Count posts, replies, and likes
    for (const blob of postBlobs.blobs) {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post) {
          if (post.isPrivate) {
            totalPrivatePosts++;
          } else {
            totalPublicPosts++;
          }
          totalReplies += (post.replies || []).length;
          
          // Count likes
          const likesCount = (post.likes || []).length;
          totalLikes += likesCount;
          if (likesCount > 0) {
            postsWithLikes++;
          }
        }
      } catch (error) {
        console.error(`Error loading post ${blob.key}:`, error);
      }
    }

    const totalPosts = totalPublicPosts + totalPrivatePosts;

    const stats = {
      users: {
        total: userBlobs.blobs.length,
        pending: pendingBlobs.blobs.length,
        approved: userBlobs.blobs.length
      },
      posts: {
        total: totalPosts,
        public: totalPublicPosts,
        private: totalPrivatePosts
      },
      engagement: {
        totalReplies: totalReplies,
        totalLikes: totalLikes,
        postsWithLikes: postsWithLikes,
        averageRepliesPerPost: totalPosts > 0 ? (totalReplies / totalPosts).toFixed(2) : 0,
        averageLikesPerPost: totalPosts > 0 ? (totalLikes / totalPosts).toFixed(2) : 0,
        likedPostsPercentage: totalPosts > 0 ? ((postsWithLikes / totalPosts) * 100).toFixed(1) : 0
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        stats: stats
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get admin stats error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load admin statistics" }),
      { status: 500, headers }
    );
  }
}

// UPDATED DOCUMENTATION
async function handleDefault(req, headers) {
  const docs = {
    message: "Blog API v4.1 - Now with Post Likes! ❤️",
    endpoints: {
      // Authentication
      "POST /api/auth/login": "Login with username/password",
      "POST /api/auth/register": "Register new account (requires admin approval)",
      "POST /api/auth/logout": "Logout (invalidate session)",
      
      // Admin endpoints (require admin privileges)
      "GET /api/admin/pending-users": "Get all users pending approval",
      "GET /api/admin/users": "Get all approved users with post counts",
      "POST /api/admin/approve-user": "Approve a pending user",
      "POST /api/admin/reject-user": "Reject a pending user",
      "POST /api/admin/delete-user": "Delete user and all their posts",
      "GET /api/admin/stats": "Get admin dashboard statistics (now includes like stats!)",
      
      // Media Detection
      "POST /api/media/detect": "Detect media type and generate embed HTML",
      
      // Feeds (requires auth) - now include like info
      "GET /api/feeds/public": "Get public posts feed with likes",
      "GET /api/feeds/private": "Get user's private posts with likes",
      
      // Posts (requires auth) - now include like info
      "POST /api/posts/create": "Create new post (text or link)",
      "GET /api/posts": "Get user's posts with pagination and likes",
      "GET /api/posts/{postId}": "Get specific post by ID with likes",
      "DELETE /api/posts/{postId}": "Delete specific post",
      
      // NEW: Like endpoints
      "POST /api/likes/toggle": "Like or unlike a post (body: {postId})",
      "GET /api/posts/{postId}/likes": "Get all likes for a specific post",
      
      // Replies/Comments (requires auth)
      "POST /api/replies/create": "Create reply to a post",
      
      // Profile (requires auth) - now includes like stats
      "GET /api/profile": "Get user profile with stats (includes like statistics)",
      "PUT /api/profile/update": "Update user profile (bio, profilePictureUrl)"
    },
    newFeatures: {
      postLikes: {
        description: "Users can now like and unlike posts! ❤️",
        features: [
          "Toggle like/unlike with POST /api/likes/toggle",
          "All posts now include likesCount and userLiked fields", 
          "View all likes for a post with GET /api/posts/{postId}/likes",
          "Like statistics in user profiles and admin dashboard",
          "Likes are stored with username and timestamp"
        ],
        responseFields: {
          likesCount: "Number of likes on the post",
          userLiked: "Boolean indicating if current user liked the post", 
          likes: "Array of like objects with username and timestamp"
        }
      },
      adminApproval: {
        description: "All new user registrations require admin approval",
        workflow: "Register → Pending → Admin approves/rejects → Active user"
      },
      userManagement: {
        description: "Complete user management for admins",
        features: ["View all users", "Delete users", "Delete user's posts", "User statistics"]
      },
      urlProfilePictures: {
        description: "Profile pictures now use URLs instead of file uploads",
        validation: "Must be PNG or GIF files with valid HTTP/HTTPS URLs",
        apiField: "profilePictureUrl"
      }
    },
    authentication: {
      session: {
        method: "Bearer token",
        header: "Authorization: Bearer <session-token>",
        obtain: "POST /api/auth/login",
        duration: "7 days"
      },
      admin: {
        note: "Admin endpoints require isAdmin: true in user profile"
      }
    },
    likeSystem: {
      howItWorks: "Users can like/unlike any post they can view (public posts + their own private posts)",
      storage: "Likes are stored in the post object as an array of {username, timestamp} objects",
      privacy: "Users can only see who liked a post, not who they follow/etc",
      restrictions: "Users cannot like private posts of other users"
    }
  };

  return new Response(
    JSON.stringify(docs, null, 2),
    { status: 200, headers }
  );
}

// Keep all existing utility functions and handlers...
// (All the existing functions remain the same: validateProfilePictureUrl, handleRegister, handleLogin, handleLogout, validateAuth, etc.)

// Utility function to validate profile picture URL
function validateProfilePictureUrl(url) {
  if (!url) return { valid: false, error: "URL is required" };
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check if URL ends with .png or .gif
    if (!pathname.endsWith('.png') && !pathname.endsWith('.gif')) {
      return { valid: false, error: "Profile picture must be a PNG or GIF file" };
    }
    
    // Check if it's HTTP/HTTPS
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { valid: false, error: "URL must use HTTP or HTTPS protocol" };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid URL format" };
  }
}

// ADMIN HANDLERS (unchanged)
async function handlePendingUsers(req, blogStore, headers, admin) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { blobs } = await blogStore.list({ prefix: "pending_user_" });
    const pendingUsers = [];

    for (const blob of blobs) {
      try {
        const user = await blogStore.get(blob.key, { type: "json" });
        if (user) {
          // Remove password from response
          const { password, ...userWithoutPassword } = user;
          pendingUsers.push(userWithoutPassword);
        }
      } catch (error) {
        console.error(`Error loading pending user ${blob.key}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pendingUsers: pendingUsers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get pending users error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load pending users" }),
      { status: 500, headers }
    );
  }
}

async function handleAllUsers(req, blogStore, headers, admin) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { blobs } = await blogStore.list({ prefix: "user_" });
    const users = [];

    for (const blob of blobs) {
      try {
        const user = await blogStore.get(blob.key, { type: "json" });
        if (user) {
          // Remove password from response and add post counts
          const { password, ...userWithoutPassword } = user;
          
          // Get post counts for this user
          const { blobs: postBlobs } = await blogStore.list({ prefix: "post_" });
          let publicPosts = 0;
          let privatePosts = 0;
          
          for (const postBlob of postBlobs) {
            try {
              const post = await blogStore.get(postBlob.key, { type: "json" });
              if (post && post.author === user.username) {
                if (post.isPrivate) {
                  privatePosts++;
                } else {
                  publicPosts++;
                }
              }
            } catch (error) {
              console.error(`Error loading post ${postBlob.key}:`, error);
            }
          }
          
          users.push({
            ...userWithoutPassword,
            postCounts: {
              public: publicPosts,
              private: privatePosts,
              total: publicPosts + privatePosts
            }
          });
        }
      } catch (error) {
        console.error(`Error loading user ${blob.key}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        users: users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get all users error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load users" }),
      { status: 500, headers }
    );
  }
}

async function handleApproveUser(req, blogStore, headers, admin) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers }
      );
    }

    // Get pending user
    const pendingUser = await blogStore.get(`pending_user_${username}`, { type: "json" });
    if (!pendingUser) {
      return new Response(
        JSON.stringify({ error: "Pending user not found" }),
        { status: 404, headers }
      );
    }

    // Move to approved users
    const approvedUser = {
      ...pendingUser,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: admin.username
    };

    await blogStore.set(`user_${username}`, JSON.stringify(approvedUser));
    await blogStore.delete(`pending_user_${username}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User approved successfully",
        user: { username: approvedUser.username, approvedAt: approvedUser.approvedAt }
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Approve user error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to approve user" }),
      { status: 500, headers }
    );
  }
}

async function handleRejectUser(req, blogStore, headers, admin) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers }
      );
    }

    // Delete pending user
    const pendingUser = await blogStore.get(`pending_user_${username}`, { type: "json" });
    if (!pendingUser) {
      return new Response(
        JSON.stringify({ error: "Pending user not found" }),
        { status: 404, headers }
      );
    }

    await blogStore.delete(`pending_user_${username}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User rejected successfully",
        username: username
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Reject user error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to reject user" }),
      { status: 500, headers }
    );
  }
}

async function handleDeleteUser(req, blogStore, headers, admin) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers }
      );
    }

    // Prevent admin from deleting themselves
    if (username === admin.username) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own admin account" }),
        { status: 400, headers }
      );
    }

    // Get user to verify it exists
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }

    // Delete all posts by this user
    const { blobs } = await blogStore.list({ prefix: "post_" });
    let deletedPosts = 0;

    for (const blob of blobs) {
      try {
        const post = await blogStore.get(blob.key, { type: "json" });
        if (post && post.author === username) {
          await blogStore.delete(blob.key);
          deletedPosts++;
        }
      } catch (error) {
        console.error(`Error deleting post ${blob.key}:`, error);
      }
    }

    // Delete user account
    await blogStore.delete(`user_${username}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User and all associated data deleted successfully",
        deletedUser: username,
        deletedPosts: deletedPosts,
        deletedBy: admin.username
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Delete user error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete user" }),
      { status: 500, headers }
    );
  }
}

// AUTH HANDLERS (unchanged)
async function handleRegister(req, blogStore, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password, bio, profilePictureUrl } = await req.json();

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

    // Check if user already exists (both approved and pending)
    const [existingUser, pendingUser] = await Promise.all([
      blogStore.get(`user_${username}`, { type: "json" }),
      blogStore.get(`pending_user_${username}`, { type: "json" })
    ]);

    if (existingUser || pendingUser) {
      return new Response(
        JSON.stringify({ error: "Username already exists or is pending approval" }),
        { status: 409, headers }
      );
    }

    // Validate profile picture URL if provided
    if (profilePictureUrl) {
      const validation = validateProfilePictureUrl(profilePictureUrl);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers }
        );
      }
    }

    // Create pending user (requires admin approval)
    const pendingUserData = {
      username,
      password,
      bio: bio || `Hello! I'm ${username}`,
      profilePictureUrl: profilePictureUrl || null,
      createdAt: new Date().toISOString(),
      status: 'pending',
      isAdmin: false
    };

    await blogStore.set(`pending_user_${username}`, JSON.stringify(pendingUserData));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration submitted for admin approval",
        status: "pending",
        username: username
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

async function handleProfileUpdate(req, blogStore, headers, user) {
  if (req.method !== 'PUT') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { bio, profilePictureUrl } = await req.json();

    if (bio && bio.length > 500) {
      return new Response(
        JSON.stringify({ error: "Bio must be 500 characters or less" }),
        { status: 400, headers }
      );
    }

    // Validate profile picture URL if provided
    if (profilePictureUrl !== undefined) {
      if (profilePictureUrl !== null && profilePictureUrl !== '') {
        const validation = validateProfilePictureUrl(profilePictureUrl);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 400, headers }
          );
        }
      }
    }

    // Update user profile
    const updatedUser = {
      ...user,
      bio: bio !== undefined ? bio : user.bio,
      profilePictureUrl: profilePictureUrl !== undefined ? profilePictureUrl : user.profilePictureUrl,
      updatedAt: new Date().toISOString()
    };

    await blogStore.set(`user_${user.username}`, JSON.stringify(updatedUser));

    // Remove password from response
    const { password, ...profileData } = updatedUser;

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
      // Check if user is pending approval
      const pendingUser = await blogStore.get(`pending_user_${username}`, { type: "json" });
      if (pendingUser) {
        return new Response(
          JSON.stringify({ error: "Your account is pending admin approval" }),
          { status: 401, headers }
        );
      }
      
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

  // Check for API key authentication
  if (apiKey) {
    if (apiKey === API_CONFIG.MASTER_API_KEY) {
      return { 
        valid: true, 
        user: { username: "admin", permissions: ["read", "write", "admin"], isAdmin: true },
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

// Utility functions
function getPaginationParams(url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(API_CONFIG.MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get('limit')) || API_CONFIG.DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

function sortPostsByTimestamp(posts) {
  return posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

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

// MEDIA DETECTION HANDLERS (unchanged)
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
    
    // Direct images
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    if (imageExts.some(ext => pathname.endsWith(ext))) {
      return `<img src="${url}" alt="Linked image" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;" loading="lazy" onerror="this.style.display='none';">`;
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

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

    const post = await blogStore.get(postId, { type: "json" });
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers }
      );
    }

    const reply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      author: user.username,
      timestamp: new Date().toISOString(),
      postId: postId
    };

    post.replies = post.replies || [];
    post.replies.push(reply);

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
