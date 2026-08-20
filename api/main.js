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

  // Ensure JSON header for all responses
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
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

      // Fetch system logs accurately from system_logs table
      const logs = await runSql("SELECT id, level, message, created_at as createdAt FROM system_logs ORDER BY id DESC LIMIT 100");
      const dripMessages = await runSql("SELECT month, theme, scripture, message, highlight_img, highlight_label FROM drip_messages ORDER BY month ASC");
      const systemConfig = await runSql("SELECT key, value FROM system_config");

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

    if (action === 'save_settings' || action === 'save_config') {
      const { configs = {} } = req.body;
      try {
        for (const [key, val] of Object.entries(configs)) {
          await runSql(`
            INSERT INTO system_config (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `, [key, String(val)]);
        }
        return res.status(200).json({ ok: true, message: "Settings saved successfully!" });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
