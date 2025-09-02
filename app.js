// App state
        let currentUser = null;
        let currentPage = 'feed';
        let communities = [];
        let posts = [];
        let currentCommunity = null;
        let isLoading = false;
        let adminData = null;
        let currentPostType = 'text';
        let uploadedMedia = null;
        let markdownRenderer;
        let inlineLoginFormOpen = false;
        let currentFeedTab = 'general'; // Track current feed tab

        // PROTECTED_ADMIN constant - matches the API
        const PROTECTED_ADMIN = "dumbass";

        // Menu functions
        function toggleMenu() {
            const menu = document.getElementById('slideMenu');
            const overlay = document.getElementById('menuOverlay');
            const isOpen = menu.classList.contains('open');
            
            if (isOpen) {
                menu.classList.remove('open');
                overlay.classList.remove('active');
            } else {
                menu.classList.add('open');
                overlay.classList.add('active');
                updateMenuContent();
            }
        }

        function updateMenuContent() {
            const menuHeader = document.getElementById('menuHeader');
            const menuLogout = document.getElementById('menuLogout');
            
            if (currentUser) {
            // Update menu avatar to use profile picture
            if (currentUser.profile?.profilePicture) {
                menuHeader.innerHTML = `
                    <div class="menu-user-info">
                        <img src="${currentUser.profile.profilePicture}" 
                             alt="Profile" 
                             class="profile-avatar"
                             style="border-radius: 50%; object-fit: cover;"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="profile-avatar" style="display: none;">${currentUser.username.charAt(0).toUpperCase()}</div>
                        <div class="menu-user-details">
                            <h4>@${escapeHtml(currentUser.username)}</h4>
                            <p>${currentUser.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                        </div>
                    </div>
                `;
            } else {
                menuHeader.innerHTML = `
                    <div class="menu-user-info">
                        <div class="profile-avatar">${currentUser.username.charAt(0).toUpperCase()}</div>
                        <div class="menu-user-details">
                            <h4>@${escapeHtml(currentUser.username)}</h4>
                            <p>${currentUser.profile?.isAdmin ? 'Administrator' : 'Member'}</p>
                        </div>
                    </div>
                `;
            }
                
                // Show/hide menu items based on auth status
                document.getElementById('menuProfile').style.display = 'flex';
                document.getElementById('menuCreateCommunity').style.display = 'flex';
                document.getElementById('menuBrowseCommunities').style.display = 'flex';
                document.getElementById('menuSettings').style.display = 'flex';
                
                // Show admin menu item only for admins
                const menuAdmin = document.getElementById('menuAdmin');
                if (currentUser.profile?.isAdmin) {
                    menuAdmin.style.display = 'flex';
                } else {
                    menuAdmin.style.display = 'none';
                }
                
                menuLogout.style.display = 'flex';
                
                // Update communities dropdown
                updateCommunitiesInMenu();
            } else {
                menuHeader.innerHTML = `
                    <div class="login-prompt">
                        <div class="login-prompt-title">Click here to log in</div>
                        <button class="login-toggle-btn" onclick="toggleInlineLoginForm()">Login</button>
                        <div class="inline-login-form" id="inlineLoginForm">
                            <div id="inlineLoginError"></div>
                            <form id="inlineLoginFormElement" onsubmit="handleInlineLogin(event)">
                                <div class="inline-form-group">
                                    <label for="inlineUsername">Username</label>
                                    <input type="text" id="inlineUsername" required minlength="3" maxlength="20">
                                </div>
                                <div class="inline-form-group">
                                    <label for="inlinePassword">Password</label>
                                    <input type="password" id="inlinePassword" required minlength="6">
                                </div>
                                <div class="inline-form-buttons">
                                    <button type="submit" class="inline-btn-primary" id="inlineLoginBtn">Sign In</button>
                                    <button type="button" class="inline-btn-secondary" onclick="openAuthModal('signup'); toggleMenu();">Sign Up</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                
                // Hide authenticated menu items
                document.getElementById('menuProfile').style.display = 'none';
                document.getElementById('menuCreateCommunity').style.display = 'none';
                document.getElementById('menuBrowseCommunities').style.display = 'none';
                document.getElementById('menuAdmin').style.display = 'none';
                document.getElementById('menuSettings').style.display = 'none';
                menuLogout.style.display = 'none';
            }
        }

        function toggleInlineLoginForm() {
            const form = document.getElementById('inlineLoginForm');
            const isOpen = form.classList.contains('open');
            
            if (isOpen) {
                form.classList.remove('open');
                inlineLoginFormOpen = false;
            } else {
                form.classList.add('open');
                inlineLoginFormOpen = true;
                // Focus on username field
                setTimeout(() => {
                    document.getElementById('inlineUsername').focus();
                }, 300);
            }
        }

        async function handleInlineLogin(e) {
            e.preventDefault();
            
            const username = document.getElementById('inlineUsername').value.trim();
            const password = document.getElementById('inlinePassword').value;
            const errorDiv = document.getElementById('inlineLoginError');
            const submitBtn = document.getElementById('inlineLoginBtn');

            errorDiv.innerHTML = '';
            
            if (username.length < 3) {
                showInlineError('Username must be at least 3 characters long');
                return;
            }
            
            if (password.length < 6) {
                showInlineError('Password must be at least 6 characters long');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';

                const user = await blobAPI.get(`user_${username}`);
                
                if (!user) {
                    const pendingUser = await blobAPI.get(`pending_user_${username}`);
                    if (pendingUser) {
                        showInlineError('Your account is still pending admin approval.');
                    } else {
                        showInlineError('Invalid username or password');
                    }
                    return;
                }
                
                if (user.password !== password) {
                    showInlineError('Invalid username or password');
                    return;
                }
                
                currentUser = { username, profile: user };
                await blobAPI.set('current_user', currentUser);
                
                // Load user's followed communities after login
                await loadFollowedCommunities();
                
                // Clear the form
                document.getElementById('inlineLoginFormElement').reset();
                
                // Close menu and update UI
                toggleMenu();
                updateUI();
                showSuccessMessage('Welcome back!');

                if (user.isAdmin) {
                    await loadAdminStats();
                }
                
            } catch (error) {
                console.error('Inline login error:', error);
                showInlineError('Something went wrong. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        }

        function showInlineError(message) {
            const errorDiv = document.getElementById('inlineLoginError');
            errorDiv.innerHTML = `<div class="inline-error-message">${escapeHtml(message)}</div>`;
        }

        function handleLogout() {
            logout();
            toggleMenu();
        }

        function updateCommunitiesInMenu() {
            const dropdown = document.getElementById('communitiesDropdown');
            
            if (communities.length === 0) {
                dropdown.innerHTML = '<div class="community-item">No communities yet</div>';
            } else {
                dropdown.innerHTML = communities.map(community => `
                    <a href="#" class="community-item" onclick="navigateToCommunity('${community.name}'); return false;">
                        c/${escapeHtml(community.displayName)}
                    </a>
                `).join('');
            }
        }

        function toggleCommunitiesDropdown() {
            const dropdown = document.getElementById('communitiesDropdown');
            const toggle = document.getElementById('communitiesToggle');
            const isOpen = dropdown.classList.contains('open');
            
            if (isOpen) {
                dropdown.classList.remove('open');
                toggle.textContent = '▼';
            } else {
                dropdown.classList.add('open');
                toggle.textContent = '▲';
            }
        }

        // Navigation functions
        function navigateToFeed() {
            toggleMenu();
            currentPage = 'feed';
            updateActiveMenuItem('menuFeed');
            updateUI();
        }

        function navigateToProfile() {
            toggleMenu();
            currentPage = 'profile';
            updateActiveMenuItem('menuProfile');
            updateUI();
        }

        function openCreateCommunity() {
            toggleMenu();
            if (!currentUser) {
                openAuthModal('signin');
                return;
            }
            openModal('createCommunityModal');
        }

        // FIXED: navigateToCommunity function with better debugging
        function navigateToCommunity(communityName) {
            console.log('navigateToCommunity called with:', communityName);
            toggleMenu();
            currentPage = 'community';
            currentCommunity = communityName;
            console.log('Set currentCommunity to:', currentCommunity);
            console.log('Communities array:', communities.map(c => c.name));
            updateUI();
        }

        function navigateToAdmin() {
            toggleMenu();
            if (!currentUser?.profile?.isAdmin) {
                showSuccessMessage('Access denied. Admin privileges required.');
                return;
            }
            currentPage = 'admin';
            updateActiveMenuItem('menuAdmin');
            updateUI();
        }

        function updateActiveMenuItem(activeId) {
            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.remove('active');
            });
            document.getElementById(activeId).classList.add('active');
        }

        // Feed Tab Functions
        function switchFeedTab(tabName) {
            currentFeedTab = tabName;
            
            // Update tab visual states
            document.querySelectorAll('.feed-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById(`${tabName}Tab`).classList.add('active');
            
            // Re-render the current page with new tab
            renderCurrentPage();
        }

        function updateFeedTabsVisibility() {
            const feedTabs = document.getElementById('feedTabs');
            // Show tabs only on feed page when user is logged in
            if (currentPage === 'feed' && currentUser) {
                feedTabs.style.display = 'flex';
                
                // Enable all tabs for logged in users
                const followedTab = document.getElementById('followedTab');
                followedTab.disabled = false;
            } else {
                feedTabs.style.display = 'none';
            }
        }

        // Admin functions - UPDATED with demotion and @dumbass protection
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

        // Render user profile page
        async function renderProfilePage() {
            if (!currentUser) {
                const loginRequiredHtml = `
                    <div class="feature-placeholder">
                        <h3>👤 Profile</h3>
                        <p>Please sign in to view your profile and manage your posts.</p>
                        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
                            <button class="btn" onclick="openAuthModal('signin')">Sign In</button>
                            <button class="btn btn-secondary" onclick="openAuthModal('signup')">Sign Up</button>
                        </div>
                    </div>
                `;
                updateFeedContent(loginRequiredHtml);
                return;
            }

            // Show loading
            updateFeedContent('<div class="loading">Loading profile...</div>');

            // Get user's posts (only public posts for profile display)
            const userPosts = posts.filter(post => post.author === currentUser.username && !post.isPrivate);
            const totalPosts = posts.filter(post => post.author === currentUser.username).length;
            const publicPosts = userPosts; // All posts shown are public
            const privatePosts = posts.filter(post => post.author === currentUser.username && post.isPrivate);

            // Get user's followed communities count
            const followedCount = followedCommunities.size;

            // Get communities created by user
            const createdCommunities = communities.filter(c => c.createdBy === currentUser.username);

            // Calculate some stats
            const totalReplies = posts.reduce((total, post) => {
                if (!post.replies) return total;
                return total + post.replies.filter(reply => reply.author === currentUser.username).length;
            }, 0);

            // Get profile picture URL (default if not set)
            const profilePictureUrl = currentUser.profile?.profilePicture || '';

            const profileHtml = `
                <div class="profile-page">
                    <!-- Profile Header -->
                    <div class="profile-header">
                        <div class="profile-hero">
                            <div class="profile-picture-container">
                                <img src="${profilePictureUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiM0Yjc2ODgiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM3LjUiIHI9IjEyLjUiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI1IDc3LjVDMjUgNjcuODM1IDMyLjgzNSA2MCA0Mi41IDYwaDE1QzY3LjE2NSA2MCA3NSA2Ny44MzUgNzUgNzcuNVY4MEgyNVY3Ny41WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4='}" 
                                     alt="Profile Picture" 
                                     class="profile-picture"
                                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiM0Yjc2ODgiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM3LjUiIHI9IjEyLjUiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI1IDc3LjVDMjUgNjcuODM1IDMyLjgzNSA2MCA0Mi41IDYwaDE1QzY3LjE2NSA2MCA3NSA2Ny44MzUgNzUgNzcuNVY4MEgyNVY3Ny41WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4='" />
                                <button class="edit-picture-btn" onclick="openEditProfileModal()" title="Edit Profile">
                                    <span>✏️</span>
                                </button>
                            </div>
                            <div class="profile-info">
                                <h1 class="profile-username">@${escapeHtml(currentUser.username)}</h1>
                                ${currentUser.profile?.isAdmin ? '<div class="admin-badge">👑 Administrator</div>' : ''}
                                <p class="profile-bio">${escapeHtml(currentUser.profile?.bio || 'No bio yet. Click edit to add one!')}</p>
                                <div class="profile-join-date">
                                    <span>📅 Joined ${formatDate(currentUser.profile?.createdAt || new Date().toISOString())}</span>
                                </div>
                            </div>
                            <div class="profile-actions">
                                <button class="btn" onclick="openEditProfileModal()">
                                    ✏️ Edit Profile
                                </button>
                            </div>
                        </div>
                        
                        <!-- Profile Stats -->
                        <div class="profile-stats">
                            <div class="stat-item">
                                <span class="stat-number">${totalPosts}</span>
                                <span class="stat-label">total posts</span>
                            </div>
                            <div class="stat-divider"></div>
                            <div class="stat-item">
                                <span class="stat-number">${publicPosts.length}</span>
                                <span class="stat-label">public posts</span>
                            </div>
                            <div class="stat-divider"></div>
                            <div class="stat-item">
                                <span class="stat-number">${privatePosts.length}</span>
                                <span class="stat-label">private posts</span>
                            </div>
                            <div class="stat-divider"></div>
                            <div class="stat-item">
                                <span class="stat-number">${followedCount}</span>
                                <span class="stat-label">following</span>
                            </div>
                            <div class="stat-divider"></div>
                            <div class="stat-item">
                                <span class="stat-number">${createdCommunities.length}</span>
                                <span class="stat-label">communities</span>
                            </div>
                            <div class="stat-divider"></div>
                            <div class="stat-item">
                                <span class="stat-number">${totalReplies}</span>
                                <span class="stat-label">replies</span>
                            </div>
                        </div>
                    </div>

                    <!-- Profile Content Tabs -->
                    <div class="profile-content">
                        <div class="profile-tabs">
                            <button class="profile-tab active" id="profilePostsTab" onclick="switchProfileTab('posts')">
                                📝 Public Posts (${userPosts.length})
                            </button>
                            <button class="profile-tab" id="profileCommunitiesTab" onclick="switchProfileTab('communities')">
                                🏘️ Communities (${createdCommunities.length})
                            </button>
                            <button class="profile-tab" id="profileFollowingTab" onclick="switchProfileTab('following')">
                                👥 Following (${followedCount})
                            </button>
                        </div>

                        <div class="profile-tab-content">
                            <!-- Posts Tab Content (default) - Only shows PUBLIC posts -->
                            <div id="profilePostsContent" class="profile-tab-panel active">
                                ${userPosts.length > 0 ? renderPostList(userPosts, 'No public posts yet!') : '<div class="empty-state"><p>You haven\'t created any public posts yet. <a href="#" onclick="openModal(\'composeModal\'); return false;" style="color: var(--accent-fg);">Create your first post!</a></p><p style="margin-top: 12px; color: var(--fg-muted); font-size: 14px;">Note: Only public posts are shown on profiles. Private posts remain private and are only visible to you in the Private feed tab.</p></div>'}
                            </div>

                            <!-- Communities Tab Content -->
                            <div id="profileCommunitiesContent" class="profile-tab-panel">
                                ${createdCommunities.length > 0 ? renderCommunitiesList(createdCommunities) : '<div class="empty-state"><p>You haven\'t created any communities yet. <a href="#" onclick="openModal(\'createCommunityModal\'); return false;" style="color: var(--accent-fg);">Create your first community!</a></p></div>'}
                            </div>

                            <!-- Following Tab Content -->
                            <div id="profileFollowingContent" class="profile-tab-panel">
                                ${followedCount > 0 ? renderFollowingList() : '<div class="empty-state"><p>You\'re not following any communities yet. <a href="#" onclick="switchFeedTab(\'general\'); navigateToFeed(); return false;" style="color: var(--accent-fg);">Browse communities to follow!</a></p></div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            updateFeedContent(profileHtml);
        }

        // Render communities list for profile
        function renderCommunitiesList(communitiesList) {
            return communitiesList.map(community => {
                const memberCount = community.members?.length || 1;
                const postCount = posts.filter(post => post.communityName === community.name && !post.isPrivate).length;
                
                return `
                    <div class="community-card">
                        <div class="community-card-header">
                            <div class="community-card-avatar">
                                ${community.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div class="community-card-info">
                                <h4 class="community-card-name">${escapeHtml(community.displayName)}</h4>
                                <p class="community-card-handle">c/${escapeHtml(community.name)}</p>
                                ${community.description ? `<p class="community-card-description">${escapeHtml(community.description)}</p>` : ''}
                            </div>
                            <div class="community-card-actions">
                                <button class="btn btn-secondary" onclick="navigateToCommunity('${community.name}')">
                                    View
                                </button>
                            </div>
                        </div>
                        <div class="community-card-stats">
                            <span class="community-card-stat">${postCount} posts</span>
                            <span class="community-card-stat">${memberCount} members</span>
                            <span class="community-card-stat">Created ${formatDate(community.createdAt)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render following list for profile
        function renderFollowingList() {
            const followedCommunitiesList = Array.from(followedCommunities).map(name => {
                const community = communities.find(c => c.name === name);
                return community || { name, displayName: name, description: '', members: [], createdAt: new Date().toISOString() };
            });

            return followedCommunitiesList.map(community => {
                const memberCount = community.members?.length || 1;
                const postCount = posts.filter(post => post.communityName === community.name && !post.isPrivate).length;
                
                return `
                    <div class="community-card">
                        <div class="community-card-header">
                            <div class="community-card-avatar">
                                ${community.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div class="community-card-info">
                                <h4 class="community-card-name">${escapeHtml(community.displayName)}</h4>
                                <p class="community-card-handle">c/${escapeHtml(community.name)}</p>
                                ${community.description ? `<p class="community-card-description">${escapeHtml(community.description)}</p>` : ''}
                            </div>
                            <div class="community-card-actions">
                                <button class="btn btn-secondary" onclick="navigateToCommunity('${community.name}')" style="margin-right: 8px;">
                                    View
                                </button>
                                <button class="btn" onclick="toggleCommunityFollow('${community.name}')" id="followBtn-${community.name}">
                                    ✓ Following
                                </button>
                            </div>
                        </div>
                        <div class="community-card-stats">
                            <span class="community-card-stat">${postCount} posts</span>
                            <span class="community-card-stat">${memberCount} members</span>
                            <span class="community-card-stat">Following since ${formatDate(new Date().toISOString())}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Profile tab switching
        let currentProfileTab = 'posts';

        function switchProfileTab(tabName) {
            currentProfileTab = tabName;
            
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
        function openEditProfileModal() {
            const currentPictureUrl = currentUser.profile?.profilePicture || '';
            const currentBio = currentUser.profile?.bio || '';
            
            document.getElementById('editProfilePicture').value = currentPictureUrl;
            document.getElementById('editProfileBio').value = currentBio;
            document.getElementById('editProfileError').innerHTML = '';
            
            openModal('editProfileModal');
        }

        // Handle profile update
        async function handleUpdateProfile(e) {
            e.preventDefault();
            
            if (!currentUser) {
                showError('editProfileError', 'Please sign in to update your profile');
                return;
            }
            
            const newPictureUrl = document.getElementById('editProfilePicture').value.trim();
            const newBio = document.getElementById('editProfileBio').value.trim();
            const submitBtn = document.getElementById('editProfileSubmitBtn');
            const errorDiv = document.getElementById('editProfileError');
            
            errorDiv.innerHTML = '';
            
            // Validation
            if (newBio.length > 500) {
                showError('editProfileError', 'Bio must be 500 characters or less');
                return;
            }

            // Validate URL if provided
            if (newPictureUrl && newPictureUrl.length > 0) {
                try {
                    new URL(newPictureUrl);
                } catch {
                    showError('editProfileError', 'Please provide a valid URL for the profile picture');
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
                await blobAPI.set(`user_${currentUser.username}`, updatedProfile);
                
                // Update current user object
                currentUser.profile = updatedProfile;
                await blobAPI.set('current_user', currentUser);
                
                closeModal('editProfileModal');
                document.getElementById('editProfileForm').reset();
                
                // Re-render profile page to show changes
                renderProfilePage();
                
                showSuccessMessage('Profile updated successfully!');
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showError('editProfileError', 'Failed to update profile. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Profile';
            }
        }

        // Netlify Blobs API implementation (keeping the existing implementation)
        const blobAPI = {
            async get(key) {
                try {
                    const response = await fetch(`/.netlify/functions/blobs?key=${encodeURIComponent(key)}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                        if (response.status === 404) return null;
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const result = await response.json();
                    return result.data;
                } catch (error) {
                    console.error('Error getting blob:', error);
                    return null;
                }
            },
            
            async set(key, value) {
                try {
                    const response = await fetch('/.netlify/functions/blobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, value })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    return await response.json();
                } catch (error) {
                    console.error('Error setting blob:', error);
                    throw error;
                }
            },
            
            async list(prefix = '') {
                try {
                    const response = await fetch(`/.netlify/functions/blobs?list=true&prefix=${encodeURIComponent(prefix)}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const result = await response.json();
                    return result.keys || [];
                } catch (error) {
                    console.error('Error listing blobs:', error);
                    return [];
                }
            },
            
            async delete(key) {
                try {
                    const response = await fetch('/.netlify/functions/blobs', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    return await response.json();
                } catch (error) {
                    console.error('Error deleting blob:', error);
                    throw error;
                }
            }
        };

        // Initialize app
        document.addEventListener('DOMContentLoaded', async () => {
            // Configure marked.js for markdown rendering
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true,
                gfm: true
            });
            
            // Custom renderer for enhanced features
            markdownRenderer = new marked.Renderer();
            
            // Custom link renderer to handle media embeds
            markdownRenderer.link = function(href, title, text) {
                const mediaHtml = renderMediaFromUrl(href);
                if (mediaHtml) return mediaHtml;
                
                return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
            };
            
            // Custom image renderer
            markdownRenderer.image = function(href, title, text) {
                return `<img src="${href}" alt="${text || 'Image'}" ${title ? `title="${title}"` : ''} onclick="openImageModal('${href}')" style="cursor: pointer;">`;
            };

            await loadUser();
            await loadCommunities();
            await loadPosts();
            updateUI();
            setupEventListeners();
            
            // Load admin stats if user is admin
            if (currentUser?.profile?.isAdmin) {
                await loadAdminStats();
            }
        });

        function setupEventListeners() {
            // Auth form
            document.getElementById('authForm').addEventListener('submit', handleAuth);
            
            // Create community form
            document.getElementById('createCommunityForm').addEventListener('submit', handleCreateCommunity);
            
            // Compose form
            document.getElementById('composeForm').addEventListener('submit', handleCreatePost);
            
            // URL input for media preview
            const urlInput = document.getElementById('postUrl');
            if (urlInput) {
                let previewTimeout;
                urlInput.addEventListener('input', (e) => {
                    clearTimeout(previewTimeout);
                    const url = e.target.value.trim();
                    
                    if (url && url.length > 10) {
                        previewTimeout = setTimeout(() => {
                            previewMedia(url);
                        }, 1000); // Debounce for 1 second
                    } else {
                        const preview = document.getElementById('mediaPreview');
                        if (preview) {
                            preview.innerHTML = '';
                        }
                    }
                });
            }
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                const menu = document.getElementById('slideMenu');
                const menuToggle = document.getElementById('menuToggle');
                
                if (menu.classList.contains('open') && 
                    !menu.contains(e.target) && 
                    !menuToggle.contains(e.target)) {
                    toggleMenu();
                }
            });
        }

        async function loadUser() {
            try {
                const userData = await blobAPI.get('current_user');
                if (userData) {
                    currentUser = userData;
                    const fullProfile = await blobAPI.get(`user_${userData.username}`);
                    if (fullProfile) {
                        currentUser.profile = fullProfile;
                    }
                    
                    // Load user's followed communities after loading user
                    await loadFollowedCommunities();
                }
            } catch (error) {
                console.error('Error loading user:', error);
            }
        }

        async function loadCommunities() {
            try {
                const communityKeys = await blobAPI.list('community_');
                const communityPromises = communityKeys.map(async (key) => {
                    try {
                        return await blobAPI.get(key);
                    } catch (error) {
                        console.error(`Error loading community ${key}:`, error);
                        return null;
                    }
                });
                
                const loadedCommunities = await Promise.all(communityPromises);
                communities = loadedCommunities
                    .filter(Boolean)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                // Update community dropdown in compose modal
                updateCommunityDropdown();
                
            } catch (error) {
                console.error('Error loading communities:', error);
                communities = [];
            }
        }

        async function loadPosts() {
            try {
                if (!isLoading) {
                    isLoading = true;
                    updateFeedContent('<div class="loading">Loading...</div>');
                }
                
                const postKeys = await blobAPI.list('post_');
                const postPromises = postKeys.map(async (key) => {
                    try {
                        return await blobAPI.get(key);
                    } catch (error) {
                        console.error(`Error loading post ${key}:`, error);
                        return null;
                    }
                });
                
                const loadedPosts = await Promise.all(postPromises);
                posts = loadedPosts
                    .filter(Boolean)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    
            } catch (error) {
                console.error('Error loading posts:', error);
                posts = [];
            } finally {
                isLoading = false;
            }
        }

        function updateUI() {
            updateComposeButton();
            updateFeedTabsVisibility();
            renderCurrentPage();
        }

        function updateComposeButton() {
            const composeBtn = document.getElementById('composeBtn');
            composeBtn.style.display = currentUser ? 'block' : 'none';
        }

        function updateCommunityDropdown() {
            const select = document.getElementById('postCommunity');
            select.innerHTML = '<option value="">General Feed</option>';
            
            communities.forEach(community => {
                const option = document.createElement('option');
                option.value = community.name;
                option.textContent = community.displayName;
                select.appendChild(option);
            });
        }

        function renderCurrentPage() {
            if (currentPage === 'feed') {
                renderFeedWithTabs();
            } else if (currentPage === 'community') {
                renderCommunityPage();
            } else if (currentPage === 'profile') {
                renderProfilePage();
            } else if (currentPage === 'admin') {
                renderAdminPage();
            }
        }

        function navigateToSettings() {
            toggleMenu();
            // TODO: Implement settings page
            showSuccessMessage('Settings page coming soon!');
        }

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
                                        ${community.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="admin-community-details">
                                        <h4>${escapeHtml(community.displayName)}</h4>
                                        <p class="admin-community-handle">c/${escapeHtml(community.name)}</p>
                                        <p class="admin-community-description">${escapeHtml(community.description || 'No description')}</p>
                                        <div class="admin-community-meta">
                                            <span>👤 Created by @${escapeHtml(community.createdBy)}</span>
                                            <span>📅 ${formatDate(community.createdAt)}</span>
                                            <span>👥 ${community.members?.length || 1} members</span>
                                            <span>📝 ${communityPosts.length} posts</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="admin-community-actions">
                                    <button class="btn btn-secondary" onclick="navigateToCommunity('${community.name}')">
                                        👁️ View
                                    </button>
                                    <button class="btn btn-danger" onclick="deleteCommunity('${community.name}')">
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
        function renderPostsPanel(allPosts) {
            return `
                <div class="admin-section-header">
                    <h3>Posts Management</h3>
                    <p>View and manage all posts</p>
                    <div class="admin-filters">
                        <button class="btn btn-small" onclick="filterAdminPosts('all')">All Posts</button>
                        <button class="btn btn-small btn-secondary" onclick="filterAdminPosts('public')">Public Only</button>
                        <button class="btn btn-small btn-secondary" onclick="filterAdminPosts('private')">Private Only</button>
                    </div>
                </div>
                <div class="admin-posts-list" id="adminPostsList">
                    ${renderPostList(allPosts.slice(0, 20), 'No posts found')}
                    ${allPosts.length > 20 ? `<div class="admin-load-more"><button class="btn btn-secondary" onclick="loadMoreAdminPosts()">Load More Posts</button></div>` : ''}
                </div>
            `;
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

        async function deleteUser(username) {
            if (!confirm(`Delete user @${username}? This will also delete all their posts and remove them from communities. This action cannot be undone.`)) return;
            
            try {
                // Delete user
                await blobAPI.delete(`user_${username}`);
                
                // Delete user's posts
                const userPosts = posts.filter(p => p.author === username);
                for (const post of userPosts) {
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

                showSuccessMessage(`User @${username} deleted successfully.`);
                
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
            if (!confirm(`Delete community c/${communityName}? This will also delete all posts in this community. This action cannot be undone.`)) return;
            
            try {
                // Delete community
                await blobAPI.delete(`community_${communityName}`);
                
                // Delete community posts
                const communityPosts = posts.filter(p => p.communityName === communityName);
                for (const post of communityPosts) {
                    await blobAPI.delete(post.id);
                }

                showSuccessMessage(`Community c/${communityName} deleted successfully.`);
                
                // Refresh data and admin page
                await loadPosts();
                await loadCommunities();
                renderAdminPage();
                
            } catch (error) {
                console.error('Error deleting community:', error);
                showSuccessMessage('Failed to delete community. Please try again.');
            }
        }

        // Post filtering for admin
        function filterAdminPosts(filter) {
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
                postsList.innerHTML = renderPostList(filteredPosts.slice(0, 20), 'No posts found') +
                    (filteredPosts.length > 20 ? `<div class="admin-load-more"><button class="btn btn-secondary" onclick="loadMoreAdminPosts()">Load More Posts</button></div>` : '');
            }
            
            // Update filter button states
            document.querySelectorAll('.admin-filters .btn').forEach(btn => {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-secondary');
            });
            event.target.classList.remove('btn-secondary');
        }

        function renderFeedWithTabs() {
            if (!currentUser) {
                // If user is not logged in, show login required message
                const loginRequiredHtml = `
                    <div class="login-required">
                        <div class="login-required-icon">🔒</div>
                        <h2>Log in to view feed</h2>
                        <p>You need to be signed in to view posts and interact with the community.</p>
                        <div class="login-required-buttons">
                            <button class="login-required-btn" onclick="openAuthModal('signin')">
                                <span>🚪</span>
                                <span>Sign In</span>
                            </button>
                            <button class="login-required-btn secondary" onclick="openAuthModal('signup')">
                                <span>✨</span>
                                <span>Sign Up</span>
                            </button>
                        </div>
                    </div>
                `;
                updateFeedContent(loginRequiredHtml);
                return;
            }

            // User is logged in, render based on current tab
            switch (currentFeedTab) {
                case 'general':
                    renderGeneralFeed();
                    break;
                case 'followed':
                    renderFollowedFeed();
                    break;
                case 'private':
                    renderPrivateFeed();
                    break;
                default:
                    renderGeneralFeed();
            }
        }

        function renderGeneralFeed() {
            const publicPosts = posts.filter(post => !post.isPrivate);
            updateFeedContent(renderPostList(publicPosts, 'No public posts yet!'));
        }

        // Get posts from followed communities
        function getFollowedCommunityPosts() {
            if (!currentUser || followedCommunities.size === 0) {
                return [];
            }

            // Filter posts that are from followed communities and not private
            const followedPosts = posts.filter(post => 
                post.communityName && 
                followedCommunities.has(post.communityName) && 
                !post.isPrivate
            );

            console.log(`Found ${followedPosts.length} posts from ${followedCommunities.size} followed communities`);
            console.log('Followed communities:', Array.from(followedCommunities));
            
            return followedPosts;
        }

        async function renderFollowedFeed() {
            if (!currentUser) {
                const placeholderHtml = `
                    <div class="feature-placeholder">
                        <h3>🏘️ Followed Communities</h3>
                        <p>Sign in to follow communities and see their posts in your personalized feed!</p>
                        <button class="btn" onclick="openAuthModal('signin')" style="margin-top: 16px;">Sign In</button>
                    </div>
                `;
                updateFeedContent(placeholderHtml);
                return;
            }

            // Show loading while we get the latest follow status
            updateFeedContent('<div class="loading">Loading your followed communities feed...</div>');
            
            // Ensure we have the latest followed communities data
            await loadFollowedCommunities();
            
            if (followedCommunities.size === 0) {
                // User isn't following any communities yet
                const emptyFollowedHtml = `
                    <div class="feature-placeholder">
                        <h3>🏘️ No Followed Communities Yet</h3>
                        <p>You're not following any communities yet! Discover and follow communities to see their posts here.</p>
                        <div style="margin-top: 20px;">
                            <p style="color: var(--fg-muted); font-size: 14px; margin-bottom: 16px;">
                                Browse communities in the sidebar to get started
                            </p>
                            <button class="btn" onclick="switchFeedTab('general')" style="margin-right: 12px;">
                                Browse General Feed
                            </button>
                            <button class="btn btn-secondary" onclick="toggleCommunitiesDropdown(); toggleMenu();">
                                Browse Communities
                            </button>
                        </div>
                    </div>
                `;
                updateFeedContent(emptyFollowedHtml);
                return;
            }

            // Get posts from followed communities
            const followedPosts = getFollowedCommunityPosts();
            
            if (followedPosts.length === 0) {
                // User is following communities but they don't have any posts
                const noPostsHtml = `
                    <div class="feature-placeholder">
                        <h3>🏘️ No Posts Yet</h3>
                        <p>You're following ${followedCommunities.size} ${followedCommunities.size === 1 ? 'community' : 'communities'}, but there are no recent posts.</p>
                        <div style="margin-top: 16px; color: var(--fg-muted); font-size: 14px;">
                            <p><strong>Following:</strong> ${Array.from(followedCommunities).map(name => `c/${name}`).join(', ')}</p>
                        </div>
                        <div style="margin-top: 20px;">
                            <button class="btn" onclick="switchFeedTab('general')" style="margin-right: 12px;">
                                Browse General Feed
                            </button>
                            <button class="btn btn-secondary" onclick="toggleCommunitiesDropdown(); toggleMenu();">
                                Find More Communities
                            </button>
                        </div>
                    </div>
                `;
                updateFeedContent(noPostsHtml);
                return;
            }

            // Create a header showing followed communities info
            const followedCommunitiesInfo = `
                <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">🏘️</span>
                        <h3 style="color: var(--fg-default); margin: 0;">Following ${followedCommunities.size} ${followedCommunities.size === 1 ? 'Community' : 'Communities'}</h3>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${Array.from(followedCommunities).map(name => {
                            const community = communities.find(c => c.name === name);
                            return `<a href="#" 
                                      class="post-community-link" 
                                      onclick="navigateToCommunity('${name}'); return false;"
                                      style="font-size: 12px;">
                                c/${community ? escapeHtml(community.displayName) : escapeHtml(name)}
                            </a>`;
                        }).join('')}
                    </div>
                    <p style="color: var(--fg-muted); font-size: 12px; margin: 12px 0 0 0;">
                        Showing ${followedPosts.length} ${followedPosts.length === 1 ? 'post' : 'posts'} from your followed communities
                    </p>
                </div>
            `;

            // Render the followed posts with the info header
            const postsHtml = renderPostList(followedPosts, 'No posts from your followed communities yet!');
            updateFeedContent(followedCommunitiesInfo + postsHtml);
        }

        function renderPrivateFeed() {
            if (!currentUser) {
                updateFeedContent('<div class="empty-state"><p>Please sign in to view private posts.</p></div>');
                return;
            }
            
            const privatePosts = posts.filter(post => post.isPrivate && post.author === currentUser.username);
            updateFeedContent(renderPostList(privatePosts, 'You haven\'t created any private posts yet!'));
        }

        function renderFeed() {
            // Legacy function - now redirects to renderFeedWithTabs
            renderFeedWithTabs();
        }

        // FIXED: renderCommunityPage function with proper follow status checking
        async function renderCommunityPage() {
            console.log('renderCommunityPage called, currentCommunity:', currentCommunity);
            
            if (!currentCommunity) {
                console.log('No currentCommunity set');
                return;
            }
            
            const community = communities.find(c => c.name === currentCommunity);
            if (!community) {
                console.log('Community not found in communities array:', currentCommunity);
                updateFeedContent('<div class="empty-state"><p>Community not found.</p></div>');
                return;
            }

            console.log('Found community:', community);

            // Check if user is following this community (if logged in)
            let isFollowing = false;
            
            if (currentUser) {
                try {
                    console.log('Checking follow status for authenticated user');
                    isFollowing = await checkIfFollowing(currentCommunity);
                    console.log('Follow status check result:', isFollowing);
                } catch (error) {
                    console.error('Error checking follow status:', error);
                }
            } else {
                console.log('User not authenticated, skipping follow status check');
            }

            const communityPosts = posts.filter(post => post.communityName === community.name && !post.isPrivate);
            
            // Create follow button HTML
            let followButtonHtml = '';
            
            if (!currentUser) {
                // User not logged in - show sign in button
                followButtonHtml = `
                    <button class="btn" 
                            onclick="openAuthModal('signin')" 
                            style="padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                        + Follow (Sign In)
                    </button>`;
            } else {
                // User is logged in - show actual follow/unfollow button
                const buttonText = isFollowing ? '✓ Following' : '+ Follow';
                const buttonClass = isFollowing ? 'btn btn-secondary' : 'btn';
                
                followButtonHtml = `
                    <button class="${buttonClass}" 
                            onclick="toggleCommunityFollow('${community.name}')" 
                            id="followBtn-${community.name}"
                            style="padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                        ${buttonText}
                    </button>`;
            }
            
            console.log('Generated follow button HTML:', followButtonHtml);
            
            // Ensure member count is accurate
            const memberCount = community.members?.length || 1;
            
            const communityHeader = `
                <div class="community-header">
                    <div class="community-hero">
                        <div class="community-avatar">
                            ${community.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="community-info">
                            <h1 class="community-title">${escapeHtml(community.displayName)}</h1>
                            <p class="community-handle">c/${escapeHtml(community.name)}</p>
                            ${community.description ? `<p class="community-description">${escapeHtml(community.description)}</p>` : ''}
                        </div>
                        <div class="community-actions">
                            ${followButtonHtml}
                        </div>
                    </div>
                    <div class="community-stats">
                        <div class="stat-item">
                            <span class="stat-number">${communityPosts.length}</span>
                            <span class="stat-label">posts</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-number">${memberCount}</span>
                            <span class="stat-label">members</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-label">Created by</span>
                            <span class="stat-creator">@${escapeHtml(community.createdBy)}</span>
                        </div>
                        <div class="stat-divider"></div>
                        <div class="stat-item">
                            <span class="stat-label">${formatDate(community.createdAt)}</span>
                        </div>
                    </div>
                </div>
            `;
            
            const finalHtml = communityHeader + renderPostList(communityPosts, 'No posts in this community yet!');
            console.log('Updating feed content with community page');
            updateFeedContent(finalHtml);
        }

        // FIXED: Improved toggleCommunityFollow function with real follow/unfollow logic
        async function toggleCommunityFollow(communityName) {
            console.log('toggleCommunityFollow called for:', communityName);
            console.log('Current user:', currentUser);
            
            if (!currentUser) {
                console.log('Not authenticated, opening auth modal');
                openAuthModal('signin');
                return;
            }

            const followBtn = document.getElementById(`followBtn-${communityName}`);
            console.log('Follow button found:', followBtn);
            
            if (!followBtn) {
                console.error('Follow button not found for community:', communityName);
                return;
            }
            
            const originalText = followBtn.textContent;
            const wasFollowing = followBtn.classList.contains('btn-secondary');
            
            try {
                followBtn.disabled = true;
                followBtn.textContent = 'Loading...';
                
                console.log('Toggling follow status for community:', communityName);
                console.log('Was following:', wasFollowing, 'Will follow:', !wasFollowing);
                
                // Use real follow/unfollow logic
                const response = await toggleFollowStatus(communityName, !wasFollowing);
                
                if (response.success) {
                    // Update button appearance
                    if (response.following) {
                        followBtn.textContent = '✓ Following';
                        followBtn.className = 'btn btn-secondary';
                        followBtn.style.cssText = 'padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
                        showSuccessMessage(`Now following c/${communityName}! 🎉`);
                    } else {
                        followBtn.textContent = '+ Follow';
                        followBtn.className = 'btn';
                        followBtn.style.cssText = 'padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
                        showSuccessMessage(`Unfollowed c/${communityName}`);
                    }
                    
                    console.log(`Follow toggle successful. New member count: ${response.memberCount}`);
                } else {
                    throw new Error(response.error || 'Unknown error');
                }
                
            } catch (error) {
                console.error('Error toggling follow status:', error);
                followBtn.textContent = originalText;
                
                // Restore original button class
                if (wasFollowing) {
                    followBtn.className = 'btn btn-secondary';
                } else {
                    followBtn.className = 'btn';
                }
                followBtn.style.cssText = 'padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
                
                showSuccessMessage(error.message || 'Failed to update follow status. Please try again.');
            } finally {
                followBtn.disabled = false;
            }
        }

        // User's followed communities storage
        let followedCommunities = new Set();

        // Load user's followed communities from storage
        async function loadFollowedCommunities() {
            if (!currentUser) {
                followedCommunities = new Set();
                return;
            }

            try {
                const userFollows = await blobAPI.get(`user_follows_${currentUser.username}`);
                followedCommunities = new Set(userFollows?.communities || []);
                console.log('Loaded followed communities:', Array.from(followedCommunities));
            } catch (error) {
                console.error('Error loading followed communities:', error);
                followedCommunities = new Set();
            }
        }

        // Save user's followed communities to storage
        async function saveFollowedCommunities() {
            if (!currentUser) return;

            try {
                const followData = {
                    username: currentUser.username,
                    communities: Array.from(followedCommunities),
                    lastUpdated: new Date().toISOString()
                };
                await blobAPI.set(`user_follows_${currentUser.username}`, followData);
                console.log('Saved followed communities:', followData);
            } catch (error) {
                console.error('Error saving followed communities:', error);
            }
        }

        // Check if user is following a specific community
        async function checkIfFollowing(communityName) {
            if (!currentUser) return false;
            
            // Load followed communities if not already loaded
            if (followedCommunities.size === 0) {
                await loadFollowedCommunities();
            }
            
            const isFollowing = followedCommunities.has(communityName);
            console.log(`User ${currentUser.username} is ${isFollowing ? '' : 'not '}following ${communityName}`);
            return isFollowing;
        }

        // Update toggleFollowStatus to refresh followed feed if currently viewing it
        async function toggleFollowStatus(communityName, shouldFollow) {
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            try {
                // Update user's followed communities
                if (shouldFollow) {
                    followedCommunities.add(communityName);
                } else {
                    followedCommunities.delete(communityName);
                }

                // Save user's followed communities
                await saveFollowedCommunities();

                // Update community member count
                const community = communities.find(c => c.name === communityName);
                if (community) {
                    // Initialize members array if it doesn't exist
                    if (!community.members) {
                        community.members = [community.createdBy]; // Creator is always a member
                    }

                    if (shouldFollow) {
                        // Add user to community members if not already there
                        if (!community.members.includes(currentUser.username)) {
                            community.members.push(currentUser.username);
                        }
                    } else {
                        // Remove user from community members (but keep creator)
                        if (currentUser.username !== community.createdBy) {
                            community.members = community.members.filter(member => member !== currentUser.username);
                        }
                    }

                    // Save updated community to storage
                    await blobAPI.set(`community_${communityName}`, community);
                    console.log(`Updated community ${communityName} members:`, community.members);

                    // Update local communities array
                    const localCommunityIndex = communities.findIndex(c => c.name === communityName);
                    if (localCommunityIndex !== -1) {
                        communities[localCommunityIndex] = community;
                    }

                    // Update member count display on page
                    updateCommunityMemberCount(communityName, community.members.length);
                }

                // If we're currently viewing the followed feed, refresh it
                if (currentPage === 'feed' && currentFeedTab === 'followed') {
                    console.log('Refreshing followed feed after follow status change');
                    setTimeout(() => {
                        renderFollowedFeed();
                    }, 100); // Small delay to allow UI to update first
                }

                return {
                    success: true,
                    following: shouldFollow,
                    memberCount: community?.members?.length || 1
                };

            } catch (error) {
                console.error('Error toggling follow status:', error);
                throw error;
            }
        }

        // Update the member count display on the community page
        function updateCommunityMemberCount(communityName, newCount) {
            // Find the member count element and update it
            const memberCountElements = document.querySelectorAll('.stat-number');
            memberCountElements.forEach((element, index) => {
                const statLabel = element.parentNode.querySelector('.stat-label');
                if (statLabel && statLabel.textContent === 'members') {
                    element.textContent = newCount;
                    console.log(`Updated member count display to ${newCount}`);
                }
            });
        }

        function renderPostList(postList, emptyMessage) {
            if (postList.length === 0) {
                return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
            }

            return postList.map(post => {
                const community = communities.find(c => c.name === post.communityName);
                
                // Get author's profile picture
                const authorProfilePic = getAuthorProfilePicture(post.author);
                
                return `
                    <div class="post-card ${post.isPrivate ? 'private' : ''}">
                        <div class="post-header">
                            <div class="post-author">
                                <div class="post-avatar">
                                    ${authorProfilePic ? 
                                        `<img src="${authorProfilePic}" 
                                             alt="${post.author}" 
                                             class="post-avatar-img"
                                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                         <div class="post-avatar-fallback" style="display: none;">${post.author.charAt(0).toUpperCase()}</div>` 
                                        : `<div class="post-avatar-text">${post.author.charAt(0).toUpperCase()}</div>`
                                    }
                                </div>
                                <div class="post-meta">
                                    <a href="#" class="post-username">@${escapeHtml(post.author)}</a>
                                    <div class="post-timestamp">${formatTimestamp(post.timestamp)}</div>
                                </div>
                            </div>
                            <div class="post-badges">
                                ${post.isPrivate ? '<span class="post-badge private">Private</span>' : ''}
                                ${post.type === 'link' ? '<span class="post-badge link">Link</span>' : ''}
                            </div>
                        </div>
                        
                        <div class="post-body">
                            ${post.communityName && community && currentPage !== 'community' ? `
                                <div class="post-community">
                                    <a href="#" class="post-community-link" onclick="navigateToCommunity('${post.communityName}'); return false;">
                                        c/${escapeHtml(community.displayName)}
                                    </a>
                                </div>
                            ` : ''}
                            <h3 class="post-title">${escapeHtml(post.title)}</h3>
                            ${renderPostContent(post)}
                        </div>
                        
                        <div class="post-actions">
                            <button class="action-btn">
                                <span>⬆️</span>
                                <span>Vote</span>
                            </button>
                            <button class="action-btn" onclick="toggleReplies('${post.id}')">
                                <span>💬</span>
                                <span>${post.replies ? post.replies.length : 0}</span>
                            </button>
                            ${currentUser && (currentUser.username === post.author || currentUser.profile?.isAdmin) ? `
                                <button class="action-btn" onclick="deletePost('${post.id}')">
                                    <span>🗑️</span>
                                    <span>Delete</span>
                                </button>
                            ` : ''}
                        </div>
                        
                        <!-- Replies Section -->
                        <div class="replies-section" id="replies-${post.id}">
                            <div class="replies-container">
                                <div class="replies-list" id="replies-list-${post.id}">
                                    ${renderReplies(post.replies || [])}
                                </div>
                                
                                ${currentUser ? `
                                    <div class="reply-form">
                                        <textarea 
                                            class="reply-input" 
                                            id="reply-input-${post.id}"
                                            placeholder="Write a reply... (Markdown supported)"
                                            maxlength="2000"></textarea>
                                        <div class="reply-form-buttons">
                                            <button class="reply-btn-cancel" onclick="toggleReplies('${post.id}')">Cancel</button>
                                            <button class="reply-btn-submit" onclick="submitReply('${post.id}')">Reply</button>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="text-align: center; padding: 16px; color: var(--fg-muted); font-size: 13px;">
                                        <a href="#" onclick="openAuthModal('signin'); return false;" style="color: var(--accent-fg);">Sign in</a> to reply
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Get author's profile picture from stored user data
        function getAuthorProfilePicture(username) {
            try {
                // Check if we have this user's data loaded
                if (currentUser && currentUser.username === username && currentUser.profile?.profilePicture) {
                    return currentUser.profile.profilePicture;
                }
                
                // For other users, we'd need to load their profile data
                // For now, return null to use default avatar
                // In a real app, you might cache user profiles or load them dynamically
                return null;
            } catch (error) {
                console.error('Error getting author profile picture:', error);
                return null;
            }
        }

        function renderPostContent(post) {
            let contentHtml = '';

            if (post.type === 'link' && post.url) {
                const mediaHtml = renderMediaFromUrl(post.url);
                if (mediaHtml) {
                    contentHtml += `<div style="margin: 12px 0; border-radius: 8px; overflow: hidden;">${mediaHtml}</div>`;
                } else {
                    contentHtml += `
                        <a href="${post.url}" target="_blank" rel="noopener noreferrer" style="display: block; color: var(--accent-fg); text-decoration: none; padding: 12px; background-color: rgba(88, 166, 255, 0.1); border: 1px solid rgba(88, 166, 255, 0.2); border-radius: 8px; margin: 12px 0;">
                            <div style="font-weight: 600; margin-bottom: 4px;">🔗 ${post.url}</div>
                            <div style="font-size: 12px; color: var(--fg-muted); word-break: break-all;">${post.url}</div>
                        </a>
                    `;
                }
                
                if (post.description) {
                    contentHtml += `<div class="markdown-content">${renderMarkdown(post.description)}</div>`;
                }
            } else if (post.content) {
                contentHtml += `<div class="markdown-content">${renderMarkdown(post.content)}</div>`;
            }

            return contentHtml;
        }

        function renderMediaFromUrl(url) {
            if (!url) return null;

            // YouTube video
            const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                return `
                    <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; overflow: hidden; border-radius: 8px; background: var(--bg-canvas);">
                        <iframe src="https://www.youtube.com/embed/${videoId}" 
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
                                allowfullscreen></iframe>
                    </div>
                `;
            }

            // Dailymotion video
            const dailymotionMatch = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
            if (dailymotionMatch) {
                const videoId = dailymotionMatch[1];
                return `
                    <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; overflow: hidden; border-radius: 8px; background: var(--bg-canvas);">
                        <iframe src="https://www.dailymotion.com/embed/video/${videoId}?autoplay=0" 
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
                                allowfullscreen></iframe>
                    </div>
                `;
            }

            // Suno AI music - Enhanced with playable embed attempt
            const sunoMatch = url.match(/suno\.com\/song\/([a-zA-Z0-9-]+)/);
            if (sunoMatch) {
                const songId = sunoMatch[1];
                return `
                    <div style="background: linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1); padding: 20px; border-radius: 12px; margin: 12px 0;">
                        <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 8px; padding: 16px;">
                            <div style="text-align: center; margin-bottom: 16px;">
                                <div style="font-size: 18px; font-weight: 600; color: white; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    🎵 Suno AI Music
                                </div>
                                <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 12px;">
                                    AI-Generated Song
                                </div>
                            </div>
                            
                            <!-- Try to embed Suno player (may not work due to CORS/embedding restrictions) -->
                            <div style="margin-bottom: 16px; text-align: center;">
                                <iframe src="${url}" 
                                        width="100%" 
                                        height="200" 
                                        frameborder="0" 
                                        style="border-radius: 8px; background: rgba(255,255,255,0.1);"
                                        onload="this.style.display='block'" 
                                        onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                                </iframe>
                                
                                <!-- Fallback if iframe doesn't work -->
                                <div style="display: none; padding: 20px; background: rgba(255,255,255,0.1); border-radius: 8px; text-align: center;">
                                    <div style="font-size: 16px; color: white; margin-bottom: 12px;">
                                        🎧 This Suno song cannot be embedded directly
                                    </div>
                                    <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 16px;">
                                        Click below to listen on Suno's website
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Always show the link button -->
                            <div style="text-align: center;">
                                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                                   style="display: inline-block; background: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; transition: all 0.2s ease; font-size: 16px;"
                                   onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                                    🎧 Listen on Suno
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Direct image links
            if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
                return `
                    <div style="text-align: center; margin: 12px 0;">
                        <img src="${url}" 
                             style="max-width: 100%; height: auto; cursor: pointer; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s ease;" 
                             onclick="openImageModal('${url}')" 
                             onmouseover="this.style.transform='scale(1.02)'"
                             onmouseout="this.style.transform='scale(1)'"
                             alt="Image" 
                             loading="lazy">
                    </div>
                `;
            }

            // Direct video links
            if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
                return `
                    <div style="margin: 12px 0;">
                        <video src="${url}" 
                               style="width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" 
                               controls 
                               preload="metadata">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                `;
            }

            // Direct audio links
            if (url.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i)) {
                return `
                    <div style="background: var(--bg-subtle); border-radius: 8px; padding: 16px; margin: 12px 0;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <span style="font-size: 20px;">🎵</span>
                            <span style="font-weight: 600; color: var(--fg-default);">Audio File</span>
                        </div>
                        <audio src="${url}" 
                               style="width: 100%;" 
                               controls 
                               preload="metadata">
                            Your browser does not support the audio tag.
                        </audio>
                    </div>
                `;
            }

            // General website preview
            if (url.match(/^https?:\/\/.+/i)) {
                const domain = new URL(url).hostname;
                const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                
                return `
                    <div style="border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; margin: 12px 0; transition: all 0.2s ease; background: var(--bg-default);"
                         onmouseover="this.style.borderColor='var(--accent-emphasis)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'"
                         onmouseout="this.style.borderColor='var(--border-default)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" 
                           style="display: block; text-decoration: none; color: inherit; padding: 16px;">
                            <div style="display: flex; align-items: flex-start; gap: 12px;">
                                <img src="${favicon}" 
                                     style="width: 24px; height: 24px; border-radius: 4px; flex-shrink: 0;" 
                                     onerror="this.style.display='none'"
                                     alt="Favicon">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: var(--accent-fg); margin-bottom: 4px; font-size: 16px;">
                                        🌐 ${domain}
                                    </div>
                                    <div style="color: var(--fg-muted); font-size: 14px; word-break: break-all; line-height: 1.4;">
                                        ${url}
                                    </div>
                                    <div style="color: var(--fg-subtle); font-size: 12px; margin-top: 8px;">
                                        Click to visit website ↗️
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                `;
            }

            return null;
        }

        function renderReplies(replies) {
            if (!replies || replies.length === 0) {
                return '<div class="no-replies">No replies yet. Be the first to reply!</div>';
            }

            return replies.map(reply => {
                // Get reply author's profile picture
                const replyAuthorProfilePic = getAuthorProfilePicture(reply.author);
                
                return `
                    <div class="reply-item" id="reply-${reply.id}">
                        <div class="reply-header">
                            <div class="reply-meta">
                                <div class="reply-avatar">
                                    ${replyAuthorProfilePic ? 
                                        `<img src="${replyAuthorProfilePic}" 
                                             alt="${reply.author}" 
                                             class="reply-avatar-img"
                                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                         <div class="reply-avatar-fallback" style="display: none;">${reply.author.charAt(0).toUpperCase()}</div>` 
                                        : `<div class="reply-avatar-text">${reply.author.charAt(0).toUpperCase()}</div>`
                                    }
                                </div>
                                <span class="reply-author">@${escapeHtml(reply.author)}</span>
                                <span class="reply-timestamp">${formatTimestamp(reply.timestamp)}</span>
                            </div>
                            ${currentUser && (currentUser.username === reply.author || currentUser.profile?.isAdmin) ? `
                                <div class="reply-actions">
                                    <button class="reply-delete-btn" onclick="deleteReply('${reply.postId || 'unknown'}', '${reply.id}')" title="Delete reply">
                                        🗑️
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        <div class="reply-content markdown-content">
                            ${renderMarkdown(reply.content)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function toggleReplies(postId) {
            const repliesSection = document.getElementById(`replies-${postId}`);
            const isOpen = repliesSection.classList.contains('open');
            
            if (isOpen) {
                repliesSection.classList.remove('open');
            } else {
                repliesSection.classList.add('open');
                // Focus on reply input if user is logged in
                if (currentUser) {
                    setTimeout(() => {
                        const replyInput = document.getElementById(`reply-input-${postId}`);
                        if (replyInput) {
                            replyInput.focus();
                        }
                    }, 300); // Wait for animation to complete
                }
            }
        }

        async function submitReply(postId) {
            if (!currentUser) {
                openAuthModal('signin');
                return;
            }

            const replyInput = document.getElementById(`reply-input-${postId}`);
            const content = replyInput.value.trim();
            
            if (!content) {
                showSuccessMessage('Please write a reply before submitting.');
                return;
            }

            if (content.length > 2000) {
                showSuccessMessage('Reply must be 2000 characters or less.');
                return;
            }

            try {
                // Find the post
                const post = posts.find(p => p.id === postId);
                if (!post) {
                    showSuccessMessage('Post not found.');
                    return;
                }

                // Create reply object
                const reply = {
                    id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    author: currentUser.username,
                    content: content,
                    timestamp: new Date().toISOString(),
                    postId: postId // Add postId reference for deletion
                };

                // Add reply to post
                if (!post.replies) {
                    post.replies = [];
                }
                post.replies.push(reply);

                // Update post in storage
                await blobAPI.set(postId, post);

                // Update local posts array
                const postIndex = posts.findIndex(p => p.id === postId);
                if (postIndex !== -1) {
                    posts[postIndex] = post;
                }

                // Clear input
                replyInput.value = '';

                // Update replies display
                const repliesList = document.getElementById(`replies-list-${postId}`);
                if (repliesList) {
                    repliesList.innerHTML = renderReplies(post.replies);
                }

                // Update reply count in button
                updateReplyCount(postId, post.replies.length);

                showSuccessMessage('Reply added successfully!');

            } catch (error) {
                console.error('Error submitting reply:', error);
                showSuccessMessage('Failed to submit reply. Please try again.');
            }
        }

        function updateReplyCount(postId, count) {
            // Find the reply button for this post and update its count
            const postCard = document.querySelector(`[onclick="toggleReplies('${postId}')"]`);
            if (postCard) {
                const countSpan = postCard.querySelector('span:last-child');
                if (countSpan) {
                    countSpan.textContent = count;
                }
            }
        }

        async function deleteReply(postId, replyId) {
            if (!currentUser) {
                showSuccessMessage('Please sign in to delete replies.');
                return;
            }

            if (!confirm('Are you sure you want to delete this reply?')) {
                return;
            }

            try {
                // Find the post
                const post = posts.find(p => p.id === postId);
                if (!post) {
                    showSuccessMessage('Post not found.');
                    return;
                }

                // Find the reply
                const replyIndex = post.replies.findIndex(r => r.id === replyId);
                if (replyIndex === -1) {
                    showSuccessMessage('Reply not found.');
                    return;
                }

                const reply = post.replies[replyIndex];

                // Check if user can delete this reply
                if (reply.author !== currentUser.username && !currentUser.profile?.isAdmin) {
                    showSuccessMessage('You can only delete your own replies.');
                    return;
                }

                // Remove reply from post
                post.replies.splice(replyIndex, 1);

                // Update post in storage
                await blobAPI.set(postId, post);

                // Update local posts array
                const postIndex = posts.findIndex(p => p.id === postId);
                if (postIndex !== -1) {
                    posts[postIndex] = post;
                }

                // Remove reply from DOM
                const replyElement = document.getElementById(`reply-${replyId}`);
                if (replyElement) {
                    replyElement.remove();
                }

                // Update replies display if no replies left
                if (post.replies.length === 0) {
                    const repliesList = document.getElementById(`replies-list-${postId}`);
                    if (repliesList) {
                        repliesList.innerHTML = renderReplies(post.replies);
                    }
                }

                // Update reply count in button
                updateReplyCount(postId, post.replies.length);

                showSuccessMessage('Reply deleted successfully!');

            } catch (error) {
                console.error('Error deleting reply:', error);
                showSuccessMessage('Failed to delete reply. Please try again.');
            }
        }

        function renderMarkdown(text) {
            if (!text) return '';
            
            try {
                const html = marked.parse(text, { renderer: markdownRenderer });
                
                // Use DOMPurify if available, otherwise return the HTML as-is
                if (typeof DOMPurify !== 'undefined') {
                    return DOMPurify.sanitize(html);
                } else {
                    console.warn('DOMPurify not available, returning unsanitized HTML');
                    return html;
                }
            } catch (error) {
                console.error('Markdown rendering error:', error);
                return escapeHtml(text);
            }
        }

        function updateFeedContent(html) {
            document.getElementById('feed').innerHTML = html;
        }

        // Modal functions
        function openModal(modalId) {
            document.getElementById(modalId).style.display = 'block';
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        function openAuthModal(mode) {
            const modal = document.getElementById('authModal');
            const title = document.getElementById('authTitle');
            const toggleText = document.getElementById('authToggleText');
            const toggleBtn = document.getElementById('authToggleBtn');
            const submitBtn = document.getElementById('authSubmitBtn');
            const form = document.getElementById('authForm');
            
            document.getElementById('authError').innerHTML = '';
            
            if (mode === 'signup') {
                title.textContent = 'Sign Up';
                toggleText.textContent = 'Already have an account?';
                toggleBtn.textContent = 'Sign In';
                submitBtn.textContent = 'Sign Up';
                form.dataset.mode = 'signup';
            } else {
                title.textContent = 'Sign In';
                toggleText.textContent = "Don't have an account?";
                toggleBtn.textContent = 'Sign Up';
                submitBtn.textContent = 'Sign In';
                form.dataset.mode = 'signin';
            }
            
            modal.style.display = 'block';
        }

        function toggleAuthMode() {
            const form = document.getElementById('authForm');
            const currentMode = form.dataset.mode;
            openAuthModal(currentMode === 'signup' ? 'signin' : 'signup');
        }

        // Auth functions
        async function handleAuth(e) {
            e.preventDefault();
            const form = e.target;
            const mode = form.dataset.mode;
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const bio = document.getElementById('bio').value.trim();
            const errorDiv = document.getElementById('authError');
            const submitBtn = document.getElementById('authSubmitBtn');

            errorDiv.innerHTML = '';
            
            if (username.length < 3) {
                showError('authError', 'Username must be at least 3 characters long');
                return;
            }
            
            if (password.length < 6) {
                showError('authError', 'Password must be at least 6 characters long');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Loading...';

                if (mode === 'signup') {
                    const existingUser = await blobAPI.get(`user_${username}`);
                    const pendingUser = await blobAPI.get(`pending_user_${username}`);
                    
                    if (existingUser || pendingUser) {
                        showError('authError', 'Username already exists or is pending approval!');
                        return;
                    }
                    
                    const newPendingUser = { 
                        username, 
                        password,
                        bio: bio || `Hello! I'm ${username}`,
                        createdAt: new Date().toISOString(),
                        status: 'pending',
                        isAdmin: false
                    };
                    
                    await blobAPI.set(`pending_user_${username}`, newPendingUser);
                    
                    closeModal('authModal');
                    showSuccessMessage('Account created! Waiting for admin approval.');
                    
                } else {
                    const user = await blobAPI.get(`user_${username}`);
                    
                    if (!user) {
                        const pendingUser = await blobAPI.get(`pending_user_${username}`);
                        if (pendingUser) {
                            showError('authError', 'Your account is still pending admin approval.');
                        } else {
                            showError('authError', 'Invalid username or password');
                        }
                        return;
                    }
                    
                    if (user.password !== password) {
                        showError('authError', 'Invalid username or password');
                        return;
                    }
                    
                    currentUser = { username, profile: user };
                    await blobAPI.set('current_user', currentUser);
                    
                    // Load user's followed communities after login
                    await loadFollowedCommunities();
                    
                    closeModal('authModal');
                    updateUI();
                    showSuccessMessage('Welcome back!');

                    if (user.isAdmin) {
                        await loadAdminStats();
                    }
                }
                
                form.reset();
                
            } catch (error) {
                console.error('Auth error:', error);
                showError('authError', 'Something went wrong. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
            }
        }

        async function logout() {
            try {
                currentUser = null;
                followedCommunities = new Set(); // Clear followed communities
                
                // Try to delete current_user key, but don't fail if it doesn't exist
                try {
                    await blobAPI.delete('current_user');
                } catch (deleteError) {
                    // Ignore 404 errors - the key might not exist
                    if (!deleteError.message.includes('404')) {
                        console.warn('Failed to delete current_user key:', deleteError);
                    }
                }
                
                // Hide admin panel
                document.getElementById('adminPanel').style.display = 'none';
                
                navigateToFeed();
                updateUI();
                showSuccessMessage('Logged out successfully!');
            } catch (error) {
                console.error('Logout error:', error);
                // Even if there's an error, still clear the user state
                currentUser = null;
                followedCommunities = new Set();
                document.getElementById('adminPanel').style.display = 'none';
                navigateToFeed();
                updateUI();
                showSuccessMessage('Logged out successfully!');
            }
        }

        // Community functions
        async function handleCreateCommunity(e) {
            e.preventDefault();
            
            if (!currentUser) {
                showError('createCommunityError', 'Please sign in to create a community');
                return;
            }
            
            const name = document.getElementById('communityName').value.trim().toLowerCase();
            const displayName = document.getElementById('communityDisplayName').value.trim();
            const description = document.getElementById('communityDescription').value.trim();
            const submitBtn = document.getElementById('createCommunitySubmitBtn');
            const errorDiv = document.getElementById('createCommunityError');
            
            errorDiv.innerHTML = '';
            
            // Validation
            if (!/^[a-z0-9_]{3,25}$/.test(name)) {
                showError('createCommunityError', 'Community name must be 3-25 characters, lowercase, alphanumeric and underscores only');
                return;
            }

            if (!displayName || displayName.length > 50) {
                showError('createCommunityError', 'Display name is required and must be 50 characters or less');
                return;
            }

            if (description.length > 500) {
                showError('createCommunityError', 'Description must be 500 characters or less');
                return;
            }

            // Check if community already exists
            const existingCommunity = await blobAPI.get(`community_${name}`);
            if (existingCommunity) {
                showError('createCommunityError', 'Community name already exists');
                return;
            }
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating...';
                
                const community = {
                    name,
                    displayName,
                    description,
                    createdBy: currentUser.username,
                    createdAt: new Date().toISOString(),
                    isPrivate: false,
                    moderators: [currentUser.username],
                    members: [currentUser.username],
                    rules: []
                };
                
                await blobAPI.set(`community_${name}`, community);
                communities.unshift(community);
                
                closeModal('createCommunityModal');
                document.getElementById('createCommunityForm').reset();
                
                updateCommunityDropdown();
                
                if (currentUser.profile?.isAdmin) {
                    await loadAdminStats();
                }
                
                showSuccessMessage(`Community "${displayName}" created successfully!`);
                
            } catch (error) {
                console.error('Error creating community:', error);
                showError('createCommunityError', 'Failed to create community. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Community';
            }
        }

        // Post functions
        function setPostType(type) {
            currentPostType = type;
            
            // Update button states
            const buttons = document.querySelectorAll('[onclick*="setPostType"]');
            buttons.forEach(btn => {
                if (btn.onclick.toString().includes(`'${type}'`)) {
                    btn.style.background = 'var(--btn-primary-bg)';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = 'transparent';
                    btn.style.color = 'var(--fg-default)';
                }
            });
            
            // Show/hide relevant fields
            const textFields = document.getElementById('textPostFields');
            const linkFields = document.getElementById('linkPostFields');
            
            if (type === 'text') {
                textFields.style.display = 'block';
                linkFields.style.display = 'none';
                document.getElementById('postContent').required = true;
                document.getElementById('postUrl').required = false;
                
                // Hide media preview
                const preview = document.getElementById('mediaPreview');
                if (preview) {
                    preview.innerHTML = '';
                    preview.style.display = 'none';
                }
            } else {
                textFields.style.display = 'none';
                linkFields.style.display = 'block';
                document.getElementById('postContent').required = false;
                document.getElementById('postUrl').required = true;
                
                // Show media preview container if URL has content
                const urlInput = document.getElementById('postUrl');
                if (urlInput && urlInput.value.trim()) {
                    previewMedia(urlInput.value.trim());
                }
            }
        }

        async function handleCreatePost(e) {
            e.preventDefault();
            
            if (!currentUser) {
                showError('composeError', 'Please sign in to create a post');
                return;
            }
            
            const title = document.getElementById('postTitle').value.trim();
            const communityName = document.getElementById('postCommunity').value;
            const isPrivate = document.getElementById('isPrivate').checked;
            const submitBtn = document.getElementById('composeSubmitBtn');
            const errorDiv = document.getElementById('composeError');
            
            let content = '';
            let url = '';
            let description = '';
            
            if (currentPostType === 'text') {
                content = document.getElementById('postContent').value.trim();
                if (!content) {
                    showError('composeError', 'Please provide content');
                    return;
                }
            } else {
                url = document.getElementById('postUrl').value.trim();
                description = document.getElementById('postDescription').value.trim();
                if (!url) {
                    showError('composeError', 'Please provide a URL');
                    return;
                }
                
                try {
                    new URL(url);
                } catch {
                    showError('composeError', 'Please provide a valid URL');
                    return;
                }
            }
            
            errorDiv.innerHTML = '';
            
            if (!title) {
                showError('composeError', 'Please provide a title');
                return;
            }
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';
                
                const post = {
                    id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: currentPostType,
                    title,
                    author: currentUser.username,
                    timestamp: new Date().toISOString(),
                    isPrivate,
                    communityName: communityName || null,
                    replies: []
                };

                if (currentPostType === 'text') {
                    post.content = content;
                } else {
                    post.url = url;
                    if (description) post.description = description;
                }
                
                await blobAPI.set(post.id, post);
                posts.unshift(post);
                
                closeModal('composeModal');
                document.getElementById('composeForm').reset();
                
                // Reset post type
                currentPostType = 'text';
                setPostType('text');
                
                updateUI();
                
                if (currentUser.profile?.isAdmin) {
                    await loadAdminStats();
                }
                
                showSuccessMessage('Post created successfully!');
                
            } catch (error) {
                console.error('Error creating post:', error);
                showError('composeError', 'Failed to create post. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post';
            }
        }

        async function deletePost(postId) {
            if (!confirm('Are you sure you want to delete this post?')) {
                return;
            }
            
            try {
                await blobAPI.delete(postId);
                posts = posts.filter(p => p.id !== postId);
                updateUI();
                
                if (currentUser.profile?.isAdmin) {
                    await loadAdminStats();
                }
                
                showSuccessMessage('Post deleted successfully!');
            } catch (error) {
                console.error('Error deleting post:', error);
                showError('general', 'Failed to delete post. Please try again.');
            }
        }

        // Admin functions (keeping existing implementation but fixing user counting)
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
                const communityKeys = await blobAPI.list('community_');

                // Update the old admin panel stats if they exist
                const totalUsersEl = document.getElementById('totalUsers');
                const pendingUsersEl = document.getElementById('pendingUsers');
                const totalPostsEl = document.getElementById('totalPosts');
                const totalCommunitiesEl = document.getElementById('totalCommunities');
                
                if (totalUsersEl) totalUsersEl.textContent = finalUsers.length;
                if (pendingUsersEl) pendingUsersEl.textContent = pendingUserKeys.length;
                if (totalPostsEl) totalPostsEl.textContent = postKeys.length;
                if (totalCommunitiesEl) totalCommunitiesEl.textContent = communityKeys.length;
                
                // Update the new admin page stats if they exist
                const adminTotalUsersEl = document.getElementById('adminTotalUsers');
                const adminPendingUsersEl = document.getElementById('adminPendingUsers');
                const adminTotalPostsEl = document.getElementById('adminTotalPosts');
                const adminTotalCommunitiesEl = document.getElementById('adminTotalCommunities');
                
                if (adminTotalUsersEl) adminTotalUsersEl.textContent = finalUsers.length;
                if (adminPendingUsersEl) adminPendingUsersEl.textContent = pendingUserKeys.length;
                if (adminTotalPostsEl) adminTotalPostsEl.textContent = postKeys.length;
                if (adminTotalCommunitiesEl) adminTotalCommunitiesEl.textContent = communityKeys.length;
                
                console.log(`Admin stats: ${finalUsers.length} users, ${pendingUserKeys.length} pending, ${postKeys.length} posts, ${communityKeys.length} communities`);
                
            } catch (error) {
                console.error('Error loading admin stats:', error);
            }
        }

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

        // Utility functions
        function showError(elementId, message) {
            document.getElementById(elementId).innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
        }

        function showSuccessMessage(message) {
            const successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.textContent = message;
            successDiv.style.position = 'fixed';
            successDiv.style.top = '80px';
            successDiv.style.right = '20px';
            successDiv.style.zIndex = '1000';
            successDiv.style.borderRadius = '8px';
            successDiv.style.boxShadow = 'var(--overlay-shadow)';
            document.body.appendChild(successDiv);
            
            setTimeout(() => {
                successDiv.remove();
            }, 4000);
        }

        function formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
            if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
            return date.toLocaleDateString();
        }

        function formatDate(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short' 
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Markdown toolbar functionality
        let currentTextarea = null;

        function insertMarkdown(prefix, suffix, placeholder) {
            const textarea = document.getElementById('postContent');
            if (!textarea) return;
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);
            const replacement = selectedText || placeholder;
            
            const newText = textarea.value.substring(0, start) + 
                           prefix + replacement + suffix + 
                           textarea.value.substring(end);
            
            textarea.value = newText;
            
            // Set cursor position
            const newCursorPos = start + prefix.length + replacement.length;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            
            // Trigger input event for any listeners
            textarea.dispatchEvent(new Event('input'));
        }

        function insertImage() {
            // Reset the form
            document.getElementById('imageInsertForm').reset();
            currentTextarea = document.getElementById('postContent');
            openModal('imageInsertModal');
        }

        function handleImageInsert(e) {
            e.preventDefault();
            
            const url = document.getElementById('imageUrl').value.trim();
            const alt = document.getElementById('imageAltText').value.trim() || 'Image';
            const title = document.getElementById('imageTitle').value.trim();
            
            if (!url) {
                showSuccessMessage('Please enter an image URL');
                return;
            }
            
            // Validate URL format
            try {
                new URL(url);
            } catch {
                showSuccessMessage('Please enter a valid URL');
                return;
            }
            
            let markdown = `![${alt}](${url}`;
            if (title) {
                markdown += ` "${title}"`;
            }
            markdown += ')';
            
            if (currentTextarea) {
                const start = currentTextarea.selectionStart;
                const end = currentTextarea.selectionEnd;
                
                const newText = currentTextarea.value.substring(0, start) + 
                               markdown + 
                               currentTextarea.value.substring(end);
                
                currentTextarea.value = newText;
                currentTextarea.focus();
                currentTextarea.setSelectionRange(start + markdown.length, start + markdown.length);
                currentTextarea.dispatchEvent(new Event('input'));
            }
            
            closeModal('imageInsertModal');
            showSuccessMessage('Image inserted successfully!');
        }

        function insertLink() {
            // Reset the form
            document.getElementById('linkInsertForm').reset();
            currentTextarea = document.getElementById('postContent');
            
            // Pre-fill with selected text if any
            const start = currentTextarea.selectionStart;
            const end = currentTextarea.selectionEnd;
            const selectedText = currentTextarea.value.substring(start, end);
            
            if (selectedText) {
                document.getElementById('linkText').value = selectedText;
            }
            
            openModal('linkInsertModal');
        }

        function handleLinkInsert(e) {
            e.preventDefault();
            
            const url = document.getElementById('linkUrl').value.trim();
            const text = document.getElementById('linkText').value.trim();
            
            if (!url || !text) {
                showSuccessMessage('Please enter both URL and link text');
                return;
            }
            
            // Validate URL format
            try {
                new URL(url);
            } catch {
                showSuccessMessage('Please enter a valid URL');
                return;
            }
            
            const markdown = `[${text}](${url})`;
            
            if (currentTextarea) {
                const start = currentTextarea.selectionStart;
                const end = currentTextarea.selectionEnd;
                
                const newText = currentTextarea.value.substring(0, start) + 
                               markdown + 
                               currentTextarea.value.substring(end);
                
                currentTextarea.value = newText;
                currentTextarea.focus();
                currentTextarea.setSelectionRange(start + markdown.length, start + markdown.length);
                currentTextarea.dispatchEvent(new Event('input'));
            }
            
            closeModal('linkInsertModal');
            showSuccessMessage('Link inserted successfully!');
        }

        function previewMarkdown() {
            const textarea = document.getElementById('postContent');
            const preview = document.getElementById('markdownPreview');
            const previewContent = document.getElementById('previewContent');
            const previewBtn = document.getElementById('previewBtn');
            
            if (!textarea.value.trim()) {
                showSuccessMessage('Write some content to preview');
                return;
            }
            
            if (preview.style.display === 'none') {
                // Show preview
                const html = renderMarkdown(textarea.value);
                previewContent.innerHTML = html;
                preview.style.display = 'block';
                textarea.style.display = 'none';
                previewBtn.textContent = '✏️';
                previewBtn.title = 'Edit';
            } else {
                // Hide preview
                hidePreview();
            }
        }

        function hidePreview() {
            const textarea = document.getElementById('postContent');
            const preview = document.getElementById('markdownPreview');
            const previewBtn = document.getElementById('previewBtn');
            
            preview.style.display = 'none';
            textarea.style.display = 'block';
            previewBtn.textContent = '👁️';
            previewBtn.title = 'Preview';
            textarea.focus();
        }

        function openImageModal(imageUrl) {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                cursor: pointer;
                backdrop-filter: blur(4px);
            `;
            
            // Create image container
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                cursor: default;
            `;
            
            // Create image element
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.cssText = `
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            `;
            
            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕ Close';
            closeBtn.style.cssText = `
                background: var(--bg-default);
                color: var(--fg-default);
                border: 1px solid var(--border-default);
                border-radius: 6px;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            `;
            
            // Add hover effect to close button
            closeBtn.addEventListener('mouseover', () => {
                closeBtn.style.background = 'var(--btn-secondary-hover-bg)';
            });
            closeBtn.addEventListener('mouseout', () => {
                closeBtn.style.background = 'var(--bg-default)';
            });
            
            // Close modal function
            const closeModal = () => {
                overlay.remove();
            };
            
            // Event listeners
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal();
                }
            });
            
            closeBtn.addEventListener('click', closeModal);
            
            // ESC key to close
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
            // Prevent image click from closing modal
            imageContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Assemble modal
            imageContainer.appendChild(img);
            imageContainer.appendChild(closeBtn);
            overlay.appendChild(imageContainer);
            document.body.appendChild(overlay);
            
            // Add loading state
            img.addEventListener('load', () => {
                img.style.opacity = '1';
            });
            img.addEventListener('error', () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSIxMDAiIHk9Ijc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE2IiBmYW1pbHk9InNhbnMtc2VyaWYiIGZpbGw9IiM5OTkiPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                img.style.maxWidth = '300px';
                img.style.maxHeight = '200px';
            });
            
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.3s ease';
        }

        // Enhanced media detection using API
        async function detectMediaType(url) {
            try {
                const response = await fetch('/.netlify/functions/api/media/detect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    return result;
                } else {
                    throw new Error('API detection failed');
                }
            } catch (error) {
                console.error('Media detection API error:', error);
                // Fallback to local detection
                return detectMediaTypeLocal(url);
            }
        }

        // Local fallback media detection
        function detectMediaTypeLocal(url) {
            if (!url) return { type: 'text', canEmbed: false, platform: null };

            // YouTube
            if (url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)/)) {
                return { type: 'video', canEmbed: true, platform: 'youtube' };
            }

            // Dailymotion
            if (url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)/)) {
                return { type: 'video', canEmbed: true, platform: 'dailymotion' };
            }

            // Suno
            if (url.match(/suno\.com\/song\//)) {
                return { type: 'audio', canEmbed: true, platform: 'suno' };
            }

            // Direct media files
            if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
                return { type: 'image', canEmbed: true, platform: 'direct' };
            }

            if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
                return { type: 'video', canEmbed: true, platform: 'direct' };
            }

            if (url.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i)) {
                return { type: 'audio', canEmbed: true, platform: 'direct' };
            }

            // General website
            if (url.match(/^https?:\/\/.+/i)) {
                return { type: 'website', canEmbed: true, platform: 'web' };
            }

            return { type: 'link', canEmbed: false, platform: null };
        }

        // Preview media in compose modal
        async function previewMedia(url) {
            if (!url || !url.trim()) return;
            
            const previewContainer = document.getElementById('mediaPreview');
            if (!previewContainer) {
                // Create preview container if it doesn't exist
                const container = document.createElement('div');
                container.id = 'mediaPreview';
                container.style.cssText = `
                    margin-top: 12px;
                    padding: 12px;
                    border: 1px solid var(--border-default);
                    border-radius: 6px;
                    background: var(--bg-subtle);
                `;
                
                const urlInput = document.getElementById('postUrl');
                if (urlInput && urlInput.parentNode) {
                    urlInput.parentNode.insertBefore(container, urlInput.nextSibling);
                }
            }
            
            const preview = document.getElementById('mediaPreview');
            preview.innerHTML = '<div style="text-align: center; color: var(--fg-muted);">🔍 Detecting media type...</div>';
            
            try {
                const mediaInfo = await detectMediaType(url);
                const mediaHtml = renderMediaFromUrl(url);
                
                if (mediaHtml) {
                    preview.innerHTML = `
                        <div style="margin-bottom: 8px; font-size: 12px; color: var(--fg-muted); font-weight: 500;">
                            📱 Preview (${mediaInfo.platform ? mediaInfo.platform.charAt(0).toUpperCase() + mediaInfo.platform.slice(1) : 'Unknown'} ${mediaInfo.type})
                        </div>
                        ${mediaHtml}
                    `;
                } else {
                    preview.innerHTML = `
                        <div style="text-align: center; color: var(--fg-muted); font-size: 14px;">
                            🔗 ${mediaInfo.type === 'website' ? 'Website link' : 'Link'} detected
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Media preview error:', error);
                preview.innerHTML = `
                    <div style="text-align: center; color: var(--danger-fg); font-size: 14px;">
                        ⚠️ Could not preview media
                    </div>
                `;
            }
        }
