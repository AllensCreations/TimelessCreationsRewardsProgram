import 'dotenv/config';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;

if (!PAGE_ACCESS_TOKEN) {
  console.error("❌ Error: Missing PAGE_ACCESS_TOKEN in environment.");
  process.exit(1);
}

async function setupPersistentMenu() {
  const url = `https://graph.facebook.com/v19.0/me/custom_user_settings?access_token=${PAGE_ACCESS_TOKEN}`;

  const payload = {
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            type: "postback",
            title: "📊 My Dashboard",
            payload: "ACTION_DASHBOARD"
          },
          {
            type: "postback",
            title: "🛍️ Rewards Catalog",
            payload: "DISCOVER_PAYLOAD"
          },
          {
            type: "postback",
            title: "📖 Help & FAQs",
            payload: "FAQS_PAYLOAD"
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.result === "success") {
      console.log("✅ Messenger Persistent Menu configured successfully!");
    } else {
      console.log("Response:", data);
    }
  } catch (err) {
    console.error("Failed to setup persistent menu:", err.message);
  }
}

setupPersistentMenu();
