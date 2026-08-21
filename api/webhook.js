import { runSql } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();

async function sendMessengerQuickReplies(psid, text) {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: {
          text: text,
          quick_replies: [
            { content_type: "text", title: "🎁 Dashboard", payload: "DASHBOARD_PAYLOAD" },
            { content_type: "text", title: "📖 FAQs", payload: "FAQS_PAYLOAD" },
            { content_type: "text", title: "✨ Get Started", payload: "START_PAYLOAD" }
          ]
        }
      })
    });
  } catch (err) {
    console.error("Failed to send Messenger quick replies:", err.message);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'tcrp_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed: Token mismatch');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          const webhookEvent = entry.messaging?.[0] || entry.standby?.[0];
          if (webhookEvent && webhookEvent.sender) {
            const psid = webhookEvent.sender.id;
            const messageText = (webhookEvent.message?.text || '').trim();
            const lowerText = messageText.toLowerCase();

            await logSystemEvent('INFO', `Messenger Event from PSID ${psid}: ${messageText || '[Attachment/Action]'}`);

            if (lowerText.includes('get started') || lowerText === 'start') {
              await sendMessengerQuickReplies(psid, "✨ Welcome to Timeless Creations Rewards Program (TCRP)! We support missionaries across the Philippines.");
            } else if (lowerText.includes('faq') || lowerText.includes('help')) {
              await sendMessengerQuickReplies(psid, "📖 FAQs: We offer 'Gawa muna bago bayad' (Work, Confirm, Pay) for first-time customers.");
            } else if (lowerText.includes('dashboard') || lowerText.includes('points')) {
              await sendMessengerQuickReplies(psid, "🎁 Please log in with your missionary email on our secure platform link to check your rewards balance.");
            } else {
              await sendMessengerQuickReplies(psid, `👋 Thanks for messaging Timeless Creations! How can we assist you today?`);
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error("Webhook processing error:", err.message);
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  return res.status(405).send('Method not allowed');
}
