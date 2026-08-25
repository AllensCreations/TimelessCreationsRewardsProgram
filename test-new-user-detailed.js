import 'dotenv/config';
import { runSql } from './lib/db.js';
import { renderMonthlyDripTemplate } from './lib/mailer.js';
import { checkDashboardRateLimit } from './lib/bot.js';

async function runDetailedLoggerTest() {
  console.log("🔍 [DIAGNOSTIC LOGGER] Starting Detailed New User Verification...\n");
  let passed = 0;
  let failed = 0;

  function logStep(stepNum, title) {
    console.log(`\n--------------------------------------------------`);
    console.log(`[STEP ${stepNum}] ${title}`);
    console.log(`--------------------------------------------------`);
  }

  function assert(condition, message, debugPayload = null) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      if (debugPayload !== null) {
        console.error(`     🐛 Debug Payload:`, JSON.stringify(debugPayload, null, 2));
      }
      failed++;
    }
  }

  const testEmail = `detailed.test.${Date.now().toString().slice(-4)}@missionary.org`;
  const testPsid = `PSID_LOG_${Date.now().toString().slice(-4)}`;
  const testReferralCode = 'TC' + Math.random().toString(36).substring(2, 7).toUpperCase();

  try {
    // -------------------------------------------------------------------------
    logStep(1, "Missionary Database Insertion & Schema Default Verification");
    // -------------------------------------------------------------------------
    console.log(`Executing SQL Insert for: ${testEmail} with code ${testReferralCode}`);
    
    await runSql(`
      INSERT INTO missionaries (email, name, last_name, cohort, points, referral_code, psid, status, max_months)
      VALUES (?, ?, ?, 'elder', 0, ?, ?, 'active', 24)
    `, [testEmail, "Elder Detailed", "Testing", testReferralCode, testPsid]);

    let userRows = await runSql("SELECT * FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
    console.log("Fetched Row from Turso:", userRows[0]);

    assert(userRows && userRows.length > 0, "Record found in database", userRows);
    assert(userRows[0]?.points === 0, `Expected points to be 0, got: ${userRows[0]?.points}`, userRows[0]);
    assert(userRows[0]?.referral_code === testReferralCode, `Referral code match check`, { expected: testReferralCode, actual: userRows[0]?.referral_code });

    // -------------------------------------------------------------------------
    logStep(2, "Referral Bonus & Point Increment Telemetry");
    // -------------------------------------------------------------------------
    console.log(`Updating points for referral code: ${testReferralCode}`);
    const updateRes = await runSql("UPDATE missionaries SET points = points + 1 WHERE referral_code = ? COLLATE NOCASE", [testReferralCode]);
    console.log("Update SQL Result Object:", updateRes);

    const updatedUserRows = await runSql("SELECT * FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
    console.log("Fetched User Row After Point Increment:", updatedUserRows[0]);

    assert(updatedUserRows[0]?.points === 1, `Expected points to increment to 1, got: ${updatedUserRows[0]?.points}`, updatedUserRows[0]);

    // -------------------------------------------------------------------------
    logStep(3, "Dashboard Rate Limiter Telemetry");
    // -------------------------------------------------------------------------
    await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [testPsid]);
    
    const r1 = await checkDashboardRateLimit(testPsid);
    console.log("Rate Limit Request 1:", r1);
    const r2 = await checkDashboardRateLimit(testPsid);
    console.log("Rate Limit Request 2:", r2);
    const r3 = await checkDashboardRateLimit(testPsid);
    console.log("Rate Limit Request 3 (Should Block):", r3);

    assert(r1.allowed === true, "1st request allowed", r1);
    assert(r2.allowed === true, "2nd request allowed", r2);
    assert(r3.allowed === false, "3rd request blocked by rate limiter", r3);

    // -------------------------------------------------------------------------
    logStep(4, "Month 1 Drip Template Rendering & Point Binding Telemetry");
    // -------------------------------------------------------------------------
    const currentPoints = updatedUserRows[0]?.points || 1;
    console.log(`Rendering Month 1 Drip Template with points value: ${currentPoints}`);

    const renderedDrip = renderMonthlyDripTemplate({
      month: 1,
      name: "Elder Detailed",
      theme: "Elder Jeffrey R. Holland",
      scripture: "Trust in the Lord with all thine heart.",
      message: "Welcome to your first month of service!",
      points: currentPoints
    }, [
      { name: "Temple Keychain", price: 6, image_url: "https://i.postimg.cc/test.png" }
    ]);

    // Log a snippet of the rendered output around the points section
    console.log("Rendered Drip HTML Snippet (Points/Rewards section):");
    const pointsSnippetIndex = renderedDrip.indexOf("Your TCRP Reward Balance");
    console.log(renderedDrip.slice(pointsSnippetIndex, pointsSnippetIndex + 400));

    assert(renderedDrip.includes("Elder Detailed"), "Template binds missionary name", { name: "Elder Detailed" });
    assert(renderedDrip.includes(`${currentPoints} Point`), `Template reflects points value (${currentPoints} Point)`, { renderedDripSample: renderedDrip.slice(pointsSnippetIndex, pointsSnippetIndex + 200) });

    // -------------------------------------------------------------------------
    logStep(5, "Database Cleanup");
    // -------------------------------------------------------------------------
    await runSql("DELETE FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
    await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [testPsid]);
    console.log("🧹 Test records successfully purged.");

  } catch (err) {
    console.error(`\n💥 Fatal Diagnostic Error:`, err);
    failed++;
  }

  console.log(`\n================================`);
  console.log(`Detailed Logger Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runDetailedLoggerTest();
