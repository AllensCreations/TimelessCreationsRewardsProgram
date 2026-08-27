import crypto from 'crypto';
import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';
import { sendReceiptEmail } from './mailer.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();

function hashIdentifier(str) {
  return crypto.createHash('sha256').update(String(str || '').toLowerCase().trim()).digest('hex');
}

export function generateXNXNXN() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let res = "";
  for (let i = 0; i < 3; i++) {
    res += letters.charAt(Math.floor(Math.random() * letters.length));
    res += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return res;
}

/**
 * Hourly Verified Dashboard Rate Limiter in Philippine Standard Time (PST / UTC+8)
 * Max 3 views per hour.
 */
async function checkVerifiedHourlyLimit(psid, maxViewsPerHour = 3) {
  const nowUtc = new Date();
  const phpTime = new Date(nowUtc.getTime() + (8 * 60 * 60 * 1000));
  
  const yyyy = phpTime.getUTCFullYear();
  const mm = String(phpTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(phpTime.getUTCDate()).padStart(2, '0');
  const hh = String(phpTime.getUTCHours()).padStart(2, '0');
  const minutes = phpTime.getUTCMinutes();
  
  const hourKey = `${yyyy}-${mm}-${dd}_${hh}`;
  const minutesRemaining = Math.max(1, 60 - minutes);

  try {
    const rows = await runSql(
      "SELECT view_count FROM bot_hourly_views WHERE psid = ? AND hour_key = ? LIMIT 1",
      [psid, hourKey]
    );

    const currentCount = Number(rows?.[0]?.view_count || 0);

    if (currentCount >= maxViewsPerHour) {
      return {
        allowed: false,
        remainingMinutes: minutesRemaining,
        message: `⏳ 𝗛𝗢𝗨𝗥𝗟𝗬 𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗\n\nYou have viewed your dashboard ${maxViewsPerHour} times this hour.\n\nAutomated dashboard & catalog refresh will unlock at the top of the hour (in about ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}, Philippine Time).\n\nThank you for your dedicated service!`
      };
    }

    const nextCount = currentCount + 1;
    await runSql(`
      INSERT INTO bot_hourly_views (psid, hour_key, view_count)
      VALUES (?, ?, ?)
      ON CONFLICT(psid, hour_key) DO UPDATE SET view_count = excluded.view_count
    `, [psid, hourKey, nextCount]);

    return { allowed: true, remainingViews: maxViewsPerHour - nextCount };
  } catch (err) {
    console.error("Hourly rate limiter error:", err.message);
    return { allowed: true, remainingViews: 1 };
  }
}

export async function sendFbGraphMessage(psid, messagePayload) {
  try {
    const textPreview = messagePayload.text || (messagePayload.attachment ? `[Carousel / Template]` : '[Message]');
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [psid, textPreview]).catch(() => {});
  } catch (_) {}

  const isMockPsid = String(psid).startsWith("TEST_") || String(psid).startsWith("SIM_");
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.startsWith('EAA_MOCK') || isMockPsid) {
    const preview = Array.from(JSON.stringify(messagePayload)).slice(0, 80).join('');
    await logSystemEvent('INFO', `(Local Sim) Dispatched: ${preview}`, psid);
    return;
  }

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: { id: psid },
        message: messagePayload
      })
    });
    const result = await res.json();
    if (result.error) {
      await logSystemEvent('ERROR', `Facebook Graph API Error: ${result.error.message}`, psid);
    } else {
      await logSystemEvent('INFO', `Dispatched to Facebook (msg_id: ${result.message_id})`, psid);
    }
  } catch (err) {
    await logSystemEvent('ERROR', `Facebook Network Error: ${err.message}`, psid);
  }
}

export async function sendTextMessage(psid, text, quickReplies = []) {
  const MAX_LEN = 1900;
  const sanitizeQuickReplies = (qrs) => {
    if (!qrs || !Array.isArray(qrs) || qrs.length === 0) return undefined;
    return qrs.map(qr => ({
      content_type: "text",
      title: String(qr.title).slice(0, 20),
      payload: String(qr.payload || qr.title).slice(0, 1000)
    }));
  };

  if (text.length <= MAX_LEN) {
    const payload = { text };
    const qrs = sanitizeQuickReplies(quickReplies);
    if (qrs) payload.quick_replies = qrs;
    await sendFbGraphMessage(psid, payload);
    return;
  }

  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LEN) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n\n', MAX_LEN);
    if (splitIdx === -1 || splitIdx < 500) splitIdx = remaining.lastIndexOf('\n', MAX_LEN);
    if (splitIdx === -1 || splitIdx < 500) splitIdx = MAX_LEN;
    chunks.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }

  for (let i = 0; i < chunks.length; i++) {
    const isLast = (i === chunks.length - 1);
    const payload = { text: chunks[i] };
    if (isLast) {
      const qrs = sanitizeQuickReplies(quickReplies);
      if (qrs) payload.quick_replies = qrs;
    }
    await sendFbGraphMessage(psid, payload);
  }
}

export async function buildCatalogCarousel(senderPoints = 0) {
  let products = [];
  try {
    products = await runSql("SELECT id, name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
  } catch (e) {
    await logSystemEvent('WARN', `Failed to load rewards catalog: ${e.message}`);
  }

  if (!products || products.length === 0) return null;

  const elements = products.map(item => {
    const price = Number(item.price) || 0;
    const canAfford = senderPoints >= price;
    const pointDiff = price - senderPoints;

    return {
      title: item.name,
      subtitle: `⭐ Cost: ${price} PTS (Balance: ${senderPoints} PTS)`,
      image_url: item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
      buttons: [
        canAfford ? {
          type: "postback",
          title: `🎁 Claim (${price} PTS)`,
          payload: `CLAIM_ITEM_${item.id}`
        } : {
          type: "postback",
          title: `⭐ Need ${pointDiff} More PTS`,
          payload: `GOAL_ITEM_${item.id}`
        }
      ]
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
    quick_replies: [
      { content_type: "text", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
      { content_type: "text", title: "🎟️ Promo Code", payload: "PROMO_INFO" }
    ]
  };
}

export async function buildDynamicFaqsText() {
  let products = [];
  try {
    products = await runSql("SELECT name, CAST(price AS INTEGER) as price FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
  } catch (_) {}

  let rewardsCatalogList = "";
  if (products.length > 0) {
    rewardsCatalogList = products.map(p => `• ${p.name}: ${p.price} Points`).join('\n');
  } else {
    rewardsCatalogList = "• Temple Keychain: 6 Points\n• Nametag Keychain: 24 Points\n• Salvation Kit: 42 Points\n• Scripture Case: 60 Points";
  }

  return `📖 𝗙𝗥𝗘𝗤𝗨𝗘𝗡𝗧𝗟𝗬 𝗔𝗦𝗞𝗘𝗗 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡𝗦 (𝗙𝗔𝗤𝘀)

1. 𝗪𝗵𝗮𝘁 𝗶𝘀 𝗧𝗖𝗥𝗣?
Answer: TCRP (Timeless Creations Rewards Program) is an exclusive reward & encouragement platform for full-time missionaries to earn points and claim essential custom gear.

2. 𝗪𝗵𝗼 𝗶𝘀 𝗲𝗹𝗶𝗴𝗶𝗯𝗹𝗲?
Answer: Currently serving Elders and Sisters with an active @missionary.org email address.

3. 𝗛𝗼𝘄 𝗱𝗼 𝗜 𝗷𝗼𝗶𝗻?
Answer: Submit your title/name, official email, and an invitation code (or global code TCRP50).

4. 𝗛𝗼𝘄 𝗱𝗼 𝗽𝗼𝗶𝗻𝘁𝘀 𝘄𝗼𝗿𝗸?
Answer: You get +1 Point upon sign-up. When a fellow missionary joins using your referral code, both of you earn +1 Free Point!

5. 𝗪𝗵𝗮𝘁 𝗰𝗮𝗻 𝗜 𝗿𝗲𝗱𝗲𝗲𝗺?
${rewardsCatalogList}

6. 𝗛𝗼𝘄 𝗱𝗼 𝗜 𝗿𝗲𝗱𝗲𝗲𝗺 𝗽𝗿𝗼𝗺𝗼 𝗰𝗼𝗱𝗲𝘀?
Answer: Type /redeem <code> or /rewards <code> to claim promotional points!

7. 𝗛𝗼𝘄 𝗱𝗼 𝗜 𝗰𝗹𝗮𝗶𝗺 𝗺𝘆 𝗿𝗲𝘄𝗮𝗿𝗱?
Answer: Tap '🎁 Claim' in the Rewards Catalog carousel to generate an official order receipt, which is routed directly to admin for dispatch.

8. 𝗖𝗮𝗻 𝗜 𝘂𝘀𝗲 𝗽𝗲𝗿𝘀𝗼𝗻𝗮𝗹 𝗲𝗺𝗮𝗶𝗹𝘀?
Answer: No. Only official @missionary.org emails are accepted.

9. 𝗛𝗼𝘄 𝗱𝗼 𝗜 𝘃𝗶𝗲𝘄 𝗺𝘆 𝗹𝗶𝗻𝗸 & 𝗯𝗮𝗹𝗮𝗻𝗰𝗲?
Answer: Tap '📊 Dashboard' below at any time.`;
}

export async function renderVerifiedDashboard(psid, missionary, prefixMsg = "") {
  const limitCheck = await checkVerifiedHourlyLimit(psid, 3);
  if (!limitCheck.allowed) {
    await sendTextMessage(psid, limitCheck.message, [
      { title: "📖 FAQs", payload: "FAQS_PAYLOAD" },
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
    ]);
    return;
  }

  let referralBanner = "";
  const pendingNotices = Number(missionary.pending_ref_notices || 0);
  if (pendingNotices > 0) {
    referralBanner = `🎉 𝗚𝗥𝗘𝗔𝗧 𝗡𝗘𝗪𝗦!\n${pendingNotices} fellow missionary companion${pendingNotices > 1 ? 's' : ''} just joined using your referral code! (+${pendingNotices} Point${pendingNotices > 1 ? 's' : ''} credited!)\n\n`;
    await runSql("UPDATE missionaries SET pending_ref_notices = 0 WHERE psid = ?", [psid]).catch(() => {});
  }

  const points = Number(missionary.points) || 0;
  const refCode = missionary.referral_code || "JOIN";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const greeting = prefixMsg ? `${prefixMsg}\n\n` : "";

  const dashboardText = `${referralBanner}${greeting}📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗

👤 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻:
• ${missionary.name}
• ${missionary.email}

⭐ 𝗣𝗼𝗶𝗻𝘁𝘀 𝗕𝗮𝗹𝗮𝗻𝗰𝗲:
• ${points} Points`;

  const invitePromoText = `💌 𝗜𝗻𝘃𝗶𝘁𝗲 𝗮 𝗙𝗿𝗶𝗲𝗻𝗱 & 𝗘𝗮𝗿𝗻 +𝟭 𝗣𝗧

Copy and send this to your companion or fellow missionary:

"✨ Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality missionary essentials worth ₱50 to ₱500! 🎁

Join here: ${inviteLink}

(When you join using my code, we BOTH receive +1 Reward Point instantly!) 🚀"`;

  await sendTextMessage(psid, dashboardText);
  await sendTextMessage(psid, invitePromoText, [
    { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" },
    { title: "🎟️ Promo Code", payload: "PROMO_INFO" }
  ]);

  const carousel = await buildCatalogCarousel(points);
  if (carousel) {
    await sendFbGraphMessage(psid, carousel);
  }
}

async function sendWelcomeAndTerms(psid) {
  const welcomeMessage = 
`✨ 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗧𝗖𝗥𝗣!
(Timeless Creations Rewards Program)

🎁 Supporting full-time LDS missionaries across the Philippines with rewards, teaching kits, and encouragement letters.

📜 𝗧𝗲𝗿𝗺𝘀 & 𝗣𝗿𝗶𝘃𝗮𝗰𝘆 𝗦𝘂𝗺𝗺𝗮𝗿𝘆
• 𝗘𝗹𝗶𝗴𝗶𝗯𝗶𝗹𝗶𝘁𝘆: Full-time missionaries with @missionary.org emails.
• 𝗗𝗮𝘁𝗮 𝗨𝘀𝗮𝗴𝗲: PSID & email are used strictly for OTP authentication, referral bonus points (+1 PT), & monthly letters. Never sold or rented.
• 𝗥𝗶𝗴𝗵𝘁𝘀: You can type /delete_account anytime for complete removal.

Do you agree to continue?`;

  await sendTextMessage(psid, welcomeMessage, [
    { title: "✅ Agree & Continue", payload: "TERMS_AGREE" },
    { title: "❌ Decline", payload: "TERMS_DECLINE" }
  ]);
}

export async function handleBotMessage(psid, rawMessage = '', payload = null, referralParam = '') {
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();
  const cleanPayload = (payload || '').trim();
  const cleanRef = (referralParam || '').trim().toUpperCase();

  await logSystemEvent('INFO', `Inbound: text="${text}", payload="${cleanPayload}", ref="${cleanRef}"`, psid);

  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || cleanPayload || cleanRef || '[Action]']).catch(() => {});
  } catch (_) {}

  // Command: /delete_account
  if (lower === '/delete_account' || cleanPayload === 'CONFIRM_DELETE_ACCOUNT') {
    const existingRows = await runSql("SELECT email, points FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
    const record = existingRows?.[0];

    if (!record) {
      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "ℹ️ No registered missionary profile was found associated with your chat thread.");
      return;
    }

    const emailHash = hashIdentifier(record.email);
    const psidHash = hashIdentifier(psid);
    
    await runSql(`
      INSERT INTO hashed_audit_identities (identity_hash, type, welcome_granted, referral_awarded)
      VALUES (?, 'email', 1, 1)
      ON CONFLICT(identity_hash) DO NOTHING
    `, [emailHash]);

    await runSql(`
      INSERT INTO hashed_audit_identities (identity_hash, type, welcome_granted, referral_awarded)
      VALUES (?, 'psid', 1, 1)
      ON CONFLICT(identity_hash) DO NOTHING
    `, [psidHash]);

    await runSql("DELETE FROM missionaries WHERE psid = ?", [psid]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("DELETE FROM bot_hourly_views WHERE psid = ?", [psid]);

    await logSystemEvent('WARN', `User account deleted under Privacy Policy rights. Anti-fraud hash archived.`, psid);
    await sendTextMessage(
      psid,
      "🗑️ Your account, personal data, and points balance have been completely deleted in accordance with our Privacy Policy.\n\nIf you ever wish to re-join, tap 'Get Started' below:",
      [{ title: "✨ Get Started", payload: "GET_STARTED" }]
    );
    return;
  }

  // Testing Reset
  if (lower === 'reset') {
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("DELETE FROM bot_hourly_views WHERE psid = ?", [psid]);
    await runSql("UPDATE missionaries SET psid = NULL WHERE psid = ?", [psid]);
    await logSystemEvent('WARN', `Session wiped via RESET keyword`, psid);
    await sendTextMessage(psid, "🔄 Session reset! Tap 'Get Started' below to begin:", [
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  // Check verified status
  const missionaryRows = await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
  const missionary = missionaryRows?.[0] || null;
  const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';

  // Command: /rewards <code> or /redeem <code>
  if (lower.startsWith("/rewards") || lower.startsWith("/redeem")) {
    if (!isVerified) {
      await sendTextMessage(psid, "⚠️ Please verify your missionary account first before redeeming promo codes.");
      return;
    }

    const parts = text.split(/\s+/);
    const promoCode = (parts[1] || "").trim().toUpperCase();

    if (!promoCode) {
      await sendTextMessage(psid, "⚠️ Please specify a code. Example: /redeem FREEPOINTS", [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }

    const promoRows = await runSql("SELECT * FROM promo_codes WHERE code = ? LIMIT 1", [promoCode]);
    const promo = promoRows?.[0];

    if (!promo) {
      await sendTextMessage(psid, `❌ Invalid or expired promo code: "${promoCode}".`, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }

    if (Number(promo.claimed_count) >= Number(promo.max_users)) {
      await sendTextMessage(psid, `⏳ Sorry! The promo code "${promoCode}" has reached its maximum limit of ${promo.max_users} users.`, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }

    const existingRedemption = await runSql("SELECT code FROM promo_redemptions WHERE code = ? AND psid = ? LIMIT 1", [promoCode, psid]);
    if (existingRedemption && existingRedemption.length > 0) {
      await sendTextMessage(psid, `ℹ️ You have already redeemed the code "${promoCode}"!`, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }

    await runSql("INSERT INTO promo_redemptions (code, psid) VALUES (?, ?)", [promoCode, psid]);
    await runSql("UPDATE promo_codes SET claimed_count = claimed_count + 1 WHERE code = ?", [promoCode]);
    await runSql("UPDATE missionaries SET points = points + ? WHERE psid = ?", [promo.points, psid]);

    const updated = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
    await sendTextMessage(psid, `🎉 SUCCESS! You redeemed "${promoCode}" and received +${promo.points} Free Point(s)! 🎁`);
    await renderVerifiedDashboard(psid, updated);
    return;
  }

  // Handle Carousel Reward Claiming (CLAIM_ITEM_X)
  if (cleanPayload.startsWith("CLAIM_ITEM_")) {
    if (!isVerified) {
      await sendTextMessage(psid, "⚠️ Please complete email verification before claiming rewards.");
      return;
    }

    const prodId = cleanPayload.replace("CLAIM_ITEM_", "").trim();
    const prod = (await runSql("SELECT * FROM product_catalog WHERE id = ? LIMIT 1", [prodId]))[0];

    if (!prod) {
      await sendTextMessage(psid, "❌ Selected reward item is no longer available.");
      return;
    }

    const cost = Number(prod.price) || 0;
    const userPts = Number(missionary.points) || 0;

    if (userPts < cost) {
      const diff = cost - userPts;
      await sendTextMessage(psid, `⚠️ You need ${diff} more Point(s) to claim "${prod.name}". Invite companion missionaries to earn +1 Point each!`, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }

    const orderId = `TCRP-${Math.floor(1000 + Math.random() * 9000)}`;
    await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ?", [cost, psid]);
    await runSql(
      "INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')",
      [orderId, psid, missionary.email, missionary.name, prod.name, cost]
    );

    await sendReceiptEmail(missionary.email, {
      name: missionary.name,
      order_id: orderId,
      item: prod.name,
      points_cost: cost
    }).catch(() => {});

    await sendTextMessage(
      psid,
      `🎉 𝗥𝗘𝗗𝗘𝗠𝗣𝗧𝗜𝗢𝗡 𝗖𝗢𝗡𝗙𝗜𝗥𝗠𝗘𝗗!\n\n📦 𝗜𝘁𝗲𝗺: ${prod.name}\n⭐ 𝗣𝗼𝗶𝗻𝘁𝘀 𝗨𝘀𝗲𝗱: ${cost} PTS\n🆔 𝗢𝗿𝗱𝗲𝗿 𝗜𝗗: ${orderId}\n\nYour order has been recorded and an official receipt was sent to ${missionary.email}. Our team will prepare your reward!`,
      [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
        { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
      ]
    );
    return;
  }

  // Handle Goal Explanation (GOAL_ITEM_X)
  if (cleanPayload.startsWith("GOAL_ITEM_")) {
    if (!isVerified) {
      await sendWelcomeAndTerms(psid);
      return;
    }
    const prodId = cleanPayload.replace("GOAL_ITEM_", "").trim();
    const prod = (await runSql("SELECT * FROM product_catalog WHERE id = ? LIMIT 1", [prodId]))[0];
    if (prod) {
      const needed = Math.max(1, (Number(prod.price) || 0) - (Number(missionary.points) || 0));
      const refLink = `https://m.me/${PAGE_ID}?ref=${missionary.referral_code || 'JOIN'}`;
      await sendTextMessage(
        psid,
        `🎯 𝗡𝗘𝗫𝗧 𝗚𝗢𝗔𝗟: ${prod.name}\n\n⚡ You only need <strong>${needed} more point${needed > 1 ? 's' : ''}</strong> to unlock this reward!\n\nShare your link with ${needed} companion${needed > 1 ? 's' : ''}:\n${refLink}`,
        [
          { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
          { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
        ]
      );
    }
    return;
  }

  // Handle Actions for Verified Users
  if (isVerified) {
    if (cleanPayload === 'FAQS_PAYLOAD' || cleanPayload === 'MENU_FAQS' || lower === 'faqs' || lower === 'faq') {
      const faqsText = await buildDynamicFaqsText();
      await sendTextMessage(psid, faqsText, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
        { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
      ]);
      return;
    }

    if (cleanPayload === 'DISCOVER_PAYLOAD' || cleanPayload === 'MENU_REWARDS' || lower === 'rewards' || lower === 'catalog') {
      const carousel = await buildCatalogCarousel(Number(missionary.points) || 0);
      if (carousel) {
        await sendFbGraphMessage(psid, carousel);
      } else {
        await sendTextMessage(psid, "🛍️ Browse our rewards catalog:", [
          { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
        ]);
      }
      return;
    }

    if (cleanPayload === 'PROMO_INFO' || lower === 'promo' || lower === 'code') {
      await sendTextMessage(psid, "🎟️ Have a promo code?\n\nType `/redeem YOURCODE` or `/rewards YOURCODE` to claim free reward points!", [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }

    if (cleanPayload === 'ACTION_DASHBOARD' || lower === 'dashboard' || lower === 'menu') {
      await renderVerifiedDashboard(psid, missionary);
      return;
    }

    await renderVerifiedDashboard(psid, missionary);
    return;
  }

  // 2. UNVERIFIED USER ONBOARDING
  let session = (await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [psid]))?.[0] || null;

  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'AWAITING_TERMS', 0)", [psid]);
    if (cleanRef) {
      await runSql("UPDATE sessions SET invite_code = ? WHERE psid = ?", [cleanRef, psid]);
    }
    await sendWelcomeAndTerms(psid);
    return;
  }

  if (lower === 'get started' || cleanPayload === 'GET_STARTED' || lower === 'start') {
    if (session.state === 'AWAITING_TERMS') {
      await sendWelcomeAndTerms(psid);
      return;
    }
    if (session.state === 'AWAITING_ALL_IN_ONE') {
      const defaultCode = session.invite_code || 'TCRP50';
      await sendTextMessage(psid, `👉 Please send your Title & Name, official @missionary.org email, and Referral Code together.\n\nExample:\nElder Smith\njohn.smith@missionary.org\n${defaultCode}`);
      return;
    }
    if (session.state === 'AWAITING_OTP') {
      await sendTextMessage(psid, "📩 Please type your 6-digit verification code sent to your email to continue:", [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Edit Info", payload: "GET_STARTED" }
      ]);
      return;
    }
    await sendWelcomeAndTerms(psid);
    return;
  }

  // STEP 1: TERMS & LEGAL ACCEPTANCE
  if (session.state === 'AWAITING_TERMS') {
    if (cleanPayload === 'TERMS_AGREE' || lower.includes('agree') || lower.includes('continue')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_ALL_IN_ONE' WHERE psid = ?", [psid]);
      
      const defaultCode = session.invite_code || "TCRP50";
      const prompt = 
`✅ 𝗧𝗲𝗿𝗺𝘀 𝗔𝗰𝗰𝗲𝗽𝘁𝗲𝗱!

Please send your Title & Name, Email, and Referral Code together.

📝 𝗘𝘅𝗮𝗺𝗽𝗹𝗲 (Copy & Edit):
Elder Smith
john.smith@missionary.org
${defaultCode}`;

      await sendTextMessage(psid, prompt);
      return;
    } else if (cleanPayload === 'TERMS_DECLINE' || lower.includes('decline')) {
      await sendTextMessage(psid, "⚠️ You must accept the Privacy Policy & Terms of Service to join TCRP and claim rewards.", [
        { title: "✅ Agree & Continue", payload: "TERMS_AGREE" }
      ]);
      return;
    } else {
      await sendWelcomeAndTerms(psid);
      return;
    }
  }

  // STEP 2: COMBINED 3-IN-1 SUBMISSION
  if (session.state === 'AWAITING_ALL_IN_ONE') {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (!emailMatch) {
      await sendTextMessage(
        psid, 
        "⚠️ Missing or invalid email. Please submit your Title, official @missionary.org email, and Referral Code.\n\nExample:\nElder Smith\njohn.smith@missionary.org\nTCRP50"
      );
      return;
    }

    const emailInput = emailMatch[1].toLowerCase();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let titleName = "Elder Missionary";
    let referralCode = session.invite_code || "TCRP50";

    if (lines.length >= 2) {
      titleName = lines[0].replace(emailMatch[0], '').trim() || "Elder Missionary";
      const lastLine = lines[lines.length - 1].toUpperCase();
      if (!lastLine.includes('@') && lastLine.length >= 4) {
        referralCode = lastLine;
      }
    } else {
      const parts = text.replace(emailMatch[0], '').trim().split(/\s+/);
      if (parts.length > 0) {
        titleName = parts.slice(0, -1).join(' ') || parts[0] || "Elder Missionary";
        if (parts.length > 1 && parts[parts.length - 1].length >= 4) {
          referralCode = parts[parts.length - 1].toUpperCase();
        }
      }
    }

    const referrerRow = await runSql("SELECT psid FROM missionaries WHERE UPPER(referral_code) = ? LIMIT 1", [referralCode]);
    if (referrerRow && referrerRow.length > 0 && referrerRow[0].psid === psid) {
      await sendTextMessage(psid, "❌ You cannot use your own referral code. Please provide another companion code or TCRP50.");
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql(`
      UPDATE sessions 
      SET state = 'AWAITING_OTP', 
          temp_title = ?, 
          temp_email = ?, 
          invite_code = ?, 
          otp_code = ? 
      WHERE psid = ?
    `, [titleName, emailInput, referralCode, otp, psid]);

    await logSystemEvent('INFO', `🔐 [OTP GENERATED] Email: ${emailInput} | Code: ${otp} | Ref: ${referralCode}`, psid);

    if (BREVO_API_KEY) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Timeless Creations RP", email: "noreply.timelesscreations.ph@gmail.com" },
            to: [{ email: emailInput }],
            subject: `🔐 Your TCRP Verification Code: ${otp}`,
            htmlContent: `<div style="padding:20px;font-family:Georgia,serif;">Hello ${titleName},<br><br>Your 6-digit TCRP Verification Code is: <b style="font-size:24px;color:#8b1a1a;">${otp}</b></div>`
          })
        });
      } catch (err) {
        await logSystemEvent('ERROR', `Brevo OTP dispatch error: ${err.message}`, psid);
      }
    }

    await sendTextMessage(
      psid,
      `📩 Verification code sent to:\n*${emailInput}*\n\nType the 6-digit code below to complete your registration:`,
      [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Edit Info", payload: "GET_STARTED" }
      ]
    );
    return;
  }

  // STEP 3: OTP CONFIRMATION & VERIFICATION
  if (session.state === 'AWAITING_OTP') {
    if (cleanPayload === 'RESEND_OTP') {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      await runSql("UPDATE sessions SET otp_code = ? WHERE psid = ?", [newOtp, psid]);
      if (BREVO_API_KEY && session.temp_email) {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Timeless Creations RP", email: "noreply.timelesscreations.ph@gmail.com" },
            to: [{ email: session.temp_email }],
            subject: `🔐 Your New TCRP Verification Code: ${newOtp}`,
            htmlContent: `<div style="padding:20px;font-family:Georgia,serif;">Hello ${session.temp_title || 'Missionary'},<br><br>Your new verification code is: <b style="font-size:24px;color:#8b1a1a;">${newOtp}</b></div>`
          })
        }).catch(() => {});
      }
      await sendTextMessage(psid, `🔄 A fresh 6-digit code has been sent to ${session.temp_email}. Please type it below:`, [
        { title: "✏️ Edit Info", payload: "GET_STARTED" }
      ]);
      return;
    }

    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const emailHash = hashIdentifier(session.temp_email);
      const psidHash = hashIdentifier(psid);

      const auditCheck = await runSql(
        "SELECT identity_hash FROM hashed_audit_identities WHERE identity_hash IN (?, ?) LIMIT 1",
        [emailHash, psidHash]
      );
      const isRejoiningUser = (auditCheck && auditCheck.length > 0);

      if (session.invite_code && !isRejoiningUser) {
        await runSql(`
          UPDATE missionaries 
          SET points = points + 1, 
              pending_ref_notices = pending_ref_notices + 1 
          WHERE UPPER(referral_code) = ?
        `, [session.invite_code.toUpperCase()]);
      }

      await runSql(`
        INSERT INTO hashed_audit_identities (identity_hash, type, welcome_granted, referral_awarded)
        VALUES (?, 'email', 1, 1)
        ON CONFLICT(identity_hash) DO NOTHING
      `, [emailHash]);

      const refCode = generateXNXNXN();
      const cohort = (session.temp_title || '').toLowerCase().includes('sister') ? 'sister' : 'elder';
      const welcomePts = isRejoiningUser ? 0 : 1;

      await runSql(`
        INSERT INTO missionaries (email, name, cohort, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, ?, ?, ?, 'active', 24)
        ON CONFLICT(email) DO UPDATE SET 
          psid = excluded.psid, 
          status = 'active', 
          name = excluded.name,
          points = CASE WHEN points = 0 THEN excluded.points ELSE points END
      `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, welcomePts, refCode, psid]);

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      const verifiedRecord = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];

      await logSystemEvent('INFO', `Account verified for ${verifiedRecord.name} (Welcome Pts: ${welcomePts})`, psid);
      
      const congratMsg = isRejoiningUser 
        ? `🎉 Welcome back ${verifiedRecord.name}! Your account has been reactivated.`
        : `🎉 Congratulations ${verifiedRecord.name}! Your account is verified with 1 Welcome Point!`;

      await renderVerifiedDashboard(psid, verifiedRecord, congratMsg);
      return;
    } else {
      await sendTextMessage(psid, "❌ Incorrect 6-digit code. Please enter the correct code below:", [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Edit Info", payload: "GET_STARTED" }
      ]);
      return;
    }
  }

  await runSql("UPDATE sessions SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
  await sendWelcomeAndTerms(psid);
}
