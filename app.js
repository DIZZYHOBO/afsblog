// app.js - Complete Main Application Logic with All Functions

// Global state
let currentUser = null;
let currentPage = 'feed';
let currentCommunityView = null;
let currentCommunity = null; // Add this for community page
let posts = [];
let communities = [];
let isLoading = false;
let currentPostType = 'text';
let currentFeedTab = 'general'; // 'general' or 'followed'
let menuOpen = false;
let composeModal = null;
let createCommunityModal = null;
let authModal = null;
let communityDropdownOpen = false;
let inlineLoginFormOpen = false;
let followedCommunities = new Set(); // Add this for followed communities

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
    
    // Show tabs only on feed page and when user is logged in
    if (currentPage === 'feed' && currentUser) {
        feedTabs.style.display = 'flex';
        
        // Update active states
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

// Menu functions - FIXED WITH NULL CHECKS (FIX 2)
function toggleMenu() {
    const menu = document.getElementById('slideMenu');
    const menuToggle = document.getElementById('menuToggle');
    
    // FIX 2: Add null checks
    if (!menu || !menuToggle) {
        console.error('Menu elements not found');
        return;
    }
    
    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        menuToggle.innerHTML = '☰';
        inlineLoginFormOpen = false;
        communityDropdownOpen = false;
    } else {
        menu.classList.add('open');
        menuToggle.innerHTML = '✕';
        updateMenuForUser();
        updateCommunitiesInMenu();
    }
}

// FIXED WITH COMPREHENSIVE NULL CHECKS (FIX 2)
function updateMenuForUser() {
    const menuUserInfo = document.getElementById('menuUserInfo');
    const menuLogout = document.getElementById('menuLogout');
    const menuAdmin = document.getElementById('menuAdmin');
    
    // FIX 2: Check if required elements exist
    if (!menuUserInfo) {
        console.error('Menu user info element not found');
        return;
    }
    
    if (currentUser) {
        // Show user info
        menuUserInfo.innerHTML = `
            <div class="menu-user-details">
                <div class="menu-username">@${escapeHtml(currentUser.username)}</div>
                ${currentUser.profile?.isAdmin ? '<div class="menu-user-badge">Admin</div>' : ''}
            </div>
        `;
        
        // Show authenticated menu items with null checks
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
        
        // Show admin menu if admin
        if (currentUser.profile?.isAdmin && menuAdmin) {
            menuAdmin.style.display = 'flex';
        } else if (menuAdmin) {
            menuAdmin.style.display = 'none';
        }
        
        if (menuSettings) menuSettings.style.display = 'flex';
        if (menuLogout) menuLogout.style.display = 'flex';
        
    } else {
        // Show login prompt
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
        
        // Hide authenticated menu items with null checks
        const menuFeed = document.getElementById('menuFeed');
        const menuChat = document.getElementById('menuChat');
        const menuProfile = document.getElementById('menuProfile');
        const menuMyShed = document.getElementById('menuMyShed');
        const menuCreateCommunity = document.getElementById('menuCreateCommunity');
        const menuBrowseCommunities = document.getElementById('menuBrowseCommunities');
        const menuSettings = document.getElementById('menuSettings');
        
        if (menuFeed) menuFeed.style.display = 'flex'; // Keep feed visible for non-auth users
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
        // Focus on username field
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
        
        // Check current follow status
        const isCurrentlyFollowing = await checkIfFollowing(communityName);
        const shouldFollow = !isCurrentlyFollowing;
        
        // Toggle follow status
        const result = await toggleFollowStatus(communityName, shouldFollow);
        
        if (result.success) {
            // Update button UI
            followBtn.textContent = shouldFollow ? '✓ Following' : 'Follow';
            followBtn.classList.toggle('following', shouldFollow);
            
            showSuccessMessage(shouldFollow ? 
                `You are now following ${communityName}!` : 
                `You have unfollowed ${communityName}`);
        } else {
            throw new Error('Failed to update follow status');
        }
        
    } catch (error) {
        console.error('Error toggling follow:', error);
        showSuccessMessage('Failed to update follow status. Please try again.');
    } finally {
        followBtn.disabled = false;
    }
}

async function toggleCommunityFollow(communityName) {
    const btn = document.getElementById(`followBtn-${communityName}`);
    if (btn) {
        await handleFollowCommunity(communityName, btn);
    }
}

// UI Update functions
function updateUI() {
    updateComposeButton();
    updateFeedTabsVisibility();
    renderCurrentPage();
}

function updateComposeButton() {
    const composeBtn = document.getElementById('composeBtn');
    if (!composeBtn) return;
    
    // Hide compose button on chat page
    if (currentUser && currentPage !== 'chat') {
        composeBtn.style.display = 'block';
    } else {
        composeBtn.style.display = 'none';
    }
}

function renderCurrentPage() {
    if (currentPage === 'feed') {
        renderFeedWithTabs();
    } else if (currentPage === 'chat') {
        if (typeof renderChatPage === 'function') {
            renderChatPage();
        } else if (typeof renderChatRoomList === 'function') {
            renderChatRoomList();
        }
    } else if (currentPage === 'community') {
        if (typeof renderCommunityPage === 'function') {
            renderCommunityPage();
        }
    } else if (currentPage === 'profile') {
        if (typeof renderProfilePage === 'function') {
            renderProfilePage();
        }
    } else if (currentPage === 'myshed') {
        if (typeof renderMyShedPage === 'function') {
            renderMyShedPage();
        }
    } else if (currentPage === 'admin') {
        if (typeof renderAdminPage === 'function') {
            renderAdminPage();
        }
    } else if (currentPage === 'browse') {
        renderBrowseCommunitiesPage();
    } else if (currentPage === 'settings') {
        renderSettingsPage();
    }
}

// Modal functions
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

function openComposeModal() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    openModal('composeModal');
}

function openCreateCommunityModal() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    openModal('createCommunityModal');
}

// Browse and Settings pages
function renderBrowseCommunitiesPage() {
    const html = `
        <div class="browse-communities">
            <h2>Browse Communities</h2>
            <div class="communities-grid">
                ${communities.map(community => `
                    <div class="community-card">
                        <h3>${escapeHtml(community.displayName)}</h3>
                        <p>${escapeHtml(community.description || 'No description')}</p>
                        <div class="community-stats">
                            <span>${community.members?.length || 0} members</span>
                        </div>
                        <button class="btn" onclick="navigateToCommunity('${community.name}')">
                            View Community
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    updateFeedContent(html);
}

function renderSettingsPage() {
    if (!currentUser) {
        const html = `
            <div class="settings-page">
                <h2>Settings</h2>
                <p>Please log in to access settings.</p>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        updateFeedContent(html);
        return;
    }
    
    const html = `
        <div class="settings-page">
            <h2>Settings</h2>
            <div class="settings-section">
                <h3>Account Settings</h3>
                <p>Username: @${escapeHtml(currentUser.username)}</p>
                <button class="btn" onclick="logout()">Log Out</button>
            </div>
        </div>
    `;
    updateFeedContent(html);
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
    
    // Create room form (chat)
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', handleCreateRoom);
    }
    
    // URL input for media preview
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
        
        if (menu && menuToggle && menu.classList.contains('open') && 
            !menu.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            toggleMenu();
        }
    });
    
    // Page visibility change handling for chat
    document.addEventListener('visibilitychange', () => {
        if (currentPage === 'chat' && typeof currentChatRoom !== 'undefined' && currentChatRoom) {
            if (document.hidden) {
                console.log('Page hidden, chat may reduce activity');
            } else {
                console.log('Page visible, ensuring chat is active');
                if (typeof chatRefreshInterval !== 'undefined' && !chatRefreshInterval && currentChatRoom && typeof startChatRefresh === 'function') {
                    startChatRefresh(currentChatRoom.id);
                }
            }
        }
    });
    
    // Cleanup chat when leaving the page
    window.addEventListener('beforeunload', () => {
        if (currentPage === 'chat' && typeof stopChatRefresh === 'function') {
            stopChatRefresh();
        }
    });
}

// Data loading functions
async function loadUser() {
    try {
        const userData = await blobAPI.get('current_user');
        if (userData) {
            currentUser = userData;
            const fullProfile = await blobAPI.get(`user_${userData.username}`);
            if (fullProfile) {
                currentUser.profile = fullProfile;
            }
            
            // Load user's followed communities after loading user
            if (typeof loadFollowedCommunities === 'function') {
                await loadFollowedCommunities();
            }
            
            // Initialize chat system for authenticated user
            if (typeof initializeChat === 'function') {
                await initializeChat();
            }
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

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
        if (typeof updateCommunityDropdown === 'function') {
            updateCommunityDropdown();
        }
        
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
            .filter(post => !post.isPrivate || (currentUser && post.author === currentUser.username))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    } finally {
        isLoading = false;
    }
}

// Helper function to get followed community posts
function getFollowedCommunityPosts() {
    if (!currentUser || !followedCommunities || followedCommunities.size === 0) {
        return [];
    }
    
    return posts.filter(post => 
        !post.isPrivate && 
        post.communityName && 
        followedCommunities.has(post.communityName)
    );
}

// Cleanup chat state (helper function)
function cleanupChat() {
    if (typeof stopChatRefresh === 'function') {
        stopChatRefresh();
    }
    if (typeof currentChatRoom !== 'undefined') {
        currentChatRoom = null;
    }
    if (typeof chatMessages !== 'undefined') {
        chatMessages = [];
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Configure marked.js for markdown rendering if available
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                if (typeof hljs !== 'undefined') {
                    return hljs.highlightAuto(code).value;
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
        
        // Custom renderer for enhanced features
        if (typeof marked.Renderer !== 'undefined') {
            window.markdownRenderer = new marked.Renderer();
            
            // Custom link renderer to handle media embeds
            window.markdownRenderer.link = function(href, title, text) {
                if (typeof renderMediaFromUrl === 'function') {
                    const mediaHtml = renderMediaFromUrl(href);
                    if (mediaHtml) return mediaHtml;
                }
                
                return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
            };
            
            // Custom image renderer
            window.markdownRenderer.image = function(href, title, text) {
                return `<img src="${href}" alt="${text || 'Image'}" ${title ? `title="${title}"` : ''} onclick="openImageModal('${href}')" style="cursor: pointer;">`;
            };
        }
    }

    await loadUser();
    await loadCommunities();
    await loadPosts();
    
    // Initialize chat system if user is logged in and function exists
    if (currentUser && typeof initializeChat === 'function') {
        await initializeChat();
    }
    
    updateUI();
    setupEventListeners();
    
    // Load admin stats if user is admin
    if (currentUser?.profile?.isAdmin && typeof loadAdminStats === 'function') {
        await loadAdminStats();
    }
});

// Utility function to update feed content
function updateFeedContent(html) {
    const feedElement = document.getElementById('feedContent') || document.getElementById('feed');
    if (feedElement) {
        feedElement.innerHTML = html;
    }
}
