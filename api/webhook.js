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
    console.error("❌ Missing FIREBASE_API_KEY or FIREBASE_DATABASE_URL");
    return null;
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// 2. HELPER UTILITIES
function generateEncryptedRefID(psid, rewardName) {
  const raw = `${psid}-${rewardName}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `TX-${hash.substring(0, 8)}`;
}

// 3. BREVO TRANSACTIONAL EMAIL
async function sendBrevoEmail(recipientEmail, otpCode, titleName) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return false;

  const payload = {
    sender: { name: "Timeless Creations Rewards", email: "noreply@timelesscreations.com" },
    to: [{ email: recipientEmail, name: titleName || "Missionary" }],
    subject: "Your TCRP Verification Code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2>Timeless Creations Rewards Program</h2>
        <p>Greetings <strong>${titleName || 'Missionary'}</strong>,</p>
        <p>Your 6-digit account verification code is:</p>
        <h1 style="color: #0284c7; letter-spacing: 5px;">${otpCode}</h1>
        <p>Enter this code in Messenger to complete your verification.</p>
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

// 4. META SEND API
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

// 5. NOTIFY ALL REGISTERED ADMINS
async function notifyAdmins(db, notificationText) {
  try {
    const adminSnap = await get(ref(db, 'admins'));
    if (adminSnap.exists()) {
      const adminList = adminSnap.val();
      for (const adminPsid in adminList) {
        if (adminList[adminPsid] === true) {
          await callSendAPI(adminPsid, notificationText, defaultQuickReplies);
        }
      }
    }
  } catch (err) {
    console.error("Admin Notification Error:", err);
  }
}

// 6. PERSISTENT MENU CONFIGURATION
async function setupPersistentMenu() {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const payload = {
    get_started: { payload: "GET_STARTED" },
    greeting: [
      {
        locale: "default",
        text: "Welcome to Timeless Creations Rewards! Tap 'Get Started' to begin and unlock custom missionary gear."
      }
    ],
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          { type: "postback", title: "🏆 Dashboard & Points", payload: "PAYLOAD_CHECK_POINTS" },
          { type: "postback", title: "🎁 Rewards Catalog", payload: "PAYLOAD_CATALOG" },
          { type: "postback", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" },
          { type: "postback", title: "❓ FAQs", payload: "PAYLOAD_FAQS" },
          { type: "postback", title: "📜 Terms & Privacy", payload: "PAYLOAD_TERMS" }
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

// 7. PRODUCT CATALOG CAROUSEL TEMPLATE
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
              buttons: [{ type: "postback", title: "Claim (6 Points)", payload: "CLAIM_KEYCHAIN" }]
            },
            {
              title: "✦ Nametag Keychain",
              image_url: imgNametag,
              subtitle: "◈ Cost: 24 Points\nOfficial missionary replica nametag.",
              buttons: [{ type: "postback", title: "Claim (24 Points)", payload: "CLAIM_NAMETAG" }]
            },
            {
              title: "✦ Salvation Kit",
              image_url: imgSalvation,
              subtitle: "◈ Cost: 42 Points\nPlan of Salvation visual teaching set.",
              buttons: [{ type: "postback", title: "Claim (42 Points)", payload: "CLAIM_SALVATION" }]
            },
            {
              title: "✦ Scripture Case",
              image_url: imgScripture,
              subtitle: "◈ Cost: 60 Points\nHandcrafted genuine leather tote case.",
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
  } catch (err) {}
}

// 8. MENUS & QUICK REPLIES
const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" },
  { content_type: "text", title: "❓ FAQs", payload: "PAYLOAD_FAQS" }
];

const catalogQuickReplies = [
  { content_type: "text", title: "🔙 Back to Menu", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" }
];

const termsQuickReplies = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];

const globalInviteQuickReply = [
  { content_type: "text", title: "Use Global Code: TCRP", payload: "TCRP" }
];

const faqMenuQuickReplies = [
  { content_type: "text", title: "1️⃣ What is TCRP?", payload: "FAQ_1" },
  { content_type: "text", title: "2️⃣ How to Earn?", payload: "FAQ_2" },
  { content_type: "text", title: "3️⃣ Items & Costs", payload: "FAQ_3" },
  { content_type: "text", title: "4️⃣ How to Redeem?", payload: "FAQ_4" },
  { content_type: "text", title: "5️⃣ Eligible Emails?", payload: "FAQ_5" },
  { content_type: "text", title: "🔙 Back to Menu", payload: "PAYLOAD_CHECK_POINTS" }
];

// 9. WEBHOOK CORE CONTROLLER
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      await setupPersistentMenu();
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

          // Secret Admin Command: /Admin 0726
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            await set(ref(db, `admins/${senderPsid}`), true);
            await callSendAPI(
              senderPsid,
              `👑 𝐀𝐃𝐌𝐈𝐍 𝐀𝐂𝐂𝐄𝐒𝐒 𝐆𝐑𝐀𝐍𝐓𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━\n` +
              `You now receive real-time purchase notices.\n\n` +
              `💡 𝐓𝐢𝐩: To fulfill orders, paste the user's Redemption Receipt or Reference ID directly in this chat.`,
              defaultQuickReplies
            );
            continue;
          }

          // Admin Receipt Fulfillment Handler (Detects TX-XXXXXXXX)
          const refIdMatch = messageText.match(/TX-[A-Z0-9]{8}/i);
          if (refIdMatch) {
            const detectedRefId = refIdMatch[0].toUpperCase();
            const txRef = ref(db, `transactions/${detectedRefId}`);
            const txSnap = await get(txRef);

            const isUserAdmin = (snapshot.exists() && snapshot.val().isAdmin === true);

            if (txSnap.exists()) {
              const txData = txSnap.val();

              if (isUserAdmin) {
                await update(txRef, { status: "FULFILLED", fulfilledAt: new Date().toISOString() });

                // Notify Admin of fulfillment
                await callSendAPI(
                  senderPsid,
                  `✅ 𝐎𝐑𝐃𝐄𝐑 𝐅𝐔𝐋𝐅𝐈𝐋𝐋𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━\n` +
                  `Reference ID: ${detectedRefId}\n` +
                  `Recipient:    ${txData.name}\n` +
                  `Item:         ${txData.item}\n` +
                  `Status:       FULFILLED & DISPATCHED`,
                  defaultQuickReplies
                );

                // Notify User of fulfillment
                if (txData.psid) {
                  await callSendAPI(
                    txData.psid,
                    `🎉 𝐆𝐎𝐎𝐃 𝐍𝐄𝐖𝐒!\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `Your reward (${txData.item}) under Reference ID ${detectedRefId} has been marked as **FULFILLED** by the team and dispatched!`,
                    defaultQuickReplies
                  );
                }
                continue;
              }
            }
          }

          // GET STARTED / RESET
          const isGetStarted = (postbackPayload === "GET_STARTED" || messageText.toLowerCase() === "get started");

          if (isGetStarted || !snapshot.exists()) {
            const initialUserData = {
              psid: senderPsid,
              state: "AWAITING_TERMS",
              termsAccepted: false,
              invited: false,
              verified: false,
              points: 0,
              pendingRefParam: mmeReferral ? mmeReferral.toUpperCase() : (snapshot.exists() ? (snapshot.val().pendingRefParam || null) : null),
              createdAt: snapshot.exists() ? (snapshot.val().createdAt || new Date().toISOString()) : new Date().toISOString()
            };

            await set(userRef, initialUserData);

            const welcomeMsg = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `Welcome to TCRP — crafted by Timeless Creations for custom missionary gear.\n\n` +
              `📜 𝐓𝐞𝐫𝐦𝐬 & 𝐏𝐫𝐢𝐯𝐚𝐜𝐲:\n` +
              `By selecting "Agree & Continue", you confirm acceptance of our Terms of Service & Privacy Policy.\n\n` +
              `Please select an option below:`;

            await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
            continue;
          }

          let userData = snapshot.val();
          let userState = userData.state || "AWAITING_TERMS";

          // STEP 1: TERMS & CONDITIONS
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
                  `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\n` +
                  `Please enter the Invitation Code from a fellow missionary, or tap below to claim using Global Code: TCRP`,
                  globalInviteQuickReply
                );
                continue;
              }
            } else if (messageText === "DECLINE_TERMS") {
              await callSendAPI(senderPsid, `✕ 𝐓𝐄𝐑𝐌𝐒 𝐃𝐄𝐂🇱𝐈𝐍𝐄𝐃\n\nParticipation in TCRP requires accepting our Terms of Service. Tap below when ready:`, termsQuickReplies);
              continue;
            } else {
              await callSendAPI(senderPsid, `Please tap "✓ Agree & Continue" below to proceed:`, termsQuickReplies);
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
                  await callSendAPI(senderPsid, `✕ 𝐆🇱𝐎𝐁𝐀🇱 🇱𝐈𝐌𝐈𝐓 𝐑𝐄𝐀🇨🇭𝐄𝐃\n\nThe Global Invitation Code TCRP has reached its maximum limit of 100 claims. Please enter a personal invitation code.`);
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
                    await callSendAPI(referrerPsid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀🇱!\n\nA missionary registered using your link! You earned +1 Reward Point!`);
                  }
                }

                await callSendAPI(
                  senderPsid,
                  `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${inputCode})\n━━━━━━━━━━━━━━━━━━━━\n` +
                  `Please enter your Missionary Title and Last Name:\n` +
                  `(e.g., Elder Smith or Sister Johnson)`
                );
              } else {
                await callSendAPI(senderPsid, `✕ Invalid Invitation Code. Please enter a valid code or tap below:`, globalInviteQuickReply);
              }
            } else {
              await callSendAPI(senderPsid, `🔑 An Invitation Code is required. Enter your code or tap below:`, globalInviteQuickReply);
            }
            continue;
          }

          // STEP 3: TITLE & NAME
          if (userState === "AWAITING_TITLE" || !userData.titleName) {
            const formatted = messageText.trim();
            if (formatted.toLowerCase().startsWith("elder ") || formatted.toLowerCase().startsWith("sister ")) {
              const formattedName = formatted.charAt(0).toUpperCase() + formatted.slice(1);
              await update(userRef, { titleName: formattedName, state: "AWAITING_EMAIL" });
              userData.titleName = formattedName;
              userData.state = "AWAITING_EMAIL";

              await callSendAPI(senderPsid, `Greetings, ${formattedName}!\n\nPlease enter your official email ending in @missionary.org:`);
            } else {
              await callSendAPI(senderPsid, `⚠️ Please start with "Elder" or "Sister" followed by your last name (e.g., Elder Smith or Sister Johnson):`);
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
                  `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n━━━━━━━━━━━━━━━━━━━━\n` +
                  `Registered: ${userData.titleName}\n` +
                  `◈ Welcome Bonus: +1 Point\n` +
                  `◈ Your Code: ${personalRefCode}\n\n` +
                  `Rule: 1 Referral = 1 Point. Share your code to unlock custom rewards!`,
                  defaultQuickReplies
                );
              } else {
                await callSendAPI(senderPsid, "✕ Incorrect verification code. Please check your inbox and enter the 6-digit code.");
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
                await callSendAPI(senderPsid, `📧 Verification code sent to ${messageText.toLowerCase()}!\n\nPlease check your inbox and reply here with the 6-digit code.`);
              } else {
                await callSendAPI(senderPsid, `📧 Verification Code: ${passCode}\n\nPlease reply with this 6-digit code to complete setup.`);
              }
            } else {
              await callSendAPI(senderPsid, "⚠️ Please enter a valid email ending in @missionary.org:");
            }
            continue;
          }

          // STEP 5: VERIFIED DASHBOARD, CATALOG, FAQS & ACTIONS
          const query = messageText.toLowerCase();

          // DASHBOARD
          if (query.includes("points") || query.includes("dashboard") || messageText === "PAYLOAD_CHECK_POINTS") {
            const dash = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n━━━━━━━━━━━━━━━━━━━━\n` +
              `Registered:  ${userData.titleName}\n` +
              `Email:       ${userData.email}\n` +
              `Balance:     ${userData.points || 0} Point(s)\n` +
              `Your Code:   ${userData.referralCode}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `Rule: 1 Referral = 1 Point`;
            await callSendAPI(senderPsid, dash, defaultQuickReplies);
          }
          // CATALOG
          else if (query.includes("catalog") || query.includes("redeem") || messageText === "PAYLOAD_CATALOG") {
            await callSendAPI(senderPsid, "🎁 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐂𝐀𝐓𝐀🇱𝐎𝐆\nSwipe right to view items and tap Claim:");
            await sendCatalogCarousel(senderPsid);
            await callSendAPI(senderPsid, "Tap an option below to navigate:", catalogQuickReplies);
          }
          // PROMO
          else if (query.includes("promo") || query.includes("refer") || messageText === "PAYLOAD_PROMO") {
            const baseUrl = process.env.MESSENGER_LINK || "https://m.me/yourpage";
            const shareableLink = `${baseUrl}?ref=${userData.referralCode}`;

            const promo = `📢 𝐒𝐇𝐀𝐑𝐄 & 𝐄𝐀𝐑𝐍 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n━━━━━━━━━━━━━━━━━━━━\n` +
              `Share your personal referral link with fellow missionaries. When they join, BOTH of you receive +1 Reward Point!\n\n` +
              `🔗 𝐘𝐨𝐮𝐫 𝐑𝐞𝐟𝐞𝐫𝐫𝐚𝐥 𝐋𝐢𝐧𝐤:\n` +
              `${shareableLink}\n\n` +
              `👉 Or share Code: ${userData.referralCode}`;
            await callSendAPI(senderPsid, promo, defaultQuickReplies);
          }
          // FAQ HUB
          else if (query.includes("faq") || messageText === "PAYLOAD_FAQS") {
            const faqPrompt = `❓ 𝐅𝐑𝐄𝐐𝐔𝐄𝐍𝐓𝐋𝐘 𝐀𝐒𝐊𝐄𝐃 𝐐𝐔𝐄𝐒𝐓𝐈𝐎𝐍𝐒\n━━━━━━━━━━━━━━━━━━━━\n` +
              `Select any topic below to learn more:`;
            await callSendAPI(senderPsid, faqPrompt, faqMenuQuickReplies);
          }
          // INDIVIDUAL FAQ RESPONSES
          else if (messageText === "FAQ_1") {
            const resText = `❓ 𝐖𝐡𝐚𝐭 𝐢𝐬 𝐓𝐂𝐑𝐏?\n━━━━━━━━━━━━━━━━━━━━\n` +
              `Timeless Creations Rewards Program (TCRP) is an exclusive rewards platform for missionaries to earn custom missionary gear by inviting their companions and district members.`;
            await callSendAPI(senderPsid, resText, faqMenuQuickReplies);
          }
          else if (messageText === "FAQ_2") {
            const resText = `❓ 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐞𝐚𝐫𝐧 𝐩𝐨𝐢𝐧𝐭𝐬?\n━━━━━━━━━━━━━━━━━━━━\n` +
              `◈ +1 Point welcome bonus on account verification.\n` +
              `◈ +1 Point every time a missionary signs up and verifies using your referral code/link.`;
            await callSendAPI(senderPsid, resText, faqMenuQuickReplies);
          }
          else if (messageText === "FAQ_3") {
            const resText = `❓ 𝐖𝐡𝐚𝐭 𝐚𝐫𝐞 𝐭𝐡𝐞 𝐢𝐭𝐞𝐦𝐬 & 𝐜𝐨𝐬𝐭𝐬?\n━━━━━━━━━━━━━━━━━━━━\n` +
              `✦ Temple Keychain: 6 Points\n` +
              `✦ Nametag Keychain: 24 Points\n` +
              `✦ Salvation Kit: 42 Points\n` +
              `✦ Scripture Case: 60 Points`;
            await callSendAPI(senderPsid, resText, faqMenuQuickReplies);
          }
          else if (messageText === "FAQ_4") {
            const resText = `❓ 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐫𝐞𝐝𝐞𝐞𝐦?\n━━━━━━━━━━━━━━━━━━━━\n` +
              `Browse the 🎁 Catalog and tap Claim. You will receive a unique Reference ID receipt. Present this receipt to our team to arrange dispatch.`;
            await callSendAPI(senderPsid, resText, faqMenuQuickReplies);
          }
          else if (messageText === "FAQ_5") {
            const resText = `❓ 𝐖𝐡𝐨 𝐜𝐚𝐧 𝐣𝐨𝐢𝐧?\n━━━━━━━━━━━━━━━━━━━━\n` +
              `Currently serving missionaries carrying the title of Elder or Sister with an active @missionary.org email address.`;
            await callSendAPI(senderPsid, resText, faqMenuQuickReplies);
          }
          // TERMS & PRIVACY VIEWER
          else if (messageText === "PAYLOAD_TERMS" || query.includes("terms") || query.includes("privacy")) {
            const termsMsg = `📜 𝐓𝐄𝐑𝐌𝐒 & 𝐂𝐎𝐍𝐃𝐈𝐓𝐈𝐎𝐍𝐒\n━━━━━━━━━━━━━━━━━━━━\n` +
              `1. Eligibility: Active missionaries only.\n` +
              `2. 1 Account per missionary PSID/Email.\n` +
              `3. Points have no cash value and are redeemable only for listed rewards.\n` +
              `4. Dispatch times depend on current production queue and location.\n\n` +
              `Privacy: Information collected is strictly used for order fulfillment and account authentication.`;
            await callSendAPI(senderPsid, termsMsg, defaultQuickReplies);
          }
          // REDEEM CLAIM ACTIONS
          else if (messageText.startsWith("CLAIM_")) {
            let cost = 0;
            let itemName = "";

            if (messageText === "CLAIM_KEYCHAIN") { cost = 6; itemName = "Temple Keychain"; }
            if (messageText === "CLAIM_NAMETAG") { cost = 24; itemName = "Nametag Keychain"; }
            if (messageText === "CLAIM_SALVATION") { cost = 42; itemName = "Salvation Kit"; }
            if (messageText === "CLAIM_SCRIPTURE") { cost = 60; itemName = "Scripture Case"; }

            const userPoints = userData.points || 0;
            if (userPoints < cost) {
              await callSendAPI(
                senderPsid,
                `✕ 𝐈𝐍𝐒𝐔𝐅🇫𝐈𝐂𝐈🇪🇳𝐓 𝐏𝐎🇮🇳𝐓𝐒\n━━━━━━━━━━━━━━━━━━━━\n` +
                `${itemName} requires ${cost} points. You currently have ${userPoints} point(s).`,
                defaultQuickReplies
              );
            } else {
              const newPoints = userPoints - cost;
              const refID = generateEncryptedRefID(senderPsid, itemName);

              await update(userRef, { points: newPoints });

              // Record Transaction in Database
              await set(ref(db, `transactions/${refID}`), {
                psid: senderPsid,
                name: userData.titleName,
                email: userData.email,
                item: itemName,
                pointsSpent: cost,
                balanceRemaining: newPoints,
                status: "PENDING_DISPATCH",
                timestamp: new Date().toISOString()
              });

              // Generate User Receipt
              const receipt = `━━━━━━━━━━━━━━━━━━━━\n` +
                `   𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒  \n` +
                `       𝐑𝐄𝐃𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐑𝐄𝐂𝐄𝐈𝐏𝐓      \n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Registered:   ${userData.titleName}\n` +
                `Reference ID: ${refID}\n` +
                `Item Claimed: ${itemName}\n` +
                `Points Used:  ${cost} Point(s)\n` +
                `Balance:      ${newPoints} Point(s)\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Status: PENDING DISPATCH\n` +
                `Present this Reference ID to an Admin to claim!`;

              await callSendAPI(senderPsid, receipt, defaultQuickReplies);

              // 📢 Trigger Real-Time Notification to All Admins
              const adminNotice = `🔔 𝐍𝐄𝐖 𝐑𝐄𝐖𝐀𝐑𝐃 𝐂𝐋𝐀𝐈𝐌\n━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Registered:   ${userData.titleName}\n` +
                `📧 Email:        ${userData.email}\n` +
                `🎁 Item Claimed: ${itemName}\n` +
                `💎 Points Spent: ${cost} (Remaining: ${newPoints})\n` +
                `🔖 Reference ID: ${refID}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `💡 Paste this Reference ID here once fulfilled to notify the user.`;

              await notifyAdmins(db, adminNotice);
            }
          }
          else {
            await callSendAPI(senderPsid, `Greetings, ${userData.titleName}! Choose an option below:`, defaultQuickReplies);
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
};
