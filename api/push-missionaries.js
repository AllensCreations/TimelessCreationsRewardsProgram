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
  // GET: Fetch the last 50 pushed missionaries from database
  if (req.method === 'GET') {
    try {
      const logs = await runSql(
        "SELECT email, name, last_name, batch_month, created_at FROM missionaries WHERE is_prelisted = 1 ORDER BY ROWID DESC LIMIT 50"
      );
      return res.status(200).json({ ok: true, history: logs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // POST: Push batch entries and record persistent logs in Turso
  if (req.method === 'POST') {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, error: "No entries provided" });
    }

    let added = 0;
    let skipped = 0;

    for (const item of entries) {
      const email = (item.email || '').toLowerCase().trim();
      const name = (item.name || '').trim();
      const lastName = (item.last_name || '').trim() || name.replace(/^(elder|sister)\s+/i, '').trim();
      const batch = (item.batch || 'August 2026').trim();

      if (!email || !name) {
        skipped++;
        continue;
      }

      try {
        const existing = (await runSql("SELECT email FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
        if (existing) {
          skipped++;
          continue;
        }

        const refCode = 'TCRP-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        await runSql(
          "INSERT INTO missionaries (email, name, last_name, cohort, batch_month, referral_code, points, status, is_prelisted) VALUES (?, ?, ?, ?, ?, ?, 0, 'active', 1)",
          [email, name, lastName, batch, batch, refCode]
        );

        // Record entry log in system_logs
        await logSystemEvent('INFO', `Imported Pre-listed Missionary: ${name} (${email}) - Batch: ${batch}`);
        added++;
      } catch (err) {
        console.error("Error inserting missionary:", err);
        skipped++;
      }
    }

    return res.status(200).json({
      ok: true,
      added,
      skipped,
      message: `Processed ${entries.length} items. Added: ${added}, Skipped/Duplicates: ${skipped}`
    });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
