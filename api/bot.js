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

            await executeBotAction(senderId, rawText, postbackPayload, referralCode, pageToken);
          }
        }
      } catch (err) {
        console.error('Webhook execution error:', err);
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

export async function executeBotAction(senderId, text, postbackPayload, referralCode, token) {
  const sid = String(senderId);
  const cleanRef = (referralCode || '').trim().toUpperCase();

  // 1. Deep Link Referral Credit for New Users
  if (cleanRef) {
    try {
      const inviter = (await runSql("SELECT * FROM missionaries WHERE referral_code = ? LIMIT 1", [cleanRef]))[0];
      if (inviter) {
        const existing = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? LIMIT 1", [sid]))[0];
        if (!existing) {
          await runSql("UPDATE missionaries SET points = points + 1 WHERE id = ?", [inviter.id]);
          const newCode = 'TC' + Math.random().toString(36).substring(2, 7).toUpperCase();
          await runSql(
            "INSERT INTO missionaries (name, fb_sender_id, points, referral_code, is_active) VALUES (?, ?, 1, ?, 1)",
            [`Missionary (${sid.slice(-4)})`, sid, newCode]
          );

          const welcomeMsg = `🎉 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗧𝗖𝗥𝗣!\n\nYou joined using ${inviter.name}'s referral link!\n\n🎁 You both received +1 Free Reward Point!\n\nTap "📊 Dashboard" below to view your points and explore rewards.`;
          await sendFbMessage(sid, { text: welcomeMsg, quick_replies: FIXED_QUICK_REPLIES }, token);
          return;
        }
      }
    } catch (e) {
      console.error('Referral onboarding error:', e.message);
    }
  }

  // Missionary lookup
  let missionary = (await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? OR referral_code = ? LIMIT 1", [sid, (text || '').toUpperCase()]))[0];
  const points = Number(missionary?.points || 0);
  const refCode = missionary?.referral_code || "JOIN";
  const refLink = `https://m.me/TimelessCreationsRP?ref=${refCode}`;

  let rewardProducts = [];
  try {
    rewardProducts = await runSql("SELECT id, name, price, image_url, type FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
  } catch (err) {
    console.warn("product_catalog query fallback:", err.message);
  }

  // 2. DASHBOARD SEQUENCE
  const rateCheck = await checkDashboardRateLimit(sid);
  if (!rateCheck.allowed) {
    if (!rateCheck.shouldMute && rateCheck.message) {
      await sendFbMessage(sid, { text: rateCheck.message, quick_replies: FIXED_QUICK_REPLIES }, token);
    }
    return;
  }

  const payload = buildDashboardPayload(missionary || { name: "Missionary", email: "Not linked yet", points }, refLink);

  // Message 1: Separate Dashboard Stats
  await sendFbMessage(sid, { text: payload.dashboardText }, token);

  // Message 2: Separate Copy-and-Send Companion Invite
  await sendFbMessage(sid, { text: payload.invitePromoText }, token);

  // Message 3: 1:1 Square Catalog Carousel + Fixed Quick Reply
  const carouselPayload = await buildCatalogCarousel(points, rewardProducts);
  await sendFbMessage(sid, carouselPayload, token);
}

async function sendFbMessage(recipientId, messagePayload, token) {
  if (!token || token.startsWith("EAA_MOCK_TOKEN")) {
    return; // Bypass network call for local test runs
  }

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: { id: recipientId },
        message: messagePayload
      })
    });
    const result = await res.json();
    if (result.error) console.error('Facebook Send API Error:', result.error);
  } catch (err) {
    console.error('Facebook network failure:', err.message);
  }
}
