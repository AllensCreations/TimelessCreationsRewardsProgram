import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').trim();
const VERIFY_TOKEN = (process.env.VERIFY_TOKEN || 'TCRP_VERIFY_TOKEN').trim();

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

async function sendMessengerMessage(recipientId, messagePayload) {
  if (!PAGE_ACCESS_TOKEN) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: messagePayload
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Messenger send error:", err.message);
    return false;
  }
}

export default async function handler(req, res) {
  // Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Incoming Messages (POST)
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object === 'page') {
      // Check Maintenance Mode in Turso
      const maintRec = (await runSql("SELECT value FROM system_config WHERE key = 'maintenance_mode'"))[0];
      const isMaintenance = maintRec?.value === '1';

      for (const entry of body.entry || []) {
        const webhookEvent = entry.messaging?.[0];
        if (!webhookEvent) continue;

        const senderPsid = webhookEvent.sender?.id;
        if (!senderPsid) continue;

        // If Maintenance Mode is active, send maintenance notice and skip normal bot pipeline
        if (isMaintenance) {
          await sendMessengerMessage(senderPsid, {
            text: "🛠️ Timeless Creations System Maintenance\n\nOur Rewards & Invoicing bot is currently undergoing scheduled system updates and improvements.\n\nPlease check back in a short while! For urgent concerns, feel free to leave a direct message here."
          });
          continue;
        }

        // Standard Bot Logic
        if (webhookEvent.message) {
          const text = webhookEvent.message.text?.trim();
          if (text) {
            await sendMessengerMessage(senderPsid, {
              text: `✨ Welcome to Timeless Creations Rewards Program!\n\nTo check your rewards status, please type your registered @missionary.org email or your 6-digit verification code.`
            });
          }
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}
