import 'dotenv/config';
import { runSql } from './db.js';

export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || 'noreply.timelesscreations.ph@gmail.com').trim();
  const senderName = (process.env.SENDER_NAME || 'Timeless Creations').trim();

  if (!apiKey) {
    console.error("❌ Brevo API Error: BREVO_API_KEY is not defined in environment variables.");
    return { ok: false, error: "BREVO_API_KEY is missing in environment." };
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
      const errMsg = responseBody?.message || responseBody?.error || `HTTP ${res.status} ${res.statusText}`;
      console.error(`❌ Brevo API Error [${res.status}]:`, errMsg);
      return { ok: false, status: res.status, error: errMsg };
    }

    return { ok: true, messageId: responseBody?.messageId || "sent" };
  } catch (err) {
    console.error("❌ Brevo REST API Fetch Error:", err.message);
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

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0; padding:20px; background-color:#12121a; font-family:'Garamond', 'Georgia', serif;">
      <div style="width:100%; max-width:440px; margin:0 auto; background:#ffffff; color:#1a1a1a; border:1px solid #e0d6bc; box-shadow:0 15px 40px rgba(0,0,0,0.5); overflow:hidden;">
        
        <div style="padding: 35px 20px 15px 20px; text-align: center; background-color: #ffffff;">
          <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8px; letter-spacing: 2px; color: #b0b0b0; text-transform: uppercase; margin-bottom: 12px; display: block;">Month ${month} • Dedicated Service</span>
          <h1 style="font-size: 24px; letter-spacing: 5px; text-transform: uppercase; font-weight: 300; margin: 0; color: #1a1a1a;">Timeless Creations</h1>
          <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5px; letter-spacing: 1.5px; color: #8c7e5d; margin-top: 8px; text-transform: uppercase; line-height: 1.4;">Most Trusted Online LDS Store by Members and Missionaries Across the Philippines</div>
        </div>

        <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" style="width: 100%; height: auto; min-height: 160px; object-fit: cover; display: block; border: 0;">

        <div style="padding: 22px 18px; text-align: center; line-height: 1.6;">
          <div style="font-size: 19px; font-style: italic; margin-bottom: 12px; color: #1a1a1a;">Hello ${customName},</div>
          <div style="font-size: 13.5px; color: #333; margin-bottom: 18px;">${message.replace(/\n/g, '<br>')}</div>

          <div style="margin: 18px 0; padding: 18px; background-color: #fdfbf8; border-left: 1px solid #d4c197; border-right: 1px solid #d4c197;">
            <span style="font-size: 14px; font-style: italic; display: block; color: #1a1a1a; line-height: 1.5; margin-bottom: 8px;">"${cleanedQuote}"</span>
            <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; color: #8c7e5d;">${theme}</div>
          </div>

          <div style="margin: 20px 0; padding: 12px 8px; font-style: italic; color: #8c7e5d; font-size: 12.5px; border-top: 1px double #e0d6bc; border-bottom: 1px double #e0d6bc;">
            As you focus on your sacred work, let us handle the small details that help you present your best self to the world.
          </div>

          <!-- Missionary Essentials -->
          <div style="padding: 20px 12px; border: 1px solid #f0eadd; background-color: #ffffff; border-radius: 2px; margin-bottom: 18px;">
            <h2 style="font-weight: 400; letter-spacing: 2px; text-transform: uppercase; font-size: 14px; margin-bottom: 16px; color: #1a1a1a;">Missionary Essentials</h2>
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" width="48%" valign="top">
                  <img src="https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE" style="width: 100%; max-width: 130px; aspect-ratio: 1 / 1; object-fit: cover; border: 1px solid #d4c197; display: block; margin: 0 auto 8px auto;" alt="Wooden Nametag">
                  <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; color: #8c7e5d; letter-spacing: 1px; font-weight: bold;">Wooden Nametag</div>
                </td>
                <td width="4%"></td>
                <td align="center" width="48%" valign="top">
                  <img src="https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ" style="width: 100%; max-width: 130px; aspect-ratio: 1 / 1; object-fit: cover; border: 1px solid #d4c197; display: block; margin: 0 auto 8px auto;" alt="POS Kit">
                  <div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; color: #8c7e5d; letter-spacing: 1px; font-weight: bold;">POS Kit</div>
                </td>
              </tr>
            </table>
            <p style="font-size: 12px; margin-top: 20px; color: #555; line-height: 1.4;">
              If you have doubts with us as scams, we offer our first time customers with a <strong>"Gawa muna bago bayad"</strong> assurance.
            </p>
            <div style="background-color: #1a1a1a; color: #d4c197; padding: 10px; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 2px; margin: 16px 0; font-weight: bold;">Work, Confirm, Pay</div>
            <a href="https://m.me/timelesscreations.06" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; border: 1px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Order Yours Now</a>
          </div>

          ${highlightLabel && highlightLabel.trim() !== "" ? `
            <!-- Product of the Month -->
            <div style="margin: 24px 0; padding: 18px; background: #faf7f0; border: 1px solid #c9a84c; border-radius: 4px;">
              <span style="font-family: 'Helvetica', Arial, sans-serif; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #8b1a1a; font-weight: bold; display: block; margin-bottom: 8px;">⭐ Product of the Month</span>
              <img src="${highlightImg || 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE'}" style="width: 140px; height: 140px; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px; border: 1px solid #c9a84c; display: block; margin: 0 auto 10px auto;" alt="Highlight">
              <div style="font-family: 'Syne', sans-serif; font-size: 12.5px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">${highlightLabel}</div>
              <a href="https://m.me/timelesscreations.06" target="_blank" style="display: inline-block; padding: 8px 18px; background: #8b1a1a; color: #fff !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; border-radius: 3px;">Inquire Item</a>
            </div>
          ` : ''}

          <!-- Community Gallery 9-Grid -->
          <div style="margin: 30px auto; text-align: center;">
            <h2 style="font-weight: 400; letter-spacing: 2px; text-transform: uppercase; font-size: 13px; margin-bottom: 8px; color: #1a1a1a;">Engrave Your Legacy</h2>
            <p style="font-size: 12.5px; color: #555; line-height: 1.5; margin-bottom: 16px; font-style: italic;">
              Your service is a story that deserves to be told. We are archiving the moments that define a mission.
            </p>
            
            <table width="100%" border="0" cellspacing="3" cellpadding="0" style="table-layout: fixed; margin-bottom: 16px;">
              <tr>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 1"></td>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 2"></td>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 3"></td>
              </tr>
              <tr>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 4"></td>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 5"></td>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 6"></td>
              </tr>
              <tr>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 7"></td>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 8"></td>
                <td><img src="https://lh3.googleusercontent.com/u/0/d/1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:1px solid #e0d6bc; display:block;" alt="Grid 9"></td>
              </tr>
            </table>

            <div style="margin-bottom: 20px;">
              <a href="https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7" target="_blank" style="display: inline-block; padding: 10px 20px; border: 1px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">
                Enter the Gallery
              </a>
            </div>
          </div>

          <!-- Dynamic Points Rewards Card -->
          <div style="padding: 20px 14px; background-color: #fdfaf3; border: 1px solid #c9a84c; border-radius: 4px; margin-top: 25px;">
            <div style="font-family: 'Syne', sans-serif; font-size: 13px; font-weight: bold; color: #8b1a1a; margin-bottom: 6px;">🎁 Your TCRP Reward Balance</div>
            <div style="font-size: 12px; color: #555; margin-bottom: 14px; line-height: 1.4;">
              You currently have <strong>${missionaryPoints}</strong> Points.
            </div>
            <a href="https://m.me/TimelessCreationsRP" target="_blank" style="display: block; width: 90%; margin: 0 auto; padding: 12px 10px; background-color: #1a1a1a; border: 1px solid #1a1a1a; color: #d4c197 !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">
              Redeem Rewards (m.me/TimelessCreationsRP)
            </a>
          </div>
        </div>

        <div style="padding: 28px 16px; background-color: #1a1a1a; color: #ffffff; text-align: center;">
          <div style="color: #d4c197; letter-spacing: 3px; font-size: 10px; text-transform: uppercase;">Timeless Creations</div>
          <div style="font-size: 8px; opacity: 0.5; margin-top: 10px; font-family: Arial, sans-serif;">Supporting Members &amp; Missionaries Across the Philippines • Since 2025</div>
          <div style="margin-top:12px; font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px;">
            <a href="https://timelesscreations.ph/api/main?action=unsubscribe&email=${encodeURIComponent(to)}" target="_blank" style="color:rgba(255,255,255,0.4); text-decoration:underline;">Unsubscribe from monthly letters</a>
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
    <body style="margin:0; padding:30px; background-color:#0a0a0f; font-family:'Helvetica Neue', Arial, sans-serif; color:#e8e6f0;">
      <div style="max-width:440px; margin:0 auto; background:#141622; border:1px solid rgba(201,168,76,0.3); border-radius:12px; padding:32px; text-align:center; box-shadow:0 15px 40px rgba(0,0,0,0.8);">
        <h2 style="font-family:Georgia,serif; color:#c9a84c; margin:0 0 8px 0; font-size:22px; letter-spacing:1px;">Timeless Creations</h2>
        <p style="font-size:11px; color:#8c90a4; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:24px;">Account Verification Code</p>
        
        <p style="font-size:13px; color:#c7c5d4; line-height:1.6; margin-bottom:24px;">
          Use the 6-digit confirmation code below to verify your missionary account and unlock your referral rewards:
        </p>

        <div style="background:#1c1f2e; border:1px solid #c9a84c; border-radius:8px; padding:16px; margin-bottom:24px;">
          <span style="font-family:'Courier New', monospace; font-size:32px; font-weight:bold; letter-spacing:8px; color:#f0d080;">${otpCode}</span>
        </div>

        <p style="font-size:11px; color:#716e88; line-height:1.5;">
          This code expires in 10 minutes. If you did not request this verification, you can safely disregard this message.
        </p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to,
    subject: `🔐 Your Verification Code: ${otpCode} • Timeless Creations`,
    htmlContent: html
  });
}

export async function sendReceiptEmail(to, order = { name: "Elder / Sister", order_id: "TCRP-9921", item: "Wooden Missionary Nametag", points_cost: 6 }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0; padding:20px; background-color:#12121a; font-family:Georgia,serif;">
      <div style="max-width:440px; margin:0 auto; background:linear-gradient(135deg, #fffcf5 0%, #f7f1e3 100%); color:#2c221e; padding:32px; border-radius:14px; border:2px solid #c9a84c; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
        <h2 style="color:#8b1a1a; margin:0 0 4px 0; font-size:22px;">✨ Timeless Creations ✨</h2>
        <div style="font-size:12px; color:#b8955a; font-style:italic; margin-bottom:18px;">Rewards Program (TCRP) Redemption</div>

        <div style="background:#ffffff; padding:18px; border-radius:8px; border:2px dashed #e2c286; text-align:left; font-family:monospace; font-size:12px; line-height:1.8; color:#3a322c; margin-bottom:18px;">
          <strong>Recipient:</strong> ${order.name}<br>
          <strong>Reference Code:</strong> <span style="color:#8b1a1a; font-weight:bold;">${order.order_id}</span><br>
          <strong>Item Claimed:</strong> ${order.item}<br>
          <strong>Points Redeemed:</strong> ${order.points_cost} PTS<br>
          <strong>Status:</strong> <span style="color:#16a34a; font-weight:bold;">COMPLETED</span>
        </div>

        <div style="font-size:13px; color:#8b1a1a; font-weight:bold;">💖 Thank you for your service! Please shop again! 🌸</div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to,
    subject: `🧾 Redemption Receipt (${order.order_id}) • Timeless Creations`,
    htmlContent: html
  });
}
