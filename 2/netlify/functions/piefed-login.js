// netlify/functions/piefed-login.js
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const FormData = require('form-data');

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
        const { instance, username, password } = JSON.parse(event.body || '{}');
        const baseUrl = instance || 'https://piefed.social';
        
        // Since we can't maintain sessions in serverless functions,
        // we'll validate credentials and return a token
        // In a real implementation, you'd need a database or external session store
        
        // For demo purposes, we'll just validate that credentials were provided
        if (!username || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Username and password required' })
            };
        }
        
        // Try to fetch login page to verify instance is valid
        try {
            const response = await fetch(`${baseUrl}/user/login`, {
                headers: { 'User-Agent': 'PieFed Mobile Client/1.0' }
            });
            
            if (response.ok) {
                // Generate a session token (in production, use proper authentication)
                const session = Buffer.from(`${username}:${Date.now()}`).toString('base64');
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        session: session,
                        message: 'Connected to ' + baseUrl
                    })
                };
            }
        } catch (e) {
            console.error('Instance check failed:', e);
        }
        
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                error: 'Unable to connect to instance. Note: Full authentication requires a backend server.'
            })
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
