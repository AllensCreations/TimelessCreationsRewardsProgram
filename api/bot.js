import { runSql } from '../lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit } from '../lib/bot.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const verifyToken = process.env.PAGE_ACCESS_TOKEN ? (process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN) : process.env.FB_VERIFY_TOKEN;
  const pageToken = process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && (token === verifyToken || token === process.env.VERIFY_TOKEN || token === process.env.FB_VERIFY_TOKEN)) {
      console.log('✅ Meta Webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden: Verify token mismatch.');
  }

  // 2. Incoming Messages & Postbacks (POST)
  if (req.method === 'POST') {
    const body = req.body;

    if (body?.object === 'page') {
      res.status(200).send('EVENT_RECEIVED');

      for (const entry of body.entry || []) {
        const webhookEvent = entry.messaging?.[0];
        if (!webhookEvent) continue;

        const senderId = webhookEvent.sender?.id;
        const rawText = (webhookEvent.message?.text || '').trim();
        const postbackPayload = webhookEvent.postback?.payload || '';

        try {
          await processBotCommand(senderId, rawText, postbackPayload, pageToken);
        } catch (err) {
          console.error('Error processing bot command:', err);
        }
      }
      return;
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

async function processBotCommand(senderId, text, postbackPayload, token) {
  if (!token) {
    console.error('Missing PAGE_ACCESS_TOKEN / FB_PAGE_ACCESS_TOKEN');
    return;
  }

  const lower = text.toLowerCase();

  // Look up missionary
  let missionary = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? OR referral_code = ? LIMIT 1", [senderId, text.toUpperCase()]))[0];
  const points = missionary?.points || 0;
  const refCode = missionary?.referral_code || "JOIN";
  const refLink = `https://m.me/TimelessCreationsRP?ref=${refCode}`;

  // 1. DASHBOARD & POINTS
  if (postbackPayload === "ACTION_DASHBOARD" || lower.includes("dashboard") || lower.includes("points") || lower.includes("balance")) {
    const rateCheck = await checkDashboardRateLimit(senderId);
    if (!rateCheck.allowed) {
      await sendToFacebook(senderId, { text: rateCheck.message }, token);
      return;
    }

    const payload = buildDashboardPayload(missionary || { name: "Missionary", email: "Not linked yet", points }, refLink);
    await sendToFacebook(senderId, { text: payload.dashboardText }, token);
    return;
  }

  // 2. CATALOG & WINDOW SHOPPING
  if (postbackPayload === "ACTION_CATALOG" || lower.includes("catalog") || lower.includes("rewards") || lower.includes("shop")) {
    const products = await runSql("SELECT * FROM products WHERE is_active = 1 ORDER BY price ASC LIMIT 10");
    const carouselPayload = await buildCatalogCarousel(points, products);
    await sendToFacebook(senderId, carouselPayload, token);
    return;
  }

  // 3. INVITE & REFERRAL LINK
  if (postbackPayload === "ACTION_INVITE" || lower.includes("invite") || lower.includes("refer")) {
    const payload = buildDashboardPayload(missionary || { name: "Missionary", points }, refLink);
    await sendToFacebook(senderId, { text: payload.invitePromoText }, token);
    return;
  }

  // DEFAULT GREETING
  const defaultReply = `✨ Welcome to 𝗧𝗶𝗺𝗲𝗹𝗲𝘀𝘀 𝗖𝗿𝗲𝗮𝘁𝗶𝗼𝗻𝘀 𝗥𝗲𝘄𝗮𝗿𝗱𝘀 𝗣𝗿𝗼𝗴𝗿𝗮𝗺!

• Type "dashboard" to view your points
• Type "catalog" to window shop & redeem rewards
• Type "invite" to get your companion referral link`;

  await sendToFacebook(senderId, { text: defaultReply }, token);
}

async function sendToFacebook(recipientId, payload, token) {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: payload
      })
    });
    const result = await res.json();
    if (result.error) {
      console.error('Facebook Send API Error:', result.error);
    }
  } catch (e) {
    console.error('Facebook network failure:', e.message);
  }
}
