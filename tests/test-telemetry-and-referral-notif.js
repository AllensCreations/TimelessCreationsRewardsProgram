import 'dotenv/config';
import http from 'http';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { handleBotMessage, toUnicodeBold } from '../lib/botHandler.js';
import { runSql } from '../lib/db.js';
import { clearDebounce } from '../lib/security.js';
import { handleEmailAction } from '../lib/handlers/emailHandler.js';
import { handleSystemAction } from '../lib/handlers/systemHandler.js';

console.log("==================================================");
console.log("TEST: Brevo Telemetry Stream & Join Referral Notification");
console.log("==================================================\n");

let passed = 0;

async function runTests() {
  const ts = Date.now();
  const referrerPsid = `TEST_REF_PSID_${ts}`;
  const referrerEmail = `referrer_${ts}@missionary.org`;
  const referrerCode = `CODE${String(ts).slice(-6)}`;

  const companionPsid = `TEST_COMP_PSID_${ts}`;
  const companionEmail = `companion_${ts}@missionary.org`;

  // --------------------------------------------------------------------------
  // 1. Setup: Referrer Missionary with initial points and referral code
  // --------------------------------------------------------------------------
  await runSql(
    `INSERT INTO missionaries (email, name, cohort, batch_month, points, referral_code, psid, status, pending_ref_notices)
     VALUES (?, ?, 'Elder', 'September 2026', 1, ?, ?, 'active', 0)`,
    [referrerEmail, 'Elder Referrer Test', referrerCode, referrerPsid]
  );

  // --------------------------------------------------------------------------
  // 2. Companion joins via referral link: /?ref=REFERRER_CODE
  // --------------------------------------------------------------------------
  clearDebounce(companionPsid);
  // Step 2a: Companion sends initial greeting with referral param from deep link
  await handleBotMessage(companionPsid, 'Hello', '', referrerCode);

  // Step 2b: Companion taps 'Verify & Join (+1)'
  clearDebounce(companionPsid);
  await handleBotMessage(companionPsid, '', 'GET_STARTED');

  // Step 2c: Companion submits details without typing ref code (auto-bind from session.invite_code)
  clearDebounce(companionPsid);
  await handleBotMessage(
    companionPsid,
    `Elder Companion Test\n${companionEmail}\nMarch 2025`
  );

  // Step 2d: Companion confirms OTP
  const companionSession = (await runSql("SELECT * FROM sessions WHERE psid = ?", [companionPsid]))[0];
  assert(companionSession?.otp_code, "OTP code must be generated for companion");
  clearDebounce(companionPsid);
  await handleBotMessage(companionPsid, companionSession.otp_code);

  // Verify Companion registered and Referrer received 1 point + pending notice
  const referrerAfterJoin = await runSql("SELECT points, pending_ref_notices FROM missionaries WHERE psid = ?", [referrerPsid]);
  assert.strictEqual(referrerAfterJoin[0]?.points, 2, "Referrer should have gained +1 point (total 2)");
  assert.strictEqual(referrerAfterJoin[0]?.pending_ref_notices, 1, "Referrer should have 1 pending referral notice");
  console.log("  ✅ [PASS] 1. Referral invite code preserved from link; points & pending_ref_notices credited");
  passed++;

  // --------------------------------------------------------------------------
  // 3. Exhaust Referrer's daily check limit
  // --------------------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  await runSql(
    "INSERT INTO bot_daily_views (sender_id, view_date, view_count, warned) VALUES (?, ?, 1, 1) ON CONFLICT(sender_id, view_date) DO UPDATE SET view_count = 1",
    [referrerPsid, today]
  );
  await runSql(
    "INSERT OR REPLACE INTO bot_rate_limits (psid, identifier, action, window_start, count) VALUES (?, ?, 'daily_view', ?, 1)",
    [referrerPsid, referrerPsid, today]
  );

  // Now Referrer clicks "Check" - despite daily check limit, pending notice must be delivered!
  clearDebounce(referrerPsid);
  await runSql("DELETE FROM chat_messages WHERE psid = ?", [referrerPsid]);
  await handleBotMessage(referrerPsid, 'Check', 'ACTION_CHECK');

  const referrerMsgs = await runSql(
    "SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC",
    [referrerPsid]
  );

  const foundNotif = referrerMsgs.some(m => 
    m.message.includes(toUnicodeBold("REFERRAL REWARD RECEIVED")) || 
    m.message.includes("fellow missionary just joined")
  );
  assert.strictEqual(foundNotif, true, "Referrer must receive prominent celebration notice during Check");

  const foundDashboard = referrerMsgs.some(m => 
    m.message.includes(toUnicodeBold("MISSIONARY DASHBOARD")) ||
    m.message.includes("Reward Point")
  );
  assert.strictEqual(foundDashboard, true, "Referrer must also see their dashboard with updated balance");

  // Verify pending notice was reset to 0 after being displayed
  const referrerAfterCheck = await runSql("SELECT pending_ref_notices FROM missionaries WHERE psid = ?", [referrerPsid]);
  assert.strictEqual(referrerAfterCheck[0]?.pending_ref_notices, 0, "Pending referral notices must be reset to 0 after viewing");
  console.log("  ✅ [PASS] 2. Referral celebration notification delivered during 'Check' (exempt from 1-day check limit)");
  passed++;

  // --------------------------------------------------------------------------
  // 4. Brevo Webhook Ingestion
  // --------------------------------------------------------------------------
  const webhookResult = await handleEmailAction("brevo_webhook", {}, [
    {
      event: "delivered",
      email: companionEmail,
      subject: "Welcome to Timeless Creations",
      "message-id": `<delivery_${ts}@brevo.com>`,
      ip: "127.0.0.1"
    },
    {
      event: "opened",
      email: companionEmail,
      subject: "Welcome to Timeless Creations",
      "message-id": `<open_${ts}@brevo.com>`,
      ip: "127.0.0.1"
    }
  ]);

  assert.strictEqual(webhookResult.status, 200, "Webhook must return 200 OK");
  assert.strictEqual(webhookResult.json.recorded, 2, "Must record 2 email events");

  const recordedEvents = await runSql("SELECT * FROM email_events WHERE email = ?", [companionEmail]);
  assert.strictEqual(recordedEvents.length, 2, "Database must have 2 email_events recorded");
  console.log("  ✅ [PASS] 3. Brevo webhook ingests delivered & opened events into email_events");
  passed++;

  // --------------------------------------------------------------------------
  // 5. System Action: get_email_events & get_stats
  // --------------------------------------------------------------------------
  const emailEventsAction = await handleSystemAction("get_email_events", { query: { limit: 10 } }, {});
  assert.strictEqual(emailEventsAction.status, 200);
  assert(emailEventsAction.json.events.length > 0, "Should return recent email events list");

  const statsAction = await handleSystemAction("get_stats", {}, {});
  assert.strictEqual(statsAction.status, 200);
  assert.strictEqual(typeof statsAction.json.open_rate, 'number', "Stats must return numerical open_rate");
  assert(statsAction.json.email_events.length > 0, "Stats must include email_events");
  console.log(`  ✅ [PASS] 4. get_stats returns open_rate (${statsAction.json.open_rate}%) and recent email events`);
  passed++;

  // --------------------------------------------------------------------------
  // 6. HTTP Endpoint Verification via Localhost Server
  // --------------------------------------------------------------------------
  await new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      event: "opened",
      email: referrerEmail,
      subject: "Monthly Drip #1"
    });

    const req = http.request(
      'http://localhost:3000/api/brevo-webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          assert.strictEqual(res.statusCode, 200, "POST /api/brevo-webhook should return 200");
          const json = JSON.parse(body);
          assert.strictEqual(json.ok, true);
          assert.strictEqual(json.recorded, 1);
          resolve();
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  console.log("  ✅ [PASS] 5. POST /api/brevo-webhook HTTP endpoint processed successfully");
  passed++;

  // --------------------------------------------------------------------------
  // 7. Frontend UI Bento Layout Verification
  // --------------------------------------------------------------------------
  const htmlContent = fs.readFileSync(path.resolve('views/index.html'), 'utf8');
  assert(htmlContent.includes('id="bento-open-rate-badge"'), "views/index.html must include bento-open-rate-badge");
  assert(htmlContent.includes('id="bento-email-events-stream"'), "views/index.html must include bento-email-events-stream");
  assert(htmlContent.includes('function renderBentoEmailStream'), "views/index.html must define renderBentoEmailStream");
  assert(htmlContent.includes('renderBentoEmailStream('), "renderBentoAnalytics must call renderBentoEmailStream");
  console.log("  ✅ [PASS] 6. views/index.html Bento header open-rate badge & telemetry stream verified");
  passed++;

  console.log("\n==================================================");
  console.log(`ALL TESTS PASSED! (${passed}/${passed})`);
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
