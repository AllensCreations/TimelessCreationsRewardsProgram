import crypto from 'crypto';
import { generateOtpHtml } from '../lib/otp-template.js';
import { queryTurso, unwrap } from '../lib/db.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
const SENDER_EMAIL = "noreply.timelesscreations.ph@gmail.com";

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

async function callSendAPI(psid, messagePayload) {
  const token = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
  if (!token) return;
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: psid },
    message: typeof messagePayload === 'string' ? { text: messagePayload } : messagePayload
  };
  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {}
}

export default async function handler(req, res) {
  const host = req.headers?.host || "localhost";
  const urlObj = new URL(req.url || "/", `https://${host}`);
  
  if (req.method === 'GET') {
    const verifyToken = (process.env.VERIFY_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
    if (req.query?.['hub.mode'] === 'subscribe' && req.query?.['hub.verify_token'] === verifyToken) return res.status(200).send(req.query?.['hub.challenge']);
    return res.status(403).send('Verification failed');
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.object === 'page' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const event of entry.messaging || []) {
          const psid = event.sender?.id;
          if (!psid) continue;

          const msg = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text?.trim() || "";
          const user = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];

          if (msg.startsWith("REDEEM_")) {
            let cost = 0; let item = "";
            if (msg.includes("KEYCHAIN")) { cost = 6; item = "Temple Keychain"; }
            else if (msg.includes("NAMETAG")) { cost = 24; item = "Nametag Keychain"; }
            else if (msg.includes("SALVATION")) { cost = 42; item = "Salvation Kit (POS)"; }
            else if (msg.includes("SCRIPTURE")) { cost = 60; item = "Scripture Case"; }

            if ((user?.points || 0) < cost) {
              await callSendAPI(psid, `✕ Insufficient Points! You have ${user.points} pt(s), but ${item} requires ${cost}.`);
            } else {
              const orderId = `TX-` + crypto.randomBytes(4).toString('hex').toUpperCase();
              await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ?", [cost, psid]);
              await runSql("INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')", 
                           [orderId, psid, user.email, user.name, item, cost]);

              const receipt = `🎟️ 𝐑𝐄𝐃𝐄𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐄𝐃!\n\n` +
                              `Title: ${user.name}\n` +
                              `Email: ${user.email}\n` +
                              `Reference code: ${orderId}\n` +
                              `Item Purchased: ${item}\n\n` +
                              `📝 𝐍𝐨𝐭𝐞: Send this Receipt to https://m.me/Timelesscreation.06`;
              
              await callSendAPI(psid, receipt);
            }
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
