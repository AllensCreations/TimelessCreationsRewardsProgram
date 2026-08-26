import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

async function testHourlyLimiter() {
  console.log("⏱️ Testing Verified Hourly Dashboard Limiter (Philippine Time)...\n");

  const testPsid = "TEST_HOURLY_" + Date.now().toString().slice(-4);
  const testEmail = `elder.limit${Date.now().toString().slice(-4)}@missionary.org`;

  // 1. Onboard user to verified status
  await handleBotMessage(testPsid, "Get Started", "GET_STARTED");
  await handleBotMessage(testPsid, "I agree", "TERMS_AGREE");
  await handleBotMessage(testPsid, `Elder Limit\n${testEmail}\nTCRP50`);
  const session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [testPsid]))[0];
  await handleBotMessage(testPsid, session.otp_code);

  console.log("  ✓ Account verified successfully.");

  // 2. Request dashboard up to the 3-per-hour limit
  console.log("  → Requesting Dashboard View 2/3...");
  await handleBotMessage(testPsid, "Dashboard");

  console.log("  → Requesting Dashboard View 3/3...");
  await handleBotMessage(testPsid, "Dashboard");

  // 3. 4th View should trigger the hourly cooldown notification
  console.log("  → Requesting Dashboard View 4/3 (Over limit)...");
  await handleBotMessage(testPsid, "Dashboard");

  const recentMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [testPsid]);
  const isCapped = recentMsgs?.[0]?.message.includes("𝗛𝗢𝗨𝗥𝗟𝗬 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗") && recentMsgs?.[0]?.message.includes("Philippine Time");

  if (isCapped) {
    console.log("  ✅ [PASS] Hourly rate limiter successfully paused 4th request and reported Philippine Time cooldown.");
  } else {
    console.error("  ❌ [FAIL] Rate limiter did not block excessive view.");
    process.exit(1);
  }

  // Cleanup
  await runSql("DELETE FROM missionaries WHERE email = ?", [testEmail]);
  await runSql("DELETE FROM bot_hourly_views WHERE psid = ?", [testPsid]);
  await runSql("DELETE FROM sessions WHERE psid = ?", [testPsid]);
  await runSql("DELETE FROM chat_messages WHERE psid = ?", [testPsid]);

  console.log("\n✨ Hourly Rate Limiter test finished successfully.");
}

testHourlyLimiter();
