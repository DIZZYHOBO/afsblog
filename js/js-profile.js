// js/profile.js - Profile Management Component
class ProfileManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to state changes
        State.addListener('currentUser', () => {
            this.refreshCurrentView();
        });
    }

    // Render profile page
    renderProfilePage() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        const user = State.getCurrentUser();
        if (!user) {
            feed.innerHTML = `
                <div class="error-page">
                    <h1>Not Logged In</h1>
                    <p>Please log in to view your profile.</p>
                    <button class="btn btn-primary" onclick="Modals.switchAuthTab('login'); Modals.open('authModal')">Login</button>
                </div>
            `;
            return;
        }

        const userPosts = State.getPosts().filter(post => post.authorId === user.id);
        const postCount = userPosts.length;
        const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes || 0), 0);

        feed.innerHTML = `
            <div class="profile-page">
                <div class="profile-header">
                    <div class="profile-hero">
                        <div class="profile-avatar">
                            <img src="${user.avatar || CONFIG.DEFAULTS.AVATAR_FALLBACK}" alt="${user.displayName}" />
                        </div>
                        <div class="profile-info">
                            <h1 class="profile-name">${user.displayName || user.username}</h1>
                            <p class="profile-username">@${user.username}</p>
                            <p class="profile-bio">${user.bio || 'No bio yet.'}</p>
                            <div class="profile-stats">
                                <span>${postCount} ${Utils.pluralize(postCount, 'post')}</span>
                                <span>•</span>
                                <span>${totalLikes} ${Utils.pluralize(totalLikes, 'like')}</span>
                                <span>•</span>
                                <span>Joined ${Utils.formatRelativeTime(user.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button class="btn btn-primary" onclick="Modals.populateEditProfileModal(); Modals.open('editProfileModal')">
                            Edit Profile
                        </button>
                    </div>
                </div>
                
                <div class="profile-content">
                    <div class="profile-tabs">
                        <button class="profile-tab active" onclick="Profile.showTab('posts')">Posts</button>
                        <button class="profile-tab" onclick="Profile.showTab('liked')">Liked</button>
                        <button class="profile-tab" onclick="Profile.showTab('private')">Private</button>
                    </div>
                    
                    <div class="profile-tab-content" id="profile-posts">
                        ${this.renderUserPosts(userPosts)}
                    </div>
                    
                    <div class="profile-tab-content" id="profile-liked" style="display: none;">
                        ${this.renderLikedPosts()}
                    </div>
                    
                    <div class="profile-tab-content" id="profile-private" style="display: none;">
                        ${this.renderPrivatePosts()}
                    </div>
                </div>
            </div>
        `;
    }

    // Render user's posts
    renderUserPosts(posts) {
        if (posts.length === 0) {
            return `
                <div class="empty-state">
                    <p>You haven't created any posts yet.</p>
                    <button class="btn btn-primary" onclick="Modals.populateComposeModal(); Modals.open('composeModal')">
                        Create Your First Post
                    </button>
                </div>
            `;
        }

        return `
            <div class="posts-list">
                ${posts.map(post => this.renderProfilePost(post)).join('')}
            </div>
        `;
    }

    // Render posts the user liked
    renderLikedPosts() {
        const user = State.getCurrentUser();
        const likedPosts = State.getPosts().filter(post => 
            post.likedBy && post.likedBy.includes(user.id)
        );

        if (likedPosts.length === 0) {
            return `
                <div class="empty-state">
                    <p>You haven't liked any posts yet.</p>
                </div>
            `;
        }

        return `
            <div class="posts-list">
                ${likedPosts.map(post => this.renderProfilePost(post)).join('')}
            </div>
        `;
    }

    // Render user's private posts
    renderPrivatePosts() {
        const user = State.getCurrentUser();
        const privatePosts = State.getPosts().filter(post => 
            post.isPrivate && post.authorId === user.id
        );

        if (privatePosts.length === 0) {
            return `
                <div class="empty-state">
                    <p>You don't have any private posts.</p>
                    <button class="btn btn-primary" onclick="Modals.populateComposeModal(); document.getElementById('composePrivate').checked = true; Modals.open('composeModal')">
                        Create Private Post
                    </button>
                </div>
            `;
        }

        return `
            <div class="posts-list">
                ${privatePosts.map(post => this.renderProfilePost(post)).join('')}
            </div>
        `;
    }

    // Render a post in profile context
    renderProfilePost(post) {
        const community = State.getCommunities().find(c => c.name === post.community);
        const communityDisplay = community ? community.displayName : post.community;

        return `
            <div class="profile-post-card">
                <div class="post-header">
                    <div class="post-meta">
                        <span class="post-community">
                            <a href="#" onclick="Navigation.navigateToCommunity('${post.community}')">${communityDisplay}</a>
                        </span>
                        <span class="post-separator">•</span>
                        <span class="post-timestamp">${Utils.formatRelativeTime(post.timestamp)}</span>
                        ${post.isPrivate ? '<span class="post-private-badge">Private</span>' : ''}
                    </div>
                    <div class="post-actions">
                        <button class="post-action-btn" onclick="Posts.editPost('${post.id}')" title="Edit">✏️</button>
                        <button class="post-action-btn" onclick="Posts.deletePost('${post.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                
                <h3 class="post-title">
                    <a href="#" onclick="Navigation.navigateToPost('${post.id}')">${Utils.escapeHtml(post.title)}</a>
                </h3>
                
                <div class="post-content-preview">
                    ${Utils.truncateText(post.content, 200)}
                </div>
                
                <div class="post-stats">
                    <span>${post.likes || 0} ${Utils.pluralize(post.likes || 0, 'like')}</span>
                    <span>•</span>
                    <span>${post.replyCount || 0} ${Utils.pluralize(post.replyCount || 0, 'reply', 'replies')}</span>
                </div>
            </div>
        `;
    }

    // Show specific profile tab
    showTab(tabName) {
        // Hide all tab contents
        const tabContents = document.querySelectorAll('.profile-tab-content');
        tabContents.forEach(content => {
            content.style.display = 'none';
        });

        // Remove active class from all tabs
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab content
        const selectedContent = document.getElementById(`profile-${tabName}`);
        if (selectedContent) {
            selectedContent.style.display = 'block';
        }

        // Add active class to selected tab
        const selectedTab = document.querySelector(`.profile-tab[onclick="Profile.showTab('${tabName}')"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
    }

    // Update user profile
    async updateProfile(updates) {
        try {
            StateHelpers.setLoading(true);
            
            const updatedUser = await Auth.updateProfile(updates);
            
            Utils.showSuccessMessage('Profile updated successfully!');
            return updatedUser;
        } catch (error) {
            Utils.showErrorMessage(error.message || 'Failed to update profile');
            throw error;
        } finally {
            StateHelpers.setLoading(false);
        }
    }

    // Handle edit profile form submission
    async handleEditForm(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        try {
            const updates = {
                displayName: formData.get('displayName'),
                bio: formData.get('bio'),
                avatar: formData.get('avatar')
            };

            // Filter out empty values
            Object.keys(updates).forEach(key => {
                if (!updates[key]) delete updates[key];
            });

            await this.updateProfile(updates);

            // Close modal
            Modals.close('editProfileModal');
        } catch (error) {
            // Error already handled in updateProfile
        }
    }

    // Refresh current view
    refreshCurrentView() {
        const currentView = State.get('currentView');
        if (currentView === 'profile') {
            this.renderProfilePage();
        }
    }
}

// Create global Profile instance
window.Profile = new ProfileManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProfileManager, Profile: window.Profile };
}
