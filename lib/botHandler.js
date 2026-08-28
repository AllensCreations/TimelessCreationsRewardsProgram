import { isRateLimited } from "./security.js";
import { runSql } from './db.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();

export async function logEvent(level, message, psid = 'SYSTEM') {
  console.log(`[${level.toUpperCase()}] [PSID:${psid}] ${message}`);
  try {
    await runSql("INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'));", [level.toUpperCase(), message]);
  } catch (_) {}
}

async function sendFbGraphMessage(psid, messagePayload) {
  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [psid, messagePayload.text || '[Template]']);
  } catch (_) {}

  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.startsWith('EAA_MOCK') || String(psid).startsWith('TEST_')) {
    return;
  }

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_type: "RESPONSE", recipient: { id: psid }, message: messagePayload })
  }).catch(err => logEvent('ERROR', `Graph API dispatch failed: ${err.message}`, psid));
}

export async function sendTextMessage(psid, text, quickReplies = []) {
  const payload = { text };
  if (quickReplies.length > 0) {
    payload.quick_replies = quickReplies.map(qr => ({ content_type: "text", title: qr.title, payload: qr.payload || qr.title }));
  }
  await sendFbGraphMessage(psid, payload);
}

export async function handleBotMessage(psid, rawMessage = '', payload = '', referralParam = '') {
  if (await isRateLimited(psid)) return;
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();
  const cleanPayload = (payload || '').trim();

  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || cleanPayload || '[Action]']);
  } catch (_) {}

  if (lower === 'reset') {
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("UPDATE missionaries SET psid = NULL WHERE psid = ?", [psid]);
    await sendTextMessage(psid, "🔄 Session reset! Tap 'Get Started' to begin:", [{ title: "✨ Get Started", payload: "GET_STARTED" }]);
    return;
  }

  let session = (await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [psid]))?.[0] || null;
  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'START', 0)", [psid]);
    session = { psid, state: 'START' };
  }

  if (session.state === 'START' || lower === 'get started' || cleanPayload === 'GET_STARTED') {
    await runSql("UPDATE sessions SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
    await sendTextMessage(psid, "✨ Welcome to Timeless Creations Rewards Program!\n\nDo you agree to our Terms & Privacy Notice?", [
      { title: "✅ Agree", payload: "TERMS_AGREE" },
      { title: "❌ Disagree", payload: "TERMS_DISAGREE" }
    ]);
    return;
  }

  if (session.state === 'AWAITING_TERMS') {
    if (cleanPayload === 'TERMS_AGREE' || lower.includes('agree')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_DETAILS' WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "✅ Thank you! Please send your details:\n\n1. Name (e.g. Elder Smith)\n2. Email (@missionary.org)\n3. Referral Code (if any)");
      return;
    } else {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "⚠️ Terms declined. Type 'Get Started' anytime.", [{ title: "✨ Get Started", payload: "GET_STARTED" }]);
      return;
    }
  }

  if (session.state === 'AWAITING_DETAILS') {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (!emailMatch) {
      await sendTextMessage(psid, "⚠️ Please include a valid @missionary.org email address.");
      return;
    }
    const emailInput = emailMatch[1].toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql("UPDATE sessions SET state = 'AWAITING_OTP', temp_email = ?, otp_code = ? WHERE psid = ?", [emailInput, otp, psid]);
    await sendTextMessage(psid, `📩 Verification code generated for *${emailInput}*:\nCode: ${otp}\n\nPlease type your 6-digit code below:`);
    return;
  }

  if (session.state === 'AWAITING_OTP') {
    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      await runSql(`
        INSERT INTO missionaries (email, name, cohort, points, referral_code, psid, status)
        VALUES (?, 'Missionary', 'elder', 1, 'TCRP50', ?, 'active')
        ON CONFLICT(email) DO UPDATE SET psid = excluded.psid, status = 'active'
      `, [session.temp_email, psid]);

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "🎉 Verified successfully! Your account is now active with +1 Welcome Point. Type 'Dashboard' to view your stats.");
      return;
    } else {
      await sendTextMessage(psid, "❌ Incorrect code. Please try again.");
      return;
    }
  }

  await sendTextMessage(psid, "✨ Welcome to TCRP!", [{ title: "✨ Get Started", payload: "GET_STARTED" }]);
}
