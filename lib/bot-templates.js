// bot-templates.js - Messenger UI Templates & Rewards Carousel

/**
 * Builds the text dashboard matching the Timeless Creations Rewards Program UI
 */
export function buildDashboardMessage(userData) {
  const name = userData.name || "Missionary";
  const status = userData.status || "Not linked yet";
  const points = userData.points ?? 0;
  const refCode = userData.refCode || "JOIN";

  return {
    text: 
`📊 MISSIONARY DASHBOARD

👤 Information:
• ${name}
• ${status}

⭐ Points Balance:
• ${points} Points

----------------------------------------
💌 Invite a Friend & Earn +1 PT

Copy and send this to your companion or fellow missionary:

"✨ Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality missionary essentials worth ₱50 to ₱500! 🎁

Join here: https://m.me/TimelessCreationsRP?ref=${refCode}

(When you join using my code, we BOTH receive +1 Reward Point instantly!) 🚀"`
  };
}

/**
 * Converts Turso `product_catalog` rows into a Messenger Carousel (Generic Template)
 * @param {Array<{id: number, name: string, price: number, image_url: string}>} products 
 */
export function buildRewardsCarousel(products) {
  if (!products || products.length === 0) {
    return { text: "🎁 No rewards currently available in the catalog." };
  }

  // Messenger allows max 10 elements per carousel
  const elements = products.slice(0, 10).map((item) => ({
    title: item.name,
    subtitle: `Cost: ${item.price} Points`,
    image_url: item.image_url || "https://placehold.co/600x400?text=Reward",
    buttons: [
      {
        type: "postback",
        title: "🎁 Redeem",
        payload: JSON.stringify({ action: "REDEEM_REWARD", productId: item.id })
      },
      {
        type: "postback",
        title: "ℹ️ Details",
        payload: JSON.stringify({ action: "VIEW_DETAILS", productId: item.id })
      }
    ]
  }));

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        image_aspect_ratio: "horizontal",
        elements
      }
    },
    quick_replies: [
      {
        content_type: "text",
        title: "📊 Dashboard",
        payload: "VIEW_DASHBOARD"
      }
    ]
  };
}
