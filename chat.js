// chat.js - Core chat functionality

// Chat state
let currentChatRoom = null;
let userRooms = [];
let chatMessages = [];
let chatRefreshInterval = null;
let lastMessageTimestamp = null;

// Chat API wrapper
const chatAPI = {
    async createRoom(roomData) {
        try {
            const response = await fetch('/.netlify/functions/chat-api/rooms/create', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                },
                body: JSON.stringify(roomData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating room:', error);
            throw error;
        }
    },
    
    async joinRoom(roomId) {
        try {
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/join`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    },
    
    async leaveRoom(roomId) {
        try {
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/leave`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error leaving room:', error);
            throw error;
        }
    },
    
    async getUserRooms() {
        try {
            const response = await fetch('/.netlify/functions/chat-api/user/rooms', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting user rooms:', error);
            throw error;
        }
    },
    
    async getPublicRooms() {
        try {
            const response = await fetch('/.netlify/functions/chat-api/rooms/public', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting public rooms:', error);
            throw error;
        }
    },
    
    async getRoomMessages(roomId, limit = 50, before = null) {
        try {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (before) params.append('before', before);
            
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages?${params}`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting room messages:', error);
            throw error;
        }
    },
    
    async sendMessage(roomId, content) {
        try {
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                },
                body: JSON.stringify({ content })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    },
    
    async inviteUser(roomId, username) {
        try {
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/invite`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                },
                body: JSON.stringify({ username })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error inviting user:', error);
            throw error;
        }
    },
    
    async removeUser(roomId, username) {
        try {
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/remove`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                },
                body: JSON.stringify({ username })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error removing user:', error);
            throw error;
        }
    }
};

// Helper function to get auth token (placeholder - adapt to your auth system)
async function getAuthToken() {
    // This should return the current user's session token
    // Adapt this to match your existing authentication system
    const userData = await blobAPI.get('current_user');
    return userData?.sessionToken || 'placeholder-token';
}

// Chat initialization
async function initializeChat() {
    if (!currentUser) {
        console.log('User not authenticated, skipping chat initialization');
        return;
    }
    
    try {
        console.log('Initializing chat system...');
        await loadUserRooms();
        console.log('Chat system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize chat:', error);
    }
}

// Load user's rooms
async function loadUserRooms() {
    try {
        const response = await chatAPI.getUserRooms();
        userRooms = response.rooms || [];
        console.log(`Loaded ${userRooms.length} user rooms`);
        
        // Update UI if chat is currently visible
        if (currentPage === 'chat') {
            renderChatRoomList();
        }
        
        return userRooms;
    } catch (error) {
        console.error('Error loading user rooms:', error);
        userRooms = [];
        return [];
    }
}

// Join a chat room
async function joinChatRoom(roomId) {
    try {
        console.log(`Joining room: ${roomId}`);
        
        const response = await chatAPI.joinRoom(roomId);
        currentChatRoom = response.room;
        
        // Load initial messages
        await loadRoomMessages(roomId);
        
        // Start auto-refresh for this room
        startChatRefresh(roomId);
        
        // Update UI
        renderChatRoom();
        
        console.log(`Successfully joined room: ${currentChatRoom.name}`);
        return currentChatRoom;
        
    } catch (error) {
        console.error('Error joining room:', error);
        showSuccessMessage('Failed to join room. Please try again.');
        throw error;
    }
}

// Leave current chat room
async function leaveChatRoom() {
    if (!currentChatRoom) return;
    
    try {
        await chatAPI.leaveRoom(currentChatRoom.id);
        
        // Stop auto-refresh
        stopChatRefresh();
        
        // Clear current room state
        currentChatRoom = null;
        chatMessages = [];
        lastMessageTimestamp = null;
        
        // Update UI to show room list
        renderChatRoomList();
        
        console.log('Left chat room successfully');
        
    } catch (error) {
        console.error('Error leaving room:', error);
        showSuccessMessage('Failed to leave room properly, but clearing local state.');
        
        // Clear local state anyway
        currentChatRoom = null;
        chatMessages = [];
        stopChatRefresh();
        renderChatRoomList();
    }
}

// Load messages for a room
async function loadRoomMessages(roomId, limit = 50, before = null) {
    try {
        const response = await chatAPI.getRoomMessages(roomId, limit, before);
        
        if (before) {
            // Loading older messages, prepend to existing
            chatMessages = [...response.messages, ...chatMessages];
        } else {
            // Loading fresh messages
            chatMessages = response.messages || [];
            if (chatMessages.length > 0) {
                lastMessageTimestamp = chatMessages[chatMessages.length - 1].timestamp;
            }
        }
        
        console.log(`Loaded ${response.messages?.length || 0} messages for room ${roomId}`);
        return chatMessages;
        
    } catch (error) {
        console.error('Error loading room messages:', error);
        return [];
    }
}

// Send a message
async function sendChatMessage(content) {
    if (!currentChatRoom || !content || !content.trim()) {
        return;
    }
    
    try {
        const response = await chatAPI.sendMessage(currentChatRoom.id, content.trim());
        
        // Add message to local cache
        chatMessages.push(response.message);
        lastMessageTimestamp = response.message.timestamp;
        
        // Update UI immediately
        renderChatMessages();
        
        // Clear input
        const messageInput = document.getElementById('chatMessageInput');
        if (messageInput) {
            messageInput.value = '';
        }
        
        console.log('Message sent successfully');
        return response.message;
        
    } catch (error) {
        console.error('Error sending message:', error);
        showSuccessMessage('Failed to send message. Please try again.');
        throw error;
    }
}

// Auto-refresh chat messages
function startChatRefresh(roomId) {
    // Clear any existing interval
    stopChatRefresh();
    
    // Set up new interval to check for new messages every 3 seconds
    chatRefreshInterval = setInterval(async () => {
        if (currentChatRoom && currentChatRoom.id === roomId) {
            await refreshChatMessages();
        } else {
            // Room changed, stop refreshing
            stopChatRefresh();
        }
    }, 3000);
    
    console.log(`Started auto-refresh for room ${roomId}`);
}

function stopChatRefresh() {
    if (chatRefreshInterval) {
        clearInterval(chatRefreshInterval);
        chatRefreshInterval = null;
        console.log('Stopped chat auto-refresh');
    }
}

// Refresh messages (get new ones since last timestamp)
async function refreshChatMessages() {
    if (!currentChatRoom || !lastMessageTimestamp) {
        return;
    }
    
    try {
        // Get messages newer than our last timestamp
        const response = await chatAPI.getRoomMessages(currentChatRoom.id, 20);
        const newMessages = response.messages.filter(msg => 
            new Date(msg.timestamp) > new Date(lastMessageTimestamp)
        );
        
        if (newMessages.length > 0) {
            // Add new messages to our cache
            chatMessages.push(...newMessages);
            lastMessageTimestamp = newMessages[newMessages.length - 1].timestamp;
            
            // Update UI
            renderChatMessages();
            
            console.log(`Received ${newMessages.length} new messages`);
        }
        
    } catch (error) {
        console.error('Error refreshing messages:', error);
        // Don't show error to user for auto-refresh failures
    }
}

// Handle message input
function handleChatInput(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const content = event.target.value.trim();
        
        if (content) {
            sendChatMessage(content);
        }
    }
}

// Handle chat commands (simple implementation)
function processChatCommand(content) {
    if (!content.startsWith('/')) {
        return false; // Not a command
    }
    
    const parts = content.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch (command) {
        case '/help':
            showChatSystemMessage('Available commands: /help, /invite <username>, /leave');
            return true;
            
        case '/invite':
            if (args.length > 0 && currentChatRoom) {
                inviteUserToRoom(currentChatRoom.id, args[0]);
            } else {
                showChatSystemMessage('Usage: /invite <username>');
            }
            return true;
            
        case '/leave':
            leaveChatRoom();
            return true;
            
        default:
            showChatSystemMessage(`Unknown command: ${command}. Type /help for available commands.`);
            return true;
    }
}

// Show system message in chat
function showChatSystemMessage(message) {
    const systemMessage = {
        id: `system_${Date.now()}`,
        content: message,
        author: 'System',
        timestamp: new Date().toISOString(),
        isSystem: true
    };
    
    chatMessages.push(systemMessage);
    renderChatMessages();
}

// Invite user to current room
async function inviteUserToRoom(roomId, username) {
    if (!currentChatRoom || currentChatRoom.createdBy !== currentUser.username) {
        showChatSystemMessage('Only room creators can invite users.');
        return;
    }
    
    try {
        await chatAPI.inviteUser(roomId, username);
        showChatSystemMessage(`Invited @${username} to the room.`);
    } catch (error) {
        console.error('Error inviting user:', error);
        showChatSystemMessage(`Failed to invite @${username}. They may not exist or already be in the room.`);
    }
}

// Remove user from current room
async function removeUserFromRoom(roomId, username) {
    if (!currentChatRoom || currentChatRoom.createdBy !== currentUser.username) {
        showSuccessMessage('Only room creators can remove users.');
        return;
    }
    
    try {
        await chatAPI.removeUser(roomId, username);
        showChatSystemMessage(`Removed @${username} from the room.`);
    } catch (error) {
        console.error('Error removing user:', error);
        showChatSystemMessage(`Failed to remove @${username}.`);
    }
}

// Get room member list
function getRoomMembers(room) {
    return room.members || [];
}

// Check if user can moderate room
function canModerateRoom(room, user) {
    if (!room || !user) return false;
    return room.createdBy === user.username || user.isAdmin;
}

// Clean up chat when user logs out
function cleanupChat() {
    stopChatRefresh();
    currentChatRoom = null;
    userRooms = [];
    chatMessages = [];
    lastMessageTimestamp = null;
    console.log('Chat cleaned up');
}
