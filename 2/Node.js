#!/usr/bin/env node

/**
 * PieFed Proxy Server
 * This server acts as a backend for the PieFed client, handling authentication
 * and proxying requests to bypass CORS restrictions.
 * 
 * To run: 
 * 1. npm install express cors body-parser cookie-parser node-fetch cheerio form-data
 * 2. node piefed-proxy-server.js
 * 3. Open piefed-client.html and it will connect to this server
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const FormData = require('form-data');
const https = require('https');
const { URLSearchParams } = require('url');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Store sessions (in production, use Redis or a database)
const sessions = new Map();

// Helper function to create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Helper to maintain cookies per session
class SessionManager {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.cookies = new Map();
        this.instance = 'https://piefed.social';
        this.username = null;
        this.csrfToken = null;
    }

    // Parse and store cookies from response
    storeCookies(response) {
        const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
        setCookieHeaders.forEach(cookie => {
            const [nameValue, ...attributes] = cookie.split(';');
            const [name, value] = nameValue.trim().split('=');
            this.cookies.set(name, value);
        });
    }

    // Get cookie string for requests
    getCookieString() {
        return Array.from(this.cookies.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }
}

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { instance, username, password, totp } = req.body;
    
    if (!instance || !username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sessionId = Math.random().toString(36).substring(7);
    const session = new SessionManager(sessionId);
    session.instance = instance.replace(/\/$/, '');
    session.username = username;

    try {
        // Step 1: Get login page to extract CSRF token
        const loginPageResponse = await fetch(`${session.instance}/user/login`, {
            method: 'GET',
            headers: {
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        const loginPageHtml = await loginPageResponse.text();
        const $ = cheerio.load(loginPageHtml);
        
        // Extract CSRF token
        session.csrfToken = $('input[name="csrf_token"]').val() || 
                           $('meta[name="csrf-token"]').attr('content') || '';

        // Store initial cookies
        session.storeCookies(loginPageResponse);

        // Step 2: Submit login form
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        if (session.csrfToken) {
            formData.append('csrf_token', session.csrfToken);
        }
        if (totp) {
            formData.append('totp', totp);
        }

        const loginResponse = await fetch(`${session.instance}/user/login`, {
            method: 'POST',
            body: formData,
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0',
                'Referer': `${session.instance}/user/login`
            },
            redirect: 'manual',
            agent: httpsAgent
        });

        // Check if login was successful
        if (loginResponse.status === 302 || loginResponse.status === 303) {
            // Login successful - follow redirect to get final cookies
            session.storeCookies(loginResponse);
            
            const redirectUrl = loginResponse.headers.get('location');
            if (redirectUrl) {
                const finalResponse = await fetch(
                    redirectUrl.startsWith('http') ? redirectUrl : `${session.instance}${redirectUrl}`,
                    {
                        headers: {
                            'Cookie': session.getCookieString(),
                            'User-Agent': 'PieFed Mobile Client/1.0'
                        },
                        agent: httpsAgent
                    }
                );
                session.storeCookies(finalResponse);
            }

            // Store session
            sessions.set(sessionId, session);

            res.json({
                success: true,
                sessionId: sessionId,
                username: username,
                instance: session.instance
            });
        } else {
            // Login failed
            const responseText = await loginResponse.text();
            const $error = cheerio.load(responseText);
            const errorMessage = $error('.alert-danger, .error, .message').text().trim() || 
                                'Login failed. Please check your credentials.';
            
            res.status(401).json({
                success: false,
                error: errorMessage
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login: ' + error.message
        });
    }
});

// Get posts
app.get('/api/posts', async (req, res) => {
    const { sessionId, feed = 'all', sort = 'hot', page = 1, community } = req.query;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        let url = session.instance;
        
        if (community) {
            url += `/c/${community}`;
        }
        
        if (feed === 'local') {
            url += '/local';
        } else if (feed === 'all') {
            url += '/all';
        }
        
        if (sort === 'new') {
            url += '/new';
        } else if (sort === 'top') {
            url += '/top';
        } else if (sort === 'active') {
            url += '/active';
        }
        
        if (page > 1) {
            url += `?page=${page}`;
        }

        const response = await fetch(url, {
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        const html = await response.text();
        const $ = cheerio.load(html);
        
        const posts = [];
        
        // Parse posts from HTML
        $('article, .post-listing, .entry, div[class*="post"]').each((i, elem) => {
            const $elem = $(elem);
            
            const titleLink = $elem.find('h2 a, h3 a, .post-title a, a.title').first();
            const title = titleLink.text().trim();
            const postUrl = titleLink.attr('href');
            
            if (!title) return;
            
            const bodyText = $elem.find('.post-body, .content, .description, p').first().text().trim();
            const author = $elem.find('.author, .submitted-by, .post-author').text().replace(/by|submitted/gi, '').trim();
            const community = $elem.find('.community, .community-link').text().trim();
            const score = parseInt($elem.find('.score, .points, .votes').text()) || 0;
            const comments = parseInt($elem.find('.comments, .comment-count').text()) || 0;
            const timeElem = $elem.find('time, .time, .date');
            const published = timeElem.attr('datetime') || timeElem.text();
            
            // Extract image if present
            const image = $elem.find('img').first().attr('src');
            
            // Extract external URL if it's a link post
            const externalLink = $elem.find('a.external-link, a[rel="nofollow"]').attr('href');
            
            posts.push({
                id: postUrl,
                title: title,
                body: bodyText,
                url: externalLink,
                thumbnail_url: image,
                community: community || 'unknown',
                author: author || 'anonymous',
                published: published,
                score: score,
                comments: comments,
                postUrl: postUrl.startsWith('http') ? postUrl : `${session.instance}${postUrl}`
            });
        });

        res.json({ posts });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts: ' + error.message });
    }
});

// Get communities
app.get('/api/communities', async (req, res) => {
    const { sessionId } = req.query;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const response = await fetch(`${session.instance}/communities`, {
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        const html = await response.text();
        const $ = cheerio.load(html);
        
        const communities = [];
        
        // Parse communities
        $('.community-list-item, .community-card, div[class*="community"], tr').each((i, elem) => {
            const $elem = $(elem);
            
            const nameLink = $elem.find('a[href*="/c/"], .community-name, h3, h4').first();
            const name = nameLink.text().trim().replace(/^!/, '').replace(/@.*$/, '');
            const link = nameLink.attr('href');
            
            if (!name) return;
            
            const description = $elem.find('.description, .community-description, p').first().text().trim();
            const subscribers = parseInt($elem.text().match(/(\d+)\s*(subscribers?|members?)/i)?.[1]) || 0;
            const posts = parseInt($elem.text().match(/(\d+)\s*posts?/i)?.[1]) || 0;
            const comments = parseInt($elem.text().match(/(\d+)\s*comments?/i)?.[1]) || 0;
            
            communities.push({
                id: name,
                name: name,
                description: description,
                subscribers: subscribers,
                posts: posts,
                comments: comments,
                link: link
            });
        });

        res.json({ communities });
    } catch (error) {
        console.error('Error fetching communities:', error);
        res.status(500).json({ error: 'Failed to fetch communities: ' + error.message });
    }
});

// Create post
app.post('/api/post', async (req, res) => {
    const { sessionId, community, title, body, url, nsfw } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // First get the create post page to extract CSRF token
        const createPageResponse = await fetch(`${session.instance}/c/${community}/create_post`, {
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        const createPageHtml = await createPageResponse.text();
        const $ = cheerio.load(createPageHtml);
        const csrfToken = $('input[name="csrf_token"]').val() || session.csrfToken;

        // Submit the post
        const formData = new FormData();
        formData.append('title', title);
        if (body) formData.append('body', body);
        if (url) formData.append('url', url);
        if (nsfw) formData.append('nsfw', 'true');
        if (csrfToken) formData.append('csrf_token', csrfToken);

        const postResponse = await fetch(`${session.instance}/c/${community}/create_post`, {
            method: 'POST',
            body: formData,
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0',
                'Referer': `${session.instance}/c/${community}/create_post`
            },
            redirect: 'manual',
            agent: httpsAgent
        });

        if (postResponse.status === 302 || postResponse.status === 303) {
            res.json({ success: true, message: 'Post created successfully' });
        } else {
            const responseText = await postResponse.text();
            const $error = cheerio.load(responseText);
            const errorMessage = $error('.alert-danger, .error').text().trim() || 'Failed to create post';
            res.status(400).json({ success: false, error: errorMessage });
        }
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Failed to create post: ' + error.message });
    }
});

// Get post with comments
app.get('/api/post/:postId', async (req, res) => {
    const { sessionId } = req.query;
    const { postId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const url = postId.startsWith('http') ? postId : `${session.instance}${postId}`;
        
        const response = await fetch(url, {
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Parse post details
        const post = {
            title: $('h1, .post-title').first().text().trim(),
            body: $('.post-content, .post-body, article .content').first().text().trim(),
            author: $('.post-author, .author').first().text().trim(),
            score: parseInt($('.post-score, .score').first().text()) || 0,
            published: $('time').first().attr('datetime') || $('time').first().text()
        };
        
        // Parse comments
        const comments = [];
        $('.comment, .comment-node').each((i, elem) => {
            const $elem = $(elem);
            const content = $elem.find('.comment-content, .comment-body').first().text().trim();
            const author = $elem.find('.comment-author, .author').first().text().trim();
            const score = parseInt($elem.find('.comment-score, .score').first().text()) || 0;
            const time = $elem.find('time').first().attr('datetime') || $elem.find('time').first().text();
            
            if (content) {
                comments.push({
                    id: i,
                    content: content,
                    author: author,
                    score: score,
                    published: time
                });
            }
        });
        
        res.json({ post, comments });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Failed to fetch post: ' + error.message });
    }
});

// Create comment
app.post('/api/comment', async (req, res) => {
    const { sessionId, postId, content, parentId } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const postUrl = postId.startsWith('http') ? postId : `${session.instance}${postId}`;
        
        // Get the post page to extract CSRF token
        const postResponse = await fetch(postUrl, {
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        const postHtml = await postResponse.text();
        const $ = cheerio.load(postHtml);
        const csrfToken = $('input[name="csrf_token"]').val() || session.csrfToken;

        // Submit comment
        const formData = new FormData();
        formData.append('content', content);
        if (parentId) formData.append('parent_id', parentId);
        if (csrfToken) formData.append('csrf_token', csrfToken);

        const commentResponse = await fetch(`${postUrl}/comment`, {
            method: 'POST',
            body: formData,
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0',
                'Referer': postUrl
            },
            redirect: 'manual',
            agent: httpsAgent
        });

        if (commentResponse.status === 302 || commentResponse.status === 303) {
            res.json({ success: true, message: 'Comment posted successfully' });
        } else {
            res.status(400).json({ success: false, error: 'Failed to post comment' });
        }
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ error: 'Failed to post comment: ' + error.message });
    }
});

// Vote on post or comment
app.post('/api/vote', async (req, res) => {
    const { sessionId, targetId, targetType, vote } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // PieFed uses different endpoints for voting
        const voteUrl = `${session.instance}/api/vote`;
        
        const formData = new FormData();
        formData.append('target_id', targetId);
        formData.append('target_type', targetType); // 'post' or 'comment'
        formData.append('vote', vote); // 1 for upvote, -1 for downvote, 0 for unvote
        if (session.csrfToken) formData.append('csrf_token', session.csrfToken);

        const response = await fetch(voteUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        if (response.ok) {
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, error: 'Failed to vote' });
        }
    } catch (error) {
        console.error('Error voting:', error);
        res.status(500).json({ error: 'Failed to vote: ' + error.message });
    }
});

// Subscribe/unsubscribe to community
app.post('/api/subscribe', async (req, res) => {
    const { sessionId, community, subscribe } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const action = subscribe ? 'subscribe' : 'unsubscribe';
        const url = `${session.instance}/c/${community}/${action}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Cookie': session.getCookieString(),
                'User-Agent': 'PieFed Mobile Client/1.0'
            },
            agent: httpsAgent
        });

        if (response.ok || response.status === 302) {
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, error: `Failed to ${action}` });
        }
    } catch (error) {
        console.error(`Error ${subscribe ? 'subscribing' : 'unsubscribing'}:`, error);
        res.status(500).json({ error: 'Failed to update subscription: ' + error.message });
    }
});

// Logout
app.post('/api/logout', async (req, res) => {
    const { sessionId } = req.body;
    sessions.delete(sessionId);
    res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
    console.log(`PieFed Proxy Server running on http://localhost:${PORT}`);
    console.log('\nTo use this server:');
    console.log('1. Make sure you have the required packages installed:');
    console.log('   npm install express cors body-parser cookie-parser node-fetch cheerio form-data');
    console.log('2. Open piefed-client.html in your browser');
    console.log('3. The client will automatically connect to this server');
    console.log('\nThe server handles:');
    console.log('- Authentication with PieFed instances');
    console.log('- Proxying all requests to bypass CORS');
    console.log('- Session management');
    console.log('- Full read/write access to PieFed features');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});
