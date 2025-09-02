// js/modals.js - Modal Management Component
class ModalManager {
    constructor() {
        this.openModals = new Set();
        this.setupEventListeners();
        this.createModalContainer();
    }

    setupEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });

        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.close(e.target.id);
            }
        });
    }

    createModalContainer() {
        if (!document.getElementById('modals-container')) {
            const container = document.createElement('div');
            container.id = 'modals-container';
            document.body.appendChild(container);
        }
        
        // Create all modals
        this.createAuthModal();
        this.createComposeModal();
        this.createCreateCommunityModal();
        this.createEditProfileModal();
        this.createImageInsertModal();
        this.createLinkInsertModal();
    }

    open(modalId) {
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            console.warn(`Modal ${modalId} not found`);
            return;
        }

        modal.style.display = 'flex';
        modal.classList.add('active');
        this.openModals.add(modalId);
        
        // Focus first input if available
        setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);

        // Prevent body scroll
        document.body.classList.add('modal-open');
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            this.openModals.delete(modalId);
            
            // Re-enable body scroll if no modals are open
            if (this.openModals.size === 0) {
                document.body.classList.remove('modal-open');
            }
        }
    }

    closeAll() {
        this.openModals.forEach(modalId => {
            this.close(modalId);
        });
    }

    createAuthModal() {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'authModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="authModalTitle">Login</h2>
                    <button class="modal-close" onclick="Modals.close('authModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="auth-tabs">
                        <button class="auth-tab active" id="loginTab" onclick="Modals.switchAuthTab('login')">Login</button>
                        <button class="auth-tab" id="registerTab" onclick="Modals.switchAuthTab('register')">Register</button>
                    </div>
                    
                    <form id="authForm" class="auth-form">
                        <div class="form-group">
                            <label for="authUsername">Username</label>
                            <input type="text" id="authUsername" name="username" required maxlength="20" 
                                   placeholder="Enter username" autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label for="authPassword">Password</label>
                            <input type="password" id="authPassword" name="password" required 
                                   placeholder="Enter password" autocomplete="current-password">
                        </div>
                        <div class="form-group" id="displayNameGroup" style="display: none;">
                            <label for="authDisplayName">Display Name</label>
                            <input type="text" id="authDisplayName" name="displayName" 
                                   placeholder="How others will see you" maxlength="50">
                        </div>
                        <div class="form-group" id="bioGroup" style="display: none;">
                            <label for="authBio">Bio (optional)</label>
                            <textarea id="authBio" name="bio" rows="3" 
                                      placeholder="Tell us about yourself..." maxlength="500"></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary" id="authSubmitBtn">Login</button>
                            <button type="button" class="btn btn-secondary" onclick="Modals.close('authModal')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        
        // Setup form handler
        const form = modal.querySelector('#authForm');
        form.addEventListener('submit', this.handleAuthSubmit.bind(this));
    }

    createComposeModal() {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'composeModal';
        modal.className = 'modal compose-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="composeModalTitle">Create Post</h2>
                    <button class="modal-close" onclick="Modals.close('composeModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="composeForm" class="compose-form">
                        <div class="form-group">
                            <label for="composeTitle">Title</label>
                            <input type="text" id="composeTitle" name="title" required 
                                   maxlength="200" placeholder="Enter post title">
                        </div>
                        
                        <div class="form-group">
                            <label for="composeCommunity">Community</label>
                            <select id="composeCommunity" name="community" required>
                                <option value="">Select a community</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="composeContent">Content</label>
                            <div class="markdown-editor">
                                <div class="markdown-toolbar" id="composeToolbar">
                                    <button type="button" title="Bold" onclick="MarkdownEditor.insertMarkdown('composeContent', '**', '**')">B</button>
                                    <button type="button" title="Italic" onclick="MarkdownEditor.insertMarkdown('composeContent', '_', '_')">I</button>
                                    <button type="button" title="Link" onclick="Modals.open('linkInsertModal'); Modals.setLinkTarget('composeContent')">🔗</button>
                                    <button type="button" title="Image" onclick="Modals.open('imageInsertModal'); Modals.setImageTarget('composeContent')">🖼️</button>
                                    <button type="button" title="Code" onclick="MarkdownEditor.insertMarkdown('composeContent', '\\`', '\\`')">{ }</button>
                                    <button type="button" title="Quote" onclick="MarkdownEditor.insertMarkdown('composeContent', '> ', '')">❝</button>
                                    <button type="button" title="List" onclick="MarkdownEditor.insertMarkdown('composeContent', '- ', '')">•</button>
                                </div>
                                <textarea id="composeContent" name="content" rows="12" required 
                                          maxlength="10000" placeholder="Write your post content here..."></textarea>
                            </div>
                        </div>
                        
                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="composePrivate" name="isPrivate">
                                <span class="checkbox-text">Private post (only visible to you)</span>
                            </label>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Create Post</button>
                            <button type="button" class="btn btn-secondary" onclick="Modals.close('composeModal')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        
        // Setup form handler
        const form = modal.querySelector('#composeForm');
        form.addEventListener('submit', this.handleComposeSubmit.bind(this));
    }

    createCreateCommunityModal() {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'createCommunityModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Create Community</h2>
                    <button class="modal-close" onclick="Modals.close('createCommunityModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="createCommunityForm" class="create-community-form">
                        <div class="form-group">
                            <label for="communityName">Community Name</label>
                            <input type="text" id="communityName" name="name" required 
                                   maxlength="25" placeholder="community_name" 
                                   pattern="^[a-z0-9_]{3,25}$">
                            <small class="form-hint">3-25 characters, lowercase letters, numbers, and underscores only</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="communityDisplayName">Display Name</label>
                            <input type="text" id="communityDisplayName" name="displayName" required 
                                   maxlength="50" placeholder="Community Display Name">
                        </div>
                        
                        <div class="form-group">
                            <label for="communityDescription">Description</label>
                            <textarea id="communityDescription" name="description" rows="4" 
                                      maxlength="500" placeholder="Describe your community..."></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Create Community</button>
                            <button type="button" class="btn btn-secondary" onclick="Modals.close('createCommunityModal')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        
        // Setup form handler
        const form = modal.querySelector('#createCommunityForm');
        form.addEventListener('submit', this.handleCreateCommunitySubmit.bind(this));
    }

    createEditProfileModal() {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'editProfileModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Profile</h2>
                    <button class="modal-close" onclick="Modals.close('editProfileModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editProfileForm" class="edit-profile-form">
                        <div class="form-group">
                            <label for="editDisplayName">Display Name</label>
                            <input type="text" id="editDisplayName" name="displayName" 
                                   maxlength="50" placeholder="How others will see you">
                        </div>
                        
                        <div class="form-group">
                            <label for="editBio">Bio</label>
                            <textarea id="editBio" name="bio" rows="4" 
                                      maxlength="500" placeholder="Tell us about yourself..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="editAvatar">Avatar URL (optional)</label>
                            <input type="url" id="editAvatar" name="avatar" 
                                   placeholder="https://example.com/your-avatar.jpg">
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Update Profile</button>
                            <button type="button" class="btn btn-secondary" onclick="Modals.close('editProfileModal')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        
        // Setup form handler
        const form = modal.querySelector('#editProfileForm');
        form.addEventListener('submit', this.handleEditProfileSubmit.bind(this));
    }

    createImageInsertModal() {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'imageInsertModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Insert Image</h2>
                    <button class="modal-close" onclick="Modals.close('imageInsertModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="imageInsertForm">
                        <div class="form-group">
                            <label for="imageUrl">Image URL</label>
                            <input type="url" id="imageUrl" name="url" required 
                                   placeholder="https://example.com/image.jpg">
                        </div>
                        
                        <div class="form-group">
                            <label for="imageAlt">Alt Text (optional)</label>
                            <input type="text" id="imageAlt" name="alt" 
                                   placeholder="Description of the image">
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Insert Image</button>
                            <button type="button" class="btn btn-secondary" onclick="Modals.close('imageInsertModal')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        
        // Setup form handler
        const form = modal.querySelector('#imageInsertForm');
        form.addEventListener('submit', this.handleImageInsert.bind(this));
    }

    createLinkInsertModal() {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'linkInsertModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Insert Link</h2>
                    <button class="modal-close" onclick="Modals.close('linkInsertModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="linkInsertForm">
                        <div class="form-group">
                            <label for="linkUrl">URL</label>
                            <input type="url" id="linkUrl" name="url" required 
                                   placeholder="https://example.com">
                        </div>
                        
                        <div class="form-group">
                            <label for="linkText">Link Text</label>
                            <input type="text" id="linkText" name="text" required 
                                   placeholder="Text to display">
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Insert Link</button>
                            <button type="button" class="btn btn-secondary" onclick="Modals.close('linkInsertModal')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        
        // Setup form handler
        const form = modal.querySelector('#linkInsertForm');
        form.addEventListener('submit', this.handleLinkInsert.bind(this));
    }

    // Auth modal methods
    switchAuthTab(mode) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const title = document.getElementById('authModalTitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const displayNameGroup = document.getElementById('displayNameGroup');
        const bioGroup = document.getElementById('bioGroup');

        if (mode === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            title.textContent = 'Login';
            submitBtn.textContent = 'Login';
            displayNameGroup.style.display = 'none';
            bioGroup.style.display = 'none';
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            title.textContent = 'Register';
            submitBtn.textContent = 'Register';
            displayNameGroup.style.display = 'block';
            bioGroup.style.display = 'block';
        }
    }

    // Form handlers
    async handleAuthSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const mode = document.getElementById('loginTab').classList.contains('active') ? 'login' : 'register';
        
        try {
            if (mode === 'login') {
                await Auth.login(formData.get('username'), formData.get('password'));
            } else {
                await Auth.register(
                    formData.get('username'),
                    formData.get('password'),
                    formData.get('displayName'),
                    formData.get('bio')
                );
            }
            this.close('authModal');
            e.target.reset();
        } catch (error) {
            Utils.showErrorMessage(error.message);
        }
    }

    async handleComposeSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await Posts.createPost({
                title: formData.get('title'),
                content: formData.get('content'),
                community: formData.get('community'),
                isPrivate: formData.get('isPrivate') === 'on'
            });
            
            this.close('composeModal');
            e.target.reset();
        } catch (error) {
            Utils.showErrorMessage(error.message);
        }
    }

    async handleCreateCommunitySubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await Communities.createCommunity({
                name: formData.get('name'),
                displayName: formData.get('displayName'),
                description: formData.get('description')
            });
            
            this.close('createCommunityModal');
            e.target.reset();
        } catch (error) {
            Utils.showErrorMessage(error.message);
        }
    }

    async handleEditProfileSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await Profile.updateProfile({
                displayName: formData.get('displayName'),
                bio: formData.get('bio'),
                avatar: formData.get('avatar')
            });
            
            this.close('editProfileModal');
        } catch (error) {
            Utils.showErrorMessage(error.message);
        }
    }

    setLinkTarget(target) {
        this.linkTarget = target;
    }

    setImageTarget(target) {
        this.imageTarget = target;
    }

    handleLinkInsert(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const url = formData.get('url');
        const text = formData.get('text');
        const markdown = `[${text}](${url})`;
        
        if (this.linkTarget) {
            MarkdownEditor.insertAtCursor(this.linkTarget, markdown);
        }
        
        this.close('linkInsertModal');
        e.target.reset();
    }

    handleImageInsert(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const url = formData.get('url');
        const alt = formData.get('alt') || 'Image';
        const markdown = `![${alt}](${url})`;
        
        if (this.imageTarget) {
            MarkdownEditor.insertAtCursor(this.imageTarget, markdown);
        }
        
        this.close('imageInsertModal');
        e.target.reset();
    }

    // Populate modals with data
    populateComposeModal() {
        const communities = State.getCommunities();
        const select = document.getElementById('composeCommunity');
        
        select.innerHTML = '<option value="">Select a community</option>';
        communities.forEach(community => {
            const option = document.createElement('option');
            option.value = community.name;
            option.textContent = community.displayName;
            select.appendChild(option);
        });
    }

    populateEditProfileModal() {
        const user = State.getCurrentUser();
        if (user) {
            document.getElementById('editDisplayName').value = user.displayName || '';
            document.getElementById('editBio').value = user.bio || '';
            document.getElementById('editAvatar').value = user.avatar || '';
        }
    }
}

// Initialize global Modals instance
window.Modals = new ModalManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalManager, Modals: window.Modals };
}
