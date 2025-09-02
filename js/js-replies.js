// js/replies.js - Reply Management Component
class RepliesManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle reply form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.matches('[data-reply-form]')) {
                this.handleReplySubmit(e);
            }
        });
    }

    // Render replies list
    renderReplies(replies) {
        if (!replies || replies.length === 0) {
            return '<div class="no-replies">No replies yet. Be the first to reply!</div>';
        }

        return replies.map(reply => this.renderReply(reply)).join('');
    }

    // Render individual reply
    renderReply(reply) {
        const currentUser = State.getCurrentUser();
        const canDelete = currentUser && (
            currentUser.username === reply.author || 
            currentUser.profile?.isAdmin
        );

        return `
            <div class="reply-item" id="reply-${reply.id}">
                <div class="reply-header">
                    <div class="reply-meta">
                        <div class="reply-avatar">
                            ${this.renderReplyAuthorAvatar(reply.author)}
                        </div>
                        <span class="reply-author">@${Utils.escapeHtml(reply.author)}</span>
                        <span class="reply-timestamp">${Utils.formatTimestamp(reply.timestamp)}</span>
                    </div>
                    ${canDelete ? `
                        <div class="reply-actions">
                            <button class="reply-delete-btn" 
                                    data-action="delete-reply" 
                                    data-params='{"postId":"${reply.postId || 'unknown'}","replyId":"${reply.id}"}'
                                    title="Delete reply">
                                🗑️
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="reply-content markdown-content">
                    ${this.renderMarkdown(reply.content)}
                </div>
            </div>
        `;
    }

    renderReplyAuthorAvatar(authorUsername) {
        const currentUser = State.getCurrentUser();
        let profilePicture = null;
        
        // Check if we have the author's profile picture
        if (currentUser && currentUser.username === authorUsername && currentUser.profile?.profilePicture) {
            profilePicture = currentUser.profile.profilePicture;
        }
        
        if (profilePicture) {
            return `
                <img src="${profilePicture}" 
                     alt="${authorUsername}" 
                     class="reply-avatar-img"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="reply-avatar-fallback" style="display: none;">${authorUsername.charAt(0).toUpperCase()}</div>
            `;
        } else {
            return `<div class="reply-avatar-text">${authorUsername.charAt(0).toUpperCase()}</div>`;
        }
    }

    renderMarkdown(text) {
        if (!text) return '';
        
        try {
            const html = marked.parse(text);
            
            // Use DOMPurify if available
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

    // Submit reply
    async submitReply(postId) {
        if (!State.isAuthenticated()) {
            Modals.openAuth('signin');
            return;
        }

        const replyInput = document.getElementById(`reply-input-${postId}`);
        if (!replyInput) return;

        const content = replyInput.value.trim();
        
        if (!content) {
            Utils.showSuccessMessage('Please write a reply before submitting.');
            return;
        }

        if (content.length > CONFIG.MAX_REPLY_LENGTH) {
            Utils.showSuccessMessage(`Reply must be ${CONFIG.MAX_REPLY_LENGTH} characters or less.`);
            return;
        }

        try {
            // Find the post in state
            const posts = State.get('posts');
            const postIndex = posts.findIndex(p => p.id === postId);
            
            if (postIndex === -1) {
                Utils.showSuccessMessage('Post not found.');
                return;
            }

            const post = posts[postIndex];
            const currentUser = State.getCurrentUser();

            // Create reply object
            const reply = {
                id: Utils.generateId('reply_'),
                author: currentUser.username,
                content: content,
                timestamp: new Date().toISOString(),
                postId: postId
            };

            // Add reply to post
            if (!post.replies) {
                post.replies = [];
            }
            post.replies.push(reply);

            // Update post in storage
            await blobAPI.set(postId, post);

            // Update state
            StateHelpers.updatePost(postId, { replies: post.replies });

            // Clear input
            replyInput.value = '';

            // Update replies display
            const repliesList = document.getElementById(`replies-list-${postId}`);
            if (repliesList) {
                repliesList.innerHTML = this.renderReplies(post.replies);
            }

            // Update reply count in button
            this.updateReplyCount(postId, post.replies.length);

            Utils.showSuccessMessage('Reply added successfully!');

        } catch (error) {
            console.error('Error submitting reply:', error);
            Utils.showSuccessMessage(error.message || 'Failed to submit reply. Please try again.');
        }
    }

    // Delete reply
    async deleteReply(postId, replyId) {
        if (!State.isAuthenticated()) {
            Utils.showSuccessMessage('Please sign in to delete replies.');
            return;
        }

        if (!confirm('Are you sure you want to delete this reply?')) {
            return;
        }

        try {
            // Find the post in state
            const posts = State.get('posts');
            const postIndex = posts.findIndex(p => p.id === postId);
            
            if (postIndex === -1) {
                Utils.showSuccessMessage('Post not found.');
                return;
            }

            const post = posts[postIndex];
            const currentUser = State.getCurrentUser();

            // Find the reply
            const replyIndex = post.replies.findIndex(r => r.id === replyId);
            if (replyIndex === -1) {
                Utils.showSuccessMessage('Reply not found.');
                return;
            }

            const reply = post.replies[replyIndex];

            // Check permissions
            if (reply.author !== currentUser.username && !currentUser.profile?.isAdmin) {
                Utils.showSuccessMessage('You can only delete your own replies.');
                return;
            }

            // Remove reply from post
            post.replies.splice(replyIndex, 1);

            // Update post in storage
            await blobAPI.set(postId, post);

            // Update state
            StateHelpers.updatePost(postId, { replies: post.replies });

            // Remove reply from DOM
            const replyElement = document.getElementById(`reply-${replyId}`);
            if (replyElement) {
                replyElement.remove();
            }

            // Update replies display if no replies left
            if (post.replies.length === 0) {
                const repliesList = document.getElementById(`replies-list-${postId}`);
                if (repliesList) {
                    repliesList.innerHTML = this.renderReplies(post.replies);
                }
            }

            // Update reply count in button
            this.updateReplyCount(postId, post.replies.length);

            Utils.showSuccessMessage('Reply deleted successfully!');

        } catch (error) {
            console.error('Error deleting reply:', error);
            Utils.showSuccessMessage(error.message || 'Failed to delete reply. Please try again.');
        }
    }

    // Update reply count in post actions
    updateReplyCount(postId, count) {
        // Find the reply button for this post and update its count
        const replyButton = document.querySelector(`[data-params*='"postId":"${postId}"'][data-action="toggle-replies"]`);
        if (replyButton) {
            const countSpan = replyButton.querySelector('span:last-child');
            if (countSpan) {
                countSpan.textContent = count;
            }
        }
    }

    // Handle reply form submission
    async handleReplySubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const postId = form.dataset.postId;
        const textArea = form.querySelector('textarea');
        
        if (!postId || !textArea) return;
        
        await this.submitReply(postId, textArea.value.trim());
    }
}

// Create global replies instance
const Replies = new RepliesManager();