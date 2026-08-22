import { runSql } from '../lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit, FIXED_QUICK_REPLIES } from '../lib/bot.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const verifyToken = process.env.PAGE_ACCESS_TOKEN 
    ? (process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN) 
    : (process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN);
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
    return res.status(403).send('Forbidden: Token mismatch.');
  }

  // 2. Incoming Messages & Postbacks (POST)
  if (req.method === 'POST') {
    const body = req.body;

    if (body?.object === 'page') {
      try {
        for (const entry of body.entry || []) {
          for (const webhookEvent of entry.messaging || []) {
            const senderId = webhookEvent.sender?.id;
            if (!senderId) continue;

            const rawText = (webhookEvent.message?.text || '').trim();
            const postbackPayload = webhookEvent.postback?.payload || webhookEvent.message?.quick_reply?.payload || '';
            const referralCode = webhookEvent.referral?.ref || 
                                 webhookEvent.postback?.referral?.ref || 
                                 webhookEvent.message?.referral?.ref || 
                                 '';

            // Must AWAIT execution in serverless so Vercel does not terminate before Graph API send finishes
            await executeBotAction(senderId, rawText, postbackPayload, referralCode, pageToken);
          }
        }
      } catch (err) {
        console.error('Error handling webhook events:', err);
      }

      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

export async function executeBotAction(senderId, text, postbackPayload, referralCode, token) {
  if (!token) {
    console.error('❌ Missing PAGE_ACCESS_TOKEN');
    return;
  }

  const cleanRef = (referralCode || '').trim().toUpperCase();
  const lower = (text || '').toLowerCase();

  // 1. Referral Link Handling
  if (cleanRef) {
    try {
      const inviter = (await runSql("SELECT * FROM missionaries WHERE referral_code = ? LIMIT 1", [cleanRef]))[0];
      if (inviter) {
        const existing = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? LIMIT 1", [senderId]))[0];
        if (!existing) {
          await runSql("UPDATE missionaries SET points = points + 1 WHERE id = ?", [inviter.id]);
          const newCode = 'TC' + Math.random().toString(36).substring(2, 7).toUpperCase();
          await runSql(
            "INSERT INTO missionaries (name, fb_sender_id, points, referral_code) VALUES (?, ?, 1, ?)",
            [`Missionary (${senderId.slice(-4)})`, senderId, newCode]
          );

          const welcomeMsg = `🎉 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗧𝗖𝗥𝗣!\n\nYou joined using ${inviter.name}'s referral link!\n\n🎁 You both received +1 Free Reward Point!\n\nTap "📊 Dashboard" below to see your balance or "🌟 View Catalog" to browse missionary rewards.`;
          await sendFbMessage(senderId, { text: welcomeMsg, quick_replies: FIXED_QUICK_REPLIES }, token);
          return;
        }
      }
    } catch (e) {
      console.error('Referral processing error:', e);
    }
  }

  // Missionary lookup
  let missionary = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? OR referral_code = ? LIMIT 1", [senderId, (text || '').toUpperCase()]))[0];
  const points = missionary?.points || 0;
  const refCode = missionary?.referral_code || "JOIN";
  const refLink = `https://m.me/TimelessCreationsRP?ref=${refCode}`;

  // 2. DASHBOARD
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

  // 3. CATALOG
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

  // 4. INVITE
  if (postbackPayload === "ACTION_INVITE" || lower.includes("invite") || lower.includes("refer")) {
    const payload = buildDashboardPayload(missionary || { name: "Missionary", points }, refLink);
    await sendFbMessage(senderId, { text: payload.invitePromoText, quick_replies: FIXED_QUICK_REPLIES }, token);
    return;
  }

  // 5. GOAL VIEW
  if (postbackPayload.startsWith("VIEW_GOAL_")) {
    const goalText = `⭐ 𝗥𝗘𝗪𝗔𝗥𝗗 𝗚𝗢𝗔𝗟 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n\nYou need more points to redeem this item.\n\n💡 Share your 1-tap invite link with a companion or friend. When they join, you BOTH earn +1 Point instantly!\n\n• 🔗 𝗬𝗼𝘂𝗿 𝗟𝗶𝗻𝗸:\n${refLink}`;
    await sendFbMessage(senderId, { text: goalText, quick_replies: FIXED_QUICK_REPLIES }, token);
    return;
  }

  // DEFAULT FALLBACK
  const defaultReply = `✨ Welcome to 𝗧𝗶𝗺𝗲𝗹𝗲𝘀𝘀 𝗖𝗿𝗲𝗮𝘁𝗶𝗼𝗻𝘀 𝗥𝗲𝘄𝗮𝗿𝗱𝘀 𝗣𝗿𝗼𝗴𝗿𝗮𝗺!

• Tap "📊 Dashboard" to check your balance
• Tap "🌟 View Catalog" to browse & claim rewards
• Tap "🔗 Invite a Friend" to get your referral link`;

  await sendFbMessage(senderId, { text: defaultReply, quick_replies: FIXED_QUICK_REPLIES }, token);
}

async function sendFbMessage(recipientId, messagePayload, token) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: recipientId },
    message: messagePayload
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (result.error) {
      console.error('❌ Facebook API Error:', JSON.stringify(result.error));
    } else {
      console.log(`✅ [MESSAGE DELIVERED] Recipient: ${recipientId}`);
    }
  } catch (err) {
    console.error('❌ Network error sending to Facebook:', err.message);
  }
}
