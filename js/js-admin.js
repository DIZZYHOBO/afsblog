// js/admin.js - Admin Panel Component
class AdminManager {
    constructor() {
        this.currentAdminTab = 'pending';
        this.adminData = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to user changes
        State.subscribe('currentUser', (user) => {
            if (user?.profile?.isAdmin && State.get('currentPage') === 'admin') {
                this.loadStats();
            }
        });
    }

    // Load admin statistics
    async loadStats() {
        try {
            const userKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.USER_PREFIX);
            const actualUserKeys = userKeys.filter(key => 
                key.startsWith(CONFIG.STORAGE_KEYS.USER_PREFIX) && 
                !key.startsWith(`${CONFIG.STORAGE_KEYS.USER_PREFIX}follows_`)
            );
            
            // Load and validate users
            const userPromises = actualUserKeys.map(async (key) => {
                try {
                    const user = await blobAPI.get(key);
                    return user && user.username ? user : null;
                } catch (error) {
                    return null;
                }
            });
            
            const validUsers = await Promise.all(userPromises);
            const uniqueUsers = this.removeDuplicateUsers(validUsers.filter(Boolean));
            
            const pendingUserKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.PENDING_USER_PREFIX);
            const postKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.POST_PREFIX);
            const communityKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX);

            this.adminData = {
                totalUsers: uniqueUsers.length,
                pendingUsers: pendingUserKeys.length,
                totalPosts: postKeys.length,
                totalCommunities: communityKeys.length,
                users: uniqueUsers,
                lastUpdated: new Date().toISOString()
            };
            
            console.log(`Admin stats loaded: ${uniqueUsers.length} users, ${pendingUserKeys.length} pending, ${postKeys.length} posts, ${communityKeys.length} communities`);
            
        } catch (error) {
            console.error('Error loading admin stats:', error);
            this.adminData = {
                totalUsers: 0,
                pendingUsers: 0,
                totalPosts: 0,
                totalCommunities: 0,
                users: [],
                lastUpdated: new Date().toISOString()
            };
        }
    }

    // Remove duplicate users based on username
    removeDuplicateUsers(users) {
        return users.reduce((acc, user) => {
            const existing = acc.find(u => u.username === user.username);
            if (!existing) {
                acc.push(user);
            }
            return acc;
        }, []);
    }

    // Render admin page
    async renderAdminPage() {
        if (!State.isAdmin()) {
            const accessDeniedHtml = `
                <div class="feature-placeholder">
                    <h3>🚫 Access Denied</h3>
                    <p>You need administrator privileges to access this page.</p>
                    <button class="btn" onclick="Navigation.navigateToFeed()">Return to Feed</button>
                </div>
            `;
            App.updateFeedContent(accessDeniedHtml);
            return;
        }

        // Show loading while loading data
        App.updateFeedContent('<div class="loading">Loading admin panel...</div>');

        // Load all admin data
        await this.loadStats();
        const pendingUsers = await this.loadPendingUsersList();
        const allUsers = this.adminData?.users || [];
        const allCommunities = State.get('communities');

        const adminHtml = `
            <div class="admin-page">
                <div class="admin-header">
                    <h1 class="admin-title">🔧 Admin Panel</h1>
                    <p class="admin-subtitle">Manage users, communities, and site content</p>
                </div>

                <!-- Admin Stats Cards -->
                <div class="admin-overview">
                    <div class="admin-stat-card">
                        <div class="admin-stat-icon">👥</div>
                        <div class="admin-stat-info">
                            <div class="admin-stat-number">${this.adminData?.totalUsers || 0}</div>
                            <div class="admin-stat-label">Total Users</div>
                        </div>
                    </div>
                    <div class="admin-stat-card ${pendingUsers.length > 0 ? 'pending' : ''}">
                        <div class="admin-stat-icon">⏳</div>
                        <div class="admin-stat-info">
                            <div class="admin-stat-number">${pendingUsers.length}</div>
                            <div class="admin-stat-label">Pending Approval</div>
                        </div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-icon">📝</div>
                        <div class="admin-stat-info">
                            <div class="admin-stat-number">${this.adminData?.totalPosts || 0}</div>
                            <div class="admin-stat-label">Total Posts</div>
                        </div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-icon">🏘️</div>
                        <div class="admin-stat-info">
                            <div class="admin-stat-number">${this.adminData?.totalCommunities || 0}</div>
                            <div class="admin-stat-label">Communities</div>
                        </div>
                    </div>
                </div>

                <!-- Admin Tabs -->
                <div class="admin-content">
                    <div class="admin-tabs">
                        <button class="admin-tab active" id="adminPendingTab" onclick="Admin.switchAdminTab('pending')">
                            ⏳ Pending Users (${pendingUsers.length})
                        </button>
                        <button class="admin-tab" id="adminUsersTab" onclick="Admin.switchAdminTab('users')">
                            👥 All Users (${allUsers.length})
                        </button>
                        <button class="admin-tab" id="adminCommunitiesTab" onclick="Admin.switchAdminTab('communities')">
                            🏘️ Communities (${allCommunities.length})
                        </button>
                        <button class="admin-tab" id="adminPostsTab" onclick="Admin.switchAdminTab('posts')">
                            📝 Posts (${State.get('posts').length})
                        </button>
                    </div>

                    <div class="admin-tab-content">
                        <!-- Pending Users Tab -->
                        <div id="adminPendingContent" class="admin-tab-panel active">
                            ${this.renderPendingUsersPanel(pendingUsers)}
                        </div>

                        <!-- All Users Tab -->
                        <div id="adminUsersContent" class="admin-tab-panel">
                            ${this.renderAllUsersPanel(allUsers)}
                        </div>

                        <!-- Communities Tab -->
                        <div id="adminCommunitiesContent" class="admin-tab-panel">
                            ${this.renderCommunitiesPanel(allCommunities)}
                        </div>

                        <!-- Posts Tab -->
                        <div id="adminPostsContent" class="admin-tab-panel">
                            ${this.renderPostsPanel(State.get('posts'))}
                        </div>
                    </div>
                </div>
            </div>
        `;

        App.updateFeedContent(adminHtml);
    }

    // Load pending users list
    async loadPendingUsersList() {
        try {
            const pendingKeys = await blobAPI.list(CONFIG.STORAGE_KEYS.PENDING_USER_PREFIX);
            console.log(`Found ${pendingKeys.length} pending user keys:`, pendingKeys);
            
            const pendingPromises = pendingKeys.map(async (key) => {
                try {
                    const user = await blobAPI.get(key);
                    if (user && user.username && user.status === 'pending') {
                        return { ...user, key };
                    }
                    return null;
                } catch (error) {
                    console.error(`Error loading pending user ${key}:`, error);
                    return null;
                }
            });
            
            const pendingUsers = await Promise.all(pendingPromises);
            const validPendingUsers = pendingUsers.filter(Boolean);
            
            console.log(`Loaded ${validPendingUsers.length} valid pending users`);
            return validPendingUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('Error loading pending users:', error);
            return [];
        }
    }

    // Render pending users panel
    renderPendingUsersPanel(pendingUsers) {
        if (pendingUsers.length === 0) {
            return `
                <div class="admin-empty-state">
                    <div class="admin-empty-icon">✅</div>
                    <h3>No Pending Users</h3>
                    <p>All user registrations have been processed!</p>
                </div>
            `;
        }

        return `
            <div class="admin-section-header">
                <h3>Pending User Approvals</h3>
                <p>Review and approve new user registrations</p>
            </div>
            <div class="admin-users-list">
                ${pendingUsers.map(user => `
                    <div class="admin-user-card">
                        <div class="admin-user-info">
                            <div class="admin-user-avatar">
                                ${user.username.charAt(0).toUpperCase()}
                            </div>
                            <div class="admin-user-details">
                                <h4>@${Utils.escapeHtml(user.username)}</h4>
                                <p class="admin-user-bio">${Utils.escapeHtml(user.bio || 'No bio provided')}</p>
                                <div class="admin-user-meta">
                                    <span>📅 Registered ${Utils.formatDate(user.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="admin-user-actions">
                            <button class="btn admin-approve-btn" onclick="Admin.approveUser('${user.username}', '${user.key}')">
                                ✅ Approve
                            </button>
                            <button class="btn btn-danger admin-reject-btn" onclick="Admin.rejectUser('${user.username}', '${user.key}')">
                                ❌ Reject
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Render all users panel
    renderAllUsersPanel(allUsers) {
        return `
            <div class="admin-section-header">
                <h3>All Users Management</h3>
                <p>View and manage all registered users</p>
            </div>
            <div class="admin-users-list">
                ${allUsers.map(user => {
                    const posts = State.get('posts');
                    const communities = State.get('communities');
                    const userPostCount = posts.filter(p => p.author === user.username).length;
                    const userCommunityCount = communities.filter(c => c.createdBy === user.username).length;
                    const isProtected = user.username === CONFIG.PROTECTED_ADMIN;
                    const currentUser = State.getCurrentUser();
                    
                    return `
                        <div class="admin-user-card">
                            <div class="admin-user-info">
                                <div class="admin-user-avatar">
                                    ${user.profilePicture ? 
                                        `<img src="${user.profilePicture}" alt="${user.username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; this.parentNode.innerHTML='${user.username.charAt(0).toUpperCase()}';">` 
                                        : user.username.charAt(0).toUpperCase()
                                    }
                                </div>
                                <div class="admin-user-details">
                                    <h4>
                                        @${Utils.escapeHtml(user.username)}
                                        ${user.isAdmin ? `<span class="admin-badge-small ${isProtected ? 'protected-badge' : ''}">${isProtected ? '🛡️ Protected Admin' : '👑 Admin'}</span>` : ''}
                                    </h4>
                                    <p class="admin-user-bio">${Utils.escapeHtml(user.bio || 'No bio provided')}</p>
                                    <div class="admin-user-meta">
                                        <span>📅 Joined ${Utils.formatDate(user.createdAt || new Date().toISOString())}</span>
                                        <span>📝 ${userPostCount} posts</span>
                                        <span>🏘️ ${userCommunityCount} communities</span>
                                    </div>
                                </div>
                            </div>
                            <div class="admin-user-actions">
                                ${!user.isAdmin ? `
                                    <button class="btn admin-promote-btn" onclick="Admin.promoteToAdmin('${user.username}')">
                                        👑 Make Admin
                                    </button>
                                ` : user.username !== currentUser.username && !isProtected ? `
                                    <button class="btn admin-demote-btn" onclick="Admin.demoteFromAdmin('${user.username}')">
                                        📉 Remove Admin
                                    </button>
                                ` : isProtected ? `
                                    <button class="btn btn-secondary" disabled title="Protected admin cannot be demoted">
                                        🛡️ Protected
                                    </button>
                                ` : ''}
                                ${user.username !== currentUser.username ? `
                                    <button class="btn btn-danger admin-delete-btn" onclick="Admin.deleteUser('${user.username}')">
                                        🗑️ Delete
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Render communities panel
    renderCommunitiesPanel(allCommunities) {
        return `
            <div class="admin-section-header">
                <h3>Communities Management</h3>
                <p>View and manage all communities</p>
            </div>
            <div class="admin-communities-list">
                ${allCommunities.map(community => {
                    const posts = State.get('posts');
                    const communityPosts = posts.filter(p => p.communityName === community.name);
                    
                    return `
                        <div class="admin-community-card">
                            <div class="admin-community-info">
                                <div class="admin-community-avatar">
                                    ${community.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div class="admin-community-details">
                                    <h4>${Utils.escapeHtml(community.displayName)}</h4>
                                    <p class="admin-community-handle">c/${Utils.escapeHtml(community.name)}</p>
                                    <p class="admin-community-description">${Utils.escapeHtml(community.description || 'No description')}</p>
                                    <div class="admin-community-meta">
                                        <span>👤 Created by @${Utils.escapeHtml(community.createdBy)}</span>
                                        <span>📅 ${Utils.formatDate(community.createdAt)}</span>
                                        <span>👥 ${community.members?.length || 1} members</span>
                                        <span>📝 ${communityPosts.length} posts</span>
                                    </div>
                                </div>
                            </div>
                            <div class="admin-community-actions">
                                <button class="btn btn-secondary" onclick="Navigation.navigateToCommunity('${community.name}')">
                                    👁️ View
                                </button>
                                <button class="btn btn-danger" onclick="Admin.deleteCommunity('${community.name}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Render posts panel
    renderPostsPanel(allPosts) {
        const recentPosts = allPosts.slice(0, 20); // Show latest 20 posts
        
        return `
            <div class="admin-section-header">
                <h3>Posts Management</h3>
                <p>View and manage all posts (showing latest 20)</p>
                <div class="admin-filters">
                    <button class="btn btn-small" onclick="Admin.filterAdminPosts('all')">All Posts</button>
                    <button class="btn btn-small btn-secondary" onclick="Admin.filterAdminPosts('public')">Public Only</button>
                    <button class="btn btn-small btn-secondary" onclick="Admin.filterAdminPosts('private')">Private Only</button>
                </div>
            </div>
            <div class="admin-posts-list" id="adminPostsList">
                ${Posts.renderPostList(recentPosts, 'No posts found')}
                ${allPosts.length > 20 ? `<div class="admin-load-more"><button class="btn btn-secondary" onclick="Admin.loadMoreAdminPosts()">Load More Posts</button></div>` : ''}
            </div>
        `;
    }

    // Switch admin tabs
    switchAdminTab(tabName) {
        this.currentAdminTab = tabName;
        
        // Update tab visual states
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).classList.add('active');
        
        // Update content visibility
        document.querySelectorAll('.admin-tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Content`).classList.add('active');
    }

    // Admin actions
    async approveUser(username, pendingKey) {
        if (!confirm(`Approve user @${username}?`)) return;
        
        try {
            // Get pending user data
            const pendingUser = await blobAPI.get(pendingKey);
            if (!pendingUser) {
                Utils.showSuccessMessage('Pending user not found');
                return;
            }

            // Create approved user
            const approvedUser = {
                ...pendingUser,
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: State.getCurrentUser().username
            };

            // Save as regular user
            await blobAPI.set(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`, approvedUser);
            
            // Delete pending user
            await blobAPI.delete(pendingKey);

            Utils.showSuccessMessage(`User @${username} approved successfully!`);
            
            // Refresh admin page
            this.renderAdminPage();
            
        } catch (error) {
            console.error('Error approving user:', error);
            Utils.showSuccessMessage('Failed to approve user. Please try again.');
        }
    }

    async rejectUser(username, pendingKey) {
        if (!confirm(`Reject user @${username}? This action cannot be undone.`)) return;
        
        try {
            // Delete pending user
            await blobAPI.delete(pendingKey);
            Utils.showSuccessMessage(`User @${username} rejected and removed.`);
            
            // Refresh admin page
            this.renderAdminPage();
            
        } catch (error) {
            console.error('Error rejecting user:', error);
            Utils.showSuccessMessage('Failed to reject user. Please try again.');
        }
    }

    async promoteToAdmin(username) {
        if (!confirm(`Promote @${username} to administrator? They will have full admin privileges.`)) return;
        
        try {
            const user = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`);
            if (!user) {
                Utils.showSuccessMessage('User not found');
                return;
            }

            if (user.isAdmin) {
                Utils.showSuccessMessage(`@${username} is already an admin!`);
                return;
            }

            // Update user to admin
            const updatedUser = {
                ...user,
                isAdmin: true,
                promotedAt: new Date().toISOString(),
                promotedBy: State.getCurrentUser().username
            };

            await blobAPI.set(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`, updatedUser);
            Utils.showSuccessMessage(`@${username} promoted to administrator!`);
            
            // Refresh admin page
            this.renderAdminPage();
            
        } catch (error) {
            console.error('Error promoting user:', error);
            Utils.showSuccessMessage('Failed to promote user. Please try again.');
        }
    }

    async demoteFromAdmin(username) {
        // Check if trying to demote the protected admin
        if (username === CONFIG.PROTECTED_ADMIN) {
            Utils.showSuccessMessage(`@${CONFIG.PROTECTED_ADMIN} is a protected admin and cannot be demoted by anyone.`);
            return;
        }

        // Prevent self-demotion
        if (username === State.getCurrentUser().username) {
            Utils.showSuccessMessage('You cannot demote yourself.');
            return;
        }

        if (!confirm(`Remove admin privileges from @${username}? They will become a regular user.`)) return;
        
        try {
            const user = await blobAPI.get(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`);
            if (!user) {
                Utils.showSuccessMessage('User not found');
                return;
            }

            if (!user.isAdmin) {
                Utils.showSuccessMessage('User is not an admin');
                return;
            }

            // Update user to remove admin privileges
            const updatedUser = {
                ...user,
                isAdmin: false,
                demotedAt: new Date().toISOString(),
                demotedBy: State.getCurrentUser().username
            };

            await blobAPI.set(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`, updatedUser);
            Utils.showSuccessMessage(`@${username} admin privileges removed!`);
            
            // Refresh admin page
            this.renderAdminPage();
            
        } catch (error) {
            console.error('Error demoting user:', error);
            Utils.showSuccessMessage('Failed to remove admin privileges. Please try again.');
        }
    }

    async deleteUser(username) {
        if (!confirm(`Delete user @${username}? This will also delete all their posts and remove them from communities. This action cannot be undone.`)) return;
        
        try {
            const posts = State.get('posts');
            const communities = State.get('communities');
            
            // Delete user
            await blobAPI.delete(`${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`);
            
            // Delete user's posts
            const userPosts = posts.filter(p => p.author === username);
            for (const post of userPosts) {
                await blobAPI.delete(post.id);
            }
            
            // Remove from communities and update communities
            for (const community of communities) {
                if (community.members && community.members.includes(username)) {
                    community.members = community.members.filter(m => m !== username);
                    await blobAPI.set(`${CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX}${community.name}`, community);
                }
            }
            
            // Delete user follows
            try {
                await blobAPI.delete(`${CONFIG.STORAGE_KEYS.FOLLOWED_COMMUNITIES}${username}`);
            } catch (e) {
                // Ignore if doesn't exist
            }

            Utils.showSuccessMessage(`User @${username} deleted successfully.`);
            
            // Refresh data and admin page
            await App.loadPosts();
            await App.loadCommunities();
            this.renderAdminPage();
            
        } catch (error) {
            console.error('Error deleting user:', error);
            Utils.showSuccessMessage('Failed to delete user. Please try again.');
        }
    }

    async deleteCommunity(communityName) {
        if (!confirm(`Delete community c/${communityName}? This will also delete all posts in this community. This action cannot be undone.`)) return;
        
        try {
            const posts = State.get('posts');
            
            // Delete community
            await blobAPI.delete(`${CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX}${communityName}`);
            
            // Delete community posts
            const communityPosts = posts.filter(p => p.communityName === communityName);
            for (const post of communityPosts) {
                await blobAPI.delete(post.id);
            }

            Utils.showSuccessMessage(`Community c/${communityName} deleted successfully.`);
            
            // Refresh data and admin page
            await App.loadPosts();
            await App.loadCommunities();
            this.renderAdminPage();
            
        } catch (error) {
            console.error('Error deleting community:', error);
            Utils.showSuccessMessage('Failed to delete community. Please try again.');
        }
    }

    // Filter posts (placeholder)
    filterAdminPosts(filter) {
        const posts = State.get('posts');
        let filteredPosts;
        
        switch (filter) {
            case 'public':
                filteredPosts = posts.filter(p => !p.isPrivate);
                break;
            case 'private':
                filteredPosts = posts.filter(p => p.isPrivate);
                break;
            default:
                filteredPosts = posts;
        }
        
        const postsList = document.getElementById('adminPostsList');
        if (postsList) {
            postsList.innerHTML = Posts.renderPostList(filteredPosts.slice(0, 20), 'No posts found') +
                (filteredPosts.length > 20 ? `<div class="admin-load-more"><button class="btn btn-secondary" onclick="Admin.loadMoreAdminPosts()">Load More Posts</button></div>` : '');
        }
        
        // Update filter button states
        document.querySelectorAll('.admin-filters .btn').forEach(btn => {
            btn.classList.add('btn-secondary');
        });
        event.target.classList.remove('btn-secondary');
    }

    // Load more posts (placeholder)
    loadMoreAdminPosts() {
        Utils.showSuccessMessage('Load more functionality coming soon!');
    }
}

// Create global admin instance
const Admin = new AdminManager();