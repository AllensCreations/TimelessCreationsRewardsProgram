import 'dotenv/config';
import { runSql } from './db.js';

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

  if (dripData.custom_html && dripData.custom_html.trim().length > 50) {
    let custom = dripData.custom_html
      .replace(/{{MONTH}}/g, monthLabel)
      .replace(/{{NAME}}/g, name)
      .replace(/{{MESSAGE}}/g, message)
      .replace(/{{SCRIPTURE}}/g, scripture)
      .replace(/{{THEME}}/g, theme)
      .replace(/{{POINTS}}/g, String(points))
      .replace(/{{TOP_PRODUCTS_HTML}}/g, topProductsHtml)
      .replace(/{{REWARD_SECTION_HTML}}/g, rewardSectionHtml)
      .replace(/{{ESS1_NAME}}/g, dripData.ess1_name || 'Wooden Nametag')
      .replace(/{{ESS1_IMG}}/g, dripData.ess1_img || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE')
      .replace(/{{ESS2_NAME}}/g, dripData.ess2_name || 'POS Kit')
      .replace(/{{ESS2_IMG}}/g, dripData.ess2_img || 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ');

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
    for (let i = 1; i <= 9; i++) {
      const gImg = dripData[`grid${i}`] || defaultGrids[i - 1];
      custom = custom.replace(new RegExp(`{{GRID${i}}}`, 'g'), gImg);
    }
    return custom;
  }

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

      <!-- Top 1 & Top 2 Showcase in 2 Columns -->
      ${topProductsHtml}

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
    ? dripData.subject.replace(/{{MONTH}}/g, monthLabel).replace(/{{NAME}}/g, customName)
    : `Monthly Encouragement (${monthLabel}) • Timeless Creations`;

  const html = renderMonthlyDripTemplate(dripData, rewardProducts, promo);
  return await sendEmail({ to, subject: subjectLine, htmlContent: html });
}

export function renderOtpTemplate({ name = "Missionary", otpCode = "749281", displayDate = null } = {}) {
  const cleanName = name || "Missionary";
  const cleanDate = displayDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Passcode | Timeless Creations</title>
  <style>
    body { margin: 0; padding: 0; background-color: #1a1610; font-family: Georgia, 'Times New Roman', serif; -webkit-font-smoothing: antialiased; }
    .email-shell { max-width: 460px; width: 100%; margin: 24px auto; background-color: #faf7f0; border: 1px solid #d6c9a8; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .header { background: linear-gradient(135deg, #2c221e, #1a1610); color: #d4b07a; padding: 26px 20px; text-align: center; }
    .body-content { padding: 30px 24px; color: #2c221e; line-height: 1.7; font-size: 14px; text-align: center; }
    .otp-box { background: #fdfbf8; border: 2px dashed #b8955a; padding: 16px 20px; font-size: 30px; font-weight: bold; letter-spacing: 6px; color: #8b1a1a; font-family: 'Helvetica', Arial, sans-serif; margin: 18px 0; border-radius: 6px; text-align: center; }
    .btn-gold { display: inline-block; background-color: #1c1208; color: #d4b07a !important; padding: 11px 20px; text-decoration: none; font-weight: bold; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px; margin: 4px; font-family: 'Helvetica', Arial, sans-serif; }
    .btn-outline { display: inline-block; background-color: #ffffff; color: #1c1208 !important; border: 1.5px solid #1c1208; padding: 10px 18px; text-decoration: none; font-weight: bold; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px; margin: 4px; font-family: 'Helvetica', Arial, sans-serif; }
    .footer { background-color: #0e0c08; padding: 18px 20px; text-align: center; color: rgba(255,255,255,0.45); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Helvetica', Arial, sans-serif; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#1a1610;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table class="email-shell" border="0" cellspacing="0" cellpadding="0" width="460">
          <tr>
            <td class="header">
              <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8955a; margin-bottom: 6px; font-family: 'Helvetica', Arial, sans-serif;">Timeless Creations • ${cleanDate}</div>
              <div style="font-size: 22px; font-weight: bold;">Account Verification 🔐</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong>${cleanName}</strong>,</p>
              <p style="color: #444; font-size: 13.5px; margin-bottom: 8px;">
                Please enter this 6-digit verification passcode in Messenger to verify your missionary email and activate your TCRP rewards account:
              </p>

              <div class="otp-box">
                ${otpCode}
              </div>

              <p style="font-size: 12px; color: #777; margin-bottom: 20px;">
                ⏱️ This code is valid for your current verification session. If you did not request this, please ignore this email.
              </p>

              <div style="margin-top: 10px;">
                <a href="https://m.me/TimelessCreationsRP" class="btn-gold" target="_blank">Open Messenger Bot →</a>
                <a href="https://m.me/timeless.creations.06" class="btn-outline" target="_blank">Contact Store Support →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderReceiptTemplate(order = {}) {
  const name = order.name || "Elder / Sister";
  const orderId = order.order_id || `TCRP-${Date.now().toString().slice(-4)}`;
  const item = order.item || "Wooden Missionary Nametag";
  const pointsCost = order.points_cost !== undefined ? order.points_cost : 6;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redemption Receipt | Timeless Creations</title>
  <style>
    body { margin: 0; padding: 0; background-color: #1a1610; font-family: Georgia, 'Times New Roman', serif; -webkit-font-smoothing: antialiased; }
    .email-shell { max-width: 460px; width: 100%; margin: 24px auto; background-color: #faf7f0; border: 1px solid #d6c9a8; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .header { background: linear-gradient(135deg, #2c221e, #1a1610); color: #d4b07a; padding: 26px 20px; text-align: center; }
    .body-content { padding: 30px 24px; color: #2c221e; line-height: 1.7; font-size: 14px; text-align: center; }
    .receipt-card { background: #fdfbf8; border: 2px dashed #b8955a; padding: 18px 20px; border-radius: 6px; margin: 20px 0; text-align: left; }
    .btn-gold { display: inline-block; background-color: #1c1208; color: #d4b07a !important; padding: 11px 20px; text-decoration: none; font-weight: bold; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px; margin: 4px; font-family: 'Helvetica', Arial, sans-serif; }
    .btn-outline { display: inline-block; background-color: #ffffff; color: #1c1208 !important; border: 1.5px solid #1c1208; padding: 10px 18px; text-decoration: none; font-weight: bold; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px; margin: 4px; font-family: 'Helvetica', Arial, sans-serif; }
    .footer { background-color: #0e0c08; padding: 18px 20px; text-align: center; color: rgba(255,255,255,0.45); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Helvetica', Arial, sans-serif; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#1a1610;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table class="email-shell" border="0" cellspacing="0" cellpadding="0" width="460">
          <tr>
            <td class="header">
              <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8955a; margin-bottom: 6px; font-family: 'Helvetica', Arial, sans-serif;">Timeless Creations Rewards • ${dateStr}</div>
              <div style="font-size: 22px; font-weight: bold;">Redemption Receipt 🧾</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong>${name}</strong>,</p>
              <p style="color: #444; font-size: 13.5px;">Your freebie reward redemption has been successfully logged in our system!</p>
              
              <div class="receipt-card">
                <div style="font-size: 10.5px; font-weight: bold; color: #8b1a1a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Helvetica', Arial, sans-serif;">📋 Order Details:</div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Order ID:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #8b1a1a;">${orderId}</span></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Item Claimed:</strong> <strong>${item}</strong></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Points Used:</strong> <strong>${pointsCost} PTS</strong></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Status:</strong> <span style="color: #b8955a; font-weight: bold;">PENDING FULFILLMENT</span></div>
              </div>

              <div style="background: #fffcf5; border-left: 3px solid #b8955a; padding: 12px 14px; text-align: left; margin-bottom: 22px; font-size: 12.5px; color: #5a4a28; line-height: 1.6;">
                💡 <strong>Next Steps:</strong> Please take a screenshot of this receipt and send it to our store page alongside your shipping address or companion notes so we can prepare your package!
              </div>

              <div>
                <a href="https://m.me/timeless.creations.06" class="btn-gold" target="_blank">Send Screenshot via Messenger →</a>
                <a href="https://m.me/TimelessCreationsRP" class="btn-outline" target="_blank">Rewards Bot Dashboard →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderThankYouTemplate(order = {}, status = "COMPLETED") {
  const name = order.name || "Elder / Sister";
  const orderId = order.order_id || `TCRP-${Date.now().toString().slice(-4)}`;
  const item = order.item || "Wooden Missionary Nametag";
  const cleanStatus = (status || "COMPLETED").toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const isCompleted = cleanStatus === "COMPLETED" || cleanStatus === "PAID" || cleanStatus === "DELIVERED";
  const title = isCompleted ? "Order Completed & Fulfilled ✨" : `Order Status: ${cleanStatus} 📦`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Timeless Creations</title>
  <style>
    body { margin: 0; padding: 0; background-color: #1a1610; font-family: Georgia, 'Times New Roman', serif; -webkit-font-smoothing: antialiased; }
    .email-shell { max-width: 460px; width: 100%; margin: 24px auto; background-color: #faf7f0; border: 1px solid #d6c9a8; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .header { background: linear-gradient(135deg, #2c221e, #1a1610); color: #d4b07a; padding: 26px 20px; text-align: center; }
    .body-content { padding: 30px 24px; color: #2c221e; line-height: 1.7; font-size: 14px; text-align: center; }
    .summary-card { background: #fdfbf8; border: 2px dashed #b8955a; padding: 18px 20px; border-radius: 6px; margin: 20px 0; text-align: left; }
    .btn-gold { display: inline-block; background-color: #1c1208; color: #d4b07a !important; padding: 11px 20px; text-decoration: none; font-weight: bold; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px; margin: 4px; font-family: 'Helvetica', Arial, sans-serif; }
    .btn-outline { display: inline-block; background-color: #ffffff; color: #1c1208 !important; border: 1.5px solid #1c1208; padding: 10px 18px; text-decoration: none; font-weight: bold; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px; margin: 4px; font-family: 'Helvetica', Arial, sans-serif; }
    .footer { background-color: #0e0c08; padding: 18px 20px; text-align: center; color: rgba(255,255,255,0.45); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Helvetica', Arial, sans-serif; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#1a1610;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table class="email-shell" border="0" cellspacing="0" cellpadding="0" width="460">
          <tr>
            <td class="header">
              <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8955a; margin-bottom: 6px; font-family: 'Helvetica', Arial, sans-serif;">Timeless Creations • ${dateStr}</div>
              <div style="font-size: 22px; font-weight: bold;">${title}</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong>${name}</strong>,</p>
              <p style="color: #444; font-size: 13.5px;">
                ${isCompleted ? `Your order <strong>${orderId}</strong> has been successfully processed and fulfilled!` : `Here is an update regarding your order <strong>${orderId}</strong>.`}
              </p>
              
              <div class="summary-card">
                <div style="font-size: 10.5px; font-weight: bold; color: #8b1a1a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Helvetica', Arial, sans-serif;">📦 Fulfillment Summary:</div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Order ID:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #8b1a1a;">${orderId}</span></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Item / Package:</strong> <strong>${item}</strong></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">${cleanStatus}</span></div>
              </div>

              <p style="font-style: italic; color: #7a6030; font-size: 13px; line-height: 1.6; margin-bottom: 22px;">
                Thank you for your dedicated missionary service and for trusting Timeless Creations! If you have any questions or need further assistance, feel free to chat with us anytime.
              </p>

              <div>
                <a href="https://m.me/timeless.creations.06" class="btn-gold" target="_blank">Chat with Store Support →</a>
                <a href="https://m.me/TimelessCreationsRP" class="btn-outline" target="_blank">Rewards Bot Dashboard →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
