// <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Setup - Blog</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👑</text></svg>">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: #000;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .setup-container {
            background: #1a1a1b;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 100%;
            border: 1px solid #374151;
        }

        .header {
            text-align: center;
            margin-bottom: 2rem;
        }

        .header h1 {
            color: #fbbf24;
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .header p {
            color: #9ca3af;
            font-size: 1rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            color: #d7dadc;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }

        .form-group input {
            width: 100%;
            background: #272729;
            border: 1px solid #343536;
            border-radius: 6px;
            padding: 12px;
            color: #d7dadc;
            font-size: 16px;
        }

        .form-group input:focus {
            outline: none;
            border-color: #fbbf24;
        }

        .btn {
            width: 100%;
            background: #fbbf24;
            color: #000;
            border: none;
            padding: 12px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 1rem;
        }

        .btn:hover {
            background: #f59e0b;
        }

        .btn:disabled {
            background: #374151;
            color: #6b7280;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: transparent;
            border: 1px solid #60a5fa;
            color: #60a5fa;
        }

        .btn-secondary:hover {
            background: #60a5fa;
            color: #000;
        }

        .status-message {
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            text-align: center;
        }

        .success {
            background: #065f46;
            border: 1px solid #10b981;
            color: #10b981;
        }

        .error {
            background: #7f1d1d;
            border: 1px solid #ef4444;
            color: #ef4444;
        }

        .warning {
            background: #92400e;
            border: 1px solid #f59e0b;
            color: #fbbf24;
        }

        .info {
            background: #1e3a8a;
            border: 1px solid #3b82f6;
            color: #60a5fa;
        }

        .target-user {
            background: #374151;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            text-align: center;
        }

        .target-user .username {
            font-size: 1.2rem;
            color: #fbbf24;
            font-weight: 600;
        }

        .link-section {
            text-align: center;
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #374151;
        }

        .link-section a {
            color: #60a5fa;
            text-decoration: none;
        }

        .link-section a:hover {
            text-decoration: underline;
        }

        code {
            background: #374151;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="setup-container">
        <div class="header">
            <h1>👑 Admin Setup</h1>
            <p>Grant admin privileges to a user</p>
        </div>

        <div class="target-user">
            <p>Target User:</p>
            <div class="username">@dumbass</div>
        </div>

        <div id="statusMessage"></div>

        <div id="loginForm">
            <div class="form-group">
                <label for="adminUsername">Your Admin Username</label>
                <input type="text" id="adminUsername" placeholder="Enter your username" required>
            </div>
            <div class="form-group">
                <label for="adminPassword">Your Password</label>
                <input type="password" id="adminPassword" placeholder="Enter your password" required>
            </div>
            <button class="btn" onclick="loginAndSetup()">Login & Make Dumbass Admin</button>
        </div>

        <div id="setupActions" style="display: none;">
            <button class="btn" onclick="makeDumbassAdmin()">👑 Grant Admin Privileges to @dumbass</button>
            <button class="btn btn-secondary" onclick="checkCurrentStatus()">🔍 Check Current Status</button>
        </div>

        <div class="link-section">
            <p><a href="index.html">← Back to Blog</a></p>
        </div>
    </div>

    <script>
        let currentUser = null;
        
        // Netlify Blobs API
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
            }
        };

        function showMessage(message, type = 'info') {
            const messageDiv = document.getElementById('statusMessage');
            messageDiv.innerHTML = `<div class="status-message ${type}">${message}</div>`;
        }

        async function loginAndSetup() {
            const username = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value;

            if (!username || !password) {
                showMessage('Please enter both username and password.', 'error');
                return;
            }

            showMessage('Logging in...', 'info');

            try {
                // Check if user exists
                const userData = await blobAPI.get(`user_${username}`);
                
                if (!userData) {
                    showMessage('User not found. Please check your username.', 'error');
                    return;
                }

                if (userData.password !== password) {
                    showMessage('Invalid password.', 'error');
                    return;
                }

                currentUser = userData;
                
                showMessage(`✅ Successfully logged in as @${username}`, 'success');
                
                // Show setup actions
                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('setupActions').style.display = 'block';
                
            } catch (error) {
                console.error('Login error:', error);
                showMessage('Login failed. Please try again.', 'error');
            }
        }

        async function makeDumbassAdmin() {
            if (!currentUser) {
                showMessage('Please log in first.', 'error');
                return;
            }

            showMessage('Checking if @dumbass exists...', 'info');

            try {
                // Check if dumbass user exists
                const dumbassUser = await blobAPI.get('user_dumbass');
                
                if (!dumbassUser) {
                    showMessage('❌ User @dumbass does not exist. They need to register first.', 'warning');
                    return;
                }

                if (dumbassUser.isAdmin) {
                    showMessage('👑 @dumbass is already an admin!', 'success');
                    return;
                }

                showMessage('Making @dumbass an admin...', 'info');

                // Update dumbass to admin
                const updatedUser = {
                    ...dumbassUser,
                    isAdmin: true,
                    madeAdminAt: new Date().toISOString(),
                    madeAdminBy: currentUser.username
                };

                await blobAPI.set('user_dumbass', updatedUser);

                showMessage('🎉 SUCCESS! @dumbass is now an admin and can access the admin panel.', 'success');
                
            } catch (error) {
                console.error('Error making dumbass admin:', error);
                showMessage('Failed to make @dumbass admin. Please try again.', 'error');
            }
        }

        async function checkCurrentStatus() {
            showMessage('Checking @dumbass status...', 'info');

            try {
                const dumbassUser = await blobAPI.get('user_dumbass');
                
                if (!dumbassUser) {
                    showMessage('❌ @dumbass user does not exist in the system.', 'warning');
                    return;
                }

                if (dumbassUser.isAdmin) {
                    showMessage(`👑 @dumbass is currently an ADMIN (granted on ${new Date(dumbassUser.madeAdminAt).toLocaleString()})`, 'success');
                } else {
                    showMessage('👤 @dumbass exists but is NOT an admin.', 'info');
                }
                
            } catch (error) {
                console.error('Error checking status:', error);
                showMessage('Failed to check status.', 'error');
            }
        }

        // Check on page load
        window.addEventListener('DOMContentLoaded', () => {
            showMessage('Ready to setup admin privileges. Please log in with your account.', 'info');
        });
    </script>
</body>
</html>
