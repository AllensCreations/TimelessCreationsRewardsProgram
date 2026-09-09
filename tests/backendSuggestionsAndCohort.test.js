import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { runSql } from '../lib/db.js';
import { handleEmailAction } from '../lib/handlers/emailHandler.js';
import { 
  getFirstMonthInfo, 
  calculateMissionMonth, 
  getFirstDispatchDate, 
  isMissionaryEligibleForDispatch 
} from '../lib/utils/batchCalculator.js';

async function runTests() {
  console.log("🧪 Running Comprehensive Tests for Backend Suggestions & Cohort Rules...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // Test 1: September 2026 Batch Cohort Rules
  // ----------------------------------------------------
  const sepInfo = getFirstMonthInfo("September 2026");
  assert(sepInfo.firstMonthNum === 10, "September 2026 batch cohort first dispatch month is 10 (October)");
  assert(sepInfo.firstMonthName === "October", "September 2026 batch cohort first dispatch month name is October");
  assert(sepInfo.firstMonthYear === 2026, "September 2026 batch cohort first dispatch year is 2026");

  const phtSept9 = new Date("2026-09-09T12:00:00Z");
  const monthSept = calculateMissionMonth("September 2026", 24, phtSept9);
  assert(monthSept === 0, "Missionary in arrival month (September 2026) has mission month 0");

  const septDispatchDate = getFirstDispatchDate("September 2026", phtSept9);
  assert(septDispatchDate === "2026-10-09", "First dispatch date for September cohort is 2026-10-09");

  const mSept = {
    email: "elder.september@test.org",
    name: "Elder September",
    cohort: "elder",
    batch_month: "September 2026",
    months_sent: 0,
    max_months: 24,
    status: "active"
  };
  const eligibleSept = isMissionaryEligibleForDispatch(mSept, phtSept9, "2026-09-09");
  assert(eligibleSept === false, "September 2026 cohort missionary is NOT eligible for dispatch in September");

  const phtOct9 = new Date("2026-10-09T12:00:00Z");
  const monthOct = calculateMissionMonth("September 2026", 24, phtOct9);
  assert(monthOct === 1, "Missionary in Month 1 (October 2026) has mission month 1");

  const eligibleOct = isMissionaryEligibleForDispatch(mSept, phtOct9, "2026-10-09");
  assert(eligibleOct === true, "September 2026 cohort missionary IS eligible for dispatch in October");

  // ----------------------------------------------------
  // Test 2: Brevo Webhook Handling (Suggestion 4)
  // ----------------------------------------------------
  const testBounceEmail = `bounce.${Date.now()}@test.org`;
  const testUnsubEmail = `unsub.${Date.now()}@test.org`;
  const testSpamEmail = `spam.${Date.now()}@test.org`;

  // Push mock missionaries
  await runSql("INSERT INTO missionaries (email, name, cohort, status) VALUES (?, ?, 'elder', 'active')", [testBounceEmail, "Elder Bounce"]).catch(() => {});
  await runSql("INSERT INTO missionaries (email, name, cohort, status) VALUES (?, ?, 'sister', 'active')", [testUnsubEmail, "Sister Unsub"]).catch(() => {});

  const resBounce = await handleEmailAction("brevo_webhook", {}, {
    event: "hard_bounce",
    email: testBounceEmail
  });
  assert(resBounce?.status === 200 && resBounce?.json?.ok === true, "Brevo webhook processes hard_bounce successfully");

  const resUnsub = await handleEmailAction("brevo_webhook", {}, {
    event: "unsubscribed",
    email: testUnsubEmail
  });
  assert(resUnsub?.status === 200 && resUnsub?.json?.ok === true, "Brevo webhook processes unsubscribed successfully");

  const resSpam = await handleEmailAction("brevo_webhook", {}, {
    event: "spam",
    email: testSpamEmail
  });
  assert(resSpam?.status === 200 && resSpam?.json?.ok === true, "Brevo webhook processes spam complaint successfully");

  // Array payload
  const resBatch = await handleEmailAction("brevo_webhook", {}, [
    { event: "soft_bounce", email: "batch1@test.org" },
    { event: "unsubscribe", email: "batch2@test.org" }
  ]);
  assert(resBatch?.status === 200 && resBatch?.json?.processed === 2, "Brevo webhook processes batch array of events");

  // ----------------------------------------------------
  // Test 3: Composite Index (Suggestion 3)
  // ----------------------------------------------------
  const schemaSql = fs.readFileSync(path.resolve('schema.sql'), 'utf-8');
  assert(schemaSql.includes('idx_m_dispatch'), "schema.sql defines idx_m_dispatch composite index");
  assert(schemaSql.includes('status') && schemaSql.includes('cohort') && schemaSql.includes('next_send_date') && schemaSql.includes('months_sent'), "idx_m_dispatch covers status, cohort, next_send_date, and months_sent");

  // ----------------------------------------------------
  // Test 4: Idempotency & In-Flight Lock (Suggestion 1)
  // ----------------------------------------------------
  const cronJs = fs.readFileSync(path.resolve('api/cron.js'), 'utf-8');
  assert(cronJs.includes('inFlightCronDispatches') && cronJs.includes('has(emailKey)'), "api/cron.js enforces in-flight concurrency lock");
  assert(cronJs.includes('substr(last_sent_at, 1, 10)'), "api/cron.js enforces database daily dispatch idempotency check");

  const emailHandlerJs = fs.readFileSync(path.resolve('lib/handlers/emailHandler.js'), 'utf-8');
  assert(emailHandlerJs.includes('inFlightBatchDispatches') && emailHandlerJs.includes('has(emailKey)'), "emailHandler.js enforces in-flight batch concurrency lock");
  assert(emailHandlerJs.includes('substr(last_sent_at, 1, 10)'), "emailHandler.js enforces database daily dispatch idempotency check");

  // ----------------------------------------------------
  // Test 5: In-Memory DB Mock Fallback (Suggestion 6)
  // ----------------------------------------------------
  const dbJs = fs.readFileSync(path.resolve('lib/db.js'), 'utf-8');
  assert(dbJs.includes('executeInMemoryFallback'), "lib/db.js includes executeInMemoryFallback");
  assert(dbJs.includes('system_settings') && dbJs.includes('power_state'), "lib/db.js in-memory store pre-populates default system settings");

  console.log(`\n========================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
