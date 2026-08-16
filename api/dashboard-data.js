import 'dotenv/config';

export default async function handler(req, res) {
  let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
  let token = (process.env.TURSO_AUTH_TOKEN || '').trim();

  rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
  token = token.replace(/^['"]|['"]$/g, '').trim();

  if (!rawUrl || !token) {
    return res.status(500).json({ ok: false, error: "Missing database credentials" });
  }

  const tursoHttp = `https://${rawUrl}/v2/pipeline`;

  try {
    const dbRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          // Unified query across both tables
          { 
            type: "execute", 
            stmt: { 
              sql: `SELECT 
                      COALESCE(full_name, name, 'Missionary') as full_name,
                      email,
                      COALESCE(cohort, CASE WHEN LOWER(COALESCE(full_name, name)) LIKE '%sister%' THEN 'sister' ELSE 'elder' END) as cohort,
                      COALESCE(start_date, batch_month, 'August 2026') as start_date,
                      COALESCE(months_diff, months_sent, 1) as months_diff,
                      COALESCE(points, 0) as points,
                      COALESCE(referral_code, 'TCRP') as referral_code,
                      COALESCE(unsubscribed, 0) as unsubscribed
                    FROM (
                      SELECT full_name, email, cohort, start_date, months_diff, points, referral_code, unsubscribed FROM missionaries
                      UNION
                      SELECT COALESCE(name, full_name) as full_name, email, cohort, COALESCE(batch_month, start_date) as start_date, COALESCE(months_sent, months_diff) as months_diff, points, referral_code, 0 as unsubscribed FROM recipients
                    )
                    GROUP BY email
                    ORDER BY rowid DESC` 
            } 
          },
          // 24-Month Messages
          { 
            type: "execute", 
            stmt: { 
              sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC" 
            } 
          },
          // Orders Count
          {
            type: "execute",
            stmt: { sql: "SELECT order_id, name, item, points_cost, created_at, status FROM orders ORDER BY rowid DESC" }
          },
          { type: "close" }
        ]
      })
    });

    const data = await dbRes.json();
    const misRows = data.results?.[0]?.response?.result?.rows || [];
    const msgRows = data.results?.[1]?.response?.result?.rows || [];
    const ordRows = data.results?.[2]?.response?.result?.rows || [];

    const missionaries = misRows.map(r => ({
      name: r[0]?.value ?? r[0] ?? '',
      email: r[1]?.value ?? r[1] ?? '',
      cohort: (r[2]?.value ?? r[2] ?? 'elder').toLowerCase(),
      start: r[3]?.value ?? r[3] ?? 'August 2026',
      monthsDiff: Number(r[4]?.value ?? r[4] ?? 1),
      points: Number(r[5]?.value ?? r[5] ?? 0),
      ref: r[6]?.value ?? r[6] ?? 'TCRP',
      unsubscribed: Boolean(Number(r[7]?.value ?? r[7] ?? 0)),
      limit: (r[2]?.value ?? r[2] ?? '').toLowerCase() === 'sister' ? 18 : 24
    }));

    const messages = msgRows.map(r => ({
      month: Number(r[0]?.value ?? r[0]),
      theme: r[1]?.value ?? r[1] ?? '',
      quote: r[2]?.value ?? r[2] ?? '',
      msg: r[3]?.value ?? r[3] ?? ''
    }));

    const orders = ordRows.map(r => ({
      order_id: r[0]?.value ?? r[0],
      name: r[1]?.value ?? r[1],
      item: r[2]?.value ?? r[2],
      cost: Number(r[3]?.value ?? r[3]),
      date: r[4]?.value ?? r[4],
      status: r[5]?.value ?? r[5]
    }));

    return res.status(200).json({
      ok: true,
      missionaries,
      messages,
      orders,
      totalCount: missionaries.length
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
