// netlify/functions/chat-api-fixed.mjs - Chat API with proper authentication integration
import { getStore } from "@netlify/blobs";
import jwt from 'jsonwebtoken';

// Use the same JWT secret as the main API
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-jwt-key-here';

// Chat API configuration
const CHAT_CONFIG = {
  MAX_SERVER_NAME_LENGTH: 50,
  MAX_ROOM_NAME_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_ROOMS_PER_USER: 50,
  MAX_SERVERS_PER_USER: 10,
  MESSAGE_BATCH_SIZE: 50
};

export default async (req, context) => {
  const chatStore = getStore("chat-data");
  const blogStore = getStore("blog-data");
  const apiStore = getStore("blog-api-data");
  
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
    
    // Remove function prefixes from path
    const apiIndex = pathParts.findIndex(p => p === 'chat-api');
    const path = apiIndex !== -1 ? pathParts.slice(apiIndex + 1) : pathParts.slice(1);
    
    console.log('Chat API Request:', path.join('/'), 'Method:', req.method);
    
    // Public endpoints (no auth required)
    if (req.method === "GET" && path[0] === "servers" && path[1] === "public") {
      return getPublicServers(chatStore, headers);
    }
    if (req.method === "GET" && path[0] === "rooms" && path[1] === "public") {
      return getPublicRooms(chatStore, headers);
    }
    
    // Validate authentication for other endpoints
    const authValidation = await validateAuth(req, apiStore, blogStore);
    if (!authValidation.valid) {
      console.log('Auth validation failed:', authValidation.error);
      return new Response(
        JSON.stringify({ error: authValidation.error }),
        { status: authValidation.status || 401, headers }
      );
    }
    
    const user = authValidation.user;
    console.log('Authenticated user:', user.username);

    // SERVER ROUTES
    if (path[0] === "servers") {
      if (!path[1]) {
        // /servers
        if (req.method === "GET") {
          return getUserServers(chatStore, user, headers);
        } else if (req.method === "POST") {
          return createServer(req, chatStore, user, headers);
        }
      } else {
        const serverId = path[1];
        
        if (path[2] === "rooms") {
          // /servers/{serverId}/rooms
          if (req.method === "GET") {
            return getServerRooms(serverId, chatStore, user, headers);
          } else if (req.method === "POST") {
            return createServerRoom(serverId, req, chatStore, user, headers);
          }
        } else if (path[2] === "join") {
          // /servers/{serverId}/join
          if (req.method === "POST") {
            return joinServer(serverId, chatStore, user, headers);
          }
        } else if (path[2] === "leave") {
          // /servers/{serverId}/leave  
          if (req.method === "POST") {
            return leaveServer(serverId, chatStore, user, headers);
          }
        } else if (!path[2]) {
          // /servers/{serverId}
          if (req.method === "GET") {
            return getServerDetails(serverId, chatStore, user, headers);
          } else if (req.method === "DELETE") {
            return deleteServer(serverId, chatStore, user, headers);
          }
        }
      }
    }

    // ROOM ROUTES
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
          } else if (req.method === "DELETE" && path[3]) {
            // /rooms/{roomId}/messages/{messageId}
            return deleteMessage(roomId, path[3], chatStore, user, headers);
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

// Authentication validation - compatible with main app's JWT tokens
async function validateAuth(req, apiStore, blogStore) {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Authentication required", status: 401 };
  }

  try {
    const token = authHeader.substring(7);
    console.log('Validating token...');
    
    // Decode JWT using the same secret as main API
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('JWT decoded successfully:', { username: decoded.username, type: decoded.type });
      
      // Check if it's an access token
      if (decoded.type !== 'access') {
        return { valid: false, error: "Invalid token type", status: 401 };
      }
      
      // Get the user profile from blog store
      const userProfile = await blogStore.get(`user_${decoded.username}`, { type: "json" });
      
      if (!userProfile) {
        console.log('User not found in store:', decoded.username);
        return { valid: false, error: "User not found", status: 404 };
      }
      
      console.log('User profile loaded:', userProfile.username);
      
      return { 
        valid: true, 
        user: {
          ...userProfile,
          sessionId: decoded.sessionId
        }
      };
      
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return { valid: false, error: "Invalid or expired token", status: 401 };
    }
    
  } catch (error) {
    console.error("Auth validation error:", error);
    return { valid: false, error: "Authentication error", status: 500 };
  }
}

// Helper function to generate unique IDs
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get user's servers
async function getUserServers(chatStore, user, headers) {
  try {
    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    
    // Batch load servers
    const serverPromises = userServers.map(async (serverId) => {
      try {
        const server = await chatStore.get(`server_${serverId}`, { type: "json" });
        if (!server) return null;
        
        return {
          ...server,
          roomCount: server.roomIds ? server.roomIds.length : 0,
          memberCount: server.members ? server.members.length : 0
        };
      } catch (error) {
        console.error(`Error loading server ${serverId}:`, error);
        return null;
      }
    });

    const servers = await Promise.all(serverPromises);
    const validServers = servers.filter(server => server !== null);

    return new Response(
      JSON.stringify({ 
        success: true, 
        servers: validServers 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get user servers error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load servers" }),
      { status: 500, headers }
    );
  }
}

// Create server
async function createServer(req, chatStore, user, headers) {
  try {
    const { name, description = "", icon = "", isPrivate = false } = await req.json();

    if (!name || name.length > CHAT_CONFIG.MAX_SERVER_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Invalid server name" }),
        { status: 400, headers }
      );
    }

    if (description.length > CHAT_CONFIG.MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Description too long" }),
        { status: 400, headers }
      );
    }

    // Check user's server limit
    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    if (userServers.length >= CHAT_CONFIG.MAX_SERVERS_PER_USER) {
      return new Response(
        JSON.stringify({ error: "Server limit reached" }),
        { status: 400, headers }
      );
    }

    const serverId = generateId();
    const server = {
      id: serverId,
      name,
      description,
      icon,
      owner: user.username,
      members: [user.username],
      isPrivate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roomIds: []
    };

    await chatStore.set(`server_${serverId}`, JSON.stringify(server));
    
    // Add to user's servers
    userServers.push(serverId);
    await chatStore.set(`user_servers_${user.username}`, JSON.stringify(userServers));

    // Add to public servers index if not private
    if (!isPrivate) {
      const publicServers = await chatStore.get('public_servers', { type: "json" }) || [];
      publicServers.push(serverId);
      await chatStore.set('public_servers', JSON.stringify(publicServers));
    }

    // Create default "general" room
    const generalRoomId = generateId();
    const generalRoom = {
      id: generalRoomId,
      name: "general",
      description: "General discussion",
      serverId: serverId,
      owner: user.username,
      members: [user.username],
      isPrivate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await chatStore.set(`room_${generalRoomId}`, JSON.stringify(generalRoom));
    
    // Update server's room list
    server.roomIds = [generalRoomId];
    await chatStore.set(`server_${serverId}`, JSON.stringify(server));

    return new Response(
      JSON.stringify({ 
        success: true, 
        server,
        defaultRoom: generalRoom,
        message: "Server created successfully"
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Create server error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create server" }),
      { status: 500, headers }
    );
  }
}

// Get server rooms
async function getServerRooms(serverId, chatStore, user, headers) {
  try {
    const server = await chatStore.get(`server_${serverId}`, { type: "json" });
    if (!server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers }
      );
    }

    // Check if user is a member
    if (!server.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this server" }),
        { status: 403, headers }
      );
    }

    const roomPromises = (server.roomIds || []).map(async (roomId) => {
      const room = await chatStore.get(`room_${roomId}`, { type: "json" });
      if (!room) return null;
      
      return {
        ...room,
        unreadCount: 0
      };
    });

    const rooms = await Promise.all(roomPromises);
    const validRooms = rooms.filter(room => room !== null);

    return new Response(
      JSON.stringify({ 
        success: true, 
        serverId,
        rooms: validRooms 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get server rooms error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load server rooms" }),
      { status: 500, headers }
    );
  }
}

// Create room in server
async function createServerRoom(serverId, req, chatStore, user, headers) {
  try {
    const { name, description = "", isPrivate = false } = await req.json();

    const server = await chatStore.get(`server_${serverId}`, { type: "json" });
    if (!server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers }
      );
    }

    if (!server.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this server" }),
        { status: 403, headers }
      );
    }

    if (!name || name.length > CHAT_CONFIG.MAX_ROOM_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Invalid room name" }),
        { status: 400, headers }
      );
    }

    const roomId = generateId();
    const room = {
      id: roomId,
      name,
      description,
      serverId: serverId,
      owner: user.username,
      members: server.members,
      isPrivate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await chatStore.set(`room_${roomId}`, JSON.stringify(room));
    
    server.roomIds = server.roomIds || [];
    server.roomIds.push(roomId);
    server.updatedAt = new Date().toISOString();
    await chatStore.set(`server_${serverId}`, JSON.stringify(server));

    return new Response(
      JSON.stringify({ 
        success: true, 
        room,
        message: "Room created successfully"
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Create server room error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create room" }),
      { status: 500, headers }
    );
  }
}

// Join server
async function joinServer(serverId, chatStore, user, headers) {
  try {
    const server = await chatStore.get(`server_${serverId}`, { type: "json" });
    if (!server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers }
      );
    }

    if (server.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          server,
          message: "Already a member of this server"
        }),
        { status: 200, headers }
      );
    }

    server.members.push(user.username);
    server.updatedAt = new Date().toISOString();
    await chatStore.set(`server_${serverId}`, JSON.stringify(server));

    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    if (!userServers.includes(serverId)) {
      userServers.push(serverId);
      await chatStore.set(`user_servers_${user.username}`, JSON.stringify(userServers));
    }

    if (server.roomIds) {
      for (const roomId of server.roomIds) {
        const room = await chatStore.get(`room_${roomId}`, { type: "json" });
        if (room && !room.isPrivate && !room.members.includes(user.username)) {
          room.members.push(user.username);
          room.updatedAt = new Date().toISOString();
          await chatStore.set(`room_${roomId}`, JSON.stringify(room));
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        server,
        message: "Successfully joined server"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Join server error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to join server" }),
      { status: 500, headers }
    );
  }
}

// Get public servers
async function getPublicServers(chatStore, headers) {
  try {
    const publicServerIds = await chatStore.get('public_servers', { type: "json" }) || [];
    
    const serverPromises = publicServerIds.map(async (serverId) => {
      const server = await chatStore.get(`server_${serverId}`, { type: "json" });
      if (!server) return null;
      
      return {
        ...server,
        memberCount: server.members ? server.members.length : 0,
        roomCount: server.roomIds ? server.roomIds.length : 0
      };
    });

    const servers = await Promise.all(serverPromises);
    const validServers = servers.filter(server => server !== null);

    return new Response(
      JSON.stringify({ 
        success: true, 
        servers: validServers 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get public servers error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load public servers" }),
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
    const after = url.searchParams.get('after');

    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    
    const sortedBlobs = blobs.sort((a, b) => {
      const timeA = a.key.split('_')[2];
      const timeB = b.key.split('_')[2];
      return timeB.localeCompare(timeA);
    });

    let filteredBlobs = sortedBlobs;

    if (after) {
      filteredBlobs = sortedBlobs.filter(blob => {
        const messageTime = blob.key.split('_')[2];
        return messageTime > after;
      });
      filteredBlobs.reverse();
    } else if (before) {
      filteredBlobs = sortedBlobs.filter(blob => {
        const messageTime = blob.key.split('_')[2];
        return messageTime < before;
      });
    }

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

    if (!after) {
      validMessages.reverse();
    }

    return new Response(
      JSON.stringify({
        success: true,
        messages: validMessages,
        hasMore: filteredBlobs.length > limit,
        count: validMessages.length
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

    room.updatedAt = timestamp;
    chatStore.set(`room_${roomId}`, JSON.stringify(room)).catch(console.error);

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

// Stub functions for remaining endpoints (same as original)
async function deleteServer(serverId, chatStore, user, headers) {
  // Implementation from original file...
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function leaveServer(serverId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function getServerDetails(serverId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function createRoom(req, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function deleteRoom(roomId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function joinRoom(roomId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function leaveRoom(roomId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function getRoomDetails(roomId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function getUserRooms(chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function getPublicRooms(chatStore, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}

async function deleteMessage(roomId, messageId, chatStore, user, headers) {
  return new Response(JSON.stringify({ error: "Not implemented" }), { status: 501, headers });
}
