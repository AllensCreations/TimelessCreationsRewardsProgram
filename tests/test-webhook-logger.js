import 'dotenv/config';
import crypto from 'crypto';
import { runSql } from '../lib/db.js';
import webhookHandler from '../api/webhook.js';
import { verifyFbSignature, clearRapidDebounce, hasUsedDailyCheck } from '../lib/security.js';
import { handleBotMessage } from '../lib/botHandler.js';

async function runWebhookLoggerTests() {
  console.log("🤖 ==================================================");
  console.log("🤖 RUNNING WEBHOOK & TELEMETRY LOGGER TEST SUITE");
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

  // Mock response object
  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      send(data) { this.body = data; return this; },
      end(data) { this.body = data; return this; }
    };
  }

  try {
    // 1. Webhook GET Verification
    console.log("📡 [Test 1] Webhook GET Hub Verification");
    const reqGetSuccess = {
      method: 'GET',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': process.env.VERIFY_TOKEN || 'tcrp_token',
        'hub.challenge': 'CHALLENGE_ACCEPTED_12345'
      }
    };
    const resGetSuccess = createMockRes();
    await webhookHandler(reqGetSuccess, resGetSuccess);
    assert(resGetSuccess.statusCode === 200 && resGetSuccess.body === 'CHALLENGE_ACCEPTED_12345', "GET verify succeeds with correct token");

    const reqGetFail = {
      method: 'GET',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'CHALLENGE_123'
      }
    };
    const resGetFail = createMockRes();
    await webhookHandler(reqGetFail, resGetFail);
    assert(resGetFail.statusCode === 403, "GET verify rejected with 403 on wrong token");

    // 2. Webhook Signature Verification
    console.log("\n🔐 [Test 2] Facebook Signature Verification with HMAC SHA-256");
    const secret = "test_app_secret_998877";
    process.env.FB_APP_SECRET = secret;
    const testPayload = JSON.stringify({ object: "page", entry: [] });
    const hmac = crypto.createHmac('sha256', secret).update(testPayload).digest('hex');

    const validReq = {
      headers: { 'x-hub-signature-256': `sha256=${hmac}` },
      rawBody: testPayload
    };
    assert(verifyFbSignature(validReq, testPayload) === true, "verifyFbSignature passes with correct signature");

    const invalidReq = {
      headers: { 'x-hub-signature-256': `sha256=invalid_hash_value` },
      rawBody: testPayload
    };
    assert(verifyFbSignature(invalidReq, testPayload) === false, "verifyFbSignature fails with incorrect signature");

    // FB_IGNORE_SIGNATURE bypass verification
    process.env.FB_IGNORE_SIGNATURE = 'true';
    const bypassRes = createMockRes();
    const bypassReq = {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=bad_sig' },
      body: { object: 'page', entry: [] }
    };
    await webhookHandler(bypassReq, bypassRes);
    assert(bypassRes.statusCode === 200, "Webhook permits dispatch when FB_IGNORE_SIGNATURE=true even with bad signature");
    delete process.env.FB_IGNORE_SIGNATURE;

    // 3. Webhook POST Inbound Logging
    console.log("\n📥 [Test 3] Webhook POST Inbound Logging to system_logs");
    delete process.env.FB_APP_SECRET; // Clear secret for test dispatch
    const testPsid = "TEST_WEBHOOK_" + Date.now().toString().slice(-4);
    const postReq = {
      method: 'POST',
      body: {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: testPsid },
            message: { text: "Hello TCRP" }
          }]
        }]
      }
    };
    const postRes = createMockRes();
    await webhookHandler(postReq, postRes);
    assert(postRes.statusCode === 200 && postRes.body === 'EVENT_RECEIVED', "Webhook POST responds with 200 EVENT_RECEIVED");

    const recentLogs = await runSql("SELECT message FROM system_logs WHERE message LIKE ? ORDER BY id DESC LIMIT 50", [`%${testPsid}%`]);
    const foundInbound = recentLogs && recentLogs.some(l => l.message && l.message.includes(testPsid) && l.message.includes("WEBHOOK_INBOUND"));
    assert(foundInbound, "Webhook inbound event logged into system_logs table");

    // 4. Recovery: Missionary details re-submission during AWAITING_OTP
    console.log("\n🔄 [Test 4] Seamless details re-submission while in AWAITING_OTP state");
    const recoveryPsid = "TEST_RECOVERY_" + Date.now().toString().slice(-4);
    const email1 = `elder.one${Date.now().toString().slice(-4)}@missionary.org`;
    const email2 = `elder.two${Date.now().toString().slice(-4)}@missionary.org`;

    await runSql("DELETE FROM sessions WHERE psid = ?", [recoveryPsid]);
    await handleBotMessage(recoveryPsid, "Get Started", "GET_STARTED");
    await handleBotMessage(recoveryPsid, `Elder One\n${email1}\nDecember 2026\nTCRP50`);

    let sessionState = (await runSql("SELECT state, temp_email, otp_code FROM sessions WHERE psid = ?", [recoveryPsid]))[0];
    assert(sessionState && sessionState.state === 'AWAITING_OTP' && sessionState.temp_email === email1, "Initial details entered AWAITING_OTP");

    // User re-submits details with different missionary info instead of OTP
    await handleBotMessage(recoveryPsid, `Elder Two\n${email2}\nDecember 2026\nTCRP50`);
    let updatedSession = (await runSql("SELECT state, temp_email, temp_title, failed_otp_count FROM sessions WHERE psid = ?", [recoveryPsid]))[0];
    assert(updatedSession && updatedSession.state === 'AWAITING_OTP', "Remains in AWAITING_OTP state");
    assert(updatedSession.temp_email === email2, "Updated email captured accurately");
    assert(updatedSession.temp_title === "Elder Two", "Updated title/name captured accurately");
    assert(Number(updatedSession.failed_otp_count) === 0, "Failed OTP count reset to 0 instead of penalizing missionary");

    // 5. Month Batch onboarding parser verification
    console.log("\n📅 [Test 5] Month Batch registration prompt and parsing");
    const batchPsid = "TEST_BATCH_" + Date.now().toString().slice(-4);
    const batchEmail = `sister.batch${Date.now().toString().slice(-4)}@missionary.org`;

    await runSql("DELETE FROM sessions WHERE psid = ?", [batchPsid]);
    await handleBotMessage(batchPsid, "Get Started", "GET_STARTED");

    const startMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [batchPsid]);
    assert(startMsgs?.[0]?.message.includes("Month Batch (e.g. December 2026)"), "Registration prompt includes Month Batch prompt");

    await handleBotMessage(batchPsid, `Sister Emma Davis\n${batchEmail}\nDecember 2026\nTCRP50`);
    let batchSession = (await runSql("SELECT state, temp_email, temp_title, temp_batch, invite_code FROM sessions WHERE psid = ?", [batchPsid]))[0];
    assert(batchSession && batchSession.state === 'AWAITING_OTP', "Batch details advanced to AWAITING_OTP");
    assert(batchSession.temp_email === batchEmail, "Batch registration captured email");
    assert(batchSession.temp_title === "Sister Emma Davis", "Batch registration captured title/name");
    assert(batchSession.temp_batch === "December 2026", "Batch registration captured 'December 2026' batch month accurately");
    assert(batchSession.invite_code === "TCRP50", "Batch registration captured referral code");

    // 6. Referral code notification & Pending notices delivery on 'check'
    console.log("\n🎉 [Test 6] Referral code alert delivery upon sending 'check'");
    const referrerPsid = "TEST_REFERRER_" + Date.now().toString().slice(-4);
    const referrerEmail = `elder.referrer${Date.now().toString().slice(-4)}@missionary.org`;
    const refCodeA = "REF" + Date.now().toString().slice(-4);

    await runSql("DELETE FROM missionaries WHERE email IN (?, ?)", [referrerEmail, batchEmail]);
    await runSql("DELETE FROM bot_daily_views WHERE sender_id IN (?, ?)", [referrerPsid, batchPsid]);
    await runSql(
      "INSERT INTO missionaries (email, name, cohort, batch_month, points, referral_code, psid, status, max_months) VALUES (?, ?, ?, ?, 1, ?, ?, 'active', 24)",
      [referrerEmail, 'Elder Referrer', 'elder', 'September 2026', refCodeA, referrerPsid]
    );

    // Complete verification for batchPsid using refCodeA
    await runSql("UPDATE sessions SET invite_code = ? WHERE psid = ?", [refCodeA, batchPsid]);
    const otpToVerify = batchSession.otp_code;
    await handleBotMessage(batchPsid, otpToVerify);

    // Verify referrer received point and pending referral notice
    const referrerM = (await runSql("SELECT points, pending_ref_notices FROM missionaries WHERE psid = ?", [referrerPsid]))[0];
    assert(Number(referrerM?.points) === 2, "Referrer points incremented to 2");
    assert(Number(referrerM?.pending_ref_notices) === 1, "Referrer pending_ref_notices incremented to 1");

    // Referrer sends 'Check'
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [referrerPsid]);
    await handleBotMessage(referrerPsid, "Check", "ACTION_CHECK");

    const refCheckMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC", [referrerPsid]);
    assert(refCheckMsgs.length === 3, `Referrer received full hub (3 messages, got ${refCheckMsgs.length})`);
    assert(refCheckMsgs[0]?.message.includes("Someone used your referral code (+1 Point added to your balance)!"), "Dashboard displays 'Someone used your referral code (+1 Point added to your balance)!' notification");

    // Verify pending_ref_notices reset to 0
    const referrerM2 = (await runSql("SELECT pending_ref_notices FROM missionaries WHERE psid = ?", [referrerPsid]))[0];
    assert(Number(referrerM2?.pending_ref_notices) === 0, "pending_ref_notices reset to 0 after notification displayed");

    // 7. 1-Check-per-day rate limit enforcement (Warning on 2nd, silent drop on 3rd+ until 8:00 AM PHT)
    console.log("\n⏱️ [Test 7] 1-Check-per-day rate limit enforcement (Warning on 2nd, silent drop on 3rd+ until 8:00 AM PHT)");
    const checkUsedAfterFirst = await hasUsedDailyCheck(referrerPsid);
    assert(checkUsedAfterFirst === true, "Daily check usage is flagged as active for today");

    clearRapidDebounce(referrerPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [referrerPsid]);
    await handleBotMessage(referrerPsid, "Check", "ACTION_CHECK");

    const secondCheckMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC", [referrerPsid]);
    assert(secondCheckMsgs.length === 1, `Second check produces 1 warning notice (got ${secondCheckMsgs.length})`);
    assert(secondCheckMsgs[0].message.includes("8:00 AM PHT"), "Warning notice mentions 8:00 AM PHT reset");

    const warnedLog = await runSql("SELECT message FROM system_logs WHERE psid = ? AND message LIKE '%CHECK_LIMIT_WARNED%' ORDER BY id DESC LIMIT 1", [referrerPsid]);
    assert(warnedLog.length > 0, "Warning logged in system_logs with [CHECK_LIMIT_WARNED]");

    clearRapidDebounce(referrerPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [referrerPsid]);
    await handleBotMessage(referrerPsid, "Check", "ACTION_CHECK");

    const thirdCheckMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC", [referrerPsid]);
    assert(thirdCheckMsgs.length === 0, "Third check produces 0 messages (silent drop until 8:00 AM PHT)");

    const silentLog = await runSql("SELECT message FROM system_logs WHERE psid = ? AND message LIKE '%CHECK_LIMIT_SILENT%' ORDER BY id DESC LIMIT 1", [referrerPsid]);
    assert(silentLog.length > 0, "Silent drop logged in system_logs with [CHECK_LIMIT_SILENT]");

    // Cleanup
    await runSql("DELETE FROM missionaries WHERE psid IN (?, ?)", [batchPsid, referrerPsid]);
    await runSql("DELETE FROM sessions WHERE psid IN (?, ?, ?)", [testPsid, recoveryPsid, batchPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid IN (?, ?, ?, ?)", [testPsid, recoveryPsid, batchPsid, referrerPsid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid IN (?, ?, ?, ?)", [testPsid, recoveryPsid, batchPsid, referrerPsid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid IN (?, ?, ?, ?)", [testPsid, recoveryPsid, batchPsid, referrerPsid]);
    await runSql("DELETE FROM bot_daily_views WHERE sender_id IN (?, ?)", [batchPsid, referrerPsid]);

  } catch (err) {
    console.error(`💥 Fatal error: ${err.message}`);
    failed++;
  }

  console.log(`\n==================================================`);
  console.log(`📊 WEBHOOK & TELEMETRY RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runWebhookLoggerTests();
