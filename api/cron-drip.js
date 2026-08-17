import 'dotenv/config';
import { MONTHLY_DRIP_HTML } from '../lib/email-templates.js';

let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
let token = (process.env.TURSO_AUTH_TOKEN || '').trim();
rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
token = token.replace(/^['"]|['"]$/g, '').trim();
const tursoHttp = `https://${rawUrl}/v2/pipeline`;

const BREVO_KEY = (process.env.BREVO_API_KEY || '').replace(/^['"]|['"]$/g, '').trim();
const SENDER_EMAIL = "noreply.timelesscreations.ph@gmail.com";

const CAP_SISTERS = 130;
const CAP_ELDERS = 130;
const CONCURRENCY_CHUNK = 12;

async function queryTurso(requests) {
  const res = await fetch(tursoHttp, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [...requests, { type: "close" }] })
  });
  return res.json();
}

export default async function handler(req, res) {
  const now = new Date();
  const currentDay = now.getDate();

  if (currentDay > 5) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      message: `Drip dispatch blocked: Today is Day ${currentDay}. Automated emails only send on Days 1 through 5.`
    });
  }

  try {
    const stopCheck = await queryTurso([
      { type: "execute", stmt: { sql: "SELECT value FROM stats WHERE key = 'FORCE_STOP';" } }
    ]);
    const isStopped = Number(stopCheck.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value || 0) === 1;
    if (isStopped) {
      return res.status(200).json({ ok: true, message: "Dispatch paused: Emergency Force Stop is ACTIVE." });
    }

    const dbRes = await queryTurso([
      {
        type: "execute",
        stmt: {
          sql: `SELECT email, name, cohort, months_sent, max_months, points, last_name FROM missionaries WHERE status = 'active' AND cohort = 'sister' AND months_sent < max_months ORDER BY months_sent ASC LIMIT ?;`,
          args: [{ type: "integer", value: String(CAP_SISTERS) }]
        }
      },
      {
        type: "execute",
        stmt: {
          sql: `SELECT email, name, cohort, months_sent, max_months, points, last_name FROM missionaries WHERE status = 'active' AND cohort = 'elder' AND months_sent < max_months ORDER BY months_sent ASC LIMIT ?;`,
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
    const nowIso = now.toISOString();

    for (let i = 0; i < targetQueue.length; i += CONCURRENCY_CHUNK) {
      const chunk = targetQueue.slice(i, i + CONCURRENCY_CHUNK);

      await Promise.allSettled(chunk.map(async (row) => {
        const email = String(row[0]?.value ?? row[0] ?? '').trim();
        const name = String(row[1]?.value ?? row[1] ?? 'Missionary').trim();
        const cohort = String(row[2]?.value ?? row[2] ?? 'elder').toLowerCase();
        const currentMonthsSent = Number(row[3]?.value ?? row[3] ?? 0);
        const maxMonths = Number(row[4]?.value ?? row[4] ?? 24);
        const points = Number(row[5]?.value ?? row[5] ?? 0);
        const lastName = String(row[6]?.value ?? row[6] ?? name.split(' ').pop() ?? '').trim();

        const targetMonth = currentMonthsSent + 1;
        if (targetMonth > maxMonths || !email.includes('@')) return;

        const dripMsg = messagesMap.get(targetMonth) || {
          theme: "Monthly Inspiration",
          quote: "Trust in the Lord with all thine heart.",
          message: "Keep pressing forward in your sacred labors!"
        };

        const htmlContent = MONTHLY_DRIP_HTML
          .replace('{DATE}', now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
          .replace('{Suffix}', cohort === 'sister' ? 'Sister' : 'Elder')
          .replace('{LastName}', lastName)
          .replace('{Msg}', dripMsg.message)
          .replace('{Quote}', dripMsg.quote)
          .replace('{Author}', dripMsg.theme)
          .replace('{Points}', points);

        try {
          const mailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { name: "Timeless Creations", email: SENDER_EMAIL },
              to: [{ email, name }],
              subject: `Monthly Inspiration: ${dripMsg.theme}`,
              htmlContent
            })
          });

          if (mailRes.ok) {
            if (cohort === 'sister') sentSisters++;
            else sentElders++;

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
        } catch (e) {}
      }));
    }

    return res.status(200).json({ ok: true, sentSisters, sentElders, totalSent: sentSisters + sentElders });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
