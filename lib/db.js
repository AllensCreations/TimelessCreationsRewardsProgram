import 'dotenv/config';

let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
let token = (process.env.TURSO_AUTH_TOKEN || '').trim();
rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
token = token.replace(/^['"]|['"]$/g, '').trim();
const tursoHttp = `https://${rawUrl}/v2/pipeline`;

export function unwrap(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if ('value' in cell) return cell.value ?? '';
    return '';
  }
  return cell;
}

export const SCHEMA_INIT_STMTS = [
  {
    type: "execute",
    stmt: {
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        psid TEXT PRIMARY KEY,
        state TEXT DEFAULT 'AWAITING_TERMS',
        invite_code TEXT,
        temp_title TEXT,
        temp_email TEXT,
        temp_batch TEXT,
        otp_code TEXT,
        last_checked_date TEXT,
        click_count INTEGER DEFAULT 0,
        window_start INTEGER DEFAULT 0
      );`
    }
  },
  {
    type: "execute",
    stmt: {
      sql: `CREATE TABLE IF NOT EXISTS missionaries (
        email TEXT PRIMARY KEY,
        name TEXT,
        last_name TEXT,
        cohort TEXT DEFAULT 'elder',
        batch_month TEXT DEFAULT 'August 2026',
        months_sent INTEGER DEFAULT 0,
        max_months INTEGER DEFAULT 24,
        psid TEXT UNIQUE,
        points INTEGER DEFAULT 0,
        referral_code TEXT UNIQUE,
        is_prelisted INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        last_sent_at TEXT,
        next_send_date TEXT
      );`
    }
  },
  {
    type: "execute",
    stmt: {
      sql: `CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        psid TEXT,
        email TEXT,
        name TEXT,
        item TEXT,
        points_cost INTEGER,
        status TEXT DEFAULT 'PENDING',
        created_at TEXT
      );`
    }
  },
  {
    type: "execute",
    stmt: {
      sql: `CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      );`
    }
  },
  {
    type: "execute",
    stmt: {
      sql: `CREATE TABLE IF NOT EXISTS drip_messages (
        month INTEGER PRIMARY KEY,
        theme TEXT,
        scripture TEXT,
        message TEXT
      );`
    }
  }
];

let schemaInitialized = false;

export async function queryTurso(requests, autoInit = true) {
  const reqList = Array.isArray(requests) ? requests : [requests];
  const finalRequests = [];

  if (autoInit && !schemaInitialized) {
    finalRequests.push(...SCHEMA_INIT_STMTS);
    schemaInitialized = true;
  }

  finalRequests.push(...reqList);
  finalRequests.push({ type: "close" });

  const res = await fetch(tursoHttp, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: finalRequests })
  });

  return res.json();
}
