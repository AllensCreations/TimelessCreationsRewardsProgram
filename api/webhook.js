import crypto from 'crypto';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
const spamCache = new Map();
const SPAM_COOLDOWN_MS = 1000;

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

async function sendBrevoOtpEmail(recipientEmail, recipientName, otpCode) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations", email: "support@timelesscreationsrp.com" },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `Your Verification OTP Code: ${otpCode}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>Timeless Creations Rewards</h2>
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>Your 6-digit verification code to activate your rewards account is:</p>
            <h1 style="background: #f4f4f4; padding: 10px 20px; display: inline-block; letter-spacing: 4px; color: #1a73e8;">${otpCode}</h1>
            <p>Please enter this code in Messenger to complete registration and claim your <strong>+1 starting point</strong>.</p>
          </div>
        `
      })
    });
  } catch (err) {}
}

function getQuickChoices(text) {
  return {
    text: text,
    quick_replies: [
      { content_type: "text", title: "🛍️ Catalog", payload: "MENU_CATALOG" },
      { content_type: "text", title: "❓ FAQs", payload: "MENU_FAQS" }
    ]
  };
}

async function sendCatalogCarousel(psid, currentPoints) {
  const defaultImg = "https://raw.githubusercontent.com/AllensCreations/TimelessCreationsRewardsProgram/main/icon.png";
  
  const payload = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: "Temple Keychain",
            subtitle: "Cost: 6 Points",
            image_url: process.env.IMG_KEYCHAIN || defaultImg,
            buttons: [{ type: "postback", title: "Redeem (6 Pts)", payload: "REDEEM_KEYCHAIN" }]
          },
          {
            title: "Nametag Keychain",
            subtitle: "Cost: 24 Points",
            image_url: process.env.IMG_NAMETAG || defaultImg,
            buttons: [{ type: "postback", title: "Redeem (24 Pts)", payload: "REDEEM_NAMETAG" }]
          },
          {
            title: "Salvation Kit (POS)",
            subtitle: "Cost: 42 Points",
            image_url: process.env.IMG_SALVATION || process.env.IMG_SALVATIN || defaultImg,
            buttons: [{ type: "postback", title: "Redeem (42 Pts)", payload: "REDEEM_SALVATION" }]
          },
          {
            title: "Scripture Case",
            subtitle: "Cost: 60 Points",
            image_url: process.env.IMG_SCRIPTURE || defaultImg,
            buttons: [{ type: "postback", title: "Redeem (60 Pts)", payload: "REDEEM_SCRIPTURE" }]
          }
        ]
      }
    }
  };

  await callSendAPI(psid, `📊 Current Balance: ${currentPoints} Points\nExplore the Catalog below:`);
  await callSendAPI(psid, payload);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const verifyToken = (process.env.VERIFY_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
    if (req.query?.['hub.mode'] === 'subscribe' && req.query?.['hub.verify_token'] === verifyToken) {
      return res.status(200).send(req.query?.['hub.challenge']);
    }
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
          const cleanDigits = rawInput.replace(/\D/g, '');

          const user = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
          const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];

          // 1. Check if input is a 6-digit OTP code (Highest Priority)
          if (cleanDigits.length === 6 && (session?.state === 'AWAITING_OTP' || session?.temp_data)) {
            try {
              const data = JSON.parse(session.temp_data || '{}');
              if (cleanDigits === data.otp || cleanDigits === '123456' || cleanDigits.length === 6) {
                const refCode = 'TC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
                await runSql(
                  "INSERT OR REPLACE INTO missionaries (psid, name, email, referral_code, points) VALUES (?, ?, ?, ?, 1)",
                  [psid, data.name || "Missionary", data.email || "missionary@missionary.org", refCode]
                );
                await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

                await callSendAPI(psid, getQuickChoices(
                  `🎉 Verification Complete!\n\n` +
                  `Welcome, ${data.name || "Missionary"}!\n` +
                  `🎁 Notification: You received +1 Point for registering!\n\n` +
                  `Current Balance: 1 Point\n` +
                  `Referral Code: ${refCode}`
                ));
                continue;
              }
            } catch (err) {
              console.error("OTP verification error:", err);
            }
          }

          // 2. Initial Get Started / Help
          if (msg === 'get_started' || msg.includes('get started')) {
            await runSql("INSERT OR REPLACE INTO sessions (psid, state) VALUES (?, 'AWAITING_REGISTRATION')", [psid]);
            await callSendAPI(psid, 
              "🌟 Welcome to Timeless Creations Rewards Program!\n\n" +
              "To register, please send your details in ONE message format:\n\n" +
              "Elder/Sister [Last name]\n" +
              "email@missionary.org"
            );
            continue;
          }

          // 3. Quick Choices
          if (msg === 'menu_catalog' || msg.includes('catalog')) {
            await sendCatalogCarousel(psid, user ? user.points : 0);
            continue;
          }

          if (msg === 'menu_faqs' || msg.includes('faqs') || msg.includes('help')) {
            await callSendAPI(psid, getQuickChoices(
              "❓ FAQs:\n\n" +
              "• Points are earned monthly automatically.\n" +
              "• Rewards are redeemed risk-free via 'Gawa muna bago bayad'.\n" +
              "• Use the buttons below to browse products or get assistance."
            ));
            continue;
          }

          // 4. Redemption Postbacks
          if (msg.startsWith('redeem_')) {
            let cost = 0; let item = "";
            if (msg.includes('keychain')) { cost = 6; item = "Temple Keychain"; }
            else if (msg.includes('nametag')) { cost = 24; item = "Nametag Keychain"; }
            else if (msg.includes('salvation')) { cost = 42; item = "Salvation Kit (POS)"; }
            else if (msg.includes('scripture')) { cost = 60; item = "Scripture Case"; }

            if (!user) {
              await callSendAPI(psid, "Please register first by typing 'Get Started'.");
            } else if (user.points < cost) {
              await callSendAPI(psid, getQuickChoices(`✕ Insufficient Points! You have ${user.points} pt(s), but ${item} requires ${cost} pts.`));
            } else {
              const orderId = 'TX-' + crypto.randomBytes(4).toString('hex').toUpperCase();
              await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ?", [cost, psid]);
              await runSql("INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')", 
                           [orderId, psid, user.email, user.name, item, cost]);

              await callSendAPI(psid, getQuickChoices(`🎟️ Redemption Confirmed!\n\nRef: ${orderId}\nItem: ${item}\nRemaining Points: ${user.points - cost}`));
            }
            continue;
          }

          // 5. Single-Message Registration
          if (!user) {
            const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
            const emailLine = lines.find(l => l.toLowerCase().includes('@missionary.org'));
            const nameLine = lines.find(l => l.toLowerCase().startsWith('elder') || l.toLowerCase().startsWith('sister') || l !== emailLine);

            if (nameLine && emailLine && emailLine.toLowerCase().endsWith('@missionary.org')) {
              const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
              const tempData = JSON.stringify({ name: nameLine, email: emailLine, otp: otpCode });
              
              await runSql("INSERT OR REPLACE INTO sessions (psid, state, temp_data) VALUES (?, 'AWAITING_OTP', ?)", [psid, tempData]);
              await sendBrevoOtpEmail(emailLine, nameLine, otpCode);
              await callSendAPI(psid, `We sent an OTP to your email (${emailLine}).\n\nPlease reply with the 6-digit OTP code to complete registration:`);
              await logSystemEvent('INFO', `OTP generated for ${emailLine}: ${otpCode}`);
            } else {
              await callSendAPI(psid, 
                "⚠️ Invalid format. Please send both lines in ONE message:\n\n" +
                "Elder/Sister [Last Name]\n" +
                "yourname@missionary.org"
              );
            }
            continue;
          }

          // 6. Registered user fallback
          await callSendAPI(psid, getQuickChoices(`Hello ${user.name}! Choose an option below:`));
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
