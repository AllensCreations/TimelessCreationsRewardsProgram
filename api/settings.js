import crypto from 'crypto';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

async function ensureConfig() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export default async function handler(req, res) {
  await ensureConfig();

  if (req.method === 'GET') {
    const stopRec = (await runSql("SELECT value FROM system_config WHERE key = 'force_stop'"))[0];
    const maintRec = (await runSql("SELECT value FROM system_config WHERE key = 'maintenance_mode'"))[0];

    return res.status(200).json({
      ok: true,
      forceStop: stopRec?.value === '1',
      maintenanceMode: maintRec?.value === '1'
    });
  }

  if (req.method === 'POST') {
    const { action, state } = req.body || {};

    if (action === 'toggle_stop') {
      const val = state ? '1' : '0';
      await runSql("INSERT OR REPLACE INTO system_config (key, value) VALUES ('force_stop', ?)", [val]);
      await logSystemEvent('WARN', `Master Dispatch Paused: ${state}`);
      return res.status(200).json({ ok: true, forceStop: state });
    }

    if (action === 'toggle_maintenance') {
      const val = state ? '1' : '0';
      await runSql("INSERT OR REPLACE INTO system_config (key, value) VALUES ('maintenance_mode', ?)", [val]);
      await logSystemEvent('WARN', `Maintenance Mode Toggled: ${state}`);
      return res.status(200).json({ ok: true, maintenanceMode: state });
    }

    if (action === 'reset_daily_quota') {
      const todayStr = new Date().toISOString().slice(0, 10);
      await runSql("DELETE FROM system_config WHERE key LIKE 'drip_count_%'");
      await logSystemEvent('INFO', `Daily send quota manually reset for ${todayStr}`);
      return res.status(200).json({ ok: true });
    }

    if (action === 'prune_logs') {
      await runSql("DELETE FROM system_logs WHERE ROWID IN (SELECT ROWID FROM system_logs ORDER BY ROWID ASC LIMIT 500)");
      return res.status(200).json({ ok: true });
    }

    if (action === 'audit_referrals') {
      const missionaries = await runSql("SELECT email, referral_code FROM missionaries WHERE referral_code IS NULL OR referral_code = ''");
      let repaired = 0;
      for (const m of missionaries) {
        const newRef = 'TCRP-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        await runSql("UPDATE missionaries SET referral_code = ? WHERE email = ?", [newRef, m.email]);
        repaired++;
      }
      return res.status(200).json({ ok: true, message: `Referral audit complete. Repaired ${repaired} missing codes.` });
    }

    if (action === 'check_brevo') {
      if (!BREVO_KEY) return res.status(400).json({ ok: false, error: "BREVO_API_KEY is missing." });
      try {
        const resp = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': BREVO_KEY, 'Accept': 'application/json' }
        });
        if (resp.ok) {
          const data = await resp.json();
          return res.status(200).json({ ok: true, email: data.email, companyName: data.companyName });
        } else {
          return res.status(400).json({ ok: false, error: "Brevo credentials rejected." });
        }
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    if (action === 'export_backup') {
      const missionaries = await runSql("SELECT * FROM missionaries");
      const messages = await runSql("SELECT * FROM drip_messages");
      const highlight = await runSql("SELECT * FROM product_highlight");
      const invoices = await runSql("SELECT * FROM cash_invoices");

      return res.status(200).json({
        ok: true,
        backup: {
          exported_at: new Date().toISOString(),
          missionaries,
          messages,
          highlight,
          invoices
        }
      });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
