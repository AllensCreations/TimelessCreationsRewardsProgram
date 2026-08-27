const LocalStore = {
  get: (k, d = null) => {
    try {
      const val = localStorage.getItem('tcrp_' + k);
      return val ? JSON.parse(val) : d;
    } catch (e) { return d; }
  },
  set: (k, v) => {
    try { localStorage.setItem('tcrp_' + k, JSON.stringify(v)); } catch (e) {}
  }
};

function showToast(msg, type = "success") {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.padding = "12px 20px";
    toast.style.borderRadius = "8px";
    toast.style.fontWeight = "bold";
    toast.style.fontSize = "0.85rem";
    toast.style.zIndex = "99999";
    toast.style.transition = "all 0.3s ease";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.6)";
    document.body.appendChild(toast);
  }
  toast.style.background = type === "error" ? "#e63946" : "var(--gold, #c9a84c)";
  toast.style.color = type === "error" ? "#fff" : "#0d0e15";
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => { toast.style.display = "none"; }, 300);
  }, 3500);
}

async function checkSystemHealth() {
  const dot = document.getElementById("nav-status-dot");
  const text = document.getElementById("nav-status-text");
  if (!dot || !text) return;
  try {
    const res = await fetch("/api/main?action=health_check");
    const data = await res.json();
    if (data.ok && data.status === "ONLINE") {
      dot.style.background = "var(--green, #4caf82)";
      dot.style.boxShadow = "0 0 8px var(--green, #4caf82)";
      text.textContent = "Online";
    } else {
      dot.style.background = "var(--gold, #c9a84c)";
      dot.style.boxShadow = "0 0 8px var(--gold, #c9a84c)";
      text.textContent = "Sleeping";
    }
  } catch (e) {
    dot.style.background = "var(--red, #e05c5c)";
    dot.style.boxShadow = "0 0 8px var(--red, #e05c5c)";
    text.textContent = "Offline";
  }
}

async function triggerGlobalRefresh() {
  const btn = document.getElementById("nav-global-refresh-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "↻ Syncing...";
  }

  try {
    const [statsRes, missRes, ordersRes, dripsRes, prodsRes] = await Promise.all([
      fetch("/api/main?action=get_stats"),
      fetch("/api/main?action=get_missionaries"),
      fetch("/api/main?action=get_orders"),
      fetch("/api/main?action=get_drips"),
      fetch("/api/main?action=get_products")
    ]);

    const [stats, miss, orders, drips, prods] = await Promise.all([
      statsRes.json(), missRes.json(), ordersRes.json(), dripsRes.json(), prodsRes.json()
    ]);

    if (stats.ok) {
      LocalStore.set('stats_payload', stats);
      LocalStore.set('stats', stats.stats);
    }
    if (miss.ok) LocalStore.set('missionaries', miss.missionaries);
    if (orders.ok) LocalStore.set('orders', orders.orders);
    if (drips.ok) LocalStore.set('drips', drips.drips);
    if (prods.ok) LocalStore.set('products', prods.products);

    showToast("Global data synchronized successfully!");

    window.dispatchEvent(new CustomEvent("tcrp:data-synced"));
    if (window.onPageDataRefreshed) window.onPageDataRefreshed();
    checkSystemHealth();
  } catch (err) {
    showToast("Global sync failed: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "↻ Global Refresh";
    }
  }
}

function initAppLayout(activeTab = 'dashboard', title = 'Dashboard') {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/index.html', icon: '📊' },
    { id: 'missionaries', label: 'Roster', href: '/missionaries.html', icon: '👥' },
    { id: 'pusher', label: '+ Add Missionaries', href: '/pusher.html', icon: '➕' },
    { id: 'messengerbot', label: 'Bot Rewards', href: '/messengerbot.html', icon: '🎁' },
    { id: 'drips', label: '24M Drips', href: '/drips.html', icon: '✉️' },
    { id: 'invoicing', label: 'Cash POS', href: '/invoicing.html', icon: '💵' },
    { id: "settings", label: "Settings", href: "/settings.html", icon: "⚙️" },
    { id: "changelog", label: "Changelog", href: "/changelog.html", icon: "📜" }
  ];

  const header = document.querySelector("header") || document.createElement("header");
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 24px; background:var(--surface, #141622); border-bottom:1px solid var(--border, rgba(201,168,76,0.2)); flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <span style="font-size:1.4rem;">🏛️</span>
        <div>
          <div style="font-family:'Syne',sans-serif; font-weight:800; color:var(--gold, #c9a84c); font-size:0.95rem; letter-spacing:0.5px;">TIMELESS CREATIONS</div>
          <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
            <span id="nav-status-dot" style="width:7px; height:7px; border-radius:50%; background:#4caf82; display:inline-block;"></span>
            <span id="nav-status-text" style="font-size:0.62rem; color:var(--muted, #8c90a4); text-transform:uppercase; letter-spacing:0.8px;">Checking...</span>
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <nav style="display:flex; gap:6px; flex-wrap:wrap;">
          ${navItems.map(item => `
            <a href="${item.href}" style="padding:6px 11px; border-radius:6px; font-size:0.72rem; text-decoration:none; display:flex; align-items:center; gap:5px; font-weight:600; transition:all 0.2s; ${activeTab === item.id ? 'background:var(--gold, #c9a84c); color:#0d0e15;' : 'color:var(--text, #e2e4ee); background:var(--surface2, #1c1f2e);'}">
              <span>${item.icon}</span> <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>
        <button id="nav-global-refresh-btn" onclick="triggerGlobalRefresh()" style="background:var(--gold-dim, rgba(201,168,76,0.15)); border:1px solid rgba(201,168,76,0.4); color:var(--gold, #c9a84c); padding:6px 12px; border-radius:6px; font-family:'DM Mono',monospace; font-size:0.72rem; font-weight:bold; cursor:pointer;">
          ↻ Global Refresh
        </button>
      </div>
    </div>
  `;
  if (!document.querySelector("header")) {
    document.body.insertBefore(header, document.body.firstChild);
  }
  checkSystemHealth();
}
