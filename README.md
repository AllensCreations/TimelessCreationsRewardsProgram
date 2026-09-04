# 🎁 Timeless Creations Rewards Program (TCRP)

[![Version](https://img.shields.io/badge/Version-v2.1.0-gold.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/tree/Appversion)
[![Android APK](https://img.shields.io/badge/Android%20APK-Build%2013-blue.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%20(ESM)%20%7C%20Android%20WebView-darkgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-Turso%20libSQL-blueviolet.svg)](https://turso.tech/)
[![Tests](https://img.shields.io/badge/Auditor%20Tests-502%20Passed%20(100%25)-brightgreen.svg)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram)

**Timeless Creations Rewards Program (TCRP)** is an enterprise-grade missionary rewards, automated encouragement drip dispatch, and Point-of-Sale (POS) invoicing ecosystem. Built with a high-performance hybrid architecture combining a native Android app (Java WebView + `AndroidBridge`), pure HTTP Turso SQLite pipeline, serverless Node.js backend with in-memory TTLCache, and Meta Messenger chatbot automation.

---

## 📱 Direct Android APK Downloads & Live Access

| Distribution Channel | Target Link | Format |
| :--- | :--- | :--- |
| **🌐 GitHub Direct APK Mirror** | [📥 Download TimelessRewards.apk (v2.1.0)](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk) | Standalone Android APK (2.8 MB) |
| **⚡ Live Production Web Host** | [🌐 Open Web Dashboard (Vercel)](https://timelesscreationsrewardsprogram.vercel.app/) | PWA / Mobile-Optimized Web App |
| **📦 Release Artifacts** | [`android/TimelessRewards-v2.1.0.apk`](android/TimelessRewards-v2.1.0.apk) | Version 2.1.0 (Build Code 13) |

---

## 🏛️ System Architecture & Key Capabilities

```
+-----------------------------------------------------------------------------------+
|                            TCRP MULTI-TIER ECOSYSTEM                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [📱 Android Native Runtime]              [🌐 Web / Mobile Dashboard]             |
|   • AndroidBridge (JS Interface)           • 0ms Stale-While-Revalidate Sync      |
|   • MediaStore / Gallery Slip Saver        • HTML Protection & Anti-Copy Lock     |
|   • In-App OTA Update Poller (60s)         • Real-time POS & Product Editor       |
|            │                                              │                       |
|            └──────────────────────┬───────────────────────┘                       |
|                                   ▼                                               |
|                    [⚡ Backend API (Node.js ESM)]                                 |
|                     • In-Memory TTLCache (1-5ms read responses)                   |
|                     • Tag-Based Cache Invalidation (invoices, orders, roster)     |
|                     • Meta Messenger Webhook Engine (Graph API v19.0+)            |
|                     • Brevo Universal Mailer & Monthly Encouragement Drips        |
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

### 1. ⚡ High-Speed Stale-While-Revalidate LocalStorage Sync & TTLCache
* **Instant 0ms Perceived Page Load (`TCRPSync` in `assets/app.js`)**:
  * Invoicing (`invoicing.html`) and Roster (`missionaries.html`) immediately render cached records from `localStorage` in **0ms** without blocking spinner delays.
  * Silent background revalidation fetches fresh data from the server and reconciles UI elements smoothly without jarring refreshes.
* **Server-Side In-Memory TTLCache (`lib/cache.js`)**:
  * Accelerates read-heavy endpoints (`get_invoices`, `get_orders`, `get_products`, `get_missionaries`) with sub-5ms response times.
  * Automatic tag invalidation (`invoices`, `orders`, `missionaries`, `catalog`) purges cached reads immediately upon any database mutation.

### 2. 🧾 Point-of-Sale (POS) & Invoicing Engine (`views/invoicing.html`)
* **Dual Transaction Architecture**:
  * **Cash Invoices (`TCxxxxxx`)**: Direct customer and walk-in sales with subtotal calculations, dynamic discount options (% or ₱), and itemized product lists.
  * **Missionary Reward Claims (`ORD-xxxxxx`)**: Points-based reward redemptions by verified missionaries.
* **Focused Product-Only Editor**:
  * Allows cashiers to add, edit, or remove purchased items without altering or corrupting customer IDs or profile records.
* **Permanent Locked Rewards (`🔒 Redeemed Reward (Permanent)`)**:
  * Primary reward items in redemptions cannot be removed or deleted during order edits.
* **7-Day Delivered Permanent Lock Policy**:
  * Automatically stamps `delivered_at` timestamp when status transitions to `DELIVERED`.
  * For transactions delivered **< 7 days ago**, displays `🚚 Delivered (Editable for X more days)`.
  * For transactions delivered **≥ 7 days ago**, status transitions to immutable `🔒 DELIVERED (7d Locked)`, disabling status changes, edits, and deletions while preserving slip downloads.
* **Downloadable Order Slips**:
  * `html2canvas` visual rendering with native Android `AndroidBridge.saveBase64File()` integration, saving directly into the device's **Pictures / TimelessRewards** gallery folder.

### 3. 📅 Missionary Batch Progression Engine
* **Standardized Calculation Rule**:
  * **Batch Month (Month 0)**: Missionary arrival month (e.g. `August 2026`).
  * **1st Month (Month 1)**: First monthly encouragement drip dispatch and mission progress begin in **`September 2026`**.
  * **Subsequent Months**: Progresses monthly (Month 2 in `October 2026`, etc.).
* **Integrated Previews**:
  * Messenger bot dashboard displays: `• Batch: August 2026 (1st Month: September 2026)` & `• Mission Progress: Month X of 24 (or 18)`.
  * Missionary Roster and Bulk Pusher feature real-time 1st-month calculations and previews.

### 4. 🤖 Meta Messenger Bot & Companion Referrals (`lib/botHandler.js`)
* **Verified Missionary Dashboard**:
  * Displays personal profile info, points balance, batch arrival, and mission progress.
* **Deep-Link Referral Engine (`m.me/TimelessCreationsRP?ref=<code>`)**:
  * Tracks incoming companions via `messaging_referrals` and postback parameters.
  * Automatically awards **+1 Reward Point** to both the inviter and the joining companion.
* **1:1 Square Aspect Ratio Catalog Carousel**:
  * Dynamic action buttons: `[ 🎁 Claim (<price> PTS) ]` when affordable or `[ ⭐ Need <diff> More PTS ]` when locked.
* **Daily Rate Limiting**: Max 2 dashboard views per day with automated UTC midnight reset.

### 5. 💌 Brevo Production Email Dispatch & Monthly Drips
* **Universal Email Dispatcher (`lib/mailer.js`)**:
  * Strict `</html>` ending verification and auto-repair engine.
  * **Supported Templates**:
    1. 🔐 OTP Verification Passcode (`templates/otp-email.html`)
    2. 🧾 Order Redemption Receipt (`templates/receipt-email.html`)
    3. 📦 Order Completed & Fulfilled (`templates/thankyou-email.html`)
    4. 💌 Monthly Encouragement Drip Letter (`templates/monthly-drip.html`)
    5. ⚡ Out-of-Window Reconnect Letter (`templates/out-of-window-drip.html`)
    6. 🚚 Package Delivered Notification (`templates/delivered-email.html`)

### 6. 📱 Android Native WebView & Permission Engine
* **`LauncherActivity.java`**:
  * Modern Android 10+ (API 29+) scoped storage via `MediaStore.Images.Media.EXTERNAL_CONTENT_URI`.
  * Dynamic `WRITE_EXTERNAL_STORAGE` permission checks for Android 9 and below.
  * Dedicated `@JavascriptInterface` bridge (`AndroidBridge.saveBase64File`).
  * Automated 60-second in-app OTA deployment update poller.
  * Streamlined **"🔍 Check for Updates"** button with dynamic `"✓ You're at the latest version!"` feedback.

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
  cohort TEXT DEFAULT 'elder',
  batch_month TEXT DEFAULT 'August 2026',
  referral_code TEXT,
  points INTEGER DEFAULT 0,
  months_sent INTEGER DEFAULT 0,
  max_months INTEGER DEFAULT 24,
  last_sent_at TEXT,
  status TEXT DEFAULT 'active',
  psid TEXT,
  is_prelisted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Point-Based Reward Orders
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  item TEXT,
  items_json TEXT,
  points_cost INTEGER,
  status TEXT DEFAULT 'PENDING',
  delivered_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cash & Custom POS Invoices
CREATE TABLE IF NOT EXISTS cash_invoices (
  invoice_id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  items_json TEXT,
  subtotal REAL,
  discount_type TEXT DEFAULT 'none',
  discount_val REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total_amount REAL,
  status TEXT DEFAULT 'PENDING',
  delivered_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product & Reward Catalog
CREATE TABLE IF NOT EXISTS product_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  price REAL,
  image_url TEXT,
  type TEXT DEFAULT 'reward'
);

-- Bot Rate Limiting
CREATE TABLE IF NOT EXISTS bot_daily_views (
  sender_id TEXT PRIMARY KEY,
  view_date TEXT,
  view_count INTEGER DEFAULT 0,
  warned INTEGER DEFAULT 0
);
```

---

## 📂 Project Structure

```
├── android/
│   ├── android-tcrp/                   # Primary Android Studio Gradle Project
│   │   └── app/src/main/java/.../     # LauncherActivity.java (WebView, AndroidBridge)
│   ├── TimelessRewards-v1.8.apk        # Compiled Android Release Binary (v1.8.0)
│   └── app/                            # Secondary build mirror
├── api/
│   ├── main.js                         # Core API Route Handler
│   ├── bot.js                          # Meta Messenger Webhook Handler
│   └── cron.js                         # Monthly Drip Encouragement Dispatcher
├── assets/
│   ├── app.js                          # TCRPSync Engine, Layouts, Updater, Protections
│   └── styles.css                      # Cockpit Dark/Gold High-Contrast Theme
├── lib/
│   ├── cache.js                        # In-Memory TTLCache with Tag Invalidation
│   ├── db.js                           # Turso libSQL Pipeline Client & Migrations
│   ├── botHandler.js                   # Messenger Bot FSM & Dashboard Formatter
│   ├── mailer.js                       # Brevo Universal Email Dispatcher
│   ├── security.js                     # Rate Limiter & View Guard
│   ├── handlers/
│   │   ├── invoiceHandler.js           # POS Invoices & 7-Day Lock Enforcement
│   │   ├── catalogHandler.js           # Product Catalog & Reward Orders
│   │   ├── missionaryHandler.js        # Roster CRUD & Bulk Pusher
│   │   └── systemHandler.js            # Update Checking & System Health
│   └── utils/
│       └── batchCalculator.js          # Standardized Batch Month Progression Logic
├── templates/                          # Production Responsive HTML Email Templates
├── views/                              # Application Frontend Views
│   ├── index.html                      # System Cockpit & Heat Map
│   ├── invoicing.html                  # POS Cashier, Wireframe Cards, Slip Downloader
│   ├── missionaries.html               # Missionary Roster & Batch Editor
│   ├── pusher.html                     # Bulk Missionary Onboarding & History Feed
│   ├── gallery.html                    # CDN Image & Reward Catalog Manager
│   ├── drips.html                      # Drip Letter Preview & Scheduler
│   ├── settings.html                   # System Settings & Clean Update Checker
│   └── logs.html                       # Real-Time System Audit Logs
├── package.json                        # Project Metadata & Scripts
└── schema.sql                          # Production Database Schema
```

---

## 🧪 Testing & Quality Assurance

All features are covered by a comprehensive, zero-failure testing suite:

```bash
# 1. Run Master 500-Point Auditor
npm test
# Result: 502 Passed, 0 Failed (100% Clean)

# 2. Run Strict HTML Email Template Auditor (Validates </html> completeness)
npm run test:templates
# Result: 6/6 Templates Passed

# 3. Run Frontend DOM & HTML Integrity Verification
npm run test:html
# Result: 12/12 HTML Views Validated

# 4. Build Web & Android Assets
npm run build

# 5. Compile Android APK with Gradle
cd android/android-tcrp && ./gradlew assembleDebug
```

---

## 📜 Full Changelog

### [v1.8.0] - 2026-09-02 (Build Code 10)
* **⚡ High-Speed Stale-While-Revalidate Engine**: Integrated `TCRPSync` in `assets/app.js` enabling instant 0ms page rendering for Invoicing and Roster views.
* **🚀 Server-Side In-Memory TTLCache (`lib/cache.js`)**: Sub-5ms response times for read queries with tag-based cache invalidation upon mutations.
* **📱 Streamlined Update Checker**: Removed raw APK download buttons from Settings; added a dedicated "🔍 Check for Updates" button with `"✓ You're at the latest version!"` feedback.

### [v1.7.0] - 2026-09-02 (Build Code 9)
* **🗑️ Invoicing Delete Button Restored**: Added global `escapeHtml()` definition, resolving confirmation modal crash.
* **📥 Android MediaStore Slip Downloader**: Implemented `AndroidBridge.saveBase64File()` using modern Android 10+ scoped storage (`MediaStore`) and dynamic storage permission handling for older Android versions.

### [v1.6.0] - 2026-09-02 (Build Code 8)
* **📅 Missionary Batch Progression Engine**: Standardized missionary mission month progression across the platform (`Batch: August` &rarr; `1st Month: September`).
* **📊 Messenger Bot Dashboard Integration**: Bot displays batch arrival month and calculated 1st month start.
* **🔍 UI Live Previews**: Real-time batch progression calculation in Roster Edit modal and Bulk Pusher.

### [v1.5.0] - 2026-09-02 (Build Code 7)
* **🔒 7-Day Delivered Permanent Lock Policy**: Automatic stamping of `delivered_at`; transactions delivered ≥ 7 days ago become permanently locked and immutable.
* **🛡️ Backend Enforcement**: Status rollbacks, product edits, and deletions rejected after 7-day delivery grace period.

### [v1.4.0] - 2026-09-02 (Build Code 6)
* **✏️ Focused Product-Only Editor**: Simplified Invoicing edit modal allowing editing of purchased products without altering customer profiles.
* **🔒 Locked Reward Items**: Permanent protection for primary reward items in redemptions.
* **🔘 Single Action Button Architecture**: Unified transaction cards to exactly one edit button per card.

### [v1.3.0] - 2026-09-02 (Build Code 5)
* **📋 Recent Additions & Bulk Push History Feed**: Live feed in `pusher.html` showing recent missionary registrations and cohort statistics.
* **🏷️ Dual Cash/Reward Item Separation**: Clear itemization between free redeemed reward items and cash add-on purchases.

### [v1.2.0] - 2026-09-02 (Build Code 4)
* **🗑️ Database Table Cleanup**: Removed obsolete Turso tables (`claims`, `invoices`, `bot_state`) and standardized on `cash_invoices` and `orders`.
* **⚡ Power Switch Persistence**: Robust online/offline system toggle backed by Turso `system_settings` table.

### [v1.1.0] - 2026-09-02 (Build Code 3)
* **📱 Android APK In-App Auto-Updater**: Automatic 60-second deployment polling and in-app APK update prompts.
* **🔐 Zero-Key Access**: Removed requirement for hardcoded admin keys in settings.

### [v1.0.0] - 2026-08-23
* **🎉 Initial Production Release**: Complete missionary reward redemption bot, Brevo 24-month email drip engine, and Turso libSQL backend.

---

## 📄 License

Proprietary — © 2026 **Timeless Creations**. All rights reserved.
