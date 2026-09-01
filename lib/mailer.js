import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

export function loadTemplateFile(filename) {
  try {
    const filePath = path.join(TEMPLATES_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(`[TEMPLATE LOAD ERROR] Could not read template ${filename}:`, err.message);
  }
  return null;
}

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

export function getCalendarMonthLabel(monthIndex) {
  const calendarNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = (Number(monthIndex) - 1) % 12;
  return calendarNames[idx];
}

export function formatMetricK(val) {
  if (!val) return "1.5k+ Sold";
  const str = String(val).trim();
  if (str.toLowerCase().includes('k') || str.toLowerCase().includes('m')) return str;
  const num = parseInt(str.replace(/\D/g, ''), 10);
  if (isNaN(num)) return str;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.0', '')}k+ Sold`;
  return `${num}+ Sold`;
}

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
          🥇 #1 TOP BESTSELLER
        </span>
        <img src="${p1Img}" style="width: 100%; max-width: 130px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; border: 1.5px solid #c9a84c; display: block; margin: 0 auto 6px auto;" alt="${p1Name}">
        <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 11.5px; font-weight: bold; color: #1a1a1a;">${p1Name}</div>
        <div style="font-size: 10px; color: #8c7e5d; font-weight: bold; margin-top: 2px;">🔥 ${p1Sold}</div>
      </div>
    `;
  }

  // Authentic 2-Column Responsive Layout
  return `
    <div style="margin: 20px 0; padding: 16px 12px; background: #faf7f0; border: 1.5px solid #c9a84c; border-radius: 6px;">
      <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; text-align: center; margin-bottom: 12px;">
        ⭐ Top Products of the Month
      </div>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout: fixed;">
        <tr>
          <!-- TOP 1 (Column 1) -->
          <td align="center" width="48%" valign="top" style="background: #ffffff; border: 1.5px solid #c9a84c; border-radius: 6px; padding: 12px 8px; box-shadow: 0 4px 10px rgba(201,168,76,0.12);">
            <span style="display: inline-block; background: #8b1a1a; color: #ffffff; font-family: 'Helvetica', Arial, sans-serif; font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold; padding: 2px 6px; border-radius: 3px; margin-bottom: 6px;">
              🥇 #1 TOP SELLER
            </span>
            <img src="${p1Img}" style="width: 100%; max-width: 110px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; border: 1.5px solid #c9a84c; display: block; margin: 0 auto 6px auto;" alt="${p1Name}">
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; font-weight: bold; color: #1a1a1a; line-height: 1.2;">${p1Name}</div>
            <div style="font-size: 9.5px; color: #8c7e5d; font-weight: bold; margin-top: 3px;">🔥 ${p1Sold}</div>
          </td>
          <td width="4%"></td>
          <!-- TOP 2 (Column 2) -->
          <td align="center" width="48%" valign="top" style="background: #fdfdfd; border: 1px dashed #d4c197; border-radius: 6px; padding: 12px 8px;">
            <span style="display: inline-block; background: #555566; color: #ffffff; font-family: 'Helvetica', Arial, sans-serif; font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold; padding: 2px 6px; border-radius: 3px; margin-bottom: 6px;">
              🥈 #2 POPULAR
            </span>
            <img src="${p2Img}" style="width: 100%; max-width: 95px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; border: 1px solid #d4c197; display: block; margin: 0 auto 6px auto;" alt="${p2Name}">
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 10.5px; font-weight: bold; color: #1a1a1a; line-height: 1.2;">${p2Name}</div>
            <div style="font-size: 9px; color: #8c7e5d; font-weight: bold; margin-top: 3px;">⭐ ${p2Sold}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function buildCombinedRewardSectionHtml(points = 2, products = [], activePromo = null) {
  const userPoints = Number(points) || 0;
  const validProducts = Array.isArray(products) ? products : [];
  const affordable = validProducts.filter(p => Number(p.price) <= userPoints);

  let promoSnippetHtml = "";
  if (activePromo && activePromo.code && activePromo.code.trim() !== '') {
    promoSnippetHtml = `
      <div style="margin: 0 0 14px 0; padding: 12px 14px; background-color: #fff9e6; border: 1.5px dashed #c9a84c; border-radius: 6px; text-align: center;">
        <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; display: block; margin-bottom: 3px;">
          🎟️ Exclusive Monthly Freebie Promo
        </span>
        <div style="font-size: 12px; color: #1a1a1a; margin-bottom: 5px;">
          Claim <strong>+${activePromo.points || 1} Free Reward Points</strong> right now!
        </div>
        <div style="font-family: monospace; font-size: 12.5px; font-weight: bold; background: #1a1a1a; color: #d4c197; padding: 5px 12px; border-radius: 4px; display: inline-block; letter-spacing: 1px;">
          /redeem ${activePromo.code}
        </div>
        <div style="font-size: 9.5px; color: #777; margin-top: 5px;">
          Type this in our Messenger chat to claim bonus points instantly!
        </div>
      </div>
    `;
  }

  let affordableHtml = "";
  if (affordable.length > 0) {
    affordableHtml = `
      <div style="font-size: 11px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px; text-align: left;">
        🎁 You can claim these reward items right now:
      </div>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
        ${affordable.map(item => `
          <tr>
            <td style="padding: 6px; background: #ffffff; border: 1px solid #e0d6bc; border-radius: 4px; margin-bottom: 6px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="36" valign="middle">
                    <img src="${item.image_url || 'https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png'}" style="width: 32px; height: 32px; aspect-ratio: 1/1; object-fit: cover; border-radius: 3px; display: block;">
                  </td>
                  <td style="padding-left: 8px; text-align: left;" valign="middle">
                    <div style="font-weight: bold; font-size: 11px; color: #1a1a1a;">${item.name}</div>
                    <div style="font-size: 9.5px; color: #8c7e5d; font-weight: bold;">⭐ ${item.price} Points</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="4"></td></tr>
        `).join('')}
      </table>
    `;
  }

  let goalHtml = "";
  if (validProducts.length > 0) {
    const sorted = [...validProducts].sort((a, b) => Number(a.price) - Number(b.price));
    const nearestItem = sorted.find(p => Number(p.price) > userPoints) || sorted[0];
    const needed = Math.max(1, (Number(nearestItem.price) || 6) - userPoints);

    goalHtml = `
      <div style="background: #ffffff; border: 1px solid #e0d6bc; border-radius: 6px; padding: 12px; text-align: center; margin-bottom: 10px;">
        <span style="font-size: 9px; color: #8b1a1a; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">
          🎯 Nearest Reward Goal:
        </span>
        <img src="${nearestItem.image_url || 'https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png'}" style="width: 50px; height: 50px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; display: block; margin: 0 auto 6px auto; border: 1px solid #d4c197;">
        <div style="font-weight: bold; font-size: 11.5px; color: #1a1a1a;">${nearestItem.name} (${nearestItem.price} PTS)</div>
        <div style="font-size: 11px; color: #8c7e5d; margin-top: 4px; font-weight: bold;">⚡ Only <strong>${needed} more point${needed > 1 ? 's' : ''}</strong> needed!</div>
      </div>
    `;
  }

  return `
    <div style="margin: 24px 0; padding: 18px 14px; background-color: #fffcf5; border: 1px solid #c9a84c; border-radius: 6px; text-align: center;">
      <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 13px; font-weight: bold; color: #8b1a1a; margin-bottom: 4px;">
        🎁 Your TCRP Reward Balance
      </div>
      <p style="font-size: 12px; margin: 0 0 14px 0; font-family: 'Helvetica', Arial, sans-serif; color: #444;">
        You currently have <strong>${userPoints} Points</strong>
      </p>

      ${promoSnippetHtml}
      ${affordableHtml}
      ${goalHtml}

      <a href="https://m.me/TimelessCreationsRP" target="_blank" style="display: block; width: 90%; margin: 12px auto 0; padding: 12px 16px; background-color: #1a1a1a; color: #d4c197 !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; border-radius: 4px; box-sizing: border-box;">
        Redeem Free Rewards via Messenger
      </a>
    </div>
  `;
}

export function renderMonthlyDripTemplate(dripData = {}, rewardProducts = [], activePromo = null) {
  const monthNum = dripData.month || getCurrentMonthNumber();
  const monthLabel = getCalendarMonthLabel(monthNum);
  const name = dripData.name || "Elder Smith";
  const theme = dripData.theme || "Elder Jeffrey R. Holland";
  const scripture = (dripData.scripture || "Trust in the Lord with all thine heart; and lean not unto thine own understanding.").replace(/^["'“](.*)["'”]$/, '$1').trim();
  const message = (dripData.message || `May your faith be strengthened as you serve and invite others during ${monthLabel}.`).replace(/\n/g, '<br>');
  const points = dripData.points !== undefined ? Number(dripData.points) : 2;

  const topProductsHtml = buildTopProductsHtml(dripData);
  const rewardSectionHtml = buildCombinedRewardSectionHtml(points, rewardProducts, activePromo);

  const defaultGrids = [
    "https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex",
    "https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky",
    "https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv",
    "https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR",
    "https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m",
    "https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV",
    "https://lh3.googleusercontent.com/u/0/d/1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY",
    "https://lh3.googleusercontent.com/u/0/d/15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI",
    "https://lh3.googleusercontent.com/u/0/d/1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC"
  ];

  let raw = (dripData.custom_html && dripData.custom_html.trim().length > 50)
    ? dripData.custom_html
    : loadTemplateFile('monthly-drip.html');

  if (raw) {
    let populated = raw
      .replace(/{{MONTH}}/gi, monthLabel)
      .replace(/{{NAME}}/gi, name)
      .replace(/{{MESSAGE}}/gi, message)
      .replace(/{{SCRIPTURE}}/gi, scripture)
      .replace(/{{THEME}}/gi, theme)
      .replace(/{{POINTS}}/gi, String(points))
      .replace(/{{TOP_PRODUCTS_HTML}}/gi, topProductsHtml)
      .replace(/{{REWARD_SECTION_HTML}}/gi, rewardSectionHtml)
      .replace(/{{ESS1_NAME}}/gi, dripData.ess1_name || 'Wooden Nametag')
      .replace(/{{ESS1_IMG}}/gi, dripData.ess1_img || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE')
      .replace(/{{ESS2_NAME}}/gi, dripData.ess2_name || 'POS Kit')
      .replace(/{{ESS2_IMG}}/gi, dripData.ess2_img || 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ')
      .replace(/{{GALLERY_URL}}/gi, dripData.gallery_url || 'https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7')
      .replace(/{{HIGHLIGHT_DISPLAY}}/gi, topProductsHtml ? 'display:block' : 'display:none')
      .replace(/{{HIGHLIGHT_ITEMS_HTML}}/gi, topProductsHtml);

    for (let i = 1; i <= 9; i++) {
      const gImg = dripData[`grid${i}`] || defaultGrids[i - 1];
      populated = populated.replace(new RegExp(`{{GRID${i}}}`, 'gi'), gImg);
    }
    return populated;
  }

  return `<div style="font-family:serif;padding:20px;text-align:center;"><h2>Timeless Creations • ${monthLabel}</h2><p>Hello ${name},</p><p>${message}</p>${topProductsHtml}${rewardSectionHtml}</div>`;
}

export function getCurrentMonthNumber() {
  return new Date().getMonth() + 1;
}

export async function sendDripEmail(to, month = null, customName = "Elder Smith") {
  const currentMonthNum = (month && !isNaN(Number(month)) && Number(month) > 0) ? Number(month) : getCurrentMonthNumber();
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

export function renderOtpTemplate({ name = "Missionary", otpCode = "749281", displayDate = null } = {}) {
  const cleanName = name || "Missionary";
  const cleanDate = displayDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const rawTemplate = loadTemplateFile('otp-email.html');

  if (rawTemplate) {
    return rawTemplate
      .replace(/{{NAME}}/gi, cleanName)
      .replace(/{{OTP_CODE}}/gi, otpCode)
      .replace(/{{DATE}}/gi, cleanDate);
  }

  return `<div style="font-family:serif;padding:20px;text-align:center;"><h2>Account Verification 🔐</h2><p>Hello <strong>${cleanName}</strong>,</p><p>Your code is: <strong>${otpCode}</strong></p></div>`;
}

export function renderReceiptTemplate(order = {}) {
  const name = order.name || "Elder / Sister";
  const orderId = order.order_id || `TCRP-${Date.now().toString().slice(-4)}`;
  const item = order.item || "Wooden Missionary Nametag";
  const pointsCost = order.points_cost !== undefined ? order.points_cost : 6;
  const status = (order.status || "PENDING FULFILLMENT").toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rawTemplate = loadTemplateFile('receipt-email.html');

  if (rawTemplate) {
    return rawTemplate
      .replace(/{{NAME}}/gi, name)
      .replace(/{{ORDER_ID}}/gi, orderId)
      .replace(/{{ITEM}}/gi, item)
      .replace(/{{POINTS_COST}}/gi, String(pointsCost))
      .replace(/{{STATUS}}/gi, status)
      .replace(/{{DATE}}/gi, dateStr);
  }

  return `<div style="font-family:serif;padding:20px;text-align:center;"><h2>Redemption Receipt 🧾</h2><p>Hello <strong>${name}</strong>,</p><p>Order ID: ${orderId}</p><p>Item: ${item}</p></div>`;
}

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
  if (rawTemplate) {
    return rawTemplate
      .replace(/{{TITLE}}/gi, title)
      .replace(/{{NAME}}/gi, name)
      .replace(/{{MESSAGE}}/gi, message)
      .replace(/{{ORDER_ID}}/gi, orderId)
      .replace(/{{ITEM}}/gi, item)
      .replace(/{{STATUS}}/gi, cleanStatus)
      .replace(/{{DATE}}/gi, dateStr);
  }

  return `<div style="font-family:serif;padding:20px;text-align:center;"><h2>${title}</h2><p>Hello <strong>${name}</strong>,</p><p>${message}</p></div>`;
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
