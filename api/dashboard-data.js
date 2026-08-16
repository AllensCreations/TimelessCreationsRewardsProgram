import 'dotenv/config';

function parseMonthsElapsed(startDateStr) {
  if (!startDateStr) return 1;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  
  let startYear = curYear;
  let startMonth = curMonth;

  const str = String(startDateStr).toLowerCase();
  const yearMatch = str.match(/\b(202[0-9])\b/);
  if (yearMatch) startYear = parseInt(yearMatch[1], 10);

  for (let i = 0; i < monthNames.length; i++) {
    if (str.includes(monthNames[i])) {
      startMonth = i;
      break;
    }
  }

  const diff = (curYear - startYear) * 12 + (curMonth - startMonth) + 1;
  return Math.max(1, diff);
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
          { type: "execute", stmt: { sql: "SELECT full_name, email, cohort, start_date, points, referral_code FROM missionaries ORDER BY id ASC;" } },
          { type: "execute", stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC;" } },
          { type: "execute", stmt: { sql: "SELECT order_id, name, email, item, points_cost, created_at, status FROM orders ORDER BY rowid DESC;" } },
          { type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP';" } },
          { type: "close" }
        ]
      })
    });

    const data = await dbRes.json();
    const misRows = data.results?.[0]?.response?.result?.rows || [];
    const msgRows = data.results?.[1]?.response?.result?.rows || [];
    const ordRows = data.results?.[2]?.response?.result?.rows || [];
    const stopVal = data.results?.[3]?.response?.result?.rows?.[0]?.[0]?.value || 0;

    const missionaries = misRows.map(r => {
      const name = r[0]?.value ?? r[0] ?? 'Missionary';
      const email = r[1]?.value ?? r[1] ?? '';
      const rawCohort = r[2]?.value ?? r[2] ?? 'elder';
      const isSister = String(rawCohort).toLowerCase().includes('sister') || String(name).toLowerCase().startsWith('sister');
      const cohort = isSister ? 'sister' : 'elder';
      const start = r[3]?.value ?? r[3] ?? 'August 2026';
      const points = Number(r[4]?.value ?? r[4] ?? 2);
      const ref = r[5]?.value ?? r[5] ?? 'TCRP';
      const limit = isSister ? 18 : 24;
      const sentCount = parseMonthsElapsed(start);

      return {
        name,
        email,
        cohort,
        start,
        monthsDiff: sentCount,
        points,
        ref,
        limit
      };
    });

    const messages = msgRows.map(r => ({
      month: Number(r[0]?.value ?? r[0] ?? 1),
      theme: r[1]?.value ?? r[1] ?? '',
      quote: r[2]?.value ?? r[2] ?? '',
      msg: r[3]?.value ?? r[3] ?? ''
    }));

    const orders = ordRows.map(r => ({
      order_id: r[0]?.value ?? r[0] ?? '',
      name: r[1]?.value ?? r[1] ?? '',
      email: r[2]?.value ?? r[2] ?? '—',
      item: r[3]?.value ?? r[3] ?? '',
      cost: Number(r[4]?.value ?? r[4] ?? 0),
      date: r[5]?.value ?? r[5] ?? '',
      status: r[6]?.value ?? r[6] ?? 'PENDING'
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
