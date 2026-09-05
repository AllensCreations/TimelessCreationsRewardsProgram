## 🎁 Timeless Rewards v2.5.0 (Build 17)

- **Build Code**: `17`
- **Branch**: `Appversion`
- **Direct APK**: [Download TimelessRewards.apk](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk)

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

