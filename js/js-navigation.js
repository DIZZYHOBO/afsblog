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
