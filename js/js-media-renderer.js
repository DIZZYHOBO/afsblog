// js/media-renderer.js - Media Detection and Rendering Component
class MediaRenderer {
    // Render media from URL
    static renderFromUrl(url) {
        if (!url) return null;

        const mediaType = this.detectMediaType(url);
        
        switch (mediaType.type) {
            case 'youtube':
                return this.renderYouTubeEmbed(mediaType.id);
            case 'dailymotion':
                return this.renderDailymotionEmbed(mediaType.id);
            case 'suno':
                return this.renderSunoEmbed(mediaType.id, url);
            case 'image':
                return this.renderImage(url);
            case 'video':
                return this.renderVideo(url);
            case 'audio':
                return this.renderAudio(url);
            case 'website':
                return this.renderWebsitePreview(url);
            default:
                return null;
        }
    }

    // Detect media type from URL
    static detectMediaType(url) {
        if (!url) return { type: 'unknown' };

        // YouTube
        const youtubeMatch = url.match(CONFIG.MEDIA_PATTERNS.YOUTUBE);
        if (youtubeMatch) {
            return { type: 'youtube', id: youtubeMatch[1] };
        }

        // Dailymotion
        const dailymotionMatch = url.match(CONFIG.MEDIA_PATTERNS.DAILYMOTION);
        if (dailymotionMatch) {
            return { type: 'dailymotion', id: dailymotionMatch[1] };
        }

        // Suno
        const sunoMatch = url.match(CONFIG.MEDIA_PATTERNS.SUNO);
        if (sunoMatch) {
            return { type: 'suno', id: sunoMatch[1] };
        }

        // Direct media files
        if (CONFIG.MEDIA_PATTERNS.IMAGE.test(url)) {
            return { type: 'image' };
        }

        if (CONFIG.MEDIA_PATTERNS.VIDEO.test(url)) {
            return { type: 'video' };
        }

        if (CONFIG.MEDIA_PATTERNS.AUDIO.test(url)) {
            return { type: 'audio' };
        }

        // General website
        if (CONFIG.VALIDATION.URL.test(url)) {
            return { type: 'website' };
        }

        return { type: 'unknown' };
    }

    // Render YouTube embed
    static renderYouTubeEmbed(videoId) {
        return `
            <div class="media-embed youtube-embed" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; overflow: hidden; border-radius: 8px;">
                <iframe src="https://www.youtube.com/embed/${videoId}" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
                        allowfullscreen
                        loading="lazy"
                        title="YouTube video player"></iframe>
            </div>
        `;
    }

    // Render Dailymotion embed
    static renderDailymotionEmbed(videoId) {
        return `
            <div class="media-embed dailymotion-embed" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; overflow: hidden; border-radius: 8px;">
                <iframe src="https://www.dailymotion.com/embed/video/${videoId}" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
                        allowfullscreen
                        loading="lazy"
                        title="Dailymotion video player"></iframe>
            </div>
        `;
    }

    // Render Suno embed (custom card since they don't have iframe embeds)
    static renderSunoEmbed(songId, url) {
        return `
            <div class="media-embed suno-embed" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; color: white; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">🎵</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Suno AI Music</div>
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">Listen to this AI-generated song</div>
                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                   style="background: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 10px 20px; border-radius: 25px; display: inline-block; font-weight: 500; transition: background 0.2s;"
                   onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    🎧 Play on Suno
                </a>
            </div>
        `;
    }

    // Render image
    static renderImage(url) {
        return `
            <div class="media-embed image-embed">
                <img src="${url}" 
                     style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer; transition: transform 0.2s;" 
                     onclick="MediaRenderer.openImageModal('${url}')" 
                     onmouseover="this.style.transform='scale(1.02)'"
                     onmouseout="this.style.transform='scale(1)'"
                     alt="Image"
                     loading="lazy">
            </div>
        `;
    }

    // Render video
    static renderVideo(url) {
        return `
            <div class="media-embed video-embed">
                <video src="${url}" 
                       style="width: 100%; max-height: 400px; border-radius: 8px;" 
                       controls
                       preload="metadata">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    }

    // Render audio
    static renderAudio(url) {
        return `
            <div class="media-embed audio-embed" style="background: var(--bg-subtle); border-radius: 8px; padding: 16px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div style="font-size: 24px;">🎵</div>
                    <div>
                        <div style="font-weight: 600; color: var(--fg-default);">Audio File</div>
                        <div style="font-size: 12px; color: var(--fg-muted);">${this.getFileNameFromUrl(url)}</div>
                    </div>
                </div>
                <audio src="${url}" 
                       style="width: 100%;" 
                       controls
                       preload="metadata">
                    Your browser does not support the audio tag.
                </audio>
            </div>
        `;
    }

    // Render website preview
    static renderWebsitePreview(url) {
        const domain = this.getDomainFromUrl(url);
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        
        return `
            <div class="media-embed website-embed">
                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                   style="display: block; text-decoration: none; background: var(--bg-subtle); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; transition: all 0.2s; color: inherit;"
                   onmouseover="this.style.background='var(--btn-secondary-hover-bg)'; this.style.borderColor='var(--accent-emphasis)'"
                   onmouseout="this.style.background='var(--bg-subtle)'; this.style.borderColor='var(--border-default)'">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <img src="${favicon}" 
                             style="width: 32px; height: 32px; border-radius: 4px; flex-shrink: 0;" 
                             alt="Website favicon"
                             onerror="this.style.display='none'">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--fg-default); margin-bottom: 4px;">🔗 ${domain}</div>
                            <div style="font-size: 12px; color: var(--fg-muted); word-break: break-all;">${url}</div>
                        </div>
                        <div style="color: var(--accent-fg); font-size: 18px;">↗</div>
                    </div>
                </a>
            </div>
        `;
    }

    // Open image in modal
    static openImageModal(imageUrl) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('imageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'imageModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 90vw; max-height: 90vh; padding: 0; background: transparent; border: none; box-shadow: none;">
                    <button class="close-btn" onclick="MediaRenderer.closeImageModal()" style="position: absolute; top: 20px; right: 20px; z-index: 1001; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer;">&times;</button>
                    <img id="modalImage" style="max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.8);" alt="Full size image">
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        const modalImage = document.getElementById('modalImage');
        modalImage.src = imageUrl;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    // Close image modal
    static closeImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    // Utility functions
    static getDomainFromUrl(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'External Link';
        }
    }

    static getFileNameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            return pathname.split('/').pop() || 'Audio File';
        } catch {
            return 'Audio File';
        }
    }

    // Check if URL is embeddable
    static isEmbeddable(url) {
        const mediaType = this.detectMediaType(url);
        return mediaType.type !== 'unknown';
    }

    // Get media info for API
    static getMediaInfo(url) {
        const mediaType = this.detectMediaType(url);
        
        return {
            type: mediaType.type,
            isEmbeddable: mediaType.type !== 'unknown',
            platform: this.getPlatformName(mediaType.type),
            id: mediaType.id || null,
            domain: mediaType.type === 'website' ? this.getDomainFromUrl(url) : null
        };
    }

    static getPlatformName(type) {
        const platformNames = {
            'youtube': 'YouTube',
            'dailymotion': 'Dailymotion',
            'suno': 'Suno AI',
            'image': 'Image',
            'video': 'Video',
            'audio': 'Audio',
            'website': 'Website'
        };
        return platformNames[type] || 'Unknown';
    }

    // Preload media for better performance
    static preloadMedia(url) {
        const mediaType = this.detectMediaType(url);
        
        if (mediaType.type === 'image') {
            const img = new Image();
            img.src = url;
        } else if (mediaType.type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.preload = 'metadata';
        } else if (mediaType.type === 'audio') {
            const audio = new Audio();
            audio.src = url;
            audio.preload = 'metadata';
        }
    }

    // Generate thumbnail URL for videos (if possible)
    static getThumbnailUrl(url) {
        const mediaType = this.detectMediaType(url);
        
        if (mediaType.type === 'youtube') {
            return `https://img.youtube.com/vi/${mediaType.id}/mqdefault.jpg`;
        } else if (mediaType.type === 'dailymotion') {
            return `https://www.dailymotion.com/thumbnail/video/${mediaType.id}`;
        }
        
        return null;
    }
}