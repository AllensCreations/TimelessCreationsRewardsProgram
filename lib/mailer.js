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

// Single combined function for rewards, goal tracking, promo code claim snippet, and Messenger CTA
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
  const monthNum = dripData.month || 1;
  const monthLabel = getCalendarMonthLabel(monthNum);
  const name = dripData.name || "Elder Smith";
  const theme = dripData.theme || "Elder Jeffrey R. Holland";
  const scripture = (dripData.scripture || "Trust in the Lord with all thine heart; and lean not unto thine own understanding.").replace(/^["'“](.*)["'”]$/, '$1').trim();
  const message = (dripData.message || `May your faith be strengthened as you serve and invite others during ${monthLabel}.`).replace(/\n/g, '<br>');
  const points = dripData.points !== undefined ? Number(dripData.points) : 2;

  let highlightHtml = '';
  const highlights = [];
  if (dripData.highlight_label && dripData.highlight_label.trim() !== '') {
    highlights.push({
      label: dripData.highlight_label,
      img: dripData.highlight_img || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE'
    });
  }
  if (dripData.highlight_label_2 && dripData.highlight_label_2.trim() !== '') {
    highlights.push({
      label: dripData.highlight_label_2,
      img: dripData.highlight_img_2 || 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ'
    });
  }

  const hasHighlights = highlights.length > 0;
  if (hasHighlights) {
    const colWidth = highlights.length === 2 ? '48%' : '100%';
    highlightHtml = `
      <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; display: block; margin-bottom: 8px; text-align: center;">⭐ Product${highlights.length > 1 ? 's' : ''} of the Month</span>
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          ${highlights.map((h, idx) => `
            <td align="center" width="${colWidth}" valign="top">
              <img src="${h.img}" style="width: 100%; max-width: 120px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; border: 1px solid #c9a84c; display: block; margin: 0 auto 4px auto;" alt="${h.label}">
              <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; font-weight: bold; color: #1a1a1a;">${h.label}</div>
            </td>
            ${idx === 0 && highlights.length === 2 ? '<td width="4%"></td>' : ''}
          `).join('')}
        </tr>
      </table>
    `;
  }

  const rewardSectionHtml = buildCombinedRewardSectionHtml(points, rewardProducts, activePromo);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Garamond', 'Georgia', serif; background-color: #f9f7f2; color: #1a1a1a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  .email-wrapper { width: 100%; background-color: #f9f7f2; display: flex; justify-content: center; padding: 20px 0; }
  .email-container { width: 100%; max-width: 450px; background: #ffffff; border: 1px solid #e0d6bc; box-shadow: 0 15px 40px rgba(0,0,0,0.03); margin: 0 auto; overflow: hidden; }
  .brand-header { padding: 30px 20px 15px; text-align: center; background-color: #ffffff; }
  .logo-text { font-size: 22px; letter-spacing: 5px; text-transform: uppercase; font-weight: 300; margin: 0; color: #1a1a1a; }
  .temple-img { width: 100%; height: auto; object-fit: cover; display: block; border: 0; }
  .main-content { padding: 20px 18px; text-align: center; line-height: 1.6; }
  .quote-container { margin: 18px 0; padding: 16px; background-color: #fdfbf8; border-left: 1px solid #d4c197; border-right: 1px solid #d4c197; }
  .transition-zone { margin: 20px 0; padding: 12px 10px; font-style: italic; color: #8c7e5d; font-size: 12.5px; border-top: 1px double #e0d6bc; border-bottom: 1px double #e0d6bc; }
  .strict-1-1 { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; border: 1px solid #f0eadd; }
  .footer { padding: 36px 20px; background-color: #1a1a1a; color: #ffffff; text-align: center; }
</style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-container">
    <div class="brand-header">
      <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8px; letter-spacing: 2px; color: #8c7e5d; text-transform: uppercase; margin-bottom: 8px; display: block;">${monthLabel} • Dedicated Service</span>
      <h1 class="logo-text">Timeless Creations</h1>
      <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 1.5px; color: #8c7e5d; margin-top: 6px; text-transform: uppercase;">Most Trusted Online LDS Store by Members &amp; Missionaries Across the Philippines</div>
    </div>
    <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" class="temple-img">
    <div class="main-content">
      <div style="font-size: 18px; font-style: italic; margin-bottom: 10px; color: #1a1a1a;">Hello ${name},</div>
      <div style="font-size: 13.5px; color: #333; margin-bottom: 16px;">${message}</div>
      <div class="quote-container">
        <div style="font-size: 14px; font-style: italic; color: #1a1a1a; margin-bottom: 6px;">"${scripture}"</div>
        <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; color: #8c7e5d;">${theme}</div>
      </div>

      <div class="transition-zone">
        As you focus on your sacred work, let us handle the small details that help you present your best self to the world.
      </div>

      <!-- 2 Missionary Essentials & Assurance -->
      <div style="padding: 20px 14px; border: 1px solid #f0eadd; background-color: #ffffff; border-radius: 4px; margin: 20px 0;">
        <h2 style="font-weight: 400; letter-spacing: 2px; text-transform: uppercase; font-size: 13px; margin: 0 0 16px 0; color: #1a1a1a; text-align: center;">Missionary Essentials</h2>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="48%" valign="top">
              <img src="${dripData.ess1_img || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE'}" style="width: 100%; max-width: 125px; aspect-ratio: 1/1; object-fit: cover; border: 1px solid #d4c197; border-radius: 3px; display: block; margin: 0 auto 6px auto;" alt="${dripData.ess1_name || 'Wooden Nametag'}">
              <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; color: #8c7e5d; font-weight: bold;">${dripData.ess1_name || 'Wooden Nametag'}</div>
            </td>
            <td width="4%"></td>
            <td align="center" width="48%" valign="top">
              <img src="${dripData.ess2_img || 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ'}" style="width: 100%; max-width: 125px; aspect-ratio: 1/1; object-fit: cover; border: 1px solid #d4c197; border-radius: 3px; display: block; margin: 0 auto 6px auto;" alt="${dripData.ess2_name || 'POS Kit'}">
              <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; color: #8c7e5d; font-weight: bold;">${dripData.ess2_name || 'POS Kit'}</div>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; margin-top: 18px; color: #555; line-height: 1.5; text-align: center;">
          If you have doubts with us as scams, we offer our first time customers with a <strong>"Gawa muna bago bayad"</strong> assurance.
        </p>
        <div style="background-color: #1a1a1a; color: #d4c197; padding: 10px; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 2px; margin: 14px 0 16px; font-weight: bold; text-align: center; border-radius: 2px;">
          Work, Confirm, Pay
        </div>
        <div style="text-align: center;">
          <a href="https://m.me/timeless.creations.06" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; border: 1.5px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; border-radius: 2px;">
            Inquire via Messenger
          </a>
        </div>
      </div>

      ${hasHighlights ? `
        <div style="margin: 20px 0; padding: 16px 12px; background: #faf7f0; border: 1px solid #c9a84c; border-radius: 4px;">
          ${highlightHtml}
        </div>
      ` : ''}

      <!-- 9 Community Photos & Google Photos Link -->
      <div style="margin: 26px auto 20px; text-align: center;">
        <h2 style="font-weight: 400; letter-spacing: 2px; text-transform: uppercase; font-size: 13px; margin-bottom: 6px; color: #1a1a1a;">Engrave Your Legacy</h2>
        <p style="font-size: 12px; color: #666; font-style: italic; line-height: 1.5; margin-bottom: 14px; padding: 0 10px;">
          Your service is a story that deserves to be told. We are archiving the moments that define a mission—one missionary, one memory, and one creation at a time.
        </p>
        <table width="100%" border="0" cellspacing="3" cellpadding="0" style="table-layout: fixed; margin-bottom: 16px;">
          <tr>
            <td><img src="${dripData.grid1 || 'https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex'}" class="strict-1-1" alt="Community Photo 1"></td>
            <td><img src="${dripData.grid2 || 'https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky'}" class="strict-1-1" alt="Community Photo 2"></td>
            <td><img src="${dripData.grid3 || 'https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv'}" class="strict-1-1" alt="Community Photo 3"></td>
          </tr>
          <tr>
            <td><img src="${dripData.grid4 || 'https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR'}" class="strict-1-1" alt="Community Photo 4"></td>
            <td><img src="${dripData.grid5 || 'https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m'}" class="strict-1-1" alt="Community Photo 5"></td>
            <td><img src="${dripData.grid6 || 'https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV'}" class="strict-1-1" alt="Community Photo 6"></td>
          </tr>
          <tr>
            <td><img src="${dripData.grid7 || 'https://lh3.googleusercontent.com/u/0/d/1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY'}" class="strict-1-1" alt="Community Photo 7"></td>
            <td><img src="${dripData.grid8 || 'https://lh3.googleusercontent.com/u/0/d/15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI'}" class="strict-1-1" alt="Community Photo 8"></td>
            <td><img src="${dripData.grid9 || 'https://lh3.googleusercontent.com/u/0/d/1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC'}" class="strict-1-1" alt="Community Photo 9"></td>
          </tr>
        </table>
        <p style="font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; letter-spacing: 1.5px; color: #8c7e5d; text-transform: uppercase; font-weight: bold; margin: 0 0 10px 0;">
          Engrave Your Memory. Be the Memory. Be You.
        </p>
        <a href="https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7" target="_blank" style="display: inline-block; padding: 10px 22px; border: 1.5px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; border-radius: 2px;">
          Enter the Gallery ↗
        </a>
      </div>

      <!-- Combined Rewards & Promo Box -->
      ${rewardSectionHtml}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div style="color: #d4c197; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; font-weight: bold;">Timeless Creations</div>
      <div style="font-size: 9px; opacity: 0.6; margin-top: 10px; font-family: Arial, sans-serif; line-height: 1.4;">Supporting Members &amp; Missionaries Across the Philippines • Since 2025</div>
      <a href="https://m.me/TimelessCreationsRP" target="_blank" style="font-size: 9.5px; color: #b8955a; text-decoration: none; margin-top: 18px; display: inline-block; font-family: 'Helvetica', Arial, sans-serif; letter-spacing: 1px;">
        Redeem Rewards &amp; Support in Messenger →
      </a>
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function sendDripEmail(to, month = 1, customName = "Elder Smith") {
  let promo = null;
  let rewardProducts = [];
  try {
    const promoRows = await runSql("SELECT code, points, max_users, claimed_count FROM promo_codes WHERE claimed_count < max_users ORDER BY created_at DESC LIMIT 1");
    if (promoRows && promoRows.length > 0) promo = promoRows[0];
    rewardProducts = await runSql("SELECT name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC");
  } catch (_) {}

  const html = renderMonthlyDripTemplate({ month, name: customName, points: 2 }, rewardProducts, promo);
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
