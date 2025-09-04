// chat-rooms.js - Chat Room Management Functions Only
// Note: All variables (currentChatRoom, chatMessages, userRooms) are declared in chat.js
// This file only contains functions to avoid redeclaration errors

// Room creation handler - FIX 1: Don't try to join after creating
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
        
        // Update the UI - add room to user's rooms list if it exists
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
        if (result.room) {
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
        if (typeof userRooms !== 'undefined' && typeof currentChatRoom !== 'undefined') {
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
        const chatMessagesEl = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        if (chatMessagesEl) chatMessagesEl.style.display = 'block';
        if (chatInput) chatInput.style.display = 'block';
        
        // Start auto-refresh if not already running
        if (typeof startChatRefresh === 'function') {
            startChatRefresh(roomId);
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
        
        // Remove from user rooms if defined
        if (typeof userRooms !== 'undefined') {
            userRooms = userRooms.filter(r => r.id !== roomId);
        }
        
        showSuccessMessage('Left room successfully');
        
        // If this was the current room, clear it
        if (typeof currentChatRoom !== 'undefined' && currentChatRoom && currentChatRoom.id === roomId) {
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

// Delete a room (owner only) - if not defined in chat.js
if (typeof deleteRoom === 'undefined') {
    async function deleteRoom(roomId) {
        if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
            return;
        }
        
        try {
            const token = await getAuthToken();
            if (!token) {
                showSuccessMessage('Please log in');
                return;
            }
            
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete room');
            }
            
            // Remove from user rooms
            if (typeof userRooms !== 'undefined') {
                userRooms = userRooms.filter(r => r.id !== roomId);
            }
            
            showSuccessMessage('Room deleted successfully');
            
            // If this was the current room, clear it
            if (typeof currentChatRoom !== 'undefined' && currentChatRoom && currentChatRoom.id === roomId) {
                currentChatRoom = null;
                if (typeof stopChatRefresh === 'function') {
                    stopChatRefresh();
                }
            }
            
            // Go back to room list
            if (typeof renderChatRoomList === 'function') {
                renderChatRoomList();
            }
            
        } catch (error) {
            console.error('Error deleting room:', error);
            showSuccessMessage(error.message || 'Failed to delete room');
        }
    }
}

// Handle chat input keypress
function handleChatInput(event) {
    // Enter to send, Shift+Enter for new line
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (typeof sendChatMessageFromInput === 'function') {
            sendChatMessageFromInput();
        }
    }
}

// Render chat page (main entry point if not defined in chat.js)
if (typeof renderChatPage === 'undefined') {
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
        if (typeof currentChatRoom !== 'undefined' && currentChatRoom) {
            if (typeof renderChatRoom === 'function') {
                renderChatRoom();
            }
        } else {
            if (typeof renderChatRoomList === 'function') {
                renderChatRoomList();
            }
        }
    }
}

// Open room members modal if not defined
if (typeof openRoomMembersModal === 'undefined') {
    function openRoomMembersModal(roomId) {
        if (!currentChatRoom) return;
        
        const members = currentChatRoom.members || [];
        const isOwner = currentChatRoom.owner === currentUser.username;
        
        const membersHtml = members.map(member => `
            <div class="member-item">
                <div class="member-avatar">
                    ${member.charAt(0).toUpperCase()}
                </div>
                <div class="member-info">
                    <span class="member-username">@${escapeHtml(member)}</span>
                    ${member === currentChatRoom.owner ? '<span class="member-badge">Owner</span>' : ''}
                </div>
                ${isOwner && member !== currentUser.username ? `
                    <button class="member-remove-btn" onclick="removeUserFromRoom('${member}')">
                        Remove
                    </button>
                ` : ''}
            </div>
        `).join('');
        
        // Create a simple modal
        const modalHtml = `
            <div class="modal" id="membersModal" style="display: block;">
                <div class="modal-content">
                    <span class="modal-close" onclick="closeModal('membersModal')">&times;</span>
                    <h2>Room Members (${members.length})</h2>
                    <div class="members-list">
                        ${membersHtml}
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        const existingModal = document.getElementById('membersModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}

// Remove user from room if not defined
if (typeof removeUserFromRoom === 'undefined') {
    async function removeUserFromRoom(username) {
        if (!currentChatRoom || currentChatRoom.owner !== currentUser.username) {
            showSuccessMessage('Only room owners can remove members');
            return;
        }
        
        if (!confirm(`Remove @${username} from the room?`)) {
            return;
        }
        
        try {
            const token = await getAuthToken();
            if (!token) {
                showSuccessMessage('Please log in');
                return;
            }
            
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${currentChatRoom.id}/remove`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to remove user');
            }
            
            // Update local room state
            if (currentChatRoom.members) {
                currentChatRoom.members = currentChatRoom.members.filter(m => m !== username);
            }
            
            showSuccessMessage(`Removed @${username} from the room`);
            
            // Refresh the members modal if it's open
            const membersModal = document.getElementById('membersModal');
            if (membersModal) {
                openRoomMembersModal(currentChatRoom.id);
            }
            
        } catch (error) {
            console.error('Error removing user:', error);
            showSuccessMessage(error.message || 'Failed to remove user');
        }
    }
}

// Open room management modal if not defined
if (typeof openRoomManagementModal === 'undefined') {
    function openRoomManagementModal(roomId) {
        // TODO: Implement full room management
        showSuccessMessage('Room management coming soon!');
    }
}
