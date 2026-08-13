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

// Quick Reply Buttons
const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Points & Code", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "🔑 Redeem Item", payload: "PAYLOAD_REDEEM" },
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

          // Admin Secret Trigger
          if (messageText.startsWith('/Admin 0726')) {
            await update(userRef, { isAdmin: true });
            await callSendAPI(senderPsid, "👑 Admin privileges activated for TCRP!", defaultQuickReplies);
            continue;
          }

          if (!snapshot.exists()) {
            await set(userRef, {
              psid: senderPsid,
              verified: false,
              points: 0,
              createdAt: new Date().toISOString()
            });
            await callSendAPI(senderPsid, "Welcome to TCRP! 🎉\n\nPlease enter your official email ending in @missionary.org to generate your verification key.");
          } else {
            const userData = snapshot.val();

            // Unverified Flow
            if (!userData.verified) {
              if (/^\d{6}$/.test(messageText)) {
                if (userData.otpCode && messageText === userData.otpCode.toString()) {
                  const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                  await update(userRef, {
                    verified: true,
                    referralCode: refCode,
                    points: 1, // 1 starting point = 1 referral
                    otpCode: null
                  });
                  await callSendAPI(senderPsid, `🎉 Verified!\n\n• Welcome Bonus: 1 Point\n• Referral Code: ${refCode}\n\nShare your code! 1 Referral = 1 Point.`, defaultQuickReplies);
                } else {
                  await callSendAPI(senderPsid, "❌ Invalid passcode. Enter the 6-digit code shown above.");
                }
              } else if (messageText.toLowerCase().endsWith('@missionary.org')) {
                const passCode = Math.floor(100000 + Math.random() * 900000).toString();
                await update(userRef, { email: messageText.toLowerCase(), otpCode: passCode });
                await callSendAPI(senderPsid, `🔑 Your Verification Passcode is: ${passCode}\n\nPlease reply with this 6-digit code to complete setup.`);
              } else {
                await callSendAPI(senderPsid, "⚠️ Please provide a valid @missionary.org email address.");
              }
            } 
            
            // Verified User Flow
            else {
              const query = messageText.toLowerCase();

              // Handle Referral Code Input
              if (messageText.startsWith("TCRP-")) {
                if (messageText.toUpperCase() === userData.referralCode) {
                  await callSendAPI(senderPsid, "⚠️ You cannot use your own referral code!", defaultQuickReplies);
                } else if (userData.usedReferral) {
                  await callSendAPI(senderPsid, "⚠️ You have already redeemed a referral code.", defaultQuickReplies);
                } else {
                  // Find referrer in Realtime Database
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
                    // 1 Point = 1 Referral Rule
                    await update(ref(db, `users/${referrerPsid}`), { points: (referrerData.points || 0) + 1 });
                    await update(userRef, { points: (userData.points || 0) + 1, usedReferral: true });

                    await callSendAPI(referrerPsid, `🎉 Someone used your referral code! You earned +1 Point!`);
                    await callSendAPI(senderPsid, `✅ Referral applied! You and your referrer both earned +1 Point!`, defaultQuickReplies);
                  } else {
                    await callSendAPI(senderPsid, "❌ Referral code not found. Please double-check and try again.", defaultQuickReplies);
                  }
                }
              }
              // Check Points Balance
              else if (query.includes('points') || messageText === 'PAYLOAD_CHECK_POINTS') {
                await callSendAPI(senderPsid, `🏆 Your Balance:\n\n• Current Points: ${userData.points}\n• Your Code: ${userData.referralCode}\n\nRule: 1 Point = 1 Referral.`, defaultQuickReplies);
              }
              // Catalog View
              else if (query.includes('catalog') || messageText === 'PAYLOAD_CATALOG') {
                const catalog = "🎁 Rewards Catalog (1 Point = 1 Referral):\n\n" +
                  "1. 🔑 Temple Keychain — 6 Points\n" +
                  "2. 🏷️ Nametag Keychain — 24 Points\n" +
                  "3. 📦 Salvation Kit — 42 Points\n" +
                  "4. 📖 Scripture Case — 60 Points\n\n" +
                  "Tap 'Redeem Item' below to claim your reward!";
                await callSendAPI(senderPsid, catalog, defaultQuickReplies);
              }
              // Claim Reward Menu
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
                  await callSendAPI(senderPsid, `❌ Insufficient Points!\n\n${itemName} requires ${cost} points. You currently have ${userData.points} points.`, defaultQuickReplies);
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
                await callSendAPI(senderPsid, `Hello! Choose an option from below:`, defaultQuickReplies);
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
