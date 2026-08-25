import 'dotenv/config';

const TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

async function runLiveDiagnostics() {
  console.log("🔍 Running Live Messenger Bot Diagnostics...\n");

  if (!TOKEN) {
    console.error("❌ ERROR: PAGE_ACCESS_TOKEN is missing from your .env file!");
    return;
  }

  // 1. Check Page Token & Name
  try {
    const pageRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${TOKEN}`);
    const pageData = await pageRes.json();
    
    if (pageData.error) {
      console.error("❌ Token Authentication Failed:", pageData.error.message);
      return;
    }
    console.log(`✅ Page Connected Successfully: [ ${pageData.name} ] (ID: ${pageData.id})`);
  } catch (err) {
    console.error("❌ Network error connecting to Graph API:", err.message);
    return;
  }

  // 2. Check Messenger Subscribed Apps / Webhook status
  try {
    const subRes = await fetch(`https://graph.facebook.com/v19.0/me/subscribed_apps?access_token=${TOKEN}`);
    const subData = await subRes.json();
    console.log("📡 Webhook App Subscriptions Check:", JSON.stringify(subData, null, 2));
    
    if (!subData.data || subData.data.length === 0) {
      console.warn("⚠️ WARNING: No apps are subscribed to this page's webhook events! This is why sending messages gives no response.");
    } else {
      console.log("✅ Page has active app subscriptions for webhooks.");
    }
  } catch (err) {
    console.log("⚠️ Could not verify app subscriptions directly:", err.message);
  }

  console.log("\n--- DIAGNOSTIC COMPLETE ---");
}

runLiveDiagnostics();
