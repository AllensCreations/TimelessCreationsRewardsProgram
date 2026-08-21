import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

const TEST_PSID = `TEST_USER_${Date.now()}`;
const TEST_EMAIL = `test.elder.${Date.now()}@missionary.org`;
const TEST_NAME = "Elder Tester Auto";

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING TCRP COMPREHENSIVE SYSTEM TEST SUITE");
  console.log("=======================================================\n");

  // TEST SUITE 1: ENVIRONMENT VARIABLES
  console.log("📌 TEST SUITE 1: Environment Variables");
  assert(Boolean(process.env.TURSO_DATABASE_URL), "TURSO_DATABASE_URL is defined");
  assert(Boolean(process.env.TURSO_AUTH_TOKEN), "TURSO_AUTH_TOKEN is defined");
  assert(Boolean(process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN), "PAGE_ACCESS_TOKEN is defined");
  assert(Boolean(process.env.VERIFY_TOKEN), "VERIFY_TOKEN is defined");
  assert(Boolean(process.env.BREVO_API_KEY), "BREVO_API_KEY is defined");

  // TEST SUITE 2: DATABASE CONNECTIVITY & SCHEMAS
  console.log("\n📌 TEST SUITE 2: Database Connectivity & Tables Check");
  try {
    const tables = ['missionaries', 'drip_messages', 'orders', 'product_catalog', 'sessions', 'global_referral_pool', 'bot_rate_limits'];
    for (const tbl of tables) {
      const res = await runSql(`SELECT count(*) as count FROM ${tbl}`);
      assert(res && res.length > 0, `Table '${tbl}' exists and queryable (${res[0].count} records)`);
    }
  } catch (err) {
    assert(false, `Database query failed: ${err.message}`);
  }

  // TEST SUITE 3: BOT ONBOARDING & VALIDATION FLOW
  console.log("\n📌 TEST SUITE 3: Messenger Bot Onboarding Simulation");
  try {
    // 3.1 Start
    await handleBotMessage(TEST_PSID, "Get Started");
    let session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    assert(session && session.state === 'AWAITING_REFERRAL', "Bot transitions to 'AWAITING_REFERRAL' on Get Started");

    // 3.2 Referral Code Submission (Global TCRP50)
    await handleBotMessage(TEST_PSID, "TCRP50");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    assert(session && session.state === 'AWAITING_TERMS' && session.invite_code === 'TCRP50', "Global Referral code TCRP50 accepted");

    // 3.3 Terms Agreement
    await handleBotMessage(TEST_PSID, null, "TERMS_AGREE");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    assert(session && session.state === 'AWAITING_NAME_EMAIL', "Bot moves to 'AWAITING_NAME_EMAIL' after agreement");

    // 3.4 Email & Name Input
    await handleBotMessage(TEST_PSID, `${TEST_NAME}\n${TEST_EMAIL}`);
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    assert(session && session.state === 'AWAITING_OTP' && session.otp_code && session.temp_email === TEST_EMAIL, "Valid @missionary.org accepted & OTP generated");

    // 3.5 OTP Verification
    const otp = session.otp_code;
    await handleBotMessage(TEST_PSID, otp);

    const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [TEST_PSID]))[0];
    assert(Boolean(missionary), "Missionary account verified and created in database");
    assert(missionary && missionary.points === 1, "New missionary rewarded with 1 starting welcome point");
    assert(missionary && /^[A-Z0-9]{6}$/.test(missionary.referral_code), `Referral code format matches X#X#X# (${missionary?.referral_code})`);

    const cleanedSession = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    assert(!cleanedSession, "Temporary registration session cleaned up after verification");
  } catch (err) {
    assert(false, `Bot onboarding simulation failed: ${err.message}`);
  }

  // TEST SUITE 4: ANTI-EXPLOIT TESTS
  console.log("\n📌 TEST SUITE 4: Security & Anti-Exploit Guards");
  try {
    const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [TEST_PSID]))[0];
    
    // Test 4.1 Self-Referral Prevention
    if (missionary) {
      const attackerPsid = `ATTACKER_${Date.now()}`;
      await runSql("INSERT INTO sessions (psid, state) VALUES (?, 'AWAITING_REFERRAL')", [TEST_PSID]);
      await handleBotMessage(TEST_PSID, missionary.referral_code); // User tries to use own code
      const sessionAfterSelfRef = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
      assert(sessionAfterSelfRef?.state === 'AWAITING_REFERRAL', "Self-referral attempt strictly blocked");
      await runSql("DELETE FROM sessions WHERE psid = ?", [TEST_PSID]);
    }

    // Test 4.2 Account Takeover Prevention
    const fakePsid = `HIJACKER_${Date.now()}`;
    await runSql("INSERT INTO sessions (psid, state) VALUES (?, 'AWAITING_NAME_EMAIL')", [fakePsid]);
    await handleBotMessage(fakePsid, `Fake Person\n${TEST_EMAIL}`); // Try re-registering existing verified email
    const fakeSession = (await runSql("SELECT * FROM sessions WHERE psid = ?", [fakePsid]))[0];
    assert(fakeSession?.state === 'AWAITING_NAME_EMAIL', "Account takeover / email re-registration blocked");
    await runSql("DELETE FROM sessions WHERE psid = ?", [fakePsid]);
  } catch (err) {
    assert(false, `Anti-exploit tests encountered error: ${err.message}`);
  }

  // TEST SUITE 5: ANTI-SPAM RATE LIMITING
  console.log("\n📌 TEST SUITE 5: Anti-Spam Rate Limiter");
  try {
    const spamPsid = `SPAMMER_${Date.now()}`;
    for (let i = 0; i < 12; i++) {
      await handleBotMessage(spamPsid, "Spam message test");
    }
    const rateRecord = (await runSql("SELECT msg_count, warned_at FROM bot_rate_limits WHERE psid = ?", [spamPsid]))[0];
    assert(rateRecord && rateRecord.msg_count >= 10, "Spam requests intercepted and tracked in rate limits");
    assert(rateRecord && rateRecord.warned_at > 0, "Rate limit warning dispatched to spamming user");
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [spamPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [spamPsid]);
  } catch (err) {
    assert(false, `Anti-spam test failed: ${err.message}`);
  }

  // TEST SUITE 6: CLEANUP
  console.log("\n📌 TEST SUITE 6: Test Data Cleanup");
  try {
    await runSql("DELETE FROM missionaries WHERE psid = ?", [TEST_PSID]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [TEST_PSID]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [TEST_PSID]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [TEST_PSID]);
    assert(true, "All test artifacts and simulated records purged safely");
  } catch (err) {
    assert(false, `Cleanup error: ${err.message}`);
  }

  // SUMMARY REPORT
  console.log("\n=======================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=======================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL SYSTEMS PASSING! System is 100% operational.\n");
  } else {
    console.log("⚠️ SOME TESTS FAILED. Review logs above to resolve issues.\n");
  }
}

runTestSuite();
