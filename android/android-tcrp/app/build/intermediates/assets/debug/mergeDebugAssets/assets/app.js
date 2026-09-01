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
  { key: 'invoicing', label: '🧾 Invoicing & POS', url: '/invoicing.html' },
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
      <div style="display:flex; align-items:center; gap:12px;">
        <button class="hamburger-btn" onclick="toggleMobileDrawer()" aria-label="Toggle Navigation">☰</button>
        <a href="/index.html" class="brand-title">✨ Timeless Creations <span>• ${pageTitle}</span></a>
      </div>
      <nav class="desktop-nav">
        ${NAV_ITEMS.map(item => `
          <a href="${item.url}" class="nav-pill ${item.key === activeKey ? 'active' : ''}">${item.label}</a>
        `).join('')}
      </nav>
      <button onclick="triggerGlobalRefresh()" class="btn btn-dark" style="padding:6px 12px; font-size:0.75rem; min-height:34px;">↻ Sync</button>
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
