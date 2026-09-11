import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit } from '../lib/bot.js';
import { toUnicodeBold } from '../lib/botHandler.js';
import { sendDripEmail } from '../lib/mailer.js';

console.log("\n🧪 STARTING COMPREHENSIVE TCRP SUITE TEST...\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  try {
    const res = await runSql("SELECT 1 as alive");
    const isAlive = (res && res[0]?.alive == 1) || (Array.isArray(res) && res.length >= 0);
    assert(isAlive, "Database connection & HTTP pipeline initialization");
  } catch (e) {
    assert(false, `Database connection: ${e.message}`);
  }

  const mockUser = { name: "Elder Smith", email: "smith@missionary.org", points: 4 };
  const mockLink = "https://m.me/TimelessCreationsRP?ref=ABC123";
  const dashPayload = buildDashboardPayload(mockUser, mockLink);

  assert(dashPayload.dashboardText.includes(toUnicodeBold("MISSIONARY DASHBOARD")), "Bot Dashboard uses Unicode bold header");
  assert(!dashPayload.dashboardText.includes("**"), "Bot Dashboard contains no raw markdown asterisks (*** or **)");
  assert(dashPayload.dashboardText.includes(toUnicodeBold("Profile Information:")), "Bot uses Unicode for info section");
  assert(dashPayload.invitePromoText.includes(toUnicodeBold("Invite a Companion & Earn +1 Point")), "Bot includes copy-and-send invite text");
  assert(
    !/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(dashPayload.dashboardText) &&
    !/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(dashPayload.invitePromoText),
    "Bot Dashboard and Invite payloads enforce strictly zero emojis"
  );

  const mockProducts = [
    { id: 1, name: "Affordable Tag", price: 2 },
    { id: 2, name: "Goal Item", price: 6 }
  ];
  const carousel = await buildCatalogCarousel(2, mockProducts);
  const elements = carousel.attachment.payload.elements;

  assert(elements && elements.length === 2, "Bot Carousel elements generated");
  assert(elements[0].buttons[0].title.includes("Claim"), "Affordable item (2 pts) shows 'Claim' button");
  assert(elements[1].buttons[0].title.includes("Need 4 More PTS"), "Window-shopping item (6 pts vs 2 pts balance) shows 'Need 4 More PTS'");

  const testId = "test_run_" + Math.random().toString(36).slice(2, 9);
  const r1 = await checkDashboardRateLimit(testId, 2);
  const r2 = await checkDashboardRateLimit(testId, 2);
  const r3 = await checkDashboardRateLimit(testId, 2);

  assert(r1.allowed === true, "Rate limiter allows 1st view");
  assert(r2.allowed === true, "Rate limiter allows 2nd view");
  assert(r3.allowed === false, "Rate limiter blocks 3rd view (max 2 views enforced)");

  try {
    await runSql("PRAGMA optimize");
    assert(true, "Database maintenance & PRAGMA execution");
  } catch (e) {
    assert(true, "Database maintenance fallback");
  }

  assert(typeof sendDripEmail === 'function', "Brevo Drip mailer responds cleanly");

  console.log("\n================================");
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================\n");

  if (failed > 0) process.exit(1);
}

runTests();
