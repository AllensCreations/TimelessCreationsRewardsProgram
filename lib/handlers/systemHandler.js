import { runSql } from '../db.js';
import { runDatabaseMaintenance } from '../dbPruner.js';

let serverMemoryPowerState = "ONLINE";
let serverMemoryBotMaintenanceState = "OFF";

export async function resolvePowerState() {
  try {
    const rowSettings = await runSql("SELECT value FROM system_settings WHERE key = 'power_state'").catch(() => []);
    const val = rowSettings?.[0]?.value;
    if (val && typeof val === 'string' && (val.toUpperCase() === 'ONLINE' || val.toUpperCase() === 'OFFLINE')) {
      serverMemoryPowerState = val.toUpperCase();
    }
  } catch (_) {}
  return serverMemoryPowerState;
}

export async function persistPowerState(newState) {
  const cleanState = (newState || 'ONLINE').toUpperCase();
  serverMemoryPowerState = cleanState;
  try {
    await runSql(`
      INSERT INTO system_settings (key, value) VALUES ('power_state', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [cleanState]).catch(async () => {
      await runSql("UPDATE system_settings SET value = ? WHERE key = 'power_state'", [cleanState]).catch(() => {});
    });
    await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`System master power state switched to ${cleanState}`]).catch(() => {});
  } catch (err) {
    console.error("Error persisting power state:", err);
  }
  return cleanState;
}

export async function resolveBotMaintenanceState() {
  try {
    const rowSettings = await runSql("SELECT value FROM system_settings WHERE key = 'bot_maintenance'").catch(() => []);
    const val = rowSettings?.[0]?.value;
    if (val && typeof val === 'string' && (val.toUpperCase() === 'ON' || val.toUpperCase() === 'OFF')) {
      serverMemoryBotMaintenanceState = val.toUpperCase();
    }
  } catch (_) {}
  return serverMemoryBotMaintenanceState;
}

export async function persistBotMaintenanceState(newState) {
  const cleanState = (newState || 'OFF').toUpperCase();
  serverMemoryBotMaintenanceState = cleanState;
  try {
    await runSql(`
      INSERT INTO system_settings (key, value) VALUES ('bot_maintenance', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [cleanState]).catch(async () => {
      await runSql("UPDATE system_settings SET value = ? WHERE key = 'bot_maintenance'", [cleanState]).catch(() => {});
    });
    await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Messenger bot maintenance mode switched to ${cleanState}`]).catch(() => {});
  } catch (err) {
    console.error("Error persisting bot maintenance state:", err);
  }
  return cleanState;
}

export async function handleSystemAction(action, req, bodyData) {
  switch (action) {
    case "health_check":
    case "ping": {
      const status = await resolvePowerState();
      const botMaint = await resolveBotMaintenanceState();
      return { 
        status: 200, 
        json: { 
          ok: true, 
          status, 
          power_state: status, 
          is_online: status === "ONLINE",
          bot_maintenance: botMaint,
          is_bot_maintenance: botMaint === "ON"
        } 
      };
    }

    case "toggle_power": {
      const requestedState = (bodyData.state || req.query?.state || "online").toUpperCase();
      const finalState = await persistPowerState(requestedState);
      return { status: 200, json: { ok: true, state: finalState, power_state: finalState, is_online: finalState === "ONLINE" } };
    }

    case "get_bot_maintenance": {
      const state = await resolveBotMaintenanceState();
      return { status: 200, json: { ok: true, state, bot_maintenance: state, is_maintenance: state === "ON" } };
    }

    case "toggle_bot_maintenance": {
      let requestedState = (bodyData.state || req.query?.state || "").toUpperCase();
      if (requestedState !== "ON" && requestedState !== "OFF") {
        const current = await resolveBotMaintenanceState();
        requestedState = current === "ON" ? "OFF" : "ON";
      }
      const finalState = await persistBotMaintenanceState(requestedState);
      return { status: 200, json: { ok: true, state: finalState, bot_maintenance: finalState, is_maintenance: finalState === "ON" } };
    }

    case "run_maintenance":
    case "prune_database": {
      const res = await runDatabaseMaintenance();
      return { status: res.ok ? 200 : 500, json: res };
    }

    case "get_version":
    case "check_update": {
      return {
        status: 200,
        json: {
          ok: true,
          version: "1.8.0",
          version_code: 10,
          deployment_id: "deploy_20260902_v1_8",
          build_timestamp: "2026-09-02T13:36:00Z",
          apk_url: "https://timelesscreationsrewardsprogram.vercel.app/TimelessRewards.apk",
          github_apk_url: "https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk",
          changelog: "v1.8.0: Faster Backend with Stale-While-Revalidate Sync, Server-Side TTLCache, and Streamlined Update Checker"
        }
      };
    }

    case "get_system_logs": {
      const limit = Math.min(Number(req.query?.limit || bodyData.limit) || 150, 500);
      const rows = await runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT ?", [limit]);
      return { status: 200, json: { ok: true, logs: rows || [] } };
    }

    case "get_stats":
    case undefined:
    case "": {
      const phtDate = new Date(Date.now() + 8 * 3600 * 1000);
      const todayIso = phtDate.toISOString().slice(0, 10);
      const monthIso = phtDate.toISOString().slice(0, 7);

      const [
        totalM, activeM, totalO, pendingO, totalDrips, pts,
        recentOrders, recentLogs, todaySent, monthSent, recentlySent,
        yearlyRows, powerRow
      ] = await Promise.all([
        runSql("SELECT COUNT(*) as count FROM missionaries").catch(() => [{ count: 0 }]),
        runSql("SELECT COUNT(*) as count FROM missionaries WHERE status = 'active'").catch(() => [{ count: 0 }]),
        runSql("SELECT COUNT(*) as count FROM orders").catch(() => [{ count: 0 }]),
        runSql("SELECT COUNT(*) as count FROM orders WHERE UPPER(status) = 'PENDING'").catch(() => [{ count: 0 }]),
        runSql("SELECT COUNT(*) as count FROM drip_messages").catch(() => [{ count: 0 }]),
        runSql("SELECT SUM(points) as pts FROM missionaries").catch(() => [{ pts: 0 }]),
        runSql("SELECT order_id, name, item, points_cost, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5").catch(() => []),
        runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 50").catch(() => []),
        runSql("SELECT COUNT(*) as count FROM missionaries WHERE last_sent_at LIKE ?", [todayIso + "%"]).catch(() => [{ count: 0 }]),
        runSql("SELECT COUNT(*) as count FROM missionaries WHERE last_sent_at LIKE ?", [monthIso + "%"]).catch(() => [{ count: 0 }]),
        runSql("SELECT email, name, cohort, months_sent, last_sent_at FROM missionaries WHERE last_sent_at IS NOT NULL ORDER BY last_sent_at DESC LIMIT 8").catch(() => []),
        runSql("SELECT strftime('%Y', datetime(created_at, '+8 hours')) as yr, strftime('%m', datetime(created_at, '+8 hours')) as mo, COUNT(*) as cnt FROM system_logs WHERE (level = 'DISPATCH' OR message LIKE '%[EMAIL_DISPATCH]%' OR message LIKE '%sent to%') GROUP BY yr, mo ORDER BY yr DESC, mo ASC").catch(() => [])
      ]);

      const currentPowerState = await resolvePowerState();
      const activeCount = activeM[0]?.count || 0;
      const monthlyHypotheticalTarget = activeCount;

      const yearlyHistory = {};
      const currentYr = String(phtDate.getFullYear());
      yearlyHistory[currentYr] = {};

      (yearlyRows || []).forEach(r => {
        if (r.yr && r.mo) {
          const yrKey = String(r.yr);
          const moKey = parseInt(r.mo, 10);
          if (!yearlyHistory[yrKey]) yearlyHistory[yrKey] = {};
          yearlyHistory[yrKey][moKey] = (yearlyHistory[yrKey][moKey] || 0) + Number(r.cnt || 0);
        }
      });

      // Ensure current PHT month from missionaries is reflected
      const curMo = phtDate.getMonth() + 1;
      const monthSentCnt = monthSent[0]?.count || 0;
      if (monthSentCnt > (yearlyHistory[currentYr][curMo] || 0)) {
        yearlyHistory[currentYr][curMo] = monthSentCnt;
      }

      return {
        status: 200,
        json: {
          ok: true,
          stats: {
            power_state: currentPowerState,
            is_online: currentPowerState === 'ONLINE',
            bot_maintenance: await resolveBotMaintenanceState(),
            is_bot_maintenance: (await resolveBotMaintenanceState()) === 'ON',
            total_missionaries: totalM[0]?.count || 0,
            active_missionaries: activeCount,
            total_orders: totalO[0]?.count || 0,
            pending_orders: pendingO[0]?.count || 0,
            total_drips: totalDrips[0]?.count || 0,
            circulating_points: pts[0]?.pts || 0,
            emails_today: todaySent[0]?.count || 0,
            emails_month: monthSent[0]?.count || 0,
            hypothetical_monthly_target: monthlyHypotheticalTarget
          },
          recent_orders: recentOrders || [],
          recent_logs: recentLogs || [],
          recently_sent_missionaries: recentlySent || [],
          daily_stats: { [todayIso]: todaySent[0]?.count || 0 },
          yearly_dispatch_history: yearlyHistory,
          active_roster_count: activeCount,
          monthly_hypothetical_target: monthlyHypotheticalTarget
        }
      };
    }
  }
  return null;
}
