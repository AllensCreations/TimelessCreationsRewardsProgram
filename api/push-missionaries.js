import 'dotenv/config';

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, char => char.toUpperCase()).trim();
}

function sanitizeEmail(email) {
  if (!email) return '';
  let clean = email.trim().toLowerCase();
  clean = clean.replace(/\+[^@]*@/, '@'); // Remove '+' aliases
  clean = clean.replace(/[^a-z0-9._@-]/g, ''); // Strip dangerous characters
  if (clean && !clean.includes('@')) clean += '@missionary.org';
  return clean;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
  let token = (process.env.TURSO_AUTH_TOKEN || '').trim();

  rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
  token = token.replace(/^['"]|['"]$/g, '').trim();

  if (!rawUrl || !token) {
    return res.status(500).json({ ok: false, error: 'Missing database configuration.' });
  }

  const tursoHttp = `https://${rawUrl}/v2/pipeline`;
  const entries = req.body?.entries || [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ ok: false, error: 'No missionary records provided.' });
  }

  try {
    // 1. Fetch all existing emails to avoid duplicates
    const checkRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "SELECT email FROM missionaries;" } },
          { type: "close" }
        ]
      })
    });
    const checkData = await checkRes.json();
    const existingRows = checkData.results?.[0]?.response?.result?.rows || [];
    const existingEmails = new Set(existingRows.map(r => String(r[0]?.value ?? r[0] ?? '').toLowerCase().trim()));

    const stmts = [];
    let addedCount = 0;
    let skippedCount = 0;

    for (const item of entries) {
      let email = sanitizeEmail(item.email);
      let rawName = toTitleCase(item.name || 'Missionary');
      let batch = toTitleCase(item.batch || 'August 2026');

      if (!email || !email.includes('@')) {
        skippedCount++;
        continue;
      }

      if (existingEmails.has(email)) {
        skippedCount++;
        continue;
      }

      const cohort = rawName.toLowerCase().includes('sister') ? 'sister' : 'elder';
      const maxMonths = cohort === 'sister' ? 18 : 24;
      const refCode = 'TCRP-' + Math.random().toString(36).substring(2, 7).toUpperCase();

      stmts.push({
        type: "execute",
        stmt: {
          sql: `INSERT INTO missionaries (email, name, last_name, cohort, batch_month, months_sent, max_months, points, referral_code, status)
                VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, 'active');`,
          args: [
            { type: "text", value: email },
            { type: "text", value: rawName },
            { type: "text", value: rawName.split(' ').pop() || '' },
            { type: "text", value: cohort },
            { type: "text", value: batch },
            { type: "integer", value: String(maxMonths) },
            { type: "text", value: refCode }
          ]
        }
      });

      existingEmails.add(email);
      addedCount++;
    }

    if (stmts.length > 0) {
      await fetch(tursoHttp, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [...stmts, { type: "close" }] })
      });
    }

    return res.status(200).json({
      ok: true,
      added: addedCount,
      skipped: skippedCount,
      message: `Processed ${entries.length} records. Added ${addedCount} new missionaries (${skippedCount} duplicates skipped).`
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
