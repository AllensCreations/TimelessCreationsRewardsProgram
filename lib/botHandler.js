import { isRateLimited, checkDailyViewLimit } from "./security.js";
import { runSql } from './db.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();

// Converts alphanumeric text to Mathematical Sans-Serif Bold Unicode (𝗔-𝗭, 𝗮-𝘇, 𝟬-𝟵)
export function toUnicodeBold(text) {
  if (!text) return "";
  return text.replace(/[A-Za-z0-9]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65)); // A-Z
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97)); // a-z
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + (code - 48)); // 0-9
    return char;
  });
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

export async function logEvent(level, message, psid = 'SYSTEM') {
  const cleanMsg = `[PSID:${psid}] ${message}`.substring(0, 1000);
  console.log(`[${level.toUpperCase()}] ${cleanMsg}`);
  try {
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'));",
      [level.toUpperCase(), cleanMsg]
    );
  } catch (_) {}
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

  if (!products || products.length === 0) return null;

  const elements = products.map(item => {
    const price = Number(item.price) || 0;
    const canAfford = senderPoints >= price;
    const pointDiff = price - senderPoints;

    return {
      title: toUnicodeBold(item.name),
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
      { content_type: "text", title: "🎟️ Redeem Promo", payload: "PROMO_INFO" }
    ]
  };
}

export async function renderVerifiedDashboard(psid, missionary, prefixMsg = "") {
  const points = Number(missionary.points) || 0;
  const refCode = missionary.referral_code || "JOIN";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const greeting = prefixMsg ? `${prefixMsg}\n\n` : "";

  const titleHeader = toUnicodeBold("MISSIONARY DASHBOARD");
  const infoHeader = toUnicodeBold("Profile Information:");
  const pointsHeader = toUnicodeBold("Reward Points Balance:");

  const dashboardText = `${greeting}📊 ${titleHeader}

${infoHeader}
• ${missionary.name}
• ${missionary.email}
• Batch: ${missionary.batch_month || 'August 2026'}
• Referral Code: ${refCode}

${pointsHeader}
• ${points} Points`;

  const inviteHeader = toUnicodeBold("Invite a Companion & Earn +1 Point");
  const invitePromoText = `💌 ${inviteHeader}

Share this with your fellow missionaries:

"✨ Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality missionary essentials! 🎁

Join here: ${inviteLink}

(When you join using my code, we BOTH get +1 Reward Point instantly!) 🚀"`;

  await sendTextMessage(psid, dashboardText);
  await sendTextMessage(psid, invitePromoText, [
    { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
    { title: "🎟️ Redeem Promo", payload: "PROMO_INFO" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
  ]);

  // Check Limit B: Max 3 Heavy Carousel Views Per Day
  const dailyLimit = await checkDailyViewLimit(psid, 3);
  if (dailyLimit.allowed) {
    const carousel = await buildCatalogCarousel(points);
    if (carousel) {
      await sendFbGraphMessage(psid, carousel);
    }
  } else {
    await sendTextMessage(psid, "💡 Note: You have reached your 3 daily visual catalog views. Your live balance is up-to-date above. Reply /redeem <CODE> anytime to claim promo codes!", [
      { title: "🎟️ Redeem Promo", payload: "PROMO_INFO" }
    ]);
  }
}

export async function handlePromoRedeem(psid, missionary, codeText) {
  const code = codeText.trim().toUpperCase();
  if (!code) {
    await sendTextMessage(psid, "⚠️ Please specify a promo code. Example:\n/redeem SPECIALGIFT");
    return;
  }

  const promoRows = await runSql("SELECT * FROM promo_codes WHERE UPPER(code) = ? LIMIT 1", [code]);
  const promo = promoRows?.[0];

  if (!promo) {
    await sendTextMessage(psid, `❌ Promo code "${code}" is invalid or has expired.`, [
      { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
    ]);
    return;
  }

  if (Number(promo.claimed_count) >= Number(promo.max_users)) {
    await sendTextMessage(psid, `⚠️ Promo code "${code}" has reached its maximum user claim limit (${promo.max_users}/${promo.max_users}).`, [
      { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
    ]);
    return;
  }

  const alreadyClaimed = await runSql("SELECT 1 FROM promo_redemptions WHERE UPPER(code) = ? AND psid = ? LIMIT 1", [code, psid]);
  if (alreadyClaimed && alreadyClaimed.length > 0) {
    await sendTextMessage(psid, `⚠️ You have already redeemed promo code "${code}".`, [
      { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
    ]);
    return;
  }

  const bonusPoints = Number(promo.points) || 1;
  await runSql("UPDATE missionaries SET points = points + ? WHERE psid = ?", [bonusPoints, psid]);
  await runSql("INSERT INTO promo_redemptions (code, psid) VALUES (?, ?)", [code, psid]);
  await runSql("UPDATE promo_codes SET claimed_count = claimed_count + 1 WHERE UPPER(code) = ?", [code]);

  await logEvent('INFO', `Promo ${code} (+${bonusPoints} PTS) redeemed by ${missionary.name} (${missionary.email})`, psid);

  const updatedMissionary = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
  const congratsHeader = toUnicodeBold("PROMO CODE REDEEMED!");

  await sendTextMessage(
    psid,
    `🎉 ${congratsHeader}\n\nYou successfully claimed promo code ${code}!\n⭐ +${bonusPoints} Reward Points added to your balance.\n\nNew Balance: ${updatedMissionary.points} Points.`,
    [
      { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
    ]
  );
}

export async function handleBotMessage(psid, rawMessage = '', payload = null, referralParam = '') {
  // Check Limit A: Anti-Flooding Throttle (Max 5 msgs / 60 seconds)
  if (await isRateLimited(psid, 5, 60)) {
    await logEvent('WARN', `Rate limit exceeded (5 msgs/min)`, psid);
    await sendTextMessage(psid, "⏳ You are sending messages too quickly. Please wait a moment before trying again.");
    return;
  }

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

  // Command /redeem <CODE>
  if (lower.startsWith('/redeem') || lower.startsWith('redeem ') || lower === 'redeem') {
    if (!isVerified) {
      await sendTextMessage(psid, "⚠️ Please verify your missionary account first to redeem promo codes.", [
        { title: "✨ Get Started", payload: "GET_STARTED" }
      ]);
      return;
    }
    const codePart = text.replace(/^\/?redeem\s*/i, '').trim();
    await handlePromoRedeem(psid, missionary, codePart);
    return;
  }

  if (cleanPayload === 'PROMO_INFO') {
    if (!isVerified) {
      await sendTextMessage(psid, "⚠️ Please verify your missionary account first to redeem promo codes.", [
        { title: "✨ Get Started", payload: "GET_STARTED" }
      ]);
      return;
    }
    await sendTextMessage(psid, "🎟️ To redeem a freebie promo code, simply reply in this chat with:\n\n/redeem YOURCODE\n\nExample:\n/redeem SPECIALGIFT");
    return;
  }

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

      const orderId = `TCRP${Math.floor(10000 + Math.random() * 90000)}`;
      await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ?", [cost, psid]);
      await runSql(
        "INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')",
        [orderId, psid, missionary.email, missionary.name, prod.name, cost]
      );

      const updatedMissionary = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
      const claimTitle = toUnicodeBold(`CONGRATULATIONS, ${missionary.name}!`);

      await sendTextMessage(
        psid,
        `🎉 ${claimTitle}\n\nYou have successfully claimed:\n📦 Item: ${prod.name}\n⭐ Points Used: ${cost} PTS\n🆔 Order ID: ${orderId}\n\n💌 Your redemption order has been logged and is being processed!`,
        [
          { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
          { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
        ]
      );

      await renderVerifiedDashboard(psid, updatedMissionary);
      return;
    }

    if (lower === 'faqs' || cleanPayload === 'FAQS_PAYLOAD') {
      const faqTitle = toUnicodeBold("FREQUENTLY ASKED QUESTIONS");
      await sendTextMessage(psid, `📖 ${faqTitle}\n\n1. What is TCRP?\nA free rewards program dedicated to LDS full-time missionaries.\n\n2. How do I earn points?\n• +1 Point upon email verification\n• +1 Point whenever a companion joins with your referral link\n• Bonus points from monthly promo codes!`, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" },
        { title: "🎟️ Redeem Promo", payload: "PROMO_INFO" }
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
    const welcomeBold = toUnicodeBold("Welcome to Timeless Creations Rewards Program (TCRP)!");
    await sendTextMessage(
      psid,
      `✨ ${welcomeBold}\n\n📜 Terms & Privacy Notice:\n• Program is exclusively for full-time missionaries with active @missionary.org email addresses.\n• Data is used strictly for verification and reward delivery.\n\nDo you agree to continue?`,
      [
        { title: "✅ Agree", payload: "TERMS_AGREE" },
        { title: "❌ Disagree", payload: "TERMS_DISAGREE" }
      ]
    );
    return;
  }

  // 2. Terms Agreement
  if (session.state === 'AWAITING_TERMS') {
    if (cleanPayload === 'TERMS_AGREE' || lower.includes('agree')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_DETAILS' WHERE psid = ?", [psid]);
      await sendTextMessage(
        psid,
        "✅ Thank you for agreeing!\n\nPlease send your details in this format:\n\n1. Title & Name (e.g. Elder Smith)\n2. Batch Month (e.g. August 2026)\n3. Email (@missionary.org)\n4. Referral Code (e.g. TCRP50)\n\nExample:\nElder Smith\nAugust 2026\njohn.smith@missionary.org\nTCRP50"
      );
      return;
    } else {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextMessage(
        psid,
        "⚠️ You have declined the Terms & Conditions. You can restart anytime by typing 'Get Started'.",
        [{ title: "✨ Get Started", payload: "GET_STARTED" }]
      );
      return;
    }
  }

  // 3. Capture Details & Send OTP
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
      if (parts.length > 0) titleName = parts[0] || "Elder Missionary";
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

  // 4. OTP Verification
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
          points = CASE WHEN points = 0 THEN 1 ELSE points END
      `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, batch, refCode, psid]);

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      const verifiedRecord = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];

      await logEvent('INFO', `Account verified successfully for ${verifiedRecord.name} (${verifiedRecord.email})`, psid);
      
      const verifiedGreeting = `🎉 ${toUnicodeBold("ACCOUNT VERIFIED!")}\nCongratulations ${verifiedRecord.name}! Your account is now active with +1 Welcome Point.`;
      await renderVerifiedDashboard(psid, verifiedRecord, verifiedGreeting);
      return;
    } else {
      await sendTextMessage(psid, "❌ Incorrect 6-digit code. Please enter the correct code below:", [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" }
      ]);
      return;
    }
  }

  await sendTextMessage(
    psid,
    "✨ Welcome to Timeless Creations Rewards Program (TCRP)!",
    [{ title: "✨ Get Started", payload: "GET_STARTED" }]
  );
}
