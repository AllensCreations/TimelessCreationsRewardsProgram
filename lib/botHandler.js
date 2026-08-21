import { runSql } from './db.js';
import { logSystemEvent } from './logger.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();

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
    return false;
  }
}

// Helper to render full dashboard & carousel
async function renderDashboardAndCarousel(psid, prefixMessage = "") {
  const missionaryRows = await runSql("SELECT name, email, points, referral_code FROM missionaries WHERE psid = ?", [psid]);
  const missionary = missionaryRows[0];

  if (missionary) {
    const refCode = missionary.referral_code || "N/A";
    const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;

    const refUsageRows = await runSql("SELECT count(*) as count FROM sessions WHERE invite_code = ?", [refCode]);
    const totalReferred = refUsageRows[0]?.count || 0;

    let notifBanner = "";
    if (totalReferred > 0) {
      notifBanner = `\n🔔 REFERRAL NOTIFICATION: ${totalReferred} missionary companion(s) joined using your code!\n`;
    }

    const greeting = prefixMessage ? `${prefixMessage}\n\n` : "";
    const dashboardMsg = `${greeting}📊 MISSIONARY DASHBOARD
${notifBanner}
👤 Information:
• ${missionary.name}
• ${missionary.email}

⭐ Points Balance:
• ${missionary.points || 0} Points

💌 Your Invitation Link & Code:
• Code: ${refCode}
• 1-Tap Invite Link:
${inviteLink}

(Share this link with fellow missionaries. When they verify, you BOTH get +1 Point!)`;

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

💡 Tap 'Get Started' below to verify your official @missionary.org email, activate your profile, and receive your welcome point + referral link!`;

    await sendTextWithQuickReplies(psid, guestMsg, [
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
  }

  const products = await runSql("SELECT name, price, image_url FROM product_catalog ORDER BY id ASC");
  await sendProductCarousel(psid, products);
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

const ABOUT_TEXT = `✨ ABOUT TIMELESS CREATIONS REWARDS PROGRAM (TCRP)

Timeless Creations RP is an exclusive reward initiative designed to uplift, encourage, and support currently serving full-time LDS missionaries across the Philippines.

• Earn Points through regular participation and peer referrals.
• Redeem custom hand-crafted gear (Nametags, Keychains, Scripture Cases, Salvation Kits).
• Receive uplifting monthly drip letters throughout your 18 or 24-month mission.`;

const TC_TEXT = `📜 TERMS & CONDITIONS (T&C)

1. Eligibility: Currently serving Elders and Sisters with active @missionary.org email addresses.
2. 1:1 Referral Rule: You earn +1 point on verification. Each verified referral adds +1 point to both parties.
3. Order Claims: Rewards are redeemed with earned points and verified by staff with your unique Reference ID.
4. Non-Transferable: Points cannot be exchanged for cash.`;

const PRIVACY_TEXT = `🔒 PRIVACY POLICY (TCRP)

• Information Collected: Page-Scoped ID (PSID), official @missionary.org email, missionary title/name, and reward activity.
• Data Usage: Strictly utilized for reward point tracking, verification codes, and custom order delivery.
• Third Parties: Powered securely via Turso DB, Vercel, and Brevo SMTP. Data is never sold or traded.
• Data Deletion: Type "/delete_account" anytime to wipe your profile and points.`;

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

  // Persistent Menu Trigger: About
  if (lower === 'about' || payload === 'MENU_ABOUT_PAYLOAD') {
    await sendTextWithQuickReplies(psid, ABOUT_TEXT, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "📜 Terms", payload: "MENU_TC_PAYLOAD" }
    ]);
    return;
  }

  // Persistent Menu Trigger: Terms & Conditions
  if (lower === 't&c' || lower === 'terms' || payload === 'MENU_TC_PAYLOAD') {
    await sendTextWithQuickReplies(psid, TC_TEXT, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "🔒 Privacy Policy", payload: "MENU_PRIVACY_PAYLOAD" }
    ]);
    return;
  }

  // Persistent Menu Trigger: Privacy Policy
  if (lower.includes('privacy') || payload === 'MENU_PRIVACY_PAYLOAD') {
    await sendTextWithQuickReplies(psid, PRIVACY_TEXT, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" },
      { title: "✨ Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  // Trigger: FAQs
  if (lower === 'faqs' || payload === 'FAQS_PAYLOAD') {
    await sendTextWithQuickReplies(psid, FAQ_TEXT, [
      { title: "🛍️ Discover", payload: "DISCOVER_PAYLOAD" }
    ]);
    return;
  }

  // Trigger: DISCOVER / DASHBOARD
  if (lower === 'discover' || lower === 'dashboard' || payload === 'DISCOVER_PAYLOAD' || payload === 'CATALOG_PAYLOAD') {
    await renderDashboardAndCarousel(psid);
    return;
  }

  // FLOW 1: GET STARTED (Checks if already registered first)
  if (lower === 'get started' || payload === 'GET_STARTED' || session.state === 'START') {
    const existingMissionary = await runSql("SELECT name FROM missionaries WHERE psid = ?", [psid]);
    
    if (existingMissionary && existingMissionary.length > 0) {
      const name = existingMissionary[0].name || "Missionary";
      await renderDashboardAndCarousel(psid, `👋 Welcome back, ${name}!`);
      return;
    }

    // New user flow
    await runSql("UPDATE sessions SET state = 'AWAITING_REFERRAL' WHERE psid = ?", [psid]);
    
    await sendTextWithQuickReplies(
      psid,
      "✨ Welcome to Timeless Creations Rewards Program (TCRP)!\n\nAn exclusive platform for full-time LDS missionaries across the Philippines.\n\nDo you have a Referral / Invitation Code?",
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

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);

      await renderDashboardAndCarousel(psid, `🎉 Congratulations ${session.temp_title}! Your account is verified and active with 1 Welcome Point!`);
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

  // Account Deletion
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
