// js/communities.js - Community Management Component
class CommunitiesManager {
    constructor() {
        this.followedCommunities = new Set();
    }

    // Load user's followed communities from storage
    async loadFollowedCommunities() {
        const currentUser = State.getCurrentUser();
        if (!currentUser) {
            this.followedCommunities = new Set();
            State.set('followedCommunities', this.followedCommunities);
            return;
        }

        try {
            const userFollows = await blobAPI.get(`${CONFIG.STORAGE_KEYS.FOLLOWED_COMMUNITIES}${currentUser.username}`);
            this.followedCommunities = new Set(userFollows?.communities || []);
            State.set('followedCommunities', this.followedCommunities);
            console.log('Loaded followed communities:', Array.from(this.followedCommunities));
        } catch (error) {
            console.error('Error loading followed communities:', error);
            this.followedCommunities = new Set();
            State.set('followedCommunities', this.followedCommunities);
        }
    }

    // Save user's followed communities to storage
    async saveFollowedCommunities() {
        const currentUser = State.getCurrentUser();
        if (!currentUser) return;

        try {
            const followData = {
                username: currentUser.username,
                communities: Array.from(this.followedCommunities),
                lastUpdated: new Date().toISOString()
            };
            await blobAPI.set(`${CONFIG.STORAGE_KEYS.FOLLOWED_COMMUNITIES}${currentUser.username}`, followData);
            console.log('Saved followed communities:', followData);
        } catch (error) {
            console.error('Error saving followed communities:', error);
        }
    }

    // Check if user is following a specific community
    isFollowing(communityName) {
        return this.followedCommunities.has(communityName);
    }

    // Toggle follow status for a community
    async toggleFollow(communityName) {
        if (!State.isAuthenticated()) {
            Modals.openAuth('signin');
            return;
        }

        const followBtn = document.getElementById(`followBtn-${communityName}`);
        if (!followBtn) {
            console.error('Follow button not found for community:', communityName);
            return;
        }
        
        const originalText = followBtn.textContent;
        const wasFollowing = this.isFollowing(communityName);
        
        try {
            followBtn.disabled = true;
            followBtn.textContent = 'Loading...';
            
            console.log('Toggling follow status for community:', communityName);
            console.log('Was following:', wasFollowing, 'Will follow:', !wasFollowing);
            
            // Update local state
            if (wasFollowing) {
                this.followedCommunities.delete(communityName);
            } else {
                this.followedCommunities.add(communityName);
            }

            // Save to storage
            await this.saveFollowedCommunities();

            // Update community member count
            await this.updateCommunityMemberCount(communityName, !wasFollowing);

            // Update button appearance
            if (!wasFollowing) {
                followBtn.textContent = '✓ Following';
                followBtn.className = 'btn btn-secondary';
                Utils.showSuccessMessage(`Now following c/${communityName}! 🎉`);
            } else {
                followBtn.textContent = '+ Follow';
                followBtn.className = 'btn';
                Utils.showSuccessMessage(`Unfollowed c/${communityName}`);
            }

            // Update global state
            State.set('followedCommunities', new Set(this.followedCommunities));

            // If we're currently viewing the followed feed, refresh it
            if (State.get('currentPage') === 'feed' && State.get('currentFeedTab') === 'followed') {
                console.log('Refreshing followed feed after follow status change');
                setTimeout(() => {
                    App.renderFollowedFeed();
                }, 100);
            }
            
        } catch (error) {
            console.error('Error toggling follow status:', error);
            
            // Revert local state on error
            if (wasFollowing) {
                this.followedCommunities.add(communityName);
            } else {
                this.followedCommunities.delete(communityName);
            }
            
            followBtn.textContent = originalText;
            Utils.showSuccessMessage(error.message || 'Failed to update follow status. Please try again.');
        } finally {
            followBtn.disabled = false;
        }
    }

    // Update community member count
    async updateCommunityMemberCount(communityName, shouldFollow) {
        try {
            const communities = State.get('communities');
            const community = communities.find(c => c.name === communityName);
            
            if (community) {
                const currentUser = State.getCurrentUser();
                
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
                await blobAPI.set(`${CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX}${communityName}`, community);
                console.log(`Updated community ${communityName} members:`, community.members);

                // Update local communities array
                const communityIndex = communities.findIndex(c => c.name === communityName);
                if (communityIndex !== -1) {
                    communities[communityIndex] = community;
                    State.set('communities', [...communities]);
                }

                // Update member count display on page
                this.updateCommunityMemberCountDisplay(communityName, community.members.length);
            }
        } catch (error) {
            console.error('Error updating community member count:', error);
        }
    }

    // Update the member count display on the community page
    updateCommunityMemberCountDisplay(communityName, newCount) {
        const memberCountElements = document.querySelectorAll('.stat-number');
        memberCountElements.forEach((element, index) => {
            const statLabel = element.parentNode.querySelector('.stat-label');
            if (statLabel && statLabel.textContent === 'members') {
                element.textContent = newCount;
                console.log(`Updated member count display to ${newCount}`);
            }
        });
    }

    // Render community page
    async renderCommunityPage(community) {
        console.log('Rendering community page for:', community);

        // Check if user is following this community (if logged in)
        let isFollowing = false;
        
        if (State.isAuthenticated()) {
            try {
                isFollowing = this.isFollowing(community.name);
                console.log('Follow status check result:', isFollowing);
            } catch (error) {
                console.error('Error checking follow status:', error);
            }
        }

        const posts = State.get('posts');
        const communityPosts = posts.filter(post => post.communityName === community.name && !post.isPrivate);
        
        // Create follow button HTML
        let followButtonHtml = '';
        
        if (!State.isAuthenticated()) {
            // User not logged in - show sign in button
            followButtonHtml = `
                <button class="btn" onclick="Modals.openAuth('signin')" style="padding: 12px 24px; font-weight: 600;">
                    + Follow (Sign In)
                </button>`;
        } else {
            // User is logged in - show actual follow/unfollow button
            const buttonText = isFollowing ? '✓ Following' : '+ Follow';
            const buttonClass = isFollowing ? 'btn btn-secondary' : 'btn';
            
            followButtonHtml = `
                <button class="${buttonClass}" 
                        onclick="Communities.toggleFollow('${community.name}')" 
                        id="followBtn-${community.name}"
                        style="padding: 12px 24px; font-weight: 600;">
                    ${buttonText}
                </button>`;
        }
        
        // Ensure member count is accurate
        const memberCount = community.members?.length || 1;
        
        const communityHeader = `
            <div class="community-header">
                <div class="community-hero">
                    <div class="community-avatar">
                        ${community.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="community-info">
                        <h1 class="community-title">${Utils.escapeHtml(community.displayName)}</h1>
                        <p class="community-handle">c/${Utils.escapeHtml(community.name)}</p>
                        ${community.description ? `<p class="community-description">${Utils.escapeHtml(community.description)}</p>` : ''}
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
                        <span class="stat-creator">@${Utils.escapeHtml(community.createdBy)}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-label">${Utils.formatDate(community.createdAt)}</span>
                    </div>
                </div>
            </div>
        `;
        
        const finalHtml = communityHeader + Posts.renderPostList(communityPosts, 'No posts in this community yet!');
        App.updateFeedContent(finalHtml);
    }

    // Handle create community form
    async handleCreateForm(e) {
        e.preventDefault();
        
        if (!State.isAuthenticated()) {
            Utils.showError('createCommunityError', 'Please sign in to create a community');
            return;
        }
        
        const formData = new FormData(e.target);
        const name = formData.get('name')?.trim().toLowerCase();
        const displayName = formData.get('displayName')?.trim();
        const description = formData.get('description')?.trim();
        
        const submitBtn = document.getElementById('createCommunitySubmitBtn');
        const errorDiv = document.getElementById('createCommunityError');
        
        if (!name || !displayName || !submitBtn || !errorDiv) return;
        
        errorDiv.innerHTML = '';
        
        // Validation
        if (!CONFIG.VALIDATION.COMMUNITY_NAME.test(name)) {
            Utils.showError('createCommunityError', `Community name must be ${CONFIG.MAX_COMMUNITY_NAME_LENGTH} characters max, lowercase, alphanumeric and underscores only`);
            return;
        }

        if (displayName.length > CONFIG.MAX_COMMUNITY_DISPLAY_NAME_LENGTH) {
            Utils.showError('createCommunityError', `Display name must be ${CONFIG.MAX_COMMUNITY_DISPLAY_NAME_LENGTH} characters or less`);
            return;
        }

        if (description && description.length > CONFIG.MAX_COMMUNITY_DESCRIPTION_LENGTH) {
            Utils.showError('createCommunityError', `Description must be ${CONFIG.MAX_COMMUNITY_DESCRIPTION_LENGTH} characters or less`);
            return;
        }

        // Check if community already exists
        const communities = State.get('communities');
        const existingCommunity = communities.find(c => c.name === name);
        if (existingCommunity) {
            Utils.showError('createCommunityError', 'Community name already exists');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
            
            const currentUser = State.getCurrentUser();
            const community = {
                name,
                displayName,
                description: description || '',
                createdBy: currentUser.username,
                createdAt: new Date().toISOString(),
                isPrivate: false,
                moderators: [currentUser.username],
                members: [currentUser.username],
                rules: []
            };
            
            await blobAPI.set(`${CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX}${name}`, community);
            StateHelpers.addCommunity(community);
            
            Modals.close('createCommunityModal');
            e.target.reset();
            
            App.updateCommunityDropdowns();
            Utils.showSuccessMessage(`Community "${displayName}" created successfully!`);
            
        } catch (error) {
            console.error('Error creating community:', error);
            Utils.showError('createCommunityError', error.message || 'Failed to create community. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Community';
        }
    }

    // Render communities list for profile
    renderCommunitiesList(communitiesList) {
        return communitiesList.map(community => {
            const posts = State.get('posts');
            const memberCount = community.members?.length || 1;
            const postCount = posts.filter(p => p.communityName === community.name && !p.isPrivate).length;
            
            return `
                <div class="community-card">
                    <div class="community-card-header">
                        <div class="community-card-avatar">
                            ${community.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="community-card-info">
                            <h4 class="community-card-name">${Utils.escapeHtml(community.displayName)}</h4>
                            <p class="community-card-handle">c/${Utils.escapeHtml(community.name)}</p>
                            ${community.description ? `<p class="community-card-description">${Utils.escapeHtml(community.description)}</p>` : ''}
                        </div>
                        <div class="community-card-actions">
                            <button class="btn btn-secondary" onclick="Navigation.navigateToCommunity('${community.name}')">
                                View
                            </button>
                        </div>
                    </div>
                    <div class="community-card-stats">
                        <span class="community-card-stat">${postCount} posts</span>
                        <span class="community-card-stat">${memberCount} members</span>
                        <span class="community-card-stat">Created ${Utils.formatDate(community.createdAt)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render following list for profile
    renderFollowingList() {
        const communities = State.get('communities');
        const followedCommunitiesList = Array.from(this.followedCommunities).map(name => {
            const community = communities.find(c => c.name === name);
            return community || { 
                name, 
                displayName: name, 
                description: '', 
                members: [], 
                createdAt: new Date().toISOString() 
            };
        });

        return followedCommunitiesList.map(community => {
            const posts = State.get('posts');
            const memberCount = community.members?.length || 1;
            const postCount = posts.filter(p => p.communityName === community.name && !p.isPrivate).length;
            
            return `
                <div class="community-card">
                    <div class="community-card-header">
                        <div class="community-card-avatar">
                            ${community.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="community-card-info">
                            <h4 class="community-card-name">${Utils.escapeHtml(community.displayName)}</h4>
                            <p class="community-card-handle">c/${Utils.escapeHtml(community.name)}</p>
                            ${community.description ? `<p class="community-card-description">${Utils.escapeHtml(community.description)}</p>` : ''}
                        </div>
                        <div class="community-card-actions">
                            <button class="btn btn-secondary" onclick="Navigation.navigateToCommunity('${community.name}')" style="margin-right: 8px;">
                                View
                            </button>
                            <button class="btn" onclick="Communities.toggleFollow('${community.name}')" id="followBtn-${community.name}">
                                ✓ Following
                            </button>
                        </div>
                    </div>
                    <div class="community-card-stats">
                        <span class="community-card-stat">${postCount} posts</span>
                        <span class="community-card-stat">${memberCount} members</span>
                        <span class="community-card-stat">Following since ${Utils.formatDate(new Date().toISOString())}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Create global communities instance
const Communities = new CommunitiesManager();