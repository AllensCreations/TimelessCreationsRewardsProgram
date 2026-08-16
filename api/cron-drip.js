import 'dotenv/config';

let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
let token = (process.env.TURSO_AUTH_TOKEN || '').trim();
rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
token = token.replace(/^['"]|['"]$/g, '').trim();
const tursoHttp = `https://${rawUrl}/v2/pipeline`;

const BREVO_KEY = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
const SENDER_EMAIL = "noreply.timelesscreations.ph@gmail.com";

// Daily Quota Caps
const CAP_SISTERS = 140;
const CAP_ELDERS = 140;

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
    // 1. Emergency Force Stop Check
    const stopCheck = await queryTurso([
      { type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP';" } }
    ]);
    const isStopped = Number(stopCheck.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value || 0) === 1;
    if (isStopped) {
      return res.status(200).json({ ok: true, message: "Dispatch paused: Emergency Force Stop is ACTIVE." });
    }

    // 2. Fetch up to 140 eligible Sisters and 140 eligible Elders
    const dbRes = await queryTurso([
      {
        type: "execute",
        stmt: {
          sql: `SELECT email, name, cohort, months_sent, max_months 
                FROM missionaries 
                WHERE status = 'active' AND cohort = 'sister' AND months_sent < max_months 
                ORDER BY months_sent ASC, rowid ASC 
                LIMIT ?;`,
          args: [{ type: "integer", value: String(CAP_SISTERS) }]
        }
      },
      {
        type: "execute",
        stmt: {
          sql: `SELECT email, name, cohort, months_sent, max_months 
                FROM missionaries 
                WHERE status = 'active' AND cohort = 'elder' AND months_sent < max_months 
                ORDER BY months_sent ASC, rowid ASC 
                LIMIT ?;`,
          args: [{ type: "integer", value: String(CAP_ELDERS) }]
        }
      },
      {
        type: "execute",
        stmt: { sql: "SELECT month, theme, scripture, message FROM drip_messages ORDER BY month ASC;" }
      }
    ]);

    const sisterRows = dbRes.results?.[0]?.response?.result?.rows || [];
    const elderRows = dbRes.results?.[1]?.response?.result?.rows || [];
    const msgRows = dbRes.results?.[2]?.response?.result?.rows || [];

    const messagesMap = new Map();
    msgRows.forEach(r => {
      messagesMap.set(Number(r[0]?.value || r[0]), {
        theme: r[1]?.value || r[1] || "Monthly Inspiration",
        quote: r[2]?.value || r[2] || "Trust in the Lord with all thine heart.",
        message: r[3]?.value || r[3] || "Keep pressing forward in your sacred labors!"
      });
    });

    const targetQueue = [...sisterRows, ...elderRows];
    let sentSisters = 0;
    let sentElders = 0;
    const nowIso = new Date().toISOString();

    for (const row of targetQueue) {
      const email = row[0]?.value || row[0];
      const name = row[1]?.value || row[1] || "Missionary";
      const cohort = String(row[2]?.value || row[2] || 'elder').toLowerCase();
      const currentMonthsSent = Number(row[3]?.value || row[3] || 0);
      const maxMonths = Number(row[4]?.value || row[4] || 24);

      const targetMonth = currentMonthsSent + 1;
      if (targetMonth > maxMonths) continue;

      const dripMsg = messagesMap.get(targetMonth) || {
        theme: "Monthly Inspiration",
        quote: "Trust in the Lord with all thine heart.",
        message: "Keep pressing forward in your sacred labors!"
      };

      const emailPayload = {
        sender: { name: "Timeless Creations", email: SENDER_EMAIL },
        to: [{ email, name }],
        subject: `Monthly Inspiration: ${dripMsg.theme}`,
        htmlContent: `
          <div style="font-family:Georgia,serif;padding:20px;color:#1a1610;background:#faf7f0;">
            <h2 style="color:#8b1a1a;">${dripMsg.theme}</h2>
            <p>Dear ${name},</p>
            <blockquote style="border-left:3px solid #b8955a;padding-left:12px;color:#5a4a28;font-style:italic;">
              "${dripMsg.quote}"
            </blockquote>
            <p style="line-height:1.6;">${dripMsg.message}</p>
            <p style="margin-top:20px;color:#8a7050;font-size:12px;">Timeless Creations Rewards Program (TCRP)</p>
          </div>
        `
      };

      const mailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      if (mailRes.ok) {
        if (cohort === 'sister') sentSisters++;
        else sentElders++;

        // Increment months_sent ONLY upon confirmed delivery
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

    return res.status(200).json({
      ok: true,
      sentSisters,
      sentElders,
      totalSent: sentSisters + sentElders,
      otpQuotaBufferRemaining: 20,
      timestamp: nowIso
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
