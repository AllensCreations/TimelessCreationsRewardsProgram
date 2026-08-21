import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();
const ADMIN_PSID = (process.env.ADMIN_PSID || '').trim();

function generateXNXNXN() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let res = "";
  for (let i = 0; i < 3; i++) {
    res += letters.charAt(Math.floor(Math.random() * letters.length));
    res += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return res;
}

async function callSendAPI(payload) {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
    try {
      await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [
        payload.recipient?.id,
        payload.message?.text || "[Template/Carousel]"
      ]);
    } catch(e){}

    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error("Messenger API Error:", err.message);
  }
}

export async function sendTextWithQuickReplies(psid, text, quickReplies = []) {
  const payload = {
    recipient: { id: psid },
    message: { text }
  };
  if (quickReplies.length > 0) {
    payload.message.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload || qr.title
    }));
  }
  return await callSendAPI(payload);
}

export async function sendProductCarousel(psid, products = []) {
  if (!products || products.length === 0) {
    products = [
      { id: 1, name: "Temple Keychain", price: 6, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
      { id: 2, name: "Nametag Keychain", price: 24, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
      { id: 3, name: "Salvation Kit", price: 42, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
      { id: 4, name: "Scripture Case", price: 60, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" }
    ];
  }

  const elements = products.slice(0, 10).map(p => ({
    title: p.name,
    subtitle: `Cost: ${p.price || 0} PTS`,
    image_url: p.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
    buttons: [
      {
        type: "postback",
        title: `Claim (${p.price || 0} Pts)`,
        payload: `REDEEM_ITEM_${p.id || p.name.toUpperCase().replace(/\s+/g, '_')}`
      }
    ]
  }));

  const payload = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          image_aspect_ratio: "square",
          elements: elements
        }
      }
    }
  };
  return await callSendAPI(payload);
}

async function sendOtpEmail(email, otp) {
  if (!BREVO_API_KEY) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations RP", email: "noreply.timelesscreations.ph@gmail.com" },
        to: [{ email }],
        subject: `🔐 Your TCRP Verification Code: ${otp}`,
        htmlContent: `
          <div style="font-family:Georgia,serif;padding:24px;border:1px solid #c9a84c;max-width:440px;margin:0 auto;background:#fdfaf3;border-radius:8px;">
            <h2 style="color:#8b1a1a;margin-top:0;">TCRP Account Verification</h2>
            <p>Here is your 6-digit verification code to join the Timeless Creations Rewards Program:</p>
            <div style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#1a1a1a;padding:12px;background:#fff;border:1px solid #e0d6bc;text-align:center;margin:16px 0;">${otp}</div>
            <p style="font-size:12px;color:#78716c;">This code will expire shortly. If you did not request this, please disregard.</p>
          </div>
        `
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function notifyAdminNewClaim(missionary, item, cost, refId) {
  const alertMsg = `🚨 [NEW CLAIM] ${missionary.name} (${missionary.email}) redeemed "${item}" for ${cost} Pts! Reference ID: #${refId}`;
  await logSystemEvent('ORDER', alertMsg);
  
  if (ADMIN_PSID) {
    await callSendAPI({
      recipient: { id: ADMIN_PSID },
      message: { text: alertMsg }
    });
  }
}

async function renderDashboardAndCarousel(psid, prefixMessage = "") {
  const missionaryRows = await runSql("SELECT name, email, points, referral_code FROM missionaries WHERE psid = ?", [psid]);
  const missionary = missionaryRows[0];

  if (missionary) {
    const refCode = missionary.referral_code || "N/A";
    const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;

    const refUsageRows = await runSql("SELECT count(*) as count FROM missionaries WHERE referral_code = ? AND psid != ?", [refCode, psid]);
    const totalReferred = refUsageRows[0]?.count || 0;

    let notifBanner = "";
    if (totalReferred > 0) {
      notifBanner = `\n🔔 REFERRAL NOTIFICATION: ${totalReferred} companion(s) joined using your code!\n`;
    }

    const greeting = prefixMessage ? `${prefixMessage}\n\n` : "";
    const dashboardMsg = `${greeting}📊 MISSIONARY DASHBOARD
${notifBanner}
👤 Information:
• ${missionary.name}
• ${missionary.email}

⭐ Points Balance:
• ${missionary.points || 0} Points

💌 Your Invitation Link & Referral Code:
• Referral Code: 👉 ${refCode} (X#X#X#)
• 1-Tap Invite Link:
${inviteLink}

(When fellow missionaries verify using your code, you BOTH receive +1 Reward Point!)`;

    await sendTextWithQuickReplies(psid, dashboardMsg, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
    ]);
  } else {
    const guestMsg = `${prefixMessage ? prefixMessage + "\n\n" : ""}📊 MISSIONARY DASHBOARD

👤 Information:
• Guest Missionary (Unlinked)
• Status: Not yet verified

⭐ Points Balance:
• 0 Points

💡 Tap 'Get Started' below to enter your referral code and verify your official @missionary.org email!`;

    await sendTextWithQuickReplies(psid, guestMsg, [
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
  }

  const products = await runSql("SELECT id, name, price, image_url FROM product_catalog WHERE type = 'reward' OR type IS NULL ORDER BY id ASC");
  await sendProductCarousel(psid, products);
}

const FAQ_TEXT = `📖 FREQUENTLY ASKED QUESTIONS (FAQs)

1. What is TCRP?
An exclusive rewards platform by Timeless Creations for missionaries to earn points for custom gear.

2. Who is eligible?
Currently serving Elders and Sisters with a valid @missionary.org email address.

3. How do I get an Invitation Code?
You strictly need a valid invitation code (e.g. A4K9M2) from a fellow missionary or the active global code.

4. How do referrals work?
1:1 Rule: You get +1 Point upon verification. When someone uses your code and verifies, you BOTH get +1 Point.

5. Reward Costs:
• Temple Keychain: 6 Points
• Nametag Keychain: 24 Points
• Salvation Kit: 42 Points
• Scripture Case: 60 Points

6. Missing OTP Code?
Check spam in @missionary.org or tap 'Resend Code'.`;

const ABOUT_TEXT = `✨ ABOUT TIMELESS CREATIONS REWARDS PROGRAM (TCRP)

Timeless Creations RP is an exclusive reward initiative designed to uplift, encourage, and support currently serving full-time LDS missionaries across the Philippines.

• Earn Points through regular participation and peer referrals.
• Redeem custom hand-crafted gear (Nametags, Keychains, Scripture Cases, Salvation Kits).
• Receive uplifting monthly drip letters throughout your 18 or 24-month mission.`;

const TC_TEXT = `📜 TERMS & CONDITIONS (T&C)

1. Eligibility: Currently serving Elders and Sisters with active @missionary.org email addresses.
2. 1:1 Referral Rule: You earn +1 point on verification. Each verified referral adds +1 point to both parties.
3. Anti-Exploit: Self-referrals and duplicate accounts are strictly blocked.
4. Order Claims: Rewards are redeemed with earned points and verified by staff with your unique Reference ID.`;

const PRIVACY_TEXT = `🔒 PRIVACY POLICY (TCRP)

• Information Collected: Page-Scoped ID (PSID), official @missionary.org email, missionary title/name, and reward activity.
• Data Usage: Strictly utilized for reward point tracking, verification codes, and custom order delivery.
• Third Parties: Powered securely via Turso DB, Vercel, and Brevo SMTP. Data is never sold or traded.
• Data Deletion: Type "/delete_account" anytime to wipe your profile and points.`;

export async function handleBotMessage(psid, rawMessage, payload = null) {
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();

  await logSystemEvent('INFO', `Messenger Event from PSID ${psid}: ${text || payload || '[Action]'}`);
  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || payload || "[Action]"]);
  } catch(e){}

  // Claim Order Handling
  if (payload && (payload.startsWith('REDEEM_ITEM_') || payload.startsWith('REDEEM_'))) {
    const missionaryRows = await runSql("SELECT email, name, points FROM missionaries WHERE psid = ?", [psid]);
    const missionary = missionaryRows[0];

    if (!missionary) {
      await sendTextWithQuickReplies(psid, "⚠️ You must be a verified missionary to claim rewards. Please tap 'Get Started' to activate your account.", [
        { title: "✨ Get Started", payload: "GET_STARTED" }
      ]);
      return;
    }

    const itemIdentifier = payload.replace(/^REDEEM_ITEM_|^REDEEM_/, '');
    const productRows = await runSql("SELECT id, name, price FROM product_catalog WHERE id = ? OR UPPER(REPLACE(name, ' ', '_')) = ?", [itemIdentifier, itemIdentifier]);
    const product = productRows[0];

    if (!product) {
      await sendTextWithQuickReplies(
        psid,
        "🙏 We sincerely apologize, but this reward item is currently unavailable or being updated in our catalog.\n\nPlease browse our active available rewards below:",
        [{ title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }]
      );
      const activeCatalog = await runSql("SELECT id, name, price, image_url FROM product_catalog WHERE type = 'reward' OR type IS NULL ORDER BY id ASC");
      await sendProductCarousel(psid, activeCatalog);
      return;
    }

    const currentPoints = Number(missionary.points) || 0;
    const cost = Number(product.price) || 0;

    if (currentPoints < cost) {
      const needed = cost - currentPoints;
      await sendTextWithQuickReplies(
        psid,
        `⚠️ Insufficient Points!\n\nYou currently have ${currentPoints} PTS, but "${product.name}" costs ${cost} PTS. You need ${needed} more point(s) to claim this item.\n\n💡 Share your referral code with companions to earn +1 Point per referral!`,
        [{ title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }]
      );
      return;
    }

    const newPoints = currentPoints - cost;
    const refId = generateXNXNXN();

    await runSql("UPDATE missionaries SET points = ? WHERE psid = ?", [newPoints, psid]);
    await runSql("INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')", [
      refId, psid, missionary.email, missionary.name, product.name, cost
    ]);

    await notifyAdminNewClaim(missionary, product.name, cost, refId);

    const confirmationMsg = `🎉 REWARD ORDER CONFIRMED!

📦 Item: ${product.name}
⭐ Cost: ${cost} Points
💰 Remaining Points: ${newPoints} Points
🏷️ Reference ID: #${refId}

Staff will prepare your custom item. Please present Reference ID #${refId} in this chat for custom engraving details & dispatch!`;

    await sendTextWithQuickReplies(psid, confirmationMsg, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "📖 FAQs", payload: "FAQS_PAYLOAD" }
    ]);
    return;
  }

  // Fetch or initialize session
  const sessionRows = await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]);
  let session = sessionRows[0] || null;

  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at) VALUES (?, 'START', 0)", [psid]);
    session = { psid, state: 'START', invite_code: null, temp_title: null, temp_email: null, otp_code: null, last_otp_at: 0 };
  }

  // Reset Name/Email typo handler
  if (payload === 'REENTER_INFO' || lower === 'change name' || lower === 'change email') {
    await runSql("UPDATE sessions SET state = 'AWAITING_NAME_EMAIL' WHERE psid = ?", [psid]);
    await sendTextWithQuickReplies(
      psid,
      "✏️ Please type your Title & Name followed by your official @missionary.org email on the next line:\n\nExample:\nElder Smith\njohn.smith@missionary.org"
    );
    return;
  }

  if (lower === 'about' || payload === 'MENU_ABOUT_PAYLOAD') {
    await sendTextWithQuickReplies(psid, ABOUT_TEXT, [{ title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }]);
    return;
  }

  if (lower === 't&c' || lower === 'terms' || payload === 'MENU_TC_PAYLOAD') {
    await sendTextWithQuickReplies(psid, TC_TEXT, [{ title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }]);
    return;
  }

  if (lower.includes('privacy') || payload === 'MENU_PRIVACY_PAYLOAD') {
    await sendTextWithQuickReplies(psid, PRIVACY_TEXT, [{ title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }]);
    return;
  }

  if (lower === 'faqs' || payload === 'FAQS_PAYLOAD') {
    await sendTextWithQuickReplies(psid, FAQ_TEXT, [{ title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }]);
    return;
  }

  if (lower === 'discover' || lower === 'dashboard' || payload === 'DISCOVER_PAYLOAD' || payload === 'CATALOG_PAYLOAD') {
    await renderDashboardAndCarousel(psid);
    return;
  }

  // FLOW 1: GET STARTED
  if (lower === 'get started' || payload === 'GET_STARTED' || session.state === 'START') {
    const existingMissionary = await runSql("SELECT name FROM missionaries WHERE psid = ?", [psid]);
    
    if (existingMissionary && existingMissionary.length > 0) {
      const name = existingMissionary[0].name || "Missionary";
      await renderDashboardAndCarousel(psid, `👋 Welcome back, ${name}!`);
      return;
    }

    await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
    
    await sendTextWithQuickReplies(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\nAn exclusive platform for full-time LDS missionaries across the Philippines.\n\n👉 Please type your 6-character Invitation / Referral Code (e.g. A4K9M2) or the active Global Code (TCRP50) to continue:"
    );
    return;
  }

  // FLOW 2: REFERRAL CODE VALIDATION
  if (session.state === 'AWAITING_REFERRAL') {
    const inputCode = text.trim().toUpperCase();

    // Check 1: Is it a valid missionary code?
    const referrerRow = await runSql("SELECT psid, email FROM missionaries WHERE UPPER(referral_code) = ?", [inputCode]);
    
    // Check 2: Is it the global code?
    const globalRow = await runSql("SELECT code, uses_count, max_limit FROM global_referral_pool WHERE UPPER(code) = ?", [inputCode]);

    let validCode = null;

    if (referrerRow && referrerRow.length > 0) {
      // Anti-Exploit: Prevent self-referral
      if (referrerRow[0].psid === psid) {
        await sendTextWithQuickReplies(psid, "❌ Anti-Exploit Warning: You cannot use your own referral code.\n\nPlease enter a companion's referral code or the global code (TCRP50):");
        return;
      }
      validCode = inputCode;
    } else if (globalRow && globalRow.length > 0) {
      const g = globalRow[0];
      if (g.uses_count >= g.max_limit) {
        await sendTextWithQuickReplies(psid, `❌ The Global Code "${inputCode}" has reached its maximum limit of ${g.max_limit} uses.\n\nPlease enter a referral code from a fellow missionary to join.`);
        return;
      }
      validCode = inputCode;
    } else {
      await sendTextWithQuickReplies(
        psid,
        "❌ Invalid Referral Code.\n\nYou must provide a valid 6-character code (e.g. A4K9M2) or the active Global Code (TCRP50) to participate. Please type it below:"
      );
      return;
    }

    await runSql("UPDATE sessions SET state = 'AWAITING_TERMS', invite_code = ? WHERE psid = ?", [validCode, psid]);
    
    await sendTextWithQuickReplies(
      psid,
      `✅ Referral code "${validCode}" accepted!\n\n📜 Terms & Privacy Notice:\n1. Strictly for full-time Elders and Sisters with @missionary.org emails.\n2. Earn points for verified engagement & referrals.\n3. Details are used solely for reward deliveries.\n\nDo you agree to continue?`,
      [
        { title: "✅ Agree & Continue", payload: "TERMS_AGREE" },
        { title: "❌ Decline", payload: "TERMS_DECLINE" }
      ]
    );
    return;
  }

  // FLOW 3: TERMS AGREEMENT
  if (session.state === 'AWAITING_TERMS') {
    if (payload === 'TERMS_DECLINE' || lower.includes('decline')) {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextWithQuickReplies(psid, "You have declined the Terms. Tap 'Get Started' whenever you are ready.", [
        { title: "✨ Get Started", payload: "GET_STARTED" }
      ]);
      return;
    }

    if (payload === 'TERMS_AGREE' || lower.includes('agree')) {
      await runSql("UPDATE sessions SET state = 'AWAITING_NAME_EMAIL' WHERE psid = ?", [psid]);
      await sendTextWithQuickReplies(
        psid,
        "Great! Please type your Title & Name followed by your official @missionary.org email on the next line.\n\nExample:\nElder Smith\njohn.smith@missionary.org"
      );
      return;
    }
  }

  // FLOW 4: NAME AND EMAIL INPUT WITH ACCOUNT TAKEOVER PROTECTION
  if (session.state === 'AWAITING_NAME_EMAIL') {
    const emailRegex = /([a-zA-Z0-9._%+-]+@missionary\.org)/i;
    const emailMatch = text.match(emailRegex);

    if (!emailMatch) {
      await sendTextWithQuickReplies(
        psid,
        "⚠️ Invalid Email. You must provide an official @missionary.org email address.\n\nExample:\nSister Santos\nmaria.santos@missionary.org"
      );
      return;
    }

    const emailInput = emailMatch[1].toLowerCase();
    const nameInput = text.replace(emailMatch[0], '').replace(/\n/g, ' ').trim() || (emailInput.split('.')[0] || "Missionary");

    // ANTI-HIJACKING FIX: Check if email already belongs to another verified PSID
    const existingAccount = await runSql("SELECT psid, name FROM missionaries WHERE LOWER(email) = ?", [emailInput]);
    if (existingAccount && existingAccount.length > 0 && existingAccount[0].psid && existingAccount[0].psid !== psid) {
      await sendTextWithQuickReplies(
        psid,
        `⚠️ Security Notice: An active TCRP account is already linked to ${emailInput}.\n\nIf you switched Facebook accounts or need help restoring access, please message staff for assistance.`,
        [{ title: "✨ Get Started", payload: "GET_STARTED" }]
      );
      return;
    }

    // PERSISTENT DB-BACKED OTP RATE LIMITING (60s Cooldown across cold starts)
    const now = Math.floor(Date.now() / 1000);
    const lastSentAt = Number(session.last_otp_at) || 0;
    if (now - lastSentAt < 60) {
      const waitSec = 60 - (now - lastSentAt);
      await sendTextWithQuickReplies(psid, `⏳ Rate Limit: Please wait ${waitSec}s before requesting a new verification code.`);
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql(
      "UPDATE sessions SET state = 'AWAITING_OTP', temp_title = ?, temp_email = ?, otp_code = ?, last_otp_at = ? WHERE psid = ?",
      [nameInput, emailInput, otp, now, psid]
    );

    await sendOtpEmail(emailInput, otp);

    await sendTextWithQuickReplies(
      psid,
      `📧 We dispatched a 6-digit verification code to:\n${emailInput}\n\nType the 6-digit code below to verify.\n\n💡 Made a typo? Tap "✏️ Change Name/Email" below:`,
      [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" },
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]
    );
    return;
  }

  // FLOW 5: OTP VERIFICATION WITH ATOMIC COUNTERS
  if (session.state === 'AWAITING_OTP') {
    if (payload === 'RESEND_OTP' || lower.includes('resend')) {
      const now = Math.floor(Date.now() / 1000);
      const lastSentAt = Number(session.last_otp_at) || 0;
      if (now - lastSentAt < 60) {
        const waitSec = 60 - (now - lastSentAt);
        await sendTextWithQuickReplies(psid, `⏳ Rate Limit: Please wait ${waitSec}s before requesting a new code.`);
        return;
      }

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

      await runSql("UPDATE sessions SET otp_code = ?, last_otp_at = ? WHERE psid = ?", [newOtp, now, psid]);
      await sendOtpEmail(session.temp_email, newOtp);
      await sendTextWithQuickReplies(psid, `🔄 A new 6-digit verification code has been dispatched to ${session.temp_email}.`, [
        { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
      ]);
      return;
    }

    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const refCode = generateXNXNXN();
      const cohort = session.temp_title.toLowerCase().includes('sister') ? 'sister' : 'elder';
      const maxMonths = cohort === 'sister' ? 18 : 24;

      await runSql(`
        INSERT INTO missionaries (email, name, last_name, cohort, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, ?, 1, ?, ?, 'active', ?)
        ON CONFLICT(email) DO UPDATE SET psid = excluded.psid, status = 'active'
      `, [session.temp_email, session.temp_title, session.temp_title.split(' ').pop(), cohort, refCode, psid, maxMonths]);

      // ATOMIC ATTRIBUTION: Safe from race conditions & referral abuse
      if (session.invite_code) {
        if (session.invite_code === 'TCRP50') {
          await runSql("UPDATE global_referral_pool SET uses_count = uses_count + 1 WHERE code = 'TCRP50' AND uses_count < max_limit");
        } else {
          // Attribute referral bonus (+1 Point) to verified missionary
          await runSql("UPDATE missionaries SET points = points + 1 WHERE UPPER(referral_code) = ?", [session.invite_code]);
        }
      }

      // Auto-purge session to keep DB lean
      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

      await renderDashboardAndCarousel(psid, `🎉 Congratulations ${session.temp_title}! Your account is verified and active with 1 Welcome Point!`);
      return;
    } else {
      await sendTextWithQuickReplies(
        psid,
        "❌ Incorrect 6-digit OTP code. Please recheck your email, tap 'Resend Code', or tap 'Change Name/Email' if you mistyped your address.",
        [
          { title: "🔄 Resend Code", payload: "RESEND_OTP" },
          { title: "✏️ Change Name/Email", payload: "REENTER_INFO" }
        ]
      );
      return;
    }
  }

  // Account Deletion Request
  if (lower === '/delete_account') {
    await runSql("DELETE FROM missionaries WHERE psid = ?", [psid]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await sendTextWithQuickReplies(psid, "🗑️ Your profile, PSID records, and earned points have been permanently removed from our databases.");
    return;
  }

  // Fallback
  await sendTextWithQuickReplies(
    psid,
    `👋 Hello! How can Timeless Creations assist your missionary journey today?`,
    [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "✨ About TCRP", payload: "MENU_ABOUT_PAYLOAD" }
    ]
  );
}
