// js/auth.js - Authentication Management Component
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for storage changes (multi-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === CONFIG.STORAGE_KEYS.CURRENT_USER) {
                this.handleStorageChange(e);
            }
        });
    }

    // Load stored user from localStorage
    async loadStoredUser() {
        try {
            const userKey = CONFIG.STORAGE_KEYS.CURRENT_USER;
            const userData = await blobAPI.get(userKey);
            
            if (userData && userData.username) {
                // Verify user still exists and is active
                const fullUserData = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${userData.username}`);
                
                if (fullUserData && fullUserData.status === 'active') {
                    State.setCurrentUser(fullUserData);
                    this.currentUser = fullUserData;
                    return fullUserData;
                } else {
                    // User no longer exists or is inactive, clear stored data
                    await this.clearStoredUser();
                }
            }
        } catch (error) {
            console.error('Error loading stored user:', error);
            await this.clearStoredUser();
        }
        return null;
    }

    // Store current user
    async storeCurrentUser(userData) {
        try {
            const userKey = CONFIG.STORAGE_KEYS.CURRENT_USER;
            const storageData = {
                username: userData.username,
                id: userData.id,
                timestamp: Date.now()
            };
            await blobAPI.set(userKey, storageData);
        } catch (error) {
            console.error('Error storing user data:', error);
        }
    }

    // Clear stored user
    async clearStoredUser() {
        try {
            const userKey = CONFIG.STORAGE_KEYS.CURRENT_USER;
            await blobAPI.delete(userKey);
        } catch (error) {
            console.error('Error clearing stored user:', error);
        }
    }

    // Login user
    async login(username, password) {
        try {
            const userData = await authAPI.login(username, password);
            
            this.currentUser = userData;
            State.setCurrentUser(userData);
            
            // Store user session
            await this.storeCurrentUser(userData);
            
            // Load user's follows
            await this.loadUserFollows(userData.id);
            
            return userData;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Register new user
    async register(username, password, displayName, bio) {
        try {
            const userData = await authAPI.register(username, password, displayName, bio);
            
            this.currentUser = userData;
            State.setCurrentUser(userData);
            
            // Store user session
            await this.storeCurrentUser(userData);
            
            return userData;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    // Logout user
    async logout() {
        try {
            // Clear stored user data
            await this.clearStoredUser();
            
            // Clear state
            this.currentUser = null;
            State.setCurrentUser(null);
            State.setFollows({});
            
            // Clear any cached data
            State.setReplies({});
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    // Update user profile
    async updateProfile(updates) {
        try {
            if (!this.currentUser) {
                throw new Error('Not authenticated');
            }

            const updatedUser = await authAPI.updateProfile(this.currentUser.username, updates);
            
            this.currentUser = updatedUser;
            State.setCurrentUser(updatedUser);
            
            // Update stored user
            await this.storeCurrentUser(updatedUser);
            
            return updatedUser;
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    }

    // Load user's followed communities
    async loadUserFollows(userId) {
        try {
            const follows = await communitiesAPI.getFollowing(userId);
            State.setFollows(follows);
            return follows;
        } catch (error) {
            console.error('Error loading user follows:', error);
            State.setFollows({});
            return {};
        }
    }

    // Follow/unfollow a community
    async toggleFollowCommunity(communityName, isFollowing) {
        try {
            if (!this.currentUser) {
                throw new Error('Not authenticated');
            }

            const follows = await communitiesAPI.setFollowing(
                this.currentUser.id,
                communityName,
                isFollowing
            );
            
            State.setFollows(follows);
            return follows;
        } catch (error) {
            console.error('Error updating follow status:', error);
            throw error;
        }
    }

    // Check if user is following a community
    isFollowing(communityName) {
        const follows = State.getFollows();
        return follows[communityName] === true;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser || State.getCurrentUser();
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.getCurrentUser() !== null;
    }

    // Check if user is admin
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'admin';
    }

    // Check if user can perform action on content
    canEdit(content) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // Admin can edit anything
        if (user.role === 'admin') return true;
        
        // User can edit their own content
        return content.authorId === user.id || content.author === user.username;
    }

    canDelete(content) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // Admin can delete anything
        if (user.role === 'admin') return true;
        
        // User can delete their own content
        return content.authorId === user.id || content.author === user.username;
    }

    canModerate() {
        const user = this.getCurrentUser();
        return user && (user.role === 'admin' || user.role === 'moderator');
    }

    // Handle storage changes from other tabs
    handleStorageChange(event) {
        if (event.newValue === null) {
            // User was logged out in another tab
            this.currentUser = null;
            State.setCurrentUser(null);
        } else {
            // User was logged in in another tab
            try {
                const userData = JSON.parse(event.newValue);
                if (userData.username) {
                    this.loadStoredUser();
                }
            } catch (error) {
                console.error('Error parsing storage change:', error);
            }
        }
    }

    // Validate user session
    async validateSession() {
        const user = this.getCurrentUser();
        if (!user) return false;

        try {
            // Check if user still exists and is active
            const fullUserData = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${user.username}`);
            
            if (!fullUserData || fullUserData.status !== 'active') {
                await this.logout();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            await this.logout();
            return false;
        }
    }

    // Refresh user data from server
    async refreshUserData() {
        const user = this.getCurrentUser();
        if (!user) return null;

        try {
            const freshUserData = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${user.username}`);
            
            if (freshUserData) {
                this.currentUser = freshUserData;
                State.setCurrentUser(freshUserData);
                await this.storeCurrentUser(freshUserData);
            }
            
            return freshUserData;
        } catch (error) {
            console.error('Error refreshing user data:', error);
            return user;
        }
    }

    // Generate secure session token (for future use)
    generateSessionToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Password validation
    validatePassword(password) {
        const errors = [];
        
        if (password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }
        
        if (password.length > 100) {
            errors.push('Password must be less than 100 characters');
        }
        
        return errors;
    }

    // Username validation
    validateUsername(username) {
        const errors = [];
        
        if (!CONFIG.VALIDATION.USERNAME.test(username)) {
            errors.push('Username must be 3-20 characters, letters, numbers, and underscores only');
        }
        
        if (username.toLowerCase() === CONFIG.PROTECTED_ADMIN.toLowerCase()) {
            errors.push('Username is reserved');
        }
        
        return errors;
    }

    // Get user display info
    getUserDisplayInfo(user = this.getCurrentUser()) {
        if (!user) return null;
        
        return {
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.avatar || CONFIG.DEFAULTS.AVATAR_FALLBACK,
            bio: user.bio || CONFIG.DEFAULTS.BIO,
            role: user.role || 'user',
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        };
    }
}

// Create global Auth instance
window.Auth = new AuthManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, Auth: window.Auth };
}
