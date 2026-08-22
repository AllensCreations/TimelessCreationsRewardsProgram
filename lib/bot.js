import { runSql } from './db.js';

export async function checkDashboardRateLimit(senderId) {
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_daily_views (
        sender_id TEXT,
        view_date TEXT,
        view_count INTEGER DEFAULT 0,
        warned INTEGER DEFAULT 0,
        PRIMARY KEY (sender_id, view_date)
      )
    `);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Calculate time remaining until 00:00 UTC midnight
    const nextMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const diffMs = nextMidnightUtc.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeFormatted = `${diffHrs}h ${diffMins}m`;

    await runSql(`
      INSERT INTO bot_daily_views (sender_id, view_date, view_count, warned) 
      VALUES (?, ?, 0, 0) 
      ON CONFLICT(sender_id, view_date) DO NOTHING
    `, [senderId, todayStr]);

    // Atomic increment if under limit
    const res = await runSql(`
      UPDATE bot_daily_views 
      SET view_count = view_count + 1 
      WHERE sender_id = ? AND view_date = ? AND view_count < 2
      RETURNING view_count
    `, [senderId, todayStr]);

    const rows = Array.isArray(res) ? res : (res?.rows || []);

    // Rate limit hit (view_count >= 2)
    if (!rows || rows.length === 0) {
      // Check if user has already received the rate limit warning today
      const userState = (await runSql(
        "SELECT warned FROM bot_daily_views WHERE sender_id = ? AND view_date = ? LIMIT 1",
        [senderId, todayStr]
      ))[0];

      // If already warned, stay silent (prevent spam response loops)
      if (userState && Number(userState.warned) === 1) {
        return { allowed: false, shouldMute: true };
      }

      // Mark user as warned for today
      await runSql(
        "UPDATE bot_daily_views SET warned = 1 WHERE sender_id = ? AND view_date = ?",
        [senderId, todayStr]
      );

      const limitMsg = `🛡️ 𝗗𝗔𝗜𝗟𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗\n\nYou have used your 2 daily dashboard views.\n\n⏳ 𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻 𝗔𝗰𝘁𝗶𝘃𝗲:\nThe bot will pause automated replies to dashboard requests for your account until:\n👉 𝟬𝟬:𝟬𝟬 𝗨𝗧𝗖 (𝗶𝗻 ${timeFormatted})\n\nThank you for your dedication and service!`;

      return { 
        allowed: false, 
        shouldMute: false,
        message: limitMsg 
      };
    }

    const currentCount = rows[0]?.view_count || 1;
    return { allowed: true, remaining: 2 - currentCount, shouldMute: false };
  } catch (err) {
    console.error("Rate limit check error:", err);
    return { allowed: true, remaining: 1, shouldMute: false };
  }
}

// Single Fixed Quick Reply Chip
export const FIXED_QUICK_REPLIES = [
  {
    content_type: "text",
    title: "📊 Dashboard",
    payload: "ACTION_DASHBOARD"
  }
];

// Unified Dashboard + Copyable Invite Text
export function buildDashboardPayload(missionary, referralLink) {
  const name = missionary?.name || "Missionary";
  const email = missionary?.email || "Not linked yet";
  const points = missionary?.points || 0;

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
    dashboardText: combinedText,
    invitePromoText: combinedText,
    quick_replies: FIXED_QUICK_REPLIES
  };
}

// 1:1 Square Image Aspect Ratio generic carousel with 1 Action Button
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
