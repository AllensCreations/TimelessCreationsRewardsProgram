const { createClient } = require("@libsql/client");
const crypto = require('crypto');

function getTursoClient() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) return null;
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function initDatabase(db) {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        psid TEXT PRIMARY KEY,
        state TEXT DEFAULT 'AWAITING_TERMS',
        termsAccepted BOOLEAN DEFAULT 0,
        invited BOOLEAN DEFAULT 0,
        verified BOOLEAN DEFAULT 0,
        points INTEGER DEFAULT 0,
        titleName TEXT,
        email TEXT,
        otpCode TEXT,
        referralCode TEXT,
        pendingRefParam TEXT,
        isAdmin BOOLEAN DEFAULT 0,
        clickCount INTEGER DEFAULT 0,
        clickWindowStart INTEGER DEFAULT 0,
        createdAt TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS referralCodes (
        code TEXT PRIMARY KEY,
        psid TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        refID TEXT PRIMARY KEY,
        psid TEXT,
        name TEXT,
        item TEXT,
        pointsSpent INTEGER,
        status TEXT DEFAULT 'PENDING',
        timestamp TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS recipients (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        last_name TEXT,
        cohort TEXT,
        start_date TEXT,
        max_months INTEGER,
        status TEXT DEFAULT 'active'
      )
    `);
  } catch (err) {
    console.error("❌ DB Init Error:", err.message);
  }
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

const unifiedQuickReplies = [
  { content_type: "text", title: "🏆 Dashboard & Share", payload: "PAYLOAD_UNIFIED_HUB" },
  { content_type: "text", title: "🎁 Catalog & Redeem", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "❓ FAQs", payload: "PAYLOAD_FAQS" }
];

const adminQuickReplies = [
  { content_type: "text", title: "📦 View Orders", payload: "ADMIN_VIEW_ORDERS" },
  { content_type: "text", title: "🏆 User Dashboard", payload: "PAYLOAD_CHECK_POINTS" }
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
      const db = getTursoClient();
      if (!db) return res.status(200).send('EVENT_RECEIVED');
      await initDatabase(db);

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

            let userRes = await db.execute({ sql: "SELECT * FROM users WHERE psid = ?", args: [senderPsid] });
            let userData = userRes.rows[0] || null;

            if (mmeReferral && userData) {
              await db.execute({ sql: "UPDATE users SET pendingRefParam = ? WHERE psid = ?", args: [mmeReferral.toUpperCase(), senderPsid] });
            }

            if (messageText.startsWith('/Admin 0726')) {
              if (userData) await db.execute({ sql: "UPDATE users SET isAdmin = 1 WHERE psid = ?", args: [senderPsid] });
              await callSendAPI(senderPsid, "👑 𝐀𝐃𝐌𝐈𝐍 𝐀𝐂𝐂𝐄𝐒𝐒 𝐆𝐑𝐀𝐍𝐓𝐄𝐃", adminQuickReplies);
              continue;
            }

            if (userData && userData.isAdmin === 1 && (messageText === "ADMIN_VIEW_ORDERS" || messageText.toLowerCase() === "orders")) {
              const txRes = await db.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 6");
              if (txRes.rows.length === 0) {
                await callSendAPI(senderPsid, "📦 No redemption transactions found.", adminQuickReplies);
                continue;
              }

              let summary = `📦 𝐑𝐄𝐂𝐄𝐍𝐓 𝐑𝐄𝐃𝐄𝐌𝐏𝐓𝐈𝐎𝐍 𝐎𝐑𝐃𝐄𝐑𝐒\n━━━━━━━━━━━━━━━━━━━━━━\n`;
              for (const tx of txRes.rows) {
                const statusIcon = tx.status === "COMPLETED" ? "✅" : "⏳";
                summary += `\n${statusIcon} ID: ${tx.refID}\n👤 ${tx.name} (${tx.item})\nStatus: ${tx.status}\n`;
              }
              await callSendAPI(senderPsid, summary, adminQuickReplies);
              continue;
            }

            const isRestart = (messageText.toLowerCase() === "get started" || messageText.toLowerCase() === "restart" || postbackPayload.includes("GET_STARTED"));

            if (!userData || isRestart) {
              await db.execute({
                sql: `
                  INSERT INTO users (psid, state, termsAccepted, invited, verified, points, pendingRefParam, createdAt)
                  VALUES (?, 'AWAITING_TERMS', 0, 0, 0, 0, ?, datetime('now'))
                  ON CONFLICT(psid) DO UPDATE SET
                    state = 'AWAITING_TERMS', termsAccepted = 0, invited = 0, verified = 0, points = 0
                `,
                args: [senderPsid, mmeReferral ? mmeReferral.toUpperCase() : null]
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

            let userState = userData.state || "AWAITING_TERMS";

            if (userData.verified === 1 && userState === "VERIFIED") {
              const now = Date.now();
              const clickWindow = userData.clickWindowStart || now;
              const clickCount = userData.clickCount || 0;

              if (now - clickWindow < 10000) {
                if (clickCount >= 5) {
                  await callSendAPI(senderPsid, "⚠️ You are clicking too fast! Please wait a moment.");
                  continue;
                }
                await db.execute({ sql: "UPDATE users SET clickCount = ? WHERE psid = ?", args: [clickCount + 1, senderPsid] });
              } else {
                await db.execute({ sql: "UPDATE users SET clickWindowStart = ?, clickCount = 1 WHERE psid = ?", args: [now, senderPsid] });
              }
            }

            if (messageText === "PAYLOAD_FAQS" || messageText.toLowerCase() === "faq") {
              await callSendAPI(senderPsid, getFaqsText(), unifiedQuickReplies);
              continue;
            }

            // STEP 1: TERMS
            if (userState === "AWAITING_TERMS" || !userData.termsAccepted) {
              if (messageText === "AGREE_TERMS" || messageText.toLowerCase().includes("agree")) {
                await db.execute({ sql: "UPDATE users SET termsAccepted = 1, state = 'AWAITING_INVITE' WHERE psid = ?", args: [senderPsid] });
                await callSendAPI(
                  senderPsid,
                  `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\n` +
                  `Please enter an Invitation Code provided by a fellow missionary, or tap below to join using Global Code: TCRP`,
                  globalInviteQuickReply
                );
                continue;
              } else {
                await callSendAPI(senderPsid, `Please tap "✓ Agree & Continue" below:`, termsQuickReplies);
                continue;
              }
            }

            // STEP 2: INVITATION
            if (userState === "AWAITING_INVITE" || !userData.invited) {
              const inputCode = messageText.toUpperCase().trim();
              if (inputCode === "TCRP" || inputCode.startsWith("TCRP-")) {
                let isValidCode = false;
                let isGlobalCode = (inputCode === "TCRP");
                let referrerPsid = null;

                if (isGlobalCode) {
                  const statRes = await db.execute({ sql: "SELECT value FROM stats WHERE key = 'globalClaims'", args: [] });
                  const currentClaims = statRes.rows[0] ? Number(statRes.rows[0].value) : 0;
                  if (currentClaims >= 100) {
                    await callSendAPI(senderPsid, `✕ Global code limit reached.`);
                    continue;
                  } else {
                    isValidCode = true;
                    await db.execute({ sql: "INSERT INTO stats (key, value) VALUES ('globalClaims', ?) ON CONFLICT(key) DO UPDATE SET value = value + 1", args: [currentClaims + 1] });
                  }
                } else {
                  const codeRes = await db.execute({ sql: "SELECT psid FROM referralCodes WHERE code = ?", args: [inputCode] });
                  if (codeRes.rows.length > 0) {
                    referrerPsid = codeRes.rows[0].psid;
                    isValidCode = true;
                  }
                }

                if (isValidCode) {
                  await db.execute({ sql: "UPDATE users SET invited = 1, usedInviteCode = ?, state = 'AWAITING_REGISTRATION' WHERE psid = ?", args: [inputCode, senderPsid] });
                  if (referrerPsid && referrerPsid !== senderPsid) {
                    const refUserRes = await db.execute({ sql: "SELECT points FROM users WHERE psid = ?", args: [referrerPsid] });
                    if (refUserRes.rows.length > 0) {
                      const refPoints = Number(refUserRes.rows[0].points || 0);
                      await db.execute({ sql: "UPDATE users SET points = ? WHERE psid = ?", args: [refPoints + 1, referrerPsid] });
                      await callSendAPI(referrerPsid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\nYou earned +1 Point!`);
                    }
                  }
                  await callSendAPI(
                    senderPsid,
                    `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${inputCode})\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Please send your Missionary Title/Name and Email together in this format:\n\n` +
                    `Elder Smith\n` +
                    `john.smith@missionary.org`
                  );
                } else {
                  await callSendAPI(senderPsid, `✕ Invalid code. Enter a valid code or tap below:`, globalInviteQuickReply);
                }
              } else {
                await callSendAPI(senderPsid, `🔑 An Invitation Code is required. Enter your code or tap below:`, globalInviteQuickReply);
              }
              continue;
            }

            // STEP 3 & 4: COMBINED REGISTRATION & OTP
            if (userState === "AWAITING_REGISTRATION" || userState === "AWAITING_OTP" || !userData.verified) {
              const normalizedInput = messageText.trim().toLowerCase();

              if (userState === "AWAITING_OTP" && /^\d{6}$/.test(normalizedInput)) {
                if (userData.otpCode && normalizedInput === userData.otpCode.toString()) {
                  const personalRefCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                  const newPoints = Number(userData.points || 0) + 1;

                  await db.execute({
                    sql: `UPDATE users SET verified = 1, referralCode = ?, points = ?, otpCode = NULL, state = 'VERIFIED' WHERE psid = ?`,
                    args: [personalRefCode, newPoints, senderPsid]
                  });

                  await db.execute({
                    sql: "INSERT INTO referralCodes (code, psid) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET psid = ?",
                    args: [personalRefCode, senderPsid, senderPsid]
                  });

                  const welcomeHub = `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Registered: ${userData.titleName}\n` +
                    `Balance: ${newPoints} Point(s)\n` +
                    `Your Code: ${personalRefCode}\n\n` +
                    `🔗 Your Link: https://m.me/timeless.creations.06?ref=${personalRefCode}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Rule: 1 Referral = 1 Point`;

                  await callSendAPI(senderPsid, welcomeHub, unifiedQuickReplies);
                } else {
                  await callSendAPI(senderPsid, "✕ Incorrect code. Please reply with the 6-digit code.");
                }
                continue;
              }

              const lines = messageText.split('\n').map(l => l.trim()).filter(Boolean);
              let foundTitle = null;
              let foundEmail = null;

              for (const line of lines) {
                if (line.toLowerCase().startsWith("elder ") || line.toLowerCase().startsWith("sister ")) {
                  foundTitle = line.charAt(0).toUpperCase() + line.slice(1);
                } else if (line.toLowerCase().endsWith("@missionary.org")) {
                  foundEmail = line.toLowerCase();
                }
              }

              if (foundTitle && foundEmail) {
                // Optional Whitelist Validation against CSV-imported recipients table
                const whitelistCheck = await db.execute({ sql: "SELECT * FROM recipients WHERE email = ?", args: [foundEmail] });
                // (Optional: You can enforce strict whitelist checking here if desired)

                const passCode = Math.floor(100000 + Math.random() * 900000).toString();
                await db.execute({
                  sql: "UPDATE users SET titleName = ?, email = ?, otpCode = ?, state = 'AWAITING_OTP' WHERE psid = ?",
                  args: [foundTitle, foundEmail, passCode, senderPsid]
                });

                const emailSent = await sendBrevoEmail(foundEmail, passCode, foundTitle);
                if (emailSent) {
                  await callSendAPI(senderPsid, `📧 Verification code sent to ${foundEmail}!\n\nPlease reply here with the 6-digit code.`);
                } else {
                  await callSendAPI(senderPsid, `📧 Verification Code: ${passCode}\n\nPlease reply with this 6-digit code.`);
                }
              } else {
                await callSendAPI(
                  senderPsid,
                  `⚠️ Please send both your Title and Email together in this format:\n\n` +
                  `Elder Smith\n` +
                  `john.smith@missionary.org`
                );
              }
              continue;
            }

            // STEP 5: DASHBOARD & ACTIONS
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
                `Rule: 1 Referral = 1 Point. Tap below to browse catalog:`;

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

              const userPoints = Number(userData.points || 0);
              if (userPoints < cost) {
                await callSendAPI(senderPsid, `✕ 𝐈𝐍𝐒𝐔𝐅𝐅𝐈𝐂𝐈𝐄𝐍𝐓 𝐏𝐎𝐈𝐍𝐓𝐒\n\n${itemName} requires ${cost} points. You have ${userPoints} point(s).`, unifiedQuickReplies);
              } else {
                const newPoints = userPoints - cost;
                const refID = generateEncryptedRefID(senderPsid, itemName);

                await db.execute({ sql: "UPDATE users SET points = ? WHERE psid = ?", args: [newPoints, senderPsid] });
                await db.execute({
                  sql: `INSERT INTO transactions (refID, psid, name, item, pointsSpent, status, timestamp) VALUES (?, ?, ?, ?, ?, 'PENDING', datetime('now'))`,
                  args: [refID, senderPsid, userData.titleName, itemName, cost]
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
                  `Present Reference ID ${refID} to claim!`;

                await callSendAPI(senderPsid, receipt, unifiedQuickReplies);
              }
            }
            else {
              await callSendAPI(senderPsid, `Greetings, ${userData.titleName}! Choose an action below:`, unifiedQuickReplies);
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
