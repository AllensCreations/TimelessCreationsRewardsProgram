# Changelog

All notable changes to the Timeless Rewards Android APK and platform are documented in this file.

## [v2.61.0] - 2026-09-11 (Build 74)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.60.0] - 2026-09-11 (Build 73)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.59.0] - 2026-09-11 (Build 72)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.58.0] - 2026-09-11 (Build 71)

### 🤖 Messenger Bot Onboarding & Anti-Spam Modernization
- **Unified 1-Step Onboarding with Embedded T&C**: Merged separate Terms & Conditions button prompt into the initial account setup step (`AWAITING_ALL_IN_ONE`). Missionary details request now directly includes: `"Note: By entering this information, you agree to our Terms of Service & Privacy Policy."`, reducing friction from 3 clicks to 1 message reply.
- **Removed Hardcoded Unoffered Product Mentions**: Cleaned `sendGatekeeper` to remove `• Custom nametags, temple keychains & CTR gear` in favor of dynamic `• Exclusive missionary rewards catalog`, ensuring zero promises of uncataloged items.
- **Messenger Typing Indicator (`sender_action: "typing_on"`)**: Added native `sendTypingIndicator` helper to `lib/botHandler.js` dispatched on inbound message processing, providing responsive conversational pacing and humanized bot delivery.
- **Interactive Simulator Typing Animation**: Enhanced `views/messenger-test.html` with animated three-dot typing indicator bubble (`.typing-indicator-msg`), mirroring real Facebook Messenger user experience.
- **Make.com vs Direct Meta API Architecture Strategy**: Validated existing direct API setup with integrated multi-layered anti-spam defenses (`checkBurstRateLimit`, `checkDailyMessageQuota`, `isDoubleTapDuplicate`, `checkOtpResendEligibility`) proving superior protection and reliability compared to third-party automation webhooks.

### 🚀 Platform & Android Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.57.0] - 2026-09-11 (Build 70)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.56.0] - 2026-09-11 (Build 69)

### 🤖 Messenger Bot & Rewards Hub Overhaul
- **Single "Check" Quick Response**: Streamlined the verified missionary conversational experience by eliminating cluttered response chips in favor of a single, intuitive Quick Reply: `Check` (`ACTION_CHECK`).
- **Unified 3-in-1 Hub Sequence**: Tapping `Check` or sending any incoming text now dispatches a unified three-message hub sequence:
  1. **Missionary Dashboard**: High-contrast Mathematical Sans-Serif Bold Unicode profile summary showing missionary name, `@missionary.org` email, live points balance, and referral code.
  2. **Interactive Rewards Carousel**: Directly linked to `product_catalog WHERE type = 'reward'` (managed via `views/messengerbot.html`), displaying 1:1 square image cards with product photos, point costs, and `Claim (X PTS)` / `Need X More PTS` action buttons.
  3. **Companion Referral Message**: Ready-to-forward companion referral copy with personalized `m.me` invite link to earn +1 Point per companion joined.
- **Empty Catalog Graceful Notice**: When `product_catalog` has 0 items, the bot cleanly falls back to a polite notice (`REWARDS CATALOG\n\nThere are currently no reward items available in the catalog. Please check back soon!`) without broken template attachments.
- **Persistent Menu Modernization**: Secondary capabilities moved into Meta's Persistent Menu (`Check`, `Help & FAQs`, `Redeem Promo`), keeping composer quick replies focused.
- **Strict Zero-Emoji Standard**: Removed all emojis across the entire Messenger bot interface, database handlers, setup scripts, and simulator views, enforcing clean Unicode typography.
- **Interactive Simulator Synchronization**: Updated `views/messenger-test.html` to mirror the live Meta Messenger phone UI with single `Check` chip, static menu chips, and dynamic horizontal-scroll carousel.

### 🧪 Automated Testing & Telemetry Enhancements
- **New Dedicated Test Suite (`tests/test-bot-check-hub.js`)**: 24-point automated test suite validating the single "Check" flow, random chat dispatch, empty catalog notice, carousel claim/goal postbacks, FAQs, promo info, zero emojis, and unverified gatekeeper protection.
- **Modernized Test Suites (`tests/test-all-replies.js` & `tests/test-all.js`)**: Updated legacy assertions to validate the single `Check` quick reply, zero-emoji typography, and daily view rate limiter.
- **Database Fallback Support (`lib/db.js`)**: Added complete `bot_daily_views` and `product_catalog` query mutations to `executeInMemoryFallback` for offline test isolation.
- **Consolidated Runner Integration**: Added `test-bot-check-hub.js` into `tests/run-all.js` as an official suite, bringing total test coverage to 8 complete suites passing 100%.

### 🚀 Android & App Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.55.0] - 2026-09-11 (Build 68)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.54.0] - 2026-09-11 (Build 67)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.53.0] - 2026-09-11 (Build 66)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.52.0] - 2026-09-11 (Build 65)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.51.0] - 2026-09-11 (Build 64)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.50.0] - 2026-09-11 (Build 63)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.44.0] - 2026-09-10 (Build 56)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.43.0] - 2026-09-10 (Build 55)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.42.0] - 2026-09-10 (Build 54)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.41.0] - 2026-09-10 (Build 53)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.40.0] - 2026-09-10 (Build 52)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.39.0] - 2026-09-10 (Build 51)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.38.0] - 2026-09-10 (Build 50)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.37.0] - 2026-09-10 (Build 49)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.36.0] - 2026-09-10 (Build 48)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.35.0] - 2026-09-10 (Build 47)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.34.0] - 2026-09-09 (Build 46)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.33.0] - 2026-09-09 (Build 45)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.32.0] - 2026-09-09 (Build 44)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.31.0] - 2026-09-09 (Build 43)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.30.0] - 2026-09-09 (Build 42)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.29.0] - 2026-09-09 (Build 41)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.28.0] - 2026-09-09 (Build 40)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.27.0] - 2026-09-09 (Build 39)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.26.0] - 2026-09-09 (Build 38)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.25.0] - 2026-09-09 (Build 37)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.24.0] - 2026-09-09 (Build 36)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.23.0] - 2026-09-09 (Build 35)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.22.0] - 2026-09-09 (Build 34)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.21.0] - 2026-09-09 (Build 33)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.20.0] - 2026-09-09 (Build 32)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.19.0] - 2026-09-09 (Build 31)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.18.0] - 2026-09-09 (Build 30)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.16.0] - 2026-09-09 (Build 28)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.14.0] - 2026-09-09 (Build 26)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.13.0] - 2026-09-09 (Build 25)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.12.0] - 2026-09-09 (Build 24)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.11.0] - 2026-09-09 (Build 23)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.10.0] - 2026-09-09 (Build 22)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.9.0] - 2026-09-09 (Build 21)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.8.0] - 2026-09-05 (Build 20)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.7.0] - 2026-09-05 (Build 19)

### 🚀 New Features & Enhancements
- **Hardware-Backed Version & Code Bridge**: Added `AndroidBridge.getAppVersion()` and `AndroidBridge.getAppVersionCode()` in `LauncherActivity.java` to read version code and name directly from Android's `PackageManager`.
- **Minimal In-App Update Modal**: In-app updater prompt is now a sleek, compact popup showing only version, build code, download size, and "Update Now" / "Later" buttons with zero changelog clutter.
- **Native Android Scroll Physics & Scrollbars**: Enabled native vertical scrollbar overlays (`setVerticalScrollBarEnabled(true)` and `setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY)`) with responsive bounce overscroll.

### 🐛 Bug Fixes
- **Eliminated WebView Immutable Asset Cache Trap**: Discovered that `LauncherActivity.java` was serving local `.css` and `.js` files with `max-age=31536000, immutable`, causing devices to lock onto stale stylesheets and scripts. Replaced with `no-cache, no-store, must-revalidate` and added `webView.clearCache(true)` on launch.
- **Cache-Busting Asset Links**: Added `?v=2.7.0` query strings to `<link>` and `<script>` tags across all 11 HTML view templates, guaranteeing immediate pickup of new CSS/JS fixes.
- **Native Viewport Touch Scrolling Standard**: Standardized `html` and `body` rules in `assets/app.css` by removing `height: 100%` and synthetic overflow constraints, allowing the native Android viewport to handle vertical scrolling naturally.
- **Overlay Touch Blocker Guard**: Configured `.warning-modal-overlay` to `display: none` when closed, eliminating invisible compositor layers from intercepting touch drags.
- **Removed Desktop-Emulation Viewport Overrides**: Removed `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` which caused Android WebView to freeze touch-drag coordinate recognition.

## [v2.6.0] - 2026-09-05 (Build 18)

### 🐛 Bug Fixes
- **Fixed Touch Scrolling Across All Pages**: Restored native document scrolling by eliminating restrictive `overscroll-behavior-y: none` and global `user-select: none` from `html, body`. Configured proper mobile viewport scrolling (`overflow-y: auto; -webkit-overflow-scrolling: touch;`).
- **Android WebView Native Scroll Physics**: Enabled vertical scrollbars and overlay styling in `LauncherActivity.java`, while removing desktop-emulation viewport overrides (`setUseWideViewPort`, `setLoadWithOverviewMode`) that were freezing touch drags.
- **Minimal In-App Update Popup**: Streamlined the update prompt into a clean, compact popup modal without any changelog text clutter, displaying only version, build code, file size, and quick action buttons ("Update Now" / "Later").

### ⚡ Enhancements & Refactors
- **Compact Dialog Ergonomics**: Redesigned `.warning-modal-card` to a compact 320px card width with refined touch targets and gold accent styling.
- **Synchronized Asset Bundling**: Re-synchronized web assets and scripts across `views/`, `public/`, and Android asset folders.

## [v2.5.0] - 2026-09-05 (Build 17)

- **Build Code**: `17`
- **Branch**: `Appversion`
- **Direct APK**: [Download TimelessRewards.apk](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk)

### 📝 Release Highlights
### 🚀 New Features
- **Native SQLite Offline Storage Engine**: Added `NativeStorageEngine.java` and `TCRPApplication.java` for persistent hardware/SQLite-backed key-value caching accessible via `AndroidBridge.setCache()` and `AndroidBridge.getCache()`.
- **Hardware Barcode & QR Scanner Engine**: Integrated ZXing barcode scanner and QR code generator (`IntentIntegrator` & `MultiFormatWriter`) via native Android bridge.
- **Tactile Haptic Feedback**: Added `AndroidBridge.vibrate(ms)` supporting tactile vibrations on user interactions.
- **Double-Tap Back Navigation Guard**: Added double-tap back press confirmation in `LauncherActivity.java` to prevent accidental app exits.

### 🐛 Bug Fixes
- **Update Modal Loop Suppressed**: Fixed updater logic to never trigger the modal popup when the installed APK matches or exceeds the remote release version.
- **Stale Cache Prevention**: Added cache-busting timestamp queries to `version.json` to prevent caching issues during update checks.
- **Binary Upstream Conflict Resolved**: Re-aligned git binary asset tracking to prevent merge conflicts in automated CI builds.

### ⚡ Enhancements & Improvements
- **Embedded Offline Typography**: Bundled local TTF fonts (`DM Mono`, `DM Sans`, `Syne`) to guarantee beautiful typography without external Google Fonts dependencies.
- **Automated Release Notes Pipeline**: Added `scripts/generate-release-notes.js` and updated CI workflow to automatically categorize features, bugs, and fixes on every release.
- **Multi-Target Asset Synchronization**: Automated sync script synchronizes web assets across `views/`, `public/`, and both Android build targets.

### 🐛 Bug Fixes
- prevent update popup from appearing when app version matches installed app [skip ci] (bdfa3ac)
- suppress update modal popup when app version and release version match [skip ci] (0e53514)
- trigger APK build on Appversion, sync web assets, untrack stale build cache, and sign release APK (01d636a)


## [v2.4.0] - 2026-09-04 (Build 16)
### 🐛 Bug Fixes
- Suppressed recurring update popup modal on app load when installed APK matches the latest remote release build.
- Fixed version comparison semantics to handle both semantic versioning and build codes.

## [v2.3.0] - 2026-09-04 (Build 15)
### 🐛 Bug Fixes
- Corrected update status card feedback in Settings view.
- Ensured release link points directly to release assets without unnecessary cache hits.

## [v2.2.0] - 2026-09-04 (Build 14)
### ⚡ Enhancements & Improvements
- Added automated CI build pipeline for APK packaging on push to `Appversion`.
- Untracked stale build cache from repository.
- Integrated automated signing of release APK.

## [v2.1.0] - 2026-09-04 (Build 13)
### 🚀 New Features
- Packaged lightweight 2.8MB release APK.
- Synchronized web assets across `views/`, `public/`, and Android asset folders.
