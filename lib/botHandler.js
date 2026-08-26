import { runSql } from './db.js';
import { logBotEvent } from './botLogger.js';

const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();

async function checkAntiSpam(psid) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const rows = await runSql("SELECT msg_count, window_start, warned_at FROM bot_rate_limits WHERE psid = ?", [psid]);
    const record = rows[0];
    if (!record) {
      await runSql("INSERT INTO bot_rate_limits (psid, msg_count, window_start, warned_at) VALUES (?, 1, ?, 0)", [psid, now]);
      return { allowed: true };
    }
    if (now - record.window_start > 60) {
      await runSql("UPDATE bot_rate_limits SET msg_count = 1, window_start = ?, warned_at = 0 WHERE psid = ?", [psid]);
      return { allowed: true };
    }
    if (record.msg_count >= 15) return { allowed: false };
    await runSql("UPDATE bot_rate_limits SET msg_count = msg_count + 1 WHERE psid = ?", [psid]);
    return { allowed: true };
  } catch (e) {
    return { allowed: true };
  }
}

function generateXNXNXN() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let res = "";
  for (let i = 0; i < 3; i++) {
    res += letters.charAt(Math.floor(Math.random() * letters.length));
    res += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return res;
}

async function sendTextWithQuickReplies(psid, text, quickReplies = []) {
  const payload = { recipient: { id: psid }, message: { text } };
  if (quickReplies && quickReplies.length > 0) {
    payload.message.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload || qr.title
    }));
  }
  await logBotEvent('INFO', `Outbound Message to PSID ${psid}: ${text.substring(0, 60)}...`, psid);
  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [psid, text]);
  } catch(e){}
}

async function renderDashboardAndCarousel(psid, missionary, prefixMessage = "") {
  const refCode = missionary.referral_code || "JOIN";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const greeting = prefixMessage ? `${prefixMessage}\n\n` : "";
  const dashboardMsg = `${greeting}📊 MISSIONARY DASHBOARD\n\n👤 Information:\n• ${missionary.name}\n• ${missionary.email}\n\n⭐ Points Balance:\n• ${missionary.points || 0} Points\n\n💌 Referral Code: ${refCode}\nLink: ${inviteLink}`;

  await sendTextWithQuickReplies(psid, dashboardMsg, [
    { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
  ]);
}

export async function handleBotMessage(psid, rawMessage, payload = null) {
  const spamCheck = await checkAntiSpam(psid);
  if (!spamCheck.allowed) {
    await logBotEvent('WARN', `Rate limit exceeded for PSID`, psid);
    return;
  }

  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();
  const cleanPayload = (payload || '').trim();

  await logBotEvent('INFO', `Received Message/Payload -> text: "${text}", payload: "${cleanPayload}"`, psid);

  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || cleanPayload || "[Action]"]);
  } catch(e){}

  if (lower === 'reset') {
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("UPDATE missionaries SET psid = NULL WHERE psid = ?", [psid]);
    await logBotEvent('WARN', `User manually executed RESET command`, psid);
    await sendTextWithQuickReplies(psid, "🔄 Session reset successfully! Tap 'Get Started' below to begin onboarding.", [
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  // Check if user is verified in missionaries by exact PSID
  const missionaryRows = await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
  const missionary = missionaryRows[0] || null;
  const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';

  await logBotEvent('INFO', `Verification status for PSID ${psid}: isVerified=${isVerified}`, psid);

  if (isVerified) {
    if (lower === 'faqs' || cleanPayload === 'FAQS_PAYLOAD') {
      await sendTextWithQuickReplies(psid, "📖 FREQUENTLY ASKED QUESTIONS:\n1. What is TCRP? Missionary rewards.\n2. How do referrals work? 1:1 Rule (+1 PT).", [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }
    await renderDashboardAndCarousel(psid, missionary);
    return;
  }

  // ==========================================
  // UNVERIFIED USER: Strict Onboarding Flow
  // ==========================================
  const sessionRows = await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [psid]);
  let session = sessionRows[0] || null;

  if (!session) {
    await logBotEvent('INFO', `No active session found. Initializing AWAITING_REFERRAL state.`, psid);
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'AWAITING_REFERRAL', 0)", [psid]);
    await sendTextWithQuickReplies(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or Global Code (TCRP50):",
      [{ title: "✨ Get Started", payload: "GET_STARTED" }]
    );
    return;
  }

  await logBotEvent('INFO', `Current Session State: ${session.state}`, psid);

  if (session.state === 'START' || lower === 'get started' || cleanPayload === 'GET_STARTED' || !session.state) {
    await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
    await sendTextWithQuickReplies(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or Global Code (TCRP50):",
      [{ title: "✨ Get Started", payload: "GET_STARTED" }]
    );
    return;
  }

  if (session.state === 'AWAITING_REFERRAL') {
    const inputCode = text.trim().toUpperCase();
    const referrerRow = await runSql("SELECT psid, email FROM missionaries WHERE UPPER(referral_code) = ? LIMIT 1", [inputCode]);
    const globalRow = await runSql("SELECT code, uses_count, max_limit FROM global_referral_pool WHERE UPPER(code) = ? LIMIT 1", [inputCode]);

    let validCode = null;
    if (referrerRow && referrerRow.length > 0) {
      if (referrerRow[0].psid === psid) {
        await sendTextWithQuickReplies(psid, "❌ You cannot use your own referral code.");
        return;
      }
      validCode = inputCode;
    } else if (globalRow && globalRow.length > 0) {
      validCode = inputCode;
    } else {
      await sendTextWithQuickReplies(psid, "❌ Invalid Referral Code. Please enter a valid 6-character code or TCRP50:");
      return;
    }

    await runSql("UPDATE sessions SET state = 'AWAITING_TERMS', invite_code = ? WHERE psid = ?", [validCode, psid]);
    await sendTextWithQuickReplies(
      psid,
      `✅ Referral code "${validCode}" accepted!\n\n📜 Terms & Privacy Notice:\n1. Strictly for full-time Elders and Sisters with @missionary.org emails.\n\nDo you agree to continue?`,
      [
        { title: "✅ Agree & Continue", payload: "TERMS_AGREE" },
        { title: "❌ Decline", payload: "TERMS_DECLINE" }
      ]
    );
    return;
  }

  if (session.state === 'AWAITING_TERMS') {
    if (cleanPayload === 'TERMS_AGREE' || lower.includes('agree') || lower.includes('continue')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_NAME_EMAIL' WHERE psid = ?", [psid]);
      await sendTextWithQuickReplies(
        psid,
        "Great! Please type your Title & Name followed by your official @missionary.org email on the next line.\n\nExample:\nElder Smith\njohn.smith@missionary.org"
      );
      return;
    } else {
      await sendTextWithQuickReplies(psid, "Please tap '✅ Agree & Continue' to proceed with your verification.", [
        { title: "✅ Agree & Continue", payload: "TERMS_AGREE" }
      ]);
      return;
    }
  }

  if (session.state === 'AWAITING_NAME_EMAIL') {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (!emailMatch) {
      await sendTextWithQuickReplies(psid, "⚠️ Invalid Email. You must provide an official @missionary.org email address (e.g. elder.smith@missionary.org).");
      return;
    }

    const emailInput = emailMatch[1].toLowerCase();
    const nameInput = text.replace(emailMatch[0], '').replace(/\n/g, ' ').trim() || "Missionary";
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql("UPDATE sessions SET state = 'AWAITING_OTP', temp_title = ?, temp_email = ?, otp_code = ? WHERE psid = ?", [nameInput, emailInput, otp, psid]);
    await sendOtpEmail(emailInput, otp);

    await sendTextWithQuickReplies(
      psid,
      `We dispatched a 6-digit verification code to:\n${emailInput}\n\nType the 6-digit code below to verify:`,
      [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]
    );
    return;
  }

  if (session.state === 'AWAITING_OTP') {
    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const refCode = generateXNXNXN();
      const cohort = (session.temp_title || '').toLowerCase().includes('sister') ? 'sister' : 'elder';
      
      await runSql(`
        INSERT INTO missionaries (email, name, cohort, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, 1, ?, ?, 'active', 24)
        ON CONFLICT(email) DO UPDATE SET psid = excluded.psid, status = 'active', points = CASE WHEN points = 0 THEN 1 ELSE points END
      `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, refCode, psid]);
      
      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      
      const newlyLinked = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
      await renderDashboardAndCarousel(psid, newlyLinked, `🎉 Congratulations ${session.temp_title}! Your account is verified and active with 1 Welcome Point!`);
      return;
    } else {
      await sendTextWithQuickReplies(psid, "❌ Incorrect 6-digit OTP code. Please enter the correct code below:", [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]);
      return;
    }
  }

  // Final Catch-all Fallback
  await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
  await sendTextWithQuickReplies(
    psid,
    "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or Global Code (TCRP50):",
    [{ title: "✨ Get Started", payload: "GET_STARTED" }]
  );
}
