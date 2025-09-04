// chat-ui.js - Chat UI rendering and interface

// Render main chat page
function renderChatPage() {
    if (!currentUser) {
        const loginRequiredHtml = `
            <div class="feature-placeholder">
                <h3>💬 Chat Rooms</h3>
                <p>Please sign in to access chat rooms and talk with other community members.</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
                    <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
                    <button class="btn btn-secondary" onclick="openAuthModal('signup')">Sign Up</button>
                </div>
            </div>
        `;
        updateFeedContent(loginRequiredHtml);
        return;
    }

    // Show loading initially
    updateFeedContent('<div class="loading">Loading chat...</div>');
    
    // If we have a current room, show it, otherwise show room list
    if (currentChatRoom) {
        renderChatRoom();
    } else {
        renderChatRoomList();
    }
}

// Render room list (lobby)
async function renderChatRoomList() {
    try {
        // Load user's rooms and public rooms
        const [userRoomsResponse, publicRoomsResponse] = await Promise.all([
            chatAPI.getUserRooms(),
            chatAPI.getPublicRooms()
        ]);
        
        const myRooms = userRoomsResponse.rooms || [];
        const publicRooms = publicRoomsResponse.rooms || [];
        
        // Filter out public rooms that user is already a member of
        const availablePublicRooms = publicRooms.filter(room => 
            !myRooms.some(myRoom => myRoom.id === room.id)
        );
        
        const chatLobbyHtml = `
            <div class="chat-page">
                <div class="chat-header">
                    <h1 class="chat-title">💬 Chat Rooms</h1>
                    <div class="chat-actions">
                        <button class="btn" onclick="openCreateRoomModal()">
                            ➕ Create Room
                        </button>
                    </div>
                </div>

                <!-- My Rooms Section -->
                <div class="chat-section">
                    <h3 class="chat-section-title">Your Rooms (${myRooms.length})</h3>
                    ${myRooms.length > 0 ? `
                        <div class="chat-rooms-grid">
                            ${myRooms.map(room => renderRoomCard(room, true)).join('')}
                        </div>
                    ` : `
                        <div class="chat-empty-state">
                            <p>You haven't joined any chat rooms yet.</p>
                            <p>Create your own room or join a public room below!</p>
                        </div>
                    `}
                </div>

                <!-- Public Rooms Section -->
                <div class="chat-section">
                    <h3 class="chat-section-title">Public Rooms (${availablePublicRooms.length})</h3>
                    ${availablePublicRooms.length > 0 ? `
                        <div class="chat-rooms-grid">
                            ${availablePublicRooms.map(room => renderRoomCard(room, false)).join('')}
                        </div>
                    ` : `
                        <div class="chat-empty-state">
                            <p>No public rooms available to join.</p>
                            <p>Be the first to create a public room!</p>
                        </div>
                    `}
                </div>
            </div>
        `;
        
        updateFeedContent(chatLobbyHtml);
        
    } catch (error) {
        console.error('Error loading room list:', error);
        updateFeedContent(`
            <div class="feature-placeholder">
                <h3>💬 Chat Error</h3>
                <p>Failed to load chat rooms. Please try again.</p>
                <button class="btn" onclick="renderChatRoomList()">Retry</button>
            </div>
        `);
    }
}

// Render individual room card
function renderRoomCard(room, isMember) {
    const memberCount = room.members ? room.members.length : 0;
    const isOwner = room.createdBy === currentUser.username;
    
    return `
        <div class="chat-room-card">
            <div class="room-card-header">
                <div class="room-card-icon">
                    ${room.isPrivate ? '🔒' : '🌐'}
                </div>
                <div class="room-card-info">
                    <h4 class="room-card-name">${escapeHtml(room.name)}</h4>
                    <p class="room-card-description">${escapeHtml(room.description || 'No description')}</p>
                    <div class="room-card-meta">
                        <span class="room-card-members">👥 ${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
                        <span class="room-card-privacy">${room.isPrivate ? 'Private' : 'Public'}</span>
                        ${isOwner ? '<span class="room-card-owner">👑 Owner</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="room-card-actions">
                ${isMember ? `
                    <button class="btn" onclick="joinChatRoom('${room.id}')">
                        Enter Room
                    </button>
                    ${isOwner ? '' : `
                        <button class="btn btn-secondary" onclick="leaveRoomConfirm('${room.id}')">
                            Leave
                        </button>
                    `}
                ` : `
                    <button class="btn" onclick="joinChatRoom('${room.id}')">
                        Join Room
                    </button>
                `}
            </div>
        </div>
    `;
}

// Render active chat room
function renderChatRoom() {
    if (!currentChatRoom) {
        renderChatRoomList();
        return;
    }
    
    const memberCount = currentChatRoom.members ? currentChatRoom.members.length : 0;
    const isOwner = currentChatRoom.createdBy === currentUser.username;
    
    const chatRoomHtml = `
        <div class="chat-room">
            <div class="chat-room-header">
                <button class="btn btn-secondary" onclick="leaveChatRoom()">
                    ← Back to Lobby
                </button>
                <div class="chat-room-info">
                    <h2 class="chat-room-title">
                        ${currentChatRoom.isPrivate ? '🔒' : '🌐'} ${escapeHtml(currentChatRoom.name)}
                    </h2>
                    <p class="chat-room-meta">
                        ${memberCount} ${memberCount === 1 ? 'member' : 'members'} • 
                        ${currentChatRoom.isPrivate ? 'Private' : 'Public'} room
                        ${isOwner ? ' • 👑 You own this room' : ''}
                    </p>
                </div>
                <div class="chat-room-actions">
                    ${isOwner ? `
                        <button class="btn btn-secondary" onclick="openRoomManagementModal('${currentChatRoom.id}')">
                            ⚙️ Manage
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="openRoomMembersModal('${currentChatRoom.id}')">
                        👥 Members
                    </button>
                </div>
            </div>

            <div class="chat-messages-container" id="chatMessagesContainer">
                <div class="chat-messages" id="chatMessages">
                    ${renderChatMessages()}
                </div>
            </div>

            <div class="chat-input-container">
                <div class="chat-input-wrapper">
                    <textarea 
                        id="chatMessageInput" 
                        class="chat-message-input" 
                        placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                        rows="1"
                        onkeydown="handleChatInput(event)"
                        oninput="autoResizeChatInput(this)"></textarea>
                    <button class="chat-send-btn" onclick="sendChatMessageFromInput()">
                        📤
                    </button>
                </div>
                <div class="chat-input-help">
                    <small>Commands: /help, /invite &lt;username&gt;, /leave</small>
                </div>
            </div>
        </div>
    `;
    
    updateFeedContent(chatRoomHtml);
    
    // Scroll to bottom of messages
    setTimeout(scrollChatToBottom, 100);
}

// Render chat messages
function renderChatMessages() {
    if (!chatMessages || chatMessages.length === 0) {
        return `
            <div class="chat-empty-messages">
                <div class="chat-empty-icon">💬</div>
                <p>No messages yet. Be the first to say hello!</p>
            </div>
        `;
    }
    
    return chatMessages.map(message => renderChatMessage(message)).join('');
}

// Render individual chat message
function renderChatMessage(message) {
    const isOwnMessage = message.author === currentUser.username;
    const isSystemMessage = message.isSystem;
    const timestamp = formatTimestamp(message.timestamp);
    
    if (isSystemMessage) {
        return `
            <div class="chat-message system-message">
                <div class="system-message-content">
                    <span class="system-message-icon">ℹ️</span>
                    ${escapeHtml(message.content)}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="chat-message ${isOwnMessage ? 'own-message' : ''}">
            <div class="message-avatar">
                ${message.author.charAt(0).toUpperCase()}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">@${escapeHtml(message.author)}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-text">
                    ${renderMessageContent(message.content)}
                </div>
            </div>
        </div>
    `;
}

// Render message content with basic formatting
function renderMessageContent(content) {
    if (!content) return '';
    
    let html = escapeHtml(content);
    
    // Basic link detection
    html = html.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Basic @mention highlighting
    html = html.replace(
        /@([a-zA-Z0-9_]+)/g,
        '<span class="mention">@$1</span>'
    );
    
    // Convert line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// Send message from input
function sendChatMessageFromInput() {
    const input = document.getElementById('chatMessageInput');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) return;
    
    // Check if it's a command
    if (processChatCommand(content)) {
        input.value = '';
        autoResizeChatInput(input);
        return;
    }
    
    // Send regular message
    sendChatMessage(content);
}

// Auto-resize chat input
function autoResizeChatInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// Scroll chat to bottom
function scrollChatToBottom() {
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// Update chat messages (called when new messages arrive)
function updateChatMessages() {
    const messagesElement = document.getElementById('chatMessages');
    if (messagesElement) {
        const wasAtBottom = isScrolledToBottom();
        messagesElement.innerHTML = renderChatMessages();
        
        // Only auto-scroll if user was already at bottom
        if (wasAtBottom) {
            scrollChatToBottom();
        }
    }
}

// Check if user is scrolled to bottom
function isScrolledToBottom() {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return true;
    
    return container.scrollHeight - container.clientHeight <= container.scrollTop + 1;
}

// Open create room modal
function openCreateRoomModal() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    document.getElementById('createRoomForm').reset();
    document.getElementById('createRoomError').innerHTML = '';
    openModal('createRoomModal');
}

// Open room management modal (for room owners)
function openRoomManagementModal(roomId) {
    // TODO: Implement room management modal
    showSuccessMessage('Room management coming soon!');
}

// Open room members modal
function openRoomMembersModal(roomId) {
    if (!currentChatRoom) return;
    
    const members = currentChatRoom.members || [];
    const isOwner = currentChatRoom.createdBy === currentUser.username;
    
    const membersHtml = members.map(member => `
        <div class="member-item">
            <div class="member-avatar">
                ${member.charAt(0).toUpperCase()}
            </div>
            <div class="member-info">
                <span class="member-username">@${escapeHtml(member)}</span>
                ${member === currentChatRoom.createdBy ? '<span class="member-badge">👑 Owner</span>' : ''}
            </div>
            ${isOwner && member !== currentUser.username ? `
                <button class="btn btn-danger btn-small" onclick="removeUserFromRoom('${roomId}', '${member}')">
                    Remove
                </button>
            ` : ''}
        </div>
    `).join('');
    
    const modalContent = `
        <div class="members-modal-content">
            <h4>Room Members (${members.length})</h4>
            <div class="members-list">
                ${membersHtml}
            </div>
            ${isOwner ? `
                <div class="invite-section">
                    <h5>Invite User</h5>
                    <div class="invite-form">
                        <input type="text" id="inviteUsername" placeholder="Username to invite" maxlength="20">
                        <button class="btn" onclick="inviteUserFromModal('${roomId}')">Invite</button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Create and show modal (simplified implementation)
    showModal('Room Members', modalContent);
}

// Invite user from modal
function inviteUserFromModal(roomId) {
    const usernameInput = document.getElementById('inviteUsername');
    if (!usernameInput) return;
    
    const username = usernameInput.value.trim();
    if (!username) {
        showSuccessMessage('Please enter a username');
        return;
    }
    
    inviteUserToRoom(roomId, username);
    usernameInput.value = '';
}

// Leave room with confirmation
function leaveRoomConfirm(roomId) {
    const room = userRooms.find(r => r.id === roomId);
    const roomName = room ? room.name : 'this room';
    
    if (confirm(`Are you sure you want to leave "${roomName}"?`)) {
        leaveChatRoom();
    }
}

// Simple modal implementation (you might want to integrate with existing modal system)
function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${escapeHtml(title)}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Navigation helper
function navigateToChat() {
    toggleMenu();
    currentPage = 'chat';
    updateActiveMenuItem('menuChat');
    updateUI();
}
