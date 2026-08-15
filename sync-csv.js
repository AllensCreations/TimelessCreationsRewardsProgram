const { createClient } = require("@libsql/client");
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runCsvSync() {
  // Ensure tables exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      last_name TEXT,
      cohort TEXT,
      start_date TEXT,
      max_months INTEGER,
      status TEXT DEFAULT 'active'
    )
  `);

  const files = [
    { path: 'TC Ver2 - Emails (Elders).csv', cohort: 'elder', maxMonths: 24 },
    { path: 'TC Ver2 - Emails (Sisters).csv', cohort: 'sister', maxMonths: 18 }
  ];

  for (const fileInfo of files) {
    if (!fs.existsSync(fileInfo.path)) {
      console.log(`⚠️ File not found: ${fileInfo.path}. Skipping.`);
      continue;
    }

    console.log(`Processing ${fileInfo.path}...`);
    const fileContent = fs.readFileSync(fileInfo.path, 'utf8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true });

    let count = 0;
    for (const r of records) {
      const email = (r.Email || '').trim().toLowerCase();
      if (!email || !email.endsWith('@missionary.org')) continue;

      const firstName = r['First Name'] || '';
      const lastName = r['Last Name'] || '';
      const startDate = r['Start Date'] || new Date().toISOString().split('T')[0];
      const id = cryptoRandomId();

      try {
        await db.execute({
          sql: `
            INSERT INTO recipients (id, email, name, last_name, cohort, start_date, max_months, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            ON CONFLICT(email) DO UPDATE SET
              name = excluded.name,
              last_name = excluded.last_name,
              cohort = excluded.cohort
          `,
          args: [id, email, firstName, lastName, fileInfo.cohort, startDate, fileInfo.maxMonths]
        });
        count++;
      } catch (err) {
        console.error(`Error inserting ${email}:`, err.message);
      }
    }
    console.log(`✅ Synced ${count} records from ${fileInfo.path}`);
  }
}

function cryptoRandomId() {
  return 'rec_' + Math.random().toString(36.substring(2, 15)) + Date.now().toString(36);
}

runCsvSync();
