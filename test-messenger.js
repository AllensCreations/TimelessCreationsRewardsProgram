import 'dotenv/config';

const TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

async function testMessenger() {
  console.log("🧪 Running Messenger API Connection Test...");
  
  if (!TOKEN) {
    console.error("❌ PAGE_ACCESS_TOKEN is missing in .env!");
    return;
  }

  // Fetch Page Info to confirm token validity and page connection
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${TOKEN}`);
    const data = await res.json();
    
    if (data.id) {
      console.log(`✅ Success! Connected to Facebook Page ID: ${data.id} (${data.name || 'Timeless Creations'})`);
    } else {
      console.error("❌ Connection failed:", data);
    }
  } catch (err) {
    console.error("❌ Network error during test:", err.message);
  }
}

testMessenger();
