# TCRP Codebase Audit
94 files, ~18,600 lines, parsed and analyzed statically (no live network/DB access in this sandbox — see "What I could NOT do" at bottom).

---
## 1. CRITICAL security findings (OWASP Top 10)

### 1.1 `api/main.js` has **zero authentication** on every action — A01:2021 Broken Access Control
`CORS: Access-Control-Allow-Origin: *` plus a `switch(action)` with ~28 branches and **no auth check anywhere in the file**. Anyone who finds the endpoint URL can, with a plain POST:
- `toggle_power` — take the whole system offline (`state: "OFFLINE"` silently stops the cron drip job)
- `update_missionary_points` — add unlimited points to any email
- `save_promo_code` / `delete_promo_code` — mint or destroy promo codes
- `get_system_logs` — read internal system logs

**Fix:** require a shared secret (or session/JWT) on every mutating action, minimum viable version below. Reject with 401 by default (fail closed), the way `api/cron.js` almost does (see 1.3).

```js
// lib/auth.js
export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query?.admin_key;
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) { res.status(500).json({ ok: false, error: 'Server not configured' }); return false; }
  if (key !== expected) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return false; }
  return true;
}
```
Then in `api/main.js`, at the top of every case that isn't a public read (`health_check`/`get_stats` can stay public if that's intended, everything else should not):
```js
case "toggle_power": {
  if (!requireAdmin(req, res)) return;
  ...
```

### 1.2 `api/simulator.js` is a live debug endpoint with no auth, shipped to prod
It can delete arbitrary sessions/missionaries and drive the bot state machine (`send_message`) for any PSID, wide-open CORS, no auth. This is a test tool that talks to the real database.

**Fix:** gate behind `NODE_ENV !== 'production'` **and** `requireAdmin`, or delete it from the deployed bundle entirely and keep it only for local dev (`server.js` already special-cases `/api/simulator`, so it's easy to strip from the Vercel build).

### 1.3 `lib/security.js::verifyFbSignature` fails **open**
```js
if (!secret) return true; // Skip if no secret configured in testing
```
If `FB_APP_SECRET` is ever unset in production (typo'd env var name, redeploy without secrets, etc.), webhook signature verification silently turns off and anyone can POST forged Messenger events to `/api/webhook`.

**Fix:** fail closed in production:
```js
export function verifyFbSignature(req, rawBody) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true; // only skip in local/dev
  }
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; } // length mismatch throws — currently unguarded, would 500 instead of 401
}
```
Also: `Buffer.from(signature)` vs `Buffer.from(expected)` will **throw** if lengths differ (`timingSafeEqual` requires equal-length buffers), which isn't caught — a malformed signature header currently crashes the handler instead of cleanly rejecting it. Wrapped above.

### 1.4 `api/cron.js` — same fail-open pattern
```js
if (process.env.CRON_SECRET && authHeader !== ...) return 401;
```
If `CRON_SECRET` is unset, the check is skipped entirely and `/api/cron` runs unauthenticated. Since this endpoint mass-emails missionaries, an unset secret means anyone can trigger production email blasts on demand. Same fix pattern as 1.3: require the secret to *exist*, don't treat "not configured" as "allow".

### 1.5 SQL injection — good news
I checked every `runSql()` call site across `api/`, `lib/`, `scripts/`, and `tests/`. All of them use `?` parameterized placeholders — I did not find a single string-concatenated query. This is the one area that's solid; don't regress it when editing (never build queries with template-literal interpolation of user input).

### 1.6 Credential handling — mostly fine, one process smell
- API keys (`BREVO_API_KEY`, `TURSO_AUTH_TOKEN`, `PAGE_ACCESS_TOKEN`, `FB_APP_SECRET`, `CRON_SECRET`) are all read from `process.env`, never hardcoded, never logged. Good.
- `run-all-suites.js` auto-runs `git add`, `git commit`, and **`git push origin main`** on green tests, and rewrites `README.md` on the fly. A test runner with unattended push access to `main` is a supply-chain-risk pattern (a compromised or buggy test file could push straight to prod) — worth turning into a manual step or a CI job with review, rather than a local script anyone can run.

---
## 2. Functional bugs (not security, but will bite you)

### 2.1 `chat_messages` table is dropped **every server boot**, and never recreated
`lib/db.js`:
```js
await runSql("DROP TABLE IF EXISTS chat_messages;").catch(() => {});
```
runs unconditionally in the boot-time migration IIFE — but no `CREATE TABLE chat_messages` exists anywhere (not in `schema.sql`, not in `db.js`). Meanwhile `lib/botHandler.js` inserts into it twice (inbound + outbound logging) and several test files (`tests/tester.js`, `test-anti-exploit.js`, `test-hourly-rate-limit.js`) read from it to assert bot behavior. **Net effect: chat logging is silently broken on every deploy**, and any test that reads `chat_messages` is checking a table that doesn't exist post-boot.

**Fix** — add the missing `CREATE TABLE IF NOT EXISTS chat_messages` and delete the stray `DROP TABLE` (it looks like leftover one-time cleanup that got committed):
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id integer PRIMARY KEY AUTOINCREMENT,
  psid text,
  sender text CHECK(sender IN ('user','bot')),
  message text,
  created_at text DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 `bot_rate_limits` table is used but never created — and the rate limiter is disconnected anyway
`lib/security.js::isRateLimited()`, `lib/dbPruner.js`, and `tests/tester.js` all reference `bot_rate_limits`, but it's absent from `schema.sql` and `db.js`. Worse: `isRateLimited` is exported but **never imported/called from `lib/botHandler.js`** — grep across the whole repo shows zero call sites outside its own definition and tests. So even once the table exists, nothing actually enforces the 5-messages/60s limit today; the bot has no real spam protection despite the code existing for one.

**Fix:** add the table, and wire it in at the top of `handleBotMessage`:
```sql
CREATE TABLE IF NOT EXISTS bot_rate_limits (
  psid text PRIMARY KEY,
  msg_count integer DEFAULT 0,
  window_start integer DEFAULT 0
);
```
```js
// lib/botHandler.js, top of handleBotMessage(psid, ...)
import { isRateLimited } from './security.js';
...
if (await isRateLimited(psid)) return; // or send a "slow down" reply
```

### 2.3 `dbPruner.js` deletes from a column that doesn't match the (missing) schema
```js
await runSql("DELETE FROM bot_rate_limits WHERE timestamp < datetime('now', '-24 hours')");
```
The rate-limit table's column is `window_start` (integer unix time) everywhere else in the code — there's no `timestamp` column. Even after fixing 2.2, this line will error every time `npm run prune` executes. Fix to:
```js
await runSql("DELETE FROM bot_rate_limits WHERE window_start < strftime('%s','now','-24 hours')");
```

### 2.4 `schema.sql` declares `bot_daily_views` **twice** (verbatim duplicate)
Two identical `CREATE TABLE IF NOT EXISTS bot_daily_views (...)` blocks back to back. Harmless at runtime (`IF NOT EXISTS`), but it's dead weight and a sign the file was concatenated from two migration sources. Delete the second block.

### 2.5 `run-all-suites.js` calls tests at the wrong path — it would fail immediately if run
```js
{ name: "Comprehensive Unit Suite", cmd: "node test-all.js" },
{ name: "Messenger Conversation Replies", cmd: "node test-all-replies.js" },
{ name: "End-to-End Infrastructure Connections", cmd: "node test-connections.js" },
```
Those three files live in `tests/`, not the project root (`tests/test-all.js`, `tests/test-all-replies.js`, `tests/test-connections.js`). Only `test-html.js` (root) actually resolves. Running `run-all-suites.js` today throws `Cannot find module 'test-all.js'` on the very first suite. Fix the `cmd` strings to `node tests/test-all.js` etc., or move the runner into `tests/`.

### 2.6 `lib/db.js` swallows real errors on schema-changing queries
```js
if (query.toLowerCase().includes('pragma') || ...'create table'... || ...'drop table'...) {
  return [{ ok: true }];
}
```
This applies to **every catch block** in `runSql`, including genuine network/auth failures — if `CREATE TABLE`/`ALTER TABLE`/`DROP TABLE` fails for any reason (bad credentials, Turso outage, syntax error), the function still reports success. That's why migrations can silently not-apply and nobody notices. Recommend logging the swallowed error even if you still choose not to throw:
```js
} catch (silent) {
  console.warn('[db] schema statement failed silently:', silent.message);
  return [{ ok: true }];
}
```

---
## 3. Duplicates found

| What | Detail |
|---|---|
| `views/*.html` and `views/sw.js`/`manifest.json` (13 files) | **Byte-identical** to `public/*` — confirmed via md5sum. This is expected: `npm run build` does `cp -r views/* public/`, so `public/` is a *generated* copy of `views/`. Don't hand-edit `public/`; treat `views/` as the only source of truth. |
| `views/assets/app.js` vs `assets/app.js` | **Not** identical — `views/assets/app.js` is missing 2 lines present in the real source (`assets/app.js`, root). Because the build script runs `cp views/* public/` *then* `cp assets/* public/assets/` (root assets wins), this stale copy never actually ships — but it's misleading dead weight sitting in the repo. Delete `views/assets/` entirely; it isn't the source, `assets/` (root) is. |
| `schema.sql`: `bot_daily_views` table | Declared twice, verbatim (see 2.4). |
| `setup-persistent-menu.js` (root) vs `scripts/setup-persistent-menu.js` | Two different implementations of the same Messenger persistent-menu setup, with different menu items and different Graph API versions (`v18.0` vs no version pinned in the other). Neither is referenced by `package.json` or any other file. Pick one (recommend `scripts/setup-persistent-menu.js`, it fails closed on missing token), delete the other. |
| `api/bot.js` vs `lib/bot.js` | Same filename, unrelated content (webhook handler vs. a dashboard rate-limit helper). Not true duplicates, but the shared name is a footgun for anyone grepping/importing. Rename `lib/bot.js` → `lib/dashboardRateLimit.js` for clarity. |
| `messengerbot.html` (root, 165 lines) vs `public/messengerbot.html` (417 lines) | Root copy is an old/abandoned draft, not wired into `server.js` routing (which only serves from `public/`/`views/`). Dead file. |

---
## 4. Unused / orphaned files
Cross-referenced every `.js`/`.sh` file against `package.json` scripts, `import`/`require` statements, and `execSync` calls throughout the repo. **Zero other references found** for:

**Root-level, orphaned:**
- `test-anti-exploit.js`, `test-flow.js`, `test-hourly-rate-limit.js`, `test-messenger-bot.js`, `test-new-user.js`, `test-new-user-detailed.js` — none are called from `package.json`, `run-all-suites.js`, or each other. Functionally overlapping with `tests/tester.js` and `tests/test-new-user-flow.js`.
- `messenger-bot-50-users.js` — imports `bot-templates.js` (which is otherwise also unused), looks like a one-off bulk-messaging utility never wired into `scripts/` or `package.json`.
- `cleanup-db.js`, `reset-db.js` — small standalone DB scripts, not referenced by any `npm run` script.
- `run-all-suites.js` — not in `package.json` scripts, and broken anyway (2.5).
- `setup-persistent-menu.js` (root, superseded by `scripts/` version — see §3).

**`scripts/`, orphaned:**
- `audit-all-endpoints.js`, `fix-database.js`, `fix-roster.sh`, `git-push.sh`, `gitbranch.js`, `setup-messenger.js`, `sync-csv.js`, `test-email.js`, `test_status.sh`, `tester.sh`, `update-terms.js`

**`tests/`, orphaned:**
- `test-bot-run.js`, `test-brevo.js`, `test-live-messenger.js`, `test-live-webhook.js`, `test-messenger.js`, `tests/tester.js` (360 lines — the most complete suite, ironically also unwired)

**`views/assets/`** — whole directory, see §3.

I did **not** delete anything myself — some of these (`scripts/sync-csv.js`, `scripts/setup-messenger.js`, one-off DB fix scripts) read like intentional manual/CLI utilities you run by hand rather than "dead code." The `cleanup.sh` below only removes the ones I'm confident are pure duplication or superseded (`views/assets/`, the stale root `messengerbot.html`, the losing `setup-persistent-menu.js`). Everything else is listed so you can decide — deleting a script you actually still run by hand would be worse than leaving it.

---
## 5. What I could NOT do (be upfront about this)
This sandbox has **no outbound network access**, so I could not:
- Connect to your real Turso DB or run any query against it
- Call the Facebook Graph API
- Actually execute `node test-*.js` against live data, or "test run a new user" end to end

Everything above is static analysis (reading the code paths, tracing calls, hashing files, cross-referencing references) — accurate for what it finds, but it's not the same as running the suite. The consolidated tester (`tests/tester.consolidated.js`, next file) is written to run correctly *when you execute it yourself* with your real `.env` — I can't run it for you here.
