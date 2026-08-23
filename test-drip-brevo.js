import 'dotenv/config';
import { runSql } from './lib/db.js';

async function testDripEmailDispatch() {
  const targetEmail = "2ndsalviejomark2019@gmail.com";
  const testName = "Elder Salviejo (Drip Test)";
  const testMonth = 1;

  console.log("\n=======================================================");
  console.log("💧 STARTING MONTHLY DRIP BREVO DISPATCH TESTER");
  console.log("=======================================================\n");

  console.log(`[CONFIG] Target Recipient : ${targetEmail}`);
  console.log(`[CONFIG] Recipient Name   : ${testName}`);
  console.log(`[CONFIG] Drip Month       : ${testMonth}`);
  console.log(`[CONFIG] Brevo API Key    : ${process.env.BREVO_API_KEY ? 'Present (***' + process.env.BREVO_API_KEY.slice(-4) + ')' : 'MISSING ❌'}`);

  if (!process.env.BREVO_API_KEY) {
    console.error("\n❌ [FAIL] BREVO_API_KEY environment variable is missing in .env!");
    process.exit(1);
  }

  // Fetch Month 1 Drip from Turso database
  let dripData = {
    month: testMonth,
    theme: "Elder Jeffrey R. Holland",
    scripture: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.",
    message: "May your faith be strengthened as you serve and invite others to come unto Christ this month.",
    highlight_img: "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE",
    highlight_label: "Handcrafted Olive Scripture Case"
  };

  try {
    const rows = await runSql("SELECT * FROM drip_messages WHERE month = ? LIMIT 1", [testMonth]);
    if (rows && rows.length > 0 && rows[0].theme) {
      dripData = { ...dripData, ...rows[0] };
      console.log("✅ Loaded live drip configuration from Turso DB.");
    } else {
      console.log("ℹ️ Using default fallback drip configuration.");
    }
  } catch (err) {
    console.warn("⚠️ Could not query Turso DB, using defaults:", err.message);
  }

  // Construct HTML content matching your monthly drip template design
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Month ${dripData.month} Drip | Timeless Creations</title>
    </head>
    <body style="font-family: 'Garamond', 'Georgia', serif; background-color: #f9f7f2; margin: 0; padding: 20px; color: #1a1a1a;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e0d6bc; box-shadow: 0 15px 40px rgba(0,0,0,0.03); overflow: hidden;">
            <div style="padding: 35px 20px 15px 20px; text-align: center; background-color: #ffffff;">
                <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8px; letter-spacing: 2px; color: #b0b0b0; text-transform: uppercase; margin-bottom: 12px; display: block;">Month ${dripData.month} • Dedicated Service</span>
                <h1 style="font-size: 24px; letter-spacing: 5px; text-transform: uppercase; font-weight: 300; margin: 0; color: #1a1a1a;">Timeless Creations</h1>
                <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 1.5px; color: #8c7e5d; margin-top: 8px; text-transform: uppercase; line-height: 1.4;">Most Trusted Online LDS Store by Members and Missionaries Across the Philippines</div>
            </div>

            <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" style="width: 100%; height: auto; min-height: 160px; object-fit: cover; display: block; border: 0;">

            <div style="padding: 22px 18px; text-align: center; line-height: 1.6;">
                <div style="font-size: 19px; font-style: italic; margin-bottom: 12px; color: #1a1a1a;">Hello ${testName},</div>
                <div style="font-size: 13.5px; color: #333; margin-bottom: 18px;">${dripData.message}</div>

                <div style="margin: 18px 0; padding: 18px; background-color: #fdfbf8; border-left: 1px solid #d4c197; border-right: 1px solid #d4c197;">
                    <span style="font-size: 14px; font-style: italic; display: block; color: #1a1a1a; line-height: 1.5; margin-bottom: 8px;">"${dripData.scripture}"</span>
                    <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; color: #8c7e5d;">${dripData.theme}</div>
                </div>

                ${dripData.highlight_label ? `
                <div style="margin: 24px 0; padding: 18px; background: #faf7f0; border: 1px solid #c9a84c; border-radius: 4px;">
                    <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; display: block; margin-bottom: 8px;">⭐ Product of the Month</span>
                    <img src="${dripData.highlight_img}" style="width: 140px; height: 140px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; border: 1px solid #c9a84c; display: block; margin: 0 auto 10px auto;" alt="Highlight">
                    <div style="font-family: 'Syne', sans-serif; font-size: 12.5px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">${dripData.highlight_label}</div>
                    <a href="https://m.me/timelesscreations.06" target="_blank" style="display: inline-block; padding: 8px 18px; background: #8b1a1a; color: #fff !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; border-radius: 3px;">Inquire Item</a>
                </div>
                ` : ''}

                <div style="margin: 20px 0; padding: 12px 8px; font-style: italic; color: #8c7e5d; font-size: 12.5px; border-top: 1px double #e0d6bc; border-bottom: 1px double #e0d6bc;">
                    As you focus on your sacred work, let us handle the small details that help you present your best self to the world.
                </div>
            </div>

            <div style="padding: 28px 16px; background-color: #1a1a1a; color: #ffffff; text-align: center;">
                <div style="color: #d4c197; letter-spacing: 3px; font-size: 10px; text-transform: uppercase;">Timeless Creations</div>
                <div style="font-size: 8px; opacity: 0.5; margin-top: 10px; font-family: Arial, sans-serif;">Supporting Members & Missionaries Across the Philippines • Since 2025</div>
            </div>
        </div>
    </body>
    </html>
  `;

  console.log("⏳ Dispatching test monthly drip email via Brevo SMTP API...");
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations Rewards Program", email: "noreply.timelesscreations.ph@gmail.com" },
        to: [{ email: targetEmail, name: testName }],
        subject: `💧 TCRP Monthly Drip (Month ${dripData.month}): ${dripData.theme}`,
        htmlContent
      })
    });

    const data = await res.json();
    console.log("\n[BREVO API RESPONSE]:", JSON.stringify(data, null, 2));

    if (res.ok) {
      console.log("\n✅ [SUCCESS] Monthly Drip test email successfully dispatched via Brevo!");
      console.log(`📬 Please check your inbox / spam folder at: ${targetEmail}\n`);
    } else {
      console.error("\n❌ [FAIL] Brevo drip email dispatch failed.");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ [FAIL] Network error dispatching drip email:", err.message);
    process.exit(1);
  }
}

testDripEmailDispatch();
