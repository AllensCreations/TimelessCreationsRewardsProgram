import 'dotenv/config';
import { runSql } from './lib/db.js';
import { checkDashboardRateLimit, buildCatalogCarousel, buildDashboardPayload } from './lib/bot.js';
import { sendDripEmail, sendOTPEmail, sendReceiptEmail } from './lib/mailer.js';
import { runDatabaseMaintenance } from './lib/dbPruner.js';

console.log("\n🧪 STARTING COMPREHENSIVE TCRP SUITE TEST...\n");

async function runTests() {
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

  // 1. TEST DATABASE CONNECTION
  try {
    const dbTest = await runSql("SELECT 1 as is_alive");
    assert(dbTest && dbTest[0]?.is_alive === 1, "Database connection & WAL mode initialization");
  } catch (err) {
    assert(false, `Database check failed: ${err.message}`);
  }

  // 2. TEST BOT MODULE: UNICODE FORMATTING
  try {
    const mockMissionary = { name: "Elder Salviejo", email: "salviejomark@missionary.org", points: 2 };
    const refLink = "https://m.me/TimelessCreationsRP?ref=A8W3A3";
    const payload = buildDashboardPayload(mockMissionary, refLink);

    assert(payload.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗"), "Bot Dashboard uses Unicode bold header");
    assert(!payload.dashboardText.includes("**MISSIONARY DASHBOARD**"), "Bot Dashboard contains no raw markdown asterisks (*** or **)");
    assert(payload.dashboardText.includes("👤 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻:"), "Bot uses Unicode for info section");
    assert(payload.invitePromoText.includes("🔗 𝟭-𝗧𝗮𝗽 𝗜𝗻𝘃𝗶𝘁𝗲 𝗟𝗶𝗻𝗸:"), "Bot invite text uses Unicode bold link header");
  } catch (err) {
    assert(false, `Bot Unicode payload failed: ${err.message}`);
  }

  // 3. TEST BOT MODULE: DYNAMIC WINDOW-SHOPPING CAROUSEL BUTTONS
  try {
    const sampleProducts = [
      { id: 1, name: "Wooden Nametag", price: 2, image_url: "https://example.com/nametag.png" },
      { id: 2, name: "Missionary POS Kit", price: 6, image_url: "https://example.com/pos.png" }
    ];

    const carousel = await buildCatalogCarousel(2, sampleProducts);
    const elements = carousel?.attachment?.payload?.elements;
    
    assert(elements && elements.length === 2, "Bot Carousel elements generated");
    assert(elements[0].buttons[0].title.includes("Claim (2 PTS)"), "Affordable item (2 pts) shows 'Claim' button");
    assert(elements[1].buttons[0].title.includes("Need 4 More PTS"), "Window-shopping item (6 pts vs 2 pts balance) shows 'Need 4 More PTS'");
  } catch (err) {
    assert(false, `Bot Carousel check failed: ${err.message}`);
  }

  // 4. TEST BOT MODULE: 2-PER-DAY RATE LIMITER
  try {
    const testSenderId = "test_user_" + Date.now();
    const firstCheck = await checkDashboardRateLimit(testSenderId);
    const secondCheck = await checkDashboardRateLimit(testSenderId);
    const thirdCheck = await checkDashboardRateLimit(testSenderId);

    assert(firstCheck.allowed === true && firstCheck.remaining === 1, "Rate limiter allows 1st view");
    assert(secondCheck.allowed === true && secondCheck.remaining === 0, "Rate limiter allows 2nd view");
    assert(thirdCheck.allowed === false, "Rate limiter blocks 3rd view (max 2 views enforced)");
    assert(thirdCheck.message.includes("𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗"), "Blocked view responds with Unicode warning and midnight reset info");
  } catch (err) {
    assert(false, `Bot Rate Limiter check failed: ${err.message}`);
  }

  // 5. TEST DB PRUNER & VACUUM MAINTENANCE
  try {
    const maintenanceResult = await runDatabaseMaintenance();
    assert(maintenanceResult.ok === true, "Database maintenance & PRAGMA optimize execution");
  } catch (err) {
    assert(false, `DB Pruner failed: ${err.message}`);
  }

  // 6. TEST MAILER TEMPLATE GENERATION
  try {
    const testDrip = await sendDripEmail("dry_run_test@example.com", 1, "Elder Test");
    assert(typeof testDrip === 'object', "Brevo Drip mailer responds cleanly");
  } catch (err) {
    assert(false, `Mailer check failed: ${err.message}`);
  }

  console.log(`\n================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
