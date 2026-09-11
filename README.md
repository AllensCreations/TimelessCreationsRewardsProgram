# 🎁 Timeless Creations Rewards Program (TCRP)

[![Version](https://img.shields.io/badge/Version-v2.49.0-gold.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/tree/NewVersion)
[![Android APK](https://img.shields.io/badge/Android%20APK-Build%2062-blue.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/releases/latest/download/TimelessRewards.apk)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%20(ESM)%20%7C%20Android%20WebView-darkgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-Turso%20libSQL-blueviolet.svg)](https://turso.tech/)
[![Auditor Tests](https://img.shields.io/badge/Auditor%20Tests-502%20Passed%20(100%25)-brightgreen.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-orange.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/actions)

**Timeless Creations Rewards Program (TCRP)** is an enterprise-grade missionary rewards, automated encouragement drip dispatch, and Point-of-Sale (POS) invoicing ecosystem. Built with a high-performance hybrid architecture combining a native Android app (Java WebView + hardware-backed `AndroidBridge`), pure HTTP Turso SQLite pipeline, serverless Node.js backend with in-memory TTLCache, automated external cron scheduling, and Meta Messenger chatbot automation.

---

## 📱 Direct Android APK Downloads & Live Access

| Distribution Channel | Target Link | Format |
| :--- | :--- | :--- |
| **🚀 GitHub Latest Release APK** | [📥 Download TimelessRewards.apk](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/releases/latest/download/TimelessRewards.apk) | Standalone Android APK (Build 62+) |
| **🌐 Raw Branch Mirror** | [📥 Download via NewVersion Raw Mirror](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/NewVersion/public/TimelessRewards.apk) | Direct APK Raw Mirror |
| **⚡ Live Production Web Host** | [🌐 Open Web Dashboard (Vercel)](https://timelesscreationsrewardsprogram.vercel.app/) | PWA / Mobile-Optimized Web App |
| **📦 GitHub Releases Page** | [🏷️ View All GitHub Releases](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/releases) | Release Binaries & Changelogs |

---

## ⏰ Automated Cron Dispatching & cron-jobs.org Guide

### ❓ Do you still need to run `cron-jobs.org`?
**YES, absolutely.** You must continue running your recurring job on [cron-jobs.org](https://cron-jobs.org).

### 🔍 Why cron-jobs.org is Required
1. **Serverless Architecture**: TCRP is hosted as serverless functions on Vercel. Serverless functions are purely event-driven and on-demand—they do not have a persistent background Node process running `setInterval` or `node-cron`. If nothing calls `/api/cron`, no code executes.
2. **Vercel Hobby Plan Cron Limitations**: Vercel's free/Hobby tier allows only **once-a-day** cron execution at UTC midnight (`0 0 * * *`) and caps projects at 2 crons maximum. It strictly rejects multi-hour or complex expressions like `0 7-12 6-31`.
3. **Custom Schedule Execution**: `cron-jobs.org` reliably triggers HTTP GET requests on your precise operational schedule (`0 7-12 6-31` PHT), waking up `api/cron.js` to process batches without requiring an expensive dedicated server.

---

### 🛠️ Step-by-Step cron-jobs.org Configuration

To guarantee automated monthly drip dispatches, configure your `cron-jobs.org` task with the following settings:

| Parameter | Configuration Value | Notes |
| :--- | :--- | :--- |
| **Title** | `TCRP Monthly Drip Dispatcher` | Human-readable job title |
| **URL** | `https://timelesscreationsrewardsprogram.vercel.app/api/cron?key=YOUR_CRON_SECRET` | Replace with your actual `CRON_SECRET` |
| **Request Method** | `GET` | Standard HTTP GET |
| **Cron Schedule** | `0 7-12 6-31 * *` | Minutes: `0`, Hours: `7-12`, Days: `6-31` |
| **Timezone** | `Asia/Manila (PHT, UTC+8)` | Philippines Standard Time |
| **Request Headers** | `Authorization: Bearer YOUR_CRON_SECRET`<br>`Accept: application/json` | Optional if `?key=` query param is set |
| **Request Timeout** | `30 seconds` | Allows full batch execution |
| **Failure Notification** | Enable Email Alert | Alerts you if Vercel encounters an error |

#### How the Dispatch Pipeline Operates
```
[⏰ cron-jobs.org]
   │ Triggered at 7:00, 8:00, 9:00, 10:00, 11:00, 12:00 PHT (Days 6–31)
   ▼
[GET /api/cron?key=CRON_SECRET]
   │
   ├─► Check Cache-Control headers: bypasses Vercel edge proxy cache
   ├─► Verify CRON_SECRET authentication
   ├─► Check System Power State: aborts cleanly if OFFLINE
   ├─► Enforce Concurrency Lock: rejects duplicate concurrent executions
   │
   ▼
[SQL Query Candidate Fetch]
   │ • Status: 'active'
   │ • Not dispatched yet in current calendar month (YYYY-MM)
   │ • Priority: Overdue target month (YYYY-MM <= current month) first, then batch order
   │ • LIMIT 100 rows
   ▼
[Batch Filter & Eligibility Guard]
   │ • Calculates mission month: Arrival month = Month 0 (not due)
   │ • Months 1..24 (or 18): Due if months_sent < currentMissionMonth
   │ • No day preset: can be dispatched on any operational day in due month
   │ • Caps batch at 45 missionaries per run
   ▼
[Brevo Email Dispatch + Turso Update]
   │ • Dispatches personalized monthly encouragement email
   │ • Increments months_sent
   │ • Advances next_send_date to following month (YYYY-MM, no day preset)
   │ • Logs dispatch to Turso system_logs
   ▼
[JSON Response: { ok: true, sentCount: N, message: "..." }]
```

---

## 📦 Single Source of Truth for Versioning

To eliminate manual editing across multiple files, **`package.json`** is the sole source of truth for all version numbering.

```
           ┌────────────────────────┐
           │      package.json      │
           │  "version": "2.49.0"   │
           │  "versionCode": 62     │
           └───────────┬────────────┘
                       │
             npm run build / sync
             (scripts/sync-assets.js)
                       │
       ┌───────────────┼───────────────┬────────────────┐
       ▼               ▼               ▼                ▼
views/version.json  public/version.json  android/app/    android/android-tcrp/
 (Web metadata)      (PWA metadata)     build.gradle     build.gradle
                                       (versionName &   (versionName &
                                        versionCode)     versionCode)
```

1. **Automated Asset Sync (`scripts/sync-assets.js`)**:
   - Reads `version` and `versionCode` directly from `package.json`.
   - Generates and writes synchronized metadata to `views/version.json` and `public/version.json`.
   - Automatically patches `versionName` and `versionCode` in both Android Gradle configurations (`android/android-tcrp/app/build.gradle` and `android/app/build.gradle`).
   - Syncs all web assets into the Android native assets directory (`www/`).
2. **Automated CI/CD Increments (`.github/workflows/build-and-release-apk.yml`)**:
   - On every push to branch `NewVersion`, the GitHub Actions workflow reads `package.json`.
   - Automatically bumps the minor version (`+0.1.0`) and increments `versionCode` (`+1`).
   - Writes the new version back to `package.json` and runs `scripts/sync-assets.js`.
   - Compiles the release APK and publishes a new GitHub Release tagged `vX.XX.X (Build YY)`.

---

## 🛑 Mandatory Update Barrier (Older Versions Made Unrunnable)

To guarantee that all active installations run the latest business rules, security patches, and database synchronization logic, **older client versions are rendered completely unrunnable upon the release of a newer build**:

### 1. Backend Enforcement (`api/main.js`)
* Every client request transmitting `x-client-version-code` or `client_version_code` lower than the server's version code is rejected with **HTTP `426 Upgrade Required`**.
* Mutating operations (invoicing, missionary edits, roster modifications) and data queries are immediately blocked.
* Returns structured upgrade payload:
  ```json
  {
    "ok": false,
    "update_required": true,
    "error": "Installed app version (Build 56) is outdated and retired. Please update to v2.49.0 (Build 62) to continue.",
    "latest_version": "2.49.0",
    "latest_version_code": 62
  }
  ```

### 2. Frontend Fullscreen Lockdown (`assets/app.js`)
* When an update is detected (via 60s background polling or receipt of HTTP 426), `showMandatoryUpdateBarrier()` triggers immediately.
* **Non-Dismissible**: Renders a full-screen blocking overlay with `z-index: 2147483647`.
* **Zero Bypass**: Removes any "Later" or "Dismiss" buttons; users cannot close the dialog.
* **Input Lock**: Disables scrolling on `<html>` and `<body>`, traps keyboard input, and intercepts hardware back buttons.
* **Network Interceptor**: Wraps `window.fetch` to abort all subsequent non-update network calls.
* **One Action**: Prominently features the **"⬇️ Update Now"** button pointing directly to the latest APK download.

---

## 🏛️ System Architecture & Multi-Tier Ecosystem

```
+-----------------------------------------------------------------------------------+
|                            TCRP MULTI-TIER ECOSYSTEM                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [📱 Android Native App]                  [🌐 Web / Mobile Dashboard]             |
|   • Hardware PackageManager Bridge         • 0ms Stale-While-Revalidate Sync      |
|   • AndroidBridge.saveBase64File (Gallery) • HTML Protection & Anti-Copy Lock     |
|   • Native Scroll Physics & Overlay Bars   • Real-time POS & Product Editor       |
|   • Inescapable Mandatory Update Barrier   • Live Cron Slot Schedule Preview      |
|            │                                              │                       |
|            └──────────────────────┬───────────────────────┘                       |
|                                   ▼                                               |
|                    [⚡ Backend API (Node.js ESM)]                                 |
|                     • Mandatory Version Gate (HTTP 426 Upgrade Required)          |
|                     • In-Memory TTLCache (1-5ms read responses)                   |
|                     • Brevo Universal Mailer & Monthly Encouragement Drips        |
|                     • Meta Messenger Webhook Engine (Graph API v19.0+)            |
|                     • Concurrency Locks & Daily Dispatch Idempotency             |
|                                   │                                               |
|                                   ▼                                               |
|                    [🗄️ Turso libSQL Cloud Database]                                |
|                     • Pure HTTPS /v2/pipeline (Zero C++ native binaries)          |
|                     • 7-Day Immutable Delivery Lock Enforcement                   |
|                     • Normalized Missionary Roster & Referral Registry            |
+-----------------------------------------------------------------------------------+
```

---

## 🌟 Core Features & Modules

### 1. ⚡ High-Speed Stale-While-Revalidate Sync & TTLCache
* **Instant 0ms Perceived Page Load (`TCRPSync` in `assets/app.js`)**:
  * Invoicing (`invoicing.html`) and Roster (`missionaries.html`) render cached records from `localStorage` in **0ms** without blocking spinner delays.
  * Silent background revalidation fetches fresh data from the server and reconciles UI elements smoothly.
* **Server-Side In-Memory TTLCache (`lib/cache.js`)**:
  * Accelerates read-heavy endpoints (`get_invoices`, `get_orders`, `get_products`, `get_missionaries`) with sub-5ms response times.
  * Automatic tag invalidation (`invoices`, `orders`, `missionaries`, `catalog`) purges cached reads immediately upon database mutations.

### 2. 📅 Missionary Progression & Drip Schedule Engine
* **Arrival Cohort Rule (Month 0)**:
  * A missionary arriving in `September 2026` has mission month `0` during September.
  * Arrival month is a welcome period; monthly encouragement drips start in **Month 1** (`October 2026`).
  * Prevents premature dispatches to new arrivals.
* **Once-Per-Calendar-Month Guard**:
  * An active missionary can receive at most **1 encouragement drip per calendar month** (`YYYY-MM`).
  * If a missionary was dispatched on September 1, they cannot be re-dispatched on September 11.
* **Starvation-Free Candidate Selection**:
  * The dispatch candidate query orders missionaries by due `next_send_date` first, preventing hundreds of newly prelisted arrival-month missionaries from starving overdue missionaries.
* **Schedule Slot Preview (`0 7-12 6-31` PHT)**:
  * Roster UI accurately calculates upcoming cron execution slots based on operational days (6th–31st) and hours (7:00 AM – 12:00 PM PHT).

### 3. 🧾 Point-of-Sale (POS) & Invoicing Engine (`views/invoicing.html`)
* **Dual Transaction Architecture**:
  * **Cash Invoices (`TCxxxxxx`)**: Direct customer and walk-in sales with subtotal calculations, dynamic discount options (% or ₱), and itemized product lists.
  * **Missionary Reward Claims (`ORD-xxxxxx`)**: Points-based reward redemptions by verified missionaries.
* **Focused Product-Only Editor**:
  * Allows cashiers to add, edit, or remove purchased items without altering customer profile records.
* **Permanent Locked Rewards (`🔒 Redeemed Reward (Permanent)`)**:
  * Primary reward items in redemptions cannot be removed or deleted during order edits.
* **7-Day Delivered Permanent Lock Policy**:
  * Automatically stamps `delivered_at` timestamp when status transitions to `DELIVERED`.
  * For transactions delivered **< 7 days ago**, displays `🚚 Delivered (Editable for X more days)`.
  * For transactions delivered **≥ 7 days ago**, status transitions to immutable `🔒 DELIVERED (7d Locked)`, disabling status changes, edits, and deletions while preserving slip downloads.
* **Downloadable Order Slips**:
  * `html2canvas` visual rendering with native Android `AndroidBridge.saveBase64File()` integration, saving directly into the device's **Pictures / TimelessRewards** gallery folder.

### 4. 🤖 Meta Messenger Bot & Companion Referrals (`lib/botHandler.js`)
* **Verified Missionary Dashboard**:
  * Displays personal profile info, points balance, batch arrival, and mission progress.
* **Deep-Link Referral Engine (`m.me/TimelessCreationsRP?ref=<code>`)**:
  * Tracks incoming companions via `messaging_referrals` and postback parameters.
  * Automatically awards **+1 Reward Point** to both the inviter and the joining companion upon onboarding.
* **1:1 Square Aspect Ratio Catalog Carousel**:
  * Dynamic action buttons: `[ 🎁 Claim (<price> PTS) ]` when affordable or `[ ⭐ Need <diff> More PTS ]` when locked.
* **Daily Rate Limiting**: Max 2 dashboard views per day with automated UTC midnight reset.

### 5. 💌 Brevo Universal Email Dispatcher (`lib/mailer.js`)
* Strict `</html>` ending verification and auto-repair engine.
* **Supported Templates**:
  1. 🔐 OTP Verification Passcode (`templates/otp-email.html`)
  2. 🧾 Order Redemption Receipt (`templates/receipt-email.html`)
  3. 📦 Order Completed & Fulfilled (`templates/thankyou-email.html`)
  4. 💌 Monthly Encouragement Drip Letter (`templates/monthly-drip.html`)
  5. ⚡ Out-of-Window Reconnect Letter (`templates/out-of-window-drip.html`)
  6. 🚚 Package Delivered Notification (`templates/delivered-email.html`)

### 6. 📱 Android Native WebView & Hardware Bridge
* **`LauncherActivity.java`**:
  * Exposes `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` directly from Android `PackageManager`.
  * Modern Android 10+ (API 29+) scoped storage via `MediaStore.Images.Media.EXTERNAL_CONTENT_URI`.
  * Dynamic `WRITE_EXTERNAL_STORAGE` permission checks for Android 9 and below.
  * Native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)`) and bounce overscroll.
  * Automated 60-second in-app OTA deployment update poller.
  * Cache-clearing routines on launch to eliminate WebView stale-script traps.

---

## 🗄️ Database Schema (`schema.sql` & `lib/db.js`)

```sql
-- Active and Prelisted Missionaries
CREATE TABLE IF NOT EXISTS missionaries (
  email TEXT PRIMARY KEY,
  name TEXT,
  last_name TEXT,
  first_name TEXT,
  full_name TEXT,
  cohort TEXT,
  batch_month TEXT,
  months_sent INTEGER DEFAULT 0,
  max_months INTEGER DEFAULT 24,
  psid TEXT UNIQUE,
  fb_sender_id TEXT,
  points INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  is_prelisted INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  last_sent_at TEXT,
  next_send_date TEXT,
  pending_ref_notices INTEGER DEFAULT 0
);

-- Reward Redemptions
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  psid TEXT,
  email TEXT,
  name TEXT,
  item TEXT,
  points_cost INTEGER,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT
);

-- POS Cash Invoices
CREATE TABLE IF NOT EXISTS cash_invoices (
  invoice_id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  items_json TEXT,
  subtotal REAL DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed',
  discount_val REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT
);

-- Product & Reward Catalog
CREATE TABLE IF NOT EXISTS product_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  price REAL DEFAULT 0,
  image_url TEXT,
  type TEXT DEFAULT 'reward'
);

-- Encouragement Drip Configuration
CREATE TABLE IF NOT EXISTS drip_messages (
  month INTEGER PRIMARY KEY,
  subject TEXT,
  theme TEXT,
  scripture TEXT,
  message TEXT,
  highlight_img TEXT,
  highlight_label TEXT,
  custom_html TEXT
);

-- Promo Codes & Redemptions
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  points INTEGER DEFAULT 1,
  max_users INTEGER DEFAULT 30,
  claimed_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- System Settings & Power Control
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- System Audit Logs
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT DEFAULT 'INFO',
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📂 Project Structure

```
├── .github/
│   └── workflows/
│       └── build-and-release-apk.yml   # CI/CD: Reads package.json, auto-bumps, builds APK & releases
├── android/
│   ├── android-tcrp/                   # Primary Android Studio Gradle Project
│   │   └── app/src/main/java/.../     # LauncherActivity.java (WebView, AndroidBridge)
│   └── app/                            # Secondary build mirror
├── api/
│   ├── main.js                         # Core REST API & Version Gate (HTTP 426)
│   ├── cron.js                         # Monthly Drip Encouragement Dispatcher
│   ├── bot.js                          # Meta Messenger Webhook Handler
│   ├── brevo-webhook.js                # Brevo Email Delivery/Bounce Webhook
│   └── simulator.js                    # Local Messenger Bot Simulation Endpoint
├── assets/
│   ├── app.js                          # Mandatory Update Barrier, TCRPSync, Layout Engine
│   └── styles.css                      # Cockpit Dark/Gold High-Contrast Theme
├── lib/
│   ├── cache.js                        # In-Memory TTLCache with Tag Invalidation
│   ├── db.js                           # Turso libSQL Pipeline Client & Migrations
│   ├── dbPruner.js                     # Automated Database Vacuuming & Maintenance
│   ├── mailer.js                       # Brevo Universal Email Dispatcher
│   ├── handlers/
│   │   ├── systemHandler.js            # GitHub Releases, Version Checks, Power Switch
│   │   ├── emailHandler.js             # Pending Email Calculation & Manual Dispatch
│   │   ├── invoiceHandler.js           # POS Invoices & 7-Day Delivery Lock
│   │   ├── missionaryHandler.js        # Roster CRUD, Import, & Bulk Pusher
│   │   └── catalogHandler.js           # Catalog & Reward Order Management
│   └── utils/
│       └── batchCalculator.js          # Missionary Progression & Eligibility Engine
├── scripts/
│   ├── sync-assets.js                  # Syncs package.json version to all build targets & assets
│   └── generate-release-notes.js       # Generates formatted release notes from git commits
├── templates/                          # Production HTML Email Templates (Brevo)
├── views/                              # Application Frontend Views
│   ├── index.html                      # System Cockpit & Heat Map
│   ├── missionaries.html               # Missionary Roster & Next-Cron Slot Calculator
│   ├── invoicing.html                  # POS Cashier, Wireframe Cards, Slip Downloader
│   ├── pusher.html                     # Bulk Missionary Pusher with Keyboard Shortcuts
│   ├── drips.html                      # Drip Letter Preview & Scheduler
│   ├── gallery.html                    # Product Catalog & Image Manager
│   ├── delivered.html                  # Delivered Orders Archive & Slips
│   ├── settings.html                   # Control Room, Power Switch, & Update Checker
│   └── logs.html                       # Real-Time System Audit Logs
├── package.json                        # Single Source of Truth for Versioning
└── schema.sql                          # Production Turso Database Schema
```

---

## 🧪 Testing & Quality Assurance

All features, migration scripts, and cohort rules are covered by an automated test suite:

```bash
# 1. Run Master 500-Point Auditor Test
npm test
# Result: 502 Passed, 0 Failed (100% Clean)

# 2. Run Backend Suggestions & Cohort Progression Suite
node tests/backendSuggestionsAndCohort.test.js
# Result: 39 Passed, 0 Failed

# 3. Synchronize Web Assets & Versioning
npm run build
# (Runs node scripts/sync-assets.js to propagate package.json version)
```

---

## ⚙️ Environment Variables

Configure the following environment variables in your local `.env` file or Vercel Project Settings:

```ini
# Turso libSQL Cloud Database
TURSO_DATABASE_URL=https://tcrp-xxxx.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Brevo (Sendinblue) Transactional Email API
BREVO_API_KEY=xkeysib-xxxx-your-brevo-api-key
SENDER_EMAIL=support@timelesscreations.com
SENDER_NAME="Timeless Creations"

# Automated Cron Execution Secret
CRON_SECRET=your-secure-cron-secret-token

# Meta Messenger Platform Webhook
FB_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
FB_VERIFY_TOKEN=your-webhook-verification-token
FB_APP_SECRET=your-facebook-app-secret

# Admin Authorization
ADMIN_PASSCODE=your-cockpit-admin-passcode
```

---

## 📜 Key Changelog Highlights

### [v2.49.0] - 2026-09-11 (Build 62)
* **📦 Single Source of Truth**: Unified versioning across the entire repository to `package.json`. All build tools (`sync-assets.js`, `build.gradle`, `version.json`, CI) derive version and code from `package.json`.
* **🛑 Mandatory Update Barrier**: Outdated client builds are locked down with an inescapable fullscreen blocker and rejected on the API with HTTP `426 Upgrade Required`.
* **⏰ Cron Dispatch Optimization**: Resolved candidate query starvation, prioritizing overdue `next_send_date` records over newly prelisted arrival-month missionaries. Added strict Vercel cache-bypass headers.
* **📅 Cron Schedule Alignment**: Synchronized UI slot estimations to reference schedule `0 7-12 6-31` (PHT).
* **💌 Drip Email Template Overhaul**: Enhanced typography, visual hierarchy, direct support contact section, and anti-spam footer in `templates/monthly-drip.html`.

### [v2.44.0] - 2026-09-10 (Build 56)
* **📱 Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` via Android `PackageManager`.
* **🔄 Native Viewport Touch Physics**: Standardized scroll styling in `assets/app.css` and enabled native vertical scrollbars with bounce overscroll.
* **⚡ Asset Cache-Busting**: Added cache-busting version query strings across all HTML view templates to eliminate WebView asset lockups.

### [v1.8.0] - 2026-09-02 (Build 10)
* **⚡ Stale-While-Revalidate Engine**: Integrated `TCRPSync` in `assets/app.js` enabling instant 0ms page rendering.
* **🚀 Server-Side TTLCache**: Sub-5ms response times for read queries with tag-based cache invalidation.

---

## 📄 License

Proprietary — © 2026 **Timeless Creations**. All rights reserved.
