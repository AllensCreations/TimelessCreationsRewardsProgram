import 'dotenv/config';

const memStore = {
  system_settings: new Map([
    ['power_state', 'ONLINE'],
    ['bot_maintenance', 'OFF'],
    ['cdn_github_owner', 'AllensCreations'],
    ['cdn_github_repo', 'Gallery'],
    ['cdn_github_branch', 'main'],
    ['cdn_upload_path', 'assets/rewards'],
    ['drip_rewards_visible', 'true'],
    ['bot_quota_unverified', '10'],
    ['bot_quota_verified', '15'],
    ['bot_otp_cooldown', '60'],
    ['bot_otp_max_resends', '3'],
    ['bot_burst_limit', '12']
  ]),
  missionaries: [],
  drip_messages: [],
  system_logs: [],
  sessions: new Map(),
  chat_messages: [],
  bot_rate_limits: new Map(),
  bot_daily_user_quotas: new Map(),
  bot_daily_views: new Map(),
  products: [
    { id: 1, name: "Temple Keychain", price: 1, type: "reward", image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
    { id: 2, name: "Custom Nametag", price: 2, type: "reward", image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
    { id: 3, name: "CTR Ring & Pass Along Pack", price: 3, type: "reward", image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" }
  ]
};

function executeInMemoryFallback(query, params = []) {
  const q = (query || '').trim();
  const qLower = q.toLowerCase();

  // DDL statements
  if (/^(create|alter|drop|pragma)\b/i.test(qLower)) {
    return [{ ok: true }];
  }

  // sessions queries
  if (qLower.includes('delete from sessions')) {
    if (params[0]) {
      memStore.sessions.delete(params[0]);
    } else {
      memStore.sessions.clear();
    }
    return [{ ok: true }];
  }
  if (qLower.includes('into sessions')) {
    const colMatch = q.match(/into sessions\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)/i);
    if (colMatch) {
      const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      const rawVals = colMatch[2].split(',').map(v => v.trim());
      let pIdx = 0;
      const sObj = { psid: '', state: 'START', last_otp_at: 0, failed_otp_count: 0 };
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const rv = rawVals[i];
        let val;
        if (rv === '?') {
          val = params[pIdx++];
        } else {
          const cleaned = rv.replace(/^['"]|['"]$/g, '');
          if (cleaned.toLowerCase() === 'null') val = null;
          else if (!isNaN(Number(cleaned))) val = Number(cleaned);
          else val = cleaned;
        }
        sObj[col] = val;
      }
      memStore.sessions.set(sObj.psid, sObj);
      return [{ ok: true }];
    }
    const psid = params[0];
    const state = params[1] || 'START';
    const lastOtpAt = Number(params[2]) || 0;
    memStore.sessions.set(psid, { psid, state, last_otp_at: lastOtpAt, failed_otp_count: 0 });
    return [{ ok: true }];
  }
  if (qLower.includes('update sessions')) {
    const psid = params[params.length - 1];
    let session = memStore.sessions.get(psid) || { psid, state: 'START', last_otp_at: 0, failed_otp_count: 0 };
    const setMatch = q.match(/set\s+([\s\S]*?)\s+where/i);
    if (setMatch) {
      const setClause = setMatch[1];
      const assignments = setClause.split(',').map(s => s.trim());
      let paramIdx = 0;
      for (const assign of assignments) {
        const parts = assign.split('=').map(s => s.trim());
        const col = parts[0].toLowerCase();
        const valRaw = parts[1];
        let val;
        if (valRaw === '?') {
          val = params[paramIdx++];
        } else {
          const cleaned = valRaw.replace(/^['"]|['"]$/g, '');
          if (cleaned.toLowerCase() === 'null') val = null;
          else if (!isNaN(Number(cleaned))) val = Number(cleaned);
          else val = cleaned;
        }
        if (col === 'state') session.state = val;
        else if (col === 'temp_title') session.temp_title = val;
        else if (col === 'temp_email') session.temp_email = val;
        else if (col === 'temp_batch') session.temp_batch = val;
        else if (col === 'invite_code') session.invite_code = val;
        else if (col === 'otp_code') session.otp_code = val;
        else if (col === 'last_otp_at') session.last_otp_at = Number(val) || 0;
        else if (col === 'failed_otp_count') session.failed_otp_count = Number(val) || 0;
      }
    }
    memStore.sessions.set(psid, session);
    return [{ ok: true }];
  }
  if (qLower.includes('from sessions')) {
    const psid = params[0];
    const s = memStore.sessions.get(psid);
    return s ? [s] : [];
  }

  // system_settings queries
  if (qLower.includes('from system_settings')) {
    if (qLower.includes('where key =')) {
      const key = params[0] || (q.match(/key\s*=\s*'([^']+)'/i) || [])[1];
      const val = memStore.system_settings.get(key);
      return val !== undefined ? [{ key, value: val }] : [];
    }
    const result = [];
    for (const [k, v] of memStore.system_settings.entries()) {
      result.push({ key: k, value: v });
    }
    return result;
  }

  if (qLower.includes('into system_settings')) {
    if (params.length >= 2) {
      memStore.system_settings.set(params[0], String(params[1]));
    }
    return [{ ok: true }];
  }

  // system_logs
  if (qLower.includes('into system_logs')) {
    memStore.system_logs.push({
      level: params[0] || 'INFO',
      message: params[1] || '',
      created_at: new Date().toISOString()
    });
    return [{ ok: true }];
  }
  if (qLower.includes('from system_logs')) {
    return memStore.system_logs.slice(-50);
  }

  // missionaries queries
  if (qLower.includes('delete from missionaries')) {
    const target = params[0];
    if (target) {
      memStore.missionaries = memStore.missionaries.filter(m => m.psid !== target && (m.email || '').toLowerCase() !== String(target).toLowerCase());
    } else {
      memStore.missionaries = [];
    }
    return [{ ok: true }];
  }

  if (qLower.includes('from missionaries')) {
    if (qLower.includes('where psid =')) {
      const targetPsid = params[0];
      const match = memStore.missionaries.find(m => m.psid === targetPsid);
      return match ? [match] : [];
    }
    if (qLower.includes('where lower(email) =') || qLower.includes('where email =')) {
      const targetEmail = (params[0] || '').toLowerCase();
      const matches = memStore.missionaries.filter(m => (m.email || '').toLowerCase() === targetEmail);
      return matches.length > 0 ? matches : [{ alive: 1, points: 0, email: targetEmail }];
    }
    return memStore.missionaries.length > 0 ? memStore.missionaries : [{ alive: 1 }];
  }

  if (qLower.includes('into missionaries')) {
    const emailParam = (params || []).find(p => typeof p === 'string' && p.includes('@'));
    if (emailParam) {
      const existingIdx = memStore.missionaries.findIndex(m => (m.email || '').toLowerCase() === emailParam.toLowerCase());
      const existing = existingIdx >= 0 ? memStore.missionaries[existingIdx] : null;
      const mObj = {
        email: emailParam,
        name: params[1] || existing?.name || 'Elder Missionary',
        cohort: params[2] || existing?.cohort || 'elder',
        batch_month: params[3] || existing?.batch_month || 'August 2026',
        points: existing ? (Number(existing.points) === 0 ? 1 : Number(existing.points)) : 1,
        referral_code: params[4] || existing?.referral_code || 'REF123',
        psid: params[5] || params[6] || existing?.psid || null,
        status: 'active',
        max_months: 24,
        alive: 1
      };
      if (existingIdx >= 0) {
        memStore.missionaries[existingIdx] = { ...existing, ...mObj };
      } else {
        memStore.missionaries.push(mObj);
      }
    }
    return [{ ok: true, alive: 1 }];
  }

  if (qLower.includes('update missionaries')) {
    if (qLower.includes('set psid = null')) {
      const psid = params[0];
      const m = memStore.missionaries.find(x => x.psid === psid);
      if (m) m.psid = null;
    } else if (qLower.includes('points = points + 1')) {
      const code = (params[0] || '').toUpperCase();
      const m = memStore.missionaries.find(x => (x.referral_code || '').toUpperCase() === code);
      if (m) m.points = (Number(m.points) || 0) + 1;
    } else if (qLower.includes('points = points - ?')) {
      const cost = Number(params[0]) || 0;
      const psid = params[1];
      const m = memStore.missionaries.find(x => x.psid === psid);
      if (m && m.points >= cost) m.points -= cost;
    } else if (qLower.includes('points = max(0, points + ?)')) {
      const delta = Number(params[0]) || 0;
      const email = (params[1] || '').toLowerCase();
      const m = memStore.missionaries.find(x => (x.email || '').toLowerCase() === email);
      if (m) {
        m.points = Math.max(0, (m.points || 0) + delta);
      }
    }
    return [{ ok: true, alive: 1 }];
  }

  // chat_messages queries
  if (qLower.includes('delete from chat_messages')) {
    const target = params[0];
    if (target) {
      memStore.chat_messages = memStore.chat_messages.filter(c => c.psid !== target);
    } else {
      memStore.chat_messages = [];
    }
    return [{ ok: true }];
  }
  if (qLower.includes('into chat_messages')) {
    const psid = params[0];
    let sender = 'bot';
    let message = '';
    if (params.length >= 3) {
      sender = params[1];
      message = params[2];
    } else {
      sender = qLower.includes("'user'") ? 'user' : 'bot';
      message = params[1];
    }
    const newId = memStore.chat_messages.length + 1;
    memStore.chat_messages.push({ id: newId, psid, sender, message, created_at: new Date().toISOString() });
    return [{ ok: true }];
  }
  if (qLower.includes('from chat_messages')) {
    const psid = params[0];
    let msgs = memStore.chat_messages.filter(c => c.psid === psid);
    if (qLower.includes('count(*)')) {
      return [{ c: msgs.length, count: msgs.length }];
    }
    if (qLower.includes('max(id)')) {
      const maxId = msgs.length > 0 ? Math.max(...msgs.map(m => m.id)) : 0;
      return [{ max_id: maxId }];
    }
    if (qLower.includes("sender = 'bot'")) {
      msgs = msgs.filter(c => c.sender === 'bot');
    }
    if (qLower.includes('id > ?')) {
      const minId = Number(params[1]) || 0;
      msgs = msgs.filter(c => c.id > minId);
    }
    if (qLower.includes('order by id desc')) {
      msgs = [...msgs].reverse();
    }
    if (qLower.includes('limit 1')) {
      return msgs.slice(0, 1);
    }
    if (qLower.includes('limit 5')) {
      return msgs.slice(0, 5);
    }
    return msgs;
  }

  // product_catalog
  if (qLower.includes('delete from product_catalog')) {
    if (params[0]) {
      const id = Number(params[0]);
      memStore.products = memStore.products.filter(x => x.id !== id);
    } else {
      memStore.products = [];
    }
    return [{ ok: true }];
  }
  if (qLower.includes('into product_catalog')) {
    memStore.products.push({
      id: Number(params[0]) || memStore.products.length + 1,
      name: params[1] || 'Reward Item',
      price: Number(params[2]) || 1,
      type: params[3] || 'reward',
      image_url: params[4] || ''
    });
    return [{ ok: true }];
  }
  if (qLower.includes('from product_catalog')) {
    if (qLower.includes('where id =')) {
      const id = Number(params[0]);
      const p = memStore.products.find(x => x.id === id);
      return p ? [p] : [];
    }
    return memStore.products;
  }

  // orders
  if (qLower.includes('into orders')) {
    return [{ ok: true }];
  }

  // bot_rate_limits queries
  if (qLower.includes('delete from bot_rate_limits')) {
    const target = params[0];
    if (target) {
      memStore.bot_rate_limits.delete(target);
    } else {
      memStore.bot_rate_limits.clear();
    }
    return [{ ok: true }];
  }
  if (qLower.includes('into bot_rate_limits')) {
    const psid = params[0];
    const window_start = params.length > 1 ? Number(params[params.length - 1]) : Math.floor(Date.now() / 1000);
    memStore.bot_rate_limits.set(psid, { psid, msg_count: 1, window_start, warned: 0 });
    return [{ ok: true }];
  }
  if (qLower.includes('update bot_rate_limits')) {
    if (qLower.includes('msg_count = 1')) {
      const window_start = Number(params[0]);
      const psid = params[1];
      memStore.bot_rate_limits.set(psid, { psid, msg_count: 1, window_start, warned: 0 });
    } else if (qLower.includes('warned = 1')) {
      const psid = params[0];
      const r = memStore.bot_rate_limits.get(psid) || { psid, msg_count: 0, window_start: Math.floor(Date.now() / 1000), warned: 0 };
      r.warned = 1;
      memStore.bot_rate_limits.set(psid, r);
    } else if (qLower.includes('msg_count = msg_count + 1')) {
      const psid = params[0];
      const r = memStore.bot_rate_limits.get(psid) || { psid, msg_count: 0, window_start: Math.floor(Date.now() / 1000), warned: 0 };
      r.msg_count = (Number(r.msg_count) || 0) + 1;
      memStore.bot_rate_limits.set(psid, r);
    }
    return [{ ok: true }];
  }
  if (qLower.includes('from bot_rate_limits')) {
    const psid = params[0];
    const r = memStore.bot_rate_limits.get(psid);
    return r ? [r] : [];
  }

  // bot_daily_user_quotas queries
  if (qLower.includes('delete from bot_daily_user_quotas')) {
    const target = params[0];
    if (target) {
      for (const [k] of memStore.bot_daily_user_quotas.entries()) {
        if (k.startsWith(`${target}:`)) memStore.bot_daily_user_quotas.delete(k);
      }
    } else {
      memStore.bot_daily_user_quotas.clear();
    }
    return [{ ok: true }];
  }
  if (qLower.includes('into bot_daily_user_quotas')) {
    const colMatch = q.match(/into bot_daily_user_quotas\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)/i);
    if (colMatch) {
      const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      const rawVals = colMatch[2].split(',').map(v => v.trim());
      let pIdx = 0;
      const qObj = { psid: '', quota_date: '', msg_count: 0, warned: 0, otp_resend_count: 0 };
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const rv = rawVals[i];
        let val;
        if (rv === '?') {
          val = params[pIdx++];
        } else {
          const cleaned = rv.replace(/^['"]|['"]$/g, '');
          if (!isNaN(Number(cleaned))) val = Number(cleaned);
          else val = cleaned;
        }
        qObj[col] = val;
      }
      const key = `${qObj.psid}:${qObj.quota_date}`;
      const existing = memStore.bot_daily_user_quotas.get(key) || {};
      memStore.bot_daily_user_quotas.set(key, { ...existing, ...qObj });
      return [{ ok: true }];
    }
    const psid = params[0];
    const quota_date = params[1];
    const msg_count = Number(params[2]) || 0;
    const warned = Number(params[3]) || 0;
    const otp_resend_count = Number(params[4]) || 0;
    const key = `${psid}:${quota_date}`;
    const existing = memStore.bot_daily_user_quotas.get(key) || {};
    memStore.bot_daily_user_quotas.set(key, { ...existing, psid, quota_date, msg_count, warned, otp_resend_count });
    return [{ ok: true }];
  }
  if (qLower.includes('update bot_daily_user_quotas')) {
    const psid = params[params.length - 2];
    const quota_date = params[params.length - 1];
    const key = `${psid}:${quota_date}`;
    const r = memStore.bot_daily_user_quotas.get(key) || { psid, quota_date, msg_count: 0, warned: 0, otp_resend_count: 0 };
    const setMatch = q.match(/set\s+([\s\S]*?)\s+where/i);
    if (setMatch) {
      const setClause = setMatch[1];
      const assignments = setClause.split(',').map(s => s.trim());
      let paramIdx = 0;
      for (const assign of assignments) {
        const parts = assign.split('=').map(s => s.trim());
        const col = parts[0].toLowerCase();
        const valRaw = parts[1];
        let val;
        if (valRaw === '?') {
          val = params[paramIdx++];
        } else {
          const cleaned = valRaw.replace(/^['"]|['"]$/g, '');
          if (!isNaN(Number(cleaned))) val = Number(cleaned);
          else val = cleaned;
        }
        if (col === 'msg_count') {
          if (assign.toLowerCase().includes('msg_count + 1')) {
            r.msg_count = (Number(r.msg_count) || 0) + 1;
          } else {
            r.msg_count = Number(val) || 0;
          }
        } else if (col === 'warned') {
          r.warned = Number(val) || 0;
        } else if (col === 'otp_resend_count') {
          if (assign.toLowerCase().includes('otp_resend_count + 1')) {
            r.otp_resend_count = (Number(r.otp_resend_count) || 0) + 1;
          } else {
            r.otp_resend_count = Number(val) || 0;
          }
        }
      }
    }
    memStore.bot_daily_user_quotas.set(key, r);
    return [{ ok: true }];
  }
  if (qLower.includes('from bot_daily_user_quotas')) {
    const psid = params[0];
    const quota_date = params[1];
    const key = `${psid}:${quota_date}`;
    const r = memStore.bot_daily_user_quotas.get(key);
    return r ? [r] : [];
  }

  // bot_daily_views queries
  if (qLower.includes('delete from bot_daily_views')) {
    const target = params[0];
    if (target) {
      for (const [k] of memStore.bot_daily_views.entries()) {
        if (k.startsWith(`${target}:`)) memStore.bot_daily_views.delete(k);
      }
    } else {
      memStore.bot_daily_views.clear();
    }
    return [{ ok: true }];
  }
  if (qLower.includes('into bot_daily_views')) {
    const sender_id = String(params[0] || '');
    const view_date = String(params[1] || '');
    const view_count = Number(params[2] || 0);
    const key = `${sender_id}:${view_date}`;
    memStore.bot_daily_views.set(key, { sender_id, view_date, view_count, warned: 0 });
    return [{ ok: true }];
  }
  if (qLower.includes('from bot_daily_views')) {
    const sender_id = String(params[0] || '');
    const view_date = String(params[1] || '');
    const key = `${sender_id}:${view_date}`;
    const r = memStore.bot_daily_views.get(key);
    return r ? [r] : [];
  }

  // drip_messages
  if (qLower.includes('from drip_messages')) {
    return memStore.drip_messages;
  }

  // Default fallback
  return [{ alive: 1, ok: true, count: 0 }];
}

export async function runSql(query, params = []) {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

  if (!url) {
    return executeInMemoryFallback(query, params);
  }

  const httpEndpoint = (url.startsWith('libsql://') ? url.replace('libsql://', 'https://') : url) + '/v2/pipeline';

  const formattedArgs = (Array.isArray(params) ? params : []).map(p => {
    if (p === null || p === undefined) return { type: 'null' };
    if (typeof p === 'number') {
      return Number.isInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
    }
    if (typeof p === 'boolean') {
      return { type: 'integer', value: p ? '1' : '0' };
    }
    return { type: 'text', value: String(p) };
  });

  const requestBody = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: query,
          args: formattedArgs
        }
      },
      { type: 'close' }
    ]
  };

  try {
    const response = await fetch(httpEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      if (query.toLowerCase().includes('pragma') || query.toLowerCase().includes('alter table') || query.toLowerCase().includes('create table') || query.toLowerCase().includes('drop table')) {
        return [{ ok: true }];
      }
      throw new Error(`Turso HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const firstResult = data.results?.[0];

    if (firstResult?.type === 'error') {
      const errMsg = firstResult.error?.message || 'Turso query execution error';
      if (query.toLowerCase().includes('pragma') || query.toLowerCase().includes('alter table') || query.toLowerCase().includes('create table') || query.toLowerCase().includes('drop table')) {
        return [{ ok: true }];
      }
      throw new Error(errMsg);
    }

    const execResult = firstResult?.response?.result;
    if (!execResult) return [];

    const cols = execResult.cols?.map(c => c.name) || [];
    const rows = execResult.rows || [];

    return rows.map(r => {
      const obj = {};
      cols.forEach((col, idx) => {
        const item = r[idx];
        obj[col] = item?.value !== undefined ? item.value : null;
      });
      return obj;
    });
  } catch (err) {
    if (query.toLowerCase().includes('pragma') || query.toLowerCase().includes('alter table') || query.toLowerCase().includes('create table') || query.toLowerCase().includes('drop table')) {
      return [{ ok: true }];
    }
    throw err;
  }
}

// Auto-run safe schema migrations on boot (preserving chat_messages)
(async function initDatabaseSchema() {
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS sessions (
        psid text PRIMARY KEY,
        state text DEFAULT 'AWAITING_TERMS',
        invite_code text,
        temp_title text,
        temp_email text,
        temp_batch text,
        otp_code text,
        last_otp_at integer DEFAULT 0
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id integer PRIMARY KEY AUTOINCREMENT,
        psid text,
        sender text CHECK(sender IN ('user','bot')),
        message text,
        created_at text DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_rate_limits (
        psid text PRIMARY KEY,
        msg_count integer DEFAULT 0,
        window_start integer DEFAULT 0,
        warned integer DEFAULT 0
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_daily_user_quotas (
        psid text,
        quota_date text,
        msg_count integer DEFAULT 0,
        warned integer DEFAULT 0,
        otp_resend_count integer DEFAULT 0,
        PRIMARY KEY(psid, quota_date)
      )
    `).catch(() => {});

    await runSql("ALTER TABLE sessions ADD COLUMN failed_otp_count integer DEFAULT 0;").catch(() => {});
    await runSql("ALTER TABLE bot_rate_limits ADD COLUMN warned integer DEFAULT 0;").catch(() => {});

    // Consolidate system_config into system_settings and prune duplicate tables
    await runSql(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key text PRIMARY KEY,
        value text,
        updated_at text DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // Safe migration from legacy system_config into system_settings
    await runSql("INSERT OR IGNORE INTO system_settings (key, value) SELECT key, value FROM system_config;").catch(() => {});

    // Prune deprecated legacy and duplicate tables
    await runSql("DROP TABLE IF EXISTS system_config;").catch(() => {});
    await runSql("DROP TABLE IF EXISTS names;").catch(() => {});
    await runSql("DROP TABLE IF EXISTS hashed_audit_identities;").catch(() => {});
    await runSql("DROP TABLE IF EXISTS bot_hourly_views;").catch(() => {});

    // Ensure delivered_at column exists for 7-day immutable delivery lock policy
    await runSql("ALTER TABLE cash_invoices ADD COLUMN delivered_at text;").catch(() => {});
    await runSql("ALTER TABLE orders ADD COLUMN delivered_at text;").catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        code text PRIMARY KEY,
        points integer DEFAULT 1,
        max_users integer DEFAULT 30,
        claimed_count integer DEFAULT 0,
        created_at text DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS promo_redemptions (
        code text,
        psid text,
        created_at text DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(code, psid)
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS cdn_gallery (
        id integer PRIMARY KEY AUTOINCREMENT,
        filename text,
        direct_url text,
        size_label text,
        original_kb real DEFAULT 0,
        compressed_kb real DEFAULT 0,
        created_at text DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await runSql("ALTER TABLE orders ADD COLUMN items_json text;").catch(() => {});
    await runSql("ALTER TABLE drip_messages ADD COLUMN subject text;").catch(() => {});
    await runSql("ALTER TABLE drip_messages ADD COLUMN custom_html text;").catch(() => {});
    await runSql("ALTER TABLE missionaries ADD COLUMN pending_ref_notices integer DEFAULT 0;").catch(() => {});

    // Default configuration values in system_settings
    await runSql("INSERT INTO system_settings (key, value) VALUES ('power_state', 'ONLINE') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('bot_maintenance', 'OFF') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('cdn_github_owner', 'AllensCreations') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('cdn_github_repo', 'Gallery') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('cdn_github_branch', 'main') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('cdn_upload_path', 'assets/rewards') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('drip_rewards_visible', 'true') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('bot_quota_unverified', '10') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('bot_quota_verified', '15') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('bot_otp_cooldown', '60') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('bot_otp_max_resends', '3') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_settings (key, value) VALUES ('bot_burst_limit', '12') ON CONFLICT(key) DO NOTHING;").catch(() => {});

    // Create composite index for email dispatch candidate selection
    await runSql("CREATE INDEX IF NOT EXISTS idx_m_dispatch ON missionaries (status, cohort, next_send_date, months_sent);").catch(() => {});

    // Ensure September cohort missionaries not yet dispatched are scheduled for their 1st month (October, no day preset)
    await runSql(`
      UPDATE missionaries 
      SET next_send_date = '2026-10'
      WHERE (months_sent = 0 OR months_sent IS NULL)
        AND (last_sent_at IS NULL OR last_sent_at = '')
        AND LOWER(batch_month) LIKE '%september%'
        AND (next_send_date IS NULL OR next_send_date < '2026-10')
    `).catch(() => {});

    // Strip day from any existing next_send_date values so that dispatches are month-level with no day preset
    await runSql(`
      UPDATE missionaries 
      SET next_send_date = substr(next_send_date, 1, 7)
      WHERE next_send_date IS NOT NULL 
        AND length(next_send_date) > 7
    `).catch(() => {});
  } catch (_) {}
})();

export const queryTurso = runSql;
export const query = runSql;
export const execute = runSql;
export default { runSql, queryTurso, query, execute };
