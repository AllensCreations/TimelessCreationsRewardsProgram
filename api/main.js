import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  if (req.method === 'GET' || action === 'dashboard_data') {
    try {
      const missionaries = await runSql("SELECT email, name, last_name, batch_month, points, referral_code, status, months_sent, max_months, next_send_date, verified FROM missionaries ORDER BY name ASC");
      const orders = await runSql("SELECT order_id, psid, email, name, item, points_cost as cost, status, created_at as date FROM orders ORDER BY ROWID DESC");
      const logs = await runSql("SELECT * FROM system_logs ORDER BY ROWID DESC LIMIT 100");

      return res.status(200).json({ ok: true, missionaries, orders, logs });
    } catch (err) {
      console.error("Dashboard API Error:", err.message);
      return res.status(500).json({ ok: false, error: err.message, missionaries: [] });
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

    if (action === 'verify_missionary') {
      const { email } = req.body;
      await runSql("UPDATE missionaries SET verified = 1 WHERE email = ?", [email]);
      await runSql("DELETE FROM sessions WHERE temp_email = ?", [email]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
