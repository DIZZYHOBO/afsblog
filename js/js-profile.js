// js/profile.js - Profile Management Component
class ProfileManager {
    constructor() {
        this.currentProfileTab = 'posts';
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to user changes
        State.subscribe('currentUser', () => {
            if (State.get('currentPage') === 'profile') {
                this.renderProfilePage();
            }
        });
    }

    // Render the main profile page
    async renderProfilePage() {
        const currentUser = State.getCurrentUser();
        
        if (!currentUser) {
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
            App.updateFeedContent(loginRequiredHtml);
            return;
        }

        // Show loading
        App.updateFeedContent('<div class="loading">Loading profile...</div>');

        const stats = this.calculateUserStats(currentUser);
        const profilePictureUrl = currentUser.profile?.profilePicture || CONFIG.DEFAULTS.AVATAR_FALLBACK;

        const profileHtml = `
            <div class="profile-page">
                <!-- Profile Header -->
                <div class="profile-header">
                    <div class="profile-hero">
                        <div class="profile-picture-container">
                            <img src="${profilePictureUrl}" 
                                 alt="Profile Picture" 
                                 class="profile-picture"
                                 onerror="this.src='${CONFIG.DEFAULTS.AVATAR_FALLBACK}'">
                            <button class="edit-picture-btn" onclick="Profile.openEditProfileModal()" title="Edit Profile">
                                <span>✏️</span>
                            </button>
                        </div>
                        <div class="profile-info">
                            <h1 class="profile-username">@${Utils.escapeHtml(currentUser.username)}</h1>
                            ${currentUser.profile?.isAdmin ? '<div class="admin-badge">👑 Administrator</div>' : ''}
                            <p class="profile-bio">${Utils.escapeHtml(currentUser.profile?.bio || 'No bio yet. Click edit to add one!')}</p>
                            <div class="profile-join-date">
                                <span>📅 Joined ${Utils.formatDate(currentUser.profile?.createdAt || new Date().toISOString())}</span>
                            </div>
                        </div>
                        <div class="profile-actions">
                            <button class="btn" onclick="Profile.openEditProfileModal()">
                                ✏️ Edit Profile
                            </button>
                        </div>
                    </div>
                    
                    <!-- Profile Stats -->
                    <div class="profile-stats">
                        <div class="stat-item">
                            <span class="stat-number">${stats.totalPosts}</span>
                            <span class="stat-label">total posts</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.publicPosts}</span>
                            <span class="stat-label">public posts</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.privatePosts}</span>
                            <span class="stat-label">private posts</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.followedCount}</span>
                            <span class="stat-label">following</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.createdCommunities}</span>
                            <span class="stat-label">communities</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.totalReplies}</span>
                            <span class="stat-label">replies</span>
                        </div>
                    </div>
                </div>

                <!-- Profile Content Tabs -->
                <div class="profile-content">
                    <div class="profile-tabs">
                        <button class="profile-tab active" id="profilePostsTab" onclick="Profile.switchProfileTab('posts')">
                            📝 Public Posts (${stats.publicPosts})
                        </button>
                        <button class="profile-tab" id="profileCommunitiesTab" onclick="Profile.switchProfileTab('communities')">
                            🏘️ Communities (${stats.createdCommunities})
                        </button>
                        <button class="profile-tab" id="profileFollowingTab" onclick="Profile.switchProfileTab('following')">
                            👥 Following (${stats.followedCount})
                        </button>
                    </div>

                    <div class="profile-tab-content">
                        <!-- Posts Tab Content (default) - Only shows PUBLIC posts -->
                        <div id="profilePostsContent" class="profile-tab-panel active">
                            ${this.renderPostsTabContent(stats.userPublicPosts)}
                        </div>

                        <!-- Communities Tab Content -->
                        <div id="profileCommunitiesContent" class="profile-tab-panel">
                            ${this.renderCommunitiesTabContent(stats.userCommunities)}
                        </div>

                        <!-- Following Tab Content -->
                        <div id="profileFollowingContent" class="profile-tab-panel">
                            ${this.renderFollowingTabContent()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        App.updateFeedContent(profileHtml);
    }

    // Calculate user statistics
    calculateUserStats(user) {
        const posts = State.get('posts');
        const communities = State.get('communities');
        const followedCommunities = State.get('followedCommunities');

        const userPosts = posts.filter(post => post.author === user.username);
        const userPublicPosts = userPosts.filter(post => !post.isPrivate);
        const userPrivatePosts = userPosts.filter(post => post.isPrivate);
        const userCommunities = communities.filter(c => c.createdBy === user.username);

        // Calculate total replies made by user
        const totalReplies = posts.reduce((total, post) => {
            if (!post.replies) return total;
            return total + post.replies.filter(reply => reply.author === user.username).length;
        }, 0);

        return {
            totalPosts: userPosts.length,
            publicPosts: userPublicPosts.length,
            privatePosts: userPrivatePosts.length,
            followedCount: followedCommunities.size,
            createdCommunities: userCommunities.length,
            totalReplies,
            userPublicPosts,
            userCommunities
        };
    }

    // Render posts tab content
    renderPostsTabContent(userPosts) {
        if (userPosts.length > 0) {
            return Posts.renderPostList(userPosts, 'No public posts yet!');
        } else {
            return `
                <div class="empty-state">
                    <p>You haven't created any public posts yet. 
                    <a href="#" onclick="Modals.open('composeModal'); return false;" style="color: var(--accent-fg);">Create your first post!</a></p>
                    <p style="margin-top: 12px; color: var(--fg-muted); font-size: 14px;">
                        Note: Only public posts are shown on profiles. Private posts remain private and are only visible to you in the Private feed tab.
                    </p>
                </div>
            `;
        }
    }

    // Render communities tab content
    renderCommunitiesTabContent(userCommunities) {
        if (userCommunities.length > 0) {
            return Communities.renderCommunitiesList(userCommunities);
        } else {
            return `
                <div class="empty-state">
                    <p>You haven't created any communities yet. 
                    <a href="#" onclick="Modals.open('createCommunityModal'); return false;" style="color: var(--accent-fg);">Create your first community!</a></p>
                </div>
            `;
        }
    }

    // Render following tab content
    renderFollowingTabContent() {
        const followedCommunities = State.get('followedCommunities');
        
        if (followedCommunities.size > 0) {
            return Communities.renderFollowingList();
        } else {
            return `
                <div class="empty-state">
                    <p>You're not following any communities yet. 
                    <a href="#" onclick="FeedTabs.switch('general'); Navigation.navigateToFeed(); return false;" style="color: var(--accent-fg);">Browse communities to follow!</a></p>
                </div>
            `;
        }
    }

    // Switch profile tabs
    switchProfileTab(tabName) {
        this.currentProfileTab = tabName;
        
        // Update tab visual states
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`profile${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).classList.add('active');
        
        // Update content visibility
        document.querySelectorAll('.profile-tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`profile${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Content`).classList.add('active');
    }

    // Open edit profile modal
    openEditProfileModal() {
        const currentUser = State.getCurrentUser();
        if (!currentUser) return;
        
        const currentPictureUrl = currentUser.profile?.profilePicture || '';
        const currentBio = currentUser.profile?.bio || '';
        
        document.getElementById('editProfilePicture').value = currentPictureUrl;
        document.getElementById('editProfileBio').value = currentBio;
        document.getElementById('editProfileError').innerHTML = '';
        
        Modals.open('editProfileModal');
    }

    // Handle profile edit form
    async handleEditForm(e) {
        e.preventDefault();
        
        const currentUser = State.getCurrentUser();
        if (!currentUser) {
            Utils.showError('editProfileError', 'Please sign in to update your profile');
            return;
        }
        
        const formData = new FormData(e.target);
        const newPictureUrl = formData.get('profilePicture')?.trim() || '';
        const newBio = formData.get('bio')?.trim() || '';
        
        const submitBtn = document.getElementById('editProfileSubmitBtn');
        const errorDiv = document.getElementById('editProfileError');
        
        if (!submitBtn || !errorDiv) return;
        
        errorDiv.innerHTML = '';
        
        // Validation
        if (newBio.length > CONFIG.MAX_BIO_LENGTH) {
            Utils.showError('editProfileError', `Bio must be ${CONFIG.MAX_BIO_LENGTH} characters or less`);
            return;
        }

        // Validate URL if provided
        if (newPictureUrl && newPictureUrl.length > 0) {
            if (!Utils.isValidUrl(newPictureUrl)) {
                Utils.showError('editProfileError', 'Please provide a valid URL for the profile picture');
                return;
            }
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
            
            // Update user profile
            const updatedProfile = {
                ...currentUser.profile,
                profilePicture: newPictureUrl,
                bio: newBio,
                updatedAt: new Date().toISOString()
            };
            
            // Save to storage
            await blobAPI.set(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${currentUser.username}`, updatedProfile);
            
            // Update current user object
            currentUser.profile = updatedProfile;
            await blobAPI.set(CONFIG.STORAGE_KEYS.CURRENT_USER, currentUser);
            State.setCurrentUser(currentUser);
            
            Modals.close('editProfileModal');
            e.target.reset();
            
            // Re-render profile page to show changes
            this.renderProfilePage();
            
            Utils.showSuccessMessage('Profile updated successfully!');
            
        } catch (error) {
            console.error('Error updating profile:', error);
            Utils.showError('editProfileError', error.message || 'Failed to update profile. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Profile';
        }
    }

    // Get profile stats for display
    getProfileStats(username) {
        const posts = State.get('posts');
        const communities = State.get('communities');
        
        const userPosts = posts.filter(post => post.author === username);
        const publicPosts = userPosts.filter(post => !post.isPrivate);
        const privatePosts = userPosts.filter(post => post.isPrivate);
        const userCommunities = communities.filter(c => c.createdBy === username);
        
        return {
            totalPosts: userPosts.length,
            publicPosts: publicPosts.length,
            privatePosts: privatePosts.length,
            communities: userCommunities.length
        };
    }

    // Export user data (future feature)
    async exportUserData() {
        const currentUser = State.getCurrentUser();
        if (!currentUser) return;

        const posts = State.get('posts');
        const communities = State.get('communities');
        const followedCommunities = State.get('followedCommunities');

        const userData = {
            profile: currentUser.profile,
            posts: posts.filter(post => post.author === currentUser.username),
            communities: communities.filter(c => c.createdBy === currentUser.username),
            followedCommunities: Array.from(followedCommunities),
            exportedAt: new Date().toISOString()
        };

        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentUser.username}_blog_data.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        Utils.showSuccessMessage('User data exported successfully!');
    }

    // Delete account (future feature)
    async deleteAccount() {
        const currentUser = State.getCurrentUser();
        if (!currentUser) return;

        const confirmMessage = `Are you sure you want to delete your account @${currentUser.username}? This action cannot be undone and will:

• Delete your profile and all posts
• Remove you from all communities
• Delete any communities you created
• Clear all your data

Type your username to confirm:`;

        const confirmation = prompt(confirmMessage);
        
        if (confirmation !== currentUser.username) {
            Utils.showSuccessMessage('Account deletion cancelled.');
            return;
        }

        try {
            // This would require admin privileges in a real implementation
            Utils.showSuccessMessage('Account deletion is not available in this demo. Contact an administrator for account deletion.');
        } catch (error) {
            console.error('Error deleting account:', error);
            Utils.showSuccessMessage('Failed to delete account. Please contact support.');
        }
    }
}

// Create global profile instance
const Profile = new ProfileManager();