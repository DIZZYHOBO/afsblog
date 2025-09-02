// js/markdown.js - Markdown Editor Helper
class MarkdownEditor {
    // Insert markdown at cursor position
    static insertAtCursor(textareaId, text) {
        const textarea = typeof textareaId === 'string' ? 
            document.getElementById(textareaId) : textareaId;
        
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        textarea.value = value.substring(0, start) + text + value.substring(end);
        
        // Set cursor position after inserted text
        const newCursorPos = start + text.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
    }

    // Insert markdown with start and end tags
    static insertMarkdown(textareaId, startTag, endTag = '') {
        const textarea = typeof textareaId === 'string' ? 
            document.getElementById(textareaId) : textareaId;
        
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        let insertText;
        if (selectedText) {
            // Wrap selected text
            insertText = startTag + selectedText + endTag;
        } else {
            // Insert placeholder
            insertText = startTag + 'text' + endTag;
        }

        this.insertAtCursor(textarea, insertText);
        
        // If no text was selected, select the placeholder
        if (!selectedText && endTag) {
            const newStart = start + startTag.length;
            const newEnd = newStart + 4; // length of 'text'
            textarea.selectionStart = newStart;
            textarea.selectionEnd = newEnd;
        }
    }

    // Preview markdown content
    static preview(markdownText) {
        try {
            let html = marked.parse(markdownText || '');
            return DOMPurify.sanitize(html);
        } catch (error) {
            console.error('Markdown preview error:', error);
            return '<p>Error rendering preview</p>';
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownEditor;
}
