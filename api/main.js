import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  if (req.method === 'GET' || action === 'dashboard_data') {
    try {
      // Alias snake_case columns to camelCase for the frontend UI
      const missionaries = await runSql(`
        SELECT 
          email, 
          name, 
          last_name as lastName, 
          cohort, 
          batch_month as batchMonth, 
          points, 
          referral_code as referralCode, 
          status, 
          months_sent as monthsSent, 
          max_months as maxMonths, 
          next_send_date as nextSendDate 
        FROM missionaries 
        ORDER BY name ASC
      `);
      
      const orders = await runSql(`
        SELECT 
          order_id as orderId, 
          psid, 
          email, 
          name, 
          item, 
          points_cost as cost, 
          status, 
          created_at as date 
        FROM orders 
        ORDER BY ROWID DESC
      `);

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
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
