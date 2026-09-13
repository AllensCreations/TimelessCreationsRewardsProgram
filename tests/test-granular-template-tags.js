import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  extractTemplateTheme,
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
  console.log("Testing Dynamic Template Style Blending for {{}} Blocks");
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
  assert(rewardComps.combinedHtml.includes("Your TCRP Reward Balance"), "Combined HTML maintains complete block");

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

  // Test 3: Dynamic Style Blending - extractTemplateTheme & Custom Template adaptation
  const emeraldCustomTemplate = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Poppins', sans-serif; background-color: #f0fdf4; color: #14532d; }
  .email-container { border: 1px solid #d5e1d7; }
  .btn-primary { background-color: #2e4a35; color: #ffffff; }
  .info-card { background-color: #f7faf7; }
</style>
</head>
<body>
  <h1>Welcome {{NAME}}</h1>
  {{TOP_PRODUCTS_HTML}}
  {{REWARD_SECTION_HTML}}
</body>
</html>`;

  const extractedTheme = extractTemplateTheme(emeraldCustomTemplate);
  assert.strictEqual(extractedTheme.btnBg, "#2e4a35", "Extracted custom button background color");
  assert.strictEqual(extractedTheme.btnColor, "#ffffff", "Extracted custom button text color");
  assert.strictEqual(extractedTheme.cardBg, "#f7faf7", "Extracted custom card background");
  assert.strictEqual(extractedTheme.cardBorder, "#d5e1d7", "Extracted custom card border");
  assert.strictEqual(extractedTheme.fontFamily, "'Poppins', sans-serif", "Extracted custom font family");

  const renderedWithTheme = renderMonthlyDripTemplate({
    name: "Elder Green",
    custom_html: emeraldCustomTemplate,
    ...dripDataWithProducts
  }, catalog, promo);

  // Assert that the generated {{REWARD_SECTION_HTML}} and {{TOP_PRODUCTS_HTML}} adopted the custom template colors
  assert(renderedWithTheme.includes("background-color: #f7faf7"), "Reward section adopted custom card background");
  assert(renderedWithTheme.includes("border: 1px solid #d5e1d7"), "Reward section adopted custom card border");
  assert(renderedWithTheme.includes("background-color: #2e4a35"), "Redeem button adopted custom btn-primary color");
  assert(renderedWithTheme.includes("class=\"btn-primary reward-redeem-btn\""), "Redeem button has btn-primary class to match template");
  assert(renderedWithTheme.includes("class=\"reward-section-card\""), "Reward section has semantic class");
  assert(renderedWithTheme.includes("class=\"top-products-section\""), "Top products section has semantic class");

  console.log("  [PASS] {{REWARD_SECTION_HTML}} and {{TOP_PRODUCTS_HTML}} dynamically adapt to custom template <style>");

  // Test 4: renderOutOfWindowDripTemplate supports custom template style blending
  const outOfWindowCustom = `<!DOCTYPE html>
<html>
<head>
<style>
  .btn-primary { background-color: #1e3a8a; color: #ffffff; }
  .info-card { background-color: #eff6ff; border: 1px solid #bfdbfe; }
</style>
</head>
<body>
  {{REWARD_SECTION_HTML}}
</body>
</html>`;

  const outOfWindowOutput = renderOutOfWindowDripTemplate(
    { name: "Elder OutOfWindow", points: 7, custom_html: outOfWindowCustom },
    catalog,
    promo
  );
  assert(outOfWindowOutput.includes("background-color: #eff6ff"), "Out-of-window adopted custom blue card background");
  assert(outOfWindowOutput.includes("border: 1px solid #bfdbfe"), "Out-of-window adopted custom blue border");
  assert(outOfWindowOutput.includes("background-color: #1e3a8a"), "Out-of-window adopted custom blue button");

  console.log("  [PASS] renderOutOfWindowDripTemplate dynamically adapts to custom template styles");

  // Test 5: Verify click-to-insert toolbar is cleanly removed from campaigns.html
  const viewsFile = fs.readFileSync(path.resolve('./views/campaigns.html'), 'utf8');
  const publicFile = fs.readFileSync(path.resolve('./public/campaigns.html'), 'utf8');

  for (const [name, content] of [["views/campaigns.html", viewsFile], ["public/campaigns.html", publicFile]]) {
    assert(!content.includes("class=\"tag-chip\""), `${name} cleanly removed tag-chip buttons`);
    assert(!content.includes("Granular Placeholders Assistant"), `${name} cleanly removed Granular Placeholders toolbar`);
    assert(content.includes("extractTemplateTheme"), `${name} contains extractTemplateTheme client-side`);
  }

  console.log("  [PASS] Campaigns UI files cleanly removed click-to-insert toolbar and integrated extractTemplateTheme");

  console.log("\n==================================================");
  console.log("ALL TEMPLATE STYLE BLENDING TESTS PASSED! (5/5)");
  console.log("==================================================");
}

runGranularTagTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
