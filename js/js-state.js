// js/state.js - Global State Management
class AppState {
    constructor() {
        this.data = {
            currentUser: null,
            currentPage: 'feed',
            currentFeedTab: 'general',
            currentCommunity: null,
            posts: [],
            communities: [],
            followedCommunities: new Set(),
            isLoading: false,
            markdownRenderer: null,
            currentPostType: 'text',
            adminData: null
        };
        
        this.subscribers = new Map();
        this.init();
    }

    init() {
        // Initialize marked.js configuration
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
        }
    }

    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.get(key)?.delete(callback);
        };
    }

    // Get state value
    get(key) {
        return this.data[key];
    }

    // Set state value and notify subscribers
    set(key, value) {
        const oldValue = this.data[key];
        this.data[key] = value;
        
        // Notify subscribers
        if (this.subscribers.has(key)) {
            this.subscribers.get(key).forEach(callback => {
                callback(value, oldValue);
            });
        }
        
        // Notify global subscribers
        if (this.subscribers.has('*')) {
            this.subscribers.get('*').forEach(callback => {
                callback(key, value, oldValue);
            });
        }
    }

    // Batch update multiple values
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    // Get current user
    getCurrentUser() {
        return this.get('currentUser');
    }

    // Set current user (helper method)
    setCurrentUser(user) {
        this.set('currentUser', user);
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.getCurrentUser() !== null;
    }

    // Check if current user is admin
    isAdmin() {
        const user = this.getCurrentUser();
        return user?.profile?.isAdmin === true;
    }

    // Get posts for current feed tab
    getCurrentFeedPosts() {
        const currentTab = this.get('currentFeedTab');
        const allPosts = this.get('posts');
        const user = this.getCurrentUser();
        const followedCommunities = this.get('followedCommunities');

        if (!user) return [];

        switch (currentTab) {
            case 'general':
                return allPosts.filter(post => !post.isPrivate);
            
            case 'followed':
                return allPosts.filter(post => 
                    !post.isPrivate && 
                    post.communityName && 
                    followedCommunities.has(post.communityName)
                );
            
            case 'private':
                return allPosts.filter(post => 
                    post.isPrivate && 
                    post.author === user.username
                );
            
            default:
                return [];
        }
    }

    // Reset state (for logout)
    reset() {
        this.data = {
            currentUser: null,
            currentPage: 'feed',
            currentFeedTab: 'general',
            currentCommunity: null,
            posts: [],
            communities: [],
            followedCommunities: new Set(),
            isLoading: false,
            markdownRenderer: this.data.markdownRenderer, // Keep renderer
            currentPostType: 'text',
            adminData: null
        };
        
        // Notify all subscribers of reset
        this.subscribers.forEach((callbacks, key) => {
            callbacks.forEach(callback => {
                callback(this.data[key], undefined);
            });
        });
    }
}

// Create global state instance
const State = new AppState();

// Helper functions for common state operations
const StateHelpers = {
    // Navigation helpers
    navigateToPage(page, data = {}) {
        State.update({
            currentPage: page,
            ...data
        });
    },

    navigateToCommunity(communityName) {
        State.update({
            currentPage: 'community',
            currentCommunity: communityName
        });
    },

    // Post helpers
    addPost(post) {
        const posts = State.get('posts');
        State.set('posts', [post, ...posts]);
    },

    removePost(postId) {
        const posts = State.get('posts').filter(p => p.id !== postId);
        State.set('posts', posts);
    },

    updatePost(postId, updates) {
        const posts = State.get('posts').map(post => 
            post.id === postId ? { ...post, ...updates } : post
        );
        State.set('posts', posts);
    },

    // Community helpers
    addCommunity(community) {
        const communities = State.get('communities');
        State.set('communities', [community, ...communities]);
    },

    followCommunity(communityName) {
        const followed = State.get('followedCommunities');
        followed.add(communityName);
        State.set('followedCommunities', new Set(followed));
    },

    unfollowCommunity(communityName) {
        const followed = State.get('followedCommunities');
        followed.delete(communityName);
        State.set('followedCommunities', new Set(followed));
    },

    // Loading helpers
    setLoading(isLoading) {
        State.set('isLoading', isLoading);
    },

    // User helpers
    setCurrentUser(user) {
        State.set('currentUser', user);
    },

    clearCurrentUser() {
        State.set('currentUser', null);
    }
};
