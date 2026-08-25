import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();
const ADMIN_PSID = (process.env.ADMIN_PSID || '').trim();

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
      await runSql("UPDATE bot_rate_limits SET msg_count = 1, window_start = ?, warned_at = 0 WHERE psid = ?", [now, psid]);
      return { allowed: true };
    }
    if (record.msg_count >= 10) return { allowed: false };
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

async function callSendAPI(payload) {
  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [
      payload.recipient?.id,
      payload.message?.text || "[Template/Carousel]"
    ]);
  } catch(e){}
}

export async function sendTextWithQuickReplies(psid, text, quickReplies = []) {
  const payload = { recipient: { id: psid }, message: { text } };
  if (quickReplies.length > 0) {
    payload.message.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload || qr.title
    }));
  }
  await callSendAPI(payload);
}

export async function sendProductCarousel(psid, products = [], userPoints = 0) {
  await callSendAPI({ recipient: { id: psid }, message: { text: "[Carousel Catalog]" } });
}

async function sendOtpEmail(email, otp) {
  // Log OTP explicitly into system_logs so it appears directly in the dev log panel for testing
  await logSystemEvent('OTP_DEBUG', `🔐 [TEST OTP GENERATED] Email: ${email} | Passcode: ${otp}`);

  if (!BREVO_API_KEY) return false;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        sender: { name: "Timeless Creations RP", email: "noreply.timelesscreations.ph@gmail.com" },
        to: [{ email }],
        subject: `🔐 Your TCRP Verification Code: ${otp}`,
        htmlContent: `<div style="padding:20px;">Verification Code: <b>${otp}</b></div>`
      })
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function renderDashboardAndCarousel(psid, prefixMessage = "") {
  const missionaryRows = await runSql("SELECT name, email, points, referral_code FROM missionaries WHERE psid = ?", [psid]);
  const missionary = missionaryRows[0];

  if (!missionary) {
    return false; // Not verified
  }

  const refCode = missionary.referral_code || "N/A";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const greeting = prefixMessage ? `${prefixMessage}\n\n` : "";
  const dashboardMsg = `${greeting}📊 MISSIONARY DASHBOARD\n\n👤 Information:\n• ${missionary.name}\n• ${missionary.email}\n\n⭐ Points Balance:\n• ${missionary.points || 0} Points\n\n💌 Referral Code: ${refCode}\nLink: ${inviteLink}`;

  await sendTextWithQuickReplies(psid, dashboardMsg, [
    { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
  ]);
  return true;
}

export async function handleBotMessage(psid, rawMessage, payload = null) {
  const spamCheck = await checkAntiSpam(psid);
  if (!spamCheck.allowed) return;

  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();

  await logSystemEvent('TURSO', `SQL: INSERT INTO chat_messages (psid, sender, message) VALUES ('${psid}', 'user', '${text || payload}')`);
  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || payload || "[Action]"]);
  } catch(e){}

  const sessionRows = await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]);
  let session = sessionRows[0] || null;

  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'START', 0)", [psid]);
    session = { psid, state: 'START', invite_code: null, temp_title: null, temp_email: null, otp_code: null, last_otp_at: 0 };
  }

  // Check if user is fully verified
  const missionaryRows = await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]);
  const isVerified = missionaryRows && missionaryRows.length > 0;

  // If verified, handle dashboard/discover/faqs normally
  if (isVerified) {
    if (lower === 'faqs' || payload === 'FAQS_PAYLOAD') {
      await sendTextWithQuickReplies(psid, "📖 FREQUENTLY ASKED QUESTIONS:\n1. What is TCRP? Missionary rewards.\n2. How do referrals work? 1:1 Rule (+1 PT).", [
        { title: "📊 Dashboard", payload: "ACTION_DASHBOARD" }
      ]);
      return;
    }
    if (lower === 'discover' || lower === 'dashboard' || payload === 'DISCOVER_PAYLOAD' || payload === 'ACTION_DASHBOARD' || lower === 'get started') {
      await renderDashboardAndCarousel(psid);
      return;
    }
  }

  // If NOT verified, enforce conversation continuity based on active session state
  if (!isVerified) {
    // If they ask for FAQs or About while unverified, answer it without breaking flow
    if (lower === 'faqs' || payload === 'FAQS_PAYLOAD') {
      await sendTextWithQuickReplies(psid, "📖 FREQUENTLY ASKED QUESTIONS:\nPlease complete verification to access your dashboard.", []);
      return;
    }

    if (lower === 'about' || payload === 'MENU_ABOUT_PAYLOAD') {
      await sendTextWithQuickReplies(psid, "✨ Timeless Creations Rewards Program (TCRP) supports missionaries across the Philippines.", []);
      return;
    }

    // State Machine Continuity
    if (session.state === 'START' || lower === 'get started' || payload === 'GET_STARTED') {
      await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
      await logSystemEvent('TURSO', `SQL: UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = '${psid}'`);
      await sendTextWithQuickReplies(
        psid,
        "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or Global Code (TCRP50):"
      );
      return;
    }

    if (session.state === 'AWAITING_REFERRAL') {
      const inputCode = text.trim().toUpperCase();
      const referrerRow = await runSql("SELECT psid, email FROM missionaries WHERE UPPER(referral_code) = ?", [inputCode]);
      const globalRow = await runSql("SELECT code, uses_count, max_limit FROM global_referral_pool WHERE UPPER(code) = ?", [inputCode]);

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
      await logSystemEvent('TURSO', `SQL: UPDATE sessions SET state = 'AWAITING_TERMS', invite_code = '${validCode}' WHERE psid = '${psid}'`);
      
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
      if (payload === 'TERMS_AGREE' || lower.includes('agree')) {
        await runSql("UPDATE sessions SET state = 'AWAITING_NAME_EMAIL' WHERE psid = ?", [psid]);
        await logSystemEvent('TURSO', `SQL: UPDATE sessions SET state = 'AWAITING_NAME_EMAIL' WHERE psid = '${psid}'`);
        await sendTextWithQuickReplies(
          psid,
          "Great! Please type your Title & Name followed by your official @missionary.org email on the next line.\n\nExample:\nElder Smith\njohn.smith@missionary.org"
        );
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
      await logSystemEvent('TURSO', `SQL: UPDATE sessions SET state = 'AWAITING_OTP', temp_email = '${emailInput}' WHERE psid = '${psid}'`);
      await sendOtpEmail(emailInput, otp);

      await sendTextWithQuickReplies(
        psid,
        `📧 We dispatched a 6-digit verification code to:\n${emailInput}\n\n(Check your dev log panel for the simulated OTP code!)\n\nType the 6-digit code below to verify:`,
        [
          { title: "🔄 Resend Code", payload: "RESEND_OTP" },
          { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
        ]
      );
      return;
    }

    if (session.state === 'AWAITING_OTP') {
      if (payload === 'RESEND_OTP' || lower.includes('resend')) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await runSql("UPDATE sessions SET otp_code = ? WHERE psid = ?", [otp, psid]);
        await sendOtpEmail(session.temp_email, otp);
        await sendTextWithQuickReplies(psid, `🔄 A new OTP has been dispatched. (Check dev log for code).`);
        return;
      }

      const cleanedCode = text.replace(/\D/g, '');
      if (cleanedCode === session.otp_code) {
        const refCode = generateXNXNXN();
        const cohort = (session.temp_title || '').toLowerCase().includes('sister') ? 'sister' : 'elder';
        
        await runSql(`
          INSERT INTO missionaries (email, name, cohort, points, referral_code, psid, status, max_months)
          VALUES (?, ?, ?, 1, ?, ?, 'active', 24)
          ON CONFLICT(email) DO UPDATE SET psid = excluded.psid, status = 'active'
        `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, refCode, psid]);
        
        await logSystemEvent('TURSO', `SQL: INSERT INTO missionaries (email, name, points, psid) VALUES ('${session.temp_email}', '${session.temp_title}', 1, '${psid}')`);
        await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

        await renderDashboardAndCarousel(psid, `🎉 Congratulations ${session.temp_title}! Your account is verified and active with 1 Welcome Point!`);
        return;
      } else {
        await sendTextWithQuickReplies(psid, "❌ Incorrect 6-digit OTP code. Please recheck your email or check the dev log for the code.");
        return;
      }
    }
  }

  // Fallback default state
  await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
  await sendTextWithQuickReplies(
    psid,
    "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or Global Code (TCRP50):",
    [{ title: "✨ Get Started", payload: "GET_STARTED" }]
  );
}
