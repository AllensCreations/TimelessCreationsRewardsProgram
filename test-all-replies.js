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

  // ----------------------------------------------------
  // TEST 1: DASHBOARD PAYLOAD (ACTION_DASHBOARD)
  // ----------------------------------------------------
  console.log("--- 1. Testing Dashboard Reply Payload ---");
  const dashPayload = buildDashboardPayload(mockMissionary, refLink);
  
  assert(
    dashPayload.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗"),
    "Dashboard contains Unicode bold header"
  );
  assert(
    dashPayload.dashboardText.includes("Elder Allen Mark Salviejo") && dashPayload.dashboardText.includes("4 Points"),
    "Dashboard correctly binds missionary name and points"
  );
  assert(
    !dashPayload.dashboardText.includes("**") && !dashPayload.dashboardText.includes("###"),
    "Dashboard text has zero raw markdown artifacts"
  );
  assert(
    Array.isArray(dashPayload.quick_replies) && dashPayload.quick_replies.length === 3,
    "Dashboard attaches exactly 3 fixed Quick Replies"
  );

  // ----------------------------------------------------
  // TEST 2: COMPANION INVITE (ACTION_INVITE)
  // ----------------------------------------------------
  console.log("\n--- 2. Testing Companion Invite Reply ---");
  assert(
    dashPayload.invitePromoText.includes("🔗 𝟭-𝗧𝗮𝗽 𝗜𝗻𝘃𝗶𝘁𝗲 𝗟𝗶𝗻𝗸:") && dashPayload.invitePromoText.includes(refLink),
    "Invite promo contains copyable Unicode referral link"
  );
  assert(
    !dashPayload.invitePromoText.includes("**"),
    "Invite promo has zero raw markdown syntax"
  );

  // ----------------------------------------------------
  // TEST 3: CATALOG CAROUSEL (ACTION_CATALOG) - 1 BUTTON RULE
  // ----------------------------------------------------
  console.log("\n--- 3. Testing Catalog Carousel Compliance (1 Button & No Progress Bar) ---");
  const sampleProducts = [
    { id: 101, name: "Engraved Nametag", price: 2, image_url: "https://i.ibb.co/tag.webp" },
    { id: 102, name: "POS Standard Drip Kit", price: 8, image_url: "https://i.ibb.co/kit.webp" }
  ];

  const carouselResult = await buildCatalogCarousel(4, sampleProducts);
  const elements = carouselResult.attachment?.payload?.elements;

  assert(
    elements && elements.length === 2,
    "Carousel generates correct number of product cards"
  );

  // Card 1: Affordable (4 pts vs 2 pts cost)
  const card1 = elements[0];
  assert(
    card1.buttons.length === 1,
    "Affordable item strictly contains exactly 1 button"
  );
  assert(
    card1.buttons[0].title.includes("Claim (2 PTS)") && card1.buttons[0].payload === "CLAIM_ITEM_101",
    "Affordable item button routes directly to CLAIM_ITEM_<id>"
  );
  assert(
    !card1.subtitle.includes("■") && !card1.subtitle.includes("□"),
    "Affordable item subtitle excludes visual progress bars"
  );

  // Card 2: Goal/Locked (4 pts vs 8 pts cost -> Needs 4 more)
  const card2 = elements[1];
  assert(
    card2.buttons.length === 1,
    "Locked item strictly contains exactly 1 button"
  );
  assert(
    card2.buttons[0].title.includes("Need 4 More PTS") && card2.buttons[0].payload === "VIEW_GOAL_102",
    "Locked item button routes to VIEW_GOAL_<id> with exact point difference"
  );
  assert(
    !card2.subtitle.includes("■") && !card2.subtitle.includes("□"),
    "Locked item subtitle excludes visual progress bars"
  );

  // Sticky Quick Replies attached to Carousel
  assert(
    Array.isArray(carouselResult.quick_replies) && carouselResult.quick_replies.length === 3,
    "Carousel maintains sticky fixed quick replies"
  );

  // ----------------------------------------------------
  // TEST 4: DAILY RATE LIMITER SHIELD (Max 2 Views/Day)
  // ----------------------------------------------------
  console.log("\n--- 4. Testing Atomic Daily Rate Limiter ---");
  const limit1 = await checkDashboardRateLimit(mockSenderId);
  const limit2 = await checkDashboardRateLimit(mockSenderId);
  const limit3 = await checkDashboardRateLimit(mockSenderId);

  assert(limit1.allowed === true && limit1.remaining === 1, "Rate limiter allows 1st view");
  assert(limit2.allowed === true && limit2.remaining === 0, "Rate limiter allows 2nd view");
  assert(limit3.allowed === false, "Rate limiter blocks 3rd view");
  assert(
    limit3.message && limit3.message.includes("🛡️ 𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗"),
    "Blocked view responds with formatted Unicode shield warning"
  );

  // ----------------------------------------------------
  // TEST 5: FIXED QUICK REPLIES SCHEMA VALIDATION
  // ----------------------------------------------------
  console.log("\n--- 5. Testing Quick Replies Schema ---");
  const requiredPayloads = ["ACTION_DASHBOARD", "ACTION_INVITE", "ACTION_CATALOG"];
  const validQuickReplies = FIXED_QUICK_REPLIES.every(qr => 
    qr.content_type === "text" && 
    typeof qr.title === "string" && 
    requiredPayloads.includes(qr.payload)
  );

  assert(validQuickReplies, "Fixed Quick Replies payload schemas match Messenger Graph specifications");

  console.log("\n==========================================");
  console.log(`REPLIES TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) process.exit(1);
}

runRepliesTest();
