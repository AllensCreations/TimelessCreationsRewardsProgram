import { runSql } from './db.js';

/**
 * ANSI Color Palette for Readable Console Telemetry
 */
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

/**
 * Core persistent logger that saves to Turso DB and prints readable formatted console telemetry
 */
export async function writeLog(level, category, message, psid = 'SYSTEM', metadata = null) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  // Format console log with visual tags
  let color = COLORS.green;
  let icon = 'ℹ️';
  if (level === 'WARN') { color = COLORS.yellow; icon = '⚠️'; }
  if (level === 'ERROR') { color = COLORS.red; icon = '🚨'; }
  if (category.includes('META')) { color = COLORS.cyan; icon = '🌐'; }
  if (category.includes('INBOUND')) { color = COLORS.blue; icon = '📥'; }
  if (category.includes('OUTBOUND')) { color = COLORS.magenta; icon = '📤'; }

  const metaStr = metadata ? `\n   ${COLORS.dim}↳ Details: ${typeof metadata === 'object' ? JSON.stringify(metadata) : metadata}${COLORS.reset}` : '';
  console.log(`${color}${icon} [${timestamp}] [${category}] [PSID:${psid}]${COLORS.reset} ${message}${metaStr}`);

  // Safely persist to Turso DB (system_logs table)
  try {
    const dbPayload = Array.from(`[${category}] [PSID:${psid}] ${message}${metadata ? ` | ${JSON.stringify(metadata)}` : ''}`).slice(0, 950).join('');
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'))",
      [level.toUpperCase(), dbPayload]
    );
  } catch (err) {
    console.error(`${COLORS.red}Failed to persist log to Turso DB:${COLORS.reset}`, err.message);
  }
}

/**
 * Specialized Log Helpers
 */
export const log = {
  inbound: (psid, text, payload, ref) => {
    return writeLog('INFO', 'BOT_INBOUND', `User sent message`, psid, {
      text: text || null,
      quick_reply_or_postback: payload || null,
      referral_code: ref || null
    });
  },

  outbound: (psid, actionDesc, payload) => {
    const isCarousel = payload?.attachment?.payload?.template_type === 'generic';
    const preview = isCarousel 
      ? `Carousel (${payload.attachment.payload.elements.length} cards)` 
      : payload?.text || '[Template/Attachment]';
    return writeLog('INFO', 'BOT_OUTBOUND', `Replying: ${actionDesc}`, psid, { preview });
  },

  metaSuccess: (psid, messageId) => {
    return writeLog('INFO', 'META_API_OK', `Delivered to Facebook Messenger`, psid, { message_id: messageId });
  },

  metaError: (psid, errorObj) => {
    return writeLog('ERROR', 'META_API_ERROR', `Facebook rejected message: ${errorObj.message || 'Unknown Error'}`, psid, {
      error_code: errorObj.code,
      error_subcode: errorObj.error_subcode,
      type: errorObj.type,
      fbtrace_id: errorObj.fbtrace_id
    });
  },

  fsmTransition: (psid, fromState, toState, action) => {
    return writeLog('INFO', 'FSM_STATE', `State change: ${fromState} ➔ ${toState} (via ${action})`, psid);
  },

  info: (category, message, metadata = null) => writeLog('INFO', category, message, 'SYSTEM', metadata),
  warn: (category, message, metadata = null) => writeLog('WARN', category, message, 'SYSTEM', metadata),
  error: (category, message, metadata = null) => writeLog('ERROR', category, message, 'SYSTEM', metadata)
};

export const logSystemEvent = (level, message, psid = 'SYSTEM') => writeLog(level, 'SYSTEM', message, psid);
export default log;
