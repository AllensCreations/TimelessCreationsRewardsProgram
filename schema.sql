-- Turso Database Schema for cohort-drip-v5 (Updated with start_month)

CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    last_name TEXT,
    cohort TEXT,
    start_date DATE,
    start_month INTEGER DEFAULT 1,
    months_sent INTEGER DEFAULT 0,
    max_months INTEGER,
    status TEXT DEFAULT 'active',
    last_sent_at DATE,
    retry_count INTEGER DEFAULT 0,
    delete_at DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content (
    month_number INTEGER,
    cohort TEXT,
    title TEXT,
    subject TEXT,
    monthly_message TEXT,
    PRIMARY KEY(month_number, cohort)
);

CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id TEXT,
    cohort TEXT,
    month_number INTEGER,
    is_final INTEGER DEFAULT 0,
    status TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Seed configuration
INSERT OR IGNORE INTO config (key, value) VALUES ('daily_cap_elder', '140');
INSERT OR IGNORE INTO config (key, value) VALUES ('daily_cap_sister', '140');
INSERT OR IGNORE INTO config (key, value) VALUES ('force_stop', 'false');
INSERT OR IGNORE INTO config (key, value) VALUES ('blackout_days', '1-5');
INSERT OR IGNORE INTO config (key, value) VALUES ('max_retry', '3');
