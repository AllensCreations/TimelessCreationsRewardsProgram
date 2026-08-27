# Code fixes — apply these directly

## lib/db.js — stop dropping chat_messages every boot, add missing tables

**Remove this line** from `initDatabaseSchema()`:
```js
await runSql("DROP TABLE IF EXISTS chat_messages;").catch(() => {});
```

**Add** (anywhere inside the same IIFE, alongside the other `CREATE TABLE IF NOT EXISTS` calls):
```js
await runSql(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id integer PRIMARY KEY AUTOINCREMENT,
    psid text,
    sender text CHECK(sender IN ('user','bot')),
    message text,
    created_at text DEFAULT CURRENT_TIMESTAMP
  )
`).catch(() => {});

await runSql(`
  CREATE TABLE IF NOT EXISTS bot_rate_limits (
    psid text PRIMARY KEY,
    msg_count integer DEFAULT 0,
    window_start integer DEFAULT 0
  )
`).catch(() => {});
```

## lib/security.js — fail closed, don't crash on malformed signatures

```js
import crypto from 'crypto';
import { runSql } from './db.js';

export function verifyFbSignature(req, rawBody) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) {
    // Only skip verification outside production — never in prod, even if
    // the secret is accidentally unset.
    return process.env.NODE_ENV !== 'production';
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false; // timingSafeEqual throws on length mismatch
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// unchanged below — isRateLimited(...)
```

## lib/botHandler.js — actually call the rate limiter (currently dead code)

Add near the top of the file:
```js
import { isRateLimited } from './security.js';
```

At the very start of `handleBotMessage(psid, text, payload, ref)`, before any state-machine logic:
```js
export async function handleBotMessage(psid, text, payload, ref) {
  if (await isRateLimited(psid)) {
    // Optionally send a single "please slow down" message instead of silently dropping.
    return;
  }
  // ...existing logic
```

## lib/dbPruner.js — fix the column name mismatch

```diff
- await runSql("DELETE FROM bot_rate_limits WHERE timestamp < datetime('now', '-24 hours')");
+ await runSql("DELETE FROM bot_rate_limits WHERE window_start < strftime('%s','now','-24 hours')");
```

## api/main.js — require an admin key on every mutating action

Add a new file `lib/auth.js`:
```js
export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query?.admin_key;
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    res.status(500).json({ ok: false, error: 'Server misconfigured: ADMIN_API_KEY not set' });
    return false;
  }
  if (key !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}
```

In `api/main.js`, import it and guard every case that isn't meant to be public:
```js
import { requireAdmin } from '../lib/auth.js';
...
case "toggle_power": {
  if (!requireAdmin(req, res)) return;
  ...
case "update_missionary_points": {
  if (!requireAdmin(req, res)) return;
  ...
case "save_promo_code":
case "delete_promo_code":
case "get_system_logs": {
  if (!requireAdmin(req, res)) return;
  ...
```
Leave `health_check`/`ping`/`get_stats` public only if your dashboard genuinely needs to poll them without auth — otherwise gate those too.

## api/cron.js — fail closed if CRON_SECRET is unset

```diff
- if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== process.env.CRON_SECRET) {
-   return res.status(401).json({ ok: false, error: "Unauthorized cron execution." });
- }
+ if (!process.env.CRON_SECRET) {
+   return res.status(500).json({ ok: false, error: "CRON_SECRET not configured — refusing to run." });
+ }
+ if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== process.env.CRON_SECRET) {
+   return res.status(401).json({ ok: false, error: "Unauthorized cron execution." });
+ }
```

## schema.sql — remove the duplicate `bot_daily_views` block

Delete the second, identical `CREATE TABLE IF NOT EXISTS bot_daily_views (...)` block at the bottom of the file (harmless but redundant).
