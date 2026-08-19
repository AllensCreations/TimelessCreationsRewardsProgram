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

// Ensure the new 'names' table exists
async function ensureTables() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS names (
      email TEXT PRIMARY KEY,
      title TEXT,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      batch_month TEXT,
      created_at TEXT
    );
  `);
}

export default async function handler(req, res) {
  await ensureTables();

  // GET: Fetch the last 50 pushed missionaries (without invalid created_at column)
  if (req.method === 'GET') {
    try {
      const logs = await runSql(
        "SELECT email, name, last_name, cohort, batch_month FROM missionaries WHERE is_prelisted = 1 ORDER BY ROWID DESC LIMIT 50"
      );
      return res.status(200).json({ ok: true, history: logs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // POST: Push batch entries
  if (req.method === 'POST') {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, error: "No entries provided" });
    }

    let added = 0;
    let skipped = 0;
    const nowIso = new Date().toISOString();

    for (const item of entries) {
      const email = (item.email || '').toLowerCase().trim();
      const titleName = (item.title_name || item.name || '').trim(); // e.g. "Elder Dela Cruz"
      const firstName = (item.first_name || '').trim();              // e.g. "Mark"
      const batchMonth = (item.batch || 'August 2026').trim();

      if (!email || !titleName) {
        skipped++;
        continue;
      }

      // 1. Auto-extract Cohort (Elder or Sister)
      let titleCohort = "Elder";
      if (/^sister\b/i.test(titleName)) {
        titleCohort = "Sister";
      } else if (/^elder\b/i.test(titleName)) {
        titleCohort = "Elder";
      }

      // 2. Extract clean last name without prefix
      const lastName = titleName.replace(/^(elder|sister)\s+/i, '').trim();

      // 3. Construct Full Name
      const fullName = firstName ? `${titleCohort} ${firstName} ${lastName}` : titleName;

      try {
        const existing = (await runSql("SELECT email FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
        if (existing) {
          skipped++;
          continue;
        }

        const refCode = 'TCRP-' + crypto.randomBytes(2).toString('hex').toUpperCase();

        // Insert into 'missionaries' table
        await runSql(
          "INSERT INTO missionaries (email, name, last_name, cohort, batch_month, referral_code, points, status, is_prelisted) VALUES (?, ?, ?, ?, ?, ?, 0, 'active', 1)",
          [email, titleName, lastName, titleCohort, batchMonth, refCode]
        );

        // Insert into 'names' table
        await runSql(
          "INSERT OR REPLACE INTO names (email, title, first_name, last_name, full_name, batch_month, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [email, titleCohort, firstName, lastName, fullName, batchMonth, nowIso]
        );

        await logSystemEvent('INFO', `Imported Pre-listed: ${titleName} (${email}) | Cohort: ${titleCohort} | Batch: ${batchMonth}`);
        added++;
      } catch (err) {
        console.error("Error inserting record:", err);
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
