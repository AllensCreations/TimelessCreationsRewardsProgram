import crypto from 'crypto';

const rawDbUrl = (process.env.TURSO_DATABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
const tursoUrl = rawDbUrl.replace('libsql://', 'https://') + '/v2/pipeline';
const tursoToken = (process.env.TURSO_AUTH_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

async function queryTurso(sql, args = []) {
  try {
    const formattedArgs = args.map(val => {
      if (val === null || val === undefined) return { type: "null" };
      if (typeof val === "number") return { type: "integer", value: String(val) };
      return { type: "text", value: String(val) };
    });

    const payload = {
      requests: [
        {
          type: "execute",
          stmt: {
            sql: sql,
            args: formattedArgs
          }
        },
        { type: "close" }
      ]
    };

    const res = await fetch(tursoUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Turso DB Error:", JSON.stringify(data));
      return [];
    }

    const firstBatch = data.results?.[0] || data.batched_results?.[0];
    if (!firstBatch) return [];

    const resultObj = firstBatch.response?.result || firstBatch.result;
    if (!resultObj || !resultObj.cols) return [];

    const cols = resultObj.cols.map(c => (typeof c === 'object' ? c.name : c));
    return resultObj.rows.map(row => {
      const obj = {};
      row.forEach((cell, idx) => {
        const colName = cols[idx];
        if (cell === null || cell === undefined) {
          obj[colName] = null;
        } else if (typeof cell === 'object' && 'value' in cell) {
          obj[colName] = cell.value;
        } else {
          obj[colName] = cell;
        }
      });
      return obj;
    });
  } catch (err) {
    console.error("❌ DB Exception:", err.message);
    return [];
  }
}

async function sendBrevoEmail(email, otpCode, name) {
  const apiKey = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
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
  const token = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
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
  const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const mode = req.query?.['hub.mode'] || urlObj.searchParams.get('hub.mode');
  const token = req.query?.['hub.verify_token'] || urlObj.searchParams.get('hub.verify_token');
  const challenge = req.query?.['hub.challenge'] || urlObj.searchParams.get('hub.challenge');

  if (req.method === 'GET') {
    const verifyToken = (process.env.VERIFY_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
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

          if (event.delivery || event.read || event.message?.is_echo) continue;

          const rawText = event.message?.text?.trim() || "";
          const payload = event.message?.quick_reply?.payload || event.postback?.payload || "";
          const msg = payload || rawText;
          if (!msg) continue;

          const sessionRows = await queryTurso("SELECT * FROM sessions WHERE psid = ?", [psid]);
          let session = sessionRows[0] || null;

          const now = Date.now();
          if (session) {
            const windowStart = Number(session.window_start) || now;
            let clickCount = Number(session.click_count) || 0;

            if (now - windowStart < 60000) {
              if (clickCount >= 5) {
                await callSendAPI(psid, "⚠️ You are sending messages too fast! Please wait a minute.");
                continue;
              }
              await queryTurso("UPDATE sessions SET click_count = ? WHERE psid = ?", [clickCount + 1, psid]);
            } else {
              await queryTurso("UPDATE sessions SET window_start = ?, click_count = 1 WHERE psid = ?", [now, psid]);
            }
          }

          // 1. Initial Start / Reset
          const isStart = msg.toLowerCase() === "get started" || msg.toLowerCase() === "restart";
          if (!session || isStart) {
            await queryTurso(`
              INSERT INTO sessions (psid, state, window_start, click_count)
              VALUES (?, 'AWAITING_TERMS', ?, 1)
              ON CONFLICT(psid) DO UPDATE SET state = 'AWAITING_TERMS', window_start = excluded.window_start, click_count = 1
            `, [psid, now]);

            const welcome = `𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒 (𝐓𝐂𝐑𝐏)\n━━━━━━━━━━━━━━━━━━━━━━\nWelcome! Claim exclusive custom missionary rewards.\n\n📜 Please accept the Terms of Service to continue:`;
            await callSendAPI(psid, welcome, termsButtons);
            continue;
          }

          // 2. Terms of Service
          if (session.state === "AWAITING_TERMS") {
            const isAgree = msg === "AGREE_TERMS" || msg.toLowerCase().includes("agree");
            const isDecline = msg === "DECLINE_TERMS" || msg.toLowerCase().includes("decline");

            if (isAgree) {
              await queryTurso("UPDATE sessions SET state = 'AWAITING_INVITE' WHERE psid = ?", [psid]);
              await callSendAPI(
                psid,
                `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━━━\n🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\nEnter an invite code from a fellow missionary, or tap below to use the global code:`,
                globalCodeButton
              );
            } else if (isDecline) {
              await callSendAPI(psid, "You must accept the Terms of Service to join TCRP. Type 'Restart' anytime to try again.", termsButtons);
            } else {
              await callSendAPI(psid, `Please tap "✓ Agree & Continue" below to proceed:`, termsButtons);
            }
            continue;
          }

          // 3. Invitation Code
          if (session.state === "AWAITING_INVITE") {
            const code = msg.toUpperCase().trim();
            let valid = false;

            if (code === "TCRP") {
              valid = true;
              await queryTurso("INSERT INTO stats (key, value) VALUES ('globalClaims', 1) ON CONFLICT(key) DO UPDATE SET value = value + 1");
            } else if (code.startsWith("TCRP-")) {
              const refMatch = await queryTurso("SELECT psid FROM missionaries WHERE referral_code = ?", [code]);
              if (refMatch[0]) valid = true;
            }

            if (valid) {
              await queryTurso("UPDATE sessions SET state = 'AWAITING_REGISTRATION', invite_code = ? WHERE psid = ?", [code, psid]);
              await callSendAPI(
                psid,
                `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${code})\n━━━━━━━━━━━━━━━━━━━━━━\nPlease send your Missionary Title & Email together:\n\nElder Smith\njohn.smith@missionary.org`
              );
            } else {
              await callSendAPI(psid, `✕ Invalid invitation code. Enter a valid code or tap below:`, globalCodeButton);
            }
            continue;
          }

          // 4. Registration & OTP Validation
          if (session.state === "AWAITING_REGISTRATION" || session.state === "AWAITING_OTP") {
            const isSixDigit = /^\d{6}$/.test(msg.trim());

            if (session.state === "AWAITING_OTP" && isSixDigit) {
              if (session.otp_code && msg.trim() === session.otp_code) {
                const email = session.temp_email;
                const title = session.temp_title || "Missionary";
                const todayStr = new Date().toISOString().split('T')[0];

                const existingM = await queryTurso("SELECT * FROM missionaries WHERE email = ?", [email]);
                let isPrelisted = existingM.length > 0 && Number(existingM[0].is_prelisted) === 1;
                const bonusPoints = isPrelisted ? 2 : 1;
                const currentPoints = existingM.length > 0 ? Number(existingM[0].points) || 0 : 0;
                const newPoints = currentPoints + bonusPoints;
                const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);

                if (existingM.length > 0) {
                  await queryTurso(`
                    UPDATE missionaries 
                    SET psid = ?, name = ?, points = ?, referral_code = ?
                    WHERE email = ?
                  `, [psid, title, newPoints, refCode, email]);
                } else {
                  await queryTurso(`
                    INSERT INTO missionaries (email, name, psid, points, referral_code, is_prelisted, status)
                    VALUES (?, ?, ?, ?, ?, 0, 'active')
                  `, [email, title, psid, newPoints, refCode]);
                }

                if (session.invite_code && session.invite_code.startsWith("TCRP-")) {
                  const refOwner = await queryTurso("SELECT psid, points FROM missionaries WHERE referral_code = ?", [session.invite_code]);
                  if (refOwner[0] && refOwner[0].psid !== psid) {
                    await queryTurso("UPDATE missionaries SET points = points + 1 WHERE psid = ?", [refOwner[0].psid]);
                    await callSendAPI(refOwner[0].psid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\nYou earned +1 Bonus Point!`);
                  }
                }

                await queryTurso("UPDATE sessions SET state = 'VERIFIED', otp_code = NULL, last_checked_date = ? WHERE psid = ?", [todayStr, psid]);

                const successMsg = `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `👤 ${title}\n` +
                  `🎁 Welcome Reward: +${bonusPoints} Point(s) ${isPrelisted ? '(Pre-Listed Bonus!)' : ''}\n` +
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
              await queryTurso(`
                UPDATE sessions 
                SET temp_title = ?, temp_email = ?, otp_code = ?, state = 'AWAITING_OTP'
                WHERE psid = ?
              `, [foundTitle, foundEmail, otp, psid]);

              await sendBrevoEmail(foundEmail, otp, foundTitle);
              await callSendAPI(psid, `📧 Passcode sent to ${foundEmail}!\n\nPlease reply with the 6-digit code:`);
            } else {
              await callSendAPI(psid, `⚠️ Please send both your Title & Email together:\n\nElder Smith\njohn.smith@missionary.org`);
            }
            continue;
          }

          // 5. Verified User Actions
          const userRows = await queryTurso("SELECT * FROM missionaries WHERE psid = ?", [psid]);
          const user = userRows[0] || null;
          const today = new Date().toISOString().split('T')[0];

          if (msg === "PAYLOAD_DASHBOARD" || msg.toLowerCase().includes("dashboard") || msg.toLowerCase().includes("points")) {
            if (session.last_checked_date === today) {
              await callSendAPI(
                psid,
                `⏱️ 𝐃𝐀𝐈𝐋𝐘 𝐋𝐈𝐌𝐈𝐓 𝐑𝐄𝐀𝐂𝐇𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━━━\nYou already checked your dashboard today.\n\nYour balance updates automatically when friends join. You can check again tomorrow!`,
                menuButtons
              );
              continue;
            }

            await queryTurso("UPDATE sessions SET last_checked_date = ? WHERE psid = ?", [today, psid]);

            const shareLink = `https://m.me/timeless.creations.06?ref=${user?.referral_code || 'TCRP'}`;
            const dashboard = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 Registered: ${user?.name || 'Missionary'}\n` +
              `✉️ Email: ${user?.email || 'N/A'}\n` +
              `💰 Balance: ${user?.points || 0} Point(s)\n` +
              `🔑 Code: ${user?.referral_code || 'TCRP'}\n\n` +
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

            const userPts = Number(user?.points) || 0;
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
            await callSendAPI(psid, `Hello ${user?.name || 'Missionary'}! How can we help? Choose an option below:`, menuButtons);
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
}
