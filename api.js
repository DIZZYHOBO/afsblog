// api.js - API and storage operations

// ============================================
// TOKEN MANAGEMENT SYSTEM (NEW)
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
// NETLIFY BLOBS API IMPLEMENTATION (UNCHANGED)
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

// Data loading functions
async function loadUser() {
    try {
        const userData = await blobAPI.get('current_user');
        if (userData) {
            currentUser = userData;
            const fullProfile = await blobAPI.get(`user_${userData.username}`);
            if (fullProfile) {
                currentUser.profile = fullProfile;
            }
            
            // Load user's followed communities after loading user
            await loadFollowedCommunities();
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadCommunities() {
    try {
        const communityKeys = await blobAPI.list('community_');
        const communityPromises = communityKeys.map(async (key) => {
            try {
                return await blobAPI.get(key);
            } catch (error) {
                console.error(`Error loading community ${key}:`, error);
                return null;
            }
        });
        
        const loadedCommunities = await Promise.all(communityPromises);
        communities = loadedCommunities
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Update community dropdown in compose modal
        updateCommunityDropdown();
        
    } catch (error) {
        console.error('Error loading communities:', error);
        communities = [];
    }
}

async function loadPosts() {
    try {
        if (!isLoading) {
            isLoading = true;
            updateFeedContent('<div class="loading">Loading...</div>');
        }
        
        const postKeys = await blobAPI.list('post_');
        const postPromises = postKeys.map(async (key) => {
            try {
                return await blobAPI.get(key);
            } catch (error) {
                console.error(`Error loading post ${key}:`, error);
                return null;
            }
        });
        
        const loadedPosts = await Promise.all(postPromises);
        posts = loadedPosts
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
    } catch (error) {
        console.error('Error loading posts:', error);
        posts = [];
    } finally {
        isLoading = false;
    }
}

// User's followed communities storage
let followedCommunities = new Set();

// Load user's followed communities from storage
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

// Save user's followed communities to storage
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

// Check if user is following a specific community
async function checkIfFollowing(communityName) {
    if (!currentUser) return false;
    
    // Load followed communities if not already loaded
    if (followedCommunities.size === 0) {
        await loadFollowedCommunities();
    }
    
    const isFollowing = followedCommunities.has(communityName);
    console.log(`User ${currentUser.username} is ${isFollowing ? '' : 'not '}following ${communityName}`);
    return isFollowing;
}

// Update toggleFollowStatus to refresh followed feed if currently viewing it
async function toggleFollowStatus(communityName, shouldFollow) {
    if (!currentUser) {
        throw new Error('User not authenticated');
    }

    try {
        // Update user's followed communities
        if (shouldFollow) {
            followedCommunities.add(communityName);
        } else {
            followedCommunities.delete(communityName);
        }

        // Save user's followed communities
        await saveFollowedCommunities();

        // Update community member count
        const community = communities.find(c => c.name === communityName);
        if (community) {
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
            await blobAPI.set(`community_${communityName}`, community);
            console.log(`Updated community ${communityName} members:`, community.members);

            // Update local communities array
            const localCommunityIndex = communities.findIndex(c => c.name === communityName);
            if (localCommunityIndex !== -1) {
                communities[localCommunityIndex] = community;
            }

            // Update member count display on page
            updateCommunityMemberCount(communityName, community.members.length);
        }

        // If we're currently viewing the followed feed, refresh it
        if (currentPage === 'feed' && currentFeedTab === 'followed') {
            console.log('Refreshing followed feed after follow status change');
            setTimeout(() => {
                renderFollowedFeed();
            }, 100); // Small delay to allow UI to update first
        }

        return {
            success: true,
            following: shouldFollow,
            memberCount: community?.members?.length || 1
        };

    } catch (error) {
        console.error('Error toggling follow status:', error);
        throw error;
    }
}

// ============================================
// AUTHENTICATION FUNCTIONS - UPDATED TO USE API
// ============================================

async function handleAuth(e) {
    e.preventDefault();
    const form = e.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const bio = document.getElementById('bio').value.trim();
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');

    errorDiv.innerHTML = '';
    
    if (username.length < 3) {
        showError('authError', 'Username must be at least 3 characters long');
        return;
    }
    
    if (password.length < 6) {
        showError('authError', 'Password must be at least 6 characters long');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Loading...';

        if (mode === 'signup') {
            // Call the registration API
            const response = await fetch('/.netlify/functions/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, bio: bio || `Hello! I'm ${username}` })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            closeModal('authModal');
            showSuccessMessage('Account created! Waiting for admin approval.');
            
        } else {
            // Call the login API
            const response = await fetch('/.netlify/functions/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (data.error === 'Your account is pending admin approval') {
                    showError('authError', 'Your account is still pending admin approval.');
                } else {
                    showError('authError', data.error || 'Invalid username or password');
                }
                return;
            }

            // Store the session token - THIS IS CRITICAL FOR CHAT
            if (data.token) {
                setAuthToken(data.token);
                console.log('Session token stored:', data.token);
            }

            // Store user data
            currentUser = { 
                username: data.user.username, 
                profile: data.user 
            };
            
            // Store in blob API for other purposes
            await blobAPI.set('current_user', currentUser);
            
            // Load user's followed communities after login
            await loadFollowedCommunities();
            
            // Initialize chat system after successful login
            if (typeof initializeChat === 'function') {
                await initializeChat();
            }
            
            closeModal('authModal');
            updateUI();
            showSuccessMessage('Welcome back!');

            if (data.user.isAdmin) {
                await loadAdminStats();
            }
        }
        
        form.reset();
        
    } catch (error) {
        console.error('Auth error:', error);
        showError('authError', error.message || 'Something went wrong. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
    }
}

async function logout() {
    try {
        const token = await getAuthToken();
        
        if (token) {
            // Notify the server about logout
            await fetch('/.netlify/functions/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        // Clear auth token
        clearAuthToken();
        
        // Clear user state
        currentUser = null;
        followedCommunities = new Set();
        
        // Try to delete current_user key, but don't fail if it doesn't exist
        try {
            await blobAPI.delete('current_user');
        } catch (deleteError) {
            // Ignore 404 errors - the key might not exist
            if (!deleteError.message.includes('404')) {
                console.warn('Failed to delete current_user key:', deleteError);
            }
        }
        
        // Hide admin panel
        document.getElementById('adminPanel').style.display = 'none';
        
        navigateToFeed();
        updateUI();
        showSuccessMessage('Logged out successfully!');
    } catch (error) {
        console.error('Logout error:', error);
        // Even if there's an error, still clear the user state
        clearAuthToken();
        currentUser = null;
        followedCommunities = new Set();
        document.getElementById('adminPanel').style.display = 'none';
        navigateToFeed();
        updateUI();
        showSuccessMessage('Logged out successfully!');
    }
}

// Inline login handling - UPDATED TO USE API
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

        // Call the login API
        const response = await fetch('/.netlify/functions/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            if (data.error === 'Your account is pending admin approval') {
                showInlineError('Your account is still pending admin approval.');
            } else {
                showInlineError(data.error || 'Invalid username or password');
            }
            return;
        }
        
        // Store the session token - THIS IS CRITICAL FOR CHAT
        if (data.token) {
            setAuthToken(data.token);
            console.log('Session token stored from inline login:', data.token);
        }
        
        // Store user data
        currentUser = { 
            username: data.user.username, 
            profile: data.user 
        };
        await blobAPI.set('current_user', currentUser);
        
        // Load user's followed communities after login
        await loadFollowedCommunities();
        
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

        if (data.user.isAdmin) {
            await loadAdminStats();
        }
        
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
    errorDiv.innerHTML = `<div class="inline-error-message">${escapeHtml(message)}</div>`;
}

// Community functions (UNCHANGED)
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
    const errorDiv = document.getElementById('createCommunityError');
    
    errorDiv.innerHTML = '';
    
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
        
        updateCommunityDropdown();
        
        if (currentUser.profile?.isAdmin) {
            await loadAdminStats();
        }
        
        showSuccessMessage(`Community "${displayName}" created successfully!`);
        
    } catch (error) {
        console.error('Error creating community:', error);
        showError('createCommunityError', 'Failed to create community. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Build Shed';
    }
}

// Post functions (UNCHANGED)
async function handleCreatePost(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('composeError', 'Please sign in to create a post');
        return;
    }
    
    const title = document.getElementById('postTitle').value.trim();
    const communityName = document.getElementById('postCommunity').value;
    const isPrivate = document.getElementById('isPrivate').checked;
    const submitBtn = document.getElementById('composeSubmitBtn');
    const errorDiv = document.getElementById('composeError');
    
    let content = '';
    let url = '';
    let description = '';
    
    if (currentPostType === 'text') {
        content = document.getElementById('postContent').value.trim();
        if (!content) {
            showError('composeError', 'Please provide content');
            return;
        }
    } else {
        url = document.getElementById('postUrl').value.trim();
        description = document.getElementById('postDescription').value.trim();
        if (!url) {
            showError('composeError', 'Please provide a URL');
            return;
        }
        
        try {
            new URL(url);
        } catch {
            showError('composeError', 'Please provide a valid URL');
            return;
        }
    }
    
    errorDiv.innerHTML = '';
    
    if (!title) {
        showError('composeError', 'Please provide a title');
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        
        const post = {
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: currentPostType,
            title,
            author: currentUser.username,
            timestamp: new Date().toISOString(),
            isPrivate,
            communityName: communityName || null,
            replies: []
        };

        if (currentPostType === 'text') {
            post.content = content;
        } else {
            post.url = url;
            if (description) post.description = description;
        }
        
        await blobAPI.set(post.id, post);
        posts.unshift(post);
        
        closeModal('composeModal');
        document.getElementById('composeForm').reset();
        
        // Reset post type
        currentPostType = 'text';
        setPostType('text');
        
        updateUI();
        
        if (currentUser.profile?.isAdmin) {
            await loadAdminStats();
        }
        
        showSuccessMessage('Post created successfully!');
        
    } catch (error) {
        console.error('Error creating post:', error);
        showError('composeError', 'Failed to create post. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
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
        
        if (currentUser.profile?.isAdmin) {
            await loadAdminStats();
        }
        
        showSuccessMessage('Post deleted successfully!');
    } catch (error) {
        console.error('Error deleting post:', error);
        showError('general', 'Failed to delete post. Please try again.');
    }
}

// Reply functions (UNCHANGED)
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
        // Find the post
        const post = posts.find(p => p.id === postId);
        if (!post) {
            showSuccessMessage('Post not found.');
            return;
        }

        // Create reply object
        const reply = {
            id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            author: currentUser.username,
            content: content,
            timestamp: new Date().toISOString(),
            postId: postId // Add postId reference for deletion
        };

        // Add reply to post
        if (!post.replies) {
            post.replies = [];
        }
        post.replies.push(reply);

        // Update post in storage
        await blobAPI.set(postId, post);

        // Update local posts array
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        }

        // Clear input
        replyInput.value = '';

        // Update replies display
        const repliesList = document.getElementById(`replies-list-${postId}`);
        if (repliesList) {
            repliesList.innerHTML = renderReplies(post.replies);
        }

        // Update reply count in button
        updateReplyCount(postId, post.replies.length);

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
        // Find the post
        const post = posts.find(p => p.id === postId);
        if (!post) {
            showSuccessMessage('Post not found.');
            return;
        }

        // Find the reply
        const replyIndex = post.replies.findIndex(r => r.id === replyId);
        if (replyIndex === -1) {
            showSuccessMessage('Reply not found.');
            return;
        }

        const reply = post.replies[replyIndex];

        // Check if user can delete this reply
        if (reply.author !== currentUser.username && !currentUser.profile?.isAdmin) {
            showSuccessMessage('You can only delete your own replies.');
            return;
        }

        // Remove reply from post
        post.replies.splice(replyIndex, 1);

        // Update post in storage
        await blobAPI.set(postId, post);

        // Update local posts array
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        }

        // Remove reply from DOM
        const replyElement = document.getElementById(`reply-${replyId}`);
        if (replyElement) {
            replyElement.remove();
        }

        // Update replies display if no replies left
        if (post.replies.length === 0) {
            const repliesList = document.getElementById(`replies-list-${postId}`);
            if (repliesList) {
                repliesList.innerHTML = renderReplies(post.replies);
            }
        }

        // Update reply count in button
        updateReplyCount(postId, post.replies.length);

        showSuccessMessage('Reply deleted successfully!');

    } catch (error) {
        console.error('Error deleting reply:', error);
        showSuccessMessage('Failed to delete reply. Please try again.');
    }
}

// Profile update (UNCHANGED)
async function handleUpdateProfile(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('editProfileError', 'Please sign in to update your profile');
        return;
    }
    
    const newPictureUrl = document.getElementById('editProfilePicture').value.trim();
    const newBio = document.getElementById('editProfileBio').value.trim();
    const submitBtn = document.getElementById('editProfileSubmitBtn');
    const errorDiv = document.getElementById('editProfileError');
    
    errorDiv.innerHTML = '';
    
    // Validation
    if (newBio.length > 500) {
        showError('editProfileError', 'Bio must be 500 characters or less');
        return;
    }

    // Validate URL if provided
    if (newPictureUrl && newPictureUrl.length > 0) {
        try {
            new URL(newPictureUrl);
        } catch {
            showError('editProfileError', 'Please provide a valid URL for the profile picture');
            return;
        }
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
        
        // Update user profile
        const updatedProfile = {
            ...currentUser.profile,
            profilePicture: newPictureUrl,
            bio: newBio,
            updatedAt: new Date().toISOString()
        };
        
        // Save to storage
        await blobAPI.set(`user_${currentUser.username}`, updatedProfile);
        
        // Update current user object
        currentUser.profile = updatedProfile;
        await blobAPI.set('current_user', currentUser);
        
        closeModal('editProfileModal');
        document.getElementById('editProfileForm').reset();
        
        // Re-render profile page to show changes
        renderProfilePage();
        
        showSuccessMessage('Profile updated successfully!');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showError('editProfileError', 'Failed to update profile. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Profile';
    }
}
