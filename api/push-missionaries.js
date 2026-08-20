import crypto from 'crypto';
import { runSql } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

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
