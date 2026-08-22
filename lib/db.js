import 'dotenv/config';
import { createClient } from '@libsql/client';

let client = null;

function getDbClient() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:tcrp_local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN || '';

  client = createClient({ url, authToken });
  return client;
}

export async function runSql(query, params = []) {
  const db = getDbClient();
  try {
    const res = await db.execute({ sql: query, args: params });
    if (res.rows && Array.isArray(res.rows)) {
      return res.rows.map(row => {
        if (typeof row === 'object' && row !== null && !Array.isArray(row)) return row;
        const obj = {};
        res.columns.forEach((col, idx) => { obj[col] = row[idx]; });
        return obj;
      });
    }
    return res;
  } catch (err) {
    throw new Error(`Turso SQL Error: ${err.message}`);
  }
}
