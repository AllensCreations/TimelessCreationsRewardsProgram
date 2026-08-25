import 'dotenv/config';
import { sendOtpEmail } from './lib/mailer.js';

async function testBrevoEmailDispatch() {
  const targetEmail = "2ndsalviejomark2019@gmail.com";
  const testName = "Elder Salviejo (Test)";
  const testOtp = "888888";

  console.log("\n=======================================================");
  console.log("📧 STARTING BREVO EMAIL DISPATCH TESTER");
  console.log("=======================================================\n");

  console.log(`[CONFIG] Target Recipient : ${targetEmail}`);
  console.log(`[CONFIG] Recipient Name   : ${testName}`);
  console.log(`[CONFIG] Test OTP Code    : ${testOtp}`);
  console.log(`[CONFIG] Brevo API Key    : ${process.env.BREVO_API_KEY ? 'Present (***' + process.env.BREVO_API_KEY.slice(-4) + ')' : 'MISSING ❌'}`);

  if (!process.env.BREVO_API_KEY) {
    console.error("\n❌ [FAIL] BREVO_API_KEY environment variable is missing in .env!");
    process.exit(1);
  }

  console.log("\n⏳ Dispatching test email via Brevo SMTP API...");
  const result = await sendOtpEmail(targetEmail, testName, testOtp);

  console.log("\n[BREVO API RESPONSE]:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("\n✅ [SUCCESS] Brevo successfully accepted the email dispatch!");
    console.log(`📬 Please check your inbox / spam folder at: ${targetEmail}\n`);
  } else {
    console.error("\n❌ [FAIL] Brevo email dispatch failed.");
    process.exit(1);
  }
}

testBrevoEmailDispatch();
