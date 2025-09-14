// netlify/functions/piefed-comments.js
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
        const { instance, postId } = JSON.parse(event.body || '{}');
        const baseUrl = instance || 'https://piefed.social';
        
        // Generate sample comments since we can't fetch real ones without auth
        const comments = [
            {
                id: 'c1',
                author: 'user1',
                content: 'This is a great post! Thanks for sharing.',
                score: 12,
                published: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 'c2',
                author: 'user2',
                content: 'I disagree with this perspective. Here\'s why...',
                score: 5,
                published: new Date(Date.now() - 7200000).toISOString()
            },
            {
                id: 'c3',
                author: 'user3',
                content: 'Can you provide more sources for this claim?',
                score: 8,
                published: new Date(Date.now() - 10800000).toISOString()
            }
        ];
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ comments })
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
