import fs from 'fs';

if (fs.existsSync('.env')) {
  const envConfig = fs.readFileSync('.env', 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  }
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  process.exit(1);
}

const httpUrl = tursoUrl.replace('libsql://', 'https://') + '/v2/pipeline';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function formatStrictMMMMYYYY(rawDate) {
  if (!rawDate) return '';
  const str = rawDate.trim();
  for (const month of MONTH_NAMES) {
    if (str.toLowerCase().includes(month.toLowerCase())) {
      const yearMatch = str.match(/\b(20\d\d)\b/);
      if (yearMatch) {
        return `${month} ${yearMatch[1]}`;
      }
    }
  }
  return str;
}

// Calculate elapsed months from batch month to current date
function computeMonthsSent(batchMonthStr, maxMonths) {
  if (!batchMonthStr) return 0;
  const s = batchMonthStr.toLowerCase();
  
  let startMonth = 0;
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (s.includes(name)) {
      startMonth = num;
      break;
    }
  }
  if (!startMonth) return 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const yearMatch = s.match(/\b(20\d\d)\b/);
  const startYear = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;

  const elapsed = (currentYear - startYear) * 12 + (currentMonth - startMonth);
  return Math.max(0, Math.min(elapsed, maxMonths));
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]);
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = fields[j] || '';
    }
    obj['__first_col__'] = fields[0] || '';
    results.push(obj);
  }
  return results;
}

function splitCSVLine(line) {
  const fields = [];
  let curr = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(curr.trim());
      curr = '';
    } else {
      curr += char;
    }
  }
  fields.push(curr.trim());
  return fields;
}

async function tursoBatchQuery(statements) {
  if (statements.length === 0) return;

  const requests = statements.map(stmt => ({
    type: "execute",
    stmt: {
      sql: stmt.sql,
      args: stmt.args.map(val => (val === null ? { type: "null" } : { type: "text", value: String(val) }))
    }
  }));
  requests.push({ type: "close" });

  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tursoToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Turso Error ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function runCsvSync() {
  console.log("⚡ Syncing Recipients with 'batch_month' & 'months_sent' to Turso...");

  await fetch(httpUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql: "DROP TABLE IF EXISTS recipients" } },
        {
          type: "execute",
          stmt: {
            sql: `CREATE TABLE recipients (
              id TEXT PRIMARY KEY,
              email TEXT UNIQUE,
              name TEXT,
              last_name TEXT,
              cohort TEXT,
              max_months INTEGER,
              months_sent INTEGER DEFAULT 0,
              status TEXT DEFAULT 'active',
              batch_month TEXT
            )`
          }
        },
        { type: "close" }
      ]
    })
  });

  const files = [
    { path: 'TC Ver2 - Emails (Elders).csv', cohort: 'elder', maxMonths: 24 },
    { path: 'TC Ver2 - Emails (Sisters).csv', cohort: 'sister', maxMonths: 18 }
  ];

  for (const fileInfo of files) {
    if (!fs.existsSync(fileInfo.path)) {
      console.log(`⚠️ File not found: ${fileInfo.path}. Skipping.`);
      continue;
    }

    console.log(`📂 Processing ${fileInfo.path}...`);
    const fileContent = fs.readFileSync(fileInfo.path, 'utf8');
    const records = parseCSV(fileContent);

    let batchStatements = [];
    let totalSynced = 0;

    for (const r of records) {
      const email = (r.Email || '').trim().toLowerCase();
      if (!email || !email.endsWith('@missionary.org')) continue;

      const firstName = (r['First Name'] || '').trim();
      const lastName = (r['Last Name'] || '').trim();
      
      const rawDate = r['Start Date'] || r['__first_col__'] || '';
      const batchMonth = formatStrictMMMMYYYY(rawDate);
      const monthsSent = computeMonthsSent(batchMonth, fileInfo.maxMonths);

      const isUnsub = (r['Unsubscribe'] || '').trim().toUpperCase() === 'YES';
      const status = isUnsub ? 'unsubscribed' : 'active';
      const id = 'rec_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

      batchStatements.push({
        sql: `
          INSERT INTO recipients (id, email, name, last_name, cohort, max_months, months_sent, status, batch_month)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [id, email, firstName, lastName, fileInfo.cohort, fileInfo.maxMonths, monthsSent, status, batchMonth]
      });

      if (batchStatements.length >= 50) {
        try {
          await tursoBatchQuery(batchStatements);
          totalSynced += batchStatements.length;
        } catch (err) {
          console.warn(`⚠️ Batch warning: ${err.message}`);
        }
        batchStatements = [];
      }
    }

    if (batchStatements.length > 0) {
      try {
        await tursoBatchQuery(batchStatements);
        totalSynced += batchStatements.length;
      } catch (err) {
        console.warn(`⚠️ Final batch warning: ${err.message}`);
      }
    }

    console.log(`✅ Synced ${fileInfo.path}: ${totalSynced} records.`);
  }

  console.log("\n🎉 Database update complete with accurate 'months_sent' tracking!");
}

runCsvSync().catch(console.error);
