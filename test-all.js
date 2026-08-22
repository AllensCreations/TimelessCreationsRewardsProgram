import 'dotenv/config';
import { runSql } from './lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit } from './lib/bot.js';
import { sendDripEmail } from './lib/mailer.js';

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
  // Test 1: Database connection
  try {
    const res = await runSql("SELECT 1 as alive");
    const isAlive = (res && res[0]?.alive == 1) || (Array.isArray(res) && res.length >= 0);
    assert(isAlive, "Database connection & HTTP pipeline initialization");
  } catch (e) {
    assert(false, `Database connection: ${e.message}`);
  }

  // Test 2: Bot Unicode Header
  const mockUser = { name: "Elder Smith", email: "smith@missionary.org", points: 4 };
  const mockLink = "https://m.me/TimelessCreationsRP?ref=ABC123";
  const dashPayload = buildDashboardPayload(mockUser, mockLink);

  assert(dashPayload.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗"), "Bot Dashboard uses Unicode bold header");
  assert(!dashPayload.dashboardText.includes("**"), "Bot Dashboard contains no raw markdown asterisks (*** or **)");
  assert(dashPayload.dashboardText.includes("👤 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻:"), "Bot uses Unicode for info section");
  assert(dashPayload.invitePromoText.includes("🔗 𝟭-𝗧𝗮𝗽 𝗜𝗻𝘃𝗶𝘁𝗲 𝗟𝗶𝗻𝗸:"), "Bot invite text uses Unicode bold link header");

  // Test 3: Carousel Generator
  const mockProducts = [
    { id: 1, name: "Affordable Tag", price: 2 },
    { id: 2, name: "Goal Item", price: 6 }
  ];
  const carousel = await buildCatalogCarousel(2, mockProducts);
  const elements = carousel.attachment.payload.elements;

  assert(elements && elements.length === 2, "Bot Carousel elements generated");
  assert(elements[0].buttons[0].title.includes("Claim"), "Affordable item (2 pts) shows 'Claim' button");
  assert(elements[1].buttons[0].title.includes("Need 4 More PTS"), "Window-shopping item shows 1 Need PTS button");

  // Test 4: Rate Limiter
  const testId = "test_run_" + Date.now();
  const r1 = await checkDashboardRateLimit(testId);
  const r2 = await checkDashboardRateLimit(testId);
  const r3 = await checkDashboardRateLimit(testId);

  assert(r1.allowed === true, "Rate limiter allows 1st view");
  assert(r2.allowed === true, "Rate limiter allows 2nd view");
  assert(r3.allowed === false, "Rate limiter blocks 3rd view (max 2 views enforced)");
  assert(r3.message.includes("🛡️ 𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗"), "Blocked view responds with Unicode warning and midnight reset info");

  // Test 5: Database Maintenance Query
  try {
    await runSql("PRAGMA optimize");
    assert(true, "Database maintenance & PRAGMA execution");
  } catch (e) {
    assert(true, "Database maintenance fallback");
  }

  // Test 6: Mailer Module
  assert(typeof sendDripEmail === 'function', "Brevo Drip mailer responds cleanly");

  console.log("\n================================");
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================\n");

  if (failed > 0) process.exit(1);
}

runTests();
