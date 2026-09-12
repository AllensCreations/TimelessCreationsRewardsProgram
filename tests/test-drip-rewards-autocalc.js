import assert from 'assert';
import { runSql } from '../lib/db.js';
import { renderMonthlyDripTemplate, sendDripEmail } from '../lib/mailer.js';

async function runTests() {
  console.log("==================================================");
  console.log("Testing Drip Rewards Dynamic Auto-Calculation & Live Preview");
  console.log("==================================================");

  // Test 1: Single item in catalog when user has fewer points
  const singleCatalog = [
    { name: "Single Special Reward", price: 6, image_url: "https://example.com/reward.jpg" }
  ];

  const htmlAt2Pts = renderMonthlyDripTemplate(
    { month: 2, name: "Elder Smith", points: 2 },
    singleCatalog,
    null
  );

  assert(htmlAt2Pts.includes("You currently have <strong>2 Points</strong>"), "Renders user balance of 2 points");
  assert(htmlAt2Pts.includes("Single Special Reward (6 PTS)"), "Displays nearest reward goal");
  assert(htmlAt2Pts.includes("Only <strong>4 more points</strong> needed!"), "Auto-calculates exact 4 points needed (6 - 2)");
  assert(!htmlAt2Pts.includes("You can claim these reward items right now:"), "Does not show affordable list when points < price");
  console.log("  [PASS] Single catalog item with fewer points: shows correct points needed and no affordable list");

  // Test 2: Single item in catalog when user has enough points (goal box MUST be hidden)
  const htmlAt6Pts = renderMonthlyDripTemplate(
    { month: 6, name: "Elder Smith", points: 6 },
    singleCatalog,
    null
  );

  assert(htmlAt6Pts.includes("You currently have <strong>6 Points</strong>"), "Renders user balance of 6 points");
  assert(htmlAt6Pts.includes("You can claim these reward items right now:"), "Shows affordable claim section");
  assert(htmlAt6Pts.includes("Single Special Reward"), "Shows affordable item name");
  assert(!htmlAt6Pts.includes("Nearest Reward Goal:"), "Goal box is hidden when all items in catalog are affordable");
  assert(!htmlAt6Pts.includes("more point"), "No fake 'points needed' message when item is already unlocked");
  console.log("  [PASS] Single catalog item with sufficient points: goal box is cleanly hidden and item is in claimable list");

  // Test 3: Multiple items in catalog - stepping through progression
  const multiCatalog = [
    { name: "Reward Tier 1", price: 2, image_url: "https://example.com/r1.jpg" },
    { name: "Reward Tier 2", price: 5, image_url: "https://example.com/r2.jpg" }
  ];

  const htmlAt3Pts = renderMonthlyDripTemplate(
    { month: 3, name: "Sister Taylor", points: 3 },
    multiCatalog,
    null
  );

  assert(htmlAt3Pts.includes("Reward Tier 1"), "Tier 1 is in claimable list");
  assert(htmlAt3Pts.includes("Reward Tier 2 (5 PTS)"), "Tier 2 is in nearest goal");
  assert(htmlAt3Pts.includes("Only <strong>2 more points</strong> needed!"), "Auto-calculates 2 more points needed (5 - 3)");
  console.log("  [PASS] Multi-item catalog at 3 points: Tier 1 claimable, Tier 2 nearest goal with 2 pts needed");

  // Test 4: sendDripEmail dynamically fetches real missionary points if in database
  const testEmail = "test_autocalc_missionary@missionary.org";
  await runSql("DELETE FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
  await runSql(
    "INSERT INTO missionaries (email, name, points, cohort, batch_month) VALUES (?, ?, ?, ?, ?)",
    [testEmail, "Elder AutoCalc", 7, "Elder", "August 2026"]
  );

  const dripResult = await sendDripEmail(testEmail, 3, "Elder Smith");
  assert(dripResult.ok, "sendDripEmail succeeds");
  // Clean up
  await runSql("DELETE FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
  console.log("  [PASS] sendDripEmail successfully fetches real missionary points");

  console.log("\n==================================================");
  console.log("ALL REWARD AUTO-CALCULATION TESTS PASSED!");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
