// In-memory instant hashmap cache for 0ms lookups
const _memCache = new Map();

const LocalStore = {
  get(key, fallback = null) {
    if (_memCache.has(key)) {
      return _memCache.get(key);
    }
    try {
      // 1. Check ultra-fast native C/C++ SQLite binary cache if running in Android app
      if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.getCache === 'function') {
        const nativeVal = window.AndroidBridge.getCache(`tcrp_${key}`);
        if (nativeVal !== null && nativeVal !== undefined) {
          const parsed = JSON.parse(nativeVal);
          _memCache.set(key, parsed);
          return parsed;
        }
      }
      // 2. Standard DOM localStorage fallback
      const v = localStorage.getItem(`tcrp_${key}`);
      if (v) {
        const parsed = JSON.parse(v);
        _memCache.set(key, parsed);
        // Write-through to native SQLite binary cache for future instant offline hits
        if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.setCache === 'function') {
          window.AndroidBridge.setCache(`tcrp_${key}`, v);
        }
        return parsed;
      }
      return fallback;
    } catch { return fallback; }
  },
  set(key, val) {
    _memCache.set(key, val);
    try {
      const jsonStr = JSON.stringify(val);
      localStorage.setItem(`tcrp_${key}`, jsonStr);
      // Fast persist into native C/C++ SQLite encrypted binary engine
      if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.setCache === 'function') {
        window.AndroidBridge.setCache(`tcrp_${key}`, jsonStr);
      }
    } catch {}
  },
  remove(key) {
    _memCache.delete(key);
    try {
      localStorage.removeItem(`tcrp_${key}`);
      if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.removeCache === 'function') {
        window.AndroidBridge.removeCache(`tcrp_${key}`);
      }
    } catch {}
  },
  clear() {
    _memCache.clear();
    try {
      localStorage.clear();
      if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.clearCache === 'function') {
        window.AndroidBridge.clearCache();
      }
    } catch {}
  }
};

// Hardware-accelerated native barcode / QR scanner bridge
window.TCRPScanner = {
  scan(callback) {
    if (typeof callback === 'function') {
      window._nativeBarcodeCallback = callback;
    }
    if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.scanBarcode === 'function') {
      window.AndroidBridge.scanBarcode();
    } else {
      const manual = prompt('Enter or scan barcode / QR code:');
      if (manual && typeof callback === 'function') {
        callback(manual);
      }
    }
  }
};

window.onNativeBarcodeScanned = function(code) {
  if (window._nativeBarcodeCallback) {
    window._nativeBarcodeCallback(code);
    window._nativeBarcodeCallback = null;
  } else {
    window.dispatchEvent(new CustomEvent('tcrp-barcode-scanned', { detail: { code } }));
  }
};

// Hardware-accelerated native QR Code Generator
window.TCRPQRCode = {
  generate(text, width = 256, height = 256) {
    if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.generateQRCode === 'function') {
      const dataUri = window.AndroidBridge.generateQRCode(text, width, height);
      if (dataUri) return dataUri;
    }
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23fff"/><rect x="10" y="10" width="80" height="80" fill="none" stroke="%23c9a84c" stroke-width="2"/><text x="50" y="55" font-family="sans-serif" font-size="8" text-anchor="middle" fill="%23000">${encodeURIComponent(text.substring(0, 20))}</text></svg>`;
  }
};

// Hierarchical Native Hardware Back Navigation Handler
window.onHardwareBackPressed = function() {
  // 1. If mobile navigation drawer is open, close it
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer && (drawer.classList.contains('open') || drawer.style.display === 'block')) {
    if (typeof toggleMobileDrawer === 'function') toggleMobileDrawer();
    else { drawer.classList.remove('open'); drawer.style.display = 'none'; }
    return true;
  }
  // 2. If any modal or popup overlay is open, close it
  const openModals = document.querySelectorAll('.modal.active, .modal.show, [id$="-modal"].open, [id$="-dialog"].open');
  if (openModals.length > 0) {
    openModals.forEach(m => {
      m.classList.remove('active', 'show', 'open');
      if (m.style.display && m.style.display !== 'none') m.style.display = 'none';
    });
    return true;
  }
  return false;
};

// Global tactile micro-haptics on all user taps
if (typeof window !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('button, .btn, .nav-pill, .tab-btn, .qr-chip, input[type="submit"], input[type="checkbox"], input[type="radio"], .card-clickable');
    if (target && window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
      window.AndroidBridge.vibrate(12);
    }
  }, { passive: true });
}

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
    const [statsRes, mRes, pendingRes] = await Promise.all([
      fetch("/api/main?action=get_stats").then(r => r.json()).catch(() => ({})),
      fetch("/api/main?action=get_missionaries").then(r => r.json()).catch(() => ({})),
      fetch("/api/main?action=get_pending_emails").then(r => r.json()).catch(() => ({}))
    ]);

    if (statsRes && statsRes.ok) LocalStore.set('stats_payload', statsRes);
    if (mRes && mRes.ok && Array.isArray(mRes.missionaries)) LocalStore.set('missionaries', mRes.missionaries);
    if (pendingRes && pendingRes.ok) {
      LocalStore.set('pending_emails_data', pendingRes);
      LocalStore.set('missionaries_with_pending_data', pendingRes);
    }

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

const MONTH_NAMES_GLOBAL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Formats any date / ISO string / timestamp into "MONTH YEAR" format without day (e.g. "April 2026", "September 2026").
 */
function formatMonthYear(dateVal, fallback = 'Never') {
  if (!dateVal) return fallback;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    for (let i = 0; i < MONTH_NAMES_GLOBAL.length; i++) {
      const mName = MONTH_NAMES_GLOBAL[i];
      if (trimmed.toLowerCase().startsWith(mName.toLowerCase())) {
        const yMatch = trimmed.match(/\b(20\d\d)\b/);
        return yMatch ? `${mName} ${yMatch[1]}` : mName;
      }
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      if (m >= 1 && m <= 12) {
        return `${MONTH_NAMES_GLOBAL[m - 1]} ${y}`;
      }
    }
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const phtDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (8 * 3600000));
    return `${MONTH_NAMES_GLOBAL[phtDate.getMonth()]} ${phtDate.getFullYear()}`;
  } catch (_) {
    return String(dateVal);
  }
}

// Alias formatShortDateMMDDYY to formatMonthYear for backward-compatible calls
function formatShortDateMMDDYY(dateVal) {
  return formatMonthYear(dateVal, 'Never');
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
 * Parses any batch month string into month index (0-11) and year
 */
function parseBatchCohort(batchMonthStr) {
  if (!batchMonthStr || typeof batchMonthStr !== 'string') {
    const now = new Date();
    return {
      monthIdx: 7,
      monthNum: 8,
      year: 2026,
      monthName: "August",
      display: "August 2026"
    };
  }

  const str = batchMonthStr.toLowerCase().trim();
  let monthIdx = -1;
  for (let i = 0; i < MONTH_NAMES_GLOBAL.length; i++) {
    if (str.includes(MONTH_NAMES_GLOBAL[i].toLowerCase())) {
      monthIdx = i;
      break;
    }
  }
  if (monthIdx === -1) {
    const isoMatch = str.match(/\b(20\d\d)-(\d{1,2})\b/);
    if (isoMatch) {
      const m = parseInt(isoMatch[2], 10);
      if (m >= 1 && m <= 12) monthIdx = m - 1;
    }
  }
  if (monthIdx === -1) monthIdx = 7;

  const yearMatch = batchMonthStr.match(/\b(20\d\d)\b/);
  const now = new Date();
  const year = yearMatch ? parseInt(yearMatch[1], 10) : now.getFullYear();

  return {
    monthIdx,
    monthNum: monthIdx + 1,
    year,
    monthName: MONTH_NAMES_GLOBAL[monthIdx],
    display: `${MONTH_NAMES_GLOBAL[monthIdx]} ${year}`
  };
}

/**
 * Formula-based Mission Month Calculator
 * Month 0: Batch Cohort (Arrival)
 * Month 1: 1st Drip Dispatch
 * Month k: Mk Drip Dispatch
 */
function getMissionMonthInfo(batchMonthStr, monthIndex = 0) {
  const base = parseBatchCohort(batchMonthStr);
  const k = Math.max(0, parseInt(monthIndex, 10) || 0);

  const totalMonths = (base.monthNum - 1) + k;
  const calMonthNum = (totalMonths % 12) + 1;
  const calYear = base.year + Math.floor(totalMonths / 12);
  const calMonthName = MONTH_NAMES_GLOBAL[calMonthNum - 1];
  const display = `${calMonthName} ${calYear}`;

  return {
    monthNum: calMonthNum,
    year: calYear,
    monthName: calMonthName,
    display,
    tenureIndex: k,
    label: k === 0 ? `${display} (Month 0)` : `${display} (M${k})`
  };
}

/**
 * Batch Month to 1st Month Calculation Helper
 */
function getFirstMonthInfo(batchMonthStr) {
  const m0 = getMissionMonthInfo(batchMonthStr, 0);
  const m1 = getMissionMonthInfo(batchMonthStr, 1);

  return {
    batchMonthName: m0.monthName,
    batchYear: m0.year,
    batchDisplay: m0.display,
    firstMonthName: m1.monthName,
    firstMonthYear: m1.year,
    firstMonthDisplay: m1.display,
    firstMonthNum: m1.monthNum
  };
}

function calculateMissionMonth(batchMonthStr, maxMonths = 24, targetDate = new Date()) {
  const base = parseBatchCohort(batchMonthStr);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;

  const elapsed = (targetYear - base.year) * 12 + (targetMonth - base.monthNum);
  return Math.max(0, Math.min(elapsed, maxMonths));
}

/**
 * Calculates current drip month and tenure info aligned with current calendar month.
 */
function getDripForTargetDate(batchMonthStr, maxMonths = 24, targetDate = new Date()) {
  const calMonthNum = targetDate.getMonth() + 1;
  const calYear = targetDate.getFullYear();
  const calMonthName = MONTH_NAMES_GLOBAL[calMonthNum - 1];
  const calMonthYear = `${calMonthName} ${calYear}`;

  const curMissionMonth = calculateMissionMonth(batchMonthStr, maxMonths, targetDate);
  const tenureLabel = curMissionMonth > 0 ? `M${curMissionMonth}` : 'Month 0';
  const displayLabel = `${calMonthYear} (${tenureLabel})`;

  return {
    targetCalMonth: calMonthNum,
    calYear,
    calMonthName,
    calMonthYear,
    curMissionMonth,
    tenureLabel,
    displayLabel
  };
}

/**
 * Calculates upcoming drip template and milestone info.
 * Synchronizes with current calendar month:
 * - If missionary is behind, upcoming is CURRENT calendar month at milestone M{curMissionMonth}.
 * - If in Month 0, upcoming is Month 1.
 * - If up to date, upcoming is next month.
 */
function getUpcomingDripInfo(batchMonthStr, monthsSent = 0, maxMonths = 24, targetDate = new Date()) {
  const sent = Number(monthsSent) || 0;
  const max = Number(maxMonths) || 24;
  if (sent >= max) return null;

  const curMissionMonth = calculateMissionMonth(batchMonthStr, max, targetDate);
  const calMonthNum = targetDate.getMonth() + 1; // 1-12
  const calYear = targetDate.getFullYear();

  let targetCalMonth;
  let targetYear;
  let tenureMonth;

  if (curMissionMonth <= 0) {
    const m1Info = getMissionMonthInfo(batchMonthStr, 1);
    targetCalMonth = m1Info.monthNum;
    targetYear = m1Info.year;
    tenureMonth = 1;
  } else if (sent < curMissionMonth) {
    targetCalMonth = calMonthNum;
    targetYear = calYear;
    tenureMonth = curMissionMonth;
  } else {
    const nextTenure = Math.max(sent + 1, curMissionMonth + 1);
    if (nextTenure > max) return null;
    const nextInfo = getMissionMonthInfo(batchMonthStr, nextTenure);
    targetCalMonth = nextInfo.monthNum;
    targetYear = nextInfo.year;
    tenureMonth = nextTenure;
  }

  const calMonthName = MONTH_NAMES_GLOBAL[targetCalMonth - 1];
  const monthYearDisplay = `${calMonthName} ${targetYear}`;
  const displayLabel = `${monthYearDisplay} (M${tenureMonth})`;

  return {
    monthNum: targetCalMonth,
    year: targetYear,
    monthName: calMonthName,
    display: monthYearDisplay,
    tenureMonth,
    displayLabel
  };
}

function getFirstDispatchDate(batchMonthStr, baseDate = new Date()) {
  const info = getFirstMonthInfo(batchMonthStr);
  const y = info.firstMonthYear;
  const m = info.firstMonthNum;
  const maxDays = new Date(y, m, 0).getDate();
  const targetDay = Math.min(Math.max(1, baseDate.getDate()), maxDays);
  return `${y}-${String(m).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function isMissionaryEligibleForDispatch(m, targetDate = new Date(), todayIso = null) {
  if (!m) return false;
  const status = (m.status || 'active').toLowerCase();
  if (status !== 'active') return false;

  const isSister = (m.cohort || '').toLowerCase().includes('sister') || (m.name || '').toLowerCase().startsWith('sister');
  const maxMonths = Number(m.max_months) || (isSister ? 18 : 24);
  const monthsSent = Number(m.months_sent) || 0;
  if (monthsSent >= maxMonths) return false;

  const curMissionMonth = calculateMissionMonth(m.batch_month || 'August 2026', maxMonths, targetDate);
  if (curMissionMonth <= 0) return false;
  if (monthsSent >= curMissionMonth) return false;

  const todayStr = todayIso || targetDate.toISOString().slice(0, 10);
  if (m.last_sent_at && m.last_sent_at.slice(0, 10) === todayStr) return false;
  if (m.next_send_date && m.next_send_date.slice(0, 10) > todayStr) return false;

  return true;
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

    overlay.style.display = 'flex';
    overlay.classList.add('open');

    const handleConfirm = () => {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
      resolve(true);
    };

    const handleCancel = () => {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
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
let CURRENT_APP_VERSION = "2.6.0";
let CURRENT_APP_VERSION_CODE = 18;
let CURRENT_DEPLOYMENT_ID = "deploy_20260905_v2_6";
let hasLoadedLocalVersion = false;

async function loadInstalledVersion() {
  if (hasLoadedLocalVersion) return;
  if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.getAppVersionCode === 'function') {
    try {
      const code = Number(window.AndroidBridge.getAppVersionCode());
      const ver = String(window.AndroidBridge.getAppVersion() || '').trim();
      if (code > 0) {
        CURRENT_APP_VERSION_CODE = code;
        if (ver) CURRENT_APP_VERSION = ver.replace(/^v/i, '');
        hasLoadedLocalVersion = true;
      }
    } catch (_) {}
  }
  try {
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        if (!hasLoadedLocalVersion) {
          CURRENT_APP_VERSION = String(data.version).replace(/^v/i, '');
          if (data.version_code) CURRENT_APP_VERSION_CODE = Number(data.version_code);
        }
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
        title: `Update Available (v${remoteVer})`,
        message: `A new update is ready to install.<br><span style="font-size:0.75rem; color:var(--muted); display:inline-block; margin-top:4px;">Build ${remoteCode} &bull; ${rel.apk_size_formatted || '11.8 MB'}</span>`,
        confirmText: "Update Now",
        cancelText: "Later",
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




