// netlify/functions/chat-api.js - Complete ESM Chat system backend API with Fix 4
import { getStore } from "@netlify/blobs";

// Chat API configuration
const CHAT_CONFIG = {
  MAX_ROOM_NAME_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_ROOMS_PER_USER: 50,
  MESSAGE_BATCH_SIZE: 50,
  ROOM_INACTIVE_DAYS: 30
};

export default async (req, context) => {
  // Use the context object provided by Netlify
  const chatStore = getStore({
    name: "chat-data",
    siteID: context.site?.id || process.env.SITE_ID,
    token: context.token || process.env.NETLIFY_AUTH_TOKEN
  });
  
  const blogStore = getStore({
    name: "blog-data",
    siteID: context.site?.id || process.env.SITE_ID,
    token: context.token || process.env.NETLIFY_AUTH_TOKEN
  });

  const apiStore = getStore({
    name: "blog-api-data",
    siteID: context.site?.id || process.env.SITE_ID,
    token: context.token || process.env.NETLIFY_AUTH_TOKEN
  });
  
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Remove 'chat-api' from path if present
    const apiIndex = pathParts.indexOf('chat-api');
    const path = apiIndex !== -1 ? pathParts.slice(apiIndex + 1) : pathParts.slice(1);
    
    // Public endpoints (no auth required)
    if (req.method === "GET" && path[0] === "rooms" && path[1] === "public") {
      return getPublicRooms(chatStore, headers);
    }
    
    // Validate authentication for other endpoints
    const authValidation = await validateAuth(req, apiStore, blogStore);
    if (!authValidation.valid) {
      return new Response(
        JSON.stringify({ error: authValidation.error }),
        { status: authValidation.status || 401, headers }
      );
    }
    
    const user = authValidation.user;

    // Route handling
    if (path[0] === "rooms") {
      if (!path[1]) {
        // /rooms
        if (req.method === "GET") {
          return getUserRooms(chatStore, user, headers);
        } else if (req.method === "POST") {
          return createRoom(req, chatStore, user, headers);
        }
      } else {
        const roomId = path[1];
        
        if (path[2] === "join") {
          // /rooms/{roomId}/join
          if (req.method === "POST") {
            return joinRoom(roomId, chatStore, user, headers);
          }
        } else if (path[2] === "leave") {
          // /rooms/{roomId}/leave
          if (req.method === "POST") {
            return leaveRoom(roomId, chatStore, user, headers);
          }
        } else if (path[2] === "messages") {
          // /rooms/{roomId}/messages
          if (req.method === "GET") {
            return getRoomMessages(roomId, req, chatStore, user, headers);
          } else if (req.method === "POST") {
            return sendMessage(roomId, req, chatStore, user, headers);
          }
        } else if (!path[2]) {
          // /rooms/{roomId}
          if (req.method === "GET") {
            return getRoomDetails(roomId, chatStore, user, headers);
          } else if (req.method === "DELETE") {
            return deleteRoom(roomId, chatStore, user, headers);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      { status: 404, headers }
    );

  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers }
    );
  }
};

// Validate authentication
async function validateAuth(req, apiStore, blogStore) {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Authentication required", status: 401 };
  }

  try {
    const token = authHeader.substring(7);
    
    // Get session from API store using the token
    const session = await apiStore.get(`session_${token}`, { type: "json" });
    
    if (!session) {
      return { valid: false, error: "Invalid session", status: 401 };
    }
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      return { valid: false, error: "Session expired", status: 401 };
    }
    
    // Check if session is active
    if (!session.active) {
      return { valid: false, error: "Session inactive", status: 401 };
    }
    
    // Get full user profile from blog store
    const userProfile = await blogStore.get(`user_${session.username}`, { type: "json" });
    
    if (!userProfile) {
      return { valid: false, error: "User not found", status: 404 };
    }

    return { valid: true, user: userProfile };
    
  } catch (error) {
    console.error("Auth validation error:", error);
    return { valid: false, error: "Authentication error", status: 500 };
  }
}

// Helper function to generate unique IDs
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get user's rooms
async function getUserRooms(chatStore, user, headers) {
  try {
    const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
    
    const roomPromises = userRooms.map(async (roomId) => {
      const room = await chatStore.get(`room_${roomId}`, { type: "json" });
      if (!room) return null;
      
      // Get last message
      const { blobs } = await chatStore.list({ 
        prefix: `message_${roomId}_`,
        limit: 1
      });
      
      let lastMessage = null;
      if (blobs.length > 0) {
        lastMessage = await chatStore.get(blobs[0].key, { type: "json" });
      }

      return {
        ...room,
        lastMessage,
        unreadCount: 0 // TODO: Implement read receipts
      };
    });

    const rooms = await Promise.all(roomPromises);
    const validRooms = rooms.filter(room => room !== null);

    return new Response(
      JSON.stringify({ 
        success: true, 
        rooms: validRooms 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get user rooms error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load rooms" }),
      { status: 500, headers }
    );
  }
}

// Get public rooms (no auth required)
async function getPublicRooms(chatStore, headers) {
  try {
    const publicRoomIds = await chatStore.get('public_rooms', { type: "json" }) || [];
    
    const roomPromises = publicRoomIds.map(async (roomId) => {
      const room = await chatStore.get(`room_${roomId}`, { type: "json" });
      return room;
    });

    const rooms = await Promise.all(roomPromises);
    const validRooms = rooms.filter(room => room !== null);

    return new Response(
      JSON.stringify({ 
        success: true, 
        rooms: validRooms 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get public rooms error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load public rooms" }),
      { status: 500, headers }
    );
  }
}

// Create room - Already adds user as member
async function createRoom(req, chatStore, user, headers) {
  try {
    const { name, description = "", isPrivate = false } = await req.json();

    if (!name || name.length > CHAT_CONFIG.MAX_ROOM_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Invalid room name" }),
        { status: 400, headers }
      );
    }

    if (description.length > CHAT_CONFIG.MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Description too long" }),
        { status: 400, headers }
      );
    }

    // Check user's room limit
    const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
    if (userRooms.length >= CHAT_CONFIG.MAX_ROOMS_PER_USER) {
      return new Response(
        JSON.stringify({ error: "Room limit reached" }),
        { status: 400, headers }
      );
    }

    const roomId = generateId();
    const room = {
      id: roomId,
      name,
      description,
      owner: user.username,
      members: [user.username], // Creator is automatically a member
      isPrivate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await chatStore.set(`room_${roomId}`, JSON.stringify(room));
    
    // Add to user's rooms
    userRooms.push(roomId);
    await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(userRooms));

    // Add to public rooms index if not private
    if (!isPrivate) {
      const publicRooms = await chatStore.get('public_rooms', { type: "json" }) || [];
      publicRooms.push(roomId);
      await chatStore.set('public_rooms', JSON.stringify(publicRooms));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        room,
        message: "Room created successfully"
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Create room error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create room" }),
      { status: 500, headers }
    );
  }
}

// Join room - FIX 4: Returns success if already member instead of error
async function joinRoom(roomId, chatStore, user, headers) {
  try {
    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // FIX 4: Return success with room data if already a member
    if (room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          room: room,
          alreadyMember: true,
          message: "You are already a member of this room"
        }),
        { status: 200, headers } // Changed from 400 to 200
      );
    }

    // Add user to room
    room.members.push(user.username);
    room.updatedAt = new Date().toISOString();
    await chatStore.set(`room_${roomId}`, JSON.stringify(room));

    // Add room to user's rooms
    const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
    if (!userRooms.includes(roomId)) {
      userRooms.push(roomId);
      await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(userRooms));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        room: room,
        alreadyMember: false,
        message: "Successfully joined the room"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Join room error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to join room" }),
      { status: 500, headers }
    );
  }
}

// Leave room
async function leaveRoom(roomId, chatStore, user, headers) {
  try {
    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    if (!room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Not a member" }),
        { status: 400, headers }
      );
    }

    // Don't allow owner to leave
    if (room.owner === user.username) {
      return new Response(
        JSON.stringify({ error: "Owner cannot leave room. Delete the room instead." }),
        { status: 400, headers }
      );
    }

    // Remove user from room
    room.members = room.members.filter(member => member !== user.username);
    room.updatedAt = new Date().toISOString();
    await chatStore.set(`room_${roomId}`, JSON.stringify(room));

    // Remove room from user's rooms
    const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
    const updatedUserRooms = userRooms.filter(id => id !== roomId);
    await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(updatedUserRooms));

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Successfully left the room"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Leave room error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to leave room" }),
      { status: 500, headers }
    );
  }
}

// Get room details
async function getRoomDetails(roomId, chatStore, user, headers) {
  try {
    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Check if user is a member (unless it's a public room)
    if (room.isPrivate && !room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers }
      );
    }

    return new Response(
      JSON.stringify(room),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get room details error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get room details" }),
      { status: 500, headers }
    );
  }
}

// Delete room (owner only)
async function deleteRoom(roomId, chatStore, user, headers) {
  try {
    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Only owner can delete
    if (room.owner !== user.username) {
      return new Response(
        JSON.stringify({ error: "Only the owner can delete this room" }),
        { status: 403, headers }
      );
    }

    // Delete all messages in the room
    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    for (const blob of blobs) {
      await chatStore.delete(blob.key);
    }

    // Remove room from all users' rooms
    for (const member of room.members) {
      const userRooms = await chatStore.get(`user_rooms_${member}`, { type: "json" }) || [];
      const updatedUserRooms = userRooms.filter(id => id !== roomId);
      await chatStore.set(`user_rooms_${member}`, JSON.stringify(updatedUserRooms));
    }

    // Remove from public rooms if applicable
    if (!room.isPrivate) {
      const publicRooms = await chatStore.get('public_rooms', { type: "json" }) || [];
      const updatedPublicRooms = publicRooms.filter(id => id !== roomId);
      await chatStore.set('public_rooms', JSON.stringify(updatedPublicRooms));
    }

    // Delete the room
    await chatStore.delete(`room_${roomId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Room deleted successfully"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Delete room error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete room" }),
      { status: 500, headers }
    );
  }
}

// Get room messages
async function getRoomMessages(roomId, req, chatStore, user, headers) {
  try {
    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    if (!room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this room" }),
        { status: 403, headers }
      );
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const before = url.searchParams.get('before');

    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    
    // Sort by timestamp (newest first)
    const sortedBlobs = blobs.sort((a, b) => {
      const timeA = a.key.split('_')[2];
      const timeB = b.key.split('_')[2];
      return timeB.localeCompare(timeA);
    });

    // Filter by 'before' parameter if provided
    const filteredBlobs = before ? 
      sortedBlobs.filter(blob => blob.key.split('_')[2] < before) : 
      sortedBlobs;

    // Limit results
    const limitedBlobs = filteredBlobs.slice(0, limit);

    const messagePromises = limitedBlobs.map(async (blob) => {
      try {
        return await chatStore.get(blob.key, { type: "json" });
      } catch (error) {
        console.error(`Error loading message ${blob.key}:`, error);
        return null;
      }
    });

    const messages = await Promise.all(messagePromises);
    const validMessages = messages.filter(msg => msg !== null);

    // Reverse to get chronological order (oldest first)
    validMessages.reverse();

    return new Response(
      JSON.stringify({
        success: true,
        messages: validMessages,
        hasMore: filteredBlobs.length > limit
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get room messages error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load messages" }),
      { status: 500, headers }
    );
  }
}

// Send message
async function sendMessage(roomId, req, chatStore, user, headers) {
  try {
    const { content } = await req.json();

    if (!content || content.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Invalid message content" }),
        { status: 400, headers }
      );
    }

    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    if (!room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this room" }),
        { status: 403, headers }
      );
    }

    // Create message
    const timestamp = new Date().toISOString();
    const messageId = generateId();
    const message = {
      id: messageId,
      roomId,
      content,
      author: user.username,
      authorDisplayName: user.displayName || user.username,
      createdAt: timestamp,
      edited: false
    };

    await chatStore.set(`message_${roomId}_${timestamp}_${messageId}`, JSON.stringify(message));

    // Update room's last activity
    room.updatedAt = timestamp;
    await chatStore.set(`room_${roomId}`, JSON.stringify(room));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        timestamp: timestamp
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send message" }),
      { status: 500, headers }
    );
  }
}
// api.js - API and storage operations

// ============================================
// TOKEN MANAGEMENT SYSTEM (NEW)
// ============================================

// Store the session token in a variable
let currentSessionToken = null;

// Get auth token function
async function getAuthToken() {
    // First, check if we have a token in memory
    if (currentSessionToken) {
        return currentSessionToken;
    }
    
    // Try to get from localStorage
    const storedToken = localStorage.getItem('sessionToken');
    if (storedToken) {
        currentSessionToken = storedToken;
        return storedToken;
    }
    
    // If no token found, user needs to authenticate
    console.warn('No authentication token found');
    return null;
}

// Set auth token function
function setAuthToken(token) {
    currentSessionToken = token;
    // Store in localStorage for persistence
    localStorage.setItem('sessionToken', token);
    console.log('Token stored in localStorage');
}

// Clear auth token function
function clearAuthToken() {
    currentSessionToken = null;
    localStorage.removeItem('sessionToken');
    console.log('Token cleared from localStorage');
}

// ============================================
// NETLIFY BLOBS API IMPLEMENTATION (UNCHANGED)
// ============================================

const blobAPI = {
    async get(key) {
        try {
            const response = await fetch(`/.netlify/functions/blobs?key=${encodeURIComponent(key)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error getting blob:', error);
            return null;
        }
    },
    
    async set(key, value) {
        try {
            const response = await fetch('/.netlify/functions/blobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error setting blob:', error);
            throw error;
        }
    },
    
    async list(prefix = '') {
        try {
            const response = await fetch(`/.netlify/functions/blobs?list=true&prefix=${encodeURIComponent(prefix)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.keys || [];
        } catch (error) {
            console.error('Error listing blobs:', error);
            return [];
        }
    },
    
    async delete(key) {
        try {
            const response = await fetch('/.netlify/functions/blobs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting blob:', error);
            throw error;
        }
    }
};

// Data loading functions
async function loadUser() {
    try {
        const userData = await blobAPI.get('current_user');
        if (userData) {
            currentUser = userData;
            const fullProfile = await blobAPI.get(`user_${userData.username}`);
            if (fullProfile) {
                currentUser.profile = fullProfile;
            }
            
            // Load user's followed communities after loading user
            await loadFollowedCommunities();
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadCommunities() {
    try {
        const communityKeys = await blobAPI.list('community_');
        const communityPromises = communityKeys.map(async (key) => {
            try {
                return await blobAPI.get(key);
            } catch (error) {
                console.error(`Error loading community ${key}:`, error);
                return null;
            }
        });
        
        const loadedCommunities = await Promise.all(communityPromises);
        communities = loadedCommunities
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Update community dropdown in compose modal
        updateCommunityDropdown();
        
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        if (!isLoading) {
            isLoading = true;
            updateFeedContent('<div class="loading">Loading...</div>');
        }
        
        const postKeys = await blobAPI.list('post_');
        const postPromises = postKeys.map(async (key) => {
            try {
                return await blobAPI.get(key);
            } catch (error) {
                console.error(`Error loading post ${key}:`, error);
                return null;
            }
        });
        
        const loadedPosts = await Promise.all(postPromises);
        posts = loadedPosts
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    } finally {
        isLoading = false;
    }
}

// User's followed communities storage
let followedCommunities = new Set();

// Load user's followed communities from storage
async function loadFollowedCommunities() {
    if (!currentUser) {
        followedCommunities = new Set();
        return;
    }

    try {
        const userFollows = await blobAPI.get(`user_follows_${currentUser.username}`);
        followedCommunities = new Set(userFollows?.communities || []);
        console.log('Loaded followed communities:', Array.from(followedCommunities));
    } catch (error) {
        console.error('Error loading followed communities:', error);
        followedCommunities = new Set();
    }
}

// Save user's followed communities to storage
async function saveFollowedCommunities() {
    if (!currentUser) return;

    try {
        const followData = {
            username: currentUser.username,
            communities: Array.from(followedCommunities),
            lastUpdated: new Date().toISOString()
        };
        await blobAPI.set(`user_follows_${currentUser.username}`, followData);
        console.log('Saved followed communities:', followData);
    } catch (error) {
        console.error('Error saving followed communities:', error);
    }
}

// Check if user is following a specific community
async function checkIfFollowing(communityName) {
    if (!currentUser) return false;
    
    // Load followed communities if not already loaded
    if (followedCommunities.size === 0) {
        await loadFollowedCommunities();
    }
    
    const isFollowing = followedCommunities.has(communityName);
    console.log(`User ${currentUser.username} is ${isFollowing ? '' : 'not '}following ${communityName}`);
    return isFollowing;
}

// Update toggleFollowStatus to refresh followed feed if currently viewing it
async function toggleFollowStatus(communityName, shouldFollow) {
    if (!currentUser) {
        throw new Error('User not authenticated');
    }

    try {
        // Update user's followed communities
        if (shouldFollow) {
            followedCommunities.add(communityName);
        } else {
            followedCommunities.delete(communityName);
        }

        // Save user's followed communities
        await saveFollowedCommunities();

        // Update community member count
        const community = communities.find(c => c.name === communityName);
        if (community) {
            // Initialize members array if it doesn't exist
            if (!community.members) {
                community.members = [community.createdBy]; // Creator is always a member
            }

            if (shouldFollow) {
                // Add user to community members if not already there
                if (!community.members.includes(currentUser.username)) {
                    community.members.push(currentUser.username);
                }
            } else {
                // Remove user from community members (but keep creator)
                if (currentUser.username !== community.createdBy) {
                    community.members = community.members.filter(member => member !== currentUser.username);
                }
            }

            // Save updated community to storage
            await blobAPI.set(`community_${communityName}`, community);
            console.log(`Updated community ${communityName} members:`, community.members);

            // Update local communities array
            const localCommunityIndex = communities.findIndex(c => c.name === communityName);
            if (localCommunityIndex !== -1) {
                communities[localCommunityIndex] = community;
            }

            // Update member count display on page
            updateCommunityMemberCount(communityName, community.members.length);
        }

        // If we're currently viewing the followed feed, refresh it
        if (currentPage === 'feed' && currentFeedTab === 'followed') {
            console.log('Refreshing followed feed after follow status change');
            setTimeout(() => {
                renderFollowedFeed();
            }, 100); // Small delay to allow UI to update first
        }

        return {
            success: true,
            following: shouldFollow,
            memberCount: community?.members?.length || 1
        };

    } catch (error) {
        console.error('Error toggling follow status:', error);
        throw error;
    }
}

// ============================================
// AUTHENTICATION FUNCTIONS - UPDATED TO USE API
// ============================================

async function handleAuth(e) {
    e.preventDefault();
    const form = e.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const bio = document.getElementById('bio').value.trim();
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');

    errorDiv.innerHTML = '';
    
    if (username.length < 3) {
        showError('authError', 'Username must be at least 3 characters long');
        return;
    }
    
    if (password.length < 6) {
        showError('authError', 'Password must be at least 6 characters long');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Loading...';

        if (mode === 'signup') {
            // Call the registration API
            const response = await fetch('/.netlify/functions/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, bio: bio || `Hello! I'm ${username}` })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            closeModal('authModal');
            showSuccessMessage('Account created! Waiting for admin approval.');
            
        } else {
            // Call the login API
            const response = await fetch('/.netlify/functions/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (data.error === 'Your account is pending admin approval') {
                    showError('authError', 'Your account is still pending admin approval.');
                } else {
                    showError('authError', data.error || 'Invalid username or password');
                }
                return;
            }

            // Store the session token - THIS IS CRITICAL FOR CHAT
            if (data.token) {
                setAuthToken(data.token);
                console.log('Session token stored:', data.token);
            }

            // Store user data
            currentUser = { 
                username: data.user.username, 
                profile: data.user 
            };
            
            // Store in blob API for other purposes
            await blobAPI.set('current_user', currentUser);
            
            // Load user's followed communities after login
            await loadFollowedCommunities();
            
            // Initialize chat system after successful login
            if (typeof initializeChat === 'function') {
                await initializeChat();
            }
            
            closeModal('authModal');
            updateUI();
            showSuccessMessage('Welcome back!');

            if (data.user.isAdmin) {
                await loadAdminStats();
            }
        }
        
        form.reset();
        
    } catch (error) {
        console.error('Auth error:', error);
        showError('authError', error.message || 'Something went wrong. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
    }
}

async function logout() {
    try {
        const token = await getAuthToken();
        
        if (token) {
            // Notify the server about logout
            await fetch('/.netlify/functions/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        // Clear auth token
        clearAuthToken();
        
        // Clear user state
        currentUser = null;
        followedCommunities = new Set();
        
        // Try to delete current_user key, but don't fail if it doesn't exist
        try {
            await blobAPI.delete('current_user');
        } catch (deleteError) {
            // Ignore 404 errors - the key might not exist
            if (!deleteError.message.includes('404')) {
                console.warn('Failed to delete current_user key:', deleteError);
            }
        }
        
        // Hide admin panel
        document.getElementById('adminPanel').style.display = 'none';
        
        navigateToFeed();
        updateUI();
        showSuccessMessage('Logged out successfully!');
    } catch (error) {
        console.error('Logout error:', error);
        // Even if there's an error, still clear the user state
        clearAuthToken();
        currentUser = null;
        followedCommunities = new Set();
        document.getElementById('adminPanel').style.display = 'none';
        navigateToFeed();
        updateUI();
        showSuccessMessage('Logged out successfully!');
    }
}

// Inline login handling - UPDATED TO USE API
async function handleInlineLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('inlineUsername').value.trim();
    const password = document.getElementById('inlinePassword').value;
    const errorDiv = document.getElementById('inlineLoginError');
    const submitBtn = document.getElementById('inlineLoginBtn');

    errorDiv.innerHTML = '';
    
    if (username.length < 3) {
        showInlineError('Username must be at least 3 characters long');
        return;
    }
    
    if (password.length < 6) {
        showInlineError('Password must be at least 6 characters long');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        // Call the login API
        const response = await fetch('/.netlify/functions/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            if (data.error === 'Your account is pending admin approval') {
                showInlineError('Your account is still pending admin approval.');
            } else {
                showInlineError(data.error || 'Invalid username or password');
            }
            return;
        }
        
        // Store the session token - THIS IS CRITICAL FOR CHAT
        if (data.token) {
            setAuthToken(data.token);
            console.log('Session token stored from inline login:', data.token);
        }
        
        // Store user data
        currentUser = { 
            username: data.user.username, 
            profile: data.user 
        };
        await blobAPI.set('current_user', currentUser);
        
        // Load user's followed communities after login
        await loadFollowedCommunities();
        
        // Initialize chat system after successful login
        if (typeof initializeChat === 'function') {
            await initializeChat();
        }
        
        // Clear the form
        document.getElementById('inlineLoginFormElement').reset();
        
        // Close menu and update UI
        toggleMenu();
        updateUI();
        showSuccessMessage('Welcome back!');

        if (data.user.isAdmin) {
            await loadAdminStats();
        }
        
    } catch (error) {
        console.error('Inline login error:', error);
        showInlineError('Something went wrong. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
}

function showInlineError(message) {
    const errorDiv = document.getElementById('inlineLoginError');
    errorDiv.innerHTML = `<div class="inline-error-message">${escapeHtml(message)}</div>`;
}

// Community functions (UNCHANGED)
async function handleCreateCommunity(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('createCommunityError', 'Please sign in to create a community');
        return;
    }
    
    const name = document.getElementById('communityName').value.trim().toLowerCase();
    const displayName = document.getElementById('communityDisplayName').value.trim();
    const description = document.getElementById('communityDescription').value.trim();
    const submitBtn = document.getElementById('createCommunitySubmitBtn');
    const errorDiv = document.getElementById('createCommunityError');
    
    errorDiv.innerHTML = '';
    
    // Validation
    if (!/^[a-z0-9_]{3,25}$/.test(name)) {
        showError('createCommunityError', 'Community name must be 3-25 characters, lowercase, alphanumeric and underscores only');
        return;
    }

    if (!displayName || displayName.length > 50) {
        showError('createCommunityError', 'Display name is required and must be 50 characters or less');
        return;
    }

    if (description.length > 500) {
        showError('createCommunityError', 'Description must be 500 characters or less');
        return;
    }

    // Check if community already exists
    const existingCommunity = await blobAPI.get(`community_${name}`);
    if (existingCommunity) {
        showError('createCommunityError', 'Community name already exists');
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        const community = {
            name,
            displayName,
            description,
            createdBy: currentUser.username,
            createdAt: new Date().toISOString(),
            isPrivate: false,
            moderators: [currentUser.username],
            members: [currentUser.username],
            rules: []
        };
        
        await blobAPI.set(`community_${name}`, community);
        communities.unshift(community);
        
        closeModal('createCommunityModal');
        document.getElementById('createCommunityForm').reset();
        
        updateCommunityDropdown();
        
        if (currentUser.profile?.isAdmin) {
            await loadAdminStats();
        }
        
        showSuccessMessage(`Community "${displayName}" created successfully!`);
        
    } catch (error) {
        console.error('Error creating community:', error);
        showError('createCommunityError', 'Failed to create community. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Build Shed';
    }
}

// Post functions (UNCHANGED)
async function handleCreatePost(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('composeError', 'Please sign in to create a post');
        return;
    }
    
    const title = document.getElementById('postTitle').value.trim();
    const communityName = document.getElementById('postCommunity').value;
    const isPrivate = document.getElementById('isPrivate').checked;
    const submitBtn = document.getElementById('composeSubmitBtn');
    const errorDiv = document.getElementById('composeError');
    
    let content = '';
    let url = '';
    let description = '';
    
    if (currentPostType === 'text') {
        content = document.getElementById('postContent').value.trim();
        if (!content) {
            showError('composeError', 'Please provide content');
            return;
        }
    } else {
        url = document.getElementById('postUrl').value.trim();
        description = document.getElementById('postDescription').value.trim();
        if (!url) {
            showError('composeError', 'Please provide a URL');
            return;
        }
        
        try {
            new URL(url);
        } catch {
            showError('composeError', 'Please provide a valid URL');
            return;
        }
    }
    
    errorDiv.innerHTML = '';
    
    if (!title) {
        showError('composeError', 'Please provide a title');
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        
        const post = {
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: currentPostType,
            title,
            author: currentUser.username,
            timestamp: new Date().toISOString(),
            isPrivate,
            communityName: communityName || null,
            replies: []
        };

        if (currentPostType === 'text') {
            post.content = content;
        } else {
            post.url = url;
            if (description) post.description = description;
        }
        
        await blobAPI.set(post.id, post);
        posts.unshift(post);
        
        closeModal('composeModal');
        document.getElementById('composeForm').reset();
        
        // Reset post type
        currentPostType = 'text';
        setPostType('text');
        
        updateUI();
        
        if (currentUser.profile?.isAdmin) {
            await loadAdminStats();
        }
        
        showSuccessMessage('Post created successfully!');
        
    } catch (error) {
        console.error('Error creating post:', error);
        showError('composeError', 'Failed to create post. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }
    
    try {
        await blobAPI.delete(postId);
        posts = posts.filter(p => p.id !== postId);
        updateUI();
        
        if (currentUser.profile?.isAdmin) {
            await loadAdminStats();
        }
        
        showSuccessMessage('Post deleted successfully!');
    } catch (error) {
        console.error('Error deleting post:', error);
        showError('general', 'Failed to delete post. Please try again.');
    }
}

// Reply functions (UNCHANGED)
async function submitReply(postId) {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }

    const replyInput = document.getElementById(`reply-input-${postId}`);
    const content = replyInput.value.trim();
    
    if (!content) {
        showSuccessMessage('Please write a reply before submitting.');
        return;
    }

    if (content.length > 2000) {
        showSuccessMessage('Reply must be 2000 characters or less.');
        return;
    }

    try {
        // Find the post
        const post = posts.find(p => p.id === postId);
        if (!post) {
            showSuccessMessage('Post not found.');
            return;
        }

        // Create reply object
        const reply = {
            id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            author: currentUser.username,
            content: content,
            timestamp: new Date().toISOString(),
            postId: postId // Add postId reference for deletion
        };

        // Add reply to post
        if (!post.replies) {
            post.replies = [];
        }
        post.replies.push(reply);

        // Update post in storage
        await blobAPI.set(postId, post);

        // Update local posts array
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        }

        // Clear input
        replyInput.value = '';

        // Update replies display
        const repliesList = document.getElementById(`replies-list-${postId}`);
        if (repliesList) {
            repliesList.innerHTML = renderReplies(post.replies);
        }

        // Update reply count in button
        updateReplyCount(postId, post.replies.length);

        showSuccessMessage('Reply added successfully!');

    } catch (error) {
        console.error('Error submitting reply:', error);
        showSuccessMessage('Failed to submit reply. Please try again.');
    }
}

async function deleteReply(postId, replyId) {
    if (!currentUser) {
        showSuccessMessage('Please sign in to delete replies.');
        return;
    }

    if (!confirm('Are you sure you want to delete this reply?')) {
        return;
    }

    try {
        // Find the post
        const post = posts.find(p => p.id === postId);
        if (!post) {
            showSuccessMessage('Post not found.');
            return;
        }

        // Find the reply
        const replyIndex = post.replies.findIndex(r => r.id === replyId);
        if (replyIndex === -1) {
            showSuccessMessage('Reply not found.');
            return;
        }

        const reply = post.replies[replyIndex];

        // Check if user can delete this reply
        if (reply.author !== currentUser.username && !currentUser.profile?.isAdmin) {
            showSuccessMessage('You can only delete your own replies.');
            return;
        }

        // Remove reply from post
        post.replies.splice(replyIndex, 1);

        // Update post in storage
        await blobAPI.set(postId, post);

        // Update local posts array
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        }

        // Remove reply from DOM
        const replyElement = document.getElementById(`reply-${replyId}`);
        if (replyElement) {
            replyElement.remove();
        }

        // Update replies display if no replies left
        if (post.replies.length === 0) {
            const repliesList = document.getElementById(`replies-list-${postId}`);
            if (repliesList) {
                repliesList.innerHTML = renderReplies(post.replies);
            }
        }

        // Update reply count in button
        updateReplyCount(postId, post.replies.length);

        showSuccessMessage('Reply deleted successfully!');

    } catch (error) {
        console.error('Error deleting reply:', error);
        showSuccessMessage('Failed to delete reply. Please try again.');
    }
}

// Profile update (UNCHANGED)
async function handleUpdateProfile(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('editProfileError', 'Please sign in to update your profile');
        return;
    }
    
    const newPictureUrl = document.getElementById('editProfilePicture').value.trim();
    const newBio = document.getElementById('editProfileBio').value.trim();
    const submitBtn = document.getElementById('editProfileSubmitBtn');
    const errorDiv = document.getElementById('editProfileError');
    
    errorDiv.innerHTML = '';
    
    // Validation
    if (newBio.length > 500) {
        showError('editProfileError', 'Bio must be 500 characters or less');
        return;
    }

    // Validate URL if provided
    if (newPictureUrl && newPictureUrl.length > 0) {
        try {
            new URL(newPictureUrl);
        } catch {
            showError('editProfileError', 'Please provide a valid URL for the profile picture');
            return;
        }
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
        
        // Update user profile
        const updatedProfile = {
            ...currentUser.profile,
            profilePicture: newPictureUrl,
            bio: newBio,
            updatedAt: new Date().toISOString()
        };
        
        // Save to storage
        await blobAPI.set(`user_${currentUser.username}`, updatedProfile);
        
        // Update current user object
        currentUser.profile = updatedProfile;
        await blobAPI.set('current_user', currentUser);
        
        closeModal('editProfileModal');
        document.getElementById('editProfileForm').reset();
        
        // Re-render profile page to show changes
        renderProfilePage();
        
        showSuccessMessage('Profile updated successfully!');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showError('editProfileError', 'Failed to update profile. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Profile';
    }
}
