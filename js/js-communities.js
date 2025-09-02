// js/communities.js - Communities Management Component
class CommunitiesManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to state changes
        State.addListener('communities', () => {
            this.refreshCurrentView();
        });

        State.addListener('currentUser', () => {
            this.refreshCurrentView();
        });
    }

    // Render communities page
    renderCommunitiesPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        const communities = State.getCommunities();
        const user = State.getCurrentUser();

        const communitiesHTML = communities.length > 0 
            ? communities.map(community => this.renderCommunity(community)).join('')
            : '<div class="empty-state"><p>No communities yet. Create the first one!</p></div>';

        feed.innerHTML = `
            <div class="communities-page">
                <div class="communities-header">
                    <h1>Communities</h1>
                    ${user ? '<button class="btn btn-primary" onclick="Modals.open(\'createCommunityModal\')">Create Community</button>' : ''}
                </div>
                <div class="communities-list">
                    ${communitiesHTML}
                </div>
            </div>
        `;
    }

    // Render a single community
    renderCommunity(community) {
        const user = State.getCurrentUser();
        const isFollowing = user && State.isFollowing(community.name);

        return `
            <div class="community-card" data-community="${community.name}">
                <div class="community-info">
                    <h3 class="community-name">
                        <a href="#" onclick="Navigation.navigateToCommunity('${community.name}')">${community.displayName}</a>
                    </h3>
                    <p class="community-description">${Utils.escapeHtml(community.description || '')}</p>
                    <div class="community-stats">
                        <span>${community.memberCount || 0} members</span>
                        <span>•</span>
                        <span>${community.postCount || 0} posts</span>
                    </div>
                </div>
                <div class="community-actions">
                    ${user ? `
                        <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" 
                                onclick="Communities.toggleFollow('${community.name}')">
                            ${isFollowing ? 'Following' : 'Follow'}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Render specific community page
    renderCommunityPage(communityName) {
        const feed = document.getElementById('feed');
        if (!feed) return;

        const communities = State.getCommunities();
        const community = communities.find(c => c.name === communityName);

        if (!community) {
            feed.innerHTML = `
                <div class="error-page">
                    <h1>Community Not Found</h1>
                    <p>The community "${communityName}" doesn't exist.</p>
                    <button class="btn btn-primary" onclick="Navigation.navigateToCommunities()">Browse Communities</button>
                </div>
            `;
            return;
        }

        const posts = State.getPosts().filter(post => 
            post.community === communityName && !post.isPrivate
        );
        
        const user = State.getCurrentUser();
        const isFollowing = user && State.isFollowing(community.name);

        const postsHTML = posts.length > 0
            ? posts.map(post => Posts.renderPost ? Posts.renderPost(post) : this.renderSimplePost(post)).join('')
            : '<div class="empty-state"><p>No posts in this community yet.</p></div>';

        feed.innerHTML = `
            <div class="community-page">
                <div class="community-header">
                    <div class="community-hero">
                        <div class="community-avatar">${community.displayName.charAt(0).toUpperCase()}</div>
                        <div class="community-info">
                            <h1 class="community-title">${community.displayName}</h1>
                            <p class="community-handle">c/${community.name}</p>
                            <p class="community-description">${Utils.escapeHtml(community.description || '')}</p>
                            <div class="community-stats">
                                <span>${community.memberCount || 0} members</span>
                                <span>•</span>
                                <span>${community.postCount || 0} posts</span>
                                <span>•</span>
                                <span>Created ${Utils.formatRelativeTime(community.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="community-actions">
                        ${user ? `
                            <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" 
                                    onclick="Communities.toggleFollow('${community.name}')">
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                            <button class="btn btn-secondary" onclick="Modals.populateComposeModal(); document.getElementById('composeCommunity').value='${community.name}'; Modals.open('composeModal')">
                                Create Post
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="community-content">
                    <div class="posts-list">
                        ${postsHTML}
                    </div>
                </div>
            </div>
        `;
    }

    // Simple post renderer for community pages
    renderSimplePost(post) {
        return `
            <div class="post-card">
                <h3><a href="#" onclick="Navigation.navigateToPost('${post.id}')">${Utils.escapeHtml(post.title)}</a></h3>
                <div class="post-meta">
                    by ${post.author} • ${Utils.formatRelativeTime(post.timestamp)}
                </div>
                <div class="post-stats">
                    ${post.likes || 0} likes • ${post.replyCount || 0} replies
                </div>
            </div>
        `;
    }

    // Create a new community
    async createCommunity(communityData) {
        try {
            StateHelpers.setLoading(true);
            
            const user = State.getCurrentUser();
            if (!user) {
                throw new Error('Must be logged in to create communities');
            }

            const community = await communitiesAPI.createCommunity({
                ...communityData,
                creatorId: user.id,
                creator: user.username
            });

            // Add to state
            State.addCommunity(community);
            
            Utils.showSuccessMessage('Community created successfully!');
            return community;
        } catch (error) {
            Utils.showErrorMessage(error.message || 'Failed to create community');
            throw error;
        } finally {
            StateHelpers.setLoading(false);
        }
    }

    // Toggle follow status for a community
    async toggleFollow(communityName) {
        try {
            const user = State.getCurrentUser();
            if (!user) {
                Modals.switchAuthTab('login');
                Modals.open('authModal');
                return;
            }

            const isCurrentlyFollowing = State.isFollowing(communityName);
            const newFollowStatus = !isCurrentlyFollowing;

            // Optimistic update
            State.setFollowing(communityName, newFollowStatus);

            // Server update
            await Auth.toggleFollowCommunity(communityName, newFollowStatus);

            const action = newFollowStatus ? 'followed' : 'unfollowed';
            Utils.showSuccessMessage(`Successfully ${action} community!`);

        } catch (error) {
            console.error('Error toggling follow:', error);
            // Revert optimistic update on error
            const isCurrentlyFollowing = State.isFollowing(communityName);
            State.setFollowing(communityName, !isCurrentlyFollowing);
            Utils.showErrorMessage('Failed to update follow status');
        }
    }

    // Handle create community form submission
    async handleCreateForm(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        try {
            const communityData = {
                name: formData.get('name'),
                displayName: formData.get('displayName'),
                description: formData.get('description')
            };

            await this.createCommunity(communityData);

            // Reset form
            event.target.reset();
            Modals.close('createCommunityModal');
        } catch (error) {
            // Error already handled in createCommunity
        }
    }

    // Refresh current view
    refreshCurrentView() {
        const currentView = State.get('currentView');
        if (currentView === 'communities') {
            this.renderCommunitiesPage();
        } else if (currentView === 'community') {
            const communityName = State.get('currentCommunity');
            if (communityName) {
                this.renderCommunityPage(communityName);
            }
        }
    }
}

// Create global Communities instance
window.Communities = new CommunitiesManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommunitiesManager, Communities: window.Communities };
}
