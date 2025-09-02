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

        modal.style.display = 'block';
        this.openModals.add(modalId);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Focus first input if available
        setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            this.openModals.delete(modalId);
            
            // Clear any error messages
            const errorElements = modal.querySelectorAll('[id$="Error"]');
            errorElements.forEach(el => el.innerHTML = '');
            
            // Reset forms
            const forms = modal.querySelectorAll('form');
            forms.forEach(form => form.reset());
        }
        
        // Restore body scroll if no modals are open
        if (this.openModals.size === 0) {
            document.body.style.overflow = '';
        }
    }

    closeAll() {
        Array.from(this.openModals).forEach(modalId => {
            this.close(modalId);
        });
    }

    openAuth(mode = 'signin') {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authTitle');
        const toggleText = document.getElementById('authToggleText');
        const toggleBtn = document.getElementById('authToggleBtn');
        const submitBtn = document.getElementById('authSubmitBtn');
        const form = document.getElementById('authForm');
        
        if (!modal || !title || !toggleText || !toggleBtn || !submitBtn || !form) {
            console.error('Auth modal elements not found');
            return;
        }
        
        document.getElementById('authError').innerHTML = '';
        
        if (mode === 'signup') {
            title.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleBtn.textContent = 'Sign In';
            submitBtn.textContent = 'Sign Up';
            form.dataset.mode = 'signup';
        } else {
            title.textContent = 'Sign In';
            toggleText.textContent = "Don't have an account?";
            toggleBtn.textContent = 'Sign Up';
            submitBtn.textContent = 'Sign In';
            form.dataset.mode = 'signin';
        }
        
        this.open('authModal');
    }

    createAuthModal() {
        const container = document.getElementById('modals-container');
        const authModalHtml = `
            <div class="modal" id="authModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="authTitle">Sign In</h3>
                        <button class="close-btn" onclick="Modals.close('authModal')">&times;</button>
                    </div>
                    <div id="authError"></div>
                    <form id="authForm" data-handler="auth" data-mode="signin">
                        <div class="form-group">
                            <label for="username">Username</label>
                            <input type="text" id="username" name="username" required minlength="3" maxlength="20">
                        </div>
                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" name="password" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label for="bio">Bio (Optional)</label>
                            <textarea id="bio" name="bio" placeholder="Tell us about yourself..." maxlength="${CONFIG.MAX_BIO_LENGTH}"></textarea>
                        </div>
                        <button type="submit" class="btn" id="authSubmitBtn">Sign In</button>
                    </form>
                    <p style="margin-top: 16px; color: var(--fg-muted); font-size: 14px;">
                        <span id="authToggleText">Don't have an account?</span>
                        <button type="button" class="btn-secondary btn" id="authToggleBtn" onclick="AuthForms.toggleAuthMode()">Sign Up</button>
                    </p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', authModalHtml);
    }

    createComposeModal() {
        const container = document.getElementById('modals-container');
        const composeModalHtml = `
            <div class="modal" id="composeModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create Post</h3>
                        <button class="close-btn" onclick="Modals.close('composeModal')">&times;</button>
                    </div>
                    <div id="composeError"></div>
                    <form id="composeForm" data-handler="create-post">
                        <div class="form-group">
                            <label for="postCommunity">Community (Optional)</label>
                            <select id="postCommunity" name="community">
                                <option value="">General Feed</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Post Type</label>
                            <div style="display: flex; background: var(--bg-subtle); border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
                                <button type="button" style="flex: 1; background: var(--btn-primary-bg); color: white; border: none; padding: 8px 16px; cursor: pointer; font-size: 14px;" onclick="Posts.setPostType('text')">Text Post</button>
                                <button type="button" style="flex: 1; background: transparent; color: var(--fg-default); border: none; padding: 8px 16px; cursor: pointer; font-size: 14px;" onclick="Posts.setPostType('link')">Link/Media</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="postTitle">Title</label>
                            <input type="text" id="postTitle" name="title" required maxlength="${CONFIG.MAX_TITLE_LENGTH}">
                        </div>

                        <!-- Text Post Fields -->
                        <div id="textPostFields">
                            <div class="form-group">
                                <label for="postContent">Content</label>
                                ${this.createMarkdownToolbar()}
                                <textarea id="postContent" name="content" required placeholder="Share your thoughts... (Markdown supported)" maxlength="${CONFIG.MAX_CONTENT_LENGTH}"></textarea>
                                ${this.createMarkdownPreview()}
                                <small>Supports Markdown formatting. Use the toolbar buttons above for quick formatting!</small>
                            </div>
                        </div>

                        <!-- Link Post Fields -->
                        <div id="linkPostFields" style="display: none;">
                            <div class="form-group">
                                <label for="postUrl">URL</label>
                                <input type="url" id="postUrl" name="url" placeholder="https://example.com">
                                <small>YouTube, images, videos, and other media will be embedded automatically</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="postDescription">Description (Optional)</label>
                                <textarea id="postDescription" name="description" placeholder="Describe this link..." maxlength="2000"></textarea>
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="isPrivate" name="isPrivate" style="width: auto;">
                                <span>Private post (only you can see this)</span>
                            </label>
                        </div>
                        <button type="submit" class="btn" id="composeSubmitBtn">Post</button>
                    </form>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', composeModalHtml);
    }

    createCreateCommunityModal() {
        const container = document.getElementById('modals-container');
        const createCommunityModalHtml = `
            <div class="modal" id="createCommunityModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create Community</h3>
                        <button class="close-btn" onclick="Modals.close('createCommunityModal')">&times;</button>
                    </div>
                    <div id="createCommunityError"></div>
                    <form id="createCommunityForm" data-handler="create-community">
                        <div class="form-group">
                            <label for="communityName">Community Name</label>
                            <input type="text" id="communityName" name="name" required minlength="3" maxlength="${CONFIG.MAX_COMMUNITY_NAME_LENGTH}" pattern="[a-z0-9_]+" placeholder="programming">
                            <small>3-${CONFIG.MAX_COMMUNITY_NAME_LENGTH} characters, lowercase, letters, numbers, and underscores only</small>
                        </div>
                        <div class="form-group">
                            <label for="communityDisplayName">Display Name</label>
                            <input type="text" id="communityDisplayName" name="displayName" required maxlength="${CONFIG.MAX_COMMUNITY_DISPLAY_NAME_LENGTH}" placeholder="Programming">
                        </div>
                        <div class="form-group">
                            <label for="communityDescription">Description</label>
                            <textarea id="communityDescription" name="description" maxlength="${CONFIG.MAX_COMMUNITY_DESCRIPTION_LENGTH}" placeholder="A community for programming discussions and help"></textarea>
                        </div>
                        <button type="submit" class="btn" id="createCommunitySubmitBtn">Create Community</button>
                    </form>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', createCommunityModalHtml);
    }

    createEditProfileModal() {
        const container = document.getElementById('modals-container');
        const editProfileModalHtml = `
            <div class="modal" id="editProfileModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Profile</h3>
                        <button class="close-btn" onclick="Modals.close('editProfileModal')">&times;</button>
                    </div>
                    <div id="editProfileError"></div>
                    <form id="editProfileForm" data-handler="edit-profile">
                        <div class="form-group">
                            <label for="editProfilePicture">Profile Picture URL</label>
                            <input type="url" id="editProfilePicture" name="profilePicture" placeholder="https://example.com/your-picture.jpg">
                            <small>Enter a URL to an image you'd like to use as your profile picture</small>
                        </div>
                        <div class="form-group">
                            <label for="editProfileBio">Bio</label>
                            <textarea id="editProfileBio" name="bio" placeholder="Tell people about yourself..." maxlength="${CONFIG.MAX_BIO_LENGTH}"></textarea>
                            <small>Describe yourself in ${CONFIG.MAX_BIO_LENGTH} characters or less</small>
                        </div>
                        <div class="form-group">
                            <small style="color: var(--fg-subtle);">
                                <strong>Tip:</strong> For profile pictures, you can use image hosting services like Imgur, or link directly to images from social media profiles.
                            </small>
                        </div>
                        <button type="submit" class="btn" id="editProfileSubmitBtn">Update Profile</button>
                    </form>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', editProfileModalHtml);
    }

    createImageInsertModal() {
        const container = document.getElementById('modals-container');
        const imageInsertModalHtml = `
            <div class="modal" id="imageInsertModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Insert Image</h3>
                        <button class="close-btn" onclick="Modals.close('imageInsertModal')">&times;</button>
                    </div>
                    <form id="imageInsertForm" onsubmit="MarkdownToolbar.handleImageInsert(event)">
                        <div class="form-group">
                            <label for="imageUrl">Image URL</label>
                            <input type="url" id="imageUrl" placeholder="https://example.com/image.jpg" required>
                            <small>Enter a direct link to an image (jpg, png, gif, webp)</small>
                        </div>
                        <div class="form-group">
                            <label for="imageAltText">Alt Text (Optional)</label>
                            <input type="text" id="imageAltText" placeholder="Description of the image" maxlength="200">
                            <small>Describes the image for accessibility and if the image fails to load</small>
                        </div>
                        <div class="form-group">
                            <label for="imageTitle">Title (Optional)</label>
                            <input type="text" id="imageTitle" placeholder="Image title" maxlength="200">
                            <small>Shows as a tooltip when hovering over the image</small>
                        </div>
                        <button type="submit" class="btn">Insert Image</button>
                    </form>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', imageInsertModalHtml);
    }

    createLinkInsertModal() {
        const container = document.getElementById('modals-container');
        const linkInsertModalHtml = `
            <div class="modal" id="linkInsertModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Insert Link</h3>
                        <button class="close-btn" onclick="Modals.close('linkInsertModal')">&times;</button>
                    </div>
                    <form id="linkInsertForm" onsubmit="MarkdownToolbar.handleLinkInsert(event)">
                        <div class="form-group">
                            <label for="linkUrl">URL</label>
                            <input type="url" id="linkUrl" placeholder="https://example.com" required>
                            <small>The web address you want to link to</small>
                        </div>
                        <div class="form-group">
                            <label for="linkText">Link Text</label>
                            <input type="text" id="linkText" placeholder="Click here" maxlength="200" required>
                            <small>The text that will be clickable</small>
                        </div>
                        <button type="submit" class="btn">Insert Link</button>
                    </form>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', linkInsertModalHtml);
    }

    createMarkdownToolbar() {
        return `
            <div class="markdown-toolbar">
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('**', '**', 'Bold text')" title="Bold">
                    <strong>B</strong>
                </button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('*', '*', 'Italic text')" title="Italic">
                    <em>I</em>
                </button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('`', '`', 'Code')" title="Inline Code">
                    <code>&lt;/&gt;</code>
                </button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('```\\n', '\\n```', 'Code block')" title="Code Block">
                    <span>{ }</span>
                </button>
                <div class="toolbar-divider"></div>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('# ', '', 'Heading 1')" title="Heading 1">H1</button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('## ', '', 'Heading 2')" title="Heading 2">H2</button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('### ', '', 'Heading 3')" title="Heading 3">H3</button>
                <div class="toolbar-divider"></div>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('> ', '', 'Quote text')" title="Quote"><span>"</span></button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('- ', '', 'List item')" title="Bullet List">•</button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('1. ', '', 'List item')" title="Numbered List">1.</button>
                <div class="toolbar-divider"></div>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertLink()" title="Add Link">🔗</button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertImage()" title="Add Image">🖼️</button>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.insertMarkdown('~~', '~~', 'Strikethrough text')" title="Strikethrough"><s>S</s></button>
                <div class="toolbar-divider"></div>
                <button type="button" class="markdown-btn" onclick="MarkdownToolbar.previewMarkdown()" title="Preview" id="previewBtn">👁️</button>
            </div>
        `;
    }

    createMarkdownPreview() {
        return `
            <div id="markdownPreview" class="markdown-preview" style="display: none;">
                <div class="preview-header">
                    <span>Preview:</span>
                    <button type="button" class="btn-small" onclick="MarkdownToolbar.hidePreview()">Edit</button>
                </div>
                <div id="previewContent" class="markdown-content"></div>
            </div>
        `;
    }
}

// Create global modals instance
const Modals = new ModalManager();