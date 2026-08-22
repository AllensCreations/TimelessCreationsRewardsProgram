import { runSql } from '../lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit, FIXED_QUICK_REPLIES } from '../lib/bot.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const verifyToken = process.env.PAGE_ACCESS_TOKEN ? (process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN) : (process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN);
  const pageToken = process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && (token === verifyToken || token === process.env.VERIFY_TOKEN || token === process.env.FB_VERIFY_TOKEN)) {
      console.log('✅ Meta Webhook successfully verified via GET /api/bot');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden: Token mismatch.');
  }

  // 2. Incoming Messages & Postbacks (POST)
  if (req.method === 'POST') {
    const body = req.body;

    if (body?.object === 'page') {
      res.status(200).send('EVENT_RECEIVED');

      for (const entry of body.entry || []) {
        for (const webhookEvent of entry.messaging || []) {
          const senderId = webhookEvent.sender?.id;
          if (!senderId) continue;

          const rawText = (webhookEvent.message?.text || '').trim();
          const postbackPayload = webhookEvent.postback?.payload || webhookEvent.message?.quick_reply?.payload || '';

          console.log(`📩 [INCOMING BOT EVENT] Sender: ${senderId} | Text: "${rawText}" | Payload: "${postbackPayload}"`);

          try {
            await executeBotAction(senderId, rawText, postbackPayload, pageToken);
          } catch (err) {
            console.error('❌ Error in executeBotAction:', err);
          }
        }
      }
      return;
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

export async function executeBotAction(senderId, text, postbackPayload, token) {
  if (!token) {
    console.error('❌ Missing PAGE_ACCESS_TOKEN in environment variables.');
    return;
  }

  const lower = (text || '').toLowerCase();

  // Missionary lookup
  let missionary = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? OR referral_code = ? LIMIT 1", [senderId, (text || '').toUpperCase()]))[0];
  const points = missionary?.points || 0;
  const refCode = missionary?.referral_code || "JOIN";
  const refLink = `https://m.me/TimelessCreationsRP?ref=${refCode}`;

  // 1. DASHBOARD
  if (postbackPayload === "ACTION_DASHBOARD" || lower.includes("dashboard") || lower.includes("points") || lower.includes("balance")) {
    const rateCheck = await checkDashboardRateLimit(senderId);
    if (!rateCheck.allowed) {
      await sendFbMessage(senderId, { text: rateCheck.message, quick_replies: FIXED_QUICK_REPLIES }, token);
      return;
    }

    const payload = buildDashboardPayload(missionary || { name: "Missionary", email: "Not linked yet", points }, refLink);
    await sendFbMessage(senderId, { text: payload.dashboardText, quick_replies: FIXED_QUICK_REPLIES }, token);
    return;
  }

  // 2. REWARD CATALOG CAROUSEL
  if (postbackPayload === "ACTION_CATALOG" || lower.includes("catalog") || lower.includes("rewards") || lower.includes("shop")) {
    let products = await runSql("SELECT * FROM products WHERE is_active = 1 ORDER BY price ASC LIMIT 10");
    if (!products || products.length === 0) {
      products = [
        { id: 1, name: "Engraved Nametag", price: 2, image_url: "https://i.ibb.co/68vN0kC/tcrp-default.webp" },
        { id: 2, name: "Standard POS Missionary Kit", price: 5, image_url: "https://i.ibb.co/68vN0kC/tcrp-default.webp" }
      ];
    }
    const carouselPayload = await buildCatalogCarousel(points, products);
    await sendFbMessage(senderId, carouselPayload, token);
    return;
  }

  // 3. INVITE COMPANION
  if (postbackPayload === "ACTION_INVITE" || lower.includes("invite") || lower.includes("refer")) {
    const payload = buildDashboardPayload(missionary || { name: "Missionary", points }, refLink);
    await sendFbMessage(senderId, { text: payload.invitePromoText, quick_replies: FIXED_QUICK_REPLIES }, token);
    return;
  }

  // 4. ITEM GOAL VIEW
  if (postbackPayload.startsWith("VIEW_GOAL_")) {
    const itemId = postbackPayload.replace("VIEW_GOAL_", "");
    const goalText = `⭐ 𝗥𝗘𝗪𝗔𝗥𝗗 𝗚𝗢𝗔𝗟 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n\nYou need a few more points to unlock this reward item!\n\n💡 Share your referral link with a companion or fellow missionary. When they verify, you BOTH get +1 Point instantly!\n\n• 🔗 𝗬𝗼𝘂𝗿 𝗟𝗶𝗻𝗸: ${refLink}`;
    await sendFbMessage(senderId, { text: goalText, quick_replies: FIXED_QUICK_REPLIES }, token);
    return;
  }

  // DEFAULT FALLBACK MENU
  const defaultReply = `✨ Welcome to 𝗧𝗶𝗺𝗲𝗹𝗲𝘀𝘀 𝗖𝗿𝗲𝗮𝘁𝗶𝗼𝗻𝘀 𝗥𝗲𝘄𝗮𝗿𝗱𝘀 𝗣𝗿𝗼𝗴𝗿𝗮𝗺!

• Tap "📊 Dashboard" below to view your balance
• Tap "🌟 View Catalog" to window shop & redeem rewards
• Tap "🔗 Invite a Friend" to share your referral link`;

  await sendFbMessage(senderId, { text: defaultReply, quick_replies: FIXED_QUICK_REPLIES }, token);
}

async function sendFbMessage(recipientId, messagePayload, token) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: messagePayload
      })
    });
    const result = await res.json();
    if (result.error) {
      console.error('❌ Facebook Graph API Rejected Message:', JSON.stringify(result.error));
    } else {
      console.log(`✅ [FB MESSAGE DELIVERED] Recipient: ${recipientId} | MessageID: ${result.message_id}`);
    }
  } catch (err) {
    console.error('❌ Network error sending to Facebook:', err.message);
  }
}
