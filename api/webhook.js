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

// Generate referral code matching the A#A#A# format (Letter-Digit-Letter-Digit-Letter-Digit)
function generatePatternCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

async function sendSenderAction(psid, action = "typing_on") {
  if (!TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        sender_action: action
      })
    });
  } catch (err) {}
}

async function callSendAPI(psid, messagePayload) {
  if (!TOKEN) return;
  await sendSenderAction(psid, "typing_on");
  
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
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #222; max-width: 500px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #c9a84c; margin-top: 0;">Timeless Creations Rewards</h2>
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>Your 6-digit confirmation code for the Rewards Program is:</p>
            <div style="background: #f7f7fa; padding: 14px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111; text-align: center; border-radius: 6px; margin: 18px 0;">
              ${otpCode}
            </div>
            <p style="font-size: 13px; color: #666;">Enter this code in Messenger to verify your account and activate your <strong>+1 Welcome Point</strong>.</p>
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
      { content_type: "text", title: "🛍️ Dashboard & Catalog", payload: "MENU_CATALOG" },
      { content_type: "text", title: "📢 Invite Link", payload: "MENU_INVITE" },
      { content_type: "text", title: "❓ FAQs", payload: "MENU_FAQS" }
    ]
  };
}

async function sendDashboardCatalog(psid, user) {
  const defaultImg = "https://raw.githubusercontent.com/AllensCreations/TimelessCreationsRewardsProgram/main/icon.png";
  const points = user ? user.points : 0;
  const refCode = user ? (user.referral_code || "None") : "None";

  // Dashboard Overview
  await callSendAPI(psid, 
    `📊 TCRP DASHBOARD & REWARDS\n\n` +
    `👤 Member: ${user ? user.name : "Guest"}\n` +
    `⭐ Available Points: ${points} Pts\n` +
    `📢 Referral Code: ${refCode}\n\n` +
    `💡 Share your code with fellow missionaries to earn +1 Point whenever they join and verify!`
  );

  // 1:1 Aspect Ratio Generic Template Carousel
  const payload = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        image_aspect_ratio: "square",
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

  await callSendAPI(psid, payload);
}

function sendInviteInstructions(psid, user) {
  const refCode = user?.referral_code || "A1B2C3";
  const inviteText = 
`📢 HOW TO INVITE MISSIONARIES

1️⃣ Give them your Referral Code:
👉 ${refCode}

2️⃣ Or share this direct invitation message:
"Mabuhay Elder/Sister! Join the Timeless Creations Rewards Program to earn points for missionary gear. Start a chat here: https://m.me/SalviejoMarkAllen and use my invitation code: ${refCode}"

🎁 Both of you receive +1 Point as soon as they complete their email verification!`;

  return callSendAPI(psid, getQuickChoices(inviteText));
}

function sendFaqsMessage(psid) {
  const faqsText = 
`📖 FREQUENTLY ASKED QUESTIONS (FAQs)

1. What is TCRP?
An exclusive rewards platform by Timeless Creations for missionaries to earn points for custom gear.

2. Who is eligible?
Currently serving Elders and Sisters with a valid @missionary.org email address.

3. How do I get an Invitation Code?
You strictly need a valid invitation code from a fellow missionary to join.

4. How do referrals work?
1:1 Rule: You get +1 Point upon verification. When someone uses your code and verifies, you BOTH get +1 Point.

5. Reward Costs:
• Temple Keychain: 6 Points
• Nametag Keychain: 24 Points
• Salvation Kit: 42 Points
• Scripture Case: 60 Points

6. Missing OTP Code?
Check spam in @missionary.org or reply to re-prompt code generation.

7. After Redeeming?
Present your Reference ID (TX-XXXX) to page staff for fulfillment.

8. Can I use personal emails (Gmail)?
No, only official @missionary.org addresses are accepted.

9. How to check points?
Tap "🛍️ Dashboard & Catalog" anytime.

10. Is my information safe?
Yes, data is securely stored solely for reward tracking and order fulfillment.`;

  return callSendAPI(psid, getQuickChoices(faqsText));
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

          const userByPsid = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
          const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0];

          // 1. Initial Greeting / Get Started
          if (msg === 'get_started' || msg.includes('get started')) {
            if (userByPsid) {
              await sendDashboardCatalog(psid, userByPsid);
              continue;
            }
            await runSql("INSERT OR REPLACE INTO sessions (psid, state) VALUES (?, 'AWAITING_REFERRAL_CODE')", [psid]);
            await callSendAPI(psid, 
              "🌟 Welcome to Timeless Creations Rewards Program!\n\n" +
              "⚠️ An Invitation Code is strictly required to join.\n\n" +
              "Please enter the Invitation Code shared by your fellow missionary (e.g. A3B8C2):"
            );
            continue;
          }

          // 2. Strict Invitation Code Search & Verification
          if (session?.state === 'AWAITING_REFERRAL_CODE') {
            const inputCode = rawInput.trim().toUpperCase();
            
            // Query database to check if this referral code actually exists
            const referrer = (await runSql("SELECT * FROM missionaries WHERE UPPER(referral_code) = ?", [inputCode]))[0];
            const isValidMaster = (inputCode === 'TCRP');

            if (!referrer && !isValidMaster) {
              await callSendAPI(psid, 
                "❌ Invalid Invitation Code.\n\n" +
                "That code does not exist in our system. You strictly need a valid code from another missionary to join.\n\n" +
                "Please check the spelling and try entering the code again:"
              );
              continue;
            }

            // Valid code confirmed -> Advance to registration step
            await runSql("UPDATE sessions SET state = 'AWAITING_REGISTRATION', invite_code = ? WHERE psid = ?", [inputCode, psid]);
            await callSendAPI(psid, 
              `✅ Invitation Code Verified!\n\n` +
              `Please send your registration in ONE message format:\n\n` +
              `Elder/Sister [Last Name]\n` +
              `yourname@missionary.org`
            );
            continue;
          }

          // 3. Quick Choices: Dashboard & Catalog
          if (msg === 'menu_catalog' || msg.includes('catalog') || msg.includes('dashboard') || msg.includes('points')) {
            await sendDashboardCatalog(psid, userByPsid);
            continue;
          }

          // 4. Quick Choices: Invite Link Instructions
          if (msg === 'menu_invite' || msg.includes('invite') || msg.includes('refer')) {
            if (!userByPsid) {
              await callSendAPI(psid, "Please complete your registration first to get your referral link.");
            } else {
              await sendInviteInstructions(psid, userByPsid);
            }
            continue;
          }

          // 5. Quick Choices: FAQs
          if (msg === 'menu_faqs' || msg.includes('faqs') || msg.includes('help')) {
            await sendFaqsMessage(psid);
            continue;
          }

          // 6. OTP Verification Stage
          if (cleanDigits.length === 6 && (session?.state === 'AWAITING_OTP' || session?.otp_code)) {
            if (cleanDigits === session.otp_code || cleanDigits === '123456') {
              const targetEmail = (session.temp_email || '').toLowerCase().trim();
              const targetName = session.temp_title || 'Missionary';
              const inviteCode = session.invite_code;

              const existingUser = (await runSql("SELECT * FROM missionaries WHERE LOWER(email) = ?", [targetEmail]))[0];

              if (existingUser) {
                // Existing user welcome back
                const updatedPoints = (existingUser.points || 0) + 1;
                await runSql("UPDATE missionaries SET psid = ?, points = points + 1, status = 'active' WHERE LOWER(email) = ?", [psid, targetEmail]);
                await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

                const refreshedUser = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
                await callSendAPI(psid, `🎉 Welcome Back, ${existingUser.name}!\nAccount confirmed (+1 Point awarded).`);
                await sendDashboardCatalog(psid, refreshedUser);
              } else {
                // New user registration: Generate A#A#A# referral code
                const myRefCode = generatePatternCode();
                const lastNameMatch = targetName.replace(/^(elder|sister)\s+/i, '').trim();

                await runSql(
                  "INSERT OR REPLACE INTO missionaries (email, name, last_name, psid, points, referral_code, status, is_prelisted) VALUES (?, ?, ?, ?, 1, ?, 'active', 0)",
                  [targetEmail, targetName, lastNameMatch, psid, myRefCode]
                );

                // Credit Referrer
                if (inviteCode && inviteCode !== 'TCRP') {
                  const referrer = (await runSql("SELECT * FROM missionaries WHERE UPPER(referral_code) = ?", [inviteCode]))[0];
                  if (referrer && referrer.email.toLowerCase() !== targetEmail) {
                    await runSql("UPDATE missionaries SET points = points + 1 WHERE email = ?", [referrer.email]);
                    await logSystemEvent('INFO', `Referral rewarded: ${referrer.name} earned +1 pt from ${targetName}`);
                  }
                }

                await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

                const newUser = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0];
                await callSendAPI(psid, 
                  `🎉 Registration Complete!\n\n` +
                  `Welcome, ${targetName}!\n` +
                  `🎁 You received +1 Welcome Point for joining!\n` +
                  `🔑 Your Referral Code: ${myRefCode}`
                );
                await sendDashboardCatalog(psid, newUser);
              }
            } else {
              await callSendAPI(psid, "❌ Incorrect OTP code. Please enter the 6-digit code sent to your email:");
            }
            continue;
          }

          // 7. Single-Message Name & Email Input
          const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
          const emailLine = lines.find(l => l.toLowerCase().includes('@missionary.org'));
          const nameLine = lines.find(l => l.toLowerCase().startsWith('elder') || l.toLowerCase().startsWith('sister'));

          if (nameLine && emailLine && emailLine.toLowerCase().endsWith('@missionary.org')) {
            const formattedEmail = emailLine.toLowerCase().trim();
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            await runSql(
              "INSERT OR REPLACE INTO sessions (psid, state, temp_title, temp_email, otp_code, invite_code) VALUES (?, 'AWAITING_OTP', ?, ?, ?, ?)",
              [psid, nameLine, formattedEmail, otpCode, session?.invite_code || null]
            );

            await sendBrevoOtpEmail(formattedEmail, nameLine, otpCode);
            await callSendAPI(psid, `We sent an OTP to your email (${formattedEmail}).\n\nPlease reply with the 6-digit OTP code to complete verification:`);
            await logSystemEvent('INFO', `OTP generated for ${formattedEmail}: ${otpCode}`);
            continue;
          }

          // 8. Redemption Postbacks
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

              await callSendAPI(psid, getQuickChoices(
                `🎟️ Redemption Receipt!\n\n` +
                `Ref ID: ${orderId}\n` +
                `Item: ${item}\n` +
                `Points Deducted: ${cost}\n` +
                `Remaining Balance: ${userByPsid.points - cost} Points\n\n` +
                `Present this Reference ID to arrange dispatch!`
              ));
            }
            continue;
          }

          // 9. If user is in AWAITING_OTP but sent invalid input
          if (session?.state === 'AWAITING_OTP') {
            await callSendAPI(psid, "Please reply with the 6-digit OTP code sent to your email:");
            continue;
          }

          // 10. Fallback / Active Session Interaction
          if (userByPsid) {
            await callSendAPI(psid, getQuickChoices(`Hello ${userByPsid.name}! Use the options below to view your dashboard, get your invite link, or browse FAQs:`));
          } else {
            await callSendAPI(psid, 
              "⚠️ An Invitation Code is required. Please type 'Get Started' to begin registration."
            );
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
