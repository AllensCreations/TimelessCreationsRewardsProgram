import 'dotenv/config';

const TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

async function setupMessenger() {
  if (!TOKEN) {
    console.error("❌ PAGE_ACCESS_TOKEN is missing!");
    return;
  }

  // 1. Get the actual Page ID associated with this token
  console.log("Fetching Page ID...");
  const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${TOKEN}`);
  const meData = await meRes.json();
  
  if (!meData.id) {
    console.error("❌ Failed to resolve Page ID from token:", meData);
    return;
  }

  const pageId = meData.id;
  console.log(`✅ Found Page ID: ${pageId}. Registering Persistent Menu & Get Started button...`);

  // 2. Set Get Started Button & Persistent Menu using the direct Page ID path
  const profilePayload = {
    get_started: { payload: "GET_STARTED" },
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          { type: "postback", title: "🎁 Dashboard & Rewards", payload: "MENU_DASHBOARD" },
          { type: "postback", title: "❓ FAQs & Help", payload: "MENU_FAQS" },
          { type: "web_url", title: "💬 Support Inbox", url: "https://m.me/TimelessCreationsRP", whitelisted_domains: ["https://m.me/TimelessCreationsRP"] }
        ]
      }
    ]
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/messenger_profile?access_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profilePayload)
  });

  const data = await res.json();
  console.log("Messenger Profile Setup Response:", data);
}

setupMessenger();
