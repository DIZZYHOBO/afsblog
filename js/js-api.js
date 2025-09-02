// js/api.js - API Communication Layer
class ApiError extends Error {
    constructor(message, status, details = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

class ApiClient {
    constructor(baseUrl = CONFIG.API_BASE) {
        this.baseUrl = baseUrl;
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: { ...this.headers, ...options.headers },
                ...options
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                let errorDetails = null;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                    errorDetails = errorData.details || null;
                } catch (e) {
                    // Failed to parse error response as JSON
                }
                
                throw new ApiError(errorMessage, response.status, errorDetails);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Network error', 0, error.message);
        }
    }

    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

class BlobApi {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async get(key) {
        try {
            const response = await this.api.post('/blobs', {
                method: 'GET',
                key: key
            });
            return response.data;
        } catch (error) {
            console.error('Error getting blob:', error);
            throw error;
        }
    }

    async set(key, data) {
        try {
            const response = await this.api.post('/blobs', {
                method: 'PUT',
                key: key,
                data: data
            });
            return response;
        } catch (error) {
            console.error('Error setting blob:', error);
            throw error;
        }
    }

    async delete(key) {
        try {
            const response = await this.api.post('/blobs', {
                method: 'DELETE',
                key: key
            });
            return response;
        } catch (error) {
            console.error('Error deleting blob:', error);
            throw error;
        }
    }

    async list(prefix = '') {
        try {
            const response = await this.api.post('/blobs', {
                method: 'LIST',
                prefix: prefix
            });
            return response.keys || [];
        } catch (error) {
            console.error('Error listing blobs:', error);
            throw error;
        }
    }

    async exists(key) {
        try {
            await this.get(key);
            return true;
        } catch (error) {
            if (error.status === 404) {
                return false;
            }
            throw error;
        }
    }
}

class AuthApi {
    constructor(apiClient, blobApi) {
        this.api = apiClient;
        this.blobs = blobApi;
    }

    async login(username, password) {
        try {
            // Get user data
            const userKey = `${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`;
            const userData = await this.blobs.get(userKey);
            
            if (!userData || userData.password !== password) {
                throw new ApiError('Invalid username or password', 401);
            }

            // Check if user is pending approval
            if (userData.status === 'pending') {
                throw new ApiError('Account pending admin approval', 403);
            }

            if (userData.status === 'banned') {
                throw new ApiError('Account has been banned', 403);
            }

            // Update last login - but don't fail if this fails
            try {
                userData.lastLogin = new Date().toISOString();
                await this.blobs.set(userKey, userData);
            } catch (updateError) {
                console.warn('Failed to update last login:', updateError);
                // Continue anyway - login should still work
            }

            return userData;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Login failed', 500);
        }
    }

    async register(username, password, displayName, bio) {
        try {
            // Validate username
            if (!CONFIG.VALIDATION.USERNAME.test(username)) {
                throw new ApiError('Username must be 3-20 characters, letters, numbers, and underscores only', 400);
            }

            // Check if username already exists
            const userKey = `${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`;
            const exists = await this.blobs.exists(userKey);
            
            if (exists) {
                throw new ApiError('Username already taken', 409);
            }

            // Create user data
            const userData = {
                id: Utils.generateId('user_'),
                username: username,
                password: password,
                displayName: displayName || username,
                bio: bio || CONFIG.DEFAULTS.BIO,
                avatar: CONFIG.DEFAULTS.AVATAR_FALLBACK,
                role: 'user',
                status: 'active',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };

            // Save user
            await this.blobs.set(userKey, userData);

            return userData;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Registration failed', 500);
        }
    }

    async updateProfile(username, updates) {
        try {
            const userKey = `${CONFIG.STORAGE_KEYS.USER_PREFIX}${username}`;
            const userData = await this.blobs.get(userKey);
            
            if (!userData) {
                throw new ApiError('User not found', 404);
            }

            // Update allowed fields
            const updatedUser = {
                ...userData,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await this.blobs.set(userKey, updatedUser);
            return updatedUser;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Profile update failed', 500);
        }
    }
}

class PostsApi {
    constructor(apiClient, blobApi) {
        this.api = apiClient;
        this.blobs = blobApi;
    }

    async createPost(postData) {
        try {
            const post = {
                id: Utils.generateId('post_'),
                ...postData,
                timestamp: new Date().toISOString(),
                likes: 0,
                likedBy: [],
                replyCount: 0
            };

            const postKey = `${CONFIG.STORAGE_KEYS.POST_PREFIX}${post.id}`;
            await this.blobs.set(postKey, post);
            
            return post;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to create post', 500);
        }
    }

    async updatePost(postId, updates) {
        try {
            const postKey = `${CONFIG.STORAGE_KEYS.POST_PREFIX}${postId}`;
            const post = await this.blobs.get(postKey);
            
            if (!post) {
                throw new ApiError('Post not found', 404);
            }

            const updatedPost = {
                ...post,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await this.blobs.set(postKey, updatedPost);
            return updatedPost;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to update post', 500);
        }
    }

    async deletePost(postId) {
        try {
            const postKey = `${CONFIG.STORAGE_KEYS.POST_PREFIX}${postId}`;
            await this.blobs.delete(postKey);
            
            // Also delete associated replies
            const replyKey = `replies_${postId}`;
            try {
                await this.blobs.delete(replyKey);
            } catch (e) {
                // Reply data might not exist, which is fine
            }
            
            return true;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to delete post', 500);
        }
    }

    async likePost(postId, userId, isLiking) {
        try {
            const postKey = `${CONFIG.STORAGE_KEYS.POST_PREFIX}${postId}`;
            const post = await this.blobs.get(postKey);
            
            if (!post) {
                throw new ApiError('Post not found', 404);
            }

            let likedBy = post.likedBy || [];
            
            if (isLiking) {
                if (!likedBy.includes(userId)) {
                    likedBy.push(userId);
                }
            } else {
                likedBy = likedBy.filter(id => id !== userId);
            }

            const updatedPost = {
                ...post,
                likes: likedBy.length,
                likedBy: likedBy,
                updatedAt: new Date().toISOString()
            };

            await this.blobs.set(postKey, updatedPost);
            return updatedPost;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to update like', 500);
        }
    }

    async getReplies(postId) {
        try {
            const replyKey = `replies_${postId}`;
            const replies = await this.blobs.get(replyKey);
            return replies || [];
        } catch (error) {
            if (error.status === 404) {
                return [];
            }
            throw error;
        }
    }

    async addReply(postId, replyData) {
        try {
            const replies = await this.getReplies(postId);
            
            const reply = {
                id: Utils.generateId('reply_'),
                ...replyData,
                timestamp: new Date().toISOString()
            };

            replies.push(reply);
            
            const replyKey = `replies_${postId}`;
            await this.blobs.set(replyKey, replies);
            
            // Update post reply count
            await this.updatePost(postId, { 
                replyCount: replies.length 
            });
            
            return reply;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to add reply', 500);
        }
    }
}

class CommunitiesApi {
    constructor(apiClient, blobApi) {
        this.api = apiClient;
        this.blobs = blobApi;
    }

    async createCommunity(communityData) {
        try {
            // Validate community name
            if (!CONFIG.VALIDATION.COMMUNITY_NAME.test(communityData.name)) {
                throw new ApiError('Invalid community name format', 400);
            }

            // Check if community already exists
            const communityKey = `${CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX}${communityData.name}`;
            const exists = await this.blobs.exists(communityKey);
            
            if (exists) {
                throw new ApiError('Community name already taken', 409);
            }

            const community = {
                id: Utils.generateId('community_'),
                ...communityData,
                memberCount: 0,
                postCount: 0,
                createdAt: new Date().toISOString()
            };

            await this.blobs.set(communityKey, community);
            return community;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to create community', 500);
        }
    }

    async updateCommunity(communityName, updates) {
        try {
            const communityKey = `${CONFIG.STORAGE_KEYS.COMMUNITY_PREFIX}${communityName}`;
            const community = await this.blobs.get(communityKey);
            
            if (!community) {
                throw new ApiError('Community not found', 404);
            }

            const updatedCommunity = {
                ...community,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await this.blobs.set(communityKey, updatedCommunity);
            return updatedCommunity;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to update community', 500);
        }
    }

    async setFollowing(userId, communityName, isFollowing) {
        try {
            const followKey = `${CONFIG.STORAGE_KEYS.FOLLOWED_COMMUNITIES}${userId}`;
            let follows = {};
            
            try {
                follows = await this.blobs.get(followKey) || {};
            } catch (e) {
                // Follow data doesn't exist yet, which is fine
            }

            if (isFollowing) {
                follows[communityName] = true;
            } else {
                delete follows[communityName];
            }

            await this.blobs.set(followKey, follows);
            return follows;
        } catch (error) {
            throw error instanceof ApiError ? error : new ApiError('Failed to update follow status', 500);
        }
    }

    async getFollowing(userId) {
        try {
            const followKey = `${CONFIG.STORAGE_KEYS.FOLLOWED_COMMUNITIES}${userId}`;
            return await this.blobs.get(followKey) || {};
        } catch (error) {
            if (error.status === 404) {
                return {};
            }
            throw error;
        }
    }
}

class MediaApi {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async detectMedia(url) {
        try {
            const response = await this.api.post('/media-detection', { url });
            return response;
        } catch (error) {
            // Fallback to client-side detection
            return {
                success: true,
                url: url,
                mediaType: this.detectMediaTypeClient(url),
                canEmbed: true
            };
        }
    }

    detectMediaTypeClient(url) {
        if (!url) return 'text';
        
        if (url.match(CONFIG.MEDIA_PATTERNS.YOUTUBE)) return 'video';
        if (url.match(CONFIG.MEDIA_PATTERNS.DAILYMOTION)) return 'video';
        if (url.match(CONFIG.MEDIA_PATTERNS.SUNO)) return 'audio';
        if (url.match(CONFIG.MEDIA_PATTERNS.IMAGE)) return 'image';
        if (url.match(CONFIG.MEDIA_PATTERNS.VIDEO)) return 'video';
        if (url.match(CONFIG.MEDIA_PATTERNS.AUDIO)) return 'audio';
        
        return 'website';
    }
}

// Initialize API instances
const apiClient = new ApiClient();
const blobAPI = new BlobApi(apiClient);
const authAPI = new AuthApi(apiClient, blobAPI);
const postsAPI = new PostsApi(apiClient, blobAPI);
const communitiesAPI = new CommunitiesApi(apiClient, blobAPI);
const mediaAPI = new MediaApi(apiClient);

// Export for global use
window.API = {
    client: apiClient,
    blobs: blobAPI,
    auth: authAPI,
    posts: postsAPI,
    communities: communitiesAPI,
    media: mediaAPI
};

// Backward compatibility exports
window.blobAPI = blobAPI;
window.authAPI = authAPI;
window.postsAPI = postsAPI;
window.communitiesAPI = communitiesAPI;
window.mediaAPI = mediaAPI;

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ApiError,
        ApiClient,
        BlobApi,
        AuthApi,
        PostsApi,
        CommunitiesApi,
        MediaApi,
        API: window.API
    };
}
