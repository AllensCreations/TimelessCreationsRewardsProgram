const { initializeApp, getApps } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const crypto = require('crypto');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

function initFirebase() {
  if (!process.env.FIREBASE_API_KEY || !process.env.FIREBASE_DATABASE_URL) {
    return null;
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// Generate encrypted 10-character reference ID
function generateEncryptedRefID(psid, rewardName) {
  const raw = `${psid}-${rewardName}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `TX-${hash.substring(0, 8)}`;
}

// Function to send custom branded HTML email via Brevo SMTP API
async function sendVerificationEmail(recipientEmail, otpCode) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SENDER_EMAIL = process.env.SENDER_EMAIL || "2ndsalviejomark2019@gmail.com";

  if (!BREVO_API_KEY) {
    console.error("CRITICAL: BREVO_API_KEY is missing!");
    return false;
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Account - TCRP</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; padding:30px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:32px 24px; text-align:center;">
                  <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:700; letter-spacing:0.5px;">TimelessCreations Rewards Program</h1>
                  <p style="color:#94a3b8; margin:6px 0 0 0; font-size:13px; text-transform:uppercase; letter-spacing:1px;">Official Missionary Portal</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 32px; color:#334155; line-height:1.6;">
                  <h2 style="color:#0f172a; margin:0 0 12px 0; font-size:18px;">Email Verification Required</h2>
                  <p style="margin:0 0 24px 0; font-size:14px; color:#475569;">
                    Thank you for signing up for TCRP! Please enter the 6-digit verification code below in your Messenger chat to confirm your <strong>@missionary.org</strong> email address and activate your account.
                  </p>

                  <!-- Verification Code Box -->
                  <div style="background:#f8fafc; border:2px dashed #cbd5e1; border-radius:10px; padding:20px; text-align:center; margin-bottom:28px;">
                    <span style="font-family:'Courier New', Courier, monospace; font-size:36px; font-weight:800; color:#2563eb; letter-spacing:8px; display:inline-block;">${otpCode}</span>
                    <p style="margin:8px 0 0 0; font-size:11px; color:#64748b; text-transform:uppercase;">Code expires in 15 minutes</p>
                  </div>

                  <!-- Program Perks -->
                  <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:14px 16px; border-radius:0 6px 6px 0; margin-bottom:24px;">
                    <p style="margin:0; font-size:13px; color:#1e40af; font-weight:600;">🎁 What happens next?</p>
                    <p style="margin:4px 0 0 0; font-size:12px; color:#1e3a8a;">Verifying unlocks your 1 Welcome Bonus Point and your unique Referral Code. Earn rewards at 6, 24, 42, and 60 points!</p>
                  </div>

                  <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center;">If you did not request this verification, you can safely ignore this email.</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8fafc; padding:20px; text-align:center; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8;">
                  &copy; 2026 TimelessCreations Rewards Program (TCRP). All rights reserved.<br>
                  <a href="https://timelesscreationsrewardsprogram.vercel.app/privacy.html" style="color:#2563eb; text-decoration:none;">Privacy Policy</a>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "TimelessCreations Rewards", email: SENDER_EMAIL },
        to: [{ email: recipientEmail }],
        subject: `${otpCode} is your TCRP Verification Code`,
        htmlContent: htmlTemplate
      })
    });

    const data = await res.json();
    return res.ok;
  } catch (err) {
    console.error('Brevo API Connection Error:', err);
    return false;
  }
}

async function callSendAPI(senderPsid, responseText, quickReplies = null) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const requestBody = {
    recipient: { id: senderPsid },
    message: { text: responseText }
  };

  if (quickReplies && Array.isArray(quickReplies)) {
    requestBody.message.quick_replies = quickReplies;
  }

  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    console.error('Meta Graph API Error:', err);
  }
}

// Quick Reply Preset Buttons
const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Points & Code", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "🔑 Redeem Item", payload: "PAYLOAD_REDEEM" },
  { content_type: "text", title: "❓ Help", payload: "PAYLOAD_HELP" }
];

const pendingQuickReplies = [
  { content_type: "text", title: "🔄 Resend Email", payload: "PAYLOAD_RESEND" },
  { content_type: "text", title: "❓ Help", payload: "PAYLOAD_HELP" }
];

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Verification token mismatch');
  } 
  
  if (req.method === 'POST') {
    const body = req.body;
    if (body.object === 'page' && body.entry) {
      const app = initFirebase();
      if (!app) return res.status(500).send('Server Error');
      const db = getDatabase(app);

      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        for (const event of entry.messaging) {
          const senderPsid = event.sender.id;
          let messageText = event.message?.text?.trim() || event.postback?.payload || "";
          if (!messageText) continue;

          const userRef = ref(db, `users/${senderPsid}`);
          const snapshot = await get(userRef);

          // Secret Admin Command
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            await callSendAPI(senderPsid, "👑 Admin access granted for TCRP!", defaultQuickReplies);
            continue;
          }

          if (!snapshot.exists()) {
            await set(userRef, {
              psid: senderPsid,
              verified: false,
              points: 0,
              createdAt: new Date().toISOString()
            });
            await callSendAPI(senderPsid, "Welcome to TimelessCreations Rewards Program! 🎉\n\nPlease enter your official email address ending in @missionary.org to receive your email verification code.");
          } else {
            const userData = snapshot.val();

            // Unverified Account Flow
            if (!userData.verified) {
              // Resend option
              if (messageText === 'PAYLOAD_RESEND' && userData.email) {
                const passCode = Math.floor(100000 + Math.random() * 900000).toString();
                await update(userRef, { otpCode: passCode });
                const sent = await sendVerificationEmail(userData.email, passCode);
                
                if (sent) {
                  await callSendAPI(senderPsid, `📩 Resent verification email to ${userData.email}!\n\nPlease check your inbox and reply here with the 6-digit code.`, pendingQuickReplies);
                } else {
                  await callSendAPI(senderPsid, "⚠️ Failed to deliver email via Brevo. Please verify your email address and try again.", pendingQuickReplies);
                }
              }
              // Verify 6-digit OTP Code
              else if (/^\d{6}$/.test(messageText)) {
                if (userData.otpCode && messageText === userData.otpCode.toString()) {
                  const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                  await update(userRef, {
                    verified: true,
                    referralCode: refCode,
                    points: 1, // 1 Starting Point
                    otpCode: null
                  });
                  await callSendAPI(senderPsid, `🎉 Account verified successfully!\n\n• Welcome Bonus: 1 Point\n• Referral Code: ${refCode}\n\nRule: 1 Referral = 1 Point! Share your code with fellow missionaries to unlock rewards.`, defaultQuickReplies);
                } else {
                  await callSendAPI(senderPsid, "❌ Incorrect verification code. Please check your Gmail inbox and enter the 6-digit code.", pendingQuickReplies);
                }
              } 
              // Process Email Input
              else if (messageText.toLowerCase().endsWith('@missionary.org')) {
                const passCode = Math.floor(100000 + Math.random() * 900000).toString();
                await update(userRef, { email: messageText.toLowerCase(), otpCode: passCode });

                const sent = await sendVerificationEmail(messageText.toLowerCase(), passCode);

                if (sent) {
                  await callSendAPI(senderPsid, `📧 Verification email dispatched to ${messageText.toLowerCase()}!\n\nPlease check your inbox/spam folder and reply here with the 6-digit verification code.`, pendingQuickReplies);
                } else {
                  await callSendAPI(senderPsid, "⚠️ Failed to send verification email. Please check your email address or try again later.", pendingQuickReplies);
                }
              } else {
                await callSendAPI(senderPsid, "⚠️ Please enter a valid email address ending in @missionary.org");
              }
            } 
            
            // Verified User Operations
            else {
              const query = messageText.toLowerCase();

              // Redeem Referral Code
              if (messageText.startsWith("TCRP-")) {
                if (messageText.toUpperCase() === userData.referralCode) {
                  await callSendAPI(senderPsid, "⚠️ You cannot redeem your own referral code!", defaultQuickReplies);
                } else if (userData.usedReferral) {
                  await callSendAPI(senderPsid, "⚠️ You have already redeemed a referral code.", defaultQuickReplies);
                } else {
                  const usersSnap = await get(ref(db, 'users'));
                  let referrerPsid = null;
                  let referrerData = null;

                  if (usersSnap.exists()) {
                    const allUsers = usersSnap.val();
                    for (const id in allUsers) {
                      if (allUsers[id].referralCode === messageText.toUpperCase()) {
                        referrerPsid = id;
                        referrerData = allUsers[id];
                        break;
                      }
                    }
                  }

                  if (referrerPsid) {
                    await update(ref(db, `users/${referrerPsid}`), { points: (referrerData.points || 0) + 1 });
                    await update(userRef, { points: (userData.points || 0) + 1, usedReferral: true });

                    await callSendAPI(referrerPsid, `🎉 Someone redeemed your referral code! You earned +1 Point!`);
                    await callSendAPI(senderPsid, `✅ Referral applied! Both you and your referrer earned +1 Point!`, defaultQuickReplies);
                  } else {
                    await callSendAPI(senderPsid, "❌ Referral code not found. Please verify the code and try again.", defaultQuickReplies);
                  }
                }
              }
              // Check Points Balance
              else if (query.includes('points') || messageText === 'PAYLOAD_CHECK_POINTS') {
                await callSendAPI(senderPsid, `🏆 Your Account Balance:\n\n• Current Points: ${userData.points}\n• Your Referral Code: ${userData.referralCode}\n\nRule: 1 Referral = 1 Point.`, defaultQuickReplies);
              }
              // Rewards Catalog
              else if (query.includes('catalog') || messageText === 'PAYLOAD_CATALOG') {
                const catalog = "🎁 TCRP Rewards Catalog (1 Point = 1 Referral):\n\n" +
                  "1. 🔑 Temple Keychain — 6 Points\n" +
                  "2. 🏷️ Nametag Keychain — 24 Points\n" +
                  "3. 📦 Salvation Kit — 42 Points\n" +
                  "4. 📖 Scripture Case — 60 Points\n\n" +
                  "Tap 'Redeem Item' below to claim!";
                await callSendAPI(senderPsid, catalog, defaultQuickReplies);
              }
              // Item Redemption Selector
              else if (query.includes('redeem') || messageText === 'PAYLOAD_REDEEM') {
                const redeemMenu = [
                  { content_type: "text", title: "🔑 Key Chain (6)", payload: "CLAIM_KEYCHAIN" },
                  { content_type: "text", title: "🏷️ Tag Chain (24)", payload: "CLAIM_NAMETAG" },
                  { content_type: "text", title: "📦 Salvation (42)", payload: "CLAIM_SALVATION" },
                  { content_type: "text", title: "📖 Scripture (60)", payload: "CLAIM_SCRIPTURE" }
                ];
                await callSendAPI(senderPsid, "Select the item you want to redeem:", redeemMenu);
              }
              // Handle Item Redemption & Receipt Generation
              else if (messageText.startsWith('CLAIM_')) {
                let cost = 0;
                let itemName = "";

                if (messageText === 'CLAIM_KEYCHAIN') { cost = 6; itemName = "Temple Keychain"; }
                if (messageText === 'CLAIM_NAMETAG') { cost = 24; itemName = "Nametag Keychain"; }
                if (messageText === 'CLAIM_SALVATION') { cost = 42; itemName = "Salvation Kit"; }
                if (messageText === 'CLAIM_SCRIPTURE') { cost = 60; itemName = "Scripture Case"; }

                if (userData.points < cost) {
                  await callSendAPI(senderPsid, `❌ Insufficient Points!\n\n${itemName} requires ${cost} points. You have ${userData.points} points.`, defaultQuickReplies);
                } else {
                  const newPoints = userData.points - cost;
                  const refID = generateEncryptedRefID(senderPsid, itemName);

                  await update(userRef, { points: newPoints });

                  const receipt = `=================================\n` +
                    `     TIMELLESS CREATIONS REWARDS   \n` +
                    `         REDEMPTION RECEIPT        \n` +
                    `=================================\n` +
                    `Reference ID:  ${refID}\n` +
                    `Item Claimed:  ${itemName}\n` +
                    `Points Spent:  ${cost} Points\n` +
                    `Remaining:     ${newPoints} Points\n` +
                    `=================================\n` +
                    `Status: PENDING DISPATCH\n` +
                    `Present this Reference ID to claim!`;

                  await callSendAPI(senderPsid, receipt, defaultQuickReplies);
                }
              }
              else {
                await callSendAPI(senderPsid, "Hello! Select an option from below:", defaultQuickReplies);
              }
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }
};
