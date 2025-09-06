// app.js - Main application logic and initialization - Updated to remove c/ prefix

// App state - ALL VARIABLES DECLARED ONCE HERE
let currentUser = null;
let currentPage = 'feed';
let communities = [];
let posts = [];
let currentCommunity = null;
let isLoading = false;
let adminData = null;
let currentPostType = 'text';
let inlineLoginFormOpen = false;
let currentFeedTab = 'general';
let followedCommunities = new Set();

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
        setTimeout(() => {
            const usernameField = document.getElementById('inlineUsername');
            if (usernameField) usernameField.focus();
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
        dropdown.innerHTML = communities.map(community => `
            <a href="#" class="community-item" onclick="navigateToCommunity('${community.name}'); return false;">
                ${escapeHtml(community.displayName || community.name)}
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

function navigateToMyShed() {
    toggleMenu();
    currentPage = 'myshed';
    updateActiveMenuItem('menuMyShed');
    updateUI();
}

function navigateToAdmin() {
    toggleMenu();
    currentPage = 'admin';
    updateActiveMenuItem('menuAdmin');
    updateUI();
}

function navigateToSettings() {
    toggleMenu();
    showSuccessMessage('Settings page coming soon!');
}

function navigateToCommunity(communityName) {
    console.log('navigateToCommunity called with:', communityName);
    
    const community = communities.find(c => c.name === communityName);
    if (!community) {
        console.error('Community not found:', communityName);
        showSuccessMessage('Community not found');
        return;
    }
    
    console.log('Found community, navigating to:', community.displayName || community.name);
    
    if (document.getElementById('slideMenu').classList.contains('open')) {
        toggleMenu();
    }
    
    currentPage = 'community';
    currentCommunity = communityName;
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    updateUI();
}

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
    const activeElement = document.getElementById(activeId);
    if (activeElement) {
        activeElement.classList.add('active');
    }
}

// Feed Tab Functions
function switchFeedTab(tabName) {
    if (tabName !== 'general' && tabName !== 'followed') {
        console.warn('Invalid tab name:', tabName);
        return;
    }
    
    currentFeedTab = tabName;
    
    document.querySelectorAll('.feed-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    renderCurrentPage();
}

function updateFeedTabsVisibility() {
    const feedTabs = document.getElementById('feedTabs');
    if (!feedTabs) return;
    
    if (currentPage === 'feed' && currentUser) {
        feedTabs.style.display = 'flex';
        const followedTab = document.getElementById('followedTab');
        if (followedTab) {
            followedTab.disabled = false;
        }
    } else {
        feedTabs.style.display = 'none';
    }
}

// Community follow function
async function toggleCommunityFollow(communityName) {
    console.log('toggleCommunityFollow called for:', communityName);
    
    if (!currentUser) {
        console.log('Not authenticated, opening auth modal');
        openAuthModal('signin');
        return;
    }

    const followBtn = document.getElementById(`followBtn-${communityName}`);
    if (!followBtn) {
        console.error('Follow button not found for community:', communityName);
        return;
    }
    
    const originalText = followBtn.textContent;
    const wasFollowing = followBtn.classList.contains('btn-secondary');
    
    try {
        followBtn.disabled = true;
        followBtn.textContent = 'Loading...';
        
        const response = await toggleFollowStatus(communityName, !wasFollowing);
        
        if (response.success) {
            if (response.following) {
                followBtn.textContent = '✓ Following';
                followBtn.className = 'btn btn-secondary';
                showSuccessMessage(`Now following ${communityName}! 🎉`);
            } else {
                followBtn.textContent = '+ Follow';
                followBtn.className = 'btn';
                showSuccessMessage(`Unfollowed ${communityName}`);
            }
        } else {
            throw new Error(response.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Error toggling follow status:', error);
        followBtn.textContent = originalText;
        
        if (wasFollowing) {
            followBtn.className = 'btn btn-secondary';
        } else {
            followBtn.className = 'btn';
        }
        
        showSuccessMessage(error.message || 'Failed to update follow status. Please try again.');
    } finally {
        followBtn.disabled = false;
    }
}

// UI update functions
function updateUI() {
    updateComposeButton();
    updateFeedTabsVisibility();
    renderCurrentPage();
}

function updateComposeButton() {
    const composeBtn = document.getElementById('composeBtn');
    if (composeBtn) {
        composeBtn.style.display = currentUser ? 'block' : 'none';
    }
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

// Event listeners setup
function setupEventListeners() {
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
    
    const createCommunityForm = document.getElementById('createCommunityForm');
    if (createCommunityForm) {
        createCommunityForm.addEventListener('submit', handleCreateCommunity);
    }
    
    const composeForm = document.getElementById('composeForm');
    if (composeForm) {
        composeForm.addEventListener('submit', handleCreatePost);
    }
    
    const urlInput = document.getElementById('postUrl');
    if (urlInput) {
        let previewTimeout;
        urlInput.addEventListener('input', (e) => {
            clearTimeout(previewTimeout);
            const url = e.target.value.trim();
            
            if (url && url.length > 10) {
                previewTimeout = setTimeout(() => {
                    previewMedia(url);
                }, 1000);
            } else {
                const preview = document.getElementById('mediaPreview');
                if (preview) {
                    preview.innerHTML = '';
                }
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('slideMenu');
        const menuToggle = document.getElementById('menuToggle');
        
        if (menu && menuToggle && menu.classList.contains('open') && 
            !menu.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            toggleMenu();
        }
    });
}

// Data loading functions using secure API
async function loadUser() {
    try {
        if (typeof secureAPI !== 'undefined') {
            currentUser = await secureAPI.loadUserData();
            if (currentUser) {
                await loadFollowedCommunities();
            }
        } else {
            // Fallback to localStorage
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                currentUser = JSON.parse(storedUser);
            }
        }
    } catch (error) {
        console.error('Error loading user:', error);
        currentUser = null;
    }
}

async function loadCommunities() {
    try {
        const response = await fetch('/.netlify/functions/blobs?list=true&prefix=community_');
        if (response.ok) {
            const data = await response.json();
            communities = data.keys ? data.keys.map(key => ({ 
                name: key.replace('community_', ''),
                displayName: key.replace('community_', '').charAt(0).toUpperCase() + key.replace('community_', '').slice(1)
            })) : [];
        }
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        const response = await fetch('/.netlify/functions/blobs?list=true&prefix=post_');
        if (response.ok) {
            const data = await response.json();
            posts = [];
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    }
}

async function loadFollowedCommunities() {
    try {
        if (currentUser) {
            followedCommunities = new Set();
        }
    } catch (error) {
        console.error('Error loading followed communities:', error);
        followedCommunities = new Set();
    }
}

async function loadAdminStats() {
    try {
        if (currentUser?.profile?.isAdmin) {
            console.log('Loading admin stats...');
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Authentication functions using secure API
async function logout() {
    try {
        if (typeof secureAPI !== 'undefined') {
            await secureAPI.logout();
        } else {
            // Fallback if secureAPI not available
            currentUser = null;
            localStorage.removeItem('currentUser');
        }
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        // Force logout even if API fails
        currentUser = null;
        localStorage.removeItem('currentUser');
        location.reload();
    }
}

async function handleAuth(e) {
    e.preventDefault();
    
    if (typeof secureAPI === 'undefined') {
        showError('authError', 'Authentication system not loaded');
        return;
    }
    
    const form = e.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;
    const bio = document.getElementById('bio')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

    if (!username || !password) {
        showError('authError', 'Username and password are required');
        return;
    }

    try {
        const submitBtn = document.getElementById('authSubmitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        if (mode === 'signup') {
            const response = await secureAPI.register({ username, password, bio, email, rememberMe });
            if (response.success) {
                showSuccessMessage('Registration submitted for admin approval!');
                closeModal('authModal');
                form.reset();
            } else {
                showError('authError', response.error || 'Registration failed');
            }
        } else {
            const response = await secureAPI.login({ username, password, rememberMe });
            if (response.success) {
                showSuccessMessage('Login successful!');
                closeModal('authModal');
                form.reset();
                // Reload user data and refresh UI
                await loadUser();
                updateUI();
            } else {
                showError('authError', response.error || 'Login failed');
            }
        }

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
    } catch (error) {
        console.error('Auth error:', error);
        showError('authError', error.message || 'Authentication failed');
        
        const submitBtn = document.getElementById('authSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
        }
    }
}

async function handleInlineLogin(e) {
    e.preventDefault();
    
    if (typeof secureAPI === 'undefined') {
        showError('inlineLoginError', 'Authentication system not loaded');
        return;
    }

    const username = document.getElementById('inlineUsername')?.value?.trim();
    const password = document.getElementById('inlinePassword')?.value;

    if (!username || !password) {
        showError('inlineLoginError', 'Username and password are required');
        return;
    }

    try {
        const submitBtn = document.getElementById('inlineLoginBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';

        const response = await secureAPI.login({ username, password, rememberMe: false });
        
        if (response.success) {
            showSuccessMessage('Login successful!');
            // Reload user data and refresh UI
            await loadUser();
            updateUI();
            toggleMenu(); // Close the menu
        } else {
            showError('inlineLoginError', response.error || 'Login failed');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
    } catch (error) {
        console.error('Inline login error:', error);
        showError('inlineLoginError', error.message || 'Login failed');
        
        const submitBtn = document.getElementById('inlineLoginBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    }
}

function handleCreateCommunity(e) {
    e.preventDefault();
    console.log('Create community handler called');
    showSuccessMessage('Community creation coming soon!');
}

function handleCreatePost(e) {
    e.preventDefault();
    console.log('Create post handler called');
    showSuccessMessage('Post creation coming soon!');
}

function toggleFollowStatus(communityName, follow) {
    return Promise.resolve({ success: true, following: follow, memberCount: 1 });
}

function checkIfFollowing(communityName) {
    return Promise.resolve(false);
}

// Placeholder rendering functions
function renderFeedWithTabs() {
    const feed = document.getElementById('feed');
    if (feed) {
        feed.innerHTML = '<div class="loading">Feed loading...</div>';
    }
}

function renderCommunityPage() {
    const feed = document.getElementById('feed');
    if (feed) {
        feed.innerHTML = '<div class="loading">Community loading...</div>';
    }
}

function renderProfilePage() {
    const feed = document.getElementById('feed');
    if (feed) {
        feed.innerHTML = '<div class="loading">Profile loading...</div>';
    }
}

function renderMyShedPage() {
    const feed = document.getElementById('feed');
    if (feed) {
        feed.innerHTML = '<div class="loading">My Shed loading...</div>';
    }
}

function renderAdminPage() {
    const feed = document.getElementById('feed');
    if (feed) {
        feed.innerHTML = '<div class="loading">Admin page loading...</div>';
    }
}

function previewMedia(url) {
    console.log('Preview media:', url);
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    // Configure marked.js for markdown rendering - SIMPLIFIED VERSION
    if (typeof marked !== 'undefined') {
        try {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            console.log('Marked.js configured successfully');
        } catch (error) {
            console.error('Error configuring marked.js:', error);
        }
    } else {
        console.warn('Marked.js library not loaded');
    }
    
    // Load app data
    await loadUser();
    await loadCommunities();
    await loadPosts();
    updateUI();
    setupEventListeners();
    
    // Load admin stats if user is admin
    if (currentUser?.profile?.isAdmin) {
        await loadAdminStats();
    }
    
    console.log('App initialized successfully');
});
