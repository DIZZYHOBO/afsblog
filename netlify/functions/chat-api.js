// netlify/functions/chat-api.js - Complete ESM Chat system backend API
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
  // Use the context object provided by Netlify - this contains the necessary configuration
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
    const path = apiIndex !== -1 ? 
      pathParts.slice(apiIndex + 1).join('/') : 
      pathParts.join('/');

    // Helper function to get authenticated user
    async function getAuthenticatedUser(req) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      const session = await blogStore.get(`session_${token}`, { type: "json" });
      
      if (!session || new Date(session.expiresAt) < new Date()) {
        return null;
      }

      const user = await blogStore.get(`user_${session.username}`, { type: "json" });
      return user;
    }

    // Check authentication for protected routes
    const publicRoutes = ['rooms/public'];
    const requiresAuth = !publicRoutes.includes(path);
    
    let user = null;
    if (requiresAuth) {
      user = await getAuthenticatedUser(req);
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers }
        );
      }
    }

    // Route handling
    if (path === 'user/rooms' && req.method === 'GET') {
      return await getUserRooms(chatStore, user, headers);
    }

    if (path === 'rooms' && req.method === 'POST') {
      return await createRoom(req, chatStore, user, headers);
    }

    if (path.startsWith('rooms/') && path.endsWith('/join') && req.method === 'POST') {
      const roomId = path.split('/')[1];
      return await joinRoom(roomId, chatStore, user, headers);
    }

    if (path.startsWith('rooms/') && path.endsWith('/leave') && req.method === 'POST') {
      const roomId = path.split('/')[1];
      return await leaveRoom(roomId, chatStore, user, headers);
    }

    if (path.startsWith('rooms/') && path.endsWith('/messages') && req.method === 'GET') {
      const roomId = path.split('/')[1];
      return await getRoomMessages(roomId, req, chatStore, user, headers);
    }

    if (path.startsWith('rooms/') && path.endsWith('/messages') && req.method === 'POST') {
      const roomId = path.split('/')[1];
      return await sendMessage(roomId, req, chatStore, user, headers);
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers }
    );

  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      { status: 500, headers }
    );
  }
};

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

// Create room
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
      members: [user.username],
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
      JSON.stringify({ success: true, room }),
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

// Join room
async function joinRoom(roomId, chatStore, user, headers) {
  try {
    const room = await chatStore.get(`room_${roomId}`, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    if (room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Already a member" }),
        { status: 400, headers }
      );
    }

    // Add user to room
    room.members.push(user.username);
    room.updatedAt = new Date().toISOString();
    await chatStore.set(`room_${roomId}`, JSON.stringify(room));

    // Add room to user's rooms
    const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
    userRooms.push(roomId);
    await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(userRooms));

    return new Response(
      JSON.stringify({ success: true, room }),
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
        JSON.stringify({ error: "Owner cannot leave room" }),
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
      JSON.stringify({ success: true }),
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
    const filteredBlobs = before 
      ? sortedBlobs.filter(blob => blob.key.split('_')[2] < before)
      : sortedBlobs;

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
      JSON.stringify({ success: true, message }),
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
