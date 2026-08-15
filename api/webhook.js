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
  if (!process.env.FIREBASE_API_KEY || !process.env.FIREBASE_DATABASE_URL) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

function generateEncryptedRefID(psid, rewardName) {
  const raw = `${psid}-${rewardName}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `TX-${hash.substring(0, 8)}`;
}

async function sendBrevoEmail(recipientEmail, otpCode, titleName) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return false;

  const payload = {
    sender: { name: "Timeless Creations Rewards", email: "noreply@timelesscreations.com" },
    to: [{ email: recipientEmail, name: titleName || "Missionary" }],
    subject: "Your TCRP Verification Code",
    htmlContent: `<p>Verification Code: <b>${otpCode}</b></p>`
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function callSendAPI(senderPsid, responseText, quickReplies = null) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const requestBody = {
    messaging_type: "RESPONSE",
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

async function sendCatalogCarousel(senderPsid) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const requestBody = {
    messaging_type: "RESPONSE",
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
              image_url: process.env.IMG_KEYCHAIN || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Temple+Keychain",
              subtitle: "◈ Cost: 6 Points\nStainless steel temple outline.",
              buttons: [{ type: "postback", title: "Claim (6 Points)", payload: "CLAIM_KEYCHAIN" }]
            },
            {
              title: "✦ Nametag Keychain",
              image_url: process.env.IMG_NAMETAG || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Nametag+Keychain",
              subtitle: "◈ Cost: 24 Points\nOfficial missionary nametag replica.",
              buttons: [{ type: "postback", title: "Claim (24 Points)", payload: "CLAIM_NAMETAG" }]
            },
            {
              title: "✦ Salvation Kit",
              image_url: process.env.IMG_SALVATION || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Salvation+Kit",
              subtitle: "◈ Cost: 42 Points\nPlan of Salvation teaching set.",
              buttons: [{ type: "postback", title: "Claim (42 Points)", payload: "CLAIM_SALVATION" }]
            },
            {
              title: "✦ Scripture Case",
              image_url: process.env.IMG_SCRIPTURE || "https://dummyimage.com/600x600/0f172a/ffffff.png&text=Scripture+Case",
              subtitle: "◈ Cost: 60 Points\nLeather scripture tote case.",
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

const termsQuickReplies = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];

const globalInviteQuickReply = [
  { content_type: "text", title: "Use Global Code: TCRP", payload: "TCRP" }
];

// Unified Dashboard Quick Replies shown across all verified actions
const unifiedQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard & Share", payload: "PAYLOAD_UNIFIED_HUB" },
  { content_type: "text", title: "🎁 Catalog & Redeem", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "❓ FAQs", payload: "PAYLOAD_FAQS" }
];

function getFaqsText() {
  return `❓ 𝐅𝐑𝐄𝐐𝐔𝐄𝐍𝐓𝐋𝐘 𝐀𝐒𝐊𝐄𝐃 𝐐𝐔𝐄𝐒𝐓𝐈𝐎𝐍𝐒\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `𝟏. 𝐖𝐡𝐚𝐭 𝐢𝐬 𝐓𝐂𝐑𝐏?\nAn exclusive missionary rewards program by Timeless Creations.\n\n` +
    `𝟐. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐞𝐚𝐫𝐧 𝐩𝐨𝐢𝐧𝐭𝐬?\n• +1 Welcome Point on signup.\n• +1 Point per verified referral.\n\n` +
    `𝟑. 𝐖𝐡𝐨 𝐜𝐚𝐧 𝐣𝐨𝐢𝐧?\nActive missionaries with a valid @missionary.org email address.\n\n` +
    `𝟒. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐫𝐞𝐝𝐞𝐞𝐦?\nSelect items in the Catalog to get your unique Reference ID.\n\n` +
    `𝟓. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐬𝐡𝐚𝐫𝐞?\nUse your personal link from your Dashboard hub.`;
}

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
          try {
            const senderPsid = event.sender?.id;
            if (!senderPsid) continue;

            const rawText = event.message?.text?.trim() || "";
            const quickReplyPayload = event.message?.quick_reply?.payload || "";
            const postbackPayload = event.postback?.payload || "";
            const mmeReferral = event.postback?.referral?.ref || event.referral?.ref || "";

            let messageText = quickReplyPayload || postbackPayload || rawText;
            if (!messageText && !mmeReferral) continue;

            const userRef = ref(db, `users/${senderPsid}`);
            const snapshot = await get(userRef);

            // -------------------------------------------------------------
            // RATE LIMITING PROTECTION (Max 5 clicks per 10 seconds)
            // -------------------------------------------------------------
            if (snapshot.exists()) {
              const uData = snapshot.val();
              const now = Date.now();
              const clickWindow = uData.clickWindowStart || now;
              const clickCount = uData.clickCount || 0;

              if (now - clickWindow < 10000) {
                if (clickCount >= 5) {
                  await callSendAPI(senderPsid, "⚠️ You are clicking too fast! Please wait a few seconds before trying again.");
                  continue;
                }
                await update(userRef, { clickCount: clickCount + 1 });
              } else {
                await update(userRef, { clickWindowStart: now, clickCount: 1 });
              }
            }

            if (mmeReferral) {
              await update(userRef, { pendingRefParam: mmeReferral.toUpperCase() });
            }

            // ADMIN SECRET
            if (messageText.startsWith('/Admin 0726')) {
              await update(userRef, { isAdmin: true });
              await callSendAPI(senderPsid, "👑 𝐀𝐃𝐌𝐈𝐍 𝐀𝐂𝐂𝐄𝐒𝐒 𝐆𝐑𝐀𝐍𝐓𝐄𝐃", unifiedQuickReplies);
              continue;
            }

            // RESET OR NEW USER
            const isGetStarted = (postbackPayload === "GET_STARTED" || postbackPayload === "GET_STARTED_PAYLOAD" || messageText.toLowerCase() === "get started");

            if (isGetStarted || !snapshot.exists()) {
              await set(userRef, {
                psid: senderPsid,
                state: "AWAITING_TERMS",
                termsAccepted: false,
                invited: false,
                verified: false,
                points: 0,
                clickCount: 1,
                clickWindowStart: Date.now(),
                createdAt: new Date().toISOString()
              });

              const welcomeMsg = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Welcome to TCRP — custom missionary gear.\n\n` +
                `📜 𝐓𝐞𝐫𝐦𝐬 & 𝐏𝐫𝐢𝐯𝐚𝐜𝐲:\n` +
                `By selecting "Agree & Continue", you accept our Terms of Service.\n\n` +
                `Please select an option below:`;

              await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
              continue;
            }

            let userData = snapshot.val();
            let userState = userData.state || "AWAITING_TERMS";

            // FAQS POSTBACK
            if (messageText === "PAYLOAD_FAQS" || messageText.toLowerCase() === "faq") {
              await callSendAPI(senderPsid, getFaqsText(), unifiedQuickReplies);
              continue;
            }

            // -------------------------------------------------------------
            // STEP 1: TERMS
            // -------------------------------------------------------------
            if (userState === "AWAITING_TERMS" || !userData.termsAccepted) {
              if (messageText === "AGREE_TERMS" || messageText.toLowerCase().includes("agree")) {
                await update(userRef, { termsAccepted: true, state: "AWAITING_INVITE" });
                
                await callSendAPI(
                  senderPsid,
                  `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\n` +
                  `Please enter an Invitation Code provided by a fellow missionary, or tap below to join using Global Code: TCRP`,
                  globalInviteQuickReply
                );
                continue;
              } else if (messageText === "DECLINE_TERMS") {
                await callSendAPI(senderPsid, `✕ Terms declined. Tap below when ready:`, termsQuickReplies);
                continue;
              } else {
                await callSendAPI(senderPsid, `Please tap "✓ Agree & Continue" below:`, termsQuickReplies);
                continue;
              }
            }

            // -------------------------------------------------------------
            // STEP 2: INVITATION CODE
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
                    await callSendAPI(senderPsid, `✕ Global code limit reached. Please enter a personal code.`);
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
                  await update(userRef, { invited: true, usedInviteCode: inputCode, state: "AWAITING_TITLE" });
                  
                  if (referrerPsid && referrerPsid !== senderPsid) {
                    const referrerSnap = await get(ref(db, `users/${referrerPsid}`));
                    if (referrerSnap.exists()) {
                      await update(ref(db, `users/${referrerPsid}`), { points: (referrerSnap.val().points || 0) + 1 });
                      await callSendAPI(referrerPsid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\nYou earned +1 Point!`);
                    }
                  }

                  await callSendAPI(senderPsid, `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${inputCode})\n\nPlease enter your Missionary Title and Last Name (e.g., Elder Smith):`);
                } else {
                  await callSendAPI(senderPsid, `✕ Invalid code. Enter a valid code or tap below:`, globalInviteQuickReply);
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

                await callSendAPI(senderPsid, `Greetings, ${formattedName}!\n\nPlease enter your official email ending in @missionary.org:`);
              } else {
                await callSendAPI(senderPsid, `⚠️ Please start with "Elder" or "Sister" followed by your last name:`);
              }
              continue;
            }

            // -------------------------------------------------------------
            // STEP 4: EMAIL & OTP
            // -------------------------------------------------------------
            if (userState === "AWAITING_EMAIL" || userState === "AWAITING_OTP" || !userData.verified) {
              const normalizedInput = messageText.trim().toLowerCase();

              if (/^\d{6}$/.test(normalizedInput)) {
                if (userData.otpCode && normalizedInput === userData.otpCode.toString()) {
                  const personalRefCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);

                  await update(userRef, {
                    verified: true,
                    referralCode: personalRefCode,
                    points: (userData.points || 0) + 1,
                    otpCode: null,
                    state: "VERIFIED"
                  });

                  await set(ref(db, `referralCodes/${personalRefCode}`), senderPsid);

                  const welcomeHub = `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Registered: ${userData.titleName}\n` +
                    `Balance: ${userData.points || 1} Point(s)\n` +
                    `Your Code: ${personalRefCode}\n\n` +
                    `🔗 Your Link: https://m.me/timeless.creations.06?ref=${personalRefCode}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Rule: 1 Referral = 1 Point`;

                  await callSendAPI(senderPsid, welcomeHub, unifiedQuickReplies);
                } else {
                  await callSendAPI(senderPsid, "✕ Incorrect code. Please check your inbox.");
                }
              } else if (normalizedInput.endsWith("@missionary.org")) {
                const passCode = Math.floor(100000 + Math.random() * 900000).toString();
                await update(userRef, { email: normalizedInput, otpCode: passCode, state: "AWAITING_OTP" });

                const emailSent = await sendBrevoEmail(normalizedInput, passCode, userData.titleName);
                if (emailSent) {
                  await callSendAPI(senderPsid, `📧 Verification code sent to ${normalizedInput}! Reply here with the 6-digit code.`);
                } else {
                  await callSendAPI(senderPsid, `📧 Verification Code: ${passCode}\nReply with this 6-digit code.`);
                }
              } else {
                await callSendAPI(senderPsid, "⚠️ Please enter a valid email ending in @missionary.org:");
              }
              continue;
            }

            // -------------------------------------------------------------
            // STEP 5: UNIFIED DASHBOARD & CATALOG (SHOWS ALL AT ONCE)
            // -------------------------------------------------------------
            const query = messageText.toLowerCase();

            if (query.includes("dashboard") || messageText === "PAYLOAD_UNIFIED_HUB") {
              const baseUrl = process.env.MESSENGER_LINK || "https://m.me/timeless.creations.06";
              const shareableLink = `${baseUrl}?ref=${userData.referralCode}`;

              const unifiedHub = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃 & 𝐇𝐔𝐁\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Registered: ${userData.titleName}\n` +
                `✉️ Email:      ${userData.email}\n` +
                `💰 Balance:    ${userData.points || 0} Point(s)\n` +
                `🔑 Code:       ${userData.referralCode}\n\n` +
                `📢 𝐒𝐇𝐀𝐑𝐄 & 𝐄𝐀𝐑𝐍:\n` +
                `${shareableLink}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Rule: 1 Referral = 1 Point. Tap below to browse catalog or get help:`;

              await callSendAPI(senderPsid, unifiedHub, unifiedQuickReplies);
            }
            else if (query.includes("catalog") || query.includes("redeem") || messageText === "PAYLOAD_CATALOG") {
              await callSendAPI(senderPsid, "🎁 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐂𝐀𝐓𝐀𝐋𝐎𝐆\nSwipe right to view and claim rewards:", unifiedQuickReplies);
              await sendCatalogCarousel(senderPsid);
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
                await callSendAPI(senderPsid, `✕ 𝐈𝐍𝐒𝐔𝐅𝐅𝐈𝐂𝐈𝐄𝐍𝐓 𝐏𝐎𝐈𝐍𝐓𝐒\n\n${itemName} requires ${cost} points. You have ${userPoints} point(s).`, unifiedQuickReplies);
              } else {
                const newPoints = userPoints - cost;
                const refID = generateEncryptedRefID(senderPsid, itemName);

                await update(userRef, { points: newPoints });

                await set(ref(db, `transactions/${refID}`), {
                  psid: senderPsid,
                  name: userData.titleName,
                  item: itemName,
                  pointsSpent: cost,
                  status: "PENDING",
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
                  `Status: ⏳ PENDING DISPATCH\n` +
                  `Tap below to connect with us on Messenger to finalize delivery!`;

                const fulfillmentUrl = `https://m.me/timeless.creations.06?ref=CLAIM_${refID}`;
                const claimButtons = [{ type: "web_url", url: fulfillmentUrl, title: "💬 Chat to Claim" }];

                await sendButtonMessage(senderPsid, receipt, claimButtons);
              }
            }
            else {
              await callSendAPI(senderPsid, `Greetings, ${userData.titleName}! Choose an option below:`, unifiedQuickReplies);
            }

          } catch (eventErr) {
            console.error("❌ Error processing event:", eventErr);
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
};
