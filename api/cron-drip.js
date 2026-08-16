import 'dotenv/config';

let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
let token = (process.env.TURSO_AUTH_TOKEN || '').trim();
rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
token = token.replace(/^['"]|['"]$/g, '').trim();
const tursoHttp = `https://${rawUrl}/v2/pipeline`;

const BREVO_KEY = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
const SENDER_EMAIL = "noreply.timelesscreations.ph@gmail.com";

async function queryTurso(requests) {
  const res = await fetch(tursoHttp, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [...requests, { type: "close" }] })
  });
  return res.json();
}

export default async function handler(req, res) {
  try {
    // 1. Check Force Stop flag
    const stopCheck = await queryTurso([
      { type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP';" } }
    ]);
    const isStopped = Number(stopCheck.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value || 0) === 1;
    if (isStopped) {
      return res.status(200).json({ ok: true, message: "Distribution paused by Emergency Force Stop." });
    }

    // 2. Fetch active missionaries due for sending
    const dbRes = await queryTurso([
      { type: "execute", stmt: { sql: "SELECT email, name, last_name, cohort, months_sent, max_months FROM missionaries WHERE status = 'active' AND months_sent < max_months;" } },
      { type: "execute", stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages;" } }
    ]);

    const misRows = dbRes.results?.[0]?.response?.result?.rows || [];
    const msgRows = dbRes.results?.[1]?.response?.result?.rows || [];

    const messagesMap = new Map();
    msgRows.forEach(r => {
      messagesMap.set(Number(r[0]?.value || r[0]), {
        theme: r[1]?.value || r[1],
        quote: r[2]?.value || r[2],
        message: r[3]?.value || r[3]
      });
    });

    let sentCount = 0;
    const nowIso = new Date().toISOString();

    for (const row of misRows) {
      const email = row[0]?.value || row[0];
      const name = row[1]?.value || row[1];
      const currentMonthsSent = Number(row[4]?.value || row[4] || 0);
      const maxMonths = Number(row[5]?.value || row[5] || 24);

      const targetMonth = currentMonthsSent + 1;
      if (targetMonth > maxMonths) continue;

      const dripMsg = messagesMap.get(targetMonth) || {
        theme: "Monthly Encouragement",
        quote: "Trust in the Lord with all thine heart.",
        message: "Keep pressing forward in your missionary labors!"
      };

      // 3. Dispatch Email via Brevo
      const emailPayload = {
        sender: { name: "Timeless Creations", email: SENDER_EMAIL },
        to: [{ email, name }],
        subject: `Monthly Inspiration: ${dripMsg.theme}`,
        htmlContent: `<p>Dear ${name},</p><blockquote><i>"${dripMsg.quote}"</i></blockquote><p>${dripMsg.message}</p>`
      };

      const mailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      if (mailRes.ok) {
        sentCount++;
        // 4. Increment months_sent by 1 ONLY after successful delivery
        await queryTurso([
          {
            type: "execute",
            stmt: {
              sql: "UPDATE missionaries SET months_sent = months_sent + 1, last_sent_at = ? WHERE email = ?;",
              args: [{ type: "text", value: nowIso }, { type: "text", value: email }]
            }
          }
        ]);
      }
    }

    return res.status(200).json({ ok: true, sentCount, timestamp: nowIso });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
