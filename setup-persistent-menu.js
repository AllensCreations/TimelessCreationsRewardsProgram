import fs from 'fs';

if (fs.existsSync('.env') && !process.env.PAGE_ACCESS_TOKEN) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|['"]$/g, '');
  });
}

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();

async function setPersistentMenu() {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("❌ Error: PAGE_ACCESS_TOKEN is missing in environment variables.");
    return;
  }

  console.log("📡 Configuring Meta Messenger Persistent Menu...");
  
  const payload = {
    get_started: {
      payload: "GET_STARTED"
    },
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            type: "postback",
            title: "🛍️ Discover",
            payload: "DISCOVER_PAYLOAD"
          },
          {
            type: "postback",
            title: "✨ About TCRP",
            payload: "MENU_ABOUT_PAYLOAD"
          },
          {
            type: "postback",
            title: "📜 Terms & Conditions",
            payload: "MENU_TC_PAYLOAD"
          },
          {
            type: "postback",
            title: "🔒 Privacy Policy",
            payload: "MENU_PRIVACY_PAYLOAD"
          }
        ]
      }
    ]
  };

  const res = await fetch(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.result === "success") {
    console.log("✅ Persistent Menu successfully configured on Facebook Messenger!");
  } else {
    console.error("❌ Failed to set Persistent Menu:", JSON.stringify(data));
  }
}

setPersistentMenu();
