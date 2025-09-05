// app.js - Main application logic and initialization - Updated to remove c/ prefix

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
        
        // Show/hide menu items based on auth status
        document.getElementById('menuProfile').style.display = 'flex';
        document.getElementById('menuCreateCommunity').style.display = 'flex';
        document.getElementById('menuBrowseCommunities').style.display = 'flex';
        document.getElementById('menuSettings').style.display = 'flex';
        
        // Show admin menu item only for admins
        const menuAdmin = document.getElementById('menuAdmin');
        if (currentUser.profile?.isAdmin) {
            menuAdmin.style.display = 'flex';
        } else {
            menuAdmin.style.display = 'none';
        }
        
        menuLogout.style.display = 'flex';
        
        // Update communities dropdown
        updateCommunitiesInMenu();
    } else {
        menuHeader.innerHTML = `
            <div class="login-prompt">
                <div class="login-prompt-title">Click here to log in</div>
                <button class="login-toggle-btn" onclick="toggleInlineLoginForm()">Login</button>
                <div class="inline-login-form" id="inlineLoginForm">
                    <div id="inlineLoginError"></div>
                    <form id="inlineLoginFormElement" onsubmit="handleInlineLogin(event)">
                        <div class="inline-form-group">
                            <label for="inlineUsername">Username</label>
                            <input type="text" id="inlineUsername" required minlength="3" maxlength="20">
                        </div>
                        <div class="inline-form-group">
                            <label for="inlinePassword">Password</label>
                            <input type="password" id="inlinePassword" required minlength="6">
                        </div>
                        <div class="inline-form-buttons">
                            <button type="submit" class="inline-btn-primary" id="inlineLoginBtn">Sign In</button>
                            <button type="button" class="inline-btn-secondary" onclick="openAuthModal('signup'); toggleMenu();">Sign Up</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Hide authenticated menu items
        document.getElementById('menuProfile').style.display = 'none';
        document.getElementById('menuCreateCommunity').style.display = 'none';
        document.getElementById('menuBrowseCommunities').style.display = 'none';
        document.getElementById('menuAdmin').style.display = 'none';
        document.getElementById('menuSettings').style.display = 'none';
        menuLogout.style.display = 'none';
    }
}

function toggleInlineLoginForm() {
    const form = document.getElementById('inlineLoginForm');
    const isOpen = form.classList.contains('open');
    
    if (isOpen) {
        form.classList.remove('open');
        inlineLoginFormOpen = false;
    } else {
        form.classList.add('open');
        inlineLoginFormOpen = true;
        // Focus on username field
        setTimeout(() => {
            document.getElementById('inlineUsername').focus();
        }, 300);
    }
}

function handleLogout() {
    logout();
    toggleMenu();
}

function updateCommunitiesInMenu() {
    const dropdown = document.getElementById('communitiesDropdown');
    
    if (communities.length === 0) {
        dropdown.innerHTML = '<div class="community-item">No communities yet</div>';
    } else {
        // UPDATED: Removed "c/" prefix from menu items
        dropdown.innerHTML = communities.map(community => `
            <a href="#" class="community-item" onclick="navigateToCommunity('${community.name}'); return false;">
                ${escapeHtml(community.displayName)}
            </a>
        `).join('');
    }
}

function toggleCommunitiesDropdown() {
    const dropdown = document.getElementById('communitiesDropdown');
    const toggle = document.getElementById('communitiesToggle');
    const isOpen = dropdown.classList.contains('open');
    
    if (isOpen) {
        dropdown.classList.remove('open');
        toggle.textContent = '▼';
    } else {
        dropdown.classList.add('open');
        toggle.textContent = '▲';
    }
}

// Navigation functions
function navigateToFeed() {
    toggleMenu();
    currentPage = 'feed';
    updateActiveMenuItem('menuFeed');
    updateUI();
}

function navigateToProfile() {
    toggleMenu();
    currentPage = 'profile';
    updateActiveMenuItem('menuProfile');
    updateUI();
}

// NEW: Updated navigateToMyShed to show private posts instead of separate page
function navigateToMyShed() {
    toggleMenu();
    currentPage = 'myshed';
    updateActiveMenuItem('menuMyShed');
    updateUI();
}

// Add missing navigation functions
function navigateToAdmin() {
    toggleMenu();
    currentPage = 'admin';
    updateActiveMenuItem('menuAdmin');
    updateUI();
}

function navigateToSettings() {
    toggleMenu();
    // For now, just show a placeholder
    showSuccessMessage('Settings page coming soon!');
}

function navigateToCommunity(communityName) {
    console.log('navigateToCommunity called with:', communityName);
    
    // Find the community
    const community = communities.find(c => c.name === communityName);
    if (!community) {
        console.error('Community not found:', communityName);
        showSuccessMessage('Community not found');
        return;
    }
    
    console.log('Found community, navigating to:', community.displayName);
    
    // Close menu if open
    if (document.getElementById('slideMenu').classList.contains('open')) {
        toggleMenu();
    }
    
    // Set page state
    currentPage = 'community';
    currentCommunity = communityName;
    
    // Update active menu item - clear all active states for community navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Update UI
    updateUI();
}

// FIXED: Add the missing openCreate function
function openCreate() {
    openCreateCommunity();
}

function openCreateCommunity() {
    toggleMenu();
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    openModal('createCommunityModal');
}

function updateActiveMenuItem(activeId) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}

// Feed Tab Functions - Updated to only handle 'general' and 'followed'
function switchFeedTab(tabName) {
    // Only allow 'general' and 'followed' tabs now
    if (tabName !== 'general' && tabName !== 'followed') {
        console.warn('Invalid tab name:', tabName);
        return;
    }
    
    currentFeedTab = tabName;
    
    // Update tab visual states
    document.querySelectorAll('.feed-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Re-render the current page with new tab
    renderCurrentPage();
}

function updateFeedTabsVisibility() {
    const feedTabs = document.getElementById('feedTabs');
    // Show tabs only on feed page when user is logged in
    if (currentPage === 'feed' && currentUser) {
        feedTabs.style.display = 'flex';
        
        // Enable followed tab for logged in users
        const followedTab = document.getElementById('followedTab');
        followedTab.disabled = false;
    } else {
        // Hide tabs for all other pages including My Shed (since My Shed is now its own page)
        feedTabs.style.display = 'none';
    }
}

// FIXED: Improved toggleCommunityFollow function with real follow/unfollow logic
async function toggleCommunityFollow(communityName) {
    console.log('toggleCommunityFollow called for:', communityName);
    console.log('Current user:', currentUser);
    
    if (!currentUser) {
        console.log('Not authenticated, opening auth modal');
        openAuthModal('signin');
        return;
    }

    const followBtn = document.getElementById(`followBtn-${communityName}`);
    console.log('Follow button found:', followBtn);
    
    if (!followBtn) {
        console.error('Follow button not found for community:', communityName);
        return;
    }
    
    const originalText = followBtn.textContent;
    const wasFollowing = followBtn.classList.contains('btn-secondary');
    
    try {
        followBtn.disabled = true;
        followBtn.textContent = 'Loading...';
        
        console.log('Toggling follow status for community:', communityName);
        console.log('Was following:', wasFollowing, 'Will follow:', !wasFollowing);
        
        // Use real follow/unfollow logic
        const response = await toggleFollowStatus(communityName, !wasFollowing);
        
        if (response.success) {
            // Update button appearance
            if (response.following) {
                followBtn.textContent = '✓ Following';
                followBtn.className = 'btn btn-secondary';
                followBtn.style.cssText = 'padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
                showSuccessMessage(`Now following ${communityName}! 🎉`);
            } else {
                followBtn.textContent = '+ Follow';
                followBtn.className = 'btn';
                followBtn.style.cssText = 'padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
                showSuccessMessage(`Unfollowed ${communityName}`);
            }
            
            console.log(`Follow toggle successful. New member count: ${response.memberCount}`);
        } else {
            throw new Error(response.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Error toggling follow status:', error);
        followBtn.textContent = originalText;
        
        // Restore original button class
        if (wasFollowing) {
            followBtn.className = 'btn btn-secondary';
        } else {
            followBtn.className = 'btn';
        }
        followBtn.style.cssText = 'padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
        
        showSuccessMessage(error.message || 'Failed to update follow status. Please try again.');
    } finally {
        followBtn.disabled = false;
    }
}

function updateUI() {
    updateComposeButton();
    updateFeedTabsVisibility();
    renderCurrentPage();
}

function updateComposeButton() {
    const composeBtn = document.getElementById('composeBtn');
    composeBtn.style.display = currentUser ? 'block' : 'none';
}

function renderCurrentPage() {
    if (currentPage === 'feed') {
        renderFeedWithTabs();
    } else if (currentPage === 'community') {
        renderCommunityPage();
    } else if (currentPage === 'profile') {
        renderProfilePage();
    } else if (currentPage === 'myshed') {
        renderMyShedPage();
    } else if (currentPage === 'admin') {
        renderAdminPage();
    }
}

// ==============================================
// 🔧 AUTHENTICATION FUNCTIONS WITH SESSION TOKEN STORAGE
// ==============================================

// Authentication functions
async function handleAuth(e) {
    e.preventDefault();
    const form = e.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const bio = document.getElementById('bio').value.trim();
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');

    errorDiv.innerHTML = '';
    
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
        submitBtn.textContent = 'Loading...';

        if (mode === 'signup') {
            // SIGNUP MODE - uses new API
            console.log('🔐 Attempting signup for user:', username);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, bio: bio || `Hello! I'm ${username}` })
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

// Inline login form handler (used in menu)
async function handleInlineLogin(e) {
    e.preventDefault();
    const username = document.getElementById('inlineUsername').value.trim();
    const password = document.getElementById('inlinePassword').value;
    const errorDiv = document.getElementById('inlineLoginError');
    const submitBtn = document.getElementById('inlineLoginBtn');

    errorDiv.innerHTML = '';
    
    if (username.length < 3 || password.length < 6) {
        showError('inlineLoginError', 'Invalid username or password');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';

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
            
            console.log('🎉 User authenticated via inline login:', currentUser.username);
            
            // Close menu and update UI
            toggleMenu();
            updateUI();
            await loadData();
            
            // Load admin stats if user is admin
            if (currentUser?.profile?.isAdmin) {
                await loadAdminStats();
            }
            
        } else {
            console.error('❌ Inline login failed:', data);
            showError('inlineLoginError', data.error || 'Login failed!');
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
            
            currentUser = data.user;
            currentUser.profile = data.user; // Ensure profile is available
            
            console.log('🎉 User session restored:', currentUser.username);
            return true;
            
        } else {
            console.log('❌ Session token is invalid, removing...');
            localStorage.removeItem('sessionToken');
            return false;
        }
    } catch (error) {
        console.error('🚨 Session validation error:', error);
        localStorage.removeItem('sessionToken');
        return false;
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
// Add these missing functions to your app.js file
// (These are the data loading functions that were in api.js)

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

// You'll also need the blobAPI object - add this too:
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
            const response = await fetch(`/.netlify/functions/blobs?list=true&prefix=${encodeURIComponent(prefix)}`, {
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

function setupEventListeners() {
    // Auth form
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    
    // Create community form
    document.getElementById('createCommunityForm').addEventListener('submit', handleCreateCommunity);
    
    // Compose form
    document.getElementById('composeForm').addEventListener('submit', handleCreatePost);
    
    // URL input for media preview
    const urlInput = document.getElementById('postUrl');
    if (urlInput) {
        let previewTimeout;
        urlInput.addEventListener('input', (e) => {
            clearTimeout(previewTimeout);
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

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
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

    // Try to restore session on page load
    const sessionValid = await validateSession();
    
    await loadUser();
    await loadCommunities();
    await loadPosts();
    updateUI();
    setupEventListeners();
    
    // Load admin stats if user is admin
    if (currentUser?.profile?.isAdmin) {
        await loadAdminStats();
    }
    
    // Show session restoration message if applicable
    if (sessionValid) {
        console.log('✅ Session restored successfully on page load');
    }
});
