const encoder = new TextEncoder();

function jsonResponse(body, status, allowedOrigin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers.Vary = "Origin";
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function corsPreflightResponse(allowedOrigin) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin"
    }
  });
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

    if (url.pathname === "/api/presence") {
      const origin = request.headers.get("Origin");
      if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
        return jsonResponse({ error: "Origin not allowed" }, 403);
      }

      if (request.method === "OPTIONS") {
        return corsPreflightResponse(env.ALLOWED_ORIGIN);
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, env.ALLOWED_ORIGIN);
      }

      if (!env.PRESENCE_COUNTER) {
        return jsonResponse({ error: "Presence counter is not configured" }, 503, env.ALLOWED_ORIGIN);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400, env.ALLOWED_ORIGIN);
      }

      if (!payload || typeof payload.sessionId !== "string" || !/^[a-f0-9]{32}$/.test(payload.sessionId)) {
        return jsonResponse({ error: "Invalid session ID" }, 400, env.ALLOWED_ORIGIN);
      }

      const id = env.PRESENCE_COUNTER.idFromName("global");
      const stub = env.PRESENCE_COUNTER.get(id);
      const response = await stub.fetch("https://presence.internal/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: payload.sessionId })
      });

      if (!response.ok) {
        return jsonResponse({ error: "Presence counter request failed" }, response.status, env.ALLOWED_ORIGIN);
      }

      return jsonResponse(await response.json(), 200, env.ALLOWED_ORIGIN);
    }

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

const PRESENCE_WINDOW_MS = 20 * 1000;

export class PresenceCounter {
  constructor(state) {
    this.state = state;
    this.initialized = state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS active_sessions (session_id TEXT PRIMARY KEY NOT NULL, last_seen_at INTEGER NOT NULL)"
      );
    });
  }

  async fetch(request) {
    await this.initialized;

    if (new URL(request.url).pathname !== "/heartbeat" || request.method !== "POST") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const payload = await request.json();
    if (!payload || typeof payload.sessionId !== "string" || !/^[a-f0-9]{32}$/.test(payload.sessionId)) {
      return jsonResponse({ error: "Invalid session ID" }, 400);
    }

    const now = Date.now();
    this.state.storage.sql.exec(
      "DELETE FROM active_sessions WHERE last_seen_at <= ?",
      now - PRESENCE_WINDOW_MS
    );
    this.state.storage.sql.exec(
      "INSERT INTO active_sessions (session_id, last_seen_at) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET last_seen_at = excluded.last_seen_at",
      payload.sessionId,
      now
    );
    await this.state.storage.setAlarm(now + PRESENCE_WINDOW_MS);

    const total = this.state.storage.sql
      .exec("SELECT COUNT(*) AS total FROM active_sessions")
      .toArray()[0].total;
    return jsonResponse({ total: Number(total) }, 200);
  }

  async alarm() {
    await this.initialized;

    const now = Date.now();
    this.state.storage.sql.exec(
      "DELETE FROM active_sessions WHERE last_seen_at <= ?",
      now - PRESENCE_WINDOW_MS
    );

    const oldestSession = this.state.storage.sql
      .exec("SELECT MIN(last_seen_at) AS last_seen_at FROM active_sessions")
      .toArray()[0].last_seen_at;
    if (oldestSession !== null) {
      await this.state.storage.setAlarm(Number(oldestSession) + PRESENCE_WINDOW_MS);
    }
  }
}
