// netlify/functions/chat-api.js - Enhanced Chat API with Servers and Management
import { getStore } from "@netlify/blobs";

// Chat API configuration
const CHAT_CONFIG = {
  MAX_SERVER_NAME_LENGTH: 50,
  MAX_ROOM_NAME_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_ROOMS_PER_USER: 50,
  MAX_SERVERS_PER_USER: 10,
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
    if (req.method === "GET" && path[0] === "servers" && path[1] === "public") {
      return getPublicServers(chatStore, headers);
    }
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

    // ROOM ROUTES (Updated for server context)
    if (path[0] === "rooms") {
      if (!path[1]) {
        // /rooms (legacy - get all user rooms across all servers)
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

// ==============================================
// SERVER MANAGEMENT FUNCTIONS
// ==============================================

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
      roomIds: [] // Array of room IDs in this server
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

// Get user's servers
async function getUserServers(chatStore, user, headers) {
  try {
    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    
    const serverPromises = userServers.map(async (serverId) => {
      const server = await chatStore.get(`server_${serverId}`, { type: "json" });
      if (!server) return null;
      
      // Get room count for this server
      const roomCount = server.roomIds ? server.roomIds.length : 0;
      
      return {
        ...server,
        roomCount,
        memberCount: server.members ? server.members.length : 0
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
    console.error("Get user servers error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load servers" }),
      { status: 500, headers }
    );
  }
}

// Delete server (owner only)
async function deleteServer(serverId, chatStore, user, headers) {
  try {
    const server = await chatStore.get(`server_${serverId}`, { type: "json" });
    if (!server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers }
      );
    }

    // Only owner can delete
    if (server.owner !== user.username) {
      return new Response(
        JSON.stringify({ error: "Only the owner can delete this server" }),
        { status: 403, headers }
      );
    }

    // Delete all rooms in the server
    if (server.roomIds) {
      for (const roomId of server.roomIds) {
        // Delete all messages in each room
        const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
        for (const blob of blobs) {
          await chatStore.delete(blob.key);
        }
        // Delete the room
        await chatStore.delete(`room_${roomId}`);
      }
    }

    // Remove server from all users' server lists
    for (const member of server.members) {
      const userServers = await chatStore.get(`user_servers_${member}`, { type: "json" }) || [];
      const updatedUserServers = userServers.filter(id => id !== serverId);
      await chatStore.set(`user_servers_${member}`, JSON.stringify(updatedUserServers));
    }

    // Remove from public servers if applicable
    if (!server.isPrivate) {
      const publicServers = await chatStore.get('public_servers', { type: "json" }) || [];
      const updatedPublicServers = publicServers.filter(id => id !== serverId);
      await chatStore.set('public_servers', JSON.stringify(updatedPublicServers));
    }

    // Delete the server
    await chatStore.delete(`server_${serverId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Server deleted successfully"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Delete server error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete server" }),
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
      
      // Get last message for this room
      const { blobs } = await chatStore.list({ 
        prefix: `message_${roomId}_`,
        limit: 1
      });
      
      let lastMessage = null;
      if (blobs.length > 0) {
        const sortedBlobs = blobs.sort((a, b) => {
          const timeA = a.key.split('_')[2];
          const timeB = b.key.split('_')[2];
          return timeB.localeCompare(timeA);
        });
        lastMessage = await chatStore.get(sortedBlobs[0].key, { type: "json" });
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

    // Check if user is a member
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
      members: server.members, // Inherit server members
      isPrivate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await chatStore.set(`room_${roomId}`, JSON.stringify(room));
    
    // Add room to server's room list
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

// ==============================================
// ENHANCED MESSAGE MANAGEMENT
// ==============================================

// Delete message (author or room owner only)
async function deleteMessage(roomId, messageId, chatStore, user, headers) {
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

    // Find the message by searching through message keys
    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    let messageKey = null;
    let message = null;

    for (const blob of blobs) {
      if (blob.key.endsWith(`_${messageId}`)) {
        messageKey = blob.key;
        message = await chatStore.get(blob.key, { type: "json" });
        break;
      }
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers }
      );
    }

    // Check if user can delete (author or room owner)
    if (message.author !== user.username && room.owner !== user.username) {
      return new Response(
        JSON.stringify({ error: "You can only delete your own messages or messages in rooms you own" }),
        { status: 403, headers }
      );
    }

    // Delete the message
    await chatStore.delete(messageKey);

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId,
        message: "Message deleted successfully"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Delete message error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete message" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// ENHANCED ROOM MANAGEMENT
// ==============================================

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
        JSON.stringify({ error: "Only the room owner can delete this room" }),
        { status: 403, headers }
      );
    }

    // Delete all messages in the room
    const { blobs } = await chatStore.list({ prefix: `message_${roomId}_` });
    for (const blob of blobs) {
      await chatStore.delete(blob.key);
    }

    // Remove room from server's room list if it belongs to a server
    if (room.serverId) {
      const server = await chatStore.get(`server_${room.serverId}`, { type: "json" });
      if (server && server.roomIds) {
        server.roomIds = server.roomIds.filter(id => id !== roomId);
        server.updatedAt = new Date().toISOString();
        await chatStore.set(`server_${room.serverId}`, JSON.stringify(server));
      }
    } else {
      // For legacy rooms not in servers, remove from user rooms
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

// ==============================================
// EXISTING FUNCTIONS (Updated for compatibility)
// ==============================================

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

// Get user's rooms (legacy function for backward compatibility)
async function getUserRooms(chatStore, user, headers) {
  try {
    // Get rooms from user's servers
    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    const allRooms = [];

    for (const serverId of userServers) {
      const server = await chatStore.get(`server_${serverId}`, { type: "json" });
      if (server && server.roomIds) {
        for (const roomId of server.roomIds) {
          const room = await chatStore.get(`room_${roomId}`, { type: "json" });
          if (room && room.members.includes(user.username)) {
            allRooms.push({
              ...room,
              serverName: server.name,
              serverId: server.id
            });
          }
        }
      }
    }

    // Also get legacy rooms (not in servers)
    const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
    
    for (const roomId of userRooms) {
      const room = await chatStore.get(`room_${roomId}`, { type: "json" });
      if (room && !room.serverId) {
        allRooms.push(room);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        rooms: allRooms 
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

// Get server details
async function getServerDetails(serverId, chatStore, user, headers) {
  try {
    const server = await chatStore.get(`server_${serverId}`, { type: "json" });
    if (!server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers }
      );
    }

    // Check if user is a member (unless it's a public server)
    if (server.isPrivate && !server.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers }
      );
    }

    return new Response(
      JSON.stringify({
        ...server,
        memberCount: server.members ? server.members.length : 0,
        roomCount: server.roomIds ? server.roomIds.length : 0
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Get server details error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get server details" }),
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

    // Check if already a member
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

    // Add user to server members
    server.members.push(user.username);
    server.updatedAt = new Date().toISOString();
    await chatStore.set(`server_${serverId}`, JSON.stringify(server));

    // Add server to user's servers
    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    if (!userServers.includes(serverId)) {
      userServers.push(serverId);
      await chatStore.set(`user_servers_${user.username}`, JSON.stringify(userServers));
    }

    // Add user to all public rooms in the server
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

// Leave server
async function leaveServer(serverId, chatStore, user, headers) {
  try {
    const server = await chatStore.get(`server_${serverId}`, { type: "json" });
    if (!server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers }
      );
    }

    // Owner cannot leave their own server
    if (server.owner === user.username) {
      return new Response(
        JSON.stringify({ error: "Server owner cannot leave. Transfer ownership or delete the server instead." }),
        { status: 400, headers }
      );
    }

    // Remove user from server members
    server.members = server.members.filter(member => member !== user.username);
    server.updatedAt = new Date().toISOString();
    await chatStore.set(`server_${serverId}`, JSON.stringify(server));

    // Remove server from user's servers
    const userServers = await chatStore.get(`user_servers_${user.username}`, { type: "json" }) || [];
    const updatedUserServers = userServers.filter(id => id !== serverId);
    await chatStore.set(`user_servers_${user.username}`, JSON.stringify(updatedUserServers));

    // Remove user from all rooms in the server
    if (server.roomIds) {
      for (const roomId of server.roomIds) {
        const room = await chatStore.get(`room_${roomId}`, { type: "json" });
        if (room && room.members.includes(user.username)) {
          room.members = room.members.filter(member => member !== user.username);
          room.updatedAt = new Date().toISOString();
          await chatStore.set(`room_${roomId}`, JSON.stringify(room));
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Successfully left the server"
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Leave server error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to leave server" }),
      { status: 500, headers }
    );
  }
}

// Keep existing functions from original API...
// (createRoom, joinRoom, leaveRoom, getRoomMessages, sendMessage, etc.)
// I'll include the key ones below:

// Create room (legacy function, creates room without server)
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

    // Check if already a member
    if (room.members.includes(user.username)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          room,
          message: "Already a member of this room"
        }),
        { status: 200, headers }
      );
    }

    // Add user to room
    room.members.push(user.username);
    room.updatedAt = new Date().toISOString();
    await chatStore.set(`room_${roomId}`, JSON.stringify(room));

    // Add room to user's rooms (if not a server room)
    if (!room.serverId) {
      const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
      if (!userRooms.includes(roomId)) {
        userRooms.push(roomId);
        await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(userRooms));
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        room,
        message: "Successfully joined room"
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

    // Owner cannot leave their own room
    if (room.owner === user.username) {
      return new Response(
        JSON.stringify({ error: "Room owner cannot leave. Delete the room instead." }),
        { status: 400, headers }
      );
    }

    // Remove user from room
    room.members = room.members.filter(member => member !== user.username);
    room.updatedAt = new Date().toISOString();
    await chatStore.set(`room_${roomId}`, JSON.stringify(room));

    // Remove room from user's rooms (if not a server room)
    if (!room.serverId) {
      const userRooms = await chatStore.get(`user_rooms_${user.username}`, { type: "json" }) || [];
      const updatedUserRooms = userRooms.filter(id => id !== roomId);
      await chatStore.set(`user_rooms_${user.username}`, JSON.stringify(updatedUserRooms));
    }

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

// Get public rooms
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
