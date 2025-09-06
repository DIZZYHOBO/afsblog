// app.js - Clean working version with localStorage

// Global variables - declared once only
let currentUser = null;
let currentPage = 'feed';
let communities = [];
let posts = [];
let currentCommunity = null;
let isLoading = false;
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
        menuHeader.innerHTML = `
            <div class="menu-user-info">
                <div class="profile-avatar">${currentUser.username.charAt(0).toUpperCase()}</div>
                <div class="menu-user-details">
                    <h4>@${escapeHtml(currentUser.username)}</h4>
                    <p>${currentUser.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                </div>
            </div>
        `;
        
        // Show authenticated menu items
        document.getElementById('menuProfile').style.display = 'flex';
        document.getElementById('menuCreateCommunity').style.display = 'flex';
        document.getElementById('menuBrowseCommunities').style.display = 'flex';
        document.getElementById('menuSettings').style.display = 'flex';
        
        // Show admin menu for admins
        const menuAdmin = document.getElementById('menuAdmin');
        if (currentUser.profile?.isAdmin) {
            menuAdmin.style.display = 'flex';
        } else {
            menuAdmin.style.display = 'none';
        }
        
        menuLogout.style.display = 'flex';
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
                            <input type="text" id="inlineUsername" required>
                        </div>
                        <div class="inline-form-group">
                            <label for="inlinePassword">Password</label>
                            <input type="password" id="inlinePassword" required>
                        </div>
                        <div class="inline-form-buttons">
                            <button type="submit" class="inline-btn-primary">Sign In</button>
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
    const community = communities.find(c => c.name === communityName);
    if (!community) {
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

// Feed tab functions
function switchFeedTab(tabName) {
    if (tabName !== 'general' && tabName !== 'followed') {
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
        if (followedTab) followedTab.disabled = false;
    } else {
        feedTabs.style.display = 'none';
    }
}

// UI functions
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

// Authentication functions
function handleAuth(e) {
    e.preventDefault();
    const form = e.target;
    const mode = form.dataset.mode || 'signin';
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;
    const bio = document.getElementById('bio')?.value?.trim();
    
    if (!username || !password) {
        showSuccessMessage('Please enter username and password');
        return;
    }
    
    try {
        if (mode === 'signup') {
            const userData = { 
                username, 
                password, 
                bio: bio || `Hello! I'm ${username}`, 
                profile: { 
                    isAdmin: username.toLowerCase() === 'admin',
                    bio: bio || `Hello! I'm ${username}`,
                    createdAt: new Date().toISOString()
                } 
            };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            currentUser = userData;
            showSuccessMessage('Account created successfully!');
        } else {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                if (userData.username === username && userData.password === password) {
                    currentUser = userData;
                    showSuccessMessage('Login successful!');
                } else {
                    showSuccessMessage('Invalid credentials');
                    return;
                }
            } else {
                showSuccessMessage('No account found. Please sign up first.');
                return;
            }
        }
        
        closeModal('authModal');
        updateUI();
        
    } catch (error) {
        console.error('Auth error:', error);
        showSuccessMessage('Authentication failed');
    }
}

function handleInlineLogin(e) {
    e.preventDefault();
    const username = document.getElementById('inlineUsername')?.value?.trim();
    const password = document.getElementById('inlinePassword')?.value;
    
    if (!username || !password) {
        showSuccessMessage('Please enter username and password');
        return;
    }
    
    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            if (userData.username === username && userData.password === password) {
                currentUser = userData;
                showSuccessMessage('Login successful!');
                toggleInlineLoginForm();
                updateUI();
            } else {
                showSuccessMessage('Invalid credentials');
            }
        } else {
            showSuccessMessage('No account found. Please sign up first.');
        }
    } catch (error) {
        console.error('Login error:', error);
        showSuccessMessage('Login failed');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showSuccessMessage('Logged out successfully');
    updateUI();
}

// Modal functions
function openAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const toggleText = document.getElementById('authToggleText');
    const toggleBtn = document.getElementById('authToggleBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    const form = document.getElementById('authForm');
    const bioField = document.getElementById('bio');
    
    if (mode === 'signup') {
        title.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Sign In';
        submitBtn.textContent = 'Sign Up';
        form.dataset.mode = 'signup';
        if (bioField) bioField.parentElement.style.display = 'block';
    } else {
        title.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
        submitBtn.textContent = 'Sign In';
        form.dataset.mode = 'signin';
        if (bioField) bioField.parentElement.style.display = 'none';
    }
    
    openModal('authModal');
}

function toggleAuthMode() {
    const form = document.getElementById('authForm');
    const currentMode = form.dataset.mode;
    openAuthModal(currentMode === 'signup' ? 'signin' : 'signup');
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

// Community and post functions
function handleCreateCommunity(e) {
    e.preventDefault();
    const communityName = document.getElementById('communityName')?.value?.trim();
    const displayName = document.getElementById('communityDisplayName')?.value?.trim();
    const description = document.getElementById('communityDescription')?.value?.trim();
    
    if (!communityName || !displayName) {
        showSuccessMessage('Please fill in required fields');
        return;
    }
    
    const newCommunity = {
        name: communityName,
        displayName: displayName,
        description: description || '',
        createdBy: currentUser?.username || 'anonymous',
        createdAt: new Date().toISOString(),
        members: [currentUser?.username || 'anonymous']
    };
    
    communities.push(newCommunity);
    localStorage.setItem('communities', JSON.stringify(communities));
    
    showSuccessMessage(`Community "${displayName}" created successfully!`);
    closeModal('createCommunityModal');
    updateCommunitiesInMenu();
    
    // Clear form
    document.getElementById('communityName').value = '';
    document.getElementById('communityDisplayName').value = '';
    document.getElementById('communityDescription').value = '';
}

function handleCreatePost(e) {
    e.preventDefault();
    const title = document.getElementById('postTitle')?.value?.trim();
    const content = document.getElementById('postContent')?.value?.trim();
    const communityName = document.getElementById('postCommunity')?.value;
    const isPrivate = document.getElementById('isPrivate')?.checked;
    
    if (!title || !content) {
        showSuccessMessage('Please fill in title and content');
        return;
    }
    
    const newPost = {
        id: Date.now().toString(),
        title: title,
        content: content,
        author: currentUser?.username || 'anonymous',
        communityName: communityName || null,
        isPrivate: isPrivate || false,
        timestamp: new Date().toISOString(),
        type: 'text',
        replies: []
    };
    
    posts.unshift(newPost);
    localStorage.setItem('posts', JSON.stringify(posts));
    
    showSuccessMessage('Post created successfully!');
    closeModal('composeModal');
    
    // Clear form
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('isPrivate').checked = false;
    
    updateUI();
}

function deletePost(postId) {
    if (!currentUser) return;
    
    const postIndex = posts.findIndex(post => post.id === postId);
    if (postIndex === -1) return;
    
    const post = posts[postIndex];
    
    if (post.author !== currentUser.username && !currentUser.profile?.isAdmin) {
        showSuccessMessage('You can only delete your own posts');
        return;
    }
    
    if (confirm('Are you sure you want to delete this post?')) {
        posts.splice(postIndex, 1);
        localStorage.setItem('posts', JSON.stringify(posts));
        showSuccessMessage('Post deleted successfully');
        updateUI();
    }
}

// Data loading functions
async function loadUser() {
    try {
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
        const storedCommunities = localStorage.getItem('communities');
        if (storedCommunities) {
            communities = JSON.parse(storedCommunities);
        } else {
            communities = [];
        }
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        const storedPosts = localStorage.getItem('posts');
        if (storedPosts) {
            posts = JSON.parse(storedPosts);
        } else {
            posts = [];
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    }
}

// Rendering functions
function renderFeedWithTabs() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!currentUser) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 40px; background: var(--bg-default); border-radius: 8px; margin: 20px 0;">
                <h2>Welcome to The Shed! 🏠</h2>
                <p style="color: var(--fg-muted); margin: 16px 0;">Join our community to share posts and connect with others.</p>
                <button class="btn" onclick="openAuthModal('signup')" style="margin-right: 12px;">Sign Up</button>
                <button class="btn btn-secondary" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        return;
    }
    
    let postsToShow = [];
    
    if (currentFeedTab === 'followed') {
        postsToShow = posts.filter(post => 
            !post.isPrivate && 
            post.communityName && 
            followedCommunities.has(post.communityName)
        );
    } else {
        postsToShow = posts.filter(post => !post.isPrivate);
    }
    
    if (postsToShow.length === 0) {
        const emptyMessage = currentFeedTab === 'followed' 
            ? 'No posts from followed communities yet!'
            : 'No posts yet! Be the first to share something.';
            
        feed.innerHTML = `
            <div style="text-align: center; padding: 40px; background: var(--bg-default); border-radius: 8px;">
                <h3>${emptyMessage}</h3>
                <button class="btn" onclick="openModal('composeModal')" style="margin-top: 16px;">Create Post</button>
            </div>
        `;
        return;
    }
    
    feed.innerHTML = postsToShow.map(post => renderPost(post)).join('');
}

function renderPost(post) {
    const community = communities.find(c => c.name === post.communityName);
    
    return `
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; margin-bottom: 16px;">
            <div style="padding: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent-emphasis), var(--accent-fg)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                        ${post.author.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--fg-default);">@${escapeHtml(post.author)}</div>
                        <div style="font-size: 12px; color: var(--fg-muted);">${formatTimestamp(post.timestamp)}</div>
                    </div>
                    ${post.isPrivate ? '<span style="background: var(--attention-fg); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: auto;">Private</span>' : ''}
                </div>
                
                ${post.communityName && community ? `
                    <div style="margin-bottom: 8px;">
                        <span style="background: rgba(88, 166, 255, 0.1); color: var(--accent-fg); padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            c/${escapeHtml(community.displayName)}
                        </span>
                    </div>
                ` : ''}
                
                <h3 style="color: var(--fg-default); margin: 0 0 12px 0; font-size: 18px;">
                    ${escapeHtml(post.title)}
                </h3>
                
                <div style="color: var(--fg-default); line-height: 1.6;">
                    ${escapeHtml(post.content)}
                </div>
            </div>
            
            <div style="background: var(--bg-subtle); border-top: 1px solid var(--border-default); padding: 8px; display: flex; gap: 8px;">
                <button style="background: none; border: none; color: var(--fg-muted); padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    ⬆️ Vote
                </button>
                <button style="background: none; border: none; color: var(--fg-muted); padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    💬 ${post.replies ? post.replies.length : 0}
                </button>
                ${currentUser && (currentUser.username === post.author || currentUser.profile?.isAdmin) ? `
                    <button onclick="deletePost('${post.id}')" style="background: none; border: none; color: var(--fg-muted); padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        🗑️ Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function renderCommunityPage() {
    const feed = document.getElementById('feed');
    if (!feed || !currentCommunity) return;
    
    const community = communities.find(c => c.name === currentCommunity);
    if (!community) {
        feed.innerHTML = '<div>Community not found</div>';
        return;
    }
    
    const communityPosts = posts.filter(post => 
        post.communityName === community.name && !post.isPrivate
    );
    
    feed.innerHTML = `
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
            <div style="display: flex; align-items: flex-start; gap: 24px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--accent-emphasis), var(--accent-fg)); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; color: white;">
                    ${community.displayName.charAt(0).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <h1 style="font-size: 32px; font-weight: 700; color: var(--fg-default); margin: 0 0 8px 0;">
                        ${escapeHtml(community.displayName)}
                    </h1>
                    <p style="font-size: 18px; color: var(--accent-fg); margin: 0 0 12px 0;">
                        c/${escapeHtml(community.name)}
                    </p>
                    ${community.description ? `<p style="color: var(--fg-muted); margin: 0;">${escapeHtml(community.description)}</p>` : ''}
                </div>
            </div>
        </div>
        
        ${communityPosts.length > 0 ? 
            communityPosts.map(post => renderPost(post)).join('') :
            `<div style="text-align: center; padding: 40px; background: var(--bg-default); border-radius: 8px;">
                <h3>No posts in this community yet!</h3>
                ${currentUser ? `<button class="btn" onclick="openModal('composeModal')">Create First Post</button>` : ''}
            </div>`
        }
    `;
}

function renderProfilePage() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!currentUser) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3>Please sign in to view your profile</h3>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        return;
    }
    
    const userPosts = posts.filter(post => 
        post.author === currentUser.username && !post.isPrivate
    );
    
    feed.innerHTML = `
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 24px;">
                <div style="width: 120px; height: 120px; background: linear-gradient(135deg, var(--accent-emphasis), var(--accent-fg)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 700; color: white;">
                    ${currentUser.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h1 style="font-size: 32px; font-weight: 700; color: var(--fg-default); margin: 0 0 8px 0;">
                        @${escapeHtml(currentUser.username)}
                    </h1>
                    ${currentUser.profile?.isAdmin ? '<div style="background: linear-gradient(135deg, var(--attention-fg), #f59e0b); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 12px;">👑 Administrator</div>' : ''}
                    <p style="color: var(--fg-muted); margin: 0;">
                        ${escapeHtml(currentUser.profile?.bio || currentUser.bio || `Hello! I'm ${currentUser.username}`)}
                    </p>
                </div>
            </div>
            
            <div style="display: flex; gap: 24px; padding-top: 20px; border-top: 1px solid var(--border-default); margin-top: 20px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px; font-weight: 700; color: var(--accent-fg);">${userPosts.length}</span>
                    <span style="color: var(--fg-muted);">public posts</span>
                </div>
            </div>
        </div>
        
        <h3 style="color: var(--fg-default); margin: 0 0 16px 0;">Your Public Posts</h3>
        
        ${userPosts.length > 0 ? 
            userPosts.map(post => renderPost(post)).join('') :
            `<div style="text-align: center; padding: 40px; background: var(--bg-default); border-radius: 8px;">
                <h3>No public posts yet!</h3>
                <button class="btn" onclick="openModal('composeModal')">Create Your First Post</button>
            </div>`
        }
    `;
}

function renderMyShedPage() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!currentUser) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3>🏠 My Shed</h3>
                <p>Please sign in to view your private posts</p>
                <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
            </div>
        `;
        return;
    }
    
    const privatePosts = posts.filter(post => 
        post.author === currentUser.username && post.isPrivate
    );
    
    feed.innerHTML = `
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h1 style="color: var(--fg-default); margin: 0 0 8px 0; font-size: 28px;">🏠 My Shed</h1>
            <p style="color: var(--fg-muted); margin: 0 0 16px 0;">Your private posts and personal content</p>
            
            <div style="display: flex; align-items: center; gap: 16px; padding-top: 16px; border-top: 1px solid var(--border-default);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px; font-weight: 600; color: var(--accent-fg);">${privatePosts.length}</span>
                    <span style="color: var(--fg-muted);">private posts</span>
                </div>
                <div style="color: var(--fg-muted); font-size: 14px;">Only visible to you</div>
            </div>
        </div>
        
        ${privatePosts.length > 0 ? 
            privatePosts.map(post => renderPost(post)).join('') :
            `<div style="text-align: center; padding: 40px; background: var(--bg-default); border-radius: 8px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <h3>No Private Posts Yet</h3>
                <p style="color: var(--fg-muted); margin: 16px 0;">Create private posts that only you can see.</p>
                <button class="btn" onclick="openModal('composeModal')">Create Private Post</button>
            </div>`
        }
    `;
}

function renderAdminPage() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!currentUser?.profile?.isAdmin) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3>🚫 Access Denied</h3>
                <p>Administrator privileges required</p>
                <button class="btn" onclick="navigateToFeed()">Return to Feed</button>
            </div>
        `;
        return;
    }
    
    const publicPosts = posts.filter(p => !p.isPrivate);
    
    feed.innerHTML = `
        <div style="background: linear-gradient(135deg, var(--danger-fg), #dc2626); color: white; border-radius: 12px; padding: 32px; margin-bottom: 24px; text-align: center;">
            <h1 style="margin: 0 0 8px 0; font-size: 32px;">🔧 Admin Panel</h1>
            <p style="margin: 0; opacity: 0.9;">Manage users, communities, and content</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 32px;">
            <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: var(--accent-fg);">1</div>
                <div style="color: var(--fg-muted); font-size: 14px;">Total Users</div>
            </div>
            <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: var(--accent-fg);">${communities.length}</div>
                <div style="color: var(--fg-muted); font-size: 14px;">Communities</div>
            </div>
            <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: var(--accent-fg);">${publicPosts.length}</div>
                <div style="color: var(--fg-muted); font-size: 14px;">Public Posts</div>
            </div>
        </div>
        
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px;">
            <h3 style="color: var(--fg-default); margin: 0 0 16px 0;">Admin Panel Active</h3>
            <p style="color: var(--fg-muted);">Welcome, Administrator! The system is running with localStorage.</p>
        </div>
    `;
}

// Event setup
function setupEventListeners() {
    const authForm = document.getElementById('authForm');
    if (authForm) authForm.addEventListener('submit', handleAuth);
    
    const createCommunityForm = document.getElementById('createCommunityForm');
    if (createCommunityForm) createCommunityForm.addEventListener('submit', handleCreateCommunity);
    
    const composeForm = document.getElementById('composeForm');
    if (composeForm) composeForm.addEventListener('submit', handleCreatePost);
    
    // Update community dropdown when compose modal opens
    const composeModal = document.getElementById('composeModal');
    if (composeModal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (composeModal.style.display === 'block') {
                        updateCommunityDropdown();
                    }
                }
            });
        });
        observer.observe(composeModal, { attributes: true });
    }
}

function updateCommunityDropdown() {
    const select = document.getElementById('postCommunity');
    if (!select) return;
    
    select.innerHTML = '<option value="">General Feed</option>';
    communities.forEach(community => {
        const option = document.createElement('option');
        option.value = community.name;
        option.textContent = community.displayName;
        select.appendChild(option);
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    await loadUser();
    await loadCommunities();
    await loadPosts();
    
    updateUI();
    setupEventListeners();
    
    console.log('App initialized successfully');
});
