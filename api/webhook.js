import { handleBotMessage } from '../lib/botHandler.js';
import { verifyFbSignature } from '../lib/security.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256');

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
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (process.env.FB_APP_SECRET && !verifyFbSignature(req, rawBody)) {
      console.warn("⚠️ Unauthorized webhook signature rejected.");
      return res.status(401).send('Invalid signature');
    }

    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (_) {
      body = {};
    }

    if (body?.object === 'page') {
      const dispatchPromises = [];

      for (const entry of body.entry || []) {
        for (const event of entry.messaging || entry.standby || []) {
          // Drop echoes, deliveries, and read notifications immediately
          if (event?.message?.is_echo || event?.delivery || event?.read) {
            continue;
          }

          if (event?.sender?.id) {
            const psid = String(event.sender.id);
            const text = event.message?.text || '';
            const payload = event.message?.quick_reply?.payload || event.postback?.payload || null;
            const ref = event.referral?.ref || event.postback?.referral?.ref || '';

            // Queue processing guarantee
            dispatchPromises.push(
              handleBotMessage(psid, text, payload, ref).catch(err => {
                console.error(`[CRITICAL] Bot handling error for PSID ${psid}:`, err);
              })
            );
          }
        }
      }

      await Promise.all(dispatchPromises);
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}
