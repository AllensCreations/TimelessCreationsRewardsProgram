import 'dotenv/config';
import { runSql } from './lib/db.js';
import { executeBotAction } from './api/bot.js';
import { buildDashboardPayload, buildCatalogCarousel, FIXED_QUICK_REPLIES } from './lib/bot.js';

console.log("\n🧪 STARTING NEW USER MESSENGER BOT LIFECYCLE SIMULATOR...\n");

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

async function runNewUserTest() {
  const fakeToken = "EAA_MOCK_TOKEN_FOR_SIMULATION_ONLY";
  const uniqueCode = "TC" + Math.random().toString(36).substring(2, 7).toUpperCase();
  const newSenderId = "fb_test_sim_" + Date.now();

  try {
    // 1. Ensure Table Exists
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

    // 2. Seed Inviter
    console.log("--- 1. Testing Deep Link Onboarding (messaging_referrals) ---");
    await runSql(
      "INSERT INTO missionaries (name, email, points, referral_code) VALUES (?, ?, 3, ?)",
      ["Elder Companion Seed", `seed_${uniqueCode.toLowerCase()}@mission.org`, uniqueCode]
    );

    const inviterRows = await runSql("SELECT * FROM missionaries WHERE referral_code = ? LIMIT 1", [uniqueCode]);
    const inviter = inviterRows?.[0];

    assert(Boolean(inviter && inviter.id), "Inviter found in Turso DB");

    if (inviter) {
      // 3. Simulate Onboarding Action
      await executeBotAction(newSenderId, "", "", uniqueCode, fakeToken);

      // 4. Verify Inviter Points Increment (+1)
      const updatedInviterRows = await runSql("SELECT points FROM missionaries WHERE id = ?", [inviter.id]);
      const inviterPoints = Number(updatedInviterRows?.[0]?.points || 0);
      assert(inviterPoints === 4, "Inviter points incremented by +1 (3 -> 4 PTS)");

      // 5. Verify New User Created with 1 Point
      const newUserRows = await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? LIMIT 1", [newSenderId]);
      const newUser = newUserRows?.[0];

      assert(Boolean(newUser), "New missionary profile created in Turso DB");
      assert(Number(newUser?.points) === 1, "New missionary awarded +1 initial welcome reward point");
    }

    // 6. Test Split Message Payloads
    console.log("\n--- 2. Testing Payload Integrity for New User ---");
    const mockRefLink = `https://m.me/TimelessCreationsRP?ref=${uniqueCode}`;
    const payload = buildDashboardPayload({ name: "Elder New User", email: "new@mission.org", points: 1 }, mockRefLink);

    assert(payload.dashboardText.includes("1 Points"), "Message 1: Dashboard reflects exactly 1 welcome point");
    assert(payload.invitePromoText.includes(mockRefLink), "Message 2: Invite contains copy-and-send companion pitch");
    assert(
      Array.isArray(payload.quick_replies) && payload.quick_replies[0].title === "📊 Dashboard",
      "Attached single fixed [ 📊 Dashboard ] Quick Reply"
    );

    // 7. Test 1:1 Square Catalog Delivery
    console.log("\n--- 3. Testing 1:1 Square Catalog Carousel ---");
    const sampleCatalog = [
      { id: 301, name: "Engraved Nametag", price: 1, image_url: "https://i.ibb.co/tag.webp" },
      { id: 302, name: "Missionary POS Kit", price: 5, image_url: "https://i.ibb.co/kit.webp" }
    ];

    const carousel = await buildCatalogCarousel(1, sampleCatalog);
    assert(carousel.attachment?.payload?.image_aspect_ratio === "square", "Catalog carousel enforces 1:1 square ratio");
    assert(carousel.attachment?.payload?.elements?.length === 2, "Catalog displays reward items correctly");
    assert(carousel.attachment?.payload?.elements[0].buttons[0].title.includes("Claim (1 PTS)"), "Affordable item shows active Claim button");
    assert(carousel.attachment?.payload?.elements[1].buttons[0].title.includes("Need 4 More PTS"), "Locked item shows dynamic Need PTS button");

  } catch (err) {
    console.error("New user test error:", err);
    assert(false, "Lifecycle test execution failed", err.message);
  }

  console.log("\n=========================================================");
  console.log(`NEW USER BOT RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=========================================================\n");

  if (failed > 0) process.exit(1);
}

runNewUserTest();
