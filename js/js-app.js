// js/app.js - Main Application Controller
class BlogApp {
    constructor() {
        this.initialized = false;
        this.pageRenderers = {
            'feed': () => this.renderFeedPage(),
            'community': () => this.renderCommunityPage(),
            'profile': () => this.renderProfilePage(),
            'admin': () => this.renderAdminPage()
        };
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
            Utils.showSuccessMessage('Failed to initialize app. Please refresh the page.');
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
            
            // Set up custom renderer
            const renderer = new marked.Renderer();
            
            // Custom link renderer to handle media embeds
            renderer.link = function(href, title, text) {
                const mediaHtml = MediaRenderer.renderFromUrl(href);
                if (mediaHtml) return mediaHtml;
                
                return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
            };
            
            // Custom image renderer
            renderer.image = function(href, title, text) {
                return `<img src="${href}" alt="${text || 'Image'}" ${title ? `title="${title}"` : ''} onclick="MediaRenderer.openImageModal('${href}')" style="cursor: pointer;">`;
            };
            
            State.set('markdownRenderer', renderer);
        }
    }

    async loadInitialData() {
        console.log('Loading initial data...');
        StateHelpers.setLoading(true);
        
        try {
            // Load user first
            await Auth.loadStoredUser();
            
            // Load data in parallel
            await Promise.all([
                this.loadCommunities(),
                this.loadPosts()
            ]);
            
            // Load admin stats if user is admin and on admin page
            const currentUser = State.getCurrentUser();
            if (currentUser?.profile?.isAdmin) {
                await Admin.loadStats();
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            Utils.showSuccessMessage('Some content may not be available. Please try refreshing the page.');
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

            State.set('communities', communities);
            
        } catch (error) {
            console.error('Error loading communities:', error);
            State.set('communities', []);
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

            State.set('posts', posts);
            
        } catch (error) {
            console.error('Error loading posts:', error);
            State.set('posts', []);
        }
    }

    setupEventListeners() {
        // Global click handler for dynamic elements
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (target) {
                const action = target.dataset.action;
                const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};
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

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            // TODO: Handle browser navigation
        });
    }

    setupStateSubscriptions() {
        // Update UI when key state changes
        State.subscribe('currentUser', () => {
            this.updateComposeButton();
            this.updateFeedTabsVisibility();
        });

        State.subscribe('currentPage', () => {
            this.updateUI();
        });

        State.subscribe('currentFeedTab', () => {
            this.updateFeedTabsVisibility();
            this.renderCurrentPage();
        });

        State.subscribe('posts', () => {
            if (State.get('currentPage') === 'feed') {
                this.renderCurrentPage();
            }
        });

        State.subscribe('communities', () => {
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
            'auth': (e) => AuthForms.handleAuthForm(e),
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
            composeBtn.style.display = State.isAuthenticated() ? 'block' : 'none';
        }
    }

    updateFeedTabsVisibility() {
        const feedTabs = document.getElementById('feedTabs');
        const currentPage = State.get('currentPage');
        const isAuthenticated = State.isAuthenticated();
        
        if (feedTabs) {
            // Show tabs only on feed page when user is logged in
            if (currentPage === 'feed' && isAuthenticated) {
                feedTabs.style.display = 'flex';
            } else {
                feedTabs.style.display = 'none';
            }
        }
    }

    updateCommunityDropdowns() {
        // Update compose modal dropdown
        const select = document.getElementById('postCommunity');
        if (select) {
            const communities = State.get('communities');
            select.innerHTML = '<option value="">General Feed</option>';
            
            communities.forEach(community => {
                const option = document.createElement('option');
                option.value = community.name;
                option.textContent = community.displayName;
                select.appendChild(option);
            });
        }
    }

    renderCurrentPage() {
        const currentPage = State.get('currentPage');
        const renderer = this.pageRenderers[currentPage];
        
        if (renderer) {
            renderer();
        } else {
            console.warn('No renderer found for page:', currentPage);
            this.renderNotFound();
        }
    }

    renderFeedPage() {
        if (!State.isAuthenticated()) {
            this.renderLoginRequired();
            return;
        }

        const currentTab = State.get('currentFeedTab');
        switch (currentTab) {
            case 'general':
                this.renderGeneralFeed();
                break;
            case 'followed':
                this.renderFollowedFeed();
                break;
            case 'private':
                this.renderPrivateFeed();
                break;
            default:
                this.renderGeneralFeed();
        }
    }

    renderGeneralFeed() {
        const posts = State.get('posts').filter(post => !post.isPrivate);
        this.updateFeedContent(Posts.renderPostList(posts, 'No public posts yet!'));
    }

    renderFollowedFeed() {
        const followedCommunities = State.get('followedCommunities');
        
        if (followedCommunities.size === 0) {
            const emptyHtml = `
                <div class="feature-placeholder">
                    <h3>🏘️ No Followed Communities Yet</h3>
                    <p>You're not following any communities yet! Discover and follow communities to see their posts here.</p>
                    <div style="margin-top: 20px;">
                        <button class="btn" data-action="navigate" data-params='{"to":"feed"}' onclick="FeedTabs.switch('general')">
                            Browse General Feed
                        </button>
                        <button class="btn btn-secondary" onclick="Navigation.toggleCommunitiesDropdown(); Navigation.toggleMenu();">
                            Browse Communities
                        </button>
                    </div>
                </div>
            `;
            this.updateFeedContent(emptyHtml);
            return;
        }

        const posts = State.get('posts').filter(post => 
            !post.isPrivate && 
            post.communityName && 
            followedCommunities.has(post.communityName)
        );

        if (posts.length === 0) {
            const noPostsHtml = `
                <div class="feature-placeholder">
                    <h3>🏘️ No Posts Yet</h3>
                    <p>You're following ${followedCommunities.size} ${followedCommunities.size === 1 ? 'community' : 'communities'}, but there are no recent posts.</p>
                    <div style="margin-top: 20px;">
                        <button class="btn" onclick="FeedTabs.switch('general')">Browse General Feed</button>
                        <button class="btn btn-secondary" onclick="Navigation.toggleCommunitiesDropdown(); Navigation.toggleMenu();">Find More Communities</button>
                    </div>
                </div>
            `;
            this.updateFeedContent(noPostsHtml);
            return;
        }

        // Create header with followed communities info
        const communities = State.get('communities');
        const followedCommunitiesInfo = `
            <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 18px;">🏘️</span>
                    <h3 style="color: var(--fg-default); margin: 0;">Following ${followedCommunities.size} ${followedCommunities.size === 1 ? 'Community' : 'Communities'}</h3>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${Array.from(followedCommunities).map(name => {
                        const community = communities.find(c => c.name === name);
                        return `<span class="post-community-link" onclick="Navigation.navigateToCommunity('${name}')" style="cursor: pointer; font-size: 12px;">
                            c/${community ? Utils.escapeHtml(community.displayName) : Utils.escapeHtml(name)}
                        </span>`;
                    }).join('')}
                </div>
                <p style="color: var(--fg-muted); font-size: 12px; margin: 12px 0 0 0;">
                    Showing ${posts.length} ${posts.length === 1 ? 'post' : 'posts'} from your followed communities
                </p>
            </div>
        `;

        const postsHtml = Posts.renderPostList(posts, 'No posts from your followed communities yet!');
        this.updateFeedContent(followedCommunitiesInfo + postsHtml);
    }

    renderPrivateFeed() {
        const currentUser = State.getCurrentUser();
        const posts = State.get('posts').filter(post => 
            post.isPrivate && post.author === currentUser?.username
        );
        this.updateFeedContent(Posts.renderPostList(posts, 'You haven\'t created any private posts yet!'));
    }

    renderCommunityPage() {
        const currentCommunity = State.get('currentCommunity');
        const communities = State.get('communities');
        
        if (!currentCommunity) {
            this.renderNotFound();
            return;
        }
        
        const community = communities.find(c => c.name === currentCommunity);
        if (!community) {
            this.updateFeedContent('<div class="empty-state"><p>Community not found.</p></div>');
            return;
        }

        Communities.renderCommunityPage(community);
    }

    renderProfilePage() {
        if (!State.isAuthenticated()) {
            const loginRequiredHtml = `
                <div class="feature-placeholder">
                    <h3>👤 Profile</h3>
                    <p>Please sign in to view your profile and manage your posts.</p>
                    <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
                        <button class="btn" onclick="Modals.openAuth('signin')">Sign In</button>
                        <button class="btn btn-secondary" onclick="Modals.openAuth('signup')">Sign Up</button>
                    </div>
                </div>
            `;
            this.updateFeedContent(loginRequiredHtml);
            return;
        }

        Profile.renderProfilePage();
    }

    renderAdminPage() {
        if (!State.isAdmin()) {
            const accessDeniedHtml = `
                <div class="feature-placeholder">
                    <h3>🚫 Access Denied</h3>
                    <p>You need administrator privileges to access this page.</p>
                    <button class="btn" onclick="Navigation.navigateToFeed()">Return to Feed</button>
                </div>
            `;
            this.updateFeedContent(accessDeniedHtml);
            return;
        }

        Admin.renderAdminPage();
    }

    renderLoginRequired() {
        const loginRequiredHtml = `
            <div class="login-required">
                <div class="login-required-icon">🔒</div>
                <h2>Log in to view feed</h2>
                <p>You need to be signed in to view posts and interact with the community.</p>
                <div class="login-required-buttons">
                    <button class="login-required-btn" onclick="Modals.openAuth('signin')">
                        <span>🚪</span>
                        <span>Sign In</span>
                    </button>
                    <button class="login-required-btn secondary" onclick="Modals.openAuth('signup')">
                        <span>✨</span>
                        <span>Sign Up</span>
                    </button>
                </div>
            </div>
        `;
        this.updateFeedContent(loginRequiredHtml);
    }

    renderNotFound() {
        const notFoundHtml = `
            <div class="feature-placeholder">
                <h3>🤔 Page Not Found</h3>
                <p>The page you're looking for doesn't exist.</p>
                <button class="btn" onclick="Navigation.navigateToFeed()">Go to Feed</button>
            </div>
        `;
        this.updateFeedContent(notFoundHtml);
    }

    updateFeedContent(html) {
        const feedElement = document.getElementById('feed');
        if (feedElement) {
            feedElement.innerHTML = html;
        }
    }

    // Utility method to show loading state
    showLoading(message = 'Loading...') {
        this.updateFeedContent(`<div class="loading">${message}</div>`);
    }

    // Method to handle errors gracefully
    handleError(error, context = 'Application') {
        console.error(`${context} error:`, error);
        
        if (error.name === 'ApiError') {
            if (error.status === 401) {
                // Unauthorized - redirect to login
                Auth.logout();
                Modals.openAuth('signin');
                return;
            } else if (error.status === 403) {
                Utils.showSuccessMessage('Access denied. You don\'t have permission for this action.');
                return;
            }
        }
        
        Utils.showSuccessMessage(error.message || `${context} error occurred. Please try again.`);
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
