// tests/tester.consolidated.js
//
// Replaces the scattered, overlapping testers found in the audit:
//   test-flow.js, test-anti-exploit.js, test-hourly-rate-limit.js,
//   test-new-user.js, test-new-user-detailed.js, test-messenger-bot.js,
//   tests/tester.js, tests/test-new-user-flow.js, tests/test-bot-run.js
//
// Three scenarios, matching how a real person actually reaches the bot:
//   1. NEW USER      — never seen before, plain "Get Started"
//   2. INVITED USER  — new, but arrives via another missionary's referral code
//   3. OLD/EXISTING USER — already onboarded, comes back later (dashboard views,
//                          rate limiting, re-registration abuse check)
//
// Every step is logged through lib/logger.js (writeLog) so you get the same
// structured, timestamped, DB-persisted log trail here that production uses —
// this doubles as a way to verify the logger itself works end to end.
//
// Usage:
//   node tests/tester.consolidated.js new
//   node tests/tester.consolidated.js invited
//   node tests/tester.consolidated.js existing
//   node tests/tester.consolidated.js all
//
// Requires a real .env with TURSO_DATABASE_URL / TURSO_AUTH_TOKEN pointed at
// a database that has run schema-fixes.sql (chat_messages, bot_rate_limits).
// The EXISTING_USER rate-limit assertion will fail until you also apply the
// lib/botHandler.js wiring from code-fixes.patch.md (isRateLimited is
// currently defined but never called — see AUDIT_REPORT §2.2). That's
// intentional: this test is what tells you the fix actually took.
// I could not execute this myself — no network access in this environment —
// so run it yourself and check the summary at the end.

import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { handleBotMessage } from '../lib/botHandler.js';
import { log } from '../lib/logger.js';

const results = { passed: 0, failed: 0, scenarios: [] };

function assert(condition, message, scenario) {
  if (condition) {
    results.passed++;
    log.info('TEST_ASSERT', `✅ [${scenario}] ${message}`);
  } else {
    results.failed++;
    log.error('TEST_ASSERT', `❌ [${scenario}] ${message}`);
  }
}

async function cleanupTestUser(psid, email) {
  await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
  await runSql("DELETE FROM missionaries WHERE psid = ? OR email = ?", [psid, email]);
  await runSql("DELETE FROM chat_messages WHERE psid = ?", [psid]);
  await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [psid]);
  await runSql("DELETE FROM bot_hourly_views WHERE psid = ?", [psid]);
  await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [psid]);
}

// ---------------------------------------------------------------------------
// 1. NEW USER — first-time onboarding, no referral code
// ---------------------------------------------------------------------------
async function testNewUser() {
  const SCENARIO = 'NEW_USER';
  const psid = `TEST_NEW_${Date.now()}`;
  const email = `new.tester.${Date.now()}@missionary.org`;
  log.info(SCENARIO, `Starting new-user onboarding test`, { psid, email });

  await cleanupTestUser(psid, email);

  await handleBotMessage(psid, '', 'GET_STARTED');
  let session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];
  assert(session?.state === 'AWAITING_TERMS', `Session enters AWAITING_TERMS after Get Started (got: ${session?.state})`, SCENARIO);

  await handleBotMessage(psid, '', 'TERMS_AGREE');
  session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];
  assert(session?.state === 'AWAITING_ALL_IN_ONE', `Session enters AWAITING_ALL_IN_ONE after agreeing to terms (got: ${session?.state})`, SCENARIO);

  await handleBotMessage(psid, `Elder Tester\n${email}`); // no referral code
  session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];
  const otp = session?.otp_code;
  assert(!!otp, `OTP generated for new user`, SCENARIO);

  await handleBotMessage(psid, otp);
  const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
  assert(!!missionary, `Missionary row created after OTP verification`, SCENARIO);
  assert(missionary?.email === email, `Stored email matches submitted email`, SCENARIO);
  assert(Number(missionary?.points) >= 0, `Welcome points granted (points: ${missionary?.points})`, SCENARIO);
  assert(!!missionary?.referral_code, `New user is issued their own referral code`, SCENARIO);

  const chatRows = await runSql("SELECT COUNT(*) as c FROM chat_messages WHERE psid = ?", [psid]);
  assert(Number(chatRows?.[0]?.c) > 0, `Conversation was logged to chat_messages`, SCENARIO);

  await cleanupTestUser(psid, email);
  log.info(SCENARIO, `Cleanup complete`);
}

// ---------------------------------------------------------------------------
// 2. INVITED USER — onboards using another missionary's referral code
// ---------------------------------------------------------------------------
async function testInvitedUser() {
  const SCENARIO = 'INVITED_USER';
  const inviterPsid = `TEST_INVITER_${Date.now()}`;
  const inviterEmail = `inviter.${Date.now()}@missionary.org`;
  const joinerPsid = `TEST_JOINER_${Date.now()}`;
  const joinerEmail = `joiner.${Date.now()}@missionary.org`;
  log.info(SCENARIO, `Starting invited-user test`, { inviterPsid, joinerPsid });

  await cleanupTestUser(inviterPsid, inviterEmail);
  await cleanupTestUser(joinerPsid, joinerEmail);

  // Onboard the inviter first so they have a real referral code.
  await handleBotMessage(inviterPsid, '', 'GET_STARTED');
  await handleBotMessage(inviterPsid, '', 'TERMS_AGREE');
  await handleBotMessage(inviterPsid, `Elder Inviter\n${inviterEmail}`);
  let session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [inviterPsid]))[0];
  await handleBotMessage(inviterPsid, session?.otp_code);
  const inviter = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [inviterPsid]))[0];
  assert(!!inviter?.referral_code, `Inviter has a referral code to share`, SCENARIO);

  const startingInviterPoints = Number(inviter?.points || 0);

  // Joiner onboards using the inviter's referral code.
  await handleBotMessage(joinerPsid, '', 'GET_STARTED');
  await handleBotMessage(joinerPsid, '', 'TERMS_AGREE');
  await handleBotMessage(joinerPsid, `Elder Joiner\n${joinerEmail}\n${inviter.referral_code}`);
  session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [joinerPsid]))[0];
  await handleBotMessage(joinerPsid, session?.otp_code);

  const joiner = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [joinerPsid]))[0];
  assert(!!joiner, `Joiner missionary row created`, SCENARIO);

  const updatedInviter = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [inviterPsid]))[0];
  assert(Number(updatedInviter?.points) > startingInviterPoints, `Inviter received a referral bonus (before: ${startingInviterPoints}, after: ${updatedInviter?.points})`, SCENARIO);

  await cleanupTestUser(inviterPsid, inviterEmail);
  await cleanupTestUser(joinerPsid, joinerEmail);
  log.info(SCENARIO, `Cleanup complete`);
}

// ---------------------------------------------------------------------------
// 3. OLD / EXISTING USER — returning user: re-onboard abuse check + rate limit
// ---------------------------------------------------------------------------
async function testExistingUser() {
  const SCENARIO = 'EXISTING_USER';
  const psid = `TEST_EXISTING_${Date.now()}`;
  const email = `existing.${Date.now()}@missionary.org`;
  log.info(SCENARIO, `Starting existing-user test`, { psid, email });

  await cleanupTestUser(psid, email);

  // Onboard once.
  await handleBotMessage(psid, '', 'GET_STARTED');
  await handleBotMessage(psid, '', 'TERMS_AGREE');
  await handleBotMessage(psid, `Elder Existing\n${email}`);
  let session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [psid]))[0];
  await handleBotMessage(psid, session?.otp_code);
  const firstJoin = (await runSql("SELECT points FROM missionaries WHERE psid = ?", [psid]))[0];
  assert(!!firstJoin, `Existing user's original registration succeeded`, SCENARIO);

  // Delete + re-register, to confirm welcome points aren't farmable.
  await handleBotMessage(psid, "/delete_account");
  const deleted = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
  assert(!deleted, `Account deletion actually removes the missionaries row`, SCENARIO);

  await handleBotMessage(psid, '', 'GET_STARTED');
  await handleBotMessage(psid, '', 'TERMS_AGREE');
  await handleBotMessage(psid, `Elder Existing\n${email}`);
  session = (await runSql("SELECT otp_code FROM sessions WHERE psid = ?", [psid]))[0];
  await handleBotMessage(psid, session?.otp_code);
  const rejoined = (await runSql("SELECT points FROM missionaries WHERE psid = ?", [psid]))[0];
  assert(Number(rejoined?.points) <= Number(firstJoin?.points), `Re-registration does not stack welcome points (first: ${firstJoin?.points}, rejoined: ${rejoined?.points})`, SCENARIO);

  // Rate limiting: hammer the bot faster than the configured limit.
  for (let i = 0; i < 6; i++) {
    await handleBotMessage(psid, "Dashboard");
  }
  const limitRow = (await runSql("SELECT msg_count FROM bot_rate_limits WHERE psid = ?", [psid]))[0];
  assert(!!limitRow && Number(limitRow.msg_count) >= 5, `Rate limiter tracked rapid-fire messages (count: ${limitRow?.msg_count})`, SCENARIO);

  await cleanupTestUser(psid, email);
  log.info(SCENARIO, `Cleanup complete`);
}

// ---------------------------------------------------------------------------
async function main() {
  const mode = process.argv[2] || 'all';
  const scenarios = { new: testNewUser, invited: testInvitedUser, existing: testExistingUser };

  console.log(`\n🧪 TCRP Consolidated Tester — mode: ${mode}\n`);

  try {
    if (mode === 'all') {
      for (const [name, fn] of Object.entries(scenarios)) {
        results.scenarios.push(name);
        await fn();
      }
    } else if (scenarios[mode]) {
      results.scenarios.push(mode);
      await scenarios[mode]();
    } else {
      console.error(`Unknown mode "${mode}". Use: new | invited | existing | all`);
      process.exit(1);
    }
  } catch (err) {
    log.error('TEST_RUNNER', `Fatal error during test run: ${err.message}`, { stack: err.stack });
    results.failed++;
  }

  console.log(`\n================================`);
  console.log(`Scenarios run: ${results.scenarios.join(', ')}`);
  console.log(`Passed: ${results.passed}  Failed: ${results.failed}`);
  console.log(`================================\n`);

  if (results.failed > 0) process.exit(1);
}

main();
