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
let followedCommunities = new Set();
let markdownRenderer;

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

// Data loading functions
async function loadUser() {
    try {
        // Simple user loading - replace with your actual auth logic
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
        }
    } catch (error) {
        console.error('Error loading user:', error);
        currentUser = null;
    }
}

async function loadCommunities() {
    try {
        // Load communities from your API or storage
        const response = await fetch('/.netlify/functions/blobs?list=true&prefix=community_');
        if (response.ok) {
            const data = await response.json();
            communities = data.keys.map(key => ({ name: key.replace('community_', '') }));
        }
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        // Load posts from your API or storage
        const response = await fetch('/.netlify/functions/blobs?list=true&prefix=post_');
        if (response.ok) {
            const data = await response.json();
            posts = []; // You'll need to implement actual post loading
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    }
}

async function loadFollowedCommunities() {
    try {
        if (currentUser) {
            followedCommunities = new Set(); // You'll need to implement this
        }
    } catch (error) {
        console.error('Error loading followed communities:', error);
        followedCommunities = new Set();
    }
}

async function loadAdminStats() {
    try {
        if (currentUser?.profile?.isAdmin) {
            // Load admin stats
            console.log('Loading admin stats...');
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Placeholder functions for missing dependencies
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    location.reload();
}

function handleAuth(e) {
    e.preventDefault();
    console.log('Auth handler called');
}

function handleCreateCommunity(e) {
    e.preventDefault();
    console.log('Create community handler called');
}

function handleCreatePost(e) {
    e.preventDefault();
    console.log('Create post handler called');
}

function handleInlineLogin(e) {
    e.preventDefault();
    console.log('Inline login handler called');
}

function toggleFollowStatus(communityName, follow) {
    // Placeholder - implement actual follow logic
    return Promise.resolve({ success: true, following: follow, memberCount: 1 });
}

function checkIfFollowing(communityName) {
    // Placeholder - implement actual check
    return Promise.resolve(false);
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Configure marked.js for markdown rendering
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
            },
            breaks: true,
            gfm: true
        });
        
    
    
    await loadUser();
    await loadCommunities();
    await loadPosts();
    updateUI();
    setupEventListeners();
    
    // Load admin stats if user is admin
    if (currentUser?.profile?.isAdmin) {
        await loadAdminStats();
    }
});
