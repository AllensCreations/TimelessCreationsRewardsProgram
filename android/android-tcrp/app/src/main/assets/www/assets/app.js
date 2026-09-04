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
 * Global HTML Escaper
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Batch Month to 1st Month Calculation Helper
 * Rule: If batch is August 2026, 1st Month is September 2026.
 */
function getFirstMonthInfo(batchMonthStr) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  if (!batchMonthStr || typeof batchMonthStr !== 'string') {
    return {
      batchMonthName: "August",
      batchYear: 2026,
      batchDisplay: "August 2026",
      firstMonthName: "September",
      firstMonthYear: 2026,
      firstMonthDisplay: "September 2026",
      firstMonthNum: 9
    };
  }

  const str = batchMonthStr.toLowerCase().trim();
  let batchMonthIdx = -1;
  for (let i = 0; i < monthNames.length; i++) {
    if (str.includes(monthNames[i].toLowerCase())) {
      batchMonthIdx = i;
      break;
    }
  }
  if (batchMonthIdx === -1) batchMonthIdx = 7; // Default to August

  const yearMatch = batchMonthStr.match(/\b(20\d\d)\b/);
  const now = new Date();
  const batchYear = yearMatch ? parseInt(yearMatch[1], 10) : now.getFullYear();

  const firstMonthIdx = (batchMonthIdx + 1) % 12;
  const firstMonthYear = (batchMonthIdx === 11) ? batchYear + 1 : batchYear;

  return {
    batchMonthName: monthNames[batchMonthIdx],
    batchYear: batchYear,
    batchDisplay: `${monthNames[batchMonthIdx]} ${batchYear}`,
    firstMonthName: monthNames[firstMonthIdx],
    firstMonthYear: firstMonthYear,
    firstMonthDisplay: `${monthNames[firstMonthIdx]} ${firstMonthYear}`,
    firstMonthNum: firstMonthIdx + 1
  };
}

function calculateMissionMonth(batchMonthStr, maxMonths = 24, targetDate = new Date()) {
  const info = getFirstMonthInfo(batchMonthStr);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;

  const elapsed = (targetYear - info.firstMonthYear) * 12 + (targetMonth - info.firstMonthNum) + 1;
  return Math.max(0, Math.min(elapsed, maxMonths));
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
 * TCRPSync Engine (Stale-While-Revalidate & Offline-First Local Cache)
 * Provides 0ms instantaneous page rendering backed by silent background API revalidation
 */
const TCRPSync = {
  get(key, defaultVal = null) {
    const entry = LocalStore.get('tcrp_sync_' + key, null);
    return entry && entry.data ? entry.data : defaultVal;
  },
  set(key, val) {
    LocalStore.set('tcrp_sync_' + key, { data: val, cachedAt: Date.now() });
  },
  getCachedData(key) {
    const entry = LocalStore.get('tcrp_sync_' + key, null);
    if (!entry) return null;
    return entry.data || null;
  },
  async fetchWithCache(url, options = {}, { cacheKey, onCached, onFresh } = {}) {
    const key = cacheKey || url;
    const cachedEntry = LocalStore.get('tcrp_sync_' + key, null);
    
    // 1. Instant 0ms Render from Local Cache
    if (cachedEntry && cachedEntry.data) {
      if (typeof onCached === 'function') {
        try { onCached(cachedEntry.data, cachedEntry.cachedAt); } catch(e) {}
      }
    }

    // 2. Silent Background Revalidation
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        const fresh = await res.json();
        LocalStore.set('tcrp_sync_' + key, { data: fresh, cachedAt: Date.now() });
        if (typeof onFresh === 'function') {
          try { onFresh(fresh, Date.now()); } catch(e) {}
        }
        return fresh;
      }
    } catch (err) {
      // Network failure: cached data already served
      console.warn('[TCRPSync] Background sync failed, using local cache:', err);
    }
    return cachedEntry ? cachedEntry.data : null;
  },
  invalidate(key) {
    try {
      localStorage.removeItem('tcrp_sync_' + key);
    } catch (_) {}
  }
};

/**
 * Automated Internal Deployment Update & APK In-App Updater
 * Automatically polls for new deployments and APK updates every 60s
 */
let CURRENT_APP_VERSION = "2.2.0";
let CURRENT_APP_VERSION_CODE = 14;
let CURRENT_DEPLOYMENT_ID = "deploy_20260904_v2_2";
let hasLoadedLocalVersion = false;

async function loadInstalledVersion() {
  if (hasLoadedLocalVersion) return;
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        CURRENT_APP_VERSION = String(data.version).replace(/^v/i, '');
        if (data.version_code) CURRENT_APP_VERSION_CODE = Number(data.version_code);
        if (data.deployment_id) CURRENT_DEPLOYMENT_ID = data.deployment_id;
        hasLoadedLocalVersion = true;
      }
    }
  } catch (_) {}
}

function isNewerSemVer(remoteVer, currentVer) {
  if (!remoteVer || !currentVer) return false;
  const rParts = String(remoteVer).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const cParts = String(currentVer).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r !== c) return r > c;
  }
  return false;
}

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && (
    window.location.host === 'appassets.androidplatform.net' ||
    window.location.protocol === 'file:' ||
    !window.location.host
  )) {
    return 'https://timelesscreationsrewardsprogram.vercel.app';
  }
  return '';
}

async function checkDeploymentUpdate(isManual = false) {
  try {
    await loadInstalledVersion();
    const apiBase = getApiBaseUrl();
    let remote = null;

    try {
      const q = new URLSearchParams({
        action: 'get_version',
        client_version: CURRENT_APP_VERSION,
        client_version_code: String(CURRENT_APP_VERSION_CODE),
        t: String(Date.now())
      });
      if (isManual) q.set('force', 'true');

      const res = await fetch(apiBase + '/api/main?' + q.toString(), { cache: 'no-store' });
      if (res.ok) remote = await res.json();
    } catch (_) {}

    if (!remote || !remote.ok) {
      try {
        const ghRes = await fetch('https://raw.githubusercontent.com/AllensCreations/TimelessCreationsRewardsProgram/Appversion/public/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          if (ghData && ghData.version) {
            remote = { ok: true, ...ghData };
          }
        }
      } catch (_) {}
    }

    const msgEl = typeof document !== 'undefined' ? document.getElementById('update-status-msg') : null;
    const badgeEl = typeof document !== 'undefined' ? document.getElementById('app-version-badge') : null;

    if (!remote || !remote.ok) {
      if (isManual) {
        showToast("Offline or remote server unreachable.", "info");
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.borderColor = 'var(--border)';
          msgEl.style.color = 'var(--muted)';
          msgEl.textContent = '✓ Offline mode active. Using cached assets.';
        }
      }
      return;
    }

    if (badgeEl) {
      badgeEl.textContent = `v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE})`;
    }

    const storedDeployId = LocalStore.get('tcrp_last_deployment_id', CURRENT_DEPLOYMENT_ID);
    const isNewDeploy = remote.deployment_id && remote.deployment_id !== storedDeployId && remote.deployment_id !== CURRENT_DEPLOYMENT_ID;

    // 1. Web / OTA Deployment Live Update
    if (isNewDeploy && window.location.host !== 'appassets.androidplatform.net') {
      LocalStore.set('tcrp_last_deployment_id', remote.deployment_id);
      showToast("✨ New deployment live! Refreshing views...", "info");
      setTimeout(() => {
        window.location.reload();
      }, 1800);
      return;
    }

    // 2. Native Android APK In-App Update & Release Link Comparison
    const remoteCode = Number(remote.version_code) || CURRENT_APP_VERSION_CODE;
    const remoteVer = String(remote.version || CURRENT_APP_VERSION).replace(/^v/i, '');
    const clientVer = String(CURRENT_APP_VERSION).replace(/^v/i, '');
    const clientCode = Number(CURRENT_APP_VERSION_CODE);
    const rel = remote.release || {};

    // Comparison logic: EXACT check
    const isSameCode = (remoteCode === clientCode);
    const isSameVersion = (remoteVer === clientVer);
    const isIdentical = isSameCode && isSameVersion;
    const isRemoteNewerCode = remoteCode > clientCode;
    const isRemoteNewerSemVer = isNewerSemVer(remoteVer, clientVer);
    const isRemoteStrictlyNewer = isRemoteNewerCode || isRemoteNewerSemVer;
    const isInstalledSameOrNewer = isIdentical || (!isRemoteStrictlyNewer);

    const comp = remote.comparison || {};
    const isSame = isInstalledSameOrNewer || comp.is_same === true;
    const hasUpdate = !isSame && (comp.has_update !== false) && isRemoteStrictlyNewer;

    if (isSame) {
      // When App version and Current app is the same (or client is newer) - NEVER show modal popup!
      if (badgeEl) {
        badgeEl.textContent = `v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE}) • Up to date`;
        badgeEl.style.background = 'rgba(74,222,128,0.15)';
        badgeEl.style.color = 'var(--green)';
      }
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.borderColor = 'rgba(74,222,128,0.3)';
        msgEl.style.background = 'rgba(74,222,128,0.05)';
        msgEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:6px;">
            <strong style="color:var(--green); font-size:0.8rem;">✓ APK in Release Link matches Installed APK (Same Build)</strong>
            <span style="font-size:0.7rem; color:var(--muted);">${rel.apk_size_formatted || '2.8 MB'}</span>
          </div>
          <div style="font-size:0.73rem; color:var(--muted); line-height:1.4;">
            ${comp.status_message || `Installed v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE}) is identical to latest release ${rel.tag_name || ('v' + CURRENT_APP_VERSION)}.`}
            ${rel.release_url ? ` &bull; <a href="${rel.release_url}" target="_blank" rel="noopener" style="color:var(--gold); text-decoration:none;">View Release Link ↗</a>` : ''}
          </div>
        `;
      }
      if (isManual) {
        showToast(`✓ Release APK is identical to installed build v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE})!`, "success");
      }
    } else if (hasUpdate) {
      if (badgeEl) {
        badgeEl.textContent = `Update: v${remoteVer} (Build ${remoteCode})`;
        badgeEl.style.background = 'rgba(201,168,76,0.2)';
        badgeEl.style.color = 'var(--gold)';
      }
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.borderColor = 'rgba(201,168,76,0.5)';
        msgEl.style.background = 'rgba(201,168,76,0.08)';
        msgEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
            <strong style="color:var(--gold); font-size:0.82rem;">🚀 New Update Detected in Release Link!</strong>
            <span style="font-size:0.7rem; color:var(--muted);">${rel.apk_size_formatted || ''}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text); line-height:1.4;">
            <div><strong>Release APK:</strong> ${rel.name || (`v${remoteVer} (Build ${remoteCode})`)}</div>
            <div><strong>Installed APK:</strong> v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE})</div>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <a href="${remote.apk_url || remote.direct_apk_url || remote.github_apk_url || 'https://github.com/AllensCreations/TimelessCreationsRewardsProgram/releases/latest/download/TimelessRewards.apk'}" class="btn btn-sm btn-gold" style="text-decoration:none; padding:4px 12px; font-size:0.75rem;">⬇️ Download Release APK</a>
            ${remote.release_url ? `<a href="${remote.release_url}" target="_blank" rel="noopener" class="btn btn-sm" style="background:rgba(255,255,255,0.08); color:var(--text); text-decoration:none; padding:4px 10px; font-size:0.75rem; border:1px solid var(--border);">🔗 Release Link</a>` : ''}
          </div>
        `;
      }

      // If user already dismissed this specific release build, do not pop up automatically in background
      const alreadyDismissed = Number(LocalStore.get('tcrp_dismissed_update_build', 0)) === remoteCode;
      if (!isManual && alreadyDismissed) {
        return;
      }

      const confirmed = await showConfirmWarningModal({
        title: `📱 New App Update Available (v${remoteVer})!`,
        message: `A new build is available in the Release Link.<br><br><strong>Release:</strong> ${rel.name || ('v' + remoteVer + ' (Build ' + remoteCode + ')')}<br><strong>File Size:</strong> ${rel.apk_size_formatted || '2.8 MB'}<br><br><strong>What's New:</strong> ${remote.changelog || 'Latest improvements and bug fixes.'}`,
        confirmText: "🚀 Update / Download Now",
        cancelText: "Remind Me Later",
        isDanger: false,
        icon: "🚀"
      });

      if (confirmed) {
        LocalStore.set('tcrp_installed_version_code', remoteCode);
        const targetUrl = remote.apk_url || remote.direct_apk_url || remote.github_apk_url || 'https://github.com/AllensCreations/TimelessCreationsRewardsProgram/releases/latest/download/TimelessRewards.apk';
        window.location.href = targetUrl;
      } else {
        LocalStore.set('tcrp_dismissed_update_build', remoteCode);
      }
    } else {
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.borderColor = 'var(--border)';
        msgEl.style.background = 'rgba(255,255,255,0.03)';
        msgEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-weight:600; color:var(--gold);">ℹ️ Build Comparison</span>
            <span style="font-size:0.7rem; color:var(--muted);">${rel.apk_size_formatted || ''}</span>
          </div>
          <div style="font-size:0.73rem; color:var(--muted); line-height:1.4;">
            ${comp.status_message || `Installed build: v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE}). Release: v${remoteVer} (Build ${remoteCode}).`}
            ${rel.release_url ? ` &bull; <a href="${rel.release_url}" target="_blank" rel="noopener" style="color:var(--gold); text-decoration:none;">View Release Link ↗</a>` : ''}
          </div>
        `;
      }
      if (isManual) {
        showToast(`Installed: v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_VERSION_CODE}) • Release: v${remoteVer}`, "info");
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




