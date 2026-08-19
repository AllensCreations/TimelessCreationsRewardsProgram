import 'dotenv/config';
import { queryTurso, unwrap } from '../lib/db.js';

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

function generatePatternCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, char => char.toUpperCase()).trim();
}

async function fixDatabase() {
  console.log("🛠️ Starting Non-Destructive Database Maintenance & Code Standardization...\n");

  // 1. Ensure new tables exist
  console.log("1️⃣ Checking tables and schemas...");
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

  // 2. Fetch all missionaries
  console.log("2️⃣ Fetching existing missionaries...");
  const missionaries = await runSql("SELECT * FROM missionaries");
  console.log(`Found ${missionaries.length} missionary records to inspect.`);

  const usedCodes = new Set();
  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  for (const m of missionaries) {
    let email = (m.email || '').toLowerCase().trim();
    if (!email) continue;

    let rawName = (m.name || '').trim();
    let titleCohort = /^sister\b/i.test(rawName) ? 'Sister' : 'Elder';
    let cleanLastName = (m.last_name || rawName.replace(/^(elder|sister)\s+/i, '')).trim();
    cleanLastName = toTitleCase(cleanLastName);

    let properName = `${titleCohort} ${cleanLastName}`;
    let batchMonth = m.batch_month || m.cohort || 'August 2026';
    if (batchMonth === 'Elder' || batchMonth === 'Sister') {
      batchMonth = 'August 2026';
    }

    // Check if referral code matches the A#A#A# format (6 chars, alternating letter-digit)
    let currentCode = (m.referral_code || '').trim().toUpperCase();
    const isStandardFormat = /^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$/.test(currentCode);

    let finalCode = currentCode;
    if (!isStandardFormat || usedCodes.has(currentCode)) {
      do {
        finalCode = generatePatternCode();
      } while (usedCodes.has(finalCode));
    }
    usedCodes.add(finalCode);

    // Update missionaries safely
    await runSql(`
      UPDATE missionaries
      SET name = ?,
          last_name = ?,
          cohort = ?,
          batch_month = ?,
          referral_code = ?,
          email = ?
      WHERE email = ?
    `, [properName, cleanLastName, titleCohort, batchMonth, finalCode, email, m.email]);

    // Populate or sync names table
    await runSql(`
      INSERT OR REPLACE INTO names (email, title, first_name, last_name, full_name, batch_month, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [email, titleCohort, '', cleanLastName, properName, batchMonth, nowIso]);

    updatedCount++;
    console.log(`✅ Fixed [${email}]: Name='${properName}', Code='${finalCode}', Cohort='${titleCohort}', Batch='${batchMonth}'`);
  }

  console.log(`\n🎉 Completed! Standardized and verified ${updatedCount} records safely.`);
}

fixDatabase().catch(err => {
  console.error("❌ Database repair failed:", err);
});
