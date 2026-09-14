import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error("❌ Error: Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment / .env");
  process.exit(1);
}

const httpUrl = (tursoUrl.startsWith('libsql://') ? tursoUrl.replace('libsql://', 'https://') : tursoUrl) + '/v2/pipeline';

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
  const execResult = data.results?.[0]?.response?.result;
  if (!execResult) return [];

  const cols = execResult.cols?.map(c => c.name) || [];
  const rows = execResult.rows?.map(r => {
    const obj = {};
    r.forEach((valObj, idx) => {
      obj[cols[idx]] = valObj.value !== undefined ? valObj.value : null;
    });
    return obj;
  }) || [];

  return rows;
}

export async function runTursoAudit({ dryRun = true } = {}) {
  console.log("==================================================");
  console.log("🔍 TURSO MISSIONARIES AUDIT & INTEGRITY ANALYZER");
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Diagnostic Only)' : 'EXECUTE (Applying Fixes)'}`);
  console.log("==================================================\n");

  // 1. Check Tables in Turso
  const tables = await tursoQuery("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log(`📊 Found ${tables.length} tables in Turso:`, tables.map(t => t.name).join(', '));

  const hasMissionaries = tables.some(t => t.name === 'missionaries');
  if (!hasMissionaries) {
    console.error("❌ 'missionaries' table not found in Turso database!");
    return;
  }

  // 2. Fetch all rows from missionaries
  const rows = await tursoQuery("SELECT rowid, * FROM missionaries");
  console.log(`\n📋 Total rows in 'missionaries' table: ${rows.length}\n`);

  // 3. Diagnostics
  const emailMap = new Map();
  const swappedRows = [];
  const invalidCohorts = [];
  const invalidBatches = [];
  const missingRefCodes = [];
  const invalidMaxMonths = [];

  const MONTH_REGEX = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i;

  for (const row of rows) {
    const rawEmail = (row.email || '').trim();
    const cleanEmail = rawEmail.toLowerCase();
    const rawName = (row.name || '').trim();
    const rawCohort = (row.cohort || '').toLowerCase().trim();
    const rawBatch = (row.batch_month || '').trim();
    const points = Number(row.points) || 0;
    const psid = (row.psid || '').trim();
    const maxMonths = Number(row.max_months) || 0;

    // Track duplicate emails
    if (cleanEmail) {
      if (!emailMap.has(cleanEmail)) {
        emailMap.set(cleanEmail, []);
      }
      emailMap.get(cleanEmail).push(row);
    }

    // Check swapped columns: email in name, or non-email in email
    const isEmailInName = rawName.includes('@missionary.org') || rawName.includes('@');
    const isNameInEmail = !rawEmail.includes('@') && rawEmail.length > 0;
    if (isEmailInName || isNameInEmail) {
      swappedRows.push({ rowid: row.rowid, email: rawEmail, name: rawName, reason: isEmailInName ? 'Email found in name column' : 'Invalid email format' });
    }

    // Check cohort inconsistencies
    const isSisterByTitle = /^sister\b/i.test(rawName);
    const isElderByTitle = /^elder\b/i.test(rawName);
    if (rawCohort !== 'elder' && rawCohort !== 'sister') {
      invalidCohorts.push({ rowid: row.rowid, email: rawEmail, name: rawName, cohort: rawCohort, issue: 'Cohort neither elder nor sister' });
    } else if (isSisterByTitle && rawCohort !== 'sister') {
      invalidCohorts.push({ rowid: row.rowid, email: rawEmail, name: rawName, cohort: rawCohort, issue: 'Name has Sister title but cohort is ' + rawCohort });
    } else if (isElderByTitle && rawCohort !== 'elder') {
      invalidCohorts.push({ rowid: row.rowid, email: rawEmail, name: rawName, cohort: rawCohort, issue: 'Name has Elder title but cohort is ' + rawCohort });
    }

    // Check max_months
    const expectedMaxMonths = (rawCohort === 'sister' || isSisterByTitle) ? 18 : 24;
    if (maxMonths !== expectedMaxMonths && (rawCohort === 'elder' || rawCohort === 'sister')) {
      invalidMaxMonths.push({ rowid: row.rowid, email: rawEmail, cohort: rawCohort, current: maxMonths, expected: expectedMaxMonths });
    }

    // Check batch_month
    if (!rawBatch || !MONTH_REGEX.test(rawBatch)) {
      invalidBatches.push({ rowid: row.rowid, email: rawEmail, batch: rawBatch });
    }

    // Check referral_code
    if (!row.referral_code || row.referral_code.trim().length === 0) {
      missingRefCodes.push({ rowid: row.rowid, email: rawEmail });
    }
  }

  // Find duplicate emails
  const duplicateEmailGroups = [];
  for (const [email, entries] of emailMap.entries()) {
    if (entries.length > 1) {
      duplicateEmailGroups.push({ email, count: entries.length, rows: entries });
    }
  }

  // Report Findings
  console.log("--------------------------------------------------");
  console.log("📑 AUDIT SUMMARY FINDINGS");
  console.log("--------------------------------------------------");
  console.log(`• Duplicate Email Groups:       ${duplicateEmailGroups.length} (${duplicateEmailGroups.reduce((acc, g) => acc + g.count, 0)} total duplicate records)`);
  console.log(`• Swapped / Corrupted Columns:   ${swappedRows.length}`);
  console.log(`• Cohort / Title Mismatches:     ${invalidCohorts.length}`);
  console.log(`• Incorrect max_months (18/24):  ${invalidMaxMonths.length}`);
  console.log(`• Invalid / Missing Batch Month: ${invalidBatches.length}`);
  console.log(`• Missing Referral Codes:        ${missingRefCodes.length}`);
  console.log("--------------------------------------------------\n");

  if (duplicateEmailGroups.length > 0) {
    console.log("🔍 Sample Duplicate Groups (First 5):");
    duplicateEmailGroups.slice(0, 5).forEach((g, idx) => {
      console.log(`\n  Group #${idx + 1}: ${g.email} (${g.count} rows)`);
      g.rows.forEach(r => {
        console.log(`    - rowid: ${r.rowid} | name: "${r.name}" | cohort: ${r.cohort} | batch: "${r.batch_month}" | points: ${r.points} | psid: ${r.psid || 'none'} | sent: ${r.months_sent}`);
      });
    });
  }

  if (swappedRows.length > 0) {
    console.log("\n⚠️ Sample Swapped/Corrupted Rows (First 5):");
    swappedRows.slice(0, 5).forEach(s => {
      console.log(`  - rowid: ${s.rowid} | email: "${s.email}" | name: "${s.name}" | ${s.reason}`);
    });
  }

  if (invalidCohorts.length > 0) {
    console.log("\n⚠️ Sample Cohort Mismatches (First 5):");
    invalidCohorts.slice(0, 5).forEach(c => {
      console.log(`  - rowid: ${c.rowid} | name: "${c.name}" | cohort: "${c.cohort}" | ${c.issue}`);
    });
  }

  if (dryRun) {
    console.log("\n💡 [DRY-RUN COMPLETE] No database modifications were performed.");
    console.log("To apply the deduplication and normalization fixes, run with --execute.");
    return {
      totalRows: rows.length,
      duplicateGroups: duplicateEmailGroups.length,
      swappedRows: swappedRows.length,
      invalidCohorts: invalidCohorts.length,
      invalidBatches: invalidBatches.length,
      missingRefCodes: missingRefCodes.length
    };
  }

  // EXECUTION MODE: BACKUP AND CLEANUP
  console.log("\n🚀 EXECUTING DATABASE CLEANUP & DEDUPLICATION...");
  const backupTableName = `missionaries_backup_${Date.now()}`;
  console.log(`📦 Creating safety backup table: ${backupTableName}...`);
  await tursoQuery(`CREATE TABLE IF NOT EXISTS ${backupTableName} AS SELECT * FROM missionaries`);
  console.log(`✅ Backup table created successfully!`);

  // Fix swapped rows where email is in name
  for (const s of swappedRows) {
    if (s.name.includes('@missionary.org') && !s.email.includes('@missionary.org')) {
      // Swapped
      const fixedEmail = s.name.toLowerCase().trim();
      const fixedName = s.email.trim();
      await tursoQuery("UPDATE missionaries SET email = ?, name = ? WHERE rowid = ?", [fixedEmail, fixedName, s.rowid]);
      console.log(`  ✓ Fixed swapped rowid ${s.rowid}: email -> ${fixedEmail}, name -> ${fixedName}`);
    }
  }

  // Deduplicate duplicate email groups
  let removedCount = 0;
  for (const g of duplicateEmailGroups) {
    // Sort rows to find the "best" keeper record:
    // 1. Has non-null PSID (active Messenger link)
    // 2. Highest points
    // 3. Highest months_sent / non-null last_sent_at
    // 4. Cleanest name
    const sorted = [...g.rows].sort((a, b) => {
      const aPsid = a.psid && a.psid.length > 0 ? 1 : 0;
      const bPsid = b.psid && b.psid.length > 0 ? 1 : 0;
      if (aPsid !== bPsid) return bPsid - aPsid;

      const aPts = Number(a.points) || 0;
      const bPts = Number(b.points) || 0;
      if (aPts !== bPts) return bPts - aPts;

      const aSent = Number(a.months_sent) || 0;
      const bSent = Number(b.months_sent) || 0;
      if (aSent !== bSent) return bSent - aSent;

      return Number(b.rowid) - Number(a.rowid);
    });

    const keeper = sorted[0];
    const duplicates = sorted.slice(1);

    // Merge points if any duplicate had points
    const maxPoints = Math.max(...sorted.map(r => Number(r.points) || 0));
    const activePsid = sorted.find(r => r.psid && r.psid.length > 0)?.psid || keeper.psid || null;

    // Update keeper with best consolidated attributes
    await tursoQuery(`
      UPDATE missionaries 
      SET points = ?, psid = ?, email = LOWER(TRIM(email))
      WHERE rowid = ?
    `, [maxPoints, activePsid, keeper.rowid]);

    // Delete redundant duplicate rows
    const duplicateRowids = duplicates.map(d => d.rowid);
    for (const rid of duplicateRowids) {
      await tursoQuery("DELETE FROM missionaries WHERE rowid = ?", [rid]);
      removedCount++;
    }
  }
  console.log(`✅ Deduplication complete: Removed ${removedCount} redundant duplicate rows.`);

  // Normalize cohorts and max_months
  await tursoQuery("UPDATE missionaries SET cohort = 'sister', max_months = 18 WHERE name LIKE 'Sister %' AND cohort != 'sister'");
  await tursoQuery("UPDATE missionaries SET cohort = 'elder', max_months = 24 WHERE name LIKE 'Elder %' AND cohort != 'elder'");
  await tursoQuery("UPDATE missionaries SET max_months = 18 WHERE cohort = 'sister' AND max_months != 18");
  await tursoQuery("UPDATE missionaries SET max_months = 24 WHERE cohort = 'elder' AND max_months != 24");
  console.log(`✅ Cohort & max_months standardized.`);

  // Generate referral codes for any rows missing them
  const missingRefRows = await tursoQuery("SELECT rowid, email FROM missionaries WHERE referral_code IS NULL OR TRIM(referral_code) = ''");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  for (const m of missingRefRows) {
    let code = "";
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
      code += nums.charAt(Math.floor(Math.random() * nums.length));
    }
    await tursoQuery("UPDATE missionaries SET referral_code = ? WHERE rowid = ?", [code, m.rowid]);
  }
  if (missingRefRows.length > 0) {
    console.log(`✅ Generated missing referral codes for ${missingRefRows.length} missionaries.`);
  }

  // Final count
  const finalCount = await tursoQuery("SELECT COUNT(*) as cnt FROM missionaries");
  console.log(`\n🎉 Turso database successfully cleaned & normalized! Final rows: ${finalCount[0]?.cnt}`);
}

const isExecute = process.argv.includes('--execute');
runTursoAudit({ dryRun: !isExecute }).catch(err => {
  console.error("❌ Audit Execution Failed:", err);
  process.exit(1);
});
