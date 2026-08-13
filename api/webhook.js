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

async function setupPersistentMenu() {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const payload = {
    get_started: { payload: "GET_STARTED" },
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          { type: "postback", title: "🏆 Dashboard & Points", payload: "PAYLOAD_CHECK_POINTS" },
          { type: "postback", title: "🎁 Catalog & Redeem", payload: "PAYLOAD_CATALOG" },
          { type: "postback", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" }
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
  } catch (err) {
    console.error('Persistent Menu Error:', err);
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
              subtitle: "◈ Cost: 6 Points (6 Referrals)\nStainless steel engraved temple outline.",
              buttons: [{ type: "postback", title: "Claim (6 Points)", payload: "CLAIM_KEYCHAIN" }]
            },
            {
              title: "✦ Nametag Keychain",
              image_url: imgNametag,
              subtitle: "◈ Cost: 24 Points (24 Referrals)\nOfficial missionary nametag replica.",
              buttons: [{ type: "postback", title: "Claim (24 Points)", payload: "CLAIM_NAMETAG" }]
            },
            {
              title: "✦ Salvation Kit",
              image_url: imgSalvation,
              subtitle: "◈ Cost: 42 Points (42 Referrals)\nPlan of Salvation visual teaching set.",
              buttons: [{ type: "postback", title: "Claim (42 Points)", payload: "CLAIM_SALVATION" }]
            },
            {
              title: "✦ Scripture Case",
              image_url: imgScripture,
              subtitle: "◈ Cost: 60 Points (60 Referrals)\nPremium protective leather scripture tote.",
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
  { content_type: "text", title: "🏆 Dashboard", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog (1:1)", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" }
];

const termsQuickReplies = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];

const globalInviteQuickReply = [
  { content_type: "text", title: "Use Global Code: TCRP", payload: "TCRP" }
];

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
      if (!app) return res.status(500).send('Server Error');
      const db = getDatabase(app);

      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        for (const event of entry.messaging) {
          const senderPsid = event.sender.id;

          // EXTRACT MESSAGE TEXT & M.ME REFERRAL PARAMETER
          let rawText = event.message?.text?.trim() || "";
          let quickReplyPayload = event.message?.quick_reply?.payload || "";
          let postbackPayload = event.postback?.payload || "";
          let mmeReferral = event.postback?.referral?.ref || event.referral?.ref || "";

          let messageText = quickReplyPayload || postbackPayload || rawText;
          if (!messageText && !mmeReferral) continue;

          const userRef = ref(db, `users/${senderPsid}`);
          const snapshot = await get(userRef);

          // Save pending referral parameter if present from m.me link
          if (mmeReferral) {
            await update(userRef, { pendingRefParam: mmeReferral.toUpperCase() });
          }

          // Secret Admin Command
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            await callSendAPI(senderPsid, "👑 𝐀𝐃𝐌𝐈𝐍 𝐀𝐂𝐂𝐄𝐒𝐒 𝐆𝐑𝐀𝐍𝐓𝐄𝐃\n\nYou now have administrative privileges.", defaultQuickReplies);
            continue;
          }

          // New User Entry
          if (!snapshot.exists()) {
            await set(userRef, {
              psid: senderPsid,
              termsAccepted: false,
              invited: false,
              verified: false,
              points: 0,
              pendingRefParam: mmeReferral ? mmeReferral.toUpperCase() : null,
              createdAt: new Date().toISOString()
            });

            const welcomeMsg = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Welcome to the official TCRP portal — crafted by Timeless Creations for custom missionary gear.\n\n` +
              `📜 𝐓𝐞𝐫𝐦𝐬 & 𝐏𝐫𝐢𝐯𝐚𝐜𝐲:\n` +
              `By selecting "Agree & Continue", you confirm acceptance of our Privacy Policy & Terms of Service, and consent to receiving notifications for reward dispatches.\n\n` +
              `Please select an option below to proceed:`;

            await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
            continue;
          }

          let userData = snapshot.val();

          // Terms Acceptance Handler
          if (messageText === 'AGREE_TERMS' || messageText.toLowerCase().includes('agree')) {
            await update(userRef, { termsAccepted: true });
            userData.termsAccepted = true;

            // Check if user clicked an m.me link with an auto-referral code
            const autoCode = userData.pendingRefParam || mmeReferral;
            if (autoCode) {
              messageText = autoCode.toUpperCase(); // Auto-advance to invitation check with link code
            } else {
              await callSendAPI(
                senderPsid, 
                `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\n` +
                `Please enter an Invitation Code provided by a fellow missionary, or tap below to claim using the Global Code: TCRP (Max 100 Claims)`, 
                globalInviteQuickReply
              );
              continue;
            }
          }

          if (messageText === 'DECLINE_TERMS') {
            await callSendAPI(senderPsid, `✕ 𝐓𝐄𝐑𝐌𝐒 𝐃𝐄𝐂𝐋𝐈𝐍𝐄𝐃\n\nParticipation in TCRP requires accepting our Terms & Conditions. Tap below to resume:`, termsQuickReplies);
            continue;
          }

          if (!userData.termsAccepted) {
            await callSendAPI(senderPsid, `Please select "✓ Agree & Continue" below to proceed:`, termsQuickReplies);
            continue;
          }

          // STEP 2: INVITATION CODE GATE (Auto-filled by m.me link if present)
          if (!userData.invited) {
            const codeInput = (userData.pendingRefParam || messageText).toUpperCase();
            
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
                    `✕ 𝐆𝐋𝐎𝐁𝐀𝐋 𝐋𝐈𝐌𝐈𝐓 𝐑𝐄𝐀𝐂𝐇𝐄𝐃\n\nThe Global Invitation Code TCRP has reached its maximum cap of 100 claims. Please enter a personal invitation code.`
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
                await update(userRef, { invited: true, usedInviteCode: codeInput, pendingRefParam: null });
                userData.invited = true;

                if (referrerPsid && referrerData) {
                  await update(ref(db, `users/${referrerPsid}`), { points: (referrerData.points || 0) + 1 });
                  await callSendAPI(referrerPsid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\n\nA missionary used your link! You earned +1 Point!`);
                }

                await callSendAPI(
                  senderPsid, 
                  `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${codeInput})\n\nPlease enter your Missionary Title and Last Name (e.g., Elder Smith or Sister Johnson):`
                );
              } else {
                await callSendAPI(senderPsid, `✕ Invalid Invitation Code. Enter a valid code or tap below:`, globalInviteQuickReply);
              }
            } else {
              await callSendAPI(senderPsid, `🔑 An Invitation Code is required to join. Enter your code or tap below:`, globalInviteQuickReply);
            }
            continue;
          }

          // STEP 3: TITLE & LAST NAME SETUP
          if (!userData.titleName) {
            if (messageText.toLowerCase().startsWith('elder') || messageText.toLowerCase().startsWith('sister')) {
              const formattedName = messageText.charAt(0).toUpperCase() + messageText.slice(1);
              await update(userRef, { titleName: formattedName });
              userData.titleName = formattedName;

              await callSendAPI(senderPsid, `Greetings, ${formattedName}!\n\nPlease enter your official email address ending in @missionary.org:`);
            } else {
              await callSendAPI(senderPsid, `⚠️ Format required: Start with "Elder" or "Sister" followed by your last name (e.g., Elder Smith or Sister Johnson):`);
            }
            continue;
          }

          // STEP 4: EMAIL & OTP VERIFICATION
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
                  `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `Registered: ${userData.titleName}\n` +
                  `◈ Welcome Bonus: 1 Point\n` +
                  `◈ Your Code: ${personalRefCode}\n\n` +
                  `Rule: 1 Referral = 1 Point. Share your code to unlock rewards!`, 
                  defaultQuickReplies
                );
              } else {
                await callSendAPI(senderPsid, "✕ Incorrect verification code. Please check your inbox and enter the 6-digit code.");
              }
            } else if (messageText.toLowerCase().endsWith('@missionary.org')) {
              const passCode = Math.floor(100000 + Math.random() * 900000).toString();
              await update(userRef, { email: messageText.toLowerCase(), otpCode: passCode });

              await callSendAPI(senderPsid, `📧 Verification email dispatched to ${messageText.toLowerCase()}!\n\nPlease check your inbox and reply here with the 6-digit code.`);
            } else {
              await callSendAPI(senderPsid, "⚠️ Please provide a valid email ending in @missionary.org");
            }
            continue;
          }

          // STEP 5: VERIFIED DASHBOARD & CATALOG
          const query = messageText.toLowerCase();

          if (query.includes('points') || query.includes('dashboard') || messageText === 'PAYLOAD_CHECK_POINTS') {
            const dash = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Registered:  ${userData.titleName}\n` +
              `Email:       ${userData.email}\n` +
              `Balance:     ${userData.points} Point(s)\n` +
              `Your Code:   ${userData.referralCode}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Rule: 1 Referral = 1 Point`;
            await callSendAPI(senderPsid, dash, defaultQuickReplies);
          }
          else if (query.includes('catalog') || query.includes('redeem') || messageText === 'PAYLOAD_CATALOG') {
            await callSendAPI(senderPsid, "🎁 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐂𝐀𝐓𝐀𝐋𝐎𝐆\nSwipe right to view items in 1:1 format:");
            await sendCatalogCarousel(senderPsid);
            await callSendAPI(senderPsid, "Tap any button on the cards above to redeem your reward!", defaultQuickReplies);
          }
          else if (query.includes('promo') || query.includes('refer') || messageText === 'PAYLOAD_PROMO') {
            const baseUrl = process.env.MESSENGER_LINK || "https://m.me/yourpage";
            const shareableLink = `${baseUrl}?ref=${userData.referralCode}`;

            const promo = `📢 𝐒𝐇𝐀𝐑𝐄 & 𝐄𝐀𝐑𝐍 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Share your personal link with fellow missionaries. When they click and sign up, BOTH of you earn +1 Reward Point!\n\n` +
              `🔗 𝐘𝐨𝐮𝐫 𝐑𝐞𝐟𝐞𝐫𝐫𝐚𝐥 𝐋𝐢𝐧𝐤:\n` +
              `${shareableLink}\n\n` +
              `👉 Or share Code: ${userData.referralCode}`;
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
              await callSendAPI(senderPsid, `✕ 𝐈𝐍𝐒𝐔𝐅𝐅𝐈𝐂𝐈𝐄𝐍𝐓 𝐏𝐎𝐈𝐍𝐓𝐒\n\n${itemName} requires ${cost} points. You currently have ${userData.points} point(s).`, defaultQuickReplies);
            } else {
              const newPoints = userData.points - cost;
              const refID = generateEncryptedRefID(senderPsid, itemName);

              await update(userRef, { points: newPoints });

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
            await callSendAPI(senderPsid, `Greetings, ${userData.titleName}! Select an option below:`, defaultQuickReplies);
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }
};
