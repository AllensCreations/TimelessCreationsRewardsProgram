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

          if (msg === 'get_started' || msg.includes('get started')) {
            await runSql("INSERT OR REPLACE INTO sessions (psid, state) VALUES (?, 'AWAITING_TERMS');", [psid]);
            await callSendAPI(psid, {
              text: "🌟 Welcome to Timeless Creations Rewards Program!\nPlease review and agree to continue:",
              quick_replies: [{ content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" }]
            });
            continue;
          }

          if (msg === 'agree_terms' || msg.includes('agree')) {
            await runSql("UPDATE sessions SET state = 'AWAITING_NAME' WHERE psid = ?", [psid]);
            await callSendAPI(psid, "Thank you for agreeing! Please reply with your full **Full Name** to register:");
            continue;
          }

          const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];
          if (session?.state === 'AWAITING_NAME') {
            const fullName = event.message?.text?.trim();
            if (fullName) {
              await runSql("UPDATE sessions SET state = 'AWAITING_EMAIL', temp_data = ? WHERE psid = ?", [fullName, psid]);
              await callSendAPI(psid, `Great, ${fullName}! Now please reply with your **Email Address** so we can link your rewards account:`);
            }
            continue;
          }

          if (session?.state === 'AWAITING_EMAIL') {
            const email = event.message?.text?.trim();
            const fullName = session.temp_data || "Missionary";
            if (email && email.includes('@')) {
              const referralCode = 'TC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
              await runSql("INSERT OR REPLACE INTO missionaries (psid, name, email, referral_code, points) VALUES (?, ?, ?, ?, 10)", [psid, fullName, email, referralCode]);
              await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
              await callSendAPI(psid, `🎉 Registration Complete!\n\nName: ${fullName}\nEmail: ${email}\nReferral Code: ${referralCode}\n\nYou've received 10 Free Points to start! Type 'Dashboard' anytime to check your rewards.`);
            } else {
              await callSendAPI(psid, "That doesn't look like a valid email. Please try entering your email address again:");
            }
            continue;
          }

          if (msg === 'menu_faqs' || msg.includes('faqs') || msg.includes('help')) {
            await callSendAPI(psid, "❓ FAQs: You earn monthly points automatically. Redeem rewards risk-free with 'Gawa muna bago bayad'.");
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
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
