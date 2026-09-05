### 🐛 Bug Fixes
- **Fixed Touch Scrolling Across All Pages**: Restored native document scrolling by eliminating restrictive `overscroll-behavior-y: none` and global `user-select: none` from `html, body`. Configured proper mobile viewport scrolling (`overflow-y: auto; -webkit-overflow-scrolling: touch;`).
- **Android WebView Native Scroll Physics**: Enabled vertical scrollbars and overlay styling in `LauncherActivity.java`, while removing desktop-emulation viewport overrides (`setUseWideViewPort`, `setLoadWithOverviewMode`) that were freezing touch drags.
- **Minimal In-App Update Popup**: Streamlined the update prompt into a clean, compact popup modal without any changelog text clutter, displaying only version, build code, file size, and quick action buttons ("Update Now" / "Later").

### ⚡ Enhancements & Refactors
- **Compact Dialog Ergonomics**: Redesigned `.warning-modal-card` to a compact 320px card width with refined touch targets and gold accent styling.
- **Synchronized Asset Bundling**: Re-synchronized web assets and scripts across `views/`, `public/`, and Android asset folders.
