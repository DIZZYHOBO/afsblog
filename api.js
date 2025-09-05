// Replace these functions in your api.js file to fix the logout issue

// FIXED: loadUser function - now uses new authentication system
async function loadUser() {
    try {
        // Use new authentication system - check for sessionToken
        const token = localStorage.getItem('sessionToken');
        
        if (!token) {
            console.log('🔍 No session token found');
            currentUser = null;
            followedCommunities = new Set(); // Clear followed communities
            return;
        }
        
        console.log('🔍 Validating existing session token...');
        
        // Validate token with new auth API
        const response = await fetch('/api/auth/validate', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Session token is valid');
            
            currentUser = data.user;
            currentUser.profile = data.user; // Ensure profile is available
            
            console.log('🎉 User session restored:', currentUser.username);
            
            // Load user's followed communities after successful auth
            await loadFollowedCommunities();
        } else {
            console.log('❌ Session token is invalid, removing...');
            localStorage.removeItem('sessionToken');
            currentUser = null;
            followedCommunities = new Set();
        }
    } catch (error) {
        console.error('🚨 Session validation error:', error);
        localStorage.removeItem('sessionToken');
        currentUser = null;
        followedCommunities = new Set();
    }
}

// FIXED: logout function - now clears both old and new systems
async function logout() {
    console.log('🚪 COMPREHENSIVE LOGOUT - Clearing ALL auth data...');
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        if (token) {
            // Call the logout API to invalidate the session on the server
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Server logout successful');
        }
    } catch (error) {
        console.error('🚨 Logout API call failed:', error);
    }
    
    // Clear NEW system
    localStorage.removeItem('sessionToken');
    console.log('🗑️ Cleared sessionToken from localStorage');
    
    // Clear OLD system (blob storage)
    try {
        await blobAPI.delete('current_user');
        console.log('🗑️ Cleared current_user from blob storage');
    } catch (deleteError) {
        // Ignore 404 errors - the key might not exist
        if (!deleteError.message.includes('404')) {
            console.warn('Failed to delete current_user key:', deleteError);
        }
        console.log('🗑️ current_user was not in blob storage');
    }
    
    // Clear app state completely
    currentUser = null;
    followedCommunities = new Set();
    
    console.log('✅ All auth data cleared');
    
    // Hide admin panel
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        adminPanel.style.display = 'none';
    }
    
    // Update UI and redirect to feed
    navigateToFeed();
    updateUI();
    showSuccessMessage('Logged out successfully!');
}

// UPDATED: handleAuth function - now uses ONLY new authentication system
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
            // SIGNUP MODE - uses new API
            console.log('🔐 Attempting signup for user:', username);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, bio: bio || `Hello! I'm ${username}` })
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Signup successful:', data);
                closeModal('authModal');
                showSuccess('authError', 'Registration submitted! Please wait for admin approval.');
            } else {
                console.error('❌ Signup failed:', data);
                showError('authError', data.error || 'Signup failed!');
            }
            
        } else {
            // LOGIN MODE - UPDATED to use ONLY new authentication system
            console.log('🔐 Attempting login for user:', username);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Login successful:', data);
                
                // 🚨 CRITICAL: Store the session token in localStorage
                if (data.token) {
                    console.log('💾 Storing session token in localStorage...');
                    localStorage.setItem('sessionToken', data.token);
                    console.log('✅ Session token stored successfully');
                    
                    // Clear any old blob storage data
                    try {
                        await blobAPI.delete('current_user');
                        console.log('🗑️ Cleared old current_user from blob storage');
                    } catch (e) {
                        // Ignore - might not exist
                    }
                } else {
                    console.warn('⚠️ No token received from server');
                }
                
                // Set current user from API response
                currentUser = data.user;
                currentUser.profile = data.user; // Ensure profile is available
                
                console.log('🎉 User authenticated:', currentUser.username);
                
                // Load user's followed communities after login
                await loadFollowedCommunities();
                
                closeModal('authModal');
                updateUI();
                showSuccess('authError', 'Login successful!');
                
                // Load admin stats if user is admin
                if (currentUser?.profile?.isAdmin) {
                    await loadAdminStats();
                }
                
            } else {
                console.error('❌ Login failed:', data);
                showError('authError', data.error || 'Login failed!');
            }
        }
        
        form.reset();
        
    } catch (error) {
        console.error('🚨 Authentication error:', error);
        showError('authError', 'Network error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
    }
}

// UPDATED: handleInlineLogin function - now uses ONLY new authentication system
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

        console.log('🔐 Attempting inline login for user:', username);
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('✅ Inline login successful:', data);
            
            // 🚨 CRITICAL: Store the session token in localStorage
            if (data.token) {
                console.log('💾 Storing session token in localStorage...');
                localStorage.setItem('sessionToken', data.token);
                console.log('✅ Session token stored successfully');
                
                // Clear any old blob storage data
                try {
                    await blobAPI.delete('current_user');
                    console.log('🗑️ Cleared old current_user from blob storage');
                } catch (e) {
                    // Ignore - might not exist
                }
            } else {
                console.warn('⚠️ No token received from server');
            }
            
            // Set current user from API response
            currentUser = data.user;
            currentUser.profile = data.user; // Ensure profile is available
            
            console.log('🎉 User authenticated via inline login:', currentUser.username);
            
            // Load user's followed communities after login
            await loadFollowedCommunities();
            
            // Clear the form
            document.getElementById('inlineLoginFormElement').reset();
            
            // Close menu and update UI
            toggleMenu();
            updateUI();
            showSuccessMessage('Welcome back!');

            // Load admin stats if user is admin
            if (currentUser?.profile?.isAdmin) {
                await loadAdminStats();
            }
            
        } else {
            console.error('❌ Inline login failed:', data);
            showInlineError(data.error || 'Login failed!');
        }
        
    } catch (error) {
        console.error('🚨 Inline login error:', error);
        showInlineError('Network error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
}
