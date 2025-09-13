// app.js - Complete working version with all functions including enhanced admin
// Main application logic with theme support and all render functions

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
let currentTheme = localStorage.getItem('selectedTheme') || 'github-dark';

// Admin state variables
let adminCurrentTab = 'overview';
let adminStats = null;
let pendingUsersList = [];
let allUsersList = [];
let allCommunitiesList = [];

// Mock secure API if not available
if (typeof secureAPI === 'undefined') {
    window.secureAPI = {
        loadUserData: async () => null,
        getCommunities: async () => [],
        getPosts: async () => [],
        loadFollowedCommunities: async () => { followedCommunities = new Set(); },
        getAdminStats: async () => ({ success: true, stats: { totalUsers: 0, pendingUsers: 0, totalPosts: 0, totalCommunities: 0 } }),
        getPendingUsers: async () => ({ success: true, pendingUsers: [] }),
        getAllUsers: async () => ({ success: true, users: [] }),
        followCommunity: async (name) => ({ success: true, following: true }),
        unfollowCommunity: async (name) => ({ success: true, following: false }),
        createCommunity: async (data) => ({ success: true }),
        createPost: async (data) => ({ success: true }),
        deletePost: async (id) => ({ success: true }),
        createReply: async (postId, content) => ({ success: true }),
        deleteReply: async (postId, replyId) => ({ success: true }),
        updateProfile: async (data) => ({ success: true }),
        login: async (data) => ({ success: false, error: 'Mock API - Please implement real authentication' }),
        register: async (data) => ({ success: false, error: 'Mock API - Please implement real authentication' }),
        logout: async () => ({ success: true }),
        clearAuthData: () => { currentUser = null; },
        approveUser: async (username, key) => ({ success: true }),
        rejectUser: async (username, key) => ({ success: true }),
        promoteToAdmin: async (username) => ({ success: true }),
        demoteFromAdmin: async (username) => ({ success: true }),
        deleteUser: async (username) => ({ success: true }),
        deleteCommunity: async (name) => ({ success: true })
    };
    console.warn('Using mock API - implement real API for production');
}

// Theme management
function applyTheme(themeName) {
    currentTheme = themeName;
    localStorage.setItem('selectedTheme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Update theme selector if it exists
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = themeName;
    }
}

function openSettingsModal() {
    // Update theme selector to current theme
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = currentTheme;
    }
    
    openModal('settingsModal');
}

function handleThemeChange(themeName) {
    applyTheme(themeName);
    showSuccessMessage(`Theme changed to ${getThemeDisplayName(themeName)}`);
}

function getThemeDisplayName(themeName) {
    const themes = {
        'github-dark': 'GitHub Dark',
        'github-light': 'GitHub Light',
        'solarized-dark': 'Solarized Dark',
        'solarized-light': 'Solarized Light',
        'nord': 'Nord',
        'dracula': 'Dracula',
        'gruvbox-dark': 'Gruvbox Dark',
        'gruvbox-light': 'Gruvbox Light',
        'sepia': 'Sepia (Eye Comfort)',
        'high-contrast': 'High Contrast'
    };
    return themes[themeName] || themeName;
}

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
        // Update menu for logged-in user
        menuHeader.innerHTML = `
            <div class="menu-user-info">
                <div class="profile-avatar">${currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}</div>
                <div class="menu-user-details">
                    <h4>@${escapeHtml(currentUser.username || 'user')}</h4>
                    <p>${currentUser.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                </div>
            </div>
        `;
        
        // Show authenticated menu items
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
        // Show login prompt for non-authenticated users
        menuHeader.innerHTML = `
            <div class="login-prompt">
                <div class="login-prompt-title">Welcome to The Shed</div>
                <button class="login-toggle-btn" onclick="openAuthModal('signin')">Login</button>
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
    openSettingsModal();
}

function navigateToCommunity(communityName) {
    console.log('navigateToCommunity called with:', communityName);
    
    const community = communities.find(c => c.name === communityName);
    if (!community) {
        console.error('Community not found:', communityName);
        showSuccessMessage('Community not found');
        return;
    }
    
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

// Render functions for different pages
function renderFeedWithTabs() {
    const feedContent = currentUser ? 
        `<div class="loading">Loading ${currentFeedTab} feed...</div>` :
        `<div class="login-required">
            <div class="login-required-icon">🔒</div>
            <h2>Log in to view feed</h2>
            <p>You need to be signed in to view posts and interact with the community.</p>
            <div class="login-required-buttons">
                <button class="login-required-btn" onclick="openAuthModal('signin')">
                    <span>🚪</span>
                    <span>Sign In</span>
                </button>
                <button class="login-required-btn secondary" onclick="openAuthModal('signup')">
                    <span>✨</span>
                    <span>Sign Up</span>
                </button>
            </div>
        </div>`;
    
    document.getElementById('feed').innerHTML = feedContent;
}

function renderCommunityPage() {
    if (!currentCommunity) {
        document.getElementById('feed').innerHTML = '<div class="empty-state"><p>No community selected</p></div>';
        return;
    }
    
    const community = communities.find(c => c.name === currentCommunity);
    const communityPosts = posts.filter(p => p.communityName === currentCommunity);
    
    document.getElementById('feed').innerHTML = `
        <div class="community-header">
            <div class="community-hero">
                <div class="community-avatar">
                    ${community ? community.displayName.charAt(0).toUpperCase() : 'C'}
                </div>
                <div class="community-info">
                    <h1 class="community-title">${community ? escapeHtml(community.displayName) : currentCommunity}</h1>
                    <p class="community-handle">c/${escapeHtml(currentCommunity)}</p>
                    ${community && community.description ? `<p class="community-description">${escapeHtml(community.description)}</p>` : ''}
                </div>
                <div class="community-actions">
                    ${currentUser ? 
                        `<button class="btn" onclick="toggleCommunityFollow('${currentCommunity}')">+ Follow</button>` :
                        `<button class="btn" onclick="openAuthModal('signin')">+ Follow (Sign In)</button>`
                    }
                </div>
            </div>
            <div class="community-stats">
                <div class="stat-item">
                    <span class="stat-number">${communityPosts.length}</span>
                    <span class="stat-label">posts</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item">
                    <span class="stat-number">${community?.members?.length || 1}</span>
                    <span class="stat-label">members</span>
                </div>
            </div>
        </div>
        <div class="posts-list">
            ${communityPosts.length > 0 ? 
                communityPosts.map(post => renderPostCard(post)).join('') :
                '<div class="empty-state"><p>No posts in this community yet!</p></div>'
            }
        </div>
    `;
}

function renderProfilePage() {
    if (!currentUser) {
        document.getElementById('feed').innerHTML = `
            <div class="login-required">
                <h2>Sign in to view your profile</h2>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        return;
    }
    
    const userPosts = posts.filter(p => p.author === currentUser.username);
    
    document.getElementById('feed').innerHTML = `
        <div class="profile-page">
            <div class="profile-header">
                <div class="profile-hero">
                    <div class="profile-picture-container">
                        <div class="profile-avatar" style="width: 120px; height: 120px; font-size: 48px;">
                            ${currentUser.username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div class="profile-info">
                        <h1 class="profile-username">@${escapeHtml(currentUser.username)}</h1>
                        ${currentUser.profile?.isAdmin ? '<div class="admin-badge">👑 Administrator</div>' : ''}
                        <p class="profile-bio">${escapeHtml(currentUser.profile?.bio || 'No bio yet.')}</p>
                    </div>
                    <div class="profile-actions">
                        <button class="btn" onclick="openModal('editProfileModal')">✏️ Edit Profile</button>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-number">${userPosts.length}</span>
                        <span class="stat-label">posts</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-number">${followedCommunities.size}</span>
                        <span class="stat-label">following</span>
                    </div>
                </div>
            </div>
            <div class="profile-content">
                <h3 style="margin: 20px 0;">Your Posts</h3>
                ${userPosts.length > 0 ?
                    userPosts.map(post => renderPostCard(post)).join('') :
                    '<div class="empty-state"><p>You haven\'t created any posts yet.</p></div>'
                }
            </div>
        </div>
    `;
}

function renderMyShedPage() {
    if (!currentUser) {
        document.getElementById('feed').innerHTML = `
            <div class="login-required">
                <h2>Sign in to view your shed</h2>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        return;
    }
    
    const privatePosts = posts.filter(p => p.isPrivate && p.author === currentUser.username);
    
    document.getElementById('feed').innerHTML = `
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">🏠</span>
                <div>
                    <h1 style="color: var(--fg-default); margin: 0 0 4px 0; font-size: 28px;">My Shed</h1>
                    <p style="color: var(--fg-muted); margin: 0; font-size: 16px;">Your private posts and personal content</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; padding-top: 16px; border-top: 1px solid var(--border-default);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px; font-weight: 600; color: var(--accent-fg);">${privatePosts.length}</span>
                    <span style="color: var(--fg-muted); font-size: 14px;">private ${privatePosts.length === 1 ? 'post' : 'posts'}</span>
                </div>
            </div>
        </div>
        ${privatePosts.length > 0 ?
            privatePosts.map(post => renderPostCard(post)).join('') :
            '<div class="empty-state"><p>No private posts yet. Create a private post to get started!</p></div>'
        }
    `;
}

// ==============================================
// ADMIN FUNCTIONALITY - ENHANCED VERSION
// ==============================================

// Admin tab switching
async function switchAdminTab(tabName) {
    adminCurrentTab = tabName;
    
    // Update active tab button
    document.querySelectorAll('[data-tab]').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.className = 'btn';
        } else {
            btn.className = 'btn btn-secondary';
        }
    });
    
    // Update content
    const adminContent = document.getElementById('adminTabContent');
    if (adminContent) {
        adminContent.innerHTML = renderAdminTabContent();
    }
    
    // Load data for the selected tab
    switch(tabName) {
        case 'pending':
            await loadPendingUsers();
            break;
        case 'users':
            await loadAllUsers();
            break;
        case 'communities':
            await loadAllCommunities();
            break;
        case 'overview':
        default:
            await loadAdminStatsData();
            break;
    }
}

function renderAdminTabContent() {
    switch(adminCurrentTab) {
        case 'pending':
            return renderPendingUsersTab();
        case 'users':
            return renderUsersTab();
        case 'communities':
            return renderCommunitiesTab();
        case 'overview':
        default:
            return renderOverviewTab();
    }
}

// Admin Overview Tab
function renderOverviewTab() {
    return `
        <div class="admin-overview">
            <h3 style="color: var(--fg-default); margin-bottom: 20px;">System Overview</h3>
            
            <div class="admin-stats">
                <div class="admin-stat-card">
                    <div class="admin-stat-number" id="adminTotalUsers">${adminStats?.totalUsers || 0}</div>
                    <div class="admin-stat-label">Total Users</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number" id="adminPendingUsers">${adminStats?.pendingUsers || 0}</div>
                    <div class="admin-stat-label">Pending Approval</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number" id="adminTotalPosts">${adminStats?.totalPosts || 0}</div>
                    <div class="admin-stat-label">Total Posts</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number" id="adminTotalCommunities">${adminStats?.totalCommunities || 0}</div>
                    <div class="admin-stat-label">Communities</div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h4 style="color: var(--fg-default); margin-bottom: 16px;">Quick Actions</h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="btn" onclick="switchAdminTab('pending')">
                        ${adminStats?.pendingUsers > 0 ? '🔴' : '✅'} Review Pending Users (${adminStats?.pendingUsers || 0})
                    </button>
                    <button class="btn btn-secondary" onclick="loadAdminStatsData()">
                        🔄 Refresh Stats
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Pending Users Tab
function renderPendingUsersTab() {
    if (pendingUsersList.length === 0) {
        return `
            <div class="admin-empty-state" style="text-align: center; padding: 40px;">
                <span style="font-size: 48px;">✅</span>
                <h3 style="margin: 16px 0;">No Pending Users</h3>
                <p style="color: var(--fg-muted);">All user registrations have been processed!</p>
            </div>
        `;
    }
    
    return `
        <div class="admin-users-list">
            <h3 style="color: var(--fg-default); margin-bottom: 20px;">
                Pending Users (${pendingUsersList.length})
            </h3>
            ${pendingUsersList.map(user => `
                <div class="admin-user-card" style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="display: flex; gap: 12px;">
                            <div class="profile-avatar" style="width: 48px; height: 48px;">
                                ${user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600; color: var(--fg-default);">@${escapeHtml(user.username)}</div>
                                <div style="color: var(--fg-muted); font-size: 14px; margin: 4px 0;">
                                    ${user.email ? `📧 ${escapeHtml(user.email)}` : 'No email'} • 
                                    Registered ${formatTimestamp(user.createdAt)}
                                </div>
                                ${user.bio ? `<div style="color: var(--fg-default); margin-top: 8px;">${escapeHtml(user.bio)}</div>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn" style="background: var(--success-fg);" onclick="approveUser('${user.username}', '${user.key}')">
                                ✅ Approve
                            </button>
                            <button class="btn" style="background: var(--danger-fg);" onclick="rejectUser('${user.username}', '${user.key}')">
                                ❌ Reject
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Users Tab
function renderUsersTab() {
    return `
        <div class="admin-users-list">
            <h3 style="color: var(--fg-default); margin-bottom: 20px;">
                All Users (${allUsersList.length})
            </h3>
            ${allUsersList.map(user => `
                <div class="admin-user-card" style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="display: flex; gap: 12px;">
                            <div class="profile-avatar" style="width: 48px; height: 48px;">
                                ${user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600; color: var(--fg-default);">
                                    @${escapeHtml(user.username)}
                                    ${user.isAdmin ? '<span style="background: var(--accent-fg); color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">👑 Admin</span>' : ''}
                                    ${user.username === 'dumbass' ? '<span style="background: var(--danger-fg); color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">🔒 Protected</span>' : ''}
                                </div>
                                <div style="color: var(--fg-muted); font-size: 14px; margin: 4px 0;">
                                    Joined ${formatTimestamp(user.createdAt || user.approvedAt)} • 
                                    Last login: ${user.lastLogin ? formatTimestamp(user.lastLogin) : 'Never'}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${!user.isAdmin && user.username !== 'dumbass' ? `
                                <button class="btn btn-secondary" onclick="promoteToAdmin('${user.username}')">
                                    👑 Make Admin
                                </button>
                            ` : ''}
                            ${user.isAdmin && user.username !== 'dumbass' && user.username !== currentUser.username ? `
                                <button class="btn btn-secondary" onclick="demoteFromAdmin('${user.username}')">
                                    👤 Remove Admin
                                </button>
                            ` : ''}
                            ${user.username !== currentUser.username && user.username !== 'dumbass' ? `
                                <button class="btn" style="background: var(--danger-fg);" onclick="deleteUser('${user.username}')">
                                    🗑️ Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Communities Tab
function renderCommunitiesTab() {
    if (allCommunitiesList.length === 0) {
        return `
            <div class="admin-empty-state" style="text-align: center; padding: 40px;">
                <span style="font-size: 48px;">🏘️</span>
                <h3 style="margin: 16px 0;">No Communities Yet</h3>
                <p style="color: var(--fg-muted);">No communities have been created.</p>
            </div>
        `;
    }
    
    return `
        <div class="admin-communities-list">
            <h3 style="color: var(--fg-default); margin-bottom: 20px;">
                All Communities (${allCommunitiesList.length})
            </h3>
            ${allCommunitiesList.map(community => `
                <div class="admin-community-card" style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="display: flex; gap: 12px;">
                            <div class="profile-avatar" style="width: 48px; height: 48px;">
                                ${community.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600; color: var(--fg-default);">${escapeHtml(community.displayName)}</div>
                                <div style="color: var(--fg-muted); font-size: 14px; margin: 4px 0;">
                                    c/${escapeHtml(community.name)} • 
                                    Created by @${escapeHtml(community.createdBy)} • 
                                    ${formatTimestamp(community.createdAt)}
                                </div>
                                <div style="color: var(--accent-fg); font-size: 14px;">
                                    👥 ${community.members?.length || 1} members • 
                                    📝 ${community.postCount || 0} posts
                                </div>
                                ${community.description ? `<div style="color: var(--fg-default); margin-top: 8px;">${escapeHtml(community.description)}</div>` : ''}
                            </div>
                        </div>
                        <div>
                            <button class="btn" style="background: var(--danger-fg);" onclick="deleteCommunity('${community.name}')">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Admin API Calls
async function loadAdminStatsData() {
    if (!currentUser?.profile?.isAdmin) return;
    
    try {
        const response = await secureAPI.getAdminStats();
        if (response.success) {
            adminStats = response.stats;
            adminData = { userCount: response.stats.totalUsers, pendingCount: response.stats.pendingUsers };
            // Update display if we're on overview tab
            if (adminCurrentTab === 'overview') {
                const totalUsersEl = document.getElementById('adminTotalUsers');
                const pendingUsersEl = document.getElementById('adminPendingUsers');
                const totalPostsEl = document.getElementById('adminTotalPosts');
                const totalCommunitiesEl = document.getElementById('adminTotalCommunities');
                
                if (totalUsersEl) totalUsersEl.textContent = response.stats.totalUsers || 0;
                if (pendingUsersEl) pendingUsersEl.textContent = response.stats.pendingUsers || 0;
                if (totalPostsEl) totalPostsEl.textContent = response.stats.totalPosts || 0;
                if (totalCommunitiesEl) totalCommunitiesEl.textContent = response.stats.totalCommunities || 0;
            }
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

async function loadPendingUsers() {
    if (!currentUser?.profile?.isAdmin) return;
    
    try {
        const response = await secureAPI.getPendingUsers();
        console.log('loadPendingUsers response:', response);
        
        if (response && response.success) {
            pendingUsersList = response.pendingUsers || [];
            pendingUsersList.sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            console.log('Loaded', pendingUsersList.length, 'pending users');
            // Re-render the tab content
            const adminContent = document.getElementById('adminTabContent');
            if (adminContent) {
                adminContent.innerHTML = renderPendingUsersTab();
            }
        } else {
            console.error('Failed to load pending users');
            pendingUsersList = [];
            // Still render to show empty state
            const adminContent = document.getElementById('adminTabContent');
            if (adminContent) {
                adminContent.innerHTML = renderPendingUsersTab();
            }
        }
    } catch (error) {
        console.error('Error loading pending users:', error);
        pendingUsersList = [];
    }
}

async function loadAllUsers() {
    if (!currentUser?.profile?.isAdmin) return;
    
    try {
        const response = await secureAPI.getAllUsers();
        console.log('loadAllUsers response:', response);
        
        if (response && response.success) {
            allUsersList = response.users || [];
            allUsersList.sort((a, b) => 
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
            console.log('Loaded', allUsersList.length, 'users');
            // Re-render the tab content
            const adminContent = document.getElementById('adminTabContent');
            if (adminContent) {
                adminContent.innerHTML = renderUsersTab();
            }
        } else {
            console.error('Failed to load users');
            allUsersList = [];
            // Still render to show empty state
            const adminContent = document.getElementById('adminTabContent');
            if (adminContent) {
                adminContent.innerHTML = renderUsersTab();
            }
        }
    } catch (error) {
        console.error('Error loading all users:', error);
        allUsersList = [];
    }
}

async function loadAllCommunities() {
    if (!currentUser?.profile?.isAdmin) return;
    
    try {
        // Use the admin endpoint to get all communities
        const response = await tokenManager.makeRequest('/.netlify/functions/api/admin/communities', {
            method: 'GET'
        });
        
        console.log('loadAllCommunities response:', response);
        
        if (response && response.success) {
            allCommunitiesList = response.communities || [];
            allCommunitiesList.sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            console.log('Loaded', allCommunitiesList.length, 'communities');
            // Re-render the tab content
            const adminContent = document.getElementById('adminTabContent');
            if (adminContent) {
                adminContent.innerHTML = renderCommunitiesTab();
            }
        } else {
            console.error('Failed to load communities');
            allCommunitiesList = [];
            // Still render to show empty state
            const adminContent = document.getElementById('adminTabContent');
            if (adminContent) {
                adminContent.innerHTML = renderCommunitiesTab();
            }
        }
    } catch (error) {
        console.error('Error loading all communities:', error);
        allCommunitiesList = [];
    }
}

// Admin Actions
async function approveUser(username, pendingKey) {
    if (!currentUser?.profile?.isAdmin) return;
    
    if (!confirm(`Approve user @${username}?`)) return;
    
    try {
        const response = await secureAPI.approveUser(username, pendingKey);
        if (response.success) {
            showSuccessMessage('User approved successfully');
            await loadPendingUsers();
            await loadAdminStatsData();
        } else {
            showSuccessMessage(response.error || 'Failed to approve user');
        }
    } catch (error) {
        console.error('Error approving user:', error);
        showSuccessMessage('Failed to approve user');
    }
}

async function rejectUser(username, pendingKey) {
    if (!currentUser?.profile?.isAdmin) return;
    
    if (!confirm(`Reject user @${username}?`)) return;
    
    try {
        const response = await secureAPI.rejectUser(username, pendingKey);
        if (response.success) {
            showSuccessMessage('User rejected');
            await loadPendingUsers();
            await loadAdminStatsData();
        } else {
            showSuccessMessage(response.error || 'Failed to reject user');
        }
    } catch (error) {
        console.error('Error rejecting user:', error);
        showSuccessMessage('Failed to reject user');
    }
}

async function promoteToAdmin(username) {
    if (!currentUser?.profile?.isAdmin) return;
    
    if (!confirm(`Promote @${username} to admin?`)) return;
    
    try {
        const response = await secureAPI.promoteToAdmin(username);
        if (response.success) {
            showSuccessMessage(`${username} promoted to admin`);
            await loadAllUsers();
        } else {
            showSuccessMessage(response.error || 'Failed to promote user');
        }
    } catch (error) {
        console.error('Error promoting user:', error);
        showSuccessMessage('Failed to promote user');
    }
}

async function demoteFromAdmin(username) {
    if (!currentUser?.profile?.isAdmin) return;
    
    if (username === 'dumbass') {
        showSuccessMessage('Cannot demote protected admin');
        return;
    }
    
    if (!confirm(`Remove admin privileges from @${username}?`)) return;
    
    try {
        const response = await secureAPI.demoteFromAdmin(username);
        if (response.success) {
            showSuccessMessage(`Admin privileges removed from ${username}`);
            await loadAllUsers();
        } else {
            showSuccessMessage(response.error || 'Failed to demote user');
        }
    } catch (error) {
        console.error('Error demoting user:', error);
        showSuccessMessage('Failed to demote user');
    }
}

async function deleteUser(username) {
    if (!currentUser?.profile?.isAdmin) return;
    
    if (username === currentUser.username) {
        showSuccessMessage('Cannot delete your own account');
        return;
    }
    
    if (username === 'dumbass') {
        showSuccessMessage('Cannot delete protected admin');
        return;
    }
    
    if (!confirm(`⚠️ DELETE user @${username}?\n\nThis will permanently delete:\n• User account\n• All posts\n• All replies\n\nThis action cannot be undone!`)) return;
    
    try {
        const response = await secureAPI.deleteUser(username);
        if (response.success) {
            showSuccessMessage(`User ${username} deleted`);
            await loadAllUsers();
            await loadAdminStatsData();
        } else {
            showSuccessMessage(response.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showSuccessMessage('Failed to delete user');
    }
}

async function deleteCommunity(communityName) {
    if (!currentUser?.profile?.isAdmin) return;
    
    if (!confirm(`⚠️ DELETE community "${communityName}"?\n\nThis will permanently delete the community and all its posts.\n\nThis action cannot be undone!`)) return;
    
    try {
        const response = await secureAPI.deleteCommunity(communityName);
        if (response.success) {
            showSuccessMessage(`Community "${communityName}" deleted`);
            await loadAllCommunities();
            await loadAdminStatsData();
        } else {
            showSuccessMessage(response.error || 'Failed to delete community');
        }
    } catch (error) {
        console.error('Error deleting community:', error);
        showSuccessMessage('Failed to delete community');
    }
}

// Enhanced Admin Page Render
function renderAdminPage() {
    if (!currentUser || !currentUser.profile?.isAdmin) {
        document.getElementById('feed').innerHTML = `
            <div class="empty-state">
                <h3>Access Denied</h3>
                <p>You need administrator privileges to access this page.</p>
            </div>
        `;
        return;
    }
    
    // Initialize admin data if needed
    if (!adminCurrentTab) {
        adminCurrentTab = 'overview';
    }
    
    document.getElementById('feed').innerHTML = `
        <div class="admin-panel">
            <div class="admin-panel-header">
                <span>🛡️</span>
                <span>Admin Panel</span>
            </div>
            
            <!-- Admin Navigation Tabs -->
            <div style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--border-default); padding-bottom: 12px;">
                <button class="btn ${adminCurrentTab === 'overview' ? '' : 'btn-secondary'}" 
                        onclick="switchAdminTab('overview')" data-tab="overview">
                    📊 Overview
                </button>
                <button class="btn ${adminCurrentTab === 'pending' ? '' : 'btn-secondary'}" 
                        onclick="switchAdminTab('pending')" data-tab="pending">
                    ⏳ Pending Users ${adminStats?.pendingUsers > 0 ? '(' + adminStats.pendingUsers + ')' : ''}
                </button>
                <button class="btn ${adminCurrentTab === 'users' ? '' : 'btn-secondary'}" 
                        onclick="switchAdminTab('users')" data-tab="users">
                    👥 Manage Users
                </button>
                <button class="btn ${adminCurrentTab === 'communities' ? '' : 'btn-secondary'}" 
                        onclick="switchAdminTab('communities')" data-tab="communities">
                    🏘️ Manage Communities
                </button>
            </div>
            
            <!-- Tab Content -->
            <div id="adminTabContent">
                ${renderAdminTabContent()}
            </div>
        </div>
    `;
    
    // Load initial data for current tab
    switchAdminTab(adminCurrentTab);
}

// Helper function to render a post card
function renderPostCard(post) {
    return `
        <div class="post-card ${post.isPrivate ? 'private' : ''}">
            <div class="post-header">
                <div class="post-author">
                    <div class="post-avatar">
                        ${post.author ? post.author.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div class="post-meta">
                        <a href="#" class="post-username">@${escapeHtml(post.author || 'anonymous')}</a>
                        <div class="post-timestamp">${formatTimestamp(post.timestamp || new Date())}</div>
                    </div>
                </div>
                <div class="post-badges">
                    ${post.isPrivate ? '<span class="post-badge private">Private</span>' : ''}
                    ${post.type === 'link' ? '<span class="post-badge link">Link</span>' : ''}
                </div>
            </div>
            
            <div class="post-body">
                ${post.communityName ? `
                    <div class="post-community">
                        <a href="#" class="post-community-link" onclick="navigateToCommunity('${post.communityName}'); return false;">
                            c/${escapeHtml(post.communityName)}
                        </a>
                    </div>
                ` : ''}
                <h3 class="post-title">${escapeHtml(post.title || 'Untitled')}</h3>
                <div class="post-content">${escapeHtml(post.content || '')}</div>
            </div>
            
            <div class="post-actions">
                <button class="action-btn">
                    <span>⬆️</span>
                    <span>Vote</span>
                </button>
                <button class="action-btn">
                    <span>💬</span>
                    <span>${post.replies ? post.replies.length : 0}</span>
                </button>
                ${currentUser && (currentUser.username === post.author || currentUser.profile?.isAdmin) ? `
                    <button class="action-btn" onclick="deletePost('${post.id}')">
                        <span>🗑️</span>
                        <span>Delete</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Community follow function
async function toggleCommunityFollow(communityName) {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    if (followedCommunities.has(communityName)) {
        followedCommunities.delete(communityName);
        showSuccessMessage(`Unfollowed ${communityName}`);
    } else {
        followedCommunities.add(communityName);
        showSuccessMessage(`Now following ${communityName}!`);
    }
    
    renderCurrentPage();
}

// Data loading functions
async function loadUser() {
    try {
        currentUser = await secureAPI.loadUserData();
        if (currentUser) {
            await loadFollowedCommunities();
        }
    } catch (error) {
        console.error('Error loading user:', error);
        currentUser = null;
    }
}

async function loadCommunities() {
    try {
        communities = await secureAPI.getCommunities();
        console.log('Loaded communities:', communities.length);
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        posts = await secureAPI.getPosts({ includePrivate: currentUser ? true : false });
        console.log('Loaded posts:', posts.length);
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    }
}

async function loadFollowedCommunities() {
    try {
        if (currentUser) {
            await secureAPI.loadFollowedCommunities();
        } else {
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
            const response = await secureAPI.getAdminStats();
            if (response.success) {
                adminData = { userCount: response.stats.totalUsers, pendingCount: response.stats.pendingUsers };
                adminStats = response.stats;
                console.log('Loaded admin stats:', adminData);
            }
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Authentication functions
async function logout() {
    try {
        await secureAPI.logout();
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        secureAPI.clearAuthData();
        location.reload();
    }
}

function handleLogout() {
    logout();
    toggleMenu();
}

async function handleAuth(e) {
    e.preventDefault();
    
    const form = e.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;

    if (!username || !password) {
        showError('authError', 'Username and password are required');
        return;
    }

    try {
        const response = mode === 'signup' ? 
            await secureAPI.register({ username, password }) :
            await secureAPI.login({ username, password });
        
        if (response.success) {
            showSuccessMessage(mode === 'signup' ? 'Registration successful!' : 'Login successful!');
            closeModal('authModal');
            await loadUser();
            updateUI();
        } else {
            showError('authError', response.error || 'Authentication failed');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('authError', error.message || 'Authentication failed');
    }
}

async function handleCreateCommunity(e) {
    e.preventDefault();
    
    const name = document.getElementById('communityName')?.value?.trim();
    const displayName = document.getElementById('communityDisplayName')?.value?.trim();
    const description = document.getElementById('communityDescription')?.value?.trim();
    
    if (!name || !displayName) {
        showSuccessMessage('Community name and display name are required');
        return;
    }
    
    // Add to local communities for demo
    communities.push({
        name,
        displayName,
        description,
        createdBy: currentUser?.username || 'anonymous',
        createdAt: new Date().toISOString(),
        members: [currentUser?.username || 'anonymous']
    });
    
    showSuccessMessage('Community created successfully!');
    closeModal('createCommunityModal');
    updateCommunitiesInMenu();
    navigateToCommunity(name);
}

async function handleCreatePost(e) {
    e.preventDefault();
    
    const title = document.getElementById('postTitle')?.value?.trim();
    const content = document.getElementById('postContent')?.value?.trim();
    const communityName = document.getElementById('postCommunity')?.value;
    const isPrivate = document.getElementById('isPrivate')?.checked || false;
    
    if (!title) {
        showSuccessMessage('Post title is required');
        return;
    }
    
    // Add to local posts for demo
    posts.unshift({
        id: Date.now().toString(),
        title,
        content,
        type: currentPostType,
        communityName: communityName || null,
        isPrivate,
        author: currentUser?.username || 'anonymous',
        timestamp: new Date().toISOString(),
        replies: []
    });
    
    showSuccessMessage('Post created successfully!');
    closeModal('composeModal');
    renderCurrentPage();
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    
    const bio = document.getElementById('editProfileBio')?.value?.trim();
    
    if (currentUser) {
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.bio = bio;
    }
    
    showSuccessMessage('Profile updated successfully!');
    closeModal('editProfileModal');
    renderCurrentPage();
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }
    
    posts = posts.filter(p => p.id !== postId);
    showSuccessMessage('Post deleted successfully');
    renderCurrentPage();
}

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="error-message">${message}</div>`;
        element.style.display = 'block';
    }
}

function showSuccessMessage(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    } else {
        console.log('Success:', message);
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleAuthMode() {
    const form = document.getElementById('authForm');
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const toggleBtn = document.getElementById('authToggleBtn');
    const bioGroup = document.getElementById('bioGroup');
    const emailGroup = document.getElementById('emailGroup');
    
    if (form.dataset.mode === 'signin') {
        form.dataset.mode = 'signup';
        title.textContent = 'Sign Up';
        submitBtn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Sign In';
        if (bioGroup) bioGroup.style.display = 'block';
        if (emailGroup) emailGroup.style.display = 'block';
    } else {
        form.dataset.mode = 'signin';
        title.textContent = 'Sign In';
        submitBtn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
        if (bioGroup) bioGroup.style.display = 'none';
        if (emailGroup) emailGroup.style.display = 'none';
    }
}

function openAuthModal(mode) {
    const form = document.getElementById('authForm');
    if (form) {
        form.dataset.mode = mode;
        if (mode === 'signup') {
            const bioGroup = document.getElementById('bioGroup');
            const emailGroup = document.getElementById('emailGroup');
            if (bioGroup) bioGroup.style.display = 'block';
            if (emailGroup) emailGroup.style.display = 'block';
            document.getElementById('authTitle').textContent = 'Sign Up';
            document.getElementById('authSubmitBtn').textContent = 'Sign Up';
            document.getElementById('authToggleText').textContent = 'Already have an account?';
            document.getElementById('authToggleBtn').textContent = 'Sign In';
        }
    }
    openModal('authModal');
}

function setPostType(type) {
    currentPostType = type;
    
    const textFields = document.getElementById('textPostFields');
    const linkFields = document.getElementById('linkPostFields');
    
    if (type === 'text') {
        textFields.style.display = 'block';
        linkFields.style.display = 'none';
    } else {
        textFields.style.display = 'none';
        linkFields.style.display = 'block';
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
    
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleUpdateProfile);
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

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    // Apply saved theme
    applyTheme(currentTheme);
    
    // Load app data
    await loadUser();
    await loadCommunities();
    await loadPosts();
    
    // Update community dropdown for compose modal
    const postCommunitySelect = document.getElementById('postCommunity');
    if (postCommunitySelect && communities.length > 0) {
        communities.forEach(community => {
            const option = document.createElement('option');
            option.value = community.name;
            option.textContent = community.displayName;
            postCommunitySelect.appendChild(option);
        });
    }
    
    updateUI();
    setupEventListeners();
    
    // Load admin stats if user is admin
    if (currentUser?.profile?.isAdmin) {
        await loadAdminStats();
    }
    
    console.log('App initialized successfully');
});
