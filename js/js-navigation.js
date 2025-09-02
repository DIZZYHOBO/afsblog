// js/navigation.js - Navigation Management
class NavigationManager {
    constructor() {
        this.isMenuOpen = false;
        this.inlineLoginFormOpen = false;
        
        this.initializeEventListeners();
        this.subscribeToStateChanges();
    }

    initializeEventListeners() {
        // Menu overlay click
        document.getElementById('menuOverlay')?.addEventListener('click', () => {
            this.toggleMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('slideMenu');
            const menuToggle = document.getElementById('menuToggle');
            
            if (this.isMenuOpen && 
                !menu.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                this.toggleMenu();
            }
        });
    }

    subscribeToStateChanges() {
        // Update menu when user changes
        State.subscribe('currentUser', () => {
            if (this.isMenuOpen) {
                this.updateMenuContent();
            }
        });

        // Update active menu item when page changes
        State.subscribe('currentPage', (page) => {
            this.updateActiveMenuItem(page);
        });
    }

    toggleMenu() {
        const menu = document.getElementById('slideMenu');
        const overlay = document.getElementById('menuOverlay');
        
        this.isMenuOpen = !this.isMenuOpen;
        
        if (this.isMenuOpen) {
            menu.classList.add('open');
            overlay.classList.add('active');
            this.updateMenuContent();
        } else {
            menu.classList.remove('open');
            overlay.classList.remove('active');
        }
    }

    updateMenuContent() {
        const menuHeader = document.getElementById('slideMenu');
        const currentUser = State.getCurrentUser();
        
        if (!menuHeader) return;
        
        if (currentUser) {
            this.renderAuthenticatedMenu(currentUser);
        } else {
            this.renderUnauthenticatedMenu();
        }
    }

    renderAuthenticatedMenu(user) {
        const menuHeader = document.querySelector('#slideMenu .menu-header');
        if (!menuHeader) return;

        // Update user info in header
        const profilePicture = user.profile?.profilePicture;
        
        menuHeader.innerHTML = `
            <div class="menu-user-info">
                ${profilePicture ? `
                    <img src="${profilePicture}" 
                         alt="Profile" 
                         class="profile-avatar"
                         style="border-radius: 50%; object-fit: cover;"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="profile-avatar" style="display: none;">${user.username.charAt(0).toUpperCase()}</div>
                ` : `
                    <div class="profile-avatar">${user.username.charAt(0).toUpperCase()}</div>
                `}
                <div class="menu-user-details">
                    <h4>@${Utils.escapeHtml(user.username)}</h4>
                    <p>${user.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                </div>
            </div>
        `;

        // Show authenticated menu items
        this.toggleMenuItems({
            'menuProfile': true,
            'menuCreateCommunity': true,
            'menuBrowseCommunities': true,
            'menuSettings': true,
            'menuAdmin': user.profile?.isAdmin,
            'menuLogout': true
        });

        this.updateCommunitiesInMenu();
    }

    renderUnauthenticatedMenu() {
        const menuHeader = document.querySelector('#slideMenu .menu-header');
        if (!menuHeader) return;

        menuHeader.innerHTML = `
            <div class="login-prompt">
                <div class="login-prompt-title">Click here to log in</div>
                <button class="login-toggle-btn" onclick="Navigation.toggleInlineLoginForm()">Login</button>
                <div class="inline-login-form" id="inlineLoginForm">
                    <div id="inlineLoginError"></div>
                    <form id="inlineLoginFormElement" onsubmit="Navigation.handleInlineLogin(event)">
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
                            <button type="button" class="inline-btn-secondary" onclick="Modals.openAuth('signup'); Navigation.toggleMenu();">Sign Up</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Hide authenticated menu items
        this.toggleMenuItems({
            'menuProfile': false,
            'menuCreateCommunity': false,
            'menuBrowseCommunities': false,
            'menuAdmin': false,
            'menuSettings': false,
            'menuLogout': false
        });
    }

    toggleMenuItems(itemVisibility) {
        Object.entries(itemVisibility).forEach(([id, visible]) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = visible ? 'flex' : 'none';
            }
        });
    }

    toggleInlineLoginForm() {
        const form = document.getElementById('inlineLoginForm');
        if (!form) return;

        this.inlineLoginFormOpen = !this.inlineLoginFormOpen;
        
        if (this.inlineLoginFormOpen) {
            form.classList.add('open');
            setTimeout(() => {
                document.getElementById('inlineUsername')?.focus();
            }, 300);
        } else {
            form.classList.remove('open');
        }
    }

    async handleInlineLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('inlineUsername')?.value.trim();
        const password = document.getElementById('inlinePassword')?.value;
        const errorDiv = document.getElementById('inlineLoginError');
        const submitBtn = document.getElementById('inlineLoginBtn');

        if (!username || !password) {
            this.showInlineError('Please enter both username and password');
            return;
        }

        if (!errorDiv || !submitBtn) return;

        errorDiv.innerHTML = '';
        
        if (username.length < 3) {
            this.showInlineError('Username must be at least 3 characters long');
            return;
        }
        
        if (password.length < 6) {
            this.showInlineError('Password must be at least 6 characters long');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            await Auth.login(username, password);
            
            // Clear the form
            document.getElementById('inlineLoginFormElement')?.reset();
            
            // Close menu
            this.toggleMenu();
            
            // Update the app UI
            App.updateUI();
            
            Utils.showSuccessMessage('Welcome back!');
            
        } catch (error) {
            console.error('Inline login error:', error);
            this.showInlineError(error.message || 'Login failed. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    }

    showInlineError(message) {
        const errorDiv = document.getElementById('inlineLoginError');
        if (errorDiv) {
            errorDiv.innerHTML = `<div class="inline-error-message">${Utils.escapeHtml(message)}</div>`;
        }
    }

    updateCommunitiesInMenu() {
        const dropdown = document.getElementById('communitiesDropdown');
        if (!dropdown) return;
        
        const communities = State.get('communities');
        
        if (communities.length === 0) {
            dropdown.innerHTML = '<div class="community-item">No communities yet</div>';
        } else {
            dropdown.innerHTML = communities.map(community => `
                <a href="#" class="community-item" onclick="Navigation.navigateToCommunity('${community.name}'); return false;">
                    c/${Utils.escapeHtml(community.displayName)}
                </a>
            `).join('');
        }
    }

    toggleCommunitiesDropdown() {
        const dropdown = document.getElementById('communitiesDropdown');
        const toggle = document.getElementById('communitiesToggle');
        
        if (!dropdown || !toggle) return;
        
        const isOpen = dropdown.classList.contains('open');
        
        if (isOpen) {
            dropdown.classList.remove('open');
            toggle.textContent = '▼';
        } else {
            dropdown.classList.add('open');
            toggle.textContent = '▲';
        }
    }

    updateActiveMenuItem(page) {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const menuItemId = this.getMenuItemId(page);
        const activeItem = document.getElementById(menuItemId);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    getMenuItemId(page) {
        const pageToMenuMap = {
            'feed': 'menuFeed',
            'profile': 'menuProfile',
            'admin': 'menuAdmin',
            'community': 'menuFeed' // Community pages show feed as active
        };
        
        return pageToMenuMap[page] || 'menuFeed';
    }

    // Navigation methods
    navigateToFeed() {
        this.toggleMenu();
        StateHelpers.navigateToPage('feed');
        App.updateUI();
    }

    navigateToProfile() {
        if (!State.isAuthenticated()) {
            Modals.openAuth('signin');
            return;
        }
        this.toggleMenu();
        StateHelpers.navigateToPage('profile');
        App.updateUI();
    }

    navigateToCommunity(communityName) {
        this.toggleMenu();
        StateHelpers.navigateToCommunity(communityName);
        App.updateUI();
    }

    navigateToAdmin() {
        if (!State.isAdmin()) {
            Utils.showSuccessMessage('Access denied. Admin privileges required.');
            return;
        }
        this.toggleMenu();
        StateHelpers.navigateToPage('admin');
        App.updateUI();
    }

    openCreateCommunity() {
        this.toggleMenu();
        if (!State.isAuthenticated()) {
            Modals.openAuth('signin');
            return;
        }
        Modals.open('createCommunityModal');
    }

    navigateToSettings() {
        this.toggleMenu();
        Utils.showSuccessMessage('Settings page coming soon!');
    }

    async logout() {
        try {
            await Auth.logout();
            this.toggleMenu();
            App.updateUI();
            Utils.showSuccessMessage('Logged out successfully!');
        } catch (error) {
            console.error('Logout error:', error);
            // Still proceed with logout even if API call fails
            State.reset();
            this.toggleMenu();
            App.updateUI();
            Utils.showSuccessMessage('Logged out successfully!');
        }
    }
}

// Create global navigation instance
const Navigation = new NavigationManager();
