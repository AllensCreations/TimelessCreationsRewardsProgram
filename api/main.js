import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  if (req.method === 'GET' || action === 'dashboard_data') {
    try {
      console.log("[DEBUG] Fetching missionaries from Turso...");
      const missionaries = await runSql("SELECT email, name, last_name, batch_month, points, referral_code, status, months_sent, max_months, next_send_date, verified FROM missionaries ORDER BY name ASC");
      console.log(`[DEBUG] Missionaries fetched: ${missionaries.length} records found.`);

      const orders = await runSql("SELECT order_id, psid, email, name, item, points_cost as cost, status, created_at as date FROM orders ORDER BY ROWID DESC");
      const logs = await runSql("SELECT * FROM system_logs ORDER BY ROWID DESC LIMIT 100");

      return res.status(200).json({ ok: true, missionaries, orders, logs });
    } catch (err) {
      console.error("[ERROR] Dashboard API Error:", err.message);
      await logSystemEvent('ERROR', `Dashboard Roster Fetch Failed: ${err.message}`);
      return res.status(500).json({ ok: false, error: err.message, missionaries: [] });
    }
  }

  if (req.method === 'POST') {
    if (action === 'delete_missionary') {
      const { email } = req.body;
      await runSql("DELETE FROM missionaries WHERE email = ?", [email]);
      await logSystemEvent('INFO', `Missionary Deleted: ${email}`);
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_order_status') {
      const { order_id, status } = req.body;
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [status, order_id]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'verify_missionary') {
      const { email } = req.body;
      await runSql("UPDATE missionaries SET verified = 1 WHERE email = ?", [email]);
      await runSql("DELETE FROM sessions WHERE temp_email = ?", [email]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
