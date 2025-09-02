// js/config.js - Application Configuration
const CONFIG = {
    APP_NAME: 'Blog Communities',
    VERSION: '1.0.0',
    
    // API Configuration
    API_BASE: '/.netlify/functions',
    
    // Protected admin user (cannot be demoted)
    PROTECTED_ADMIN: 'dumbass',
    
    // Pagination
    POSTS_PER_PAGE: 20,
    REPLIES_PER_PAGE: 50,
    
    // Content limits
    MAX_TITLE_LENGTH: 200,
    MAX_CONTENT_LENGTH: 10000,
    MAX_BIO_LENGTH: 500,
    MAX_REPLY_LENGTH: 2000,
    MAX_COMMUNITY_NAME_LENGTH: 25,
    MAX_COMMUNITY_DISPLAY_NAME_LENGTH: 50,
    MAX_COMMUNITY_DESCRIPTION_LENGTH: 500,
    
    // UI Settings
    ANIMATION_DURATION: 300,
    SUCCESS_MESSAGE_DURATION: 4000,
    
    // Storage keys
    STORAGE_KEYS: {
        CURRENT_USER: 'current_user',
        FOLLOWED_COMMUNITIES: 'user_follows_',
        USER_PREFIX: 'user_',
        PENDING_USER_PREFIX: 'pending_user_',
        POST_PREFIX: 'post_',
        COMMUNITY_PREFIX: 'community_'
    },
    
    // Media detection patterns
    MEDIA_PATTERNS: {
        YOUTUBE: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
        DAILYMOTION: /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9_-]+)/,
        SUNO: /suno\.com\/song\/([a-zA-Z0-9_-]+)/,
        IMAGE: /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i,
        VIDEO: /\.(mp4|webm|ogg|mov)(\?.*)?$/i,
        AUDIO: /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i
    },
    
    // Validation patterns
    VALIDATION: {
        USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
        COMMUNITY_NAME: /^[a-z0-9_]{3,25}$/,
        URL: /^https?:\/\/.+/i
    },
    
    // Default values
    DEFAULTS: {
        BIO: 'Hello! I\'m new here.',
        AVATAR_FALLBACK: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiM0Yjc2ODgiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM3LjUiIHI9IjEyLjUiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI1IDc3LjVDMjUgNjcuODM1IDMyLjgzNSA2MCA0Mi41IDYwaDE1QzY3LjE2NSA2MCA3NSA2Ny44MzUgNzUgNzcuNVY4MEgyNVY3Ny41WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4='
    }
};

// Feature flags for development
const FEATURES = {
    ENABLE_DEBUG_LOGGING: false,
    ENABLE_ADMIN_PANEL: true,
    ENABLE_COMMUNITIES: true,
    ENABLE_FOLLOWING: true,
    ENABLE_PRIVATE_POSTS: true,
    ENABLE_MARKDOWN_PREVIEW: true
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, FEATURES };
}