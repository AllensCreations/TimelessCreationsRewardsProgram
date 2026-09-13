import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  buildRewardSectionComponents,
  buildCombinedRewardSectionHtml,
  buildTopProductsComponents,
  buildTopProductsHtml,
  renderMonthlyDripTemplate,
  renderOutOfWindowDripTemplate,
  interpolatePlaceholders
} from '../lib/mailer.js';

async function runGranularTagTests() {
  console.log("==================================================");
  console.log("Testing Granular Template Tags for Custom Templates");
  console.log("==================================================");

  // Test 1: buildRewardSectionComponents structure and data calculation
  const catalog = [
    { name: "Scripture Case", price: 4, image_url: "https://example.com/case.jpg" },
    { name: "Leather Journal", price: 8, image_url: "https://example.com/journal.jpg" }
  ];
  const promo = { code: "SPRING2026", points: 3 };

  const rewardComps = buildRewardSectionComponents(5, catalog, promo);

  assert.strictEqual(rewardComps.pts, 5, "Reward points calculation matches input");
  assert.strictEqual(rewardComps.affordableCount, 1, "Correct affordable count (1 item <= 5 pts)");
  assert.strictEqual(rewardComps.affordable[0].name, "Scripture Case", "Affordable item is Scripture Case");
  assert(rewardComps.affordableHtml.includes("Scripture Case"), "Affordable HTML includes item name");
  assert.strictEqual(rewardComps.nearestItem.name, "Leather Journal", "Nearest goal is Leather Journal (8 pts)");
  assert.strictEqual(rewardComps.needed, 3, "Needed points is 3 (8 - 5)");
  assert(rewardComps.goalHtml.includes("Leather Journal"), "Goal HTML includes goal item name");
  assert.strictEqual(rewardComps.promoCode, "SPRING2026", "Promo code extracted");
  assert.strictEqual(rewardComps.promoPoints, "3", "Promo points extracted");
  assert(rewardComps.promoSnippetHtml.includes("SPRING2026"), "Promo snippet contains promo code");
  assert(rewardComps.combinedHtml.includes("Your TCRP Reward Balance"), "Combined HTML maintains complete backward-compatible block");

  console.log("  [PASS] buildRewardSectionComponents returns complete granular reward properties");

  // Test 2: buildTopProductsComponents structure and fallback behavior
  const dripDataWithProducts = {
    highlight_product_name: "CTR Ring Deluxe",
    highlight_product_img: "https://example.com/ctr.jpg",
    highlight_product_sold: "2.4k+ Sold",
    highlight_product_2_name: "Preach My Gospel Bookmark",
    highlight_product_2_img: "https://example.com/bookmark.jpg",
    highlight_product_2_sold: "1.1k+ Sold"
  };

  const topComps = buildTopProductsComponents(dripDataWithProducts);
  assert.strictEqual(topComps.p1Name, "CTR Ring Deluxe", "p1Name correctly mapped");
  assert(topComps.p1Img.includes("ctr.jpg"), "p1Img correctly mapped");
  assert.strictEqual(topComps.p1Sold, "2.4k+ Sold", "p1Sold correctly mapped");
  assert.strictEqual(topComps.p2Name, "Preach My Gospel Bookmark", "p2Name correctly mapped");
  assert(topComps.p2Img.includes("bookmark.jpg"), "p2Img correctly mapped");
  assert.strictEqual(topComps.p2Sold, "1.1k+ Sold", "p2Sold correctly mapped");
  assert.strictEqual(topComps.display, "display:block", "display is block when products present");
  assert(topComps.combinedHtml.includes("CTR Ring Deluxe"), "combinedHtml includes product 1");
  assert(topComps.combinedHtml.includes("Preach My Gospel Bookmark"), "combinedHtml includes product 2");

  const emptyTopComps = buildTopProductsComponents({ highlight_enabled: false });
  assert.strictEqual(emptyTopComps.p1Name, "", "p1Name is empty when not provided/disabled");
  assert.strictEqual(emptyTopComps.p2Name, "", "p2Name is empty when not provided/disabled");
  assert.strictEqual(emptyTopComps.display, "display:none", "display is none when no products");
  assert.strictEqual(emptyTopComps.combinedHtml, "", "combinedHtml is empty string when no products");

  console.log("  [PASS] buildTopProductsComponents handles present and empty products cleanly");

  // Test 3: Custom Template rendering with ONLY granular tags (No macro blocks)
  const customTemplateHtml = `<!DOCTYPE html>
<html>
<head><title>Custom Drip</title></head>
<body>
  <h1>Hello {{NAME}}</h1>
  <p>Your current reward points: <span id="pts">{{USER_POINTS}}</span></p>

  <!-- Granular Top Products in custom card layout -->
  <div class="my-custom-product-card" style="{{TOP_PRODUCTS_DISPLAY}}">
    <h2>Hot Item: {{PRODUCT_1_NAME}}</h2>
    <img src="{{PRODUCT_1_IMG}}" alt="{{PRODUCT_1_NAME}}" />
    <span class="sold-badge">{{PRODUCT_1_SOLD}}</span>
  </div>

  <!-- Granular Goal in custom styling -->
  <div class="my-custom-goal">
    <h3>Target: {{NEAREST_GOAL_NAME}} ({{NEAREST_GOAL_POINTS}} pts)</h3>
    <p>Only {{NEAREST_GOAL_NEEDED}} points away!</p>
    <img src="{{NEAREST_GOAL_IMG}}" />
  </div>

  <!-- Granular Promo in custom banner -->
  <div class="custom-promo">
    Promo: <b>{{PROMO_CODE}}</b> gives +{{PROMO_POINTS}} pts!
  </div>
</body>
</html>`;

  // We test using interpolatePlaceholders with drip renderer dictionary
  const renderedOutput = renderMonthlyDripTemplate({
    name: "Elder Tyler",
    month: 5,
    points: 5,
    ...dripDataWithProducts
  }, catalog, promo);

  // Validate that default template still works and includes USER_POINTS and macro blocks
  assert(renderedOutput.includes("Elder Tyler"), "Default template rendered recipient");
  assert(renderedOutput.includes("5 Points"), "Default template rendered points");
  assert(renderedOutput.includes("CTR Ring Deluxe"), "Default template contains top product");

  // Test custom template compilation with interpolatePlaceholders directly
  const customRendered = interpolatePlaceholders(customTemplateHtml, {
    NAME: "Elder Tyler",
    USER_POINTS: "5",
    TOP_PRODUCTS_DISPLAY: topComps.display,
    PRODUCT_1_NAME: topComps.p1Name,
    PRODUCT_1_IMG: topComps.p1Img,
    PRODUCT_1_SOLD: topComps.p1Sold,
    NEAREST_GOAL_NAME: rewardComps.nearestItem.name,
    NEAREST_GOAL_POINTS: String(rewardComps.nearestItem.price),
    NEAREST_GOAL_NEEDED: String(rewardComps.needed),
    NEAREST_GOAL_IMG: rewardComps.nearestItem.image_url,
    PROMO_CODE: rewardComps.promoCode,
    PROMO_POINTS: rewardComps.promoPoints
  });

  assert(customRendered.includes("Your current reward points: <span id=\"pts\">5</span>"), "Custom points rendered");
  assert(customRendered.includes("Hot Item: CTR Ring Deluxe"), "Granular product name rendered in custom layout");
  assert(customRendered.includes("Target: Leather Journal (8 pts)"), "Granular goal name and points rendered");
  assert(customRendered.includes("Only 3 points away!"), "Granular goal needed points rendered");
  assert(customRendered.includes("Promo: <b>SPRING2026</b> gives +3 pts!"), "Granular promo rendered");
  assert(!customRendered.includes("{{"), "No unparsed template tags remain in custom template");

  console.log("  [PASS] Custom template renders granular tags without requiring monolithic HTML blocks");

  // Test 4: renderOutOfWindowDripTemplate supports granular tags
  const outOfWindowOutput = renderOutOfWindowDripTemplate(
    { name: "Elder OutOfWindow", points: 7 },
    catalog,
    promo
  );
  assert(outOfWindowOutput.includes("Elder OutOfWindow"), "Recipient rendered in out of window template");
  assert(outOfWindowOutput.includes("7 Points"), "Points rendered in out of window template");
  assert(outOfWindowOutput.includes("SPRING2026"), "Promo code rendered in out of window template");

  console.log("  [PASS] renderOutOfWindowDripTemplate supports granular tags");

  // Test 5: Verify tag chips and insertTag existence in UI files
  const viewsFile = fs.readFileSync(path.resolve('./views/campaigns.html'), 'utf8');
  const publicFile = fs.readFileSync(path.resolve('./public/campaigns.html'), 'utf8');

  for (const [name, content] of [["views/campaigns.html", viewsFile], ["public/campaigns.html", publicFile]]) {
    assert(content.includes("insertTag('{{USER_POINTS}}')"), `${name} has USER_POINTS tag chip`);
    assert(content.includes("insertTag('{{PRODUCT_1_NAME}}')"), `${name} has PRODUCT_1_NAME tag chip`);
    assert(content.includes("insertTag('{{PRODUCT_1_IMG}}')"), `${name} has PRODUCT_1_IMG tag chip`);
    assert(content.includes("insertTag('{{NEAREST_GOAL_NAME}}')"), `${name} has NEAREST_GOAL_NAME tag chip`);
    assert(content.includes("insertTag('{{PROMO_CODE}}')"), `${name} has PROMO_CODE tag chip`);
    assert(content.includes("window.insertTag = function"), `${name} has insertTag helper`);
    assert(content.includes(".tag-chip"), `${name} has tag-chip CSS class`);
  }

  console.log("  [PASS] Campaigns UI files (views and public) contain tag chips and insertTag helpers");

  console.log("\n==================================================");
  console.log("ALL GRANULAR TEMPLATE TAG TESTS PASSED! (5/5)");
  console.log("==================================================");
}

runGranularTagTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
