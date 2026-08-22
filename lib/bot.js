import { runSql } from './db.js';

// Helper to check and enforce anti-spam dashboard view limits (Max 2 views per day)
export async function checkDashboardRateLimit(senderId) {
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_daily_views (
        sender_id TEXT,
        view_date TEXT,
        view_count INTEGER DEFAULT 0,
        PRIMARY KEY (sender_id, view_date)
      )
    `);

    const todayStr = new Date().toISOString().split('T')[0];
    let record = (await runSql("SELECT view_count FROM bot_daily_views WHERE sender_id = ? AND view_date = ?", [senderId, todayStr]))[0];

    let count = record ? record.view_count : 0;
    if (count >= 2) {
      return { 
        allowed: false, 
        message: `🛡️ 𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗\n\nTo keep our system secure and fast, your dashboard can be accessed up to **2 times per day**.\n\n⏳ Your view window will automatically reset and unlock at **midnight (00:00 UTC)**.` 
      };
    }

    if (record) {
      await runSql("UPDATE bot_daily_views SET view_count = view_count + 1 WHERE sender_id = ? AND view_date = ?", [senderId, todayStr]);
    } else {
      await runSql("INSERT INTO bot_daily_views (sender_id, view_date, view_count) VALUES (?, ?, 1)", [senderId, todayStr]);
    }

    return { allowed: true, remaining: 2 - (count + 1) };
  } catch (err) {
    console.error("Rate limit check error:", err);
    return { allowed: true };
  }
}

// Generate Catalog Carousel with Dynamic Button Labels
export async function buildCatalogCarousel(senderPoints = 0, products = []) {
  if (!products || products.length === 0) {
    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "🌟 TCRP REWARD CATALOG",
              subtitle: `Your Current Balance: ${senderPoints} Points.`,
              image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
              buttons: [
                { type: "postback", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
                { type: "postback", title: "🔗 Invite a Friend", payload: "ACTION_INVITE" }
              ]
            }
          ]
        }
      }
    };
  }

  const elements = products.slice(0, 10).map(item => {
    const itemPrice = Number(item.price) || 5;
    const canAfford = senderPoints >= itemPrice;
    const pointDiff = itemPrice - senderPoints;

    let actionButton = canAfford ? {
      type: "postback",
      title: `🎁 Claim (${itemPrice} PTS)`,
      payload: `CLAIM_ITEM_${item.id}`
    } : {
      type: "postback",
      title: `⭐ Need ${pointDiff} More PTS`,
      payload: `VIEW_GOAL_${item.id}`
    };

    return {
      title: item.name || "Missionary Essential",
      subtitle: `⭐ Cost: ${itemPrice} PTS | Balance: ${senderPoints} PTS\n${canAfford ? '✅ Available to claim!' : `🔥 Need ${pointDiff} more points!`}`,
      image_url: item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
      buttons: [
        actionButton,
        { type: "postback", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
        { type: "postback", title: "🔗 Invite a Friend", payload: "ACTION_INVITE" }
      ]
    };
  });

  return { attachment: { type: "template", payload: { template_type: "generic", elements } } };
}

// Exact requested Unicode dashboard format and promotional copy generator
export function buildDashboardPayload(missionary, referralLink) {
  const name = missionary.name || "Missionary";
  const email = missionary.email || "missionary@mission.org";
  const points = missionary.points || 0;

  const dashboardText = `📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗

👤 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻:
• ${name}
• ${email}

⭐ 𝗣𝗼𝗶𝗻𝘁𝘀 𝗕𝗮𝗹𝗮𝗻𝗰𝗲:
• ${points} Points`;

  const invitePromoText = `Hey, Join TCRP and get 1 Points to redeem variety types of free Items, worth 50php-500php! 🎁

• 1-Tap Invite Link:
${referralLink}

(When fellow missionaries verify using your code, you BOTH receive +1 Reward Point!)`;

  return {
    dashboardText,
    invitePromoText
  };
}
