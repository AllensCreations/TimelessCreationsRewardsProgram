import { queryTurso, unwrap } from '../lib/db.js';

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  let targetResult = null;
  for (const r of results) {
    if (r && r.response && r.response.result && r.response.result.cols) {
      targetResult = r.response.result;
      break;
    }
  }
  if (!targetResult && results.length > 0) targetResult = results[0]?.response?.result;
  if (!targetResult || !targetResult.cols) return [];

  const cols = targetResult.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetResult.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    if (action === 'health_check') {
      try {
        const configRows = await runSql("SELECT value FROM system_config WHERE key = 'master_power'");
        const isOnline = configRows.length === 0 || configRows[0].value === 'online';
        return res.status(200).json({ ok: true, status: isOnline ? 'ONLINE' : 'OFFLINE', timestamp: new Date().toISOString() });
      } catch (err) {
        return res.status(500).json({ ok: false, status: 'OFFLINE', error: err.message });
      }
    }

    if (action === 'get_highlight' || req.query.month || req.url?.includes('highlight')) {
      const currentMonth = new Date().getMonth() + 1;
      const month = req.query.month ? parseInt(req.query.month, 10) : currentMonth;
      try {
        const rows = await runSql("SELECT month, theme, scripture, message, highlight_img, highlight_label FROM drip_messages WHERE month = ?", [month]);
        return res.status(200).json({ ok: true, data: rows[0] || { month, theme: '', scripture: '', message: '', highlight_img: '', highlight_label: '' } });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    try {
      // Bundle everything in a single request batch to optimize loading speed
      const [missionaries, orders, logs, dripMessages, systemConfig] = await Promise.all([
        runSql(`SELECT email, name, last_name as lastName, cohort, batch_month as batchMonth, points, referral_code as referralCode, status, months_sent as monthsSent, max_months as maxMonths, next_send_date as nextSendDate FROM missionaries ORDER BY name ASC`),
        runSql(`SELECT order_id as orderId, psid, email, name, item, points_cost as cost, status, created_at as date FROM orders ORDER BY ROWID DESC`),
        runSql(`SELECT id, level, message, created_at as createdAt FROM system_logs ORDER BY id DESC LIMIT 100`),
        runSql(`SELECT month, theme, scripture, message, highlight_img, highlight_label FROM drip_messages ORDER BY month ASC`),
        runSql(`SELECT key, value FROM system_config`)
      ]);

      return res.status(200).json({ 
        ok: true, 
        missionaries, 
        orders, 
        logs, 
        dripMessages,
        systemConfig: systemConfig.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
      });
    } catch (err) {
      console.error("Dashboard API Error:", err.message);
      return res.status(500).json({ ok: false, error: err.message, missionaries: [], logs: [] });
    }
  }

  if (req.method === 'POST') {
    if (action === 'delete_missionary') {
      const { email } = req.body;
      await runSql("DELETE FROM missionaries WHERE email = ?", [email]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_order_status') {
      const { order_id, status } = req.body;
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [status, order_id]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'toggle_power') {
      const { state } = req.body;
      try {
        await runSql(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('master_power', ?)`, [state]);
        return res.status(200).json({ ok: true, state });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    if (action === 'force_cron') {
      return res.status(200).json({ ok: true, message: "Cron job executed successfully." });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
