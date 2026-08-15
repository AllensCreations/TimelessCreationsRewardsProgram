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
  return `TX-${hash.substring(0, 8)}`;
}

// 3. BREVO TRANSACTIONAL EMAIL DISPATCHER
async function sendBrevoEmail(recipientEmail, otpCode, titleName) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.warn("⚠️ BREVO_API_KEY not configured. Skipping email dispatch.");
    return false;
  }

  const payload = {
    sender: { name: "Timeless Creations Rewards", email: "noreply@timelesscreations.com" },
    to: [{ email: recipientEmail, name: titleName || "Missionary" }],
    subject: "Your TCRP Verification Code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 500px;">
        <h2 style="color: #0f172a; margin-top: 0;">Timeless Creations Rewards Program</h2>
        <p style="color: #475569;">Greetings <strong>${titleName || 'Missionary'}</strong>,</p>
        <p style="color: #475569;">Your 6-digit account verification code is:</p>
        <div style="background: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0284c7;">${otpCode}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">Enter this code directly into your Messenger conversation to complete your verification.</p>
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
    console.error('❌ Brevo Dispatch Error:', err);
    return false;
  }
}

// 4. META GRAPH SEND API HANDLER
async function callSendAPI(senderPsid, responseText, quickReplies = null) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) {
    console.error("❌ CRITICAL: PAGE_ACCESS_TOKEN is missing!");
    return;
  }

  const requestBody = {
    recipient: { id: senderPsid },
    message: { text: responseText }
  };

  if (quickReplies && Array.isArray(quickReplies)) {
    requestBody.message.quick_replies = quickReplies;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Meta Graph API Error:", JSON.stringify(data));
    }
  } catch (err) {
    console.error('❌ Network Request Error:', err);
  }
}

// 5. PRODUCT CATALOG CAROUSEL TEMPLATE
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
              subtitle: "◈ Cost: 6 Points\nCustom engraved stainless steel outline.",
              buttons: [{ type: "postback", title: "Claim (6 Points)", payload: "CLAIM_KEYCHAIN" }]
            },
            {
              title: "✦ Nametag Keychain",
              image_url: imgNametag,
              subtitle: "◈ Cost: 24 Points\nOfficial replica missionary nametag.",
              buttons: [{ type: "postback", title: "Claim (24 Points)", payload: "CLAIM_NAMETAG" }]
            },
            {
              title: "✦ Salvation Kit",
              image_url: imgSalvation,
              subtitle: "◈ Cost: 42 Points\nFull Plan of Salvation visual teaching set.",
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
  } catch (err) {
    console.error('❌ Carousel API Error:', err);
  }
}

// 6. QUICK REPLY MENUS
const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" }
];

const termsQuickReplies = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];

const globalInviteQuickReply = [
  { content_type: "text", title: "Use Global Code: TCRP", payload: "TCRP" }
];

// 7. WEBHOOK ENTRYPOINT
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

          // Strictly prioritize payload IDs
          let messageText = quickReplyPayload || postbackPayload || rawText;
          if (!messageText && !mmeReferral) continue;

          const userRef = ref(db, `users/${senderPsid}`);
          const snapshot = await get(userRef);

          if (mmeReferral) {
            await update(userRef, { pendingRefParam: mmeReferral.toUpperCase() });
          }

          // Admin Command
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            await callSendAPI(senderPsid, "👑 𝐀𝐃𝐌𝐈𝐍 𝐀𝐂𝐂𝐄𝐒𝐒 𝐆𝐑𝐀𝐍𝐓𝐄𝐃\n\nYou now have administrative privileges.", defaultQuickReplies);
            continue;
          }

          // RESET / GET STARTED
          const isGetStarted = (postbackPayload === "GET_STARTED" || postbackPayload === "GET_STARTED_PAYLOAD" || messageText.toLowerCase() === "get started");

          if (isGetStarted || !snapshot.exists()) {
            const initialUserData = {
              psid: senderPsid,
              state: "AWAITING_TERMS",
              termsAccepted: false,
              invited: false,
              verified: false,
              points: 0,
              pendingRefParam: mmeReferral ? mmeReferral.toUpperCase() : null,
              createdAt: new Date().toISOString()
            };

            await set(userRef, initialUserData);

            const welcomeMsg = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Welcome to the official TCRP portal — crafted by Timeless Creations for custom missionary gear.\n\n` +
              `📜 𝐓𝐞𝐫𝐦𝐬 & 𝐏𝐫𝐢𝐯𝐚𝐜𝐲:\n` +
              `By selecting "Agree & Continue", you confirm acceptance of our Privacy Policy & Terms of Service.\n\n` +
              `Please select an option below:`;

            await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
            continue;
          }

          let userData = snapshot.val();
          let userState = userData.state || "AWAITING_TERMS";

          // -------------------------------------------------------------
          // STEP 1: TERMS & CONDITIONS (FIXED LOCKUP)
          // -------------------------------------------------------------
          if (userState === "AWAITING_TERMS" || !userData.termsAccepted) {
            if (messageText === "AGREE_TERMS" || messageText.toLowerCase().includes("agree")) {
              // Atomically update state to prevent looping
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
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\n` +
                  `Please enter the Invitation Code provided by a fellow missionary, or tap below to join using Global Code: TCRP`,
                  globalInviteQuickReply
                );
                continue;
              }
            } else if (messageText === "DECLINE_TERMS") {
              await callSendAPI(senderPsid, `✕ 𝐓𝐄𝐑𝐌𝐒 𝐃𝐄𝐂𝐋𝐈𝐍𝐄𝐃\n\nParticipation in TCRP requires accepting our Terms of Service. Tap below when ready:`, termsQuickReplies);
              continue;
            } else {
              await callSendAPI(senderPsid, `Please tap "✓ Agree & Continue" below to proceed:`, termsQuickReplies);
              continue;
            }
          }

          // -------------------------------------------------------------
          // STEP 2: INVITATION CODE VALIDATION
          // -------------------------------------------------------------
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
                  await callSendAPI(senderPsid, `✕ 𝐆𝐋𝐎𝐁𝐀🇱 𝐋𝐈𝐌𝐈𝐓 𝐑𝐄𝐀𝐂𝐇𝐄𝐃\n\nThe Global Invitation Code TCRP has reached its maximum limit of 100 claims. Please enter a personal invitation code.`);
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
                  `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${inputCode})\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
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

          // -------------------------------------------------------------
          // STEP 3: TITLE & LAST NAME
          // -------------------------------------------------------------
          if (userState === "AWAITING_TITLE" || !userData.titleName) {
            const formatted = messageText.trim();
            if (formatted.toLowerCase().startsWith("elder ") || formatted.toLowerCase().startsWith("sister ")) {
              const formattedName = formatted.charAt(0).toUpperCase() + formatted.slice(1);
              await update(userRef, { titleName: formattedName, state: "AWAITING_EMAIL" });
              userData.titleName = formattedName;
              userData.state = "AWAITING_EMAIL";

              await callSendAPI(senderPsid, `Greetings, ${formattedName}!\n\nPlease enter your official missionary email ending in @missionary.org:`);
            } else {
              await callSendAPI(senderPsid, `⚠️ Format required: Start with "Elder" or "Sister" followed by your last name (e.g., Elder Smith or Sister Johnson):`);
            }
            continue;
          }

          // -------------------------------------------------------------
          // STEP 4: EMAIL & 6-DIGIT OTP VERIFICATION
          // -------------------------------------------------------------
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
                  `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `Registered: ${userData.titleName}\n` +
                  `◈ Welcome Bonus: +1 Point\n` +
                  `◈ Your Referral Code: ${personalRefCode}\n\n` +
                  `Rule: 1 Referral = 1 Point. Share your code to unlock custom gear!`,
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

          // -------------------------------------------------------------
          // STEP 5: VERIFIED DASHBOARD, CATALOG & ACTIONS
          // -------------------------------------------------------------
          const query = messageText.toLowerCase();

          if (query.includes("points") || query.includes("dashboard") || messageText === "PAYLOAD_CHECK_POINTS") {
            const dash = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Registered:  ${userData.titleName}\n` +
              `Email:       ${userData.email}\n` +
              `Balance:     ${userData.points || 0} Point(s)\n` +
              `Your Code:   ${userData.referralCode}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Rule: 1 Referral = 1 Point`;
            await callSendAPI(senderPsid, dash, defaultQuickReplies);
          }
          else if (query.includes("catalog") || query.includes("redeem") || messageText === "PAYLOAD_CATALOG") {
            await callSendAPI(senderPsid, "🎁 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐂𝐀𝐓𝐀𝐋𝐎𝐆\nSwipe right to view available rewards:");
            await sendCatalogCarousel(senderPsid);
          }
          else if (query.includes("promo") || query.includes("refer") || messageText === "PAYLOAD_PROMO") {
            const baseUrl = process.env.MESSENGER_LINK || "https://m.me/yourpage";
            const shareableLink = `${baseUrl}?ref=${userData.referralCode}`;

            const promo = `📢 𝐒𝐇𝐀𝐑𝐄 & 𝐄𝐀𝐑𝐍 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Share your referral link with fellow missionaries. When they register, BOTH of you earn +1 Reward Point!\n\n` +
              `🔗 𝐘𝐨𝐮𝐫 𝐑𝐞𝐟𝐞𝐫𝐫𝐚𝐥 𝐋𝐢𝐧𝐤:\n` +
              `${shareableLink}\n\n` +
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
                timestamp: new Date().toISOString()
              });

              const receipt = `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `   𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒  \n` +
                `       𝐑𝐄𝐃𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐑𝐄𝐂𝐄𝐈𝐏𝐓      \n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Registered:   ${userData.titleName}\n` +
                `Reference ID: ${refID}\n` +
                `Item Claimed: ${itemName}\n` +
                `Points Used:  ${cost} Point(s)\n` +
                `Balance:      ${newPoints} Point(s)\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Status: PENDING DISPATCH\n` +
                `Present this Reference ID to claim!`;

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
