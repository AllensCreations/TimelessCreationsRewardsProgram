import { handleBotMessage } from '../lib/botHandler.js';
import { verifyFbSignature } from '../lib/security.js';
import { logSystemEvent } from '../lib/logger.js';

// Disable default body parser on Vercel to preserve exact raw body bytes for HMAC-SHA256 signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function resolveRequestBody(req) {
  if (req.rawBody) {
    const raw = typeof req.rawBody === 'string' ? req.rawBody : req.rawBody.toString('utf8');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = req.body || {}; }
    return { rawBody: raw, body: parsed };
  }

  // If req is an unconsumed stream (e.g. bodyParser disabled on Vercel)
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (_) { parsed = {}; }
      return { rawBody: raw, body: parsed };
    }
  } catch (_) {}

  if (typeof req.body === 'string') {
    let parsed = null;
    try { parsed = JSON.parse(req.body); } catch (_) { parsed = {}; }
    return { rawBody: req.body, body: parsed };
  }

  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf8');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = {}; }
    return { rawBody: raw, body: parsed };
  }

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return { rawBody: JSON.stringify(req.body), body: req.body };
  }

  return { rawBody: JSON.stringify(req.body || {}), body: req.body || {} };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const VERIFY_TOKEN = (process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || 'tcrp_token').trim();

  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      await logSystemEvent('INFO', `[WEBHOOK_VERIFY] Meta webhook subscription verified successfully.`);
      return res.status(200).send(challenge);
    }
    await logSystemEvent('WARN', `[WEBHOOK_VERIFY_FAIL] Verification token mismatch. Received token: "${token}".`);
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    const { rawBody, body } = await resolveRequestBody(req);

    const rawSecret = (process.env.FB_APP_SECRET || '').trim().replace(/^["']|["']$/g, '');
    const hasAppSecret = Boolean(rawSecret);
    const ignoreSig = (process.env.FB_IGNORE_SIGNATURE || '').trim().toLowerCase() === 'true';

    if (hasAppSecret && !ignoreSig && !verifyFbSignature(req, rawBody)) {
      const sigHeader = req.headers?.['x-hub-signature-256'] || req.headers?.['X-Hub-Signature-256'] || 'none';
      const secretHint = rawSecret.startsWith('EAA')
        ? ' Note: FB_APP_SECRET appears to be a Page Access Token instead of an App Secret.'
        : '';
      await logSystemEvent('ERROR', `[WEBHOOK_AUTH_FAIL] Unauthorized signature rejected. Header: ${sigHeader.slice(0, 16)}... Set FB_IGNORE_SIGNATURE=true in Vercel to bypass, or check FB_APP_SECRET in Meta Developer settings.${secretHint}`);
      return res.status(401).send('Invalid signature');
    }

    if (body?.object === 'page') {
      const dispatchPromises = [];

      for (const entry of body.entry || []) {
        for (const event of entry.messaging || entry.standby || []) {
          if (event?.message?.is_echo || event?.delivery || event?.read) {
            continue;
          }

          if (event?.sender?.id) {
            const psid = String(event.sender.id);
            const text = event.message?.text || '';
            const payload = event.message?.quick_reply?.payload || event.postback?.payload || null;
            const ref = event.referral?.ref || event.postback?.referral?.ref || '';
            const preview = (text || payload || ref || '[Action]').slice(0, 60);

            await logSystemEvent('INFO', `[WEBHOOK_INBOUND] [PSID:${psid}] Inbound message: "${preview}"`, psid);

            dispatchPromises.push(
              handleBotMessage(psid, text, payload, ref).catch(async err => {
                await logSystemEvent('ERROR', `[WEBHOOK_CRITICAL] Bot error for PSID ${psid}: ${err.message}`, psid);
              })
            );
          }
        }
      }

      await Promise.all(dispatchPromises);
      return res.status(200).send('EVENT_RECEIVED');
    }

    await logSystemEvent('WARN', `[WEBHOOK_DROP] Webhook received non-page object: ${body?.object || 'unknown'}`);
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}
