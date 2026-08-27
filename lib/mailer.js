import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { runSql } from './db.js';

export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || 'noreply.timelesscreations.ph@gmail.com').trim();
  const senderName = (process.env.SENDER_NAME || 'Timeless Creations').trim();

  if (!apiKey || apiKey.startsWith('MOCK') || apiKey.startsWith('EAA_MOCK')) {
    console.log(`[BREVO SIMULATOR] Email to ${to} | Subject: ${subject}`);
    return { ok: true, simulated: true };
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseBody = await res.json().catch(() => null);
    if (!res.ok) {
      const errMsg = responseBody?.message || responseBody?.error || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errMsg };
    }

    return { ok: true, messageId: responseBody?.messageId || "sent" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function buildRewardSectionHtml(points = 2, products = []) {
  const userPoints = Number(points) || 0;
  const validProducts = Array.isArray(products) ? products : [];
  const affordable = validProducts.filter(p => Number(p.price) <= userPoints);

  let claimBoxContent = '';

  if (affordable.length > 0) {
    claimBoxContent = `
      <div style="font-size:11px; font-weight:bold; color:#1a1a1a; margin-bottom:8px; text-align:left;">
        🎉 You can claim these reward items right now:
      </div>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
        ${affordable.map(item => `
          <tr>
            <td style="padding:6px; background:#ffffff; border:1px solid #e0d6bc; border-radius:4px; margin-bottom:6px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="40" valign="middle">
                    <img src="${item.image_url || 'https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png'}" style="width:36px; height:36px; aspect-ratio:1/1; object-fit:cover; border-radius:3px; display:block;">
                  </td>
                  <td style="padding-left:10px; text-align:left;" valign="middle">
                    <div style="font-weight:bold; font-size:11px; color:#1a1a1a;">${item.name}</div>
                    <div style="font-size:9.5px; color:#8c7e5d; font-weight:bold;">⭐ ${item.price} Points</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="4"></td></tr>
        `).join('')}
      </table>
    `;
  } else if (validProducts.length > 0) {
    const sorted = [...validProducts].sort((a, b) => Number(a.price) - Number(b.price));
    const nearestItem = sorted.find(p => Number(p.price) > userPoints) || sorted[0];
    const needed = Math.max(1, (Number(nearestItem.price) || 6) - userPoints);

    claimBoxContent = `
      <div style="background:#ffffff; border:1px solid #e0d6bc; border-radius:6px; padding:12px; text-align:center; margin-bottom:12px;">
        <span style="font-size:9.5px; color:#8b1a1a; font-weight:bold; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:6px;">
          🔥 You're so close! Next Goal:
        </span>
        <img src="${nearestItem.image_url || 'https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png'}" style="width:55px; height:55px; aspect-ratio:1/1; object-fit:cover; border-radius:4px; display:block; margin:0 auto 6px auto; border:1px solid #d4c197;">
        <div style="font-weight:bold; font-size:11.5px; color:#1a1a1a;">${nearestItem.name} (${nearestItem.price} PTS)</div>
        <div style="font-size:11px; color:#8c7e5d; margin-top:4px; font-weight:bold;">
          ⚡ Only <strong>${needed} more point${needed > 1 ? 's' : ''}</strong> needed to claim!
        </div>
        <div style="font-size:9.5px; color:#777777; margin-top:4px; line-height:1.3;">
          Invite just <strong>${needed} companion${needed > 1 ? 's' : ''}</strong> with your referral link to unlock this reward!
        </div>
      </div>
    `;
  } else {
    claimBoxContent = `
      <div style="background:#ffffff; border:1px solid #e0d6bc; border-radius:6px; padding:16px 14px; text-align:center; margin-bottom:12px;">
        <span style="font-size:10px; color:#8b1a1a; font-weight:bold; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:6px;">
          🌱 No Rewards Available Just Yet
        </span>
        <div style="font-size:11px; color:#444444; line-height:1.5; font-style:italic;">
          Great things take a little time to brew! Keep serving with all your heart—we're working on fresh perks and missionary essentials to celebrate your dedication soon.
        </div>
      </div>
    `;
  }

  return `
    <div style="padding:16px 12px; background-color:#fdfaf3; border:1px solid #c9a84c; border-radius:4px; margin-top:18px;">
      <div style="font-family:'Helvetica', Arial, sans-serif; font-size:12px; font-weight:bold; color:#8b1a1a; margin-bottom:4px;">🎁 Your TCRP Reward Balance</div>
      <div style="font-size:11.5px; color:#555555; margin-bottom:12px;">You currently have <strong>${userPoints}</strong> Points.</div>
      ${claimBoxContent}
      <a href="https://m.me/TimelessCreationsRP" target="_blank" style="display:block; width:88%; margin:0 auto; padding:10px 8px; background-color:#1a1a1a; color:#d4c197 !important; text-decoration:none; font-family:'Helvetica', Arial, sans-serif; font-size:9px; text-transform:uppercase; letter-spacing:1px; font-weight:bold; border-radius:3px;">
        Redeem Rewards (m.me/TimelessCreationsRP)
      </a>
    </div>
  `;
}

// Clean month representation without Odd/Even text
export function getCalendarMonthLabel(monthIndex) {
  const calendarNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = (Number(monthIndex) - 1) % 12;
  return calendarNames[idx];
}

export function renderMonthlyDripTemplate(dripData = {}, rewardProducts = []) {
  const masterTemplatePath = path.resolve("templates/monthly-drip.html");
  const masterTemplate = fs.readFileSync(masterTemplatePath, "utf8");

  let template = dripData.custom_html && dripData.custom_html.trim() !== "" 
    ? dripData.custom_html 
    : masterTemplate;

  const monthNum = dripData.month || 1;
  const monthDisplayLabel = getCalendarMonthLabel(monthNum);
  const name = dripData.name || "Elder Smith";
  const theme = dripData.theme || "Elder Jeffrey R. Holland";
  const scripture = (dripData.scripture || "Trust in the Lord with all thine heart; and lean not unto thine own understanding.").replace(/^["'“](.*)["'”]$/, '$1').trim();
  const message = (dripData.message || `May your faith be strengthened as you serve and invite others during ${monthDisplayLabel}.`).replace(/\n/g, '<br>');
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
    highlightHtml = highlights.map(h => `
      <td align="center" width="${colWidth}" valign="top" style="padding:4px;">
        <img class="img-square" src="${h.img}" style="max-width:130px; border-radius:4px; border:1px solid #c9a84c; margin:0 auto 6px auto;" alt="Highlight">
        <div style="font-family:'Helvetica', Arial, sans-serif; font-size:9.5px; font-weight:bold; color:#1a1a1a;">${h.label}</div>
      </td>
    `).join('<td width="4%"></td>');
  }

  const rewardSectionHtml = buildRewardSectionHtml(points, rewardProducts);

  return template
    .replace(/{{MONTH}}/g, monthDisplayLabel)
    .replace(/{{NAME}}/g, String(name))
    .replace(/{{MESSAGE}}/g, String(message))
    .replace(/{{SCRIPTURE}}/g, String(scripture))
    .replace(/{{THEME}}/g, String(theme))
    .replace(/{{POINTS}}/g, String(points))
    .replace(/{{ESS1_NAME}}/g, dripData.ess1_name || "Wooden Nametag")
    .replace(/{{ESS1_IMG}}/g, dripData.ess1_img || "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE")
    .replace(/{{ESS2_NAME}}/g, dripData.ess2_name || "POS Kit")
    .replace(/{{ESS2_IMG}}/g, dripData.ess2_img || "https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ")
    .replace(/{{HIGHLIGHT_DISPLAY}}/g, hasHighlights ? "display:block" : "display:none")
    .replace(/{{HIGHLIGHT_ITEMS_HTML}}/g, highlightHtml)
    .replace(/{{REWARD_SECTION_HTML}}/g, rewardSectionHtml)
    .replace(/{{GRID1}}/g, dripData.grid1 || "https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex")
    .replace(/{{GRID2}}/g, dripData.grid2 || "https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky")
    .replace(/{{GRID3}}/g, dripData.grid3 || "https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv")
    .replace(/{{GRID4}}/g, dripData.grid4 || "https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR")
    .replace(/{{GRID5}}/g, dripData.grid5 || "https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m")
    .replace(/{{GRID6}}/g, dripData.grid6 || "https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV")
    .replace(/{{GRID7}}/g, dripData.grid7 || "https://lh3.googleusercontent.com/u/0/d/1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY")
    .replace(/{{GRID8}}/g, dripData.grid8 || "https://lh3.googleusercontent.com/u/0/d/15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI")
    .replace(/{{GRID9}}/g, dripData.grid9 || "https://lh3.googleusercontent.com/u/0/d/1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC")
    .replace(/{{GALLERY_URL}}/g, dripData.gallery_url || "https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7");
}

export async function sendDripEmail(to, month = 1, customName = "Elder Smith") {
  let dripData = { month, name: customName, points: 2 };
  let rewardProducts = [];

  try {
    const dbDrip = (await runSql("SELECT * FROM drip_messages WHERE month = ?", [month]))[0];
    if (dbDrip) {
      dripData = { ...dripData, ...dbDrip };
    }
    const extraRows = await runSql("SELECT value FROM system_config WHERE key = ?", [`drip_${month}_highlight_2`]);
    if (extraRows?.[0]?.value) {
      try {
        const extra = JSON.parse(extraRows[0].value);
        dripData.highlight_label_2 = extra.label;
        dripData.highlight_img_2 = extra.img;
      } catch (_) {}
    }

    const missionary = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [to]))[0];
    if (missionary && missionary.points !== undefined) {
      dripData.points = missionary.points;
    }
    rewardProducts = await runSql("SELECT name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC");
  } catch (_) {}

  const html = renderMonthlyDripTemplate(dripData, rewardProducts);
  const monthLabel = getCalendarMonthLabel(month);
  const subjectLine = dripData.subject && dripData.subject.trim() !== "" 
    ? dripData.subject 
    : `Monthly Encouragement (${monthLabel}) • Timeless Creations`;

  return await sendEmail({
    to,
    subject: subjectLine,
    htmlContent: html
  });
}

export async function sendOTPEmail(to, otpCode = "749281") {
  const templatePath = path.resolve("templates/otp-email.html");
  let html = fs.existsSync(templatePath) 
    ? fs.readFileSync(templatePath, "utf8").replace(/{{OTP_CODE}}/g, otpCode)
    : `<h2>Verification Code: ${otpCode}</h2>`;

  return await sendEmail({ to, subject: `🔐 Your Verification Code: ${otpCode}`, htmlContent: html });
}

export async function sendReceiptEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-9921", item: "Wooden Missionary Nametag", points_cost: 6 }) {
  const templatePath = path.resolve("templates/receipt-email.html");
  let html = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, "utf8")
        .replace(/{{NAME}}/g, order.name || "Missionary")
        .replace(/{{ORDER_ID}}/g, order.order_id || "TCRP-ORDER")
        .replace(/{{ITEM}}/g, order.item || "Reward Item")
        .replace(/{{POINTS_COST}}/g, String(order.points_cost || 0))
    : `<h2>Redemption Receipt: ${order.order_id}</h2>`;

  return await sendEmail({ to, subject: `🧾 Redemption Receipt (${order.order_id})`, htmlContent: html });
}

export async function sendThankYouEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-9921", item: "Wooden Missionary Nametag" }) {
  const templatePath = path.resolve("templates/thankyou-email.html");
  let html = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, "utf8")
        .replace(/{{NAME}}/g, order.name || "Missionary")
        .replace(/{{ORDER_ID}}/g, order.order_id || "TCRP-ORDER")
        .replace(/{{ITEM}}/g, order.item || "Reward Item")
    : `<h2>Order Completed: ${order.order_id}</h2>`;

  return await sendEmail({ to, subject: `📦 Order Completed & Thank You! (${order.order_id}) • Timeless Creations`, htmlContent: html });
}

export async function sendOrderStatusEmail(to, order = { name: "Missionary", order_id: "TCRP-0000", item: "Item" }, status = "PAID") {
  const statusMessages = {
    "PAID": "Your payment has been successfully verified and recorded.",
    "READY FOR PICKUP": "Your freebie reward / order is now complete, prepared, and ready for pickup!",
    "OUT FOR DELIVERY": "Your order is currently out for delivery with our courier. Please keep your phone ready!",
    "DELIVERED": "Your order has been successfully delivered. Thank you for choosing Timeless Creations!"
  };
  const desc = statusMessages[status] || `Your order status has been updated to: ${status}`;
  const html = `
    <div style="font-family:Georgia,serif; max-width:450px; margin:0 auto; background:#ffffff; border:1px solid #e0d6bc; padding:30px; color:#1a1a1a;">
      <h2 style="color:#8b1a1a; margin-top:0; font-family:Syne,sans-serif;">Timeless Creations Update</h2>
      <p>Hello <strong>${order.name}</strong>,</p>
      <p>We are writing to update you regarding your order/claim <strong>${order.order_id}</strong>.</p>
      <div style="background:#fdfaf3; border-left:3px solid #c9a84c; padding:12px; margin:16px 0;">
        <strong>Status Update:</strong> <span style="color:#8b1a1a; text-transform:uppercase; font-weight:bold;">${status}</span><br>
        <p style="margin:6px 0 0 0; font-size:13px; color:#444;">${desc}</p>
      </div>
      <p style="font-size:13px; color:#666;">Items: ${order.item}</p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
      <p style="font-size:11px; color:#888; text-align:center;">Timeless Creations • Supporting Missionaries Across the Philippines</p>
    </div>
  `;
  return await sendEmail({ to, subject: `📦 Order Update [${status}] • ${order.order_id} • Timeless Creations`, htmlContent: html });
}
