// chat.js - Complete Chat Application with API Integration

// Global State
let currentUser = null;
let currentServer = null;
let currentRoom = null;
let servers = [];
let rooms = [];
let messages = [];
let pollInterval = null;
let lastMessageTimestamp = null;

// API Configuration
const API_BASE = '/.netlify/functions';
const CHAT_API = `${API_BASE}/chat-api`;
const AUTH_API = `${API_BASE}/api`;

// Authentication state from existing app
const AUTH_CONFIG = {
    ACCESS_TOKEN_KEY: 'shed_access_token',
    REFRESH_TOKEN_KEY: 'shed_refresh_token',
    USER_DATA_KEY: 'shed_user_data',
    SESSION_KEY: 'shed_session_data'
};

// Initialize the app
async function init() {
    console.log('Initializing chat app...');
    
    // Check authentication from existing app
    const authenticated = await checkAuthentication();
    
    if (!authenticated) {
        showToast('Please log in to use chat', 'error');
        // Redirect to main app for login
        window.location.href = '/';
        return;
    }
    
    // Load user's servers
    await loadUserServers();
    
    // Set up periodic message polling
    setupMessagePolling();
}

// Check authentication using existing session
async function checkAuthentication() {
    try {
        // Get token from localStorage (from your existing app)
        const accessTokenData = localStorage.getItem(AUTH_CONFIG.ACCESS_TOKEN_KEY);
        const userDataRaw = localStorage.getItem(AUTH_CONFIG.USER_DATA_KEY);
        
        if (!accessTokenData || !userDataRaw) {
            console.log('No authentication tokens found');
            return false;
        }
        
        // Parse the access token (wrapped in object)
        let accessToken;
        try {
            const tokenParsed = JSON.parse(accessTokenData);
            accessToken = tokenParsed.value || tokenParsed;
        } catch (e) {
            accessToken = accessTokenData; // Use raw if not JSON
        }
        
        // Parse user data
        try {
            const userDataParsed = JSON.parse(userDataRaw);
            currentUser = userDataParsed.value || userDataParsed;
            console.log('Authenticated as:', currentUser.username);
            console.log('Token available:', accessToken ? 'Yes' : 'No');
            
            // Store the actual token for later use
            window.currentAccessToken = accessToken;
            
            return true;
        } catch (error) {
            console.error('Error parsing user data:', error);
            return false;
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        return false;
    }
}

// Get authentication headers
function getAuthHeaders() {
    // Use the stored token from authentication check
    const accessToken = window.currentAccessToken;
    
    if (!accessToken) {
        // Fallback: try to get it again from localStorage
        const tokenData = localStorage.getItem(AUTH_CONFIG.ACCESS_TOKEN_KEY);
        if (tokenData) {
            try {
                const parsed = JSON.parse(tokenData);
                window.currentAccessToken = parsed.value || parsed;
            } catch (e) {
                window.currentAccessToken = tokenData;
            }
        }
    }
    
    console.log('Sending auth header:', window.currentAccessToken ? 'Bearer token included' : 'No token');
    
    return {
        'Authorization': window.currentAccessToken ? `Bearer ${window.currentAccessToken}` : '',
        'Content-Type': 'application/json'
    };
}

// API Request Helper
async function apiRequest(url, options = {}) {
    try {
        const headers = getAuthHeaders();
        console.log('Making API request to:', url);
        console.log('Request method:', options.method || 'GET');
        
        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            
            let error;
            try {
                const errorJson = JSON.parse(errorText);
                error = new Error(errorJson.error || `HTTP ${response.status}`);
            } catch (e) {
                error = new Error(`HTTP ${response.status}: ${errorText}`);
            }
            throw error;
        }
        
        const data = await response.json();
        console.log('API Response success');
        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Load user's servers
async function loadUserServers() {
    try {
        const data = await apiRequest(`${CHAT_API}/servers`);
        servers = data.servers || [];
        renderServerBar();
        
        // Auto-select first server if available
        if (servers.length > 0 && !currentServer) {
            selectServer(servers[0].id);
        }
    } catch (error) {
        console.error('Failed to load servers:', error);
        showToast('Failed to load servers', 'error');
    }
}

// Render server bar
function renderServerBar() {
    const serverList = document.getElementById('serverBar');
    
    // Clear existing servers (keep create and browse buttons)
    const existingServers = serverList.querySelectorAll('.server-button:not(.create):not(.browse)');
    existingServers.forEach(btn => btn.remove());
    
    // Add server buttons
    servers.forEach(server => {
        const button = document.createElement('button');
        button.className = `server-button ${currentServer === server.id ? 'active' : ''}`;
        button.textContent = server.name;
        button.title = server.name;
        button.onclick = () => selectServer(server.id);
        serverList.appendChild(button);
    });
}

// Select a server
async function selectServer(serverId) {
    try {
        currentServer = serverId;
        currentRoom = null;
        lastMessageTimestamp = null;
        
        // Update UI
        renderServerBar();
        
        // Load server rooms
        const data = await apiRequest(`${CHAT_API}/servers/${serverId}/rooms`);
        rooms = data.rooms || [];
        
        // Update sidebar
        const server = servers.find(s => s.id === serverId);
        document.getElementById('sidebarServerName').textContent = server ? server.name : 'Server';
        renderRoomsList();
        
        // Auto-select first room
        if (rooms.length > 0) {
            selectRoom(rooms[0].id);
        } else {
            // Clear chat area
            document.getElementById('roomName').textContent = 'No rooms available';
            document.getElementById('messagesContainer').innerHTML = `
                <div class="welcome-screen">
                    <div class="welcome-title">No Rooms Yet</div>
                    <div class="welcome-subtitle">Create a room to start chatting</div>
                    <div class="welcome-actions">
                        <button class="btn btn-primary" onclick="showCreateRoomModal()">Create Room</button>
                    </div>
                </div>
            `;
            document.getElementById('inputArea').style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to select server:', error);
        showToast('Failed to load server rooms', 'error');
    }
}

// Render rooms list
function renderRoomsList() {
    const roomsList = document.getElementById('roomsList');
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="loading">No rooms yet</div>';
        return;
    }
    
    roomsList.innerHTML = rooms.map(room => `
        <div class="room-item ${currentRoom === room.id ? 'active' : ''}" onclick="selectRoom('${room.id}')">
            <span class="room-hash">#</span>
            <span>${room.name}</span>
        </div>
    `).join('');
}

// Select a room
async function selectRoom(roomId) {
    try {
        currentRoom = roomId;
        lastMessageTimestamp = null;
        
        // Update UI
        renderRoomsList();
        
        const room = rooms.find(r => r.id === roomId);
        document.getElementById('roomName').textContent = room ? `# ${room.name}` : 'Loading...';
        
        // Show input area
        document.getElementById('inputArea').style.display = 'block';
        
        // Load messages
        await loadMessages();
        
    } catch (error) {
        console.error('Failed to select room:', error);
        showToast('Failed to load room', 'error');
    }
}

// Load messages for current room
async function loadMessages(isPoll = false) {
    if (!currentRoom) return;
    
    try {
        let url = `${CHAT_API}/rooms/${currentRoom}/messages?limit=50`;
        
        // For polling, only get new messages
        if (isPoll && lastMessageTimestamp) {
            url += `&after=${lastMessageTimestamp}`;
        }
        
        const data = await apiRequest(url);
        
        if (isPoll && data.messages.length > 0) {
            // Append new messages
            messages = messages.concat(data.messages);
            data.messages.forEach(msg => renderMessage(msg, true));
            
            // Update last timestamp
            const lastMsg = data.messages[data.messages.length - 1];
            if (lastMsg) {
                lastMessageTimestamp = lastMsg.createdAt;
            }
            
            // Scroll to bottom
            scrollToBottom();
        } else if (!isPoll) {
            // Initial load
            messages = data.messages || [];
            renderMessages();
            
            // Set last timestamp
            if (messages.length > 0) {
                lastMessageTimestamp = messages[messages.length - 1].createdAt;
            }
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        if (!isPoll) {
            showToast('Failed to load messages', 'error');
        }
    }
}

// Render all messages
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-title">No messages yet</div>
                <div class="welcome-subtitle">Be the first to say something!</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    messages.forEach(msg => renderMessage(msg, false));
    scrollToBottom();
}

// Render a single message
function renderMessage(message, append = false) {
    const container = document.getElementById('messagesContainer');
    
    // Clear welcome screen if needed
    if (container.querySelector('.welcome-screen')) {
        container.innerHTML = '';
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.dataset.messageId = message.id;
    
    const time = new Date(message.createdAt).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
    });
    
    const authorInitial = (message.authorDisplayName || message.author).charAt(0).toUpperCase();
    
    messageEl.innerHTML = `
        <div class="message-avatar">${authorInitial}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.authorDisplayName || message.author}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.content)}</div>
        </div>
    `;
    
    if (append) {
        container.appendChild(messageEl);
    } else {
        container.appendChild(messageEl);
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentRoom) return;
    
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;
    
    try {
        const data = await apiRequest(`${CHAT_API}/rooms/${currentRoom}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        
        // Clear input
        input.value = '';
        
        // Add message to UI immediately
        messages.push(data.message);
        renderMessage(data.message, true);
        scrollToBottom();
        
        // Update last timestamp
        lastMessageTimestamp = data.message.createdAt;
        
    } catch (error) {
        console.error('Failed to send message:', error);
        showToast('Failed to send message', 'error');
    } finally {
        sendButton.disabled = false;
        input.focus();
    }
}

// Handle message input keypress
function handleMessageKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Create server
async function createServer() {
    const name = document.getElementById('serverName').value.trim();
    const description = document.getElementById('serverDescription').value.trim();
    const isPrivate = document.getElementById('serverPrivate').checked;
    
    if (!name) {
        showError('createServerError', 'Server name is required');
        return;
    }
    
    try {
        const data = await apiRequest(`${CHAT_API}/servers`, {
            method: 'POST',
            body: JSON.stringify({ name, description, isPrivate })
        });
        
        showToast('Server created successfully!', 'success');
        closeModal('createServerModal');
        
        // Clear form
        document.getElementById('serverName').value = '';
        document.getElementById('serverDescription').value = '';
        document.getElementById('serverPrivate').checked = false;
        
        // Reload servers and select new one
        await loadUserServers();
        if (data.server) {
            selectServer(data.server.id);
        }
        
    } catch (error) {
        showError('createServerError', error.message);
    }
}

// Create room
async function createRoom() {
    if (!currentServer) {
        showToast('Please select a server first', 'error');
        return;
    }
    
    const name = document.getElementById('roomNameInput').value.trim();
    const description = document.getElementById('roomDescription').value.trim();
    const isPrivate = document.getElementById('roomPrivate').checked;
    
    if (!name) {
        showError('createRoomError', 'Room name is required');
        return;
    }
    
    try {
        const data = await apiRequest(`${CHAT_API}/servers/${currentServer}/rooms`, {
            method: 'POST',
            body: JSON.stringify({ name, description, isPrivate })
        });
        
        showToast('Room created successfully!', 'success');
        closeModal('createRoomModal');
        
        // Clear form
        document.getElementById('roomNameInput').value = '';
        document.getElementById('roomDescription').value = '';
        document.getElementById('roomPrivate').checked = false;
        
        // Reload rooms and select new one
        await selectServer(currentServer);
        if (data.room) {
            selectRoom(data.room.id);
        }
        
    } catch (error) {
        showError('createRoomError', error.message);
    }
}

// Load public servers
async function loadPublicServers() {
    const container = document.getElementById('publicServersList');
    
    try {
        const data = await apiRequest(`${CHAT_API}/servers/public`);
        const publicServers = data.servers || [];
        
        if (publicServers.length === 0) {
            container.innerHTML = '<div class="loading">No public servers available</div>';
            return;
        }
        
        container.innerHTML = publicServers.map(server => `
            <div class="server-list-item" onclick="joinServer('${server.id}')">
                <div class="server-list-name">${escapeHtml(server.name)}</div>
                <div class="server-list-info">
                    ${server.memberCount} members • ${server.roomCount} rooms
                    ${server.description ? `<br>${escapeHtml(server.description)}` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load public servers:', error);
        container.innerHTML = '<div class="loading">Failed to load servers</div>';
    }
}

// Join server
async function joinServer(serverId) {
    try {
        await apiRequest(`${CHAT_API}/servers/${serverId}/join`, {
            method: 'POST'
        });
        
        showToast('Successfully joined server!', 'success');
        closeModal('browseServersModal');
        
        // Reload servers and select joined one
        await loadUserServers();
        selectServer(serverId);
        
    } catch (error) {
        showToast('Failed to join server', 'error');
    }
}

// Join server by code
async function joinServerByCode() {
    const code = document.getElementById('serverCode').value.trim();
    
    if (!code) {
        showError('browseServersError', 'Please enter a server code');
        return;
    }
    
    try {
        // Server code is the server ID
        await joinServer(code);
        document.getElementById('serverCode').value = '';
    } catch (error) {
        showError('browseServersError', 'Invalid server code or server not found');
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('roomsSidebar');
    sidebar.classList.toggle('open');
}

// Setup message polling
function setupMessagePolling() {
    // Poll for new messages every 2 seconds
    pollInterval = setInterval(() => {
        if (currentRoom) {
            loadMessages(true);
        }
    }, 2000);
}

// UI Helper Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    // Clear any error messages
    const errorEl = document.querySelector(`#${modalId} [id$="Error"]`);
    if (errorEl) {
        errorEl.innerHTML = '';
    }
}

function showCreateServerModal() {
    showModal('createServerModal');
}

function showBrowseServersModal() {
    showModal('browseServersModal');
    loadPublicServers();
}

function showCreateRoomModal() {
    if (!currentServer) {
        showToast('Please select a server first', 'error');
        return;
    }
    showModal('createRoomModal');
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
