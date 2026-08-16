import 'dotenv/config';

export default async function handler(req, res) {
  const rawUrl = (process.env.TURSO_DATABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
  const token = (process.env.TURSO_AUTH_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

  if (!rawUrl || !token) {
    return res.status(500).json({ ok: false, error: "Missing database credentials" });
  }

  const tursoHttp = rawUrl.replace('libsql://', 'https://').replace(/\/+$/, '') + '/v2/pipeline';

  try {
    const dbRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          // 1. Fetch missionaries from your tracking table
          { type: "execute", stmt: { sql: "SELECT full_name, email, cohort, start_date, months_diff, points, referral_code, unsubscribed FROM missionaries ORDER BY rowid DESC" } },
          // 2. Fetch all 24 drip messages
          { type: "execute", stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC" } },
          { type: "close" }
        ]
      })
    });

    const data = await dbRes.json();
    const misRows = data.results?.[0]?.response?.result?.rows || [];
    const msgRows = data.results?.[1]?.response?.result?.rows || [];

    const missionaries = misRows.map(r => ({
      name: r[0]?.value || r[0] || '',
      email: r[1]?.value || r[1] || '',
      cohort: (r[2]?.value || r[2] || 'elder').toLowerCase(),
      start: r[3]?.value || r[3] || 'August 2026',
      monthsDiff: Number(r[4]?.value || r[4] || 1),
      points: Number(r[5]?.value || r[5] || 0),
      ref: r[6]?.value || r[6] || 'TCRP',
      unsubscribed: Boolean(Number(r[7]?.value || r[7] || 0)),
      limit: (r[2]?.value || r[2] || '').toLowerCase() === 'sister' ? 18 : 24
    }));

    const messages = msgRows.map(r => ({
      month: Number(r[0]?.value || r[0]),
      theme: r[1]?.value || r[1] || '',
      quote: r[2]?.value || r[2] || '',
      msg: r[3]?.value || r[3] || ''
    }));

    return res.status(200).json({
      ok: true,
      missionaries,
      messages,
      totalCount: missionaries.length
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
