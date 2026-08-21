import 'dotenv/config';

export async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    console.warn("⚠️ BREVO_API_KEY is not configured.");
    return false;
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
        sender: {
          name: "Timeless Creations",
          email: process.env.SENDER_EMAIL || "noreply.timelesscreations.ph@gmail.com"
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const data = await res.json();
    return res.ok;
  } catch (err) {
    console.error("Mailer Fetch Error:", err.message);
    return false;
  }
}

export async function sendDripEmail(to, month = 1, theme = "Dedicated Service", scripture = "", message = "") {
  const html = `
    <div style="font-family:Georgia,serif; padding:20px; color:#1a1a1a; max-width:500px; margin:0 auto; border:1px solid #e0d6bc;">
      <h2 style="color:#8b1a1a; text-align:center;">Timeless Creations</h2>
      <p style="font-size:12px; text-transform:uppercase; color:#8c7e5d; text-align:center;">Month ${month} • ${theme}</p>
      <hr style="border:0; border-top:1px solid #e0d6bc; margin:16px 0;">
      <p style="font-size:14px; line-height:1.6;">${message || "May your faith be strengthened as you serve this month."}</p>
      ${scripture ? `<blockquote style="font-style:italic; border-left:2px solid #c9a84c; padding-left:12px; margin:16px 0; color:#555;">"${scripture}"</blockquote>` : ""}
      <hr style="border:0; border-top:1px solid #e0d6bc; margin:16px 0;">
      <p style="font-size:10px; color:#777; text-align:center;">Supporting Missionaries Across the Philippines</p>
    </div>
  `;
  return await sendEmail({
    to,
    subject: `Monthly Encouragement (Month ${month}) • Timeless Creations`,
    htmlContent: html
  });
}

export async function sendOTPEmail(to, otpCode) {
  const html = `
    <div style="font-family:sans-serif; padding:20px; text-align:center;">
      <h2>Timeless Creations Verification</h2>
      <p>Your one-time verification code is:</p>
      <h1 style="color:#c9a84c; letter-spacing:4px;">${otpCode}</h1>
    </div>
  `;
  return await sendEmail({
    to,
    subject: "Your Timeless Creations Verification Code",
    htmlContent: html
  });
}
