CREATE TABLE IF NOT EXISTS visitors (
  visitor_hash TEXT PRIMARY KEY NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
