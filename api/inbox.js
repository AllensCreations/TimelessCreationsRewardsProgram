import { queryTurso, unwrap } from '../lib/db.js';

const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || '').trim();

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

export default async function handler(req, res) {
  await runSql(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      psid TEXT,
      sender TEXT,
      text TEXT,
      created_at TEXT
    );
  `);

  if (req.method === 'GET') {
    const { psid } = req.query || {};
    if (psid) {
      const messages = await runSql("SELECT sender, text, created_at FROM chat_messages WHERE psid = ? ORDER BY ROWID ASC", [psid]);
      return res.status(200).json({ ok: true, messages });
    } else {
      const conversations = await runSql(`
        SELECT psid, (SELECT name FROM missionaries WHERE missionaries.psid = chat_messages.psid) as name,
        (SELECT text FROM chat_messages cm2 WHERE cm2.psid = chat_messages.psid ORDER BY cm2.ROWID DESC LIMIT 1) as last_message
        FROM chat_messages GROUP BY psid ORDER BY ROWID DESC
      `);
      return res.status(200).json({ ok: true, conversations });
    }
  }

  if (req.method === 'POST') {
    const { psid, text } = req.body || {};
    if (!psid || !text) return res.status(400).json({ ok: false, error: "Missing psid or text" });

    // Send via Meta Graph API
    if (PAGE_ACCESS_TOKEN) {
      await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: psid }, message: { text } })
      });
    }

    const nowIso = new Date().toISOString();
    await runSql("INSERT INTO chat_messages (psid, sender, text, created_at) VALUES (?, 'page', ?, ?)", [psid, text, nowIso]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
