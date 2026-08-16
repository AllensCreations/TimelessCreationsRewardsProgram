export function generateOtpHtml({ name, otpCode, displayDate }) {
  const cleanName = name || "Missionary";
  const cleanDate = displayDate || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const messengerLink = "https://m.me/TimelessCreationsRP";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Verification Passcode | Timeless Creations</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #1a1610; }

    .cta-button { transition: all 0.25s ease; }
    .cta-button:hover { background-color: #3a2e14 !important; box-shadow: 6px 6px 0 rgba(180,140,70,0.6) !important; transform: translate(-2px,-2px); }

    @media only screen and (max-width: 600px) {
      .email-shell { width: 100% !important; }
      .letter-body-td { padding: 32px 20px !important; }
      .otp-badge { font-size: 28px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#1a1610;font-family:Georgia,'Times New Roman',serif;">

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#1a1610;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table class="email-shell" role="presentation" border="0" cellpadding="0" cellspacing="0" width="460" style="max-width:460px;width:100%;">

        <!-- ── BADGE ── -->
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border:1px dashed rgba(180,140,70,0.25);border-radius:50%;padding:5px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border:1px solid rgba(180,140,70,0.40);border-radius:50%;padding:10px 20px;text-align:center;">
                        <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(180,140,70,0.75);">Timeless Creations</div>
                        <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:rgba(180,140,70,0.55);margin-top:3px;">${cleanDate} • Verification</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── ENVELOPE FLAP ── -->
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
                <td align="center" style="background:linear-gradient(180deg,#c9b98a 0%,#d6c9a8 40%);padding:14px 20px 22px;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#5a4a28;opacity:0.75;">Account Passcode</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#3a2e14;line-height:1.2;margin-top:2px;font-weight:bold;">${cleanName}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── LETTER BODY ── -->
        <tr>
          <td class="letter-body-td" style="background-color:#faf7f0;background-image:repeating-linear-gradient(transparent,transparent 27px,rgba(180,160,100,0.12) 27px,rgba(180,160,100,0.12) 28px);padding:36px 32px 34px;border-left:4px solid rgba(180,80,80,0.18);box-shadow:0 -4px 20px rgba(0,0,0,0.25);text-align:center;">

            <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1c1208;margin-bottom:14px;">
              Your One-Time Passcode
            </div>

            <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.8;color:#2a200c;margin:0 0 24px 0;">
              Please enter this 6-digit verification code in Messenger to verify your missionary email and activate your Timeless Creations Rewards (TCRP) points account.
            </p>

            <!-- ── OTP DISPLAY BOX ── -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 auto 24px auto;">
              <tr>
                <td align="center" style="background-color:#f6f1e6;border:2px dashed #b8955a;padding:18px 12px;border-radius:4px;">
                  <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8b1a1a;margin-bottom:6px;font-weight:bold;">Verification Passcode</div>
                  <div class="otp-badge" style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:#8b1a1a;">
                    ${otpCode}
                  </div>
                  <div style="font-family:Georgia,serif;font-size:11px;color:#7a6030;margin-top:6px;font-style:italic;">Valid for 10 minutes</div>
                </td>
              </tr>
            </table>

            <!-- ── RETURN TO MESSENGER CTA BUTTON ── -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 20px auto;">
              <tr>
                <td class="cta-button" style="background-color:#1c1208;padding:14px 32px;box-shadow:4px 4px 0 rgba(180,140,70,0.35);">
                  <a href="${messengerLink}" style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4b07a;text-decoration:none;font-weight:bold;display:block;white-space:nowrap;">
                    Return to Messenger →
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-family:Georgia,serif;font-size:11px;color:#8a7050;font-style:italic;">
              If you did not request this code, you can safely disregard this email.
            </div>

            <!-- Signature -->
            <div style="margin-top:28px;text-align:center;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#3a2800;">With warmth,</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1208;margin-top:2px;">Timeless Creations</div>
            </div>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background-color:#0e0c08;padding:24px 20px;text-align:center;border-top:1px solid rgba(180,140,70,0.18);">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#b8955a;font-style:italic;margin-bottom:4px;">Timeless Creations Rewards</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;color:rgba(255,255,255,0.28);">Supporting Members &amp; Missionaries Across the Philippines</div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
