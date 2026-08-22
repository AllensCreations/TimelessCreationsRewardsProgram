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
  const mockSenderId = "fb_sim_user_" + Date.now();
  const mockMissionary = {
    name: "Elder Allen Mark Salviejo",
    email: "salviejomark@missionary.org",
    points: 4,
    referral_code: "ALLEN77"
  };
  const refLink = `https://m.me/TimelessCreationsRP?ref=${mockMissionary.referral_code}`;

  // 1. Dashboard + Invite Unified Payload Test
  console.log("--- 1. Testing Unified Dashboard & Copyable Invite Payload ---");
  const dashPayload = buildDashboardPayload(mockMissionary, refLink);
  
  assert(
    dashPayload.text.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗"),
    "Dashboard contains Unicode bold header"
  );
  assert(
    dashPayload.text.includes("Elder Allen Mark Salviejo") && dashPayload.text.includes("4 Points"),
    "Dashboard correctly binds missionary name and points"
  );
  assert(
    dashPayload.text.includes("💌 𝗜𝗻𝘃𝗶𝘁𝗲 𝗮 𝗙𝗿𝗶𝗲𝗻𝗱 & 𝗘𝗮𝗿𝗻 +𝟭 𝗣𝗧") && dashPayload.text.includes(refLink),
    "Dashboard includes the integrated copy-and-send companion invite"
  );
  assert(
    !dashPayload.text.includes("**") && !dashPayload.text.includes("###"),
    "Dashboard text has zero raw markdown artifacts"
  );
  assert(
    Array.isArray(dashPayload.quick_replies) && dashPayload.quick_replies.length === 1 && dashPayload.quick_replies[0].title === "📊 Dashboard",
    "Dashboard attaches exactly 1 single fixed Quick Reply: [ 📊 Dashboard ]"
  );

  // 2. 1:1 Square Catalog Carousel Test
  console.log("\n--- 2. Testing 1:1 Square Catalog Carousel (1 Button Rule) ---");
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
    "Carousel generates correct number of product cards"
  );

  // Card 1: Affordable Item (4 pts vs 2 pts cost)
  const card1 = elements[0];
  assert(
    card1.buttons.length === 1 && card1.buttons[0].title.includes("Claim (2 PTS)"),
    "Affordable item contains exactly 1 Claim button"
  );

  // Card 2: Locked Goal Item (4 pts vs 8 pts cost)
  const card2 = elements[1];
  assert(
    card2.buttons.length === 1 && card2.buttons[0].title.includes("Need 4 More PTS"),
    "Locked item contains exactly 1 Need PTS button"
  );
  assert(
    !card2.subtitle.includes("■") && !card2.subtitle.includes("□"),
    "Subtitle excludes raw progress bar block characters"
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
