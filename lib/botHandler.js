import { isRateLimited } from "./security.js";
import { runSql } from './db.js';
import { sendReceiptEmail } from './mailer.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();

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

export async function logEvent(level, message, psid = 'SYSTEM') {
  const cleanMsg = `[PSID:${psid}] ${message}`.substring(0, 1000);
  console.log(`[${level.toUpperCase()}] ${cleanMsg}`);
  try {
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'));",
      [level.toUpperCase(), cleanMsg]
    );
  } catch (err) {
    console.error("DB Log error:", err.message);
  }
}

async function sendFbGraphMessage(psid, messagePayload) {
  try {
    const textPreview = messagePayload.text || (messagePayload.attachment ? `[Carousel / Template]` : '[Message]');
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [psid, textPreview]);
  } catch (_) {}

  const isMockPsid = String(psid).startsWith("TEST_") || String(psid).startsWith("SIM_");
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.startsWith('EAA_MOCK') || isMockPsid) {
    await logEvent('INFO', `(Local Sim) Message dispatched: ${JSON.stringify(messagePayload).substring(0, 80)}`, psid);
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
      await logEvent('ERROR', `Facebook Graph API Error: ${result.error.message}`, psid);
    } else {
      await logEvent('INFO', `Dispatched to Facebook Graph API (msg_id: ${result.message_id})`, psid);
    }
  } catch (err) {
    await logEvent('ERROR', `Facebook network dispatch failed: ${err.message}`, psid);
  }
}

export async function sendTextMessage(psid, text, quickReplies = []) {
  const payload = { text };
  if (quickReplies && quickReplies.length > 0) {
    payload.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload || qr.title
    }));
  }
  await sendFbGraphMessage(psid, payload);
}

export async function buildCatalogCarousel(senderPoints = 0) {
  let products = [];
  try {
    products = await runSql("SELECT id, name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
  } catch (e) {
    await logEvent('WARN', `Failed to load rewards catalog: ${e.message}`);
  }

  if (!products || products.length === 0) {
    return null;
  }

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
      { content_type: "text", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
    ]
  };
}

export async function renderVerifiedDashboard(psid, missionary, prefixMsg = "") {
  const points = Number(missionary.points) || 0;
  const refCode = missionary.referral_code || "JOIN";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const greeting = prefixMsg ? `${prefixMsg}\n\n` : "";

  const dashboardText = `${greeting}📊 MISSIONARY DASHBOARD

👤 Information:
• ${missionary.name}
• ${missionary.email}
• Batch: ${missionary.batch_month || 'August 2026'}

⭐ Points Balance:
• ${points} Points`;

  const invitePromoText = `💌 Invite a Friend & Earn +1 PT

Copy and send this to your companion or fellow missionary:

"✨ Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality missionary essentials worth ₱50 to ₱500! 🎁

Join here: ${inviteLink}

(When you join using my code, we BOTH receive +1 Reward Point instantly!) 🚀"`;

  await sendTextMessage(psid, dashboardText);
  await sendTextMessage(psid, invitePromoText, [
    { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
  ]);

  const carousel = await buildCatalogCarousel(points);
  if (carousel) {
    await sendFbGraphMessage(psid, carousel);
  }
}

export async function handleBotMessage(psid, rawMessage = '', payload = null, referralParam = '') {
  if (await isRateLimited(psid)) return;
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();
  const cleanPayload = (payload || '').trim();
  const rawRef = (referralParam || '').trim().toUpperCase();
  const cleanRef = (rawRef.includes('DASHBOARD') || rawRef.includes('FAQS') || rawRef.length > 10) ? '' : rawRef;

  await logEvent('INFO', `Inbound: text="${text}", payload="${cleanPayload}", ref="${cleanRef}"`, psid);

  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || cleanPayload || cleanRef || '[Action]']);
  } catch (_) {}

  if (lower === 'reset') {
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("UPDATE missionaries SET psid = NULL WHERE psid = ?", [psid]);
    await logEvent('WARN', `Session wiped via RESET keyword`, psid);
    await sendTextMessage(psid, "🔄 Session reset! Tap 'Get Started' below to begin:", [
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  const missionaryRows = await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
  const missionary = missionaryRows?.[0] || null;
  const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';

  if (isVerified) {
    if (cleanPayload.startsWith("CLAIM_ITEM_")) {
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
        await sendTextMessage(psid, `⚠️ You need ${diff} more Point(s) to claim "${prod.name}".`, [
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

      const updatedMissionary = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];

      await sendTextMessage(
        psid,
        `🎉 𝗖𝗢𝗡𝗚𝗥𝗔𝗧𝗨𝗟𝗔𝗧𝗜𝗢𝗡𝗦, ${missionary.name}!\n\nYou have successfully claimed:\n📦 𝗜𝘁𝗲𝗺: ${prod.name}\n⭐ 𝗣𝗼𝗶𝗻𝘁𝘀 𝗨𝘀𝗲𝗱: ${cost} PTS\n🆔 𝗢𝗿𝗱𝗲𝗿 𝗜𝗗: ${orderId}\n\n💌 𝗣𝗹𝗲𝗮𝘀𝗲 𝗰𝗵𝗲𝗰𝗸 𝘆𝗼𝘂𝗿 𝗲𝗺𝗮𝗶𝗹 𝗶𝗻𝗯𝗼𝘅 (${missionary.email}) for your official redemption receipt and fulfillment instructions!`,
        [
          { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
          { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
        ]
      );

      await renderVerifiedDashboard(psid, updatedMissionary);
      return;
    }

    if (lower === 'faqs' || cleanPayload === 'FAQS_PAYLOAD') {
      await sendTextMessage(psid, "📖 FREQUENTLY ASKED QUESTIONS:\n1. What is TCRP? Missionary rewards.\n2. How do referrals work? +1 Point for both when someone joins.", [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }
    await renderVerifiedDashboard(psid, missionary);
    return;
  }

  // UNVERIFIED FLOW
  let session = (await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [psid]))?.[0] || null;

  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'START', 0)", [psid]);
    session = { psid, state: 'START' };
  }

  // 1. Get Started Trigger
  if (session.state === 'START' || lower === 'get started' || cleanPayload === 'GET_STARTED') {
    await runSql("UPDATE sessions SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
    await sendTextMessage(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\n📜 Terms & Privacy Notice:\n• Program is exclusively for full-time missionaries with active @missionary.org email addresses.\n• Data is used strictly for authentication and rewards.\n\nDo you agree to continue?",
      [
        { title: "✅ Agree", payload: "TERMS_AGREE" },
        { title: "❌ Disagree", payload: "TERMS_DISAGREE" }
      ]
    );
    return;
  }

  // 2. T&C (Agree / Disagree)
  if (session.state === 'AWAITING_TERMS') {
    if (cleanPayload === 'TERMS_AGREE' || lower.includes('agree')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_DETAILS' WHERE psid = ?", [psid]);
      await sendTextMessage(
        psid,
        "✅ Thank you for agreeing!\n\nPlease send your details in this format:\n\n1. Title & Name (e.g. Elder Smith)\n2. Batch Month (e.g. August 2026)\n3. Email (@missionary.org)\n4. Referral Code (e.g. TCRP50)\n\nExample:\nElder Smith\nAugust 2026\njohn.smith@missionary.org\nTCRP50"
      );
      return;
    } else if (cleanPayload === 'TERMS_DISAGREE' || lower.includes('disagree') || lower.includes('decline')) {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextMessage(
        psid,
        "⚠️ You have declined the Terms & Conditions. You can restart anytime by typing 'Get Started'.",
        [{ title: "✨ Get Started", payload: "GET_STARTED" }]
      );
      return;
    } else {
      await sendTextMessage(psid, "Please select an option below:", [
        { title: "✅ Agree", payload: "TERMS_AGREE" },
        { title: "❌ Disagree", payload: "TERMS_DISAGREE" }
      ]);
      return;
    }
  }

  // 3. Title, Batch, Email, Referral Code Input
  if (session.state === 'AWAITING_DETAILS') {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (!emailMatch) {
      await sendTextMessage(
        psid,
        "⚠️ Invalid or missing @missionary.org email address. Please send your details again following the required format:\n\nElder Smith\nAugust 2026\njohn.smith@missionary.org\nTCRP50"
      );
      return;
    }

    const emailInput = emailMatch[1].toLowerCase();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let titleName = "Elder Missionary";
    let batchMonth = "August 2026";
    let referralCode = "TCRP50";

    if (lines.length >= 3) {
      titleName = lines[0];
      batchMonth = lines[1].includes('@') ? "August 2026" : lines[1];
      const possibleRef = lines[lines.length - 1];
      if (!possibleRef.includes('@') && possibleRef.length >= 4) {
        referralCode = possibleRef.toUpperCase();
      }
    } else {
      const parts = text.replace(emailMatch[0], '').trim().split(/\s+/);
      if (parts.length > 0) {
        titleName = parts[0] || "Elder Missionary";
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql(`
      UPDATE sessions 
      SET state = 'AWAITING_OTP', 
          temp_title = ?, 
          temp_email = ?, 
          temp_batch = ?, 
          invite_code = ?, 
          otp_code = ? 
      WHERE psid = ?
    `, [titleName, emailInput, batchMonth, referralCode, otp, psid]);

    await logEvent('INFO', `🔐 [OTP GENERATED] Email: ${emailInput} | Code: ${otp} | Batch: ${batchMonth}`, psid);

    if (BREVO_API_KEY) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Timeless Creations RP", email: "noreply.timelesscreations.ph@gmail.com" },
            to: [{ email: emailInput }],
            subject: `🔐 Your TCRP Verification Code: ${otp}`,
            htmlContent: `<div style="padding:20px;font-family:Georgia,serif;">Your 6-digit Verification Code is: <b style="font-size:24px;color:#8b1a1a;">${otp}</b></div>`
          })
        });
      } catch (err) {
        await logEvent('ERROR', `Brevo OTP dispatch error: ${err.message}`, psid);
      }
    }

    await sendTextMessage(
      psid,
      `📩 Verification code sent to:\n*${emailInput}*\n\nPlease type your 6-digit verification code below:`,
      [{ title: "🔄 Resend Code", payload: "RESEND_OTP" }]
    );
    return;
  }

  // 4. OTP Verification & Dashboard
  if (session.state === 'AWAITING_OTP') {
    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const refCode = generateXNXNXN();
      const cohort = (session.temp_title || '').toLowerCase().includes('sister') ? 'sister' : 'elder';
      const batch = session.temp_batch || 'August 2026';

      if (session.invite_code) {
        await runSql("UPDATE missionaries SET points = points + 1 WHERE UPPER(referral_code) = ?", [session.invite_code.toUpperCase()]);
      }

      await runSql(`
        INSERT INTO missionaries (email, name, cohort, batch_month, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, ?, 1, ?, ?, 'active', 24)
        ON CONFLICT(email) DO UPDATE SET 
          psid = excluded.psid, 
          status = 'active', 
          name = excluded.name,
          batch_month = excluded.batch_month,
          points = CASE WHEN points = 0 ? 1 : points END
      `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, batch, refCode, psid]);

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      const verifiedRecord = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];

      await logEvent('INFO', `Account verified successfully for ${verifiedRecord.name} (${verifiedRecord.email})`, psid);
      
      await renderVerifiedDashboard(psid, verifiedRecord, `🎉 𝙑𝙀𝙍𝙄𝗙𝙄𝙀𝘿!\nCongratulations ${verifiedRecord.name}! Your account is now active with +1 Welcome Point.`);
      return;
    } else {
      await sendTextMessage(psid, "❌ Incorrect 6-digit code. Please enter the correct code below:", [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" }
      ]);
      return;
    }
  }

  // Fallback
  await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
  await sendTextMessage(
    psid,
    "✨ Welcome to Timeless Creations Rewards Program (TCRP)!",
    [{ title: "✨ Get Started", payload: "GET_STARTED" }]
  );
}
