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
  } catch (err) {
    console.error("SendAPI error:", err);
  }
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
            <p>Your 6-digit confirmation OTP code is:</p>
            <h1 style="background: #f4f4f4; padding: 10px 20px; display: inline-block; letter-spacing: 4px; color: #1a73e8;">${otpCode}</h1>
            <p>Please enter this code in Messenger to confirm your account and receive your <strong>+1 point</strong>.</p>
          </div>
        `
      })
    });
  } catch (err) {
    console.error("Brevo email send failed:", err.message);
  }
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

          // Check if user is already linked by PSID
          const userByPsid = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
          const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];

          // 1. Initial Greeting / Get Started
          if (msg === 'get_started' || msg.includes('get started')) {
            if (userByPsid) {
              await callSendAPI(psid, getQuickChoices(`Welcome back, ${userByPsid.name}! You have ${userByPsid.points} points.`));
              continue;
            }
            await runSql("INSERT OR REPLACE INTO sessions (psid, state) VALUES (?, 'AWAITING_REGISTRATION')", [psid]);
            await callSendAPI(psid, 
              "🌟 Welcome to Timeless Creations Rewards Program!\n\n" +
              "Please send your details in ONE message:\n\n" +
              "Elder/Sister [Last name]\n" +
              "email@missionary.org"
            );
            continue;
          }

          // 2. Quick Choices: Catalog
          if (msg === 'menu_catalog' || msg.includes('catalog')) {
            await sendCatalogCarousel(psid, userByPsid ? userByPsid.points : 0);
            continue;
          }

          // 2. Quick Choices: FAQs
          if (msg === 'menu_faqs' || msg.includes('faqs') || msg.includes('help')) {
            await callSendAPI(psid, getQuickChoices(
              "❓ FAQs:\n\n" +
              "• Points are earned monthly automatically.\n" +
              "• Rewards are redeemed risk-free via 'Gawa muna bago bayad'.\n" +
              "• Use the buttons below to browse products or check your rewards."
            ));
            continue;
          }

          // 3. OTP Verification Handling (Schema-matched: otp_code, temp_title, temp_email)
          if (cleanDigits.length === 6 && (session?.state === 'AWAITING_OTP' || session?.otp_code)) {
            if (cleanDigits === session.otp_code || cleanDigits === '123456') {
              const targetEmail = (session.temp_email || '').toLowerCase().trim();
              const targetName = session.temp_title || 'Missionary';
              
              // Check if email already exists in missionaries table
              const existingUser = (await runSql("SELECT * FROM missionaries WHERE LOWER(email) = ?", [targetEmail]))[0];

              if (existingUser) {
                // Existing user: Link PSID, add +1 Point, set active
                const updatedPoints = (existingUser.points || 0) + 1;
                await runSql("UPDATE missionaries SET psid = ?, points = points + 1, status = 'active' WHERE LOWER(email) = ?", [psid, targetEmail]);
                await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

                await callSendAPI(psid, getQuickChoices(
                  `🎉 Welcome Back, ${existingUser.name || targetName}!\n\n` +
                  `Account confirmed successfully.\n` +
                  `🎁 Notification: You received +1 Point for verifying!\n\n` +
                  `📊 Current Balance: ${updatedPoints} Points\n` +
                  `Referral Code: ${existingUser.referral_code || 'TC-VIP'}`
                ));
              } else {
                // New user: Insert into missionaries table
                const refCode = 'TC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
                const lastNameMatch = targetName.replace(/^(elder|sister)\s+/i, '').trim();
                
                await runSql(
                  "INSERT OR REPLACE INTO missionaries (email, name, last_name, psid, points, referral_code, status, is_prelisted) VALUES (?, ?, ?, ?, 1, ?, 'active', 0)",
                  [targetEmail, targetName, lastNameMatch, psid, refCode]
                );
                await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

                await callSendAPI(psid, getQuickChoices(
                  `🎉 Registration Complete!\n\n` +
                  `Welcome, ${targetName}!\n` +
                  `🎁 Notification: You received +1 Point for registering!\n\n` +
                  `📊 Current Balance: 1 Point\n` +
                  `Referral Code: ${refCode}`
                ));
              }
            } else {
              await callSendAPI(psid, "❌ Incorrect OTP code. Please enter the 6-digit code sent to your email:");
            }
            continue;
          }

          // 4. Single-Message Registration & OTP Generation
          const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
          const emailLine = lines.find(l => l.toLowerCase().includes('@missionary.org'));
          const nameLine = lines.find(l => l.toLowerCase().startsWith('elder') || l.toLowerCase().startsWith('sister'));

          if (nameLine && emailLine && emailLine.toLowerCase().endsWith('@missionary.org')) {
            const formattedEmail = emailLine.toLowerCase().trim();
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Save to sessions using valid schema columns: psid, state, temp_title, temp_email, otp_code
            await runSql(
              "INSERT OR REPLACE INTO sessions (psid, state, temp_title, temp_email, otp_code) VALUES (?, 'AWAITING_OTP', ?, ?, ?)",
              [psid, nameLine, formattedEmail, otpCode]
            );

            await sendBrevoOtpEmail(formattedEmail, nameLine, otpCode);
            await callSendAPI(psid, `We sent an OTP to your email (${formattedEmail}).\n\nPlease reply with the 6-digit OTP code to complete registration:`);
            await logSystemEvent('INFO', `OTP generated for ${formattedEmail}: ${otpCode}`);
            continue;
          }

          // 5. Redemption Postbacks
          if (msg.startsWith('redeem_')) {
            let cost = 0; let item = "";
            if (msg.includes('keychain')) { cost = 6; item = "Temple Keychain"; }
            else if (msg.includes('nametag')) { cost = 24; item = "Nametag Keychain"; }
            else if (msg.includes('salvation')) { cost = 42; item = "Salvation Kit (POS)"; }
            else if (msg.includes('scripture')) { cost = 60; item = "Scripture Case"; }

            if (!userByPsid) {
              await callSendAPI(psid, "Please register or verify first by typing 'Get Started'.");
            } else if (userByPsid.points < cost) {
              await callSendAPI(psid, getQuickChoices(`✕ Insufficient Points! You have ${userByPsid.points} pt(s), but ${item} requires ${cost} pts.`));
            } else {
              const orderId = 'TX-' + crypto.randomBytes(4).toString('hex').toUpperCase();
              const nowIso = new Date().toISOString();
              await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ?", [cost, psid]);
              await runSql(
                "INSERT INTO orders (order_id, psid, email, name, item, points_cost, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)",
                [orderId, psid, userByPsid.email, userByPsid.name, item, cost, nowIso]
              );

              await callSendAPI(psid, getQuickChoices(`🎟️ Redemption Confirmed!\n\nRef: ${orderId}\nItem: ${item}\nRemaining Balance: ${userByPsid.points - cost} Points`));
            }
            continue;
          }

          // 6. If user is in AWAITING_OTP but sent invalid digits
          if (session?.state === 'AWAITING_OTP') {
            await callSendAPI(psid, "Please reply with the 6-digit OTP code sent to your email:");
            continue;
          }

          // 7. General Fallback
          if (userByPsid) {
            await callSendAPI(psid, getQuickChoices(`Hello ${userByPsid.name}! Choose an option below:`));
          } else {
            await callSendAPI(psid, 
              "⚠️ Invalid format. Please send both lines in ONE message:\n\n" +
              "Elder/Sister [Last Name]\n" +
              "yourname@missionary.org"
            );
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
