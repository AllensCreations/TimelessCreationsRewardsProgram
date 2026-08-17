import 'dotenv/config';

function unwrap(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if ('value' in cell) return cell.value ?? '';
    return '';
  }
  return cell;
}

export default async function handler(req, res) {
  let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
  let token = (process.env.TURSO_AUTH_TOKEN || '').trim();

  rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
  token = token.replace(/^['"]|['"]$/g, '').trim();

  if (!rawUrl || !token) {
    return res.status(500).json({ ok: false, error: "Missing database credentials" });
  }

  const tursoHttp = `https://${rawUrl}/v2/pipeline`;

  // Delete Missionary
  if (req.method === 'POST' && req.body?.action === 'delete_missionary') {
    const email = String(req.body.email || '').trim().toLowerCase();
    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "DELETE FROM missionaries WHERE email = ?;", args: [{ type: "text", value: email }] } },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, deletedEmail: email });
  }

  // Admin Update Points
  if (req.method === 'POST' && req.body?.action === 'update_points') {
    const email = String(req.body.email || '').trim().toLowerCase();
    const newPoints = Number(req.body.points) || 0;
    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "UPDATE missionaries SET points = ? WHERE email = ?;", args: [{ type: "integer", value: String(newPoints) }, { type: "text", value: email }] } },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, email, newPoints });
  }

  // Admin Update Order Status
  if (req.method === 'POST' && req.body?.action === 'update_order_status') {
    const orderId = String(req.body.order_id || '').trim();
    const status = String(req.body.status || 'PENDING').trim().toUpperCase();
    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "UPDATE orders SET status = ? WHERE order_id = ?;", args: [{ type: "text", value: status }, { type: "text", value: orderId }] } },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, orderId, status });
  }

  // Toggle System Flags (Force Stop / Maintenance)
  if (req.method === 'POST' && (req.body?.action === 'toggle_stop' || req.body?.action === 'toggle_maintenance')) {
    const key = req.body.action === 'toggle_stop' ? 'FORCE_STOP' : 'MAINTENANCE_MODE';
    const desiredState = req.body.state ? 1 : 0;
    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "CREATE TABLE IF NOT EXISTS stats (key TEXT PRIMARY KEY, value INTEGER);" } },
          { type: "execute", stmt: { sql: "INSERT INTO stats (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [{ type: "text", value: key }, { type: "integer", value: String(desiredState) }] } },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, [key.toLowerCase()]: Boolean(desiredState) });
  }

  // Test Send Email
  if (req.method === 'POST' && req.body?.action === 'test_send') {
    const targetEmail = String(req.body.email || '').trim();
    const brevoKey = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
    
    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ ok: false, error: "Valid test email required" });
    }

    try {
      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': brevoKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: "Timeless Creations Rewards", email: "noreply.timelesscreations.ph@gmail.com" },
          to: [{ email: targetEmail, name: "Admin Test" }],
          subject: "🧪 TCRP System Test Dispatch",
          htmlContent: `<div style="font-family:Georgia,serif;padding:20px;background:#faf7f0;color:#1a1610;"><h2>TCRP Test Dispatch Successful!</h2><p>This is a live test transmission from your Command Center Admin Panel.</p></div>`
        })
      });

      if (emailRes.ok) {
        return res.status(200).json({ ok: true, message: `Test email successfully sent to ${targetEmail}` });
      } else {
        const errJson = await emailRes.json();
        return res.status(500).json({ ok: false, error: errJson.message || "Brevo dispatch failed" });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // Edit Monthly Message
  if (req.method === 'POST' && req.body?.action === 'update_message') {
    const month = Number(req.body.month);
    const theme = String(req.body.theme || '');
    const scripture = String(req.body.scripture || '');
    const message = String(req.body.message || '');

    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "CREATE TABLE IF NOT EXISTS drip_messages (month INTEGER PRIMARY KEY, theme TEXT, scripture TEXT, message TEXT);" } },
          {
            type: "execute",
            stmt: {
              sql: "INSERT INTO drip_messages (month, theme, scripture, message) VALUES (?, ?, ?, ?) ON CONFLICT(month) DO UPDATE SET theme = excluded.theme, scripture = excluded.scripture, message = excluded.message;",
              args: [
                { type: "integer", value: String(month) },
                { type: "text", value: theme },
                { type: "text", value: scripture },
                { type: "text", value: message }
              ]
            }
          },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, message: `Month ${month} updated successfully` });
  }

  try {
    const dbRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "SELECT email, COALESCE(name, 'Missionary'), COALESCE(last_name, ''), COALESCE(cohort, 'elder'), COALESCE(batch_month, 'August 2026'), COALESCE(months_sent, 0), COALESCE(max_months, 24), COALESCE(points, 0), COALESCE(referral_code, 'TCRP'), COALESCE(status, 'active') FROM missionaries ORDER BY rowid ASC;" } },
          { type: "execute", stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC;" } },
          { type: "execute", stmt: { sql: "SELECT order_id, psid, email, name, item, points_cost, status, created_at FROM orders ORDER BY CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END ASC, rowid ASC;" } },
          { type: "execute", stmt: { sql: "SELECT key, value FROM stats;" } },
          { type: "close" }
        ]
      })
    });

    const data = await dbRes.json();
    const misRows = data.results?.[0]?.response?.result?.rows || [];
    const msgRows = data.results?.[1]?.response?.result?.rows || [];
    const ordRows = data.results?.[2]?.response?.result?.rows || [];
    const statsRows = data.results?.[3]?.response?.result?.rows || [];

    const statsMap = {};
    statsRows.forEach(r => {
      statsMap[String(unwrap(r[0]))] = Number(unwrap(r[1])) || 0;
    });

    const missionaries = misRows.map(row => {
      const email = String(unwrap(row[0])).trim();
      const name = String(unwrap(row[1])).trim();
      const lastName = String(unwrap(row[2])).trim();
      const cohort = String(unwrap(row[3])).toLowerCase().trim();
      const batch = String(unwrap(row[4])).trim();
      const monthsSent = Number(unwrap(row[5])) || 0;
      const maxMonths = Number(unwrap(row[6])) || (cohort.includes('sister') ? 18 : 24);
      const points = Number(unwrap(row[7])) || 0;
      const ref = String(unwrap(row[8])).trim();
      const status = String(unwrap(row[9])).trim();

      return {
        email,
        name: name || 'Missionary',
        lastName,
        cohort: cohort.includes('sister') ? 'sister' : 'elder',
        start: batch || 'August 2026',
        monthsDiff: monthsSent,
        limit: maxMonths,
        points,
        ref: ref || 'TCRP',
        status: status || 'active'
      };
    });

    const messages = msgRows.map(row => ({
      month: Number(unwrap(row[0])) || 1,
      theme: String(unwrap(row[1])),
      quote: String(unwrap(row[2])),
      msg: String(unwrap(row[3]))
    }));

    const orders = ordRows.map(row => ({
      order_id: String(unwrap(row[0])),
      psid: String(unwrap(row[1])),
      email: String(unwrap(row[2])),
      name: String(unwrap(row[3])) || 'Missionary',
      item: String(unwrap(row[4])),
      cost: Number(unwrap(row[5])) || 0,
      status: String(unwrap(row[6])) || 'PENDING',
      date: String(unwrap(row[7])) || ''
    }));

    return res.status(200).json({
      ok: true,
      missionaries,
      messages,
      orders,
      forceStop: statsMap['FORCE_STOP'] === 1,
      maintenanceMode: statsMap['MAINTENANCE_MODE'] === 1,
      totalCount: missionaries.length
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
