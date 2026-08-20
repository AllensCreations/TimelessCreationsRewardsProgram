import { queryTurso, unwrap } from '../lib/db.js';

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

    if (body.object === 'page') {
      const maintRec = (await runSql("SELECT value FROM system_config WHERE key = 'maintenance_mode'"))[0];
      const isMaintenance = maintRec?.value === '1';

      for (const entry of body.entry || []) {
        const webhookEvent = entry.messaging?.[0];
        if (!webhookEvent) continue;

        const senderPsid = webhookEvent.sender?.id;
        if (!senderPsid) continue;

        if (isMaintenance) {
          // Send maintenance text notice
          await sendMessengerMessage(senderPsid, {
            text: "🛠️ Timeless Creations System Maintenance\n\nOur Rewards & Invoicing bot is currently undergoing scheduled system updates and improvements.\n\nPlease check back in a short while! For urgent concerns, feel free to leave a direct message here."
          });

          // Send Dashboard button
          await sendMessengerMessage(senderPsid, {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text: "You can still access your Rewards Dashboard below:",
                buttons: [
                  {
                    type: "web_url",
                    url: "https://timelesscreationsrewardsprogram.vercel.app/",
                    title: "Open Dashboard"
                  }
                ]
              }
            }
          });
          continue;
        }

        // Normal Bot Mode
        if (webhookEvent.message) {
          const text = webhookEvent.message.text?.trim();
          if (text) {
            await sendMessengerMessage(senderPsid, {
              attachment: {
                type: "template",
                payload: {
                  template_type: "button",
                  text: `✨ Welcome to Timeless Creations Rewards Program!\n\nYou can access your account, check points, and view rewards anytime:`,
                  buttons: [
                    {
                      type: "web_url",
                      url: "https://timelesscreationsrewardsprogram.vercel.app/",
                      title: "Open Dashboard"
                    }
                  ]
                }
              }
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
