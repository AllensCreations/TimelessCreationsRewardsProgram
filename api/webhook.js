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

function generateEncryptedRefID(psid, rewardName) {
  const raw = `${psid}-${rewardName}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `TX-${hash.substring(0, 8)}`;
}

// Function to send custom branded HTML email via Brevo SMTP API
async function sendVerificationEmail(recipientEmail, otpCode, titleName) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SENDER_EMAIL = process.env.SENDER_EMAIL || "noreply.timelesscreations.ph@gmail.com";
  const TEST_RECEIVER = "2ndSalviejomark2019@gmail.com"; // Test receiver email added

  if (!BREVO_API_KEY) return false;

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Account - TCRP</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; padding:30px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:32px 24px; text-align:center;">
                  <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:700;">TimelessCreations Rewards Program</h1>
                  <p style="color:#94a3b8; margin:6px 0 0 0; font-size:13px; text-transform:uppercase;">Official Missionary Portal</p>
                </td>
              </tr>
              <tr>
                <td style="padding:36px 32px; color:#334155; line-height:1.6;">
                  <h2 style="color:#0f172a; margin:0 0 12px 0; font-size:18px;">Email Verification Required</h2>
                  <p style="margin:0 0 20px 0; font-size:14px; color:#475569;">
                    Greetings <strong>${titleName}</strong>! Thank you for registering with TCRP by <strong>Timeless Creations</strong>.
                  </p>
                  <div style="background:#f8fafc; border:2px dashed #cbd5e1; border-radius:10px; padding:20px; text-align:center; margin-bottom:24px;">
                    <span style="font-family:'Courier New', monospace; font-size:36px; font-weight:800; color:#2563eb; letter-spacing:8px;">${otpCode}</span>
                    <p style="margin:8px 0 0 0; font-size:11px; color:#64748b; text-transform:uppercase;">Expires in 15 minutes</p>
                  </div>
                  <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center;">
                    By verifying, you agree to receive promotional updates from Timeless Creations.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f8fafc; padding:20px; text-align:center; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8;">
                  &copy; 2026 Timeless Creations. All rights reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Receivers list includes both the user's email and your test receiver
  const recipients = [{ email: recipientEmail }];
  if (recipientEmail.toLowerCase() !== TEST_RECEIVER.toLowerCase()) {
    recipients.push({ email: TEST_RECEIVER });
  }

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
        to: recipients,
        subject: `${otpCode} is your TCRP Verification Code`,
        htmlContent: htmlTemplate
      })
    });
    return res.ok;
  } catch (err) {
    console.error('Brevo Error:', err);
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
    console.error('Meta API Error:', err);
  }
}

async function sendCatalogCarousel(senderPsid) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const imgKeychain = process.env.IMG_KEYCHAIN || "https://dummyimage.com/600x400/0f172a/ffffff.png&text=Temple+Keychain";
  const imgNametag = process.env.IMG_NAMETAG || "https://dummyimage.com/600x400/0f172a/ffffff.png&text=Nametag+Keychain";
  const imgSalvation = process.env.IMG_SALVATION || "https://dummyimage.com/600x400/0f172a/ffffff.png&text=Salvation+Kit";
  const imgScripture = process.env.IMG_SCRIPTURE || "https://dummyimage.com/600x400/0f172a/ffffff.png&text=Scripture+Case";

  const requestBody = {
    recipient: { id: senderPsid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "🔑 Temple Keychain",
              image_url: imgKeychain,
              subtitle: "Cost: 6 Points (6 Referrals)\nCustom stainless steel temple outline.",
              buttons: [{ type: "postback", title: "Claim (6 Points)", payload: "CLAIM_KEYCHAIN" }]
            },
            {
              title: "🏷️ Nametag Keychain",
              image_url: imgNametag,
              subtitle: "Cost: 24 Points (24 Referrals)\nEngraved official missionary nametag replica.",
              buttons: [{ type: "postback", title: "Claim (24 Points)", payload: "CLAIM_NAMETAG" }]
            },
            {
              title: "📦 Salvation Kit",
              image_url: imgSalvation,
              subtitle: "Cost: 42 Points (42 Referrals)\nComplete Plan of Salvation teaching kit.",
              buttons: [{ type: "postback", title: "Claim (42 Points)", payload: "CLAIM_SALVATION" }]
            },
            {
              title: "📖 Scripture Case",
              image_url: imgScripture,
              subtitle: "Cost: 60 Points (60 Referrals)\nPremium protective leather scripture tote.",
              buttons: [{ type: "postback", title: "Claim (60 Points)", payload: "CLAIM_SCRIPTURE" }]
            }
          ]
        }
      }
    }
  };

  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    console.error('Meta API Carousel Error:', err);
  }
}

const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard & Points", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog & Redeem", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" }
];

const termsQuickReplies = [
  { content_type: "text", title: "✅ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "❌ Decline", payload: "DECLINE_TERMS" }
];

const globalInviteQuickReply = [
  { content_type: "text", title: "Use Global Code: TCRP", payload: "TCRP" }
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

          let rawText = event.message?.text?.trim() || "";
          let quickReplyPayload = event.message?.quick_reply?.payload || "";
          let postbackPayload = event.postback?.payload || "";

          let messageText = quickReplyPayload || postbackPayload || rawText;
          if (!messageText) continue;

          const userRef = ref(db, `users/${senderPsid}`);
          const snapshot = await get(userRef);

          // Admin Command
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            await callSendAPI(senderPsid, "👑 Admin access granted for TCRP!", defaultQuickReplies);
            continue;
          }

          if (!snapshot.exists()) {
            await set(userRef, {
              psid: senderPsid,
              termsAccepted: false,
              invited: false,
              verified: false,
              points: 0,
              createdAt: new Date().toISOString()
            });

            const welcomeMsg = `Welcome to TimelessCreations Rewards Program (TCRP)! 🎉\n\n` +
              `Brought to you by Timeless Creations — custom missionary keychains, nametags, and gear.\n\n` +
              `📜 Terms & Privacy Notice:\n` +
              `By tapping "Agree & Continue", you agree to our Terms of Service & Privacy Policy, and consent to receiving promotional updates at your registered email address.\n\n` +
              `You must accept to proceed.`;

            await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
            continue;
          }

          let userData = snapshot.val();

          if (messageText === 'AGREE_TERMS' || messageText.toLowerCase().includes('agree')) {
            await update(userRef, { termsAccepted: true });
            userData.termsAccepted = true;

            await callSendAPI(
              senderPsid, 
              `✅ Terms Accepted!\n\n🔑 Invitation Code Required:\nTo join TCRP, please enter an Invitation Code from a fellow missionary, or tap below to use the Global Code: TCRP (Limited to first 100 claims)`, 
              globalInviteQuickReply
            );
            continue;
          }

          if (messageText === 'DECLINE_TERMS') {
            await callSendAPI(
              senderPsid, 
              `⚠️ Terms Declined.\n\nYou must accept the Terms & Conditions to participate in TCRP. Tap below to accept:`, 
              termsQuickReplies
            );
            continue;
          }

          if (!userData.termsAccepted) {
            await callSendAPI(senderPsid, `Please tap "✅ Agree & Continue" below to proceed:`, termsQuickReplies);
            continue;
          }

          if (!userData.invited) {
            const codeInput = messageText.toUpperCase();
            
            if (codeInput === 'TCRP' || codeInput.startsWith('TCRP-')) {
              let isValidCode = false;
              let isGlobalCode = (codeInput === 'TCRP');
              let referrerPsid = null;
              let referrerData = null;

              if (isGlobalCode) {
                const statsRef = ref(db, 'stats/globalInvitesClaimed');
                const statsSnap = await get(statsRef);
                const currentGlobalClaims = statsSnap.exists() ? statsSnap.val() : 0;

                if (currentGlobalClaims >= 100) {
                  await callSendAPI(
                    senderPsid, 
                    `❌ The Global Invitation Code TCRP has reached its maximum limit of 100 claims!\n\nPlease request a personal referral code from a fellow missionary to join.`
                  );
                  continue;
                } else {
                  isValidCode = true;
                  await set(statsRef, currentGlobalClaims + 1);
                }
              } else {
                const usersSnap = await get(ref(db, 'users'));
                if (usersSnap.exists()) {
                  const allUsers = usersSnap.val();
                  for (const id in allUsers) {
                    if (allUsers[id].referralCode === codeInput) {
                      referrerPsid = id;
                      referrerData = allUsers[id];
                      isValidCode = true;
                      break;
                    }
                  }
                }
              }

              if (isValidCode) {
                await update(userRef, { invited: true, usedInviteCode: codeInput });
                userData.invited = true;

                if (referrerPsid && referrerData) {
                  await update(ref(db, `users/${referrerPsid}`), { points: (referrerData.points || 0) + 1 });
                  await callSendAPI(referrerPsid, `🎉 A new missionary used your invitation code! You earned +1 Point!`);
                }

                await callSendAPI(
                  senderPsid, 
                  `✅ Invitation Code Accepted!\n\nPlease enter your Missionary Title and Last Name (e.g., Elder Smith or Sister Johnson):`
                );
              } else {
                await callSendAPI(senderPsid, `❌ Invalid Invitation Code. Enter a valid code or tap below:`, globalInviteQuickReply);
              }
            } else {
              await callSendAPI(senderPsid, `🔑 An Invitation Code is required. Enter your code or tap below:`, globalInviteQuickReply);
            }
            continue;
          }

          if (!userData.titleName) {
            if (messageText.toLowerCase().startsWith('elder') || messageText.toLowerCase().startsWith('sister')) {
              const formattedName = messageText.charAt(0).toUpperCase() + messageText.slice(1);
              await update(userRef, { titleName: formattedName });
              userData.titleName = formattedName;

              await callSendAPI(senderPsid, `Pleased to meet you, ${formattedName}!\n\nNow, enter your official email address ending in @missionary.org to complete verification:`);
            } else {
              await callSendAPI(senderPsid, `⚠️ Please start with "Elder" or "Sister" followed by your last name (e.g., Elder Smith or Sister Johnson):`);
            }
            continue;
          }

          if (!userData.verified) {
            if (/^\d{6}$/.test(messageText)) {
              if (userData.otpCode && messageText === userData.otpCode.toString()) {
                const personalRefCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                await update(userRef, {
                  verified: true,
                  referralCode: personalRefCode,
                  points: 1,
                  otpCode: null
                });

                await callSendAPI(
                  senderPsid, 
                  `🎉 Account Verified!\n\nRegistered: ${userData.titleName}\n• Welcome Bonus: 1 Point\n• Personal Referral Code: ${personalRefCode}\n\nRule: 1 Referral = 1 Point! Share your code to unlock rewards!`, 
                  defaultQuickReplies
                );
              } else {
                await callSendAPI(senderPsid, "❌ Incorrect verification code. Please check your email inbox and enter the 6-digit code.");
              }
            } else if (messageText.toLowerCase().endsWith('@missionary.org')) {
              const passCode = Math.floor(100000 + Math.random() * 900000).toString();
              await update(userRef, { email: messageText.toLowerCase(), otpCode: passCode });

              await sendVerificationEmail(messageText.toLowerCase(), passCode, userData.titleName);

              await callSendAPI(senderPsid, `📧 Verification email sent to ${messageText.toLowerCase()}!\n\nPlease check your inbox and reply here with the 6-digit code.`);
            } else {
              await callSendAPI(senderPsid, "⚠️ Please provide a valid email ending in @missionary.org");
            }
            continue;
          }

          const query = messageText.toLowerCase();

          if (query.includes('points') || query.includes('dashboard') || messageText === 'PAYLOAD_CHECK_POINTS') {
            const dash = `🏆 TCRP MISSIONARY DASHBOARD\n` +
              `=============================\n` +
              `Registered: ${userData.titleName}\n` +
              `Email: ${userData.email}\n` +
              `Current Points: ${userData.points} Point(s)\n` +
              `Referral Code: ${userData.referralCode}\n` +
              `=============================\n` +
              `Rule: 1 Referral = 1 Point!\n` +
              `Share your code with other missionaries to earn rewards.`;
            await callSendAPI(senderPsid, dash, defaultQuickReplies);
          }
          else if (query.includes('catalog') || query.includes('redeem') || messageText === 'PAYLOAD_CATALOG') {
            await callSendAPI(senderPsid, "🎁 Here is the Timeless Creations Rewards Catalog. Swipe right to view all items:");
            await sendCatalogCarousel(senderPsid);
            await callSendAPI(senderPsid, "Tap any button on the cards above to redeem your reward!", defaultQuickReplies);
          }
          else if (query.includes('promo') || query.includes('refer') || messageText === 'PAYLOAD_PROMO') {
            const promo = `📢 SHARE TIMELESS CREATIONS & EARN REWARDS!\n\n` +
              `Timeless Creations is your provider for custom missionary keychains, nametag holders, and gifts!\n\n` +
              `🎁 Invite fellow missionaries to join TCRP using your personal code:\n\n` +
              `👉 YOUR CODE: ${userData.referralCode}\n\n` +
              `When they sign up using your code, BOTH of you earn +1 Reward Point!`;
            await callSendAPI(senderPsid, promo, defaultQuickReplies);
          }
          else if (messageText.startsWith('CLAIM_')) {
            let cost = 0;
            let itemName = "";

            if (messageText === 'CLAIM_KEYCHAIN') { cost = 6; itemName = "Temple Keychain"; }
            if (messageText === 'CLAIM_NAMETAG') { cost = 24; itemName = "Nametag Keychain"; }
            if (messageText === 'CLAIM_SALVATION') { cost = 42; itemName = "Salvation Kit"; }
            if (messageText === 'CLAIM_SCRIPTURE') { cost = 60; itemName = "Scripture Case"; }

            if (userData.points < cost) {
              await callSendAPI(senderPsid, `❌ Insufficient Points!\n\n${itemName} requires ${cost} points. Registered (${userData.titleName}) currently has ${userData.points} point(s).`, defaultQuickReplies);
            } else {
              const newPoints = userData.points - cost;
              const refID = generateEncryptedRefID(senderPsid, itemName);

              await update(userRef, { points: newPoints });

              const receipt = `=================================\n` +
                `     TIMELLESS CREATIONS REWARDS   \n` +
                `         REDEMPTION RECEIPT        \n` +
                `=================================\n` +
                `Registered:    ${userData.titleName}\n` +
                `Reference ID:  ${refID}\n` +
                `Item Claimed:  ${itemName}\n` +
                `Points Spent:  ${cost} Point(s)\n` +
                `Remaining:     ${newPoints} Point(s)\n` +
                `=================================\n` +
                `Status: PENDING DISPATCH\n` +
                `Present this Reference ID to claim!`;

              await callSendAPI(senderPsid, receipt, defaultQuickReplies);
            }
          }
          else {
            await callSendAPI(senderPsid, `Hello ${userData.titleName}! Select an option below:`, defaultQuickReplies);
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }
};
