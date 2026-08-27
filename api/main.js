import 'dotenv/config';
import { handleSystemAction } from '../lib/handlers/systemHandler.js';
import { handleMissionaryAction } from '../lib/handlers/missionaryHandler.js';
import { handlePromoAction } from '../lib/handlers/promoHandler.js';
import { handleEmailAction } from '../lib/handlers/emailHandler.js';
import { handleCatalogAction } from '../lib/handlers/catalogHandler.js';
import { handleDripAction } from '../lib/handlers/dripHandler.js';
import { handleInvoiceAction } from '../lib/handlers/invoiceHandler.js';
import { handleCdnAction } from '../lib/handlers/cdnHandler.js';
import { handleBotApiAction } from '../lib/handlers/botApiHandler.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
