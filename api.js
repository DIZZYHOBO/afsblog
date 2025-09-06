// api.js - COMPLETELY REWRITTEN SECURE FRONTEND API CLIENT
// Secure API client with modern authentication

// Security configuration
const AUTH_CONFIG = {
  ACCESS_TOKEN_KEY: 'shed_access_token',
  REFRESH_TOKEN_KEY: 'shed_refresh_token',
  USER_DATA_KEY: 'shed_user_data',
  SESSION_KEY: 'shed_session_data',
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // Refresh when < 5 minutes left
  MAX_RETRY_ATTEMPTS: 3,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  CSRF_TOKEN_KEY: 'shed_csrf_token'
};

// Secure storage wrapper
const secureStorage = {
  set(key, value) {
    try {
      const data = {
        value: value,
        timestamp: Date.now(),
        checksum: this.generateChecksum(value)
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Storage error:', error);
    }
  },
  
  get(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const data = JSON.parse(item);
      
      // Verify checksum
      if (this.generateChecksum(data.value) !== data.checksum) {
        console.warn('Storage integrity check failed:', key);
        this.remove(key);
        return null;
      }
      
      return data.value;
    } catch (error) {
      console.error('Storage retrieval error:', error);
      this.remove(key);
      return null;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removal error:', error);
    }
  },
  
  clear() {
    try {
      Object.values(AUTH_CONFIG).forEach(key => {
        if (typeof key === 'string') {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  },
  
  generateChecksum(value) {
    // Simple checksum for integrity verification
    let hash = 0;
    const str = JSON.stringify(value);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
};

// Token management
const tokenManager = {
  getAccessToken() {
    return secureStorage.get(AUTH_CONFIG.ACCESS_TOKEN_KEY);
  },
  
  getRefreshToken() {
    return secureStorage.get(AUTH_CONFIG.REFRESH_TOKEN_KEY);
  },
  
  setTokens(accessToken, refreshToken) {
    secureStorage.set(AUTH_CONFIG.ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      secureStorage.set(AUTH_CONFIG.REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  
  clearTokens() {
    secureStorage.remove(AUTH_CONFIG.ACCESS_TOKEN_KEY);
    secureStorage.remove(AUTH_CONFIG.REFRESH_TOKEN_KEY);
  },
  
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      return currentTime >= expirationTime;
    } catch (error) {
      console.error('Token validation error:', error);
      return true;
    }
  },
  
  shouldRefreshToken(token) {
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      
      return (expirationTime - currentTime) < AUTH_CONFIG.TOKEN_REFRESH_THRESHOLD;
    } catch (error) {
      return false;
    }
  },
  
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken || this.isTokenExpired(refreshToken)) {
      throw new Error('No valid refresh token available');
    }
    
    try {
      const response = await this.makeRequest('/.netlify/functions/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuth: true
      });
      
      if (response.success) {
        this.setTokens(response.accessToken);
        return response.accessToken;
      } else {
        throw new Error(response.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      throw error;
    }
  },
  
  async makeRequest(url, options = {}) {
    const { skipAuth = false, ...fetchOptions } = options;
    
    const headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers
    };
    
    // Add authentication header if not skipped
    if (!skipAuth) {
      let accessToken = this.getAccessToken();
      
      // Refresh token if needed
      if (accessToken && this.shouldRefreshToken(accessToken)) {
        try {
          accessToken = await this.refreshAccessToken();
        } catch (error) {
          console.error('Auto-refresh failed:', error);
          // Continue with expired token, let server handle it
        }
      }
      
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    
    // Add CSRF token for state-changing operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(fetchOptions.method?.toUpperCase())) {
      const csrfToken = secureStorage.get(AUTH_CONFIG.CSRF_TOKEN_KEY);
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }
    
    const requestOptions = {
      ...fetchOptions,
      headers,
      timeout: AUTH_CONFIG.REQUEST_TIMEOUT
    };
    
    try {
      const response = await fetch(url, requestOptions);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }
};

// Enhanced API client
const secureAPI = {
  // Authentication methods
  async register(userData) {
    try {
      const { username, password, bio, email, rememberMe = false } = userData;
      
      // Client-side validation
      this.validateRegistrationData({ username, password, bio, email });
      
      const response = await tokenManager.makeRequest('/.netlify/functions/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, bio, email }),
        skipAuth: true
      });
      
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  },
  
  async login(credentials) {
    try {
      const { username, password, rememberMe = false } = credentials;
      
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      
      const response = await tokenManager.makeRequest('/.netlify/functions/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, rememberMe }),
        skipAuth: true
      });
      
      if (response.success) {
        // Store tokens and user data securely
        tokenManager.setTokens(response.accessToken, response.refreshToken);
        secureStorage.set(AUTH_CONFIG.USER_DATA_KEY, response.user);
        secureStorage.set(AUTH_CONFIG.SESSION_KEY, response.session);
        
        // Update global state
        currentUser = {
          username: response.user.username,
          profile: response.user
        };
        
        return response;
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  },
  
  async logout(logoutAll = false) {
    try {
      const sessionData = secureStorage.get(AUTH_CONFIG.SESSION_KEY);
      const sessionId = sessionData?.id;
      
      await tokenManager.makeRequest('/.netlify/functions/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ sessionId, logoutAll })
      });
      
      // Clear all local data
      this.clearAuthData();
      
      return { success: true, message: logoutAll ? 'Logged out from all devices' : 'Logged out successfully' };
    } catch (error) {
      // Always clear local data even if request fails
      this.clearAuthData();
      console.error('Logout error:', error);
      return { success: true, message: 'Logged out locally' };
    }
  },
  
  async changePassword(passwordData) {
    try {
      const { currentPassword, newPassword } = passwordData;
      
      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }
      
      this.validatePassword(newPassword);
      
      const response = await tokenManager.makeRequest('/.netlify/functions/api/security/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      return response;
    } catch (error) {
      console.error('Change password error:', error);
      throw new Error(error.message || 'Failed to change password');
    }
  },
  
  // User session management
  async getUserSessions() {
    try {
      const response = await tokenManager.makeRequest('/.netlify/functions/api/security/sessions', {
        method: 'GET'
      });
      
      return response;
    } catch (error) {
      console.error('Get sessions error:', error);
      throw new Error(error.message || 'Failed to load sessions');
    }
  },
  
  async getLoginHistory() {
    try {
      const response = await tokenManager.makeRequest('/.netlify/functions/api/security/login-history', {
        method: 'GET'
      });
      
      return response;
    } catch (error) {
      console.error('Get login history error:', error);
      throw new Error(error.message || 'Failed to load login history');
    }
  },
  
  // Data loading methods (updated for new auth)
  async loadUserData() {
    try {
      const storedUser = secureStorage.get(AUTH_CONFIG.USER_DATA_KEY);
      if (storedUser && tokenManager.getAccessToken()) {
        currentUser = {
          username: storedUser.username,
          profile: storedUser
        };
        
        // Load additional user data
        await this.loadFollowedCommunities();
        return currentUser;
      }
      return null;
    } catch (error) {
      console.error('Error loading user data:', error);
      this.clearAuthData();
      return null;
    }
  },
  
  async loadFollowedCommunities() {
    if (!currentUser) {
      followedCommunities = new Set();
      return;
    }
    
    try {
      const response = await tokenManager.makeRequest('/.netlify/functions/api/communities/following', {
        method: 'GET'
      });
      
      if (response.success) {
        followedCommunities = new Set(response.communities.map(c => c.name));
      }
    } catch (error) {
      console.error('Error loading followed communities:', error);
      followedCommunities = new Set();
    }
  },
  
  // Utility methods
  clearAuthData() {
    tokenManager.clearTokens();
    secureStorage.remove(AUTH_CONFIG.USER_DATA_KEY);
    secureStorage.remove(AUTH_CONFIG.SESSION_KEY);
    secureStorage.remove(AUTH_CONFIG.CSRF_TOKEN_KEY);
    
    currentUser = null;
    followedCommunities = new Set();
  },
  
  isAuthenticated() {
    const accessToken = tokenManager.getAccessToken();
    const refreshToken = tokenManager.getRefreshToken();
    
    // Check if we have valid tokens
    if (!accessToken && !refreshToken) {
      return false;
    }
    
    // If access token is expired but refresh token exists, we can refresh
    if (tokenManager.isTokenExpired(accessToken) && refreshToken && !tokenManager.isTokenExpired(refreshToken)) {
      return true;
    }
    
    // If access token is valid, we're authenticated
    return !tokenManager.isTokenExpired(accessToken);
  },
  
  async ensureAuthenticated() {
    if (!this.isAuthenticated()) {
      throw new Error('Authentication required');
    }
    
    const accessToken = tokenManager.getAccessToken();
    if (tokenManager.shouldRefreshToken(accessToken)) {
      try {
        await tokenManager.refreshAccessToken();
      } catch (error) {
        this.clearAuthData();
        throw new Error('Session expired. Please log in again.');
      }
    }
  },
  
  // Validation methods
  validateRegistrationData({ username, password, bio, email }) {
    // Username validation
    if (!username || username.length < 3 || username.length > 20) {
      throw new Error('Username must be 3-20 characters long');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }
    
    // Password validation
    this.validatePassword(password);
    
    // Bio validation
    if (bio && bio.length > 500) {
      throw new Error('Bio must be 500 characters or less');
    }
    
    // Email validation (optional)
    if (email && !this.isValidEmail(email)) {
      throw new Error('Please provide a valid email address');
    }
  },
  
  validatePassword(password) {
    if (!password || password.length < 9) {
      throw new Error('Password must be at least 9 characters long');
    }
    
    if (password.length > 128) {
      throw new Error('Password must be less than 128 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
    
    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456789', 'qwertyuiop', 'password123', 
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new Error('Password is too common. Please choose a more secure password');
    }
  },
  
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Password strength indicator
  getPasswordStrength(password) {
    let score = 0;
    const feedback = [];
    
    if (password.length >= 9) score++;
    else feedback.push('At least 9 characters');
    
    if (/[A-Z]/.test(password)) score++;
    else feedback.push('One uppercase letter');
    
    if (/[a-z]/.test(password)) score++;
    else feedback.push('One lowercase letter');
    
    if (/\d/.test(password)) score++;
    else feedback.push('One number');
    
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    else feedback.push('One special character');
    
    if (password.length >= 12) score++;
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) score++;
    
    const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
    
    return {
      score,
      strength,
      feedback: feedback.length > 0 ? `Missing: ${feedback.join(', ')}` : 'Strong password!'
    };
  }
};

// Enhanced authentication handlers with improved security
async function handleSecureAuth(e) {
  e.preventDefault();
  const form = e.target;
  const mode = form.dataset.mode;
  const username = document.getElementById('username')?.value?.trim();
  const password = document.getElementById('password')?.value;
  const bio = document.getElementById('bio')?.value?.trim();
  const email = document.getElementById('email')?.value?.trim();
  const rememberMe = document.getElementById('rememberMe')?.checked || false;
  
  // Complete the handleSecureAuth function
  } catch (error) {
    console.error('Auth error:', error);
  }
}
async function handleSecureAuth(e) {
  e.preventDefault();
  const form = e.target;
  const mode = form.dataset.mode;
  const username = document.getElementById('username')?.value?.trim();
  const password = document.getElementById('password')?.value;
  const bio = document.getElementById('bio')?.value?.trim();
  const email = document.getElementById('email')?.value?.trim();
  const rememberMe = document.getElementById('rememberMe')?.checked || false;

  try {
    if (mode === 'signup') {
      await handleRegister({ username, password, bio, email, rememberMe });
    } else {
      await handleLogin({ username, password, rememberMe });
    }
  } catch (error) {
    console.error('Auth error:', error);
    showError('authError', error.message);
  }
}
