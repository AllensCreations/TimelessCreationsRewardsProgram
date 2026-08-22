import 'dotenv/config';
import { runSql } from './lib/db.js';
import { executeBotAction } from './api/bot.js';
import { buildDashboardPayload, buildCatalogCarousel, FIXED_QUICK_REPLIES } from './lib/bot.js';

console.log("\n=======================================================");
console.log("👤 STARTING NEW USER MESSENGER ONBOARDING FLOW TESTER");
console.log("=======================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, label, errDetail = '') {
  if (condition) {
    console.log(`✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${label} ${errDetail ? '-> ' + errDetail : ''}`);
    failed++;
  }
}

async function testNewUserExperience() {
  const fakeToken = "EAA_MOCK_TOKEN_FOR_SIMULATION_ONLY";
  const uniqueTag = Math.random().toString(36).substring(2, 7).toUpperCase();
  const inviterRefCode = `INV${uniqueTag}`;
  const newSenderId = `fb_new_user_${Date.now()}`;

  // STEP 1: Provision Table and Seed Inviting Missionary
  console.log("--- Step 1: Seeding Inviting Missionary in Database ---");
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS missionaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        points INTEGER DEFAULT 0,
        referral_code TEXT UNIQUE,
        fb_sender_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSql(
      "INSERT INTO missionaries (name, email, points, referral_code, is_active) VALUES (?, ?, 3, ?, 1)",
      [`Elder Inviter ${uniqueTag}`, `inviter_${uniqueTag.toLowerCase()}@missionary.org`, inviterRefCode]
    );
    assert(true, "Seeded inviting missionary with initial 3 points");
  } catch (err) {
    assert(false, "Seeding inviter failed", err.message);
  }

  // STEP 2: Simulate New User Clicking Deep-Link
  console.log("\n--- Step 2: Simulating New User Deep-Link Referral Join ---");
  try {
    await executeBotAction(newSenderId, "", "", inviterRefCode, fakeToken);
    
    // Check inviter increment
    const inviterRows = await runSql("SELECT points FROM missionaries WHERE referral_code = ? LIMIT 1", [inviterRefCode]);
    const inviterRecord = inviterRows?.[0];
    assert(Number(inviterRecord?.points) === 4, "Inviter received +1 reward point (3 -> 4 PTS)");

    // Check new user record
    const newUserRows = await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? LIMIT 1", [newSenderId]);
    const newUserRecord = newUserRows?.[0];
    assert(Boolean(newUserRecord), "New missionary profile auto-created from referral link");
    assert(Number(newUserRecord?.points) === 1, "New missionary received +1 welcome reward point");
    assert(Boolean(newUserRecord?.referral_code), `New missionary assigned unique referral code: ${newUserRecord?.referral_code}`);
  } catch (err) {
    assert(false, "Referral join sequence failed", err.message);
  }

  // STEP 3: Verify New User Dashboard Payload Separation
  console.log("\n--- Step 3: Verifying New User Dashboard & Invite Payload ---");
  try {
    const newUserRows = await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? LIMIT 1", [newSenderId]);
    const newUserRecord = newUserRows?.[0];
    const refLink = `https://m.me/TimelessCreationsRP?ref=${newUserRecord?.referral_code}`;
    const payload = buildDashboardPayload(newUserRecord, refLink);

    assert(
      payload.dashboardText.includes("1 Points") && payload.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗"),
      "Message 1: Dashboard reflects exactly 1 welcome point with clean Unicode bolding"
    );
    assert(
      payload.invitePromoText.includes(refLink) && payload.invitePromoText.includes("💌 𝗜𝗻𝘃𝗶𝘁𝗲 𝗮 𝗙𝗿𝗶𝗲𝗻𝗱"),
      "Message 2: Invite payload generates copy-and-send companion template with new user link"
    );
  } catch (err) {
    assert(false, "Dashboard formatting verification failed", err.message);
  }

  // STEP 4: Verify 1:1 Square Reward Carousel for 1 Point Balance
  console.log("\n--- Step 4: Verifying 1:1 Square Catalog Carousel (1 PTS Balance) ---");
  try {
    const sampleCatalog = [
      { id: 201, name: "Engraved Nametag", price: 1, image_url: "https://i.ibb.co/tag.webp" },
      { id: 202, name: "Missionary POS Kit", price: 5, image_url: "https://i.ibb.co/kit.webp" }
    ];

    const carousel = await buildCatalogCarousel(1, sampleCatalog);
    const elements = carousel.attachment?.payload?.elements;
    const ratio = carousel.attachment?.payload?.image_aspect_ratio;

    assert(ratio === "square", "Catalog strictly enforces 1:1 square aspect ratio");
    assert(elements.length === 2, "Catalog displays reward items correctly");

    assert(
      elements[0].buttons.length === 1 && elements[0].buttons[0].title.includes("Claim (1 PTS)"),
      "Card 1: 1 PT item shows active [ 🎁 Claim (1 PTS) ] button"
    );
    assert(elements[0].subtitle === "⭐ Cost: 1 PTS", "Card 1 subtitle displays Name and Cost only");

    assert(
      elements[1].buttons.length === 1 && elements[1].buttons[0].title.includes("Need 4 More PTS"),
      "Card 2: 5 PT item displays dynamic [ ⭐ Need 4 More PTS ] button"
    );
    assert(elements[1].subtitle === "⭐ Cost: 5 PTS", "Card 2 subtitle displays Name and Cost only");

    assert(
      Array.isArray(carousel.quick_replies) && carousel.quick_replies.length === 1 && carousel.quick_replies[0].title === "📊 Dashboard",
      "Attached single fixed [ 📊 Dashboard ] Quick Reply"
    );
  } catch (err) {
    assert(false, "Catalog generation verification failed", err.message);
  }

  console.log("\n=======================================================");
  console.log(`NEW USER TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

testNewUserExperience();
