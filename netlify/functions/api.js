// components/Blog.js
import { ICONS } from './icons.js';
import { formatTimestamp, timeAgo, processSpoilers } from './utils.js';
import { showToast, showSuccessToast, showErrorToast, showWarningToast, renderLoginPrompt } from './ui.js';

class BlogAPI {
    constructor(baseUrl = 'https://afsblogs.netlify.app/.netlify/functions/api') {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('blog_token');
        
        // Add pagination state
        this.currentPage = 1;
        this.hasMore = true;
        this.postsPerPage = 10;
        this.allPosts = []; // Cache all posts
        this.lastFeedType = null;
        this.lastLoadTime = 0;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        console.log('Making API request:', {
            url,
            method: options.method || 'GET',
            hasAuth: !!this.token,
            endpoint
        });

        const response = await fetch(url, { ...options, headers });
        const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }));

        if (!response.ok) {
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                data,
                url,
                method: options.method || 'GET'
            });
            throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    }

    async register(username, password, bio = '', profilePictureUrl = '') {
        const requestData = { username, password };
        if (bio.trim()) requestData.bio = bio;
        if (profilePictureUrl.trim()) requestData.profilePictureUrl = profilePictureUrl;
        
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
        
        // Note: Registration returns pending status, not a token
        return data;
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (data.token) {
            this.token = data.token;
            localStorage.setItem('blog_token', data.token);
            localStorage.setItem('blog_username', data.user.username);
            localStorage.setItem('blog_user_data', JSON.stringify(data.user));
        }
        
        return data;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.token = null;
            localStorage.removeItem('blog_token');
            localStorage.removeItem('blog_username');
            localStorage.removeItem('blog_user_data');
        }
    }

    // Get user's own posts with pagination
    async getUserPosts(page = 1, limit = 10) {
        return await this.request(`/posts?page=${page}&limit=${limit}`);
    }

    // Get specific post by ID
    async getPost(postId) {
        return await this.request(`/posts/${postId}`);
    }

    // Updated feed methods with pagination support
    async getPublicFeed(page = 1, limit = 10) {
        return await this.request(`/feeds/public?page=${page}&limit=${limit}&includeReplies=true`);
    }

    async getPrivateFeed(page = 1, limit = 10) {
        return await this.request(`/feeds/private?page=${page}&limit=${limit}&includeReplies=true`);
    }

    // Search posts using the API
    async searchPosts(query, page = 1, limit = 20, includeReplies = true) {
        return await this.request(`/search/posts?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&includeReplies=${includeReplies}`);
    }

    // Create text post
    async createTextPost(title, content, isPrivate = false) {
        return await this.request('/posts/create', {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'text', 
                title, 
                content, 
                isPrivate 
            })
        });
    }

    // Create link post
    async createLinkPost(title, url, description = '', isPrivate = false) {
        return await this.request('/posts/create', {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'link', 
                title, 
                url, 
                description, 
                isPrivate 
            })
        });
    }

    // Edit post - NEW FEATURE from API docs
    async editPost(postId, updateData) {
        return await this.request(`/posts/${postId}/edit`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    // Delete post
    async deletePost(postId) {
        return await this.request(`/posts/${postId}`, {
            method: 'DELETE'
        });
    }

    // Media detection
    async detectMedia(url) {
        return await this.request('/media/detect', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
    }

    // Get current user's profile
    async getProfile() {
        return await this.request('/profile');
    }

    // Update current user's profile
    async updateProfile(bio, profilePictureUrl = undefined) {
        const updateData = {};
        if (bio !== undefined) updateData.bio = bio;
        if (profilePictureUrl !== undefined) updateData.profilePictureUrl = profilePictureUrl;
        
        return await this.request('/profile/update', {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    // Toggle like/unlike for a post
    async toggleLike(postId) {
        console.log('Toggling like for post:', postId);
        return await this.request('/likes/toggle', {
            method: 'POST',
            body: JSON.stringify({ postId })
        });
    }

    // Get detailed likes for a post
    async getPostLikes(postId) {
        return await this.request(`/posts/${postId}/likes`);
    }

    // Create comment/reply
    async createComment(postId, content) {
        console.log('Creating comment:', { postId, content });
        return await this.request('/replies/create', {
            method: 'POST',
            body: JSON.stringify({ postId, content })
        });
    }

    isLoggedIn() {
        return !!this.token;
    }

    // Get current user info from localStorage
    getCurrentUser() {
        const userData = localStorage.getItem('blog_user_data');
        return userData ? JSON.parse(userData) : null;
    }

    // Reset pagination when switching feeds
    resetPagination() {
        this.currentPage = 1;
        this.hasMore = true;
        this.allPosts = [];
        this.lastLoadTime = 0;
    }
}

const blogAPI = new BlogAPI();

// Profile utility functions

// Validate profile picture URL
function validateProfilePictureUrl(url) {
    if (!url || url.trim() === '') return { valid: true, message: 'No profile picture' };
    
    try {
        const urlObj = new URL(url.trim());
        const pathname = urlObj.pathname.toLowerCase();
        
        if (!pathname.endsWith('.png') && !pathname.endsWith('.gif')) {
            return { valid: false, message: 'Must be a PNG or GIF file' };
        }
        
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return { valid: false, message: 'Must use HTTP or HTTPS' };
        }
        
        return { valid: true, message: 'Valid image URL' };
    } catch (error) {
        return { valid: false, message: 'Invalid URL format' };
    }
}

// Enhanced user avatar rendering with better profile picture support
function renderUserAvatar(user, size = 'normal') {
    const sizeClass = size === 'small' ? 'profile-avatar-small' : 
                     size === 'large' ? 'profile-avatar-large' : 'profile-avatar';
    const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';

    // Check if user has a profile picture URL
    if (user.profilePictureUrl && user.profilePictureUrl.trim() !== '') {
        return `
            <div class="${sizeClass}">
                <img src="${user.profilePictureUrl}" 
                     alt="${user.username || 'User'}" 
                     class="profile-picture"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
                <div class="avatar-fallback" style="display: none;">${initial}</div>
            </div>
        `;
    }

    // Fallback to initial-based avatar
    return `<div class="${sizeClass} avatar-fallback">${initial}</div>`;
}

export function renderBlogCard(post) {
    const card = document.createElement('div');
    card.className = 'status blog-card';
    card.dataset.id = post.id;

    // Handle different post types
    let contentHTML = '';
    const isPrivate = post.isPrivate;
    const privacyBadge = isPrivate ? '<span class="privacy-badge private">Private</span>' : '<span class="privacy-badge public">Public</span>';
    
    // Check if current user is the author
    const currentUsername = localStorage.getItem('blog_username');
    const isAuthor = currentUsername === post.author;
    
    // Get reply and like counts from the API response
    const replyCount = post.replyCount || (post.replies ? post.replies.length : 0);
    const likesCount = post.likesCount || 0;
    const userLiked = post.userLiked || false;

    // Create user object with profile picture if available
    const postAuthor = {
        username: post.author,
        profilePictureUrl: post.authorProfilePicture || null
    };

    // Show edit history if post has been edited
    const editIndicator = post.editedAt ? `
        <div class="edit-indicator" title="Last edited ${formatTimestamp(post.editedAt)} by ${post.editedBy}">
            ${ICONS.edit || '✏️'} Edited
        </div>
    ` : '';

    if (post.type === 'link') {
        // Handle link posts with media detection
        let mediaHTML = '';
        if (post.canEmbed && post.embedHtml) {
            // Use the embed HTML provided by the API
            mediaHTML = `<div class="blog-media-container">${post.embedHtml}</div>`;
        } else if (post.url) {
            // Handle different media types manually
            const url = post.url;
            
            // YouTube videos
            const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const youtubeMatch = url.match(youtubeRegex);
            
            // Vimeo videos
            const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
            const vimeoMatch = url.match(vimeoRegex);
            
            // Direct video files
            const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(url);
            
            // Direct audio files
            const isDirectAudio = /\.(mp3|wav|ogg|m4a)$/i.test(url);
            
            // Direct image files
            const isDirectImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
            
            if (youtubeMatch) {
                mediaHTML = `
                    <div class="video-embed-container">
                        <iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0" 
                                width="100%" 
                                height="315"
                                frameborder="0" 
                                allowfullscreen
                                loading="lazy"
                                onload="this.style.display='block'"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"></iframe>
                        <div class="video-fallback" style="display: none; padding: 20px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; text-align: center;">
                            <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-color);">
                                🎥 Watch on YouTube: ${post.title}
                            </a>
                        </div>
                    </div>
                `;
            } else if (vimeoMatch) {
                mediaHTML = `
                    <div class="video-embed-container">
                        <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" 
                                width="100%" 
                                height="315"
                                frameborder="0" 
                                allowfullscreen
                                loading="lazy"
                                onload="this.style.display='block'"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"></iframe>
                        <div class="video-fallback" style="display: none; padding: 20px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; text-align: center;">
                            <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-color);">
                                🎬 Watch on Vimeo: ${post.title}
                            </a>
                        </div>
                    </div>
                `;
            } else if (isDirectVideo) {
                mediaHTML = `
                    <div class="blog-media-container">
                        <video controls width="100%" preload="metadata">
                            <source src="${url}" type="video/mp4">
                            Your browser does not support the video tag.
                            <a href="${url}" target="_blank" rel="noopener noreferrer">Download video</a>
                        </video>
                    </div>
                `;
            } else if (isDirectAudio) {
                mediaHTML = `
                    <div class="blog-media-container">
                        <audio controls width="100%">
                            <source src="${url}" type="audio/mpeg">
                            Your browser does not support the audio tag.
                            <a href="${url}" target="_blank" rel="noopener noreferrer">Download audio</a>
                        </audio>
                    </div>
                `;
            } else if (isDirectImage) {
                mediaHTML = `
                    <div class="blog-media-container">
                        <img src="${url}" alt="${post.title}" loading="lazy" class="blog-clickable-image" data-image-url="${url}">
                    </div>
                `;
            } else {
                // Generic link with preview
                const domain = new URL(url).hostname.replace('www.', '');
                mediaHTML = `
                    <div class="blog-link-preview">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="blog-external-link">
                            <div class="link-preview-content">
                                <div class="link-title">${post.title}</div>
                                <div class="link-url">${url}</div>
                                ${post.description ? `<div class="link-description">${post.description}</div>` : ''}
                                <div class="link-domain-indicator">
                                    <span class="domain-text">${domain}</span>
                                </div>
                            </div>
                            <div class="external-link-icon">${ICONS.external || '🔗'}</div>
                        </a>
                    </div>
                `;
            }
        }

        contentHTML = `
            <h3 class="blog-title">${post.title}</h3>
            ${mediaHTML}
            ${post.description ? `<div class="blog-post-body">${processBlogContent(post.description)}</div>` : ''}
            ${editIndicator}
        `;
    } else {
        // Handle text posts with improved read more functionality
        const processedContent = processSpoilers(post.content || '');
        
        // Check if showdown is available, fallback to plain text if not
        let fullBodyHTML;
        try {
            const converter = new showdown.Converter();
            fullBodyHTML = converter.makeHtml(processedContent);
        } catch (error) {
            // Fallback if showdown is not available
            console.warn('showdown not available, using plain text');
            fullBodyHTML = processedContent.replace(/\n/g, '<br>');
        }

        // Check if content needs truncation
        const wordCount = post.content ? post.content.split(/\s+/).length : 0;
        let bodyHTML = fullBodyHTML;
        
        if (wordCount > 50) {
            const truncatedText = post.content.split(/\s+/).slice(0, 50).join(' ');
            const truncatedProcessed = processSpoilers(truncatedText);
            
            let truncatedHTML;
            try {
                const converter = new showdown.Converter();
                truncatedHTML = converter.makeHtml(truncatedProcessed);
            } catch (error) {
                truncatedHTML = truncatedProcessed.replace(/\n/g, '<br>');
            }
            
            bodyHTML = `
                <div class="blog-content-wrapper">
                    <div class="blog-content-truncated">
                        ${truncatedHTML}
                        <span class="read-more-text">... <button class="read-more-btn" type="button" style="color: var(--accent-color); background: none; border: none; text-decoration: underline; cursor: pointer; font-size: inherit; padding: 0; margin-left: 4px;">Read More</button></span>
                    </div>
                    <div class="blog-content-full" style="display: none;">
                        ${fullBodyHTML}
                        <div class="read-less-container" style="margin-top: 10px;">
                            <button class="read-less-btn" type="button" style="color: var(--accent-color); background: none; border: none; text-decoration: underline; cursor: pointer; font-size: inherit; padding: 4px 8px;">Read Less</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            bodyHTML = `<div class="blog-content-wrapper"><div class="blog-content-full">${fullBodyHTML}</div></div>`;
        }

        contentHTML = `
            <h3 class="blog-title">${post.title}</h3>
            <div class="blog-post-body">${bodyHTML}</div>
            ${editIndicator}
        `;
    }

    card.innerHTML = `
        <div class="status-body-content">
            <div class="status-header">
                <div class="status-header-main">
                    <div class="user-avatar-container" data-username="${post.author}">
                        ${renderUserAvatar(postAuthor, 'normal')}
                    </div>
                    <div>
                        <span class="display-name">${post.author}</span>
                        <span class="acct">${formatTimestamp(post.timestamp)} ${privacyBadge}</span>
                    </div>
                </div>
                <div class="status-header-side">
                    <div class="blog-icon-indicator">${ICONS.blog || '📝'}</div>
                    ${post.type === 'link' ? `<div class="post-type-badge link-badge">Link</div>` : ''}
                </div>
            </div>
        </div>
        <div class="status-content">
            ${contentHTML}
        </div>
        <div class="status-footer">
            <div class="status-actions">
                <button class="status-action" data-action="comment">
                    ${ICONS.reply || '💬'} ${replyCount}
                </button>
                <button class="status-action like-action ${userLiked ? 'liked' : ''}" data-action="like" data-likes="${likesCount}" data-user-liked="${userLiked}">
                    ${ICONS.like || '👍'} ${likesCount}
                </button>
                ${isAuthor ? `
                    <button class="status-action" data-action="edit">
                        ${ICONS.edit || '✏️'}
                    </button>
                    <button class="status-action danger" data-action="delete">
                        ${ICONS.delete || '🗑️'}
                    </button>
                ` : ''}
            </div>
        </div>
        <div class="blog-comments-container" style="display: none;">
            <div class="blog-comments-section">
                <div class="blog-comments-list"></div>
                <div class="blog-comment-form">
                    <textarea class="blog-comment-input" placeholder="Write a comment..." rows="3"></textarea>
                    <div class="blog-comment-actions">
                        <button class="button-secondary comment-cancel-btn">Cancel</button>
                        <button class="button-primary comment-submit-btn">Comment</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Handle read more/less functionality
    const readMoreBtn = card.querySelector('.read-more-btn');
    const readLessBtn = card.querySelector('.read-less-btn');
    
    if (readMoreBtn && readLessBtn) {
        const truncatedDiv = card.querySelector('.blog-content-truncated');
        const fullDiv = card.querySelector('.blog-content-full');

        readMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            truncatedDiv.style.display = 'none';
            fullDiv.style.display = 'block';
            fullDiv.style.maxHeight = '0px';
            fullDiv.style.overflow = 'hidden';
            fullDiv.style.transition = 'max-height 0.5s ease-out';
            
            setTimeout(() => {
                const targetHeight = fullDiv.scrollHeight;
                fullDiv.style.maxHeight = targetHeight + 'px';
                setTimeout(() => {
                    fullDiv.style.maxHeight = 'none';
                    fullDiv.style.overflow = 'visible';
                }, 500);
            }, 50);
        });

        readLessBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentHeight = fullDiv.offsetHeight;
            fullDiv.style.maxHeight = currentHeight + 'px';
            fullDiv.style.overflow = 'hidden';
            fullDiv.style.transition = 'max-height 0.3s ease-in';
            
            setTimeout(() => {
                fullDiv.style.maxHeight = '0px';
                setTimeout(() => {
                    fullDiv.style.display = 'none';
                    truncatedDiv.style.display = 'block';
                    fullDiv.style.maxHeight = 'none';
                    fullDiv.style.overflow = 'visible';
                    fullDiv.style.transition = '';
                    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
            }, 50);
        });
    }

    // Handle action buttons
    setupBlogCardActions(card, post);

    return card;
}

// Profile picture editor popup
function showProfilePictureEditor() {
    if (!blogAPI.isLoggedIn()) {
        showWarningToast('Please log in to edit your profile');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'profile-picture-modal';
    modal.innerHTML = `
        <div class="profile-picture-overlay">
            <div class="profile-picture-content">
                <div class="profile-picture-header">
                    <h3>Change Profile Picture</h3>
                    <button class="close-profile-picture-btn">&times;</button>
                </div>
                <div class="profile-picture-body">
                    <div class="form-group">
                        <label for="profilePictureUrl">Profile Picture URL</label>
                        <input type="url" id="profilePictureUrl" class="profile-picture-input" 
                               placeholder="https://example.com/image.png">
                        <div class="url-helper-text">
                            Must be a PNG or GIF image with HTTP/HTTPS URL. Leave empty to remove picture.
                        </div>
                        <div id="urlValidation" class="url-validation" style="display: none;"></div>
                    </div>
                    <div id="imagePreview" class="image-preview" style="display: none;">
                        <div class="preview-label">Preview:</div>
                        <div class="preview-container">
                            <img id="previewImg" alt="Preview" style="max-width: 100px; max-height: 100px; border-radius: 50%;">
                        </div>
                    </div>
                </div>
                <div class="profile-picture-footer">
                    <button type="button" class="button-secondary cancel-profile-btn">Cancel</button>
                    <button type="button" class="button-danger remove-picture-btn">Remove Picture</button>
                    <button type="button" class="button-primary save-profile-btn">Save</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const urlInput = modal.querySelector('#profilePictureUrl');
    const validation = modal.querySelector('#urlValidation');
    const preview = modal.querySelector('#imagePreview');
    const previewImg = modal.querySelector('#previewImg');
    const saveBtn = modal.querySelector('.save-profile-btn');
    const cancelBtn = modal.querySelector('.cancel-profile-btn');
    const removeBtn = modal.querySelector('.remove-picture-btn');
    const closeBtn = modal.querySelector('.close-profile-picture-btn');

    // Load current profile picture
    loadCurrentProfilePicture();

    async function loadCurrentProfilePicture() {
        try {
            const profile = await blogAPI.getProfile();
            if (profile.success && profile.profile.profilePictureUrl) {
                urlInput.value = profile.profile.profilePictureUrl;
                validateAndPreview(profile.profile.profilePictureUrl);
            }
        } catch (error) {
            console.error('Failed to load current profile:', error);
        }
    }

    // Real-time validation and preview
    urlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        validateAndPreview(url);
    });

    function validateAndPreview(url) {
        const result = validateProfilePictureUrl(url);
        
        if (url) {
            validation.style.display = 'block';
            validation.textContent = result.message;
            validation.className = `url-validation ${result.valid ? 'valid' : 'invalid'}`;
            
            if (result.valid && url !== '') {
                previewImg.onload = () => preview.style.display = 'block';
                previewImg.onerror = () => {
                    preview.style.display = 'none';
                    validation.textContent = 'Failed to load image from URL';
                    validation.className = 'url-validation invalid';
                };
                previewImg.src = url;
            } else {
                preview.style.display = 'none';
            }
        } else {
            validation.style.display = 'none';
            preview.style.display = 'none';
        }
        
        saveBtn.disabled = url && !result.valid;
    }

    // Handle save
    saveBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const result = validateProfilePictureUrl(url);
        
        if (url && !result.valid) {
            showErrorToast('Please enter a valid PNG or GIF image URL');
            return;
        }

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            await blogAPI.updateProfile(undefined, url || null);
            showSuccessToast('Profile picture updated successfully!');
            modal.remove();
            window.location.reload();
            
        } catch (error) {
            console.error('Error updating profile picture:', error);
            showErrorToast('Failed to update profile picture: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    });

    // Handle remove picture
    removeBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to remove your profile picture?')) {
            return;
        }

        try {
            removeBtn.disabled = true;
            removeBtn.textContent = 'Removing...';

            await blogAPI.updateProfile(undefined, null);
            showSuccessToast('Profile picture removed successfully!');
            modal.remove();
            window.location.reload();
            
        } catch (error) {
            console.error('Error removing profile picture:', error);
            showErrorToast('Failed to remove profile picture: ' + error.message);
        } finally {
            removeBtn.disabled = false;
            removeBtn.textContent = 'Remove Picture';
        }
    });

    // Handle close/cancel
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

export async function fetchBlogFeed(state, feedType = 'public', loadMore = false) {
    if (!blogAPI.isLoggedIn()) {
        renderBlogLoginPrompt(state.timelineDiv);
        return;
    }

    if (state.isLoadingMore && loadMore) return;

    // Reset pagination if switching feed types
    if (blogAPI.lastFeedType !== feedType) {
        blogAPI.resetPagination();
        blogAPI.lastFeedType = feedType;
        loadMore = false;
    }

    if (!loadMore) {
        window.scrollTo(0, 0);
        blogAPI.resetPagination();
    }
    
    if (loadMore && !blogAPI.hasMore) {
        console.log('No more blog posts to load');
        return;
    }

    state.isLoadingMore = true;
    if (loadMore) {
        state.scrollLoader.classList.add('loading');
        const loadMoreBtn = document.querySelector('#blog-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.textContent = 'Loading...';
            loadMoreBtn.disabled = true;
        }
    } else {
        document.getElementById('refresh-btn').classList.add('loading');
        state.timelineDiv.innerHTML = '<div class="loading-indicator">Loading blog posts...</div>';
    }

    try {
        const pageToLoad = loadMore ? blogAPI.currentPage + 1 : 1;
        console.log(`Loading blog feed: ${feedType}, page: ${pageToLoad}`);

        let response;
        if (feedType === 'public') {
            response = await blogAPI.getPublicFeed(pageToLoad, blogAPI.postsPerPage);
        } else {
            response = await blogAPI.getPrivateFeed(pageToLoad, blogAPI.postsPerPage);
        }

        const posts = response.posts || [];
        const pagination = response.pagination || {};

        blogAPI.currentPage = pageToLoad;
        blogAPI.hasMore = pagination.hasMore !== undefined ? pagination.hasMore : posts.length >= blogAPI.postsPerPage;

        console.log(`Loaded ${posts.length} posts, hasMore: ${blogAPI.hasMore}, page: ${blogAPI.currentPage}`);

        if (!loadMore) {
            state.timelineDiv.innerHTML = '';
            blogAPI.allPosts = [];
        }

        if (posts.length > 0) {
            const existingIds = new Set(blogAPI.allPosts.map(p => p.id));
            const newPosts = posts.filter(p => !existingIds.has(p.id));
            
            if (loadMore) {
                blogAPI.allPosts = [...blogAPI.allPosts, ...newPosts];
            } else {
                blogAPI.allPosts = posts;
            }

            const existingLoadMore = state.timelineDiv.querySelector('.load-more-container');
            if (existingLoadMore) {
                existingLoadMore.remove();
            }

            const postsToRender = loadMore ? newPosts : posts;
            postsToRender.forEach(post => {
                const postCard = renderBlogCard(post);
                state.timelineDiv.appendChild(postCard);
            });

            addPaginationControl(state, feedType);

        } else {
            if (!loadMore) {
                state.timelineDiv.innerHTML = `
                    <div class="empty-state">
                        <p>No ${feedType} blog posts yet.</p>
                        ${feedType === 'private' ? '<p>Your private posts will appear here.</p>' : '<p>Public posts from all users will appear here.</p>'}
                    </div>
                `;
            } else {
                blogAPI.hasMore = false;
                addPaginationControl(state, feedType);
            }
        }

    } catch (error) {
        console.error('Failed to fetch blog feed:', error);
        showErrorToast(`Could not load blog feed: ${error.message}`);
        if (!loadMore) {
            state.timelineDiv.innerHTML = `
                <div class="error-state">
                    <p>Error loading ${feedType} feed: ${error.message}</p>
                    <button class="button-primary" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    } finally {
        state.isLoadingMore = false;
        if (loadMore) {
            state.scrollLoader.classList.remove('loading');
        } else {
            document.getElementById('refresh-btn').classList.remove('loading');
        }
    }
}

function addPaginationControl(state, feedType) {
    const existingPagination = state.timelineDiv.querySelector('.load-more-container');
    if (existingPagination) {
        existingPagination.remove();
    }

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'load-more-container';

    if (blogAPI.hasMore) {
        paginationContainer.innerHTML = `
            <button class="load-more-btn" id="blog-load-more">Load More Posts</button>
            ${blogAPI.currentPage > 1 ? `
                <div class="pagination-info">
                    Page ${blogAPI.currentPage} • ${blogAPI.allPosts.length} posts loaded
                </div>
            ` : ''}
        `;

        const loadMoreBtn = paginationContainer.querySelector('#blog-load-more');
        loadMoreBtn.addEventListener('click', () => {
            fetchBlogFeed(state, feedType, true);
        });
    } else {
        if (blogAPI.allPosts.length > 0) {
            paginationContainer.innerHTML = `
                <div class="no-more-posts">
                    📄 No more posts to display
                </div>
                ${blogAPI.currentPage > 1 ? `
                    <div class="pagination-info">
                        ${blogAPI.allPosts.length} posts total
                    </div>
                ` : ''}
            `;
        }
    }

    if (paginationContainer.innerHTML.trim()) {
        state.timelineDiv.appendChild(paginationContainer);
    }
}

function renderBlogLoginPrompt(container) {
    container.innerHTML = `
        <div class="login-prompt blog-login-prompt">
            <h3>Connect to Blog</h3>
            <div class="login-tabs">
                <button class="login-tab-btn active" data-tab="login">Login</button>
                <button class="login-tab-btn" data-tab="register">Register</button>
            </div>
            <div class="login-tab-content active" id="blog-login-tab">
                <form class="login-form" id="blog-login-form">
                    <input type="text" class="username-input" placeholder="Username" required>
                    <input type="password" class="password-input" placeholder="Password" required>
                    <button type="submit" class="connect-btn">Login</button>
                </form>
            </div>
            <div class="login-tab-content" id="blog-register-tab">
                <form class="login-form" id="blog-register-form">
                    <input type="text" class="username-input" placeholder="Username (min 3 chars)" required minlength="3">
                    <input type="password" class="password-input" placeholder="Password (min 6 chars)" required minlength="6">
                    <input type="text" class="bio-input" placeholder="Bio (optional, max 500 chars)" maxlength="500">
                    <input type="url" class="profile-picture-input" placeholder="Profile Picture URL (optional - PNG/GIF only)">
                    <div class="registration-note">
                        <small>⚠️ Registration requires admin approval. You'll be notified when approved.</small>
                    </div>
                    <button type="submit" class="connect-btn">Register</button>
                </form>
            </div>
        </div>
    `;

    // Handle tab switching
    container.querySelectorAll('.login-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.login-tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.login-tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            container.querySelector(`#blog-${tab}-tab`).classList.add('active');
        });
    });

    // Handle login
    container.querySelector('#blog-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.querySelector('.username-input').value.trim();
        const password = e.target.querySelector('.password-input').value;

        if (!username || !password) {
            showErrorToast('Please fill in all fields');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('.connect-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            await blogAPI.login(username, password);
            showSuccessToast('Blog login successful!');
            window.location.reload();
        } catch (error) {
            showErrorToast('Login failed: ' + error.message);
        } finally {
            const submitBtn = e.target.querySelector('.connect-btn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });

    // Handle registration with enhanced validation
    container.querySelector('#blog-register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.querySelector('.username-input').value.trim();
        const password = e.target.querySelector('.password-input').value;
        const bio = e.target.querySelector('.bio-input').value.trim();
        const profilePictureUrl = e.target.querySelector('.profile-picture-input').value.trim();

        // Validation
        if (!username || username.length < 3) {
            showErrorToast('Username must be at least 3 characters');
            return;
        }
        
        if (!password || password.length < 6) {
            showErrorToast('Password must be at least 6 characters');
            return;
        }

        if (bio && bio.length > 500) {
            showErrorToast('Bio must be 500 characters or less');
            return;
        }

        if (profilePictureUrl) {
            const validation = validateProfilePictureUrl(profilePictureUrl);
            if (!validation.valid) {
                showErrorToast('Profile picture: ' + validation.message);
                return;
            }
        }

        try {
            const submitBtn = e.target.querySelector('.connect-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';

            const response = await blogAPI.register(username, password, bio, profilePictureUrl);
            
            if (response.status === 'pending') {
                showSuccessToast('Registration submitted! Please wait for admin approval.');
                // Clear form
                e.target.reset();
            } else if (response.token) {
                // Immediate approval (shouldn't happen based on docs)
                showSuccessToast('Registration and login successful!');
                window.location.reload();
            }
            
        } catch (error) {
            if (error.message.includes('409') || error.message.toLowerCase().includes('username')) {
                showErrorToast('Username already exists. Please choose a different one.');
            } else {
                showErrorToast('Registration failed: ' + error.message);
            }
        } finally {
            const submitBtn = e.target.querySelector('.connect-btn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });
}

export function renderBlogSubNav(currentFeed, actions) {
    console.log('renderBlogSubNav called with:', { currentFeed, actions });
    
    const subNavContainer = document.getElementById('timeline-sub-nav');
    console.log('Found timeline-sub-nav element:', subNavContainer);
    
    if (!subNavContainer) {
        console.error('timeline-sub-nav element not found!');
        return;
    }
    
    subNavContainer.innerHTML = '';
    subNavContainer.style.display = 'flex';
    subNavContainer.style.flexDirection = 'column';
    subNavContainer.style.gap = '12px';
    subNavContainer.style.padding = '10px';
    subNavContainer.style.backgroundColor = 'var(--card-color)';
    subNavContainer.style.borderBottom = '1px solid var(--border-color)';

    // Add search bar first
    console.log('Creating search container...');
    const searchContainer = document.createElement('div');
    searchContainer.className = 'blog-search-container';
    searchContainer.innerHTML = `
        <div class="blog-search-wrapper">
            <input type="text" 
                   id="blog-search-input" 
                   class="blog-search-input" 
                   placeholder="Search posts, replies, and content..."
                   autocomplete="off">
            <button type="button" id="blog-search-btn" class="blog-search-btn" title="Search">
                🔍
            </button>
            <button type="button" id="blog-clear-search" class="blog-clear-search-btn" title="Clear search" style="display: none;">
                ✕
            </button>
        </div>
        <div id="blog-search-status" class="blog-search-status" style="display: none;"></div>
    `;

    // Add user info and logout if logged in
    const currentUser = blogAPI.getCurrentUser();
    if (currentUser) {
        const userInfoContainer = document.createElement('div');
        userInfoContainer.className = 'blog-user-info';
        userInfoContainer.innerHTML = `
            <div class="user-info-content">
                <span class="current-user">@${currentUser.username}</span>
                <div class="user-actions">
                    <button class="user-action-btn" id="show-profile-btn" title="View Profile">
                        ${ICONS.user || '👤'}
                    </button>
                    <button class="user-action-btn" id="logout-btn" title="Logout">
                        ${ICONS.logout || '🚪'}
                    </button>
                </div>
            </div>
        `;
        subNavContainer.appendChild(userInfoContainer);

        // Handle user actions
        userInfoContainer.querySelector('#show-profile-btn').addEventListener('click', () => {
            showCurrentUserProfile();
        });

        userInfoContainer.querySelector('#logout-btn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await blogAPI.logout();
                    showSuccessToast('Logged out successfully');
                    window.location.reload();
                } catch (error) {
                    console.error('Logout error:', error);
                    // Clear local storage even if API call fails
                    blogAPI.token = null;
                    localStorage.removeItem('blog_token');
                    localStorage.removeItem('blog_username');
                    localStorage.removeItem('blog_user_data');
                    showWarningToast('Logged out (with errors)');
                    window.location.reload();
                }
            }
        });
    }

    // Add tabs
    console.log('Creating tabs container...');
    const tabs = document.createElement('div');
    tabs.className = 'timeline-sub-nav-tabs';

    const items = [
        { label: 'Public', feed: 'public' },
        { label: 'Private', feed: 'private' }
    ];

    items.forEach(item => {
        const button = document.createElement('button');
        button.className = 'timeline-sub-nav-btn';
        button.textContent = item.label;
        if (item.feed === currentFeed) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            actions.showBlogFeed(item.feed);
        });
        tabs.appendChild(button);
    });
    
    console.log('Appending search container and tabs...');
    subNavContainer.appendChild(searchContainer);
    subNavContainer.appendChild(tabs);

    // Setup search functionality
    console.log('Setting up search functionality...');
    try {
        setupBlogSearch(actions);
        console.log('Search setup completed successfully');
    } catch (error) {
        console.error('Error setting up search:', error);
    }
}

export function renderBlogComposePage(state, actions) {
    const view = document.getElementById('blog-compose-view');
    if (!view) {
        const newView = document.createElement('div');
        newView.id = 'blog-compose-view';
        newView.className = 'view-container blog-compose-view';
        document.querySelector('.container').appendChild(newView);
    }
    
    const composeView = document.getElementById('blog-compose-view');
    composeView.innerHTML = `
        <div class="blog-compose-container">
            <div class="blog-compose-header">
                <h2>Create Blog Post</h2>
                <div class="blog-compose-actions">
                    <label class="privacy-toggle">
                        <input type="checkbox" id="blog-private-checkbox">
                        <span class="privacy-label">Private Post</span>
                    </label>
                </div>
            </div>
            
            <!-- API Status Notice -->
            <div class="api-status-notice">
                <div class="api-info-content">
                    <strong>📝 Blog API Status:</strong>
                    <span class="status-working">✅ Creating posts</span>
                    <span class="status-working">✅ Reading posts</span>
                    <span class="status-working">✅ Adding comments</span>
                    <span class="status-working">✅ Likes feature</span>
                    <span class="status-working">✅ Search posts</span>
                    <span class="status-working">✅ Edit posts</span>
                    <span class="status-working">✅ Delete posts</span>
                    <span class="status-working">✅ Profile management</span>
                </div>
            </div>
            
            <!-- Post Type Tabs -->
            <div class="blog-post-type-tabs">
                <button class="blog-type-tab-btn active" data-type="text">Text</button>
                <button class="blog-type-tab-btn" data-type="link">Link Post</button>
            </div>
            
            <!-- Text Post Tab -->
            <form id="blog-compose-form" class="blog-compose-form">
                <div class="blog-post-type-content active" id="text-post-content">
                    <div class="form-group">
                        <input type="text" id="blog-title-input" name="text-title" class="blog-title-input" placeholder="Post Title (max 200 chars)" maxlength="200">
                    </div>
                    
                    <div class="form-group">
                        <div class="markdown-toolbar">
                            <button type="button" class="md-btn" data-action="bold" title="Bold">B</button>
                            <button type="button" class="md-btn" data-action="italic" title="Italic">I</button>
                            <button type="button" class="md-btn" data-action="code" title="Code">&lt;/&gt;</button>
                            <button type="button" class="md-btn" data-action="link" title="Link">🔗</button>
                            <button type="button" class="md-btn" data-action="heading" title="Heading">H1</button>
                            <button type="button" class="md-btn" data-action="list" title="List">•</button>
                            <button type="button" class="md-btn" data-action="quote" title="Quote">"</button>
                        </div>
                        <textarea id="blog-content-textarea" name="text-content" class="blog-content-textarea" placeholder="Write your blog post content in Markdown... (max 10,000 chars)" maxlength="10000"></textarea>
                        <div class="char-counter">
                            <span id="content-char-count">0</span> / 10,000 characters
                        </div>
                    </div>
                </div>
                
                <!-- Link Post Tab -->
                <div class="blog-post-type-content" id="link-post-content">
                    <div class="form-group">
                        <input type="text" id="blog-link-title-input" name="link-title" class="blog-title-input" placeholder="Link Post Title (max 200 chars)" maxlength="200">
                    </div>
                    
                    <div class="form-group">
                        <input type="url" id="blog-link-url-input" name="link-url" class="blog-url-input" placeholder="Enter URL (e.g., https://example.com)">
                        <div class="url-helper-text">Supported: YouTube, Vimeo, images, videos, audio, and web links</div>
                    </div>
                    
                    <div class="form-group">
                        <div class="markdown-toolbar">
                            <button type="button" class="md-btn" data-action="bold" title="Bold">B</button>
                            <button type="button" class="md-btn" data-action="italic" title="Italic">I</button>
                            <button type="button" class="md-btn" data-action="code" title="Code">&lt;/&gt;</button>
                            <button type="button" class="md-btn" data-action="link" title="Link">🔗</button>
                            <button type="button" class="md-btn" data-action="heading" title="Heading">H1</button>
                            <button type="button" class="md-btn" data-action="list" title="List">•</button>
                            <button type="button" class="md-btn" data-action="quote" title="Quote">"</button>
                        </div>
                        <textarea id="blog-link-description-textarea" name="link-description" class="blog-content-textarea" placeholder="Optional description or commentary about this link... (max 2,000 chars)" maxlength="2000"></textarea>
                        <div class="char-counter">
                            <span id="description-char-count">0</span> / 2,000 characters
                        </div>
                    </div>
                    
                    <div class="link-preview-container" id="link-preview-container" style="display: none;">
                        <div class="preview-header">Link Preview:</div>
                        <div id="link-preview-content"></div>
                    </div>
                </div>
                
                <div class="blog-compose-footer">
                    <div class="privacy-indicator">
                        <span id="privacy-status">Public Post</span>
                    </div>
                    <div class="compose-actions">
                        <button type="button" class="button-secondary" id="blog-cancel-btn">Cancel</button>
                        <button type="submit" class="button-primary" id="blog-submit-btn">Post</button>
                    </div>
                </div>
            </form>
        </div>
    `;

    // Get form elements
    const privateCheckbox = composeView.querySelector('#blog-private-checkbox');
    const privacyStatus = composeView.querySelector('#privacy-status');
    const cancelBtn = composeView.querySelector('#blog-cancel-btn');
    const submitBtn = composeView.querySelector('#blog-submit-btn');
    const form = composeView.querySelector('#blog-compose-form');
    
    // Tab elements
    const typeTabBtns = composeView.querySelectorAll('.blog-type-tab-btn');
    const typeContents = composeView.querySelectorAll('.blog-post-type-content');
    
    // Text post elements
    const textTitleInput = composeView.querySelector('#blog-title-input');
    const textContentTextarea = composeView.querySelector('#blog-content-textarea');
    const contentCharCount = composeView.querySelector('#content-char-count');
    
    // Link post elements
    const linkTitleInput = composeView.querySelector('#blog-link-title-input');
    const linkUrlInput = composeView.querySelector('#blog-link-url-input');
    const linkDescriptionTextarea = composeView.querySelector('#blog-link-description-textarea');
    const descriptionCharCount = composeView.querySelector('#description-char-count');
    const linkPreviewContainer = composeView.querySelector('#link-preview-container');
    const linkPreviewContent = composeView.querySelector('#link-preview-content');

    let currentPostType = 'text';

    // Character counters
    textContentTextarea.addEventListener('input', () => {
        contentCharCount.textContent = textContentTextarea.value.length;
    });

    linkDescriptionTextarea.addEventListener('input', () => {
        descriptionCharCount.textContent = linkDescriptionTextarea.value.length;
    });

    // Handle post type tabs
    typeTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeTabBtns.forEach(b => b.classList.remove('active'));
            typeContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            currentPostType = btn.dataset.type;
            
            const targetContent = composeView.querySelector(`#${currentPostType}-post-content`);
            targetContent.classList.add('active');
            
            const allInputs = form.querySelectorAll('input, textarea');
            allInputs.forEach(input => {
                input.setCustomValidity('');
            });
        });
    });

    // Handle privacy toggle
    privateCheckbox.addEventListener('change', () => {
        if (privateCheckbox.checked) {
            privacyStatus.textContent = 'Private Post';
            privacyStatus.className = 'privacy-status private';
        } else {
            privacyStatus.textContent = 'Public Post';
            privacyStatus.className = 'privacy-status public';
        }
    });

    // Handle URL preview for link posts
    let previewTimeout;
    linkUrlInput.addEventListener('input', () => {
        clearTimeout(previewTimeout);
        const url = linkUrlInput.value.trim();
        
        if (url) {
            previewTimeout = setTimeout(async () => {
                try {
                    linkPreviewContent.innerHTML = '<div class="preview-loading">Loading preview...</div>';
                    linkPreviewContainer.style.display = 'block';
                    
                    const mediaData = await blogAPI.detectMedia(url);
                    
                    if (mediaData.canEmbed && mediaData.embedHtml) {
                        linkPreviewContent.innerHTML = `
                            <div class="media-preview">
                                ${mediaData.embedHtml}
                                <div class="media-info">
                                    <strong>Type:</strong> ${mediaData.mediaType} - ${mediaData.metadata?.platform || 'Embeddable'}
                                </div>
                            </div>
                        `;
                    } else {
                        linkPreviewContent.innerHTML = `
                            <div class="url-preview">
                                <div class="url-preview-icon">${getUrlIcon(mediaData.mediaType)}</div>
                                <div class="url-preview-info">
                                    <strong>URL:</strong> ${url}<br>
                                    <strong>Type:</strong> ${mediaData.mediaType || 'link'}
                                    ${mediaData.metadata?.platform ? `<br><strong>Platform:</strong> ${mediaData.metadata.platform}` : ''}
                                </div>
                            </div>
                        `;
                    }
                } catch (error) {
                    linkPreviewContent.innerHTML = `
                        <div class="preview-error">
                            Could not load preview: ${error.message}
                        </div>
                    `;
                }
            }, 1000);
        } else {
            linkPreviewContainer.style.display = 'none';
        }
    });

    // Handle markdown toolbar for both text areas
    const setupMarkdownToolbar = (toolbar, textarea) => {
        toolbar.querySelectorAll('.md-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end);
                
                let replacement = '';
                let newCursorPos = start;

                switch (action) {
                    case 'bold':
                        replacement = `**${selectedText || 'bold text'}**`;
                        newCursorPos = selectedText ? end + 4 : start + 2;
                        break;
                    case 'italic':
                        replacement = `*${selectedText || 'italic text'}*`;
                        newCursorPos = selectedText ? end + 2 : start + 1;
                        break;
                    case 'code':
                        replacement = `\`${selectedText || 'code'}\``;
                        newCursorPos = selectedText ? end + 2 : start + 1;
                        break;
                    case 'link':
                        replacement = `[${selectedText || 'link text'}](url)`;
                        newCursorPos = selectedText ? start + selectedText.length + 3 : start + 11;
                        break;
                    case 'heading':
                        replacement = `# ${selectedText || 'heading'}`;
                        newCursorPos = selectedText ? end + 2 : start + 2;
                        break;
                    case 'list':
                        replacement = `- ${selectedText || 'list item'}`;
                        newCursorPos = selectedText ? end + 2 : start + 2;
                        break;
                    case 'quote':
                        replacement = `> ${selectedText || 'quote'}`;
                        newCursorPos = selectedText ? end + 2 : start + 2;
                        break;
                }

                textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
                textarea.focus();
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                
                // Update character counter
                textarea.dispatchEvent(new Event('input'));
            });
        });
    };

    // Setup markdown toolbars
    setupMarkdownToolbar(composeView.querySelector('#text-post-content .markdown-toolbar'), textContentTextarea);
    setupMarkdownToolbar(composeView.querySelector('#link-post-content .markdown-toolbar'), linkDescriptionTextarea);

    // Handle cancel
    cancelBtn.addEventListener('click', () => {
        actions.showBlogFeed('public');
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!blogAPI.isLoggedIn()) {
            showWarningToast('Please log in to create blog posts');
            return;
        }

        const isPrivate = privateCheckbox.checked;
        
        let title, content, url, description;
        
        if (currentPostType === 'text') {
            title = textTitleInput.value.trim();
            content = textContentTextarea.value.trim();

            if (!title) {
                showWarningToast('Please enter a title for your post');
                textTitleInput.focus();
                return;
            }
            
            if (title.length > 200) {
                showWarningToast('Title must be 200 characters or less');
                textTitleInput.focus();
                return;
            }
            
            if (!content) {
                showWarningToast('Please enter content for your post');
                textContentTextarea.focus();
                return;
            }

            if (content.length > 10000) {
                showWarningToast('Content must be 10,000 characters or less');
                textContentTextarea.focus();
                return;
            }
        } else {
            title = linkTitleInput.value.trim();
            url = linkUrlInput.value.trim();
            description = linkDescriptionTextarea.value.trim();

            if (!title) {
                showWarningToast('Please enter a title for your link post');
                linkTitleInput.focus();
                return;
            }

            if (title.length > 200) {
                showWarningToast('Title must be 200 characters or less');
                linkTitleInput.focus();
                return;
            }
            
            if (!url) {
                showWarningToast('Please enter a URL for your link post');
                linkUrlInput.focus();
                return;
            }
            
            // Basic URL validation
            try {
                new URL(url);
            } catch (urlError) {
                showWarningToast('Please enter a valid URL (e.g., https://example.com)');
                linkUrlInput.focus();
                return;
            }

            if (description && description.length > 2000) {
                showWarningToast('Description must be 2,000 characters or less');
                linkDescriptionTextarea.focus();
                return;
            }
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';

            if (currentPostType === 'text') {
                await blogAPI.createTextPost(title, content, isPrivate);
            } else {
                await blogAPI.createLinkPost(title, url, description, isPrivate);
            }
            
            showSuccessToast('Blog post created successfully!');
            blogAPI.resetPagination();
            actions.showBlogFeed(isPrivate ? 'private' : 'public');
            
        } catch (error) {
            console.error('Failed to create blog post:', error);
            showErrorToast('Failed to create blog post: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        }
    });
}

function getUrlIcon(mediaType) {
    const icons = {
        'youtube': '📺',
        'vimeo': '🎬',
        'image': '🖼️',
        'video': '🎥',
        'audio': '🎵',
        'twitter': '🐦',
        'instagram': '📷',
        'tiktok': '🎵',
        'link': '🔗'
    };
    return icons[mediaType] || '🔗';
}

// Enhanced CSS injection for all features
function injectBlogCSS() {
    if (!document.querySelector('#blog-enhanced-styles')) {
        const style = document.createElement('style');
        style.id = 'blog-enhanced-styles';
        style.textContent = `
            /* Profile picture styles */
            .profile-picture {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
                display: block;
                transition: opacity 0.3s ease;
            }

            .profile-avatar, .profile-avatar-small, .profile-avatar-large {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                overflow: hidden;
                flex-shrink: 0;
            }

            .profile-avatar {
                width: 40px;
                height: 40px;
            }

            .profile-avatar-small {
                width: 32px;
                height: 32px;
            }

            .profile-avatar-large {
                width: 80px;
                height: 80px;
            }

            .avatar-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--accent-color, #007acc);
                color: white;
                font-weight: bold;
                width: 100%;
                height: 100%;
                border-radius: 50%;
            }

            /* User info styles */
            .blog-user-info {
                background: var(--bg-secondary, #f8f9fa);
                border-radius: 8px;
                padding: 8px 12px;
                border: 1px solid var(--border-color, #dee2e6);
            }

            .user-info-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .current-user {
                font-weight: 600;
                color: var(--accent-color, #007acc);
            }

            .user-actions {
                display: flex;
                gap: 8px;
            }

            .user-action-btn {
                background: none;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                color: var(--text-muted, #6c757d);
                transition: all 0.2s ease;
            }

            .user-action-btn:hover {
                background: var(--accent-color, #007acc);
                color: white;
            }

            /* Edit indicator */
            .edit-indicator {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: rgba(255, 193, 7, 0.1);
                color: #856404;
                border: 1px solid rgba(255, 193, 7, 0.3);
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 11px;
                font-weight: 500;
                margin-top: 8px;
            }

            /* Character counter */
            .char-counter {
                text-align: right;
                font-size: 12px;
                color: var(--text-muted, #6c757d);
                margin-top: 4px;
            }

            /* Registration note */
            .registration-note {
                margin: 8px 0;
                padding: 8px;
                background: rgba(255, 193, 7, 0.1);
                border: 1px solid rgba(255, 193, 7, 0.3);
                border-radius: 4px;
                font-size: 13px;
                color: #856404;
            }

            /* Like button styles */
            .status-action.like-action {
                transition: all 0.2s ease;
            }

            .status-action.like-action:hover {
                background-color: rgba(233, 30, 99, 0.1);
                color: #e91e63;
            }

            .status-action.like-action.liked {
                color: #e91e63;
            }

            .status-action.like-action.loading {
                opacity: 0.6;
                cursor: wait;
            }

            @keyframes likeAnimation {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }

            .status-action.like-action.liked {
                animation: likeAnimation 0.3s ease;
            }

            /* Search styles */
            .blog-search-container {
                margin-bottom: 8px;
            }

            .blog-search-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                background: var(--bg-color, #ffffff);
                border: 1px solid var(--border-color, #dee2e6);
                border-radius: 8px;
                padding: 4px;
                transition: border-color 0.2s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            .blog-search-wrapper:focus-within {
                border-color: var(--accent-color, #007acc);
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
            }

            .blog-search-input {
                flex: 1;
                border: none;
                background: transparent;
                padding: 8px 12px;
                font-size: 14px;
                color: var(--text-color, #333);
                outline: none;
                min-width: 200px;
            }

            .blog-search-btn, 
            .blog-clear-search-btn {
                background: var(--accent-color, #007acc);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                cursor: pointer;
                transition: background-color 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 36px;
                font-size: 14px;
                font-weight: 500;
            }

            .blog-search-btn:hover {
                background: var(--accent-hover-color, #0056b3);
                transform: translateY(-1px);
            }

            .blog-clear-search-btn {
                background: var(--border-color, #6c757d);
                color: var(--text-color, #333);
                min-width: 32px;
            }

            .blog-clear-search-btn:hover {
                background: #dc3545;
                color: white;
            }

            .blog-search-status {
                margin-top: 8px;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                background: var(--bg-secondary, #f8f9fa);
                border: 1px solid var(--border-color, #dee2e6);
            }

            /* Search result indicators */
            .search-result-indicator {
                margin: 12px 0;
                padding: 8px 12px;
                background: linear-gradient(135deg, rgba(0, 122, 204, 0.05) 0%, rgba(0, 122, 204, 0.1) 100%);
                border: 1px solid rgba(0, 122, 204, 0.2);
                border-radius: 6px;
                border-left: 4px solid var(--accent-color, #007acc);
            }

            .search-metadata {
                display: flex;
                gap: 12px;
                font-size: 12px;
                color: var(--text-muted, #6c757d);
                align-items: center;
                flex-wrap: wrap;
            }

            .relevance-score, 
            .matched-fields, 
            .total-matches {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 2px 6px;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.7);
                font-weight: 500;
                font-size: 11px;
            }

            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .blog-user-info {
                    background: var(--bg-secondary, #2d2d2d);
                    border-color: var(--border-color, #333);
                }
                
                .blog-search-wrapper {
                    background: var(--bg-color, #1a1a1a);
                    border-color: var(--border-color, #333);
                }
                
                .blog-search-input {
                    color: var(--text-color, #fff);
                }
                
                .search-result-indicator {
                    background: linear-gradient(135deg, rgba(0, 122, 204, 0.1) 0%, rgba(0, 122, 204, 0.15) 100%);
                    border: 1px solid rgba(0, 122, 204, 0.3);
                }
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .blog-search-wrapper {
                    padding: 6px;
                    gap: 6px;
                }
                
                .blog-search-input {
                    padding: 6px 8px;
                    font-size: 13px;
                    min-width: 150px;
                }
                
                .user-info-content {
                    flex-direction: column;
                    gap: 8px;
                    align-items: flex-start;
                }

                .search-metadata {
                    flex-direction: column;
                    gap: 8px;
                    align-items: flex-start;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

function processBlogContent(content) {
    try {
        const converter = new showdown.Converter();
        return converter.makeHtml(processSpoilers(content));
    } catch (error) {
        console.warn('showdown not available, using plain text');
        return processSpoilers(content).replace(/\n/g, '<br>');
    }
}

// Updated setupBlogCardActions with enhanced edit functionality
function setupBlogCardActions(card, post) {
    const actions = card.querySelectorAll('[data-action]');
    
    actions.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            
            switch (action) {
                case 'comment':
                    await toggleBlogComments(card, post);
                    break;
                case 'like':
                    await toggleBlogLike(card, post, button);
                    break;
                case 'edit':
                    await editBlogPost(card, post);
                    break;
                case 'delete':
                    await deleteBlogPost(card, post);
                    break;
            }
        });
    });
    
    // Handle clickable images
    const clickableImage = card.querySelector('.blog-clickable-image');
    if (clickableImage) {
        clickableImage.style.cursor = 'pointer';
        clickableImage.addEventListener('click', (e) => {
            e.stopPropagation();
            const imageUrl = clickableImage.dataset.imageUrl || clickableImage.src;
            
            if (window.showImageModal) {
                window.showImageModal(imageUrl);
            } else {
                window.open(imageUrl, '_blank', 'noopener,noreferrer');
            }
        });
    }
}

// Enhanced like functionality
async function toggleBlogLike(card, post, button) {
    if (!blogAPI.isLoggedIn()) {
        showWarningToast('Please log in to like posts');
        return;
    }

    if (button.classList.contains('loading')) {
        return;
    }

    try {
        button.classList.add('loading');
        button.disabled = true;
        const originalText = button.innerHTML;
        button.innerHTML = button.innerHTML.replace(/\d+/, '...');

        const response = await blogAPI.toggleLike(post.id);
        
        if (response.success) {
            const newLikesCount = response.likesCount;
            const newUserLiked = response.userLiked;
            const action = response.action;
            
            post.likesCount = newLikesCount;
            post.userLiked = newUserLiked;
            
            button.dataset.likes = newLikesCount;
            button.dataset.userLiked = newUserLiked;
            
            if (newUserLiked) {
                button.classList.add('liked');
                button.style.color = '#e91e63';
            } else {
                button.classList.remove('liked');
                button.style.color = '';
            }
            
            button.innerHTML = `${ICONS.like || '👍'} ${newLikesCount}`;
            showSuccessToast(`Post ${action}!`);
        } else {
            throw new Error('API response indicated failure');
        }
        
    } catch (error) {
        console.error('Error toggling like:', error);
        
        if (error.message.includes('Access denied')) {
            showErrorToast('You cannot like this private post');
        } else if (error.message.includes('Post not found')) {
            showErrorToast('This post no longer exists');
        } else if (error.message.includes('Authentication') || error.message.includes('401')) {
            showErrorToast('Please log in again to like posts');
        } else {
            showErrorToast('Failed to like post: ' + error.message);
        }
        
        button.innerHTML = `${ICONS.like || '👍'} ${post.likesCount || 0}`;
        
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Enhanced edit functionality using the new API endpoint
async function editBlogPost(card, post) {
    const editModal = document.createElement('div');
    editModal.className = 'blog-edit-modal';
    
    let formContent = '';
    if (post.type === 'link') {
        formContent = `
            <div class="form-group">
                <label>Title (max 200 chars)</label>
                <input type="text" class="edit-title-input" value="${post.title}" required maxlength="200">
                <div class="char-counter">
                    <span class="title-char-count">${post.title.length}</span> / 200 characters
                </div>
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="url" class="edit-url-input" value="${post.url || ''}" required>
            </div>
            <div class="form-group">
                <label>Description (max 2,000 chars)</label>
                <textarea class="edit-content-input" maxlength="2000">${post.description || ''}</textarea>
                <div class="char-counter">
                    <span class="desc-char-count">${(post.description || '').length}</span> / 2,000 characters
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" class="edit-privacy-checkbox" ${post.isPrivate ? 'checked' : ''}>
                    Private post
                </label>
            </div>
        `;
    } else {
        formContent = `
            <div class="form-group">
                <label>Title (max 200 chars)</label>
                <input type="text" class="edit-title-input" value="${post.title}" required maxlength="200">
                <div class="char-counter">
                    <span class="title-char-count">${post.title.length}</span> / 200 characters
                </div>
            </div>
            <div class="form-group">
                <label>Content (max 10,000 chars)</label>
                <textarea class="edit-content-input" required maxlength="10000">${post.content || ''}</textarea>
                <div class="char-counter">
                    <span class="content-char-count">${(post.content || '').length}</span> / 10,000 characters
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" class="edit-privacy-checkbox" ${post.isPrivate ? 'checked' : ''}>
                    Private post
                </label>
            </div>
        `;
    }
    
    editModal.innerHTML = `
        <div class="blog-edit-overlay">
            <div class="blog-edit-content">
                <div class="blog-edit-header">
                    <h3>Edit Blog Post</h3>
                    <button class="close-edit-btn">&times;</button>
                </div>
                <form class="blog-edit-form">
                    ${formContent}
                    <div class="form-actions">
                        <button type="button" class="button-secondary cancel-edit-btn">Cancel</button>
                        <button type="submit" class="button-primary save-edit-btn">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(editModal);
    
    const titleInput = editModal.querySelector('.edit-title-input');
    const contentInput = editModal.querySelector('.edit-content-input');
    const urlInput = editModal.querySelector('.edit-url-input');
    const privacyInput = editModal.querySelector('.edit-privacy-checkbox');
    const form = editModal.querySelector('.blog-edit-form');
    const closeBtn = editModal.querySelector('.close-edit-btn');
    const cancelBtn = editModal.querySelector('.cancel-edit-btn');

    // Setup character counters
    const titleCharCount = editModal.querySelector('.title-char-count');
    const contentCharCount = editModal.querySelector('.content-char-count');
    const descCharCount = editModal.querySelector('.desc-char-count');

    if (titleCharCount) {
        titleInput.addEventListener('input', () => {
            titleCharCount.textContent = titleInput.value.length;
        });
    }

    if (contentCharCount) {
        contentInput.addEventListener('input', () => {
            contentCharCount.textContent = contentInput.value.length;
        });
    }

    if (descCharCount) {
        contentInput.addEventListener('input', () => {
            descCharCount.textContent = contentInput.value.length;
        });
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newTitle = titleInput.value.trim();
        const isPrivate = privacyInput.checked;
        
        if (!newTitle) {
            showWarningToast('Please fill in the title');
            return;
        }

        if (newTitle.length > 200) {
            showWarningToast('Title must be 200 characters or less');
            return;
        }
        
        try {
            const saveBtn = form.querySelector('.save-edit-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const updateData = {
                title: newTitle,
                isPrivate: isPrivate
            };

            if (post.type === 'link') {
                const newUrl = urlInput.value.trim();
                const newDescription = contentInput.value.trim();
                
                if (!newUrl) {
                    showWarningToast('Please provide a URL for the link post');
                    return;
                }

                if (newDescription.length > 2000) {
                    showWarningToast('Description must be 2,000 characters or less');
                    return;
                }
                
                updateData.url = newUrl;
                updateData.description = newDescription;
            } else {
                const newContent = contentInput.value.trim();
                
                if (!newContent) {
                    showWarningToast('Please fill in the content');
                    return;
                }

                if (newContent.length > 10000) {
                    showWarningToast('Content must be 10,000 characters or less');
                    return;
                }
                
                updateData.content = newContent;
            }
            
            const response = await blogAPI.editPost(post.id, updateData);
            
            if (response.success) {
                // Update the post object with response data
                Object.assign(post, response.post);
                
                // Update the card display
                const titleElement = card.querySelector('.blog-title');
                titleElement.textContent = post.title;
                
                // Update privacy badge
                const privacyBadge = card.querySelector('.privacy-badge');
                if (privacyBadge) {
                    privacyBadge.textContent = post.isPrivate ? 'Private' : 'Public';
                    privacyBadge.className = `privacy-badge ${post.isPrivate ? 'private' : 'public'}`;
                }
                
                // Update content if it's a text post
                if (post.type === 'text') {
                    const bodyElement = card.querySelector('.blog-post-body');
                    if (bodyElement) {
                        bodyElement.innerHTML = processBlogContent(post.content);
                    }
                }
                
                // Update edit indicator
                const statusContent = card.querySelector('.status-content');
                const existingEdit = statusContent.querySelector('.edit-indicator');
                if (existingEdit) {
                    existingEdit.remove();
                }
                
                if (post.editedAt) {
                    const editIndicator = document.createElement('div');
                    editIndicator.className = 'edit-indicator';
                    editIndicator.title = `Last edited ${formatTimestamp(post.editedAt)} by ${post.editedBy}`;
                    editIndicator.innerHTML = `${ICONS.edit || '✏️'} Edited`;
                    statusContent.appendChild(editIndicator);
                }
                
                showSuccessToast(`Post updated successfully! (${response.changesCount} change${response.changesCount !== 1 ? 's' : ''})`);
            } else {
                throw new Error('Update failed');
            }
            
            editModal.remove();
            
        } catch (error) {
            console.error('Error updating post:', error);
            showErrorToast('Failed to update post: ' + error.message);
        } finally {
            const saveBtn = form.querySelector('.save-edit-btn');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });
    
    // Handle close/cancel
    const closeModal = () => editModal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });
}

// Enhanced delete functionality
async function deleteBlogPost(card, post) {
    if (!confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await blogAPI.deletePost(post.id);
        
        if (response.success) {
            // Animate removal
            card.style.opacity = '0';
            card.style.transform = 'translateX(-100%)';
            setTimeout(() => {
                card.remove();
            }, 300);
            
            showSuccessToast('Post deleted successfully!');
        } else {
            throw new Error('Delete failed');
        }
        
    } catch (error) {
        console.error('Error deleting post:', error);
        
        if (error.message.includes('404') || error.message.includes('Not Found')) {
            showToast('Post not found - it may have already been deleted.');
            card.style.opacity = '0';
            card.style.transform = 'translateX(-100%)';
            setTimeout(() => {
                card.remove();
            }, 300);
        } else if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized')) {
            showErrorToast('You are not authorized to delete this post. Please log in again.');
        } else {
            showErrorToast(`Failed to delete post: ${error.message}`);
        }
    }
}

// Search functionality
function setupBlogSearch(actions) {
    console.log('Setting up blog search functionality...');
    
    const searchInput = document.getElementById('blog-search-input');
    const searchBtn = document.getElementById('blog-search-btn');
    const clearBtn = document.getElementById('blog-clear-search');
    const searchStatus = document.getElementById('blog-search-status');

    if (!searchInput || !searchBtn || !clearBtn || !searchStatus) {
        console.error('Search elements not found');
        return;
    }

    let currentSearchQuery = '';
    let isSearchActive = false;

    // Handle search execution
    const executeSearch = async () => {
        const query = searchInput.value.trim();
        
        if (!query) {
            showWarningToast('Please enter a search term');
            return;
        }

        if (query.length < 2) {
            showWarningToast('Search term must be at least 2 characters long');
            return;
        }

        if (!blogAPI.isLoggedIn()) {
            showWarningToast('Please log in to search posts');
            return;
        }

        try {
            searchBtn.disabled = true;
            searchBtn.innerHTML = '⏳';
            searchStatus.style.display = 'block';
            searchStatus.innerHTML = `<span class="searching">Searching for "${query}"...</span>`;
            
            currentSearchQuery = query;
            isSearchActive = true;
            
            const timelineDiv = document.getElementById('timeline');
            if (timelineDiv) {
                timelineDiv.innerHTML = '<div class="loading-indicator">Searching posts...</div>';
            }

            console.log('Making search API call...');
            const response = await blogAPI.searchPosts(query, 1, 20, true);
            console.log('Search response:', response);
            
            const totalResults = response.searchStats.totalResults;
            const searchTime = response.searchStats.searchTime;
            
            searchStatus.innerHTML = `
                <span class="search-results-info">
                    Found ${totalResults} result${totalResults !== 1 ? 's' : ''} 
                    for "<strong>${query}</strong>" (${searchTime}ms)
                </span>
            `;
            
            clearBtn.style.display = 'inline-flex';
            
            if (timelineDiv) {
                renderSearchResults(response, timelineDiv);
            }
            
            updateNavForSearch();
            showSuccessToast(`Found ${totalResults} matching posts`);
            
        } catch (error) {
            console.error('Search failed:', error);
            searchStatus.innerHTML = `<span class="search-error">Search failed: ${error.message}</span>`;
            showErrorToast('Search failed: ' + error.message);
            
            const timelineDiv = document.getElementById('timeline');
            if (timelineDiv) {
                timelineDiv.innerHTML = `
                    <div class="error-state">
                        <p>Search failed: ${error.message}</p>
                        <button class="button-primary" onclick="location.reload()">Refresh</button>
                    </div>
                `;
            }
        } finally {
            searchBtn.disabled = false;
            searchBtn.innerHTML = '🔍';
        }
    };

    // Handle clearing search
    const clearSearch = () => {
        console.log('Clearing search...');
        searchInput.value = '';
        currentSearchQuery = '';
        isSearchActive = false;
        
        searchStatus.style.display = 'none';
        clearBtn.style.display = 'none';
        
        resetNavFromSearch();
        actions.showBlogFeed('public');
        showSuccessToast('Search cleared');
    };

    // Event listeners
    searchBtn.addEventListener('click', executeSearch);
    clearBtn.addEventListener('click', clearSearch);
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSearch();
        }
        if (e.key === 'Escape') {
            if (isSearchActive) {
                clearSearch();
            }
        }
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length === 1) {
            searchStatus.style.display = 'block';
            searchStatus.innerHTML = '<span class="search-hint">Enter at least 2 characters to search</span>';
        } else if (query.length === 0 && searchStatus.style.display === 'block' && !isSearchActive) {
            searchStatus.style.display = 'none';
        }
    });

    console.log('Blog search setup completed successfully');
}

// Function to render search results
function renderSearchResults(response, container) {
    console.log('Rendering search results:', response);
    const posts = response.posts || [];
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No posts found matching "${response.searchTerm}"</p>
                <p>Try different keywords or check your spelling.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    posts.forEach(post => {
        const postCard = renderBlogCard(post);
        
        // Add search result indicator
        const searchMetadata = post.searchMetadata;
        if (searchMetadata) {
            const searchIndicator = document.createElement('div');
            searchIndicator.className = 'search-result-indicator';
            searchIndicator.innerHTML = `
                <div class="search-metadata">
                    <span class="relevance-score" title="Relevance Score">
                        ⭐ ${searchMetadata.relevanceScore}/10
                    </span>
                    <span class="matched-fields" title="Matched in: ${searchMetadata.matchedFields.join(', ')}">
                        📍 ${searchMetadata.matchedFields.length} field${searchMetadata.matchedFields.length !== 1 ? 's' : ''}
                    </span>
                    <span class="total-matches" title="Total Matches">
                        🎯 ${searchMetadata.totalMatches} match${searchMetadata.totalMatches !== 1 ? 'es' : ''}
                    </span>
                </div>
            `;
            
            const statusHeader = postCard.querySelector('.status-header');
            if (statusHeader && statusHeader.parentNode) {
                statusHeader.parentNode.insertBefore(searchIndicator, statusHeader.nextSibling);
            }
        }
        
        container.appendChild(postCard);
    });

    if (response.pagination && response.pagination.hasMore) {
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'search-pagination-info';
        paginationInfo.innerHTML = `
            <div class="search-pagination-notice">
                <p>Showing ${response.searchStats.resultsOnPage} of ${response.searchStats.totalResults} results</p>
                <p class="pagination-note">💡 Tip: Use more specific terms to narrow results</p>
            </div>
        `;
        container.appendChild(paginationInfo);
    }
}

// Helper functions for navigation state
function updateNavForSearch() {
    console.log('Updating nav for search mode...');
    const navTabs = document.querySelectorAll('.timeline-sub-nav-btn');
    navTabs.forEach(tab => {
        tab.disabled = true;
        tab.style.opacity = '0.5';
        tab.style.pointerEvents = 'none';
    });
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.title = 'Clear search and return to feed';
        refreshBtn.onclick = () => {
            const clearBtn = document.getElementById('blog-clear-search');
            if (clearBtn && clearBtn.style.display !== 'none') {
                clearBtn.click();
            }
        };
    }
}

function resetNavFromSearch() {
    console.log('Resetting nav from search mode...');
    const navTabs = document.querySelectorAll('.timeline-sub-nav-btn');
    navTabs.forEach(tab => {
        tab.disabled = false;
        tab.style.opacity = '';
        tab.style.pointerEvents = '';
    });
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.title = 'Refresh timeline';
        refreshBtn.onclick = null;
    }
}

// Comment functionality
async function toggleBlogComments(card, post) {
    const commentsContainer = card.querySelector('.blog-comments-container');
    const isVisible = commentsContainer.style.display === 'block';
    
    if (isVisible) {
        commentsContainer.style.maxHeight = '0px';
        commentsContainer.style.opacity = '0';
        setTimeout(() => {
            commentsContainer.style.display = 'none';
        }, 300);
    } else {
        commentsContainer.style.display = 'block';
        commentsContainer.style.maxHeight = '0px';
        commentsContainer.style.opacity = '0';
        
        await loadBlogComments(card, post);
        
        setTimeout(() => {
            commentsContainer.style.maxHeight = '600px';
            commentsContainer.style.opacity = '1';
        }, 10);
    }
}

async function loadBlogComments(card, post) {
    const commentsList = card.querySelector('.blog-comments-list');
    commentsList.innerHTML = '<div class="loading-comments">Loading comments...</div>';
    
    try {
        const comments = post.replies || [];
        commentsList.innerHTML = '';
        
        if (comments.length > 0) {
            comments.forEach(comment => {
                const commentElement = createBlogCommentElement(comment, post);
                commentsList.appendChild(commentElement);
            });
        } else {
            commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
        }
        
        setupBlogCommentForm(card, post);
        
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<div class="error-comments">Failed to load comments</div>';
    }
}

function createBlogCommentElement(comment, post) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'blog-comment';
    commentDiv.dataset.commentId = comment.id;
    
    const currentUsername = localStorage.getItem('blog_username');
    const isAuthor = currentUsername === comment.author;
    
    let commentHTML;
    try {
        const converter = new showdown.Converter();
        commentHTML = converter.makeHtml(comment.content || '');
    } catch (error) {
        commentHTML = (comment.content || '').replace(/\n/g, '<br>');
    }
    
    const commentAuthor = {
        username: comment.author,
        profilePictureUrl: comment.authorProfilePicture || null
    };
    
    commentDiv.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-container" data-username="${comment.author}">
                ${renderUserAvatar(commentAuthor, 'small')}
            </div>
            <div class="comment-meta">
                <span class="comment-author">${comment.author}</span>
                <span class="comment-timestamp">${formatTimestamp(comment.timestamp)}</span>
            </div>
        </div>
        <div class="comment-content">${commentHTML}</div>
    `;
    
    return commentDiv;
}

function setupBlogCommentForm(card, post) {
    const commentInput = card.querySelector('.blog-comment-input');
    const submitBtn = card.querySelector('.comment-submit-btn');
    const cancelBtn = card.querySelector('.comment-cancel-btn');
    
    // Handle comment submission
    submitBtn.addEventListener('click', async () => {
        const content = commentInput.value.trim();
        if (!content) {
            showWarningToast('Please enter a comment');
            return;
        }

        if (content.length > 2000) {
            showWarningToast('Comment must be 2,000 characters or less');
            return;
        }
        
        if (!blogAPI.isLoggedIn()) {
            showWarningToast('Please log in to comment');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';
            
            const response = await blogAPI.createComment(post.id, content);
            
            const newComment = response.reply;
            const totalReplies = response.totalReplies;
            
            if (!post.replies) post.replies = [];
            post.replies.push(newComment);
            
            post.replyCount = totalReplies;
            
            const commentButton = card.querySelector('[data-action="comment"]');
            commentButton.innerHTML = `${ICONS.reply || '💬'} ${totalReplies}`;
            
            const commentsList = card.querySelector('.blog-comments-list');
            const noCommentsMsg = commentsList.querySelector('.no-comments');
            if (noCommentsMsg) {
                noCommentsMsg.remove();
            }
            
            const commentElement = createBlogCommentElement(newComment, post);
            commentsList.appendChild(commentElement);
            
            commentInput.value = '';
            showSuccessToast('Comment posted successfully!');
            
        } catch (error) {
            console.error('Error posting comment:', error);
            showErrorToast('Failed to post comment: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Comment';
        }
    });
    
    // Handle cancel
    cancelBtn.addEventListener('click', () => {
        commentInput.value = '';
        const commentsContainer = card.querySelector('.blog-comments-container');
        commentsContainer.style.maxHeight = '0px';
        commentsContainer.style.opacity = '0';
        setTimeout(() => {
            commentsContainer.style.display = 'none';
        }, 300);
    });
    
    // Handle Enter key (Shift+Enter for new line)
    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }
    });
}

// Profile functions
function showCurrentUserProfile() {
    const currentUsername = localStorage.getItem('blog_username');
    if (currentUsername) {
        showUserProfile(currentUsername);
    } else {
        showWarningToast('Please log in to view your profile');
    }
}

async function showUserProfile(username) {
    const modal = document.createElement('div');
    modal.className = 'user-profile-modal';
    modal.innerHTML = `
        <div class="user-profile-overlay">
            <div class="user-profile-content">
                <div class="user-profile-header">
                    <h3>@${username}'s Profile</h3>
                    <button class="close-profile-btn">&times;</button>
                </div>
                <div class="user-profile-body">
                    <div class="loading-indicator">Loading profile...</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const profileBody = modal.querySelector('.user-profile-body');
    const closeBtn = modal.querySelector('.close-profile-btn');

    try {
        const currentUsername = localStorage.getItem('blog_username');
        const isCurrentUser = currentUsername === username;

        if (isCurrentUser) {
            // Load full profile for current user
            const response = await blogAPI.getProfile();
            if (response.success) {
                renderFullProfile(response.profile, profileBody, isCurrentUser);
            } else {
                throw new Error('Failed to load profile');
            }
        } else {
            // For other users, get posts to extract basic info
            const postsData = await blogAPI.getPublicFeed(1, 50);
            const userPosts = postsData.posts.filter(post => post.author === username);
            
            if (userPosts.length === 0) {
                profileBody.innerHTML = `
                    <div class="profile-not-found">
                        <h3>User Not Found</h3>
                        <p>No public posts found for user "${username}"</p>
                    </div>
                `;
                return;
            }

            const mockProfile = {
                username: username,
                bio: `Blog author with ${userPosts.length} public posts`,
                profilePictureUrl: userPosts[0].authorProfilePicture || null,
                stats: {
                    totalPosts: userPosts.length,
                    publicPosts: userPosts.length,
                    totalReplies: userPosts.reduce((total, post) => total + (post.replyCount || 0), 0),
                    totalLikes: userPosts.reduce((total, post) => total + (post.likesCount || 0), 0)
                },
                recentPosts: userPosts.slice(0, 5)
            };

            renderFullProfile(mockProfile, profileBody, false);
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
        profileBody.innerHTML = `
            <div class="error-state">
                <p>Failed to load profile for "${username}"</p>
                <p class="error-details">${error.message}</p>
                <button class="button-primary" onclick="this.closest('.error-state').parentElement.querySelector('.loading-indicator').innerHTML = 'Loading profile...'; showUserProfile('${username}')">Retry</button>
            </div>
        `;
    }

    // Handle close
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function renderFullProfile(profile, container, isCurrentUser) {
    container.innerHTML = `
        <div class="user-profile-container">
            <div class="profile-header">
                <div class="profile-avatar-section">
                    ${renderUserAvatar(profile, 'large')}
                    ${isCurrentUser ? `
                        <button class="edit-picture-btn" onclick="showProfilePictureEditor()">
                            ${ICONS.camera || '📷'} Change Picture
                        </button>
                    ` : ''}
                </div>
                <div class="profile-info">
                    <h2 class="profile-username">@${profile.username}</h2>
                    <p class="profile-bio">${profile.bio || 'No bio provided'}</p>
                    ${isCurrentUser && profile.isAdmin ? '<div class="admin-badge">Administrator</div>' : ''}
                    <div class="profile-stats">
                        <div class="stat">
                            <span class="stat-number">${profile.stats?.totalPosts || profile.stats?.publicPosts || 0}</span>
                            <span class="stat-label">Posts</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${profile.stats?.totalReplies || 0}</span>
                            <span class="stat-label">Replies</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${profile.stats?.totalLikesReceived || profile.stats?.totalLikes || 0}</span>
                            <span class="stat-label">Likes Received</span>
                        </div>
                        ${isCurrentUser && profile.stats?.totalLikesGiven ? `
                            <div class="stat">
                                <span class="stat-number">${profile.stats.totalLikesGiven}</span>
                                <span class="stat-label">Likes Given</span>
                            </div>
                        ` : ''}
                    </div>
                    ${isCurrentUser ? `
                        <div class="profile-actions">
                            <button class="button-secondary" onclick="showBioEditor()">Edit Bio</button>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="profile-content">
                <h3 class="posts-section-title">${isCurrentUser ? 'Recent Posts' : 'Public Posts'}</h3>
                <div class="profile-posts-list">
                    ${(profile.recentPosts || []).length > 0 ? 
                        (profile.recentPosts || []).map(post => `
                            <div class="profile-post-item">
                                <div class="post-header">
                                    <h4 class="post-title">${post.title}</h4>
                                    <span class="post-date">${formatTimestamp(post.timestamp)}</span>
                                </div>
                                <div class="post-preview">
                                    ${post.type === 'text' ? 
                                        `<p>${(post.content || '').substring(0, 150)}${post.content && post.content.length > 150 ? '...' : ''}</p>` :
                                        `<p>🔗 Link: ${post.url}</p>`
                                    }
                                </div>
                                <div class="post-stats">
                                    <span class="reply-count">${ICONS.reply || '💬'} ${post.replyCount || 0}</span>
                                    <span class="like-count">${ICONS.like || '👍'} ${post.likesCount || 0}</span>
                                    <span class="post-type">${post.type === 'link' ? 'Link' : 'Text'}</span>
                                    ${post.isPrivate ? '<span class="privacy-indicator">Private</span>' : ''}
                                </div>
                            </div>
                        `).join('')
                        : '<p class="no-posts">No recent posts to display</p>'
                    }
                </div>
            </div>
        </div>
    `;

    // Make functions globally accessible
    window.showProfilePictureEditor = showProfilePictureEditor;
    window.showBioEditor = () => showBioEditor();
}

function showBioEditor() {
    const modal = document.createElement('div');
    modal.className = 'bio-editor-modal';
    modal.innerHTML = `
        <div class="bio-editor-overlay">
            <div class="bio-editor-content">
                <div class="bio-editor-header">
                    <h3>Edit Bio</h3>
                    <button class="close-bio-editor-btn">&times;</button>
                </div>
                <div class="bio-editor-body">
                    <div class="form-group">
                        <label for="bioText">Bio (max 500 chars)</label>
                        <textarea id="bioText" class="bio-editor-textarea" 
                                  placeholder="Tell people about yourself..." 
                                  maxlength="500" rows="4"></textarea>
                        <div class="char-counter">
                            <span id="bioCharCount">0</span> / 500 characters
                        </div>
                    </div>
                </div>
                <div class="bio-editor-footer">
                    <button type="button" class="button-secondary cancel-bio-btn">Cancel</button>
                    <button type="button" class="button-primary save-bio-btn">Save Bio</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const bioTextarea = modal.querySelector('#bioText');
    const charCount = modal.querySelector('#bioCharCount');
    const saveBtn = modal.querySelector('.save-bio-btn');
    const cancelBtn = modal.querySelector('.cancel-bio-btn');
    const closeBtn = modal.querySelector('.close-bio-editor-btn');

    // Load current bio
    loadCurrentBio();

    async function loadCurrentBio() {
        try {
            const profile = await blogAPI.getProfile();
            if (profile.success && profile.profile.bio) {
                bioTextarea.value = profile.profile.bio;
                charCount.textContent = profile.profile.bio.length;
            }
        } catch (error) {
            console.error('Failed to load current bio:', error);
        }
    }

    // Character counter
    bioTextarea.addEventListener('input', () => {
        charCount.textContent = bioTextarea.value.length;
    });

    // Handle save
    saveBtn.addEventListener('click', async () => {
        const newBio = bioTextarea.value.trim();
        
        if (newBio.length > 500) {
            showErrorToast('Bio must be 500 characters or less');
            return;
        }

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            await blogAPI.updateProfile(newBio, undefined);
            showSuccessToast('Bio updated successfully!');
            modal.remove();
            
            // Refresh profile if open
            const profileModal = document.querySelector('.user-profile-modal');
            if (profileModal) {
                profileModal.remove();
                showCurrentUserProfile();
            }
            
        } catch (error) {
            console.error('Error updating bio:', error);
            showErrorToast('Failed to update bio: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Bio';
        }
    });

    // Handle close/cancel
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Initialize CSS when component loads
injectBlogCSS();

// Make blogAPI available globally for debugging
window.blogAPI = blogAPI;

export { blogAPI };
