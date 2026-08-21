import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();

async function callSendAPI(payload) {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
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
      { name: "Temple Keychain", price: 6, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
      { name: "Nametag Keychain", price: 24, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
      { name: "Salvation Kit", price: 42, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" },
      { name: "Scripture Case", price: 60, image_url: "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png" }
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
        payload: `REDEEM_${(p.name || '').toUpperCase().replace(/\s+/g, '_')}`
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
          elements: elements
        }
      }
    }
  };
  return await callSendAPI(payload);
}

async function sendOtpEmail(email, otp) {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY missing. Cannot send OTP.");
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations RP", email: "verify@timelesscreationsrp.com" },
        to: [{ email }],
        subject: `🔐 Your TCRP Verification Code: ${otp}`,
        htmlContent: `
          <div style="font-family:Georgia,serif;padding:24px;border:1px solid #c9a84c;max-width:440px;margin:0 auto;background:#fdfaf3;">
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
    console.error("Error sending OTP email:", e.message);
    return false;
  }
}

const FAQ_TEXT = `📖 FREQUENTLY ASKED QUESTIONS (FAQs)

1. What is TCRP?
An exclusive rewards platform by Timeless Creations for missionaries to earn points for custom gear.

2. Who is eligible?
Currently serving Elders and Sisters with a valid @missionary.org email address.

3. How do I get an Invitation Code?
You strictly need a valid invitation code from a fellow missionary to join.

4. How do referrals work?
1:1 Rule: You get +1 Point upon verification. When someone uses your code and verifies, you BOTH get +1 Point.

5. Reward Costs:
• Temple Keychain: 6 Points
• Nametag Keychain: 24 Points
• Salvation Kit: 42 Points
• Scripture Case: 60 Points

6. Missing OTP Code?
Check spam in @missionary.org or reply to re-prompt code generation.

7. After Redeeming?
Present your Reference ID (X#X#X#) to page staff for fulfillment.

8. Can I use personal emails (Gmail)?
No, only official @missionary.org addresses are accepted.

9. How to check points?
Tap "🛍️ Discover" anytime.

10. Is my information safe?
Yes, data is securely stored solely for reward tracking and order fulfillment.`;

export async function handleBotMessage(psid, rawMessage, payload = null) {
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();

  await logSystemEvent('INFO', `Messenger Event from PSID ${psid}: ${text || payload || '[Action]'}`);

  // Fetch or initialize session
  const sessionRows = await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]);
  let session = sessionRows[0] || null;

  if (!session) {
    await runSql("INSERT INTO sessions (psid, state) VALUES (?, 'START')", [psid]);
    session = { psid, state: 'START', invite_code: null, temp_title: null, temp_email: null, otp_code: null };
  }

  // Common quick pills
  const defaultPills = [
    { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
    { title: "📖 FAQs", payload: "FAQS_PAYLOAD" },
    { title: "✨ Get Started", payload: "GET_STARTED" }
  ];

  // Trigger: FAQs
  if (lower === 'faqs' || payload === 'FAQS_PAYLOAD') {
    await sendTextWithQuickReplies(psid, FAQ_TEXT, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  // Trigger: DISCOVER / DASHBOARD FLOW
  if (lower === 'discover' || lower === 'catalog' || lower === 'dashboard' || payload === 'DISCOVER_PAYLOAD' || payload === 'CATALOG_PAYLOAD') {
    const missionaryRows = await runSql("SELECT name, email, points, referral_code FROM missionaries WHERE psid = ?", [psid]);
    const missionary = missionaryRows[0];

    if (missionary) {
      const refCode = missionary.referral_code || "N/A";
      const dashboardMsg = `📊 MISSIONARY DASHBOARD

👤 Information:
• ${missionary.name}
• ${missionary.email}

⭐ Points Balance:
• ${missionary.points || 0} Points

💌 How to Invite & Earn Points:
1. Share your Referral Code: 👉 ${refCode}
2. When a fellow missionary taps 'Get Started' and enters your code, you BOTH receive +1 Reward Point upon verification!`;

      await sendTextWithQuickReplies(psid, dashboardMsg);
    } else {
      const guestMsg = `📊 MISSIONARY DASHBOARD

👤 Information:
• Guest Missionary (Unlinked)
• Status: Not yet verified

⭐ Points Balance:
• 0 Points

💡 Tap 'Get Started' to verify your @missionary.org email, activate your profile, and receive your welcome point + referral code!`;

      await sendTextWithQuickReplies(psid, guestMsg, [
        { title: "✨ Get Started", payload: "GET_STARTED" }
      ]);
    }

    // Display Reward Carousel
    const products = await runSql("SELECT name, price, image_url FROM product_catalog ORDER BY id ASC");
    await sendProductCarousel(psid, products);
    return;
  }

  // FLOW 1: GET STARTED
  if (lower === 'get started' || payload === 'GET_STARTED' || session.state === 'START') {
    await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
    
    await sendTextWithQuickReplies(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\nAn exclusive platform for full-time LDS missionaries across the Philippines to receive monthly encouragement letters and earn points for custom missionary gear.\n\nDo you have a Referral / Invitation Code?",
      [
        { title: "⏭️ Skip Referral", payload: "SKIP_REFERRAL" }
      ]
    );
    return;
  }

  // FLOW 2: REFERRAL CODE OR SKIP
  if (session.state === 'AWAITING_REFERRAL') {
    let inviteCode = null;
    if (payload !== 'SKIP_REFERRAL' && !lower.includes('skip')) {
      inviteCode = text.trim().toUpperCase();
    }

    await runSql("UPDATE sessions SET state = 'AWAITING_TERMS', invite_code = ? WHERE psid = ?", [inviteCode, psid]);
    
    await sendTextWithQuickReplies(
      psid,
      "📜 Terms & Privacy Policy:\n\n1. Strictly for serving Elders and Sisters with official @missionary.org email addresses.\n2. Points are earned through verified activity & referrals.\n3. Your details will strictly be used for reward order fulfillment.\n\nDo you agree to continue?",
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
      await sendTextWithQuickReplies(psid, "You have declined the Terms. Whenever you are ready to join, tap 'Get Started' below.", [
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

  // FLOW 4: NAME AND EMAIL INPUT
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await runSql(
      "UPDATE sessions SET state = 'AWAITING_OTP', temp_title = ?, temp_email = ?, otp_code = ? WHERE psid = ?",
      [nameInput, emailInput, otp, psid]
    );

    await sendOtpEmail(emailInput, otp);

    await sendTextWithQuickReplies(
      psid,
      `📧 We sent a 6-digit OTP verification code to:\n${emailInput}\n\nPlease type the 6-digit code below (e.g. 123456) to verify your account:`,
      [
        { title: "🔄 Resend Code", payload: "RESEND_OTP" }
      ]
    );
    return;
  }

  // FLOW 5: OTP VERIFICATION
  if (session.state === 'AWAITING_OTP') {
    if (payload === 'RESEND_OTP' || lower.includes('resend')) {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      await runSql("UPDATE sessions SET otp_code = ? WHERE psid = ?", [newOtp, psid]);
      await sendOtpEmail(session.temp_email, newOtp);
      await sendTextWithQuickReplies(psid, `🔄 A new 6-digit verification code has been dispatched to ${session.temp_email}. Please enter it below:`);
      return;
    }

    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const refCode = "TC-" + Math.random().toString(36).substring(2, 7).toUpperCase();
      const cohort = session.temp_title.toLowerCase().includes('sister') ? 'sister' : 'elder';
      const maxMonths = cohort === 'sister' ? 18 : 24;

      await runSql(`
        INSERT INTO missionaries (email, name, last_name, cohort, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, ?, 1, ?, ?, 'active', ?)
        ON CONFLICT(email) DO UPDATE SET psid = excluded.psid, status = 'active'
      `, [session.temp_email, session.temp_title, session.temp_title.split(' ').pop(), cohort, refCode, psid, maxMonths]);

      if (session.invite_code) {
        await runSql("UPDATE missionaries SET points = points + 1 WHERE referral_code = ?", [session.invite_code]);
      }

      await runSql("UPDATE sessions SET state = 'VERIFIED' WHERE psid = ?", [psid]);

      // Show Dashboard format upon completion
      const successMsg = `🎉 Congratulations ${session.temp_title}! Your account is verified and active!

📊 MISSIONARY DASHBOARD

👤 Information:
• ${session.temp_title}
• ${session.temp_email}

⭐ Points Balance:
• 1 Point (Welcome Bonus)

💌 How to Invite & Earn Points:
1. Share your Referral Code: 👉 ${refCode}
2. When fellow missionaries register using your code, you BOTH receive +1 Point!`;

      await sendTextWithQuickReplies(psid, successMsg);

      // Display Discover Carousel
      const products = await runSql("SELECT name, price, image_url FROM product_catalog ORDER BY id ASC");
      await sendProductCarousel(psid, products);

      // Send 10 FAQs
      await sendTextWithQuickReplies(psid, FAQ_TEXT, [
        { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
      ]);
      return;
    } else {
      await sendTextWithQuickReplies(
        psid,
        "❌ Incorrect 6-digit OTP code. Please recheck your email or tap 'Resend Code'.",
        [
          { title: "🔄 Resend Code", payload: "RESEND_OTP" }
        ]
      );
      return;
    }
  }

  // Fallback
  await sendTextWithQuickReplies(
    psid,
    `👋 Hello! How can Timeless Creations assist your missionary journey today?`,
    defaultPills
  );
}
