import fs from 'fs';
import path from 'path';
import { queryTurso, unwrap } from '../lib/db.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();
const SENDER_EMAIL = 'noreply.timelesscreations.ph@gmail.com';

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

async function ensureDripMessages() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS drip_messages (
      month INTEGER PRIMARY KEY,
      theme TEXT,
      scripture TEXT,
      message TEXT,
      highlight_img TEXT,
      highlight_label TEXT
    );
  `);

  const countRow = (await runSql("SELECT COUNT(*) as c FROM drip_messages"))[0];
  if (!countRow || Number(countRow.c) === 0) {
    // Seed standard 1 to 24 month tracks if table is fresh
    for (let m = 1; m <= 24; m++) {
      await runSql(`
        INSERT OR IGNORE INTO drip_messages (month, theme, scripture, message, highlight_img, highlight_label)
        VALUES (?, ?, ?, ?, '', '')
      `, [
        m,
        `Month ${m} Focus`,
        `"Trust in the Lord with all thine heart; and lean not unto thine own understanding." — Proverbs 3:5`,
        `Congratulations on serving faithfully for ${m} month(s)! Your dedication brings light and hope to many lives across the Philippines.`
      ]);
    }
  }
}

export default async function handler(req, res) {
  await ensureDripMessages();

  if (req.method === 'GET') {
    try {
      const missionaries = await runSql("SELECT * FROM missionaries ORDER BY ROWID DESC");
      const messages = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");

      const todayStr = new Date().toISOString().slice(0, 10);
      const emailsToday = (await runSql("SELECT COUNT(*) as c FROM system_logs WHERE timestamp LIKE ? AND message LIKE '%sent%'", [`${todayStr}%`]))[0]?.c || 0;
      
      const monthPrefix = todayStr.slice(0, 7);
      const emailsThisMonth = (await runSql("SELECT COUNT(*) as c FROM system_logs WHERE timestamp LIKE ? AND message LIKE '%sent%'", [`${monthPrefix}%`]))[0]?.c || 0;

      const dailyStatsRows = await runSql(`
        SELECT substr(timestamp, 1, 10) as log_date, count(*) as count 
        FROM system_logs 
        WHERE (message LIKE '%Drip%' OR message LIKE '%sent%')
        GROUP BY substr(timestamp, 1, 10)
      `);
      
      const dailyStats = {};
      dailyStatsRows.forEach(r => {
        if (r.log_date) dailyStats[r.log_date] = r.count;
      });

      return res.status(200).json({
        ok: true,
        missionaries: missionaries.map(m => ({
          name: m.name,
          email: m.email,
          cohort: m.cohort || 'elder',
          start: m.batch_month || 'August 2026',
          points: m.points || 0,
          ref: m.referral_code || 'TCRP',
          status: m.status || 'active',
          monthsDiff: m.months_sent || 0,
          limit: m.max_months || 24,
          next_send_date: m.next_send_date
        })),
        messages: messages.map(msg => ({
          month: msg.month,
          theme: msg.theme,
          quote: msg.scripture,
          msg: msg.message,
          highlight_img: msg.highlight_img,
          highlight_label: msg.highlight_label
        })),
        emailsToday,
        emailsThisMonth,
        dailyStats
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { action } = body;

    if (action === 'update_message') {
      const { month, theme, scripture, message } = body;
      await runSql(`
        INSERT INTO drip_messages (month, theme, scripture, message)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(month) DO UPDATE SET
          theme = excluded.theme,
          scripture = excluded.scripture,
          message = excluded.message;
      `, [month, theme || '', scripture || '', message || '']);
      return res.status(200).json({ ok: true, message: `Month ${month} updated in drip_messages successfully.` });
    }

    if (action === 'delete_missionary') {
      const { email } = body;
      await runSql("DELETE FROM missionaries WHERE email = ?", [email]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
