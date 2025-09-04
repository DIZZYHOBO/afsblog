// utils.js - Utility functions

// HTML escaping to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format timestamp to relative time
function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce function for search/input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Get auth token from localStorage
async function getAuthToken() {
    try {
        const session = localStorage.getItem('session');
        if (!session) return null;
        
        const sessionData = JSON.parse(session);
        return sessionData.token || null;
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

// Store session
function storeSession(sessionData) {
    try {
        localStorage.setItem('session', JSON.stringify(sessionData));
    } catch (error) {
        console.error('Error storing session:', error);
    }
}

// Clear session
function clearSession() {
    try {
        localStorage.removeItem('session');
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

// Check if user is logged in
function isLoggedIn() {
    return currentUser !== null;
}

// Validate username
function validateUsername(username) {
    if (!username) return { valid: false, error: 'Username is required' };
    if (username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
    if (username.length > 20) return { valid: false, error: 'Username must be less than 20 characters' };
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }
    return { valid: true };
}

// Validate password
function validatePassword(password) {
    if (!password) return { valid: false, error: 'Password is required' };
    if (password.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
    return { valid: true };
}

// Format number with commas
function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Deep clone object
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Sort posts by timestamp
function sortPostsByDate(posts, order = 'desc') {
    return posts.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return order === 'desc' ? dateB - dateA : dateA - dateB;
    });
}

// Filter posts by community
function filterPostsByCommunity(posts, communityName) {
    if (!communityName) return posts;
    return posts.filter(post => post.community === communityName);
}

// Search posts
function searchPosts(posts, query) {
    if (!query) return posts;
    
    const searchTerm = query.toLowerCase();
    return posts.filter(post => {
        const titleMatch = post.title?.toLowerCase().includes(searchTerm);
        const contentMatch = post.content?.toLowerCase().includes(searchTerm);
        const authorMatch = post.author?.toLowerCase().includes(searchTerm);
        return titleMatch || contentMatch || authorMatch;
    });
}

// Paginate array
function paginate(array, pageSize, pageNumber) {
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return {
        items: array.slice(startIndex, endIndex),
        totalPages: Math.ceil(array.length / pageSize),
        currentPage: pageNumber,
        hasNext: endIndex < array.length,
        hasPrev: pageNumber > 1
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Get file extension
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

// Check if file is image
function isImageFile(filename) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const ext = getFileExtension(filename).toLowerCase();
    return imageExtensions.includes(ext);
}

// Check if file is video
function isVideoFile(filename) {
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
    const ext = getFileExtension(filename).toLowerCase();
    return videoExtensions.includes(ext);
}

// Local storage wrapper with error handling
const storage = {
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error reading ${key} from storage:`, error);
            return null;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing ${key} to storage:`, error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing ${key} from storage:`, error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    }
};

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        formatTimeAgo,
        generateId,
        debounce,
        throttle,
        isValidUrl,
        getAuthToken,
        storeSession,
        clearSession,
        isLoggedIn,
        validateUsername,
        validatePassword,
        formatNumber,
        deepClone,
        sortPostsByDate,
        filterPostsByCommunity,
        searchPosts,
        paginate,
        getFileExtension,
        isImageFile,
        isVideoFile,
        storage
    };
}
