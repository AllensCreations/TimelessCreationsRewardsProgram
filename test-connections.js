import 'dotenv/config';
import { runSql } from './lib/db.js';
import { checkDashboardRateLimit, buildCatalogCarousel, buildDashboardPayload } from './lib/bot.js';
import { sendDripEmail } from './lib/mailer.js';

console.log("\n📡 STARTING END-TO-END TCRP CONNECTIONS TESTER...\n");

let passed = 0;
let failed = 0;

function assert(condition, label, errDetail = '') {
  if (condition) {
    console.log(`✅ [OK] ${label}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${label} ${errDetail ? '-> ' + errDetail : ''}`);
    failed++;
  }
}

async function runAllConnectionTests() {
  // 1. TEST TURSO DATABASE CONNECTION
  try {
    const res = await runSql("SELECT 1 as alive");
    const isAlive = (Array.isArray(res) ? res[0]?.alive : res?.rows?.[0]?.alive) === 1 || res?.[0]?.alive === 1;
    assert(isAlive, "Turso Database Connection (runSql)");
  } catch (err) {
    assert(false, "Turso Database Connection", err.message);
  }

  // 2. TEST IMGBB API KEY CONFIGURATION
  const imgbbKey = process.env.IMGBB_API_KEY;
  assert(Boolean(imgbbKey && imgbbKey.length >= 20), "ImgBB API Key configuration in .env", imgbbKey ? "" : "IMGBB_API_KEY missing");

  // 3. TEST BREVO EMAIL CONFIGURATION
  const brevoKey = process.env.BREVO_API_KEY;
  assert(Boolean(brevoKey && brevoKey.startsWith('xkeysib-')), "Brevo API Key format validation", brevoKey ? "" : "BREVO_API_KEY missing");

  // 4. TEST FACEBOOK MESSENGER ENVIRONMENT CONFIGURATION
  const fbToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const fbVerify = process.env.FB_VERIFY_TOKEN;
  assert(Boolean(fbToken && fbToken.length > 20), "Facebook Page Access Token (FB_PAGE_ACCESS_TOKEN)", fbToken ? "" : "Missing token");
  assert(Boolean(fbVerify && fbVerify.length > 0), "Facebook Webhook Verify Token (FB_VERIFY_TOKEN)", fbVerify ? "" : "Missing verify token");

  // 5. TEST BOT MODULE: UNICODE DASHBOARD & INVITE PAYLOAD GENERATION
  try {
    const mockUser = { name: "Elder Salviejo", email: "salviejomark@missionary.org", points: 3 };
    const refLink = "https://m.me/TimelessCreationsRP?ref=A8W3A3";
    const payload = buildDashboardPayload(mockUser, refLink);

    const hasUnicodeDash = payload.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗");
    const hasUnicodeInvite = payload.invitePromoText.includes("🔗 𝟭-𝗧𝗮𝗽 𝗜𝗻𝘃𝗶𝘁𝗲 𝗟𝗶𝗻𝗸:");
    const hasNoRawAsterisks = !payload.dashboardText.includes("**MISSIONARY");

    assert(hasUnicodeDash && hasUnicodeInvite && hasNoRawAsterisks, "Bot Payload Formatter (Unicode Bold & Clean Formatting)");
  } catch (err) {
    assert(false, "Bot Payload Formatter", err.message);
  }

  // 6. TEST BOT MODULE: CAROUSEL WITH DYNAMIC PROGRESS BARS
  try {
    const sampleProducts = [
      { id: 1, name: "Engraved Tag", price: 2 },
      { id: 2, name: "POS Missionary Kit", price: 6 }
    ];
    const carousel = await buildCatalogCarousel(2, sampleProducts);
    const elements = carousel?.attachment?.payload?.elements;
    const item1Affordable = elements?.[0]?.buttons?.[0]?.title.includes("Claim");
    const item2Goal = elements?.[1]?.buttons?.[0]?.title.includes("Need 4 More PTS");
    const hasProgressBar = elements?.[1]?.subtitle?.includes("[■■");

    assert(item1Affordable && item2Goal && hasProgressBar, "Bot Carousel (Progress bar [■■□□□] & Claim button routing)");
  } catch (err) {
    assert(false, "Bot Carousel Generator", err.message);
  }

  // 7. TEST BOT MODULE: DAILY VIEW LIMITER
  try {
    const testId = "conn_test_" + Date.now();
    const c1 = await checkDashboardRateLimit(testId);
    const c2 = await checkDashboardRateLimit(testId);
    const c3 = await checkDashboardRateLimit(testId);

    assert(c1.allowed && c2.allowed && !c3.allowed, "Bot Rate Limiter (Max 2 views per day enforcement)");
  } catch (err) {
    assert(false, "Bot Rate Limiter", err.message);
  }

  console.log("\n==========================================");
  console.log(`TOTAL CONNECTIONS TESTED: ${passed} OK | ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) process.exit(1);
}

runAllConnectionTests();
