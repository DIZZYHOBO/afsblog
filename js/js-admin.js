// js/admin.js - Admin Panel Component
class AdminManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to state changes
        State.addListener('currentUser', () => {
            this.refreshCurrentView();
        });
    }

    // Render admin page
    renderAdminPage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        const user = State.getCurrentUser();
        if (!user || user.role !== 'admin') {
            feed.innerHTML = `
                <div class="error-page">
                    <h1>Access Denied</h1>
                    <p>Admin access required.</p>
                    <button class="btn btn-primary" onclick="Navigation.navigateToFeed()">Back to Feed</button>
                </div>
            `;
            return;
        }

        const posts = State.getPosts();
        const communities = State.getCommunities();
        const allUsers = this.getAllUsers(); // This would need to be implemented

        feed.innerHTML = `
            <div class="admin-page">
                <div class="admin-header">
                    <h1>Admin Panel</h1>
                    <p>Manage your blog community</p>
                </div>
                
                <div class="admin-tabs">
                    <button class="admin-tab active" onclick="Admin.showTab('overview')">Overview</button>
                    <button class="admin-tab" onclick="Admin.showTab('posts')">Posts</button>
                    <button class="admin-tab" onclick="Admin.showTab('communities')">Communities</button>
                    <button class="admin-tab" onclick="Admin.showTab('users')">Users</button>
                </div>
                
                <div class="admin-content">
                    <div class="admin-tab-content" id="admin-overview">
                        ${this.renderOverviewTab(posts, communities)}
                    </div>
                    
                    <div class="admin-tab-content" id="admin-posts" style="display: none;">
                        ${this.renderPostsTab(posts)}
                    </div>
                    
                    <div class="admin-tab-content" id="admin-communities" style="display: none;">
                        ${this.renderCommunitiesTab(communities)}
                    </div>
                    
                    <div class="admin-tab-content" id="admin-users" style="display: none;">
                        ${this.renderUsersTab(allUsers)}
                    </div>
                </div>
            </div>
        `;
    }

    // Render overview tab
    renderOverviewTab(posts, communities) {
        const totalPosts = posts.length;
        const totalCommunities = communities.length;
        const recentPosts = posts.slice(0, 5);

        return `
            <div class="admin-overview">
                <div class="admin-stats">
                    <div class="stat-card">
                        <div class="stat-number">${totalPosts}</div>
                        <div class="stat-label">Total Posts</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${totalCommunities}</div>
                        <div class="stat-label">Communities</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${posts.filter(p => p.isPrivate).length}</div>
                        <div class="stat-label">Private Posts</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${posts.reduce((sum, p) => sum + (p.likes || 0), 0)}</div>
                        <div class="stat-label">Total Likes</div>
                    </div>
                </div>
                
                <div class="recent-activity">
                    <h3>Recent Posts</h3>
                    <div class="activity-list">
                        ${recentPosts.map(post => `
                            <div class="activity-item">
                                <div class="activity-content">
                                    <strong>${Utils.escapeHtml(post.title)}</strong>
                                    <div class="activity-meta">
                                        by ${post.author} in ${post.community} • ${Utils.formatRelativeTime(post.timestamp)}
                                    </div>
                                </div>
                                <div class="activity-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="Posts.editPost('${post.id}')">Edit</button>
                                    <button class="btn btn-sm btn-danger" onclick="Posts.deletePost('${post.id}')">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Render posts management tab
    renderPostsTab(posts) {
        if (posts.length === 0) {
            return '<div class="empty-state"><p>No posts to manage.</p></div>';
        }

        return `
            <div class="admin-posts">
                <div class="admin-section-header">
                    <h3>All Posts</h3>
                    <div class="admin-filters">
                        <select onchange="Admin.filterPosts(this.value)">
                            <option value="all">All Posts</option>
                            <option value="public">Public Only</option>
                            <option value="private">Private Only</option>
                        </select>
                    </div>
                </div>
                
                <div class="admin-posts-list" id="admin-posts-list">
                    ${posts.map(post => this.renderAdminPost(post)).join('')}
                </div>
            </div>
        `;
    }

    // Render communities management tab
    renderCommunitiesTab(communities) {
        return `
            <div class="admin-communities">
                <div class="admin-section-header">
                    <h3>Communities</h3>
                    <button class="btn btn-primary" onclick="Modals.open('createCommunityModal')">
                        Create Community
                    </button>
                </div>
                
                <div class="admin-communities-list">
                    ${communities.map(community => this.renderAdminCommunity(community)).join('')}
                </div>
            </div>
        `;
    }

    // Render users management tab
    renderUsersTab(users) {
        return `
            <div class="admin-users">
                <div class="admin-section-header">
                    <h3>Users</h3>
                    <p>User management features coming soon...</p>
                </div>
            </div>
        `;
    }

    // Render post in admin context
    renderAdminPost(post) {
        const community = State.getCommunities().find(c => c.name === post.community);
        const communityDisplay = community ? community.displayName : post.community;

        return `
            <div class="admin-post-item">
                <div class="admin-post-info">
                    <h4>${Utils.escapeHtml(post.title)}</h4>
                    <div class="admin-post-meta">
                        <span class="post-community">${communityDisplay}</span>
                        <span>•</span>
                        <span>by ${post.author}</span>
                        <span>•</span>
                        <span>${Utils.formatRelativeTime(post.timestamp)}</span>
                        ${post.isPrivate ? '<span class="post-private-badge">Private</span>' : ''}
                    </div>
                    <div class="admin-post-stats">
                        ${post.likes || 0} likes • ${post.replyCount || 0} replies
                    </div>
                </div>
                <div class="admin-post-actions">
                    <button class="btn btn-sm btn-secondary" onclick="Posts.editPost('${post.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="Admin.confirmDeletePost('${post.id}')">Delete</button>
                </div>
            </div>
        `;
    }

    // Render community in admin context
    renderAdminCommunity(community) {
        return `
            <div class="admin-community-item">
                <div class="admin-community-info">
                    <h4>${community.displayName}</h4>
                    <div class="admin-community-meta">
                        <span>c/${community.name}</span>
                        <span>•</span>
                        <span>Created ${Utils.formatRelativeTime(community.createdAt)}</span>
                    </div>
                    <div class="admin-community-description">
                        ${Utils.escapeHtml(community.description || '')}
                    </div>
                    <div class="admin-community-stats">
                        ${community.memberCount || 0} members • ${community.postCount || 0} posts
                    </div>
                </div>
                <div class="admin-community-actions">
                    <button class="btn btn-sm btn-secondary" onclick="Admin.editCommunity('${community.name}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="Admin.confirmDeleteCommunity('${community.name}')">Delete</button>
                </div>
            </div>
        `;
    }

    // Show specific admin tab
    showTab(tabName) {
        // Hide all tab contents
        const tabContents = document.querySelectorAll('.admin-tab-content');
        tabContents.forEach(content => {
            content.style.display = 'none';
        });

        // Remove active class from all tabs
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab content
        const selectedContent = document.getElementById(`admin-${tabName}`);
        if (selectedContent) {
            selectedContent.style.display = 'block';
        }

        // Add active class to selected tab
        const selectedTab = document.querySelector(`.admin-tab[onclick="Admin.showTab('${tabName}')"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
    }

    // Filter posts by type
    filterPosts(filterType) {
        const posts = State.getPosts();
        let filteredPosts;

        switch (filterType) {
            case 'public':
                filteredPosts = posts.filter(post => !post.isPrivate);
                break;
            case 'private':
                filteredPosts = posts.filter(post => post.isPrivate);
                break;
            case 'all':
            default:
                filteredPosts = posts;
        }

        const postsList = document.getElementById('admin-posts-list');
        if (postsList) {
            postsList.innerHTML = filteredPosts.map(post => this.renderAdminPost(post)).join('');
        }
    }

    // Confirm post deletion
    confirmDeletePost(postId) {
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            Posts.deletePost(postId);
        }
    }

    // Confirm community deletion
    confirmDeleteCommunity(communityName) {
        if (confirm(`Are you sure you want to delete the community "${communityName}"? This will also delete all posts in this community. This action cannot be undone.`)) {
            this.deleteCommunity(communityName);
        }
    }

    // Delete community (admin only)
    async deleteCommunity(communityName) {
        try {
            StateHelpers.setLoading(true);
            
            // This would need to be implemented in the API
            // await communitiesAPI.deleteCommunity(communityName);
            
            // Remove from state
            const communities = State.getCommunities();
            const updatedCommunities = communities.filter(c => c.name !== communityName);
            State.setCommunities(updatedCommunities);
            
            Utils.showSuccessMessage('Community deleted successfully');
        } catch (error) {
            console.error('Error deleting community:', error);
            Utils.showErrorMessage('Failed to delete community');
        } finally {
            StateHelpers.setLoading(false);
        }
    }

    // Edit community (placeholder for future implementation)
    editCommunity(communityName) {
        Utils.showInfoMessage('Community editing coming soon!');
    }

    // Get all users (placeholder - would need proper implementation)
    getAllUsers() {
        // This would need to fetch from API or state
        return [];
    }

    // Refresh current view
    refreshCurrentView() {
        const currentView = State.get('currentView');
        if (currentView === 'admin') {
            this.renderAdminPage();
        }
    }
}

// Create global Admin instance
window.Admin = new AdminManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdminManager, Admin: window.Admin };
}
