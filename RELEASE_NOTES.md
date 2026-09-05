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
