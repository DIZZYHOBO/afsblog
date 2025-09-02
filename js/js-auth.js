// js/auth.js - Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
    }

    async loadStoredUser() {
        try {
            // Try to load from new API first, then fall back to blob storage
            const userData = await blobAPI.get(CONFIG.STORAGE_KEYS.CURRENT_USER);
            
            if (userData) {
                // Verify user still exists and is valid
                const fullProfile = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${userData.username}`);
                if (fullProfile) {
                    this.currentUser = { ...userData, profile: fullProfile };
                    State.set('currentUser', this.currentUser);
                    
                    // Load user's followed communities
                    await Communities.loadFollowedCommunities();
                    return true;
                }
            }
        } catch (error) {
            console.error('Error loading stored user:', error);
        }
        
        return false;
    }

    async login(username, password) {
        try {
            // Use blob API for now (legacy compatibility)
            const user = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`);
            
            if (!user) {
                const pendingUser = await blobAPI.get(`${CONFIG.STORAGE_KEYS.PENDING_USER_PREFIX}${username}`);
                if (pendingUser) {
                    throw new Error('Your account is still pending admin approval.');
                } else {
                    throw new Error('Invalid username or password');
                }
            }
            
            if (user.password !== password) {
                throw new Error('Invalid username or password');
            }
            
            this.currentUser = { username, profile: user };
            State.set('currentUser', this.currentUser);
            
            // Store current user
            await blobAPI.set(CONFIG.STORAGE_KEYS.CURRENT_USER, this.currentUser);
            
            // Load user's followed communities
            await Communities.loadFollowedCommunities();
            
            // Load admin stats if user is admin
            if (user.isAdmin && State.get('currentPage') === 'admin') {
                await Admin.loadStats();
            }
            
            return this.currentUser;
        } catch (error) {
            throw error;
        }
    }

    async register(username, password, bio = '') {
        try {
            // Validation
            if (!username || username.length < 3 || username.length > 20) {
                throw new Error('Username must be 3-20 characters long');
            }
            
            if (!CONFIG.VALIDATION.USERNAME.test(username)) {
                throw new Error('Username can only contain letters, numbers, and underscores');
            }
            
            if (!password || password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }
            
            if (bio && bio.length > CONFIG.MAX_BIO_LENGTH) {
                throw new Error(`Bio must be ${CONFIG.MAX_BIO_LENGTH} characters or less`);
            }

            // Check if user already exists
            const existingUser = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`);
            const pendingUser = await blobAPI.get(`${CONFIG.STORAGE_KEYS.PENDING_USER_PREFIX}${username}`);
            
            if (existingUser || pendingUser) {
                throw new Error('Username already exists or is pending approval');
            }
            
            const newPendingUser = { 
                username, 
                password,
                bio: bio || CONFIG.DEFAULTS.BIO.replace('new here', username),
                createdAt: new Date().toISOString(),
                status: 'pending',
                isAdmin: false
            };
            
            await blobAPI.set(`${CONFIG.STORAGE_KEYS.PENDING_USER_PREFIX}${username}`, newPendingUser);
            
            return {
                success: true,
                message: 'Account created! Waiting for admin approval.',
                status: 'pending'
            };
        } catch (error) {
            throw error;
        }
    }

    async logout() {
        try {
            // Clear stored user data
            try {
                await blobAPI.delete(CONFIG.STORAGE_KEYS.CURRENT_USER);
            } catch (deleteError) {
                // Ignore if key doesn't exist
                if (!deleteError.message.includes('404')) {
                    console.warn('Failed to delete current_user key:', deleteError);
                }
            }
            
            // Clear local state
            this.currentUser = null;
            this.authToken = null;
            State.reset();
            
            return { success: true, message: 'Logged out successfully' };
        } catch (error) {
            // Even if there's an error, still clear local state
            this.currentUser = null;
            this.authToken = null;
            State.reset();
            throw error;
        }
    }

    getCurrentUser() {
        return this.currentUser || State.get('currentUser');
    }

    isAuthenticated() {
        return this.getCurrentUser() !== null;
    }

    isAdmin() {
        const user = this.getCurrentUser();
        return user?.profile?.isAdmin === true;
    }

    hasPermission(permission) {
        const user = this.getCurrentUser();
        
        switch (permission) {
            case 'create_post':
            case 'create_reply':
            case 'follow_community':
                return this.isAuthenticated();
            
            case 'create_community':
                return this.isAuthenticated(); // All authenticated users can create communities
            
            case 'admin_panel':
            case 'approve_users':
            case 'manage_users':
            case 'delete_posts':
                return this.isAdmin();
            
            case 'edit_post':
            case 'delete_post':
                return (postAuthor) => {
                    return this.isAdmin() || (this.isAuthenticated() && user.username === postAuthor);
                };
            
            case 'edit_reply':
            case 'delete_reply':
                return (replyAuthor) => {
                    return this.isAdmin() || (this.isAuthenticated() && user.username === replyAuthor);
                };
            
            default:
                return false;
        }
    }

    // Check if user can be demoted (protects the protected admin)
    canDemoteUser(username) {
        if (!this.isAdmin()) return false;
        if (username === CONFIG.PROTECTED_ADMIN) return false;
        if (username === this.getCurrentUser()?.username) return false; // Can't demote self
        return true;
    }
}

// Handle form submissions
class AuthForms {
    static async handleAuthForm(e) {
        e.preventDefault();
        
        const form = e.target;
        const mode = form.dataset.mode;
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value;
        const bio = document.getElementById('bio')?.value.trim();
        const errorDiv = document.getElementById('authError');
        const submitBtn = document.getElementById('authSubmitBtn');

        if (!username || !password || !errorDiv || !submitBtn) return;

        errorDiv.innerHTML = '';
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Loading...';

            if (mode === 'signup') {
                const result = await Auth.register(username, password, bio);
                Modals.close('authModal');
                Utils.showSuccessMessage(result.message);
            } else {
                await Auth.login(username, password);
                Modals.close('authModal');
                App.updateUI();
                Utils.showSuccessMessage('Welcome back!');
            }
            
            form.reset();
            
        } catch (error) {
            console.error('Auth error:', error);
            Utils.showError('authError', error.message || 'Authentication failed');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
        }
    }

    static toggleAuthMode() {
        const form = document.getElementById('authForm');
        const currentMode = form?.dataset.mode;
        Modals.openAuth(currentMode === 'signup' ? 'signin' : 'signup');
    }
}

// Create global auth instance
const Auth = new AuthManager();
