import { runSql } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();

async function sendMessengerReply(psid, text) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("PAGE_ACCESS_TOKEN is missing. Cannot send Facebook reply.");
    return;
  }
  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text: text }
      })
    });
  } catch (err) {
    console.error("Failed to send Messenger reply:", err.message);
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

            // Automated Bot Flow Router
            if (lowerText.includes('get started') || lowerText === 'start') {
              await sendMessengerReply(psid, "✨ Welcome to Timeless Creations Rewards Program (TCRP)! We are honored to support missionaries across the Philippines. Type 'Dashboard' to check points or 'FAQs' for assistance.");
            } else if (lowerText.includes('faq') || lowerText.includes('help')) {
              await sendMessengerReply(psid, "📖 FAQs: We offer 'Gawa muna bago bayad' (Work, Confirm, Pay) for first-time customers. For order status or custom nametags, message our support team anytime!");
            } else if (lowerText.includes('dashboard') || lowerText.includes('points')) {
              await sendMessengerReply(psid, "🎁 To check your rewards balance and monthly drip progress, please log in with your missionary email on our secure platform link.");
            } else if (messageText) {
              await sendMessengerReply(psid, `👋 Thanks for reaching out to Timeless Creations! We received your message: "${messageText}". An admin will review your request shortly.`);
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
