import crypto from 'crypto';

const rawDbUrl = (process.env.TURSO_DATABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
const tursoUrl = rawDbUrl.replace('libsql://', 'https://').replace(/\/+$/, '') + '/v2/pipeline';
const tursoToken = (process.env.TURSO_AUTH_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();

// Environment Image Assets
const IMG_KEYCHAIN = process.env.IMG_KEYCHAIN || '';
const IMG_NAMETAG = process.env.IMG_NAMETAG || process.env.IMG_NAMETAGE || '';
const IMG_SALVATION = process.env.IMG_SALVATION || '';
const IMG_SCRIPTURE = process.env.IMG_SCRIPTURE || '';

async function queryTurso(sql, args = []) {
  try {
    const formattedArgs = args.map(val => {
      if (val === null || val === undefined) return { type: "null" };
      if (typeof val === "number") return { type: "integer", value: String(val) };
      return { type: "text", value: String(val) };
    });

    const payload = {
      requests: [
        { type: "execute", stmt: { sql, args: formattedArgs } },
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

async function callSendAPI(psid, messagePayload) {
  const token = (process.env.PAGE_ACCESS_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
  if (!token) return;

  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: psid },
    message: typeof messagePayload === 'string' ? { text: messagePayload } : messagePayload
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) console.error("❌ Graph API Error:", await res.text());
  } catch (err) {
    console.error("❌ Send API Exception:", err.message);
  }
}

const termsButtons = [
  { content_type: "text", title: "✓ Agree & Continue", payload: "AGREE_TERMS" },
  { content_type: "text", title: "✕ Decline", payload: "DECLINE_TERMS" }
];
const globalCodeButton = [
  { content_type: "text", title: "Use Code: TCRP", payload: "TCRP" }
];
const menuButtons = [
  { content_type: "text", title: "🏆 Dashboard", payload: "PAYLOAD_DASHBOARD" },
  { content_type: "text", title: "🎁 Catalog & Redeem", payload: "PAYLOAD_CATALOG" },
  { content_type: "text", title: "❓ FAQs", payload: "PAYLOAD_FAQS" }
];

function getCatalogCarouselPayload() {
  const elements = [
    {
      title: "Temple Keychain",
      subtitle: "Requires 6 TCRP Points\nCustom handcrafted wooden keepsake.",
      image_url: IMG_KEYCHAIN,
      buttons: [{ type: "postback", title: "Redeem (6 Pts)", payload: "REDEEM_KEYCHAIN" }]
    },
    {
      title: "Nametag Keychain",
      subtitle: "Requires 24 TCRP Points\nPersonalized engraved missionary badge.",
      image_url: IMG_NAMETAG,
      buttons: [{ type: "postback", title: "Redeem (24 Pts)", payload: "REDEEM_NAMETAG" }]
    },
    {
      title: "Salvation Kit (POS)",
      subtitle: "Requires 42 TCRP Points\nComplete Plan of Salvation teaching kit.",
      image_url: IMG_SALVATION,
      buttons: [{ type: "postback", title: "Redeem (42 Pts)", payload: "REDEEM_SALVATION" }]
    },
    {
      title: "Scripture Case",
      subtitle: "Requires 60 TCRP Points\nPremium protective genuine leather cover.",
      image_url: IMG_SCRIPTURE,
      buttons: [{ type: "postback", title: "Redeem (60 Pts)", payload: "REDEEM_SCRIPTURE" }]
    }
  ];

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        image_aspect_ratio: "square",
        elements: elements.map(item => ({
          title: item.title,
          subtitle: item.subtitle,
          image_url: item.image_url || undefined,
          buttons: item.buttons
        }))
      }
    },
    quick_replies: menuButtons
  };
}

export default async function handler(req, res) {
  const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const mode = req.query?.['hub.mode'] || urlObj.searchParams.get('hub.mode');
  const token = req.query?.['hub.verify_token'] || urlObj.searchParams.get('hub.verify_token');
  const challenge = req.query?.['hub.challenge'] || urlObj.searchParams.get('hub.challenge');

  if (req.method === 'GET') {
    const verifyToken = (process.env.VERIFY_TOKEN || '').replace(/^['"]|['"]$/g, '').trim();
    if (mode === 'subscribe' && token === verifyToken) return res.status(200).send(challenge);
    return res.status(403).send('Verification failed');
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.object === 'page' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        for (const event of entry.messaging) {
          const psid = event.sender?.id;
          if (!psid || event.delivery || event.read || event.message?.is_echo) continue;

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
              if (clickCount >= 8) {
                await callSendAPI(psid, "⚠️ You are sending actions too quickly! Please wait a moment.");
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
            await callSendAPI(psid, { text: welcome, quick_replies: termsButtons });
            continue;
          }

          // 2. Terms of Service
          if (session.state === "AWAITING_TERMS") {
            const isAgree = msg === "AGREE_TERMS" || msg.toLowerCase().includes("agree");
            const isDecline = msg === "DECLINE_TERMS" || msg.toLowerCase().includes("decline");

            if (isAgree) {
              await queryTurso("UPDATE sessions SET state = 'AWAITING_INVITE' WHERE psid = ?", [psid]);
              await callSendAPI(psid, {
                text: `✦ 𝐓𝐄𝐑𝐌𝐒 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃\n━━━━━━━━━━━━━━━━━━━━━━\n🔑 𝐈𝐧𝐯𝐢𝐭𝐚𝐭𝐢𝐨𝐧 𝐂𝐨𝐝𝐞 𝐑𝐞𝐪𝐮𝐢𝐫𝐞𝐝:\nEnter an invite code from a fellow missionary, or tap below to use the global code:`,
                quick_replies: globalCodeButton
              });
            } else if (isDecline) {
              await callSendAPI(psid, { text: "You must accept the Terms of Service to join TCRP. Type 'Restart' anytime to try again.", quick_replies: termsButtons });
            } else {
              await callSendAPI(psid, { text: `Please tap "✓ Agree & Continue" below to proceed:`, quick_replies: termsButtons });
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
              const refMatch = await queryTurso("SELECT psid, email FROM missionaries WHERE referral_code = ? UNION SELECT psid, email FROM recipients WHERE referral_code = ?", [code, code]);
              if (refMatch[0]) valid = true;
            }

            if (valid) {
              await queryTurso("UPDATE sessions SET state = 'AWAITING_REGISTRATION', invite_code = ? WHERE psid = ?", [code, psid]);
              const prompt = `✓ 𝐈𝐍𝐕𝐈𝐓𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐂𝐄𝐏𝐓𝐄𝐃 (${code})\n━━━━━━━━━━━━━━━━━━━━━━\nPlease send your details in 3 lines:\n\n1. Cohort / Title (e.g. Elder Smith)\n2. Missionary Email (e.g. John.Smith@missionary.org)\n3. Batch Month & Year (e.g. July 2026)\n\nExample:\nElder Smith\nJohn.Smith@missionary.org\nJuly 2026`;
              await callSendAPI(psid, prompt);
            } else {
              await callSendAPI(psid, { text: `✕ Invalid invitation code. Enter a valid code or tap below:`, quick_replies: globalCodeButton });
            }
            continue;
          }

          // 4. Registration Submission (Parses 3 Lines: Cohort, Email, Batch Month & Year)
          if (session.state === "AWAITING_REGISTRATION" || session.state === "AWAITING_OTP") {
            const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
            let foundTitle = null;
            let foundEmail = null;
            let foundBatch = null;

            for (const line of lines) {
              if (line.toLowerCase().startsWith("elder ") || line.toLowerCase().startsWith("sister ")) {
                foundTitle = line;
              } else if (line.includes("@")) {
                foundEmail = line.toLowerCase();
              } else if (/\b(202[0-9]|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(line)) {
                foundBatch = line;
              }
            }

            if (foundTitle && foundEmail) {
              const batchYearMonth = foundBatch || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              const todayStr = new Date().toISOString().split('T')[0];

              // Check existing in missionaries or recipients
              const existingM = await queryTurso("SELECT * FROM missionaries WHERE email = ? UNION SELECT * FROM recipients WHERE email = ?", [foundEmail, foundEmail]);
              const isPrelisted = existingM.length > 0;
              
              // 1 Point for new joiner (+1 extra if prelisted = 2)
              const joinerBonus = isPrelisted ? 2 : 1;
              const currentPoints = existingM.length > 0 ? Number(existingM[0].points) || 0 : 0;
              const newPoints = currentPoints + joinerBonus;
              const refCode = "TCRP-" + Math.floor(1000 + Math.random() * 9000);
              const cohortType = foundTitle.toLowerCase().startsWith("sister") ? "sister" : "elder";

              // Upsert into missionaries table
              await queryTurso(`
                INSERT INTO missionaries (full_name, email, cohort, start_date, points, referral_code, psid, unsubscribed)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                ON CONFLICT(email) DO UPDATE SET
                  full_name = excluded.full_name,
                  psid = excluded.psid,
                  points = points + excluded.points,
                  referral_code = excluded.referral_code
              `, [foundTitle, foundEmail, cohortType, batchYearMonth, newPoints, refCode, psid]);

              // Mutual Referral: +1 Point to the Inviter
              if (session.invite_code && session.invite_code.startsWith("TCRP-")) {
                const refOwner = await queryTurso("SELECT psid, points FROM missionaries WHERE referral_code = ?", [session.invite_code]);
                if (refOwner[0] && refOwner[0].psid && refOwner[0].psid !== psid) {
                  await queryTurso("UPDATE missionaries SET points = points + 1 WHERE psid = ?", [refOwner[0].psid]);
                  await callSendAPI(refOwner[0].psid, `✦ 𝐍𝐄𝐖 𝐑𝐄𝐅𝐄𝐑𝐑𝐀𝐋!\nA missionary joined using your code! You earned +1 Bonus Point! 💰`);
                }
              }

              await queryTurso("UPDATE sessions SET state = 'VERIFIED', last_checked_date = ? WHERE psid = ?", [todayStr, psid]);

              const successMsg = `✦ 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐕𝐄𝐑𝐈𝐅𝐈𝐄𝐃!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Title: ${foundTitle}\n` +
                `✉️ Email: ${foundEmail}\n` +
                `📅 Batch: ${batchYearMonth}\n` +
                `🎁 Welcome Reward: +${joinerBonus} Point(s) ${isPrelisted ? '(Pre-Listed Bonus!)' : ''}\n` +
                `💰 Balance: ${newPoints} Point(s)\n` +
                `🔑 Your Code: ${refCode}\n\n` +
                `📢 Share with companions to earn +1 Point each:\nhttps://m.me/TimelessCreationsRP?ref=${refCode}`;

              await callSendAPI(psid, { text: successMsg, quick_replies: menuButtons });
              continue;
            } else {
              await callSendAPI(psid, `⚠️ Please submit all 3 details:\n\nElder Smith\nJohn.Smith@missionary.org\nJuly 2026`);
              continue;
            }
          }

          // 5. Verified User Actions
          const userRows = await queryTurso("SELECT * FROM missionaries WHERE psid = ? UNION SELECT * FROM recipients WHERE psid = ?", [psid, psid]);
          const user = userRows[0] || null;
          const today = new Date().toISOString().split('T')[0];

          // SINGLE COMPREHENSIVE FAQS MESSAGE
          if (msg === "PAYLOAD_FAQS" || msg.toLowerCase().includes("faq") || msg.toLowerCase().includes("help")) {
            const fullFaq = `❓ 𝐓𝐈𝐌𝐄𝐋𝐄𝐒𝐒 𝐂𝐑𝐄𝐀𝐓𝐈𝐎𝐍𝐒 𝐑𝐄𝐖𝐀𝐑𝐃𝐒 (𝐓𝐂𝐑𝐏) 𝐅𝐀𝐐𝐬\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `💰 𝟏. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐞𝐚𝐫𝐧 𝐩𝐨𝐢𝐧𝐭𝐬?\n` +
              `• Welcome Bonus: 1 Pt upon joining (2 Pts if pre-listed).\n` +
              `• Mutual Referrals: +1 Point for YOU and +1 Point for your friend whenever they join with your code!\n\n` +
              `📦 𝟐. 𝐂𝐫𝐚𝐟𝐭𝐬𝐦𝐚𝐧𝐬𝐡𝐢𝐩 & 𝐃𝐞𝐥𝐢𝐯𝐞𝐫𝐲\n` +
              `• We craft by "Gawa muna bago bayad".\n` +
              `• Handcrafted in Nueva Vizcaya and dispatched to mission homes/apartments nationwide.\n\n` +
              `🎟️ 𝟑. 𝐇𝐨𝐰 𝐝𝐨 𝐈 𝐫𝐞𝐝𝐞𝐞𝐦?\n` +
              `• Tap "🎁 Catalog & Redeem" below, swipe to your reward, and tap Redeem to generate your instant order ticket.\n\n` +
              `👑 𝟒. 𝐂𝐚𝐭𝐚𝐥𝐨𝐠 𝐑𝐞𝐰𝐚𝐫𝐝𝐬\n` +
              `• Temple Keychain: 6 Pts\n` +
              `• Nametag Keychain: 24 Pts\n` +
              `• Salvation Kit (POS): 42 Pts\n` +
              `• Scripture Case: 60 Pts`;

            await callSendAPI(psid, { text: fullFaq, quick_replies: menuButtons });
            continue;
          }

          // CATALOG & REDEEM AS ONE
          if (msg === "PAYLOAD_CATALOG" || msg.toLowerCase().includes("catalog") || msg.toLowerCase().includes("store")) {
            await callSendAPI(psid, `🎁 𝐓𝐂𝐑𝐏 𝐑𝐄𝐖𝐀𝐑𝐃𝐒 𝐂𝐀𝐓𝐀𝐋𝐎𝐆\nYour Balance: 💰 ${user?.points || 0} Point(s)\n\nSwipe items below and tap Redeem to claim directly:`);
            await callSendAPI(psid, getCatalogCarouselPayload());
            continue;
          }

          // REDEMPTIONS
          if (msg.startsWith("REDEEM_") || msg.toUpperCase().startsWith("REDEEM")) {
            let cost = 6;
            let item = "Temple Keychain";

            if (msg.includes("NAMETAG")) { cost = 24; item = "Nametag Keychain"; }
            else if (msg.includes("SALVATION") || msg.includes("POS")) { cost = 42; item = "Salvation Kit (POS)"; }
            else if (msg.includes("SCRIPTURE")) { cost = 60; item = "Scripture Case"; }

            const userPts = Number(user?.points) || 0;
            if (userPts < cost) {
              await callSendAPI(psid, {
                text: `✕ Insufficient Points!\n\nYou currently have ${userPts} point(s), but ${item} requires ${cost} points.\n\nShare your link to earn +1 point for every missionary who joins!`,
                quick_replies: menuButtons
              });
            } else {
              const orderId = `TX-` + crypto.randomBytes(4).toString('hex').toUpperCase();
              const newBalance = userPts - cost;

              await queryTurso("UPDATE missionaries SET points = ? WHERE psid = ?", [newBalance, psid]);
              await queryTurso(`
                INSERT INTO orders (order_id, psid, email, name, item, points_cost, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))
              `, [orderId, psid, user?.email || 'N/A', user?.full_name || user?.name || 'Missionary', item, cost]);

              const receipt = `🎟️ 𝐑𝐄𝐃𝐄𝐌𝐏𝐓𝐈𝐎🇳 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐄𝐃!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Order Ref: ${orderId}\n` +
                `Item: ${item}\n` +
                `Cost: ${cost} Points\n` +
                `Remaining Balance: ${newBalance} Pt(s)\n` +
                `Status: ⏳ PENDING DISPATCH\n\n` +
                `We will craft your reward and notify you once ready!`;

              await callSendAPI(psid, { text: receipt, quick_replies: menuButtons });
            }
            continue;
          }

          // DASHBOARD
          if (msg === "PAYLOAD_DASHBOARD" || msg.toLowerCase().includes("dashboard") || msg.toLowerCase().includes("points")) {
            const shareLink = `https://m.me/TimelessCreationsRP?ref=${user?.referral_code || 'TCRP'}`;
            const dashboard = `🏆 𝐌𝐈𝐒𝐒𝐈𝐎𝐍𝐀𝐑𝐘 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃\n━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 Registered: ${user?.full_name || user?.name || 'Missionary'}\n` +
              `✉️ Email: ${user?.email || 'N/A'}\n` +
              `💰 Balance: ${user?.points || 0} Point(s)\n` +
              `🔑 Code: ${user?.referral_code || 'TCRP'}\n\n` +
              `📢 𝐒𝐡𝐚𝐫𝐞 & 𝐄𝐚𝐫𝐧 (+1 Pt Each for You & Invitee):\n${shareLink}`;

            await callSendAPI(psid, { text: dashboard, quick_replies: menuButtons });
            continue;
          }

          // DEFAULT
          await callSendAPI(psid, {
            text: `Hello ${user?.full_name || user?.name || 'Missionary'}! How can we assist you today?`,
            quick_replies: menuButtons
          });
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(404).send('Not Found');
}
