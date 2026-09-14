import 'dotenv/config';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
const httpUrl = (tursoUrl.startsWith('libsql://') ? tursoUrl.replace('libsql://', 'https://') : tursoUrl) + '/v2/pipeline';

async function query(sql, params = []) {
  const formattedArgs = params.map(p => {
    if (p === null || p === undefined) return { type: 'null' };
    if (typeof p === 'number') {
      return Number.isInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
    }
    return { type: 'text', value: String(p) };
  });

  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: formattedArgs } },
        { type: 'close' }
      ]
    })
  });

  const data = await response.json();
  const execResult = data.results?.[0]?.response?.result;
  if (!execResult) return [];

  const cols = execResult.cols?.map(c => c.name) || [];
  return execResult.rows?.map(r => {
    const obj = {};
    r.forEach((valObj, idx) => {
      obj[cols[idx]] = valObj.value !== undefined ? valObj.value : null;
    });
    return obj;
  }) || [];
}

async function analyze() {
  console.log("=== TURSO DEEP DATA ANALYSIS ===\n");

  // 1. Table schema
  const schema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='missionaries'");
  console.log("📌 Missionaries Table Schema:\n", schema[0]?.sql, "\n");

  // 2. Sample 10 rows
  const samples = await query("SELECT rowid, email, name, cohort, batch_month, months_sent, max_months, points, psid, referral_code, status, last_sent_at, next_send_date FROM missionaries LIMIT 15");
  console.log("📌 Sample 15 rows:");
  console.table(samples);

  // 3. Batch month distribution
  const batchDist = await query("SELECT batch_month, COUNT(*) as cnt FROM missionaries GROUP BY batch_month ORDER BY cnt DESC LIMIT 25");
  console.log("\n📌 Top Batch Months Distribution:");
  console.table(batchDist);

  // 4. Cohort distribution
  const cohortDist = await query("SELECT cohort, COUNT(*) as cnt FROM missionaries GROUP BY cohort");
  console.log("\n📌 Cohort Distribution:");
  console.table(cohortDist);

  // 5. Status distribution
  const statusDist = await query("SELECT status, COUNT(*) as cnt FROM missionaries GROUP BY status");
  console.log("\n📌 Status Distribution:");
  console.table(statusDist);

  // 6. Name Duplicates (Same Name, Different Emails)
  const nameDupes = await query(`
    SELECT name, COUNT(*) as cnt, GROUP_CONCAT(email, ' | ') as emails 
    FROM missionaries 
    WHERE name IS NOT NULL AND TRIM(name) != '' AND TRIM(name) != 'Missionary'
    GROUP BY LOWER(TRIM(name)) 
    HAVING cnt > 1 
    ORDER BY cnt DESC 
    LIMIT 20
  `);
  console.log(`\n📌 Duplicate Names across different emails (Total groups found: ${nameDupes.length}):`);
  console.table(nameDupes);

  // 7. Non-@missionary.org emails
  const nonLdsEmails = await query("SELECT email, name, cohort FROM missionaries WHERE email NOT LIKE '%@missionary.org' LIMIT 20");
  console.log(`\n📌 Non-@missionary.org Emails (Found: ${nonLdsEmails.length}):`);
  console.table(nonLdsEmails);

  // 8. PSID count
  const psidCount = await query("SELECT COUNT(*) as linked_psid_count FROM missionaries WHERE psid IS NOT NULL AND TRIM(psid) != ''");
  console.log(`\n📌 Missionaries linked to Facebook PSID: ${psidCount[0]?.linked_psid_count}`);

  // 9. Referral code collisions / duplicates
  const refDupes = await query("SELECT referral_code, COUNT(*) as cnt FROM missionaries WHERE referral_code IS NOT NULL GROUP BY referral_code HAVING cnt > 1");
  console.log(`\n📌 Duplicate Referral Codes: ${refDupes.length}`);

  // 10. Next send date values
  const nextSendDist = await query("SELECT next_send_date, COUNT(*) as cnt FROM missionaries GROUP BY next_send_date ORDER BY cnt DESC LIMIT 15");
  console.log("\n📌 Next Send Date Distribution:");
  console.table(nextSendDist);
}

analyze().catch(console.error);
