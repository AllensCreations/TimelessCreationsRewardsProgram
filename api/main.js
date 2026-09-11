import 'dotenv/config';
import { handleSystemAction, readLocalVersion } from '../lib/handlers/systemHandler.js';
import { handleMissionaryAction } from '../lib/handlers/missionaryHandler.js';
import { handlePromoAction } from '../lib/handlers/promoHandler.js';
import { handleEmailAction } from '../lib/handlers/emailHandler.js';
import { handleCatalogAction } from '../lib/handlers/catalogHandler.js';
import { handleDripAction } from '../lib/handlers/dripHandler.js';
import { handleInvoiceAction } from '../lib/handlers/invoiceHandler.js';
import { handleCdnAction } from '../lib/handlers/cdnHandler.js';
import { handleBotApiAction } from '../lib/handlers/botApiHandler.js';
import { requireAdmin } from '../lib/auth.js';

const MUTATING_ADMIN_ACTIONS = new Set([
  'save_products', 'sync_catalog', 'update_order_status', 'update_order', 'delete_order',
  'update_missionary', 'update_missionary_points', 'delete_missionary', 'push_missionaries',
  'save_promo_code', 'delete_promo_code', 'save_drip', 'apply_top_sales_all_months',
  'update_invoice_status', 'update_invoice', 'delete_invoice', 'create_invoice',
  'save_cdn_config', 'delete', 'cdn_delete', 'toggle_power', 'toggle_bot_maintenance', 'setup_messenger_profile',
  'run_maintenance', 'prune_database', 'toggle_drip_rewards_category', 'set_drip_rewards_visibility',
  'dispatch_single_pending', 'reschedule_missionary_email', 'trigger_cron_dispatch'
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key, x-client-version, x-client-version-code");

  if (req.method === "OPTIONS") return res.status(200).end();

  let action = req.query?.action;
  let bodyData = {};

  if (req.body) {
    if (typeof req.body === "string") {
      try { bodyData = JSON.parse(req.body); } catch (e) { bodyData = {}; }
    } else {
      bodyData = req.body || {};
    }
    if (bodyData.action) action = bodyData.action;
  }

  // Enforce unrunnable status for outdated client versions (except update checks)
  const clientCodeHeader = req.headers?.['x-client-version-code'] || req.query?.client_version_code || bodyData?.client_version_code;
  if (clientCodeHeader && action !== 'get_version' && action !== 'check_update') {
    const local = readLocalVersion();
    const clientCodeNum = parseInt(clientCodeHeader, 10);
    if (!isNaN(clientCodeNum) && local.version_code && clientCodeNum < local.version_code) {
      return res.status(426).json({
        ok: false,
        update_required: true,
        error: `Installed app version (Build ${clientCodeNum}) is outdated and retired. Please update to v${local.version} (Build ${local.version_code}) to continue.`,
        latest_version: local.version,
        latest_version_code: local.version_code
      });
    }
  }

  try {
    const handlers = [
      handleSystemAction,
      handleMissionaryAction,
      handlePromoAction,
      handleEmailAction,
      handleCatalogAction,
      handleDripAction,
      handleInvoiceAction,
      handleCdnAction,
      handleBotApiAction
    ];

    for (const h of handlers) {
      const result = await h(action, req, bodyData);
      if (result) {
        return res.status(result.status).json(result.json);
      }
    }

    return res.status(404).json({ ok: false, error: `Unknown action '${action}'` });
  } catch (err) {
    console.error(`API Error [${action}]:`, err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
