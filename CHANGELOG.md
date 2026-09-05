# Changelog

All notable changes to the Timeless Rewards Android APK and platform are documented in this file.

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
