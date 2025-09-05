// app.js - Main application logic and initialization - Fixed for Your HTML Structure

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
let currentFeedTab = 'general';
let followedCommunities = new Set();
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

// UI Rendering Functions
function updateFeedContent(html) {
    const feedElement = document.getElementById('feed');
    if (feedElement) {
        feedElement.innerHTML = html;
    }
}

function renderFeedPage() {
    if (!currentUser) {
        const loginRequiredHtml = `
            <div class="login-required">
                <div class="login-required-icon">🔒</div>
                <h2>Welcome to AFS</h2>
                <p>Sign in to view posts and join communities.</p>
                <div class="login-required-buttons">
                    <button class="btn" onclick="openAuthModal('signin')">
                        Sign In
                    </button>
                    <button class="btn btn-secondary" onclick="openAuthModal('signup')">
                        Sign Up
                    </button>
                </div>
            </div>
        `;
        updateFeedContent(loginRequiredHtml);
        return;
    }

    // User is logged in, show feed with tabs
    renderFeedWithTabs();
}

function renderFeedWithTabs() {
    if (!currentUser) {
        renderFeedPage();
        return;
    }

    // Render based on current tab
    switch (currentFeedTab) {
        case 'general':
            renderGeneralFeed();
            break;
        case 'followed':
            renderFollowedFeed();
            break;
        default:
            renderGeneralFeed();
    }
}

function renderGeneralFeed() {
    const publicPosts = posts.filter(post => !post.isPrivate);
    
    if (publicPosts.length === 0) {
        const emptyHtml = `
            <div class="feature-placeholder">
                <h3>📫 No Posts Yet</h3>
                <p>Be the first to share something with the community!</p>
                <button class="btn" onclick="openModal('composeModal')">Create First Post</button>
            </div>
        `;
        updateFeedContent(emptyHtml);
        return;
    }

    const postsHtml = renderPostList(publicPosts);
    updateFeedContent(postsHtml);
}

function renderFollowedFeed() {
    if (followedCommunities.size === 0) {
        const emptyFollowedHtml = `
            <div class="feature-placeholder">
                <h3>🏘️ No Followed Communities Yet</h3>
                <p>You're not following any communities yet! Discover and follow communities to see their posts here.</p>
                <button class="btn" onclick="switchFeedTab('general')">Browse General Feed</button>
            </div>
        `;
        updateFeedContent(emptyFollowedHtml);
        return;
    }

    const followedPosts = getFollowedCommunityPosts();
    
    if (followedPosts.length === 0) {
        const noPostsHtml = `
            <div class="feature-placeholder">
                <h3>🏘️ No Posts Yet</h3>
                <p>Your followed communities don't have any posts yet.</p>
                <button class="btn" onclick="switchFeedTab('general')">Browse General Feed</button>
            </div>
        `;
        updateFeedContent(noPostsHtml);
        return;
    }

    const postsHtml = renderPostList(followedPosts);
    updateFeedContent(postsHtml);
}

function getFollowedCommunityPosts() {
    if (!currentUser || followedCommunities.size === 0) {
        return [];
    }

    return posts.filter(post => 
        post.communityName && 
        followedCommunities.has(post.communityName) && 
        !post.isPrivate
    );
}

function renderPostList(postArray) {
    if (!postArray || postArray.length === 0) {
        return `
            <div class="feature-placeholder">
                <h3>📫 No Posts</h3>
                <p>No posts to display.</p>
            </div>
        `;
    }

    return postArray.map(post => {
        const timeAgo = formatTimeAgo(post.timestamp);
        const communityLink = post.communityName ? 
            `<a href="/${post.communityName}" onclick="navigateToCommunity('${post.communityName}'); return false;" class="community-link">${post.communityName}</a>` : 
            '';

        return `
            <div class="post-card" id="post-${post.id}">
                <div class="post-header">
                    <div class="post-meta">
                        <span class="post-author">@${escapeHtml(post.author)}</span>
                        ${communityLink ? `<span class="post-community">in ${communityLink}</span>` : ''}
                        <span class="post-time">${timeAgo}</span>
                    </div>
                </div>
                
                <div class="post-content">
                    ${renderPostContent(post)}
                </div>
                
                <div class="post-actions">
                    <button class="action-btn" onclick="toggleReplies('${post.id}')">
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
                
                <div class="replies-section" id="replies-${post.id}" style="display: none;">
                    <div class="replies-container">
                        <div class="replies-list" id="replies-list-${post.id}">
                            ${renderReplies(post.replies || [])}
                        </div>
                        
                        ${currentUser ? `
                            <div class="reply-form">
                                <textarea 
                                    class="reply-input" 
                                    id="reply-input-${post.id}"
                                    placeholder="Write a reply..."
                                    maxlength="2000"></textarea>
                                <div class="reply-form-buttons">
                                    <button class="reply-btn-cancel" onclick="toggleReplies('${post.id}')">Cancel</button>
                                    <button class="reply-btn-submit" onclick="submitReply('${post.id}')">Reply</button>
                                </div>
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 16px; color: var(--fg-muted); font-size: 13px;">
                                <a href="#" onclick="openAuthModal('signin'); return false;">Sign in</a> to reply
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPostContent(post) {
    let contentHtml = '';

    if (post.type === 'link' && post.url) {
        contentHtml += `
            <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="post-link">
                🔗 ${post.url}
            </a>
        `;
        
        if (post.description) {
            contentHtml += `<div class="post-description">${escapeHtml(post.description)}</div>`;
        }
    } else if (post.content) {
        contentHtml += `<div class="post-text">${escapeHtml(post.content)}</div>`;
    }

    return contentHtml;
}

function renderReplies(replies) {
    if (!replies || replies.length === 0) {
        return '<div class="no-replies">No replies yet. Be the first to reply!</div>';
    }

    return replies.map(reply => `
        <div class="reply-item" id="reply-${reply.id}">
            <div class="reply-header">
                <span class="reply-author">@${escapeHtml(reply.author)}</span>
                <span class="reply-time">${formatTimeAgo(reply.timestamp)}</span>
            </div>
            <div class="reply-content">${escapeHtml(reply.content)}</div>
        </div>
    `).join('');
}

function renderCommunityPage() {
    if (!currentCommunity) {
        updateFeedContent('<div class="feature-placeholder"><h3>Community not found</h3></div>');
        return;
    }

    const community = communities.find(c => c.name === currentCommunity);
    if (!community) {
        updateFeedContent('<div class="feature-placeholder"><h3>Community not found</h3></div>');
        return;
    }

    const communityPosts = posts.filter(post => post.communityName === community.name && !post.isPrivate);
    
    const communityHtml = `
        <div class="community-page">
            <div class="community-header">
                <h1>${escapeHtml(community.name)}</h1>
                <p>${escapeHtml(community.description || 'No description available')}</p>
                <div class="community-stats">
                    <span>${community.members ? community.members.length : 0} members</span>
                    <span>${communityPosts.length} posts</span>
                </div>
                ${currentUser ? `
                    <button class="btn" onclick="followCommunity('${community.name}')">
                        Follow
                    </button>
                ` : ''}
            </div>
            <div class="community-posts">
                ${renderPostList(communityPosts)}
            </div>
        </div>
    `;

    updateFeedContent(communityHtml);
}

function renderAdminPage() {
    if (!currentUser?.profile?.isAdmin) {
        updateFeedContent(`
            <div class="feature-placeholder">
                <h3>🚫 Access Denied</h3>
                <p>You need administrator privileges to access this page.</p>
                <button class="btn" onclick="navigateToFeed()">Return to Feed</button>
            </div>
        `);
        return;
    }

    const adminHtml = `
        <div class="admin-page">
            <h1>Admin Panel</h1>
            <div class="admin-stats">
                <div class="stat-card">
                    <h3 id="totalUsers">${adminData?.totalUsers || 0}</h3>
                    <p>Total Users</p>
                </div>
                <div class="stat-card">
                    <h3 id="totalPosts">${adminData?.totalPosts || 0}</h3>
                    <p>Total Posts</p>
                </div>
                <div class="stat-card">
                    <h3 id="totalCommunities">${adminData?.totalCommunities || 0}</h3>
                    <p>Total Communities</p>
                </div>
            </div>
            <div class="admin-actions">
                <button class="btn" onclick="loadPendingUsers()">Manage Pending Users</button>
                <button class="btn" onclick="loadAllUsers()">Manage All Users</button>
                <button class="btn" onclick="refreshAdminStats()">Refresh Stats</button>
            </div>
        </div>
    `;

    updateFeedContent(adminHtml);
}

// Feed tab switching
function switchFeedTab(tab) {
    currentFeedTab = tab;
    renderFeedWithTabs();
}

// Menu functions
function toggleMenu() {
    const menu = document.getElementById('slideMenu');
    const overlay = document.getElementById('menuOverlay');
    
    if (!menu || !overlay) {
        console.warn('Menu elements not found');
        return;
    }
    
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
    
    if (!menuHeader) {
        console.warn('Menu header not found');
        return;
    }
    
    if (currentUser) {
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
        
        if (menuLogout) {
            menuLogout.style.display = 'block';
        }
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
        
        if (menuLogout) {
            menuLogout.style.display = 'none';
        }
    }
}

// Navigation functions
function navigateToFeed() {
    currentPage = 'feed';
    currentCommunity = null;
    updateUI();
    history.pushState({page: 'feed'}, 'Feed', '/');
}

function navigateToCommunity(communityName) {
    currentPage = 'community';
    currentCommunity = communityName;
    updateUI();
    history.pushState({page: 'community', community: communityName}, `${communityName}`, `/${communityName}`);
}

function navigateToChat() {
    window.open('/chat.html', '_blank');
}

function navigateToAdmin() {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Access denied. Admin privileges required.');
        return;
    }
    
    currentPage = 'admin';
    updateUI();
    history.pushState({page: 'admin'}, 'Admin', '/admin');
}

// FIXED: Authentication functions to work with your HTML structure
async function handleAuth(e) {
    e.preventDefault();
    
    const form = e.target;
    const mode = form.dataset.mode || 'signup'; // Default to signup
    
    // Get form elements from your HTML structure
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const bio = document.getElementById('bio').value.trim();
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');

    // Clear previous errors
    if (errorDiv) {
        errorDiv.innerHTML = '';
    }

    if (!username || !password) {
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
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'signup' ? 'Creating Account...' : 'Signing In...';
        }
        
        if (mode === 'signup') {
            console.log('🔐 Attempting signup for user:', username);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username, 
                    password,
                    bio: bio || `I'm ${username}` 
                })
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Signup successful:', data);
                closeModal('authModal');
                showSuccessMessage('Registration submitted! Please wait for admin approval.');
            } else {
                console.error('❌ Signup failed:', data);
                showError('authError', data.error || 'Signup failed!');
            }
            
        } else {
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
                
                if (data.token) {
                    console.log('💾 Storing session token in localStorage...');
                    localStorage.setItem('sessionToken', data.token);
                    console.log('✅ Session token stored successfully');
                } else {
                    console.warn('⚠️ No token received from server');
                }
                
                currentUser = data.user;
                currentUser.profile = data.user;
                
                console.log('🎉 User authenticated:', currentUser.username);
                
                closeModal('authModal');
                updateUI();
                await loadData();
                showSuccessMessage('Login successful!');
                
                await loadFollowedCommunities();
                
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
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
        }
    }
}

// FIXED: Toggle auth mode function to work with your HTML
function toggleAuthMode() {
    const form = document.getElementById('authForm');
    const title = document.getElementById('authTitle');
    const toggleText = document.getElementById('authToggleText');
    const toggleBtn = document.getElementById('authToggleBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    
    if (!form || !title) {
        console.warn('Auth form elements not found');
        return;
    }
    
    const currentMode = form.dataset.mode || 'signup';
    
    if (currentMode === 'signup') {
        // Switch to signin
        form.dataset.mode = 'signin';
        title.textContent = 'Sign In';
        if (toggleText) toggleText.textContent = "Don't have an account?";
        if (toggleBtn) toggleBtn.textContent = 'Sign Up';
        if (submitBtn) submitBtn.textContent = 'Sign In';
    } else {
        // Switch to signup
        form.dataset.mode = 'signup';
        title.textContent = 'Sign Up';
        if (toggleText) toggleText.textContent = 'Already have an account?';
        if (toggleBtn) toggleBtn.textContent = 'Sign In';
        if (submitBtn) submitBtn.textContent = 'Sign Up';
    }
    
    // Clear any errors
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.innerHTML = '';
    }
}

// FIXED: Open auth modal function
function openAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const form = document.getElementById('authForm');
    const title = document.getElementById('authTitle');
    const toggleText = document.getElementById('authToggleText');
    const toggleBtn = document.getElementById('authToggleBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    
    if (!modal || !form) {
        console.warn('Auth modal elements not found');
        return;
    }
    
    // Clear any previous errors
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.innerHTML = '';
    }
    
    // Set the mode
    form.dataset.mode = mode;
    
    if (mode === 'signup') {
        if (title) title.textContent = 'Sign Up';
        if (toggleText) toggleText.textContent = 'Already have an account?';
        if (toggleBtn) toggleBtn.textContent = 'Sign In';
        if (submitBtn) submitBtn.textContent = 'Sign Up';
    } else {
        if (title) title.textContent = 'Sign In';
        if (toggleText) toggleText.textContent = "Don't have an account?";
        if (toggleBtn) toggleBtn.textContent = 'Sign Up';
        if (submitBtn) submitBtn.textContent = 'Sign In';
    }
    
    modal.style.display = 'block';
    
    // Focus on the username field
    setTimeout(() => {
        const usernameField = document.getElementById('username');
        if (usernameField) {
            usernameField.focus();
        }
    }, 100);
}

async function logout() {
    console.log('🚪 Logging out user...');
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        if (token) {
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
    
    localStorage.removeItem('sessionToken');
    currentUser = null;
    followedCommunities = new Set();
    
    console.log('✅ User logged out successfully');
    
    updateUI();
    navigateToFeed();
    showSuccessMessage('Logged out successfully!');
}

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
            currentUser.profile = data.user;
            
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
        console.log('📋 Loading communities...');
        const communityKeys = await blobAPI.list('community_');
        console.log('📋 Found community keys:', communityKeys.length);
        
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

        console.log('✅ Loaded communities:', communities.length);
        
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
        console.log('📄 Loading posts...');
        if (!isLoading) {
            isLoading = true;
            const feedElement = document.getElementById('feed');
            if (feedElement) {
                feedElement.innerHTML = '<div class="loading">Loading...</div>';
            }
        }
        
        const postKeys = await blobAPI.list('post_');
        console.log('📄 Found post keys:', postKeys.length);
        
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
            
        console.log('✅ Loaded posts:', posts.length);
            
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    } finally {
        isLoading = false;
    }
}

async function loadData() {
    await loadCommunities();
    await loadPosts();
}

async function loadAdminStats() {
    if (!currentUser?.profile?.isAdmin) return;
    
    try {
        console.log('📊 Loading admin statistics...');
        
        const pendingKeys = await blobAPI.list('pending_user_');
        const pendingUsers = [];
        for (const key of pendingKeys) {
            const user = await blobAPI.get(key);
            if (user) pendingUsers.push({...user, key});
        }
        
        const userKeys = await blobAPI.list('user_');
        const allUsers = [];
        for (const key of userKeys) {
            const user = await blobAPI.get(key);
            if (user) allUsers.push(user);
        }
        
        adminData = {
            totalUsers: allUsers.length,
            pendingUsers: pendingUsers.length,
            totalPosts: posts.length,
            totalCommunities: communities.length,
            pendingUsersList: pendingUsers,
            allUsersList: allUsers
        };
        
        console.log('✅ Admin stats loaded:', adminData);
        
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
    // Note: Your HTML doesn't have signInBtn, userMenu, profileBtn elements
    // so we'll skip the header update to avoid errors
    console.log('🔄 Updating header (skipped - elements not in HTML)');
}

function updateMainContent() {
    const feedElement = document.getElementById('feed');
    
    if (!feedElement) {
        console.warn('⚠️ Feed element not found, skipping content update');
        return;
    }
    
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
    
    if (!composeBtn) {
        console.warn('⚠️ Compose button not found, skipping compose button update');
        return;
    }
    
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
        modal.style.display = 'block';
        
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
        
        const errorElements = modal.querySelectorAll('.error-message, .success-message');
        errorElements.forEach(el => el.innerHTML = '');
        
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
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

// Post interaction functions
function toggleReplies(postId) {
    const repliesSection = document.getElementById(`replies-${postId}`);
    const isOpen = repliesSection.style.display !== 'none';
    
    if (isOpen) {
        repliesSection.style.display = 'none';
    } else {
        repliesSection.style.display = 'block';
        if (currentUser) {
            setTimeout(() => {
                const replyInput = document.getElementById(`reply-input-${postId}`);
                if (replyInput) {
                    replyInput.focus();
                }
            }, 300);
        }
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
    // FIXED: Auth form event listener to work with your HTML structure
    const authForm = document.getElementById('authForm');
    
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
        console.log('✅ Auth form event listener attached');
    } else {
        console.warn('⚠️ Auth form not found');
    }

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
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Starting main app initialization...');
    
    setupSessionMonitoring();
    
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
            },
            breaks: true,
            gfm: true
        });
        
        markdownRenderer = new marked.Renderer();
        
        markdownRenderer.link = function(href, title, text) {
            if (typeof renderMediaFromUrl === 'function') {
                const mediaHtml = renderMediaFromUrl(href);
                if (mediaHtml) return mediaHtml;
            }
            
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
        };
        
        markdownRenderer.image = function(href, title, text) {
            return `<img src="${href}" alt="${text || 'Image'}" ${title ? `title="${title}"` : ''} onclick="openImageModal('${href}')" style="cursor: pointer;">`;
        };
    }

    console.log('🔍 Checking for existing session...');
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        if (token) {
            console.log('📱 Found session token, validating...');
            
            const sessionValid = await validateSession();
            
            if (sessionValid && currentUser) {
                console.log('✅ Session restored successfully for user:', currentUser.username);
                
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
        localStorage.removeItem('sessionToken');
    }
    
    console.log('📊 Loading application data...');
    
    try {
        await loadCommunities();
        await loadPosts();
    } catch (error) {
        console.error('💥 Error loading data:', error);
    }
    
    updateUI();
    setupEventListeners();
    
    if (currentUser?.profile?.isAdmin) {
        console.log('👑 Loading admin interface...');
        try {
            await loadAdminStats();
        } catch (error) {
            console.error('💥 Error loading admin stats:', error);
        }
    }
    
    console.log('✅ Main app initialization complete');
});
