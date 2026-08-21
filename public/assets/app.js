function initAppLayout(activeKey, pageTitle) {
  const sidebarHtml = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div>
          <h1>Timeless<br><em>Creations</em></h1>
          <p>Command Center</p>
        </div>
        <button class="close-sidebar-btn" onclick="toggleSidebar(false)">✕</button>
      </div>
      <nav class="nav">
        <div class="nav-label">Main</div>
        <a href="/" class="nav-item ${activeKey === 'overview' ? 'active' : ''}"><span class="icon">📊</span> Overview</a>
        
        <div class="nav-label">Modules</div>
        <a href="/inbox.html" class="nav-item ${activeKey === 'inbox' ? 'active' : ''}"><span class="icon">💬</span> Messenger Inbox</a>
        <a href="/messengerbot.html" class="nav-item ${activeKey === 'messengerbot' ? 'active' : ''}"><span class="icon">🤖</span> Bot Rewards Catalog</a>
        <a href="/pusher.html" class="nav-item ${activeKey === 'pusher' ? 'active' : ''}"><span class="icon">➕</span> Add Missionaries</a>
        <a href="/invoicing.html" class="nav-item ${activeKey === 'invoicing' ? 'active' : ''}"><span class="icon">🧾</span> Invoicing &amp; Billing</a>
        <a href="/highlight.html" class="nav-item ${activeKey === 'highlight' ? 'active' : ''}"><span class="icon">🌟</span> Media &amp; Messages</a>
        
        <div class="nav-label">Operations</div>
        <a href="/logs.html" class="nav-item ${activeKey === 'logs' ? 'active' : ''}"><span class="icon">📜</span> System Logs</a>
        <a href="/settings.html" class="nav-item ${activeKey === 'settings' ? 'active' : ''}"><span class="icon">⚙️</span> Control Room</a>
      </nav>
    </aside>
  `;

  document.body.innerHTML = `
    <div class="app-layout">
      ${sidebarHtml}
      <main class="main-content">
        <div class="top-header">
          <div style="display:flex; align-items:center;">
            <button class="hamburger-btn" onclick="toggleSidebar(true)">☰</button>
            <h1>${pageTitle}</h1>
          </div>
          <div>
            <button class="btn btn-dark" onclick="window.syncData ? window.syncData() : location.reload()">↻ Re-Sync</button>
          </div>
        </div>
        <div id="page-root">${document.body.innerHTML}</div>
      </main>
    </div>
    <div id="toast-container" style="position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none;"></div>
  `;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const isError = type === 'error';
  toast.style.cssText = `
    background: ${isError ? '#2a1215' : '#111118'};
    border: 1px solid ${isError ? '#e05c5c' : '#c9a84c'};
    color: ${isError ? '#fca5a5' : '#f0d080'};
    padding: 12px 20px;
    border-radius: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 0.75rem;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  toast.innerHTML = `${isError ? '❌' : '✨'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function toggleSidebar(open) {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open', open);
}

const LocalStore = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem('tcrp_' + key);
      return item ? JSON.parse(item) : fallback;
    } catch(e) { return fallback; }
  },
  set(key, val) {
    try {
      localStorage.setItem('tcrp_' + key, JSON.stringify(val));
    } catch(e) {}
  }
};
