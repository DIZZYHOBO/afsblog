// js/posts.js - Post Management Component
class PostsManager {
    constructor() {
        this.currentPostType = 'text';
    }

    // Render a list of posts
    renderPostList(postList, emptyMessage) {
        if (postList.length === 0) {
            return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
        }

        return postList.map(post => this.renderPost(post)).join('');
    }

    // Render individual post
    renderPost(post) {
        const communities = State.get('communities');
        const community = communities.find(c => c.name === post.communityName);
        const currentUser = State.getCurrentUser();
        
        return `
            <div class="post-card ${post.isPrivate ? 'private' : ''}">
                <div class="post-header">
                    <div class="post-author">
                        <div class="post-avatar">
                            ${this.renderAuthorAvatar(post.author)}
                        </div>
                        <div class="post-meta">
                            <a href="#" class="post-username">@${Utils.escapeHtml(post.author)}</a>
                            <div class="post-timestamp">${Utils.formatTimestamp(post.timestamp)}</div>
                        </div>
                    </div>
                    <div class="post-badges">
                        ${post.isPrivate ? '<span class="post-badge private">Private</span>' : ''}
                        ${post.type === 'link' ? '<span class="post-badge link">Link</span>' : ''}
                    </div>
                </div>
                
                <div class="post-body">
                    ${this.renderCommunityTag(post, community)}
                    <h3 class="post-title">${Utils.escapeHtml(post.title)}</h3>
                    ${this.renderPostContent(post)}
                </div>
                
                <div class="post-actions">
                    <button class="action-btn">
                        <span>⬆️</span>
                        <span>Vote</span>
                    </button>
                    <button class="action-btn" data-action="toggle-replies" data-params='{"postId":"${post.id}"}'>
                        <span>💬</span>
                        <span>${post.replies ? post.replies.length : 0}</span>
                    </button>
                    ${this.renderPostActions(post, currentUser)}
                </div>
                
                ${this.renderRepliesSection(post)}
            </div>
        `;
    }

    renderAuthorAvatar(authorUsername) {
        // Try to get author's profile picture from current user or cached data
        const currentUser = State.getCurrentUser();
        let profilePicture = null;
        
        if (currentUser && currentUser.username === authorUsername && currentUser.profile?.profilePicture) {
            profilePicture = currentUser.profile.profilePicture;
        }
        
        if (profilePicture) {
            return `
                <img src="${profilePicture}" 
                     alt="${authorUsername}" 
                     class="post-avatar-img"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="post-avatar-fallback" style="display: none;">${authorUsername.charAt(0).toUpperCase()}</div>
            `;
        } else {
            return `<div class="post-avatar-text">${authorUsername.charAt(0).toUpperCase()}</div>`;
        }
    }

    renderCommunityTag(post, community) {
        const currentPage = State.get('currentPage');
        
        if (post.communityName && community && currentPage !== 'community') {
            return `
                <div class="post-community">
                    <a href="#" class="post-community-link" data-action="navigate" data-params='{"to":"community","data":{"name":"${post.communityName}"}}'>
                        c/${Utils.escapeHtml(community.displayName)}
                    </a>
                </div>
            `;
        }
        return '';
    }

    renderPostContent(post) {
        let contentHtml = '';

        if (post.type === 'link' && post.url) {
            const mediaHtml = MediaRenderer.renderFromUrl(post.url);
            if (mediaHtml) {
                contentHtml += `<div style="margin: 12px 0; border-radius: 8px; overflow: hidden;">${mediaHtml}</div>`;
            } else {
                contentHtml += `
                    <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="post-link-preview">
                        <div class="link-title">🔗 ${post.url}</div>
                        <div class="link-url">${post.url}</div>
                    </a>
                `;
            }
            
            if (post.description) {
                contentHtml += `<div class="markdown-content">${this.renderMarkdown(post.description)}</div>`;
            }
        } else if (post.content) {
            contentHtml += `<div class="markdown-content">${this.renderMarkdown(post.content)}</div>`;
        }

        return contentHtml;
    }

    renderPostActions(post, currentUser) {
        if (currentUser && (currentUser.username === post.author || currentUser.profile?.isAdmin)) {
            return `
                <button class="action-btn" data-action="delete-post" data-params='{"postId":"${post.id}"}'>
                    <span>🗑️</span>
                    <span>Delete</span>
                </button>
            `;
        }
        return '';
    }

    renderRepliesSection(post) {
        return `
            <div class="replies-section" id="replies-${post.id}">
                <div class="replies-container">
                    <div class="replies-list" id="replies-list-${post.id}">
                        ${Replies.renderReplies(post.replies || [])}
                    </div>
                    
                    ${this.renderReplyForm(post.id)}
                </div>
            </div>
        `;
    }

    renderReplyForm(postId) {
        const currentUser = State.getCurrentUser();
        
        if (currentUser) {
            return `
                <div class="reply-form">
                    <textarea 
                        class="reply-input" 
                        id="reply-input-${postId}"
                        placeholder="Write a reply... (Markdown supported)"
                        maxlength="${CONFIG.MAX_REPLY_LENGTH}"></textarea>
                    <div class="reply-form-buttons">
                        <button class="reply-btn-cancel" data-action="toggle-replies" data-params='{"postId":"${postId}"}'>Cancel</button>
                        <button class="reply-btn-submit" onclick="Replies.submitReply('${postId}')">Reply</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div style="text-align: center; padding: 16px; color: var(--fg-muted); font-size: 13px;">
                    <a href="#" onclick="Modals.openAuth('signin'); return false;" style="color: var(--accent-fg);">Sign in</a> to reply
                </div>
            `;
        }
    }

    renderMarkdown(text) {
        if (!text) return '';
        
        try {
            const html = marked.parse(text);
            
            // Use DOMPurify if available for security
            if (typeof DOMPurify !== 'undefined') {
                return DOMPurify.sanitize(html);
            } else {
                console.warn('DOMPurify not available, returning unsanitized HTML');
                return html;
            }
        } catch (error) {
            console.error('Markdown rendering error:', error);
            return Utils.escapeHtml(text);
        }
    }

    // Toggle replies section
    toggleReplies(postId) {
        const repliesSection = document.getElementById(`replies-${postId}`);
        if (!repliesSection) return;
        
        const isOpen = repliesSection.classList.contains('open');
        
        if (isOpen) {
            repliesSection.classList.remove('open');
        } else {
            repliesSection.classList.add('open');
            // Focus on reply input if user is logged in
            if (State.isAuthenticated()) {
                setTimeout(() => {
                    const replyInput = document.getElementById(`reply-input-${postId}`);
                    if (replyInput) {
                        replyInput.focus();
                    }
                }, CONFIG.ANIMATION_DURATION);
            }
        }
    }

    // Create new post
    async handleCreateForm(e) {
        e.preventDefault();
        
        if (!State.isAuthenticated()) {
            Utils.showError('composeError', 'Please sign in to create a post');
            return;
        }
        
        const formData = new FormData(e.target);
        const title = formData.get('title')?.trim();
        const communityName = formData.get('community') || null;
        const isPrivate = formData.has('isPrivate');
        
        let content = '';
        let url = '';
        let description = '';
        
        if (this.currentPostType === 'text') {
            content = formData.get('content')?.trim();
            if (!content) {
                Utils.showError('composeError', 'Please provide content');
                return;
            }
        } else {
            url = formData.get('url')?.trim();
            description = formData.get('description')?.trim();
            if (!url) {
                Utils.showError('composeError', 'Please provide a URL');
                return;
            }
            
            if (!Utils.isValidUrl(url)) {
                Utils.showError('composeError', 'Please provide a valid URL');
                return;
            }
        }
        
        if (!title) {
            Utils.showError('composeError', 'Please provide a title');
            return;
        }
        
        if (title.length > CONFIG.MAX_TITLE_LENGTH) {
            Utils.showError('composeError', `Title must be ${CONFIG.MAX_TITLE_LENGTH} characters or less`);
            return;
        }

        try {
            const submitBtn = e.target.querySelector('[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';
            }
            
            const post = {
                id: Utils.generateId(CONFIG.STORAGE_KEYS.POST_PREFIX),
                type: this.currentPostType,
                title,
                author: State.getCurrentUser().username,
                timestamp: new Date().toISOString(),
                isPrivate,
                communityName,
                replies: []
            };

            if (this.currentPostType === 'text') {
                post.content = content;
            } else {
                post.url = url;
                if (description) post.description = description;
            }
            
            await blobAPI.set(post.id, post);
            StateHelpers.addPost(post);
            
            Modals.close('composeModal');
            e.target.reset();
            
            // Reset post type
            this.setPostType('text');
            
            App.updateUI();
            Utils.showSuccessMessage('Post created successfully!');
            
        } catch (error) {
            console.error('Error creating post:', error);
            Utils.showError('composeError', error.message || 'Failed to create post. Please try again.');
        } finally {
            const submitBtn = e.target.querySelector('[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post';
            }
        }
    }

    // Delete post
    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        try {
            await blobAPI.delete(postId);
            StateHelpers.removePost(postId);
            App.updateUI();
            Utils.showSuccessMessage('Post deleted successfully!');
        } catch (error) {
            console.error('Error deleting post:', error);
            Utils.showSuccessMessage(error.message || 'Failed to delete post. Please try again.');
        }
    }

    // Set post type for compose modal
    setPostType(type) {
        this.currentPostType = type;
        State.set('currentPostType', type);
        
        // Update compose modal UI
        this.updateComposeModalForPostType(type);
    }

    updateComposeModalForPostType(type) {
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
        
        if (textFields && linkFields) {
            if (type === 'text') {
                textFields.style.display = 'block';
                linkFields.style.display = 'none';
            } else {
                textFields.style.display = 'none';
                linkFields.style.display = 'block';
            }
        }
        
        // Update required fields
        const contentField = document.getElementById('postContent');
        const urlField = document.getElementById('postUrl');
        
        if (contentField && urlField) {
            if (type === 'text') {
                contentField.required = true;
                urlField.required = false;
            } else {
                contentField.required = false;
                urlField.required = true;
            }
        }
    }
}

// Create global posts instance
const Posts = new PostsManager();