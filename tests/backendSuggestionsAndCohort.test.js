import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { runSql } from '../lib/db.js';
import { handleEmailAction } from '../lib/handlers/emailHandler.js';
import { handleDripAction } from '../lib/handlers/dripHandler.js';
import { handleCdnAction } from '../lib/handlers/cdnHandler.js';
import { 
  getFirstMonthInfo, 
  calculateMissionMonth, 
  getFirstDispatchDate, 
  isMissionaryEligibleForDispatch,
  parseBatchCohort,
  getMissionMonthInfo,
  getUpcomingDripInfo,
  formatMonthYear
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
  // Test 1: Month 0 Formula & Month Year Formatting
  // ----------------------------------------------------
  // Format Month Year (no day numbers)
  assert(formatMonthYear("2026-09-09") === "September 2026", "formatMonthYear formats '2026-09-09' to 'September 2026'");
  assert(formatMonthYear("2026-10-09") === "October 2026", "formatMonthYear formats '2026-10-09' to 'October 2026'");
  assert(formatMonthYear("April 2026") === "April 2026", "formatMonthYear preserves 'April 2026'");
  assert(formatMonthYear(null) === "Never", "formatMonthYear handles null as 'Never'");

  // April 2026 Cohort Formula Tests (Month 0 = April 2026)
  const aprM0 = getMissionMonthInfo("April 2026", 0);
  assert(aprM0.display === "April 2026" && aprM0.monthNum === 4 && aprM0.year === 2026, "April 2026 Month 0 is April 2026");
  const aprM1 = getMissionMonthInfo("April 2026", 1);
  assert(aprM1.display === "May 2026" && aprM1.monthNum === 5 && aprM1.year === 2026, "April 2026 Month 1 (M1) is May 2026");
  const aprM5 = getMissionMonthInfo("April 2026", 5);
  assert(aprM5.display === "September 2026" && aprM5.monthNum === 9 && aprM5.year === 2026, "April 2026 Month 5 (M5) is September 2026");
  const aprM18 = getMissionMonthInfo("April 2026", 18);
  assert(aprM18.display === "October 2027" && aprM18.monthNum === 10 && aprM18.year === 2027, "April 2026 Month 18 (Sister M18) is October 2027");
  const aprM24 = getMissionMonthInfo("April 2026", 24);
  assert(aprM24.display === "April 2028" && aprM24.monthNum === 4 && aprM24.year === 2028, "April 2026 Month 24 (Elder M24) is April 2028");

  // September 2026 Cohort Formula Tests (Month 0 = September 2026)
  const sepM0 = getMissionMonthInfo("September 2026", 0);
  assert(sepM0.display === "September 2026" && sepM0.monthNum === 9 && sepM0.year === 2026, "September 2026 Month 0 is September 2026");
  const sepM1 = getMissionMonthInfo("September 2026", 1);
  assert(sepM1.display === "October 2026" && sepM1.monthNum === 10 && sepM1.year === 2026, "September 2026 Month 1 (M1) is October 2026");
  const sepM4 = getMissionMonthInfo("September 2026", 4);
  assert(sepM4.display === "January 2027" && sepM4.monthNum === 1 && sepM4.year === 2027, "September 2026 Month 4 (M4) crosses year boundary to January 2027");

  // Elapsed mission month calculation
  const phtSept9 = new Date("2026-09-09T12:00:00Z");
  const monthSeptFromApr = calculateMissionMonth("April 2026", 24, phtSept9);
  assert(monthSeptFromApr === 5, "April 2026 missionary in September 2026 is at Month 5");

  const monthSeptFromSep = calculateMissionMonth("September 2026", 24, phtSept9);
  assert(monthSeptFromSep === 0, "Missionary in arrival month (September 2026) has mission month 0");

  const septDispatchDate = getFirstDispatchDate("September 2026", phtSept9);
  assert(septDispatchDate === "2026-10", "First dispatch date for September cohort is 2026-10 (no day preset)");

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

  // Verify that an April missionary due in September with next_send_date = '2026-09' can be dispatched on the 6th
  const mAprilDueSept = {
    email: "elder.april@test.org",
    name: "Elder April",
    cohort: "elder",
    batch_month: "April 2026",
    months_sent: 4,
    max_months: 24,
    status: "active",
    next_send_date: "2026-09"
  };
  const phtSept6 = new Date("2026-09-06T08:00:00Z");
  const eligibleSept6 = isMissionaryEligibleForDispatch(mAprilDueSept, phtSept6, "2026-09-06");
  assert(eligibleSept6 === true, "Missionary with next_send_date '2026-09' is eligible on September 6 (no day preset)");

  // Legacy format with day '2026-09-09' also does not block dispatch on September 6
  const mAprilLegacyDate = { ...mAprilDueSept, next_send_date: "2026-09-09" };
  const eligibleLegacySept6 = isMissionaryEligibleForDispatch(mAprilLegacyDate, phtSept6, "2026-09-06");
  assert(eligibleLegacySept6 === true, "Missionary with legacy next_send_date '2026-09-09' is eligible on September 6 (no day block)");

  // ----------------------------------------------------
  // Test 1b: Calendar-Synchronized Drip & Missed Month Skip
  // ----------------------------------------------------
  // April 2026 elder who sent July (3 sent), missed August, evaluated in September 2026
  const aprilMissedAug = getUpcomingDripInfo("April 2026", 3, 24, phtSept9);
  assert(aprilMissedAug.monthNum === 9, "Upcoming drip month for missionary who missed August is September (Month 9)");
  assert(aprilMissedAug.tenureMonth === 5, "Upcoming drip tenure milestone is M5 (September = Month 5 from April)");
  assert(aprilMissedAug.displayLabel === "September 2026 (M5)", "Upcoming drip display label is 'September 2026 (M5)'");

  // After September is sent (5 sent), upcoming advances to October (M6)
  const aprilAfterSept = getUpcomingDripInfo("April 2026", 5, 24, phtSept9);
  assert(aprilAfterSept.monthNum === 10, "After September dispatch, next drip is October (Month 10)");
  assert(aprilAfterSept.tenureMonth === 6, "After September dispatch, next milestone is M6");
  assert(aprilAfterSept.displayLabel === "October 2026 (M6)", "Display label after September dispatch is 'October 2026 (M6)'");

  // Brand new September 2026 cohort missionary in September 2026 (Month 0)
  const sepArrival = getUpcomingDripInfo("September 2026", 0, 24, phtSept9);
  assert(sepArrival.monthNum === 10, "Arrival month missionary's upcoming drip is October (Month 10)");
  assert(sepArrival.tenureMonth === 1, "Arrival month missionary's first drip tenure milestone is M1");
  assert(sepArrival.displayLabel === "October 2026 (M1)", "Arrival month missionary upcoming display label is 'October 2026 (M1)'");

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

  // ----------------------------------------------------
  // Test 6: Essentials & Grid "Apply to All" and Cloudflare R2 CDN Acceleration
  // ----------------------------------------------------
  console.log("\n🖼️ [Test 6] Essentials & Grid All-Months Application and Cloudflare R2 CDN Acceleration");
  
  const applyEgRes = await handleDripAction("apply_essentials_grid_all_months", {}, {
    ess1_name: "Test Wooden Nametag",
    ess1_img: "https://example.com/nametag.jpg",
    ess2_name: "Test POS Kit",
    ess2_img: "https://example.com/pos.jpg",
    grid1: "https://example.com/g1.jpg",
    grid2: "https://example.com/g2.jpg",
    grid3: "https://example.com/g3.jpg",
    grid4: "https://example.com/g4.jpg",
    grid5: "https://example.com/g5.jpg",
    grid6: "https://example.com/g6.jpg",
    grid7: "https://example.com/g7.jpg",
    grid8: "https://example.com/g8.jpg",
    grid9: "https://example.com/g9.jpg"
  });
  assert(applyEgRes?.status === 200 && applyEgRes?.json?.ok === true, "apply_essentials_grid_all_months responds with ok: true");

  const dripsListRes = await handleDripAction("get_drips", {}, {});
  assert(dripsListRes?.status === 200 && Array.isArray(dripsListRes?.json?.drips), "get_drips returns drip messages array");
  const dripM1 = dripsListRes?.json?.drips.find(d => Number(d.month) === 1);
  const dripM12 = dripsListRes?.json?.drips.find(d => Number(d.month) === 12);
  assert(dripM1 && dripM1.ess1_name === "Test Wooden Nametag" && dripM1.grid1 === "https://example.com/g1.jpg", "Month 1 received applied essentials & grid");
  assert(dripM12 && dripM12.ess1_name === "Test Wooden Nametag" && dripM12.grid9 === "https://example.com/g9.jpg", "Month 12 received applied essentials & grid");

  await handleCdnAction("save_cdn_config", {}, {
    cdn_r2_worker_url: "https://tcrp.2ndsalviejomark2019.workers.dev"
  });
  const cdnCfgRes = await handleCdnAction("get_cdn_config", {}, {});
  assert(cdnCfgRes?.json?.config?.cdn_r2_worker_url === "https://tcrp.2ndsalviejomark2019.workers.dev", "CDN config correctly saves and reads cdn_r2_worker_url");

  const addDirectRes = await handleCdnAction("add_direct_image", {}, {
    url: "https://cdn.jsdelivr.net/gh/AllensCreations/Gallery@main/assets/rewards/sample.webp",
    filename: "sample.webp"
  });
  assert(addDirectRes?.status === 200 && addDirectRes?.json?.ok === true, "add_direct_image succeeds");
  assert(addDirectRes?.json?.direct_url.startsWith("https://tcrp.2ndsalviejomark2019.workers.dev/"), "Direct jsDelivr URL is accelerated with Cloudflare R2 worker prefix");
  assert(addDirectRes?.json?.direct_url.includes("origin="), "Cloudflare R2 accelerated URL includes origin parameter");

  console.log(`\n========================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
