// js/navigation.js - Navigation Management Component
class NavigationManager {
    constructor() {
        this.isMenuOpen = false;
        this.currentPage = 'feed';
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Menu toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleMenu());
        }

        // Menu items
        this.setupMenuItems();

        // Auth form handlers
        this.setupAuthHandlers();

        // User menu
        this.setupUserMenu();

        // Subscribe to state changes
        State.addListener('currentUser', (user) => {
            this.updateNavigationForUser(user);
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('navigationMenu');
            const toggle = document.getElementById('menuToggle');
            
            if (menu && this.isMenuOpen && 
                !menu.contains(e.target) && 
                !toggle.contains(e.target)) {
                this.closeMenu();
            }
        });
    }

    setupMenuItems() {
        const menuItems = {
            'menuHome': () => this.navigateToFeed(),
            'menuCommunities': () => this.navigateToCommunities(),
            'menuProfile': () => this.navigateToProfile(),
            'menuAdmin': () => this.navigateToAdmin(),
            'menuSettings': () => this.navigateToSettings(),
            'menuLogout': () => this.logout()
        };

        Object.entries(menuItems).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    handler();
                    this.closeMenu();
                });
            }
        });
    }

    setupAuthHandlers() {
        // Inline login form
        const inlineLogin = document.getElementById('inlineLogin');
        const inlineRegister = document.getElementById('inlineRegister');

        if (inlineLogin) {
            inlineLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleInlineLogin();
            });
        }

        if (inlineRegister) {
            inlineRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAuthModal('register');
            });
        }

        // Enter key handlers for inline auth
        const usernameInput = document.getElementById('inlineUsername');
        const passwordInput = document.getElementById('inlinePassword');

        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    passwordInput?.focus();
                }
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleInlineLogin();
                }
            });
        }
    }

    setupUserMenu() {
        const userMenuToggle = document.getElementById('userMenuToggle');
        if (userMenuToggle) {
            userMenuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleUserMenu();
            });
        }
    }

    // Navigation methods
    navigateToFeed() {
        this.currentPage = 'feed';
        State.set('currentView', 'feed');
        Utils.updateUrl('/');
        this.renderFeedPage();
    }

    navigateToCommunities() {
        this.currentPage = 'communities';
        State.set('currentView', 'communities');
        Utils.updateUrl('/communities');
        this.renderCommunitiesPage();
    }

    navigateToProfile() {
        if (!State.getCurrentUser()) {
            this.openAuthModal('login');
            return;
        }
        
        this.currentPage = 'profile';
        State.set('currentView', 'profile');
        Utils.updateUrl('/profile');
        this.renderProfilePage();
    }

    navigateToAdmin() {
        const user = State.getCurrentUser();
        if (!user || user.role !== 'admin') {
            Utils.showErrorMessage('Admin access required');
            return;
        }
        
        this.currentPage = 'admin';
        State.set('currentView', 'admin');
        Utils.updateUrl('/admin');
        this.renderAdminPage();
    }

    navigateToSettings() {
        if (!State.getCurrentUser()) {
            this.openAuthModal('login');
            return;
        }
        
        this.currentPage = 'settings';
        State.set('currentView', 'settings');
        Utils.updateUrl('/settings');
        this.renderSettingsPage();
    }

    navigateToCommunity(communityName) {
        this.currentPage = 'community';
        State.set('currentView', 'community');
        State.set('currentCommunity', communityName);
        Utils.updateUrl(`/c/${communityName}`);
        this.renderCommunityPage(communityName);
    }

    navigateToPost(postId) {
        this.currentPage = 'post';
        State.set('currentView', 'post');
        State.set('currentPost', postId);
        Utils.updateUrl(`/p/${postId}`);
        this.renderPostPage(postId);
    }

    // Menu management
    toggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const menu = document.getElementById('navigationMenu');
        if (menu) {
            menu.classList.add('open');
            this.isMenuOpen = true;
        }
    }

    closeMenu() {
        const menu = document.getElementById('navigationMenu');
        if (menu) {
            menu.classList.remove('open');
            this.isMenuOpen = false;
        }
    }

    // User menu management
    toggleUserMenu() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.classList.toggle('menu-open');
        }
    }

    closeUserMenu() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.classList.remove('menu-open');
        }
    }

    // Authentication methods
    async handleInlineLogin() {
        const usernameInput = document.getElementById('inlineUsername');
        const passwordInput = document.getElementById('inlinePassword');
        
        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            Utils.showErrorMessage('Please enter both username and password');
            return;
        }

        try {
            const user = await Auth.login(username, password);
            
            // Clear form
            usernameInput.value = '';
            passwordInput.value = '';
            
            Utils.showSuccessMessage(`Welcome back, ${user.displayName}!`);
        } catch (error) {
            console.error('Inline login error:', error);
            Utils.showErrorMessage(error.message || 'Login failed');
        }
    }

    openAuthModal(mode = 'login') {
        Modals.switchAuthTab(mode);
        Modals.open('authModal');
    }

    async logout() {
        try {
            await Auth.logout();
            this.navigateToFeed();
            Utils.showSuccessMessage('Logged out successfully');
        } catch (error) {
            Utils.showErrorMessage(error.message || 'Logout failed');
        }
    }

    // UI Updates
    updateNavigationForUser(user) {
        this.updateAuthUI(user);
        this.updateMenuItems(user);
        this.updateUserInfo(user);
        this.closeUserMenu();
    }

    updateAuthUI(user) {
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');

        if (authContainer && userInfo) {
            if (user) {
                authContainer.style.display = 'none';
                userInfo.style.display = 'flex';
            } else {
                authContainer.style.display = 'block';
                userInfo.style.display = 'none';
            }
        }
    }

    updateMenuItems(user) {
        const menuItems = {
            'menuProfile': user !== null,
            'menuAdmin': user && user.role === 'admin',
            'menuSettings': user !== null,
            'menuLogout': user !== null
        };

        Object.entries(menuItems).forEach(([id, show]) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = show ? 'flex' : 'none';
            }
        });
    }

    updateUserInfo(user) {
        if (!user) return;

        const avatar = document.getElementById('userAvatar');
        const displayName = document.getElementById('userDisplayName');

        if (avatar) {
            avatar.src = user.avatar || CONFIG.DEFAULTS.AVATAR_FALLBACK;
            avatar.alt = user.displayName || user.username;
        }

        if (displayName) {
            displayName.textContent = user.displayName || user.username;
        }
    }

    // Page rendering methods
    renderFeedPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        // Show compose button if logged in
        const composeBtn = document.getElementById('composeBtn');
        if (composeBtn) {
            const user = State.getCurrentUser();
            composeBtn.style.display = user ? 'flex' : 'none';
            
            // Set up compose button click handler
            composeBtn.onclick = () => {
                Modals.populateComposeModal();
                Modals.open('composeModal');
            };
        }

        // Update feed tabs
        FeedTabs.updateTabsVisibility();

        // Render posts
        Posts.renderFeedPosts();
    }

    renderCommunitiesPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Communities.renderCommunitiesPage();
    }

    renderProfilePage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Profile.renderProfilePage();
    }

    renderAdminPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Admin.renderAdminPage();
    }

    renderSettingsPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        feed.innerHTML = `
            <div class="settings-page">
                <div class="settings-header">
                    <h1>Settings</h1>
                </div>
                <div class="settings-content">
                    <div class="settings-section">
                        <h2>Account Settings</h2>
                        <button class="btn btn-primary" onclick="Modals.populateEditProfileModal(); Modals.open('editProfileModal');">
                            Edit Profile
                        </button>
                    </div>
                    <div class="settings-section">
                        <h2>Preferences</h2>
                        <p>More settings coming soon...</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderCommunityPage(communityName) {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Communities.renderCommunityPage(communityName);
    }

    renderPostPage(postId) {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Posts.renderPostPage(postId);
    }

    // Browser history handling
    handlePopState(event) {
        const path = window.location.pathname;
        
        if (path === '/' || path === '/feed') {
            this.navigateToFeed();
        } else if (path === '/communities') {
            this.navigateToCommunities();
        } else if (path === '/profile') {
            this.navigateToProfile();
        } else if (path === '/admin') {
            this.navigateToAdmin();
        } else if (path === '/settings') {
            this.navigateToSettings();
        } else if (path.startsWith('/c/')) {
            const communityName = path.substring(3);
            this.navigateToCommunity(communityName);
        } else if (path.startsWith('/p/')) {
            const postId = path.substring(3);
            this.navigateToPost(postId);
        }
    }

    // Utility methods
    getCurrentPage() {
        return this.currentPage;
    }

    isCurrentPage(pageName) {
        return this.currentPage === pageName;
    }

    refreshCurrentPage() {
        switch (this.currentPage) {
            case 'feed':
                this.renderFeedPage();
                break;
            case 'communities':
                this.renderCommunitiesPage();
                break;
            case 'profile':
                this.renderProfilePage();
                break;
            case 'admin':
                this.renderAdminPage();
                break;
            case 'settings':
                this.renderSettingsPage();
                break;
            default:
                this.renderFeedPage();
        }
    }
}

// Create global Navigation instance
window.Navigation = new NavigationManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationManager, Navigation: window.Navigation };
}this.renderPostPage(postId);
    }

    // Menu management
    toggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const menu = document.getElementById('navigationMenu');
        if (menu) {
            menu.classList.add('open');
            this.isMenuOpen = true;
        }
    }

    closeMenu() {
        const menu = document.getElementById('navigationMenu');
        if (menu) {
            menu.classList.remove('open');
            this.isMenuOpen = false;
        }
    }

    // User menu management
    toggleUserMenu() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.classList.toggle('menu-open');
        }
    }

    closeUserMenu() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.classList.remove('menu-open');
        }
    }

    // Authentication methods
    async handleInlineLogin() {
        const usernameInput = document.getElementById('inlineUsername');
        const passwordInput = document.getElementById('inlinePassword');
        
        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            Utils.showErrorMessage('Please enter both username and password');
            return;
        }

        try {
            const user = await Auth.login(username, password);
            
            // Clear form
            usernameInput.value = '';
            passwordInput.value = '';
            
            Utils.showSuccessMessage(`Welcome back, ${user.displayName}!`);
        } catch (error) {
            console.error('Inline login error:', error);
            Utils.showErrorMessage(error.message || 'Login failed');
        }
    }

    openAuthModal(mode = 'login') {
        Modals.switchAuthTab(mode);
        Modals.open('authModal');
    }

    async logout() {
        try {
            await Auth.logout();
            this.navigateToFeed();
            Utils.showSuccessMessage('Logged out successfully');
        } catch (error) {
            Utils.showErrorMessage(error.message || 'Logout failed');
        }
    }

    // UI Updates
    updateNavigationForUser(user) {
        this.updateAuthUI(user);
        this.updateMenuItems(user);
        this.updateUserInfo(user);
        this.closeUserMenu();
    }

    updateAuthUI(user) {
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');

        if (authContainer && userInfo) {
            if (user) {
                authContainer.style.display = 'none';
                userInfo.style.display = 'flex';
            } else {
                authContainer.style.display = 'block';
                userInfo.style.display = 'none';
            }
        }
    }

    updateMenuItems(user) {
        const menuItems = {
            'menuProfile': user !== null,
            'menuAdmin': user && user.role === 'admin',
            'menuSettings': user !== null,
            'menuLogout': user !== null
        };

        Object.entries(menuItems).forEach(([id, show]) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = show ? 'flex' : 'none';
            }
        });
    }

    updateUserInfo(user) {
        if (!user) return;

        const avatar = document.getElementById('userAvatar');
        const displayName = document.getElementById('userDisplayName');

        if (avatar) {
            avatar.src = user.avatar || CONFIG.DEFAULTS.AVATAR_FALLBACK;
            avatar.alt = user.displayName || user.username;
        }

        if (displayName) {
            displayName.textContent = user.displayName || user.username;
        }
    }

    // Page rendering methods
    renderFeedPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        // Show compose button if logged in
        const composeBtn = document.getElementById('composeBtn');
        if (composeBtn) {
            const user = State.getCurrentUser();
            composeBtn.style.display = user ? 'flex' : 'none';
            
            // Set up compose button click handler
            composeBtn.onclick = () => {
                Modals.populateComposeModal();
                Modals.open('composeModal');
            };
        }

        // Update feed tabs
        FeedTabs.updateTabsVisibility();

        // Render posts
        Posts.renderFeedPosts();
    }

    renderCommunitiesPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Communities.renderCommunitiesPage();
    }

    renderProfilePage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Profile.renderProfilePage();
    }

    renderAdminPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Admin.renderAdminPage();
    }

    renderSettingsPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        feed.innerHTML = `
            <div class="settings-page">
                <div class="settings-header">
                    <h1>Settings</h1>
                </div>
                <div class="settings-content">
                    <div class="settings-section">
                        <h2>Account Settings</h2>
                        <button class="btn btn-primary" onclick="Modals.populateEditProfileModal(); Modals.open('editProfileModal');">
                            Edit Profile
                        </button>
                    </div>
                    <div class="settings-section">
                        <h2>Preferences</h2>
                        <p>More settings coming soon...</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderCommunityPage(communityName) {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Communities.renderCommunityPage(communityName);
    }

    renderPostPage(postId) {
        const feed = document.getElementById('feed');
        if (!feed) return;

        Posts.renderPostPage(postId);
    }

    // Browser history handling
    handlePopState(event) {
        const path = window.location.pathname;
        
        if (path === '/' || path === '/feed') {
            this.navigateToFeed();
        } else if (path === '/communities') {
            this.navigateToCommunities();
        } else if (path === '/profile') {
            this.navigateToProfile();
        } else if (path === '/admin') {
            this.navigateToAdmin();
        } else if (path === '/settings') {
            this.navigateToSettings();
        } else if (path.startsWith('/c/')) {
            const communityName = path.substring(3);
            this.navigateToCommunity(communityName);
        } else if (path.startsWith('/p/')) {
            const postId = path.substring(3);
            this.navigateToPost(postId);
        }
    }

    // Utility methods
    getCurrentPage() {
        return this.currentPage;
    }

    isCurrentPage(pageName) {
        return this.currentPage === pageName;
    }

    refreshCurrentPage() {
        switch (this.currentPage) {
            case 'feed':
                this.renderFeedPage();
                break;
            case 'communities':
                this.renderCommunitiesPage();
                break;
            case 'profile':
                this.renderProfilePage();
                break;
            case 'admin':
                this.renderAdminPage();
                break;
            case 'settings':
                this.renderSettingsPage();
                break;
            default:
                this.renderFeedPage();
        }
    }
}

// Create global Navigation instance
window.Navigation = new NavigationManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationManager, Navigation: window.Navigation };
}
