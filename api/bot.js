import { handleBotMessage } from '../lib/botHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || 'tcrp_token';

  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (body?.object === 'page') {
      try {
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || entry.standby || []) {
            if (event?.sender?.id) {
              const psid = event.sender.id;
              const text = event.message?.text || '';
              const payload = event.postback?.payload || event.message?.quick_reply?.payload || null;
              const ref = event.referral?.ref || event.postback?.referral?.ref || '';
              await handleBotMessage(psid, text, payload, ref);
            }
          }
        }
      } catch (err) {
        console.error('Bot webhook error:', err.message);
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}
