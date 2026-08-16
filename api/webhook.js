import crypto from 'crypto';

const tursoUrl = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://') + '/v2/pipeline';
const tursoToken = process.env.TURSO_AUTH_TOKEN;

async function queryTurso(sql, args = []) {
  try {
    const payload = {
      requests: [
        {
          type: "execute",
          stmt: {
            sql: sql,
            args: args.map(val => (val === null ? { type: "null" } : { type: "text", value: String(val) }))
          }
        },
        { type: "close" }
      ]
    };
    const res = await fetch(tursoUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.batched_results?.[0]?.type === 'error') {
      console.error("❌ Turso Query Error:", JSON.stringify(data));
      return [];
    }
    const resultObj = data.batched_results?.[0]?.result;
    if (!resultObj || !resultObj.cols) return [];
    
    const cols = resultObj.cols.map(c => c.name);
    return resultObj.rows.map(row => {
      const obj = {};
      row.forEach((cell, idx) => { obj[cols[idx]] = cell.value; });
      return obj;
    });
  } catch (err) {
    console.error("❌ DB Network Error:", err.message);
    return [];
  }
}

async function sendBrevoEmail(email, otpCode, name) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: "Timeless Creations Rewards", email: "noreply@timelesscreations.com" },
        to: [{ email, name: name || "Missionary" }],
        subject: "Your TCRP Verification Passcode",
        htmlContent: `<p>Greetings ${name || 'Missionary'},</p><p>Your TCRP verification code is: <b>${otpCode}</b></p>`
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function callSendAPI(psid, text, quickReplies = null) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return;
  
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: psid },
    message: { text }
  };
  if (quickReplies && Array.isArray(quickReplies)) {
    body.message.quick_replies = quickReplies;
  }

  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {}
}

const termsButtons = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];
const globalCodeButton = [
  { content_type: "text", title: "Use Code: TCRP", payload: "TCRP" }
];
const menuButtons = [
  { content_type: "text", title: "🏆 Daily Dashboard", payload: "PAYLOAD_DASHBOARD" },
  { content_type: "text", title: "🎁 Catalog", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "❓ FAQs", payload: "PAYLOAD_FAQS" }
];

export default async function handler(req, res) {
  // Safe Query String Extraction for Meta Verification
  const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const mode = req.query?.['hub.mode'] || urlObj.searchParams.get('hub.mode');
  const token = req.query?.['hub.verify_token'] || urlObj.searchParams.get('hub.verify_token');
  const challenge = req.query?.['hub.challenge'] || urlObj.searchParams.get('hub.challenge');

  if (req.method === 'GET') {
    const verifyToken = process.env.VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.object === 'page' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        for (const event of entry.messaging) {
          const psid = event.sender?.id;
          if (!psid) continue;

          // Ignore echo and read receipts
          if (event.delivery || event.read || event.message?.is_echo) continue;

          const rawText = event.message?.text?.trim() || "";
          const payload = event.message?.quick_reply?.payload || event.postback?.payload || "";
          const msg = payload || rawText;
          if (!msg) continue;

          const existing = await queryTurso("SELECT * FROM missionaries WHERE psid = ?", [psid]);
          let user = existing[0] || null;

          // 1. Initial Welcome / Reset
          if (!user || msg.toLowerCase() === "get started" || msg.toLowerCase() === "restart") {
            if (!user) {
              const dummyEmail = `temp_${psid}@missionary.org`;
              await queryTurso(`
                INSERT INTO missionaries (email, psid, state, is_prelisted, status)
                VALUES (?, ?, 'AWAITING_TERMS', 0, 'active')
                ON CONFLICT(psid) DO UPDATE SET state = 'AWAITING_TERMS'
              `, [dummyEmail, psid]);
            } else {
              await queryTurso("UPDATE missionaries SET state = 'AWAITING_TERMS' WHERE psid = ?", [psid]);
            }
            const welcome = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒 (𝐓𝐂𝐑𝐏)\n━━━━━━━━━━━━━━━━━━━━━━\nWelcome! Claim exclusive custom missionary rewards.\n\n📜 Please accept the Terms of Service to continue:`;
            await callSendAPI(psid, welcome, termsButtons);
            continue;
          }

          // 2. Terms Agreement
          if (user.state === "AWAITING_TERMS") {
            if (msg === "AGREE_TERMS" || msg.toLowerCase().includes("agree")) {
              await queryTurso("UPDATE missionaries SET state = 'AWAITING_INVITE' WHERE psid = ?", [psid]);
              await callSendAPI(psid, `🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\nEnter an invite code from a fellow missionary, or tap below to use the global code:`, globalCodeButton);
            } else {
              await callSendAPI(psid, `Please tap "✓ Agree & Continue" to join:`, termsButtons);
            }
            continue;
          }

          // 3. Invite Code Processing
          if (user.state === "AWAITING_INVITE") {
            const code = msg.toUpperCase().trim();
            let referrer = null;
            if (code === "TCRP") {
              const stat = await queryTurso("SELECT value FROM stats WHERE key = 'globalClaims'");
              const claims = stat[0] ? Number(stat[0].value) : 0;
              await queryTurso("INSERT INTO stats (key, value) VALUES ('globalClaims', 1) ON CONFLICT(key) DO UPDATE SET value = value + 1");
            } else if (code.startsWith("TCRP-")) {
              const refMatch = await queryTurso("SELECT psid, points FROM missionaries WHERE referral_code = ?", [code]);
              if (refMatch[0]) referrer = refMatch[0];
            }

            await queryTurso("UPDATE missionaries SET state = 'AWAITING_REGISTRATION' WHERE psid = ?", [psid]);
            if (referrer && referrer.psid !== psid) {
              await queryTurso("UPDATE missionaries SET points = points + 1 WHERE psid = ?", [referrer.psid]);
              await callSendAPI(referrer.psid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\nYou earned +1 Bonus Point!`);
            }

            await callSendAPI(psid, `✓ Code Accepted!\n━━━━━━━━━━━━━━━━━━━━━━\nPlease send your Missionary Title & Email together:\n\nElder Smith\njohn.smith@missionary.org`);
            continue;
          }

          // 4. Registration & OTP Validation
          if (user.state === "AWAITING_REGISTRATION" || user.state === "AWAITING_OTP") {
            const isSixDigit = /^\d{6}$/.test(msg.trim());

            if (user.state === "AWAITING_OTP" && isSixDigit) {
              if (user.otp_code && msg.trim() === user.otp_code) {
                const bonusPoints = user.is_prelisted === 1 ? 2 : 1;
                const newPoints = (Number(user.points) || 0) + bonusPoints;
                const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
                const todayStr = new Date().toISOString().split('T')[0];

                await queryTurso(`
                  UPDATE missionaries 
                  SET points = ?, referral_code = ?, otp_code = NULL, state = 'VERIFIED', last_checked_date = ?
                  WHERE psid = ?
                `, [newPoints, refCode, todayStr, psid]);

                const successMsg = `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `👤 ${user.name || 'Missionary'}\n` +
                  `🎁 Welcome Reward: +${bonusPoints} Point(s) ${user.is_prelisted === 1 ? '(Pre-Listed Bonus!)' : ''}\n` +
                  `💰 Balance: ${newPoints} Point(s)\n` +
                  `🔑 Your Code: ${refCode}\n\n` +
                  `🔗 Share Link:\nhttps://m.me/timeless.creations.06?ref=${refCode}`;

                await callSendAPI(psid, successMsg, menuButtons);
              } else {
                await callSendAPI(psid, "✕ Incorrect 6-digit passcode. Please check your inbox and reply with the code.");
              }
              continue;
            }

            const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
            let foundTitle = null;
            let foundEmail = null;

            for (const line of lines) {
              if (line.toLowerCase().startsWith("elder ") || line.toLowerCase().startsWith("sister ")) foundTitle = line;
              else if (line.toLowerCase().endsWith("@missionary.org")) foundEmail = line.toLowerCase();
            }

            if (foundTitle && foundEmail) {
              const otp = Math.floor(100000 + Math.random() * 900000).toString();
              const target = await queryTurso("SELECT * FROM missionaries WHERE email = ?", [foundEmail]);

              if (target.length > 0) {
                await queryTurso(`
                  UPDATE missionaries 
                  SET psid = ?, name = ?, otp_code = ?, state = 'AWAITING_OTP'
                  WHERE email = ?
                `, [psid, foundTitle, otp, foundEmail]);
              } else {
                await queryTurso(`
                  INSERT INTO missionaries (email, name, psid, is_prelisted, otp_code, state)
                  VALUES (?, ?, ?, 0, ?, 'AWAITING_OTP')
                  ON CONFLICT(email) DO UPDATE SET psid = excluded.psid, otp_code = excluded.otp_code, state = 'AWAITING_OTP'
                `, [foundEmail, foundTitle, psid, otp]);
              }

              await sendBrevoEmail(foundEmail, otp, foundTitle);
              await callSendAPI(psid, `📧 Passcode sent to ${foundEmail}!\n\nPlease reply with the 6-digit code:`);
            } else {
              await callSendAPI(psid, `⚠️ Please send both your Title & Email together:\n\nElder Smith\njohn.smith@missionary.org`);
            }
            continue;
          }

          // 5. Daily 1-Check Limit
          const today = new Date().toISOString().split('T')[0];

          if (msg === "PAYLOAD_DASHBOARD" || msg.toLowerCase().includes("dashboard") || msg.toLowerCase().includes("points")) {
            if (user.last_checked_date === today) {
              await callSendAPI(
                psid,
                `⏱️ 𝐃𝐀𝐈𝐋𝐘 𝐋𝐈𝐌𝐈𝐓 𝐑𝐄𝐀𝐂𝐇𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━━━\nYou already checked your dashboard today.\n\nYour balance updates automatically when friends join. You can check again tomorrow!`,
                menuButtons
              );
              continue;
            }

            await queryTurso("UPDATE missionaries SET last_checked_date = ? WHERE psid = ?", [today, psid]);

            const shareLink = `https://m.me/timeless.creations.06?ref=${user.referral_code || 'TCRP'}`;
            const dashboard = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 Registered: ${user.name}\n` +
              `✉️ Email: ${user.email}\n` +
              `💰 Balance: ${user.points || 0} Point(s)\n` +
              `🔑 Code: ${user.referral_code}\n\n` +
              `📢 𝐒𝐡𝐚𝐫𝐞 & 𝐄𝐚𝐫𝐧 (+1 Pt per Referral):\n${shareLink}\n\n` +
              `ℹ️ (Daily check completed for today)`;

            await callSendAPI(psid, dashboard, menuButtons);
          } else if (msg === "PAYLOAD_CATALOG" || msg.toLowerCase().includes("catalog")) {
            await callSendAPI(psid, `🎁 𝐓𝐂𝐑𝐏 𝐑𝐄𝐖𝐀𝐑𝐃𝐒 𝐂𝐀𝐓𝐀𝐋𝐎𝐆\n\n• Temple Keychain (6 Pts)\n• Nametag Keychain (24 Pts)\n• Salvation Kit (42 Pts)\n• Scripture Case (60 Pts)\n\nReply with "REDEEM KEYCHAIN" or choose an action below:`, menuButtons);
          } else if (msg.toUpperCase().startsWith("REDEEM")) {
            let cost = 6;
            let item = "Temple Keychain";
            if (msg.toUpperCase().includes("NAMETAG")) { cost = 24; item = "Nametag Keychain"; }
            if (msg.toUpperCase().includes("SALVATION")) { cost = 42; item = "Salvation Kit"; }
            if (msg.toUpperCase().includes("SCRIPTURE")) { cost = 60; item = "Scripture Case"; }

            const userPts = Number(user.points) || 0;
            if (userPts < cost) {
              await callSendAPI(psid, `✕ Insufficient points. You have ${userPts} point(s), but ${item} requires ${cost} points.`, menuButtons);
            } else {
              const orderId = `TX-` + crypto.randomBytes(4).toString('hex').toUpperCase();
              const newBalance = userPts - cost;

              await queryTurso("UPDATE missionaries SET points = ? WHERE psid = ?", [newBalance, psid]);
              await queryTurso(`
                INSERT INTO orders (order_id, psid, email, name, item, points_cost, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))
              `, [orderId, psid, user.email, user.name, item, cost]);

              await callSendAPI(psid, `🎟️ 𝐑𝐄𝐃𝐄𝐌𝐏𝐓𝐈𝐎🇳 𝐑𝐄𝐂𝐄𝐈𝐏𝐓\n━━━━━━━━━━━━━━━━━━━━━━\nOrder Ref: ${orderId}\nItem: ${item}\nRemaining Balance: ${newBalance} Pt(s)\nStatus: ⏳ PENDING DISPATCH`, menuButtons);
            }
          } else {
            await callSendAPI(psid, `Hello ${user.name || 'Missionary'}! How can we help? Choose an option below:`, menuButtons);
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
}
