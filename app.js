// app.js - Complete Main Application Logic with All Functions and Fixes

// Global state variables
let currentUser = null;
let currentPage = 'feed';
let currentCommunityView = null;
let currentCommunity = null;
let posts = [];
let communities = [];
let isLoading = false;
let currentPostType = 'text';
let currentFeedTab = 'general';
let menuOpen = false;
let composeModal = null;
let createCommunityModal = null;
let authModal = null;
let communityDropdownOpen = false;
let inlineLoginFormOpen = false;

// Navigation functions
function navigateToFeed() {
    currentPage = 'feed';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

function navigateToCommunity(communityName) {
    currentPage = 'community';
    currentCommunityView = communityName;
    currentCommunity = communityName;
    updateUI();
}

function navigateToProfile() {
    currentPage = 'profile';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

function navigateToMyShed() {
    currentPage = 'myshed';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

function navigateToAdmin() {
    if (!currentUser || !currentUser.profile?.isAdmin) {
        showSuccessMessage('Admin access required');
        return;
    }
    currentPage = 'admin';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

function navigateToChat() {
    currentPage = 'chat';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

function navigateToBrowse() {
    currentPage = 'browse';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

function navigateToSettings() {
    currentPage = 'settings';
    currentCommunityView = null;
    currentCommunity = null;
    updateUI();
}

// Feed tab switching
function switchFeedTab(tabName) {
    currentFeedTab = tabName;
    updateFeedTabsVisibility();
    renderFeedWithTabs();
}

function updateFeedTabsVisibility() {
    const feedTabs = document.getElementById('feedTabs');
    if (!feedTabs) return;
    
    if (currentPage === 'feed' && currentUser) {
        feedTabs.style.display = 'flex';
        
        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const generalTab = document.getElementById('generalTab');
        const followedTab = document.getElementById('followedTab');
        
        if (currentFeedTab === 'general' && generalTab) {
            generalTab.classList.add('active');
        } else if (currentFeedTab === 'followed' && followedTab) {
            followedTab.classList.add('active');
        }
    } else {
        feedTabs.style.display = 'none';
    }
}

// Menu functions with null checks
function toggleMenu() {
    const menu = document.getElementById('slideMenu');
    const menuToggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('menuOverlay');
    
    if (!menu || !menuToggle) {
        console.error('Menu elements not found');
        return;
    }
    
    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        menuToggle.innerHTML = '☰';
        if (overlay) overlay.style.display = 'none';
        inlineLoginFormOpen = false;
        communityDropdownOpen = false;
    } else {
        menu.classList.add('open');
        menuToggle.innerHTML = '✕';
        if (overlay) overlay.style.display = 'block';
        updateMenuForUser();
        updateCommunitiesInMenu();
    }
}

// Update menu for user with comprehensive null checks
function updateMenuForUser() {
    const menuUserInfo = document.getElementById('menuUserInfo');
    const menuLogout = document.getElementById('menuLogout');
    const menuAdmin = document.getElementById('menuAdmin');
    
    if (!menuUserInfo) {
        console.error('Menu user info element not found');
        return;
    }
    
    if (currentUser) {
        menuUserInfo.innerHTML = `
            <div class="menu-user-details">
                <div class="menu-username">@${escapeHtml(currentUser.username)}</div>
                ${currentUser.profile?.isAdmin ? '<div class="menu-user-badge">Admin</div>' : ''}
            </div>
        `;
        
        // Show logged-in user menu items
        const menuFeed = document.getElementById('menuFeed');
        const menuChat = document.getElementById('menuChat');
        const menuProfile = document.getElementById('menuProfile');
        const menuMyShed = document.getElementById('menuMyShed');
        const menuCreateCommunity = document.getElementById('menuCreateCommunity');
        const menuBrowseCommunities = document.getElementById('menuBrowseCommunities');
        const menuSettings = document.getElementById('menuSettings');
        
        if (menuFeed) menuFeed.style.display = 'flex';
        if (menuChat) menuChat.style.display = 'flex';
        if (menuProfile) menuProfile.style.display = 'flex';
        if (menuMyShed) menuMyShed.style.display = 'flex';
        if (menuCreateCommunity) menuCreateCommunity.style.display = 'flex';
        if (menuBrowseCommunities) menuBrowseCommunities.style.display = 'flex';
        
        if (currentUser.profile?.isAdmin && menuAdmin) {
            menuAdmin.style.display = 'flex';
        } else if (menuAdmin) {
            menuAdmin.style.display = 'none';
        }
        
        if (menuSettings) menuSettings.style.display = 'flex';
        if (menuLogout) menuLogout.style.display = 'flex';
        
    } else {
        // Show login form for non-logged-in users
        menuUserInfo.innerHTML = `
            <div class="menu-login-prompt">
                <button class="menu-login-toggle-btn" onclick="toggleInlineLoginForm()">
                    Sign In
                </button>
                <div id="inlineLoginForm" class="inline-login-form">
                    <form id="inlineLoginFormElement" onsubmit="handleInlineLogin(event); return false;">
                        <div class="inline-form-group">
                            <label for="inlineUsername">Username</label>
                            <input type="text" id="inlineUsername" required minlength="3">
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
                    <div id="inlineLoginError" style="display: none;"></div>
                </div>
            </div>
        `;
        
        // Hide logged-in user menu items
        const menuFeed = document.getElementById('menuFeed');
        const menuChat = document.getElementById('menuChat');
        const menuProfile = document.getElementById('menuProfile');
        const menuMyShed = document.getElementById('menuMyShed');
        const menuCreateCommunity = document.getElementById('menuCreateCommunity');
        const menuBrowseCommunities = document.getElementById('menuBrowseCommunities');
        const menuSettings = document.getElementById('menuSettings');
        
        if (menuFeed) menuFeed.style.display = 'flex';
        if (menuChat) menuChat.style.display = 'none';
        if (menuProfile) menuProfile.style.display = 'none';
        if (menuMyShed) menuMyShed.style.display = 'none';
        if (menuCreateCommunity) menuCreateCommunity.style.display = 'none';
        if (menuBrowseCommunities) menuBrowseCommunities.style.display = 'none';
        if (menuAdmin) menuAdmin.style.display = 'none';
        if (menuSettings) menuSettings.style.display = 'none';
        if (menuLogout) menuLogout.style.display = 'none';
    }
}

function toggleInlineLoginForm() {
    const form = document.getElementById('inlineLoginForm');
    if (!form) {
        console.error('Inline login form not found');
        return;
    }
    
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

async function handleInlineLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('inlineUsername').value.trim();
    const password = document.getElementById('inlinePassword').value;
    const errorDiv = document.getElementById('inlineLoginError');
    const loginBtn = document.getElementById('inlineLoginBtn');
    
    if (!username || !password) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter both username and password';
            errorDiv.style.display = 'block';
        }
        return;
    }
    
    try {
        if (loginBtn) loginBtn.disabled = true;
        
        const result = await login(username, password);
        
        if (result.success) {
            currentUser = result.user;
            toggleMenu();
            showSuccessMessage('Welcome back!');
            updateUI();
        } else {
            if (errorDiv) {
                errorDiv.textContent = result.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
        }
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = 'Login failed. Please try again.';
            errorDiv.style.display = 'block';
        }
    } finally {
        if (loginBtn) loginBtn.disabled = false;
    }
}

function handleLogout() {
    if (typeof logout === 'function') {
        logout();
    }
    toggleMenu();
}

function updateCommunitiesInMenu() {
    const menuCommunities = document.getElementById('menuCommunities');
    if (!menuCommunities) return;
    
    if (!currentUser) {
        menuCommunities.innerHTML = '';
        return;
    }
    
    if (communities.length === 0) {
        menuCommunities.innerHTML = `
            <div class="menu-no-communities">
                No communities yet
            </div>
        `;
        return;
    }
    
    const communitiesHtml = communities.slice(0, 10).map(community => `
        <div class="menu-community-item" onclick="navigateToCommunity('${community.name}'); toggleMenu();">
            <span class="menu-community-name">${escapeHtml(community.displayName)}</span>
            <span class="menu-community-members">${community.members?.length || 1} members</span>
        </div>
    `).join('');
    
    menuCommunities.innerHTML = communitiesHtml;
    
    if (communities.length > 10) {
        menuCommunities.innerHTML += `
            <div class="menu-more-communities">
                +${communities.length - 10} more communities
            </div>
        `;
    }
}

function toggleCommunitiesDropdown() {
    const dropdown = document.getElementById('communitiesDropdown');
    if (!dropdown) return;
    
    communityDropdownOpen = !communityDropdownOpen;
    dropdown.style.display = communityDropdownOpen ? 'block' : 'none';
}

// Community management functions
async function handleFollowCommunity(communityName, followBtn) {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }

    try {
        followBtn.disabled = true;
        
        const isCurrentlyFollowing = typeof checkIfFollowing === 'function' ? 
            await checkIfFollowing(communityName) : false;
        const shouldFollow = !isCurrentlyFollowing;
        
        if (typeof toggleFollowStatus === 'function') {
            const result = await toggleFollowStatus(communityName, shouldFollow);
            
            if (result.success) {
                followBtn.textContent = shouldFollow ? '✓ Following' : 'Follow';
                followBtn.classList.toggle('following', shouldFollow);
                
                showSuccessMessage(shouldFollow ? 
                    `You are now following ${communityName}` : 
                    `You have unfollowed ${communityName}`
                );
            }
        }
    } catch (error) {
        console.error('Error toggling follow status:', error);
        showSuccessMessage('Failed to update follow status');
    } finally {
        followBtn.disabled = false;
    }
}

// Main UI Update Function
function updateUI() {
    updateFeedTabsVisibility();
    updateMenuForUser();
    
    switch (currentPage) {
        case 'feed':
            renderFeedWithTabs();
            break;
        case 'community':
            if (typeof renderCommunityPage === 'function') {
                renderCommunityPage(currentCommunityView);
            }
            break;
        case 'profile':
            renderProfilePage();
            break;
        case 'myshed':
            renderMyShedPage();
            break;
        case 'admin':
            if (typeof renderAdminPanel === 'function') {
                renderAdminPanel();
            }
            break;
        case 'chat':
            if (typeof renderChatInterface === 'function') {
                renderChatInterface();
            }
            break;
        case 'browse':
            renderBrowsePage();
            break;
        case 'settings':
            renderSettingsPage();
            break;
        default:
            renderFeedWithTabs();
    }
}

// Render functions for different pages
function renderFeedWithTabs() {
    if (typeof renderFeed === 'function') {
        if (currentUser && currentFeedTab === 'followed') {
            renderFollowedFeed();
        } else {
            renderFeed();
        }
    } else {
        // Fallback basic feed rendering
        const feed = document.getElementById('feed');
        if (feed) {
            feed.innerHTML = '<div class="no-posts">No posts yet. Be the first to post!</div>';
        }
    }
}

function renderFollowedFeed() {
    if (!currentUser) {
        renderFeed();
        return;
    }
    
    // Filter posts from followed communities
    const followedPosts = posts.filter(post => {
        if (!post.community) return false;
        return currentUser.profile?.followedCommunities?.includes(post.community);
    });
    
    if (typeof renderPostList === 'function') {
        renderPostList(followedPosts);
    } else {
        const feed = document.getElementById('feed');
        if (feed) {
            if (followedPosts.length === 0) {
                feed.innerHTML = '<div class="no-posts">No posts from communities you follow yet.</div>';
            } else {
                feed.innerHTML = followedPosts.map(post => renderPost(post)).join('');
            }
        }
    }
}

function renderBrowsePage() {
    const html = `
        <div class="page-header">
            <h2>Browse Communities</h2>
            <button class="btn" onclick="openModal('createCommunityModal')">+ Create Community</button>
        </div>
        <div class="communities-grid">
            ${communities.map(community => `
                <div class="community-card" onclick="navigateToCommunity('${community.name}')">
                    <h3>${escapeHtml(community.displayName)}</h3>
                    <p>${escapeHtml(community.description || 'No description')}</p>
                    <div class="community-stats">
                        <span>${community.members?.length || 1} members</span>
                        <span>${community.posts?.length || 0} posts</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    updateFeedContent(html);
}

function renderProfilePage() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    const html = `
        <div class="profile-page">
            <div class="profile-header">
                <h2>@${escapeHtml(currentUser.username)}</h2>
                ${currentUser.profile?.bio ? `<p>${escapeHtml(currentUser.profile.bio)}</p>` : ''}
            </div>
            <div class="profile-stats">
                <div class="stat">
                    <span class="stat-value">${currentUser.profile?.posts?.length || 0}</span>
                    <span class="stat-label">Posts</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${currentUser.profile?.followedCommunities?.length || 0}</span>
                    <span class="stat-label">Following</span>
                </div>
            </div>
        </div>
    `;
    updateFeedContent(html);
}

function renderMyShedPage() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    const userPosts = posts.filter(post => post.author === currentUser.username);
    
    const html = `
        <div class="page-header">
            <h2>My Shed</h2>
            <button class="btn" onclick="openComposeModal()">+ New Post</button>
        </div>
        <div class="posts-list">
            ${userPosts.length > 0 ? 
                userPosts.map(post => renderPost(post)).join('') : 
                '<div class="no-posts">You haven\'t posted anything yet.</div>'
            }
        </div>
    `;
    updateFeedContent(html);
}

function renderSettingsPage() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    const html = `
        <div class="settings-page">
            <h2>Settings</h2>
            <div class="settings-section">
                <h3>Account</h3>
                <p>Username: @${escapeHtml(currentUser.username)}</p>
                <button class="btn" onclick="logout()">Log Out</button>
            </div>
        </div>
    `;
    updateFeedContent(html);
}

// Helper function to render individual posts
function renderPost(post) {
    if (!post) return '';
    
    const isLiked = currentUser?.profile?.likedPosts?.includes(post.id);
    const isAuthor = currentUser?.username === post.author;
    
    return `
        <div class="post" data-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    <span class="post-username">@${escapeHtml(post.author)}</span>
                    ${post.community ? `<span class="post-community">in ${escapeHtml(post.community)}</span>` : ''}
                    <span class="post-timestamp">${formatTimeAgo(post.timestamp)}</span>
                </div>
                ${isAuthor ? `
                    <button class="post-options" onclick="showPostOptions('${post.id}')">⋯</button>
                ` : ''}
            </div>
            ${post.title ? `<h3 class="post-title">${escapeHtml(post.title)}</h3>` : ''}
            <div class="post-content">
                ${post.type === 'media' && post.mediaUrl ? 
                    renderMediaContent(post.mediaUrl, post.mediaType) : 
                    `<div class="post-text">${renderMarkdown(post.content || '')}</div>`
                }
            </div>
            <div class="post-actions">
                <button class="post-action ${isLiked ? 'liked' : ''}" onclick="handleLike('${post.id}')">
                    ${isLiked ? '❤️' : '🤍'} ${post.likes || 0}
                </button>
                <button class="post-action" onclick="showComments('${post.id}')">
                    💬 ${post.comments?.length || 0}
                </button>
                <button class="post-action" onclick="sharePost('${post.id}')">
                    🔗 Share
                </button>
            </div>
        </div>
    `;
}

// Setup event listeners
function setupEventListeners() {
    // Auth form
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
    
    // Create community form
    const createCommunityForm = document.getElementById('createCommunityForm');
    if (createCommunityForm) {
        createCommunityForm.addEventListener('submit', handleCreateCommunity);
    }
    
    // Compose form
    const composeForm = document.getElementById('composeForm');
    if (composeForm) {
        composeForm.addEventListener('submit', handleCreatePost);
    }
    
    // Create room form (for chat)
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', handleCreateRoom);
    }
    
    // URL preview for media posts
    const urlInput = document.getElementById('postUrl');
    if (urlInput) {
        let previewTimeout;
        urlInput.addEventListener('input', (e) => {
            clearTimeout(previewTimeout);
            const url = e.target.value.trim();
            
            if (url && url.length > 10) {
                previewTimeout = setTimeout(() => {
                    if (typeof previewMedia === 'function') {
                        previewMedia(url);
                    }
                }, 1000);
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
        
        if (menu && menuToggle && menu.classList.contains('open') && 
            !menu.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            toggleMenu();
        }
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// Initialize the application
async function init() {
    console.log('Initializing application...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check for existing session
    if (typeof checkSession === 'function') {
        const session = await checkSession();
        if (session) {
            currentUser = session;
        }
    }
    
    // Load initial data
    if (typeof loadPosts === 'function') {
        await loadPosts();
    }
    
    if (typeof loadCommunities === 'function') {
        await loadCommunities();
    }
    
    // Initial UI update
    updateUI();
    
    console.log('Application initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
