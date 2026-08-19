const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();
const SENDER_EMAIL = (process.env.BREVO_EMAIL || process.env.SENDER_EMAIL || 'support@timelesscreationsrp.com').trim();
const SENDER_NAME = "Timeless Creations";

export async function sendEmail({ toEmail, toName, subject, htmlContent }) {
  if (!BREVO_KEY) {
    console.error("Mailer Error: BREVO_API_KEY is missing.");
    return false;
  }
  if (!toEmail || !toEmail.includes('@')) {
    console.error("Mailer Error: Invalid recipient email:", toEmail);
    return false;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: toEmail, name: toName || 'Valued Customer' }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      console.error("Brevo API error response:", errData);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Mailer network exception:", err.message);
    return false;
  }
}
