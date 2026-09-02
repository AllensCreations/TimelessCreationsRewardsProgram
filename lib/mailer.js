import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

const BUILTIN_TEMPLATES = {
  'otp-email.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Passcode | Timeless Creations</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610; margin:0; padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);">
          <tr>
            <td style="background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;">
              <div style="font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;">Timeless Creations • {{DATE}}</div>
              <div style="font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;">Account Verification 🔐</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;">
              <p style="margin:0 0 12px; font-size:16px; color:#2c221e;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color:#444444; font-size:13.5px; line-height:1.6; margin:0 0 16px;">
                Please enter this 6-digit verification passcode in Messenger to verify your missionary email and activate your TCRP rewards account:
              </p>
              
              <div style="background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; font-size:32px; font-weight:bold; letter-spacing:8px; color:#8b1a1a; font-family:'Courier New', Courier, monospace; margin:20px 0; border-radius:6px; text-align:center;">
                {{OTP_CODE}}
              </div>

              <p style="font-size:11.5px; color:#777777; margin:0 0 22px; font-style:italic;">
                ⏱️ This passcode is valid for your active session. If you did not request this, you can safely ignore this email.
              </p>

              <div style="margin-top:14px;">
                <a href="https://m.me/TimelessCreationsRP" style="display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Open Messenger Bot →</a>
                <a href="https://m.me/timeless.creations.06" style="display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Contact Store Support →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,

  'receipt-email.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redemption Receipt | Timeless Creations</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610; margin:0; padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);">
          <tr>
            <td style="background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;">
              <div style="font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;">Timeless Creations Rewards • {{DATE}}</div>
              <div style="font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;">Redemption Receipt 🧾</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;">
              <p style="margin:0 0 12px; font-size:16px; color:#2c221e;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color:#444444; font-size:13.5px; margin:0 0 18px; line-height:1.6;">Your freebie reward redemption has been successfully logged in our system!</p>
              
              <div style="background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; border-radius:6px; margin:20px 0; text-align:left;">
                <div style="font-size:10.5px; font-weight:bold; color:#8b1a1a; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px; font-family:'Helvetica', Arial, sans-serif;">📋 Order Details:</div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Order ID:</strong> <span style="font-family:'Courier New', Courier, monospace; font-size:15px; font-weight:bold; color:#8b1a1a;">{{ORDER_ID}}</span></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Item Claimed:</strong> <strong>{{ITEM}}</strong></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Points Used:</strong> <strong>{{POINTS_COST}} PTS</strong></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Status:</strong> <span style="color:#b8955a; font-weight:bold;">{{STATUS}}</span></div>
              </div>

              <div style="background-color:#fffcf5; border-left:3px solid #b8955a; padding:14px 16px; text-align:left; margin-bottom:24px; font-size:12.5px; color:#5a4a28; line-height:1.6;">
                💡 <strong>Next Steps:</strong> Please take a screenshot of this receipt and send it to our store page alongside your shipping address or companion notes so we can prepare your package!
              </div>

              <div>
                <a href="https://m.me/timeless.creations.06" style="display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Send Screenshot via Messenger →</a>
                <a href="https://m.me/TimelessCreationsRP" style="display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Rewards Bot Dashboard →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,

  'thankyou-email.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} | Timeless Creations</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610; margin:0; padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);">
          <tr>
            <td style="background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;">
              <div style="font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;">Timeless Creations • {{DATE}}</div>
              <div style="font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;">{{TITLE}}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;">
              <p style="margin:0 0 12px; font-size:16px; color:#2c221e;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color:#444444; font-size:13.5px; line-height:1.6; margin:0 0 16px;">
                {{MESSAGE}}
              </p>
              
              <div style="background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; border-radius:6px; margin:20px 0; text-align:left;">
                <div style="font-size:10.5px; font-weight:bold; color:#8b1a1a; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px; font-family:'Helvetica', Arial, sans-serif;">📦 Fulfillment Summary:</div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Order ID:</strong> <span style="font-family:'Courier New', Courier, monospace; font-size:15px; font-weight:bold; color:#8b1a1a;">{{ORDER_ID}}</span></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Item / Package:</strong> <strong>{{ITEM}}</strong></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Status:</strong> <span style="color:#16a34a; font-weight:bold;">{{STATUS}}</span></div>
              </div>

              <p style="font-style:italic; color:#7a6030; font-size:13px; line-height:1.6; margin:0 0 24px;">
                Thank you for your dedicated missionary service and for trusting Timeless Creations! If you have any questions or need further assistance, feel free to chat with us anytime.
              </p>

              <div>
                <a href="https://m.me/timeless.creations.06" style="display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Chat with Store Support →</a>
                <a href="https://m.me/TimelessCreationsRP" style="display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Rewards Bot Dashboard →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,

  'delivered-email.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Package Delivered • Timeless Creations</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610; margin:0; padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);">
          <tr>
            <td style="background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;">
              <div style="font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;">Timeless Creations • {{DATE}}</div>
              <div style="font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;">Package Delivered 🚚</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;">
              <div style="display:inline-block; background-color:#16a34a; color:#ffffff; font-family:'Helvetica', Arial, sans-serif; font-size:9.5px; font-weight:bold; text-transform:uppercase; letter-spacing:2px; padding:5px 14px; border-radius:99px; margin-bottom:14px;">
                ✓ Successfully Delivered
              </div>
              <p style="margin:0 0 12px; font-size:16px; color:#2c221e;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color:#444444; font-size:13.5px; line-height:1.6; margin:0 0 16px;">
                We are delighted to confirm that your order <strong>{{ORDER_ID}}</strong> has arrived and was successfully delivered!
              </p>
              
              <div style="background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; border-radius:6px; margin:20px 0; text-align:left;">
                <div style="font-size:10.5px; font-weight:bold; color:#8b1a1a; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px; font-family:'Helvetica', Arial, sans-serif;">📦 Delivery Summary:</div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Order ID:</strong> <span style="font-family:'Courier New', Courier, monospace; font-size:15px; font-weight:bold; color:#8b1a1a;">{{ORDER_ID}}</span></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Package Item(s):</strong> <strong>{{ITEM}}</strong></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Status:</strong> <span style="color:#16a34a; font-weight:bold;">{{STATUS}}</span></div>
                <div style="font-size:13.5px; color:#2c221e; padding:4px 0;">• <strong>Delivery Date:</strong> <strong>{{DATE}}</strong></div>
              </div>

              <p style="font-style:italic; color:#7a6030; font-size:13px; line-height:1.6; margin:0 0 24px;">
                May these creations inspire you in your sacred missionary service across the Philippines. Thank you for your continued trust in Timeless Creations!
              </p>

              <div>
                <a href="https://m.me/timeless.creations.06" style="display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Message Support on Messenger →</a>
                <a href="https://m.me/TimelessCreationsRP" style="display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;" target="_blank">Rewards Dashboard →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;">
              Supporting Members &amp; Missionaries Across the Philippines • Since 2025
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,

  'out-of-window-drip.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Dispatch & Reconnect | Timeless Creations</title>
</head>
<body style="margin:0; padding:16px; background-color:#0b0b10; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#e8e6f0; -webkit-font-smoothing:antialiased;">

<div style="max-width:430px; margin:0 auto; background:#12131c; border:1px solid rgba(201,168,76,0.35); border-radius:14px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.6);">
  <!-- Meta 24-hr Reason Notice -->
  <div style="background:linear-gradient(135deg, #241c0e 0%, #171510 100%); border-bottom:1px solid rgba(201,168,76,0.25); padding:10px 16px; font-size:11px; color:#d4c197; text-align:center; line-height:1.4;">
    ⚡ <strong>Messenger Session Offline:</strong> Meta requires a reply every 24 hours to keep direct chat open. Reconnect below to view rewards and redeem promo points!
  </div>

  <div style="padding:22px 20px 14px; text-align:center;">
    <div style="font-size:9px; letter-spacing:2px; text-transform:uppercase; color:#8c90a4;">{{MONTH}} • Monthly Encouragement</div>
    <h1 style="font-size:18px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:#c9a84c; margin:4px 0; font-family:Georgia, serif;">Timeless Creations</h1>
  </div>

  <div style="padding:10px 20px 20px;">
    <div style="font-size:16px; font-weight:bold; color:#ffffff; margin-bottom:8px;">Hello {{NAME}},</div>
    <div style="font-size:13px; line-height:1.6; color:#c4c2d0; margin-bottom:16px;">{{MESSAGE}}</div>

    <div style="background:#181926; border-left:3px solid #c9a84c; border-radius:0 8px 8px 0; padding:12px 14px; margin-bottom:18px;">
      <div style="font-size:13px; font-style:italic; color:#f3f2f8; line-height:1.5; margin-bottom:6px; font-family:Georgia, serif;">"{{SCRIPTURE}}"</div>
      <div style="font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#c9a84c; font-weight:bold;">{{THEME}}</div>
    </div>

    <!-- Combined Rewards & Promo Block -->
    {{REWARD_SECTION_HTML}}

    <div style="text-align:center; margin:18px 0;">
      <a href="https://m.me/TimelessCreationsRP" target="_blank" style="display:block; background:#c9a84c; color:#0a0a0f !important; text-decoration:none; padding:13px 20px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; border-radius:8px; box-shadow:0 4px 14px rgba(201,168,76,0.3);">
        💬 Tap to Reopen Messenger Chat →
      </a>
    </div>
  </div>

  <div style="padding:14px 20px; text-align:center; border-top:1px solid rgba(255,255,255,0.06); font-size:9px; color:#626173; line-height:1.4;">
    Timeless Creations Rewards Program (TCRP) • Supporting full-time LDS missionaries.<br>
    <a href="https://m.me/TimelessCreationsRP" style="color:#8c90a4; text-decoration:underline; margin-top:4px; display:inline-block;">Open TCRP Bot</a>
  </div>
</div>

</body>
</html>`,

  'monthly-drip.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCRP Monthly Encouragement Letter</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family:'Garamond', 'Georgia', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f4f7; padding:16px 0;">
    <tr>
      <td align="center">
        <!-- Main Responsive Container -->
        <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:440px; background-color:#ffffff; border:1px solid #e0d6bc; box-shadow:0 10px 30px rgba(0,0,0,0.08); overflow:hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding:28px 16px 12px; text-align:center; background-color:#ffffff;">
              <span id="drip-prev-date" style="font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:2px; color:#b0b0b0; text-transform:uppercase; margin-bottom:8px; display:block;">Month {{MONTH}} • Dedicated Service</span>
              <h1 style="font-size:20px; letter-spacing:4px; text-transform:uppercase; font-weight:300; margin:0; color:#1a1a1a;">Timeless Creations</h1>
              <div style="font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:1px; color:#8c7e5d; margin-top:4px; text-transform:uppercase; line-height:1.4;">
                Most Trusted Online LDS Store by Members and Missionaries Across the Philippines
              </div>
            </td>
          </tr>

          <!-- Temple Hero Image -->
          <tr>
            <td>
              <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" style="width:100%; max-width:100%; height:auto; min-height:140px; max-height:220px; object-fit:cover; display:block; border:0;">
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding:20px 16px; text-align:center; line-height:1.6;">
              <div style="font-size:17px; font-style:italic; margin-bottom:10px; color:#1a1a1a;">Hello {{NAME}},</div>
              <div id="drip-prev-msg" style="font-size:13px; color:#333333; margin-bottom:16px;">{{MESSAGE}}</div>

              <!-- Quote Block -->
              <div style="margin:16px 0; padding:14px; background-color:#fdfbf8; border-left:1px solid #d4c197; border-right:1px solid #d4c197;">
                <span id="drip-prev-quote" style="font-size:13px; font-style:italic; display:block; color:#1a1a1a; line-height:1.5; margin-bottom:6px;">"{{SCRIPTURE}}"</span>
                <div id="drip-prev-speaker" style="font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:2px; font-weight:bold; color:#8c7e5d;">{{THEME}}</div>
              </div>

              <div style="margin:16px 0; padding:10px 4px; font-style:italic; color:#8c7e5d; font-size:11.5px; border-top:1px double #e0d6bc; border-bottom:1px double #e0d6bc;">
                As you focus on your sacred work, let us handle the small details that help you present your best self to the world.
              </div>

              <!-- 1:1 Responsive Missionary Essentials -->
              <div style="padding:14px 10px; border:1px solid #f0eadd; background-color:#ffffff; border-radius:4px; margin-bottom:16px;">
                <h2 style="font-weight:400; letter-spacing:2px; text-transform:uppercase; font-size:12px; margin-bottom:12px; color:#1a1a1a;">Missionary Essentials</h2>
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout:fixed;">
                  <tr>
                    <td align="center" width="48%" valign="top" style="padding:0 4px;">
                      <div style="width:100%; max-width:130px; margin:0 auto 6px auto;">
                        <img id="drip-prev-ess1-img" src="{{ESS1_IMG}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:1px solid #d4c197; border-radius:4px;" alt="Essential 1">
                      </div>
                      <div id="drip-prev-ess1-name" style="font-family:'Helvetica', Arial, sans-serif; font-size:9px; text-transform:uppercase; color:#8c7e5d; letter-spacing:1px; font-weight:bold;">{{ESS1_NAME}}</div>
                    </td>
                    <td width="4%"></td>
                    <td align="center" width="48%" valign="top" style="padding:0 4px;">
                      <div style="width:100%; max-width:130px; margin:0 auto 6px auto;">
                        <img id="drip-prev-ess2-img" src="{{ESS2_IMG}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:1px solid #d4c197; border-radius:4px;" alt="Essential 2">
                      </div>
                      <div id="drip-prev-ess2-name" style="font-family:'Helvetica', Arial, sans-serif; font-size:9px; text-transform:uppercase; color:#8c7e5d; letter-spacing:1px; font-weight:bold;">{{ESS2_NAME}}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- 1:1 Product(s) of the Month -->
              {{TOP_PRODUCTS_HTML}}

              <!-- 1:1 Responsive 9-Photo Archive Grid -->
              <div style="margin:20px auto; text-align:center;">
                <h2 style="font-weight:400; letter-spacing:2px; text-transform:uppercase; font-size:12px; margin-bottom:4px; color:#1a1a1a;">Engrave Your Legacy</h2>
                <p style="font-size:11.5px; color:#555555; line-height:1.4; margin-bottom:12px; font-style:italic;">
                  Your service is a story that deserves to be told.
                </p>
                <table width="100%" border="0" cellspacing="4" cellpadding="0" style="table-layout:fixed; margin-bottom:14px;">
                  <tr>
                    <td style="padding:2px;"><img id="drip-grid-1" src="{{GRID1}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 1"></td>
                    <td style="padding:2px;"><img id="drip-grid-2" src="{{GRID2}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 2"></td>
                    <td style="padding:2px;"><img id="drip-grid-3" src="{{GRID3}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 3"></td>
                  </tr>
                  <tr>
                    <td style="padding:2px;"><img id="drip-grid-4" src="{{GRID4}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 4"></td>
                    <td style="padding:2px;"><img id="drip-grid-5" src="{{GRID5}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 5"></td>
                    <td style="padding:2px;"><img id="drip-grid-6" src="{{GRID6}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 6"></td>
                  </tr>
                  <tr>
                    <td style="padding:2px;"><img id="drip-grid-7" src="{{GRID7}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 7"></td>
                    <td style="padding:2px;"><img id="drip-grid-8" src="{{GRID8}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 8"></td>
                    <td style="padding:2px;"><img id="drip-grid-9" src="{{GRID9}}" style="width:100%; max-width:100%; aspect-ratio:1/1; object-fit:cover; display:block; border:0;" alt="Grid 9"></td>
                  </tr>
                </table>
                <a id="drip-prev-gallery-link" href="{{GALLERY_URL}}" target="_blank" style="display:inline-block; padding:8px 18px; border:1px solid #1a1a1a; color:#1a1a1a !important; text-decoration:none; font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:1.5px; font-weight:bold;">
                  Enter the Gallery
                </a>
              </div>

              <!-- Dynamic Reward Points Balance (Claimable List vs Nearest Goal Card) -->
              {{REWARD_SECTION_HTML}}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 16px; background-color:#1a1a1a; color:#ffffff; text-align:center;">
              <div style="color:#d4c197; letter-spacing:2px; font-size:9px; text-transform:uppercase;">Timeless Creations</div>
              <div style="font-size:7.5px; opacity:0.5; margin-top:4px; font-family:Arial, sans-serif;">Supporting Members &amp; Missionaries Across the Philippines</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
};

/**
 * Universal Template File Loader
 * Reads directly from the templates/ directory with fallback to BUILTIN_TEMPLATES.
 */
export function loadTemplateFile(filename) {
  const candidatePaths = [
    path.join(TEMPLATES_DIR, filename),
    path.resolve(process.cwd(), 'templates', filename),
    path.resolve(process.cwd(), filename),
    path.join(__dirname, '../templates', filename),
    path.join(__dirname, '../../templates', filename),
    path.resolve('/var/task/templates', filename),
    path.resolve('/var/task', filename)
  ];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content && content.trim().length > 0) {
          return content;
        }
      }
    } catch (_) {}
  }

  if (BUILTIN_TEMPLATES[filename]) {
    return BUILTIN_TEMPLATES[filename];
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
 * Strict </html> Ending & Completeness Detector
 * Verifies whether htmlContent is non-empty and case-insensitively terminates with </html>.
 */
export function detectEndsWithHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return { endsWithHtml: false, trimmed: '' };
  }
  const trimmed = htmlContent.trim();
  const cleanTail = trimmed.replace(/<!--[\s\S]*?-->\s*$/g, '').trim();
  const endsWithHtml = cleanTail.toLowerCase().endsWith('</html>');
  return {
    endsWithHtml,
    trimmed
  };
}

/**
 * Master HTML Safety Wrapper
 * Ensures that any HTML string dispatched ends with </html> and contains a valid outer document structure.
 */
export function ensureEndsWithHtml(htmlContent, fallbackSubject = "Timeless Creations") {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>${fallbackSubject}</title></head>\n<body style="font-family:Georgia, serif; padding:20px; background:#faf7f0;">\n<p>${fallbackSubject}</p>\n</body>\n</html>`;
  }

  const { endsWithHtml, trimmed } = detectEndsWithHtml(htmlContent);
  if (endsWithHtml) {
    return trimmed;
  }

  // If it already has <html> opening, append </html>
  if (trimmed.toLowerCase().includes('<html') && trimmed.toLowerCase().includes('<body')) {
    if (!trimmed.toLowerCase().includes('</body>')) {
      return `${trimmed}\n</body>\n</html>`;
    }
    return `${trimmed}\n</html>`;
  }

  // If it is a raw fragment/snippet without html/body tags, wrap into full master document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fallbackSubject}</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1a1610; margin:0; padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="padding:28px 24px; color:#2c221e; line-height:1.6; font-size:14px;">
              ${trimmed}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Centralized Brevo Email Dispatcher
 * Validates that htmlContent strictly ends with </html> before dispatch to guarantee 100% rich HTML inbox rendering.
 */
export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || 'noreply.timelesscreations.ph@gmail.com').trim();
  const senderName = (process.env.SENDER_NAME || 'Timeless Creations').trim();

  // 1. Detect and ensure strict </html> closing tag
  const { endsWithHtml } = detectEndsWithHtml(htmlContent);
  let finalHtml = htmlContent;
  if (!endsWithHtml) {
    console.warn(`[HTML DETECTOR] Warning: Outgoing email to ${to} is missing </html> ending. Auto-wrapping into valid HTML document.`);
    finalHtml = ensureEndsWithHtml(htmlContent, subject);
  }

  try {
    const [rowSettings, rowConfig] = await Promise.all([
      runSql("SELECT value FROM system_settings WHERE key = 'power_state'").catch(() => []),
      runSql("SELECT value FROM system_config WHERE key = 'power_state'").catch(() => [])
    ]);
    const powerVal = rowSettings?.[0]?.value || rowConfig?.[0]?.value;
    if (powerVal && String(powerVal).toUpperCase() === 'OFFLINE') {
      console.log(`[EMAIL DISPATCH BLOCKED] System power is OFFLINE. Skip sending to ${to}`);
      return { ok: false, error: "System is OFFLINE" };
    }
  } catch (_) {}

  if (!apiKey || apiKey.startsWith('MOCK') || apiKey.startsWith('EAA_MOCK')) {
    console.log(`[BREVO SIMULATOR] Email to ${to} | Subject: ${subject} | Verified </html> Ending: YES`);
    return { ok: true, simulated: true, endsWithHtml: true };
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
        htmlContent: finalHtml
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
  const status = (order.status || "DELIVERED").toUpperCase();
  const dateStr = order.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rawTemplate = loadTemplateFile('delivered-email.html');

  return interpolatePlaceholders(rawTemplate, {
    NAME: name,
    ORDER_ID: orderId,
    ITEM: item,
    STATUS: status,
    DATE: dateStr
  });
}

/**
 * Universal All-Email Template Dispatcher
 * Renders any of the 6 TCRP email templates and ensures 100% complete HTML ending with </html>.
 */
export function renderEmailTemplate(templateType, options = {}) {
  const type = String(templateType || 'monthly_drip').toLowerCase().replace(/[\s-]/g, '_');
  let rawHtml = '';

  switch (type) {
    case 'otp':
    case 'passcode':
    case 'verification':
      rawHtml = renderOtpTemplate(options);
      break;
    case 'receipt':
    case 'redemption':
      rawHtml = renderReceiptTemplate(options.order || options);
      break;
    case 'thankyou':
    case 'thank_you':
    case 'fulfillment':
    case 'order_update':
      rawHtml = renderThankYouTemplate(options.order || options, options.status || 'COMPLETED');
      break;
    case 'delivered':
    case 'delivery':
    case 'package_delivered':
      rawHtml = renderDeliveredTemplate(options.order || options);
      break;
    case 'out_of_window':
    case 'out_of_window_drip':
    case 'reconnect':
      rawHtml = renderOutOfWindowDripTemplate(options.dripData || options, options.rewardProducts || [], options.activePromo || null);
      break;
    case 'monthly_drip':
    case 'drip':
    default:
      rawHtml = renderMonthlyDripTemplate(options.dripData || options, options.rewardProducts || [], options.activePromo || null);
      break;
  }

  return ensureEndsWithHtml(rawHtml, options.subject || 'Timeless Creations');
}

export const renderAllEmailTemplate = renderEmailTemplate;

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
