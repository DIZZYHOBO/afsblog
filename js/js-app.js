// js/app.js - Main Application Controller
class BlogApp {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log('Initializing Blog App...');
            
            // Initialize components in order
            await this.initializeMarkdown();
            await this.loadInitialData();
            this.setupEventListeners();
            this.setupStateSubscriptions();
            
            // Initial UI update
            this.updateUI();
            
            this.initialized = true;
            console.log('Blog App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.showErrorMessage('Failed to initialize app. Please refresh the page.');
        }
    }

    async initializeMarkdown() {
        // Configure marked.js for markdown rendering
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

    async loadInitialData() {
        try {
            console.log('Loading initial data...');
            StateHelpers.setLoading(true);
            
            // Load data in parallel
            await Promise.all([
                Auth.loadStoredUser(),
                this.loadCommunities(),
                this.loadPosts()
            ]);
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            Utils.showErrorMessage('Failed to load data. Please refresh the page.');
        } finally {
            StateHelpers.setLoading(false);
        }
    }

    async loadCommunities() {
        try {
            const communityKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX);
            const communityPromises = communityKeys.map(async (key) => {
                try {
                    return await blobAPI.get(key);
                } catch (error) {
                    console.error(`Error loading community ${key}:`, error);
                    return null;
                }
            });
            
            const loadedCommunities = await Promise.all(communityPromises);
            const communities = loadedCommunities
                .filter(Boolean)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            State.setCommunities(communities);
            
        } catch (error) {
            console.error('Error loading communities:', error);
            State.setCommunities([]);
        }
    }

    async loadPosts() {
        try {
            const postKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.POST_PREFIX);
            const postPromises = postKeys.map(async (key) => {
                try {
                    return await blobAPI.get(key);
                } catch (error) {
                    console.error(`Error loading post ${key}:`, error);
                    return null;
                }
            });
            
            const loadedPosts = await Promise.all(postPromises);
            const posts = loadedPosts
                .filter(Boolean)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            State.setPosts(posts);
            
        } catch (error) {
            console.error('Error loading posts:', error);
            State.setPosts([]);
        }
    }

    setupEventListeners() {
        // Global click handler for dynamic elements
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (target) {
                const action = target.dataset.action;
                const params = target.dataset.params ? 
                    JSON.parse(target.dataset.params) : {};
                this.handleAction(action, params, e);
            }
        });

        // Global form submission handler
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.dataset.handler) {
                const handler = this.getFormHandler(form.dataset.handler);
                if (handler) {
                    handler(e);
                }
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to open search (future feature)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                // TODO: Open search modal
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                Modals.closeAll();
            }
        });
    }

    setupStateSubscriptions() {
        // Update UI when key state changes
        State.addListener('currentUser', () => {
            this.updateComposeButton();
            this.updateFeedTabsVisibility();
        });

        State.addListener('currentView', () => {
            this.updateUI();
        });

        State.addListener('currentFeedTab', () => {
            this.updateFeedTabsVisibility();
            this.renderCurrentPage();
        });

        State.addListener('posts', () => {
            const currentView = State.get('currentView');
            if (currentView === 'feed') {
                this.renderCurrentPage();
            }
        });

        State.addListener('communities', () => {
            this.updateCommunityDropdowns();
        });
    }

    handleAction(action, params, event) {
        switch (action) {
            case 'navigate':
                this.navigate(params.to, params.data);
                break;
            case 'toggle-replies':
                Posts.toggleReplies(params.postId);
                break;
            case 'delete-post':
                Posts.deletePost(params.postId);
                break;
            case 'delete-reply':
                Replies.deleteReply(params.postId, params.replyId);
                break;
            case 'follow-community':
                Communities.toggleFollow(params.communityName);
                break;
            case 'open-modal':
                Modals.open(params.modalId);
                break;
            case 'close-modal':
                Modals.close(params.modalId);
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }

    getFormHandler(handlerName) {
        const handlers = {
            'auth': (e) => Auth.handleAuthForm ? Auth.handleAuthForm(e) : Modals.handleAuthSubmit(e),
            'create-community': (e) => Communities.handleCreateForm(e),
            'create-post': (e) => Posts.handleCreateForm(e),
            'create-reply': (e) => Replies.handleCreateForm(e),
            'edit-profile': (e) => Profile.handleEditForm(e)
        };
        
        return handlers[handlerName];
    }

    navigate(to, data = {}) {
        switch (to) {
            case 'feed':
                Navigation.navigateToFeed();
                break;
            case 'profile':
                Navigation.navigateToProfile();
                break;
            case 'admin':
                Navigation.navigateToAdmin();
                break;
            case 'community':
                Navigation.navigateToCommunity(data.name);
                break;
            default:
                console.warn('Unknown navigation target:', to);
        }
    }

    updateUI() {
        this.updateComposeButton();
        this.updateFeedTabsVisibility();
        this.updateCommunityDropdowns();
        this.renderCurrentPage();
    }

    updateComposeButton() {
        const composeBtn = document.getElementById('composeBtn');
        if (composeBtn) {
            const user = State.getCurrentUser();
            composeBtn.style.display = user ? 'flex' : 'none';
        }
    }

    updateFeedTabsVisibility() {
        const user = State.getCurrentUser();
        FeedTabs.updateTabsVisibility(user);
    }

    updateCommunityDropdowns() {
        const communities = State.getCommunities();
        
        // Update compose modal community dropdown
        const communitySelect = document.getElementById('composeCommunity');
        if (communitySelect) {
            communitySelect.innerHTML = '<option value="">Select a community</option>';
            communities.forEach(community => {
                const option = document.createElement('option');
                option.value = community.name;
                option.textContent = community.displayName;
                communitySelect.appendChild(option);
            });
        }
    }

    renderCurrentPage() {
        const currentView = State.get('currentView');
        
        switch (currentView) {
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
            case 'community':
                this.renderCommunityPage();
                break;
            default:
                this.renderFeedPage();
        }
    }

    renderFeedPage() {
        Navigation.renderFeedPage();
    }

    renderCommunitiesPage() {
        Navigation.renderCommunitiesPage();
    }

    renderProfilePage() {
        Navigation.renderProfilePage();
    }

    renderAdminPage() {
        Navigation.renderAdminPage();
    }

    renderCommunityPage() {
        const communityName = State.get('currentCommunity');
        if (communityName) {
            Navigation.renderCommunityPage(communityName);
        }
    }

    // Error handling
    handleError(error, context = 'Unknown') {
        console.error(`${context} error:`, error);
        
        // Don't show error messages for expected API errors (404s on empty data)
        if (error instanceof ApiError && error.status === 404) {
            return; // Expected for empty data
        }

        // Handle auth errors
        if (error instanceof ApiError && error.status === 401) {
            State.setCurrentUser(null);
            Utils.showErrorMessage('Session expired. Please log in again.');
            return;
        }

        // Handle permission errors
        if (error instanceof ApiError && error.status === 403) {
            Utils.showErrorMessage('You don\'t have permission for this action.');
            return;
        }
        
        Utils.showErrorMessage(error.message || `${context} error occurred. Please try again.`);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing app...');
    window.App = new BlogApp();
    await App.initialize();
});

// Handle any unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.App) {
        App.handleError(event.reason, 'Unhandled Promise');
    }
});

// Handle any unhandled errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.App) {
        App.handleError(event.error, 'Global Error');
    }
});
