import 'dotenv/config';

let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
let token = (process.env.TURSO_AUTH_TOKEN || '').trim();
rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
token = token.replace(/^['"]|['"]$/g, '').trim();
const tursoHttp = `https://${rawUrl}/v2/pipeline`;

const BREVO_KEY = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
const SENDER_EMAIL = "noreply.timelesscreations.ph@gmail.com";

// Daily Safe Allocations (Leaves 40 emails buffer for live OTP passcodes)
const CAP_SISTERS = 130;
const CAP_ELDERS = 130;
const CONCURRENCY_CHUNK = 12; // 12 parallel requests per batch to finish in ~4s

async function queryTurso(requests) {
  const res = await fetch(tursoHttp, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [...requests, { type: "close" }] })
  });
  return res.json();
}

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    // 1. Emergency Force Stop Check
    const stopCheck = await queryTurso([
      { type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP';" } }
    ]);
    const isStopped = Number(stopCheck.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value || 0) === 1;
    if (isStopped) {
      return res.status(200).json({ ok: true, message: "Dispatch paused: Emergency Force Stop is ACTIVE." });
    }

    // 2. Fetch up to quota limit for Sisters and Elders
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
      const mNum = Number(r[0]?.value ?? r[0] ?? 1);
      messagesMap.set(mNum, {
        theme: r[1]?.value ?? r[1] ?? "Monthly Inspiration",
        quote: r[2]?.value ?? r[2] ?? "Trust in the Lord with all thine heart.",
        message: r[3]?.value ?? r[3] ?? "Keep pressing forward in your sacred labors!"
      });
    });

    const targetQueue = [...sisterRows, ...elderRows];
    let sentSisters = 0;
    let sentElders = 0;
    const nowIso = new Date().toISOString();

    // 3. Process in parallel chunks of 12
    for (let i = 0; i < targetQueue.length; i += CONCURRENCY_CHUNK) {
      // Guard: If approaching 8 seconds, cleanly stop to avoid Vercel 10s crash
      if (Date.now() - startTime > 8000) {
        console.warn("⏱️ Approaching Vercel execution window limit. Pausing batch until next run.");
        break;
      }

      const chunk = targetQueue.slice(i, i + CONCURRENCY_CHUNK);

      await Promise.allSettled(chunk.map(async (row) => {
        const email = String(row[0]?.value ?? row[0] ?? '').trim();
        const name = String(row[1]?.value ?? row[1] ?? 'Missionary').trim();
        const cohort = String(row[2]?.value ?? row[2] ?? 'elder').toLowerCase();
        const currentMonthsSent = Number(row[3]?.value ?? row[3] ?? 0);
        const maxMonths = Number(row[4]?.value ?? row[4] ?? 24);

        const targetMonth = currentMonthsSent + 1;
        if (targetMonth > maxMonths || !email.includes('@')) return;

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
            <div style="font-family:Georgia,serif;padding:24px;color:#1a1610;background:#faf7f0;border-radius:8px;max-width:560px;margin:auto;">
              <h2 style="color:#8b1a1a;margin-top:0;">${dripMsg.theme}</h2>
              <p style="font-size:15px;line-height:1.6;">Dear ${name},</p>
              <blockquote style="border-left:3px solid #b8955a;padding-left:14px;color:#5a4a28;font-style:italic;margin:16px 0;">
                "${dripMsg.quote}"
              </blockquote>
              <p style="font-size:14px;line-height:1.7;">${dripMsg.message}</p>
              <hr style="border:none;border-top:1px solid rgba(0,0,0,0.1);margin:24px 0 16px;"/>
              <p style="color:#8a7050;font-size:12px;margin:0;">Timeless Creations Rewards Program (TCRP)</p>
            </div>
          `
        };

        try {
          const mailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
            body: JSON.stringify(emailPayload)
          });

          if (mailRes.ok) {
            if (cohort === 'sister') sentSisters++;
            else sentElders++;

            // Increment count immediately upon verified send
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
        } catch (e) {
          console.error(`Failed sending to ${email}:`, e.message);
        }
      }));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(200).json({
      ok: true,
      sentSisters,
      sentElders,
      totalSent: sentSisters + sentElders,
      duration: `${elapsed}s`,
      timestamp: nowIso
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
