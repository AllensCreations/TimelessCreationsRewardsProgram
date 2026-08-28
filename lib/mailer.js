import 'dotenv/config';
import { runSql } from './db.js';

export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || 'noreply.timelesscreations.ph@gmail.com').trim();
  const senderName = (process.env.SENDER_NAME || 'Timeless Creations').trim();

  // Guard: Check if offline
  try {
    const power = (await runSql("SELECT value FROM system_settings WHERE key = 'power_state'"))[0];
    if ((power?.value || 'ONLINE').toUpperCase() === 'OFFLINE') {
      console.log(`[EMAIL DISPATCH BLOCKED] System power is OFFLINE. Skip sending to ${to}`);
      return { ok: false, error: "System is OFFLINE" };
    }
  } catch (_) {}

  if (!apiKey || apiKey.startsWith('MOCK') || apiKey.startsWith('EAA_MOCK')) {
    console.log(`[BREVO SIMULATOR] Email to ${to} | Subject: ${subject}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent
      })
    });

    const responseBody = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: responseBody?.message || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: responseBody?.messageId || "sent" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function getCalendarMonthLabel(monthIndex) {
  const calendarNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = (Number(monthIndex) - 1) % 12;
  return calendarNames[idx];
}

export function buildPromoBannerHtml(activePromo = null) {
  if (!activePromo || !activePromo.code) return "";
  return `
    <div style="margin: 18px 0; padding: 14px 16px; background-color: #fff9e6; border: 1.5px dashed #c9a84c; border-radius: 6px; text-align: center;">
      <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; display: block; margin-bottom: 4px;">
        🎟️ Exclusive Monthly Freebie Promo
      </span>
      <div style="font-size: 13px; color: #1a1a1a; margin-bottom: 6px;">
        Claim <strong>+${activePromo.points} Free Reward Points</strong> right now!
      </div>
      <div style="font-family: monospace; font-size: 13px; font-weight: bold; background: #1a1a1a; color: #d4c197; padding: 6px 12px; border-radius: 4px; display: inline-block; letter-spacing: 1px;">
        /redeem ${activePromo.code}
      </div>
      <div style="font-size: 10px; color: #777; margin-top: 6px;">
        Type this in our Messenger chat to claim bonus points instantly!
      </div>
    </div>
  `;
}

export function renderMonthlyDripTemplate(dripData = {}, rewardProducts = [], activePromo = null) {
  const monthNum = dripData.month || 1;
  const monthLabel = getCalendarMonthLabel(monthNum);
  const name = dripData.name || "Elder Smith";
  const theme = dripData.theme || "Elder Jeffrey R. Holland";
  const scripture = dripData.scripture || "Trust in the Lord with all thine heart; and lean not unto thine own understanding.";
  const message = (dripData.message || `May your faith be strengthened as you serve during ${monthLabel}.`).replace(/\n/g, '<br>');
  const points = dripData.points !== undefined ? Number(dripData.points) : 2;
  const galleryUrl = dripData.gallery_url || "https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7";

  const promoBannerHtml = buildPromoBannerHtml(activePromo);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Garamond', 'Georgia', serif; background-color: #f9f7f2; color: #1a1a1a; margin: 0; padding: 12px; }
      .email-container { width: 100%; max-width: 450px; background: #ffffff; margin: 0 auto; border: 1px solid #e0d6bc; box-shadow: 0 8px 24px rgba(0,0,0,0.04); }
      .brand-header { padding: 25px 14px 10px; text-align: center; }
      .logo-text { font-size: 20px; letter-spacing: 4px; text-transform: uppercase; font-weight: 300; margin: 0; color: #1a1a1a; }
      .temple-img { width: 100%; height: auto; object-fit: cover; display: block; border: 0; }
      .main-content { padding: 16px 14px; text-align: center; line-height: 1.5; }
      .quote-container { margin: 14px 0; padding: 14px; background-color: #fdfbf8; border-left: 1px solid #d4c197; border-right: 1px solid #d4c197; }
      .gallery-btn { display: inline-block; padding: 10px 22px; border: 1px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; border-radius: 2px; margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="brand-header">
        <div style="font-size: 7.5px; letter-spacing: 2px; color: #b0b0b0; text-transform: uppercase; margin-bottom: 8px;">${monthLabel} • Dedicated Service</div>
        <h1 class="logo-text">Timeless Creations</h1>
      </div>
      <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" class="temple-img">
      <div class="main-content">
        <div style="font-size: 17px; font-style: italic; margin-bottom: 10px;">Hello ${name},</div>
        <div style="font-size: 13px; color: #333; margin-bottom: 14px;">${message}</div>
        <div class="quote-container">
          <div style="font-size: 13.5px; font-style: italic; color: #1a1a1a; margin-bottom: 6px;">"${scripture}"</div>
          <div style="font-size: 8.5px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; color: #8c7e5d;">${theme}</div>
        </div>

        ${promoBannerHtml}

        <div style="margin: 22px auto; text-align: center;">
          <h2 style="font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase; font-size: 12px; margin-bottom: 4px; color: #1a1a1a;">Engrave Your Legacy</h2>
          <p style="font-size: 11px; color: #666; font-style: italic; margin-bottom: 10px;">We archive the sacred memories of full-time missionaries across the Philippines.</p>
          <a href="${galleryUrl}" target="_blank" class="gallery-btn">Enter the Google Photos Gallery ↗</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

export async function sendDripEmail(to, month = 1, customName = "Elder Smith") {
  let promo = null;
  try {
    const promoRows = await runSql("SELECT code, points, max_users, claimed_count FROM promo_codes WHERE claimed_count < max_users ORDER BY created_at DESC LIMIT 1");
    if (promoRows && promoRows.length > 0) promo = promoRows[0];
  } catch (_) {}

  const html = renderMonthlyDripTemplate({ month, name: customName, points: 2 }, [], promo);
  const monthLabel = getCalendarMonthLabel(month);
  return await sendEmail({ to, subject: `Monthly Encouragement (${monthLabel}) • Timeless Creations`, htmlContent: html });
}

export async function sendOTPEmail(to, otpCode = "749281") {
  const html = `<div style="padding:20px;font-family:Georgia,serif;">Your 6-digit verification code is: <b>${otpCode}</b></div>`;
  return await sendEmail({ to, subject: `🔐 Your Verification Code: ${otpCode}`, htmlContent: html });
}

export async function sendReceiptEmail(to, order = { name: "Missionary", order_id: "TCRP-9921", item: "Wooden Nametag", points_cost: 6 }) {
  const html = `<div style="padding:20px;font-family:Georgia,serif;">Receipt for ${order.order_id}: ${order.item} (${order.points_cost} PTS)</div>`;
  return await sendEmail({ to, subject: `🧾 Redemption Receipt (${order.order_id})`, htmlContent: html });
}

export async function sendThankYouEmail(to, order = { name: "Missionary", order_id: "TCRP-9921", item: "Wooden Nametag" }) {
  const html = `<div style="padding:20px;font-family:Georgia,serif;">Thank you for your order ${order.order_id}! Item: ${order.item}</div>`;
  return await sendEmail({ to, subject: `📦 Order Completed (${order.order_id})`, htmlContent: html });
}

export async function sendOrderStatusEmail(to, order = { name: "Missionary", order_id: "TCRP-0000", item: "Item" }, status = "PAID") {
  const html = `<div style="padding:20px;font-family:Georgia,serif;">Order status update for ${order.order_id}: <b>${status}</b></div>`;
  return await sendEmail({ to, subject: `📦 Order Update [${status}] • ${order.order_id}`, htmlContent: html });
}
