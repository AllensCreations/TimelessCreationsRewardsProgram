import { runSql } from './db.js';

export async function checkDashboardRateLimit(senderId) {
  const sid = String(senderId);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const cacheKey = `${sid}_${todayStr}`;

  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_daily_views (
        sender_id TEXT,
        view_date TEXT,
        view_count INTEGER DEFAULT 0,
        warned INTEGER DEFAULT 0,
        PRIMARY KEY (sender_id, view_date)
      )
    `);

    const dbRows = await runSql(
      "SELECT view_count FROM bot_daily_views WHERE sender_id = ? AND view_date = ? LIMIT 1",
      [sid, todayStr]
    );

    const currentCount = Number(dbRows?.[0]?.view_count || 0);

    if (currentCount >= 2) {
      return { allowed: false, remaining: 0, shouldMute: true, message: "Daily limit reached." };
    }

    const newCount = currentCount + 1;
    await runSql(`
      INSERT INTO bot_daily_views (sender_id, view_date, view_count, warned) 
      VALUES (?, ?, ?, 0) 
      ON CONFLICT(sender_id, view_date) DO UPDATE SET view_count = ?
    `, [sid, todayStr, String(newCount), String(newCount)]);

    return { allowed: true, remaining: 2 - newCount, shouldMute: false, message: '' };
  } catch (err) {
    return { allowed: true, remaining: 1, shouldMute: false, message: '' };
  }
}
