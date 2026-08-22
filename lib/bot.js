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

// Fixed Quick Reply Chips for sticky bottom access
export const FIXED_QUICK_REPLIES = [
  {
    content_type: "text",
    title: "📊 Dashboard",
    payload: "ACTION_DASHBOARD"
  },
  {
    content_type: "text",
    title: "🔗 Invite a Friend",
    payload: "ACTION_INVITE"
  },
  {
    content_type: "text",
    title: "🌟 View Catalog",
    payload: "ACTION_CATALOG"
  }
];

// Carousel with exactly 1 primary Action Button per card and clean subtitles (no progress bars)
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
              subtitle: `Your Current Balance: ${senderPoints} Points. New items arriving soon!`,
              image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
              buttons: [
                { type: "postback", title: "📊 Open Dashboard", payload: "ACTION_DASHBOARD" }
              ]
            }
          ]
        }
      },
      quick_replies: FIXED_QUICK_REPLIES
    };
  }

  const elements = products.slice(0, 10).map(item => {
    const itemPrice = Number(item.price) || 5;
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
      subtitle: `⭐ Cost: ${itemPrice} PTS\n${canAfford ? '✅ Available to claim now!' : `🔥 Need ${pointDiff} more referral point${pointDiff > 1 ? 's' : ''} to unlock`}`,
      image_url: item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
      buttons: [
        actionButton
      ]
    };
  });

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements
      }
    },
    quick_replies: FIXED_QUICK_REPLIES
  };
}

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
    invitePromoText,
    quick_replies: FIXED_QUICK_REPLIES
  };
}
