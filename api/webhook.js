import { handleBotMessage } from '../lib/botHandler.js';

export default async function handler(req, res) {
  // Meta Webhook Verification Handshake
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

  // Incoming Messenger Events
  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          for (const webhookEvent of entry.messaging || entry.standby || []) {
            if (webhookEvent && webhookEvent.sender) {
              const psid = webhookEvent.sender.id;
              const messageText = webhookEvent.message?.text || '';
              const quickReplyPayload = webhookEvent.message?.quick_reply?.payload || webhookEvent.postback?.payload || null;

              // Delegate to the shared robust bot handler
              await handleBotMessage(psid, messageText, quickReplyPayload);
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
