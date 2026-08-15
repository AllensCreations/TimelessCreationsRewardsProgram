const { initializeApp, getApps } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const crypto = require('crypto');

// 1. FIREBASE INITIALIZATION
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
    console.error("❌ CRITICAL: Missing FIREBASE_API_KEY or FIREBASE_DATABASE_URL");
    return null;
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// 2. HELPER UTILITIES
function generateEncryptedRefID(psid, rewardName) {
  const raw = `${psid}-${rewardName}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `TX-${hash.substring(0, 6)}`;
}

// 3. BREVO TRANSACTIONAL EMAIL DISPATCHER
async function sendBrevoEmail(recipientEmail, otpCode, titleName) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return false;

  const payload = {
    sender: { name: "Timeless Creations Rewards", email: "noreply@timelesscreations.com" },
    to: [{ email: recipientEmail, name: titleName || "Missionary" }],
    subject: "Your TCRP Verification Code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 480px;">
        <h2 style="color: #0f172a; margin-top: 0;">Timeless Creations Rewards</h2>
        <p style="color: #475569;">Greetings <strong>${titleName || 'Missionary'}</strong>,</p>
        <p style="color: #475569;">Your 6-digit verification code is:</p>
        <div style="background: #f1f5f9; padding: 12px; text-align: center; border-radius: 6px; margin: 15px 0;">
          <span style="font-size: 26px; font-weight: bold; letter-spacing: 5px; color: #0284c7;">${otpCode}</span>
        </div>
        <p style="color: #64748b; font-size: 12px;">Reply in Messenger with this code to activate your account.</p>
      </div>`
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

// 4. PERSISTENT MENU SETUP
async function setupMessengerProfile() {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const payload = {
    get_started: { payload: "GET_STARTED_PAYLOAD" },
    greeting: [
      {
        locale: "default",
        text: "Welcome to Timeless Creations Rewards Program (TCRP)! Tap 'Get Started' to activate your account and earn custom missionary gear."
      }
    ],
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          { type: "postback", title: "🏆 Dashboard", payload: "PAYLOAD_CHECK_POINTS" },
          { type: "postback", title: "🎁 Rewards Catalog", payload: "PAYLOAD_CATALOG" },
          { type: "postback", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" },
          { type: "postback", title: "❓ Top FAQs", payload: "PAYLOAD_FAQS" },
          { type: "postback", title: "📜 Terms & Conditions", payload: "PAYLOAD_TERMS" }
        ]
      }
    ]
  };

  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {}
}

// 5. META GRAPH SEND API
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
  } catch (err) {}
}

// 6. PRODUCT CATALOG CAROUSEL
async function sendCatalogCarousel(senderPsid) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const imgKeychain = process.env.IMG_KEYCHAIN || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Temple+Keychain";
  const imgNametag = process.env.IMG_NAMETAG || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Nametag+Keychain";
  const imgSalvation = process.env.IMG_SALVATION || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Salvation+Kit";
  const imgScripture = process.env.IMG_SCRIPTURE || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Scripture+Case";

  const requestBody = {
    recipient: { id: senderPsid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          image_aspect_ratio: "square",
          elements: [
            {
              title: "✦ Temple Keychain",
              image_url: imgKeychain,
              subtitle: "◈ Cost: 6 Points\nEngraved stainless steel temple outline.",
              buttons: [{ type: "postback", title: "Claim (6 Pts)", payload: "CLAIM_KEYCHAIN" }]
            },
            {
              title: "✦ Nametag Keychain",
              image_url: imgNametag,
              subtitle: "◈ Cost: 24 Points\nOfficial replica missionary nametag.",
              buttons: [{ type: "postback", title: "Claim (24 Pts)", payload: "CLAIM_NAMETAG" }]
            },
            {
              title: "✦ Salvation Kit",
              image_url: imgSalvation,
              subtitle: "◈ Cost: 42 Points\nPlan of Salvation visual visual set.",
              buttons: [{ type: "postback", title: "Claim (42 Pts)", payload: "CLAIM_SALVATION" }]
            },
            {
              title: "✦ Scripture Case",
              image_url: imgScripture,
              subtitle: "◈ Cost: 60 Points\nHandcrafted genuine leather tote.",
              buttons: [{ type: "postback", title: "Claim (60 Pts)", payload: "CLAIM_SCRIPTURE" }]
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
  } catch (err) {}
}

// 7. MENUS & QUICK REPLIES
const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" },
  { content_type: "text", title: "❓ FAQs", payload: "PAYLOAD_FAQS" }
];

const catalogQuickReplies = [
  { content_type: "text", title: "🔙 Back to Menu", payload: "PAYLOAD_MAIN_MENU" },
  { content_type: "text", title: "🏆 My Points", payload: "PAYLOAD_CHECK_POINTS" }
];

const termsQuickReplies = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];

const globalInviteQuickReply = [
  { content_type: "text", title: "Use Global Code: TCRP", payload: "TCRP" }
];

// 8. COMBINED FAQS CONTENT (TOP 5)
const FAQS_TEXT = 
`❓ 𝐅𝐑𝐄𝐐𝐔𝐄𝐍𝐓𝐋𝐘 𝐀𝐒𝐊𝐄𝐃 𝐐𝐔𝐄𝐒𝐓𝐈𝐎𝐍𝐒

𝟏. 𝐖𝐡𝐚𝐭 𝐢𝐬 𝐓𝐂𝐑𝐏?
A rewards program by Timeless Creations giving serving missionaries free custom gear through referrals.

𝟐. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐞𝐚𝐫𝐧 𝐩𝐨𝐢𝐧𝐭𝐬?
• +1 Welcome Point upon email verification.
• +1 Point every time a missionary signs up with your link.

𝟑. 𝐖𝐡𝐨 𝐢𝐬 𝐞𝐥𝐢𝐠𝐢𝐛𝐥𝐞?
Currently serving missionaries with an active @missionary.org email address.

𝟒. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐜𝐥𝐚𝐢𝐦 𝐫𝐞𝐰𝐚𝐫𝐝𝐬?
Reach the required point goal, select Claim in the Catalog, and present your Reference ID to the page.

𝟓. 𝐃𝐨 𝐩𝐨𝐢𝐧𝐭𝐬 𝐞𝐱𝐩𝐢𝐫𝐞?
Your points stay active throughout your entire mission duration!`;

const TERMS_TEXT = 
`📜 𝐓𝐄𝐑𝐌𝐒 & 𝐂𝐎𝐍𝐃𝐈𝐓𝐈𝐎𝐍𝐒
━━━━━━━━━━━━━━━━━━
1. TCRP is dedicated solely to active missionaries.
2. Verified @missionary.org email is mandatory.
3. 1 account per missionary. Duplicate accounts are subject to point forfeiture.
4. Reward items are fulfilled based on stock availability and dispatch schedule.`;

// 9. WEBHOOK HANDLER
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      await setupMessengerProfile();
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Verification token mismatch');
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (body.object === 'page' && body.entry) {
      const app = initFirebase();
      if (!app) return res.status(200).send('EVENT_RECEIVED');
      const db = getDatabase(app);

      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        for (const event of entry.messaging) {
          const senderPsid = event.sender.id;

          const rawText = event.message?.text?.trim() || "";
          const quickReplyPayload = event.message?.quick_reply?.payload || "";
          const postbackPayload = event.postback?.payload || "";
          const mmeReferral = event.postback?.referral?.ref || event.referral?.ref || "";

          let messageText = quickReplyPayload || postbackPayload || rawText;
          if (!messageText && !mmeReferral) continue;

          const userRef = ref(db, `users/${senderPsid}`);
          const snapshot = await get(userRef);

          if (mmeReferral) {
            await update(userRef, { pendingRefParam: mmeReferral.toUpperCase() });
          }

          // -------------------------------------------------------------
          // ADMIN SUITE & COMMANDS
          // -------------------------------------------------------------
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            const adminMenu = 
              `👑 𝐀𝐃𝐌𝐈𝐍 𝐏𝐀𝐍𝐄𝐋 𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Commands available:\n` +
              `• /orders - View all active orders\n` +
              `• /setstatus <REF_ID> <Pending|Complete>\n` +
              `• /points <PSID> <Amount> - Adjust points`;
            await callSendAPI(senderPsid, adminMenu, defaultQuickReplies);
            continue;
          }

          // Check Admin status for privileged commands
          const isAdminUser = snapshot.exists() && snapshot.val().isAdmin === true;

          if (isAdminUser && messageText.toLowerCase() === '/orders') {
            const txSnap = await get(ref(db, 'transactions'));
            if (!txSnap.exists()) {
              await callSendAPI(senderPsid, "📦 No redemption orders found.", defaultQuickReplies);
            } else {
              const allTx = txSnap.val();
              let orderList = `📦 𝐂𝐔𝐑𝐑𝐄𝐍𝐓 𝐎𝐑𝐃𝐄𝐑𝐒 𝐋𝐈𝐒𝐓\n━━━━━━━━━━━━━━━━━━\n`;
              let count = 0;

              for (const id in allTx) {
                const o = allTx[id];
                const statusEmoji = o.status === 'Complete' ? '✅' : '⏳';
                orderList += `${statusEmoji} 𝐈𝐃: ${id}\n👤 ${o.name}\n🎁 ${o.item} (${o.pointsSpent} pts)\n📌 Status: ${o.status || 'Pending'}\n📅 ${o.timestamp?.substring(0, 10) || 'N/A'}\n──────────────────\n`;
                count++;
                if (count >= 8) break; // Keep inside mobile screen limits
              }

              orderList += `Update status with:\n/setstatus <REF_ID> <Pending|Complete>`;
              await callSendAPI(senderPsid, orderList, defaultQuickReplies);
            }
            continue;
          }

          if (isAdminUser && messageText.toLowerCase().startsWith('/setstatus')) {
            const parts = messageText.split(' ');
            if (parts.length >= 3) {
              const targetRefId = parts[1].toUpperCase();
              const newStatus = parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase();

              const orderRef = ref(db, `transactions/${targetRefId}`);
              const orderSnap = await get(orderRef);

              if (orderSnap.exists()) {
                await update(orderRef, { status: newStatus });
                const orderData = orderSnap.val();

                // Notify User of status change
                if (orderData.psid) {
                  const notifyMsg = 
                    `📦 𝐎𝐑𝐃𝐄𝐑 𝐔𝐏𝐃𝐀𝐓𝐄\n` +
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `Your reward order for ${orderData.item} (${targetRefId}) is now: **${newStatus.toUpperCase()}**`;
                  await callSendAPI(orderData.psid, notifyMsg, defaultQuickReplies);
                }

                await callSendAPI(senderPsid, `✅ Order ${targetRefId} marked as ${newStatus}.`, defaultQuickReplies);
              } else {
                await callSendAPI(senderPsid, `✕ Order ${targetRefId} not found.`, defaultQuickReplies);
              }
            } else {
              await callSendAPI(senderPsid, `⚠️ Usage: /setstatus <REF_ID> <Pending|Complete>`, defaultQuickReplies);
            }
            continue;
          }

          // -------------------------------------------------------------
          // GLOBAL INFO & FAQS
          // -------------------------------------------------------------
          if (messageText === "PAYLOAD_FAQS" || messageText.toLowerCase() === "faqs" || messageText.toLowerCase() === "faq") {
            await callSendAPI(senderPsid, FAQS_TEXT, defaultQuickReplies);
            continue;
          }

          if (messageText === "PAYLOAD_TERMS" || messageText.toLowerCase() === "terms") {
            await callSendAPI(senderPsid, TERMS_TEXT, defaultQuickReplies);
            continue;
          }

          if (messageText === "PAYLOAD_MAIN_MENU" || messageText.toLowerCase() === "back" || messageText.toLowerCase() === "menu") {
            await callSendAPI(senderPsid, `🏠 𝐌𝐀𝐈𝐍 𝐌𝐄𝐍𝐔\nChoose an action below:`, defaultQuickReplies);
            continue;
          }

          // -------------------------------------------------------------
          // USER ONBOARDING
          // -------------------------------------------------------------
          const isGetStarted = (postbackPayload === "GET_STARTED" || postbackPayload === "GET_STARTED_PAYLOAD" || messageText.toLowerCase() === "get started");

          if (isGetStarted || !snapshot.exists()) {
            await set(userRef, {
              psid: senderPsid,
              state: "AWAITING_TERMS",
              termsAccepted: false,
              invited: false,
              verified: false,
              points: 0,
              pendingRefParam: mmeReferral ? mmeReferral.toUpperCase() : (snapshot.exists() ? (snapshot.val().pendingRefParam || null) : null),
              createdAt: snapshot.exists() ? (snapshot.val().createdAt || new Date().toISOString()) : new Date().toISOString()
            });

            const welcomeMsg = 
              `🌟 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐓𝐂𝐑𝐏!\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Timeless Creations Rewards Program provides exclusive custom gear for missionaries.\n\n` +
              `✨ 𝐖𝐡𝐚𝐭 𝐲𝐨𝐮 𝐠𝐞𝐭:\n` +
              `• Free Temple & Nametag Keychains\n` +
              `• Teaching sets & leather scripture cases\n` +
              `• +1 Free Point just for joining!\n\n` +
              `Please agree to our Terms to begin:`;

            await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
            continue;
          }

          let userData = snapshot.val();
          let userState = userData.state || "AWAITING_TERMS";

          // STEP 1: TERMS
          if (userState === "AWAITING_TERMS" || !userData.termsAccepted) {
            if (messageText === "AGREE_TERMS" || messageText.toLowerCase().includes("agree")) {
              await update(userRef, { termsAccepted: true, state: "AWAITING_INVITE" });
              userData.termsAccepted = true;
              userData.state = "AWAITING_INVITE";

              const autoCode = userData.pendingRefParam || mmeReferral;
              if (autoCode) {
                messageText = autoCode.toUpperCase();
              } else {
                await callSendAPI(
                  senderPsid,
                  `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\n` +
                  `Enter a referral code from a missionary, or tap below for the Global Code:`,
                  globalInviteQuickReply
                );
                continue;
              }
            } else if (messageText === "DECLINE_TERMS") {
              await callSendAPI(senderPsid, `✕ Terms declined. Tap below when you're ready:`, termsQuickReplies);
              continue;
            } else {
              await callSendAPI(senderPsid, `Please tap "✓ Agree & Continue" to start:`, termsQuickReplies);
              continue;
            }
          }

          // STEP 2: INVITATION CODE
          if (userState === "AWAITING_INVITE" || !userData.invited) {
            const inputCode = messageText.toUpperCase().trim();

            if (inputCode === "TCRP" || inputCode.startsWith("TCRP-")) {
              let isValidCode = false;
              let isGlobalCode = (inputCode === "TCRP");
              let referrerPsid = null;

              if (isGlobalCode) {
                const statsRef = ref(db, 'stats/globalInvitesClaimed');
                const statsSnap = await get(statsRef);
                const currentGlobalClaims = statsSnap.exists() ? statsSnap.val() : 0;

                if (currentGlobalClaims >= 100) {
                  await callSendAPI(senderPsid, `✕ Global Code reached its limit. Please enter a missionary referral code:`);
                  continue;
                } else {
                  isValidCode = true;
                  await set(statsRef, currentGlobalClaims + 1);
                }
              } else {
                const codeLookupSnap = await get(ref(db, `referralCodes/${inputCode}`));
                if (codeLookupSnap.exists()) {
                  referrerPsid = codeLookupSnap.val();
                  isValidCode = true;
                }
              }

              if (isValidCode) {
                await update(userRef, {
                  invited: true,
                  usedInviteCode: inputCode,
                  pendingRefParam: null,
                  state: "AWAITING_TITLE"
                });
                userData.invited = true;
                userData.state = "AWAITING_TITLE";

                if (referrerPsid && referrerPsid !== senderPsid) {
                  const referrerSnap = await get(ref(db, `users/${referrerPsid}`));
                  if (referrerSnap.exists()) {
                    const currentPoints = referrerSnap.val().points || 0;
                    await update(ref(db, `users/${referrerPsid}`), { points: currentPoints + 1 });
                    await callSendAPI(referrerPsid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\n\nA missionary joined with your code! +1 Point added to your balance!`);
                  }
                }

                await callSendAPI(
                  senderPsid,
                  `✓ 𝐂𝐎𝐃𝐄 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${inputCode})\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `Please enter your Title and Last Name:\n` +
                  `(e.g., Elder Smith or Sister Johnson)`
                );
              } else {
                await callSendAPI(senderPsid, `✕ Invalid code. Enter a valid referral code or tap below:`, globalInviteQuickReply);
              }
            } else {
              await callSendAPI(senderPsid, `🔑 Please enter your Invitation Code or tap below:`, globalInviteQuickReply);
            }
            continue;
          }

          // STEP 3: TITLE & LAST NAME
          if (userState === "AWAITING_TITLE" || !userData.titleName) {
            const formatted = messageText.trim();
            if (formatted.toLowerCase().startsWith("elder ") || formatted.toLowerCase().startsWith("sister ")) {
              const formattedName = formatted.charAt(0).toUpperCase() + formatted.slice(1);
              await update(userRef, { titleName: formattedName, state: "AWAITING_EMAIL" });
              userData.titleName = formattedName;
              userData.state = "AWAITING_EMAIL";

              await callSendAPI(senderPsid, `Greetings, ${formattedName}!\n\nEnter your official email ending in @missionary.org:`);
            } else {
              await callSendAPI(senderPsid, `⚠️ Please start with "Elder" or "Sister" (e.g., Elder Smith or Sister Johnson):`);
            }
            continue;
          }

          // STEP 4: EMAIL & OTP
          if (userState === "AWAITING_EMAIL" || userState === "AWAITING_OTP" || !userData.verified) {
            if (/^\d{6}$/.test(messageText)) {
              if (userData.otpCode && messageText === userData.otpCode.toString()) {
                const personalRefCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);

                await update(userRef, {
                  verified: true,
                  referralCode: personalRefCode,
                  points: (userData.points || 0) + 1,
                  otpCode: null,
                  state: "VERIFIED"
                });

                await set(ref(db, `referralCodes/${personalRefCode}`), senderPsid);

                await callSendAPI(
                  senderPsid,
                  `🎉 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `Registered: ${userData.titleName}\n` +
                  `🎁 Welcome Bonus: +1 Point\n` +
                  `🔗 Your Code: ${personalRefCode}\n\n` +
                  `Tap below to explore rewards or check your dashboard:`,
                  defaultQuickReplies
                );
              } else {
                await callSendAPI(senderPsid, "✕ Incorrect code. Please check your email inbox and enter the 6-digit code.");
              }
            } else if (messageText.toLowerCase().endsWith("@missionary.org")) {
              const passCode = Math.floor(100000 + Math.random() * 900000).toString();
              await update(userRef, {
                email: messageText.toLowerCase(),
                otpCode: passCode,
                state: "AWAITING_OTP"
              });

              const emailSent = await sendBrevoEmail(messageText.toLowerCase(), passCode, userData.titleName);

              if (emailSent) {
                await callSendAPI(senderPsid, `📧 Code sent to ${messageText.toLowerCase()}!\n\nReply here with the 6-digit verification code:`);
              } else {
                await callSendAPI(senderPsid, `📧 Verification Code: ${passCode}\n\nReply with this 6-digit code to complete setup:`);
              }
            } else {
              await callSendAPI(senderPsid, "⚠️ Please provide a valid email ending in @missionary.org:");
            }
            continue;
          }

          // -------------------------------------------------------------
          // STEP 5: VERIFIED DASHBOARD & ACTIONS
          // -------------------------------------------------------------
          const query = messageText.toLowerCase();

          if (query.includes("points") || query.includes("dashboard") || messageText === "PAYLOAD_CHECK_POINTS") {
            const dash = 
              `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `👤 Name:    ${userData.titleName}\n` +
              `📧 Email:   ${userData.email}\n` +
              `⭐ Points:  ${userData.points || 0} Point(s)\n` +
              `🔑 Code:    ${userData.referralCode}\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Rule: 1 Referral = 1 Point`;
            await callSendAPI(senderPsid, dash, defaultQuickReplies);
          }
          else if (query.includes("catalog") || query.includes("redeem") || messageText === "PAYLOAD_CATALOG") {
            await callSendAPI(senderPsid, "🎁 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐂𝐀𝐓𝐀𝐋𝐎𝐆\nSwipe right to view gear:");
            await sendCatalogCarousel(senderPsid);
            await callSendAPI(senderPsid, "Tap 'Claim' on any item above, or go back:", catalogQuickReplies);
          }
          else if (query.includes("promo") || query.includes("refer") || messageText === "PAYLOAD_PROMO") {
            const baseUrl = process.env.MESSENGER_LINK || "https://m.me/yourpage";
            const shareableLink = `${baseUrl}?ref=${userData.referralCode}`;

            const promo = 
              `📢 𝐒𝐇𝐀𝐑𝐄 & 𝐄𝐀𝐑𝐍 𝐆𝐄𝐀𝐑\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Share your link with fellow missionaries. When they join, BOTH of you get +1 Point!\n\n` +
              `🔗 𝐘𝐨𝐮𝐫 𝐋𝐢𝐧𝐤:\n${shareableLink}\n\n` +
              `👉 Or share Code: ${userData.referralCode}`;
            await callSendAPI(senderPsid, promo, defaultQuickReplies);
          }
          else if (messageText.startsWith("CLAIM_")) {
            let cost = 0;
            let itemName = "";

            if (messageText === "CLAIM_KEYCHAIN") { cost = 6; itemName = "Temple Keychain"; }
            if (messageText === "CLAIM_NAMETAG") { cost = 24; itemName = "Nametag Keychain"; }
            if (messageText === "CLAIM_SALVATION") { cost = 42; itemName = "Salvation Kit"; }
            if (messageText === "CLAIM_SCRIPTURE") { cost = 60; itemName = "Scripture Case"; }

            const userPoints = userData.points || 0;
            if (userPoints < cost) {
              await callSendAPI(senderPsid, `✕ 𝐈𝐍𝐒𝐔𝐅𝐅𝐈𝐂𝐈𝐄𝐍𝐓 𝐏𝐎𝐈𝐍𝐓𝐒\n\n${itemName} requires ${cost} points. You currently have ${userPoints} point(s).`, defaultQuickReplies);
            } else {
              const newPoints = userPoints - cost;
              const refID = generateEncryptedRefID(senderPsid, itemName);

              await update(userRef, { points: newPoints });

              await set(ref(db, `transactions/${refID}`), {
                psid: senderPsid,
                name: userData.titleName,
                item: itemName,
                pointsSpent: cost,
                status: "Pending",
                timestamp: new Date().toISOString()
              });

              const receipt = 
                `━━━━━━━━━━━━━━━━━━\n` +
                ` 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒 \n` +
                `     𝐑𝐄𝐃𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐑𝐄𝐂𝐄𝐈𝐏𝐓    \n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `👤 Name:    ${userData.titleName}\n` +
                `🔖 Ref ID:  ${refID}\n` +
                `🎁 Item:    ${itemName}\n` +
                `⭐ Spent:   ${cost} Pts\n` +
                `💳 Balance: ${newPoints} Pts\n` +
                `📌 Status:  PENDING\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `Present this Ref ID to our page to arrange dispatch!`;

              await callSendAPI(senderPsid, receipt, defaultQuickReplies);
            }
          }
          else {
            await callSendAPI(senderPsid, `Greetings, ${userData.titleName}! Choose an action below:`, defaultQuickReplies);
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
};
