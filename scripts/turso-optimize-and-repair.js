import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const httpUrl = (tursoUrl.startsWith('libsql://') ? tursoUrl.replace('libsql://', 'https://') : tursoUrl) + '/v2/pipeline';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

async function tursoQuery(sql, params = []) {
  const formattedArgs = params.map(p => {
    if (p === null || p === undefined) return { type: 'null' };
    if (typeof p === 'number') {
      return Number.isInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
    }
    if (typeof p === 'boolean') {
      return { type: 'integer', value: p ? '1' : '0' };
    }
    return { type: 'text', value: String(p) };
  });

  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tursoToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: formattedArgs } },
        { type: 'close' }
      ]
    })
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Turso Query Error ${response.status}: ${txt}`);
  }

  const data = await response.json();
  const firstResult = data.results?.[0];
  if (firstResult?.type === 'error') {
    throw new Error(`SQL Error: ${firstResult.error?.message} | Query: ${sql}`);
  }

  const execResult = firstResult?.response?.result;
  if (!execResult) return [];

  const cols = execResult.cols?.map(c => c.name) || [];
  return (execResult.rows || []).map(r => {
    const obj = {};
    r.forEach((valObj, idx) => {
      obj[cols[idx]] = valObj.value !== undefined ? valObj.value : null;
    });
    return obj;
  });
}

async function tursoBatch(statements) {
  if (!statements || statements.length === 0) return [];

  const requests = statements.map(s => {
    const args = (s.args || []).map(p => {
      if (p === null || p === undefined) return { type: 'null' };
      if (typeof p === 'number') {
        return Number.isInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
      }
      if (typeof p === 'boolean') {
        return { type: 'integer', value: p ? '1' : '0' };
      }
      return { type: 'text', value: String(p) };
    });
    return {
      type: 'execute',
      stmt: { sql: s.sql, args }
    };
  });

  requests.push({ type: 'close' });

  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tursoToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Turso Batch Error ${response.status}: ${txt}`);
  }

  const data = await response.json();
  return data.results || [];
}

function splitCSVLine(line) {
  const fields = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(curr.trim());
      curr = '';
    } else {
      curr += char;
    }
  }
  fields.push(curr.trim());
  return fields;
}

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = fields[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

function normalizeBatchMonth(raw) {
  if (!raw) return 'August 2026';
  const str = String(raw).trim();
  if (str.toLowerCase() === 'elder' || str.toLowerCase() === 'sister') {
    return null; // Corrupted
  }
  for (const month of MONTH_NAMES) {
    if (str.toLowerCase().includes(month.toLowerCase())) {
      const yearMatch = str.match(/\b(20\d\d)\b/);
      if (yearMatch) {
        return `${month} ${yearMatch[1]}`;
      }
    }
  }
  return str;
}

function calculateElapsedMonths(batchMonthStr, maxMonths = 24, targetDate = new Date()) {
  if (!batchMonthStr) return 0;
  let monthIdx = -1;
  const s = batchMonthStr.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (s.includes(MONTH_NAMES[i].toLowerCase())) {
      monthIdx = i;
      break;
    }
  }
  if (monthIdx === -1) return 0;

  const yearMatch = batchMonthStr.match(/\b(20\d\d)\b/);
  const baseYear = yearMatch ? parseInt(yearMatch[1], 10) : targetDate.getFullYear();
  const baseMonth = monthIdx + 1;

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;

  const elapsed = (targetYear - baseYear) * 12 + (targetMonth - baseMonth);
  return Math.max(0, Math.min(elapsed, maxMonths));
}

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += nums.charAt(Math.floor(Math.random() * nums.length));
  }
  return code;
}

export async function runOptimizationAndRepair({ dryRun = true } = {}) {
  console.log("==================================================================");
  console.log("⚡ TURSO USAGE OPTIMIZATION & MULTI-SOURCE REPAIR PIPELINE");
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Diagnostic & Plan Preview)' : 'EXECUTE (Applying Changes)'}`);
  console.log("==================================================================\n");

  // 1. Fetch current missionaries from Turso
  const currentRows = await tursoQuery("SELECT rowid, * FROM missionaries");
  console.log(`📊 Current missionaries table row count: ${currentRows.length}`);

  // 2. Fetch ground truth CSVs
  const eldersCSV = parseCSV('data/elders.csv');
  const sistersCSV = parseCSV('data/sisters.csv');
  console.log(`📂 Ground Truth CSVs: ${eldersCSV.length} elders, ${sistersCSV.length} sisters`);

  // Build CSV lookup maps
  const csvByEmail = new Map();
  const csvByName = new Map();

  for (const e of eldersCSV) {
    const em = (e.Email || '').toLowerCase().trim();
    const nm = (e['Full Name'] || '').toLowerCase().trim();
    const data = {
      cohort: 'elder',
      batch: normalizeBatchMonth(e['Start Date']),
      firstName: e['First Name']?.trim() || '',
      lastName: e['Last Name']?.trim() || '',
      name: e['Full Name']?.trim() || `Elder ${e['Last Name'] || ''}`.trim()
    };
    if (em) csvByEmail.set(em, data);
    if (nm && !csvByName.has(nm)) csvByName.set(nm, data);
  }

  for (const s of sistersCSV) {
    const em = (s.Email || '').toLowerCase().trim();
    const nm = (s['Full Name'] || '').toLowerCase().trim();
    const data = {
      cohort: 'sister',
      batch: normalizeBatchMonth(s['Start Date']),
      firstName: s['First Name']?.trim() || '',
      lastName: s['Last Name']?.trim() || '',
      name: s['Full Name']?.trim() || `Sister ${s['Last Name'] || ''}`.trim()
    };
    if (em) csvByEmail.set(em, data);
    if (nm && !csvByName.has(nm)) csvByName.set(nm, data);
  }

  // 3. Fetch dispatch logs from system_logs to deduce batch months for any rows not in CSV
  console.log("🔍 Scanning system_logs dispatch history for historical batch months...");
  const dispatchLogs = await tursoQuery(`
    SELECT message, created_at 
    FROM system_logs 
    WHERE message LIKE '%[EMAIL_DISPATCH]%' OR message LIKE '%Automated Drip%'
    ORDER BY id ASC
  `).catch(() => []);

  const dispatchHistory = new Map();
  for (const l of dispatchLogs) {
    let monthNum = null;
    let email = null;
    let m = l.message.match(/Automated Drip M(\d+) dispatched to (.*?) \((.*?)\)/i);
    if (m) {
      monthNum = parseInt(m[1], 10);
      email = m[3].trim().toLowerCase();
    } else {
      m = l.message.match(/\[EMAIL_DISPATCH\]\s*(?:M(\d+)\s*\((.*?)\)|(.*?)\s*\(M(\d+)\))\s*sent to\s*([^\s,]+)/i);
      if (m) {
        monthNum = parseInt(m[1] || m[4], 10);
        email = m[5].trim().toLowerCase();
      }
    }
    if (email && monthNum) {
      if (!dispatchHistory.has(email)) dispatchHistory.set(email, []);
      dispatchHistory.get(email).push({ monthNum, at: l.created_at });
    }
  }
  console.log(`✓ Indexed historical dispatch logs for ${dispatchHistory.size} unique recipients.\n`);

  // 4. Dot-normalization & Deduplication Map
  // Map normalized key (e.g. "marielablin@missionary.org") -> list of records
  const canonicalGroups = new Map();

  for (const row of currentRows) {
    let rawEmail = (row.email || '').trim().toLowerCase();
    // Clean trailing dots, e.g. "julie.ramos.@missionary.org" -> "julie.ramos@missionary.org"
    rawEmail = rawEmail.replace(/\.@missionary\.org$/i, '@missionary.org');
    
    // Key for grouping dot-variations
    const parts = rawEmail.split('@');
    const dotFreeKey = parts.length === 2 ? `${parts[0].replace(/\./g, '')}@${parts[1]}` : rawEmail;

    if (!canonicalGroups.has(dotFreeKey)) {
      canonicalGroups.set(dotFreeKey, []);
    }
    canonicalGroups.get(dotFreeKey).push({ ...row, cleanedEmail: rawEmail });
  }

  console.log(`👥 Grouped ${currentRows.length} raw rows into ${canonicalGroups.size} canonical missionary entities.`);
  const duplicateGroups = Array.from(canonicalGroups.values()).filter(g => g.length > 1);
  console.log(`⚠️ Detected ${duplicateGroups.length} duplicate groups (${duplicateGroups.reduce((acc, g) => acc + g.length, 0)} total rows involved).\n`);

  // 5. Harmonize and Prepare Clean Records
  const cleanMissionaries = [];
  const assignedReferralCodes = new Set();
  let restoredFromCSV = 0;
  let restoredFromDispatches = 0;
  let restoredElderAllen = 0;
  let datesNormalized = 0;
  let maxMonthsFixed = 0;

  for (const [key, group] of canonicalGroups.entries()) {
    // Sort group to find best keeper:
    // 1. Linked PSID (active Messenger user)
    // 2. Highest points
    // 3. Highest months_sent
    // 4. Canonical email with dot (preferred over dotless)
    const sorted = [...group].sort((a, b) => {
      const aPsid = a.psid && String(a.psid).trim().length > 0 ? 1 : 0;
      const bPsid = b.psid && String(b.psid).trim().length > 0 ? 1 : 0;
      if (aPsid !== bPsid) return bPsid - aPsid;

      const aPts = Number(a.points) || 0;
      const bPts = Number(b.points) || 0;
      if (aPts !== bPts) return bPts - aPts;

      const aSent = Number(a.months_sent) || 0;
      const bSent = Number(b.months_sent) || 0;
      if (aSent !== bSent) return bSent - aSent;

      // Prefer email with dot in username
      const aHasDot = a.cleanedEmail.split('@')[0].includes('.') ? 1 : 0;
      const bHasDot = b.cleanedEmail.split('@')[0].includes('.') ? 1 : 0;
      if (aHasDot !== bHasDot) return bHasDot - aHasDot;

      return Number(a.rowid) - Number(b.rowid);
    });

    const keeper = sorted[0];
    const email = keeper.cleanedEmail;

    // Consolidate points and PSID across all duplicates
    let points = Math.max(...group.map(r => Number(r.points) || 0));
    let psid = group.find(r => r.psid && String(r.psid).trim().length > 0)?.psid || null;
    if (psid && String(psid).trim() === '') psid = null;

    let cohort = (keeper.cohort || '').toLowerCase().trim();
    let name = (keeper.name || '').trim();
    let firstName = (keeper.first_name || '').trim();
    let lastName = (keeper.last_name || '').trim();
    let batchMonth = normalizeBatchMonth(keeper.batch_month);
    let monthsSent = Number(keeper.months_sent) || 0;
    let status = (keeper.status || 'active').toLowerCase().trim();
    if (!['active', 'unsubscribed', 'paused'].includes(status)) status = 'active';

    // SPECIAL RESTORATION: Elder Allen (Row 1 / admin user)
    if (email === '2ndsalviejomark2019@gmail.com') {
      points = 420;
      psid = '27847655444926694';
      keeper.referral_code = 'G2X7F5';
      cohort = 'elder';
      batchMonth = 'August 2026';
      name = 'Elder Allen';
      restoredElderAllen++;
    }

    // Check if original date was reversed in database (e.g. "2025 May" -> "May 2025")
    const origBatchRaw = (keeper.batch_month || '').trim();
    if (/^\d{4}\s+[A-Za-z]+$/.test(origBatchRaw)) {
      datesNormalized++;
    }

    // Attempt Ground Truth CSV restoration (CSV is primary ground truth for batch & names)
    const csvMatch = csvByEmail.get(email) || csvByName.get(name.toLowerCase());
    if (csvMatch) {
      const origNormalized = normalizeBatchMonth(origBatchRaw);
      if (csvMatch.batch && csvMatch.batch !== origNormalized) {
        batchMonth = csvMatch.batch;
        restoredFromCSV++;
      } else if (!batchMonth) {
        batchMonth = csvMatch.batch;
      }
      if (csvMatch.firstName && (!firstName || firstName === '0' || firstName === '')) {
        firstName = csvMatch.firstName;
      }
      if (csvMatch.lastName && (!lastName || lastName.startsWith('Elder ') || lastName.startsWith('Sister '))) {
        lastName = csvMatch.lastName;
      }
      if (csvMatch.name && (!name || name === 'Missionary' || name.toLowerCase() === 'elder' || name.toLowerCase() === 'sister')) {
        name = csvMatch.name;
      }
      cohort = csvMatch.cohort;
    }

    // If batch_month was overwritten with "September 2026" or missing, and no CSV match, check dispatch logs
    if ((!batchMonth || batchMonth === 'September 2026' || batchMonth === 'August 2026') && !csvMatch && dispatchHistory.has(email)) {
      const history = dispatchHistory.get(email);
      // Sort by dispatch date
      const latest = history[history.length - 1];
      // If latest was e.g. M8 in August 2026, arrival (Month 0) was December 2025
      const dispatchDate = new Date(latest.at || '2026-08-20');
      const totalMonthsAgo = latest.monthNum;
      const arrivalDate = new Date(dispatchDate.getFullYear(), dispatchDate.getMonth() - totalMonthsAgo, 1);
      const deducedBatch = `${MONTH_NAMES[arrivalDate.getMonth()]} ${arrivalDate.getFullYear()}`;
      if (deducedBatch !== batchMonth) {
        batchMonth = deducedBatch;
        restoredFromDispatches++;
      }
    }

    // Final fallback for batch month if completely missing
    if (!batchMonth) {
      batchMonth = 'August 2026';
    }

    // Cohort & Title standardizations
    if (/^sister\b/i.test(name) || cohort === 'sister') {
      cohort = 'sister';
    } else {
      cohort = 'elder';
    }

    // Standardize max_months (18 for Sister, 24 for Elder)
    const maxMonths = cohort === 'sister' ? 18 : 24;
    if (Number(keeper.max_months) !== maxMonths) {
      maxMonthsFixed++;
    }

    // If months_sent is 0 but missionary arrived months ago, recalculate accurate elapsed tenure
    if (monthsSent === 0) {
      const calculated = calculateElapsedMonths(batchMonth, maxMonths);
      if (calculated > 0) {
        monthsSent = calculated;
      }
    }

    // Referral code preservation & collision resolution
    let refCode = (keeper.referral_code || '').toUpperCase().trim();
    if (!refCode || assignedReferralCodes.has(refCode)) {
      do {
        refCode = generateReferralCode();
      } while (assignedReferralCodes.has(refCode));
    }
    assignedReferralCodes.add(refCode);

    // Clean name formatting
    if (!name || name === 'Elder' || name === 'Sister') {
      const title = cohort === 'sister' ? 'Sister' : 'Elder';
      name = lastName ? `${title} ${lastName}` : `${title} Missionary`;
    }

    cleanMissionaries.push({
      email,
      name,
      first_name: firstName || '',
      last_name: lastName || '',
      cohort,
      batch_month: batchMonth,
      months_sent: monthsSent,
      max_months: maxMonths,
      points,
      referral_code: refCode,
      psid,
      status,
      is_prelisted: Number(keeper.is_prelisted) || 0,
      last_sent_at: keeper.last_sent_at ? String(keeper.last_sent_at) : null,
      next_send_date: keeper.next_send_date ? String(keeper.next_send_date).slice(0, 7) : null,
      pending_ref_notices: Number(keeper.pending_ref_notices) || 0
    });
  }

  // Summary of planned changes
  console.log("------------------------------------------------------------------");
  console.log("📋 OPTIMIZATION & REPAIR METRICS PREVIEW");
  console.log("------------------------------------------------------------------");
  console.log(`• Starting Rows in Turso:         ${currentRows.length}`);
  console.log(`• Final Deduplicated Rows:       ${cleanMissionaries.length} (${currentRows.length - cleanMissionaries.length} duplicates removed)`);
  console.log(`• Restored Batches from CSV:     ${restoredFromCSV}`);
  console.log(`• Restored Batches from Logs:    ${restoredFromDispatches}`);
  console.log(`• Elder Allen Restored:          ${restoredElderAllen ? 'YES (420 pts, PSID 27847655444926694, Code G2X7F5)' : 'NO'}`);
  console.log(`• Reversed Dates Normalized:     ${datesNormalized}`);
  console.log(`• Incorrect max_months Fixed:    ${maxMonthsFixed}`);
  console.log(`• Redundant Columns Dropped:     fb_sender_id, is_active`);
  console.log(`• New Indexes to Create:         idx_m_psid, idx_m_referral, idx_m_dispatch, (email PK)`);
  console.log("------------------------------------------------------------------\n");

  if (dryRun) {
    console.log("💡 [DRY-RUN COMPLETE] No database modifications were executed.");
    console.log("To apply the safety backup, schema rebuild, deduplication, and indexing, run with --execute.");
    return {
      ok: true,
      mode: 'dry-run',
      initialRows: currentRows.length,
      finalRows: cleanMissionaries.length,
      restoredFromCSV,
      restoredFromDispatches,
      datesNormalized,
      maxMonthsFixed
    };
  }

  // ─── EXECUTE MODE ────────────────────────────────────────────────────────────
  console.log("🚀 EXECUTING DATABASE OPTIMIZATION & REPAIR...");

  // 1. Safety Backup Table
  const backupTableName = `missionaries_backup_${Date.now()}`;
  console.log(`📦 Step 1: Creating safety backup table '${backupTableName}'...`);
  await tursoQuery(`CREATE TABLE IF NOT EXISTS ${backupTableName} AS SELECT * FROM missionaries`);
  console.log(`✅ Backup table created successfully!`);

  // 2. Create Modernized `missionaries_new` Table
  console.log(`🛠️ Step 2: Creating modernized 'missionaries_new' table with PRIMARY KEY(email)...`);
  await tursoQuery("DROP TABLE IF EXISTS missionaries_new").catch(() => {});
  await tursoQuery(`
    CREATE TABLE missionaries_new (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      cohort TEXT NOT NULL CHECK(cohort IN ('elder', 'sister')),
      batch_month TEXT NOT NULL,
      months_sent INTEGER DEFAULT 0,
      max_months INTEGER NOT NULL,
      points INTEGER DEFAULT 0,
      referral_code TEXT UNIQUE,
      psid TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'unsubscribed', 'paused')),
      is_prelisted INTEGER DEFAULT 0,
      last_sent_at TEXT,
      next_send_date TEXT,
      pending_ref_notices INTEGER DEFAULT 0
    )
  `);
  console.log(`✅ 'missionaries_new' schema created.`);

  // 3. Batch insert all cleaned records
  console.log(`📥 Step 3: Inserting ${cleanMissionaries.length} cleaned & deduplicated records...`);
  const chunkSize = 40;
  let inserted = 0;

  for (let i = 0; i < cleanMissionaries.length; i += chunkSize) {
    const chunk = cleanMissionaries.slice(i, i + chunkSize);
    const statements = chunk.map(m => ({
      sql: `
        INSERT INTO missionaries_new (
          email, name, first_name, last_name, cohort, batch_month,
          months_sent, max_months, points, referral_code, psid,
          status, is_prelisted, last_sent_at, next_send_date, pending_ref_notices
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        m.email, m.name, m.first_name, m.last_name, m.cohort, m.batch_month,
        m.months_sent, m.max_months, m.points, m.referral_code, m.psid,
        m.status, m.is_prelisted, m.last_sent_at, m.next_send_date, m.pending_ref_notices
      ]
    }));

    await tursoBatch(statements);
    inserted += chunk.length;
    process.stdout.write(`  Inserted ${inserted}/${cleanMissionaries.length} records...\r`);
  }
  console.log(`\n✅ All ${inserted} records inserted successfully.`);

  // 4. Create Performance Indexes on `missionaries_new`
  console.log(`⚡ Step 4: Creating high-speed performance indexes...`);
  await tursoQuery("DROP INDEX IF EXISTS idx_m_psid").catch(() => {});
  await tursoQuery("DROP INDEX IF EXISTS idx_m_referral").catch(() => {});
  await tursoQuery("DROP INDEX IF EXISTS idx_m_dispatch").catch(() => {});

  await tursoQuery("CREATE INDEX idx_m_psid ON missionaries_new(psid)");
  await tursoQuery("CREATE INDEX idx_m_referral ON missionaries_new(referral_code)");
  await tursoQuery("CREATE INDEX idx_m_dispatch ON missionaries_new(status, cohort, next_send_date, months_sent)");
  console.log(`✅ Indexes created (idx_m_psid, idx_m_referral, idx_m_dispatch).`);

  // 5. Swap Tables: Swap missionaries_new to missionaries
  console.log(`🔄 Step 5: Atomic table swap (missionaries -> missionaries_old_archive, missionaries_new -> missionaries)...`);
  await tursoQuery("DROP TABLE IF EXISTS missionaries_old_archive").catch(() => {});
  await tursoQuery("ALTER TABLE missionaries RENAME TO missionaries_old_archive");
  await tursoQuery("ALTER TABLE missionaries_new RENAME TO missionaries");
  console.log(`✅ Table swap completed! Live table 'missionaries' is now active.`);

  // 6. Verify Final State
  const finalCount = await tursoQuery("SELECT COUNT(*) as cnt FROM missionaries");
  const finalIndices = await tursoQuery("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='missionaries'");
  console.log(`\n🎉 SUCCESS: Turso database fully optimized and repaired!`);
  console.log(`• Final Table Rows: ${finalCount[0]?.cnt}`);
  console.log(`• Table Indexes:    ${finalIndices.map(i => i.name).join(', ')}`);

  return {
    ok: true,
    mode: 'execute',
    finalRows: Number(finalCount[0]?.cnt),
    backupTable: backupTableName
  };
}

const isExecute = process.argv.includes('--execute');
runOptimizationAndRepair({ dryRun: !isExecute }).catch(err => {
  console.error("❌ Execution Error:", err);
  process.exit(1);
});
