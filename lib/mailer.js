import 'dotenv/config';
import { runSql } from './db.js';

export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || 'noreply.timelesscreations.ph@gmail.com').trim();
  const senderName = (process.env.SENDER_NAME || 'Timeless Creations').trim();

  if (!apiKey) {
    console.error("❌ Brevo API Error: BREVO_API_KEY is not defined.");
    return { ok: false, error: "BREVO_API_KEY is missing." };
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

export async function sendDripEmail(to, month = 1, customName = "Elder Smith") {
  let theme = "Elder Jeffrey R. Holland";
  let scripture = "Trust in the Lord with all thine heart; and lean not unto thine own understanding.";
  let message = `May your faith be strengthened as you serve and invite others to come unto Christ during Month ${month}.`;
  let highlightImg = "";
  let highlightLabel = "";
  let missionaryPoints = 2;

  try {
    const dbDrip = (await runSql("SELECT * FROM drip_messages WHERE month = ?", [month]))[0];
    if (dbDrip) {
      theme = dbDrip.theme || theme;
      scripture = dbDrip.scripture || scripture;
      message = dbDrip.message || message;
      highlightImg = dbDrip.highlight_img || "";
      highlightLabel = dbDrip.highlight_label || "";
    }

    const missionary = (await runSql("SELECT points FROM missionaries WHERE LOWER(email) = LOWER(?)", [to]))[0];
    if (missionary && missionary.points !== undefined) {
      missionaryPoints = missionary.points;
    }
  } catch(e) {}

  const cleanedQuote = scripture.replace(/^["'“](.*)["'”]$/, '$1').trim();

  // Modern, warm, premium editorial email layout
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0; padding:30px 10px; background-color:#f4f1ea; font-family:'Georgia', serif; color:#2c2c2c;">
      <div style="max-width:500px; margin:0 auto; background:#ffffff; border:1px solid #e3dec9; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08);">
        
        <!-- Header Brand -->
        <div style="padding: 36px 24px 20px 24px; text-align: center; background: #ffffff;">
          <span style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 3px; color: #9c8c6c; text-transform: uppercase; display: block; margin-bottom: 10px;">Month ${month} • Dedicated Service</span>
          <h1 style="font-size: 22px; letter-spacing: 4px; text-transform: uppercase; font-weight: normal; margin: 0; color: #1a1a1a;">Timeless Creations</h1>
          <div style="font-family: Arial, sans-serif; font-size: 8px; letter-spacing: 1.5px; color: #8c7e5d; margin-top: 6px; text-transform: uppercase;">Missionary Rewards &amp; Encouragement Program</div>
        </div>

        <!-- Hero Image -->
        <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" style="width: 100%; height: auto; max-height: 220px; object-fit: cover; display: block;">

        <!-- Main Body -->
        <div style="padding: 28px 24px; text-align: left; line-height: 1.7;">
          <div style="font-size: 18px; font-style: italic; margin-bottom: 14px; color: #1a1a1a;">Hello ${customName},</div>
          <div style="font-size: 14px; color: #444444; margin-bottom: 22px;">${message.replace(/\n/g, '<br>')}</div>

          <!-- Quote Callout Box -->
          <div style="margin: 24px 0; padding: 20px; background-color: #faf7f0; border-left: 3px solid #c9a84c; border-radius: 0 8px 8px 0;">
            <div style="font-size: 14px; font-style: italic; color: #2c2c2c; line-height: 1.6; margin-bottom: 8px;">"${cleanedQuote}"</div>
            <div style="font-family: Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; color: #8c7e5d;">— ${theme}</div>
          </div>

          <!-- Essentials Section -->
          <div style="padding: 22px 16px; background: #fdfbf7; border: 1px solid #ebdcb5; border-radius: 8px; margin-top: 24px; text-align: center;">
            <h3 style="font-family: Arial, sans-serif; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; font-size: 11px; margin: 0 0 16px 0; color: #1a1a1a;">Featured Missionary Essentials</h3>
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" width="48%" valign="top">
                  <img src="https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE" style="width: 110px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #d4c197; display: block; margin: 0 auto 6px auto;" alt="Nametag">
                  <div style="font-family: Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; color: #8c7e5d; font-weight: bold;">Wooden Nametag</div>
                </td>
                <td width="4%"></td>
                <td align="center" width="48%" valign="top">
                  <img src="https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ" style="width: 110px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #d4c197; display: block; margin: 0 auto 6px auto;" alt="POS Kit">
                  <div style="font-family: Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; color: #8c7e5d; font-weight: bold;">POS Kit</div>
                </td>
              </tr>
            </table>

            <div style="margin-top: 18px;">
              <a href="https://m.me/timelesscreations.06" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #1a1a1a; color: #ffffff !important; text-decoration: none; font-family: Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; border-radius: 4px;">Order via Messenger (Gawa Muna)</a>
            </div>
          </div>

          ${highlightLabel && highlightLabel.trim() !== "" ? `
            <!-- Product of the Month -->
            <div style="margin-top: 20px; padding: 18px; background: #fff8eb; border: 1px solid #c9a84c; border-radius: 8px; text-align: center;">
              <span style="font-family: Arial, sans-serif; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; display: block; margin-bottom: 6px;">⭐ Special Product of the Month</span>
              <img src="${highlightImg || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE'}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #c9a84c; display: block; margin: 0 auto 8px auto;" alt="Highlight">
              <div style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">${highlightLabel}</div>
              <a href="https://m.me/timelesscreations.06" target="_blank" style="display: inline-block; padding: 8px 16px; background: #8b1a1a; color: #fff !important; text-decoration: none; font-family: Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; border-radius: 4px;">Inquire Now</a>
            </div>
          ` : ''}

          <!-- Reward Balance Widget -->
          <div style="margin-top: 24px; padding: 16px; background: #f5f2e9; border-radius: 8px; text-align: center;">
            <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #8b1a1a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">🎁 Your TCRP Reward Balance</div>
            <div style="font-size: 13px; color: #555; margin-bottom: 10px;">You currently have <strong>${missionaryPoints} Points</strong> available to claim rewards.</div>
            <a href="https://m.me/TimelessCreationsRP" target="_blank" style="font-family: Arial, sans-serif; font-size: 9.5px; font-weight: bold; color: #1a1a1a; text-decoration: underline;">View Claimable Rewards &rarr;</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 24px 20px; background-color: #1a1a1a; color: #ffffff; text-align: center;">
          <div style="color: #d4c197; letter-spacing: 2px; font-size: 9px; text-transform: uppercase;">Timeless Creations • Philippines</div>
          <div style="font-size: 7.5px; opacity: 0.5; margin-top: 8px; font-family: Arial, sans-serif;">Supporting LDS Missionaries Across the Country • Since 2025</div>
          <div style="margin-top: 10px; font-size: 7.5px; font-family: Arial, sans-serif;">
            <a href="https://timelesscreations.ph/api/main?action=unsubscribe&email=${encodeURIComponent(to)}" target="_blank" style="color: #b0b0b0; text-decoration: underline;">Unsubscribe / Pause Drips</a>
          </div>
        </div>

      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to,
    subject: `Monthly Encouragement (Month ${month}) • Timeless Creations`,
    htmlContent: html
  });
}

export async function sendOTPEmail(to, otpCode = "749281") {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0; padding:30px 10px; background-color:#f4f1ea; font-family:Arial, sans-serif; color:#2c2c2c;">
      <div style="max-width:440px; margin:0 auto; background:#ffffff; border:1px solid #e3dec9; border-radius:12px; padding:32px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.06);">
        <h2 style="font-family:Georgia,serif; color:#c9a84c; margin:0 0 4px 0; font-size:20px;">Timeless Creations</h2>
        <p style="font-size:9px; color:#8c90a4; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:24px;">Verification Code</p>
        
        <p style="font-size:13px; color:#555; line-height:1.6; margin-bottom:20px;">
          Use the confirmation code below to verify your account and unlock your missionary referral rewards:
        </p>

        <div style="background:#faf7f0; border:1px solid #c9a84c; border-radius:8px; padding:16px; margin-bottom:20px;">
          <span style="font-family:monospace; font-size:30px; font-weight:bold; letter-spacing:6px; color:#8b1a1a;">${otpCode}</span>
        </div>

        <p style="font-size:10px; color:#888;">This code expires in 10 minutes. If you did not request this, you may disregard this email.</p>
      </div>
    </body>
    </html>
  `;
  return await sendEmail({ to, subject: `🔐 Your Verification Code: ${otpCode}`, htmlContent: html });
}

export async function sendReceiptEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-9921", item: "Wooden Missionary Nametag", points_cost: 6 }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0; padding:30px 10px; background-color:#f4f1ea; font-family:Georgia,serif; color:#2c2c2c;">
      <div style="max-width:440px; margin:0 auto; background:#ffffff; border:2px solid #c9a84c; border-radius:12px; padding:32px; text-align:center;">
        <h2 style="color:#8b1a1a; margin:0 0 4px 0; font-size:20px;">✨ Timeless Creations ✨</h2>
        <div style="font-size:11px; color:#b8955a; font-style:italic; margin-bottom:16px;">Rewards Redemption Receipt</div>

        <div style="background:#faf7f0; padding:16px; border-radius:6px; border:1px dashed #d4c197; text-align:left; font-family:monospace; font-size:11.5px; line-height:1.8; margin-bottom:16px;">
          <strong>Name:</strong> ${order.name}<br>
          <strong>Reference:</strong> ${order.order_id}<br>
          <strong>Item:</strong> ${order.item}<br>
          <strong>Points:</strong> ${order.points_cost} PTS<br>
          <strong>Status:</strong> <span style="color:#16a34a; font-weight:bold;">COMPLETED</span>
        </div>

        <div style="font-size:12px; color:#8b1a1a; font-weight:bold;">💖 Thank you for your missionary service!</div>
      </div>
    </body>
    </html>
  `;
  return await sendEmail({ to, subject: `🧾 Redemption Receipt (${order.order_id})`, htmlContent: html });
}
