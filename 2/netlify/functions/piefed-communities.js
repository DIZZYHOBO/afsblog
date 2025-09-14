// netlify/functions/piefed-communities.js
const fetch = require('node-fetch');
const cheerio = require('cheerio');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { instance } = JSON.parse(event.body || '{}');
        const baseUrl = instance || 'https://piefed.social';
        
        const response = await fetch(`${baseUrl}/communities`, {
            headers: { 'User-Agent': 'PieFed Mobile Client/1.0' }
        });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const communities = [];
        
        // Parse communities from HTML
        $('.community-list-item, .community-card, div[class*="community"], tr').each((i, elem) => {
            const $elem = $(elem);
            
            const nameLink = $elem.find('a[href*="/c/"]').first();
            const name = nameLink.text().trim().replace(/^!/, '').replace(/@.*$/, '');
            
            if (!name || name.length < 2) return;
            
            const description = $elem.find('.description, p').first().text().trim();
            const statsText = $elem.text();
            const subscribers = parseInt(statsText.match(/(\d+)\s*subscribers?/i)?.[1]) || 0;
            const posts = parseInt(statsText.match(/(\d+)\s*posts?/i)?.[1]) || 0;
            
            communities.push({
                id: name,
                name: name,
                description: description.substring(0, 200),
                subscribers: subscribers,
                posts: posts
            });
        });
        
        // If no communities found, return defaults
        if (communities.length === 0) {
            communities.push(
                { id: 'technology', name: 'technology', description: 'Technology discussions', subscribers: 1000, posts: 500 },
                { id: 'news', name: 'news', description: 'Latest news', subscribers: 2000, posts: 1000 },
                { id: 'fediverse', name: 'fediverse', description: 'Fediverse discussions', subscribers: 500, posts: 200 }
            );
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ communities })
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
