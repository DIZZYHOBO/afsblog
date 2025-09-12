// app.js - COMPLETE PRODUCTION MAIN APPLICATION LOGIC WITH SETTINGS
// Main application logic with full API integration and theme support

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
                <div class="login-prompt-title">Welcome to The Shed</div>
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
                            <input type="password" id="inlinePassword" required minlength="9">
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
        
        const response = wasFollowing ? 
            await secureAPI.unfollowCommunity(communityName) :
            await secureAPI.followCommunity(communityName);
        
        if (response.success) {
            if (response.following) {
                followedCommunities.add(communityName);
                followBtn.textContent = '✓ Following';
                followBtn.className = 'btn btn-secondary';
                showSuccessMessage(`Now following ${communityName}! 🎉`);
            } else {
                followedCommunities.delete(communityName);
                followBtn.textContent = '+ Follow';
                followBtn.className = 'btn';
                showSuccessMessage(`Unfollowed ${communityName}`);
            }
            
            // Update member count if available
            if (response.memberCount !== undefined) {
                updateCommunityMemberCount(communityName, response.memberCount);
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

// Check if following
async function checkIfFollowing(communityName) {
    try {
        return followedCommunities.has(communityName);
    } catch (error) {
        console.error('Error checking follow status:', error);
        return false;
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
    
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleUpdateProfile);
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
        // If user is logged in, include their private posts
        if (currentUser) {
            posts = await secureAPI.getPosts({ includePrivate: true });
        } else {
            posts = await secureAPI.getPosts();
        }
        console.log('Loaded posts:', posts.length);
        
        // Log private posts for debugging
        const privatePosts = posts.filter(p => p.isPrivate);
        console.log('Private posts loaded:', privatePosts.length);
        if (privatePosts.length > 0) {
            console.log('Private posts:', privatePosts);
        }
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
            adminData = await secureAPI.getAdminStats();
            console.log('Loaded admin stats:', adminData);
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Admin-specific data loading
async function loadPendingUsersList() {
    try {
        if (currentUser?.profile?.isAdmin) {
            return await secureAPI.getPendingUsers();
        }
        return [];
    } catch (error) {
        console.error('Error loading pending users:', error);
        return [];
    }
}

async function loadAllUsersList() {
    try {
        if (currentUser?.profile?.isAdmin) {
            return await secureAPI.getAllUsers();
        }
        return [];
    } catch (error) {
        console.error('Error loading all users:', error);
        return [];
    }
}

async function loadAllCommunitiesList() {
    try {
        // This doesn't need admin privileges
        return await secureAPI.getCommunities();
    } catch (error) {
        console.error('Error loading communities list:', error);
        return [];
    }
}

// Authentication functions using secure API
async function logout() {
    try {
        await secureAPI.logout();
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        // Force logout even if API fails
        secureAPI.clearAuthData();
        location.reload();
    }
}

async function handleAuth(e) {
    e.preventDefault();
    
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

async function handleCreateCommunity(e) {
    e.preventDefault();
    
    const name = document.getElementById('communityName')?.value?.trim();
    const displayName = document.getElementById('communityDisplayName')?.value?.trim();
    const description = document.getElementById('communityDescription')?.value?.trim();
    
    if (!name || !displayName) {
        showSuccessMessage('Community name and display name are required');
        return;
    }
    
    try {
        const submitBtn = document.getElementById('createCommunitySubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        const response = await secureAPI.createCommunity({
            name,
            displayName,
            description
        });
        
        if (response.success) {
            showSuccessMessage('Community created successfully! 🎉');
            closeModal('createCommunityModal');
            // Reload communities
            await loadCommunities();
            updateCommunitiesInMenu();
            // Navigate to the new community
            navigateToCommunity(name);
        } else {
            showSuccessMessage(response.error || 'Failed to create community');
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = '🔨 Build Shed';
    } catch (error) {
        console.error('Create community error:', error);
        showSuccessMessage(error.message || 'Failed to create community');
        
        const submitBtn = document.getElementById('createCommunitySubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🔨 Build Shed';
        }
    }
}

async function handleCreatePost(e) {
    e.preventDefault();
    
    const title = document.getElementById('postTitle')?.value?.trim();
    const content = document.getElementById('postContent')?.value?.trim();
    const url = document.getElementById('postUrl')?.value?.trim();
    const description = document.getElementById('postDescription')?.value?.trim();
    const communityName = document.getElementById('postCommunity')?.value;
    const isPrivate = document.getElementById('isPrivate')?.checked || false;
    
    if (!title) {
        showSuccessMessage('Post title is required');
        return;
    }
    
    if (currentPostType === 'text' && !content) {
        showSuccessMessage('Post content is required');
        return;
    }
    
    if (currentPostType === 'link' && !url) {
        showSuccessMessage('Post URL is required');
        return;
    }
    
    try {
        const submitBtn = document.getElementById('composeSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        
        const postData = {
            title,
            type: currentPostType,
            content: currentPostType === 'text' ? content : description,
            url: currentPostType === 'link' ? url : null,
            communityName: communityName || null,
            isPrivate
        };
        
        const response = await secureAPI.createPost(postData);
        
        if (response.success) {
            showSuccessMessage('Post created successfully! 🎉');
            closeModal('composeModal');
            // Reload posts
            await loadPosts();
            renderCurrentPage();
        } else {
            showSuccessMessage(response.error || 'Failed to create post');
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    } catch (error) {
        console.error('Create post error:', error);
        showSuccessMessage(error.message || 'Failed to create post');
        
        const submitBtn = document.getElementById('composeSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        }
    }
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    
    const profilePicture = document.getElementById('editProfilePicture')?.value?.trim();
    const bio = document.getElementById('editProfileBio')?.value?.trim();
    
    try {
        const submitBtn = document.getElementById('editProfileSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
        
        const response = await secureAPI.updateProfile({
            profilePicture,
            bio
        });
        
        if (response.success) {
            showSuccessMessage('Profile updated successfully!');
            closeModal('editProfileModal');
            // Refresh profile page
            renderProfilePage();
        } else {
            showError('editProfileError', response.error || 'Failed to update profile');
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Profile';
    } catch (error) {
        console.error('Update profile error:', error);
        showError('editProfileError', error.message || 'Failed to update profile');
        
        const submitBtn = document.getElementById('editProfileSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Profile';
        }
    }
}

// Post actions
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }
    
    try {
        const response = await secureAPI.deletePost(postId);
        
        if (response.success) {
            showSuccessMessage('Post deleted successfully');
            await loadPosts();
            renderCurrentPage();
        } else {
            showSuccessMessage(response.error || 'Failed to delete post');
        }
    } catch (error) {
        console.error('Delete post error:', error);
        showSuccessMessage(error.message || 'Failed to delete post');
    }
}

// Reply actions
async function submitReply(postId) {
    const replyInput = document.getElementById(`reply-input-${postId}`);
    const content = replyInput?.value?.trim();
    
    if (!content) {
        showSuccessMessage('Reply cannot be empty');
        return;
    }
    
    try {
        replyInput.disabled = true;
        
        const response = await secureAPI.createReply(postId, content);
        
        if (response.success) {
            showSuccessMessage('Reply posted!');
            replyInput.value = '';
            // Reload posts to get updated replies
            await loadPosts();
            renderCurrentPage();
        } else {
            showSuccessMessage(response.error || 'Failed to post reply');
        }
        
        replyInput.disabled = false;
    } catch (error) {
        console.error('Submit reply error:', error);
        showSuccessMessage(error.message || 'Failed to post reply');
        
        if (replyInput) {
            replyInput.disabled = false;
        }
    }
}

async function deleteReply(postId, replyId) {
    if (!confirm('Are you sure you want to delete this reply?')) {
        return;
    }
    
    try {
        const response = await secureAPI.deleteReply(postId, replyId);
        
        if (response.success) {
            showSuccessMessage('Reply deleted successfully');
            await loadPosts();
            renderCurrentPage();
        } else {
            showSuccessMessage(response.error || 'Failed to delete reply');
        }
    } catch (error) {
        console.error('Delete reply error:', error);
        showSuccessMessage(error.message || 'Failed to delete reply');
    }
}

// Admin actions
async function approveUser(username, pendingKey) {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Admin privileges required');
        return;
    }

    if (!confirm(`Approve user @${username}?`)) return;
    
    try {
        const response = await secureAPI.approveUser(username, pendingKey);
        
        if (response.success) {
            showSuccessMessage('User approved successfully');
            // Reload admin page
            renderAdminPage();
        } else {
            showSuccessMessage(response.error || 'Failed to approve user');
        }
    } catch (error) {
        console.error('Error approving user:', error);
        showSuccessMessage('Failed to approve user');
    }
}

async function rejectUser(username, pendingKey) {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Admin privileges required');
        return;
    }

    if (!confirm(`Reject user @${username}?`)) return;
    
    try {
        const response = await secureAPI.rejectUser(username, pendingKey);
        
        if (response.success) {
            showSuccessMessage('User rejected');
            // Reload admin page
            renderAdminPage();
        } else {
            showSuccessMessage(response.error || 'Failed to reject user');
        }
    } catch (error) {
        console.error('Error rejecting user:', error);
        showSuccessMessage('Failed to reject user');
    }
}

async function promoteToAdmin(username) {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Admin privileges required');
        return;
    }

    if (!confirm(`Promote @${username} to admin?`)) return;
    
    try {
        const response = await secureAPI.promoteToAdmin(username);
        
        if (response.success) {
            showSuccessMessage('User promoted to admin');
            renderAdminPage();
        } else {
            showSuccessMessage(response.error || 'Failed to promote user');
        }
    } catch (error) {
        console.error('Error promoting user:', error);
        showSuccessMessage('Failed to promote user');
    }
}

async function demoteFromAdmin(username) {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Admin privileges required');
        return;
    }

    if (!confirm(`Remove admin privileges from @${username}?`)) return;
    
    try {
        const response = await secureAPI.demoteFromAdmin(username);
        
        if (response.success) {
            showSuccessMessage('Admin privileges removed');
            renderAdminPage();
        } else {
            showSuccessMessage(response.error || 'Failed to demote user');
        }
    } catch (error) {
        console.error('Error demoting user:', error);
        showSuccessMessage('Failed to demote user');
    }
}

async function deleteUser(username) {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Admin privileges required');
        return;
    }

    if (!confirm(`Permanently delete user @${username}? This action cannot be undone.`)) return;
    
    try {
        const response = await secureAPI.deleteUser(username);
        
        if (response.success) {
            showSuccessMessage('User deleted successfully');
            renderAdminPage();
        } else {
            showSuccessMessage(response.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showSuccessMessage('Failed to delete user');
    }
}

async function deleteCommunity(communityName) {
    if (!currentUser?.profile?.isAdmin) {
        showSuccessMessage('Admin privileges required');
        return;
    }

    if (!confirm(`Permanently delete community "${communityName}"? This action cannot be undone.`)) return;
    
    try {
        const response = await secureAPI.deleteCommunity(communityName);
        
        if (response.success) {
            showSuccessMessage('Community deleted successfully');
            await loadCommunities();
            renderAdminPage();
        } else {
            showSuccessMessage(response.error || 'Failed to delete community');
        }
    } catch (error) {
        console.error('Error deleting community:', error);
        showSuccessMessage('Failed to delete community');
    }
}

// Admin tab switching
let currentAdminTab = 'pending';

function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    
    // Update tab visual states
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update content visibility
    document.querySelectorAll('.admin-tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const activePanel = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Content`);
    if (activePanel) {
        activePanel.classList.add('active');
    }
}

// Filter admin posts
let currentPostFilter = 'all';

function filterAdminPosts(filter) {
    currentPostFilter = filter;
    
    // Update button states
    document.querySelectorAll('#adminPostsContent .btn-secondary').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}Posts`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Filter posts
    const publicPosts = posts.filter(post => !post.isPrivate);
    let filteredPosts = publicPosts;
    
    if (filter === 'community') {
        filteredPosts = publicPosts.filter(p => p.communityName);
    } else if (filter === 'general') {
        filteredPosts = publicPosts.filter(p => !p.communityName);
    }
    
    // Render filtered posts
    const postsList = document.getElementById('adminPostsList');
    if (postsList) {
        postsList.innerHTML = renderPostList(filteredPosts.slice(0, 20), 'No posts found');
        
        if (filteredPosts.length > 20) {
            postsList.innerHTML += `
                <div class="admin-load-more">
                    <button class="btn btn-secondary" onclick="loadMoreAdminPosts()">
                        Load More Posts
                    </button>
                </div>
            `;
        }
    }
}

let adminPostsOffset = 20;

function loadMoreAdminPosts() {
    const publicPosts = posts.filter(post => !post.isPrivate);
    let filteredPosts = publicPosts;
    
    if (currentPostFilter === 'community') {
        filteredPosts = publicPosts.filter(p => p.communityName);
    } else if (currentPostFilter === 'general') {
        filteredPosts = publicPosts.filter(p => !p.communityName);
    }
    
    const nextPosts = filteredPosts.slice(adminPostsOffset, adminPostsOffset + 20);
    const postsList = document.getElementById('adminPostsList');
    
    if (postsList && nextPosts.length > 0) {
        // Remove the load more button first
        const loadMoreBtn = postsList.querySelector('.admin-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.remove();
        }
        
        // Add new posts
        postsList.innerHTML += renderPostList(nextPosts, '');
        
        adminPostsOffset += 20;
        
        // Add load more button if there are more posts
        if (adminPostsOffset < filteredPosts.length) {
            postsList.innerHTML += `
                <div class="admin-load-more">
                    <button class="btn btn-secondary" onclick="loadMoreAdminPosts()">
                        Load More Posts
                    </button>
                </div>
            `;
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    // Apply saved theme
    applyTheme(currentTheme);
    
    // Configure marked.js for markdown rendering
    if (typeof marked !== 'undefined') {
        try {
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false,
                pedantic: false,
                smartLists: true,
                smartypants: false
            });
            console.log('Marked.js configured successfully');
        } catch (error) {
            console.error('Error configuring marked.js:', error);
        }
    } else {
        console.warn('Marked.js library not loaded');
    }
    
    // Setup markdown renderer
    if (typeof marked !== 'undefined') {
        window.markdownRenderer = new marked.Renderer();
        
        // Custom link renderer - open in new tab
        window.markdownRenderer.link = function(href, title, text) {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${text}</a>`;
        };
        
        // Custom image renderer
        window.markdownRenderer.image = function(href, title, text) {
            return `<img src="${href}" alt="${text}" title="${title || ''}" style="max-width: 100%; height: auto; border-radius: 8px;" onclick="openImageModal('${href}')" />`;
        };
        
        // Custom code block renderer with syntax highlighting
        window.markdownRenderer.code = function(code, language) {
            if (typeof hljs !== 'undefined' && language) {
                try {
                    const highlighted = hljs.highlight(code, { language }).value;
                    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
                } catch (error) {
                    console.error('Syntax highlighting error:', error);
                }
            }
            return `<pre><code>${escapeHtml(code)}</code></pre>`;
        };
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
