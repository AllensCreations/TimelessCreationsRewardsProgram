import fs from 'fs';
import path from 'path';

// Load environment variables if running locally with dotenv, or fallback to process.env
const apiKey = (process.env.BREVO_API_KEY || '').trim();
const senderEmail = (process.env.BREVO_EMAIL || process.env.SENDER_EMAIL || 'support@timelesscreationsrp.com').trim();

console.log("==================================================");
console.log("🔍 TCRP BREVO EMAIL DIAGNOSTIC RUNNER");
console.log("==================================================");
console.log("🔑 API Key Present?:", apiKey ? "YES (" + apiKey.slice(0, 6) + "...)" : "NO ❌");
console.log("📧 Sender Email:", senderEmail);
console.log("==================================================");

async function testSend() {
  if (!apiKey) {
    console.error("❌ ERROR: BREVO_API_KEY is missing from your environment variables.");
    return;
  }

  const recipient = "2ndsalviejomark2019@gmail.com";
  console.log(`🚀 Attempting to send test email to ${recipient} via Brevo API...`);

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations", email: senderEmail },
        to: [{ email: recipient, name: "Mark Allen" }],
        subject: "TCRP Diagnostic Test Email",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #c9a84c; border-radius: 8px;">
            <h2 style="color: #8b1a1a;">✨ TCRP Email Diagnostic Success! ✨</h2>
            <p>If you are reading this, your <strong>Brevo API key</strong> and <strong>BREVO_EMAIL</strong> variable configuration are working perfectly.</p>
          </div>
        `
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log("✅ SUCCESS! Brevo accepted the email request.");
      console.log("📨 Message ID:", data.messageId || data);
    } else {
      console.error("❌ BREVO REJECTED THE REQUEST:");
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("❌ NETWORK ERROR DURING FETCH:", err.message);
  }
}

testSend();
