import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

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

async function sendFbGraphMessage(psid, messagePayload) {
  try {
    const textPreview = messagePayload.text || (messagePayload.attachment ? `[Carousel / Template]` : '[Message]');
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [psid, textPreview]);
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
      { content_type: "text", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
    ]
  };
}

export async function renderVerifiedDashboard(psid, missionary, prefixMsg = "") {
  const points = Number(missionary.points) || 0;
  const refCode = missionary.referral_code || "JOIN";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const greeting = prefixMsg ? `${prefixMsg}\n\n` : "";

  const dashboardText = `${greeting}📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗

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
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
  ]);

  const carousel = await buildCatalogCarousel(points);
  if (carousel) {
    await sendFbGraphMessage(psid, carousel);
  }
}

async function sendWelcomeAndTerms(psid) {
  // Condensed Privacy Policy & Terms of Service (~540 chars)
  const welcomeAndTermsMessage = 
`✨ 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗧𝗖𝗥𝗣!
Timeless Creations Rewards Program encourages full-time LDS missionaries across the Philippines with rewards and monthly support.

📜 𝗧𝗲𝗿𝗺𝘀 & 𝗣𝗿𝗶𝘃𝗮𝗰𝘆 𝗦𝘂𝗺𝗺𝗮𝗿𝘆
• 𝗘𝗹𝗶𝗴𝗶𝗯𝗶𝗹𝗶𝘁𝘆: Full-time missionaries with valid @missionary.org emails.
• 𝗗𝗮𝘁𝗮 𝗨𝘀𝗮𝗴𝗲: PSID & email are used strictly for OTP verification, points tracking (+1 PT referrals), & monthly letters. Never sold/rented.
• 𝗗𝗲𝗹𝗲𝘁𝗶𝗼𝗻: Type /delete_account anytime for full removal.

Do you agree to continue?`;

  await sendTextMessage(psid, welcomeAndTermsMessage, [
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
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || cleanPayload || cleanRef || '[Action]']);
  } catch (_) {}

  // Shortcut for testing: type RESET to wipe test session
  if (lower === 'reset') {
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("UPDATE missionaries SET psid = NULL WHERE psid = ?", [psid]);
    await logSystemEvent('WARN', `Session wiped via RESET keyword`, psid);
    await sendTextMessage(psid, "🔄 Session reset! Tap 'Get Started' below to begin:", [
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  // 1. Check if user is ALREADY verified in missionaries table by PSID
  const missionaryRows = await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
  const missionary = missionaryRows?.[0] || null;
  const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';

  if (isVerified) {
    await logSystemEvent('INFO', `User verified (${missionary.name}). Showing dashboard.`, psid);
    if (lower === 'faqs' || cleanPayload === 'FAQS_PAYLOAD') {
      await sendTextMessage(psid, "📖 𝗙𝗥𝗘𝗤𝗨𝗘𝗡𝗧𝗟𝗬 𝗔𝗦𝗞𝗘𝗗 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡𝗦:\n\n1. 𝗪𝗵𝗮𝘁 𝗶𝘀 𝗧𝗖𝗥𝗣? Missionary encouragement and rewards.\n2. 𝗛𝗼𝘄 𝗱𝗼 𝗿𝗲𝗳𝗲𝗿𝗿𝗮ls 𝘄𝗼𝗿𝗸? Share your invite link — you and your companion BOTH receive +1 Point when they verify!", [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }
    await renderVerifiedDashboard(psid, missionary);
    return;
  }

  // 2. UNVERIFIED USER: Onboarding State Machine (Welcome & Terms -> Referral -> Email -> OTP)
  let session = (await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [psid]))?.[0] || null;

  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'AWAITING_TERMS', 0)", [psid]);
    if (cleanRef) {
      await runSql("UPDATE sessions SET invite_code = ? WHERE psid = ?", [cleanRef, psid]);
    }
    await sendWelcomeAndTerms(psid);
    return;
  }

  if (session.state === 'START' || lower === 'get started' || cleanPayload === 'GET_STARTED') {
    await runSql("UPDATE sessions SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
    if (cleanRef) {
      await runSql("UPDATE sessions SET invite_code = ? WHERE psid = ?", [cleanRef, psid]);
    }
    await sendWelcomeAndTerms(psid);
    return;
  }

  // STEP 1: TERMS & PRIVACY ACCEPTANCE
  if (session.state === 'AWAITING_TERMS') {
    if (cleanPayload === 'TERMS_AGREE' || lower.includes('agree') || lower.includes('continue')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
      
      const promptMsg = session.invite_code 
        ? `✅ Terms accepted!\n\n🎟️ Detected Referral Code: *${session.invite_code}*\n\nType *${session.invite_code}* below to apply it, or enter another valid 6-character code / TCRP50:`
        : `✅ Thank you for agreeing to the Terms & Privacy Policy!\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or Global Code (*TCRP50*):`;
      
      await sendTextMessage(psid, promptMsg);
      return;
    } else if (cleanPayload === 'TERMS_DECLINE' || lower.includes('decline')) {
      await sendTextMessage(psid, "⚠️ You must accept the Privacy Policy & Terms of Service to participate in TCRP and claim rewards. Tap 'Agree & Continue' when you are ready:", [
        { title: "✅ Agree & Continue", payload: "TERMS_AGREE" }
      ]);
      return;
    } else {
      await sendWelcomeAndTerms(psid);
      return;
    }
  }

  // STEP 2: REFERRAL CODE VALIDATION
  if (session.state === 'AWAITING_REFERRAL') {
    const inputCode = text.trim().toUpperCase();
    const referrerRow = await runSql("SELECT psid, email FROM missionaries WHERE UPPER(referral_code) = ? LIMIT 1", [inputCode]);
    const globalRow = await runSql("SELECT code, uses_count, max_limit FROM global_referral_pool WHERE UPPER(code) = ? LIMIT 1", [inputCode]);

    let validCode = null;
    if (referrerRow && referrerRow.length > 0) {
      if (referrerRow[0].psid === psid) {
        await sendTextMessage(psid, "❌ You cannot use your own referral code. Please enter a valid companion referral code or TCRP50:");
        return;
      }
      validCode = inputCode;
    } else if (globalRow && globalRow.length > 0) {
      validCode = inputCode;
    } else {
      await sendTextMessage(psid, "❌ Invalid Referral Code. Please enter a valid 6-character code (e.g. TCRP50):");
      return;
    }

    await runSql("UPDATE sessions SET state = 'AWAITING_NAME_EMAIL', invite_code = ? WHERE psid = ?", [validCode, psid]);
    await sendTextMessage(
      psid,
      `✅ Referral Code *"${validCode}"* accepted!\n\n👤 Please type your Title & Name followed by your official @missionary.org email on the next line.\n\nExample:\nElder Smith\njohn.smith@missionary.org`
    );
    return;
  }

  // STEP 3: MISSIONARY NAME & EMAIL
  if (session.state === 'AWAITING_NAME_EMAIL') {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (!emailMatch) {
      await sendTextMessage(psid, "⚠️ Invalid Email. You must provide an official @missionary.org email address (e.g. elder.smith@missionary.org).");
      return;
    }

    const emailInput = emailMatch[1].toLowerCase();
    const nameInput = text.replace(emailMatch[0], '').replace(/\n/g, ' ').trim() || "Elder Missionary";
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql("UPDATE sessions SET state = 'AWAITING_OTP', temp_title = ?, temp_email = ?, otp_code = ? WHERE psid = ?", [nameInput, emailInput, otp, psid]);
    await logSystemEvent('INFO', `🔐 [OTP GENERATED] Email: ${emailInput} | Code: ${otp}`, psid);

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
        await logSystemEvent('ERROR', `Brevo OTP dispatch error: ${err.message}`, psid);
      }
    }

    await sendTextMessage(
      psid,
      `📩 We dispatched a 6-digit verification code to:\n*${emailInput}*\n\nType the 6-digit code below to complete your verification:`,
      [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]
    );
    return;
  }

  // STEP 4: OTP CODE VERIFICATION
  if (session.state === 'AWAITING_OTP') {
    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const refCode = generateXNXNXN();
      const cohort = (session.temp_title || '').toLowerCase().includes('sister') ? 'sister' : 'elder';

      if (session.invite_code) {
        await runSql("UPDATE missionaries SET points = points + 1 WHERE UPPER(referral_code) = ?", [session.invite_code.toUpperCase()]);
      }

      await runSql(`
        INSERT INTO missionaries (email, name, cohort, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, 1, ?, ?, 'active', 24)
        ON CONFLICT(email) DO UPDATE SET 
          psid = excluded.psid, 
          status = 'active', 
          name = excluded.name,
          points = CASE WHEN points = 0 THEN 1 ELSE points END
      `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, refCode, psid]);

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      const verifiedRecord = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];

      await logSystemEvent('INFO', `Account verified successfully for ${verifiedRecord.name} (${verifiedRecord.email})`, psid);
      await renderVerifiedDashboard(psid, verifiedRecord, `🎉 Congratulations ${verifiedRecord.name}! Your account is now verified with 1 Welcome Point!`);
      return;
    } else {
      await sendTextMessage(psid, "❌ Incorrect 6-digit code. Please enter the correct code below:", [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]);
      return;
    }
  }

  // Fallback redirection to Welcome & Terms
  await runSql("UPDATE sessions SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
  await sendWelcomeAndTerms(psid);
}
