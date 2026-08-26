import { runSql } from './db.js';

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m"
};

export async function writeLog(level, category, message, psid = 'SYSTEM', metadata = null) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  let color = COLORS.green;
  let icon = 'ℹ️';
  if (level === 'WARN') { color = COLORS.yellow; icon = '⚠️'; }
  if (level === 'ERROR') { color = COLORS.red; icon = '🚨'; }
  if (category.includes('META')) { color = COLORS.cyan; icon = '🌐'; }
  if (category.includes('INBOUND')) { color = COLORS.blue; icon = '📥'; }
  if (category.includes('OUTBOUND')) { color = COLORS.magenta; icon = '📤'; }

  const metaJson = metadata ? JSON.stringify(metadata, null, 2) : '';
  const metaStr = metadata ? `\n   ${COLORS.dim}↳ Details: ${metaJson}${COLORS.reset}` : '';
  
  console.log(`${color}${icon} [${timestamp}] [${category}] [PSID:${psid}]${COLORS.reset} ${message}${metaStr}`);

  try {
    const dbPayload = Array.from(`[${category}] [PSID:${psid}] ${message} ${metadata ? JSON.stringify(metadata) : ''}`).slice(0, 950).join('');
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'))",
      [level.toUpperCase(), dbPayload]
    );
  } catch (err) {
    console.error(`${COLORS.red}Failed to persist log to Turso DB:${COLORS.reset}`, err.message);
  }
}

export const log = {
  inbound: (psid, text, payload, ref) => writeLog('INFO', 'BOT_INBOUND', `User message received`, psid, { text, payload, ref }),
  outbound: (psid, actionDesc, payload) => writeLog('INFO', 'BOT_OUTBOUND', `Bot Dispatch: ${actionDesc}`, psid, { payload }),
  metaSuccess: (psid, messageId) => writeLog('INFO', 'META_API_OK', `Delivered successfully`, psid, { message_id: messageId }),
  metaError: (psid, errorObj) => writeLog('ERROR', 'META_API_ERROR', `Facebook API Error: ${errorObj.message}`, psid, errorObj),
  fsmTransition: (psid, fromState, toState, action) => writeLog('INFO', 'FSM_STATE', `State Transition: ${fromState} ➔ ${toState} via [${action}]`, psid),
  info: (category, message, metadata = null) => writeLog('INFO', category, message, 'SYSTEM', metadata),
  warn: (category, message, metadata = null) => writeLog('WARN', category, message, 'SYSTEM', metadata),
  error: (category, message, metadata = null) => writeLog('ERROR', category, message, 'SYSTEM', metadata)
};

export const logSystemEvent = (level, message, psid = 'SYSTEM') => writeLog(level, 'SYSTEM', message, psid);
export default log;
