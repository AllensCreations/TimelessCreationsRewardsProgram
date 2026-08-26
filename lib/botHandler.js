import crypto from 'crypto';
import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

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
  const MAX_LEN = 1900;
  if (text.length <= MAX_LEN) {
    const payload = { text };
    if (quickReplies && quickReplies.length > 0) {
      payload.quick_replies = quickReplies.map(qr => ({
        content_type: "text",
        title: qr.title,
        payload: qr.payload || qr.title
      }));
    }
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
    if (isLast && quickReplies && quickReplies.length > 0) {
      payload.quick_replies = quickReplies.map(qr => ({
        content_type: "text",
        title: qr.title,
        payload: qr.payload || qr.title
      }));
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
      { content_type: "text", title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
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

1. 𝗪𝗵𝗮𝘁 𝗶𝘀 𝘁𝗵𝗲 𝗧𝗶𝗺𝗲𝗹𝗲𝘀𝘀𝗖𝗿𝗲𝗮𝘁𝗶𝗼𝗻𝘀𝗥𝗲𝘄𝗮𝗿𝗱𝘀𝗣𝗿𝗼𝗴𝗿𝗮𝗺 (𝗧𝗖𝗥𝗣)?
Answer: TCRP is an exclusive rewards platform created by Timeless Creations for missionaries. By participating and sharing the program with fellow missionaries, you can earn points to redeem custom missionary gear like keychains, teaching sets, and scripture cases.

2. 𝗪𝗵𝗼 𝗶𝘀 𝗲𝗹𝗶𝗴𝗶𝗯𝗹𝗲 𝘁𝗼 𝗷𝗼𝗶𝗻 𝗧𝗖𝗥𝗣?
Answer: TCRP is open exclusively to currently serving missionaries who hold a valid, official @missionary.org email address and carry the title of Elder or Sister.

3. 𝗛𝗼𝘄 𝗱𝗼 𝗜 𝗴𝗲𝘁 𝗮𝗻 𝗜𝗻𝘃𝗶𝘁𝗮𝘁𝗶𝗼𝗻 𝗖𝗼𝗱𝗲 𝘁𝗼 𝘀𝗶𝗴𝗻 𝘂𝗽?
Answer: You can join using a personal referral code/link shared by a fellow missionary, or use the global code TCRP50.

4. 𝗛𝗼𝘄 𝗱𝗼𝗲𝘀 𝘁𝗵𝗲 𝗿𝗲𝗳𝗲𝗿𝗿𝗮𝗹 𝗮𝗻𝗱 𝗽𝗼𝗶𝗻𝘁 𝘀𝘆𝘀𝘁𝗲𝗺 𝘄𝗼𝗿𝗸?
Answer: The system runs on a simple 1:1 rule:
• You receive +1 Welcome Point as soon as your account is verified.
• Whenever another missionary registers and verifies using your referral code/link, both of you receive +1 Point.

5. 𝗪𝗵𝗮𝘁 𝗶𝘁𝗲𝗺𝘀 𝗰𝗮𝗻 𝗜 𝗿𝗲𝗱𝗲𝗲𝗺 𝘄𝗶𝘁𝗵 𝗺𝘆 𝗽𝗼𝗶𝗻𝘁𝘀?
Answer: You can claim items directly through the in-chat Catalog carousel:
${rewardsCatalogList}

6. 𝗪𝗵𝘆 𝗱𝗶𝗱𝗻'𝘁 𝗜 𝗿𝗲𝗰𝗲𝗶𝘃𝗲 𝗺𝘆 𝟲-𝗱𝗶𝗴𝗶𝘁 𝗲𝗺𝗮𝗶𝗹 𝘃𝗲𝗿𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻 𝗰𝗼𝗱𝗲?
Answer: Check your spam/junk folder in your @missionary.org inbox. Ensure you entered your exact email address without typos. If you still don't see it, tap '🔄 Resend Code' in chat.

7. 𝗪𝗵𝗮𝘁 𝗱𝗼 𝗜 𝗱𝗼 𝗮𝗳𝘁𝗲𝗿 𝗿𝗲𝗱𝗲𝗲𝗺𝗶𝗻𝗴 𝗮 𝗿𝗲𝘄𝗮𝗿𝗱?
Answer: Once redeemed, an official Redemption Receipt containing a unique Reference ID is generated. Keep this ID and present it to an admin or page representative to arrange dispatch/fulfillment.

8. 𝗖𝗮𝗻 𝗜 𝘂𝘀𝗲 𝗮 𝗽𝗲𝗿𝘀𝗼𝗻𝗮𝗹 𝗲𝗺𝗮𝗶𝗹 (𝗹𝗶𝗸𝗲 𝗚𝗺𝗮𝗶𝗹 𝗼𝗿 𝗬𝗮𝗵𝗼𝗼) 𝘁𝗼 𝗿𝗲𝗴𝗶𝘀𝘁𝗲𝗿?
Answer: No. To ensure only active missionaries receive custom missionary gear, the system strictly enforces verification via official @missionary.org email addresses.

9. 𝗛𝗼𝘄 𝗱𝗼 𝗜 𝗰𝗵𝗲𝗰𝗸 𝗺𝘆 𝗰𝘂𝗿𝗿𝗲𝗻𝘁 𝗽𝗼𝗶𝗻𝘁 𝗯𝗮𝗹𝗮𝗻𝗰𝗲 𝗮𝗻𝗱 𝗿𝗲𝗳𝗲𝗿𝗿𝗮𝗹 𝗹𝗶𝗻𝗸?
Answer: You can view your balance anytime by tapping the 📊 Dashboard button.

10. 𝗜𝘀 𝗺𝘆 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻 𝘀𝗮𝗳𝗲 𝘄𝗶𝘁𝗵 𝗧𝗖𝗥𝗣?
Answer: Yes. We only collect your Messenger profile ID, title/name, and missionary email address solely for account authentication, reward tracking, and order fulfillment.`;
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

  // -------------------------------------------------------------------------
  // COMMAND: /delete_account (Meta GDPR Compliance with Anti-Exploit Archival)
  // -------------------------------------------------------------------------
  if (lower === '/delete_account' || cleanPayload === 'CONFIRM_DELETE_ACCOUNT') {
    const existingRows = await runSql("SELECT email, points FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
    const record = existingRows?.[0];

    if (!record) {
      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "ℹ️ No registered missionary profile was found associated with your chat thread.");
      return;
    }

    // Retain SHA-256 hash tombstone to prevent point re-farming
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

    // Hard delete personal data from active tables
    await runSql("DELETE FROM missionaries WHERE psid = ?", [psid]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [psid]);

    await logSystemEvent('WARN', `User account deleted under Privacy Policy rights. Anti-fraud hash archived.`, psid);
    await sendTextMessage(
      psid,
      "🗑️ Your account, personal data, and points balance have been completely deleted from our system in accordance with our Privacy Policy.\n\nIf you ever wish to re-join, tap 'Get Started' below:",
      [{ title: "✨ Get Started", payload: "GET_STARTED" }]
    );
    return;
  }

  // Testing Shortcut: RESET
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
    await logSystemEvent('INFO', `User verified (${missionary.name}). Showing dashboard or action.`, psid);
    if (lower === 'faqs' || lower === 'faq' || cleanPayload === 'FAQS_PAYLOAD') {
      const faqsText = await buildDynamicFaqsText();
      await sendTextMessage(psid, faqsText, [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }
    await renderVerifiedDashboard(psid, missionary);
    return;
  }

  // 2. UNVERIFIED USER: Onboarding State Machine
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

  // STEP 4: OTP CODE VERIFICATION & ANTI-EXPLOIT CREDIT
  if (session.state === 'AWAITING_OTP') {
    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const emailHash = hashIdentifier(session.temp_email);
      const psidHash = hashIdentifier(psid);

      // Check anti-exploit audit table
      const auditCheck = await runSql(
        "SELECT identity_hash FROM hashed_audit_identities WHERE identity_hash IN (?, ?) LIMIT 1",
        [emailHash, psidHash]
      );
      const isRejoiningUser = (auditCheck && auditCheck.length > 0);

      // Credit referral point ONLY if the user has never claimed before
      if (session.invite_code && !isRejoiningUser) {
        await runSql("UPDATE missionaries SET points = points + 1 WHERE UPPER(referral_code) = ?", [session.invite_code.toUpperCase()]);
      } else if (isRejoiningUser && session.invite_code) {
        await logSystemEvent('WARN', `Blocked duplicate referral credit: ${session.temp_email} rejoined after prior deletion.`, psid);
      }

      // Record this registration into audit archive
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
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]);
      return;
    }
  }

  // Fallback
  await runSql("UPDATE sessions SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
  await sendWelcomeAndTerms(psid);
}
