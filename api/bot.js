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
  const cleanRef = (referralCode || '').trim().toUpperCase();

  // Ensure table exists and all required columns are present
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS missionaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT DEFAULT '',
        points INTEGER DEFAULT 0,
        referral_code TEXT UNIQUE,
        fb_sender_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Safe column migrations in case table existed previously without these columns
    await runSql("ALTER TABLE missionaries ADD COLUMN fb_sender_id TEXT").catch(() => {});
    await runSql("ALTER TABLE missionaries ADD COLUMN referral_code TEXT").catch(() => {});
    await runSql("ALTER TABLE missionaries ADD COLUMN points INTEGER DEFAULT 0").catch(() => {});
    await runSql("ALTER TABLE missionaries ADD COLUMN is_active INTEGER DEFAULT 1").catch(() => {});
  } catch (_) {}

  // 1. Deep Link Referral Credit (messaging_referrals)
  if (cleanRef) {
    try {
      const inviterRows = await runSql("SELECT * FROM missionaries WHERE UPPER(referral_code) = ? LIMIT 1", [cleanRef]);
      const inviter = inviterRows?.[0];

      if (inviter) {
        const existingRows = await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? LIMIT 1", [String(senderId)]);
        const existing = existingRows?.[0];

        if (!existing) {
          // Award +1 point to inviter
          const currentInviterPoints = Number(inviter.points || 0);
          await runSql("UPDATE missionaries SET points = ? WHERE id = ?", [currentInviterPoints + 1, Number(inviter.id)]);
          
          // Create new missionary record with +1 point and unique code
          const newCode = 'TC' + Math.random().toString(36).substring(2, 7).toUpperCase();
          const fallbackEmail = `user_${String(senderId).slice(-6)}@missionary.org`;
          await runSql(
            "INSERT INTO missionaries (name, email, fb_sender_id, points, referral_code, is_active) VALUES (?, ?, ?, 1, ?, 1)",
            [`Elder Missionary`, fallbackEmail, String(senderId), newCode]
          );

          if (token && !token.startsWith("EAA_MOCK")) {
            const welcomeMsg = `🎉 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗧𝗖𝗥𝗣!\n\nYou joined using ${inviter.name}'s referral link!\n\n🎁 You both received +1 Free Reward Point!\n\nTap "📊 Dashboard" below to view your points and explore rewards.`;
            await sendFbMessage(senderId, { text: welcomeMsg, quick_replies: FIXED_QUICK_REPLIES }, token);
          }
          return;
        }
      }
    } catch (e) {
      console.error('Referral error:', e);
    }
  }

  // Missionary lookup
  let missionaryRows = await runSql("SELECT * FROM missionaries WHERE fb_sender_id = ? OR UPPER(referral_code) = ? LIMIT 1", [String(senderId), (text || '').toUpperCase()]);
  let missionary = missionaryRows?.[0];
  const points = Number(missionary?.points || 0);
  const refCode = missionary?.referral_code || "JOIN";
  const refLink = `https://m.me/TimelessCreationsRP?ref=${refCode}`;

  // Query product_catalog table strictly for reward items
  let rewardProducts = [];
  try {
    rewardProducts = await runSql("SELECT id, name, price, image_url, type FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
  } catch (err) {
    console.warn("product_catalog table query fallback:", err.message);
  }

  // 2. Rate Limiting Check
  const rateCheck = await checkDashboardRateLimit(senderId);
  if (!rateCheck.allowed) {
    if (!rateCheck.shouldMute && rateCheck.message && token && !token.startsWith("EAA_MOCK")) {
      await sendFbMessage(senderId, { text: rateCheck.message, quick_replies: FIXED_QUICK_REPLIES }, token);
    }
    return;
  }

  if (!token || token.startsWith("EAA_MOCK")) return;

  const payload = buildDashboardPayload(missionary || { name: "Missionary", email: "Not linked yet", points }, refLink);

  // Message 1: Separate Dashboard Stats Message
  await sendFbMessage(senderId, { text: payload.dashboardText }, token);

  // Message 2: Separate Copy-and-Send Companion Invite Message
  await sendFbMessage(senderId, { text: payload.invitePromoText }, token);

  // Message 3: 1:1 Square Catalog Carousel
  const carouselPayload = await buildCatalogCarousel(points, rewardProducts);
  await sendFbMessage(senderId, carouselPayload, token);
}

async function sendFbMessage(recipientId, messagePayload, token) {
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
