# Changelog

All notable changes to the Timeless Rewards Android APK and platform are documented in this file.

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
