// js/api.js - API Communication Layer
class ApiClient {
    constructor() {
        this.baseUrl = CONFIG.API_BASE;
    }

    // Generic request handler
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new ApiError(errorData.error || 'Request failed', response.status, errorData);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Network error', 0, { originalError: error });
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, value);
            }
        });
        
        return await this.request(url.pathname + url.search);
    }

    // POST request
    async post(endpoint, data = {}) {
        return await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint, data = {}) {
        return await this.request(endpoint, {
            method: 'DELETE',
            body: JSON.stringify(data)
        });
    }
}

// Custom error class for API errors
class ApiError extends Error {
    constructor(message, status, data = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }

    isNetworkError() {
        return this.status === 0;
    }

    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    isServerError() {
        return this.status >= 500;
    }
}

// Blob API for legacy compatibility
class BlobApi {
    constructor() {
        this.apiClient = new ApiClient();
    }

    async get(key) {
        try {
            const response = await this.apiClient.get('/blobs', { key });
            return response.data;
        } catch (error) {
            if (error.status === 404) {
                return null;
            }
            console.error('Error getting blob:', error);
            return null;
        }
    }

    async set(key, value) {
        try {
            return await this.apiClient.post('/blobs', { key, value });
        } catch (error) {
            console.error('Error setting blob:', error);
            throw error;
        }
    }

    async list(prefix = '') {
        try {
            const response = await this.apiClient.get('/blobs', { list: true, prefix });
            return response.keys || [];
        } catch (error) {
            console.error('Error listing blobs:', error);
            return [];
        }
    }

    async delete(key) {
        try {
            return await this.apiClient.delete('/blobs', { key });
        } catch (error) {
            console.error('Error deleting blob:', error);
            throw error;
        }
    }
}

// Specific API methods
class BlogApi {
    constructor() {
        this.apiClient = new ApiClient();
        this.blobApi = new BlobApi(); // For backward compatibility
    }

    // Auth methods
    async login(username, password) {
        return await this.apiClient.post('/api/auth/login', { username, password });
    }

    async register(username, password, bio) {
        return await this.apiClient.post('/api/auth/register', { username, password, bio });
    }

    async logout() {
        return await this.apiClient.post('/api/auth/logout');
    }

    // Posts
    async createPost(postData) {
        return await this.apiClient.post('/api/posts/create', postData);
    }

    async getPosts(params = {}) {
        return await this.apiClient.get('/api/posts', params);
    }

    async deletePost(postId) {
        return await this.apiClient.delete(`/api/posts/${postId}`);
    }

    // Feeds
    async getPublicFeed(params = {}) {
        return await this.apiClient.get('/api/feeds/public', params);
    }

    async getPrivateFeed(params = {}) {
        return await this.apiClient.get('/api/feeds/private', params);
    }

    async getFollowingFeed(params = {}) {
        return await this.apiClient.get('/api/feeds/following', params);
    }

    // Communities
    async getCommunities(params = {}) {
        return await this.apiClient.get('/api/communities', params);
    }

    async createCommunity(communityData) {
        return await this.apiClient.post('/api/communities', communityData);
    }

    async getCommunity(name) {
        return await this.apiClient.get(`/api/communities/${name}`);
    }

    async getCommunityPosts(name, params = {}) {
        return await this.apiClient.get(`/api/communities/${name}/posts`, params);
    }

    // Following
    async followCommunity(communityName, action = 'toggle') {
        return await this.apiClient.post('/api/communities/follow', { communityName, action });
    }

    async getFollowedCommunities() {
        return await this.apiClient.get('/api/communities/following');
    }

    // Replies
    async createReply(postId, content) {
        return await this.apiClient.post('/api/replies/create', { postId, content });
    }

    async deleteReply(postId, replyId) {
        return await this.apiClient.delete('/api/replies/delete', { postId, replyId });
    }

    // Profile
    async getProfile() {
        return await this.apiClient.get('/api/profile');
    }

    async updateProfile(profileData) {
        return await this.apiClient.put('/api/profile/update', profileData);
    }

    // Admin
    async getPendingUsers() {
        return await this.apiClient.get('/api/admin/pending-users');
    }

    async approveUser(username) {
        return await this.apiClient.post('/api/admin/approve-user', { username });
    }

    async rejectUser(username) {
        return await this.apiClient.post('/api/admin/reject-user', { username });
    }

    async promoteUser(username) {
        return await this.apiClient.post('/api/admin/promote-user', { username });
    }

    async demoteUser(username) {
        return await this.apiClient.post('/api/admin/demote-user', { username });
    }

    async deleteUser(username) {
        return await this.apiClient.post('/api/admin/delete-user', { username });
    }

    async getAdminStats() {
        return await this.apiClient.get('/api/admin/stats');
    }

    // Media detection
    async detectMedia(url) {
        return await this.apiClient.post('/api/media/detect', { url });
    }

    // Search
    async searchPosts(query, params = {}) {
        return await this.apiClient.get('/api/search/posts', { query, ...params });
    }
}

// Create global API instances
const api = new BlogApi();
const blobAPI = new BlobApi(); // For backward compatibility

// Export error class
window.ApiError = ApiError;