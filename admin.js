// admin.js - Admin functionality - UPDATED: Private post access removed

// Admin stats loading
async function loadAdminStats() {
    try {
        // Load actual approved users (not pending ones)
        const userKeys = await blobAPI.list('user_');
        const actualUserKeys = userKeys.filter(key => key.startsWith('user_') && !key.startsWith('user_follows_'));
        
        // Load and validate users to avoid counting invalid entries
        const userPromises = actualUserKeys.map(async (key) => {
            try {
                const user = await blobAPI.get(key);
                return user && user.username ? user : null;
            } catch (error) {
                return null;
            }
        });
        
        const validUsers = await Promise.all(userPromises);
        const uniqueUsers = validUsers.filter(Boolean);
        
        // Remove duplicates based on username
        const finalUsers = uniqueUsers.reduce((acc, user) => {
            const existing = acc.find(u => u.username === user.username);
            if (!existing) {
                acc.push(user);
            }
            return acc;
        }, []);
        
        const pendingUserKeys = await blobAPI.list('pending_user_');
        const postKeys = await blobAPI.list('post_');
        
        // UPDATED: Only count PUBLIC posts for admin stats
        const publicPostCount = posts.filter(post => !post.isPrivate).length;
        
        const communityKeys = await blobAPI.list('community_');

        // Update the old admin panel stats if they exist
        const totalUsersEl = document.getElementById('totalUsers');
        const pendingUsersEl = document.getElementById('pendingUsers');
        const totalPostsEl = document.getElementById('totalPosts');
        const totalCommunitiesEl = document.getElementById('totalCommunities');
        
        if (totalUsersEl) totalUsersEl.textContent = finalUsers.length;
        if (pendingUsersEl) pendingUsersEl.textContent = pendingUserKeys.length;
        if (totalPostsEl) totalPostsEl.textContent = publicPostCount; // Only public posts
        if (totalCommunitiesEl) totalCommunitiesEl.textContent = communityKeys.length;
        
        // Update the new admin page stats if they exist
        const adminTotalUsersEl = document.getElementById('adminTotalUsers');
        const adminPendingUsersEl = document.getElementById('adminPendingUsers');
        const adminTotalPostsEl = document.getElementById('adminTotalPosts');
        const adminTotalCommunitiesEl = document.getElementById('adminTotalCommunities');
        
        if (adminTotalUsersEl) adminTotalUsersEl.textContent = finalUsers.length;
        if (adminPendingUsersEl) adminPendingUsersEl.textContent = pendingUserKeys.length;
        if (adminTotalPostsEl) adminTotalPostsEl.textContent = publicPostCount; // Only public posts
        if (adminTotalCommunitiesEl) adminTotalCommunitiesEl.textContent = communityKeys.length;
        
        console.log(`Admin stats: ${finalUsers.length} users, ${pendingUserKeys.length} pending, ${publicPostCount} public posts, ${communityKeys.length} communities`);
        
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Load pending users list (make sure we only get pending users, not approved ones)
async function loadPendingUsersList() {
    try {
        const pendingKeys = await blobAPI.list('pending_user_');
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

// Load all users list (only approved users, not pending ones)
async function loadAllUsersList() {
    try {
        const userKeys = await blobAPI.list('user_');
        // Filter out any keys that might be pending users or other data
        const actualUserKeys = userKeys.filter(key => key.startsWith('user_') && !key.startsWith('user_follows_'));
        
        const userPromises = actualUserKeys.map(async (key) => {
            try {
                const user = await blobAPI.get(key);
                if (user && user.username) { // Only include valid user objects
                    return { ...user, key };
                }
                return null;
            } catch (error) {
                console.error(`Error loading user ${key}:`, error);
                return null;
            }
        });
        
        const allUsers = await Promise.all(userPromises);
        const validUsers = allUsers.filter(Boolean);
        
        // Remove duplicates based on username
        const uniqueUsers = validUsers.reduce((acc, user) => {
            const existing = acc.find(u => u.username === user.username);
            if (!existing) {
                acc.push(user);
            }
            return acc;
        }, []);
        
        console.log(`Loaded ${uniqueUsers.length} unique users from ${actualUserKeys.length} user keys`);
        return uniqueUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (error) {
        console.error('Error loading all users:', error);
        return [];
    }
}

// Load all communities list
async function loadAllCommunitiesList() {
    return communities; // We already have this loaded
}

// Admin actions
async function approveUser(username, pendingKey) {
    if (!confirm(`Approve user @${username}?`)) return;
    
    try {
        // Get pending user data
        const pendingUser = await blobAPI.get(pendingKey);
        if (!pendingUser) {
            showSuccessMessage('Pending user not found');
            return;
        }

        // Create approved user
        const approvedUser = {
            ...pendingUser,
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.username
        };

        // Save as regular user
        await blobAPI.set(`user_${username}`, approvedUser);
        
        // Delete pending user
        await blobAPI.delete(pendingKey);

        showSuccessMessage(`User @${username} approved successfully!`);
        
        // Refresh admin page
        renderAdminPage();
        
    } catch (error) {
        console.error('Error approving user:', error);
        showSuccessMessage('Failed to approve user. Please try again.');
    }
}

async function rejectUser(username, pendingKey) {
    if (!confirm(`Reject user @${username}? This action cannot be undone.`)) return;
    
    try {
        // Delete pending user
        await blobAPI.delete(pendingKey);
        showSuccessMessage(`User @${username} rejected and removed.`);
        
        // Refresh admin page
        renderAdminPage();
        
    } catch (error) {
        console.error('Error rejecting user:', error);
        showSuccessMessage('Failed to reject user. Please try again.');
    }
}

async function promoteToAdmin(username) {
    if (!confirm(`Promote @${username} to administrator? They will have full admin privileges.`)) return;
    
    try {
        const user = await blobAPI.get(`user_${username}`);
        if (!user) {
            showSuccessMessage('User not found');
            return;
        }

        if (user.isAdmin) {
            showSuccessMessage(`@${username} is already an admin!`);
            return;
        }

        // Update user to admin
        const updatedUser = {
            ...user,
            isAdmin: true,
            promotedAt: new Date().toISOString(),
            promotedBy: currentUser.username
        };

        await blobAPI.set(`user_${username}`, updatedUser);
        showSuccessMessage(`@${username} promoted to administrator!`);
        
        // Refresh admin page
        renderAdminPage();
        
    } catch (error) {
        console.error('Error promoting user:', error);
        showSuccessMessage('Failed to promote user. Please try again.');
    }
}

// NEW: Admin demotion function with @dumbass protection
async function demoteFromAdmin(username) {
    // Check if trying to demote the protected admin
    if (username === PROTECTED_ADMIN) {
        showSuccessMessage(`@${PROTECTED_ADMIN} is a protected admin and cannot be demoted by anyone.`);
        return;
    }

    // Prevent self-demotion
    if (username === currentUser.username) {
        showSuccessMessage('You cannot demote yourself.');
        return;
    }

    if (!confirm(`Remove admin privileges from @${username}? They will become a regular user.`)) return;
    
    try {
        const user = await blobAPI.get(`user_${username}`);
        if (!user) {
            showSuccessMessage('User not found');
            return;
        }

        if (!user.isAdmin) {
            showSuccessMessage('User is not an admin');
            return;
        }

        // Update user to remove admin privileges
        const updatedUser = {
            ...user,
            isAdmin: false,
            demotedAt: new Date().toISOString(),
            demotedBy: currentUser.username
        };

        await blobAPI.set(`user_${username}`, updatedUser);
        showSuccessMessage(`@${username} admin privileges removed!`);
        
        // Refresh admin page
        renderAdminPage();
        
    } catch (error) {
        console.error('Error demoting user:', error);
        showSuccessMessage('Failed to remove admin privileges. Please try again.');
    }
}

async function deleteUser(username) {
    if (!confirm(`Delete user @${username}? This will also delete all their PUBLIC posts and remove them from communities. This action cannot be undone. Note: Private posts are not accessible to admins and cannot be deleted through the admin panel.`)) return;
    
    try {
        // Delete user
        await blobAPI.delete(`user_${username}`);
        
        // Delete user's PUBLIC posts only (private posts are not admin business)
        const userPublicPosts = posts.filter(p => p.author === username && !p.isPrivate);
        for (const post of userPublicPosts) {
            await blobAPI.delete(post.id);
        }
        
        // Remove from communities
        for (const community of communities) {
            if (community.members && community.members.includes(username)) {
                community.members = community.members.filter(m => m !== username);
                await blobAPI.set(`community_${community.name}`, community);
            }
        }
        
        // Delete user follows
        try {
            await blobAPI.delete(`user_follows_${username}`);
        } catch (e) {
            // Ignore if doesn't exist
        }

        showSuccessMessage(`User @${username} deleted successfully. ${userPublicPosts.length} public posts were removed. Private posts remain private and were not affected.`);
        
        // Refresh data and admin page
        await loadPosts();
        await loadCommunities();
        renderAdminPage();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showSuccessMessage('Failed to delete user. Please try again.');
    }
}

async function deleteCommunity(communityName) {
    if (!confirm(`Delete community c/${communityName}? This will also delete all PUBLIC posts in this community. This action cannot be undone. Note: Private posts are not accessible to admins and cannot be deleted through the admin panel.`)) return;
    
    try {
        // Delete community
        await blobAPI.delete(`community_${communityName}`);
        
        // Delete community's PUBLIC posts only
        const communityPublicPosts = posts.filter(p => p.communityName === communityName && !p.isPrivate);
        for (const post of communityPublicPosts) {
            await blobAPI.delete(post.id);
        }

        showSuccessMessage(`Community c/${communityName} deleted successfully. ${communityPublicPosts.length} public posts were removed. Private posts remain private and were not affected.`);
        
        // Refresh data and admin page
        await loadPosts();
        await loadCommunities();
        renderAdminPage();
        
    } catch (error) {
        console.error('Error deleting community:', error);
        showSuccessMessage('Failed to delete community. Please try again.');
    }
}

// Admin tab switching
let currentAdminTab = 'pending';

function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    
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

// UPDATED: Post filtering for admin - only public posts, no private option
function filterAdminPosts(filter) {
    let filteredPosts;
    
    // Only work with PUBLIC posts - private posts are not admin business
    const publicPosts = posts.filter(p => !p.isPrivate);
    
    switch (filter) {
        case 'community':
            filteredPosts = publicPosts.filter(p => p.communityName);
            break;
        case 'general':
            filteredPosts = publicPosts.filter(p => !p.communityName);
            break;
        default:
            filteredPosts = publicPosts;
    }
    
    const postsList = document.getElementById('adminPostsList');
    if (postsList) {
        postsList.innerHTML = renderPostList(filteredPosts.slice(0, 20), 'No public posts found') +
            (filteredPosts.length > 20 ? `<div class="admin-load-more"><button class="btn btn-secondary" onclick="loadMoreAdminPosts()">Load More Posts</button></div>` : '');
    }
    
    // Update filter button states
    document.querySelectorAll('.admin-filters .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    });
    
    // Find and highlight active button
    const activeButton = Array.from(document.querySelectorAll('.admin-filters .btn')).find(btn => 
        btn.onclick.toString().includes(`'${filter}'`)
    );
    if (activeButton) {
        activeButton.classList.remove('btn-secondary');
        activeButton.classList.add('btn-primary');
    }
}

// Legacy admin functions (keeping for compatibility)
function showAdminPanel() {
    const adminPanel = document.getElementById('adminPanel');
    const isVisible = adminPanel.style.display !== 'none';
    adminPanel.style.display = isVisible ? 'none' : 'block';

    if (isVisible) {
        document.getElementById('pendingUsersSection').style.display = 'none';
        document.getElementById('allUsersSection').style.display = 'none';
        document.getElementById('adminCommunitiesSection').style.display = 'none';
    }
}

async function loadPendingUsers() {
    // TODO: Implement pending users management
    showSuccessMessage('Pending users management coming soon!');
}

async function loadAllUsers() {
    // TODO: Implement all users management
    showSuccessMessage('User management coming soon!');
}

async function loadAdminCommunities() {
    // TODO: Implement community management
    showSuccessMessage('Community management coming soon!');
}

function refreshAdminStats() {
    loadAdminStats();
    showSuccessMessage('Admin stats refreshed!');
}
