import { generateMasterEmailHtml } from '../lib/email-template.js';

const tursoUrl = (process.env.TURSO_DATABASE_URL || '').replace(/^[\x27\x22]|[\x27\x22]$/g, '').replace('libsql://', 'https://') + '/v2/pipeline';
const tursoToken = (process.env.TURSO_AUTH_TOKEN || '').replace(/^[\x27\x22]|[\x27\x22]$/g, '');
const brevoKey = (process.env.BREVO_API_KEY || '').replace(/^[\x27\x22]|[\x27\x22]$/g, '');

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 1. Fetch eligible missionaries with full name metadata + all 24 messages
  const selectPayload = {
    requests: [
      {
        type: "execute",
        stmt: {
          sql: `
            SELECT email, name, last_name, cohort, months_sent, max_months, points, referral_code 
            FROM missionaries 
            WHERE status = 'active' 
              AND months_sent < max_months 
              AND (next_send_date IS NULL OR next_send_date <= date('now'))
            ORDER BY next_send_date ASC, months_sent ASC
            LIMIT 280
          `
        }
      },
      {
        type: "execute",
        stmt: {
          sql: `SELECT month, theme, scripture, message FROM drip_messages`
        }
      },
      { type: "close" }
    ]
  };

  const dbRes = await fetch(tursoUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(selectPayload)
  });
  const dbData = await dbRes.json();

  const missionaryRows = dbData.results?.[0]?.response?.result?.rows || dbData.batched_results?.[0]?.result?.rows || [];
  const messageRows = dbData.results?.[1]?.response?.result?.rows || dbData.batched_results?.[1]?.result?.rows || [];

  if (missionaryRows.length === 0) {
    return res.status(200).json({ message: "No drip emails due today." });
  }

  // Build message lookup map: month -> { theme, scripture, message }
  const messageMap = {};
  for (const m of messageRows) {
    const mNum = Number(m[0]?.value ?? m[0]);
    messageMap[mNum] = {
      theme: m[1]?.value ?? m[1],
      scripture: m[2]?.value ?? m[2],
      message: m[3]?.value ?? m[3]
    };
  }

  let sentCount = 0;
  const updates = [];

  // 2. Dispatch emails via Brevo
  for (const r of missionaryRows) {
    const email = r[0]?.value ?? r[0];
    const rawName = r[1]?.value ?? r[1] ?? "Missionary";
    const rawLastName = r[2]?.value ?? r[2];
    const cohort = (r[3]?.value ?? r[3] ?? "").toLowerCase();
    const monthsSent = Number(r[4]?.value ?? r[4] ?? 0);
    const maxMonths = Number(r[5]?.value ?? r[5] ?? 24);
    const points = Number(r[6]?.value ?? r[6] ?? 0);
    const referralCode = r[7]?.value ?? r[7] ?? 'TCRP';

    // Compute Clean Suffix & Last Name
    const isSister = cohort.includes('sister') || rawName.toLowerCase().startsWith('sister');
    const cleanSuffix = isSister ? 'Sister' : 'Elder';
    
    let cleanLastName = rawLastName;
    if (!cleanLastName) {
      cleanLastName = rawName.replace(/^(elder|sister)\s+/i, '').trim();
    }

    const nextMonth = monthsSent + 1;
    const newStatus = nextMonth >= maxMonths ? 'completed' : 'active';
    const msgData = messageMap[nextMonth] || {
      theme: `Month ${nextMonth} Milestone`,
      scripture: "Trust in the Lord with all thine heart. — Proverbs 3:5",
      message: `Congratulations on reaching Month ${nextMonth} of your mission service!`
    };

    const htmlContent = generateMasterEmailHtml({
      name: rawName,
      lastName: cleanLastName,
      suffix: cleanSuffix,
      month: nextMonth,
      theme: msgData.theme,
      scripture: msgData.scripture,
      quoteAuthor: msgData.theme,
      message: msgData.message,
      points,
      referralCode
    });

    try {
      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': brevoKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: "Timeless Creations", email: "rewards@timelesscreations.com" },
          to: [{ email, name: `${cleanSuffix} ${cleanLastName}` }],
          subject: `Month ${nextMonth}: ${msgData.theme}`,
          htmlContent: htmlContent
        })
      });

      if (emailRes.ok) {
        sentCount++;
        updates.push({
          type: "execute",
          stmt: {
            sql: `
              UPDATE missionaries 
              SET months_sent = ?, 
                  next_send_date = date('now', '+30 days'), 
                  last_sent_at = datetime('now'), 
                  status = ? 
              WHERE email = ?
            `,
            args: [
              { type: "integer", value: String(nextMonth) },
              { type: "text", value: newStatus },
              { type: "text", value: email }
            ]
          }
        });
      }
    } catch (e) {
      console.error(`Failed to send email to ${email}:`, e.message);
    }
  }

  // 3. Batch commit updates back to Turso
  if (updates.length > 0) {
    updates.push({ type: "close" });
    await fetch(tursoUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: updates })
    });
  }

  return res.status(200).json({ success: true, processed: missionaryRows.length, sent: sentCount });
}
