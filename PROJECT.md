# Project: Timeless Creations Rewards Program (TCRP) Remediation

## Architecture
The TCRP application is a Node.js ESM-based rewards and loyalty platform integrating with Meta Messenger Webhooks, Brevo transactional email API, Turso libSQL/SQLite database, and a vanilla JS PWA dashboard.

### Core Subsystems:
1. **API Layer (`api/`)**: Webhook receiver (`webhook.js`), administration dispatch router (`main.js`), bot endpoint (`bot.js`), cron dispatcher (`cron.js`).
2. **Library Layer (`lib/`)**:
   - `db.js`: Database client with offline in-memory fallback engine for development/testing.
   - `botHandler.js` & `bot.js`: Messenger conversational FSM, quick replies, catalog carousel, and rate limiting.
   - `mailer.js`: Email templating, placeholder interpolation, and Brevo API integration.
   - `auth.js`: Admin authentication and authorization middleware.
   - `cdn.js`: Image caching and CDN asset handlers.
   - Handlers in `lib/handlers/` for admin features (email, analytics, etc.).
3. **Email Templates (`templates/`)**: 6 HTML templates (`otp-email.html`, `receipt-email.html`, `thankyou-email.html`, `monthly-drip.html`, `out-of-window-drip.html`, `delivered-email.html`).
4. **Views & PWA (`views/`)**: HTML administrative views, service worker (`sw.js`), and dashboard components.
5. **Test Infrastructure**: Root test suites (`test-templates.js`, `test-master.js`, `test-html.js`, `test-cdn.js`, `test-messenger-bot.js`) and comprehensive suites in `tests/`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Offline Database Simulation | Stateful in-memory SQL mock for `runSql` in `lib/db.js` when offline | M1 | Survey |
| 2 | Bot Helper Exports | Export `buildDashboardPayload`, `buildCatalogCarousel`, `FIXED_QUICK_REPLIES` from `lib/bot.js` | M1 | Survey |
| 3 | API Bot Handler Export | Export `executeBotAction` from `api/bot.js` | M1 | Survey |
| 4 | Mailer Export Harmonization | Export `sendOtpEmail` alias and `{ ok: true, success: true }` format | M1 | Survey |
| 5 | Compatibility Layer | Provide `lib/database.js`, `lib/messenger-bot.js`, `lib/cdn.js` module exports | M1 | Survey |
| 6 | Bot FSM State Harmonization | Align state to `AWAITING_ALL_IN_ONE` on terms agreement in `lib/botHandler.js` | M2 | Survey |
| 7 | Account Deletion Command | Implement `/delete_account` command in `lib/botHandler.js` | M2 | Survey |
| 8 | Security & Auth Guards | Add `requireAdmin` checks in `api/main.js` and fail-closed checks in `api/webhook.js` | M2 | Survey |
| 9 | Local Server Route Mapping | Map `/api/cron` and `/api/bot` in `server.js` | M2 | Survey |
| 10 | Email Admin Handler & View Parity | Add `delivered` and `out_of_window` in `emailHandler.js` & `settings.html` | M2 | Survey |
| 11 | PWA Service Worker & Preview Fixes | Fix precache paths in `sw.js` and `{{GALLERY_URL}}` in `drips.html` | M2 | Survey |
| 12 | Audit Report Remediation Log | Document all resolved warnings and fixes in `AUDIT_REPORT.md` | M2 | Survey |
| 13 | Test Import Path Normalization | Fix relative imports (`../lib/`, `../api/`) in `tests/*.js` | M3 | Survey |
| 14 | Root Test Suite Hardening | Ensure `test-messenger-bot.js`, `test-cdn.js`, etc. pass with exit code 0 | M3 | Survey |
| 15 | Subdirectory Test Suite Hardening | Ensure all 11 suites in `tests/` pass with exit code 0 | M3 | Survey |
| 16 | E2E & Forensic Integrity Audit | Complete validation across reviewers, challengers, and auditor | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Mock & Core Exports Stabilization | `lib/db.js`, `lib/database.js`, `lib/bot.js`, `api/bot.js`, `lib/mailer.js`, `lib/cdn.js`, `lib/messenger-bot.js` | none | PLANNED |
| M2 | Bot FSM, Admin Handlers, Security & View Hardening | `lib/botHandler.js`, `api/main.js`, `api/webhook.js`, `server.js`, `lib/handlers/emailHandler.js`, `views/sw.js`, `views/drips.html`, `views/settings.html`, `AUDIT_REPORT.md` | M1 | PLANNED |
| M3 | Test Suites Repair & Full Passing Verification | `test-messenger-bot.js`, `tests/*.js` | M1, M2 | PLANNED |
| M4 | E2E Testing, Adversarial Verification & Forensic Audit | All test suites, Reviewers, Challengers, Forensic Auditor | M1, M2, M3 | PLANNED |

## Interface Contracts
### `lib/db.js` (Offline In-Memory Mock)
- `runSql(query, params)`: Returns an array of row objects matching table schemas (`sessions`, `missionaries`, `chat_messages`, `analytics`, `system_settings`, `promo_codes`, `orders`, `invoices`).
- Handles `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE` gracefully.

### `lib/bot.js`
- `buildDashboardPayload(psid, missionary)`: Returns dashboard webview payload.
- `buildCatalogCarousel(products)`: Returns generic template carousel payload.
- `FIXED_QUICK_REPLIES`: Array of default quick reply objects.
- `checkDashboardRateLimit(psid)`: Token bucket rate limiter.

### `api/bot.js`
- `executeBotAction(req, res)` / `handleBotAction(action, data)`: Executes bot action and returns result object.

### `lib/mailer.js`
- `sendOTPEmail(to, otpCode, customName)` and `sendOtpEmail(to, otpCode, customName)`: Returns `{ ok: true, success: true, simulated: true, ... }`.

## Code Layout
- `api/`: Vercel/Node serverless API routes
- `lib/`: Business logic, database connector, bot FSM, mailer, handlers
- `templates/`: HTML email templates with inline CSS
- `views/`: PWA dashboard views and service worker
- `tests/`: Automated unit, integration, and flow test scripts
- Root: Configuration, server entry point (`server.js`), master verification test suites (`test-*.js`)
