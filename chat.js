// chat.js - Core chat functionality with proper auth token management

// Store the session token in a variable
let currentSessionToken = null;

// Chat state
let currentChatRoom = null;
let userRooms = [];
let chatMessages = [];
let chatRefreshInterval = null;
let lastMessageTimestamp = null;

// Updated getAuthToken function
async function getAuthToken() {
    // First, check if we have a token in memory
    if (currentSessionToken) {
        return currentSessionToken;
    }
    
    // Try to get from localStorage (if you're storing it there after login)
    const storedToken = localStorage.getItem('sessionToken');
    if (storedToken) {
        currentSessionToken = storedToken;
        return storedToken;
    }
    
    // If no token found, user needs to authenticate
    console.warn('No authentication token found');
    return null;
}

// Function to set the auth token (call this after successful login)
function setAuthToken(token) {
    currentSessionToken = token;
    // Store in localStorage for persistence
    localStorage.setItem('sessionToken', token);
}

// Function to clear the auth token (call this on logout)
function clearAuthToken() {
    currentSessionToken = null;
    localStorage.removeItem('sessionToken');
}

// Chat API wrapper
const chatAPI = {
    async createRoom(roomData) {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch('/.netlify/functions/chat-api/rooms', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/join`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/leave`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch('/.netlify/functions/chat-api/user/rooms', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`
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
            // Public rooms don't require authentication
            const response = await fetch('/.netlify/functions/chat-api/rooms/public', {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json'
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
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const params = new URLSearchParams({ limit: limit.toString() });
            if (before) params.append('before', before);
            
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages?${params}`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    },
    
    async sendMessage(roomId, content) {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/invite`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/remove`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
        stopChatRefresh();
        currentChatRoom = null;
        chatMessages = [];
        lastMessageTimestamp = null;
        renderChatRoomList();
    }
}

// Load messages for a room
async function loadRoomMessages(roomId, append = false) {
    try {
        const response = await chatAPI.getRoomMessages(roomId, 50, lastMessageTimestamp);
        
        if (response.messages && response.messages.length > 0) {
            if (append) {
                chatMessages = [...chatMessages, ...response.messages];
            } else {
                chatMessages = response.messages;
            }
            
            // Update last message timestamp for pagination
            if (response.messages.length > 0) {
                lastMessageTimestamp = response.messages[response.messages.length - 1].createdAt;
            }
            
            // Update UI
            updateChatMessages();
            
            // Scroll to bottom if this is initial load
            if (!append) {
                scrollChatToBottom();
            }
        }
        
        return response.hasMore;
        
    } catch (error) {
        console.error('Error loading messages:', error);
        return false;
    }
}

// Send a chat message
async function sendChatMessage(content) {
    if (!currentChatRoom || !content.trim()) return;
    
    try {
        console.log('Sending message...');
        
        const response = await chatAPI.sendMessage(currentChatRoom.id, content);
        
        if (response.message) {
            // Add message to local state immediately
            chatMessages.push(response.message);
            updateChatMessages();
            scrollChatToBottom();
            
            // Clear input
            const input = document.getElementById('chatMessageInput');
            if (input) {
                input.value = '';
                autoResizeChatInput(input);
            }
            
            console.log('Message sent successfully');
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showSuccessMessage('Failed to send message. Please try again.');
    }
}

// Start auto-refresh for chat messages
function startChatRefresh(roomId) {
    // Stop any existing refresh
    stopChatRefresh();
    
    // Refresh every 3 seconds
    chatRefreshInterval = setInterval(async () => {
        if (currentChatRoom && currentChatRoom.id === roomId) {
            await refreshChatMessages(roomId);
        }
    }, 3000);
}

// Stop auto-refresh
function stopChatRefresh() {
    if (chatRefreshInterval) {
        clearInterval(chatRefreshInterval);
        chatRefreshInterval = null;
    }
}

// Refresh chat messages (get new messages)
async function refreshChatMessages(roomId) {
    try {
        // Get the timestamp of the most recent message
        const mostRecentTimestamp = chatMessages.length > 0 
            ? chatMessages[chatMessages.length - 1].createdAt 
            : null;
        
        const response = await chatAPI.getRoomMessages(roomId, 50);
        
        if (response.messages && response.messages.length > 0) {
            // Find new messages (those after our most recent timestamp)
            const newMessages = mostRecentTimestamp 
                ? response.messages.filter(msg => msg.createdAt > mostRecentTimestamp)
                : response.messages;
            
            if (newMessages.length > 0) {
                // Check if we need to scroll
                const wasAtBottom = isScrolledToBottom();
                
                // Add new messages
                chatMessages = [...chatMessages, ...newMessages];
                updateChatMessages();
                
                // Auto-scroll only if user was already at bottom
                if (wasAtBottom) {
                    scrollChatToBottom();
                }
                
                console.log(`Loaded ${newMessages.length} new messages`);
            }
        }
        
    } catch (error) {
        console.error('Error refreshing messages:', error);
    }
}

// Create a new chat room
async function createChatRoom(name, description = '', isPrivate = false) {
    try {
        console.log('Creating room:', name);
        
        const response = await chatAPI.createRoom({
            name,
            description,
            isPrivate
        });
        
        if (response.room) {
            // Add to user rooms
            userRooms.push(response.room);
            
            // Join the room immediately
            await joinChatRoom(response.room.id);
            
            console.log('Room created successfully:', response.room.name);
            showSuccessMessage(`Room "${response.room.name}" created!`);
            
            return response.room;
        }
        
    } catch (error) {
        console.error('Error creating room:', error);
        showSuccessMessage('Failed to create room. Please try again.');
        throw error;
    }
}

// Handle create room form submission
async function handleCreateRoom(e) {
    e.preventDefault();
    
    const name = document.getElementById('roomName').value.trim();
    const description = document.getElementById('roomDescription').value.trim();
    const isPrivate = document.getElementById('roomPrivate').checked;
    
    if (!name) {
        showError('createRoomError', 'Room name is required');
        return;
    }
    
    try {
        await createChatRoom(name, description, isPrivate);
        
        // Close modal
        closeModal('createRoomModal');
        
        // Reset form
        document.getElementById('createRoomForm').reset();
        document.getElementById('createRoomError').innerHTML = '';
        
    } catch (error) {
        showError('createRoomError', error.message || 'Failed to create room');
    }
}

// Process chat commands
function processChatCommand(input) {
    if (!input.startsWith('/')) return false;
    
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');
    
    switch (command) {
        case '/help':
            showSystemMessage('Available commands:\n/help - Show this help\n/clear - Clear chat\n/leave - Leave current room\n/invite [username] - Invite user to room\n/kick [username] - Remove user from room');
            return true;
            
        case '/clear':
            chatMessages = [];
            updateChatMessages();
            showSystemMessage('Chat cleared');
            return true;
            
        case '/leave':
            leaveChatRoom();
            return true;
            
        case '/invite':
            if (args) {
                inviteUserToRoom(args);
            } else {
                showSystemMessage('Usage: /invite [username]');
            }
            return true;
            
        case '/kick':
            if (args) {
                removeUserFromRoom(args);
            } else {
                showSystemMessage('Usage: /kick [username]');
            }
            return true;
            
        default:
            showSystemMessage(`Unknown command: ${command}`);
            return true;
    }
}

// Show system message in chat
function showSystemMessage(message) {
    const systemMsg = {
        id: Date.now(),
        content: message,
        author: 'System',
        authorDisplayName: 'System',
        createdAt: new Date().toISOString(),
        isSystem: true
    };
    
    chatMessages.push(systemMsg);
    updateChatMessages();
    scrollChatToBottom();
}

// Invite user to room
async function inviteUserToRoom(username) {
    if (!currentChatRoom) return;
    
    try {
        await chatAPI.inviteUser(currentChatRoom.id, username);
        showSystemMessage(`Invited ${username} to the room`);
    } catch (error) {
        showSystemMessage(`Failed to invite ${username}: ${error.message}`);
    }
}

// Remove user from room
async function removeUserFromRoom(username) {
    if (!currentChatRoom) return;
    
    if (currentChatRoom.owner !== currentUser.username) {
        showSystemMessage('Only the room owner can remove users');
        return;
    }
    
    try {
        await chatAPI.removeUser(currentChatRoom.id, username);
        showSystemMessage(`Removed ${username} from the room`);
    } catch (error) {
        showSystemMessage(`Failed to remove ${username}: ${error.message}`);
    }
}
