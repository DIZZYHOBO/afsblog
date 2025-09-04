// ui.js - UI rendering and modal functions - Complete file

let markdownRenderer;
let uploadedMedia = null;

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
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

// Community dropdown update
function updateCommunityDropdown() {
    const select = document.getElementById('postCommunity');
    if (!select) return;
    
    select.innerHTML = '<option value="">General Feed</option>';
    
    communities.forEach(community => {
        const option = document.createElement('option');
        option.value = community.name;
        option.textContent = community.displayName;
        select.appendChild(option);
    });
}

// Feed content update - FIXED to check both possible element IDs
function updateFeedContent(html) {
    // Try the new ID first
    let feedElement = document.getElementById('feedContent');
    
    // If not found, try the old ID
    if (!feedElement) {
        feedElement = document.getElementById('feed');
    }
    
    // If we found an element, update it
    if (feedElement) {
        feedElement.innerHTML = html;
    } else {
        console.error('Feed element not found - neither feedContent nor feed IDs exist');
    }
}

// Post type setting
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
        
        // Show media preview if available
        const preview = document.getElementById('mediaPreview');
        if (preview) {
            preview.style.display = 'block';
        }
    }
}

// Media preview function
async function previewMedia(url) {
    if (!url) return;
    
    const preview = document.getElementById('mediaPreview');
    if (!preview) return;
    
    const mediaType = detectMediaType(url);
    
    if (mediaType.embed) {
        const embedHtml = renderMediaEmbed(url, mediaType);
        preview.innerHTML = `
            <div class="media-preview">
                <h4>Preview:</h4>
                ${embedHtml}
            </div>
        `;
    } else {
        preview.innerHTML = '';
    }
}

// Render media embed
function renderMediaEmbed(url, mediaType) {
    if (!mediaType.embed) return '';
    
    switch (mediaType.platform) {
        case 'youtube':
            const youtubeId = extractYouTubeId(url);
            return youtubeId ? `
                <div class="video-container">
                    <iframe src="https://www.youtube.com/embed/${youtubeId}" 
                            frameborder="0" 
                            allowfullscreen></iframe>
                </div>` : '';
                
        case 'dailymotion':
            const dailymotionId = extractDailymotionId(url);
            return dailymotionId ? `
                <div class="video-container">
                    <iframe src="https://www.dailymotion.com/embed/video/${dailymotionId}" 
                            frameborder="0" 
                            allowfullscreen></iframe>
                </div>` : '';
                
        case 'suno':
            const sunoId = extractSunoId(url);
            return sunoId ? `
                <div class="audio-container">
                    <iframe src="https://suno.com/embed/${sunoId}" 
                            frameborder="0" 
                            height="150"></iframe>
                </div>` : '';
                
        case 'direct':
            if (mediaType.type === 'image') {
                return `<img src="${url}" alt="Preview" class="media-preview-img">`;
            } else if (mediaType.type === 'video') {
                return `<video src="${url}" controls class="media-preview-video"></video>`;
            } else if (mediaType.type === 'audio') {
                return `<audio src="${url}" controls class="media-preview-audio"></audio>`;
            }
            break;
            
        default:
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
    
    return '';
}

// Extract platform-specific IDs
function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}

function extractDailymotionId(url) {
    const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([^_]+)/);
    return match ? match[1] : null;
}

function extractSunoId(url) {
    const match = url.match(/suno\.com\/song\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
}

// Render media from URL
function renderMediaFromUrl(url) {
    const mediaType = detectMediaType(url);
    if (mediaType.embed) {
        return renderMediaEmbed(url, mediaType);
    }
    return null;
}

// Reply rendering
function renderReplies(replies) {
    if (!replies || replies.length === 0) {
        return '<p style="color: var(--fg-muted); text-align: center; padding: 8px;">No replies yet</p>';
    }
    
    return replies.map(reply => `
        <div class="reply">
            <div class="reply-header">
                <span class="reply-author">@${escapeHtml(reply.author)}</span>
                <span class="reply-timestamp">${formatTimestamp(reply.timestamp)}</span>
                ${currentUser && (currentUser.username === reply.author || currentUser.username === currentUser.profile?.isAdmin) ? `
                    <button class="reply-delete-btn" onclick="deleteReply('${reply.postId}', '${reply.id}')">×</button>
                ` : ''}
            </div>
            <div class="reply-content">
                ${marked ? marked.parse(reply.content, { renderer: window.markdownRenderer }) : escapeHtml(reply.content)}
            </div>
        </div>
    `).join('');
}

// Toggle replies section
function toggleReplies(postId) {
    const repliesSection = document.getElementById(`replies-${postId}`);
    if (repliesSection) {
        const isOpen = repliesSection.classList.contains('open');
        if (isOpen) {
            repliesSection.classList.remove('open');
        } else {
            repliesSection.classList.add('open');
            const replyInput = document.getElementById(`reply-input-${postId}`);
            if (replyInput) {
                replyInput.focus();
            }
        }
    }
}

// Update reply count
function updateReplyCount(postId, count) {
    const buttons = document.querySelectorAll(`[onclick="toggleReplies('${postId}')"]`);
    buttons.forEach(btn => {
        const replyCountSpan = btn.querySelector('span:last-child');
        if (replyCountSpan) {
            replyCountSpan.textContent = count;
        }
    });
}

// Post list rendering
function renderPostList(postList, emptyMessage) {
    if (postList.length === 0) {
        return `<div class="empty-state">${emptyMessage}</div>`;
    }
    
    return postList.map(post => {
        const community = communities.find(c => c.name === post.communityName);
        const isLiked = post.likes && currentUser && post.likes.includes(currentUser.username);
        
        return `
            <div class="post" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-meta">
                        <span class="post-author">@${escapeHtml(post.author)}</span>
                        ${post.communityName ? `
                            <span class="post-community">
                                <a href="#" onclick="navigateToCommunity('${post.communityName}'); return false;" class="post-community-link">
                                    ${community ? escapeHtml(community.displayName) : escapeHtml(post.communityName)}
                                </a>
                            </span>
                        ` : ''}
                        <span class="post-timestamp">${formatTimestamp(post.timestamp)}</span>
                        ${post.isPrivate ? '<span class="post-private-badge">🔒 Private</span>' : ''}
                    </div>
                </div>
                
                <h3 class="post-title">${escapeHtml(post.title)}</h3>
                
                <div class="post-content">
                    ${post.type === 'link' && post.url ? 
                        renderMediaEmbed(post.url, detectMediaType(post.url)) : 
                        (marked ? marked.parse(post.content || '', { renderer: window.markdownRenderer }) : escapeHtml(post.content || ''))
                    }
                </div>
                
                <div class="post-actions">
                    <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                        <span>${isLiked ? '❤️' : '🤍'}</span>
                        <span>${post.likes ? post.likes.length : 0}</span>
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

// Feed rendering functions
function renderGeneralFeed() {
    const publicPosts = posts.filter(post => !post.isPrivate);
    updateFeedContent(renderPostList(publicPosts, 'No public posts yet!'));
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
    if (typeof loadFollowedCommunities === 'function') {
        await loadFollowedCommunities();
    }
    
    if (!followedCommunities || followedCommunities.size === 0) {
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
    const followedPosts = typeof getFollowedCommunityPosts === 'function' ? 
        getFollowedCommunityPosts() : [];
    
    if (followedPosts.length === 0) {
        // User is following communities but they don't have any posts
        const noPostsHtml = `
            <div class="feature-placeholder">
                <h3>🏘️ No Posts Yet</h3>
                <p>You're following ${followedCommunities.size} ${followedCommunities.size === 1 ? 'community' : 'communities'}, but there are no recent posts.</p>
                <div style="margin-top: 16px; color: var(--fg-muted); font-size: 14px;">
                    <p><strong>Following:</strong> ${Array.from(followedCommunities).map(name => name).join(', ')}</p>
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
                        ${community ? escapeHtml(community.displayName) : escapeHtml(name)}
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

// Main feed rendering function
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
        default:
            renderGeneralFeed();
    }
}

// My Shed page rendering
function renderMyShedPage() {
    if (!currentUser) {
        const loginRequiredHtml = `
            <div class="feature-placeholder">
                <h3>🏠 My Shed</h3>
                <p>Please sign in to view your private posts and personal content.</p>
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
    updateFeedContent('<div class="loading">Loading your shed...</div>');
    
    const privatePosts = posts.filter(post => post.author === currentUser.username && post.isPrivate);
    
    const myShedHeader = `
        <div class="my-shed-header">
            <h2>🏠 My Shed</h2>
            <p>Your private posts - only visible to you</p>
            <div class="my-shed-stats">
                <span>${privatePosts.length} private ${privatePosts.length === 1 ? 'post' : 'posts'}</span>
            </div>
        </div>
    `;
    
    const postsHtml = renderPostList(privatePosts, `
        <div>
            <h3>No private posts yet!</h3>
            <p>Create a private post to get started!</p>
            <button class="btn" onclick="openModal('composeModal')" style="margin-right: 12px;">
                Create Private Post
            </button>
            <button class="btn btn-secondary" onclick="navigateToFeed()">
                Browse Public Feed
            </button>
        </div>
    `);
    
    updateFeedContent(myShedHeader + postsHtml);
}

// Community page rendering
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

    // Check if user is following this community
    let isFollowing = false;
    
    if (currentUser && typeof checkIfFollowing === 'function') {
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
        followButtonHtml = `
            <button class="btn" 
                    onclick="openAuthModal('signin')" 
                    style="padding: 12px 24px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                + Follow (Sign In)
            </button>`;
    } else {
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
                    <p class="community-handle">${escapeHtml(community.name)}</p>
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

// Profile page rendering
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

    // Get user's posts
    const userPosts = posts.filter(post => post.author === currentUser.username && !post.isPrivate);
    const privatePosts = posts.filter(post => post.author === currentUser.username && post.isPrivate);

    // Get user's followed communities count
    const followedCount = typeof followedCommunities !== 'undefined' ? followedCommunities.size : 0;

    // Get communities created by user
    const createdCommunities = communities.filter(c => c.createdBy === currentUser.username);

    // Calculate some stats
    const totalReplies = posts.reduce((total, post) => {
        if (!post.replies) return total;
        return total + post.replies.filter(reply => reply.author === currentUser.username).length;
    }, 0);

    const profileHtml = `
        <div class="profile-page">
            <div class="profile-header">
                <div class="profile-hero">
                    <div class="profile-picture-container">
                        <div class="profile-picture-placeholder">
                            ${currentUser.username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div class="profile-info">
                        <h1 class="profile-username">@${escapeHtml(currentUser.username)}</h1>
                        ${currentUser.profile?.bio ? `<p class="profile-bio">${escapeHtml(currentUser.profile.bio)}</p>` : ''}
                        ${currentUser.profile?.isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-number">${userPosts.length}</span>
                        <span class="stat-label">public posts</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-number">${privatePosts.length}</span>
                        <span class="stat-label">private posts</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-number">${totalReplies}</span>
                        <span class="stat-label">replies</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-number">${followedCount}</span>
                        <span class="stat-label">following</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-number">${createdCommunities.length}</span>
                        <span class="stat-label">communities created</span>
                    </div>
                </div>
            </div>

            <div class="profile-tabs">
                <button class="profile-tab active" id="profilePostsTab" onclick="switchProfileTab('posts')">
                    Public Posts (${userPosts.length})
                </button>
                <button class="profile-tab" id="profileCommunitiesTab" onclick="switchProfileTab('communities')">
                    Communities (${createdCommunities.length})
                </button>
                <button class="profile-tab" id="profileFollowingTab" onclick="switchProfileTab('following')">
                    Following (${followedCount})
                </button>
            </div>

            <div class="profile-content">
                <div class="profile-tab-panel active" id="profilePostsContent">
                    ${renderPostList(userPosts, 'No public posts yet!')}
                </div>
                <div class="profile-tab-panel" id="profileCommunitiesContent" style="display: none;">
                    ${renderUserCommunities(createdCommunities)}
                </div>
                <div class="profile-tab-panel" id="profileFollowingContent" style="display: none;">
                    ${renderFollowingList()}
                </div>
            </div>
        </div>
    `;

    updateFeedContent(profileHtml);
}

// Profile tab switching
function switchProfileTab(tabName) {
    // Update tab visual states
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`profile${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update content visibility
    document.querySelectorAll('.profile-tab-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    const activePanel = document.getElementById(`profile${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Content`);
    if (activePanel) {
        activePanel.style.display = 'block';
    }
}

// Render user's communities
function renderUserCommunities(userCommunities) {
    if (userCommunities.length === 0) {
        return '<div class="empty-state">You haven\'t created any communities yet.</div>';
    }
    
    return userCommunities.map(community => {
        const postCount = posts.filter(p => p.communityName === community.name).length;
        const memberCount = community.members?.length || 1;
        
        return `
            <div class="community-card">
                <div class="community-card-header">
                    <div class="community-card-avatar">
                        ${community.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="community-card-info">
                        <h3 class="community-card-title">
                            <a href="#" onclick="navigateToCommunity('${community.name}'); return false;">
                                ${escapeHtml(community.displayName)}
                            </a>
                        </h3>
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

// Render following list
function renderFollowingList() {
    if (!followedCommunities || followedCommunities.size === 0) {
        return '<div class="empty-state">You\'re not following any communities yet.</div>';
    }
    
    return Array.from(followedCommunities).map(name => {
        const community = communities.find(c => c.name === name);
        if (!community) return '';
        
        const postCount = posts.filter(p => p.communityName === community.name).length;
        const memberCount = community.members?.length || 1;
        
        return `
            <div class="community-card">
                <div class="community-card-header">
                    <div class="community-card-avatar">
                        ${community.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="community-card-info">
                        <h3 class="community-card-title">
                            <a href="#" onclick="navigateToCommunity('${community.name}'); return false;">
                                ${escapeHtml(community.displayName)}
                            </a>
                        </h3>
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

// Legacy function - redirects to renderFeedWithTabs
function renderFeed() {
    renderFeedWithTabs();
}

// Open edit profile modal
function openEditProfileModal() {
    // TODO: Implement edit profile modal
    showSuccessMessage('Edit profile feature coming soon!');
}

// Open image modal
function openImageModal(imageUrl) {
    // TODO: Implement image modal
    window.open(imageUrl, '_blank');
}
