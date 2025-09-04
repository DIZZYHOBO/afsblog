// chat-ui.js - Chat UI rendering functions

// Main chat interface renderer
function renderChatInterface() {
    if (!currentUser) {
        updateFeedContent(`
            <div class="chat-login-prompt">
                <h2>Join the Conversation</h2>
                <p>Sign in to access chat rooms</p>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `);
        return;
    }
    
    // Initialize chat if needed
    if (!chatInitialized) {
        initializeChat();
    }
    
    const html = `
        <div class="chat-container">
            <div class="chat-sidebar">
                <div class="chat-sidebar-header">
                    <h3>Chat Rooms</h3>
                    <button class="btn-small" onclick="openModal('createRoomModal')">+</button>
                </div>
                <div class="chat-rooms-list">
                    ${renderChatRoomsList()}
                </div>
            </div>
            <div class="chat-main">
                ${currentChatRoom ? renderChatRoom() : renderNoChatSelected()}
            </div>
        </div>
    `;
    
    updateFeedContent(html);
    
    // Set up chat input handler if in a room
    if (currentChatRoom) {
        const input = document.getElementById('chatInput');
        if (input) {
            input.addEventListener('keydown', handleChatInput);
            input.focus();
        }
    }
}

// Render list of chat rooms
function renderChatRoomsList() {
    if (!userRooms || userRooms.length === 0) {
        return `
            <div class="no-rooms">
                <p>No chat rooms yet</p>
                <button class="btn-secondary" onclick="openModal('createRoomModal')">
                    Create your first room
                </button>
            </div>
        `;
    }
    
    return userRooms.map(room => `
        <div class="chat-room-item ${currentChatRoom?.id === room.id ? 'active' : ''}" 
             onclick="joinChatRoom('${room.id}')">
            <div class="room-icon">${room.isPrivate ? '🔒' : '#'}</div>
            <div class="room-info">
                <div class="room-name">${escapeHtml(room.name)}</div>
                ${room.lastMessage ? `
                    <div class="room-last-message">
                        ${escapeHtml(room.lastMessage.substring(0, 50))}${room.lastMessage.length > 50 ? '...' : ''}
                    </div>
                ` : ''}
            </div>
            ${room.unreadCount ? `
                <div class="room-unread">${room.unreadCount}</div>
            ` : ''}
        </div>
    `).join('');
}

// Render active chat room
function renderChatRoom() {
    if (!currentChatRoom) return '';
    
    return `
        <div class="chat-room">
            <div class="chat-room-header">
                <button class="btn-icon" onclick="leaveChatRoom()">←</button>
                <div class="room-header-info">
                    <h3>${escapeHtml(currentChatRoom.name)}</h3>
                    ${currentChatRoom.description ? 
                        `<p>${escapeHtml(currentChatRoom.description)}</p>` : ''}
                </div>
                <div class="room-header-actions">
                    ${currentChatRoom.creator === currentUser.username ? `
                        <button class="btn-icon" onclick="showRoomSettings('${currentChatRoom.id}')">⚙️</button>
                    ` : ''}
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                ${renderChatMessages()}
            </div>
            <div class="chat-input-container">
                <textarea 
                    id="chatInput" 
                    class="chat-input" 
                    placeholder="Type a message..."
                    rows="1"
                ></textarea>
                <button class="btn-send" onclick="sendChatMessage(document.getElementById('chatInput').value)">
                    Send
                </button>
            </div>
        </div>
    `;
}

// Render chat messages
function renderChatMessages() {
    if (!chatMessages || chatMessages.length === 0) {
        return `
            <div class="no-messages">
                <p>No messages yet</p>
                <p class="text-muted">Be the first to say something!</p>
            </div>
        `;
    }
    
    let lastDate = null;
    let html = '';
    
    chatMessages.forEach(message => {
        const messageDate = new Date(message.timestamp).toDateString();
        
        // Add date separator if new day
        if (messageDate !== lastDate) {
            html += `<div class="message-date-separator">${messageDate}</div>`;
            lastDate = messageDate;
        }
        
        const isOwn = message.author === currentUser.username;
        
        html += `
            <div class="chat-message ${isOwn ? 'own' : ''}">
                <div class="message-author">${escapeHtml(message.author)}</div>
                <div class="message-content">${escapeHtml(message.content)}</div>
                <div class="message-time">${formatChatTime(message.timestamp)}</div>
            </div>
        `;
    });
    
    return html;
}

// Append a new message to the chat
function appendChatMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const isOwn = message.author === currentUser.username;
    
    // Check if we need a date separator
    const lastMessage = messagesContainer.querySelector('.chat-message:last-child');
    const messageDate = new Date(message.timestamp).toDateString();
    
    if (!lastMessage || new Date(chatMessages[chatMessages.length - 2]?.timestamp).toDateString() !== messageDate) {
        const separator = document.createElement('div');
        separator.className = 'message-date-separator';
        separator.textContent = messageDate;
        messagesContainer.appendChild(separator);
    }
    
    // Create and append the message
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
    messageDiv.innerHTML = `
        <div class="message-author">${escapeHtml(message.author)}</div>
        <div class="message-content">${escapeHtml(message.content)}</div>
        <div class="message-time">${formatChatTime(message.timestamp)}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Render no chat selected state
function renderNoChatSelected() {
    return `
        <div class="chat-empty-state">
            <h2>Select a Chat Room</h2>
            <p>Choose a room from the sidebar or create a new one</p>
            <button class="btn" onclick="openModal('createRoomModal')">Create Room</button>
        </div>
    `;
}

// Show room settings
function showRoomSettings(roomId) {
    const room = userRooms.find(r => r.id === roomId);
    if (!room || room.creator !== currentUser.username) return;
    
    // Create a simple settings modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>Room Settings</h2>
            <div class="room-settings">
                <h3>${escapeHtml(room.name)}</h3>
                <p>${escapeHtml(room.description || 'No description')}</p>
                <div class="settings-actions">
                    ${room.isPrivate ? `
                        <div class="form-group">
                            <label>Invite User</label>
                            <input type="text" id="inviteUsername" placeholder="Username">
                            <button class="btn" onclick="inviteToRoom('${roomId}', document.getElementById('inviteUsername').value)">
                                Send Invite
                            </button>
                        </div>
                    ` : ''}
                    <button class="btn btn-danger" onclick="confirmDeleteRoom('${roomId}')">
                        Delete Room
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Confirm room deletion
function confirmDeleteRoom(roomId) {
    if (confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
        deleteChatRoom(roomId).then(success => {
            if (success) {
                showSuccessMessage('Room deleted successfully');
                document.querySelector('.modal').remove();
            } else {
                showSuccessMessage('Failed to delete room');
            }
        });
    }
}

// Auto-resize chat input
function autoResizeChatInput() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
}

// Initialize chat UI listeners
function initChatUIListeners() {
    // Auto-resize textarea
    document.addEventListener('input', (e) => {
        if (e.target.id === 'chatInput') {
            autoResizeChatInput();
        }
    });
}
