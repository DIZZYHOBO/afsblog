// app.js - Main application logic and initialization - Updated with Session Persistence Fix

// App state
let currentUser = null;
let currentPage = 'feed';
let communities = [];
let posts = [];
let currentCommunity = null;
let isLoading = false;
let adminData = null;
let currentPostType = 'text';
let inlineLoginFormOpen = false;
let currentFeedTab = 'general'; // Track current feed tab - only 'general' and 'followed' now
let followedCommunities = new Set(); // Track followed communities
let markdownRenderer = null;
let previewTimeout = null;

// blobAPI object for data operations
const blobAPI = {
    async get(key) {
        try {
            const response = await fetch(`/.netlify/functions/blobs?key=${encodeURIComponent(key)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error getting blob:', error);
            return null;
        }
    },
    
    async set(key, value) {
        try {
            const response = await fetch('/.netlify/functions/blobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error setting blob:', error);
            throw error;
        }
    },
    
    async list(prefix = '') {
        try {
            const response = await fetch(`/.netlify/functions/blobs?prefix=${encodeURIComponent(prefix)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.keys || [];
        } catch (error) {
            console.error('Error listing blobs:', error);
            return [];
        }
    },
    
    async delete(key) {
        try {
            const response = await fetch('/.netlify/functions/blobs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting blob:', error);
            throw error;
        }
    }
};

// Menu functions
function toggleMenu() {
    const menu = document.getElementById('slideMenu');
    const overlay = document.getElementById('menuOverlay');
    const isOpen = menu.classList.contains('open');
    
    if (isOpen) {
        menu.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        menu.classList.add('open');
        overlay.classList.add('active');
        updateMenuContent();
    }
}

function updateMenuContent() {
    const menuHeader = document.getElementById('menuHeader');
    const menuLogout = document.getElementById('menuLogout');
    
    if (currentUser) {
    // Update menu avatar to use profile picture
    if (currentUser.profile?.profilePicture) {
        menuHeader.innerHTML = `
            <div class="menu-user-info">
                <img src="${currentUser.profile.profilePicture}" 
                     alt="Profile" 
                     class="profile-avatar"
                     style="border-radius: 50%; object-fit: cover;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="profile-avatar" style="display: none;">${currentUser.username.charAt(0).toUpperCase()}</div>
                <div class="menu-user-details">
                    <h4>@${escapeHtml(currentUser.username)}</h4>
                    <p>${currentUser.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                </div>
            </div>
        `;
    } else {
        menuHeader.innerHTML = `
            <div class="menu-user-info">
                <div class="profile-avatar">${currentUser.username.charAt(0).toUpperCase()}</div>
                <div class="menu-user-details">
                    <h4>@${escapeHtml(currentUser.username)}</h4>
                    <p>${currentUser.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                </div>
            </div>
        `;
    }
        
        menuLogout.style.display = 'block';
    } else {
        menuHeader.innerHTML = `
            <div class="menu-guest-info">
                <div class="guest-avatar">?</div>
                <div class="guest-details">
                    <h4>Guest User</h4>
                    <p>Sign in to post and join communities</p>
                </div>
            </div>
        `;
        menuLogout.style.display = 'none';
    }
}

function showInlineLoginForm() {
    inlineLoginFormOpen = true;
    const menuContent = document.getElementById('menuContent');
    
    menuContent.innerHTML = `
        <div class="inline-login-form">
            <h3>Sign In</h3>
            <form id="inlineLoginFormElement">
                <div class="form-group">
                    <input type="text" id="inlineUsername" placeholder="Username" required>
                </div>
                <div class="form-group">
                    <input type="password" id="inlinePassword" placeholder="Password" required>
                </div>
                <div class="form-group">
                    <button type="submit" id="inlineLoginBtn" class="btn btn-primary">Sign In</button>
                </div>
            </form>
            <div id="inlineLoginError" class="error-message"></div>
            <div class="form-footer">
                <p>Don't have an account? <a href="#" onclick="openModal('authModal'); setAuthMode('signup'); toggleMenu();">Sign up</a></p>
                <p><a href="#" onclick="hideInlineLoginForm()">Cancel</a></p>
            </div>
        </div>
    `;
    
    // Add form submission handler
    document.getElementById('inlineLoginFormElement').addEventListener('submit', handleInlineLogin);
}

function hideInlineLoginForm() {
    inlineLoginFormOpen = false;
    updateMenuContent();
}

function showInlineError(message) {
    const errorDiv = document.getElementById('inlineLoginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Navigation functions
function navigateToFeed() {
    currentPage = 'feed';
    currentCommunity = null;
    updateUI();
    
    // Update URL without page reload
    history.pushState({page: 'feed'}, 'Feed', '/');
}

function navigateToCommunity(communityName) {
    currentPage = 'community';
    currentCommunity = communities.find(c => c.name === communityName);
    updateUI();
    
    // Update URL without page reload
    history.pushState({page: 'community', community: communityName}, `${communityName}`, `/${communityName}`);
}

function navigateToChat() {
    // Open chat in new tab/window
    window.open('/chat.html', '_blank');
}

function navigateToAdmin() {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Access denied. Admin privileges required.');
        return;
    }
    
    currentPage = 'admin';
    updateUI();
    
    // Update URL without page reload
    history.pushState({page: 'admin'}, 'Admin', '/admin');
}

// Authentication functions - UPDATED with session token storage
async function handleAuth(e, mode) {
    e.preventDefault();
    
    const username = document.getElementById(mode === 'signup' ? 'signupUsername' : 'signinUsername').value.trim();
    const password = document.getElementById(mode === 'signup' ? 'signupPassword' : 'signinPassword').value;
    const email = mode === 'signup' ? document.getElementById('signupEmail').value.trim() : '';
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const form = e.target;

    if (!username || !password || (mode === 'signup' && !email)) {
        showError('authError', 'Please fill in all fields');
        return;
    }

    if (username.length < 3) {
        showError('authError', 'Username must be at least 3 characters long');
        return;
    }

    if (password.length < 6) {
        showError('authError', 'Password must be at least 6 characters long');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'signup' ? 'Creating Account...' : 'Signing In...';
        
        if (mode === 'signup') {
            // SIGNUP MODE
            console.log('🔐 Attempting signup for user:', username);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username, 
                    email, 
                    password,
                    bio: `I'm ${username}` })
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Signup successful:', data);
                closeModal('authModal');
                showSuccess('authError', 'Registration submitted! Please wait for admin approval.');
            } else {
                console.error('❌ Signup failed:', data);
                showError('authError', data.error || 'Signup failed!');
            }
            
        } else {
            // LOGIN MODE - UPDATED with session token storage
            console.log('🔐 Attempting login for user:', username);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Login successful:', data);
                
                // 🚨 CRITICAL FIX: Store the session token in localStorage
                if (data.token) {
                    console.log('💾 Storing session token in localStorage...');
                    localStorage.setItem('sessionToken', data.token);
                    console.log('✅ Session token stored successfully');
                } else {
                    console.warn('⚠️ No token received from server');
                }
                
                // Set current user
                currentUser = data.user;
                currentUser.profile = data.user; // Ensure profile is available
                
                console.log('🎉 User authenticated:', currentUser.username);
                
                closeModal('authModal');
                updateUI();
                await loadData();
                showSuccess('authError', 'Login successful!');
                
                // Load user's followed communities after login
                await loadFollowedCommunities();
                
                // Load admin stats if user is admin
                if (currentUser?.profile?.isAdmin) {
                    await loadAdminStats();
                }
                
            } else {
                console.error('❌ Login failed:', data);
                showError('authError', data.error || 'Login failed!');
            }
        }
        
        form.reset();
        
    } catch (error) {
        console.error('🚨 Authentication error:', error);
        showError('authError', 'Network error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
    }
}

// UPDATED: handleInlineLogin function - now uses ONLY new authentication system
async function handleInlineLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('inlineUsername').value.trim();
    const password = document.getElementById('inlinePassword').value;
    const errorDiv = document.getElementById('inlineLoginError');
    const submitBtn = document.getElementById('inlineLoginBtn');

    errorDiv.innerHTML = '';
    
    if (username.length < 3) {
        showInlineError('Username must be at least 3 characters long');
        return;
    }
    
    if (password.length < 6) {
        showInlineError('Password must be at least 6 characters long');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        console.log('🔐 Attempting inline login for user:', username);
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('✅ Inline login successful:', data);
            
            // 🚨 CRITICAL: Store the session token in localStorage
            if (data.token) {
                console.log('💾 Storing session token in localStorage...');
                localStorage.setItem('sessionToken', data.token);
                console.log('✅ Session token stored successfully');
            } else {
                console.warn('⚠️ No token received from server');
            }
            
            // Set current user from API response
            currentUser = data.user;
            currentUser.profile = data.user; // Ensure profile is available
            
            console.log('🎉 User authenticated via inline login:', currentUser.username);
            
            // Load user's followed communities after login
            await loadFollowedCommunities();
            
            // Clear the form
            document.getElementById('inlineLoginFormElement').reset();
            
            // Close menu and update UI
            toggleMenu();
            updateUI();
            showSuccessMessage('Welcome back!');
            
            // Load admin stats if user is admin
            if (currentUser?.profile?.isAdmin) {
                await loadAdminStats();
            }
            
        } else {
            console.error('❌ Inline login failed:', data);
            showInlineError(data.error || 'Login failed!');
        }
        
    } catch (error) {
        console.error('🚨 Inline login error:', error);
        showError('inlineLoginError', 'Network error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
}

// Logout function - Updated to properly clear session token
async function logout() {
    console.log('🚪 Logging out user...');
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        if (token) {
            // Call the logout API to invalidate the session on the server
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('🚨 Logout API call failed:', error);
    }
    
    // Clear local session data
    localStorage.removeItem('sessionToken');
    currentUser = null;
    followedCommunities = new Set();
    
    console.log('✅ User logged out successfully');
    
    // Update UI and redirect to feed
    updateUI();
    navigateToFeed();
    showSuccessMessage('Logged out successfully!');
}

// Session validation function - Check if user has valid session on page load
async function validateSession() {
    const token = localStorage.getItem('sessionToken');
    
    if (!token) {
        console.log('🔍 No session token found');
        return false;
    }
    
    try {
        console.log('🔍 Validating existing session token...');
        
        const response = await fetch('/api/auth/validate', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Session token is valid');
            
            // 🚨 CRITICAL: Set the current user from the validated session
            currentUser = data.user;
            currentUser.profile = data.user; // Ensure profile is available
            
            console.log('🎉 User session restored:', currentUser.username);
            return true;
            
        } else {
            console.log('❌ Session token is invalid, removing...');
            localStorage.removeItem('sessionToken');
            currentUser = null;
            return false;
        }
    } catch (error) {
        console.error('🚨 Session validation error:', error);
        localStorage.removeItem('sessionToken');
        currentUser = null;
        return false;
    }
}

// Load user's followed communities
async function loadFollowedCommunities() {
    if (!currentUser) {
        followedCommunities = new Set();
        return;
    }
    
    try {
        console.log('📋 Loading followed communities for user:', currentUser.username);
        
        const response = await fetch('/api/user/followed-communities', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            followedCommunities = new Set(data.followedCommunities || []);
            console.log('✅ Loaded followed communities:', followedCommunities.size);
        } else {
            console.log('❌ Failed to load followed communities');
            followedCommunities = new Set();
        }
    } catch (error) {
        console.error('💥 Error loading followed communities:', error);
        followedCommunities = new Set();
    }
}

// Add localStorage monitoring to debug session storage
function setupSessionMonitoring() {
    console.log('🔍 Setting up session monitoring for main app...');
    
    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    
    localStorage.setItem = function(key, value) {
        console.log(`📝 MAIN APP localStorage.setItem("${key}", "${value?.substring(0, 50)}${value?.length > 50 ? '...' : ''}")`);
        
        if (key === 'sessionToken') {
            console.log('🎉 MAIN APP: SESSION TOKEN STORED!');
            console.log('Token value:', value?.substring(0, 30) + '...');
        }
        
        return originalSetItem.apply(this, arguments);
    };
    
    localStorage.removeItem = function(key) {
        console.log(`🗑️ MAIN APP localStorage.removeItem("${key}")`);
        
        if (key === 'sessionToken') {
            console.log('❌ MAIN APP: SESSION TOKEN REMOVED!');
        }
        
        return originalRemoveItem.apply(this, arguments);
    };
    
    console.log('✅ Session monitoring active in main app');
}

// Data loading functions
async function loadCommunities() {
    try {
        const communityKeys = await blobAPI.list('community_');
        const communityPromises = communityKeys.map(async (key) => {
            try {
                return await blobAPI.get(key);
            } catch (error) {
                console.error(`Error loading community ${key}:`, error);
                return null;
            }
        });
        
        const loadedCommunities = await Promise.all(communityPromises);
        communities = loadedCommunities
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Update community dropdown in compose modal
        updateCommunityDropdown();
        
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        if (!isLoading) {
            isLoading = true;
            updateFeedContent('<div class="loading">Loading...</div>');
        }
        
        const postKeys = await blobAPI.list('post_');
        const postPromises = postKeys.map(async (key) => {
            try {
                return await blobAPI.get(key);
            } catch (error) {
                console.error(`Error loading post ${key}:`, error);
                return null;
            }
        });
        
        const loadedPosts = await Promise.all(postPromises);
        posts = loadedPosts
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    } finally {
        isLoading = false;
    }
}

async function loadData() {
    // Wrapper function to load all data
    await loadCommunities();
    await loadPosts();
}

// Admin stats loading
async function loadAdminStats() {
    if (!currentUser?.profile?.isAdmin) return;
    
    try {
        console.log('📊 Loading admin statistics...');
        
        // Load pending users
        const pendingKeys = await blobAPI.list('pending_user_');
        const pendingUsers = [];
        for (const key of pendingKeys) {
            const user = await blobAPI.get(key);
            if (user) pendingUsers.push({...user, key});
        }
        
        // Load all users
        const userKeys = await blobAPI.list('user_');
        const allUsers = [];
        for (const key of userKeys) {
            const user = await blobAPI.get(key);
            if (user) allUsers.push(user);
        }
        
        // Calculate stats
        adminData = {
            totalUsers: allUsers.length,
            pendingUsers: pendingUsers.length,
            totalPosts: posts.length,
            totalCommunities: communities.length,
            pendingUsersList: pendingUsers,
            allUsersList: allUsers
        };
        
        console.log('✅ Admin stats loaded:', adminData);
        
        // Update admin UI if on admin page
        if (currentPage === 'admin') {
            updateAdminStatsDisplay();
        }
        
    } catch (error) {
        console.error('💥 Error loading admin stats:', error);
        adminData = null;
    }
}

function updateAdminStatsDisplay() {
    if (!adminData) return;
    
    const totalUsersEl = document.getElementById('totalUsers');
    const totalPostsEl = document.getElementById('totalPosts');
    const totalCommunitiesEl = document.getElementById('totalCommunities');
    
    if (totalUsersEl) totalUsersEl.textContent = adminData.totalUsers;
    if (totalPostsEl) totalPostsEl.textContent = adminData.totalPosts;
    if (totalCommunitiesEl) totalCommunitiesEl.textContent = adminData.totalCommunities;
}

// UI Update function
function updateUI() {
    updateHeader();
    updateMainContent();
    updateComposeButton();
}

function updateHeader() {
    const signInBtn = document.getElementById('signInBtn');
    const userMenu = document.getElementById('userMenu');
    const profileBtn = document.getElementById('profileBtn');
    
    if (currentUser) {
        signInBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        
        // Update profile button with user avatar
        if (currentUser.profile?.profilePicture) {
            profileBtn.innerHTML = `
                <img src="${currentUser.profile.profilePicture}" 
                     alt="Profile" 
                     class="profile-avatar"
                     style="border-radius: 50%; object-fit: cover;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="profile-avatar" style="display: none;">${currentUser.username.charAt(0).toUpperCase()}</div>
            `;
        } else {
            profileBtn.innerHTML = `<div class="profile-avatar">${currentUser.username.charAt(0).toUpperCase()}</div>`;
        }
    } else {
        signInBtn.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}

function updateMainContent() {
    const feedElement = document.getElementById('feed');
    
    switch (currentPage) {
        case 'feed':
            renderFeedPage();
            break;
        case 'community':
            renderCommunityPage();
            break;
        case 'admin':
            renderAdminPage();
            break;
        default:
            renderFeedPage();
            break;
    }
}

function updateComposeButton() {
    const composeBtn = document.getElementById('composeBtn');
    
    if (currentUser && (currentPage === 'feed' || currentPage === 'community')) {
        composeBtn.style.display = 'flex';
    } else {
        composeBtn.style.display = 'none';
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // Auto-focus first input
        const firstInput = modal.querySelector('input[type="text"], input[type="email"], textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        
        // Clear any error messages
        const errorElements = modal.querySelectorAll('.error-message, .success-message');
        errorElements.forEach(el => el.innerHTML = '');
        
        // Reset forms
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
    }
}

function setAuthMode(mode) {
    const authModal = document.getElementById('authModal');
    const signupForm = document.getElementById('signupForm');
    const signinForm = document.getElementById('signinForm');
    const authTitle = document.getElementById('authTitle');
    
    if (mode === 'signup') {
        authTitle.textContent = 'Sign Up';
        signupForm.style.display = 'block';
        signinForm.style.display = 'none';
    } else {
        authTitle.textContent = 'Sign In';
        signupForm.style.display = 'none';
        signinForm.style.display = 'block';
    }
}

// Message functions
function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message floating-message';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="error-message">${message}</div>`;
        element.style.display = 'block';
    }
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="success-message">${message}</div>`;
        element.style.display = 'block';
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return time.toLocaleDateString();
}

// Event listener setup
function setupEventListeners() {
    // Modal click-outside-to-close
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // URL preview for compose modal
    const urlInput = document.getElementById('postUrl');
    if (urlInput) {
        urlInput.addEventListener('input', (e) => {
            if (previewTimeout) {
                clearTimeout(previewTimeout);
            }
            
            const url = e.target.value.trim();
            
            if (url && url.length > 10) {
                previewTimeout = setTimeout(() => {
                    previewMedia(url);
                }, 1000); // Debounce for 1 second
            } else {
                const preview = document.getElementById('mediaPreview');
                if (preview) {
                    preview.innerHTML = '';
                }
            }
        });
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('slideMenu');
        const menuToggle = document.getElementById('menuToggle');
        
        if (menu.classList.contains('open') && 
            !menu.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            toggleMenu();
        }
    });
}

// Initialize app - FIXED VERSION
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Starting main app initialization...');
    
    // Set up session monitoring for debugging
    setupSessionMonitoring();
    
    // Configure marked.js for markdown rendering
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });
    
    // Custom renderer for enhanced features
    markdownRenderer = new marked.Renderer();
    
    // Custom link renderer to handle media embeds
    markdownRenderer.link = function(href, title, text) {
        const mediaHtml = renderMediaFromUrl(href);
        if (mediaHtml) return mediaHtml;
        
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
    };
    
    // Custom image renderer
    markdownRenderer.image = function(href, title, text) {
        return `<img src="${href}" alt="${text || 'Image'}" ${title ? `title="${title}"` : ''} onclick="openImageModal('${href}')" style="cursor: pointer;">`;
    };

    // 🚨 CRITICAL FIX: Properly validate session and restore user state
    console.log('🔍 Checking for existing session...');
    
    try {
        // First check if we have a session token
        const token = localStorage.getItem('sessionToken');
        
        if (token) {
            console.log('📱 Found session token, validating...');
            
            // Validate the session and restore user if valid
            const sessionValid = await validateSession();
            
            if (sessionValid && currentUser) {
                console.log('✅ Session restored successfully for user:', currentUser.username);
                
                // Load user's followed communities after successful session restore
                await loadFollowedCommunities();
                
                showSuccessMessage(`Welcome back, ${currentUser.username}!`);
            } else {
                console.log('❌ Session validation failed, user will need to log in');
                currentUser = null;
            }
        } else {
            console.log('🔍 No session token found, user will need to log in');
            currentUser = null;
        }
    } catch (error) {
        console.error('💥 Error during session restoration:', error);
        currentUser = null;
        // Clear potentially corrupted token
        localStorage.removeItem('sessionToken');
    }
    
    // Load data regardless of authentication status
    console.log('📊 Loading application data...');
    
    await loadCommunities();
    await loadPosts();
    
    // Update UI based on current authentication state
    updateUI();
    setupEventListeners();
    
    // Load admin stats if user is admin
    if (currentUser?.profile?.isAdmin) {
        console.log('👑 Loading admin interface...');
        await loadAdminStats();
    }
    
    console.log('✅ Main app initialization complete');
});
