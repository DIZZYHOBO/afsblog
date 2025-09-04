// chat-rooms.js - Chat room management and creation

// Create new chat room
async function handleCreateRoom(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('createRoomError', 'Please sign in to create a room');
        return;
    }
    
    const name = document.getElementById('roomName').value.trim();
    const description = document.getElementById('roomDescription').value.trim();
    const isPrivate = document.getElementById('roomIsPrivate').checked;
    const submitBtn = document.getElementById('createRoomSubmitBtn');
    const errorDiv = document.getElementById('createRoomError');
    
    errorDiv.innerHTML = '';
    
    // Validation
    if (!name) {
        showError('createRoomError', 'Room name is required');
        return;
    }
    
    if (name.length < 3 || name.length > 50) {
        showError('createRoomError', 'Room name must be 3-50 characters');
        return;
    }
    
    if (description && description.length > 200) {
        showError('createRoomError', 'Description must be 200 characters or less');
        return;
    }
    
    // Check for inappropriate characters in room name
    if (!/^[a-zA-Z0-9\s\-_!?.]+$/.test(name)) {
        showError('createRoomError', 'Room name contains invalid characters');
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        const roomData = {
            name: name,
            description: description || '',
            isPrivate: isPrivate
        };
        
        const response = await chatAPI.createRoom(roomData);
        
        if (response.success) {
            // Add room to user's rooms
            userRooms.unshift(response.room);
            
            closeModal('createRoomModal');
            document.getElementById('createRoomForm').reset();
            
            showSuccessMessage(`Room "${response.room.name}" created successfully!`);
            
            // Navigate to the new room
            await joinChatRoom(response.room.id);
        } else {
            showError('createRoomError', response.error || 'Failed to create room');
        }
        
    } catch (error) {
        console.error('Error creating room:', error);
        showError('createRoomError', 'Failed to create room. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Room';
    }
}

// Delete a room (owner only)
async function deleteRoom(roomId) {
    const room = userRooms.find(r => r.id === roomId);
    if (!room) {
        showSuccessMessage('Room not found');
        return;
    }
    
    if (room.createdBy !== currentUser.username && !currentUser.profile?.isAdmin) {
        showSuccessMessage('Only the room creator or admins can delete rooms');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the room "${room.name}"? This action cannot be undone and will remove all messages.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/delete`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${await getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Remove from local cache
        userRooms = userRooms.filter(r => r.id !== roomId);
        
        // If we're currently in this room, go back to lobby
        if (currentChatRoom && currentChatRoom.id === roomId) {
            currentChatRoom = null;
            chatMessages = [];
            stopChatRefresh();
            renderChatRoomList();
        }
        
        showSuccessMessage(`Room "${room.name}" deleted successfully`);
        
    } catch (error) {
        console.error('Error deleting room:', error);
        showSuccessMessage('Failed to delete room. Please try again.');
    }
}

// Update room settings (owner only)
async function updateRoomSettings(roomId, settings) {
    try {
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/settings`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Update local cache
        const roomIndex = userRooms.findIndex(r => r.id === roomId);
        if (roomIndex !== -1) {
            userRooms[roomIndex] = { ...userRooms[roomIndex], ...result.room };
        }
        
        // Update current room if it's the one we're in
        if (currentChatRoom && currentChatRoom.id === roomId) {
            currentChatRoom = { ...currentChatRoom, ...result.room };
        }
        
        showSuccessMessage('Room settings updated successfully');
        return result.room;
        
    } catch (error) {
        console.error('Error updating room settings:', error);
        showSuccessMessage('Failed to update room settings');
        throw error;
    }
}

// Get room statistics
async function getRoomStats(roomId) {
    try {
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/stats`, {
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
        console.error('Error getting room stats:', error);
        return null;
    }
}

// Search public rooms
async function searchPublicRooms(query) {
    try {
        const params = new URLSearchParams({ q: query, limit: '20' });
        const response = await fetch(`/.netlify/functions/chat-api/rooms/search?${params}`, {
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
        console.error('Error searching rooms:', error);
        return { rooms: [] };
    }
}

// Join room by invite code
async function joinRoomByCode(inviteCode) {
    try {
        const response = await fetch(`/.netlify/functions/chat-api/rooms/join-by-code`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
            },
            body: JSON.stringify({ inviteCode })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Add room to user's rooms if not already there
        if (!userRooms.some(r => r.id === result.room.id)) {
            userRooms.unshift(result.room);
        }
        
        showSuccessMessage(`Joined room "${result.room.name}" successfully!`);
        
        // Navigate to the room
        await joinChatRoom(result.room.id);
        
        return result.room;
        
    } catch (error) {
        console.error('Error joining room by code:', error);
        showSuccessMessage('Invalid invite code or failed to join room');
        throw error;
    }
}

// Generate invite code for room (owner only)
async function generateInviteCode(roomId) {
    try {
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/invite-code`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${await getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.inviteCode;
        
    } catch (error) {
        console.error('Error generating invite code:', error);
        showSuccessMessage('Failed to generate invite code');
        throw error;
    }
}

// Get room activity (recent messages count, active users, etc.)
async function getRoomActivity(roomId) {
    try {
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/activity`, {
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
        console.error('Error getting room activity:', error);
        return null;
    }
}

// Archive/unarchive room (owner only)
async function toggleRoomArchive(roomId) {
    try {
        const room = userRooms.find(r => r.id === roomId);
        if (!room) {
            showSuccessMessage('Room not found');
            return;
        }
        
        const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/archive`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
            },
            body: JSON.stringify({ archived: !room.archived })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Update local cache
        const roomIndex = userRooms.findIndex(r => r.id === roomId);
        if (roomIndex !== -1) {
            userRooms[roomIndex].archived = result.archived;
        }
        
        const action = result.archived ? 'archived' : 'unarchived';
        showSuccessMessage(`Room "${room.name}" ${action} successfully`);
        
        return result;
        
    } catch (error) {
        console.error('Error toggling room archive:', error);
        showSuccessMessage('Failed to update room archive status');
        throw error;
    }
}

// Bulk actions for room management
async function bulkManageRooms(action, roomIds) {
    try {
        const response = await fetch('/.netlify/functions/chat-api/rooms/bulk', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
            },
            body: JSON.stringify({ action, roomIds })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Refresh user rooms
        await loadUserRooms();
        
        showSuccessMessage(`Bulk ${action} completed successfully`);
        return result;
        
    } catch (error) {
        console.error('Error with bulk room action:', error);
        showSuccessMessage(`Failed to perform bulk ${action}`);
        throw error;
    }
}

// Room validation helpers
function validateRoomName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Room name is required' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 3) {
        return { valid: false, error: 'Room name must be at least 3 characters' };
    }
    
    if (trimmed.length > 50) {
        return { valid: false, error: 'Room name must be 50 characters or less' };
    }
    
    if (!/^[a-zA-Z0-9\s\-_!?.]+$/.test(trimmed)) {
        return { valid: false, error: 'Room name contains invalid characters' };
    }
    
    return { valid: true, name: trimmed };
}

function validateRoomDescription(description) {
    if (!description) {
        return { valid: true, description: '' };
    }
    
    if (typeof description !== 'string') {
        return { valid: false, error: 'Description must be text' };
    }
    
    const trimmed = description.trim();
    
    if (trimmed.length > 200) {
        return { valid: false, error: 'Description must be 200 characters or less' };
    }
    
    return { valid: true, description: trimmed };
}

// Room permissions helpers
function canUserAccessRoom(room, user) {
    if (!room || !user) return false;
    
    // Public rooms are accessible to all authenticated users
    if (!room.isPrivate) return true;
    
    // Private rooms only accessible to members
    return room.members && room.members.includes(user.username);
}

function canUserModerateRoom(room, user) {
    if (!room || !user) return false;
    
    // Room creator and admins can moderate
    return room.createdBy === user.username || user.isAdmin;
}

function canUserInviteToRoom(room, user) {
    if (!room || !user) return false;
    
    // For now, only room creators can invite
    // You could extend this to allow all members or specific moderators
    return room.createdBy === user.username;
}

// Room search and filtering
function filterUserRooms(rooms, filter) {
    if (!rooms || !Array.isArray(rooms)) return [];
    
    switch (filter) {
        case 'public':
            return rooms.filter(room => !room.isPrivate);
        case 'private':
            return rooms.filter(room => room.isPrivate);
        case 'owned':
            return rooms.filter(room => room.createdBy === currentUser?.username);
        case 'joined':
            return rooms.filter(room => room.createdBy !== currentUser?.username);
        case 'archived':
            return rooms.filter(room => room.archived);
        case 'active':
            return rooms.filter(room => !room.archived);
        default:
            return rooms;
    }
}

function sortRooms(rooms, sortBy = 'recent') {
    if (!rooms || !Array.isArray(rooms)) return [];
    
    const sortedRooms = [...rooms];
    
    switch (sortBy) {
        case 'name':
            return sortedRooms.sort((a, b) => a.name.localeCompare(b.name));
        case 'members':
            return sortedRooms.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
        case 'created':
            return sortedRooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        case 'recent':
        default:
            return sortedRooms.sort((a, b) => new Date(b.lastActivity || b.createdAt) - new Date(a.lastActivity || a.createdAt));
    }
}

// Cleanup room-related data
function cleanupRoomData() {
    userRooms = [];
    currentChatRoom = null;
    chatMessages = [];
    stopChatRefresh();
    console.log('Room data cleaned up');
}
