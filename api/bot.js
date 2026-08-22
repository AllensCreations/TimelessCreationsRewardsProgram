import { runSql } from '../lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit } from '../lib/bot.js';

export default async function handler(req, res) {
  // Webhook Verification from Meta Developer Portal
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
      console.log('Webhook verified by Facebook Meta');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden verify token mismatch.');
  }

  // Incoming Messages / Postbacks from Messenger
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object === 'page') {
      // Must respond with 200 OK immediately so Facebook does not time out
      res.status(200).send('EVENT_RECEIVED');

      for (const entry of body.entry || []) {
        const webhookEvent = entry.messaging?.[0];
        if (!webhookEvent) continue;

        const senderId = webhookEvent.sender?.id;
        const messageText = (webhookEvent.message?.text || '').trim().toLowerCase();
        const postbackPayload = webhookEvent.postback?.payload || '';

        try {
          await handleBotEvent(senderId, messageText, postbackPayload);
        } catch (err) {
          console.error('Error handling bot event:', err);
        }
      }
      return;
    }

    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

async function handleBotEvent(senderId, messageText, postbackPayload) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing FB_PAGE_ACCESS_TOKEN");
    return;
  }

  // Fetch missionary details by senderId if linked
  let missionary = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? OR referral_code = ? LIMIT 1", [senderId, messageText.toUpperCase()]))[0];
  const points = missionary?.points || 0;
  const refCode = missionary?.referral_code || "JOIN";
  const refLink = `https://m.me/TimelessCreationsRP?ref=${refCode}`;

  // 1. ACTION: Dashboard or "points" / "dashboard"
  if (postbackPayload === "ACTION_DASHBOARD" || messageText.includes("dashboard") || messageText.includes("points") || messageText.includes("balance")) {
    const rateCheck = await checkDashboardRateLimit(senderId);
    if (!rateCheck.allowed) {
      await sendFbMessage(senderId, { text: rateCheck.message }, token);
      return;
    }

    const payload = buildDashboardPayload(missionary || { name: "Missionary", email: "Not verified yet", points }, refLink);
    await sendFbMessage(senderId, { text: payload.dashboardText }, token);
    return;
  }

  // 2. ACTION: Catalog / Window Shopping Carousel
  if (postbackPayload === "ACTION_CATALOG" || messageText.includes("catalog") || messageText.includes("rewards")) {
    const products = await runSql("SELECT * FROM products WHERE is_active = 1 ORDER BY price ASC LIMIT 10");
    const carouselPayload = await buildCatalogCarousel(points, products);
    await sendFbMessage(senderId, carouselPayload, token);
    return;
  }

  // 3. ACTION: Invite / Referral link
  if (postbackPayload === "ACTION_INVITE" || messageText.includes("invite") || messageText.includes("refer")) {
    const payload = buildDashboardPayload(missionary || { name: "Missionary", points }, refLink);
    await sendFbMessage(senderId, { text: payload.invitePromoText }, token);
    return;
  }

  // Default Fallback Message
  const defaultReply = `✨ Welcome to 𝗧𝗶𝗺𝗲𝗹𝗲𝘀𝘀 𝗖𝗿𝗲𝗮𝘁𝗶𝗼𝗻𝘀 𝗥𝗲𝘄𝗮𝗿𝗱𝘀 𝗣𝗿𝗼𝗴𝗿𝗮𝗺!

• Type "dashboard" to view your verified points
• Type "catalog" to window shop & redeem rewards
• Type "invite" to get your 1-tap companion referral link`;

  await sendFbMessage(senderId, { text: defaultReply }, token);
}

async function sendFbMessage(recipientId, messagePayload, token) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: messagePayload
    })
  });
}
