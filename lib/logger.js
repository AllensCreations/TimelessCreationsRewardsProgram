import { runSql } from './db.js';

/**
 * Universal System & Bot Event Logger
 * Safely handles multi-byte Unicode characters and avoids SQL truncation errors.
 */
export async function logSystemEvent(level, message, psid = 'SYSTEM') {
  const safeMessage = Array.from(String(message || '')).slice(0, 800).join('');
  const tag = psid === 'SYSTEM' ? '[SYSTEM]' : `[PSID:${psid}]`;
  const cleanMsg = `${tag} ${safeMessage}`;
  
  console.log(`[${level.toUpperCase()}] ${cleanMsg}`);
  try {
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'))",
      [level.toUpperCase(), cleanMsg]
    );
  } catch (err) {
    console.error("DB Logger Error:", err.message);
  }
}

export const logBotEvent = logSystemEvent;
export default { logSystemEvent, logBotEvent };
