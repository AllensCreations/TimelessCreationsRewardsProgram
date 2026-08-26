import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

async function runFullBotTester() {
  console.log("🤖 ==================================================");
  console.log("🤖 STARTING MESSENGER BOT TEST SUITE (3-IN-1 ONBOARDING)");
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
  const testEmail = `elder.tester${Date.now().toString().slice(-4)}@missionary.org`;

  try {
    // TEST 1: Initial Touch -> Welcome & Terms
    console.log("📝 [Test 1] Initial Touch (AWAITING_TERMS)");
    await runSql("DELETE FROM sessions WHERE psid = ?", [testPsid]);
    await runSql("DELETE FROM missionaries WHERE psid = ?", [testPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [testPsid]);

    await handleBotMessage(testPsid, "Get Started", "GET_STARTED");
    let session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_TERMS', "Shows Welcome & Privacy/Terms");

    // TEST 2: Terms Agreed -> Advances to 3-in-1 Step
    console.log("\n📜 [Test 2] Agree to Terms");
    await handleBotMessage(testPsid, "I agree", "TERMS_AGREE");
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_ALL_IN_ONE', "Advanced to 3-in-1 submission (AWAITING_ALL_IN_ONE)");

    // TEST 3: Combined 3-in-1 Submission
    console.log("\n✉️ [Test 3] Combined Submission (Name + Email + RefCode)");
    await handleBotMessage(testPsid, `Elder Smith\n${testEmail}\nTCRP50`);
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [testPsid]))[0];
    assert(session && session.state === 'AWAITING_OTP', "Parsed 3-in-1 payload, generated OTP, advanced to AWAITING_OTP");
    assert(session.temp_email === testEmail, "Email captured accurately");
    assert(session.invite_code === "TCRP50", "Referral code captured accurately");

    // TEST 4: OTP Verification
    console.log("\n🔐 [Test 4] OTP Verification");
    const validOtp = session.otp_code;
    await handleBotMessage(testPsid, validOtp);

    const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [testPsid]))[0];
    assert(missionary !== undefined && missionary.email === testEmail, "Missionary account verified and linked");
    assert(Number(missionary.points) === 1, "+1 Welcome Point granted");

    // TEST 5: FAQs with dynamic catalog integration
    console.log("\n📖 [Test 5] Dynamic FAQs Inspection");
    await handleBotMessage(testPsid, "FAQs");
    const msgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [testPsid]);
    assert(msgs?.[0]?.message.includes("𝗙𝗥𝗘𝗤𝗨𝗘𝗡𝗧𝗟𝗬 𝗔𝗦𝗞𝗘𝗗 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡𝗦") && msgs?.[0]?.message.includes("Points"), "FAQs rendered with live product catalog points");

  } catch (err) {
    console.error(`\n💥 Fatal Test Error: ${err.message}`);
    failed++;
  }

  // Cleanup
  try {
    await runSql("DELETE FROM missionaries WHERE email = ?", [testEmail]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [testPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [testPsid]);
  } catch (_) {}

  console.log(`\n==================================================`);
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runFullBotTester();
