import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  if (req.method === 'GET') {
    if (action === 'get_highlight' || req.query.month || req.url.includes('highlight')) {
      // Auto-load current month if not specified (e.g., August = 8)
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
      const dripMessages = await runSql("SELECT month, theme, scripture, message, highlight_img, highlight_label FROM drip_messages ORDER BY month ASC");

      return res.status(200).json({ ok: true, missionaries, orders, logs, dripMessages });
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

    if (action === 'save_highlight' || action === 'save_drip_message') {
      const { month, theme, scripture, message, highlight_img, highlight_label } = req.body;
      try {
        await runSql(`
          INSERT INTO drip_messages (month, theme, scripture, message, highlight_img, highlight_label)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(month) DO UPDATE SET
            theme = excluded.theme,
            scripture = excluded.scripture,
            message = excluded.message,
            highlight_img = excluded.highlight_img,
            highlight_label = excluded.highlight_label
        `, [month, theme, scripture, message, highlight_img, highlight_label]);
        return res.status(200).json({ ok: true, message: "Drip message saved successfully!" });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
