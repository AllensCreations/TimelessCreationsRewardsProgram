const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, increment } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function callSendAPI(senderPsid, responseText) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) return;

  const requestBody = {
    recipient: { id: senderPsid },
    message: { text: responseText }
  };

  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    console.error('Error sending Messenger reply:', err);
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
      if (body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const event of entry.messaging) {
              const senderPsid = event.sender.id;
              
              if (event.message && event.message.text) {
                const messageText = event.message.text.trim();
                const userRef = doc(db, 'users', senderPsid);
                const userSnap = await getDoc(userRef);

                // Admin Secret Trigger
                if (messageText.startsWith('/Admin 0726')) {
                  await setDoc(userRef, { isAdmin: true }, { merge: true });
                  await callSendAPI(senderPsid, "👑 Admin access granted for TCRP!");
                  continue;
                }

                // Check if user exists
                if (!userSnap.exists()) {
                  await setDoc(userRef, {
                    psid: senderPsid,
                    verified: false,
                    points: 0,
                    createdAt: new Date().toISOString()
                  });
                  await callSendAPI(senderPsid, "Welcome to TCRP! 🎉\n\nPlease enter your official email address ending in @missionary.org to verify your account.");
                } else {
                  const userData = userSnap.data();

                  if (!userData.verified) {
                    if (messageText.toLowerCase().endsWith('@missionary.org')) {
                      const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                      await updateDoc(userRef, {
                        email: messageText,
                        verified: true,
                        referralCode: refCode,
                        points: 100
                      });
                      await callSendAPI(senderPsid, `✅ Account verified!\n\nYou earned 100 welcome points.\nYour Referral Code is: ${refCode}\n\nShare this code with fellow missionaries to earn extra rewards!`);
                    } else {
                      await callSendAPI(senderPsid, "⚠️ Invalid email. Please provide a valid email ending in @missionary.org");
                    }
                  } else {
                    // Check points or process referral code
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
