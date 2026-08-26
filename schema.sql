CREATE TABLE IF NOT EXISTS `missionaries` (
	`email` text PRIMARY KEY,
	`name` text,
	`last_name` text,
	`first_name` text,
	`full_name` text,
	`cohort` text,
	`batch_month` text,
	`months_sent` integer DEFAULT 0,
	`max_months` integer DEFAULT 24,
	`psid` text UNIQUE,
	`fb_sender_id` text,
	`points` integer DEFAULT 0,
	`referral_code` text UNIQUE,
	`is_prelisted` integer DEFAULT 1,
	`is_active` integer DEFAULT 1,
	`status` text DEFAULT 'active',
	`last_sent_at` text,
	`next_send_date` text,
	`pending_ref_notices` integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `hashed_audit_identities` (
	`identity_hash` text PRIMARY KEY,
	`type` text, -- 'email' or 'psid'
	`welcome_granted` integer DEFAULT 1,
	`referral_awarded` integer DEFAULT 1,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `orders` (
	`order_id` text PRIMARY KEY,
	`psid` text,
	`email` text,
	`name` text,
	`item` text,
	`points_cost` integer,
	`status` text DEFAULT 'PENDING',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `product_catalog` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text UNIQUE,
	`price` real DEFAULT 0,
	`image_url` text,
	`type` text DEFAULT 'reward'
);

CREATE TABLE IF NOT EXISTS `drip_messages` (
	`month` integer PRIMARY KEY,
	`theme` text,
	`scripture` text,
	`message` text,
	`highlight_img` text,
	`highlight_label` text
);

CREATE TABLE IF NOT EXISTS `sessions` (
	`psid` text PRIMARY KEY,
	`state` text DEFAULT 'AWAITING_TERMS',
	`invite_code` text,
	`temp_title` text,
	`temp_email` text,
	`temp_batch` text,
	`otp_code` text,
	`last_otp_at` integer DEFAULT 0,
	`click_count` integer DEFAULT 0,
	`window_start` integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `cash_invoices` (
	`invoice_id` text PRIMARY KEY,
	`email` text,
	`name` text,
	`items_json` text,
	`subtotal` real DEFAULT 0,
	`discount_type` text DEFAULT 'fixed',
	`discount_val` real DEFAULT 0,
	`discount_amount` real DEFAULT 0,
	`total_amount` real DEFAULT 0,
	`status` text DEFAULT 'PENDING',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `system_config` (
	`key` text PRIMARY KEY,
	`value` text
);

CREATE TABLE IF NOT EXISTS `system_settings` (
	`key` text PRIMARY KEY,
	`value` text
);

CREATE TABLE IF NOT EXISTS `system_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`level` text DEFAULT 'INFO',
	`message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `bot_rate_limits` (
	`psid` text PRIMARY KEY,
	`msg_count` integer DEFAULT 1,
	`window_start` integer DEFAULT 0,
	`warned_at` integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `cdn_gallery` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`filename` text,
	`direct_url` text,
	`size_label` text,
	`original_kb` real DEFAULT 0,
	`compressed_kb` real DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS `idx_m_email` ON `missionaries` (`email`);
CREATE INDEX IF NOT EXISTS `idx_m_psid` ON `missionaries` (`psid`);
CREATE INDEX IF NOT EXISTS `idx_m_ref` ON `missionaries` (`referral_code`);
CREATE INDEX IF NOT EXISTS `idx_m_status_date` ON `missionaries` (`status`, `next_send_date`, `months_sent`, `max_months`);
CREATE INDEX IF NOT EXISTS `idx_orders_status` ON `orders` (`status`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_catalog_type` ON `product_catalog` (`type`, `price`);
