// js/feed-tabs.js - Feed Tab Management Component
class FeedTabsManager {
    constructor() {
        this.currentTab = 'general';
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to authentication changes
        State.subscribe('currentUser', (user) => {
            this.updateTabsVisibility(user);
            if (user) {
                this.enableAllTabs();
            } else {
                this.disableAuthTabs();
            }
        });

        // Subscribe to page changes
        State.subscribe('currentPage', (page) => {
            this.updateTabsVisibility();
        });
    }

    // Switch to a different feed tab
    switch(tabName) {
        if (!this.isValidTab(tabName)) {
            console.warn('Invalid tab name:', tabName);
            return;
        }

        // Check authentication for protected tabs
        if (this.requiresAuth(tabName) && !State.isAuthenticated()) {
            Modals.openAuth('signin');
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
        if (State.get('currentPage') === 'feed') {
            App.renderFeedPage();
        }
    }

    // Update tabs visibility based on current page and user
    updateTabsVisibility(user = State.getCurrentUser()) {
        const feedTabs = document.getElementById('feedTabs');
        const currentPage = State.get('currentPage');
        
        if (!feedTabs) return;
        
        // Show tabs only on feed page when user is logged in
        if (currentPage === 'feed' && user) {
            feedTabs.style.display = 'flex';
            this.enableAllTabs();
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
            followedTab.title = '';
        }
        
        if (privateTab) {
            privateTab.disabled = false;
            privateTab.title = '';
        }
    }

    // Disable authentication-required tabs
    disableAuthTabs() {
        const followedTab = document.getElementById('followedTab');
        const privateTab = document.getElementById('privateTab');
        
        if (followedTab) {
            followedTab.disabled = true;
            followedTab.title = 'Sign in to view followed communities';
        }
        
        if (privateTab) {
            privateTab.disabled = true;
            privateTab.title = 'Sign in to view private posts';
        }
        
        // Switch to general tab if currently on a protected tab
        if (this.requiresAuth(this.currentTab)) {
            this.switch('general');
        }
    }

    // Get current tab
    getCurrentTab() {
        return this.currentTab;
    }

    // Update tab badges/counts
    updateTabCounts() {
        if (!State.isAuthenticated()) return;
        
        const posts = State.get('posts');
        const currentUser = State.getCurrentUser();
        const followedCommunities = State.get('followedCommunities');
        
        // Count posts for each tab
        const counts = {
            general: posts.filter(p => !p.isPrivate).length,
            followed: posts.filter(p => 
                !p.isPrivate && 
                p.communityName && 
                followedCommunities.has(p.communityName)
            ).length,
            private: posts.filter(p => 
                p.isPrivate && 
                p.author === currentUser.username
            ).length
        };
        
        // Update tab text with counts (optional feature)
        this.updateTabText('general', `General (${counts.general})`);
        this.updateTabText('followed', `Followed (${counts.followed})`);
        this.updateTabText('private', `Private (${counts.private})`);
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
}

// Create global feed tabs instance
const FeedTabs = new FeedTabsManager();