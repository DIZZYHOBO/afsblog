// api.js - Frontend API and storage operations (NO IMPORT STATEMENTS)

// ============================================
// TOKEN MANAGEMENT SYSTEM
// ============================================

// Store the session token in a variable
let currentSessionToken = null;

// Get auth token function
async function getAuthToken() {
    // First, check if we have a token in memory
    if (currentSessionToken) {
        return currentSessionToken;
    }
    
    // Try to get from localStorage
    const storedToken = localStorage.getItem('sessionToken');
    if (storedToken) {
        currentSessionToken = storedToken;
        return storedToken;
    }
    
    // If no token found, user needs to authenticate
    console.warn('No authentication token found');
    return null;
}

// Set auth token function
function setAuthToken(token) {
    currentSessionToken = token;
    // Store in localStorage for persistence
    localStorage.setItem('sessionToken', token);
    console.log('Token stored in localStorage');
}

// Clear auth token function
function clearAuthToken() {
    currentSessionToken = null;
    localStorage.removeItem('sessionToken');
    console.log('Token cleared from localStorage');
}

// ============================================
// NETLIFY BLOBS API IMPLEMENTATION
// ============================================

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

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

async function handleAuth(e) {
    e.preventDefault();
    
    const form = e.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const bio = document.getElementById('bio')?.value || '';
    const submitBtn = document.getElementById('authSubmitBtn');
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'signup' ? 'Creating account...' : 'Signing in...';
        
        const endpoint = mode === 'signup' ? 
            '/.netlify/functions/api/auth/register' : 
            '/.netlify/functions/api/auth/login';
        
        const body = mode === 'signup' ? 
            { username, password, bio } : 
            { username, password };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Authentication failed');
        }
        
        // Store the token if login was successful
        if (data.token) {
            setAuthToken(data.token);
        }
        
        // Store user data
        currentUser = { username: data.user.username, profile: data.user };
        await blobAPI.set('current_user', currentUser);
        
        // Close modal and update UI
        closeModal('authModal');
        updateUI();
        showSuccessMessage(mode === 'signup' ? 'Account created successfully!' : 'Welcome back!');
        
        // Reload data
        await loadCommunities();
        await loadPosts();
        updateUI();
        
    } catch (error) {
        console.error('Auth error:', error);
        showError('authError', error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
    }
}

async function logout() {
    try {
        const token = await getAuthToken();
        if (token) {
            await fetch('/.netlify/functions/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        clearAuthToken();
        currentUser = null;
        followedCommunities = new Set();
        await blobAPI.delete('current_user');
        
        navigateToFeed();
        updateUI();
        showSuccessMessage('Logged out successfully!');
    } catch (error) {
        console.error('Logout error:', error);
        // Clear local state even if API call fails
        clearAuthToken();
        currentUser = null;
        followedCommunities = new Set();
        navigateToFeed();
        updateUI();
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

        const response = await fetch('/.netlify/functions/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            showInlineError(data.error || 'Invalid username or password');
            return;
        }
        
        // Store the session token
        if (data.token) {
            setAuthToken(data.token);
            console.log('Session token stored from inline login');
        }
        
        // Store user data
        currentUser = { 
            username: data.user.username, 
            profile: data.user 
        };
        await blobAPI.set('current_user', currentUser);
        
        // Load user's followed communities after login
        if (typeof loadFollowedCommunities === 'function') {
            await loadFollowedCommunities();
        }
        
        // Initialize chat system after successful login
        if (typeof initializeChat === 'function') {
            await initializeChat();
        }
        
        // Clear the form
        document.getElementById('inlineLoginFormElement').reset();
        
        // Close menu and update UI
        toggleMenu();
        updateUI();
        showSuccessMessage('Welcome back!');
        
        // Reload data
        await loadCommunities();
        await loadPosts();
        updateUI();
        
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
    if (errorDiv) {
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = `<div class="inline-error-message">${escapeHtml(message)}</div>`;
    }
}

// ============================================
// POST AND COMMUNITY FUNCTIONS
// ============================================

async function handleCreatePost(e) {
    e.preventDefault();
    
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const url = document.getElementById('postUrl')?.value.trim() || '';
    const communityName = document.getElementById('postCommunity').value;
    const isPrivate = document.getElementById('postPrivate').checked;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (!title) {
        showError('composeError', 'Title is required');
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        
        const post = {
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title,
            content: currentPostType === 'text' ? content : '',
            url: currentPostType === 'link' ? url : '',
            type: currentPostType,
            author: currentUser.username,
            communityName,
            isPrivate,
            timestamp: new Date().toISOString(),
            likes: [],
            replies: []
        };
        
        await blobAPI.set(post.id, post);
        posts.unshift(post);
        
        closeModal('composeModal');
        document.getElementById('composeForm').reset();
        updateUI();
        showSuccessMessage('Post created successfully!');
        
    } catch (error) {
        console.error('Error creating post:', error);
        showError('composeError', 'Failed to create post. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
}

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
        
        if (typeof updateCommunityDropdown === 'function') {
            updateCommunityDropdown();
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

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }
    
    try {
        await blobAPI.delete(postId);
        posts = posts.filter(p => p.id !== postId);
        updateUI();
        showSuccessMessage('Post deleted successfully!');
    } catch (error) {
        console.error('Error deleting post:', error);
        showSuccessMessage('Failed to delete post. Please try again.');
    }
}

// ============================================
// REPLY FUNCTIONS
// ============================================

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
        const post = posts.find(p => p.id === postId);
        if (!post) {
            showSuccessMessage('Post not found.');
            return;
        }

        const reply = {
            id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            author: currentUser.username,
            content: content,
            timestamp: new Date().toISOString(),
            postId: postId
        };

        if (!post.replies) {
            post.replies = [];
        }
        post.replies.push(reply);

        await blobAPI.set(postId, post);

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        }

        replyInput.value = '';

        const repliesList = document.getElementById(`replies-list-${postId}`);
        if (repliesList && typeof renderReplies === 'function') {
            repliesList.innerHTML = renderReplies(post.replies);
        }

        if (typeof updateReplyCount === 'function') {
            updateReplyCount(postId, post.replies.length);
        }

        showSuccessMessage('Reply added successfully!');

    } catch (error) {
        console.error('Error submitting reply:', error);
        showSuccessMessage('Failed to submit reply. Please try again.');
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
        const post = posts.find(p => p.id === postId);
        if (!post || !post.replies) {
            showSuccessMessage('Post or reply not found.');
            return;
        }

        const replyIndex = post.replies.findIndex(r => r.id === replyId);
        if (replyIndex === -1) {
            showSuccessMessage('Reply not found.');
            return;
        }

        const reply = post.replies[replyIndex];
        
        if (reply.author !== currentUser.username && !currentUser.profile?.isAdmin) {
            showSuccessMessage('You can only delete your own replies.');
            return;
        }

        post.replies.splice(replyIndex, 1);
        await blobAPI.set(postId, post);

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        }

        const repliesList = document.getElementById(`replies-list-${postId}`);
        if (repliesList && typeof renderReplies === 'function') {
            repliesList.innerHTML = renderReplies(post.replies);
        }

        if (typeof updateReplyCount === 'function') {
            updateReplyCount(postId, post.replies.length);
        }

        showSuccessMessage('Reply deleted successfully!');

    } catch (error) {
        console.error('Error deleting reply:', error);
        showSuccessMessage('Failed to delete reply. Please try again.');
    }
}

// ============================================
// LIKE FUNCTIONS
// ============================================

async function toggleLike(postId) {
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }

    try {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        if (!post.likes) {
            post.likes = [];
        }

        const likeIndex = post.likes.indexOf(currentUser.username);
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
        } else {
            post.likes.push(currentUser.username);
        }

        await blobAPI.set(postId, post);

        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const likeButton = postElement.querySelector('.action-btn');
            if (likeButton) {
                likeButton.classList.toggle('liked');
                const likeCount = likeButton.querySelector('span:last-child');
                if (likeCount) {
                    likeCount.textContent = post.likes.length;
                }
                const likeIcon = likeButton.querySelector('span:first-child');
                if (likeIcon) {
                    likeIcon.textContent = post.likes.includes(currentUser.username) ? '❤️' : '🤍';
                }
            }
        }

    } catch (error) {
        console.error('Error toggling like:', error);
        showSuccessMessage('Failed to update like. Please try again.');
    }
}

// ============================================
// FOLLOW FUNCTIONS
// ============================================

let followedCommunities = new Set();

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

async function checkIfFollowing(communityName) {
    if (!currentUser) return false;
    
    if (followedCommunities.size === 0) {
        await loadFollowedCommunities();
    }
    
    const isFollowing = followedCommunities.has(communityName);
    console.log(`User ${currentUser.username} is ${isFollowing ? '' : 'NOT '}following ${communityName}`);
    return isFollowing;
}

async function toggleFollowStatus(communityName, shouldFollow) {
    if (!currentUser) {
        return { success: false, error: 'Not logged in' };
    }

    try {
        if (shouldFollow) {
            followedCommunities.add(communityName);
        } else {
            followedCommunities.delete(communityName);
        }

        await saveFollowedCommunities();
        
        return { success: true };
    } catch (error) {
        console.error('Error toggling follow status:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// CHAT API
// ============================================

const chatAPI = {
    async getUserRooms() {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch('/.netlify/functions/chat-api/rooms', {
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting user rooms:', error);
            throw error;
        }
    },
    
    async getPublicRooms() {
        try {
            const response = await fetch('/.netlify/functions/chat-api/rooms/public');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting public rooms:', error);
            throw error;
        }
    },
    
    async joinRoom(roomId) {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/join`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    },
    
    async leaveRoom(roomId) {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/leave`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error leaving room:', error);
            throw error;
        }
    },
    
    async getRoomMessages(roomId, limit = 50, before = null) {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const params = new URLSearchParams({ limit: limit.toString() });
            if (before) params.append('before', before);
            
            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages?${params}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    },
    
    async sendMessage(roomId, content) {
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/.netlify/functions/chat-api/rooms/${roomId}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
};
