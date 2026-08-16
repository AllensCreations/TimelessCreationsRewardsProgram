export function generateMasterEmailHtml({ name, lastName, suffix, month, theme, scripture, quoteAuthor, message, points, referralCode, displayDate }) {
  const cleanLastName = lastName || (name ? name.replace(/^(Elder|Sister)\s+/i, '').trim() : 'Missionary');
  const cleanSuffix = suffix || (name?.toLowerCase().startsWith('sister') ? 'Sister' : 'Elder');
  const cleanDate = displayDate || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const pointsVal = points !== undefined && points !== null ? points : 0;
  const codeVal = referralCode || 'TCRP';
  const messengerJoinLink = "https://m.me/TimelessCreationsRP";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Month ${month} Encouragement | Timeless Creations</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #1a1610; }

    .cta-button { transition: all 0.25s ease; }
    .cta-button:hover { background-color: #3a2e14 !important; box-shadow: 6px 6px 0 rgba(180,140,70,0.6) !important; transform: translate(-2px,-2px); }

    @media only screen and (max-width: 600px) {
      .email-shell { width: 100% !important; }
      .product-col { width: 100% !important; display: block !important; margin-bottom: 15px; }
      .gallery-img { width: 33.33% !important; }
      .letter-body-td { padding: 32px 20px !important; }
      .salutation-name { font-size: 24px !important; }
      .body-text { font-size: 14px !important; line-height: 1.7 !important; }
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#1a1610;font-family:Georgia,'Times New Roman',serif;">

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#1a1610;">
  <tr>
    <td align="center" style="padding:30px 12px;">

      <table class="email-shell" role="presentation" border="0" cellpadding="0" cellspacing="0" width="460" style="max-width:460px;">

        <!-- ── BADGE ── -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border:1px dashed rgba(180,140,70,0.25);border-radius:50%;padding:5px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border:1px solid rgba(180,140,70,0.40);border-radius:50%;padding:10px 20px;text-align:center;">
                        <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(180,140,70,0.75);">Timeless Creations</div>
                        <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:rgba(180,140,70,0.55);margin-top:3px;">${cleanDate} • Month ${month}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── ENVELOPE FLAP & SALUTATION ── -->
        <tr>
          <td>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#d6c9a8;border-radius:2px 2px 0 0;box-shadow:0 10px 30px rgba(0,0,0,0.35);">
              <tr>
                <td style="padding:0;font-size:0;line-height:0;">
                  <div style="width:0;height:0;border-left:230px solid transparent;border-right:230px solid transparent;border-top:100px solid #c4b48e;"></div>
                </td>
              </tr>
              <tr>
                <td align="center" style="margin-top:-25px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:54px;height:54px;background:radial-gradient(circle at 38% 38%,#c0362a,#8b1a1a 60%,#5a0f0f);border-radius:50%;text-align:center;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:rgba(255,255,255,0.9);letter-spacing:1px;box-shadow:0 4px 14px rgba(0,0,0,0.55);">TC</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="background:linear-gradient(180deg,#c9b98a 0%,#d6c9a8 40%);padding:14px 20px 24px;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#5a4a28;opacity:0.75;">A letter for</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#6a5530;margin-top:2px;">${cleanSuffix}</div>
                  <div class="salutation-name" style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#3a2e14;line-height:1.2;margin-top:2px;font-weight:bold;">${cleanLastName}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── LETTER BODY ── -->
        <tr>
          <td class="letter-body-td" style="background-color:#faf7f0;background-image:repeating-linear-gradient(transparent,transparent 27px,rgba(180,160,100,0.12) 27px,rgba(180,160,100,0.12) 28px);padding:40px 32px 36px;border-left:4px solid rgba(180,80,80,0.18);box-shadow:0 -4px 20px rgba(0,0,0,0.25);">

            <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#7a6840;text-align:right;margin-bottom:18px;">${cleanDate}</div>

            <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1c1208;margin-bottom:16px;">
              Dear <span style="color:#8b1a1a;font-style:italic;">${cleanSuffix} ${cleanLastName},</span>
            </div>

            <div class="body-text" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.85;color:#2a200c;">
              <p style="margin:0 0 16px 0;">${message}</p>

              <!-- Quote Block -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:22px 0;">
                <tr>
                  <td style="border-left:3px solid #b8955a;background-color:rgba(180,140,70,0.07);padding:16px 18px;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;font-style:italic;color:#3a2800;line-height:1.75;margin-bottom:8px;">“${scripture}”</div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;color:#7a6030;letter-spacing:1px;text-transform:uppercase;">— ${quoteAuthor || theme}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0;">
                As you focus on your sacred work across your mission, we are archiving the moments that define a mission—one missionary, one memory, and one creation at a time.
              </p>
            </div>

            <!-- Signature -->
            <div style="margin-top:30px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#3a2800;margin-bottom:6px;">With pride and warmth,</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1c1208;line-height:1.1;">Timeless Creations</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;color:#8a7050;letter-spacing:1px;font-style:italic;margin-top:4px;">Your friends in the Philippines</div>
            </div>

            <!-- ── ENHANCED TCRP REWARDS SECTION ── -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px;">
              <tr>
                <td style="background-color:#f4eee1;border:2px solid #b8955a;padding:22px 18px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                  <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8b1a1a;font-weight:bold;margin-bottom:6px;">✦ Timeless Creations Rewards (TCRP) ✦</div>
                  
                  <div style="font-family:Georgia,serif;font-size:28px;color:#1c1208;font-weight:bold;margin:4px 0;">${pointsVal} Point(s)</div>
                  
                  <div style="font-family:Georgia,serif;font-size:12px;color:#5a4a28;margin-bottom:12px;">
                    Your Referral Code: <strong style="color:#1c1208;letter-spacing:1px;font-size:14px;">${codeVal}</strong>
                  </div>

                  <!-- Free Stuff / Join Now link -->
                  <div style="font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#2a200c;padding:12px 10px;background-color:#ffffff;border:1px dashed #b8955a;margin-bottom:14px;">
                    🎁 <strong>Want some free Stuff?</strong> Join now and click this link:<br>
                    <a href="${messengerJoinLink}" style="color:#8b1a1a;font-weight:bold;text-decoration:underline;word-break:break-all;font-size:13px;">${messengerJoinLink}</a>
                  </div>

                  <!-- Note: Redeem your points now -->
                  <div style="font-family:Georgia,serif;font-size:13px;color:#6a4e23;margin-bottom:14px;font-style:italic;">
                    💡 <em>Note: Redeem your points... now for exclusive missionary gear, custom nametags, or temple keychains!</em>
                  </div>

                  <!-- Button -->
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td style="background-color:#1c1208;padding:12px 24px;border-radius:2px;">
                        <a href="${messengerJoinLink}" style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4b07a;text-decoration:none;font-weight:bold;display:block;">Redeem Your Points Now →</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── DIVIDER ── -->
        <tr>
          <td style="background-color:#faf7f0;padding:24px 0 10px;text-align:center;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="border-bottom:1px solid rgba(180,140,70,0.3);width:30%;font-size:0;">&nbsp;</td>
                <td align="center" style="width:40%;font-family:Georgia,serif;font-size:11px;letter-spacing:2px;color:rgba(180,140,70,0.85);padding:0 8px;white-space:nowrap;text-transform:uppercase;">
                  Missionary Essentials
                </td>
                <td style="border-bottom:1px solid rgba(180,140,70,0.3);width:30%;font-size:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── PRODUCT SECTION ── -->
        <tr>
          <td style="background-color:#faf7f0;background-image:linear-gradient(135deg,#faf7f0 0%,#f0e8d0 100%);padding:20px 24px 32px;">

            <!-- Product Cards -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
              <tr>
                <td class="product-col" width="48%" valign="top" style="padding-right:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:1px solid rgba(180,140,70,0.3);box-shadow:0 4px 10px rgba(0,0,0,0.06);">
                    <tr><td align="right" style="padding:6px 6px 0;"><span style="font-family:Georgia,serif;font-size:7px;letter-spacing:2px;color:#8b1a1a;border:1px solid #8b1a1a;padding:2px 4px;">BESTSELLER</span></td></tr>
                    <tr><td style="padding:0 8px 4px;"><img src="https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE" alt="Wooden Nametag" width="100%" style="display:block;width:100%;height:auto;border:0;"></td></tr>
                    <tr><td align="center" style="padding:0 6px 14px;">
                      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a4020;font-weight:bold;">Wooden Nametag</div>
                      <div style="font-family:Georgia,serif;font-size:11px;color:#b8955a;margin-top:3px;">Engraved by hand</div>
                    </td></tr>
                  </table>
                </td>
                <td width="4%">&nbsp;</td>
                <td class="product-col" width="48%" valign="top" style="padding-left:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:1px solid rgba(180,140,70,0.3);box-shadow:0 4px 10px rgba(0,0,0,0.06);">
                    <tr><td align="right" style="padding:6px 6px 0;"><span style="font-family:Georgia,serif;font-size:7px;letter-spacing:2px;color:#8b1a1a;border:1px solid #8b1a1a;padding:2px 4px;">MISSION READY</span></td></tr>
                    <tr><td style="padding:0 8px 4px;"><img src="https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ" alt="POS Kit" width="100%" style="display:block;width:100%;height:auto;border:0;"></td></tr>
                    <tr><td align="center" style="padding:0 6px 14px;">
                      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a4020;font-weight:bold;">POS Kit</div>
                      <div style="font-family:Georgia,serif;font-size:11px;color:#b8955a;margin-top:3px;">Plan of Salvation</div>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Guarantee -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td style="background-color:#fffdf7;border:2px solid #8b1a1a;padding:16px;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#4a3810;line-height:1.7;text-align:center;">
                  <div style="text-transform:uppercase;letter-spacing:2px;font-size:10px;color:#8b1a1a;margin-bottom:6px;font-weight:bold;">Our Promise to You</div>
                  <span>First-time customer? We work by <strong style="color:#8b1a1a;font-size:15px;">"Gawa muna bago bayad"</strong> — we craft it first, you see it, then you pay. No risk, no pressure.</span>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td class="cta-button" style="background-color:#1c1208;padding:16px 36px;box-shadow:5px 5px 0 rgba(180,140,70,0.35);">
                        <a href="${messengerJoinLink}" style="font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d4b07a;text-decoration:none;display:block;white-space:nowrap;font-weight:bold;">Order / Join Rewards Hub →</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- 6-Photo Legacy Gallery -->
            <div style="margin-top:36px;margin-bottom:10px;text-align:center;font-family:Georgia,serif;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#b8955a;">Trusted by Elders &amp; Sisters Nationwide</div>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="box-shadow:0 8px 24px rgba(0,0,0,0.08);">
              <tr>
                <td class="gallery-img" width="33%" style="padding:1px;"><img src="https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex" alt="Photo 1" width="100%" style="display:block;width:100%;height:auto;"></td>
                <td class="gallery-img" width="33%" style="padding:1px;"><img src="https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky" alt="Photo 2" width="100%" style="display:block;width:100%;height:auto;"></td>
                <td class="gallery-img" width="34%" style="padding:1px;"><img src="https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv" alt="Photo 3" width="100%" style="display:block;width:100%;height:auto;"></td>
              </tr>
              <tr>
                <td class="gallery-img" width="33%" style="padding:1px;"><img src="https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR" alt="Photo 4" width="100%" style="display:block;width:100%;height:auto;"></td>
                <td class="gallery-img" width="33%" style="padding:1px;"><img src="https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m" alt="Photo 5" width="100%" style="display:block;width:100%;height:auto;"></td>
                <td class="gallery-img" width="34%" style="padding:1px;"><img src="https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV" alt="Photo 6" width="100%" style="display:block;width:100%;height:auto;"></td>
              </tr>
            </table>

            <div style="text-align:center;padding-top:14px;font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#8a7050;line-height:1.7;">
              <a href="https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7" style="color:#b8955a;text-decoration:underline;">View our full craftsmanship gallery →</a>
            </div>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background-color:#0e0c08;padding:30px 20px;text-align:center;border-top:1px solid rgba(180,140,70,0.18);">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;letter-spacing:4px;text-transform:uppercase;color:#b8955a;font-style:italic;margin-bottom:6px;">Timeless Creations</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;color:rgba(180,140,70,0.55);letter-spacing:1px;margin-bottom:10px;">Engraving Memories — One Mission at a Time</div>
            <div style="font-family:Georgia,serif;font-size:10px;color:#b8955a;letter-spacing:1px;margin-bottom:12px;text-transform:uppercase;">
              Luzon &bull; Visayas &bull; Mindanao
            </div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;color:rgba(255,255,255,0.28);letter-spacing:1px;">Supporting Members &amp; Missionaries Across the Philippines · Since 2025</div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
