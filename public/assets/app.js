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

function initAppLayout(activeTab = 'dashboard', title = 'Dashboard') {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/index.html', icon: '📊' },
    { id: 'missionaries', label: 'Roster', href: '/missionaries.html', icon: '👥' },
    { id: 'pusher', label: '+ Add Missionaries', href: '/pusher.html', icon: '➕' },
    { id: 'messengerbot', label: 'Bot Rewards', href: '/messengerbot.html', icon: '🎁' },
    { id: 'drips', label: '24M Drips', href: '/drips.html', icon: '✉️' },
    { id: 'claims', label: 'Claims & Orders', href: '/claims.html', icon: '📦' },
    { id: 'invoicing', label: 'Cash POS', href: '/invoicing.html', icon: '💵' },
    { id: 'settings', label: 'Settings', href: '/settings.html', icon: '⚙️' }
  ];

  const header = document.querySelector("header") || document.createElement("header");
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 24px; background:var(--surface, #141622); border-bottom:1px solid var(--border, rgba(201,168,76,0.2)); flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:1.4rem;">🏛️</span>
        <div>
          <div style="font-family:'Syne',sans-serif; font-weight:800; color:var(--gold, #c9a84c); font-size:1rem; letter-spacing:0.5px;">TIMELESS CREATIONS</div>
          <div style="font-size:0.65rem; color:var(--muted, #8c90a4); text-transform:uppercase; letter-spacing:1px;">Rewards Administration Platform</div>
        </div>
      </div>
      <nav style="display:flex; gap:8px; flex-wrap:wrap;">
        ${navItems.map(item => `
          <a href="${item.href}" style="padding:6px 12px; border-radius:6px; font-size:0.75rem; text-decoration:none; display:flex; align-items:center; gap:6px; font-weight:600; transition:all 0.2s; ${activeTab === item.id ? 'background:var(--gold, #c9a84c); color:#0d0e15;' : 'color:var(--text, #e2e4ee); background:var(--surface2, #1c1f2e);'}">
            <span>${item.icon}</span> <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
    </div>
  `;
  if (!document.querySelector("header")) {
    document.body.insertBefore(header, document.body.firstChild);
  }
}
