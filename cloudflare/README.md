# Visitor and online counter setup

The GitHub Pages site uses a Cloudflare Worker and D1 database to count each IP
address once across all visitors. The database stores a keyed SHA-256 hash of
each IP, not the IP address itself. The Worker also uses a Durable Object to
show an approximate number of currently connected browser sessions.

Run these commands from the repository root:

1. Create a D1 database:

   ```sh
   npx wrangler d1 create fc-calculator-visitors
   ```

   Copy the returned database ID into `cloudflare/wrangler.toml`, replacing
   `REPLACE_WITH_D1_DATABASE_ID`.

2. Create the table:

   ```sh
   npx wrangler d1 execute fc-calculator-visitors --remote --file=cloudflare/schema.sql --config cloudflare/wrangler.toml
   ```

3. Set a private HMAC key (use a randomly generated value of at least 32
   characters; do not commit it):

   ```sh
   npx wrangler secret put IP_HASH_SECRET --config cloudflare/wrangler.toml
   ```

4. Deploy the Worker. Wrangler will create and migrate the Durable Object
   namespace from the configuration in `cloudflare/wrangler.toml`:

   ```sh
   npx wrangler deploy --config cloudflare/wrangler.toml
   ```

5. Copy the deployed Worker URL into `FC.VISITOR_API_URL` in `js/config.js`,
   adding `/api/visitors` to the end. For example:

   ```js
   global.FC.VISITOR_API_URL = "https://fc-calculator-visitors.example.workers.dev/api/visitors";
   ```

   Commit and push that change to publish the counter on GitHub Pages.

The online counter sends an anonymous random session ID to the Worker every
five seconds. Sessions with no heartbeat for 20 seconds are removed. A session
ID is stored in the browser's local storage so multiple tabs in the same
browser count as one session; no IP address is stored for the online counter.
The displayed number is approximate because browsers may pause background tabs
or delay network requests.

`ALLOWED_ORIGIN` in `cloudflare/wrangler.toml` must match the exact origin of
the Pages site (no path or trailing slash). Update it whenever the Pages
account name or custom domain changes, then deploy the Worker again. Do not
change the HMAC key after the counter is in use, or existing IPs will be
counted again.
