const LocalStore = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(`tcrp_${key}`);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(`tcrp_${key}`, JSON.stringify(val)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(`tcrp_${key}`); } catch {}
  }
};

const REMOTE_API_SERVER = (function() {
  if (typeof window !== 'undefined') {
    return LocalStore.get('remote_server_url', 'https://timelesscreationsrewardsprogram.vercel.app');
  }
  return 'https://timelesscreationsrewardsprogram.vercel.app';
})();

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const serverUrl = LocalStore.get('remote_server_url', 'https://timelesscreationsrewardsprogram.vercel.app');
      return originalFetch(`${serverUrl.replace(/\/$/, '')}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  if (container.children.length > 2) {
    container.firstElementChild.remove();
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : ""}`;
  toast.innerHTML = `<span>${type === "error" ? "⚠️" : "✨"}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

const NAV_ITEMS = [
  { key: 'dashboard', label: '📊 Dashboard', url: '/index.html' },
  { key: 'missionaries', label: '👥 Missionaries', url: '/missionaries.html' },
  { key: 'pusher', label: '➕ Add Batch', url: '/pusher.html' },
  { key: 'invoicing', label: '🧾 Order Summary & POS', url: '/invoicing.html' },
  { key: 'drips', label: '💌 24M Drips', url: '/drips.html' },
  { key: 'messengerbot', label: '🎁 Bot Rewards', url: '/messengerbot.html' },
  { key: 'gallery', label: '🖼️ CDN Gallery', url: '/gallery.html' },
  { key: 'logs', label: '📜 Logs', url: '/logs.html' },
  { key: 'settings', label: '⚙️ Settings', url: '/settings.html' }
];

function initAppLayout(activeKey = 'dashboard', pageTitle = 'Dashboard') {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="header-inner">
      <div class="header-branding">
        <button class="hamburger-btn" onclick="toggleMobileDrawer()" aria-label="Toggle Navigation">☰</button>
        <a href="/index.html" class="brand-title">✨ Timeless Creations <span>• ${pageTitle}</span></a>
      </div>
      <nav class="desktop-nav">
        ${NAV_ITEMS.map(item => `
          <a href="${item.url}" class="nav-pill ${item.key === activeKey ? 'active' : ''}">${item.label}</a>
        `).join('')}
      </nav>
      <button onclick="triggerGlobalRefresh()" class="btn btn-dark" style="padding:6px 12px; font-size:0.75rem; min-height:34px; flex-shrink:0;">↻ Sync</button>
    </div>
  `;
  document.body.prepend(header);

  const drawer = document.createElement('div');
  drawer.id = 'mobile-nav-drawer';
  drawer.className = 'mobile-drawer';
  drawer.onclick = (e) => { if (e.target === drawer) toggleMobileDrawer(); };
  drawer.innerHTML = `
    <div class="drawer-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border);">
        <div style="font-family:'Syne',sans-serif; color:var(--gold); font-size:1.05rem; font-weight:800;">Timeless Creations</div>
        <button onclick="toggleMobileDrawer()" class="modal-close-btn">✕</button>
      </div>
      ${NAV_ITEMS.map(item => `
        <a href="${item.url}" class="drawer-link ${item.key === activeKey ? 'active' : ''}">${item.label}</a>
      `).join('')}
    </div>
  `;
  document.body.appendChild(drawer);
}

function toggleMobileDrawer() {
  const d = document.getElementById('mobile-nav-drawer');
  if (d) d.classList.toggle('open');
}

let isRefreshing = false;
async function triggerGlobalRefresh() {
  if (isRefreshing) return;
  isRefreshing = true;
  showToast("Syncing data with server...");
  
  try {
    const [statsRes, mRes] = await Promise.all([
      fetch("/api/main?action=get_stats").then(r => r.json()).catch(() => ({})),
      fetch("/api/main?action=get_missionaries").then(r => r.json()).catch(() => ({}))
    ]);

    if (statsRes && statsRes.ok) LocalStore.set('stats_payload', statsRes);
    if (mRes && mRes.ok && Array.isArray(mRes.missionaries)) LocalStore.set('missionaries', mRes.missionaries);

    showToast("✓ Live data updated!");
    window.dispatchEvent(new CustomEvent("tcrp:data-synced"));
    if (typeof window.renderFromCache === 'function') window.renderFromCache();
    if (typeof window.loadData === 'function') window.loadData();
    if (typeof window.renderRoster === 'function') window.renderRoster();
  } catch (err) {
    showToast("Network error syncing data.", "error");
  } finally {
    isRefreshing = false;
  }
}

function getCalendarMonthLabel(monthIndex) {
  const calendarNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = (Number(monthIndex) - 1) % 12;
  return calendarNames[idx < 0 ? (idx + 12) % 12 : idx];
}

/**
 * Universal Philippine Standard Time (PST/PHT, UTC+8) Helpers
 */
function getPhtDate() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function formatPhtDate(dateVal, includeSeconds = true) {
  if (!dateVal) return '--';
  try {
    let d;
    if (typeof dateVal === 'string') {
      if (!dateVal.endsWith('Z') && !dateVal.includes('+')) {
        d = new Date(dateVal.replace(' ', 'T') + 'Z');
      } else {
        d = new Date(dateVal);
      }
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) d = new Date(dateVal);

    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    }) + ' PHT';
  } catch {
    return String(dateVal);
  }
}

function formatPhtShortTime(dateVal) {
  if (!dateVal) return '--';
  try {
    let d;
    if (typeof dateVal === 'string') {
      if (!dateVal.endsWith('Z') && !dateVal.includes('+')) {
        d = new Date(dateVal.replace(' ', 'T') + 'Z');
      } else {
        d = new Date(dateVal);
      }
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) d = new Date(dateVal);

    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' PHT';
  } catch {
    return String(dateVal);
  }
}

/**
 * HTML Protection Lock Engine
 * Disables right-click context menu, image drag-saving, and download shortcuts
 */
function initHtmlProtection() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Disable Right-Click (except inside editable input/textarea)
  document.addEventListener('contextmenu', (e) => {
    const tag = (e.target.tagName || '').toUpperCase();
    const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
    if (!isEditable) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // 2. Disable Image / Link Dragging
  document.addEventListener('dragstart', (e) => {
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'IMG' || tag === 'A') {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // 3. Disable Save / Source / DevTools Shortcut Keys
  document.addEventListener('keydown', (e) => {
    const key = e.key ? e.key.toLowerCase() : '';
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Block Ctrl+S / Cmd+S (Save Page)
    if (isCtrlOrCmd && key === 's') {
      e.preventDefault();
      showToast("🔒 Page saving is disabled.", "error");
      return false;
    }

    // Block Ctrl+U / Cmd+U (View Source)
    if (isCtrlOrCmd && key === 'u') {
      e.preventDefault();
      return false;
    }

    // Block F12 / Ctrl+Shift+I / Cmd+Option+I (Inspect)
    if (e.key === 'F12' || (isCtrlOrCmd && e.shiftKey && (key === 'i' || key === 'c' || key === 'j'))) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });
}

// Auto-activate HTML protection lock on page load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHtmlProtection);
  } else {
    initHtmlProtection();
  }
}

/**
 * Universal Dark-Gold Warning & Confirmation Modal
 * Replaces native browser confirm() / alert() with a rich glassmorphism UI dialog
 */
function showConfirmWarningModal({
  title = "⚠️ Warning Confirmation",
  message = "Are you sure you want to proceed with this action?",
  confirmText = "Yes, Proceed",
  cancelText = "Cancel",
  isDanger = false,
  icon = null
} = {}) {
  return new Promise((resolve) => {
    let overlay = document.getElementById('universal-warning-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'universal-warning-modal';
      overlay.className = 'warning-modal-overlay';
      document.body.appendChild(overlay);
    }

    const defaultIcon = isDanger ? '🚨' : '⚠️';
    const displayIcon = icon || defaultIcon;

    overlay.innerHTML = `
      <div class="warning-modal-card">
        <div class="warning-icon-badge ${isDanger ? 'danger' : ''}">${displayIcon}</div>
        <div class="warning-title-text ${isDanger ? 'danger' : ''}">${title}</div>
        <div class="warning-msg-text">${message}</div>
        <div class="warning-actions-row">
          <button type="button" id="warn-modal-cancel-btn" class="btn btn-dark">${cancelText}</button>
          <button type="button" id="warn-modal-confirm-btn" class="btn ${isDanger ? 'btn-danger' : 'btn-gold'}">${confirmText}</button>
        </div>
      </div>
    `;

    overlay.classList.add('open');

    const handleConfirm = () => {
      overlay.classList.remove('open');
      resolve(true);
    };

    const handleCancel = () => {
      overlay.classList.remove('open');
      resolve(false);
    };

    const confirmBtn = document.getElementById('warn-modal-confirm-btn');
    const cancelBtn = document.getElementById('warn-modal-cancel-btn');
    if (confirmBtn) confirmBtn.onclick = handleConfirm;
    if (cancelBtn) cancelBtn.onclick = handleCancel;
  });
}

/**
 * Automated Internal Deployment Update & APK In-App Updater
 * Automatically polls for new deployments and APK updates every 60s
 */
const CURRENT_APP_VERSION = "1.2.0";
const CURRENT_APP_VERSION_CODE = 4;
const CURRENT_DEPLOYMENT_ID = "deploy_20260902_v1_2";

async function checkDeploymentUpdate(isManual = false) {
  try {
    const res = await fetch('/api/main?action=get_version&t=' + Date.now());
    if (!res.ok) return;
    const remote = await res.json();
    if (!remote || !remote.ok) return;

    const storedDeployId = LocalStore.get('tcrp_last_deployment_id', CURRENT_DEPLOYMENT_ID);
    const isNewDeploy = remote.deployment_id && remote.deployment_id !== storedDeployId && remote.deployment_id !== CURRENT_DEPLOYMENT_ID;

    // 1. Web / OTA Deployment Live Update
    if (isNewDeploy) {
      LocalStore.set('tcrp_last_deployment_id', remote.deployment_id);
      showToast("✨ New deployment live! Refreshing views...", "info");
      setTimeout(() => {
        window.location.reload();
      }, 1800);
      return;
    }

    // 2. Native Android APK In-App Update Prompt
    const isAndroidApp = (typeof window !== 'undefined' && (
      window.location.host === 'appassets.androidplatform.net' ||
      navigator.userAgent.includes('TCRP-Android') ||
      window.AndroidBridge !== undefined
    ));

    const storedApkVersion = LocalStore.get('tcrp_installed_version_code', CURRENT_APP_VERSION_CODE);
    if (isAndroidApp && remote.version_code > storedApkVersion) {
      const confirmed = await showConfirmWarningModal({
        title: `📱 New App Update (v${remote.version})!`,
        message: `An updated Android build is available.<br><br><strong>What's New:</strong> ${remote.changelog || 'Latest improvements and bug fixes.'}`,
        confirmText: "📥 Download & Install APK",
        cancelText: "Remind Me Later",
        isDanger: false,
        icon: "🚀"
      });

      if (confirmed) {
        LocalStore.set('tcrp_installed_version_code', remote.version_code);
        window.location.href = remote.apk_url || '/TimelessRewards.apk';
      }
    }
  } catch (_) {}
}

function initAutoUpdateChecker() {
  // Check 3 seconds after page load
  setTimeout(() => checkDeploymentUpdate(false), 3000);
  // Recurring check every 60 seconds
  setInterval(() => checkDeploymentUpdate(false), 60000);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoUpdateChecker);
  } else {
    initAutoUpdateChecker();
  }
}




