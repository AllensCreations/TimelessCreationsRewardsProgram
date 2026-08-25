import 'dotenv/config';
import { runSql } from './lib/db.js';
import { renderMonthlyDripTemplate } from './lib/mailer.js';
import { checkDashboardRateLimit } from './lib/bot.js';

async function runNewUserTest() {
  console.log("👤 Running New User Onboarding & Integration Tester...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const testEmail = `test.elder.${Date.now().toString().slice(-4)}@missionary.org`;
  const testPsid = `PSID_TEST_${Date.now().toString().slice(-4)}`;
  const testReferralCode = 'TC' + Math.random().toString(36).substring(2, 7).toUpperCase();

  try {
    // 1. Simulate New User Registration (Database Insertion)
    console.log("📝 1. Simulating New Missionary Registration");
    await runSql(`
      INSERT INTO missionaries (email, name, last_name, cohort, points, referral_code, psid, status, max_months)
      VALUES (?, ?, ?, 'elder', 1, ?, ?, 'active', 24)
    `, [testEmail, "Elder Testing", "Testing", testReferralCode, testPsid]);

    const userRows = await runSql("SELECT * FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
    assert(userRows && userRows.length > 0, "New missionary successfully saved to Turso database");
    assert(userRows[0].points === 1, "New user starts with 1 Welcome Point");
    assert(userRows[0].referral_code === testReferralCode, "Unique referral code successfully generated & bound");

    // 2. Simulate Referral Usage (Friend Joining via Link)
    console.log("\n🤝 2. Simulating Companion Referral Code Usage");
    const friendEmail = `test.sister.${Date.now().toString().slice(-4)}@missionary.org`;
    const friendPsid = `PSID_FRIEND_${Date.now().toString().slice(-4)}`;
    
    // Credit inviter
    await runSql(
      "UPDATE missionaries SET points = points + 1 WHERE referral_code = ? COLLATE NOCASE",
      [testReferralCode]
    );

    // Register friend
    const friendRefCode = 'TC' + Math.random().toString(36).substring(2, 7).toUpperCase();
    await runSql(`
      INSERT INTO missionaries (email, name, last_name, cohort, points, referral_code, psid, status, max_months)
      VALUES (?, ?, ?, 'sister', 1, ?, ?, 'active', 18)
    `, [friendEmail, "Sister Friend", "Friend", friendRefCode, friendPsid]);

    const updatedInviter = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]))[0];
    assert(updatedInviter.points === 2, "Inviter points correctly incremented via 1:1 referral rule (+1 Pt)");

    // 3. Test New User Dashboard Rate Limiter
    console.log("\n🛡️ 3. Testing New User Dashboard Rate Limiter");
    await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [testPsid]);

    const check1 = await checkDashboardRateLimit(testPsid);
    const check2 = await checkDashboardRateLimit(testPsid);
    const check3 = await checkDashboardRateLimit(testPsid);

    assert(check1.allowed === true, "New user 1st dashboard request allowed");
    assert(check2.allowed === true, "New user 2nd dashboard request allowed");
    assert(check3.allowed === false, "New user 3rd dashboard request blocked (Daily Limit = 2)");

    // 4. Test Initial Drip Generation for New User
    console.log("\n✉️ 4. Testing Month 1 Drip Generation");
    const renderedWelcomeDrip = renderMonthlyDripTemplate({
      month: 1,
      name: "Elder Testing",
      theme: "Elder Jeffrey R. Holland",
      scripture: "Trust in the Lord with all thine heart.",
      message: "Welcome to your first month of service!",
      points: updatedInviter.points
    }, [
      { name: "Temple Keychain", price: 6, image_url: "https://i.postimg.cc/test.png" }
    ]);

    assert(renderedWelcomeDrip.includes("Elder Testing"), "New user drip renders custom name");
    assert(renderedWelcomeDrip.includes("2 Points"), "New user drip reflects updated points balance");

    // Clean up test records
    await runSql("DELETE FROM missionaries WHERE LOWER(email) IN (LOWER(?), LOWER(?))", [testEmail, friendEmail]);
    await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [testPsid]);
    console.log("\n🧹 Cleaned up test records successfully.");

  } catch (err) {
    console.error(`\n💥 New User Test Error: ${err.message}`);
    failed++;
  }

  console.log(`\n================================`);
  console.log(`New User Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runNewUserTest();
