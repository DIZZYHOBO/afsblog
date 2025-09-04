// ui.js - UI rendering and modal functions - Updated to remove c/ prefix

let markdownRenderer;
let uploadedMedia = null;

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

// Community dropdown update
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

// Feed content update
function updateFeedContent(html) {
    document.getElementById('feed').innerHTML = html;
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
        
        // Show media preview container if URL has content
        const urlInput = document.getElementById('postUrl');
        if (urlInput && urlInput.value.trim()) {
            previewMedia(urlInput.value.trim());
        }
    }
}

// Reply count update
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

// Toggle replies section
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

// Markdown rendering
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

// Media rendering from URL
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
                <iframe src="https://www.dailymotion.com/embed/video/${videoId}?autoplay=0&mute=0&queue-autoplay-next=0&queue-enable=0&ui-start-screen-info=0&ui-logo=0" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
                        allow="autoplay 'none'"
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

// Post content rendering
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

// Render replies
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

// Render post list
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
                                ${escapeHtml(community.displayName)}
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

// Feed rendering functions - UPDATED to only handle 'general' and 'followed'
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

// UPDATED: renderFeedWithTabs - no longer handles private tab, only general and followed
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

    // User is logged in, render based on current tab (only general and followed now)
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

// My Shed page rendering (private posts) - UPDATED to be its own page
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
    
    const privatePosts = posts.filter(post => post.isPrivate && post.author === currentUser.username);
    
    // Create header for My Shed
    const myShedHeader = `
        <div style="background: var(--bg-default); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">🏠</span>
                <div>
                    <h1 style="color: var(--fg-default); margin: 0 0 4px 0; font-size: 28px;">My Shed</h1>
                    <p style="color: var(--fg-muted); margin: 0; font-size: 16px;">Your private posts and personal content</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; padding-top: 16px; border-top: 1px solid var(--border-default);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px; font-weight: 600; color: var(--accent-fg);">${privatePosts.length}</span>
                    <span style="color: var(--fg-muted); font-size: 14px;">private ${privatePosts.length === 1 ? 'post' : 'posts'}</span>
                </div>
                <div style="width: 1px; height: 20px; background: var(--border-default);"></div>
                <div style="color: var(--fg-muted); font-size: 14px;">
                    Only visible to you
                </div>
            </div>
        </div>
    `;
    
    const postsHtml = renderPostList(privatePosts, `
        <div style="text-align: center; padding: 40px; color: var(--fg-muted);">
            <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
            <h3 style="color: var(--fg-default); margin-bottom: 8px;">No Private Posts Yet</h3>
            <p style="margin-bottom: 20px;">Your private posts will appear here. Create a private post to get started!</p>
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

// Legacy function - now redirects to renderFeedWithTabs
function renderFeed() {
    renderFeedWithTabs();
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
                        ${userPosts.length > 0 ? renderPostList(userPosts, 'No public posts yet!') : '<div class="empty-state"><p>You haven\'t created any public posts yet. <a href="#" onclick="openModal(\'composeModal\'); return false;" style="color: var(--accent-fg);">Create your first post!</a></p><p style="margin-top: 12px; color: var(--fg-muted); font-size: 14px;">Note: Only public posts are shown on profiles. Private posts remain private and are only visible to you in "My Shed".</p></div>'}
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
                        <p class="community-card-handle">${escapeHtml(community.name)}</p>
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
                        <p class="community-card-handle">${escapeHtml(community.name)}</p>
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

// Image modal
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
        const mediaInfo = await detectMediaTypeAPI(url);
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
