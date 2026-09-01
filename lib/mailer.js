import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

// Builtin in-memory fallback templates for serverless execution
const BUILTIN_TEMPLATES = {
  'otp-email.html': "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Verification Passcode | Timeless Creations</title>\n</head>\n<body style=\"margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;\">\n  <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#1a1610; margin:0; padding:24px 0;\">\n    <tr>\n      <td align=\"center\" style=\"padding:0 12px;\">\n        <table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);\">\n          <tr>\n            <td style=\"background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;\">\n              <div style=\"font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;\">Timeless Creations • {{DATE}}</div>\n              <div style=\"font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;\">Account Verification 🔐</div>\n            </td>\n          </tr>\n          <tr>\n            <td style=\"padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;\">\n              <p style=\"margin:0 0 12px; font-size:16px; color:#2c221e;\">Hello <strong>{{NAME}}</strong>,</p>\n              <p style=\"color:#444444; font-size:13.5px; line-height:1.6; margin:0 0 16px;\">\n                Please enter this 6-digit verification passcode in Messenger to verify your missionary email and activate your TCRP rewards account:\n              </p>\n              \n              <div style=\"background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; font-size:32px; font-weight:bold; letter-spacing:8px; color:#8b1a1a; font-family:'Courier New', Courier, monospace; margin:20px 0; border-radius:6px; text-align:center;\">\n                {{OTP_CODE}}\n              </div>\n\n              <p style=\"font-size:11.5px; color:#777777; margin:0 0 22px; font-style:italic;\">\n                ⏱️ This passcode is valid for your active session. If you did not request this, you can safely ignore this email.\n              </p>\n\n              <div style=\"margin-top:14px;\">\n                <a href=\"https://m.me/TimelessCreationsRP\" style=\"display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;\" target=\"_blank\">Open Messenger Bot →</a>\n                <a href=\"https://m.me/timeless.creations.06\" style=\"display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;\" target=\"_blank\">Contact Store Support →</a>\n              </div>\n            </td>\n          </tr>\n          <tr>\n            <td style=\"background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;\">\n              Supporting Members &amp; Missionaries Across the Philippines • Since 2025\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>\n",
  'receipt-email.html': "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Redemption Receipt | Timeless Creations</title>\n</head>\n<body style=\"margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;\">\n  <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#1a1610; margin:0; padding:24px 0;\">\n    <tr>\n      <td align=\"center\" style=\"padding:0 12px;\">\n        <table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);\">\n          <tr>\n            <td style=\"background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;\">\n              <div style=\"font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;\">Timeless Creations Rewards • {{DATE}}</div>\n              <div style=\"font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;\">Redemption Receipt 🧾</div>\n            </td>\n          </tr>\n          <tr>\n            <td style=\"padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;\">\n              <p style=\"margin:0 0 12px; font-size:16px; color:#2c221e;\">Hello <strong>{{NAME}}</strong>,</p>\n              <p style=\"color:#444444; font-size:13.5px; margin:0 0 18px; line-height:1.6;\">Your freebie reward redemption has been successfully logged in our system!</p>\n              \n              <div style=\"background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; border-radius:6px; margin:20px 0; text-align:left;\">\n                <div style=\"font-size:10.5px; font-weight:bold; color:#8b1a1a; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px; font-family:'Helvetica', Arial, sans-serif;\">📋 Order Details:</div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Order ID:</strong> <span style=\"font-family:'Courier New', Courier, monospace; font-size:15px; font-weight:bold; color:#8b1a1a;\">{{ORDER_ID}}</span></div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Item Claimed:</strong> <strong>{{ITEM}}</strong></div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Points Used:</strong> <strong>{{POINTS_COST}} PTS</strong></div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Status:</strong> <span style=\"color:#b8955a; font-weight:bold;\">{{STATUS}}</span></div>\n              </div>\n\n              <div style=\"background-color:#fffcf5; border-left:3px solid #b8955a; padding:14px 16px; text-align:left; margin-bottom:24px; font-size:12.5px; color:#5a4a28; line-height:1.6;\">\n                💡 <strong>Next Steps:</strong> Please take a screenshot of this receipt and send it to our store page alongside your shipping address or companion notes so we can prepare your package!\n              </div>\n\n              <div>\n                <a href=\"https://m.me/timeless.creations.06\" style=\"display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;\" target=\"_blank\">Send Screenshot via Messenger →</a>\n                <a href=\"https://m.me/TimelessCreationsRP\" style=\"display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;\" target=\"_blank\">Rewards Bot Dashboard →</a>\n              </div>\n            </td>\n          </tr>\n          <tr>\n            <td style=\"background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;\">\n              Supporting Members &amp; Missionaries Across the Philippines • Since 2025\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>\n",
  'thankyou-email.html': "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>{{TITLE}} | Timeless Creations</title>\n</head>\n<body style=\"margin:0; padding:0; background-color:#1a1610; font-family:Georgia, 'Times New Roman', serif; -webkit-font-smoothing:antialiased;\">\n  <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#1a1610; margin:0; padding:24px 0;\">\n    <tr>\n      <td align=\"center\" style=\"padding:0 12px;\">\n        <table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width:460px; width:100%; background-color:#faf7f0; border:1px solid #d6c9a8; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.45);\">\n          <tr>\n            <td style=\"background:linear-gradient(135deg, #2c221e, #1a1610); background-color:#2c221e; color:#d4b07a; padding:28px 20px 22px; text-align:center;\">\n              <div style=\"font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#b8955a; margin-bottom:6px; font-family:'Helvetica', Arial, sans-serif; font-weight:bold;\">Timeless Creations • {{DATE}}</div>\n              <div style=\"font-size:22px; font-weight:bold; color:#d4b07a; font-family:Georgia, 'Times New Roman', serif; margin:0;\">{{TITLE}}</div>\n            </td>\n          </tr>\n          <tr>\n            <td style=\"padding:32px 24px; color:#2c221e; line-height:1.7; font-size:14px; text-align:center; font-family:Georgia, 'Times New Roman', serif; background-color:#faf7f0;\">\n              <p style=\"margin:0 0 12px; font-size:16px; color:#2c221e;\">Hello <strong>{{NAME}}</strong>,</p>\n              <p style=\"color:#444444; font-size:13.5px; line-height:1.6; margin:0 0 16px;\">\n                {{MESSAGE}}\n              </p>\n              \n              <div style=\"background-color:#fdfbf8; border:2px dashed #b8955a; padding:18px 20px; border-radius:6px; margin:20px 0; text-align:left;\">\n                <div style=\"font-size:10.5px; font-weight:bold; color:#8b1a1a; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px; font-family:'Helvetica', Arial, sans-serif;\">📦 Fulfillment Summary:</div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Order ID:</strong> <span style=\"font-family:'Courier New', Courier, monospace; font-size:15px; font-weight:bold; color:#8b1a1a;\">{{ORDER_ID}}</span></div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Item / Package:</strong> <strong>{{ITEM}}</strong></div>\n                <div style=\"font-size:13.5px; color:#2c221e; padding:4px 0;\">• <strong>Status:</strong> <span style=\"color:#16a34a; font-weight:bold;\">{{STATUS}}</span></div>\n              </div>\n\n              <p style=\"font-style:italic; color:#7a6030; font-size:13px; line-height:1.6; margin:0 0 24px;\">\n                Thank you for your dedicated missionary service and for trusting Timeless Creations! If you have any questions or need further assistance, feel free to chat with us anytime.\n              </p>\n\n              <div>\n                <a href=\"https://m.me/timeless.creations.06\" style=\"display:inline-block; background-color:#1c1208; color:#d4b07a !important; padding:12px 22px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;\" target=\"_blank\">Chat with Store Support →</a>\n                <a href=\"https://m.me/TimelessCreationsRP\" style=\"display:inline-block; background-color:#ffffff; color:#1c1208 !important; border:1.5px solid #1c1208; padding:11px 20px; text-decoration:none; font-weight:bold; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; border-radius:4px; margin:4px; font-family:'Helvetica', Arial, sans-serif;\" target=\"_blank\">Rewards Bot Dashboard →</a>\n              </div>\n            </td>\n          </tr>\n          <tr>\n            <td style=\"background-color:#0e0c08; padding:20px; text-align:center; color:rgba(255,255,255,0.45); font-size:9.5px; letter-spacing:1px; text-transform:uppercase; font-family:'Helvetica', Arial, sans-serif;\">\n              Supporting Members &amp; Missionaries Across the Philippines • Since 2025\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>\n",
  'monthly-drip.html': "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>TCRP Monthly Encouragement Letter</title>\n  <style>\n    .img-square {\n      width: 100% !important;\n      max-width: 100% !important;\n      aspect-ratio: 1 / 1 !important;\n      object-fit: cover !important;\n      display: block !important;\n      border: 0 !important;\n    }\n    @media only screen and (max-width: 480px) {\n      .email-container {\n        width: 100% !important;\n        max-width: 100% !important;\n      }\n      .essential-cell {\n        padding: 0 4px !important;\n      }\n      .grid-cell {\n        padding: 2px !important;\n      }\n    }\n  </style>\n</head>\n<body style=\"margin:0; padding:0; background-color:#f4f4f7; font-family:'Garamond', 'Georgia', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;\">\n  <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#f4f4f7; padding:16px 0;\">\n    <tr>\n      <td align=\"center\">\n        <!-- Main Responsive Container -->\n        <table class=\"email-container\" width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:440px; background-color:#ffffff; border:1px solid #e0d6bc; box-shadow:0 10px 30px rgba(0,0,0,0.08); overflow:hidden;\">\n          \n          <!-- Header Banner -->\n          <tr>\n            <td style=\"padding:28px 16px 12px; text-align:center; background-color:#ffffff;\">\n              <span id=\"drip-prev-date\" style=\"font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:2px; color:#b0b0b0; text-transform:uppercase; margin-bottom:8px; display:block;\">Month {{MONTH}} • Dedicated Service</span>\n              <h1 style=\"font-size:20px; letter-spacing:4px; text-transform:uppercase; font-weight:300; margin:0; color:#1a1a1a;\">Timeless Creations</h1>\n              <div style=\"font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:1px; color:#8c7e5d; margin-top:4px; text-transform:uppercase; line-height:1.4;\">\n                Most Trusted Online LDS Store by Members and Missionaries Across the Philippines\n              </div>\n            </td>\n          </tr>\n\n          <!-- Temple Hero Image -->\n          <tr>\n            <td>\n              <img src=\"https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG\" alt=\"Temple\" style=\"width:100%; max-width:100%; height:auto; min-height:140px; max-height:220px; object-fit:cover; display:block; border:0;\">\n            </td>\n          </tr>\n\n          <!-- Message Body -->\n          <tr>\n            <td style=\"padding:20px 16px; text-align:center; line-height:1.6;\">\n              <div style=\"font-size:17px; font-style:italic; margin-bottom:10px; color:#1a1a1a;\">Hello {{NAME}},</div>\n              <div id=\"drip-prev-msg\" style=\"font-size:13px; color:#333333; margin-bottom:16px;\">{{MESSAGE}}</div>\n\n              <!-- Quote Block -->\n              <div style=\"margin:16px 0; padding:14px; background-color:#fdfbf8; border-left:1px solid #d4c197; border-right:1px solid #d4c197;\">\n                <span id=\"drip-prev-quote\" style=\"font-size:13px; font-style:italic; display:block; color:#1a1a1a; line-height:1.5; margin-bottom:6px;\">\"{{SCRIPTURE}}\"</span>\n                <div id=\"drip-prev-speaker\" style=\"font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:2px; font-weight:bold; color:#8c7e5d;\">{{THEME}}</div>\n              </div>\n\n              <div style=\"margin:16px 0; padding:10px 4px; font-style:italic; color:#8c7e5d; font-size:11.5px; border-top:1px double #e0d6bc; border-bottom:1px double #e0d6bc;\">\n                As you focus on your sacred work, let us handle the small details that help you present your best self to the world.\n              </div>\n\n              <!-- 1:1 Responsive Missionary Essentials -->\n              <div style=\"padding:14px 10px; border:1px solid #f0eadd; background-color:#ffffff; border-radius:4px; margin-bottom:16px;\">\n                <h2 style=\"font-weight:400; letter-spacing:2px; text-transform:uppercase; font-size:12px; margin-bottom:12px; color:#1a1a1a;\">Missionary Essentials</h2>\n                <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"table-layout:fixed;\">\n                  <tr>\n                    <td align=\"center\" width=\"48%\" valign=\"top\" class=\"essential-cell\">\n                      <div style=\"width:100%; max-width:130px; margin:0 auto 6px auto;\">\n                        <img id=\"drip-prev-ess1-img\" class=\"img-square\" src=\"{{ESS1_IMG}}\" style=\"border:1px solid #d4c197; border-radius:4px;\" alt=\"Essential 1\">\n                      </div>\n                      <div id=\"drip-prev-ess1-name\" style=\"font-family:'Helvetica', Arial, sans-serif; font-size:9px; text-transform:uppercase; color:#8c7e5d; letter-spacing:1px; font-weight:bold;\">{{ESS1_NAME}}</div>\n                    </td>\n                    <td width=\"4%\"></td>\n                    <td align=\"center\" width=\"48%\" valign=\"top\" class=\"essential-cell\">\n                      <div style=\"width:100%; max-width:130px; margin:0 auto 6px auto;\">\n                        <img id=\"drip-prev-ess2-img\" class=\"img-square\" src=\"{{ESS2_IMG}}\" style=\"border:1px solid #d4c197; border-radius:4px;\" alt=\"Essential 2\">\n                      </div>\n                      <div id=\"drip-prev-ess2-name\" style=\"font-family:'Helvetica', Arial, sans-serif; font-size:9px; text-transform:uppercase; color:#8c7e5d; letter-spacing:1px; font-weight:bold;\">{{ESS2_NAME}}</div>\n                    </td>\n                  </tr>\n                </table>\n              </div>\n\n              <!-- 1:1 Product(s) of the Month -->\n              <div id=\"drip-prev-highlight-container\" style=\"{{HIGHLIGHT_DISPLAY}}; margin:16px 0; padding:14px; background-color:#faf7f0; border:1px solid #c9a84c; border-radius:4px;\">\n                <span style=\"font-family:'Helvetica', Arial, sans-serif; font-size:8px; letter-spacing:2px; text-transform:uppercase; color:#8b1a1a; font-weight:bold; display:block; margin-bottom:10px;\">⭐ Product(s) of the Month</span>\n                <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" id=\"drip-highlight-table\" style=\"table-layout:fixed;\">\n                  <tr>\n                    {{HIGHLIGHT_ITEMS_HTML}}\n                  </tr>\n                </table>\n              </div>\n\n              <!-- 1:1 Responsive 9-Photo Archive Grid -->\n              <div style=\"margin:20px auto; text-align:center;\">\n                <h2 style=\"font-weight:400; letter-spacing:2px; text-transform:uppercase; font-size:12px; margin-bottom:4px; color:#1a1a1a;\">Engrave Your Legacy</h2>\n                <p style=\"font-size:11.5px; color:#555555; line-height:1.4; margin-bottom:12px; font-style:italic;\">\n                  Your service is a story that deserves to be told.\n                </p>\n                <table width=\"100%\" border=\"0\" cellspacing=\"4\" cellpadding=\"0\" style=\"table-layout:fixed; margin-bottom:14px;\">\n                  <tr>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-1\" class=\"img-square\" src=\"{{GRID1}}\" alt=\"Grid 1\"></td>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-2\" class=\"img-square\" src=\"{{GRID2}}\" alt=\"Grid 2\"></td>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-3\" class=\"img-square\" src=\"{{GRID3}}\" alt=\"Grid 3\"></td>\n                  </tr>\n                  <tr>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-4\" class=\"img-square\" src=\"{{GRID4}}\" alt=\"Grid 4\"></td>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-5\" class=\"img-square\" src=\"{{GRID5}}\" alt=\"Grid 5\"></td>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-6\" class=\"img-square\" src=\"{{GRID6}}\" alt=\"Grid 6\"></td>\n                  </tr>\n                  <tr>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-7\" class=\"img-square\" src=\"{{GRID7}}\" alt=\"Grid 7\"></td>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-8\" class=\"img-square\" src=\"{{GRID8}}\" alt=\"Grid 8\"></td>\n                    <td class=\"grid-cell\"><img id=\"drip-grid-9\" class=\"img-square\" src=\"{{GRID9}}\" alt=\"Grid 9\"></td>\n                  </tr>\n                </table>\n                <a id=\"drip-prev-gallery-link\" href=\"{{GALLERY_URL}}\" target=\"_blank\" style=\"display:inline-block; padding:8px 18px; border:1px solid #1a1a1a; color:#1a1a1a !important; text-decoration:none; font-family:'Helvetica', Arial, sans-serif; font-size:8.5px; text-transform:uppercase; letter-spacing:1.5px; font-weight:bold;\">\n                  Enter the Gallery\n                </a>\n              </div>\n\n              <!-- Dynamic Reward Points Balance (Claimable List vs Nearest Goal Card) -->\n              {{REWARD_SECTION_HTML}}\n\n            </td>\n          </tr>\n\n          <!-- Footer -->\n          <tr>\n            <td style=\"padding:20px 16px; background-color:#1a1a1a; color:#ffffff; text-align:center;\">\n              <div style=\"color:#d4c197; letter-spacing:2px; font-size:9px; text-transform:uppercase;\">Timeless Creations</div>\n              <div style=\"font-size:7.5px; opacity:0.5; margin-top:4px; font-family:Arial, sans-serif;\">Supporting Members &amp; Missionaries Across the Philippines</div>\n            </td>\n          </tr>\n\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>\n"
};

/**
 * Universal Template File Loader
 * Reads from disk first, then falls back to memory.
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
