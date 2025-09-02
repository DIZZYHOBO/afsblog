// js/markdown.js - Markdown Processing and Toolbar Component
class MarkdownToolbar {
    constructor() {
        this.currentTextarea = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle toolbar button clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.markdown-btn')) {
                const textarea = this.findAssociatedTextarea(e.target);
                if (textarea) {
                    this.currentTextarea = textarea;
                }
            }
        });

        // Auto-save current textarea when focused
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('textarea[id*="Content"], textarea[id*="Description"]')) {
                this.currentTextarea = e.target;
            }
        });
    }

    // Find the textarea associated with a toolbar button
    findAssociatedTextarea(button) {
        const toolbar = button.closest('.markdown-toolbar');
        if (toolbar) {
            const nextElement = toolbar.nextElementSibling;
            if (nextElement && nextElement.tagName === 'TEXTAREA') {
                return nextElement;
            }
        }
        return null;
    }

    // Insert markdown formatting around selected text
    static insertMarkdown(prefix, suffix, placeholder) {
        const toolbar = new MarkdownToolbar();
        const textarea = toolbar.currentTextarea || document.getElementById('postContent');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const replacement = selectedText || placeholder;
        
        const newText = textarea.value.substring(0, start) + 
                       prefix + replacement + suffix + 
                       textarea.value.substring(end);
        
        textarea.value = newText;
        
        // Set cursor position
        const newCursorPos = start + prefix.length + replacement.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event for any listeners
        textarea.dispatchEvent(new Event('input'));
    }

    // Insert image markdown
    static insertImage() {
        const toolbar = new MarkdownToolbar();
        toolbar.currentTextarea = document.getElementById('postContent');
        Modals.open('imageInsertModal');
    }

    // Handle image insertion from modal
    static handleImageInsert(e) {
        e.preventDefault();
        
        const url = document.getElementById('imageUrl').value.trim();
        const alt = document.getElementById('imageAltText').value.trim() || 'Image';
        const title = document.getElementById('imageTitle').value.trim();
        
        if (!url) {
            Utils.showSuccessMessage('Please enter an image URL');
            return;
        }
        
        // Validate URL format
        if (!Utils.isValidUrl(url)) {
            Utils.showSuccessMessage('Please enter a valid URL');
            return;
        }
        
        let markdown = `![${alt}](${url}`;
        if (title) {
            markdown += ` "${title}"`;
        }
        markdown += ')';
        
        const toolbar = new MarkdownToolbar();
        if (toolbar.currentTextarea) {
            const start = toolbar.currentTextarea.selectionStart;
            const end = toolbar.currentTextarea.selectionEnd;
            
            const newText = toolbar.currentTextarea.value.substring(0, start) + 
                           markdown + 
                           toolbar.currentTextarea.value.substring(end);
            
            toolbar.currentTextarea.value = newText;
            toolbar.currentTextarea.focus();
            toolbar.currentTextarea.setSelectionRange(start + markdown.length, start + markdown.length);
            toolbar.currentTextarea.dispatchEvent(new Event('input'));
        }
        
        Modals.close('imageInsertModal');
        Utils.showSuccessMessage('Image inserted successfully!');
    }

    // Insert link markdown
    static insertLink() {
        const toolbar = new MarkdownToolbar();
        toolbar.currentTextarea = document.getElementById('postContent');
        
        // Pre-fill with selected text if any
        const start = toolbar.currentTextarea.selectionStart;
        const end = toolbar.currentTextarea.selectionEnd;
        const selectedText = toolbar.currentTextarea.value.substring(start, end);
        
        if (selectedText) {
            document.getElementById('linkText').value = selectedText;
        }
        
        Modals.open('linkInsertModal');
    }

    // Handle link insertion from modal
    static handleLinkInsert(e) {
        e.preventDefault();
        
        const url = document.getElementById('linkUrl').value.trim();
        const text = document.getElementById('linkText').value.trim();
        
        if (!url || !text) {
            Utils.showSuccessMessage('Please enter both URL and link text');
            return;
        }
        
        // Validate URL format
        if (!Utils.isValidUrl(url)) {
            Utils.showSuccessMessage('Please enter a valid URL');
            return;
        }
        
        const markdown = `[${text}](${url})`;
        
        const toolbar = new MarkdownToolbar();
        if (toolbar.currentTextarea) {
            const start = toolbar.currentTextarea.selectionStart;
            const end = toolbar.currentTextarea.selectionEnd;
            
            const newText = toolbar.currentTextarea.value.substring(0, start) + 
                           markdown + 
                           toolbar.currentTextarea.value.substring(end);
            
            toolbar.currentTextarea.value = newText;
            toolbar.currentTextarea.focus();
            toolbar.currentTextarea.setSelectionRange(start + markdown.length, start + markdown.length);
            toolbar.currentTextarea.dispatchEvent(new Event('input'));
        }
        
        Modals.close('linkInsertModal');
        Utils.showSuccessMessage('Link inserted successfully!');
    }

    // Preview markdown content
    static previewMarkdown() {
        const textarea = document.getElementById('postContent');
        const preview = document.getElementById('markdownPreview');
        const previewContent = document.getElementById('previewContent');
        const previewBtn = document.getElementById('previewBtn');
        
        if (!textarea || !preview || !previewContent || !previewBtn) return;
        
        if (!textarea.value.trim()) {
            Utils.showSuccessMessage('Write some content to preview');
            return;
        }
        
        if (preview.style.display === 'none') {
            // Show preview
            const html = MarkdownProcessor.render(textarea.value);
            previewContent.innerHTML = html;
            preview.style.display = 'block';
            textarea.style.display = 'none';
            previewBtn.textContent = '✏️';
            previewBtn.title = 'Edit';
        } else {
            // Hide preview
            MarkdownToolbar.hidePreview();
        }
    }

    // Hide markdown preview
    static hidePreview() {
        const textarea = document.getElementById('postContent');
        const preview = document.getElementById('markdownPreview');
        const previewBtn = document.getElementById('previewBtn');
        
        if (!textarea || !preview || !previewBtn) return;
        
        preview.style.display = 'none';
        textarea.style.display = 'block';
        previewBtn.textContent = '👁️';
        previewBtn.title = 'Preview';
        textarea.focus();
    }

    // Insert table template
    static insertTable() {
        const tableMarkdown = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`.trim();

        this.insertMarkdown('', '', tableMarkdown);
    }

    // Insert horizontal rule
    static insertHorizontalRule() {
        this.insertMarkdown('\n---\n', '', '');
    }

    // Insert task list item
    static insertTaskList() {
        this.insertMarkdown('- [ ] ', '', 'Task item');
    }
}

// Markdown processing utility
class MarkdownProcessor {
    static render(text) {
        if (!text) return '';
        
        try {
            if (typeof marked === 'undefined') {
                console.warn('Marked.js not available, returning plain text');
                return Utils.escapeHtml(text);
            }

            const html = marked.parse(text);
            
            // Use DOMPurify if available for security
            if (typeof DOMPurify !== 'undefined') {
                return DOMPurify.sanitize(html, {
                    ALLOWED_TAGS: [
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                        'p', 'br', 'strong', 'em', 'u', 's', 'del',
                        'a', 'img', 'code', 'pre', 'blockquote',
                        'ul', 'ol', 'li', 'table', 'thead', 'tbody',
                        'tr', 'th', 'td', 'hr'
                    ],
                    ALLOWED_ATTR: [
                        'href', 'title', 'alt', 'src', 'target', 'rel',
                        'class', 'id'
                    ]
                });
            } else {
                console.warn('DOMPurify not available, returning unsanitized HTML');
                return html;
            }
        } catch (error) {
            console.error('Markdown rendering error:', error);
            return Utils.escapeHtml(text);
        }
    }

    // Extract plain text from markdown (for summaries, etc.)
    static toPlainText(markdown) {
        if (!markdown) return '';
        
        try {
            // Simple markdown stripping - remove common markdown syntax
            return markdown
                .replace(/#+\s/g, '') // Headers
                .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
                .replace(/\*(.*?)\*/g, '$1') // Italic
                .replace(/`(.*?)`/g, '$1') // Inline code
                .replace(/```[\s\S]*?```/g, '') // Code blocks
                .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
                .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Images
                .replace(/>/g, '') // Blockquotes
                .replace(/[-*+]\s/g, '') // List items
                .replace(/\n+/g, ' ') // Multiple newlines to spaces
                .trim();
        } catch (error) {
            console.error('Error converting markdown to plain text:', error);
            return markdown;
        }
    }

    // Get markdown summary (first few words)
    static getSummary(markdown, maxWords = 20) {
        const plainText = this.toPlainText(markdown);
        const words = plainText.split(/\s+/);
        
        if (words.length <= maxWords) {
            return plainText;
        }
        
        return words.slice(0, maxWords).join(' ') + '...';
    }

    // Validate markdown for common issues
    static validate(markdown) {
        const issues = [];
        
        if (!markdown || markdown.trim().length === 0) {
            issues.push('Content cannot be empty');
            return issues;
        }
        
        // Check for unclosed markdown syntax
        const boldCount = (markdown.match(/\*\*/g) || []).length;
        if (boldCount % 2 !== 0) {
            issues.push('Unclosed bold formatting (**)');
        }
        
        const italicCount = (markdown.match(/(?<!\*)\*(?!\*)/g) || []).length;
        if (italicCount % 2 !== 0) {
            issues.push('Unclosed italic formatting (*)');
        }
        
        const codeCount = (markdown.match(/`/g) || []).length;
        if (codeCount % 2 !== 0) {
            issues.push('Unclosed inline code formatting (`)');
        }
        
        // Check for malformed links
        const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(markdown)) !== null) {
            const [, text, url] = linkMatch;
            if (!text.trim()) {
                issues.push('Link text cannot be empty');
            }
            if (!url.trim()) {
                issues.push('Link URL cannot be empty');
            }
        }
        
        return issues;
    }
}