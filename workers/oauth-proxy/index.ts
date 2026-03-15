export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GEMINI_API_KEY: string;
  EXTENSION_SECRET: string; // Set via `wrangler secret put`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin.startsWith("chrome-extension://") ? origin : "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Extension-Secret",
        },
      });
    }

    // Security Verification: Shared Secret
    const reqSecret = request.headers.get("X-Extension-Secret");
    if (!env.EXTENSION_SECRET || reqSecret !== env.EXTENSION_SECRET) {
      return new Response("Forbidden: Invalid extension secret", { status: 403 });
    }

    // Security Verification: Origin check (Optional but recommended)
    if (origin && !origin.startsWith("chrome-extension://")) {
      return new Response("Forbidden: Invalid origin", { status: 403 });
    }

    const commonHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
    };

    // --- 1. GitHub Token Exchange ---
    if (url.pathname === "/github/token" && request.method === "POST") {
      try {
        const { code } = await request.json() as { code: string };
        if (!code) return new Response("Missing code", { status: 400 });

        const response = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: commonHeaders });
      } catch (err: any) {
        return new Response(err.message, { status: 500 });
      }
    }

    // --- 2. Gemini AI Proxy ---
    if (url.pathname === "/gemini/enhance" && request.method === "POST") {
      try {
        const body = await request.json();
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: commonHeaders });
      } catch (err: any) {
        return new Response(err.message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
