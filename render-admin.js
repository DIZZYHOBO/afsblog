// render-admin.js - Admin UI rendering functions

// Admin page rendering and functionality
async function renderAdminPage() {
    if (!currentUser?.profile?.isAdmin) {
        const accessDeniedHtml = `
            <div class="feature-placeholder">
                <h3>🚫 Access Denied</h3>
                <p>You need administrator privileges to access this page.</p>
                <button class="btn" onclick="navigateToFeed()">Return to Feed</button>
            </div>
        `;
        updateFeedContent(accessDeniedHtml);
        return;
    }

    // Show loading
    updateFeedContent('<div class="loading">Loading admin panel...</div>');

    // Load all admin data
    await loadAdminStats();
    const pendingUsers = await loadPendingUsersList();
    const allUsers = await loadAllUsersList();
    const allCommunities = await loadAllCommunitiesList();

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
                        <div class="admin-stat-number" id="adminTotalUsers">0</div>
                        <div class="admin-stat-label">Total Users</div>
                    </div>
                </div>
                <div class="admin-stat-card pending">
                    <div class="admin-stat-icon">⏳</div>
                    <div class="admin-stat-info">
                        <div class="admin-stat-number" id="adminPendingUsers">0</div>
                        <div class="admin-stat-label">Pending Approval</div>
                    </div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-icon">📝</div>
                    <div class="admin-stat-info">
                        <div class="admin-stat-number" id="adminTotalPosts">0</div>
                        <div class="admin-stat-label">Total Posts</div>
                    </div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-icon">🏘️</div>
                    <div class="admin-stat-info">
                        <div class="admin-stat-number" id="adminTotalCommunities">0</div>
                        <div class="admin-stat-label">Communities</div>
                    </div>
                </div>
            </div>

            <!-- Admin Tabs -->
            <div class="admin-content">
                <div class="admin-tabs">
                    <button class="admin-tab active" id="adminPendingTab" onclick="switchAdminTab('pending')">
                        ⏳ Pending Users (${pendingUsers.length})
                    </button>
                    <button class="admin-tab" id="adminUsersTab" onclick="switchAdminTab('users')">
                        👥 All Users (${allUsers.length})
                    </button>
                    <button class="admin-tab" id="adminCommunitiesTab" onclick="switchAdminTab('communities')">
                        🏘️ Communities (${allCommunities.length})
                    </button>
                    <button class="admin-tab" id="adminPostsTab" onclick="switchAdminTab('posts')">
                        📝 Posts (${posts.length})
                    </button>
                </div>

                <div class="admin-tab-content">
                    <!-- Pending Users Tab -->
                    <div id="adminPendingContent" class="admin-tab-panel active">
                        ${renderPendingUsersPanel(pendingUsers)}
                    </div>

                    <!-- All Users Tab -->
                    <div id="adminUsersContent" class="admin-tab-panel">
                        ${renderAllUsersPanel(allUsers)}
                    </div>

                    <!-- Communities Tab -->
                    <div id="adminCommunitiesContent" class="admin-tab-panel">
                        ${renderCommunitiesPanel(allCommunities)}
                    </div>

                    <!-- Posts Tab -->
                    <div id="adminPostsContent" class="admin-tab-panel">
                        ${renderPostsPanel(posts)}
                    </div>
                </div>
            </div>
        </div>
    `;

    updateFeedContent(adminHtml);
    
    // Update the stats numbers
    document.getElementById('adminTotalUsers').textContent = allUsers.length;
    document.getElementById('adminPendingUsers').textContent = pendingUsers.length;
    document.getElementById('adminTotalPosts').textContent = posts.length;
    document.getElementById('adminTotalCommunities').textContent = allCommunities.length;
}

// Render pending users panel
function renderPendingUsersPanel(pendingUsers) {
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
                            <h4>@${escapeHtml(user.username)}</h4>
                            <p class="admin-user-bio">${escapeHtml(user.bio || 'No bio provided')}</p>
                            <div class="admin-user-meta">
                                <span>📅 Registered ${formatDate(user.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="admin-user-actions">
                        <button class="btn admin-approve-btn" onclick="approveUser('${user.username}', '${user.key}')">
                            ✅ Approve
                        </button>
                        <button class="btn btn-danger admin-reject-btn" onclick="rejectUser('${user.username}', '${user.key}')">
                            ❌ Reject
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// UPDATED: renderAllUsersPanel function with demote button and protection
function renderAllUsersPanel(allUsers) {
    return `
        <div class="admin-section-header">
            <h3>All Users Management</h3>
            <p>View and manage all registered users</p>
        </div>
        <div class="admin-users-list">
            ${allUsers.map(user => `
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
                                @${escapeHtml(user.username)}
                                ${user.isAdmin ? `<span class="admin-badge-small ${user.username === PROTECTED_ADMIN ? 'protected-badge' : ''}">${user.username === PROTECTED_ADMIN ? '🛡️ Protected Admin' : '👑 Admin'}</span>` : ''}
                            </h4>
                            <p class="admin-user-bio">${escapeHtml(user.bio || 'No bio provided')}</p>
                            <div class="admin-user-meta">
                                <span>📅 Joined ${formatDate(user.createdAt || new Date().toISOString())}</span>
                                <span>📝 ${posts.filter(p => p.author === user.username).length} posts</span>
                                <span>🏘️ ${communities.filter(c => c.createdBy === user.username).length} communities</span>
                            </div>
                        </div>
                    </div>
                    <div class="admin-user-actions">
                        ${!user.isAdmin ? `
                            <button class="btn admin-promote-btn" onclick="promoteToAdmin('${user.username}')">
                                👑 Make Admin
                            </button>
                        ` : user.username !== currentUser.username && user.username !== PROTECTED_ADMIN ? `
                            <button class="btn admin-demote-btn" onclick="demoteFromAdmin('${user.username}')">
                                📉 Remove Admin
                            </button>
                        ` : user.username === PROTECTED_ADMIN ? `
                            <button class="btn btn-secondary" disabled title="Protected admin cannot be demoted">
                                🛡️ Protected
                            </button>
                        ` : ''}
                        ${user.username !== currentUser.username ? `
                            <button class="btn btn-danger admin-delete-btn" onclick="deleteUser('${user.username}')">
                                🗑️ Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Render communities panel
function renderCommunitiesPanel(allCommunities) {
    return `
        <div class="admin-section-header">
            <h3>Communities Management</h3>
            <p>View and manage all communities</p>
        </div>
        <div class="admin-communities-list">
            ${allCommunities.map(community => {
                const communityPosts = posts.filter(p => p.communityName === community.name);
                return `
                    <div class="admin-community-card">
                        <div class="admin-community-info">
                            <div class="admin-community-avatar">
                                ${community.displayName.
