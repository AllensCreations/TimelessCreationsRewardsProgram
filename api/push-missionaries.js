import 'dotenv/config';

function unwrap(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if ('value' in cell) return cell.value ?? '';
    return '';
  }
  return cell;
}

function calculateInitialMonths(batchStr) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const s = String(batchStr || '').toLowerCase().trim();

  let startYear = curYear;
  let startMonth = curMonth;

  const yMatch = s.match(/\b(202[0-9])\b/);
  if (yMatch) startYear = parseInt(yMatch[1], 10);

  for (let i = 0; i < months.length; i++) {
    if (s.includes(months[i])) {
      startMonth = i + 1;
      break;
    }
  }

  const diff = (curYear - startYear) * 12 + (curMonth - startMonth);
  return Math.max(0, diff);
}

function parseLastName(fullName) {
  const parts = fullName.replace(/^(Elder|Sister)\s+/i, '').trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
  let token = (process.env.TURSO_AUTH_TOKEN || '').trim();
  rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '').trim();
  token = token.replace(/^['"]|['"]$/g, '').trim();

  if (!rawUrl || !token) {
    return res.status(500).json({ ok: false, error: "Missing database credentials" });
  }

  const tursoHttp = `https://${rawUrl}/v2/pipeline`;
  const entries = req.body?.entries || [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ ok: false, error: "No missionary entries provided" });
  }

  try {
    // 1. Fetch existing emails to prevent duplicates
    const checkRes = await fetch(tursoHttp, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "SELECT email FROM missionaries;" } },
          { type: "close" }
        ]
      })
    });
    const checkData = await checkRes.json();
    const existingRows = checkData.results?.[0]?.response?.result?.rows || [];
    const existingEmails = new Set(existingRows.map(r => String(unwrap(r[0])).toLowerCase().trim()));

    let addedCount = 0;
    let skippedCount = 0;
    const tursoRequests = [];

    for (const item of entries) {
      const email = String(item.email || '').toLowerCase().trim();
      if (!email || !email.includes('@')) continue;

      // SKIP DUPLICATES
      if (existingEmails.has(email)) {
        skippedCount++;
        continue;
      }

      const rawName = String(item.name || item.prefix || 'Missionary').trim();
      const isSister = rawName.toLowerCase().startsWith('sister');
      const name = rawName.toLowerCase().startsWith('elder') || isSister ? rawName : (isSister ? `Sister ${rawName}` : `Elder ${rawName}`);
      const lastName = parseLastName(name);
      const cohort = isSister ? 'sister' : 'elder';
      const maxMonths = isSister ? 18 : 24;
      const batch = String(item.batch || item.year_and_month || 'August 2026').trim();
      const monthsSent = Math.min(calculateInitialMonths(batch), maxMonths);
      const ref = `TCRP-${Math.floor(1000 + Math.random() * 9000)}`;

      existingEmails.add(email); // Prevent duplicates within the same batch upload
      addedCount++;

      tursoRequests.push({
        type: "execute",
        stmt: {
          sql: `INSERT INTO missionaries (email, name, last_name, cohort, batch_month, months_sent, max_months, points, referral_code, is_prelisted, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, 1, 'active');`,
          args: [
            { type: "text", value: email },
            { type: "text", value: name },
            { type: "text", value: lastName },
            { type: "text", value: cohort },
            { type: "text", value: batch },
            { type: "integer", value: String(monthsSent) },
            { type: "integer", value: String(maxMonths) },
            { type: "text", value: ref }
          ]
        }
      });
    }

    if (tursoRequests.length > 0) {
      tursoRequests.push({ type: "close" });
      await fetch(tursoHttp, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: tursoRequests })
      });
    }

    return res.status(200).json({
      ok: true,
      added: addedCount,
      skipped: skippedCount,
      message: `Successfully added ${addedCount} missionaries. Skipped ${skippedCount} duplicate emails.`
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
