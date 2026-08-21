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
  `;
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
