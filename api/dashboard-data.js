import 'dotenv/config';

function parseMonthsElapsed(startDateStr) {
  if (!startDateStr) return 1;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed

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

  // Emergency Force Stop Handler
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
    const schemaRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "SELECT name FROM sqlite_master WHERE type='table';" } },
          { type: "close" }
        ]
      })
    });

    const schemaData = await schemaRes.json();
    const tableRows = schemaData.results?.[0]?.response?.result?.rows || [];
    const tables = tableRows.map(r => (r[0]?.value || r[0] || '').toLowerCase());

    const requests = [];
    if (tables.includes('elders')) requests.push({ type: "execute", stmt: { sql: "SELECT * FROM elders" } });
    if (tables.includes('sisters')) requests.push({ type: "execute", stmt: { sql: "SELECT * FROM sisters" } });
    if (tables.includes('recipients')) requests.push({ type: "execute", stmt: { sql: "SELECT * FROM recipients" } });
    if (tables.includes('missionaries')) requests.push({ type: "execute", stmt: { sql: "SELECT * FROM missionaries" } });
    if (tables.includes('users')) requests.push({ type: "execute", stmt: { sql: "SELECT * FROM users" } });
    if (tables.includes('drip_messages')) requests.push({ type: "execute", stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC" } });
    if (tables.includes('orders')) requests.push({ type: "execute", stmt: { sql: "SELECT order_id, name, email, item, points_cost, created_at, status FROM orders ORDER BY rowid DESC" } });
    if (tables.includes('stats')) requests.push({ type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP'" } });
    requests.push({ type: "close" });

    const queryRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });

    const queryData = await queryRes.json();
    const results = queryData.results || [];

    const missionariesMap = new Map();
    let messages = [];
    let orders = [];
    let forceStop = false;

    for (const resItem of results) {
      const resultObj = resItem.response?.result;
      if (!resultObj || !resultObj.cols) continue;

      const cols = resultObj.cols.map(c => (typeof c === 'object' ? c.name : c).toLowerCase());
      const rows = resultObj.rows || [];

      if (cols.includes('theme') && cols.includes('scripture')) {
        messages = rows.map(r => ({
          month: Number(r[cols.indexOf('month')]?.value ?? r[cols.indexOf('month')] ?? 1),
          theme: r[cols.indexOf('theme')]?.value ?? r[cols.indexOf('theme')] ?? '',
          quote: r[cols.indexOf('scripture')]?.value ?? r[cols.indexOf('scripture')] ?? '',
          msg: r[cols.indexOf('message')]?.value ?? r[cols.indexOf('message')] ?? ''
        }));
        continue;
      }

      if (cols.includes('order_id') && cols.includes('item')) {
        orders = rows.map(r => ({
          order_id: r[cols.indexOf('order_id')]?.value ?? r[cols.indexOf('order_id')] ?? '',
          name: r[cols.indexOf('name')]?.value ?? r[cols.indexOf('name')] ?? 'Missionary',
          email: r[cols.indexOf('email')]?.value ?? r[cols.indexOf('email')] ?? '—',
          item: r[cols.indexOf('item')]?.value ?? r[cols.indexOf('item')] ?? '',
          cost: Number(r[cols.indexOf('points_cost')]?.value ?? r[cols.indexOf('points_cost')] ?? 0),
          date: r[cols.indexOf('created_at')]?.value ?? r[cols.indexOf('created_at')] ?? '',
          status: r[cols.indexOf('status')]?.value ?? r[cols.indexOf('status')] ?? 'PENDING'
        }));
        continue;
      }

      if (cols.includes('key') && cols.includes('value')) {
        const row = rows.find(r => (r[0]?.value || r[0]) === 'FORCE_STOP');
        if (row) forceStop = Number(row[1]?.value || row[1]) === 1;
        continue;
      }

      const emailIdx = cols.findIndex(c => c.includes('email'));
      const nameIdx = cols.findIndex(c => c.includes('name') || c.includes('fullname') || c.includes('title'));
      const cohortIdx = cols.findIndex(c => c.includes('cohort') || c.includes('prefix') || c.includes('type'));
      const startIdx = cols.findIndex(c => c.includes('start') || c.includes('batch') || c.includes('date'));
      const diffIdx = cols.findIndex(c => c.includes('diff') || c.includes('sent') || c.includes('month_diff'));
      const pointsIdx = cols.findIndex(c => c.includes('point') || c.includes('balance') || c.includes('pts'));
      const refIdx = cols.findIndex(c => c.includes('code') || c.includes('ref') || c.includes('invite'));

      if (emailIdx !== -1) {
        rows.forEach(r => {
          const email = (r[emailIdx]?.value ?? r[emailIdx] ?? '').trim().toLowerCase();
          if (!email || !email.includes('@')) return;

          const rawName = nameIdx !== -1 ? (r[nameIdx]?.value ?? r[nameIdx] ?? 'Missionary') : 'Missionary';
          const rawCohort = cohortIdx !== -1 ? (r[cohortIdx]?.value ?? r[cohortIdx] ?? '') : '';
          const isSister = rawCohort.toLowerCase().includes('sister') || rawName.toLowerCase().startsWith('sister');
          const cohort = isSister ? 'sister' : 'elder';
          const start = startIdx !== -1 ? (r[startIdx]?.value ?? r[startIdx] ?? 'August 2026') : 'August 2026';
          
          // Compute months elapsed
          const monthsElapsed = diffIdx !== -1 && r[diffIdx]?.value ? Number(r[diffIdx]?.value) : parseMonthsElapsed(start);
          const points = pointsIdx !== -1 ? Number(r[pointsIdx]?.value ?? r[pointsIdx] ?? 0) : 0;
          const ref = refIdx !== -1 ? (r[refIdx]?.value ?? r[refIdx] ?? 'TCRP') : 'TCRP';
          const limit = isSister ? 18 : 24;

          if (!missionariesMap.has(email)) {
            missionariesMap.set(email, {
              name: rawName,
              email,
              cohort,
              start,
              monthsDiff: monthsElapsed,
              points,
              ref,
              limit
            });
          }
        });
      }
    }

    const missionaries = Array.from(missionariesMap.values());

    return res.status(200).json({
      ok: true,
      missionaries,
      messages,
      orders,
      forceStop,
      totalCount: missionaries.length
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
