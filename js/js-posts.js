// js/posts.js - Posts Management Component
class PostsManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to state changes
        State.addListener('posts', () => {
            this.refreshCurrentView();
        });

        State.addListener('currentFeedTab', () => {
            this.refreshCurrentView();
        });
    }

    // Render feed posts based on current tab
    renderFeedPosts() {
        const feed = document.getElementById('feed');
        if (!feed) return;

        const posts = FeedTabs.getVisiblePosts();
        
        if (posts.length === 0) {
            this.renderEmptyState(feed);
            return;
        }

        // Sort posts by timestamp (newest first)
        const sortedPosts = [...posts].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        const postsHTML = sortedPosts.map(post => this.renderPost(post)).join('');
        
        feed.innerHTML = `
            <div class="feed-container">
                <div class="posts-list">
                    ${postsHTML}
                </div>
            </div>
        `;

        // Setup post event listeners
        this.setupPostEventListeners();
    }

    // Render empty state
    renderEmptyState(container) {
        const currentTab = FeedTabs.getCurrentTab();
        const user = State.getCurrentUser();

        let emptyMessage = '';
        let emptyActions = '';

        switch (currentTab) {
            case 'followed':
                emptyMessage = user ? 
                    "You haven't followed any communities yet." :
                    "Please log in to see followed communities.";
                emptyActions = user ? 
                    '<button class="btn btn-primary" onclick="Navigation.navigateToCommunities()">Browse Communities</button>' :
                    '<button class="btn btn-primary" onclick="Modals.switchAuthTab(\'login\'); Modals.open(\'authModal\')">Login</button>';
                break;
                
            case 'private':
                emptyMessage = user ?
                    "You haven't created any private posts yet." :
                    "Please log in to see private posts.";
                emptyActions = user ?
                    '<button class="btn btn-primary" onclick="Modals.populateComposeModal(); Modals.open(\'composeModal\')">Create Post</button>' :
                    '<button class="btn btn-primary" onclick="Modals.switchAuthTab(\'login\'); Modals.open(\'authModal\')">Login</button>';
                break;
                
            case 'general':
            default:
                emptyMessage = "No posts yet. Be the first to share something!";
                emptyActions = user ?
                    '<button class="btn btn-primary" onclick="Modals.populateComposeModal(); Modals.open(\'composeModal\')">Create Post</button>' :
                    '<button class="btn btn-primary" onclick="Modals.switchAuthTab(\'register\'); Modals.open(\'authModal\')">Join the Community</button>';
        }

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h2 class="empty-state-title">No posts here</h2>
                <p class="empty-state-message">${emptyMessage}</p>
                <div class="empty-state-actions">
                    ${emptyActions}
                </div>
            </div>
        `;
    }

    // Render a single post
    renderPost(post) {
        const user = State.getCurrentUser();
        const canEdit = user && (user.role === 'admin' || post.authorId === user.id);
        const canDelete = canEdit;
        const isLiked = user && post.likedBy && post.likedBy.includes(user.id);
        
        const community = State.getCommunities().find(c => c.name === post.community);
        const communityDisplay = community ? community.displayName : post.community;

        return `
            <article class="post" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-meta">
                        <span class="post-community">
                            <a href="#" onclick="Navigation.navigateToCommunity('${post.community}')">${communityDisplay}</a>
                        </span>
                        <span class="post-separator">•</span>
                        <span class="post-author">${post.author}</span>
                        <span class="post-separator">•</span>
                        <span class="post-timestamp" title="${new Date(post.timestamp).toLocaleString()}">
                            ${Utils.formatRelativeTime(post.timestamp)}
                        </span>
                        ${post.isPrivate ? '<span class="post-private-badge">Private</span>' : ''}
                    </div>
                    ${canEdit || canDelete ? `
                        <div class="post-actions">
                            ${canEdit ? `<button class="post-action-btn" onclick="Posts.editPost('${post.id}')" title="Edit">✏️</button>` : ''}
                            ${canDelete ? `<button class="post-action-btn" onclick="Posts.deletePost('${post.id}')" title="Delete">🗑️</button>` : ''}
                        </div>
                    ` : ''}
                </div>
                
                <div class="post-body">
                    <h3 class="post-title">${Utils.escapeHtml(post.title)}</h3>
                    <div class="post-content">
                        ${this.renderPostContent(post.content)}
                    </div>
                </div>
                
                <div class="post-footer">
                    <div class="post-stats">
                        <button class="post-stat-btn like-btn ${isLiked ? 'liked' : ''}" 
                                onclick="Posts.toggleLike('${post.id}')" 
                                ${!user ? 'disabled' : ''}>
                            <span class="stat-icon">${isLiked ? '❤️' : '🤍'}</span>
                            <span class="stat-count">${post.likes || 0}</span>
                        </button>
                        
                        <button class="post-stat-btn reply-btn" onclick="Posts.showReplies('${post.id}')">
                            <span class="stat-icon">💬</span>
                            <span class="stat-count">${post.replyCount || 0}</span>
                        </button>
                        
                        <button class="post-stat-btn share-btn" onclick="Posts.sharePost('${post.id}')">
                            <span class="stat-icon">🔗</span>
                            <span class="stat-text">Share</span>
                        </button>
                    </div>
                </div>
                
                <div class="post-replies" id="replies-${post.id}" style="display: none;">
                    <div class="replies-loading">Loading replies...</div>
                </div>
            </article>
        `;
    }

    // Render post content with markdown and media
    renderPostContent(content) {
        try {
            // First, render markdown
            let html = marked.parse(content);
            
            // Sanitize HTML
            html = DOMPurify.sanitize(html);
            
            // Process media embeds
            html = this.processMediaEmbeds(html);
            
            return html;
        } catch (error) {
            console.error('Error rendering post content:', error);
            return Utils.escapeHtml(content);
        }
    }

    // Process media embeds in content
    processMediaEmbeds(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Find all links
        const links = tempDiv.querySelectorAll('a');
        links.forEach(link => {
            const url = link.href;
            const mediaEmbed = MediaRenderer.renderFromUrl(url);
            
            if (mediaEmbed) {
                const embedContainer = document.createElement('div');
                embedContainer.className = 'media-embed';
                embedContainer.appendChild(mediaEmbed);
                
                // Insert after the link
                link.parentNode.insertBefore(embedContainer, link.nextSibling);
            }
        });
        
        return tempDiv.innerHTML;
    }

    // Setup event listeners for posts
    setupPostEventListeners() {
        // This method can be expanded to add more complex event handling
        // For now, most events are handled via onclick attributes in the HTML
    }

    // Create a new post
    async createPost(postData) {
        try {
            StateHelpers.setLoading(true);
            
            const user = State.getCurrentUser();
            if (!user) {
                throw new Error('Must be logged in to create posts');
            }

            const post = await postsAPI.createPost({
                ...postData,
                author: user.username,
                authorId: user.id,
                displayName: user.displayName || user.username
            });

            // Add to state
            State.addPost(post);
            
            Utils.showSuccessMessage('Post created successfully!');
            return post;
        } catch (error) {
            Utils.showErrorMessage(error.message || 'Failed to create post');
            throw error;
        } finally {
            StateHelpers.setLoading(false);
        }
    }

    // Toggle like on a post
    async toggleLike(postId) {
        try {
            const user = State.getCurrentUser();
            if (!user) {
                Modals.switchAuthTab('login');
                Modals.open('authModal');
                return;
            }

            const posts = State.getPosts();
            const post = posts.find(p => p.id === postId);
            if (!post) return;

            const isCurrentlyLiked = post.likedBy && post.likedBy.includes(user.id);
            const newLikeStatus = !isCurrentlyLiked;

            // Optimistic update
            const updatedPost = {
                ...post,
                likedBy: newLikeStatus 
                    ? [...(post.likedBy || []), user.id]
                    : (post.likedBy || []).filter(id => id !== user.id)
            };
            updatedPost.likes = updatedPost.likedBy.length;

            State.updatePost(postId, updatedPost);

            // Server update
            await postsAPI.likePost(postId, user.id, newLikeStatus);

        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert optimistic update on error
            this.refreshCurrentView();
        }
    }

    // Show/hide replies for a post
    async showReplies(postId) {
        const repliesContainer = document.getElementById(`replies-${postId}`);
        if (!repliesContainer) return;

        if (repliesContainer.style.display === 'none') {
            repliesContainer.style.display = 'block';
            await this.loadReplies(postId);
        } else {
            repliesContainer.style.display = 'none';
        }
    }

    // Load replies for a post
    async loadReplies(postId) {
        const repliesContainer = document.getElementById(`replies-${postId}`);
        if (!repliesContainer) return;

        try {
            repliesContainer.innerHTML = '<div class="replies-loading">Loading replies...</div>';
            
            const replies = await postsAPI.getReplies(postId);
            State.setReplies(postId, replies);
            
            this.renderReplies(postId, replies);
        } catch (error) {
            console.error('Error loading replies:', error);
            repliesContainer.innerHTML = '<div class="replies-error">Failed to load replies</div>';
        }
    }

    // Render replies for a post
    renderReplies(postId, replies) {
        const repliesContainer = document.getElementById(`replies-${postId}`);
        if (!repliesContainer) return;

        const user = State.getCurrentUser();
        
        const repliesHTML = replies.length > 0 
            ? replies.map(reply => this.renderReply(reply)).join('')
            : '<div class="no-replies">No replies yet</div>';

        const replyFormHTML = user ? `
            <div class="reply-form">
                <textarea placeholder="Write a reply..." maxlength="${CONFIG.MAX_REPLY_LENGTH}" 
                          id="reply-input-${postId}"></textarea>
                <button class="btn btn-primary btn-sm" onclick="Posts.submitReply('${postId}')">Reply</button>
            </div>
        ` : `
            <div class="reply-form-login">
                <button class="btn btn-primary btn-sm" onclick="Modals.switchAuthTab('login'); Modals.open('authModal')">
                    Login to Reply
                </button>
            </div>
        `;

        repliesContainer.innerHTML = `
            <div class="replies-content">
                <div class="replies-list">
                    ${repliesHTML}
                </div>
                ${replyFormHTML}
            </div>
        `;
    }

    // Render a single reply
    renderReply(reply) {
        const user = State.getCurrentUser();
        const canDelete = user && (user.role === 'admin' || reply.authorId === user.id);

        return `
            <div class="reply" data-reply-id="${reply.id}">
                <div class="reply-header">
                    <span class="reply-author">${reply.author}</span>
                    <span class="reply-timestamp">${Utils.formatRelativeTime(reply.timestamp)}</span>
                    ${canDelete ? `<button class="reply-delete-btn" onclick="Posts.deleteReply('${reply.id}', '${reply.postId}')">🗑️</button>` : ''}
                </div>
                <div class="reply-content">
                    ${Utils.escapeHtml(reply.content)}
                </div>
            </div>
        `;
    }

    // Submit a reply
    async submitReply(postId) {
        try {
            const user = State.getCurrentUser();
            if (!user) return;

            const input = document.getElementById(`reply-input-${postId}`);
            if (!input) return;

            const content = input.value.trim();
            if (!content) return;

            const reply = await postsAPI.addReply(postId, {
                content: content,
                author: user.username,
                authorId: user.id,
                postId: postId
            });

            // Clear input
            input.value = '';

            // Refresh replies
            await this.loadReplies(postId);

            Utils.showSuccessMessage('Reply added!');
        } catch (error) {
            console.error('Error submitting reply:', error);
            Utils.showErrorMessage('Failed to add reply');
        }
    }

    // Edit a post
    async editPost(postId) {
        const posts = State.getPosts();
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        // Open compose modal with existing data
        document.getElementById('composeTitle').value = post.title;
        document.getElementById('composeContent').value = post.content;
        document.getElementById('composeCommunity').value = post.community;
        document.getElementById('composePrivate').checked = post.isPrivate;

        // Change modal title and submit button
        document.getElementById('composeModalTitle').textContent = 'Edit Post';
        
        // Set up edit mode
        const form = document.getElementById('composeForm');
        form.dataset.editMode = 'true';
        form.dataset.editPostId = postId;

        Modals.open('composeModal');
    }

    // Delete a post
    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }

        try {
            StateHelpers.setLoading(true);
            
            await postsAPI.deletePost(postId);
            State.removePost(postId);
            
            Utils.showSuccessMessage('Post deleted successfully');
        } catch (error) {
            console.error('Error deleting post:', error);
            Utils.showErrorMessage('Failed to delete post');
        } finally {
            StateHelpers.setLoading(false);
        }
    }

    // Share a post
    async sharePost(postId) {
        const url = `${window.location.origin}/p/${postId}`;
        
        try {
            await Utils.copyToClipboard(url);
            Utils.showSuccessMessage('Post link copied to clipboard!');
        } catch (error) {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            Utils.showSuccessMessage('Post link copied!');
        }
    }

    // Refresh current view
    refreshCurrentView() {
        const currentView = State.get('currentView');
        if (currentView === 'feed') {
            this.renderFeedPosts();
        }
    }

    // Handle form submission
    async handleCreateForm(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        const isEditMode = form.dataset.editMode === 'true';
        const editPostId = form.dataset.editPostId;
        
        try {
            const postData = {
                title: formData.get('title'),
                content: formData.get('content'),
                community: formData.get('community'),
                isPrivate: formData.get('isPrivate') === 'on'
            };

            if (isEditMode && editPostId) {
                await this.updatePost(editPostId, postData);
            } else {
                await this.createPost(postData);
            }

            // Reset form
            form.reset();
            form.removeAttribute('data-edit-mode');
            form.removeAttribute('data-edit-post-id');
            
            // Reset modal title
            document.getElementById('composeModalTitle').textContent = 'Create Post';
            
            Modals.close('composeModal');
        } catch (error) {
            // Error already handled in createPost/updatePost
        }
    }

    // Update an existing post
    async updatePost(postId, updates) {
        try {
            StateHelpers.setLoading(true);
            
            const updatedPost = await postsAPI.updatePost(postId, updates);
            State.updatePost(postId, updatedPost);
            
            Utils.showSuccessMessage('Post updated successfully!');
            return updatedPost;
        } catch (error) {
            Utils.showErrorMessage(error.message || 'Failed to update post');
            throw error;
        } finally {
            StateHelpers.setLoading(false);
        }
    }
}

// Create global Posts instance
window.Posts = new PostsManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PostsManager, Posts: window.Posts };
}
