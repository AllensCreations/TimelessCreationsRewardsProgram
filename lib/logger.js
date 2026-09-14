import { runSql, runSqlBatch } from './db.js';

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

// ── In-Memory Buffered Log Flusher ──────────────────────────────────────────
// Buffers routine logs in memory and flushes them in bulk via a single pipeline
// query to slash Turso monthly rows written & eliminate per-log network latency.
const logBuffer = [];
let flushTimeout = null;
const MAX_BUFFER_SIZE = 20;
const FLUSH_INTERVAL_MS = 10000;

export async function flushLogBuffer() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (logBuffer.length === 0) return;

  const toFlush = logBuffer.splice(0, logBuffer.length);
  try {
    const statements = toFlush.map(l => ({
      sql: "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'))",
      args: [l.level, l.message]
    }));
    await runSqlBatch(statements);
  } catch (err) {
    console.error(`${COLORS.red}Failed to flush buffered logs to Turso DB:${COLORS.reset}`, err.message);
  }
}

// Ensure pending logs are written to Turso before node exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => { flushLogBuffer().catch(() => {}); });
  process.on('SIGTERM', () => { flushLogBuffer().catch(() => {}); });
  process.on('SIGINT', () => { flushLogBuffer().catch(() => {}); });
}

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

  // Filter out high-frequency routine delivery confirmations from persisting to DB
  // (kept in console for real-time inspection, but omitted from Turso rows written)
  if (category === 'META_API_OK') {
    return;
  }

  let rawMsg = `[${category}] [PSID:${psid}] ${message}`;
  if (metadata) {
    try {
      rawMsg += ` ${JSON.stringify(metadata)}`;
    } catch (_) {}
  }
  let dbPayload = Array.from(rawMsg).slice(0, 940).join('');
  dbPayload = dbPayload.replace(/\\u[0-9a-fA-F]{0,3}$/, '').replace(/\\+$/, '');
  const entry = { level: level.toUpperCase(), message: dbPayload };

  // Critical events flush immediately to guarantee zero data loss
  const isCritical = level === 'WARN' || level === 'ERROR' || category === 'DISPATCH' || category === 'ACCOUNT_VERIFIED' || category === 'REDEMPTION' || category === 'ORDER';

  if (isCritical) {
    logBuffer.push(entry);
    await flushLogBuffer();
  } else {
    logBuffer.push(entry);
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      await flushLogBuffer();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => { flushLogBuffer().catch(() => {}); }, FLUSH_INTERVAL_MS);
      if (typeof flushTimeout.unref === 'function') flushTimeout.unref();
    }
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
