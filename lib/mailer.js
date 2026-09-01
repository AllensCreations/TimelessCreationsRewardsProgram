import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

/**
 * Universal Template File Loader
 * Reads directly from the templates/ directory.
 */
export function loadTemplateFile(filename) {
  const candidatePaths = [
    path.join(TEMPLATES_DIR, filename),
    path.resolve(process.cwd(), 'templates', filename),
    path.resolve(process.cwd(), filename)
  ];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (_) {}
  }

  console.error(`[TEMPLATE READ ERROR] Template file not found: ${filename} (checked in ${TEMPLATES_DIR})`);
  return null;
}

/**
 * Universal Placeholder Interpolator
 * Replaces {{KEY}} placeholders case-insensitively.
 */
export function interpolatePlaceholders(templateStr, placeholderMap = {}) {
  if (!templateStr) return "";
  let result = templateStr;
  for (const [key, value] of Object.entries(placeholderMap)) {
    const safeVal = (value === null || value === undefined) ? "" : String(value);
    const regex = new RegExp(`{{${key}}}`, 'gi');
    result = result.replace(regex, safeVal);
  }
  return result;
}

/**
 * Centralized Brevo Email Dispatcher
 * Sends htmlContent directly to Brevo to guarantee 100% rich HTML inbox rendering.
 */
export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || 'noreply.timelesscreations.ph@gmail.com').trim();
  const senderName = (process.env.SENDER_NAME || 'Timeless Creations').trim();

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

/**
 * Unified Month Helper (1-12 or 1-24)
 */
export function getCalendarMonthLabel(monthIndex) {
  const calendarNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = (Number(monthIndex) - 1) % 12;
  return calendarNames[idx];
}

/**
 * Unified Number Formatter (1500 -> 1.5k+ Sold)
 */
export function formatMetricK(val) {
  if (!val) return "1.5k+ Sold";
  const str = String(val).trim();
  if (str.toLowerCase().includes('k') || str.toLowerCase().includes('m')) return str;
  const num = parseInt(str.replace(/\D/g, ''), 10);
  if (isNaN(num)) return str;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.0', '')}k+ Sold`;
  return `${num}+ Sold`;
}

/**
 * Unified Top Products HTML Builder
 */
export function buildTopProductsHtml(dripData = {}) {
  const p1Name = (dripData.highlight_label || "").trim();
  const p1Img = dripData.highlight_img || "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE";
  const p1Sold = formatMetricK(dripData.highlight_sold_1 || "1500");

  const p2Name = (dripData.highlight_label_2 || "").trim();
  const p2Img = dripData.highlight_img_2 || "https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ";
  const p2Sold = formatMetricK(dripData.highlight_sold_2 || "950");

  if (!p1Name && !p2Name) return "";

  if (p1Name && !p2Name) {
    return `
      <div style="margin: 20px 0; padding: 16px 12px; background: #faf7f0; border: 1.5px solid #c9a84c; border-radius: 6px; text-align: center;">
        <span style="display: inline-block; background: #8b1a1a; color: #ffffff; font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: bold; padding: 3px 8px; border-radius: 3px; margin-bottom: 8px;">
          ★ Monthly Spotlight
        </span>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding: 6px 0;">
              <img src="${p1Img}" style="width: 140px; height: 140px; object-fit: cover; border-radius: 4px; border: 1px solid #d4c197; display: block; margin: 0 auto 8px auto;" alt="${p1Name}">
              <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; font-weight: bold; color: #1a1a1a; text-transform: uppercase;">${p1Name}</div>
              <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; color: #8b1a1a; font-weight: bold; margin-top: 3px;">🔥 ${p1Sold}</div>
            </td>
          </tr>
        </table>
        <a href="https://m.me/timeless.creations.06" style="display: inline-block; margin-top: 10px; padding: 8px 18px; background: #1a1a1a; color: #d4c197; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; border-radius: 3px;">
          Claim Yours Now →
        </a>
      </div>
    `;
  }

  return `
    <div style="margin: 20px 0; padding: 16px 12px; background: #faf7f0; border: 1.5px solid #c9a84c; border-radius: 6px; text-align: center;">
      <span style="display: inline-block; background: #8b1a1a; color: #ffffff; font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: bold; padding: 3px 8px; border-radius: 3px; margin-bottom: 8px;">
        ★ Top Selling Missionary Items
      </span>
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td width="48%" align="center" valign="top" style="padding: 4px;">
            <img src="${p1Img}" style="width: 100%; max-width: 120px; height: 120px; object-fit: cover; border-radius: 4px; border: 1px solid #d4c197; display: block; margin: 0 auto 6px auto;" alt="${p1Name}">
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; font-weight: bold; color: #1a1a1a; text-transform: uppercase;">${p1Name}</div>
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; color: #8b1a1a; font-weight: bold; margin-top: 2px;">🔥 ${p1Sold}</div>
          </td>
          <td width="4%"></td>
          <td width="48%" align="center" valign="top" style="padding: 4px;">
            <img src="${p2Img}" style="width: 100%; max-width: 120px; height: 120px; object-fit: cover; border-radius: 4px; border: 1px solid #d4c197; display: block; margin: 0 auto 6px auto;" alt="${p2Name}">
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; font-weight: bold; color: #1a1a1a; text-transform: uppercase;">${p2Name}</div>
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; color: #8b1a1a; font-weight: bold; margin-top: 2px;">🔥 ${p2Sold}</div>
          </td>
        </tr>
      </table>
      <a href="https://m.me/timeless.creations.06" style="display: inline-block; margin-top: 10px; padding: 8px 18px; background: #1a1a1a; color: #d4c197; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; border-radius: 3px;">
        Order Yours Now →
      </a>
    </div>
  `;
}

/**
 * Unified Reward Section Builder
 */
export function buildCombinedRewardSectionHtml(userPoints = 2, catalogProducts = [], activePromo = null) {
  let promoHtml = '';
  if (activePromo) {
    const pts = activePromo.points || 1;
    const code = activePromo.code || "FREEGIFT";
    promoHtml = `
      <div style="margin-bottom: 16px; padding: 12px; background-color: #fff9e6; border: 1px dashed #c9a84c; border-radius: 4px; text-align: center;">
        <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; margin-bottom: 4px;">
          🎁 Active Promo Gift: +${pts} Free Points
        </div>
        <div style="font-size: 11px; color: #5a4a28; line-height: 1.4; margin-bottom: 8px;">
          Type <strong style="font-family: monospace; font-size: 12px; background: #fff; padding: 2px 6px; border: 1px solid #d4c197; border-radius: 3px; color: #8b1a1a;">/redeem ${code}</strong> in Messenger to claim your gift!
        </div>
      </div>
    `;
  }

  const claimable = (catalogProducts || []).filter(p => Number(p.price) <= userPoints);
  const nextTarget = (catalogProducts || []).find(p => Number(p.price) > userPoints);

  let itemsHtml = '';
  if (claimable.length > 0) {
    itemsHtml += `
      <div style="margin-bottom: 10px; text-align: left;">
        <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #16a34a; font-weight: bold;">
          ✅ Ready to Claim Right Now:
        </span>
      </div>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
    `;
    claimable.forEach(item => {
      itemsHtml += `
        <tr>
          <td width="36" style="padding: 4px 0;"><img src="${item.image_url || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE'}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 3px; border: 1px solid #d4c197; display: block;" alt="${item.name}"></td>
          <td style="padding: 4px 8px; font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; color: #1a1a1a; font-weight: bold;">${item.name}</td>
          <td align="right" style="padding: 4px 0; font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; color: #8b1a1a; font-weight: bold;">${item.price} PTS</td>
        </tr>
      `;
    });
    itemsHtml += `</table>`;
  }

  if (nextTarget) {
    const ptsNeeded = Number(nextTarget.price) - userPoints;
    itemsHtml += `
      <div style="margin-top: 10px; padding: 10px; background-color: #f6f1e6; border-radius: 4px; text-align: left;">
        <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; color: #8c7e5d; font-weight: bold; display: block; margin-bottom: 4px;">
          🎯 Next Reward Goal (${ptsNeeded} pts away):
        </span>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td width="36"><img src="${nextTarget.image_url || 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ'}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 3px; border: 1px solid #d4c197; display: block;" alt="${nextTarget.name}"></td>
            <td style="padding: 0 8px; font-family: 'Helvetica', Arial, sans-serif; font-size: 10.5px; color: #5a4a28;"><strong>${nextTarget.name}</strong> (${nextTarget.price} PTS)</td>
          </tr>
        </table>
      </div>
    `;
  }

  return `
    <div style="margin: 20px 0 16px; padding: 16px 14px; background-color: #fffcf5; border: 1.5px solid #d4c197; border-radius: 6px; text-align: center;">
      ${promoHtml}
      ${itemsHtml}
      <a href="https://m.me/TimelessCreationsRP" style="display: inline-block; margin-top: 14px; padding: 10px 20px; background-color: #1a1a1a; color: #d4c197; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; border-radius: 3px;" target="_blank">
        Open TCRP Rewards Bot →
      </a>
    </div>
  `;
}

/**
 * Master Renderer for Monthly Encouragement Drip
 */
export function renderMonthlyDripTemplate(dripData = {}, rewardProducts = [], activePromo = null) {
  const currentMonthNum = (dripData.month && !isNaN(Number(dripData.month)) && Number(dripData.month) > 0) ? Number(dripData.month) : (new Date().getMonth() + 1);
  const monthLabel = getCalendarMonthLabel(currentMonthNum);
  const name = dripData.name || "Elder Smith";
  const message = (dripData.message || "May this month bring you renewed faith, strength, and joy in your sacred service across the Philippines.").replace(/\n/g, '<br>');
  const scripture = (dripData.scripture || "Trust in the Lord with all thine heart; and lean not unto thine own understanding.").replace(/^["'“](.*)["'”]$/, '$1').trim();
  const theme = dripData.theme || "Elder Jeffrey R. Holland";
  const points = dripData.points !== undefined ? Number(dripData.points) : 2;

  const topProductsHtml = buildTopProductsHtml(dripData);
  const rewardSectionHtml = buildCombinedRewardSectionHtml(points, rewardProducts, activePromo);

  const defaultGrids = [
    'https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex',
    'https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky',
    'https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv',
    'https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR',
    'https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m',
    'https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV',
    'https://lh3.googleusercontent.com/u/0/d/1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY',
    'https://lh3.googleusercontent.com/u/0/d/15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI',
    'https://lh3.googleusercontent.com/u/0/d/1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC'
  ];

  const rawTemplate = (dripData.custom_html && dripData.custom_html.trim() !== '')
    ? dripData.custom_html
    : loadTemplateFile('monthly-drip.html');

  const replacements = {
    MONTH: monthLabel,
    NAME: name,
    MESSAGE: message,
    SCRIPTURE: scripture,
    THEME: theme,
    POINTS: String(points),
    TOP_PRODUCTS_HTML: topProductsHtml,
    REWARD_SECTION_HTML: rewardSectionHtml,
    ESS1_NAME: dripData.ess1_name || 'Wooden Nametag',
    ESS1_IMG: dripData.ess1_img || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE',
    ESS2_NAME: dripData.ess2_name || 'POS Kit',
    ESS2_IMG: dripData.ess2_img || 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ',
    GALLERY_URL: dripData.gallery_url || 'https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7',
    HIGHLIGHT_DISPLAY: topProductsHtml ? 'display:block' : 'display:none',
    HIGHLIGHT_ITEMS_HTML: topProductsHtml
  };

  for (let i = 1; i <= 9; i++) {
    replacements[`GRID${i}`] = dripData[`grid${i}`] || defaultGrids[i - 1];
  }

  return interpolatePlaceholders(rawTemplate, replacements);
}

/**
 * Master Renderer for Out of Window Reconnect Drip
 */
export function renderOutOfWindowDripTemplate(dripData = {}, rewardProducts = [], activePromo = null) {
  const currentMonthNum = (dripData.month && !isNaN(Number(dripData.month)) && Number(dripData.month) > 0) ? Number(dripData.month) : (new Date().getMonth() + 1);
  const monthLabel = getCalendarMonthLabel(currentMonthNum);
  const name = dripData.name || "Elder / Sister";
  const message = (dripData.message || "We hope you are having a spiritually uplifting week! Here is your latest rewards update from Timeless Creations.").replace(/\n/g, '<br>');
  const scripture = (dripData.scripture || "Trust in the Lord with all thine heart.").replace(/^["'“](.*)["'”]$/, '$1').trim();
  const theme = dripData.theme || "Elder Jeffrey R. Holland";
  const points = dripData.points !== undefined ? Number(dripData.points) : 2;

  const rewardSectionHtml = buildCombinedRewardSectionHtml(points, rewardProducts, activePromo);
  const rawTemplate = loadTemplateFile('out-of-window-drip.html');

  return interpolatePlaceholders(rawTemplate, {
    MONTH: monthLabel,
    NAME: name,
    MESSAGE: message,
    SCRIPTURE: scripture,
    THEME: theme,
    REWARD_SECTION_HTML: rewardSectionHtml
  });
}

/**
 * Master Renderer for OTP Passcode Email
 */
export function renderOtpTemplate({ name = "Missionary", otpCode = "749281", displayDate = null } = {}) {
  const cleanName = name || "Missionary";
  const cleanDate = displayDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const rawTemplate = loadTemplateFile('otp-email.html');

  return interpolatePlaceholders(rawTemplate, {
    NAME: cleanName,
    OTP_CODE: otpCode,
    DATE: cleanDate
  });
}

/**
 * Master Renderer for Redemption Receipt Email
 */
export function renderReceiptTemplate(order = {}) {
  const name = order.name || "Elder / Sister";
  const orderId = order.order_id || `TCRP-${Date.now().toString().slice(-4)}`;
  const item = order.item || "Wooden Missionary Nametag";
  const pointsCost = order.points_cost !== undefined ? order.points_cost : 6;
  const status = (order.status || "PENDING FULFILLMENT").toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rawTemplate = loadTemplateFile('receipt-email.html');

  return interpolatePlaceholders(rawTemplate, {
    NAME: name,
    ORDER_ID: orderId,
    ITEM: item,
    POINTS_COST: String(pointsCost),
    STATUS: status,
    DATE: dateStr
  });
}

/**
 * Master Renderer for Thank You / Fulfillment Email
 */
export function renderThankYouTemplate(order = {}, status = "COMPLETED") {
  const name = order.name || "Elder / Sister";
  const orderId = order.order_id || `TCRP-${Date.now().toString().slice(-4)}`;
  const item = order.item || "Wooden Missionary Nametag";
  const cleanStatus = (status || "COMPLETED").toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const isCompleted = cleanStatus === "COMPLETED" || cleanStatus === "PAID" || cleanStatus === "DELIVERED";
  const title = isCompleted ? "Order Completed & Fulfilled ✨" : `Order Status: ${cleanStatus} 📦`;
  const message = isCompleted
    ? `Your order <strong>${orderId}</strong> has been successfully processed and fulfilled!`
    : `Here is an update regarding your order <strong>${orderId}</strong>.`;

  const rawTemplate = loadTemplateFile('thankyou-email.html');
  return interpolatePlaceholders(rawTemplate, {
    TITLE: title,
    NAME: name,
    MESSAGE: message,
    ORDER_ID: orderId,
    ITEM: item,
    STATUS: cleanStatus,
    DATE: dateStr
  });
}

/**
 * Master Renderer for Package Delivered Email
 */
export function renderDeliveredTemplate(order = {}) {
  const name = order.name || "Elder / Sister";
  const orderId = order.order_id || `TCRP-${Date.now().toString().slice(-4)}`;
  const item = order.item || "Wooden Missionary Nametag";
  const rawTemplate = loadTemplateFile('delivered-email.html');

  return interpolatePlaceholders(rawTemplate, {
    NAME: name,
    ORDER_ID: orderId,
    ITEM: item
  });
}

// -------------------------------------------------------------------------
// Standard High-Level Dispatchers
// -------------------------------------------------------------------------

export async function sendDripEmail(to, month = null, customName = "Elder Smith") {
  const currentMonthNum = (month && !isNaN(Number(month)) && Number(month) > 0) ? Number(month) : (new Date().getMonth() + 1);
  let promo = null;
  let rewardProducts = [];
  let dripData = { month: currentMonthNum, name: customName, points: 2 };

  try {
    const promoRows = await runSql("SELECT code, points, max_users, claimed_count FROM promo_codes WHERE claimed_count < max_users ORDER BY created_at DESC LIMIT 1");
    if (promoRows && promoRows.length > 0) promo = promoRows[0];
    rewardProducts = await runSql("SELECT name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC");

    const dripRows = await runSql("SELECT * FROM drip_messages WHERE month = ? LIMIT 1", [currentMonthNum]);
    if (dripRows && dripRows.length > 0) {
      dripData = { ...dripData, ...dripRows[0] };
    }
    const configRows = await runSql("SELECT value FROM system_config WHERE key = ?", [`drip_${currentMonthNum}_highlight_meta`]);
    if (configRows && configRows.length > 0) {
      try {
        const meta = JSON.parse(configRows[0].value);
        if (meta.sold_1) dripData.highlight_sold_1 = meta.sold_1;
        if (meta.label_2) dripData.highlight_label_2 = meta.label_2;
        if (meta.img_2) dripData.highlight_img_2 = meta.img_2;
        if (meta.sold_2) dripData.highlight_sold_2 = meta.sold_2;
      } catch (_) {}
    }
  } catch (_) {}

  const monthLabel = getCalendarMonthLabel(currentMonthNum);
  const subjectLine = (dripData.subject && dripData.subject.trim())
    ? dripData.subject.replace(/{{MONTH}}/gi, monthLabel).replace(/{{NAME}}/gi, customName)
    : `Monthly Encouragement (${monthLabel}) • Timeless Creations`;

  const html = renderMonthlyDripTemplate(dripData, rewardProducts, promo);
  return await sendEmail({ to, subject: subjectLine, htmlContent: html });
}

export async function sendOTPEmail(to, otpCode = "749281", customName = "Missionary") {
  const html = renderOtpTemplate({ name: customName, otpCode });
  return await sendEmail({ to, subject: `🔐 Your TCRP Verification Code: ${otpCode}`, htmlContent: html });
}

export async function sendReceiptEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-9921", item: "Wooden Missionary Nametag", points_cost: 6 }) {
  const html = renderReceiptTemplate(order);
  return await sendEmail({ to, subject: `🧾 Redemption Receipt (${order.order_id || 'TCRP-9921'}) • Timeless Creations`, htmlContent: html });
}

export async function sendThankYouEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-9921", item: "Wooden Missionary Nametag" }) {
  const html = renderThankYouTemplate(order, "COMPLETED");
  return await sendEmail({ to, subject: `📦 Order Completed (${order.order_id || 'TCRP-9921'}) • Timeless Creations`, htmlContent: html });
}

export async function sendOrderStatusEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-0000", item: "Item" }, status = "PAID") {
  const html = renderThankYouTemplate(order, status);
  return await sendEmail({ to, subject: `📦 Order Update [${status}] • ${order.order_id || 'TCRP-0000'}`, htmlContent: html });
}

export async function sendDeliveredEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-0000", item: "Item" }) {
  const html = renderDeliveredTemplate(order);
  return await sendEmail({ to, subject: `📦 Order Delivered (${order.order_id || 'TCRP-0000'}) • Timeless Creations`, htmlContent: html });
}

export function getCurrentMonthNumber() {
  return new Date().getMonth() + 1;
}
