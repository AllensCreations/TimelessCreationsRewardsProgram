import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();

// Generic helper to send text + quick replies to Facebook Messenger
export async function sendQuickReplyMessage(psid, text, quickReplies = []) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("PAGE_ACCESS_TOKEN is missing in environment variables.");
    return;
  }

  const payload = {
    recipient: { id: psid },
    message: { text }
  };

  if (quickReplies && quickReplies.length > 0) {
    payload.message.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload || qr.title
    }));
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error("Failed to send Messenger message:", err.message);
  }
}

// Main customizable bot router — EDIT YOUR REPLIES HERE
export async function handleBotMessage(psid, rawMessage, payload = null) {
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();

  // Log incoming interaction to Turso system_logs
  await logSystemEvent('INFO', `Messenger Event from PSID ${psid}: ${text || payload || '[Action]'}`);

  // Default Quick Reply Pills
  const defaultPills = [
    { title: "🎁 Dashboard", payload: "DASHBOARD_PAYLOAD" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" },
    { title: "✨ Get Started", payload: "START_PAYLOAD" }
  ];

  // 1. Welcome / Start Flow
  if (lower.includes('get started') || lower === 'start' || payload === 'START_PAYLOAD') {
    return await sendQuickReplyMessage(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)! We are honored to support missionaries across the Philippines.\n\nTap an option below to get started:",
      defaultPills
    );
  }

  // 2. FAQs & Assistance Flow
  if (lower.includes('faq') || lower.includes('help') || payload === 'FAQS_PAYLOAD') {
    return await sendQuickReplyMessage(
      psid,
      "📖 FAQs:\n• We offer 'Gawa muna bago bayad' (Work, Confirm, Pay) for first-time customers.\n• For personalized nametags or POS kits, feel free to ask us here anytime!",
      defaultPills
    );
  }

  // 3. Rewards / Points Balance Flow
  if (lower.includes('dashboard') || lower.includes('points') || payload === 'DASHBOARD_PAYLOAD') {
    return await sendQuickReplyMessage(
      psid,
      "🎁 Rewards Balance:\nPlease visit your missionary portal link to check your current points balance, claim rewards, or view monthly letters.",
      defaultPills
    );
  }

  // 4. Default Fallback Reply
  return await sendQuickReplyMessage(
    psid,
    `👋 Hello! Thanks for messaging Timeless Creations. We received: "${text}". How can we assist your missionary journey today?`,
    defaultPills
  );
}
