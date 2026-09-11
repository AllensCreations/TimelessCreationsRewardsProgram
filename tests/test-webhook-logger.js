import 'dotenv/config';
import crypto from 'crypto';
import { runSql } from '../lib/db.js';
import webhookHandler from '../api/webhook.js';
import { verifyFbSignature } from '../lib/security.js';
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
    await handleBotMessage(recoveryPsid, `Elder One\n${email1}\nTCRP50`);

    let sessionState = (await runSql("SELECT state, temp_email, otp_code FROM sessions WHERE psid = ?", [recoveryPsid]))[0];
    assert(sessionState && sessionState.state === 'AWAITING_OTP' && sessionState.temp_email === email1, "Initial details entered AWAITING_OTP");

    // User re-submits details with different missionary info instead of OTP
    await handleBotMessage(recoveryPsid, `Elder Two\n${email2}\nTCRP50`);
    let updatedSession = (await runSql("SELECT state, temp_email, temp_title, failed_otp_count FROM sessions WHERE psid = ?", [recoveryPsid]))[0];
    assert(updatedSession && updatedSession.state === 'AWAITING_OTP', "Remains in AWAITING_OTP state");
    assert(updatedSession.temp_email === email2, "Updated email captured accurately");
    assert(updatedSession.temp_title === "Elder Two", "Updated title/name captured accurately");
    assert(Number(updatedSession.failed_otp_count) === 0, "Failed OTP count reset to 0 instead of penalizing missionary");

    // Cleanup
    await runSql("DELETE FROM sessions WHERE psid IN (?, ?)", [testPsid, recoveryPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid IN (?, ?)", [testPsid, recoveryPsid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid IN (?, ?)", [testPsid, recoveryPsid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid IN (?, ?)", [testPsid, recoveryPsid]);

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
