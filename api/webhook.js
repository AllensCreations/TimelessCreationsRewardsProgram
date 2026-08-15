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
    console.error("❌ CRITICAL: Missing FIREBASE_API_KEY or FIREBASE_DATABASE_URL");
    return null;
  }
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
    htmlContent: `<p>Verification code: <b>${otpCode}</b></p>`
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
  if (!PAGE_ACCESS_TOKEN) {
    console.error("❌ CRITICAL: Missing PAGE_ACCESS_TOKEN");
    return;
  }

  const requestBody = {
    messaging_type: "RESPONSE",
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
    console.log("📤 Meta API Response:", JSON.stringify(data));
  } catch (err) {
    console.error('❌ Meta Fetch Error:', err);
  }
}

const termsQuickReplies = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];

const defaultQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard", payload: "PAYLOAD_CHECK_POINTS" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "📢 Refer a Friend", payload: "PAYLOAD_PROMO" }
];

// Helper to reliably parse body on serverless invocations
async function parseBody(req) {
  if (req.body && Object.keys(req.body).length > 0) return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
  });
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
    const body = await parseBody(req);
    console.log("📥 Inbound Webhook Payload:", JSON.stringify(body));

    if (body.object === 'page' && Array.isArray(body.entry)) {
      const app = initFirebase();
      if (!app) {
        console.error("❌ Firebase failed to initialize. Check Env Vars.");
        return res.status(200).send('EVENT_RECEIVED');
      }
      const db = getDatabase(app);

      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        for (const event of entry.messaging) {
          const senderPsid = event.sender?.id;
          if (!senderPsid) continue;

          const rawText = event.message?.text?.trim() || "";
          const quickReplyPayload = event.message?.quick_reply?.payload || "";
          const postbackPayload = event.postback?.payload || "";
          const messageText = quickReplyPayload || postbackPayload || rawText;

          console.log(`👤 Processing PSID: ${senderPsid} | Message: "${messageText}"`);

          const userRef = ref(db, `users/${senderPsid}`);
          const snapshot = await get(userRef);

          if (postbackPayload === "GET_STARTED_PAYLOAD" || messageText.toLowerCase() === "get started" || !snapshot.exists()) {
            if (!snapshot.exists()) {
              await set(userRef, {
                psid: senderPsid,
                termsAccepted: false,
                invited: false,
                verified: false,
                points: 0,
                createdAt: new Date().toISOString()
              });
            }

            const welcomeMsg = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Welcome to TCRP — custom gear for missionaries.\n\n` +
              `📜 𝐓𝐞𝐫𝐦𝐬 & 𝐏𝐫𝐢𝐯𝐚𝐜𝐲:\n` +
              `By selecting "Agree & Continue", you accept our Terms of Service.\n\n` +
              `Please select an option below:`;

            await callSendAPI(senderPsid, welcomeMsg, termsQuickReplies);
            continue;
          }

          let userData = snapshot.val();

          if (!userData.termsAccepted) {
            if (messageText === 'AGREE_TERMS' || messageText.toLowerCase().includes('agree')) {
              await update(userRef, { termsAccepted: true });
              await callSendAPI(senderPsid, `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n\nPlease enter your Invitation Code (or type TCRP):`);
            } else {
              await callSendAPI(senderPsid, `Please tap "✓ Agree & Continue" below to proceed:`, termsQuickReplies);
            }
            continue;
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
};
