import fs from 'fs';
import path from 'path';
import { runSql } from '../db.js';
import { runDatabaseMaintenance } from '../dbPruner.js';

let serverMemoryPowerState = "ONLINE";
let serverMemoryBotMaintenanceState = "OFF";

let cachedReleaseInfo = null;
let lastReleaseFetchTime = 0;

function formatApkBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '44.4 MB';
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(1) + ' MB';
}

function parseSemVer(verStr) {
  if (!verStr) return [0, 0, 0];
  const cleaned = String(verStr).replace(/^[^\d]*/, '').trim();
  const parts = cleaned.split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isNewerSemVer(remoteVer, currentVer) {
  const [rMaj, rMin, rPat] = parseSemVer(remoteVer);
  const [cMaj, cMin, cPat] = parseSemVer(currentVer);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

function readLocalVersion() {
  const defaults = {
    version: "2.0.0",
    version_code: 12,
    deployment_id: "deploy_20260904_v2_0",
    build_timestamp: "2026-09-04T12:55:00Z",
    changelog: "v2.0.0: Timeless Rewards 2.0 - Major update with Release Link APK auto-detection, build comparison, and enhanced reward catalog controls"
  };

  const candidatePaths = [
    path.resolve('views/version.json'),
    path.resolve('public/version.json'),
    path.resolve('version.json')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed && parsed.version) {
          return { ...defaults, ...parsed };
        }
      } catch (_) {}
    }
  }
  return defaults;
}

export async function fetchGitHubRelease(force = false) {
  const now = Date.now();
  if (!force && cachedReleaseInfo && (now - lastReleaseFetchTime < 60000)) {
    return cachedReleaseInfo;
  }

  const local = readLocalVersion();
  const repo = "AllensCreations/TimelessCreationsRewardsProgram";
  const releaseApiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const defaultReleaseUrl = `https://github.com/${repo}/releases/latest`;
  const defaultDownloadUrl = `https://github.com/${repo}/releases/latest/download/TimelessRewards.apk`;

  let releaseData = null;
  try {
    const res = await fetch(releaseApiUrl, {
      headers: {
        'User-Agent': 'TCRP-Update-Checker/2.0.0',
        'Accept': 'application/vnd.github+json'
      }
    });
    if (res.ok) {
      releaseData = await res.json();
    }
  } catch (_) {}

  if (releaseData) {
    const tag = releaseData.tag_name || `v${local.version}`;
    const cleanVer = tag.replace(/^v/i, '');

    let buildCode = Number(local.version_code) || 11;
    const match = (releaseData.name || "").match(/Build\s*(\d+)/i) || (releaseData.body || "").match(/Build\s*(?:Code)?[:\s*`]*(\d+)/i);
    if (match) {
      buildCode = parseInt(match[1], 10);
    }

    const assets = releaseData.assets || [];
    const apkAsset = assets.find(a => a.name === 'TimelessRewards.apk') ||
                     assets.find(a => a.name && a.name.endsWith('.apk')) || null;

    const downloadUrl = apkAsset?.browser_download_url || defaultDownloadUrl;
    const apkSize = apkAsset?.size || 46552697;
    const digest = apkAsset?.digest || '';

    cachedReleaseInfo = {
      tag_name: tag,
      version: cleanVer,
      version_code: buildCode,
      name: releaseData.name || `Timeless Rewards ${tag} (Build ${buildCode})`,
      release_url: releaseData.html_url || defaultReleaseUrl,
      apk_name: apkAsset?.name || 'TimelessRewards.apk',
      apk_size: apkSize,
      apk_size_formatted: formatApkBytes(apkSize),
      apk_digest: digest,
      apk_url: downloadUrl,
      direct_apk_url: defaultDownloadUrl,
      github_apk_url: `https://github.com/${repo}/raw/Appversion/public/TimelessRewards.apk`,
      published_at: releaseData.published_at || releaseData.created_at || local.build_timestamp,
      changelog: releaseData.body || `Automated release ${tag}`
    };
  } else {
    cachedReleaseInfo = {
      tag_name: `v${local.version}`,
      version: local.version,
      version_code: Number(local.version_code) || 11,
      name: `Timeless Rewards v${local.version} (Build ${local.version_code || 11})`,
      release_url: defaultReleaseUrl,
      apk_name: 'TimelessRewards.apk',
      apk_size: 46552697,
      apk_size_formatted: '44.4 MB',
      apk_digest: '',
      apk_url: defaultDownloadUrl,
      direct_apk_url: defaultDownloadUrl,
      github_apk_url: `https://github.com/${repo}/raw/Appversion/public/TimelessRewards.apk`,
      published_at: local.build_timestamp,
      changelog: local.changelog || 'Latest improvements and bug fixes.'
    };
  }

  lastReleaseFetchTime = now;
  return cachedReleaseInfo;
}

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
      const forceCheck = req.query?.force === 'true' || bodyData.force === true;
      const release = await fetchGitHubRelease(forceCheck);
      const local = readLocalVersion();

      const clientVerParam = req.query?.client_version || req.query?.version || bodyData?.client_version || bodyData?.version;
      const clientCodeParam = req.query?.client_version_code || req.query?.version_code || bodyData?.client_version_code || bodyData?.version_code;

      const currentVer = clientVerParam || local.version || "2.0.0";
      const currentCode = clientCodeParam ? Number(clientCodeParam) : (Number(local.version_code) || 12);

      const remoteVer = release.version || currentVer;
      const remoteCode = Number(release.version_code) || currentCode;

      const isSame = (remoteCode === currentCode) && (remoteVer === currentVer);
      const hasUpdate = (remoteCode > currentCode) || (!isSame && isNewerSemVer(remoteVer, currentVer));

      let comparisonStatus = isSame ? "same" : (hasUpdate ? "update_available" : "different");
      let statusLabel = isSame ? "Identical (Up to date)" : (hasUpdate ? "New Update Available" : "Different Build");
      let statusMessage = isSame
        ? `✓ Installed APK matches the latest GitHub Release (${release.tag_name} • Build ${remoteCode}).`
        : (hasUpdate
            ? `🚀 New update detected in Release Link: ${release.tag_name} (Build ${remoteCode}). Current is v${currentVer} (Build ${currentCode}).`
            : `Notice: Installed version is v${currentVer} (Build ${currentCode}) and release is ${release.tag_name} (Build ${remoteCode}).`);

      return {
        status: 200,
        json: {
          ok: true,
          version: release.version,
          version_code: release.version_code,
          deployment_id: local.deployment_id,
          build_timestamp: release.published_at || local.build_timestamp,
          apk_url: release.apk_url,
          direct_apk_url: release.direct_apk_url,
          github_apk_url: release.github_apk_url,
          release_url: release.release_url,
          changelog: release.changelog,
          current: {
            version: currentVer,
            version_code: currentCode,
            deployment_id: local.deployment_id,
            build_timestamp: local.build_timestamp
          },
          release: release,
          comparison: {
            is_same: isSame,
            has_update: hasUpdate,
            status: comparisonStatus,
            status_label: statusLabel,
            status_message: statusMessage,
            installed_apk: {
              version: currentVer,
              version_code: currentCode
            },
            release_apk: {
              tag: release.tag_name,
              version: remoteVer,
              version_code: remoteCode,
              file_name: release.apk_name,
              file_size: release.apk_size,
              file_size_formatted: release.apk_size_formatted,
              download_url: release.apk_url,
              release_url: release.release_url
            }
          }
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
