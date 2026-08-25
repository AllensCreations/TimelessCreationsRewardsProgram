import 'dotenv/config';
import { runSql } from './lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit, FIXED_QUICK_REPLIES } from './lib/bot.js';

console.log("\n🤖 STARTING MESSENGER BOT CONVERSATION & REPLIES TESTER...\n");

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

async function runRepliesTest() {
  const mockSenderId = "fb_sim_user_" + Math.random().toString(36).slice(2, 9);
  const mockMissionary = {
    name: "Elder Allen Mark Salviejo",
    email: "salviejomark@missionary.org",
    points: 4,
    referral_code: "ALLEN77"
  };
  const refLink = `https://m.me/TimelessCreationsRP?ref=${mockMissionary.referral_code}`;

  // 1. Separate Dashboard and Invite Messages Test
  console.log("--- 1. Testing Separate Dashboard & Invite Messages ---");
  const payloads = buildDashboardPayload(mockMissionary, refLink);
  
  assert(
    payloads.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗") && payloads.dashboardText.includes("4 Points"),
    "Message 1: Dashboard contains Unicode header and points balance"
  );
  assert(
    payloads.invitePromoText.includes("💌 𝗜𝗻𝘃𝗶𝘁𝗲 𝗮 𝗙𝗿𝗶𝗲𝗻𝗱 & 𝗘𝗮𝗿𝗻 +𝟭 𝗣𝗧") && payloads.invitePromoText.includes(refLink),
    "Message 2: Invite contains copy-and-send companion template"
  );
  assert(
    !payloads.dashboardText.includes("**") && !payloads.invitePromoText.includes("**"),
    "Both messages have zero raw markdown artifacts"
  );

  // 2. 1:1 Square Catalog Carousel Test (Name & Cost Only)
  console.log("\n--- 2. Testing 1:1 Square Catalog Carousel (Name & Cost Only) ---");
  const sampleProducts = [
    { id: 101, name: "Engraved Nametag", price: 2, image_url: "https://i.ibb.co/tag.webp" },
    { id: 102, name: "POS Standard Drip Kit", price: 8, image_url: "https://i.ibb.co/kit.webp" }
  ];

  const carouselResult = await buildCatalogCarousel(4, sampleProducts);
  const elements = carouselResult.attachment?.payload?.elements;
  const aspectRatio = carouselResult.attachment?.payload?.image_aspect_ratio;

  assert(
    aspectRatio === "square",
    "Carousel strictly enforces 1:1 square image_aspect_ratio"
  );
  assert(
    elements && elements.length === 2,
    "Carousel generates product cards"
  );
  assert(
    elements[0].subtitle === "⭐ Cost: 2 PTS",
    "Card 1 subtitle strictly displays Name and Cost only"
  );
  assert(
    elements[1].subtitle === "⭐ Cost: 8 PTS",
    "Card 2 subtitle strictly displays Name and Cost only"
  );
  assert(
    elements[0].buttons.length === 1 && elements[0].buttons[0].title.includes("Claim (2 PTS)"),
    "Affordable card contains 1 Claim button"
  );
  assert(
    elements[1].buttons.length === 1 && elements[1].buttons[0].title.includes("Need 4 More PTS"),
    "Locked card contains 1 Need PTS button"
  );
  assert(
    Array.isArray(carouselResult.quick_replies) && carouselResult.quick_replies.length === 1 && carouselResult.quick_replies[0].title === "📊 Dashboard",
    "Carousel attaches single fixed [ 📊 Dashboard ] Quick Reply"
  );

  // 3. Daily Rate Limiter Test
  console.log("\n--- 3. Testing Atomic Daily Rate Limiter ---");
  const limit1 = await checkDashboardRateLimit(mockSenderId);
  const limit2 = await checkDashboardRateLimit(mockSenderId);
  const limit3 = await checkDashboardRateLimit(mockSenderId);

  assert(limit1.allowed === true, "Rate limiter allows 1st view");
  assert(limit2.allowed === true, "Rate limiter allows 2nd view");
  assert(limit3.allowed === false, "Rate limiter blocks 3rd view");

  console.log("\n==========================================");
  console.log(`REPLIES TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) process.exit(1);
}

runRepliesTest();
