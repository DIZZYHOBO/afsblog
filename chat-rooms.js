// chat-rooms.js - Complete Chat Room Management

// Note: userRooms might be declared in chat.js, so we'll check first
if (typeof userRooms === 'undefined') {
    var userRooms = [];
}

// Other chat-specific variables
let currentChatRoom = null;
let chatMessages = [];
let chatRefreshInterval = null;

// FIXED: Room creation/join flow (FIX 1)
async function handleCreateRoom(event) {
    event.preventDefault();
    
    const roomName = document.getElementById('roomName');
    const roomDescription = document.getElementById('roomDescription');
    const isPrivate = document.getElementById('isPrivate');
    
    if (!roomName || !roomDescription || !isPrivate) {
        console.error('Room form elements not found');
        return;
    }
    
    const name = roomName.value.trim();
    const description = roomDescription.value.trim();
    const privateRoom = isPrivate.checked;
    
    if (!name) {
        showSuccessMessage('Please enter a room name');
        return;
    }
    
    try {
        const token = await getAuthToken();
        if (!token) {
            showSuccessMessage('Please log in to create rooms');
            return;
        }

        // Create the room
        const response = await fetch('/.netlify/functions/chat-api/rooms', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                name, 
                description, 
                isPrivate: privateRoom 
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Room created successfully:', result.room);
        
        // FIX 1: Don't try to join the room after creating it
        // The backend already adds the creator as a member
        
        // Update the UI - add room to user's rooms list
        if (result.room && typeof userRooms !== 'undefined') {
            if (!userRooms.some(r => r.id === result.room.id)) {
                userRooms.unshift(result.room);
            }
        }
        
        showSuccessMessage(`Room "${name}" created successfully!`);
        
        // Clear the form
        event.target.reset();
        
        // Close the modal if it exists
        const modal = document.getElementById('createRoomModal');
        if (modal) {
            closeModal('createRoomModal');
        }
        
        // Navigate to the new room (just load it, don't join)
        if (typeof loadChatRoom === 'function' && result.room) {
            await loadChatRoom(result.room.id);
        }
        
        // Refresh the rooms list
        if (typeof loadUserRooms === 'function') {
            await loadUserRooms();
        }
        
    } catch (error) {
        console.error('Error creating room:', error);
        const errorDiv = document.getElementById('createRoomError');
        if (errorDiv) {
            errorDiv.innerHTML = `<div class="error-message">${error.message || 'Failed to create room'}</div>`;
        }
        showSuccessMessage(error.message || 'Failed to create room');
    }
}

// Load a chat room without joining (for rooms we're already members of)
async function loadChatRoom(roomId) {
    try {
        // Find the room in user's rooms
        if (typeof userRooms !== 'undefined') {
            currentChatRoom = userRooms.find(r => r.id === roomId);
        }
        
        if (!currentChatRoom) {
            // If not in user rooms, try to fetch it
            const token = await getAuthToken();
            if (!token) {
                showSuccessMessage('Please log in to access chat');
                return;
            }
            
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Room not found or access denied');
            }
            
            currentChatRoom = await response.json();
        }
        
        // Update UI to show this room
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const roomElement = document.querySelector(`[data-room-id="${roomId}"]`);
        if (roomElement) {
            roomElement.classList.add('active');
        }
        
        // Load messages for this room
        if (typeof loadRoomMessages === 'function') {
            await loadRoomMessages(roomId);
        }
        
        // Update the chat header
        const chatHeader = document.getElementById('chatHeader');
        if (chatHeader && currentChatRoom) {
            chatHeader.innerHTML = `
                <h3>${escapeHtml(currentChatRoom.name)}</h3>
                ${currentChatRoom.description ? 
                    `<p class="chat-room-description">${escapeHtml(currentChatRoom.description)}</p>` : ''}
                <div class="chat-room-meta">
                    <span>👥 ${currentChatRoom.members ? currentChatRoom.members.length : 0} members</span>
                    <span>${currentChatRoom.isPrivate ? '🔒 Private' : '🌐 Public'}</span>
                </div>
            `;
        }
        
        // Show the chat messages area
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        if (chatMessages) chatMessages.style.display = 'block';
        if (chatInput) chatInput.style.display = 'block';
        
        // Start auto-refresh if not already running
        if (typeof startChatRefresh === 'function') {
            startChatRefresh();
        }
        
        // Update page to show chat room view
        if (typeof renderChatRoom === 'function') {
            renderChatRoom();
        }
        
    } catch (error) {
        console.error('Error loading chat room:', error);
        showSuccessMessage('Failed to load chat room');
    }
}

// Join a chat room (for rooms we're not members of yet)
async function joinChatRoom(roomId) {
    try {
        const token = await getAuthToken();
        if (!token) {
            showSuccessMessage('Please log in to join rooms');
            return;
        }
        
        console.log('Joining room:', roomId);
        
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        // FIX 1: Handle both new joins and already-member cases
        if (!response.ok && !result.alreadyMember) {
            throw new Error(result.error || 'Failed to join room');
        }
        
        if (result.room) {
            currentChatRoom = result.room;
            
            // Add to user rooms if not already there
            if (typeof userRooms !== 'undefined' && !userRooms.some(r => r.id === result.room.id)) {
                userRooms.unshift(result.room);
            }
            
            if (result.alreadyMember) {
                console.log('Already a member of this room');
            } else {
                showSuccessMessage('Successfully joined room!');
            }
            
            // Now load the room
            await loadChatRoom(roomId);
        }
        
    } catch (error) {
        console.error('Error joining room:', error);
        showSuccessMessage(error.message || 'Failed to join room');
    }
}

// Leave a chat room
async function leaveChatRoom() {
    if (!currentChatRoom) return;
    
    try {
        const token = await getAuthToken();
        if (!token) {
            showSuccessMessage('Please log in');
            return;
        }
        
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${currentChatRoom.id}/leave`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to leave room');
        }
        
        // Remove from user rooms
        if (typeof userRooms !== 'undefined') {
            userRooms = userRooms.filter(r => r.id !== currentChatRoom.id);
        }
        
        showSuccessMessage('Left room successfully');
        
        // Clear current room and go back to room list
        currentChatRoom = null;
        if (typeof stopChatRefresh === 'function') {
            stopChatRefresh();
        }
        
        // Refresh room list
        if (typeof renderChatRoomList === 'function') {
            renderChatRoomList();
        }
        
    } catch (error) {
        console.error('Error leaving room:', error);
        showSuccessMessage(error.message || 'Failed to leave room');
    }
}

// Confirm before leaving a room
function leaveRoomConfirm(roomId) {
    if (confirm('Are you sure you want to leave this room?')) {
        leaveRoom(roomId);
    }
}

// Leave a specific room
async function leaveRoom(roomId) {
    try {
        const token = await getAuthToken();
        if (!token) {
            showSuccessMessage('Please log in');
            return;
        }
        
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/leave`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to leave room');
        }
        
        // Remove from user rooms
        if (typeof userRooms !== 'undefined') {
            userRooms = userRooms.filter(r => r.id !== roomId);
        }
        
        showSuccessMessage('Left room successfully');
        
        // If this was the current room, clear it
        if (currentChatRoom && currentChatRoom.id === roomId) {
            currentChatRoom = null;
            if (typeof stopChatRefresh === 'function') {
                stopChatRefresh();
            }
        }
        
        // Refresh the room list
        if (typeof renderChatRoomList === 'function') {
            renderChatRoomList();
        }
        
    } catch (error) {
        console.error('Error leaving room:', error);
        showSuccessMessage(error.message || 'Failed to leave room');
    }
}

// Load user's rooms
async function loadUserRooms() {
    try {
        const token = await getAuthToken();
        if (!token) {
            console.log('No auth token, skipping room load');
            return;
        }
        
        const response = await fetch('/.netlify/functions/chat-api/rooms', {
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load rooms');
        }
        
        const data = await response.json();
        userRooms = data.rooms || [];
        console.log('Loaded user rooms:', userRooms.length);
        
    } catch (error) {
        console.error('Error loading user rooms:', error);
        userRooms = [];
    }
}

// Load messages for a room
async function loadRoomMessages(roomId) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return;
        }
        
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages?limit=50`, {
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        
        const data = await response.json();
        chatMessages = data.messages || [];
        
        // Update the UI with messages
        if (typeof updateChatMessages === 'function') {
            updateChatMessages();
        }
        
    } catch (error) {
        console.error('Error loading messages:', error);
        chatMessages = [];
    }
}

// Send a chat message
async function sendChatMessage(content) {
    if (!currentChatRoom || !content.trim()) return;
    
    try {
        const token = await getAuthToken();
        if (!token) {
            showSuccessMessage('Please log in to send messages');
            return;
        }
        
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${currentChatRoom.id}/messages`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: content.trim() })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send message');
        }
        
        const data = await response.json();
        
        // Add message to local array
        chatMessages.push(data.message);
        
        // Update UI
        if (typeof updateChatMessages === 'function') {
            updateChatMessages();
        }
        
        // Clear input
        const input = document.getElementById('chatMessageInput');
        if (input) {
            input.value = '';
            if (typeof autoResizeChatInput === 'function') {
                autoResizeChatInput(input);
            }
        }
        
        // Scroll to bottom
        if (typeof scrollChatToBottom === 'function') {
            scrollChatToBottom();
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showSuccessMessage(error.message || 'Failed to send message');
    }
}

// Start chat refresh interval
function startChatRefresh() {
    stopChatRefresh(); // Clear any existing interval
    
    if (!currentChatRoom) return;
    
    chatRefreshInterval = setInterval(async () => {
        if (currentChatRoom) {
            await loadRoomMessages(currentChatRoom.id);
        }
    }, 3000); // Refresh every 3 seconds
}

// Stop chat refresh interval
function stopChatRefresh() {
    if (chatRefreshInterval) {
        clearInterval(chatRefreshInterval);
        chatRefreshInterval = null;
    }
}

// Process chat commands
function processChatCommand(content) {
    if (!content.startsWith('/')) return false;
    
    const parts = content.split(' ');
    const command = parts[0].toLowerCase();
    
    switch (command) {
        case '/help':
            showSuccessMessage('Commands: /help, /members, /leave');
            return true;
            
        case '/members':
            if (currentChatRoom && currentChatRoom.members) {
                showSuccessMessage(`Members: ${currentChatRoom.members.join(', ')}`);
            }
            return true;
            
        case '/leave':
            leaveChatRoom();
            return true;
            
        default:
            showSuccessMessage('Unknown command. Type /help for available commands.');
            return true;
    }
}

// Render chat page (main entry point)
function renderChatPage() {
    if (!currentUser) {
        const html = `
            <div class="feature-placeholder">
                <h3>💬 Chat Rooms</h3>
                <p>Please sign in to access chat rooms.</p>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        updateFeedContent(html);
        return;
    }
    
    // If we have a current room, show it; otherwise show room list
    if (currentChatRoom) {
        if (typeof renderChatRoom === 'function') {
            renderChatRoom();
        }
    } else {
        if (typeof renderChatRoomList === 'function') {
            renderChatRoomList();
        }
    }
}
