import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

async function testHourlyLimiterAndReferralNotice() {
  console.log("⏱️ Testing Verified Hourly Dashboard Limiter & Passive Referral Notices...\n");

  const inviterPsid = "TEST_INVITER_" + Date.now().toString().slice(-4);
  const inviterEmail = `elder.inviter${Date.now().toString().slice(-4)}@missionary.org`;
  const joinerPsid = "TEST_JOINER_" + Date.now().toString().slice(-4);
  const joinerEmail = `elder.joiner${Date.now().toString().slice(-4)}@missionary.org`;

  // 1. Onboard inviter
  await handleBotMessage(inviterPsid, "Get Started", "GET_STARTED");
  await handleBotMessage(inviterPsid, "I agree", "TERMS_AGREE");
  await handleBotMessage(inviterPsid, `Elder Inviter\n${inviterEmail}\nTCRP50`);
  let session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [inviterPsid]))[0];
  await handleBotMessage(inviterPsid, session.otp_code);

  const inviter = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [inviterPsid]))[0];
  console.log(`  ✓ Inviter verified with code: ${inviter.referral_code}`);

  // 2. Onboard joiner using inviter's referral code
  await handleBotMessage(joinerPsid, "Get Started", "GET_STARTED");
  await handleBotMessage(joinerPsid, "I agree", "TERMS_AGREE");
  await handleBotMessage(joinerPsid, `Elder Joiner\n${joinerEmail}\n${inviter.referral_code}`);
  session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [joinerPsid]))[0];
  await handleBotMessage(joinerPsid, session.otp_code);

  const updatedInviter = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [inviterPsid]))[0];
  console.log(`  ✓ Joiner verified. Inviter points: ${updatedInviter.points} PT (Pending notices: ${updatedInviter.pending_ref_notices})`);

  // 3. Inviter chats again -> receives in-chat notification passively without spam
  await handleBotMessage(inviterPsid, "Dashboard");
  
  const recentMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 6", [inviterPsid]);
  console.log("  🔍 [DEBUG] Recent bot messages for inviter:", recentMsgs.map(m => m.message));

  const hasNotice = recentMsgs.some(m => m.message.includes("companion") || m.message.includes("𝗚𝗥𝗘𝗔𝗧 𝗡𝗘𝗪𝗦") || m.message.includes("joined using"));
  console.log(`  ✓ Passive In-Chat referral alert detected: ${hasNotice}`);

  // 4. Test Hourly rate limit (requests 2, 3, then 4)
  await handleBotMessage(inviterPsid, "Dashboard"); // 2nd view
  await handleBotMessage(inviterPsid, "Dashboard"); // 3rd view
  await handleBotMessage(inviterPsid, "Dashboard"); // 4th view (Over limit)

  const lastBotMsg = (await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [inviterPsid]))[0];
  console.log("  🔍 [DEBUG] Last bot message (rate limit check):", lastBotMsg?.message);

  const isCapped = lastBotMsg?.message.includes("𝗛𝗢𝗨𝗥𝗟𝗬 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗") && lastBotMsg?.message.includes("Philippine Time");

  if (isCapped && hasNotice) {
    console.log("  ✅ [PASS] Hourly limiter successfully paused 4th request & referral alert verified!");
  } else {
    console.error("  ❌ [FAIL] Check hourly check or notice logic.");
    process.exit(1);
  }

  // Cleanup
  await runSql("DELETE FROM missionaries WHERE email IN (?, ?)", [inviterEmail, joinerEmail]);
  await runSql("DELETE FROM bot_hourly_views WHERE psid IN (?, ?)", [inviterPsid, joinerPsid]);
  await runSql("DELETE FROM sessions WHERE psid IN (?, ?)", [inviterPsid, joinerPsid]);
  await runSql("DELETE FROM chat_messages WHERE psid IN (?, ?)", [inviterPsid, joinerPsid]);

  console.log("\n✨ All tests completed successfully.");
}

testHourlyLimiterAndReferralNotice();
