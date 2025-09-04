// netlify/functions/chat-api.js - Chat system backend API
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
  const chatStore = getStore("chat-data");
  const blogStore = getStore("blog-data"); // For user authentication
  
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
    const path = apiIndex !== -1 ? pathParts.slice(apiIndex + 1) : pathParts;

    console.log(`Chat API called: ${req.method} ${path.join('/')}`);

    // Validate authentication for all routes
    const authResult = await validateChatAuth(req, blogStore);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers }
      );
    }

    const user = authResult.user;

    // Route handling
    switch (req.method) {
      case 'GET':
        return await handleChatGet(path, req, chatStore, user, headers);
      case 'POST':
        return await handleChatPost(path, req, chatStore, user, headers);
      case 'PUT':
        return await handleChatPut(path, req, chatStore, user, headers);
      case 'DELETE':
        return await handleChatDelete(path, req, chatStore, user, headers);
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers }
        );
    }

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

// Authentication validation
async function validateChatAuth(req, blogStore) {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Authentication required", status: 401 };
  }

  // For now, we'll use a simple token validation
  // In a real implementation, you'd validate against your session store
  try {
    // Get current user from blog store (adapt this to your auth system)
    const currentUser = await blogStore.get('current_user', { type: "json" });
    
    if (!currentUser || !currentUser.username) {
      return { valid: false, error: "Invalid authentication", status: 401 };
    }

    // Get full user profile
    const userProfile = await blogStore.get(`user_${currentUser.username}`, { type: "json" });
    
    if (!userProfile) {
      return { valid: false, error: "User not found", status: 404 };
    }

    return { valid: true, user: userProfile };
  } catch (error) {
    console.error("Auth validation error:", error);
    return { valid: false, error: "Authentication error", status: 500 };
  }
}

// GET request handler
async function handleChatGet(path, req, chatStore, user, headers) {
  if (path[0] === 'user' && path[1] === 'rooms') {
    return await getUserRooms(req, chatStore, user, headers);
  }
  
  if (path[0] === 'rooms') {
    if (path[1] === 'public') {
      return await getPublicRooms(req, chatStore, user, headers);
    }
    if (path[1] === 'search') {
      return await searchRooms(req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'messages') {
      return await getRoomMessages(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'stats') {
      return await getRoomStats(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'activity') {
      return await getRoomActivity(path[1], req, chatStore, user, headers);
    }
  }

  return new Response(
    JSON.stringify({ error: "Endpoint not found" }),
    { status: 404, headers }
  );
}

// POST request handler
async function handleChatPost(path, req, chatStore, user, headers) {
  if (path[0] === 'rooms') {
    if (path[1] === 'create') {
      return await createRoom(req, chatStore, user, headers);
    }
    if (path[1] === 'join-by-code') {
      return await joinRoomByCode(req, chatStore, user, headers);
    }
    if (path[1] === 'bulk') {
      return await bulkManageRooms(req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'join') {
      return await joinRoom(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'leave') {
      return await leaveRoom(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'messages') {
      return await sendMessage(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'invite') {
      return await inviteUser(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'remove') {
      return await removeUser(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'invite-code') {
      return await generateInviteCode(path[1], req, chatStore, user, headers);
    }
    if (path[1] && path[2] === 'archive') {
      return await toggleRoomArchive(path[1], req, chatStore, user, headers);
    }
  }

  return new Response(
    JSON.stringify({ error: "Endpoint not found" }),
    { status: 404, headers }
  );
}

// PUT request handler
async function handleChatPut(path, req, chatStore, user, headers) {
  if (path[0] === 'rooms' && path[1] && path[2] === 'settings') {
    return await updateRoomSettings(path[1], req, chatStore, user, headers);
  }

  return new Response(
    JSON.stringify({ error: "Endpoint not found" }),
    { status: 404, headers }
  );
}

// DELETE request handler
async function handleChatDelete(path, req, chatStore, user, headers) {
  if (path[0] === 'rooms' && path[1] && path[2] === 'delete') {
    return await deleteRoom(path[1], req, chatStore, user, headers);
  }

  return new Response(
    JSON.stringify({ error: "Endpoint not found" }),
    { status: 404, headers }
  );
}

// Create room
async function createRoom(req, chatStore, user, headers) {
  try {
    const { name, description, isPrivate } = await req.json();

    // Validation
    if (!name || typeof name !== 'string') {
      return new Response(
        JSON.stringify({ error: "Room name is required" }),
        { status: 400, headers }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > CHAT_CONFIG.MAX_ROOM_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Room name must be 3-${CHAT_CONFIG.MAX_ROOM_NAME_LENGTH} characters` }),
        { status: 400, headers }
      );
    }

    if (description && description.length > CHAT_CONFIG.MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Description must be ${CHAT_CONFIG.MAX_DESCRIPTION_LENGTH} characters or less` }),
        { status: 400, headers }
      );
    }

    // Check if user has too many rooms
    const userRooms = await getUserRoomsList(chatStore, user.username);
    if (userRooms.length >= CHAT_CONFIG.MAX_ROOMS_PER_USER) {
      return new Response(
        JSON.stringify({ error: "Maximum number of rooms reached" }),
        { status: 400, headers }
      );
    }

    // Create room
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const room = {
      id: roomId,
      name: trimmedName,
      description: description?.trim() || '',
      isPrivate: Boolean(isPrivate),
      createdBy: user.username,
      createdAt: new Date().toISOString(),
      members: [user.username],
      messageCount: 0,
      lastActivity: new Date().toISOString(),
      archived: false
    };

    await chatStore.set(roomId, JSON.stringify(room));

    // Add room to user's room list
    userRooms.push(roomId);
    await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(userRooms));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Room created successfully",
        room: room
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

// Join room
async function joinRoom(roomId, req, chatStore, user, headers) {
  try {
    const room = await chatStore.get(roomId, { type: "json" });
    
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Check access permissions
    if (room.isPrivate && !room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Access denied to private room" }),
        { status: 403, headers }
      );
    }

    // Add user to room if not already a member
    if (!room.members.includes(user.username)) {
      room.members.push(user.username);
      room.lastActivity = new Date().toISOString();
      await chatStore.set(roomId, JSON.stringify(room));
    }

    // Add room to user's room list
    const userRooms = await getUserRoomsList(chatStore, user.username);
    if (!userRooms.includes(roomId)) {
      userRooms.push(roomId);
      await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(userRooms));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Joined room successfully",
        room: room
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
async function leaveRoom(roomId, req, chatStore, user, headers) {
  try {
    const room = await chatStore.get(roomId, { type: "json" });
    
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Remove user from room members
    room.members = room.members.filter(member => member !== user.username);
    room.lastActivity = new Date().toISOString();

    // If room is empty and not owned by anyone, delete it
    if (room.members.length === 0) {
      await chatStore.delete(roomId);
      // Also delete all messages for this room
      await deleteRoomMessages(chatStore, roomId);
    } else {
      await chatStore.set(roomId, JSON.stringify(room));
    }

    // Remove room from user's room list
    const userRooms = await getUserRoomsList(chatStore, user.username);
    const updatedUserRooms = userRooms.filter(id => id !== roomId);
    await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(updatedUserRooms));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Left room successfully"
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

// Send message
async function sendMessage(roomId, req, chatStore, user, headers) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: "Message content is required" }),
        { status: 400, headers }
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return new Response(
        JSON.stringify({ error: "Message cannot be empty" }),
        { status: 400, headers }
      );
    }

    if (trimmedContent.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Message must be ${CHAT_CONFIG.MAX_MESSAGE_LENGTH} characters or less` }),
        { status: 400, headers }
      );
    }

    const room = await chatStore.get(roomId, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Check if user is a member
    if (!room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "You are not a member of this room" }),
        { status: 403, headers }
      );
    }

    // Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      id: messageId,
      roomId: roomId,
      author: user.username,
      content: trimmedContent,
      timestamp: new Date().toISOString(),
      edited: false
    };

    // Store message
    await chatStore.set(`message_${roomId}_${messageId}`, JSON.stringify(message));

    // Update room stats
    room.messageCount = (room.messageCount || 0) + 1;
    room.lastActivity = new Date().toISOString();
    await chatStore.set(roomId, JSON.stringify(room));

    return new Response(
      JSON.stringify({
        success: true,
        message: message
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

// Get room messages
async function getRoomMessages(roomId, req, chatStore, user, headers) {
  try {
    const room = await chatStore.get(roomId, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Check access
    if (room.isPrivate && !room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers }
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
    const before = url.searchParams.get('before');

    // Get messages for this room
    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    
    const messagePromises = blobs.map(async (blob) => {
      try {
        return await chatStore.get(blob.key, { type: "json" });
      } catch (error) {
        console.error(`Error loading message ${blob.key}:`, error);
        return null;
      }
    });

    const messages = await Promise.all(messagePromises);
    const validMessages = messages.filter(Boolean);

    // Sort by timestamp
    validMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Apply before filter if specified
    let filteredMessages = validMessages;
    if (before) {
      filteredMessages = validMessages.filter(msg => new Date(msg.timestamp) < new Date(before));
    }

    // Apply limit
    const limitedMessages = filteredMessages.slice(-limit);

    return new Response(
      JSON.stringify({
        success: true,
        messages: limitedMessages,
        total: validMessages.length,
        hasMore: filteredMessages.length > limit
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get messages error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load messages" }),
      { status: 500, headers }
    );
  }
}

// Get user's rooms
async function getUserRooms(req, chatStore, user, headers) {
  try {
    const userRoomIds = await getUserRoomsList(chatStore, user.username);
    
    const roomPromises = userRoomIds.map(async (roomId) => {
      try {
        return await chatStore.get(roomId, { type: "json" });
      } catch (error) {
        console.error(`Error loading room ${roomId}:`, error);
        return null;
      }
    });

    const rooms = await Promise.all(roomPromises);
    const validRooms = rooms.filter(Boolean);

    // Sort by last activity
    validRooms.sort((a, b) => new Date(b.lastActivity || b.createdAt) - new Date(a.lastActivity || a.createdAt));

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

// Get public rooms
async function getPublicRooms(req, chatStore, user, headers) {
  try {
    const { blobs } = await chatStore.list({ prefix: "room_" });
    
    const roomPromises = blobs.map(async (blob) => {
      try {
        return await chatStore.get(blob.key, { type: "json" });
      } catch (error) {
        console.error(`Error loading room ${blob.key}:`, error);
        return null;
      }
    });

    const allRooms = await Promise.all(roomPromises);
    const publicRooms = allRooms.filter(room => room && !room.isPrivate && !room.archived);

    // Sort by member count and activity
    publicRooms.sort((a, b) => {
      const aScore = (a.members?.length || 0) + (new Date(a.lastActivity || a.createdAt).getTime() / 1000000);
      const bScore = (b.members?.length || 0) + (new Date(b.lastActivity || b.createdAt).getTime() / 1000000);
      return bScore - aScore;
    });

    return new Response(
      JSON.stringify({
        success: true,
        rooms: publicRooms
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

// Invite user to room
async function inviteUser(roomId, req, chatStore, user, headers) {
  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers }
      );
    }

    const room = await chatStore.get(roomId, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Check permissions
    if (room.createdBy !== user.username && !user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only room creators can invite users" }),
        { status: 403, headers }
      );
    }

    // Check if user is already a member
    if (room.members.includes(username)) {
      return new Response(
        JSON.stringify({ error: "User is already a member" }),
        { status: 400, headers }
      );
    }

    // Add user to room
    room.members.push(username);
    room.lastActivity = new Date().toISOString();
    await chatStore.set(roomId, JSON.stringify(room));

    // Add room to user's room list
    const userRooms = await getUserRoomsList(chatStore, username);
    if (!userRooms.includes(roomId)) {
      userRooms.push(roomId);
      await chatStore.set(`user_rooms_${username}`, JSON.stringify(userRooms));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${username} invited successfully`
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Invite user error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to invite user" }),
      { status: 500, headers }
    );
  }
}

// Remove user from room
async function removeUser(roomId, req, chatStore, user, headers) {
  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers }
      );
    }

    const room = await chatStore.get(roomId, { type: "json" });
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers }
      );
    }

    // Check permissions
    if (room.createdBy !== user.username && !user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only room creators can remove users" }),
        { status: 403, headers }
      );
    }

    // Can't remove room creator
    if (username === room.createdBy) {
      return new Response(
        JSON.stringify({ error: "Cannot remove room creator" }),
        { status: 400, headers }
      );
    }

    // Remove user from room
    room.members = room.members.filter(member => member !== username);
    room.lastActivity = new Date().toISOString();
    await chatStore.set(roomId, JSON.stringify(room));

    // Remove room from user's room list
    const userRooms = await getUserRoomsList(chatStore, username);
    const updatedUserRooms = userRooms.filter(id => id !== roomId);
    await chatStore.set(`user_rooms_${username}`, JSON.stringify(updatedUserRooms));

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${username} removed successfully`
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Remove user error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to remove user" }),
      { status: 500, headers }
    );
  }
}

// Helper functions
async function getUserRoomsList(chatStore, username) {
  try {
    const userRooms = await chatStore.get(`user_rooms_${username}`, { type: "json" });
    return userRooms || [];
  } catch (error) {
    return [];
  }
}

async function deleteRoomMessages(chatStore, roomId) {
  try {
    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    
    const deletePromises = blobs.map(blob => chatStore.delete(blob.key));
    await Promise.all(deletePromises);
    
    console.log(`Deleted ${blobs.length} messages for room ${roomId}`);
  } catch (error) {
    console.error("Error deleting room messages:", error);
  }
}

// Placeholder implementations for remaining endpoints
async function searchRooms(req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ success: true, rooms: [] }),
    { status: 200, headers }
  );
}

async function getRoomStats(roomId, req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ success: true, stats: {} }),
    { status: 200, headers }
  );
}

async function getRoomActivity(roomId, req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ success: true, activity: {} }),
    { status: 200, headers }
  );
}

async function joinRoomByCode(req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ error: "Invite codes not implemented yet" }),
    { status: 501, headers }
  );
}

async function bulkManageRooms(req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ error: "Bulk operations not implemented yet" }),
    { status: 501, headers }
  );
}

async function generateInviteCode(roomId, req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ error: "Invite codes not implemented yet" }),
    { status: 501, headers }
  );
}

async function toggleRoomArchive(roomId, req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ error: "Room archiving not implemented yet" }),
    { status: 501, headers }
  );
}

async function updateRoomSettings(roomId, req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ error: "Room settings update not implemented yet" }),
    { status: 501, headers }
  );
}

async function deleteRoom(roomId, req, chatStore, user, headers) {
  return new Response(
    JSON.stringify({ error: "Room deletion not implemented yet" }),
    { status: 501, headers }
  );
