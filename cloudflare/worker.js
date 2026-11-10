const encoder = new TextEncoder();

function jsonResponse(body, status, allowedOrigin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers.Vary = "Origin";
  }

  return new Response(JSON.stringify(body), { status, headers });
}

async function hashIp(ipAddress, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ipAddress));
  return Array.from(new Uint8Array(signature), function (byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/visitors") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, env.ALLOWED_ORIGIN);
    }

    const origin = request.headers.get("Origin");
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return jsonResponse({ error: "Origin not allowed" }, 403);
    }

    if (!env.DB || !env.IP_HASH_SECRET) {
      return jsonResponse({ error: "Visitor counter is not configured" }, 503, env.ALLOWED_ORIGIN);
    }

    const ipAddress = request.headers.get("CF-Connecting-IP");
    if (!ipAddress) {
      return jsonResponse({ error: "Client IP is unavailable" }, 503, env.ALLOWED_ORIGIN);
    }

    const visitorHash = await hashIp(ipAddress, env.IP_HASH_SECRET);
    const results = await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO visitors (visitor_hash) VALUES (?)"
      ).bind(visitorHash),
      env.DB.prepare("SELECT COUNT(*) AS total FROM visitors")
    ]);

    const total = results[1].results[0].total;
    return jsonResponse({ total: Number(total) }, 200, env.ALLOWED_ORIGIN);
  }
};
