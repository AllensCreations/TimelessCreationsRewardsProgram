import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { handleBotMessage } from '../lib/botHandler.js';
import { 
  checkBurstRateLimit, 
  checkDailyMessageQuota, 
  isDoubleTapDuplicate, 
  clearDebounce, 
  checkOtpResendEligibility, 
  recordOtpResend,
  getTodayDateStr
} from '../lib/security.js';

async function runAntiSpamTests() {
  console.log("🛡️ ==================================================");
  console.log("🛡️ RUNNING BOT ANTI-SPAM & QUOTAS INTEGRATION SUITE");
  console.log("🛡️ ==================================================\n");

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

  const testPsid = `SPAM_TEST_${Date.now()}`;
  const testEmail = `spam.tester.${Date.now()}@missionary.org`;
  const todayStr = getTodayDateStr();

  try {
    // ----------------------------------------------------
    // TEST 1: Double-Tap Debouncing
    // ----------------------------------------------------
    console.log("1️⃣ Testing Double-Tap Debounce...");
    clearDebounce(testPsid);
    const tap1 = isDoubleTapDuplicate(testPsid, "GET_STARTED");
    assert(tap1 === false, "First tap is allowed");
    const tap2 = isDoubleTapDuplicate(testPsid, "GET_STARTED");
    assert(tap2 === true, "Immediate duplicate tap (<3000ms) is detected and dropped");
    const tap3 = isDoubleTapDuplicate(testPsid, "GET_STARTED");
    assert(tap3 === false, "Third continuous tap passes through to burst rate limiter");

    clearDebounce(testPsid);
    const tapAfterClear = isDoubleTapDuplicate(testPsid, "GET_STARTED");
    assert(tapAfterClear === false, "Debounce map clears cleanly on reset/clearDebounce");

    // ----------------------------------------------------
    // TEST 2: Burst Rate Limiter (Warn-Once + Silent Drop)
    // ----------------------------------------------------
    console.log("\n2️⃣ Testing Burst Rate Limiter (5 msgs / 60s)...");
    const burstPsid = `BURST_PSID_${Date.now()}`;
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [burstPsid]);

    for (let i = 1; i <= 4; i++) {
      const res = await checkBurstRateLimit(burstPsid, 5, 60);
      assert(!res.limited, `Burst message ${i}/5 allowed`);
    }

    // 5th message (reaches limit)
    const res5 = await checkBurstRateLimit(burstPsid, 5, 60);
    assert(!res5.limited, "Burst message 5/5 allowed (reaches limit threshold)");

    // 6th message (exceeds limit -> Warn Once)
    const res6 = await checkBurstRateLimit(burstPsid, 5, 60);
    assert(res6.limited === true && res6.silentDrop === false, "Burst message 6 triggers rate limit with initial warning (silentDrop=false)");

    // 7th message (exceeds limit -> Silent Drop)
    const res7 = await checkBurstRateLimit(burstPsid, 5, 60);
    assert(res7.limited === true && res7.silentDrop === true, "Burst message 7 activates silent drop (silentDrop=true, 0 outbound messages)");

    // ----------------------------------------------------
    // TEST 3: Daily Message Quota (10 Unverified / 15 Verified)
    // ----------------------------------------------------
    console.log("\n3️⃣ Testing Daily Message Quota Tiering & Warn-Once...");
    const quotaPsid = `QUOTA_PSID_${Date.now()}`;
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [quotaPsid]);

    // Unverified user: quota limit = 10
    for (let i = 1; i <= 9; i++) {
      const qCheck = await checkDailyMessageQuota(quotaPsid, false);
      assert(qCheck.allowed, `Unverified user message ${i}/10 allowed`);
    }
    const qCheck10 = await checkDailyMessageQuota(quotaPsid, false);
    assert(qCheck10.allowed && qCheck10.current === 10, "Unverified user message 10/10 allowed (quota exhausted)");

    // 11th message: warn once
    const qCheck11 = await checkDailyMessageQuota(quotaPsid, false);
    assert(qCheck11.allowed === false && qCheck11.silentDrop === false, "Message 11 triggers quota notice (silentDrop=false)");

    // 12th message: silent drop
    const qCheck12 = await checkDailyMessageQuota(quotaPsid, false);
    assert(qCheck12.allowed === false && qCheck12.silentDrop === true, "Message 12 is silently dropped (silentDrop=true)");

    // Verified user: quota limit = 15
    const verifiedPsid = `VERIFIED_PSID_${Date.now()}`;
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [verifiedPsid]);
    for (let i = 1; i <= 15; i++) {
      await checkDailyMessageQuota(verifiedPsid, true);
    }
    const vCheck16 = await checkDailyMessageQuota(verifiedPsid, true);
    assert(vCheck16.allowed === false && vCheck16.limit === 15, "Verified missionary receives 15-message daily quota before limit notice");

    // ----------------------------------------------------
    // TEST 4: OTP Anti-Abuse (60s Cooldown & 3 Daily Resends)
    // ----------------------------------------------------
    console.log("\n4️⃣ Testing OTP Anti-Abuse (Cooldown & Resend Limits)...");
    const otpPsid = `OTP_TEST_${Date.now()}`;
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [otpPsid]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [otpPsid]);

    const sessionObj = { psid: otpPsid, last_otp_at: 0 };
    const el1 = await checkOtpResendEligibility(otpPsid, sessionObj);
    assert(el1.allowed === true, "Initial OTP generation is allowed");

    // Record 1st OTP
    await recordOtpResend(otpPsid);
    const nowSec = Math.floor(Date.now() / 1000);
    sessionObj.last_otp_at = nowSec;

    // Immediate resend attempt (within 60s cooldown)
    const elCooldown = await checkOtpResendEligibility(otpPsid, sessionObj);
    assert(elCooldown.allowed === false && elCooldown.reason === 'COOLDOWN', "Rapid OTP resend is rejected by 60s cooldown");
    assert(elCooldown.remainingSeconds > 0, `Cooldown displays remaining seconds (${elCooldown.remainingSeconds}s)`);

    // Simulate cooldown expiration
    sessionObj.last_otp_at = nowSec - 65;
    const el2 = await checkOtpResendEligibility(otpPsid, sessionObj);
    assert(el2.allowed === true, "OTP resend is allowed after cooldown expires");

    // Record 2nd and 3rd OTPs
    await recordOtpResend(otpPsid);
    await recordOtpResend(otpPsid);

    // 4th OTP attempt (exceeds 3/day)
    const elMax = await checkOtpResendEligibility(otpPsid, sessionObj);
    assert(elMax.allowed === false && elMax.reason === 'MAX_RESENDS_REACHED', "4th OTP attempt rejected by daily max resends limit (3/day)");

    // ----------------------------------------------------
    // TEST 5: Failed OTP Attempt Lockout (5 Attempts)
    // ----------------------------------------------------
    console.log("\n5️⃣ Testing Failed OTP Attempt Lockout...");
    const lockoutPsid = `LOCKOUT_PSID_${Date.now()}`;
    await runSql("DELETE FROM sessions WHERE psid = ?", [lockoutPsid]);
    clearDebounce(lockoutPsid);

    // Setup session in AWAITING_OTP
    await runSql(`
      INSERT INTO sessions (psid, state, temp_title, temp_email, temp_batch, invite_code, otp_code, last_otp_at, failed_otp_count)
      VALUES (?, 'AWAITING_OTP', 'Elder Lockout', 'lockout@missionary.org', 'August 2026', 'TCRP50', '888888', ?, 0)
    `, [lockoutPsid, Math.floor(Date.now() / 1000) - 100]);

    // Send 4 wrong attempts
    for (let attempt = 1; attempt <= 4; attempt++) {
      clearDebounce(lockoutPsid);
      await handleBotMessage(lockoutPsid, `00000${attempt}`);
      const s = (await runSql("SELECT failed_otp_count, state FROM sessions WHERE psid = ?", [lockoutPsid]))[0];
      assert(s && Number(s.failed_otp_count) === attempt && s.state === 'AWAITING_OTP', `Wrong OTP attempt ${attempt} increments failed_otp_count to ${attempt}`);
    }

    // 5th wrong attempt triggers lockout and resets to START
    clearDebounce(lockoutPsid);
    await handleBotMessage(lockoutPsid, "000005");
    const lockedSession = (await runSql("SELECT failed_otp_count, state FROM sessions WHERE psid = ?", [lockoutPsid]))[0];
    assert(lockedSession && lockedSession.state === 'START' && Number(lockedSession.failed_otp_count) === 0, "5th failed attempt triggers session lockout and reset to START");

    // Cleanup
    await runSql("DELETE FROM sessions WHERE psid = ?", [lockoutPsid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [burstPsid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [quotaPsid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [verifiedPsid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [otpPsid]);
    clearDebounce();

  } catch (err) {
    console.error(`💥 Fatal error: ${err.message}`, err.stack);
    failed++;
  }

  console.log(`\n==================================================`);
  console.log(`📊 ANTI-SPAM TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runAntiSpamTests();
