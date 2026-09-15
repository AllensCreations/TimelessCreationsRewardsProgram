import { runSql } from '../lib/db.js';
import { handlePromoRedeem, handleBotMessage } from '../lib/botHandler.js';
import { handleCatalogAction } from '../lib/handlers/catalogHandler.js';
import { handleSystemAction } from '../lib/handlers/systemHandler.js';

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    failed++;
  }
}

async function run() {
  console.log("==================================================");
  console.log("TEST SUITE: Remaining This Month & Security Fixes");
  console.log("==================================================");

  // Test 1: get_stats returns remaining_this_month
  console.log("\n📊 [Test 1] get_stats remaining_this_month verification");
  const statsRes = await handleSystemAction('get_stats', {}, {}, {}, {});
  assert(statsRes?.status === 200, "get_stats returned 200 OK");
  assert(statsRes?.json?.stats?.remaining_this_month !== undefined, "stats.remaining_this_month is present");
  console.log(`     remaining_this_month: ${statsRes?.json?.stats?.remaining_this_month}`);
  assert(typeof statsRes?.json?.stats?.remaining_this_month === 'number', "remaining_this_month is a number");

  // Test 2: Order cancellation points refund
  console.log("\n💰 [Test 2] Order cancellation & deletion points refund");
  const testEmail = `refund.test.${Date.now()}@missionary.org`;
  const testOrderId = `TEST_ORD_${Date.now()}`;
  await runSql("INSERT INTO missionaries (email, name, points, status) VALUES (?, ?, ?, 'active')", [testEmail, 'Elder Refund', 5]);
  
  // Missionary starts with 5 points, creates order costing 2 points
  await runSql("UPDATE missionaries SET points = 3 WHERE LOWER(email) = LOWER(?)", [testEmail]);
  await runSql("INSERT INTO orders (order_id, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, 'PENDING')", [
    testOrderId, testEmail, 'Elder Refund', 'Custom CTR Ring', 2
  ]);

  // Cancel order -> should refund 2 points back to missionary
  const cancelRes = await handleCatalogAction('update_order_status', {}, { order_id: testOrderId, status: 'CANCELLED' });
  assert(cancelRes?.status === 200, "update_order_status to CANCELLED returned 200");
  
  const mAfterCancel = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]))[0];
  assert(mAfterCancel?.points === 5, `Missionary points refunded from 3 to 5 (got ${mAfterCancel?.points})`);

  // Un-cancel order -> should deduct 2 points back
  await handleCatalogAction('update_order_status', {}, { order_id: testOrderId, status: 'PENDING' });
  const mAfterReopen = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]))[0];
  assert(mAfterReopen?.points === 3, `Missionary points re-deducted from 5 to 3 on uncancel (got ${mAfterReopen?.points})`);

  // Delete pending order -> should refund 2 points
  const delRes = await handleCatalogAction('delete_order', {}, { order_id: testOrderId });
  assert(delRes?.status === 200, "delete_order returned 200");
  const mAfterDelete = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]))[0];
  assert(mAfterDelete?.points === 5, `Missionary points refunded from 3 to 5 on deletion (got ${mAfterDelete?.points})`);

  // Clean up
  await runSql("DELETE FROM missionaries WHERE LOWER(email) = LOWER(?)", [testEmail]);
  await runSql("DELETE FROM orders WHERE order_id = ?", [testOrderId]);

  // Test 3: Promo code duplicate redemption check with email & psid
  console.log("\n🎟️ [Test 3] Promo code duplicate redemption protection");
  const promoCode = `TESTPROMO_${Date.now()}`;
  await runSql("INSERT INTO promo_codes (code, points, max_users, claimed_count) VALUES (?, 2, 5, 0)", [promoCode]);
  
  const promoPsid1 = `PROMO_PSID_1_${Date.now()}`;
  const promoEmail1 = `promotest.${Date.now()}@missionary.org`;
  await runSql("INSERT INTO missionaries (email, name, points, psid, status) VALUES (?, ?, ?, ?, 'active')", [
    promoEmail1, 'Elder Promo', 1, promoPsid1
  ]);

  const missionaryObj = { email: promoEmail1, name: 'Elder Promo', psid: promoPsid1 };
  
  // First claim -> should succeed
  await handlePromoRedeem(promoPsid1, missionaryObj, promoCode);
  const mAfterClaim1 = (await runSql("SELECT points FROM missionaries WHERE psid = ?", [promoPsid1]))[0];
  assert(mAfterClaim1?.points === 3, `Missionary points increased from 1 to 3 (+2 points) (got ${mAfterClaim1?.points})`);

  // Second claim with same PSID -> should be rejected
  await handlePromoRedeem(promoPsid1, missionaryObj, promoCode);
  const mAfterClaim2 = (await runSql("SELECT points FROM missionaries WHERE psid = ?", [promoPsid1]))[0];
  assert(mAfterClaim2?.points === 3, `Duplicate claim by PSID was rejected, points remain 3 (got ${mAfterClaim2?.points})`);

  // Third claim with different PSID but same EMAIL -> should be rejected
  const promoPsid2 = `PROMO_PSID_2_${Date.now()}`;
  await handlePromoRedeem(promoPsid2, missionaryObj, promoCode);
  const mAfterClaim3 = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [promoEmail1]))[0];
  assert(mAfterClaim3?.points === 3, `Duplicate claim by same email on new PSID was rejected, points remain 3 (got ${mAfterClaim3?.points})`);

  // Clean up
  await runSql("DELETE FROM promo_codes WHERE UPPER(code) = ?", [promoCode]);
  await runSql("DELETE FROM promo_redemptions WHERE UPPER(code) = ?", [promoCode]);
  // Test 4: Referral re-verification exploit prevention & next_send_date population
  console.log("\n👥 [Test 4] Referral re-verification exploit prevention & next_send_date");
  const referrerPsid = `REF_OWNER_${Date.now()}`;
  const referrerEmail = `refowner.${Date.now()}@missionary.org`;
  const testRefCode = `REF${Math.floor(1000 + Math.random() * 9000)}`;
  await runSql("INSERT INTO missionaries (email, name, points, psid, referral_code, status) VALUES (?, ?, 5, ?, ?, 'active')", [
    referrerEmail, 'Elder Referrer', referrerPsid, testRefCode
  ]);

  // Existing missionary re-verifying with referral code in session
  const existingEmail = `existing.missionary.${Date.now()}@missionary.org`;
  await runSql("INSERT INTO missionaries (email, name, points, status) VALUES (?, 'Elder Existing', 1, 'active')", [existingEmail]);

  const reVerifyPsid = `REVERIFY_PSID_${Date.now()}`;
  await runSql("INSERT INTO sessions (psid, state, invite_code, temp_title, temp_email, temp_batch, otp_code) VALUES (?, 'AWAITING_OTP', ?, ?, ?, 'December 2026', '999888')", [
    reVerifyPsid, testRefCode, 'Elder Existing', existingEmail
  ]);

  // Submit OTP
  await handleBotMessage(reVerifyPsid, '999888');

  // Check referrer points - MUST STILL BE 5 (not 6) because existingEmail already existed in DB!
  const referrerAfterReverify = (await runSql("SELECT points FROM missionaries WHERE psid = ?", [referrerPsid]))[0];
  assert(referrerAfterReverify?.points === 5, `Referrer points NOT increased on re-verification of existing missionary (expected 5, got ${referrerAfterReverify?.points})`);

  // Now verify with brand new missionary
  const newEmail = `brandnew.missionary.${Date.now()}@missionary.org`;
  const brandNewPsid = `BRANDNEW_PSID_${Date.now()}`;
  await runSql("INSERT INTO sessions (psid, state, invite_code, temp_title, temp_email, temp_batch, otp_code) VALUES (?, 'AWAITING_OTP', ?, ?, ?, 'December 2026', '777666')", [
    brandNewPsid, testRefCode, 'Elder Brand New', newEmail
  ]);

  await handleBotMessage(brandNewPsid, '777666');

  const referrerAfterNew = (await runSql("SELECT points FROM missionaries WHERE psid = ?", [referrerPsid]))[0];
  assert(referrerAfterNew?.points === 6, `Referrer points increased (+1) for brand new missionary (expected 6, got ${referrerAfterNew?.points})`);

  // Check that next_send_date was populated for December 2026 cohort (Month 1 is 2027-01)
  const newRec = (await runSql("SELECT next_send_date FROM missionaries WHERE email = ?", [newEmail]))[0];
  assert(Boolean(newRec?.next_send_date), `next_send_date is populated for new missionary (${newRec?.next_send_date})`);
  assert(newRec?.next_send_date === '2027-01', `next_send_date matches Month 1 dispatch for December 2026 cohort (expected 2027-01, got ${newRec?.next_send_date})`);

  // Cleanup Test 4
  await runSql("DELETE FROM missionaries WHERE email IN (?, ?, ?)", [referrerEmail, existingEmail, newEmail]);

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
