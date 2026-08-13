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

// Function to send OTP Email via Brevo API
async function sendBrevoOTP(recipientEmail, otpCode) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SENDER_EMAIL = process.env.SENDER_EMAIL || "no-reply@allenscreations.com";

  if (!BREVO_API_KEY) {
    console.error("CRITICAL ERROR: BREVO_API_KEY is missing on Vercel!");
    return false;
  }

  const payload = {
    sender: { name: "Timeless Creations Rewards", email: SENDER_EMAIL },
    to: [{ email: recipientEmail }],
    subject: `Your TCRP Verification Code: ${otpCode}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #0056b3; text-align: center;">TCRP Email Verification</h2>
          <p>Hello Elder / Sister,</p>
          <p>Thank you for registering with <strong>TimelessCreationsRewardsProgram</strong>. Your 6-digit verification code is:</p>
          <div style="text-align: center; margin: 25px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background: #eff6ff; padding: 10px 20px; border-radius: 6px; border: 1px dashed #2563eb;">${otpCode}</span>
          </div>
          <p>Please enter this code in your Messenger chat to complete your registration and claim your 100 welcome points.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777; text-align: center;">If you did not request this code, please ignore this email.</p>
        </div>
      </div>
    `
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

    const data = await res.json();
    if (res.ok) {
      console.log('Brevo OTP email sent successfully:', data.messageId);
      return true;
    } else {
      console.error('Brevo API Error:', data);
      return false;
    }
  } catch (err) {
    console.error('Network Error calling Brevo API:', err);
    return false;
  }
}

async function callSendAPI(senderPsid, responseText) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) {
    console.error("CRITICAL ERROR: PAGE_ACCESS_TOKEN is missing on Vercel!");
    return;
  }

  const requestBody = {
    recipient: { id: senderPsid },
    message: { text: responseText }
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (data.error) {
      console.error('Meta Graph API Error:', data.error);
    }
  } catch (err) {
    console.error('Network Error calling Meta Graph API:', err);
  }
}

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
      if (!app) {
        return res.status(500).send('Server Misconfiguration: Firebase keys missing');
      }
      
      const db = getDatabase(app);

      if (body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const event of entry.messaging) {
              const senderPsid = event.sender.id;
              
              if (event.message && event.message.text) {
                const messageText = event.message.text.trim();
                const userRef = ref(db, `users/${senderPsid}`);
                const snapshot = await get(userRef);

                // Admin Command
                if (messageText.startsWith('/Admin 0726')) {
                  await update(userRef, { isAdmin: true });
                  await callSendAPI(senderPsid, "👑 Admin access granted for TCRP!");
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
                  await callSendAPI(senderPsid, "Welcome to TCRP! 🎉\n\nPlease enter your official email address ending in @missionary.org to request your verification code.");
                } else {
                  const userData = snapshot.val();

                  // Account Pending Verification
                  if (!userData.verified) {
                    // Check if input is 6-digit OTP code
                    if (/^\d{6}$/.test(messageText)) {
                      if (userData.otpCode && messageText === userData.otpCode.toString()) {
                        const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                        await update(userRef, {
                          verified: true,
                          referralCode: refCode,
                          points: 100,
                          otpCode: null // Clear OTP after use
                        });
                        await callSendAPI(senderPsid, `🎉 Email verified successfully!\n\nYou earned 100 welcome points.\nYour Referral Code is: ${refCode}\n\nShare this code with fellow missionaries to earn extra rewards!`);
                      } else {
                        await callSendAPI(senderPsid, "❌ Incorrect verification code. Please check your inbox and try again.");
                      }
                    } 
                    // Check if input is a valid @missionary.org email
                    else if (messageText.toLowerCase().endsWith('@missionary.org')) {
                      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
                      
                      await update(userRef, {
                        email: messageText.toLowerCase(),
                        otpCode: generatedOTP
                      });

                      const emailSent = await sendBrevoOTP(messageText.toLowerCase(), generatedOTP);

                      if (emailSent) {
                        await callSendAPI(senderPsid, `📧 Verification code sent to ${messageText.toLowerCase()}!\n\nPlease check your inbox and reply here with the 6-digit code.`);
                      } else {
                        await callSendAPI(senderPsid, "⚠️ Failed to send verification email. Please check the email address and try again.");
                      }
                    } else {
                      await callSendAPI(senderPsid, "⚠️ Please enter a valid email address ending in @missionary.org");
                    }
                  } 
                  
                  // Verified User Interactions
                  else {
                    if (messageText.toLowerCase() === 'points' || messageText.toLowerCase() === 'balance') {
                      await callSendAPI(senderPsid, `🏆 Your Current Balance:\nPoints: ${userData.points}\nReferral Code: ${userData.referralCode}`);
                    } else {
                      await callSendAPI(senderPsid, `Hello! Type 'points' to check your rewards balance, or share your referral code: ${userData.referralCode}`);
                    }
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
