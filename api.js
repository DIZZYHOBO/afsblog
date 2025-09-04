// api.js - API functions for communication with backend

const API_BASE = '/.netlify/functions/api';
const CHAT_API_BASE = '/.netlify/functions/chat-api';

// Authentication functions
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            storeSession(data.session);
            currentUser = data.user;
            return { success: true, user: data.user };
        }
        
        return { success: false, error: data.error || 'Login failed' };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Network error' };
    }
}

async function register(username, password, bio = '') {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, bio })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            storeSession(data.session);
            currentUser = data.user;
            return { success: true, user: data.user };
        }
        
        return { success: false, error: data.error || 'Registration failed' };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Network error' };
    }
}

async function logout() {
    try {
        const token = await getAuthToken();
        if (token) {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        clearSession();
        currentUser = null;
        updateUI();
    }
}

async function checkSession() {
    try {
        const session = storage.get('session');
        if (!session || !session.token) return null;
        
        const response = await fetch(`${API_BASE}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.valid) {
                currentUser = data.user;
                return data.user;
            }
        }
        
        clearSession();
        return null;
    } catch (error) {
        console.error('Session check error:', error);
        clearSession();
        return null;
    }
}

// Post functions
async function loadPosts() {
    try {
        const response = await fetch(`${API_BASE}/posts`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            posts = data.posts || [];
            return posts;
        }
        
        return [];
    } catch (error) {
        console.error('Error loading posts:', error);
        return [];
    }
}

async function createPost(postData) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const response = await fetch(`${API_BASE}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(postData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            posts.unshift(data.post);
            return { success: true, post: data.post };
        }
        
        return { success: false, error: data.error || 'Failed to create post' };
    } catch (error) {
        console.error('Error creating post:', error);
        return { success: false, error: 'Network error' };
    }
}

async function deletePost(postId) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const response = await fetch(`${API_BASE}/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            posts = posts.filter(p => p.id !== postId);
            return { success: true };
        }
        
        return { success: false, error: data.error || 'Failed to delete post' };
    } catch (error) {
        console.error('Error deleting post:', error);
        return { success: false, error: 'Network error' };
    }
}

async function toggleLike(postId) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            return { success: true, liked: data.liked };
        }
        
        return { success: false, error: data.error || 'Failed to toggle like' };
    } catch (error) {
        console.error('Error toggling like:', error);
        return { success: false, error: 'Network error' };
    }
}

// Community functions
async function loadCommunities() {
    try {
        const response = await fetch(`${API_BASE}/communities`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            communities = data.communities || [];
            return communities;
        }
        
        return [];
    } catch (error) {
        console.error('Error loading communities:', error);
        return [];
    }
}

async function createCommunity(communityData) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const response = await fetch(`${API_BASE}/communities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(communityData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            communities.push(data.community);
            return { success: true, community: data.community };
        }
        
        return { success: false, error: data.error || 'Failed to create community' };
    } catch (error) {
        console.error('Error creating community:', error);
        return { success: false, error: 'Network error' };
    }
}

async function toggleFollowStatus(communityName, shouldFollow) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const endpoint = shouldFollow ? 'follow' : 'unfollow';
        const response = await fetch(`${API_BASE}/communities/${communityName}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (shouldFollow) {
                if (!currentUser.profile.followedCommunities) {
                    currentUser.profile.followedCommunities = [];
                }
                currentUser.profile.followedCommunities.push(communityName);
            } else {
                currentUser.profile.followedCommunities = 
                    currentUser.profile.followedCommunities.filter(c => c !== communityName);
            }
            return { success: true };
        }
        
        return { success: false, error: data.error || 'Failed to update follow status' };
    } catch (error) {
        console.error('Error toggling follow status:', error);
        return { success: false, error: 'Network error' };
    }
}

async function checkIfFollowing(communityName) {
    return currentUser?.profile?.followedCommunities?.includes(communityName) || false;
}

// Media detection
async function detectMedia(url) {
    try {
        const response = await fetch(`${API_BASE}/media/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        return null;
    } catch (error) {
        console.error('Error detecting media:', error);
        return null;
    }
}

// Profile functions
async function updateProfile(profileData) {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const response = await fetch(`${API_BASE}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentUser.profile = { ...currentUser.profile, ...profileData };
            return { success: true };
        }
        
        return { success: false, error: data.error || 'Failed to update profile' };
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, error: 'Network error' };
    }
}

// Search functions
async function searchPosts(query) {
    try {
        const response = await fetch(`${API_BASE}/search/posts?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.posts || [];
        }
        
        return [];
    } catch (error) {
        console.error('Error searching posts:', error);
        return [];
    }
}

// Form handlers
async function handleAuth(event) {
    event.preventDefault();
    
    const form = event.target;
    const mode = form.dataset.mode;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const bio = document.getElementById('bio')?.value || '';
    
    // Validate inputs
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        showError('authError', usernameValidation.error);
        return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        showError('authError', passwordValidation.error);
        return;
    }
    
    try {
        const result = mode === 'signup' ? 
            await register(username, password, bio) : 
            await login(username, password);
        
        if (result.success) {
            closeModal('authModal');
            showSuccessMessage(mode === 'signup' ? 'Welcome to The Shed!' : 'Welcome back!');
            updateUI();
        } else {
            showError('authError', result.error);
        }
    } catch (error) {
        showError('authError', 'An error occurred. Please try again.');
    }
}

async function handleCreatePost(event) {
    event.preventDefault();
    
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent')?.value || '';
    const url = document.getElementById('postUrl')?.value || '';
    const community = document.getElementById('postCommunity').value;
    
    if (!title) {
        showError('composeError', 'Title is required');
        return;
    }
    
    const postData = {
        title,
        content: currentPostType === 'text' ? content : '',
        type: currentPostType,
        mediaUrl: currentPostType !== 'text' ? url : '',
        community: community || null,
        author: currentUser.username,
        timestamp: new Date().toISOString(),
        id: generateId()
    };
    
    try {
        const result = await createPost(postData);
        
        if (result.success) {
            closeModal('composeModal');
            showSuccessMessage('Post created successfully!');
            document.getElementById('composeForm').reset();
            updateUI();
        } else {
            showError('composeError', result.error);
        }
    } catch (error) {
        showError('composeError', 'Failed to create post');
    }
}

async function handleCreateCommunity(event) {
    event.preventDefault();
    
    if (!currentUser) {
        openAuthModal('signin');
        return;
    }
    
    const name = document.getElementById('communityName').value.trim().toLowerCase();
    const displayName = document.getElementById('communityDisplayName').value.trim();
    const description = document.getElementById('communityDescription').value.trim();
    
    if (!name || !displayName || !description) {
        showError('createCommunityError', 'All fields are required');
        return;
    }
    
    if (!/^[a-z0-9_]+$/.test(name)) {
        showError('createCommunityError', 'Community name can only contain lowercase letters, numbers, and underscores');
        return;
    }
    
    const communityData = {
        name,
        displayName,
        description,
        creator: currentUser.username,
        members: [currentUser.username],
        posts: [],
        createdAt: new Date().toISOString()
    };
    
    try {
        const result = await createCommunity(communityData);
        
        if (result.success) {
            closeModal('createCommunityModal');
            showSuccessMessage('Community created successfully!');
            document.getElementById('createCommunityForm').reset();
            updateUI();
        } else {
            showError('createCommunityError', result.error);
        }
    } catch (error) {
        showError('createCommunityError', 'Failed to create community');
    }
}
