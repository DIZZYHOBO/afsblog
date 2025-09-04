// utils.js - Utility functions and helpers

// PROTECTED_ADMIN constant - matches the API
const PROTECTED_ADMIN = "dumbass";

// Utility functions
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
    return date.toLocaleDateString();
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(elementId, message) {
    document.getElementById(elementId).innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '80px';
    successDiv.style.right = '20px';
    successDiv.style.zIndex = '1000';
    successDiv.style.borderRadius = '8px';
    successDiv.style.boxShadow = 'var(--overlay-shadow)';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 4000);
}

// Enhanced detectMediaType function
function detectMediaType(url) {
    if (!url) return { type: 'text', embed: false, platform: null };

    // YouTube
    if (url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)/)) {
        return { type: 'video', embed: true, platform: 'youtube' };
    }

    // Dailymotion
    if (url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)/)) {
        return { type: 'video', embed: true, platform: 'dailymotion' };
    }

    // Suno
    if (url.match(/suno\.com\/song\//)) {
        return { type: 'audio', embed: true, platform: 'suno' };
    }

    // Direct media files
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
        return { type: 'image', embed: true, platform: 'direct' };
    }

    if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
        return { type: 'video', embed: true, platform: 'direct' };
    }

    if (url.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i)) {
        return { type: 'audio', embed: true, platform: 'direct' };
    }

    // General website
    if (url.match(/^https?:\/\/.+/i)) {
        return { type: 'website', embed: true, platform: 'web' };
    }

    return { type: 'link', embed: false, platform: null };
}

// Enhanced media detection using API
async function detectMediaTypeAPI(url) {
    try {
        const response = await fetch('/.netlify/functions/api/media/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (response.ok) {
            const result = await response.json();
            return result;
        } else {
            throw new Error('API detection failed');
        }
    } catch (error) {
        console.error('Media detection API error:', error);
        // Fallback to local detection
        return detectMediaType(url);
    }
}

// Markdown toolbar functionality
let currentTextarea = null;

function insertMarkdown(prefix, suffix, placeholder) {
    const textarea = document.getElementById('postContent');
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

function insertImage() {
    // Reset the form
    document.getElementById('imageInsertForm').reset();
    currentTextarea = document.getElementById('postContent');
    openModal('imageInsertModal');
}

function handleImageInsert(e) {
    e.preventDefault();
    
    const url = document.getElementById('imageUrl').value.trim();
    const alt = document.getElementById('imageAltText').value.trim() || 'Image';
    const title = document.getElementById('imageTitle').value.trim();
    
    if (!url) {
        showSuccessMessage('Please enter an image URL');
        return;
    }
    
    // Validate URL format
    try {
        new URL(url);
    } catch {
        showSuccessMessage('Please enter a valid URL');
        return;
    }
    
    let markdown = `![${alt}](${url}`;
    if (title) {
        markdown += ` "${title}"`;
    }
    markdown += ')';
    
    if (currentTextarea) {
        const start = currentTextarea.selectionStart;
        const end = currentTextarea.selectionEnd;
        
        const newText = currentTextarea.value.substring(0, start) + 
                       markdown + 
                       currentTextarea.value.substring(end);
        
        currentTextarea.value = newText;
        currentTextarea.focus();
        currentTextarea.setSelectionRange(start + markdown.length, start + markdown.length);
        currentTextarea.dispatchEvent(new Event('input'));
    }
    
    closeModal('imageInsertModal');
    showSuccessMessage('Image inserted successfully!');
}

function insertLink() {
    // Reset the form
    document.getElementById('linkInsertForm').reset();
    currentTextarea = document.getElementById('postContent');
    
    // Pre-fill with selected text if any
    const start = currentTextarea.selectionStart;
    const end = currentTextarea.selectionEnd;
    const selectedText = currentTextarea.value.substring(start, end);
    
    if (selectedText) {
        document.getElementById('linkText').value = selectedText;
    }
    
    openModal('linkInsertModal');
}

function handleLinkInsert(e) {
    e.preventDefault();
    
    const url = document.getElementById('linkUrl').value.trim();
    const text = document.getElementById('linkText').value.trim();
    
    if (!url || !text) {
        showSuccessMessage('Please enter both URL and link text');
        return;
    }
    
    // Validate URL format
    try {
        new URL(url);
    } catch {
        showSuccessMessage('Please enter a valid URL');
        return;
    }
    
    const markdown = `[${text}](${url})`;
    
    if (currentTextarea) {
        const start = currentTextarea.selectionStart;
        const end = currentTextarea.selectionEnd;
        
        const newText = currentTextarea.value.substring(0, start) + 
                       markdown + 
                       currentTextarea.value.substring(end);
        
        currentTextarea.value = newText;
        currentTextarea.focus();
        currentTextarea.setSelectionRange(start + markdown.length, start + markdown.length);
        currentTextarea.dispatchEvent(new Event('input'));
    }
    
    closeModal('linkInsertModal');
    showSuccessMessage('Link inserted successfully!');
}

function previewMarkdown() {
    const textarea = document.getElementById('postContent');
    const preview = document.getElementById('markdownPreview');
    const previewContent = document.getElementById('previewContent');
    const previewBtn = document.getElementById('previewBtn');
    
    if (!textarea.value.trim()) {
        showSuccessMessage('Write some content to preview');
        return;
    }
    
    if (preview.style.display === 'none') {
        // Show preview
        const html = renderMarkdown(textarea.value);
        previewContent.innerHTML = html;
        preview.style.display = 'block';
        textarea.style.display = 'none';
        previewBtn.textContent = '✏️';
        previewBtn.title = 'Edit';
    } else {
        // Hide preview
        hidePreview();
    }
}

function hidePreview() {
    const textarea = document.getElementById('postContent');
    const preview = document.getElementById('markdownPreview');
    const previewBtn = document.getElementById('previewBtn');
    
    preview.style.display = 'none';
    textarea.style.display = 'block';
    previewBtn.textContent = '👁️';
    previewBtn.title = 'Preview';
    textarea.focus();
}
