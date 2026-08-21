import { runSql } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

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
            const messageText = webhookEvent.message?.text || '';
            await logSystemEvent('INFO', `Messenger Event from PSID ${psid}: ${messageText || '[Attachment/Action]'}`);
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error("Webhook processing error:", err.message);
      return.status(200).send('EVENT_RECEIVED');
    }
  }

  return res.status(405).send('Method not allowed');
}
