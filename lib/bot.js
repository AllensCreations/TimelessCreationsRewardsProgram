import { runSql } from './db.js';

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
        message: `🛡️ 𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗\n\nTo keep our system secure and fast, your dashboard can be accessed up to 2 times per day.\n\n⏳ Your view window will automatically reset and unlock at midnight (00:00 UTC). Thank you for your dedication!` 
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

// Generate Catalog Carousel with Dynamic Button Labels & Goal Progress Bar
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
              subtitle: `Your Current Balance: ${senderPoints} Points. Check back soon for new items!`,
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

    // Visual Unicode Progress Bar: [■■□□□]
    const filledBlocks = Math.min(5, Math.round((senderPoints / itemPrice) * 5));
    const emptyBlocks = 5 - filledBlocks;
    const progressBar = "■".repeat(filledBlocks) + "□".repeat(emptyBlocks);
    const pct = Math.min(100, Math.round((senderPoints / itemPrice) * 100));

    let actionButton;
    if (canAfford) {
      actionButton = {
        type: "postback",
        title: `🎁 Claim (${itemPrice} PTS)`,
        payload: `CLAIM_ITEM_${item.id}`
      };
    } else {
      actionButton = {
        type: "postback",
        title: `⭐ Need ${pointDiff} More PTS`,
        payload: `VIEW_GOAL_${item.id}`
      };
    }

    return {
      title: item.name || "Missionary Essential",
      subtitle: `⭐ Cost: ${itemPrice} PTS | [${progressBar}] ${senderPoints}/${itemPrice} (${pct}%)\n${canAfford ? '✅ Available to claim now!' : `🔥 Need ${pointDiff} more referral point${pointDiff > 1 ? 's' : ''}!`}`,
      image_url: item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
      buttons: [
        actionButton,
        { type: "postback", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
        { type: "postback", title: "🔗 Invite a Friend", payload: "ACTION_INVITE" }
      ]
    };
  });

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: elements
      }
    }
  };
}

// Generate formatted Dashboard text message
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

  const invitePromoText = `📋 Copy and paste this message to share with your companion or friend:

"✨ Hey! Join TCRP (Timeless Creations Rewards Program) and instantly earn +1 Free Point to redeem a variety of high-quality missionary items worth ₱50 to ₱500 absolutely free! 🎁

• 🔗 𝟭-𝗧𝗮𝗽 𝗜𝗻𝘃𝗶𝘁𝗲 𝗟𝗶𝗻𝗸:
${referralLink}

(When fellow missionaries verify using your code, you BOTH receive +1 Reward Point instantly!) 🚀"`;

  return {
    dashboardText,
    invitePromoText
  };
}
