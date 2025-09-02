// netlify/functions/blobs.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // Initialize the blob store with a specific name for your blog
  const store = getStore("blog-data");
  
  // CORS headers to allow frontend to access this function
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle preflight CORS requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  console.log(`Blob API called: ${req.method} ${req.url}`);

  try {
    // Handle both old-style GET/POST requests and new unified POST requests
    if (req.method === "GET") {
      return await handleGet(req, store, headers);
    } else if (req.method === "POST") {
      const body = await req.json();
      
      // Check if this is a unified request with method in body
      if (body.method) {
        switch (body.method.toUpperCase()) {
          case 'GET':
            return await handleGetFromBody(body, store, headers);
          case 'SET':
            return await handleSetFromBody(body, store, headers);
          case 'LIST':
            return await handleListFromBody(body, store, headers);
          case 'DELETE':
            return await handleDeleteFromBody(body, store, headers);
          default:
            return new Response(
              JSON.stringify({ error: "Unknown method" }), 
              { status: 400, headers }
            );
        }
      } else {
        // Legacy POST request for setting data
        return await handlePost(req, store, headers, body);
      }
    } else if (req.method === "DELETE") {
      return await handleDelete(req, store, headers);
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }), 
        { status: 405, headers }
      );
    }
  } catch (error) {
    console.error("Blob function error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      { status: 500, headers }
    );
  }
};

// Handle GET requests from body (unified approach)
async function handleGetFromBody(body, store, headers) {
  const { key } = body;
  
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Missing key parameter" }),
      { status: 400, headers }
    );
  }

  try {
    const data = await store.get(key, { type: "json" });
    
    if (data === null) {
      console.log(`Key not found: ${key}`);
      return new Response(
        JSON.stringify({ error: "Key not found" }),
        { status: 404, headers }
      );
    }

    console.log(`Retrieved data for key: ${key}`);
    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error(`Error getting blob ${key}:`, error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve data" }),
      { status: 500, headers }
    );
  }
}

// Handle SET requests from body (unified approach)
async function handleSetFromBody(body, store, headers) {
  const { key, value } = body;

  // Validation
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Missing key in request body" }),
      { status: 400, headers }
    );
  }

  if (value === undefined) {
    return new Response(
      JSON.stringify({ error: "Missing value in request body" }),
      { status: 400, headers }
    );
  }

  // Security: validate key format
  if (typeof key !== "string" || key.length > 200) {
    return new Response(
      JSON.stringify({ error: "Invalid key format" }),
      { status: 400, headers }
    );
  }

  try {
    // Store the data
    await store.set(key, JSON.stringify(value));
    
    console.log(`Stored data for key: ${key}`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data stored successfully",
        key 
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error storing blob:", error);
    return new Response(
      JSON.stringify({ error: "Failed to store data" }),
      { status: 500, headers }
    );
  }
}

// Handle LIST requests from body (unified approach)
async function handleListFromBody(body, store, headers) {
  const { prefix = "" } = body;

  try {
    const { blobs } = await store.list({ prefix });
    const keys = blobs.map(blob => blob.key);
    
    console.log(`Listed ${keys.length} keys with prefix "${prefix}"`);
    return new Response(
      JSON.stringify({ keys }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error listing blobs:", error);
    return new Response(
      JSON.stringify({ keys: [] }),
      { status: 200, headers }
    );
  }
}

// Handle DELETE requests from body (unified approach)
async function handleDeleteFromBody(body, store, headers) {
  const { key } = body;

  if (!key) {
    return new Response(
      JSON.stringify({ error: "Missing key in request body" }),
      { status: 400, headers }
    );
  }

  try {
    // Check if the key exists before deleting
    const existingData = await store.get(key, { type: "json" });
    if (existingData === null) {
      return new Response(
        JSON.stringify({ error: "Key not found" }),
        { status: 404, headers }
      );
    }

    // Delete the data
    await store.delete(key);
    
    console.log(`Deleted data for key: ${key}`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data deleted successfully",
        key 
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error deleting blob:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete data" }),
      { status: 500, headers }
    );
  }
}

// Legacy GET requests (retrieve data or list keys)
async function handleGet(req, store, headers) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const list = url.searchParams.get("list");
  const prefix = url.searchParams.get("prefix") || "";

  // List all keys with optional prefix filter
  if (list === "true") {
    try {
      const { blobs } = await store.list({ prefix });
      const keys = blobs.map(blob => blob.key);
      
      console.log(`Listed ${keys.length} keys with prefix "${prefix}"`);
      return new Response(
        JSON.stringify({ keys }),
        { status: 200, headers }
      );
    } catch (error) {
      console.error("Error listing blobs:", error);
      return new Response(
        JSON.stringify({ keys: [] }),
        { status: 200, headers }
      );
    }
  }

  // Get specific key
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Missing key parameter" }),
      { status: 400, headers }
    );
  }

  try {
    const data = await store.get(key, { type: "json" });
    
    if (data === null) {
      console.log(`Key not found: ${key}`);
      return new Response(
        JSON.stringify({ error: "Key not found" }),
        { status: 404, headers }
      );
    }

    console.log(`Retrieved data for key: ${key}`);
    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error(`Error getting blob ${key}:`, error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve data" }),
      { status: 500, headers }
    );
  }
}

// Legacy POST requests (store data)
async function handlePost(req, store, headers, body = null) {
  try {
    const requestBody = body || await req.json();
    const { key, value } = requestBody;

    // Validation
    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing key in request body" }),
        { status: 400, headers }
      );
    }

    if (value === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing value in request body" }),
        { status: 400, headers }
      );
    }

    // Security: validate key format
    if (typeof key !== "string" || key.length > 200) {
      return new Response(
        JSON.stringify({ error: "Invalid key format" }),
        { status: 400, headers }
      );
    }

    // Store the data
    await store.set(key, JSON.stringify(value));
    
    console.log(`Stored data for key: ${key}`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data stored successfully",
        key 
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error storing blob:", error);
    return new Response(
      JSON.stringify({ error: "Failed to store data" }),
      { status: 500, headers }
    );
  }
}

// Legacy DELETE requests (remove data)
async function handleDelete(req, store, headers) {
  try {
    const body = await req.json();
    const { key } = body;

    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing key in request body" }),
        { status: 400, headers }
      );
    }

    // Check if the key exists before deleting
    const existingData = await store.get(key, { type: "json" });
    if (existingData === null) {
      return new Response(
        JSON.stringify({ error: "Key not found" }),
        { status: 404, headers }
      );
    }

    // Delete the data
    await store.delete(key);
    
    console.log(`Deleted data for key: ${key}`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data deleted successfully",
        key 
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error deleting blob:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete data" }),
      { status: 500, headers }
    );
  }
}
