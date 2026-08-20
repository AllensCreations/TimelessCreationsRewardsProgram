import crypto from 'crypto';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const logs = await runSql("SELECT email, name, last_name, batch_month, verified FROM missionaries WHERE is_prelisted = 1 ORDER BY ROWID DESC LIMIT 50");
      return res.status(200).json({ ok: true, history: logs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, error: "No entries provided" });
    }

    let added = 0;
    let skipped = 0;

    for (const item of entries) {
      const email = (item.email || '').toLowerCase().trim();
      const titleName = (item.title_name || item.name || '').trim();
      const batchMonth = (item.batch || 'August 2026').trim();

      if (!email || !titleName) { skipped++; continue; }

      const lastName = titleName.replace(/^(elder|sister)\s+/i, '').trim();

      try {
        const existing = (await runSql("SELECT email FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
        if (existing) { skipped++; continue; }

        const refCode = 'TCRP-' + crypto.randomBytes(2).toString('hex').toUpperCase();

        // Insert directly into consolidated missionaries table
        await runSql(
          "INSERT INTO missionaries (email, name, last_name, batch_month, referral_code, points, status, is_prelisted, verified) VALUES (?, ?, ?, ?, ?, 0, 'active', 1, 0)",
          [email, titleName, lastName, batchMonth, refCode]
        );

        await logSystemEvent('INFO', `Imported Pre-listed: ${titleName} (${email}) | Batch: ${batchMonth}`);
        added++;
      } catch (err) {
        skipped++;
      }
    }

    return res.status(200).json({ ok: true, added, skipped, message: `Added: ${added}, Skipped: ${skipped}` });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
