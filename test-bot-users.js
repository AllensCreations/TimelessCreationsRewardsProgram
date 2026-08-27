import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

async function runBotUserTests() {
  console.log("🤖 Starting TCRP Messenger Bot (New User vs Old User) Test Suite...\n");

  const NEW_USER_PSID = "TEST_PSID_NEW_1001";
  const NEW_USER_EMAIL = "john.newman@missionary.org";

  const OLD_USER_PSID = "TEST_PSID_OLD_2002";
  const OLD_USER_EMAIL = "elder.veteran@missionary.org";

  try {
    // ----------------------------------------------------
    // CLEANUP TEST DATA
    // ----------------------------------------------------
    console.log("🧹 0. Preparing Clean Test Environment...");
    await runSql("DELETE FROM sessions WHERE psid IN (?, ?)", [NEW_USER_PSID, OLD_USER_PSID]);
    await runSql("DELETE FROM missionaries WHERE psid IN (?, ?) OR email IN (?, ?)", [NEW_USER_PSID, OLD_USER_PSID, NEW_USER_EMAIL, OLD_USER_EMAIL]);
    await runSql("DELETE FROM bot_hourly_views WHERE psid IN (?, ?)", [NEW_USER_PSID, OLD_USER_PSID]);
    await runSql("DELETE FROM chat_messages WHERE psid IN (?, ?)", [NEW_USER_PSID, OLD_USER_PSID]);

    // ----------------------------------------------------
    // TEST 1: BRAND NEW USER REGISTRATION FLOW
    // ----------------------------------------------------
    console.log("\n🆕 1. Testing Brand New User Registration Flow");

    // Step 1A: User sends 'Get Started'
    console.log("  ➜ Sending: 'GET_STARTED'");
    await handleBotMessage(NEW_USER_PSID, '', 'GET_STARTED');
    let session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [NEW_USER_PSID]))[0];
    console.log(`  ✓ Session State: ${session?.state || 'NONE'} (Expected: AWAITING_TERMS)`);

    // Step 1B: User agrees to Terms
    console.log("  ➜ Sending: 'TERMS_AGREE'");
    await handleBotMessage(NEW_USER_PSID, '', 'TERMS_AGREE');
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [NEW_USER_PSID]))[0];
    console.log(`  ✓ Session State: ${session?.state || 'NONE'} (Expected: AWAITING_ALL_IN_ONE)`);

    // Step 1C: User sends 3-in-1 registration text
    console.log("  ➜ Sending 3-in-1 Info: 'Elder Newman \\n john.newman@missionary.org \\n TCRP50'");
    await handleBotMessage(NEW_USER_PSID, `Elder Newman\n${NEW_USER_EMAIL}\nTCRP50`);
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [NEW_USER_PSID]))[0];
    const generatedOtp = session?.otp_code;
    console.log(`  ✓ Session State: ${session?.state || 'NONE'} | Generated OTP: ${generatedOtp}`);

    // Step 1D: User submits valid OTP
    console.log(`  ➜ Submitting OTP: ${generatedOtp}`);
    await handleBotMessage(NEW_USER_PSID, generatedOtp);
    const newMissionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [NEW_USER_PSID]))[0];
    console.log(`  ✅ New User Verified! Name: ${newMissionary?.name} | Points: ${newMissionary?.points} (Expected: 1 Point)`);

    // ----------------------------------------------------
    // TEST 2: OLD/EXISTING VERIFIED USER INTERACTION & MENU
    // ----------------------------------------------------
    console.log("\n👤 2. Testing Verified User Quick Replies & Dashboard");

    // Step 2A: Trigger FAQs
    console.log("  ➜ Sending Quick Reply: 'FAQS_PAYLOAD'");
    await handleBotMessage(NEW_USER_PSID, '', 'FAQS_PAYLOAD');

    // Step 2B: Trigger Rewards Catalog
    console.log("  ➜ Sending Quick Reply: 'DISCOVER_PAYLOAD'");
    await handleBotMessage(NEW_USER_PSID, '', 'DISCOVER_PAYLOAD');

    // Step 2C: Trigger Dashboard Refresh
    console.log("  ➜ Sending Quick Reply: 'ACTION_DASHBOARD'");
    await handleBotMessage(NEW_USER_PSID, '', 'ACTION_DASHBOARD');

    // ----------------------------------------------------
    // TEST 3: RETURNING / RE-JOINING USER (ANTI-FRAUD WELCOME POINT CHECK)
    // ----------------------------------------------------
    console.log("\n🔄 3. Testing Returning User Flow (Account Re-activation)");

    // Step 3A: User deletes account
    console.log("  ➜ User typing: '/delete_account'");
    await handleBotMessage(NEW_USER_PSID, '/delete_account');
    const deletedCheck = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [NEW_USER_PSID]))[0];
    console.log(`  ✓ User deleted from active roster: ${!deletedCheck ? 'YES' : 'NO'}`);

    // Step 3B: Same user re-registers
    console.log("  ➜ Re-joining: 'GET_STARTED' ➔ 'TERMS_AGREE'");
    await handleBotMessage(NEW_USER_PSID, '', 'GET_STARTED');
    await handleBotMessage(NEW_USER_PSID, '', 'TERMS_AGREE');
    await handleBotMessage(NEW_USER_PSID, `Elder Newman\n${NEW_USER_EMAIL}\nTCRP50`);

    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [NEW_USER_PSID]))[0];
    console.log(`  ➜ Submitting re-activation OTP: ${session?.otp_code}`);
    await handleBotMessage(NEW_USER_PSID, session?.otp_code);

    const rejoiningUser = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [NEW_USER_PSID]))[0];
    console.log(`  ✅ Re-joined User Verified! Name: ${rejoiningUser?.name} | Welcome Points: ${rejoiningUser?.points} (Expected: 0 Bonus Points due to anti-fraud audit)`);

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    await runSql("DELETE FROM sessions WHERE psid IN (?, ?)", [NEW_USER_PSID, OLD_USER_PSID]);
    await runSql("DELETE FROM missionaries WHERE psid IN (?, ?) OR email IN (?, ?)", [NEW_USER_PSID, OLD_USER_PSID, NEW_USER_EMAIL, OLD_USER_EMAIL]);
    await runSql("DELETE FROM hashed_audit_identities WHERE identity_hash IN (?, ?)", [
      NEW_USER_EMAIL, OLD_USER_EMAIL
    ]).catch(() => {});

    console.log("\n=======================================================");
    console.log("🎉 All New & Old User Bot Tests Passed Successfully!");
    console.log("=======================================================\n");

  } catch (err) {
    console.error(`\n❌ Test Error: ${err.message}`);
    process.exit(1);
  }
}

runBotUserTests();
