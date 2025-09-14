// netlify/functions/piefed-posts.js
const fetch = require('node-fetch');
const cheerio = require('cheerio');

exports.handler = async (event) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { instance, feed, sort, community } = JSON.parse(event.body || '{}');
        const baseUrl = instance || 'https://piefed.social';
        
        // Build URL
        let url = baseUrl;
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
        }

        // Try RSS feed first
        const rssUrl = url + '.rss';
        try {
            const rssResponse = await fetch(rssUrl, {
                headers: { 'User-Agent': 'PieFed Mobile Client/1.0' }
            });
            
            if (rssResponse.ok) {
                const rssText = await rssResponse.text();
                const posts = parseRSS(rssText);
                if (posts.length > 0) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ posts })
                    };
                }
            }
        } catch (e) {
            console.log('RSS failed, trying HTML');
        }

        // Fallback to HTML parsing
        const response = await fetch(url, {
            headers: { 'User-Agent': 'PieFed Mobile Client/1.0' }
        });
        
        const html = await response.text();
        const posts = parseHTML(html, baseUrl);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ posts })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function parseRSS(xmlText) {
    const posts = [];
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    
    items.forEach((item, index) => {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
        const link = (item.match(/<link>(.*?)<\/link>/))?.[1] || '';
        const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || '';
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || '';
        const creator = (item.match(/<dc:creator>(.*?)<\/dc:creator>/) || item.match(/<creator>(.*?)<\/creator>/))?.[1] || 'anonymous';
        
        // Extract community from link
        const communityMatch = link.match(/\/c\/([^\/]+)/);
        const community = communityMatch ? communityMatch[1] : 'piefed';
        
        // Clean HTML from description
        const cleanDescription = description.replace(/<[^>]*>/g, '').substring(0, 500);
        
        posts.push({
            id: `post-${index}`,
            title: unescapeHtml(title),
            body: cleanDescription,
            url: null,
            community: community,
            author: creator,
            published: pubDate,
            score: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 50),
            postUrl: link
        });
    });
    
    return posts;
}

function parseHTML(html, baseUrl) {
    const $ = cheerio.load(html);
    const posts = [];
    
    // Try different selectors
    const selectors = ['article', '.post-listing', '.entry', 'div[class*="post"]'];
    let postElements = [];
    
    for (const selector of selectors) {
        postElements = $(selector).toArray();
        if (postElements.length > 0) break;
    }
    
    postElements.forEach((elem, index) => {
        const $elem = $(elem);
        
        const titleLink = $elem.find('h2 a, h3 a, .post-title a, a.title').first();
        const title = titleLink.text().trim();
        const postUrl = titleLink.attr('href');
        
        if (!title) return;
        
        const body = $elem.find('.post-body, .content, p').first().text().trim();
        const author = $elem.find('.author, .submitted-by').text().replace(/by|submitted/gi, '').trim();
        const community = $elem.find('.community').text().trim() || 'piefed';
        const score = parseInt($elem.find('.score, .points').text()) || 0;
        const comments = parseInt($elem.find('.comments').text()) || 0;
        
        posts.push({
            id: `post-${index}`,
            title: title,
            body: body.substring(0, 500),
            url: null,
            community: community,
            author: author || 'anonymous',
            published: new Date().toISOString(),
            score: score,
            comments: comments,
            postUrl: postUrl?.startsWith('http') ? postUrl : `${baseUrl}${postUrl}`
        });
    });
    
    return posts;
}

function unescapeHtml(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}
