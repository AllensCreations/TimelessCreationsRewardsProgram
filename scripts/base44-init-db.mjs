// Base44 dev helper: applies schema.sql to the local libSQL server via /v2/pipeline.
import fs from 'fs';

const url = process.env.DATABASE_URL;
const sql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(Boolean);

for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(url + '/health');
    if (r.ok) break;
  } catch (_) {}
  await new Promise(res => setTimeout(res, 1000));
}

const body = {
  requests: [
    ...statements.map(s => ({ type: 'execute', stmt: { sql: s } })),
    { type: 'close' }
  ]
};

const res = await fetch(url + '/v2/pipeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const data = await res.json();
const errors = (data.results || []).filter(r => r.type === 'error');
errors.forEach(e => console.error('SQL error:', e.error?.message));
console.log(`Applied ${statements.length} statements, ${errors.length} errors.`);
