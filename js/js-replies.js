// js/replies.js - Replies Management Component
class RepliesManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to state changes
        State.addListener('replies', () => {
            this.refreshCurrentView();
        });
    }

    // Handle reply form submission
    async handleCreateForm(event) {
        event.preventDefault();
        
        const form = event.target;
        const postId = form.dataset.postId;
        const content = form.querySelector('textarea').value.trim();
        
        if (!content) {
            Utils.showErrorMessage('Reply cannot be empty');
            return;
        }

        try {
            const user = State.getCurrentUser();
            if (!user) {
                Utils.showErrorMessage('Must be logged in to reply');
                return;
            }

            const reply = await postsAPI.addReply(postId, {
                content: content,
                author: user.username,
                authorId: user.id,
                postId: postId
            });

            // Clear form
            form.reset();

            // Refresh replies for this post
            const replies = await postsAPI.getReplies(postId);
            State.setReplies(postId, replies);

            Utils.showSuccessMessage('Reply added!');
        } catch (error) {
            console.error('Error creating reply:', error);
            Utils.showErrorMessage('Failed to add reply');
        }
    }

    // Delete a reply
    async deleteReply(replyId, postId) {
        if (!confirm('Are you sure you want to delete this reply?')) {
            return;
        }

        try {
            // This would need to be implemented in the API
            // await postsAPI.deleteReply(replyId);
            
            // Remove from current replies
            const replies = State.getReplies(postId);
            const updatedReplies = replies.filter(reply => reply.id !== replyId);
            State.setReplies(postId, updatedReplies);
            
            Utils.showSuccessMessage('Reply deleted');
        } catch (error) {
            console.error('Error deleting reply:', error);
            Utils.showErrorMessage('Failed to delete reply');
        }
    }

    // Refresh current view
    refreshCurrentView() {
        // This component doesn't have its own view, replies are embedded in posts
        // The post component will handle refreshing replies
    }
}

// Create global Replies instance
window.Replies = new RepliesManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RepliesManager, Replies: window.Replies };
}
