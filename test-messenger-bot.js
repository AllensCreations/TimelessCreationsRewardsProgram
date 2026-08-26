import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

async function runFullBotTester() {
  console.log("🤖 ==================================================");
  console.log("🤖 STARTING COMPREHENSIVE MESSENGER BOT TEST SUITE");
  console.log("🤖 ==================================================\n");

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

  const testPsid = "TEST_PHONE_PSID_" + Date.now().toString().slice(-4);

  try {
    // ----------------------------------------------------
    // TEST 1: New User First Touch / "Get Started"
    // ----------------------------------------------------
    console.log("📝 [Test 1] New User Onboarding Trigger (START State)");
    await runSql("DELETE FROM sessions WHERE psid = ?", [testPsid]);
    await runSql("DELETE FROM missionaries WHERE psid = ?", [testPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [testPsid]);

    await handleBotMessage(testPsid, "Get Started", "GET_STARTED");
    let session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_REFERRAL', "New user prompted for referral code (AWAITING_REFERRAL)");

    // ----------------------------------------------------
    // TEST 2: Referral Code Validation (Global Code TCRP50)
    // ----------------------------------------------------
    console.log("\n🎟️ [Test 2] Referral Code Input");
    await handleBotMessage(testPsid, "TCRP50");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_TERMS', "Referral code TCRP50 accepted, advanced to AWAITING_TERMS");

    // ----------------------------------------------------
    // TEST 3: Terms & Conditions Agreement
    // ----------------------------------------------------
    console.log("\n📜 [Test 3] Terms & Privacy Agreement");
    await handleBotMessage(testPsid, "I agree", "TERMS_AGREE");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_NAME_EMAIL', "Terms agreed, advanced to AWAITING_NAME_EMAIL");

    // ----------------------------------------------------
    // TEST 4: Invalid Email Rejection vs Valid @missionary.org
    // ----------------------------------------------------
    console.log("\n✉️ [Test 4] Email Validation (@missionary.org check)");
    await handleBotMessage(testPsid, "Elder Invalid\nwrong.email@gmail.com");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_NAME_EMAIL', "Non-missionary email correctly rejected; state remains AWAITING_NAME_EMAIL");

    // Now send valid missionary email
    await handleBotMessage(testPsid, "Elder Smith\nelder.smith@missionary.org");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_OTP', "Valid missionary email parsed, OTP generated, advanced to AWAITING_OTP");
    assert(session.otp_code && session.otp_code.length === 6, "6-digit OTP code generated successfully");

    // ----------------------------------------------------
    // TEST 5: OTP Passcode Verification & Point Grant
    // ----------------------------------------------------
    console.log("\n🔐 [Test 5] OTP Passcode Verification");
    const validOtp = session.otp_code;
    await handleBotMessage(testPsid, validOtp);

    const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [testPsid]))[0];
    session = (await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [testPsid]))[0];

    assert(missionary !== undefined && missionary.email === "elder.smith@missionary.org", "Missionary created & linked to phone PSID");
    assert(Number(missionary.points) === 1, "Missionary correctly granted +1 Welcome Point");
    assert(!session || session.state === undefined, "Onboarding session wiped clean after verification");

    // ----------------------------------------------------
    // TEST 6: Returning Verified User (Dashboard Access)
    // ----------------------------------------------------
    console.log("\n📊 [Test 6] Returning Verified User (Dashboard Flow)");
    await handleBotMessage(testPsid, "Hello");

    const recentMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 3", [testPsid]);
    const receivedDashboard = (recentMsgs || []).some(m => m.message.includes("MISSIONARY DASHBOARD") && m.message.includes("Elder Smith"));
    assert(receivedDashboard, "Returning verified user successfully receives their Dashboard instantly (bypasses onboarding)");

    // ----------------------------------------------------
    // TEST 7: Reset Command Test
    // ----------------------------------------------------
    console.log("\n🔄 [Test 7] RESET Command");
    await handleBotMessage(testPsid, "RESET");

    const resetMissionary = (await runSql("SELECT psid FROM missionaries WHERE email = 'elder.smith@missionary.org' LIMIT 1", [testPsid]))[0];
    assert(resetMissionary?.psid === null || resetMissionary === undefined, "RESET command successfully unlinked PSID from account");

  } catch (err) {
    console.error(`\n💥 Fatal Test Suite Error: ${err.message}`);
    failed++;
  }

  // Cleanup test data
  try {
    await runSql("DELETE FROM missionaries WHERE email = 'elder.smith@missionary.org'");
    await runSql("DELETE FROM sessions WHERE psid = ?", [testPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [testPsid]);
  } catch (_) {}

  console.log(`\n==================================================`);
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runFullBotTester();
