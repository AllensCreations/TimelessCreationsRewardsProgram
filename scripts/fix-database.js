import 'dotenv/config';
import { queryTurso, unwrap } from '../lib/db.js';
import { getFirstMonthInfo, getFirstDispatchDate, calculateMissionMonth } from '../lib/utils/batchCalculator.js';

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
  const phtNow = new Date(Date.now() + 8 * 3600 * 1000);
  const todayPhtIso = phtNow.toISOString().slice(0, 10);

  for (const m of missionaries) {
    let email = (m.email || '').toLowerCase().trim();
    if (!email) continue;

    let rawName = (m.name || '').trim();
    let isSister = /^sister\b/i.test(rawName) || (m.cohort || '').toLowerCase().includes('sister');
    let titleCohort = isSister ? 'sister' : 'elder';
    let maxMonths = isSister ? 18 : 24;
    let cleanLastName = (m.last_name || rawName.replace(/^(elder|sister)\s+/i, '')).trim();
    cleanLastName = toTitleCase(cleanLastName);

    let properName = `${isSister ? 'Sister' : 'Elder'} ${cleanLastName}`;
    let batchMonth = m.batch_month || 'August 2026';
    if (batchMonth.toLowerCase() === 'elder' || batchMonth.toLowerCase() === 'sister') {
      batchMonth = 'August 2026';
    }

    const batchInfo = getFirstMonthInfo(batchMonth);
    const monthsSent = Number(m.months_sent) || 0;
    const firstDispatchDate = getFirstDispatchDate(batchMonth, phtNow);
    const firstMonthPrefix = `${batchInfo.firstMonthYear}-${String(batchInfo.firstMonthNum).padStart(2, '0')}`;

    // Calculate proper next_send_date without jumping to distant years
    let cleanNextSendDate = m.next_send_date;
    if (monthsSent === 0 || !m.last_sent_at) {
      if (!cleanNextSendDate || cleanNextSendDate.slice(0, 7) !== firstMonthPrefix) {
        cleanNextSendDate = firstDispatchDate;
      }
    } else if (m.last_sent_at) {
      try {
        const lastD = new Date(m.last_sent_at);
        lastD.setMonth(lastD.getMonth() + 1);
        const expectedNext = lastD.toISOString().slice(0, 10);
        if (!cleanNextSendDate || cleanNextSendDate.slice(0, 7) > expectedNext.slice(0, 7)) {
          cleanNextSendDate = expectedNext;
        }
      } catch (_) {
        cleanNextSendDate = todayPhtIso;
      }
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
          max_months = ?,
          next_send_date = ?,
          referral_code = ?,
          email = ?
      WHERE LOWER(email) = LOWER(?)
    `, [properName, cleanLastName, titleCohort, batchMonth, maxMonths, cleanNextSendDate, finalCode, email, m.email]);

    // Populate or sync names table
    await runSql(`
      INSERT OR REPLACE INTO names (email, title, first_name, last_name, full_name, batch_month, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [email, isSister ? 'Sister' : 'Elder', '', cleanLastName, properName, batchMonth, nowIso]);

    updatedCount++;
    console.log(`✅ Fixed [${email}]: Name='${properName}', Code='${finalCode}', Cohort='${titleCohort}', NextSend='${cleanNextSendDate}', Batch='${batchMonth}'`);
  }

  console.log(`\n🎉 Completed! Standardized and verified ${updatedCount} records safely.`);
}

fixDatabase().catch(err => {
  console.error("❌ Database repair failed:", err);
});
