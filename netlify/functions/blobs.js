// netlify/functions/blobs.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // Initialize the blob store
  const store = getStore("blog-data");
  
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    switch (req.method) {
      case "GET":
        return await handleGet(req, store, headers);
      
      case "POST":
        return await handlePost(req, store, headers);
        
      case "DELETE":
        return await handleDelete(req, store, headers);
        
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }), 
          { 
            status: 405, 
            headers: { ...headers, "Content-Type": "application/json" }
          }
        );
    }
  } catch (error) {
    console.error("Blob function error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }
};

async function handleGet(req, store, headers) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const list = url.searchParams.get("list");
  const prefix = url.searchParams.get("prefix") || "";

  if (list === "true") {
    // List all keys with optional prefix filter
    try {
      const { blobs } = await store.list({ prefix });
      const keys = blobs.map(blob => blob.key);
      
      return new Response(
        JSON.stringify({ keys }),
        { 
          status: 200, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      console.error("Error listing blobs:", error);
      return new Response(
        JSON.stringify({ keys: [] }),
        { 
          status: 200, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }
  }

  if (!key) {
    return new Response(
      JSON.stringify({ error: "Missing key parameter" }),
      { 
        status: 400, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const data = await store.get(key, { type: "json" });
    
    if (data === null) {
      return new Response(
        JSON.stringify({ error: "Key not found" }),
        { 
          status: 404, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { 
        status: 200, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error(`Error getting blob ${key}:`, error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve data" }),
      { 
        status: 500, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }
}

async function handlePost(req, store, headers) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing key in request body" }),
        { 
          status: 400, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    if (value === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing value in request body" }),
        { 
          status: 400, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    // Validate key format (optional security measure)
    if (typeof key !== "string" || key.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid key format" }),
        { 
          status: 400, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    await store.set(key, JSON.stringify(value));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data stored successfully",
        key 
      }),
      { 
        status: 200, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error storing blob:", error);
    return new Response(
      JSON.stringify({ error: "Failed to store data" }),
      { 
        status: 500, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }
}

async function handleDelete(req, store, headers) {
  try {
    const body = await req.json();
    const { key } = body;

    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing key in request body" }),
        { 
          status: 400, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    // Check if the key exists before deleting
    const existingData = await store.get(key, { type: "json" });
    if (existingData === null) {
      return new Response(
        JSON.stringify({ error: "Key not found" }),
        { 
          status: 404, 
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    await store.delete(key);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data deleted successfully",
        key 
      }),
      { 
        status: 200, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error deleting blob:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete data" }),
      { 
        status: 500, 
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }
}
