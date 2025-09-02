// js/feed-tabs.js - Feed Tab Management Component
class FeedTabsManager {
    constructor() {
        this.currentTab = 'general';
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to authentication changes
        State.addListener('currentUser', (user) => {
            this.updateTabsVisibility(user);
            if (user) {
                this.enableAllTabs();
            } else {
                this.disableAuthTabs();
            }
        });

        // Subscribe to view changes
        State.addListener('currentView', (view) => {
            this.updateTabsVisibility();
        });

        // Set up click handlers for tabs
        const tabs = ['generalTab', 'followedTab', 'privateTab'];
        tabs.forEach(tabId => {
            const tabElement = document.getElementById(tabId);
            if (tabElement) {
                tabElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tabName = this.getTabNameFromId(tabId);
                    this.switch(tabName);
                });
            }
        });
    }

    // Get tab name from element ID
    getTabNameFromId(id) {
        const mapping = {
            'generalTab': 'general',
            'followedTab': 'followed',
            'privateTab': 'private'
        };
        return mapping[id] || 'general';
    }

    // Switch to a different feed tab
    switch(tabName) {
        if (!this.isValidTab(tabName)) {
            console.warn('Invalid tab name:', tabName);
            return;
        }

        // Check authentication for protected tabs
        if (this.requiresAuth(tabName) && !State.getCurrentUser()) {
            Modals.switchAuthTab('login');
            Modals.open('authModal');
            return;
        }

        this.currentTab = tabName;
        State.set('currentFeedTab', tabName);
        
        this.updateTabVisualStates();
        this.updateTabContent();
    }

    // Check if tab name is valid
    isValidTab(tabName) {
        return ['general', 'followed', 'private'].includes(tabName);
    }

    // Check if tab requires authentication
    requiresAuth(tabName) {
        return ['followed', 'private'].includes(tabName);
    }

    // Update visual states of tabs
    updateTabVisualStates() {
        const tabs = ['general', 'followed', 'private'];
        
        tabs.forEach(tab => {
            const tabElement = document.getElementById(`${tab}Tab`);
            if (tabElement) {
                if (tab === this.currentTab) {
                    tabElement.classList.add('active');
                } else {
                    tabElement.classList.remove('active');
                }
            }
        });
    }

    // Update tab content based on current tab
    updateTabContent() {
        // Trigger re-render of current page if it's the feed page
        const currentView = State.get('currentView');
        if (currentView === 'feed') {
            Posts.renderFeedPosts();
        }
    }

    // Update tabs visibility based on current page and user
    updateTabsVisibility(user = State.getCurrentUser()) {
        const feedTabs = document.getElementById('feedTabs');
        const currentView = State.get('currentView');
        
        if (!feedTabs) return;
        
        // Show tabs only on feed page when user is logged in
        if (currentView === 'feed' && user) {
            feedTabs.style.display = 'flex';
            this.enableAllTabs();
        } else if (currentView === 'feed') {
            // Show tabs but disable auth-required tabs when not logged in
            feedTabs.style.display = 'flex';
            this.disableAuthTabs();
        } else {
            feedTabs.style.display = 'none';
        }
    }

    // Enable all tabs for authenticated users
    enableAllTabs() {
        const followedTab = document.getElementById('followedTab');
        const privateTab = document.getElementById('privateTab');
        
        if (followedTab) {
            followedTab.disabled = false;
            followedTab.style.opacity = '1';
            followedTab.style.cursor = 'pointer';
            followedTab.title = '';
        }
        
        if (privateTab) {
            privateTab.disabled = false;
            privateTab.style.opacity = '1';
            privateTab.style.cursor = 'pointer';
            privateTab.title = '';
        }
    }

    // Disable auth-required tabs for unauthenticated users
    disableAuthTabs() {
        const followedTab = document.getElementById('followedTab');
        const privateTab = document.getElementById('privateTab');
        
        if (followedTab) {
            followedTab.disabled = true;
            followedTab.style.opacity = '0.5';
            followedTab.style.cursor = 'not-allowed';
            followedTab.title = 'Login required';
        }
        
        if (privateTab) {
            privateTab.disabled = true;
            privateTab.style.opacity = '0.5';
            privateTab.style.cursor = 'not-allowed';
            privateTab.title = 'Login required';
        }

        // Switch to general tab if currently on an auth tab
        if (this.requiresAuth(this.currentTab)) {
            this.switch('general');
        }
    }

    // Get current tab
    getCurrentTab() {
        return this.currentTab;
    }

    // Get visible posts based on current tab
    getVisiblePosts() {
        const posts = State.getPosts();
        const currentUser = State.getCurrentUser();
        const follows = State.getFollows();

        switch (this.currentTab) {
            case 'followed':
                if (!currentUser) return [];
                return posts.filter(post => 
                    follows[post.community] === true && !post.isPrivate
                );
            
            case 'private':
                if (!currentUser) return [];
                return posts.filter(post => 
                    post.isPrivate && post.authorId === currentUser.id
                );
            
            case 'general':
            default:
                return posts.filter(post => !post.isPrivate);
        }
    }

    // Update tab counts (optional feature)
    updateTabCounts() {
        const posts = State.getPosts();
        const currentUser = State.getCurrentUser();
        const follows = State.getFollows();

        const counts = {
            general: posts.filter(p => !p.isPrivate).length,
            followed: currentUser ? posts.filter(p => 
                follows[p.community] === true && !p.isPrivate
            ).length : 0,
            private: currentUser ? posts.filter(p => 
                p.isPrivate && p.authorId === currentUser.id
            ).length : 0
        };
        
        // Update tab text with counts (optional feature)
        this.updateTabText('general', `General${counts.general > 0 ? ` (${counts.general})` : ''}`);
        this.updateTabText('followed', `Followed${counts.followed > 0 ? ` (${counts.followed})` : ''}`);
        this.updateTabText('private', `Private${counts.private > 0 ? ` (${counts.private})` : ''}`);
    }

    // Update tab text
    updateTabText(tabName, text) {
        const tabElement = document.getElementById(`${tabName}Tab`);
        if (tabElement) {
            tabElement.textContent = text;
        }
    }

    // Reset tabs to default state
    reset() {
        this.currentTab = 'general';
        this.updateTabVisualStates();
        this.updateTabsVisibility(null);
    }

    // Handle tab click events
    handleTabClick(event) {
        const tabElement = event.target.closest('.feed-tab');
        if (!tabElement) return;
        
        const tabName = this.getTabNameFromElement(tabElement);
        if (tabName) {
            this.switch(tabName);
        }
    }

    // Get tab name from tab element
    getTabNameFromElement(element) {
        const id = element.id;
        const tabNames = {
            'generalTab': 'general',
            'followedTab': 'followed',
            'privateTab': 'private'
        };
        return tabNames[id] || null;
    }

    // Create tab badge for notifications (future feature)
    createTabBadge(count) {
        if (count === 0) return '';
        
        return `<span class="tab-badge">${count > 99 ? '99+' : count}</span>`;
    }

    // Get tab description for accessibility
    getTabDescription(tabName) {
        const descriptions = {
            general: 'All public posts from all communities',
            followed: 'Posts from communities you follow',
            private: 'Your private posts that only you can see'
        };
        return descriptions[tabName] || '';
    }

    // Update tab accessibility attributes
    updateTabAccessibility() {
        const tabs = ['general', 'followed', 'private'];
        
        tabs.forEach(tab => {
            const tabElement = document.getElementById(`${tab}Tab`);
            if (tabElement) {
                tabElement.setAttribute('aria-selected', tab === this.currentTab);
                tabElement.setAttribute('aria-description', this.getTabDescription(tab));
            }
        });
    }

    // Filter posts based on search term (for future search feature)
    filterPosts(searchTerm = '') {
        const posts = this.getVisiblePosts();
        
        if (!searchTerm) return posts;
        
        const term = searchTerm.toLowerCase();
        return posts.filter(post => 
            post.title.toLowerCase().includes(term) ||
            post.content.toLowerCase().includes(term) ||
            post.author.toLowerCase().includes(term) ||
            post.community.toLowerCase().includes(term)
        );
    }

    // Sort posts (for future sorting feature)
    sortPosts(posts, sortBy = 'newest') {
        switch (sortBy) {
            case 'oldest':
                return [...posts].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            case 'most_liked':
                return [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
            case 'most_replies':
                return [...posts].sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0));
            case 'newest':
            default:
                return [...posts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
    }
}

// Create global feed tabs instance
window.FeedTabs = new FeedTabsManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FeedTabsManager, FeedTabs: window.FeedTabs };
}
