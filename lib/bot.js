import { runSql } from './db.js';

// Helper to check and enforce anti-spam dashboard view limits (Max 2 views per day)
export async function checkDashboardRateLimit(senderId) {
  try {
    // Ensure table exists for tracking daily views
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
        message: `🛡️ **Daily Dashboard Limit Reached**\n\nTo keep our system secure and fast, your dashboard can be accessed up to **2 times per day**.\n\n⏳ Your view window will automatically reset and unlock at **midnight (00:00 UTC)**. Thank you for understanding, and keep up the great missionary work!` 
      };
    }

    // Increment or insert view count
    if (record) {
      await runSql("UPDATE bot_daily_views SET view_count = view_count + 1 WHERE sender_id = ? AND view_date = ?", [senderId, todayStr]);
    } else {
      await runSql("INSERT INTO bot_daily_views (sender_id, view_date, view_count) VALUES (?, ?, 1)", [senderId, todayStr]);
    }

    return { allowed: true, remaining: 2 - (count + 1) };
  } catch (err) {
    console.error("Rate limit check error:", err);
    return { allowed: true }; // Fail-safe allow if DB error occurs
  }
}

// Generate Catalog Carousel with Dynamic Button Labels (Window Shopping optimization)
export async function buildCatalogCarousel(senderPoints = 0, products = []) {
  if (!products || products.length === 0) {
    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "🌟 TCRP Reward Catalog",
              subtitle: `Your Current Balance: ${senderPoints} Points. Check back soon for new items!`,
              image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
              buttons: [
                { type: "postback", title: "📊 View Dashboard", payload: "ACTION_DASHBOARD" },
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

    // Dynamic button label for window shopping
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
      subtitle: `⭐ Cost: ${itemPrice} Points | Your Balance: ${senderPoints} PTS\n${canAfford ? '✅ You can claim this right now!' : `🔥 Need ${pointDiff} more referral point${pointDiff > 1 ? 's' : ''}!`}`,
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
