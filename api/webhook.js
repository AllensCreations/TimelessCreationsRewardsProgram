import crypto from 'crypto';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
const spamCache = new Map();
const SPAM_COOLDOWN_MS = 1200;

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
  if (!TOKEN) return;
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: psid },
    message: typeof messagePayload === 'string' ? { text: messagePayload } : messagePayload
  };
  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${TOKEN}`, {
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

          const now = Date.now();
          const lastTime = spamCache.get(psid) || 0;
          if (now - lastTime < SPAM_COOLDOWN_MS) continue;
          spamCache.set(psid, now);

          const rawInput = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text?.trim() || "";
          const msg = rawInput.toLowerCase();
          const user = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];

          if (msg === 'menu_faqs' || msg.includes('faqs') || msg.includes('help')) {
            await callSendAPI(psid, "❓ FAQs: You earn monthly points automatically. Redeem rewards risk-free with 'Gawa muna bago bayad'. Access your dashboard anytime below.");
            await logSystemEvent('INFO', `Sent FAQs to PSID ${psid}`);
            continue;
          }

          if (msg === 'menu_dashboard' || msg.includes('dashboard')) {
            if (!user) {
              await callSendAPI(psid, "Please type 'Get Started' to register your account first!");
            } else {
              await callSendAPI(psid, `📊 Dashboard\n\nName: ${user.name}\nPoints: ${user.points} Pts\nReferral: ${user.referral_code}`);
            }
            continue;
          }

          if (msg === 'get_started' || msg.includes('get started')) {
            await runSql("INSERT OR REPLACE INTO sessions (psid, state) VALUES (?, 'AWAITING_TERMS');", [psid]);
            await callSendAPI(psid, {
              text: "🌟 Welcome to Timeless Creations Rewards Program!\nPlease review and agree to continue:",
              quick_replies: [{ content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" }]
            });
            await logSystemEvent('INFO', `New onboarding started for PSID ${psid}`);
            continue;
          }

          if (msg.startsWith("redeem_")) {
            let cost = 0; let item = "";
            if (msg.includes("keychain")) { cost = 6; item = "Temple Keychain"; }
            else if (msg.includes("nametag")) { cost = 24; item = "Nametag Keychain"; }
            else if (msg.includes("salvation")) { cost = 42; item = "Salvation Kit (POS)"; }
            else if (msg.includes("scripture")) { cost = 60; item = "Scripture Case"; }

            if ((user?.points || 0) < cost) {
              await callSendAPI(psid, `✕ Insufficient Points! You have ${user.points} pt(s), but ${item} requires ${cost}.`);
            } else {
              const orderId = `TX-` + crypto.randomBytes(4).toString('hex').toUpperCase();
              await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ?", [cost, psid]);
              await runSql("INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')", 
                           [orderId, psid, user.email, user.name, item, cost]);

              await callSendAPI(psid, `🎟️ 𝐑𝐄𝐃𝐄𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐄𝐃!\n\nTitle: ${user.name}\nRef: ${orderId}\nItem: ${item}\n\nSend Receipt to m.me/timeless.creations.06`);
              await logSystemEvent('SUCCESS', `Redemption order ${orderId} created for ${user.email}`);
            }
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
