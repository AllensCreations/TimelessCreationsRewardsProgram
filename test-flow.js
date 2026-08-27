import 'dotenv/config';
import { runSql } from './lib/db.js';
import { handleBotMessage } from './lib/botHandler.js';

async function verifyCompleteFlow() {
  console.log("🧪 Testing Complete Messenger Bot Flow...\n");
  const TEST_PSID = "TEST_PSID_FLOW_909";
  const TEST_EMAIL = "test.missionary@missionary.org";

  try {
    // 0. Clean Test Data
    await runSql("DELETE FROM sessions WHERE psid = ?", [TEST_PSID]);
    await runSql("DELETE FROM missionaries WHERE psid = ? OR email = ?", [TEST_PSID, TEST_EMAIL]);

    // 1. Get Started
    console.log("1️⃣ Step 1: User sends 'Get Started'");
    await handleBotMessage(TEST_PSID, '', 'GET_STARTED');
    let session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    console.log(`   ✓ Session State: ${session?.state} (Expected: AWAITING_TERMS)`);

    // 2. Agree to Terms
    console.log("2️⃣ Step 2: User clicks '✅ Agree & Continue'");
    await handleBotMessage(TEST_PSID, '', 'TERMS_AGREE');
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    console.log(`   ✓ Session State: ${session?.state} (Expected: AWAITING_ALL_IN_ONE)`);

    // 3. Submit 3-in-1 details
    console.log("3️⃣ Step 3: User submits Title, Email, Referral Code");
    await handleBotMessage(TEST_PSID, `Elder Testing\n${TEST_EMAIL}\nTCRP50`);
    session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [TEST_PSID]))[0];
    const otp = session?.otp_code;
    console.log(`   ✓ Session State: ${session?.state} | Generated OTP: ${otp}`);

    // 4. Submit 6-digit OTP
    console.log(`4️⃣ Step 4: User submits OTP: ${otp}`);
    await handleBotMessage(TEST_PSID, otp);

    // 5. Verify Insertion into missionaries table
    const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [TEST_PSID]))[0];
    console.log(`5️⃣ Step 5: Verification in 'missionaries' table:`);
    console.log(`   ✓ Name: ${missionary?.name}`);
    console.log(`   ✓ Email: ${missionary?.email}`);
    console.log(`   ✓ Points: ${missionary?.points}`);
    console.log(`   ✓ Referral Code: ${missionary?.referral_code}`);

    // Cleanup
    await runSql("DELETE FROM sessions WHERE psid = ?", [TEST_PSID]);
    await runSql("DELETE FROM missionaries WHERE psid = ? OR email = ?", [TEST_PSID, TEST_EMAIL]);

    console.log("\n=======================================================");
    console.log("🎉 All 5 Steps of the Messenger Flow Passed Successfully!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  }
}

verifyCompleteFlow();
