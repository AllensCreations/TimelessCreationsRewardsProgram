import { 
  isRateLimited, 
  checkBurstRateLimit, 
  checkDailyMessageQuota, 
  isDoubleTapDuplicate, 
  clearDebounce,
  checkDailyViewLimit, 
  checkOtpResendEligibility, 
  recordOtpResend 
} from "./security.js";
import { runSql } from './db.js';
import { sendReceiptEmail, sendOTPEmail } from './mailer.js';
import { logSystemEvent } from './logger.js';
import { getFirstMonthInfo, calculateMissionMonth } from './utils/batchCalculator.js';
import { resolveBotMaintenanceState, resolvePowerState } from './handlers/systemHandler.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
const PAGE_ID = (process.env.FB_PAGE_ID || 'TimelessCreationsRP').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();

// Converts alphanumeric text to Mathematical Sans-Serif Bold Unicode (𝗔-𝗭, 𝗮-𝘇, 𝟬-𝟵)
export function toUnicodeBold(text) {
  if (!text) return "";
  return text.replace(/[A-Za-z0-9]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65)); // A-Z
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97)); // a-z
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + (code - 48)); // 0-9
    return char;
  });
}

export function generateXNXNXN() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let res = "";
  for (let i = 0; i < 3; i++) {
    res += letters.charAt(Math.floor(Math.random() * letters.length));
    res += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return res;
}

export async function logEvent(level, message, psid = 'SYSTEM') {
  return await logSystemEvent(level, message, psid);
}

async function sendFbGraphMessage(psid, messagePayload) {
  try {
    const textPreview = messagePayload.text || (messagePayload.attachment ? `[Carousel / Template]` : '[Message]');
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'bot', ?)", [psid, textPreview]);
  } catch (_) {}

  const isMockPsid = String(psid).startsWith("TEST_") || String(psid).startsWith("SIM_");
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.startsWith('EAA_MOCK') || isMockPsid) {
    await logEvent('INFO', `(Local Sim) Message dispatched: ${JSON.stringify(messagePayload).substring(0, 80)}`, psid);
    return;
  }

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: { id: psid },
        message: messagePayload
      })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result.error) {
      const err = result.error || {};
      const errCode = err.code ? `Code ${err.code}` : `HTTP ${res.status}`;
      const errSubcode = err.error_subcode ? `Subcode ${err.error_subcode}` : '';
      const trace = err.fbtrace_id ? `[trace: ${err.fbtrace_id}]` : '';
      const errMsg = err.message || res.statusText || 'Unknown Meta API error';
      await logEvent('ERROR', `[META_API_ERROR] ${[errCode, errSubcode, errMsg, trace].filter(Boolean).join(' | ')}`, psid);
    } else {
      await logEvent('INFO', `[META_API_OK] Delivered successfully (mid: ${result.message_id || 'ok'})`, psid);
    }
  } catch (err) {
    await logEvent('ERROR', `[META_API_FAIL] Facebook network dispatch failed: ${err.message}`, psid);
  }
}

export async function sendTextMessage(psid, text, quickReplies = []) {
  const payload = { text };
  if (quickReplies && quickReplies.length > 0) {
    payload.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title ? String(qr.title).slice(0, 20) : "Option",
      payload: qr.payload || qr.title
    }));
  }
  await sendFbGraphMessage(psid, payload);
}

export async function sendTypingIndicator(psid, action = "typing_on") {
  const isMockPsid = String(psid).startsWith("TEST_") || String(psid).startsWith("SIM_") || String(psid).startsWith("AUDIT_");
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.startsWith('EAA_MOCK') || isMockPsid) {
    return;
  }
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        sender_action: action
      })
    });
  } catch (_) {}
}

export const SINGLE_QUICK_REPLY = [
  { title: "Check", payload: "ACTION_CHECK" }
];

export async function buildCatalogCarousel(senderPoints = 0, productList = null) {
  let products = productList;
  if (!products) {
    try {
      products = await runSql("SELECT id, name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
    } catch (e) {
      await logEvent('WARN', `Failed to load rewards catalog: ${e.message}`);
    }
  }

  if (!products || products.length === 0) return null;

  const elements = products.slice(0, 10).map(item => {
    const price = Number(item.price) || 0;
    const canAfford = senderPoints >= price;
    const pointDiff = price - senderPoints;

    return {
      title: toUnicodeBold(item.name),
      subtitle: `Cost: ${price} PTS (Balance: ${senderPoints} PTS)`,
      image_url: item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png",
      buttons: [
        canAfford ? {
          type: "postback",
          title: `Claim (${price} PTS)`,
          payload: `CLAIM_ITEM_${item.id}`
        } : {
          type: "postback",
          title: `Need ${pointDiff} More PTS`,
          payload: `GOAL_ITEM_${item.id}`
        }
      ]
    };
  });

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        image_aspect_ratio: "square",
        elements
      }
    },
    quick_replies: [
      { content_type: "text", title: "Check", payload: "ACTION_CHECK" }
    ]
  };
}

export async function sendGatekeeper(psid) {
  const title = toUnicodeBold("TCRP Verification Required");
  await sendTextMessage(
    psid,
    `${title}\n\nThe Timeless Creations Rewards Program is exclusively for LDS full-time missionaries with an active @missionary.org email address.\n\nJoin today to get:\n• +1 Free Welcome Reward Point\n• Exclusive missionary rewards catalog\n• Monthly encouragement packages\n\nTap below to verify your missionary account in under 60 seconds!`,
    [
      { title: "Verify & Join (+1)", payload: "GET_STARTED" },
      { title: "Help & Info", payload: "MENU_HELP" }
    ]
  );
}

export async function sendCatalogCarouselOrNote(psid, points = 0) {
  let products = [];
  try {
    products = await runSql("SELECT id, name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC LIMIT 10");
  } catch (e) {
    await logEvent('WARN', `Failed to load rewards catalog: ${e.message}`);
  }

  if (!products || products.length === 0) {
    const emptyTitle = toUnicodeBold("REWARDS CATALOG");
    await sendTextMessage(
      psid,
      `${emptyTitle}\n\nThere are currently no reward items available in the catalog. Please check back soon!`
    );
    return;
  }

  const carousel = await buildCatalogCarousel(points, products);
  if (carousel) {
    await sendFbGraphMessage(psid, carousel);
  }
}

export async function sendDashboardMessage(psid, missionary, prefixMsg = "") {
  const points = Number(missionary?.points) || 0;
  const refCode = missionary?.referral_code || "JOIN";
  const greeting = prefixMsg ? `${prefixMsg}\n\n` : "";

  const isSister = (missionary?.cohort || '').toLowerCase().includes('sister') || (missionary?.name || '').toLowerCase().startsWith('sister');

  const titleHeader = toUnicodeBold("MISSIONARY DASHBOARD");
  const infoHeader = toUnicodeBold("Profile Information:");
  const pointsHeader = toUnicodeBold("Reward Points Balance:");

  const dashboardText = `${greeting}${titleHeader}\n\n${infoHeader}\n• ${missionary?.name || 'Missionary'} (${isSister ? 'Sister' : 'Elder'})\n• ${missionary?.email || '—'}\n• Referral Code: ${refCode}\n\n${pointsHeader}\n${points} Reward Point(s)`;

  await sendTextMessage(psid, dashboardText);
}

export async function sendInviteLink(psid, missionary) {
  const refCode = missionary?.referral_code || "JOIN";
  const inviteLink = `https://m.me/${PAGE_ID}?ref=${refCode}`;
  const inviteHeader = toUnicodeBold("Invite a Companion & Earn +1 Point");

  const invitePromoText = `${inviteHeader}\n\nShare this message with your companion or district:\n\n"Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality custom missionary gear!\n\nJoin here: ${inviteLink}\n\n(When you join using my code ${refCode}, we BOTH get +1 Reward Point instantly!)"`;

  await sendTextMessage(psid, invitePromoText, SINGLE_QUICK_REPLY);
}

export async function sendVerifiedHub(psid, missionary, prefixMsg = "") {
  const points = Number(missionary?.points) || 0;
  // 1. Dashboard message
  await sendDashboardMessage(psid, missionary, prefixMsg);
  // 2. Visual Carousel or clean empty catalog notice
  await sendCatalogCarouselOrNote(psid, points);
  // 3. Companion invite link with single "Check" quick response
  await sendInviteLink(psid, missionary);
}

export const renderVerifiedDashboard = sendVerifiedHub;
export const sendRewardsCatalog = sendVerifiedHub;

export function buildDashboardPayload(missionary, referralLink) {
  const name = missionary?.name || "Missionary";
  const email = missionary?.email || "—";
  const points = Number(missionary?.points) || 0;
  const refCode = missionary?.referral_code || "JOIN";
  const link = referralLink || `https://m.me/${PAGE_ID}?ref=${refCode}`;

  const isSister = (missionary?.cohort || '').toLowerCase().includes('sister') || (missionary?.name || '').toLowerCase().startsWith('sister');

  const titleHeader = toUnicodeBold("MISSIONARY DASHBOARD");
  const infoHeader = toUnicodeBold("Profile Information:");
  const pointsHeader = toUnicodeBold("Reward Points Balance:");

  const dashboardText = `${titleHeader}\n\n${infoHeader}\n• ${name} (${isSister ? 'Sister' : 'Elder'})\n• ${email}\n• Referral Code: ${refCode}\n\n${pointsHeader}\n${points} Reward Point(s)`;

  const invitePromoText = `${toUnicodeBold("Invite a Companion & Earn +1 Point")}\n\nShare this message with your companion or district:\n\n"Hey! Join TCRP (Timeless Creations Rewards Program) to redeem high-quality custom missionary gear!\n\nJoin here: ${link}\n\n(When you join using my code ${refCode}, we BOTH get +1 Reward Point instantly!)"`;

  return {
    dashboardText,
    invitePromoText,
    text: dashboardText,
    quick_replies: SINGLE_QUICK_REPLY
  };
}

export async function sendHelpAndFaqs(psid, isVerified = false) {
  const title = toUnicodeBold("HELP & FREQUENTLY ASKED QUESTIONS");
  const faqText = `${title}\n\n1. What is TCRP?\nAn exclusive, free rewards program for LDS full-time missionaries providing high-quality custom gear, accessories, and encouragement packages.\n\n2. How do I earn Reward Points?\n• +1 Point when you verify your @missionary.org email\n• +1 Point whenever a fellow missionary joins with your referral link\n• Bonus points from monthly promo codes in our emails\n\n3. How do I redeem points for items?\nTap 'Check' to view the Rewards Catalog carousel. Tap 'Claim' on any item you have enough points for!\n\n4. Need to restart or update details?\nReply 'reset' anytime to clear your current session.`;

  const quickReplies = isVerified ? SINGLE_QUICK_REPLY : [
    { title: "Verify & Join (+1)", payload: "GET_STARTED" },
    { title: "Restart", payload: "RESET_SESSION" }
  ];

  await sendTextMessage(psid, faqText, quickReplies);
}

export async function handlePromoRedeem(psid, missionary, codeText) {
  const code = codeText.trim().toUpperCase();
  if (!code) {
    await sendTextMessage(psid, "Please specify a promo code.\n\nExample:\n/redeem SPECIALGIFT", SINGLE_QUICK_REPLY);
    return;
  }

  const promoRows = await runSql("SELECT * FROM promo_codes WHERE UPPER(code) = ? LIMIT 1", [code]);
  const promo = promoRows?.[0];

  if (!promo) {
    await sendTextMessage(psid, `Promo code "${code}" is invalid or has expired.`, SINGLE_QUICK_REPLY);
    return;
  }

  if (Number(promo.claimed_count) >= Number(promo.max_users)) {
    await sendTextMessage(psid, `Promo code "${code}" has reached its maximum user claim limit (${promo.max_users}/${promo.max_users}).`, SINGLE_QUICK_REPLY);
    return;
  }

  const alreadyClaimed = await runSql("SELECT 1 FROM promo_redemptions WHERE UPPER(code) = ? AND psid = ? LIMIT 1", [code, psid]);
  if (alreadyClaimed && alreadyClaimed.length > 0) {
    await sendTextMessage(psid, `You have already redeemed promo code "${code}".`, SINGLE_QUICK_REPLY);
    return;
  }

  const bonusPoints = Number(promo.points) || 1;
  await runSql("UPDATE promo_codes SET claimed_count = claimed_count + 1 WHERE UPPER(code) = ? AND claimed_count < max_users", [code]);
  await runSql("INSERT OR IGNORE INTO promo_redemptions (code, psid) VALUES (?, ?)", [code, psid]);
  await runSql("UPDATE missionaries SET points = points + ? WHERE psid = ?", [bonusPoints, psid]);

  await logEvent('INFO', `Promo ${code} (+${bonusPoints} PTS) redeemed by ${missionary.name} (${missionary.email})`, psid);

  const updatedMissionary = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
  const congratsHeader = toUnicodeBold("PROMO CODE REDEEMED!");

  await sendTextMessage(
    psid,
    `${congratsHeader}\n\nYou successfully claimed promo code ${code}!\n+${bonusPoints} Reward Point(s) added to your balance.\n\nNew Balance: ${updatedMissionary.points} Points.`,
    SINGLE_QUICK_REPLY
  );
}

export async function handleBotMessage(psid, rawMessage = '', payload = null, referralParam = '') {
  const text = (rawMessage || '').trim();
  const lower = text.toLowerCase();
  const cleanPayload = (payload || '').trim();
  const rawRef = (referralParam || '').trim().toUpperCase();
  const cleanRef = (rawRef.includes('DASHBOARD') || rawRef.includes('FAQS') || rawRef.length > 10) ? '' : rawRef;

  // 1. Double-Tap Debounce (3-Second Quota-Safe Deduping)
  const messageKey = cleanPayload || text || cleanRef || '[Action]';
  if (isDoubleTapDuplicate(psid, messageKey)) {
    await logEvent('INFO', `(Debounce) Rapid duplicate dropped: "${messageKey}"`, psid);
    return;
  }

  // 2. Anti-Flooding Rapid Burst Rate Limiter (Max 12 msgs / 60 seconds with Warn-Once + Friendly Notice)
  const burstCheck = await checkBurstRateLimit(psid, 12, 60);
  if (burstCheck.limited) {
    if (!burstCheck.silentDrop) {
      await logEvent('WARN', `Rate limit exceeded (12 msgs/min) - warning dispatched`, psid);
      await sendTextMessage(psid, "You are sending messages too quickly. Please wait a moment before trying again.");
    } else {
      await logEvent('WARN', `Rate limit exceeded (12 msgs/min) - drop active`, psid);
    }
    return;
  }

  await logEvent('INFO', `Inbound: text="${text}", payload="${cleanPayload}", ref="${cleanRef}"`, psid);

  try {
    await runSql("INSERT INTO chat_messages (psid, sender, message) VALUES (?, 'user', ?)", [psid, text || cleanPayload || cleanRef || '[Action]']);
  } catch (_) {}

  // Messenger Bot Maintenance & Power Mode Check
  const [botMaintState, powerState] = await Promise.all([
    resolveBotMaintenanceState(),
    resolvePowerState()
  ]);
  if (botMaintState === 'ON' || powerState === 'OFFLINE') {
    await logEvent('WARN', `Messenger bot in maintenance/offline mode (bot=${botMaintState}, power=${powerState}) - notice dispatched to PSID`, psid);
    await sendTextMessage(
      psid,
      `${toUnicodeBold("Maintenance Mode Active")}\n\nThe Timeless Creations Messenger Bot is currently undergoing scheduled maintenance & system upgrades.\n\nInteractive rewards features will return shortly! For urgent inquiries, please contact our support team directly.`
    );
    return;
  }

  // Trigger Messenger typing indicator for responsive conversation pacing
  await sendTypingIndicator(psid, "typing_on");

  // Reset keyword or payload
  if (lower === 'reset' || cleanPayload === 'RESET_SESSION' || lower === 'restart') {
    clearDebounce(psid);
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("UPDATE missionaries SET psid = NULL WHERE psid = ?", [psid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [psid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [psid]);
    await logEvent('WARN', `Session wiped via RESET keyword/action`, psid);
    await sendTextMessage(psid, "Session reset! Tap 'Get Started' below to begin:", [
      { title: "Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  // Delete Account Command (/delete_account)
  if (lower === '/delete_account' || lower === 'delete account') {
    clearDebounce(psid);
    await runSql("DELETE FROM missionaries WHERE psid = ?", [psid]);
    await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
    await runSql("DELETE FROM chat_messages WHERE psid = ?", [psid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [psid]);
    await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [psid]);
    await logEvent('INFO', `Account and session completely deleted via /delete_account`, psid);
    await sendTextMessage(psid, "Your missionary account and data have been completely deleted. You can re-register anytime by tapping below:", [
      { title: "Get Started", payload: "GET_STARTED" }
    ]);
    return;
  }

  const missionaryRows = await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]);
  const missionary = missionaryRows?.[0] || null;
  const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';

  // 3. Daily Message Quota (10 Unverified / 15 Verified) - Midnight UTC+8 Reset
  const quotaCheck = await checkDailyMessageQuota(psid, isVerified);
  if (!quotaCheck.allowed) {
    if (!quotaCheck.silentDrop) {
      await logEvent('WARN', `Daily message quota reached (${quotaCheck.current}/${quotaCheck.limit}) - notice sent`, psid);
      await sendTextMessage(
        psid,
        `You have reached today's conversation limit (${quotaCheck.limit} messages).\n\nTo ensure fair access and dependable service, your daily quota resets tonight at 12:00 AM UTC+8.\n\nThank you for your understanding!`
      );
    } else {
      await logEvent('WARN', `Daily message quota exceeded (${quotaCheck.limit}) - silent drop active`, psid);
    }
    return;
  }

  // Promo info inquiry (Quick Reply: 'Redeem Promo' or payload: PROMO_INFO)
  if (cleanPayload === 'PROMO_INFO' || lower === 'redeem promo') {
    if (!isVerified) {
      await sendGatekeeper(psid);
      return;
    }
    await sendTextMessage(
      psid,
      `${toUnicodeBold("Redeem Promo Code")}\n\nTo redeem a freebie promo code, type:\n/redeem YOURCODE\n\nExample:\n/redeem SPECIALGIFT`,
      SINGLE_QUICK_REPLY
    );
    return;
  }

  // Strict Promo Redemption Command: /redeem <CODE> or redeem <CODE>
  if (lower.startsWith('/redeem') || lower.startsWith('redeem ') || lower === 'redeem') {
    if (!isVerified) {
      await sendTextMessage(psid, "Please verify your missionary account first to redeem promo codes.", [
        { title: "Verify & Join (+1)", payload: "GET_STARTED" }
      ]);
      return;
    }
    const codePart = text.replace(/^\/?redeem\s*/i, '').trim();
    await handlePromoRedeem(psid, missionary, codePart);
    return;
  }

  // ----------------------------------------------------
  // VERIFIED MISSIONARY ROUTING
  // ----------------------------------------------------
  if (isVerified) {
    if (cleanPayload.startsWith("CLAIM_ITEM_")) {
      const prodId = cleanPayload.replace("CLAIM_ITEM_", "").trim();
      const prod = (await runSql("SELECT * FROM product_catalog WHERE id = ? LIMIT 1", [prodId]))[0];

      if (!prod) {
        await sendTextMessage(psid, "Selected reward item is no longer available.", SINGLE_QUICK_REPLY);
        return;
      }

      const cost = Number(prod.price) || 0;
      const currentM = (await runSql("SELECT points, email, name FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
      const userPts = Number(currentM?.points ?? missionary.points) || 0;

      if (userPts < cost) {
        const diff = cost - userPts;
        await sendTextMessage(psid, `You need ${diff} more Point(s) to claim "${prod.name}".\n\nTip: Invite a companion to get +1 Point instantly!`, SINGLE_QUICK_REPLY);
        return;
      }

      const orderId = `TCRP${Math.floor(10000 + Math.random() * 90000)}`;
      await runSql("UPDATE missionaries SET points = points - ? WHERE psid = ? AND points >= ?", [cost, psid, cost]);
      await runSql(
        "INSERT INTO orders (order_id, psid, email, name, item, points_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')",
        [orderId, psid, currentM?.email || missionary.email, currentM?.name || missionary.name, prod.name, cost]
      );

      await sendReceiptEmail(currentM?.email || missionary.email, {
        name: currentM?.name || missionary.name,
        order_id: orderId,
        item: prod.name,
        points_cost: cost
      }).catch(() => {});

      const claimTitle = toUnicodeBold(`CONGRATULATIONS, ${missionary.name}!`);

      await sendTextMessage(
        psid,
        `${claimTitle}\n\nYou have successfully claimed:\n• Item: ${prod.name}\n• Points Used: ${cost} PTS\n• Order ID: ${orderId}\n\nWe emailed your redemption receipt to ${missionary.email}.`,
        SINGLE_QUICK_REPLY
      );
      return;
    }

    if (cleanPayload.startsWith("GOAL_ITEM_")) {
      const prodId = cleanPayload.replace("GOAL_ITEM_", "").trim();
      const prod = (await runSql("SELECT * FROM product_catalog WHERE id = ? LIMIT 1", [prodId]))[0];
      const cost = Number(prod?.price) || 0;
      const currentM = (await runSql("SELECT points FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];
      const userPts = Number(currentM?.points ?? missionary.points) || 0;
      const diff = Math.max(1, cost - userPts);

      await sendTextMessage(
        psid,
        `${toUnicodeBold(prod?.name || "Reward Item")}\n\nCost: ${cost} PTS\nYour Balance: ${userPts} PTS\nGoal: Need ${diff} more Point(s) to unlock this gift!\n\nEarn points faster by inviting your companion (+1 Pt) or waiting for monthly encouragement deliveries!`,
        SINGLE_QUICK_REPLY
      );
      return;
    }

    if (cleanPayload === 'INVITE_COMPANION' || lower === 'invite') {
      await sendInviteLink(psid, missionary);
      return;
    }

    if (cleanPayload === 'MENU_HELP' || cleanPayload === 'FAQS_PAYLOAD' || lower === 'help' || lower === 'faqs') {
      await sendHelpAndFaqs(psid, true);
      return;
    }

    if (cleanPayload === 'PROMO_INFO') {
      await sendTextMessage(
        psid,
        `${toUnicodeBold("Redeem Promo Code")}\n\nTo redeem a freebie promo code, type:\n/redeem YOURCODE\n\nExample:\n/redeem SPECIALGIFT`,
        SINGLE_QUICK_REPLY
      );
      return;
    }

    if (cleanPayload === 'ACTION_CHECK' || cleanPayload === 'ACTION_DASHBOARD' || cleanPayload === 'MENU_DASHBOARD' || cleanPayload === 'MENU_REWARDS' || cleanPayload === 'DISCOVER_PAYLOAD' || lower === 'check' || lower === 'dashboard' || lower === 'my dashboard' || lower === 'rewards' || lower === 'catalog') {
      await sendVerifiedHub(psid, missionary);
      return;
    }

    // Default for verified missionary: any chat renders the unified hub (Dashboard + Carousel + Invite)
    await sendVerifiedHub(psid, missionary);
    return;
  }

  // ----------------------------------------------------
  // UNVERIFIED / NEW USER ROUTING
  // ----------------------------------------------------

  // Persistent menu items tapped by unverified user: Friendly Gatekeeper
  if (cleanPayload === 'ACTION_CHECK' || cleanPayload === 'ACTION_DASHBOARD' || cleanPayload === 'MENU_REWARDS' || cleanPayload === 'DISCOVER_PAYLOAD' || cleanPayload === 'PROMO_INFO' || cleanPayload === 'INVITE_COMPANION') {
    await sendGatekeeper(psid);
    return;
  }

  if (cleanPayload === 'MENU_HELP' || cleanPayload === 'FAQS_PAYLOAD' || lower === 'help' || lower === 'faqs') {
    await sendHelpAndFaqs(psid, false);
    return;
  }

  let session = (await runSql("SELECT * FROM sessions WHERE psid = ? LIMIT 1", [psid]))?.[0] || null;
  if (!session) {
    await runSql("INSERT INTO sessions (psid, state, last_otp_at, failed_otp_count) VALUES (?, 'START', 0, 0)", [psid]);
    session = { psid, state: 'START', last_otp_at: 0, failed_otp_count: 0 };
  }

  // 1. Unified Registration & Terms Setup Trigger
  if (session.state === 'START' || lower === 'get started' || cleanPayload === 'GET_STARTED') {
    await runSql("UPDATE sessions SET state = 'AWAITING_ALL_IN_ONE' WHERE psid = ?", [psid]);
    const welcomeBold = toUnicodeBold("Welcome to Timeless Creations Rewards Program (TCRP)!");
    const regBold = toUnicodeBold("MISSIONARY REGISTRATION");
    await sendTextMessage(
      psid,
      `${welcomeBold}\n\n${regBold}\nPlease reply with your missionary details in one message:\n\n1. Title & Full Name (e.g. Elder John Smith or Sister Jane Doe)\n2. Email (@missionary.org)\n3. Referral Code (Optional, e.g. TCRP50)\n\nExample:\nElder John Smith\njohn.smith@missionary.org\nTCRP50\n\nNote: By entering this information, you agree to our Terms of Service & Privacy Policy.`,
      [{ title: "Cancel", payload: "RESET_SESSION" }]
    );
    return;
  }

  // 2. Terms Agreement (Backward Compatibility for existing sessions / tests)
  if (session.state === 'AWAITING_TERMS' || cleanPayload === 'TERMS_AGREE') {
    if (cleanPayload === 'TERMS_DISAGREE' || cleanPayload === 'TERMS_DECLINE' || lower.includes('disagree') || lower.includes('decline')) {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextMessage(
        psid,
        "You have declined the Terms & Conditions. You can restart anytime by tapping below:",
        [{ title: "Get Started", payload: "GET_STARTED" }]
      );
      return;
    }
    await runSql("UPDATE sessions SET state = 'AWAITING_ALL_IN_ONE' WHERE psid = ?", [psid]);
    const welcomeBold = toUnicodeBold("Welcome to Timeless Creations Rewards Program (TCRP)!");
    const regBold = toUnicodeBold("MISSIONARY REGISTRATION");
    await sendTextMessage(
      psid,
      `${welcomeBold}\n\n${regBold}\nPlease reply with your missionary details in one message:\n\n1. Title & Full Name (e.g. Elder John Smith or Sister Jane Doe)\n2. Email (@missionary.org)\n3. Referral Code (Optional, e.g. TCRP50)\n\nExample:\nElder John Smith\njohn.smith@missionary.org\nTCRP50\n\nNote: By entering this information, you agree to our Terms of Service & Privacy Policy.`,
      [{ title: "Cancel", payload: "RESET_SESSION" }]
    );
    return;
  }

  // 3. Capture Details & Send OTP
  if (session.state === 'AWAITING_DETAILS' || session.state === 'AWAITING_ALL_IN_ONE') {
    if (cleanPayload === 'RESET_SESSION' || lower === 'cancel') {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "Registration cancelled. Tap below whenever you're ready to restart:", [
        { title: "Get Started", payload: "GET_STARTED" }
      ]);
      return;
    }

    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (!emailMatch) {
      await sendTextMessage(
        psid,
        "Missing or invalid @missionary.org email address. Please send your details following the required format:\n\nElder John Smith\njohn.smith@missionary.org\nTCRP50\n\nNote: By entering this information, you agree to our Terms of Service & Privacy Policy.",
        [{ title: "Cancel", payload: "RESET_SESSION" }]
      );
      return;
    }

    const emailInput = emailMatch[1].toLowerCase();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let titleName = "Elder Missionary";
    const currentBatchMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
    let batchMonth = currentBatchMonth || "September 2026";
    let referralCode = cleanRef || "TCRP50";

    if (lines.length >= 2) {
      titleName = lines[0];
      const nonEmailLines = lines.slice(1).filter(l => !l.toLowerCase().includes('@missionary.org'));
      if (nonEmailLines.length > 0) {
        const candidate = nonEmailLines[0].trim();
        if (candidate.length >= 4 && !/^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(candidate)) {
          referralCode = candidate.toUpperCase();
        } else if (nonEmailLines.length >= 2) {
          referralCode = nonEmailLines[1].trim().toUpperCase();
        }
      }
    } else {
      const parts = text.replace(emailMatch[0], '').trim().split(/\s+/);
      if (parts.length > 0 && parts[0]) titleName = parts[0];
    }

    // Check OTP Resend Eligibility before dispatching email
    const otpEligibility = await checkOtpResendEligibility(psid, session);
    if (!otpEligibility.allowed) {
      if (otpEligibility.reason === 'COOLDOWN') {
        await sendTextMessage(
          psid,
          `Please wait ${otpEligibility.remainingSeconds}s before requesting a verification code.`,
          [{ title: "Cancel", payload: "RESET_SESSION" }]
        );
        return;
      }
      if (otpEligibility.reason === 'MAX_RESENDS_REACHED') {
        await sendTextMessage(
          psid,
          `You have reached today's verification code limit (${otpEligibility.maxResends} codes per day).\n\nPlease try again tomorrow at 12:00 AM UTC+8.`,
          [{ title: "Cancel", payload: "RESET_SESSION" }]
        );
        return;
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const nowSec = Math.floor(Date.now() / 1000);
    await recordOtpResend(psid);

    await runSql(`
      UPDATE sessions 
      SET state = 'AWAITING_OTP', 
          temp_title = ?, 
          temp_email = ?, 
          temp_batch = ?, 
          invite_code = ?, 
          otp_code = ?, 
          last_otp_at = ?,
          failed_otp_count = 0
      WHERE psid = ?
    `, [titleName, emailInput, batchMonth, referralCode, otp, nowSec, psid]);

    await logEvent('INFO', `[OTP GENERATED] Email: ${emailInput} | Code: ${otp}`, psid);

    // Dispatch OTP email concurrently so email latency never delays or times out the Messenger reply
    sendOTPEmail(emailInput, otp, titleName).catch(async (err) => {
      await logEvent('ERROR', `Brevo OTP dispatch error: ${err.message}`, psid);
    });

    await sendTextMessage(
      psid,
      `Verification code sent to:\n*${emailInput}*\n\nPlease check your email inbox and type your 6-digit verification code below:`,
      [
        { title: "Resend Code", payload: "RESEND_OTP" },
        { title: "Edit Details", payload: "EDIT_DETAILS" },
        { title: "Cancel", payload: "RESET_SESSION" }
      ]
    );
    return;
  }

  // 4. OTP Verification with Full Recovery Suite
  if (session.state === 'AWAITING_OTP') {
    // Seamless Recovery: If user re-submits registration details containing @missionary.org
    const missionaryEmailMatch = text.match(/([a-zA-Z0-9._%+-]+@missionary\.org)/i);
    if (missionaryEmailMatch) {
      const emailInput = missionaryEmailMatch[1].toLowerCase();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let titleName = session.temp_title || "Elder Missionary";
      const currentBatchMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
      let batchMonth = session.temp_batch || currentBatchMonth || "September 2026";
      let referralCode = session.invite_code || cleanRef || "TCRP50";

      if (lines.length >= 2) {
        titleName = lines[0];
        const nonEmailLines = lines.slice(1).filter(l => !l.toLowerCase().includes('@missionary.org'));
        if (nonEmailLines.length > 0) {
          const candidate = nonEmailLines[0].trim();
          if (candidate.length >= 4 && !/^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(candidate)) {
            referralCode = candidate.toUpperCase();
          } else if (nonEmailLines.length >= 2) {
            referralCode = nonEmailLines[1].trim().toUpperCase();
          }
        }
      }

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const nowSec = Math.floor(Date.now() / 1000);

      await runSql(`
        UPDATE sessions 
        SET state = 'AWAITING_OTP', 
            temp_title = ?, 
            temp_email = ?, 
            temp_batch = ?, 
            invite_code = ?, 
            otp_code = ?, 
            last_otp_at = ?,
            failed_otp_count = 0
        WHERE psid = ?
      `, [titleName, emailInput, batchMonth, referralCode, newOtp, nowSec, psid]);

      await logEvent('INFO', `[OTP RE-GENERATED VIA DETAILS UPDATE] Email: ${emailInput} | Code: ${newOtp}`, psid);

      sendOTPEmail(emailInput, newOtp, titleName).catch(async (err) => {
        await logEvent('ERROR', `Brevo OTP dispatch error: ${err.message}`, psid);
      });

      await sendTextMessage(
        psid,
        `Verification code sent to:\n*${emailInput}*\n\nPlease check your email inbox and type your 6-digit verification code below:`,
        [
          { title: "Resend Code", payload: "RESEND_OTP" },
          { title: "Edit Details", payload: "EDIT_DETAILS" },
          { title: "Cancel", payload: "RESET_SESSION" }
        ]
      );
      return;
    }

    if (cleanPayload === 'RESEND_OTP' || lower === 'resend') {
      const recipientEmail = session.temp_email;
      if (!recipientEmail) {
        await runSql("UPDATE sessions SET state = 'AWAITING_ALL_IN_ONE' WHERE psid = ?", [psid]);
        await sendTextMessage(psid, "Email address missing. Please re-enter your missionary details:", [
          { title: "Cancel", payload: "RESET_SESSION" }
        ]);
        return;
      }

      const otpEligibility = await checkOtpResendEligibility(psid, session);
      if (!otpEligibility.allowed) {
        if (otpEligibility.reason === 'COOLDOWN') {
          await sendTextMessage(
            psid,
            `Please wait ${otpEligibility.remainingSeconds}s before requesting another verification code.\n\nCheck your spam/junk folder for the previous code sent to *${recipientEmail}*.`,
            [
              { title: "Resend Code", payload: "RESEND_OTP" },
              { title: "Edit Details", payload: "EDIT_DETAILS" },
              { title: "Cancel", payload: "RESET_SESSION" }
            ]
          );
          return;
        }
        if (otpEligibility.reason === 'MAX_RESENDS_REACHED') {
          await sendTextMessage(
            psid,
            `You have reached today's limit for verification codes (${otpEligibility.maxResends} codes per day).\n\nPlease check your email for previously sent codes or try again tomorrow at 12:00 AM UTC+8.`,
            [
              { title: "Edit Details", payload: "EDIT_DETAILS" },
              { title: "Cancel", payload: "RESET_SESSION" }
            ]
          );
          return;
        }
      }

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const nowSec = Math.floor(Date.now() / 1000);
      const resendCount = await recordOtpResend(psid);
      const maxResends = otpEligibility.maxResends || 3;
      const resendsLeft = Math.max(0, maxResends - resendCount);

      await runSql("UPDATE sessions SET otp_code = ?, last_otp_at = ? WHERE psid = ?", [newOtp, nowSec, psid]);
      await logEvent('INFO', `[OTP RESENT] Email: ${recipientEmail} | Code: ${newOtp} | Resends used: ${resendCount}/${maxResends}`, psid);

      sendOTPEmail(recipientEmail, newOtp, session.temp_title || "Elder Missionary").catch(async (err) => {
        await logEvent('ERROR', `Brevo OTP resend error: ${err.message}`, psid);
      });

      await sendTextMessage(
        psid,
        `A fresh 6-digit verification code was emailed to:\n*${recipientEmail}*\n\n(Resends left today: ${resendsLeft}/${maxResends})\nPlease type the new 6-digit code below:`,
        [
          { title: "Resend Code", payload: "RESEND_OTP" },
          { title: "Edit Details", payload: "EDIT_DETAILS" },
          { title: "Cancel", payload: "RESET_SESSION" }
        ]
      );
      return;
    }

    if (cleanPayload === 'EDIT_DETAILS' || lower === 'edit') {
      await runSql("UPDATE sessions SET state = 'AWAITING_ALL_IN_ONE' WHERE psid = ?", [psid]);
      await sendTextMessage(
        psid,
        "Please reply with your updated missionary details:\n\n1. Title & Full Name (e.g. Elder John Smith)\n2. Email (@missionary.org)\n3. Referral Code (Optional)",
        [{ title: "Cancel", payload: "RESET_SESSION" }]
      );
      return;
    }

    if (cleanPayload === 'RESET_SESSION' || lower === 'cancel') {
      await runSql("UPDATE sessions SET state = 'START' WHERE psid = ?", [psid]);
      await sendTextMessage(psid, "Registration cancelled. Tap below whenever you'd like to restart:", [
        { title: "Get Started", payload: "GET_STARTED" }
      ]);
      return;
    }

    const cleanedCode = text.replace(/\D/g, '');
    if (cleanedCode === session.otp_code) {
      const refCode = generateXNXNXN();
      const cohort = (session.temp_title || '').toLowerCase().includes('sister') ? 'sister' : 'elder';
      const currentBatchMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
      const batch = session.temp_batch || currentBatchMonth || 'September 2026';

      if (session.invite_code && session.invite_code.toUpperCase() !== refCode.toUpperCase()) {
        await runSql("UPDATE missionaries SET points = points + 1 WHERE UPPER(referral_code) = ? AND LOWER(email) != LOWER(?)", [session.invite_code.toUpperCase(), session.temp_email || '']);
      }

      await runSql(`
        INSERT INTO missionaries (email, name, cohort, batch_month, points, referral_code, psid, status, max_months)
        VALUES (?, ?, ?, ?, 1, ?, ?, 'active', 24)
        ON CONFLICT(email) DO UPDATE SET 
          psid = excluded.psid, 
          status = 'active', 
          name = excluded.name,
          batch_month = excluded.batch_month,
          points = CASE WHEN points = 0 THEN 1 ELSE points END
      `, [session.temp_email, session.temp_title || 'Elder Missionary', cohort, batch, refCode, psid]);

      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      const verifiedRecord = (await runSql("SELECT * FROM missionaries WHERE psid = ? LIMIT 1", [psid]))[0];

      await logEvent('INFO', `Account verified successfully for ${verifiedRecord.name} (${verifiedRecord.email})`, psid);
      
      const verifiedGreeting = `${toUnicodeBold("ACCOUNT VERIFIED!")}\nCongratulations ${verifiedRecord.name}! Your account is now active with +1 Welcome Point.`;
      await renderVerifiedDashboard(psid, verifiedRecord, verifiedGreeting);
      return;
    } else {
      const failedCount = (Number(session.failed_otp_count) || 0) + 1;
      const MAX_ATTEMPTS = 5;

      if (failedCount >= MAX_ATTEMPTS) {
        await runSql("UPDATE sessions SET state = 'START', failed_otp_count = 0 WHERE psid = ?", [psid]);
        await logEvent('WARN', `OTP lockout triggered: ${failedCount} failed attempts`, psid);
        await sendTextMessage(
          psid,
          "Too many incorrect verification attempts. For your security, this registration session has been locked and reset.\n\nPlease tap below when you are ready to restart:",
          [{ title: "Get Started", payload: "GET_STARTED" }]
        );
        return;
      }

      await runSql("UPDATE sessions SET failed_otp_count = ? WHERE psid = ?", [failedCount, psid]);
      const attemptsLeft = MAX_ATTEMPTS - failedCount;

      await sendTextMessage(
        psid,
        `Incorrect 6-digit code (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining).\n\nPlease enter the correct code from your email, or choose an option below:`,
        [
          { title: "Resend Code", payload: "RESEND_OTP" },
          { title: "Edit Details", payload: "EDIT_DETAILS" },
          { title: "Cancel", payload: "RESET_SESSION" }
        ]
      );
      return;
    }
  }

  // Fallback for unverified users
  await sendGatekeeper(psid);
}
