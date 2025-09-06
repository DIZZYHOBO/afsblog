// admin.js - COMPLETELY REWRITTEN SECURE ADMIN SYSTEM
// Enhanced admin functionality with modern security


// Admin security configuration
const ADMIN_CONFIG = {
  MAX_BULK_OPERATIONS: 10,
  AUDIT_LOG_RETENTION_DAYS: 90,
  SESSION_TIMEOUT_WARNING: 5 * 60 * 1000, // 5 minutes
  AUTO_REFRESH_INTERVAL: 30 * 1000, // 30 seconds
  SECURITY_EVENT_REFRESH: 10 * 1000 // 10 seconds
};

// Enhanced admin stats loading with security
async function loadAdminStats() {
  if (!currentUser?.profile?.isAdmin) {
    console.warn('Unauthorized admin stats access attempt');
    return;
  }

  try {
    const response = await tokenManager.makeRequest('/.netlify/functions/api/admin/stats', {
      method: 'GET'
    });

    if (response.success) {
      updateAdminStatsDisplay(response.stats);
      
      // Log admin access
      await logAdminAction('stats_viewed', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Failed to load admin stats:', response.error);
    }
  } catch (error) {
    console.error('Error loading admin stats:', error);
  }
}

function updateAdminStatsDisplay(stats) {
  // Update the old admin panel stats if they exist
  const elements = {
    totalUsers: document.getElementById('totalUsers'),
    pendingUsers: document.getElementById('pendingUsers'),
    totalPosts: document.getElementById('totalPosts'),
    totalCommunities: document.getElementById('totalCommunities'),
    // New admin page stats
    adminTotalUsers: document.getElementById('adminTotalUsers'),
    adminPendingUsers: document.getElementById('adminPendingUsers'),
    adminTotalPosts: document.getElementById('adminTotalPosts'),
    adminTotalCommunities: document.getElementById('adminTotalCommunities')
  };

  Object.entries(elements).forEach(([key, element]) => {
    if (element && stats[key] !== undefined) {
      element.textContent = stats[key];
    }
  });

  console.log('Admin stats updated:', stats);
}

// Enhanced pending users management
async function loadPendingUsersList() {
  if (!currentUser?.profile?.isAdmin) {
    throw new Error('Admin privileges required');
  }

  try {
    const response = await tokenManager.makeRequest('/.netlify/functions/api/admin/pending-users', {
      method: 'GET'
    });

    if (response.success) {
      return response.pendingUsers.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else {
      throw new Error(response.error || 'Failed to load pending users');
    }
  } catch (error) {
    console.error('Error loading pending users:', error);
    return [];
  }
}

// Enhanced all users management
async function loadAllUsersList() {
  if (!currentUser?.profile?.isAdmin) {
    throw new Error('Admin privileges required');
  }

  try {
    const response = await tokenManager.makeRequest('/.netlify/functions/api/admin/users', {
      method: 'GET'
    });

    if (response.success) {
      return response.users.sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
    } else {
      throw new Error(response.error || 'Failed to load users');
    }
  } catch (error) {
    console.error('Error loading all users:', error);
    return [];
  }
}

// Enhanced communities management
async function loadAllCommunitiesList() {
  if (!currentUser?.profile?.isAdmin) {
    throw new Error('Admin privileges required');
  }

  try {
    const response = await tokenManager.makeRequest('/.netlify/functions/api/admin/communities', {
      method: 'GET'
    });

    if (response.success) {
      return response.communities.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else {
      throw new Error(response.error || 'Failed to load communities');
    }
  } catch (error) {
    console.error('Error loading communities:', error);
    return communities; // Fallback to loaded communities
  }
}

// Secure user approval with audit logging
async function approveUser(username, pendingKey) {
  if (!currentUser?.profile?.isAdmin) {
    showSuccessMessage('Admin privileges required');
    return;
  }

  if (!confirm(`Approve user @${username}?`)) return;
  
  try {
    const response = await tokenManager.makeRequest('/.netlify/functions/api/admin/approve-user', {
      method: 'POST',
      body: JSON.stringify({ username, pendingKey })
    });
    
    if (response.success) {
      showSuccessMessage('User approved successfully');
      // Reload pending users list
      loadPendingUsers();
    } else {
      showSuccessMessage(response.error || 'Failed to approve user');
    }
  } catch (error) {
    console.error('Error approving user:', error);
    showSuccessMessage('Failed to approve user');
  }
}
