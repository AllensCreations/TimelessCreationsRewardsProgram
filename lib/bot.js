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

    await runSql(`
      INSERT INTO bot_daily_views (sender_id, view_date, view_count) 
      VALUES (?, ?, 0) 
      ON CONFLICT(sender_id, view_date) DO NOTHING
    `, [senderId, todayStr]);

    const res = await runSql(`
      UPDATE bot_daily_views 
      SET view_count = view_count + 1 
      WHERE sender_id = ? AND view_date = ? AND view_count < 2
      RETURNING view_count
    `, [senderId, todayStr]);

    const rows = Array.isArray(res) ? res : (res?.rows || []);
    if (!rows || rows.length === 0) {
      return { 
        allowed: false, 
        message: `🛡️ 𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗\n\nTo keep our system fast and secure, your dashboard can be accessed up to 2 times per day.\n\n⏳ Your access window will reset at midnight (00:00 UTC). Thank you for your dedication!` 
      };
    }

    const currentCount = rows[0]?.view_count || 1;
    return { allowed: true, remaining: 2 - currentCount };
  } catch (err) {
    console.error("Rate limit check error:", err);
    return { allowed: true };
  }
}

// Single Fixed Quick Reply
export const FIXED_QUICK_REPLIES = [
  {
    content_type: "text",
    title: "📊 Dashboard",
    payload: "ACTION_DASHBOARD"
  }
];

// Unified Dashboard + Copyable Invite Text
export function buildDashboardPayload(missionary, referralLink) {
  const name = missionary.name || "Missionary";
  const email = missionary.email || "Not linked yet";
  const points = missionary.points || 0;

  const combinedText = `📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗

👤 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻:
• ${name}
• ${email}

⭐ 𝗣𝗼𝗶𝗻𝘁𝘀 𝗕𝗮𝗹𝗮𝗻𝗰𝗲:
• ${points} Points

━━━━━━━━━━━━━━━━━━━
💌 𝗜𝗻𝘃𝗶𝘁𝗲 𝗮 𝗙𝗿𝗶𝗲𝗻𝗱 & 𝗘𝗮𝗿𝗻 +𝟭 𝗣𝗧

Copy and send this to your companion or fellow missionary:

"✨ Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality missionary essentials worth ₱50 to ₱500! 🎁

Join here: ${referralLink}

(When you join using my code, we BOTH receive +1 Reward Point instantly!) 🚀"`;

  return { 
    text: combinedText,
    quick_replies: FIXED_QUICK_REPLIES
  };
}

// Reward Carousel with 1:1 Square Image Aspect Ratio & 1 Button per card
export async function buildCatalogCarousel(senderPoints = 0, products = []) {
  if (!products || products.length === 0) {
    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          image_aspect_ratio: "square",
          elements: [
            {
              title: "🌟 TCRP REWARD CATALOG",
              subtitle: `Your Current Balance: ${senderPoints} Points. New rewards arriving soon!`,
              image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
              buttons: [
                { type: "postback", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
              ]
            }
          ]
        }
      },
      quick_replies: FIXED_QUICK_REPLIES
    };
  }

  const elements = products.slice(0, 10).map(item => {
    const itemPrice = Math.round(Number(item.price) || 0);
    const canAfford = senderPoints >= itemPrice;
    const pointDiff = itemPrice - senderPoints;

    const actionButton = canAfford ? {
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
      subtitle: `⭐ Cost: ${itemPrice} PTS\n${canAfford ? '✅ Available to claim now!' : `🔥 Need ${pointDiff} more referral point${pointDiff > 1 ? 's' : ''}`}`,
      image_url: item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
      buttons: [actionButton]
    };
  });

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        image_aspect_ratio: "square",
        elements
      }
    },
    quick_replies: FIXED_QUICK_REPLIES
  };
}
