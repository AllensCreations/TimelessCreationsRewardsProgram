-- TCRP schema fixes — run once against your Turso DB.
-- Fixes: missing chat_messages table (2.1), missing bot_rate_limits table (2.2),
-- duplicate bot_daily_views declaration (2.4, informational only — IF NOT EXISTS
-- already makes it harmless, nothing to run for that one, just delete the
-- second block from schema.sql by hand).

CREATE TABLE IF NOT EXISTS chat_messages (
  id integer PRIMARY KEY AUTOINCREMENT,
  psid text,
  sender text CHECK(sender IN ('user','bot')),
  message text,
  created_at text DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_rate_limits (
  psid text PRIMARY KEY,
  msg_count integer DEFAULT 0,
  window_start integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_psid ON chat_messages (psid, created_at);
