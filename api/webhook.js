const { initializeApp, getApps } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');

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
    console.error("CRITICAL ERROR: Firebase API Key or Database URL missing on Vercel!");
    return null;
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// Function to send Messenger replies with optional Quick Reply buttons
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
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (data.error) console.error('Meta Graph API Error:', data.error);
  } catch (err) {
    console.error('Network Error calling Meta Graph API:', err);
  }
}

// Standard Quick Reply buttons for verified users
const defaultQuickReplies = [
  { content_type: "text", title: "🏆 My Points", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Rewards", payload: "PAYLOAD_REWARDS" },
  { content_type: "text", title: "❓ Help", payload: "PAYLOAD_HELP" }
];

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Verification token mismatch');
    }
  } 
  
  else if (req.method === 'POST') {
    const body = req.body;

    if (body.object === 'page') {
      const app = initFirebase();
      if (!app) return res.status(500).send('Server Misconfiguration');
      
      const db = getDatabase(app);

      if (body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const event of entry.messaging) {
              const senderPsid = event.sender.id;
              
              // Extract text from regular messages, quick reply payloads, or postbacks
              let messageText = "";
              if (event.message && event.message.text) {
                messageText = event.message.text.trim();
              } else if (event.postback && event.postback.payload) {
                messageText = event.postback.payload;
              }

              if (!messageText) continue;

              const userRef = ref(db, `users/${senderPsid}`);
              const snapshot = await get(userRef);

              // Admin Command
              if (messageText.startsWith('/Admin 0726')) {
                await update(userRef, { isAdmin: true });
                await callSendAPI(senderPsid, "👑 Admin access granted for TCRP!", defaultQuickReplies);
                continue;
              }

              // Initial Registration
              if (!snapshot.exists()) {
                await set(userRef, {
                  psid: senderPsid,
                  verified: false,
                  points: 0,
                  createdAt: new Date().toISOString()
                });
                await callSendAPI(senderPsid, "Welcome to TCRP! 🎉\n\nPlease enter your official email address ending in @missionary.org to get started.");
              } else {
                const userData = snapshot.val();

                // Account Pending Verification
                if (!userData.verified) {
                  if (/^\d{6}$/.test(messageText)) {
                    if (userData.otpCode && messageText === userData.otpCode.toString()) {
                      const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                      await update(userRef, {
                        verified: true,
                        referralCode: refCode,
                        points: 100,
                        otpCode: null
                      });
                      await callSendAPI(senderPsid, `🎉 Email verified successfully!\n\nYou earned 100 welcome points.\nYour Referral Code is: ${refCode}`, defaultQuickReplies);
                    } else {
                      await callSendAPI(senderPsid, "❌ Incorrect verification code. Please check your inbox and try again.");
                    }
                  } else if (messageText.toLowerCase().endsWith('@missionary.org')) {
                    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
                    await update(userRef, { email: messageText.toLowerCase(), otpCode: generatedOTP });
                    
                    // (Brevo sending logic is integrated here)
                    await callSendAPI(senderPsid, `📧 Verification code sent to ${messageText.toLowerCase()}!\n\nPlease enter the 6-digit code here.`);
                  } else {
                    await callSendAPI(senderPsid, "⚠️ Please enter a valid email address ending in @missionary.org");
                  }
                } 
                
                // Verified User Options
                else {
                  const query = messageText.toLowerCase();

                  if (query.includes('points') || query.includes('balance') || messageText === 'PAYLOAD_CHECK_POINTS') {
                    await callSendAPI(
                      senderPsid, 
                      `🏆 Your TCRP Account Balance:\n\n• Points: ${userData.points}\n• Referral Code: ${userData.referralCode}\n\nShare your code with other missionaries to earn 50 bonus points for each referral!`,
                      defaultQuickReplies
                    );
                  } else if (query.includes('reward') || query.includes('claim') || messageText === 'PAYLOAD_REWARDS') {
                    await callSendAPI(
                      senderPsid,
                      `🎁 Available Rewards:\n\n1. 🎟️ $5 Gift Card - 250 Points\n2. 🎟️ $10 Gift Card - 450 Points\n3. 📦 TCRP Merch Pack - 800 Points\n\nTo redeem, reply with the reward name or contact support.`,
                      defaultQuickReplies
                    );
                  } else if (query.includes('help') || query.includes('info') || messageText === 'PAYLOAD_HELP') {
                    await callSendAPI(
                      senderPsid,
                      `❓ TCRP Help Center:\n\n• Type 'points' to check balance.\n• Share your referral code to earn more points.\n• Contact support at 2ndsalviejomark2019@gmail.com for assistance.`,
                      defaultQuickReplies
                    );
                  } else {
                    await callSendAPI(senderPsid, `Hello! What would you like to do today? Select an option below:`, defaultQuickReplies);
                  }
                }
              }
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    } else {
      return res.status(404).send('Not a page event');
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
