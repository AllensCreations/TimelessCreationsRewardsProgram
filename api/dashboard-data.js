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

  // Handle Delete Missionary Request
  if (req.method === 'POST' && req.body?.action === 'delete_missionary') {
    const emailToDelete = String(req.body.email || '').trim().toLowerCase();
    if (!emailToDelete) {
      return res.status(400).json({ ok: false, error: "Email required for deletion" });
    }

    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            type: "execute",
            stmt: {
              sql: "DELETE FROM missionaries WHERE email = ?;",
              args: [{ type: "text", value: emailToDelete }]
            }
          },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, deletedEmail: emailToDelete });
  }

  // Handle Toggle Force Stop
  if (req.method === 'POST' && req.body?.action === 'toggle_stop') {
    const desiredState = req.body.state ? 1 : 0;
    await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "CREATE TABLE IF NOT EXISTS stats (key TEXT PRIMARY KEY, value INTEGER);" } },
          { type: "execute", stmt: { sql: "INSERT INTO stats (key, value) VALUES ('FORCE_STOP', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [{ type: "integer", value: String(desiredState) }] } },
          { type: "close" }
        ]
      })
    });
    return res.status(200).json({ ok: true, forceStop: Boolean(desiredState) });
  }

  try {
    const dbRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { 
            type: "execute", 
            stmt: { 
              sql: `SELECT email, COALESCE(name, 'Missionary'), COALESCE(last_name, ''), COALESCE(cohort, 'elder'), COALESCE(batch_month, 'August 2026'), COALESCE(months_sent, 0), COALESCE(max_months, 24), COALESCE(points, 0), COALESCE(referral_code, 'TCRP'), COALESCE(status, 'active') FROM missionaries ORDER BY rowid ASC;` 
            } 
          },
          { type: "execute", stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC;" } },
          { type: "execute", stmt: { sql: "SELECT order_id, psid, email, name, item, points_cost, status, created_at FROM orders ORDER BY rowid DESC;" } },
          { type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP';" } },
          { type: "close" }
        ]
      })
    });

    const data = await dbRes.json();
    const misRows = data.results?.[0]?.response?.result?.rows || [];
    const msgRows = data.results?.[1]?.response?.result?.rows || [];
    const ordRows = data.results?.[2]?.response?.result?.rows || [];
    const stopVal = unwrap(data.results?.[3]?.response?.result?.rows?.[0]?.[0]);

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
      forceStop: Number(stopVal) === 1,
      totalCount: missionaries.length
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
