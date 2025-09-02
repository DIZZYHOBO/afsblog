// js/state.js - Application State Management
class StateManager {
    constructor() {
        this.state = {
            currentUser: null,
            posts: [],
            communities: [],
            replies: {},
            follows: {},
            currentFeed: 'general',
            currentView: 'feed',
            loading: false,
            initialized: false
        };
        
        this.listeners = {};
        this.setupDefaults();
    }

    setupDefaults() {
        // Initialize any default state values
        this.state.replies = {};
        this.state.follows = {};
    }

    // Get state value
    get(key) {
        return this.state[key];
    }

    // Set state value and notify listeners
    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // Notify listeners if value changed
        if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            this.notifyListeners(key, value, oldValue);
        }
    }

    // Update nested state object
    update(key, updates) {
        const current = this.state[key] || {};
        this.set(key, { ...current, ...updates });
    }

    // Add listener for state changes
    addListener(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.listeners[key].indexOf(callback);
            if (index > -1) {
                this.listeners[key].splice(index, 1);
            }
        };
    }

    // Remove listener
    removeListener(key, callback) {
        if (this.listeners[key]) {
            const index = this.listeners[key].indexOf(callback);
            if (index > -1) {
                this.listeners[key].splice(index, 1);
            }
        }
    }

    // Notify all listeners for a key
    notifyListeners(key, newValue, oldValue) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error('Error in state listener:', error);
                }
            });
        }
    }

    // Get all state
    getState() {
        return { ...this.state };
    }

    // Reset state to defaults
    reset() {
        const initialState = {
            currentUser: null,
            posts: [],
            communities: [],
            replies: {},
            follows: {},
            currentFeed: 'general',
            currentView: 'feed',
            loading: false,
            initialized: false
        };
        
        Object.keys(initialState).forEach(key => {
            this.set(key, initialState[key]);
        });
    }

    // User management methods
    setCurrentUser(user) {
        this.set('currentUser', user);
    }

    getCurrentUser() {
        return this.get('currentUser');
    }

    clearCurrentUser() {
        this.set('currentUser', null);
    }

    // Posts management
    setPosts(posts) {
        this.set('posts', posts || []);
    }

    getPosts() {
        return this.get('posts') || [];
    }

    addPost(post) {
        const posts = this.getPosts();
        this.set('posts', [post, ...posts]);
    }

    updatePost(postId, updates) {
        const posts = this.getPosts();
        const updatedPosts = posts.map(post => 
            post.id === postId ? { ...post, ...updates } : post
        );
        this.set('posts', updatedPosts);
    }

    removePost(postId) {
        const posts = this.getPosts();
        const filteredPosts = posts.filter(post => post.id !== postId);
        this.set('posts', filteredPosts);
    }

    // Communities management
    setCommunities(communities) {
        this.set('communities', communities || []);
    }

    getCommunities() {
        return this.get('communities') || [];
    }

    addCommunity(community) {
        const communities = this.getCommunities();
        this.set('communities', [...communities, community]);
    }

    updateCommunity(communityId, updates) {
        const communities = this.getCommunities();
        const updatedCommunities = communities.map(community => 
            community.id === communityId ? { ...community, ...updates } : community
        );
        this.set('communities', updatedCommunities);
    }

    // Replies management
    setReplies(postId, replies) {
        const allReplies = this.get('replies') || {};
        this.set('replies', { ...allReplies, [postId]: replies });
    }

    getReplies(postId) {
        const allReplies = this.get('replies') || {};
        return allReplies[postId] || [];
    }

    addReply(postId, reply) {
        const replies = this.getReplies(postId);
        this.setReplies(postId, [...replies, reply]);
    }

    // Follows management
    setFollows(follows) {
        this.set('follows', follows || {});
    }

    getFollows() {
        return this.get('follows') || {};
    }

    setFollowing(communityName, isFollowing) {
        const follows = this.getFollows();
        if (isFollowing) {
            follows[communityName] = true;
        } else {
            delete follows[communityName];
        }
        this.set('follows', follows);
    }

    isFollowing(communityName) {
        const follows = this.getFollows();
        return follows[communityName] === true;
    }

    // Loading state
    setLoading(loading) {
        this.set('loading', Boolean(loading));
    }

    isLoading() {
        return this.get('loading');
    }

    // Navigation state
    setCurrentFeed(feed) {
        this.set('currentFeed', feed);
    }

    getCurrentFeed() {
        return this.get('currentFeed');
    }

    setCurrentView(view) {
        this.set('currentView', view);
    }

    getCurrentView() {
        return this.get('currentView');
    }

    // Initialization
    setInitialized(initialized) {
        this.set('initialized', Boolean(initialized));
    }

    isInitialized() {
        return this.get('initialized');
    }
}

// Helper functions for common state operations
class StateHelpers {
    static setLoading(loading) {
        State.setLoading(loading);
    }

    static showLoading() {
        State.setLoading(true);
    }

    static hideLoading() {
        State.setLoading(false);
    }

    static isUserLoggedIn() {
        return State.getCurrentUser() !== null;
    }

    static isUserAdmin() {
        const user = State.getCurrentUser();
        return user && user.role === 'admin';
    }

    static getCurrentUserId() {
        const user = State.getCurrentUser();
        return user ? user.id : null;
    }

    static getCurrentUsername() {
        const user = State.getCurrentUser();
        return user ? user.username : null;
    }

    static canUserEdit(item) {
        const user = State.getCurrentUser();
        if (!user) return false;
        
        // Admin can edit anything
        if (user.role === 'admin') return true;
        
        // User can edit their own items
        return item.authorId === user.id;
    }

    static canUserDelete(item) {
        const user = State.getCurrentUser();
        if (!user) return false;
        
        // Admin can delete anything
        if (user.role === 'admin') return true;
        
        // User can delete their own items
        return item.authorId === user.id;
    }

    static getVisiblePosts() {
        const posts = State.getPosts();
        const currentFeed = State.getCurrentFeed();
        const user = State.getCurrentUser();
        const follows = State.getFollows();

        switch (currentFeed) {
            case 'followed':
                if (!user) return [];
                return posts.filter(post => 
                    follows[post.community] === true
                );
            
            case 'private':
                if (!user) return [];
                return posts.filter(post => 
                    post.isPrivate && (post.authorId === user.id || user.role === 'admin')
                );
            
            case 'general':
            default:
                return posts.filter(post => !post.isPrivate);
        }
    }

    static getFilteredCommunities(searchTerm = '') {
        const communities = State.getCommunities();
        if (!searchTerm) return communities;
        
        const term = searchTerm.toLowerCase();
        return communities.filter(community => 
            community.name.toLowerCase().includes(term) ||
            community.displayName.toLowerCase().includes(term) ||
            community.description.toLowerCase().includes(term)
        );
    }
}

// Create global State instance
window.State = new StateManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateManager, StateHelpers, State: window.State };
}
