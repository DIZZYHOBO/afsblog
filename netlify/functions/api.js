// netlify/functions/api.js - COMPLETELY REWRITTEN WITH MODERN SECURITY
import { getStore } from "@netlify/blobs";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Enhanced security configuration
const SECURITY_CONFIG = {
  // Environment variables (must be set in Netlify)
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
  MASTER_API_KEY: process.env.MASTER_API_KEY || "your-secret-master-key-here",
  
  // Token lifetimes
  ACCESS_TOKEN_LIFETIME: 15 * 60, // 15 minutes
  REFRESH_TOKEN_LIFETIME: 7 * 24 * 60 * 60, // 7 days
  REMEMBER_ME_LIFETIME: 30 * 24 * 60 * 60, // 30 days
  
  // Rate limiting (per IP address)
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: { max: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
    REGISTRATION: { max: 3, window: 60 * 60 * 1000 }, // 3 registrations per hour
    PASSWORD_RESET: { max: 3, window: 60 * 60 * 1000 }, // 3 resets per hour
    API_CALLS: { max: 100, window: 60 * 1000 } // 100 calls per minute
  },
  
  // Account security
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
  
  // Password requirements
  PASSWORD_MIN_LENGTH: 9,
  PASSWORD_REQUIREMENTS: {
    minLength: 9,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLength: 128
  },
  
  // Session security
  MAX_CONCURRENT_SESSIONS: 5,
  SESSION_ROTATION_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  
  // CORS settings
  ALLOWED_ORIGINS: [
    'https://your-domain.netlify.app',
    'https://localhost:3000',
    'http://localhost:8888'
  ],
  
  PROTECTED_ADMIN: "dumbass" // Protected admin that cannot be demoted
};

export default async (req, context) => {
  const store = getStore("blog-api-data");
  const blogStore = getStore("blog-data");
  const securityStore = getStore("security-data");
  
  // Enhanced CORS headers
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/api/')[1] || '';
    const clientIP = getClientIP(req);

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(securityStore, clientIP, path, req.method);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          retryAfter: rateLimitResult.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Retry-After': rateLimitResult.retryAfter.toString() 
          } 
        }
      );
    }

    // Security logging
    await logSecurityEvent(securityStore, {
      type: 'api_request',
      ip: clientIP,
      path: path,
      method: req.method,
      userAgent: req.headers.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Authentication endpoints (no auth required)
    if (path === 'auth/register') {
      return await handleSecureRegister(req, blogStore, securityStore, corsHeaders, clientIP);
    }
    
    if (path === 'auth/login') {
      return await handleSecureLogin(req, blogStore, securityStore, corsHeaders, clientIP);
    }
    
    if (path === 'auth/refresh') {
      return await handleTokenRefresh(req, store, corsHeaders);
    }
    
    if (path === 'auth/logout') {
      return await handleSecureLogout(req, store, securityStore, corsHeaders);
    }
    
    if (path === 'auth/forgot-password') {
      return await handleForgotPassword(req, blogStore, securityStore, corsHeaders, clientIP);
    }
    
    if (path === 'auth/verify-email') {
      return await handleEmailVerification(req, blogStore, corsHeaders);
    }

    // Public endpoints (no auth required)
    if (path === 'communities' && req.method === 'GET') {
      return await handleGetCommunities(req, blogStore, corsHeaders);
    }
    
    if (path.startsWith('communities/') && req.method === 'GET') {
      const communityName = path.split('/')[1];
      if (path.endsWith('/posts')) {
        return await handleCommunityPosts(req, blogStore, corsHeaders, communityName);
      } else {
        return await handleGetCommunity(req, blogStore, corsHeaders, communityName);
      }
    }

    // Protected endpoints - validate authentication
    const authResult = await validateSecureAuth(req, store, blogStore);
    if (!authResult.valid) {
      await logSecurityEvent(securityStore, {
        type: 'auth_failure',
        ip: clientIP,
        path: path,
        reason: authResult.error,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: corsHeaders }
      );
    }

    // Update user's last activity
    await updateUserActivity(store, authResult.user.username);

    // Admin endpoints (require admin privileges)
    if (path.startsWith('admin/')) {
      if (!authResult.user.isAdmin) {
        await logSecurityEvent(securityStore, {
          type: 'unauthorized_admin_access',
          ip: clientIP,
          username: authResult.user.username,
          path: path,
          timestamp: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({ error: "Admin privileges required" }),
          { status: 403, headers: corsHeaders }
        );
      }
      
      return await handleAdminEndpoints(path, req, blogStore, securityStore, corsHeaders, authResult.user);
    }

    // Security endpoints
    if (path === 'security/sessions') {
      return await handleUserSessions(req, store, corsHeaders, authResult.user);
    }
    
    if (path === 'security/change-password') {
      return await handleChangePassword(req, blogStore, securityStore, corsHeaders, authResult.user, clientIP);
    }
    
    if (path === 'security/login-history') {
      return await handleLoginHistory(req, securityStore, corsHeaders, authResult.user);
    }

    // Regular authenticated endpoints
    return await handleAuthenticatedEndpoints(path, req, blogStore, store, corsHeaders, authResult.user);

  } catch (error) {
    console.error("API error:", error);
    
    // Log security incident
    await logSecurityEvent(securityStore, {
      type: 'api_error',
      ip: getClientIP(req),
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        id: crypto.randomUUID() // Error tracking ID
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

// ==============================================
// SECURE AUTHENTICATION HANDLERS
// ==============================================

async function handleSecureRegister(req, blogStore, securityStore, headers, clientIP) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password, bio, email } = await req.json();

    // Input validation
    const validation = validateRegistrationInput({ username, password, bio, email });
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers }
      );
    }

    // Check for existing users
    const [existingUser, pendingUser] = await Promise.all([
      blogStore.get(`user_${username}`, { type: "json" }),
      blogStore.get(`pending_user_${username}`, { type: "json" })
    ]);

    if (existingUser || pendingUser) {
      await logSecurityEvent(securityStore, {
        type: 'registration_attempt_duplicate',
        ip: clientIP,
        username: username,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Username already exists or is pending approval" }),
        { status: 409, headers }
      );
    }

    // Hash password securely
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const salt = await bcrypt.genSalt(saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const pendingUserData = {
      id: crypto.randomUUID(),
      username,
      email: email || null,
      passwordHash,
      passwordSalt: salt,
      bio: bio || `Hello! I'm ${username}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      isAdmin: false,
      emailVerified: false,
      verificationToken,
      verificationExpiry: verificationExpiry.toISOString(),
      registrationIP: clientIP,
      failedLoginAttempts: 0,
      lockedUntil: null,
      securityEvents: [],
      settings: {
        twoFactorEnabled: false,
        sessionTimeout: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME
      }
    };

    await blogStore.set(`pending_user_${username}`, JSON.stringify(pendingUserData));

    // Log successful registration
    await logSecurityEvent(securityStore, {
      type: 'user_registration',
      ip: clientIP,
      username: username,
      email: email || null,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration submitted for admin approval",
        status: "pending",
        username: username,
        emailVerificationRequired: !!email
      }),
      { status: 201, headers }
    );

  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({ error: "Registration failed" }),
      { status: 500, headers }
    );
  }
}

async function handleSecureLogin(req, blogStore, securityStore, headers, clientIP) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { username, password, rememberMe = false } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password required" }),
        { status: 400, headers }
      );
    }

    // Check for account lockout
    const user = await blogStore.get(`user_${username}`, { type: "json" });
    
    if (!user) {
      // Check if user is pending
      const pendingUser = await blogStore.get(`pending_user_${username}`, { type: "json" });
      if (pendingUser) {
        await logSecurityEvent(securityStore, {
          type: 'login_attempt_pending',
          ip: clientIP,
          username: username,
          timestamp: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({ error: "Your account is pending admin approval" }),
          { status: 401, headers }
        );
      }
      
      await logSecurityEvent(securityStore, {
        type: 'login_attempt_invalid_user',
        ip: clientIP,
        username: username,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers }
      );
    }

    // Check account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await logSecurityEvent(securityStore, {
        type: 'login_attempt_locked_account',
        ip: clientIP,
        username: username,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Account temporarily locked due to too many failed attempts",
          lockedUntil: user.lockedUntil
        }),
        { status: 423, headers }
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordValid) {
      // Increment failed attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updatedUser = { ...user, failedLoginAttempts: failedAttempts };
      
      // Lock account if too many failures
      if (failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
        updatedUser.lockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION).toISOString();
      }
      
      await blogStore.set(`user_${username}`, JSON.stringify(updatedUser));
      
      await logSecurityEvent(securityStore, {
        type: 'login_attempt_invalid_password',
        ip: clientIP,
        username: username,
        failedAttempts: failedAttempts,
        accountLocked: failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers }
      );
    }

    // Successful login - reset failed attempts and clear lockout
    const loginTime = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Generate tokens
    const tokenLifetime = rememberMe ? SECURITY_CONFIG.REMEMBER_ME_LIFETIME : SECURITY_CONFIG.REFRESH_TOKEN_LIFETIME;
    
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        sessionId: sessionId,
        type: 'access'
      },
      SECURITY_CONFIG.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME }
    );
    
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        sessionId: sessionId,
        type: 'refresh'
      },
      SECURITY_CONFIG.JWT_REFRESH_SECRET,
      { expiresIn: tokenLifetime }
    );

    // Create session record
    const sessionData = {
      sessionId: sessionId,
      userId: user.id,
      username: user.username,
      createdAt: loginTime,
      lastActivity: loginTime,
      expiresAt: new Date(Date.now() + (tokenLifetime * 1000)).toISOString(),
      ip: clientIP,
      userAgent: req.headers.get('User-Agent') || 'Unknown',
      deviceFingerprint: deviceFingerprint,
      active: true,
      rememberMe: rememberMe
    };

    // Store session
    const apiStore = getStore("blog-api-data");
    await apiStore.set(`session_${sessionId}`, JSON.stringify(sessionData));

    // Clean up old sessions and enforce session limit
    await cleanupUserSessions(apiStore, user.username, sessionId);

    // Update user record
    const updatedUser = {
      ...user,
      lastLogin: loginTime,
      loginCount: (user.loginCount || 0) + 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastIP: clientIP
    };
    
    await blogStore.set(`user_${username}`, JSON.stringify(updatedUser));

    // Log successful login
    await logSecurityEvent(securityStore, {
      type: 'user_login_success',
      ip: clientIP,
      username: username,
      sessionId: sessionId,
      deviceFingerprint: deviceFingerprint,
      rememberMe: rememberMe,
      timestamp: loginTime
    });

    // Remove sensitive data from response
    const { passwordHash, passwordSalt, securityEvents, ...userProfile } = updatedUser;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: userProfile,
        session: {
          id: sessionId,
          expiresAt: sessionData.expiresAt,
          rememberMe: rememberMe
        }
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Login failed" }),
      { status: 500, headers }
    );
  }
}

async function handleTokenRefresh(req, store, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { refreshToken } = await req.json();
    
    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: "Refresh token required" }),
        { status: 400, headers }
      );
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, SECURITY_CONFIG.JWT_REFRESH_SECRET);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid refresh token" }),
        { status: 401, headers }
      );
    }

    if (decoded.type !== 'refresh') {
      return new Response(
        JSON.stringify({ error: "Invalid token type" }),
        { status: 401, headers }
      );
    }

    // Check session exists and is active
    const session = await store.get(`session_${decoded.sessionId}`, { type: "json" });
    
    if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired or invalid" }),
        { status: 401, headers }
      );
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { 
        userId: decoded.userId,
        username: decoded.username,
        sessionId: decoded.sessionId,
        type: 'access'
      },
      SECURITY_CONFIG.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME }
    );

    // Update session activity
    session.lastActivity = new Date().toISOString();
    await store.set(`session_${decoded.sessionId}`, JSON.stringify(session));

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: newAccessToken,
        expiresIn: SECURITY_CONFIG.ACCESS_TOKEN_LIFETIME
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Token refresh error:", error);
    return new Response(
      JSON.stringify({ error: "Token refresh failed" }),
      { status: 500, headers }
    );
  }
}

async function handleSecureLogout(req, store, securityStore, headers) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { sessionId, logoutAll = false } = await req.json();
    const authHeader = req.headers.get("Authorization");
    
    let targetSessionId = sessionId;
    
    // If no sessionId provided, try to get from token
    if (!targetSessionId && authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
        targetSessionId = decoded.sessionId;
      } catch (error) {
        // Invalid token, continue with logout anyway
      }
    }

    if (targetSessionId) {
      const session = await store.get(`session_${targetSessionId}`, { type: "json" });
      
      if (session) {
        if (logoutAll) {
          // Logout from all sessions for this user
          await logoutAllUserSessions(store, session.username);
        } else {
          // Logout from specific session
          session.active = false;
          session.loggedOutAt = new Date().toISOString();
          await store.set(`session_${targetSessionId}`, JSON.stringify(session));
        }

        // Log logout event
        await logSecurityEvent(securityStore, {
          type: logoutAll ? 'user_logout_all' : 'user_logout',
          username: session.username,
          sessionId: targetSessionId,
          ip: getClientIP(req),
          timestamp: new Date().toISOString()
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: logoutAll ? "Logged out from all devices" : "Logged out successfully" 
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Logout error:", error);
    return new Response(
      JSON.stringify({ error: "Logout failed" }),
      { status: 500, headers }
    );
  }
}

async function handleChangePassword(req, blogStore, securityStore, headers, user, clientIP) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Current password and new password required" }),
        { status: 400, headers }
      );
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers }
      );
    }

    // Get current user data
    const userData = await blogStore.get(`user_${user.username}`, { type: "json" });
    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers }
      );
    }

    // Verify current password
    const currentPasswordValid = await bcrypt.compare(currentPassword, userData.passwordHash);
    if (!currentPasswordValid) {
      await logSecurityEvent(securityStore, {
        type: 'password_change_failed_verification',
        username: user.username,
        ip: clientIP,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: "Current password is incorrect" }),
        { status: 401, headers }
      );
    }

    // Check if new password is different from current
    const samePassword = await bcrypt.compare(newPassword, userData.passwordHash);
    if (samePassword) {
      return new Response(
        JSON.stringify({ error: "New password must be different from current password" }),
        { status: 400, headers }
      );
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    const newSalt = await bcrypt.genSalt(saltRounds);

    // Update user with new password
    const updatedUser = {
      ...userData,
      passwordHash: newPasswordHash,
      passwordSalt: newSalt,
      passwordChangedAt: new Date().toISOString(),
      passwordChangedBy: user.username,
      passwordChangeIP: clientIP
    };

    await blogStore.set(`user_${user.username}`, JSON.stringify(updatedUser));

    // Log password change
    await logSecurityEvent(securityStore, {
      type: 'password_changed',
      username: user.username,
      ip: clientIP,
      timestamp: new Date().toISOString()
    });

    // Invalidate all sessions except current one (force re-login)
    const apiStore = getStore("blog-api-data");
    await invalidateUserSessions(apiStore, user.username, user.sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password changed successfully. Please log in again on other devices."
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Change password error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to change password" }),
      { status: 500, headers }
    );
  }
}

// ==============================================
// VALIDATION AND SECURITY UTILITIES
// ==============================================

function validateRegistrationInput({ username, password, bio, email }) {
  // Username validation
  if (!username || typeof username !== 'string') {
    return { valid: false, error: "Username is required" };
  }
  
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: "Username must be 3-20 characters long" };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }

  // Password validation
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  // Bio validation
  if (bio && bio.length > 500) {
    return { valid: false, error: "Bio must be 500 characters or less" };
  }

  // Email validation (optional)
  if (email && !isValidEmail(email)) {
    return { valid: false, error: "Please provide a valid email address" };
  }

  return { valid: true };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: "Password is required" };
  }

  const config = SECURITY_CONFIG.PASSWORD_REQUIREMENTS;
  
  if (password.length < config.minLength) {
    return { valid: false, error: `Password must be at least ${config.minLength} characters long` };
  }
  
  if (password.length > config.maxLength) {
    return { valid: false, error: `Password must be less than ${config.maxLength} characters long` };
  }
  
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  
  if (config.requireNumbers && !/\d/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  
  if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)" };
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456789', 'qwertyuiop', 'password123', 
    'admin', 'letmein', 'welcome', 'monkey', '1234567890'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: "Password is too common. Please choose a more secure password" };
  }

  return { valid: true };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function validateSecureAuth(req, store, blogStore) {
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("X-API-Key");

  // Master API key authentication
  if (apiKey) {
    if (apiKey === SECURITY_CONFIG.MASTER_API_KEY) {
      return { 
        valid: true, 
        user: { 
          username: "system", 
          permissions: ["read", "write", "admin"], 
          isAdmin: true,
          sessionId: "master"
        },
        authType: "apikey"
      };
    }
    return { valid: false, error: "Invalid API key", status: 401 };
  }

  // JWT token authentication
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
      
      if (decoded.type !== 'access') {
        return { valid: false, error: "Invalid token type", status: 401 };
      }

      // Check session exists and is active
      const session = await store.get(`session_${decoded.sessionId}`, { type: "json" });
      
      if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
        return { valid: false, error: "Session expired", status: 401 };
      }

      // Get user profile
      const userProfile = await blogStore.get(`user_${decoded.username}`, { type: "json" });
      
      if (!userProfile) {
        return { valid: false, error: "User not found", status: 404 };
      }

      // Check if account is locked
      if (userProfile.lockedUntil && new Date(userProfile.lockedUntil) > new Date()) {
        return { valid: false, error: "Account locked", status: 423 };
      }

      return { 
        valid: true, 
        user: { 
          ...userProfile, 
          sessionId: decoded.sessionId 
        },
        authType: "jwt"
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: "Token expired", status: 401 };
      } else if (error.name === 'JsonWebTokenError') {
        return { valid: false, error: "Invalid token", status: 401 };
      } else {
        return { valid: false, error: "Authentication error", status: 500 };
      }
    }
  }

  return { valid: false, error: "Authentication required", status: 401 };
}

// ==============================================
// RATE LIMITING AND SECURITY UTILITIES
// ==============================================

async function checkRateLimit(securityStore, clientIP, path, method) {
  const now = Date.now();
  const rateLimitKey = `rate_limit_${clientIP}_${path}_${method}`;
  
  try {
    const rateLimitData = await securityStore.get(rateLimitKey, { type: "json" }) || {
      count: 0,
      windowStart: now,
      blocked: false
    };

    // Determine rate limit for this endpoint
    let limit = SECURITY_CONFIG.RATE_LIMITS.API_CALLS;
    
    if (path.includes('auth/login')) {
      limit = SECURITY_CONFIG.RATE_LIMITS.LOGIN_ATTEMPTS;
    } else if (path.includes('auth/register')) {
      limit = SECURITY_CONFIG.RATE_LIMITS.REGISTRATION;
    } else if (path.includes('forgot-password')) {
      limit = SECURITY_CONFIG.RATE_LIMITS.PASSWORD_RESET;
    }

    // Reset window if expired
    if (now - rateLimitData.windowStart > limit.window) {
      rateLimitData.count = 0;
      rateLimitData.windowStart = now;
      rateLimitData.blocked = false;
    }

    // Check if blocked
    if (rateLimitData.blocked || rateLimitData.count >= limit.max) {
      rateLimitData.blocked = true;
      await securityStore.set(rateLimitKey, JSON.stringify(rateLimitData));
      
      const retryAfter = Math.ceil((limit.window - (now - rateLimitData.windowStart)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment counter
    rateLimitData.count++;
    await securityStore.set(rateLimitKey, JSON.stringify(rateLimitData));

    return { allowed: true };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request if rate limiting fails
    return { allowed: true };
  }
}

async function logSecurityEvent(securityStore, event) {
  try {
    const eventId = crypto.randomUUID();
    const logEntry = {
      id: eventId,
      ...event,
      severity: getEventSeverity(event.type)
    };
    
    await securityStore.set(`security_log_${eventId}`, JSON.stringify(logEntry));
    
    // Also maintain a daily log index for easier querying
    const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
    const dailyLogKey = `daily_security_log_${dateKey}`;
    
    const dailyLog = await securityStore.get(dailyLogKey, { type: "json" }) || [];
    dailyLog.push(eventId);
    
    // Keep only last 100 events per day to prevent storage bloat
    if (dailyLog.length > 100) {
      dailyLog.splice(0, dailyLog.length - 100);
    }
    
    await securityStore.set(dailyLogKey, JSON.stringify(dailyLog));
    
  } catch (error) {
    console.error('Security logging error:', error);
  }
}

function getEventSeverity(eventType) {
  const highSeverity = [
    'login_attempt_invalid_password',
    'login_attempt_locked_account',
    'unauthorized_admin_access',
    'password_change_failed_verification'
  ];
  
  const mediumSeverity = [
    'login_attempt_invalid_user',
    'login_attempt_pending',
    'auth_failure'
  ];
  
  if (highSeverity.includes(eventType)) return 'high';
  if (mediumSeverity.includes(eventType)) return 'medium';
  return 'low';
}

// ==============================================
// SESSION MANAGEMENT
// ==============================================

async function cleanupUserSessions(store, username, currentSessionId) {
  try {
    // Get all sessions for user
    const { blobs } = await store.list({ prefix: "session_" });
    const userSessions = [];
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active) {
          userSessions.push({ key: blob.key, session });
        }
      } catch (error) {
        // Clean up corrupted sessions
        await store.delete(blob.key);
      }
    }
    
    // Sort by last activity (newest first)
    userSessions.sort((a, b) => new Date(b.session.lastActivity) - new Date(a.session.lastActivity));
    
    // Keep only the most recent sessions (including current)
    const sessionsToKeep = SECURITY_CONFIG.MAX_CONCURRENT_SESSIONS;
    const sessionsToRemove = userSessions.slice(sessionsToKeep);
    
    for (const { key } of sessionsToRemove) {
      // Don't remove current session
      if (!key.includes(currentSessionId)) {
        await store.delete(key);
      }
    }
    
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}

async function logoutAllUserSessions(store, username) {
  try {
    const { blobs } = await store.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active) {
          session.active = false;
          session.loggedOutAt = new Date().toISOString();
          await store.set(blob.key, JSON.stringify(session));
        }
      } catch (error) {
        console.error(`Error logging out session ${blob.key}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Logout all sessions error:', error);
  }
}

async function invalidateUserSessions(store, username, exceptSessionId) {
  try {
    const { blobs } = await store.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active && session.sessionId !== exceptSessionId) {
          session.active = false;
          session.invalidatedAt = new Date().toISOString();
          await store.set(blob.key, JSON.stringify(session));
        }
      } catch (error) {
        console.error(`Error invalidating session ${blob.key}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Invalidate sessions error:', error);
  }
}

async function updateUserActivity(store, username) {
  try {
    // Update all active sessions for user
    const { blobs } = await store.list({ prefix: "session_" });
    
    for (const blob of blobs) {
      try {
        const session = await store.get(blob.key, { type: "json" });
        if (session && session.username === username && session.active) {
          session.lastActivity = new Date().toISOString();
          await store.set(blob.key, JSON.stringify(session));
        }
      } catch (error) {
        console.error(`Error updating session activity ${blob.key}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Update user activity error:', error);
  }
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

function getClientIP(req) {
  // Check various headers for real IP
  return req.headers.get('cf-connecting-ip') || 
         req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         req.headers.get('x-client-ip') || 
         'unknown';
}

function generateDeviceFingerprint(req) {
  const userAgent = req.headers.get('User-Agent') || '';
  const acceptLanguage = req.headers.get('Accept-Language') || '';
  const acceptEncoding = req.headers.get('Accept-Encoding') || '';
  
  const fingerprint = crypto
    .createHash('sha256')
    .update(userAgent + acceptLanguage + acceptEncoding)
    .digest('hex')
    .substring(0, 16);
    
  return fingerprint;
}

function getCorsHeaders(req) {
  const origin = req.headers.get('Origin');
  const allowedOrigin = SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin) ? origin : SECURITY_CONFIG.ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
}

// ==============================================
// PLACEHOLDER HANDLERS (to be implemented)
// ==============================================

async function handleForgotPassword(req, blogStore, securityStore, headers, clientIP) {
  // TODO: Implement password reset functionality
  return new Response(
    JSON.stringify({ message: "Password reset functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleEmailVerification(req, blogStore, headers) {
  // TODO: Implement email verification
  return new Response(
    JSON.stringify({ message: "Email verification functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleUserSessions(req, store, headers, user) {
  // TODO: Implement user session management
  return new Response(
    JSON.stringify({ message: "Session management functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleLoginHistory(req, securityStore, headers, user) {
  // TODO: Implement login history
  return new Response(
    JSON.stringify({ message: "Login history functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleAdminEndpoints(path, req, blogStore, securityStore, headers, user) {
  // TODO: Implement admin endpoints
  return new Response(
    JSON.stringify({ message: "Admin endpoints functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleAuthenticatedEndpoints(path, req, blogStore, store, headers, user) {
  // TODO: Implement authenticated endpoints (posts, communities, etc.)
  return new Response(
    JSON.stringify({ message: "Authenticated endpoints functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleGetCommunities(req, blogStore, headers) {
  // TODO: Implement get communities
  return new Response(
    JSON.stringify({ message: "Get communities functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleCommunityPosts(req, blogStore, headers, communityName) {
  // TODO: Implement community posts
  return new Response(
    JSON.stringify({ message: "Community posts functionality coming soon" }),
    { status: 501, headers }
  );
}

async function handleGetCommunity(req, blogStore, headers, communityName) {
  // TODO: Implement get community
  return new Response(
    JSON.stringify({ message: "Get community functionality coming soon" }),
    { status: 501, headers }
  );
}
