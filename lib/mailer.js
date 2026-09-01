import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

// Builtin in-memory templates ensure 100% full-fidelity HTML rendering on any serverless lambda
const BUILTIN_TEMPLATES = {
  'otp-email.html': `<!DOCTYPE html>
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
              <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8955a; margin-bottom: 6px; font-family: 'Helvetica', Arial, sans-serif;">Timeless Creations • {{DATE}}</div>
              <div style="font-size: 22px; font-weight: bold;">Account Verification 🔐</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color: #444; font-size: 13.5px; margin-bottom: 8px;">
                Please enter this 6-digit verification passcode in Messenger to verify your missionary email and activate your TCRP rewards account:
              </p>
              <div class="otp-box">
                {{OTP_CODE}}
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
</html>`,

  'receipt-email.html': `<!DOCTYPE html>
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
              <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8955a; margin-bottom: 6px; font-family: 'Helvetica', Arial, sans-serif;">Timeless Creations Rewards • {{DATE}}</div>
              <div style="font-size: 22px; font-weight: bold;">Redemption Receipt 🧾</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color: #444; font-size: 13.5px;">Your freebie reward redemption has been successfully logged in our system!</p>
              <div class="receipt-card">
                <div style="font-size: 10.5px; font-weight: bold; color: #8b1a1a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Helvetica', Arial, sans-serif;">📋 Order Details:</div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Order ID:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #8b1a1a;">{{ORDER_ID}}</span></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Item Claimed:</strong> <strong>{{ITEM}}</strong></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Points Used:</strong> <strong>{{POINTS_COST}} PTS</strong></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Status:</strong> <span style="color: #b8955a; font-weight: bold;">{{STATUS}}</span></div>
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
</html>`,

  'thankyou-email.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} | Timeless Creations</title>
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
              <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8955a; margin-bottom: 6px; font-family: 'Helvetica', Arial, sans-serif;">Timeless Creations • {{DATE}}</div>
              <div style="font-size: 22px; font-weight: bold;">{{TITLE}}</div>
            </td>
          </tr>
          <tr>
            <td class="body-content">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong>{{NAME}}</strong>,</p>
              <p style="color: #444; font-size: 13.5px;">
                {{MESSAGE}}
              </p>
              <div class="summary-card">
                <div style="font-size: 10.5px; font-weight: bold; color: #8b1a1a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Helvetica', Arial, sans-serif;">📦 Fulfillment Summary:</div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Order ID:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #8b1a1a;">{{ORDER_ID}}</span></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Item / Package:</strong> <strong>{{ITEM}}</strong></div>
                <div style="font-size: 13px; color: #2c221e; padding: 3px 0;">• <strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">{{STATUS}}</span></div>
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
</html>`,

  'monthly-drip.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCRP Monthly Encouragement Letter</title>
  <style>
    .img-square { width: 100% !important; max-width: 100% !important; aspect-ratio: 1 / 1 !important; object-fit: cover !important; display: block !important; border: 0 !important; }
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .essential-cell { padding: 0 4px !important; }
      .grid-cell { padding: 2px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family:'Garamond', 'Georgia', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f4f7; padding:16px 0;">
    <tr>
      <td align="center">
        <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:440px; background-color:#ffffff; border:1px solid #e0d6bc; box-shadow:0 10px 30px rgba(0,0,0,0.08); overflow:hidden;">
          <tr>
            <td style="padding:28px 16px 12px; text-align:center; background-color:#ffffff;">
              <span style="font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:2px; color:#b0b0b0; text-transform:uppercase; margin-bottom:8px; display:block;">Month {{MONTH}} • Dedicated Service</span>
              <h1 style="font-size:22px; letter-spacing:5px; text-transform:uppercase; font-weight:300; margin:0; color:#1a1a1a;">Timeless Creations</h1>
              <div style="font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:1.5px; color:#8c7e5d; margin-top:6px; text-transform:uppercase;">Most Trusted Online LDS Store Across the Philippines</div>
            </td>
          </tr>
          <tr>
            <td>
              <img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple Banner" style="width:100%; height:auto; display:block; border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:20px 20px 10px; text-align:center;">
              <div style="font-size:18px; font-style:italic; margin-bottom:12px; color:#1a1a1a;">Dear {{NAME}},</div>
              <div style="font-size:13.5px; color:#333333; margin-bottom:18px; line-height:1.7;">{{MESSAGE}}</div>
              <div style="margin:16px 0; padding:14px; background-color:#fdfbf8; border-left:2px solid #d4c197; border-right:2px solid #d4c197;">
                <span style="font-size:14px; font-style:italic; display:block; margin-bottom:6px; color:#1a1a1a; line-height:1.5;">"{{SCRIPTURE}}"</span>
                <div style="font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:2px; font-weight:bold; color:#8c7e5d;">{{THEME}}</div>
              </div>
              <div style="margin:20px 0 10px; padding:16px 12px; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:6px; text-align:center;">
                <div style="font-family:'Helvetica', Arial, sans-serif; font-size:11px; color:#5a4a28; margin-bottom:10px;">
                  Your Rewards Balance: <strong style="color:#8b1a1a; font-size:13px;">{{POINTS}} Points</strong>
                </div>
                <a href="https://m.me/TimelessCreationsRP" style="display:inline-block; padding:10px 18px; background-color:#1c1208; color:#d4b07a; text-decoration:none; font-family:'Helvetica', Arial, sans-serif; font-size:9.5px; text-transform:uppercase; letter-spacing:1.5px; font-weight:bold; border-radius:4px;" target="_blank">
                  Redeem Rewards via Messenger →
                </a>
              </div>
              {{TOP_PRODUCTS_HTML}}
              <div style="margin:20px 0 10px; padding:10px 0; font-style:italic; color:#8c7e5d; font-size:12px; border-top:1px double #e0d6bc; border-bottom:1px double #e0d6bc;">
                As you focus on your sacred calling, we handle the small details that help you present your best self.
              </div>
              <div style="padding:16px 12px; border:1px solid #f0eadd; background-color:#ffffff; border-radius:4px; margin-bottom:16px;">
                <h3 style="font-weight:normal; letter-spacing:2px; text-transform:uppercase; font-size:12.5px; margin:0 0 12px 0; color:#1a1a1a;">Missionary Essentials</h3>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" width="48%" class="essential-cell" valign="top">
                      <img src="{{ESS1_IMG}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #d4c197; margin-bottom:6px;" alt="{{ESS1_NAME}}">
                      <div style="font-family:'Helvetica', Arial, sans-serif; font-size:9.5px; text-transform:uppercase; color:#8c7e5d; font-weight:bold;">{{ESS1_NAME}}</div>
                    </td>
                    <td width="4%"></td>
                    <td align="center" width="48%" class="essential-cell" valign="top">
                      <img src="{{ESS2_IMG}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #d4c197; margin-bottom:6px;" alt="{{ESS2_NAME}}">
                      <div style="font-family:'Helvetica', Arial, sans-serif; font-size:9.5px; text-transform:uppercase; color:#8c7e5d; font-weight:bold;">{{ESS2_NAME}}</div>
                    </td>
                  </tr>
                </table>
                <p style="font-size:11.5px; margin-top:14px; margin-bottom:8px; color:#555; line-height:1.4;">
                  We offer our first-time customers our <strong>"Gawa muna bago bayad"</strong> assurance.
                </p>
                <div style="background-color:#1a1a1a; color:#d4c197; padding:7px; font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:1.5px; margin:10px 0 12px; font-weight:bold;">Work, Confirm, Pay</div>
                <a href="https://m.me/timeless.creations.06" style="display:inline-block; padding:9px 16px; background-color:#ffffff; border:1px solid #1a1a1a; color:#1a1a1a; text-decoration:none; font-family:'Helvetica', Arial, sans-serif; font-size:9px; text-transform:uppercase; letter-spacing:1.5px; font-weight:bold;" target="_blank">Order Yours Now →</a>
              </div>
              {{REWARD_SECTION_HTML}}
              <div style="margin:24px 0 10px; text-align:center; padding:0 8px;">
                <h3 style="font-weight:normal; letter-spacing:2px; text-transform:uppercase; font-size:12.5px; margin-bottom:6px; color:#1a1a1a;">Engrave Your Legacy</h3>
                <p style="font-size:12px; color:#555; line-height:1.5; margin-bottom:14px; font-style:italic;">
                  Your service is a story that deserves to be told. Archiving memories one missionary at a time.
                </p>
                <table width="100%" border="0" cellspacing="3" cellpadding="0" style="table-layout:fixed; margin-bottom:14px;">
                  <tr>
                    <td class="grid-cell"><img src="{{GRID1}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 1"></td>
                    <td class="grid-cell"><img src="{{GRID2}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 2"></td>
                    <td class="grid-cell"><img src="{{GRID3}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 3"></td>
                  </tr>
                  <tr>
                    <td class="grid-cell"><img src="{{GRID4}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 4"></td>
                    <td class="grid-cell"><img src="{{GRID5}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 5"></td>
                    <td class="grid-cell"><img src="{{GRID6}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 6"></td>
                  </tr>
                  <tr>
                    <td class="grid-cell"><img src="{{GRID7}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 7"></td>
                    <td class="grid-cell"><img src="{{GRID8}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 8"></td>
                    <td class="grid-cell"><img src="{{GRID9}}" class="img-square" style="width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #f0eadd;" alt="Community Photo 9"></td>
                  </tr>
                </table>
                <div style="margin-bottom:14px;">
                  <p style="font-family:'Helvetica', Arial, sans-serif; font-size:9.5px; letter-spacing:1px; color:#8c7e5d; text-transform:uppercase; font-weight:bold; margin-bottom:3px;">
                    Engrave Your Memory. Be the Memory. Be You.
                  </p>
                  <a href="{{GALLERY_URL}}" style="display:inline-block; padding:8px 16px; border:1px solid #1a1a1a; color:#1a1a1a; text-decoration:none; font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:1.5px; font-weight:bold; margin-top:6px;" target="_blank">
                    Enter the Gallery →
                  </a>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 16px; background-color:#1a1a1a; color:#ffffff; text-align:center;">
              <div style="color:#d4b07a; letter-spacing:3px; font-size:10px; text-transform:uppercase;">Timeless Creations</div>
              <div style="font-size:8px; opacity:0.5; margin-top:8px; font-family:'Helvetica', Arial, sans-serif;">Supporting Members &amp; Missionaries Across the Philippines • Since 2025</div>
              <a href="https://m.me/TimelessCreationsRP" style="font-size:8.5px; color:#888888; text-decoration:none; margin-top:14px; display:block; font-family:'Helvetica', Arial, sans-serif;">Redeem Rewards &amp; Support in Messenger</a>
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
 * Robust Template File Loader
 * Reads from disk if available, and seamlessly falls back to the in-memory bundle.
 */
export function loadTemplateFile(filename) {
  try {
    const filePath = path.join(TEMPLATES_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.warn(`[TEMPLATE DISK READ] Falling back to built-in for ${filename}:`, err.message);
  }
  return BUILTIN_TEMPLATES[filename] || null;
}

/**
 * Universal Placeholder Interpolator
 * Replaces {{KEY}} placeholders cleanly and case-insensitively.
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
 * Converts rich HTML into clean, human-readable plain text for Dual MIME delivery.
 */
export function stripHtmlToPlainText(html = "") {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Centralized Brevo Dual-MIME Email Dispatcher
 * Sends both htmlContent and textContent for 100% inbox rendering compatibility.
 */
export async function sendEmail({ to, subject, htmlContent, textContent = null }) {
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

  const plainText = textContent || stripHtmlToPlainText(htmlContent);

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
        htmlContent,
        textContent: plainText
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

export function getCurrentMonthNumber() {
  return new Date().getMonth() + 1;
}
