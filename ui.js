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
    const bioGroup = document.getElementById('bioGroup');
    
    if (!modal || !title || !form) return;
    
    document.getElementById('authError').innerHTML = '';
    
    if (mode === 'signup') {
        title.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Sign In';
        submitBtn.textContent = 'Sign Up';
        form.dataset.mode = 'signup';
        if (bioGroup) bioGroup.style.display = 'block';
    } else {
        title.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
        submitBtn.textContent = 'Sign In';
        form.dataset.mode = 'signin';
        if (bioGroup) bioGroup.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

function toggleAuthMode() {
    const form = document.getElementById('authForm');
    const currentMode = form.dataset.mode;
    openAuthModal(currentMode === 'signup' ? 'signin' : 'signup');
}

function openComposeModal() {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    openModal('composeModal');
    updateCommunityDropdown();
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
    document.querySelectorAll('.post-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide appropriate form fields
    const textGroup = document.getElementById('textContentGroup');
    const urlGroup = document.getElementById('urlContentGroup');
    
    if (type === 'text') {
        if (textGroup) textGroup.style.display = 'block';
        if (urlGroup) urlGroup.style.display = 'none';
    } else {
        if (textGroup) textGroup.style.display = 'none';
        if (urlGroup) urlGroup.style.display = 'block';
    }
}

// Success message display
function showSuccessMessage(message, duration = 3000) {
    const successDiv = document.getElementById('successMessage');
    if (!successDiv) return;
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, duration);
}

// Error message display
function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (!errorDiv) return;
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Markdown rendering
function renderMarkdown(text) {
    if (!text) return '';
    
    // Initialize marked if needed
    if (!markdownRenderer && typeof marked !== 'undefined') {
        markdownRenderer = new marked.Renderer();
        marked.setOptions({
            renderer: markdownRenderer,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {}
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
    }
    
    try {
        // Render markdown
        let html = marked ? marked.parse(text) : text;
        
        // Sanitize HTML to prevent XSS
        if (typeof DOMPurify !== 'undefined') {
            html = DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 
                               'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 
                               'h3', 'h4', 'h5', 'h6', 'img'],
                ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'class']
            });
        }
        
        return `<div class="markdown-content">${html}</div>`;
    } catch (error) {
        console.error('Error rendering markdown:', error);
        return `<div class="markdown-content">${escapeHtml(text)}</div>`;
    }
}

// Media content rendering
function renderMediaContent(url, mediaType) {
    if (!url) return '';
    
    // Determine media type if not provided
    if (!mediaType) {
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            mediaType = 'image';
        } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
            mediaType = 'video';
        } else if (url.match(/youtube\.com|youtu\.be/)) {
            mediaType = 'youtube';
        } else if (url.match(/twitter\.com|x\.com/)) {
            mediaType = 'tweet';
        } else {
            mediaType = 'link';
        }
    }
    
    switch (mediaType) {
        case 'image':
            return `<img src="${url}" alt="Post image" class="post-image" onclick="openImageModal('${url}')">`;
            
        case 'video':
            return `<video src="${url}" controls class="post-video"></video>`;
            
        case 'youtube':
            const youtubeId = extractYoutubeId(url);
            if (youtubeId) {
                return `<div class="post-embed">
                    <iframe src="https://www.youtube.com/embed/${youtubeId}" 
                            frameborder="0" allowfullscreen></iframe>
                </div>`;
            }
            return renderLinkPreview(url);
            
        case 'tweet':
            return `<div class="post-embed tweet-embed">
                <a href="${url}" target="_blank">View Tweet</a>
            </div>`;
            
        default:
            return renderLinkPreview(url);
    }
}

// Link preview rendering
function renderLinkPreview(url) {
    return `<div class="link-preview">
        <a href="${url}" target="_blank" rel="noopener">
            <div class="link-url">${url}</div>
        </a>
    </div>`;
}

// Media preview for compose modal
async function previewMedia(url) {
    const preview = document.getElementById('mediaPreview');
    if (!preview) return;
    
    preview.innerHTML = '<div class="loading">Loading preview...</div>';
    
    try {
        // Detect media type
        const response = await detectMedia(url);
        
        if (response && response.type) {
            preview.innerHTML = renderMediaContent(url, response.type);
        } else {
            preview.innerHTML = renderLinkPreview(url);
        }
    } catch (error) {
        preview.innerHTML = '<div class="error">Failed to load preview</div>';
    }
}

// Post rendering
function renderPost(post) {
    if (!post) return '';
    
    const isLiked = currentUser?.profile?.likedPosts?.includes(post.id);
    const isAuthor = currentUser?.username === post.author;
    
    return `
        <div class="post" data-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    <span class="post-username">@${escapeHtml(post.author)}</span>
                    ${post.community ? `<span class="post-community">in ${escapeHtml(post.community)}</span>` : ''}
                    <span class="post-timestamp">${formatTimeAgo(post.timestamp)}</span>
                </div>
                ${isAuthor ? `
                    <button class="post-options" onclick="showPostOptions('${post.id}')">⋯</button>
                ` : ''}
            </div>
            ${post.title ? `<h3 class="post-title">${escapeHtml(post.title)}</h3>` : ''}
            <div class="post-content">
                ${post.type === 'media' && post.mediaUrl ? 
                    renderMediaContent(post.mediaUrl, post.mediaType) : 
                    renderMarkdown(post.content || '')
                }
            </div>
            <div class="post-actions">
                <button class="post-action ${isLiked ? 'liked' : ''}" onclick="handleLike('${post.id}')">
                    ${isLiked ? '❤️' : '🤍'} ${post.likes || 0}
                </button>
                <button class="post-action" onclick="showComments('${post.id}')">
                    💬 ${post.comments?.length || 0}
                </button>
                <button class="post-action" onclick="sharePost('${post.id}')">
                    🔗 Share
                </button>
            </div>
        </div>
    `;
}

// Render post list
function renderPostList(postsList) {
    const feed = document.getElementById('feed') || document.getElementById('feedContent');
    if (!feed) return;
    
    if (!postsList || postsList.length === 0) {
        feed.innerHTML = '<div class="no-posts">No posts yet. Be the first to post!</div>';
        return;
    }
    
    feed.innerHTML = postsList.map(post => renderPost(post)).join('');
}

// Render feed
function renderFeed() {
    renderPostList(posts);
}

// Community page rendering
function renderCommunityPage(communityName) {
    const community = communities.find(c => c.name === communityName);
    if (!community) {
        updateFeedContent('<div class="error">Community not found</div>');
        return;
    }
    
    const communityPosts = posts.filter(p => p.community === communityName);
    const isFollowing = currentUser?.profile?.followedCommunities?.includes(communityName);
    const isMember = community.members?.includes(currentUser?.username);
    const isCreator = community.creator === currentUser?.username;
    
    const html = `
        <div class="community-header">
            <div class="community-info">
                <h1>${escapeHtml(community.displayName)}</h1>
                <p>${escapeHtml(community.description || 'No description')}</p>
                <div class="community-stats">
                    <span>${community.members?.length || 1} members</span>
                    <span>•</span>
                    <span>${communityPosts.length} posts</span>
                </div>
            </div>
            <div class="community-actions">
                ${currentUser ? `
                    ${!isCreator ? `
                        <button class="btn ${isFollowing ? 'btn-secondary' : ''}" 
                                onclick="handleFollowCommunity('${communityName}', this)">
                            ${isFollowing ? '✓ Following' : 'Follow'}
                        </button>
                    ` : ''}
                    <button class="btn" onclick="openComposeModal(); document.getElementById('postCommunity').value='${communityName}'">
                        + New Post
                    </button>
                ` : ''}
            </div>
        </div>
        <div class="community-posts">
            ${communityPosts.length > 0 ? 
                communityPosts.map(post => renderPost(post)).join('') : 
                '<div class="no-posts">No posts in this community yet.</div>'
            }
        </div>
    `;
    
    updateFeedContent(html);
}

// Show post options menu
function showPostOptions(postId) {
    // Implementation for post options (edit, delete, etc.)
    console.log('Show options for post:', postId);
}

// Handle like action
async function handleLike(postId) {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    try {
        const result = await toggleLike(postId);
        if (result.success) {
            // Update the post in the local state
            const post = posts.find(p => p.id === postId);
            if (post) {
                const isLiked = currentUser.profile.likedPosts?.includes(postId);
                if (isLiked) {
                    post.likes = (post.likes || 0) - 1;
                    currentUser.profile.likedPosts = currentUser.profile.likedPosts.filter(id => id !== postId);
                } else {
                    post.likes = (post.likes || 0) + 1;
                    if (!currentUser.profile.likedPosts) {
                        currentUser.profile.likedPosts = [];
                    }
                    currentUser.profile.likedPosts.push(postId);
                }
                // Re-render the current page
                updateUI();
            }
        }
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

// Show comments
function showComments(postId) {
    console.log('Show comments for post:', postId);
    // Implementation for showing comments
}

// Share post
function sharePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const url = `${window.location.origin}/#post=${postId}`;
    
    if (navigator.share) {
        navigator.share({
            title: post.title || 'Post from The Shed',
            text: post.content?.substring(0, 100) || '',
            url: url
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            showSuccessMessage('Link copied to clipboard!');
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
        });
    }
}

// Helper function to extract YouTube video ID
function extractYoutubeId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
