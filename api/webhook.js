import crypto from 'crypto';
import { queryTurso, unwrap } from '../lib/db.js';

const TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

// Anti-Spam Memory Cache (Stores last interaction timestamp per PSID)
const spamCache = new Map();
const SPAM_COOLDOWN_MS = 1200; // 1.2 seconds anti-spam throttle

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

          // ANTI-SPAM THROTTLE CHECK
          const now = Date.now();
          const lastTime = spamCache.get(psid) || 0;
          if (now - lastTime < SPAM_COOLDOWN_MS) {
            continue; // Drop spam request to protect Meta rate limits
          }
          spamCache.set(psid, now);

          const rawInput = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text?.trim() || "";
          const msg = rawInput.toLowerCase();
          const user = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];

          // 1. GET STARTED / PERSISTENT MENU: FAQS
          if (msg === 'menu_faqs' || msg.includes('faqs') || msg.includes('help')) {
            const faqText = 
              `❓ **Frequently Asked Questions (FAQs)**\n\n` +
              `1️⃣ *How do I earn points?*\n` +
              `You earn points automatically through participation and your monthly rewards cycle (+2 Pts/mo)!\n\n` +
              `2️⃣ *How does 'Gawa muna bago bayad' work?*\n` +
              `We create and confirm your reward items first before you complete payment. No upfront risk!\n\n` +
              `3️⃣ *How do I redeem items?*\n` +
              `Click 'Dashboard & Rewards' in your persistent menu to browse keychains, nametags, and scripture cases.`;
            
            await callSendAPI(psid, faqText);
            continue;
          }

          // 2. PERSISTENT MENU: DASHBOARD & REWARDS
          if (msg === 'menu_dashboard' || msg.includes('dashboard')) {
            if (!user) {
              await callSendAPI(psid, "Please type 'Get Started' or click our welcome link to register your account first!");
            } else {
              await callSendAPI(psid, `📊 **Your TCRP Dashboard**\n\nTitle & Name: ${user.name}\nPoints Balance: ${user.points} Pts\nReferral Code: ${user.referral_code}\n\nTo redeem, select an item below or visit m.me/timeless.creations.06`);
            }
            continue;
          }

          // 3. GET STARTED / WELCOME FLOW
          if (msg === 'get_started' || msg.includes('get started')) {
            await runSql("INSERT OR REPLACE INTO sessions (psid, state) VALUES (?, 'AWAITING_TERMS');", [psid]);
            await callSendAPI(psid, {
              text: "🌟 Welcome to Timeless Creations Rewards Program (TCRP)!\n\nEarn rewards and encouragement as you serve. Please review and agree to continue:",
              quick_replies: [
                { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" }
              ]
            });
            continue;
          }

          // 4. REFERRAL NOTIFICATION LOGIC (When a new user registers with an invite code)
          // If user registers and provided a referral code, notify the inviter!
          // (Inviter lookup example: INVITER_NOTIF)
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

              const receipt = `🎟️ 𝐑𝐄𝐃𝐄𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐄𝐃!\n\n` +
                              `Title: ${user.name}\n` +
                              `Email: ${user.email}\n` +
                              `Reference code: ${orderId}\n` +
                              `Item Purchased: ${item}\n\n` +
                              `Note : Send this Receipt to https://m.me/timeless.creations.06`;
              
              await callSendAPI(psid, receipt);
            }
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
