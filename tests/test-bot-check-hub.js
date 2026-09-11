#!/usr/bin/env node

import 'dotenv/config';
import { handleBotMessage, toUnicodeBold } from '../lib/botHandler.js';
import { runSql } from '../lib/db.js';
import { clearDebounce } from '../lib/security.js';

console.log("🤖 ==================================================");
console.log("🤖 TIMELESS CREATIONS REWARDS PROGRAM - BOT HUB & CHECK TESTER");
console.log("🤖 ==================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${label} ${detail ? '-> ' + detail : ''}`);
    failed++;
  }
}

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

async function runCheckHubTester() {
  const verifiedPsid = 'TEST_VERIFIED_HUB_' + Date.now();
  const verifiedEmail = `elder.hub${Date.now()}@missionary.org`;
  const unverifiedPsid = 'TEST_UNVERIFIED_HUB_' + Date.now();

  try {
    // ----------------------------------------------------
    // SETUP: Register verified test missionary
    // ----------------------------------------------------
    clearDebounce(verifiedPsid);
    clearDebounce(unverifiedPsid);

    await runSql(
      "INSERT INTO missionaries (email, name, cohort, batch_month, points, referral_code, psid, status, max_months) VALUES (?, ?, ?, ?, 1, ?, ?, 'active', 24)",
      [verifiedEmail, 'Elder Test Runner', 'elder', 'September 2026', 'HUB123', verifiedPsid]
    );

    // ----------------------------------------------------
    // TEST 1: Verified missionary sends "Check" (payload: ACTION_CHECK)
    // ----------------------------------------------------
    console.log("📌 [Test 1] Verified user clicks 'Check' quick reply");
    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);
    await handleBotMessage(verifiedPsid, 'Check', 'ACTION_CHECK');

    let botMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC", [verifiedPsid]);
    assert(botMsgs.length === 3, `Received exact 3-in-1 sequence (got ${botMsgs.length} messages)`);

    const hasDashboard = botMsgs[0]?.message.includes(toUnicodeBold("MISSIONARY DASHBOARD"));
    const hasPoints = botMsgs[0]?.message.includes("Reward Point");
    assert(hasDashboard && hasPoints, "Message 1 is Missionary Dashboard with live points balance");

    const hasCarousel = botMsgs[1]?.message.includes("[Carousel / Template]");
    assert(hasCarousel, "Message 2 is Product Catalog visual Carousel");

    const hasInvite = botMsgs[2]?.message.includes(toUnicodeBold("Invite a Companion & Earn +1 Point"));
    assert(hasInvite, "Message 3 is Companion Invite promo with referral link");

    const zeroEmojis1 = botMsgs.every(m => !EMOJI_REGEX.test(m.message));
    assert(zeroEmojis1, "All 3 messages strictly enforce 0 emojis");

    // ----------------------------------------------------
    // TEST 2: Verified missionary types random chat ("hello bot")
    // ----------------------------------------------------
    console.log("\n📌 [Test 2] Verified user sends random chat text");
    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);
    await handleBotMessage(verifiedPsid, 'hello bot');

    botMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC", [verifiedPsid]);
    assert(botMsgs.length === 3, `Random chat triggers full 3-in-1 sequence (got ${botMsgs.length} messages)`);
    assert(botMsgs[0]?.message.includes(toUnicodeBold("MISSIONARY DASHBOARD")), "Random chat includes Dashboard");
    assert(botMsgs[1]?.message.includes("[Carousel / Template]"), "Random chat includes Carousel");
    assert(botMsgs[2]?.message.includes(toUnicodeBold("Invite a Companion")), "Random chat includes Invite link");

    // ----------------------------------------------------
    // TEST 3: Empty Catalog Graceful Fallback
    // ----------------------------------------------------
    console.log("\n📌 [Test 3] Empty Catalog Graceful Fallback (0 rewards)");
    const backupProducts = await runSql("SELECT * FROM product_catalog");
    await runSql("DELETE FROM product_catalog");
    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);

    await handleBotMessage(verifiedPsid, 'Check', 'ACTION_CHECK');
    botMsgs = await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id ASC", [verifiedPsid]);

    assert(botMsgs.length === 3, `Empty catalog delivers 3 messages without crash (got ${botMsgs.length})`);
    assert(botMsgs[0]?.message.includes(toUnicodeBold("MISSIONARY DASHBOARD")), "Message 1 remains Dashboard");
    assert(
      botMsgs[1]?.message.includes("There are currently no reward items available in the catalog."),
      "Message 2 is clean polite notice when catalog is empty"
    );
    assert(!botMsgs[1]?.message.includes("[Carousel / Template]"), "No broken carousel template sent when empty");
    assert(botMsgs[2]?.message.includes(toUnicodeBold("Invite a Companion")), "Message 3 remains Invite link");

    // Restore products
    for (const p of backupProducts) {
      await runSql("INSERT INTO product_catalog (id, name, price, type, image_url) VALUES (?, ?, ?, ?, ?)", [p.id, p.name, p.price, p.type, p.image_url]);
    }

    // ----------------------------------------------------
    // TEST 4: Persistent Menu Actions (MENU_HELP & PROMO_INFO)
    // ----------------------------------------------------
    console.log("\n📌 [Test 4] Persistent Menu Actions (MENU_HELP & PROMO_INFO)");
    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);
    await handleBotMessage(verifiedPsid, 'Help', 'MENU_HELP');
    let helpMsg = (await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [verifiedPsid]))[0];
    assert(helpMsg?.message.includes(toUnicodeBold("HELP & FREQUENTLY ASKED QUESTIONS")), "MENU_HELP returns FAQs");
    assert(!EMOJI_REGEX.test(helpMsg?.message), "FAQs has 0 emojis");

    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);
    await handleBotMessage(verifiedPsid, 'Promo Info', 'PROMO_INFO');
    let promoMsg = (await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [verifiedPsid]))[0];
    assert(promoMsg?.message.includes(toUnicodeBold("Redeem Promo Code")), "PROMO_INFO returns promo instructions");
    assert(!EMOJI_REGEX.test(promoMsg?.message), "PROMO_INFO has 0 emojis");

    // ----------------------------------------------------
    // TEST 5: Carousel Item Postbacks (Claim & Goal)
    // ----------------------------------------------------
    console.log("\n📌 [Test 5] Carousel Item Postbacks (Claim & Goal)");
    // Affordable item: ID 1 (cost 1, balance 1)
    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);
    await handleBotMessage(verifiedPsid, 'Claim Item 1', 'CLAIM_ITEM_1');
    let claimMsg = (await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [verifiedPsid]))[0];
    assert(claimMsg?.message.includes(toUnicodeBold("CONGRATULATIONS")), "CLAIM_ITEM executes and returns congratulations");
    assert(!EMOJI_REGEX.test(claimMsg?.message), "Claim confirmation has 0 emojis");

    // Goal item: ID 2 (cost 2, balance now 0)
    clearDebounce(verifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [verifiedPsid]);
    await handleBotMessage(verifiedPsid, 'Goal Item 2', 'GOAL_ITEM_2');
    let goalMsg = (await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [verifiedPsid]))[0];
    assert(goalMsg?.message.includes("PTS") && goalMsg?.message.includes("Goal:"), "GOAL_ITEM returns goal diff");
    assert(!EMOJI_REGEX.test(goalMsg?.message), "Goal details has 0 emojis");

    // ----------------------------------------------------
    // TEST 6: Unverified Gatekeeper Protection
    // ----------------------------------------------------
    console.log("\n📌 [Test 6] Unverified Gatekeeper Protection");
    clearDebounce(unverifiedPsid);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [unverifiedPsid]);
    await handleBotMessage(unverifiedPsid, 'Check', 'ACTION_CHECK');
    let gateMsg = (await runSql("SELECT message FROM chat_messages WHERE psid = ? AND sender = 'bot' ORDER BY id DESC LIMIT 1", [unverifiedPsid]))[0];
    assert(gateMsg?.message.includes(toUnicodeBold("TCRP Verification Required")), "Unverified user blocked by Gatekeeper");
    assert(!gateMsg?.message.includes(toUnicodeBold("MISSIONARY DASHBOARD")), "Unverified user cannot view Dashboard");

  } catch (err) {
    console.error(`\n💥 Fatal Test Error: ${err.message}`);
    failed++;
  } finally {
    // Cleanup
    clearDebounce(verifiedPsid);
    clearDebounce(unverifiedPsid);
    await runSql("DELETE FROM missionaries WHERE psid IN (?, ?)", [verifiedPsid, unverifiedPsid]);
    await runSql("DELETE FROM sessions WHERE psid IN (?, ?)", [verifiedPsid, unverifiedPsid]);
    await runSql("DELETE FROM chat_messages WHERE psid IN (?, ?)", [verifiedPsid, unverifiedPsid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid IN (?, ?)", [verifiedPsid, unverifiedPsid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid IN (?, ?)", [verifiedPsid, unverifiedPsid]);
    await runSql("DELETE FROM bot_daily_views WHERE sender_id IN (?, ?)", [verifiedPsid, unverifiedPsid]);
  }

  console.log("\n==================================================");
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) process.exit(1);
}

runCheckHubTester();
