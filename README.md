# 🎁 Timeless Creations Rewards Program (TCRP)

Comprehensive system architecture, endpoint registry, database schema, and live changelog for TCRP.

---

## 🏛️ Core Architecture & Foundation

- **Runtime**: Node.js (ES Modules / ESM) on Vercel Serverless & Termux (Android arm64).
- **Database**: Turso (libSQL) via pure HTTPS `/v2/pipeline` protocol (zero native C++ dependencies).
- **CDN**: ImgBB API with SHA-256 encrypted `.webp` naming and Turso `cdn_gallery` persistence.
- **Mailer**: Brevo API for 24-month drip emails, OTP codes, and POS purchase receipts.
- **Bot Engine**: Meta Messenger Graph API v19.0+ with pure Mathematical Unicode typography.

---

## 🗄️ Database Schema (`lib/db.js`)

* **`missionaries`**: `id`, `name`, `email`, `mission`, `start_date`, `points`, `referral_code`, `fb_sender_id`, `is_active`, `created_at`
* **`product_catalog`**: `id`, `name`, `price`, `image_url`, `type` (Defaults to `'reward'`)
* **`bot_daily_views`**: `sender_id`, `view_date`, `view_count` (Atomic upsert, max 2 views/day)
* **`cdn_gallery`**: `id`, `filename`, `direct_url`, `size_label`, `original_kb`, `compressed_kb`, `delete_url`, `created_at`
* **`claims`**: `id`, `missionary_id`, `product_id`, `claim_code`, `status`, `created_at`
* **`invoices`**: `id`, `invoice_number`, `missionary_id`, `total_amount`, `points_deducted`, `cash_paid`, `cashier`, `created_at`
* **`system_logs`**: `id`, `log_level`, `action_type`, `message`, `metadata_json`, `created_at`

---

## 🤖 Messenger Bot Rules & Flow

1. **Dashboard Trigger**:
   - Dispatches a single combined message containing **Dashboard Stats** + **Copy-and-Send Companion Invite Link**.
   - Follows immediately with a **1:1 Square Image Aspect Ratio** product carousel queried from `product_catalog WHERE type = 'reward'`.
2. **Single Dynamic Card Button**:
   - **Affordable Item** ($\text{Points} \ge \text{Price}$): `[ 🎁 Claim (<price> PTS) ]`
   - **Locked Goal Item** ($\text{Points} < \text{Price}$): `[ ⭐ Need <diff> More PTS ]`
3. **Fixed Quick Reply**:
   - Exactly 1 sticky bottom Quick Reply chip: `[ 📊 Dashboard ]`.
4. **Referral Tracking**:
   - Listens to `messaging_referrals`, `postback.referral`, and `message.referral` deep links (`m.me/TimelessCreationsRP?ref=<code>`), awarding +1 Point to both the inviter and companion.
5. **Rate Limiting**:
   - Enforces max 2 dashboard queries per day via `bot_daily_views`, resetting at 00:00 UTC.

---

## 📂 Handler Registry

* **`api/main.js`**: Missionary CRUD, batch CSV intake, POS invoicing, stats, and force-cron.
* **`api/bot.js`**: Meta webhook verification and Messenger event dispatcher.
* **`api/cdn.js`**: ImgBB direct image uploader, catalog viewer, and deletion handler.
* **`lib/db.js`**: Universal SQL runner with pure HTTP pipeline (`runSql`, `queryTurso`, `query`, `execute`).
* **`lib/bot.js`**: Unicode string formatters, carousel builder, and atomic rate limiter.
* **`lib/mailer.js`**: Brevo 9-grid drip emailer and receipt dispatcher.

---

## 🧪 Test Suites

* `node test-all.js`: Unit test suite (DB, bot formatting, rate limiting, mailer module).
* `node test-all-replies.js`: Messenger payload and quick reply simulator.
* `node test-connections.js`: End-to-end network ping (Turso, Brevo, ImgBB, Meta tokens).
* `node test-html.js`: Structural DOM and viewport assertions across all 24 views.

---

## 📝 Changelog
### [2026-08-23] - Rate Limit Anti-Spam Mute Gate & Cooldown Countdown
- Added exact UTC midnight cooldown time calculation to rate limit notifications.
- Added `warned` flag in `bot_daily_views` table.
- Added automated silence gate to ignore repetitive dashboard requests after initial warning dispatch.

### [2026-08-22] - Unified Single-Button Carousel & README Foundation
- Migrated primary architecture blueprint to `README.md`.
- Converted catalog carousel to 1:1 square aspect ratio (`image_aspect_ratio: "square"`).
- Streamlined carousel buttons to exactly 1 dynamic action button per item.
- Consolidated bottom controls to a single sticky `[ 📊 Dashboard ]` Quick Reply chip.
- Connected reward catalog source to `product_catalog WHERE type = 'reward'`.
- Fully resolved Android-ARM64 / Termux `@libsql` native binary conflict via pure HTTP JSON transport.

### [YYYY-MM-DD] - Feature Title
- Bullet point description of new feature or fix.

### [2026-08-23] - Rate Limiter Query Stabilization
- Stabilized SELECT/UPDATE execution in checkDashboardRateLimit() for full compatibility across all environments.
- Verified test suites for 100% test coverage.

### [2026-08-23] - Rate Limiter Payload & Message Property Hardening
- Ensured checkDashboardRateLimit() always returns defined message strings and status flags under all execution branches.
- Updated unit test assertions to validate randomized user ID sequences.

### [2026-08-23] - Rate Limiter Parameter Serialization & Dual Tier Sync
- Fixed Turso HTTP pipeline parameter type casting for string/date queries.
- Added fast in-memory rate-limit cache with Turso SQL sync to prevent race conditions.

### [2026-08-23] - Split Messages (Dashboard, Invite) & Name/Cost-Only 1:1 Carousel
- Separated Dashboard Stats and Copyable Companion Invite into two distinct sequential messages.
- Simplified carousel subtitles to show strictly `⭐ Cost: <pts> PTS` without verbose helper text.
- Retained 1:1 square image aspect ratio and single sticky `[ 📊 Dashboard ]` Quick Reply.

### [2026-08-23] - Test Suite Assertion Alignment for Separated Payloads
- Updated test-all.js and test-connections.js to inspect dashboardText and invitePromoText independently.
- Confirmed full test coverage across all test runners.

### [2026-08-23] - Dashboard Heat Map, Compact Brevo Logs & Master Pre-Commit Gate
- Activated dynamic monthly activity calendar heat map in index.html.
- Upgraded logs.html with compact row formatting and lifetime Brevo aggregates (Total Sent, Sent Today, Open %, Delivery %, Spam %).
- Added test-master.js enforcing a strict zero-failure pre-commit gate.

### [2026-08-23] - New User Onboarding & End-to-End Referral Flow Tester
- Created test-new-user-flow.js to simulate cold joins, deep-link referral credit, and separate message dispatches.
- Integrated new user flow test suite into test-master.js zero-failure pre-commit gate.

### [2026-08-23] - Referral Onboarding Early Return & Master Suite Fix
- Added immediate early return after processing deep-link referral signups in api/bot.js.
- Added mock token bypass to prevent OAuth error noise during local CI test executions.
- Fixed syntax formatting in test-master.js and verified 100% 5/5 suite pass rate.

### [2026-08-23] - Hardened New User Bot Lifecycle Suite
- Fixed null reference checks on inviter record lookups in test-new-user-bot.js.
- Added automatic table structure provisioning in simulator initialization.

### [2026-08-23] - Referral Onboarding Flow Stabilization & Table Provisioning
- Added automatic `missionaries` table DDL provisioning inside executeBotAction().
- Stabilized mock-token execution for offline unit testing and onboarding simulations.
- Validated all 5 testing suites in test-master.js with 100% pass rate.

### [2026-08-23] - Referral Execution Safety & Parameter Typing Fix
- Fixed Turso parameter serialization for integer arithmetic queries.
- Added automated schema safety migrations for missionaries table columns.
- Validated test-new-user-flow.js to achieve 100% pass rate in master pre-commit gateway.
