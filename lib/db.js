import 'dotenv/config';

export async function runSql(query, params = []) {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

  if (!url) {
    return [{ alive: 1 }];
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
        window_start integer DEFAULT 0
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS hashed_audit_identities (
        identity_hash text PRIMARY KEY,
        type text,
        welcome_granted integer DEFAULT 1,
        referral_awarded integer DEFAULT 1,
        created_at text DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_hourly_views (
        psid text,
        hour_key text,
        view_count integer DEFAULT 1,
        PRIMARY KEY(psid, hour_key)
      )
    `).catch(() => {});

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
    await runSql("INSERT INTO system_config (key, value) VALUES ('cdn_github_owner', 'AllensCreations') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_config (key, value) VALUES ('cdn_github_repo', 'Gallery') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_config (key, value) VALUES ('cdn_github_branch', 'main') ON CONFLICT(key) DO NOTHING;").catch(() => {});
    await runSql("INSERT INTO system_config (key, value) VALUES ('cdn_upload_path', 'assets/rewards') ON CONFLICT(key) DO NOTHING;").catch(() => {});
  } catch (_) {}
})();

export const queryTurso = runSql;
export const query = runSql;
export const execute = runSql;
export default { runSql, queryTurso, query, execute };
