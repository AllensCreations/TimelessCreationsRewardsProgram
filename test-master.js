import 'dotenv/config';
import { runSql } from './lib/db.js';
import { renderMonthlyDripTemplate, sendOTPEmail, sendReceiptEmail } from './lib/mailer.js';
import { checkDashboardRateLimit } from './lib/bot.js';

async function runMasterSuite() {
  console.log("🚀 Running TCRP Master Verification Suite...\n");
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

  try {
    // 1. Database Connection & Schema Health Check
    console.log("📦 1. Database & Schema Health Check");
    const ping = await runSql("SELECT 1 as alive");
    assert(ping && ping.length > 0, "Turso Database connection is active");

    const tableRows = await runSql("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = (tableRows || []).map(t => t.name);
    
    assert(tables.includes('missionaries'), "Table 'missionaries' exists in schema");
    assert(tables.includes('product_catalog'), "Table 'product_catalog' exists in schema");
    assert(tables.includes('drip_messages'), "Table 'drip_messages' exists in schema");
    assert(tables.includes('orders'), "Table 'orders' exists in schema");
    assert(tables.includes('system_config'), "Table 'system_config' exists in schema");

    // 2. Automated Drips & Mailer Validation
    console.log("\n✉️ 2. Automated Drips & Mailer Validation");
    const testDripData = {
      month: 1,
      name: "Elder Smith",
      theme: "Elder Jeffrey R. Holland",
      scripture: "Trust in the Lord with all thine heart.",
      message: "May your faith be strengthened this month.",
      points: 4,
      highlight_label: "Wooden Nametag",
      highlight_img: "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE",
      highlight_label_2: "Salvation Kit",
      highlight_img_2: "https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ"
    };

    const renderedDrip = renderMonthlyDripTemplate(testDripData, [
      { name: "Temple Keychain", price: 6, image_url: "https://i.postimg.cc/test.png" }
    ]);

    assert(renderedDrip.includes("Elder Smith"), "Drip template accurately binds recipient name");
    assert(renderedDrip.includes("Wooden Nametag"), "Drip template renders primary highlight product");
    assert(renderedDrip.includes("Salvation Kit"), "Drip template renders secondary highlight product");
    assert(renderedDrip.includes("Only <strong>2 more points</strong>"), "Accurately computes nearest reward goal difference");

    // 3. Messenger Rate Limit Verification
    console.log("\n🛡️ 3. Messenger Rate Limit Verification");
    const testPsid = "TEST_PSID_SUITE_123";
    await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [testPsid]);

    const view1 = await checkDashboardRateLimit(testPsid);
    const view2 = await checkDashboardRateLimit(testPsid);
    const view3 = await checkDashboardRateLimit(testPsid);

    assert(view1.allowed === true, "Rate Limiter allows 1st dashboard request");
    assert(view2.allowed === true, "Rate Limiter allows 2nd dashboard request");
    assert(view3.allowed === false, "Rate Limiter blocks 3rd dashboard request within daily window");

    await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [testPsid]);

  } catch (err) {
    console.error(`\n💥 Fatal Test Error: ${err.message}`);
    failed++;
  }

  console.log(`\n================================`);
  console.log(`Suite Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterSuite();
