// js/utils.js - Utility Functions
class Utils {
    // Show success message to user
    static showSuccessMessage(message, duration = CONFIG.SUCCESS_MESSAGE_DURATION) {
        this.showMessage(message, 'success', duration);
    }

    // Show error message to user
    static showErrorMessage(message, duration = CONFIG.SUCCESS_MESSAGE_DURATION) {
        this.showMessage(message, 'error', duration);
    }

    // Show info message to user
    static showInfoMessage(message, duration = CONFIG.SUCCESS_MESSAGE_DURATION) {
        this.showMessage(message, 'info', duration);
    }

    // Show message with specified type
    static showMessage(message, type = 'info', duration = CONFIG.SUCCESS_MESSAGE_DURATION) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.toast-message');
        existingMessages.forEach(msg => msg.remove());

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `toast-message toast-${type}`;
        messageEl.textContent = message;

        // Add to page
        document.body.appendChild(messageEl);

        // Show with animation
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 100);

        // Auto-hide
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, duration);
    }

    // Escape HTML characters
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Format date/time relative to now
    static formatRelativeTime(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const now = new Date();
        const date = new Date(timestamp);
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSeconds < 60) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else if (diffWeeks < 4) {
            return `${diffWeeks}w ago`;
        } else if (diffMonths < 12) {
            return `${diffMonths}mo ago`;
        } else {
            return `${diffYears}y ago`;
        }
    }

    // Format absolute date/time
    static formatAbsoluteTime(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    // Validate email format
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Generate random ID
    static generateId(prefix = '') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}${timestamp}_${random}`;
    }

    // Copy text to clipboard
    static async copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'absolute';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
    }

    // Smooth scroll to element
    static scrollToElement(element, offset = 0) {
        if (typeof element === 'string') {
            element = document.getElementById(element) || document.querySelector(element);
        }
        
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Truncate text with ellipsis
    static truncateText(text, length = 100, suffix = '...') {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + suffix;
    }

    // Convert string to URL-friendly slug
    static createSlug(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Parse query parameters from URL
    static parseQueryParams(url = window.location.search) {
        const params = new URLSearchParams(url);
        const result = {};
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    }

    // Update URL without page reload
    static updateUrl(path, state = null) {
        if (window.history && window.history.pushState) {
            window.history.pushState(state, '', path);
        }
    }

    // Local storage helpers with error handling
    static setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
            return false;
        }
    }

    static getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Failed to read from localStorage:', error);
            return defaultValue;
        }
    }

    static removeLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
            return false;
        }
    }

    // Debounce function
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Check if element is in viewport
    static isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // Get element offset from top of page
    static getElementOffset(element) {
        let offsetTop = 0;
        while (element) {
            offsetTop += element.offsetTop;
            element = element.offsetParent;
        }
        return offsetTop;
    }

    // Sanitize filename for safe usage
    static sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
    }

    // Check if device is mobile
    static isMobile() {
        return window.innerWidth <= 768;
    }

    // Check if device is tablet
    static isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    // Check if device is desktop
    static isDesktop() {
        return window.innerWidth > 1024;
    }

    // Format number with commas
    static formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Random color generator
    static randomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Generate random avatar color based on string
    static generateAvatarColor(str) {
        if (!str) return '#4b7688';
        
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = hash % 360;
        return `hsl(${hue}, 50%, 50%)`;
    }

    // Pluralize word based on count
    static pluralize(count, singular, plural = singular + 's') {
        return count === 1 ? singular : plural;
    }

    // Format duration in seconds to readable format
    static formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    }

    // Check if string is valid URL
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Get domain from URL
    static getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch (_) {
            return null;
        }
    }

    // Wait for specified milliseconds
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Retry function with exponential backoff
    static async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await this.sleep(delay);
                return this.retry(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    // Check if object is empty
    static isEmpty(obj) {
        return Object.keys(obj || {}).length === 0;
    }

    // Deep clone object
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
    }

    // Capitalize first letter
    static capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Convert camelCase to kebab-case
    static camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    // Convert kebab-case to camelCase
    static kebabToCamel(str) {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }

    // Get contrast color (black or white) for background color
    static getContrastColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Add CSS to document head
    static addCSS(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    }

    // Remove element safely
    static removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    // Get file extension from filename
    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }

    // Check if file is image based on extension
    static isImageFile(filename) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const extension = this.getFileExtension(filename).toLowerCase();
        return imageExtensions.includes(extension);
    }

    // Check if file is video based on extension
    static isVideoFile(filename) {
        const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv'];
        const extension = this.getFileExtension(filename).toLowerCase();
        return videoExtensions.includes(extension);
    }

    // Check if file is audio based on extension
    static isAudioFile(filename) {
        const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
        const extension = this.getFileExtension(filename).toLowerCase();
        return audioExtensions.includes(extension);
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
