import { runSql } from '../db.js';
import { 
  sendDripEmail, 
  sendOTPEmail, 
  sendReceiptEmail, 
  sendThankYouEmail, 
  sendDeliveredEmail, 
  renderEmailTemplate, 
  sendEmail,
  getCalendarMonthLabel
} from '../mailer.js';
import { cache } from '../cache.js';
import { resolvePowerState } from './systemHandler.js';
import { 
  getFirstMonthInfo, 
  calculateMissionMonth, 
  getFirstDispatchDate, 
  isMissionaryEligibleForDispatch,
  getMissionMonthInfo,
  getUpcomingDripInfo,
  formatMonthYear
} from '../utils/batchCalculator.js';

const inFlightBatchDispatches = new Set();

export async function handleEmailAction(action, req, bodyData) {
  if (action === "test_email") {
    const rawEmails = (bodyData.email || req.query?.email || "").trim();
    const templateType = (bodyData.template_type || req.query?.template_type || "drip").toLowerCase().replace(/[\s-]/g, '_');
    const currentMonthNumber = new Date().getMonth() + 1;
    const month = Number(bodyData.month || req.query?.month) || currentMonthNumber;

    if (!rawEmails) return { status: 400, json: { ok: false, error: "Missing email address(es)" } };

    const targets = rawEmails.split(",").map(e => e.trim()).filter(Boolean);
    let successCount = 0;
    const results = [];

    for (const target of targets) {
      let dispatchResult;
      if (templateType === "otp" || templateType === "passcode" || templateType === "verification") {
        dispatchResult = await sendOTPEmail(target, "891402");
      } else if (templateType === "receipt" || templateType === "redemption") {
        dispatchResult = await sendReceiptEmail(target, {
          name: "Elder / Sister Diagnostic",
          order_id: "TCRP-" + Date.now().toString().slice(-4),
          item: "Wooden Missionary Nametag",
          points_cost: 6
        });
      } else if (templateType === "thankyou" || templateType === "fulfillment" || templateType === "thank_you") {
        dispatchResult = await sendThankYouEmail(target, {
          name: "Elder / Sister Diagnostic",
          order_id: "TCRP-" + Date.now().toString().slice(-4),
          item: "Wooden Missionary Nametag"
        });
      } else if (templateType === "delivered" || templateType === "package_delivered") {
        dispatchResult = await sendDeliveredEmail(target, {
          name: "Elder / Sister Diagnostic",
          order_id: "TCRP-" + Date.now().toString().slice(-4),
          item: "Wooden Missionary Nametag & POS Kit",
          status: "DELIVERED"
        });
      } else if (templateType === "out_of_window" || templateType === "out_of_window_drip" || templateType === "reconnect") {
        const outOfWindowHtml = renderEmailTemplate("out_of_window", {
          name: "Elder / Sister Diagnostic",
          points: 2
        });
        dispatchResult = await sendEmail({
          to: target,
          subject: "⚡ Missionary Reconnect & Rewards • Timeless Creations",
          htmlContent: outOfWindowHtml
        });
      } else {
        dispatchResult = await sendDripEmail(target, month, "Elder / Sister");
      }

      results.push({ email: target, ...dispatchResult });
      if (dispatchResult?.ok) successCount++;
    }

    await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Executed test email dispatch (${templateType}) to ${targets.join(', ')}`]);

    if (successCount > 0) {
      return {
        status: 200,
        json: {
          ok: true,
          totalSent: successCount,
          template: templateType,
          month: templateType === "drip" ? month : undefined,
          recipients: targets,
          details: results
        }
      };
    }

    return {
      status: 500,
      json: {
        ok: false,
        error: "Brevo REST API rejected dispatch.",
        details: results
      }
    };
  }

  if (action === "get_pending_emails" || action === "get_email_schedule") {
    try {
      const payload = await cache.getOrSet("pending_emails_summary", async () => {
        const phtNow = new Date(Date.now() + 8 * 3600 * 1000);
        const todayPhtIso = phtNow.toISOString().slice(0, 10);
        const currentCalMonth = phtNow.getMonth() + 1;

        const [missionaries, drips, powerState] = await Promise.all([
          runSql("SELECT email, name, last_name, first_name, full_name, cohort, batch_month, months_sent, max_months, psid, points, referral_code, is_active, status, last_sent_at, next_send_date FROM missionaries ORDER BY is_prelisted DESC, name ASC").catch(() => []),
          runSql("SELECT month, subject, theme, scripture, message, highlight_img, highlight_label FROM drip_messages ORDER BY month ASC").catch(() => []),
          resolvePowerState().catch(() => 'ONLINE')
        ]);

        const dripMap = {};
        (drips || []).forEach(d => {
          dripMap[d.month] = d;
        });

        let dueTodayCount = 0;
        let sentTodayCount = 0;
        let upcoming7dCount = 0;
        let upcoming30dCount = 0;
        let completedCount = 0;
        let eldersDueToday = 0;
        let sistersDueToday = 0;
        const forecastByDate = {};

        const processedMissionaries = (missionaries || []).map(m => {
          const isSister = (m.cohort || '').toLowerCase().includes('sister') || (m.name || '').toLowerCase().startsWith('sister');
          const maxMonths = Number(m.max_months) || (isSister ? 18 : 24);
          const monthsSent = Number(m.months_sent) || 0;
          const isCompleted = monthsSent >= maxMonths;
          const tenureMonthNum = isCompleted ? null : (monthsSent + 1);

          const lastSentAt = m.last_sent_at || null;
          const sentToday = !!(lastSentAt && lastSentAt.slice(0, 10) === todayPhtIso);
          const sentThisMonth = !!(lastSentAt && lastSentAt.slice(0, 7) === todayPhtIso.slice(0, 7));

          const batchInfo = getFirstMonthInfo(m.batch_month || 'August 2026');
          const currentMissionMonth = calculateMissionMonth(m.batch_month || 'August 2026', maxMonths, phtNow);
          const upcomingDrip = getUpcomingDripInfo(m.batch_month || 'August 2026', monthsSent, maxMonths, phtNow);

          let estimatedNextDate = null;
          if (!isCompleted) {
            const firstDispatchIso = getFirstDispatchDate(m.batch_month || 'August 2026', phtNow);
            const firstMonthPrefix = `${batchInfo.firstMonthYear}-${String(batchInfo.firstMonthNum).padStart(2, '0')}`;

            if (monthsSent === 0) {
              if (currentMissionMonth <= 0) {
                // Missionary is still in arrival batch month (Month 0, e.g. September cohort in September 2026).
                // 1st dispatch MUST occur in their 1st Month (e.g. October 2026), not in arrival month or distant future.
                if (m.next_send_date && m.next_send_date.slice(0, 7) === firstMonthPrefix) {
                  estimatedNextDate = m.next_send_date.slice(0, 10);
                } else {
                  estimatedNextDate = firstDispatchIso;
                  runSql("UPDATE missionaries SET next_send_date = ? WHERE LOWER(email) = ? AND (months_sent = 0 OR months_sent IS NULL)", [estimatedNextDate, m.email]).catch(() => {});
                }
              } else {
                // 1st Month has arrived or passed and missionary has not been sent yet
                if (m.next_send_date && m.next_send_date.slice(0, 10) <= todayPhtIso) {
                  estimatedNextDate = m.next_send_date.slice(0, 10);
                } else {
                  estimatedNextDate = todayPhtIso;
                  runSql("UPDATE missionaries SET next_send_date = ? WHERE LOWER(email) = ? AND (months_sent = 0 OR months_sent IS NULL)", [estimatedNextDate, m.email]).catch(() => {});
                }
              }
            } else {
              // Missionary has already had 1 or more dispatches
              if (monthsSent < currentMissionMonth && !sentThisMonth) {
                // Missed past months and NOT yet dispatched this calendar month: due today
                estimatedNextDate = todayPhtIso;
              } else if (lastSentAt) {
                try {
                  const lastD = new Date(lastSentAt);
                  lastD.setMonth(lastD.getMonth() + 1);
                  const expectedNext = lastD.toISOString().slice(0, 10);
                  // If next_send_date in DB is more than 35 days in future or missing, align to monthly cadence
                  if (!m.next_send_date || m.next_send_date.slice(0, 7) > expectedNext.slice(0, 7)) {
                    estimatedNextDate = expectedNext;
                    runSql("UPDATE missionaries SET next_send_date = ? WHERE LOWER(email) = ?", [estimatedNextDate, m.email]).catch(() => {});
                  } else {
                    estimatedNextDate = m.next_send_date.slice(0, 10);
                  }
                } catch (_) {
                  estimatedNextDate = m.next_send_date ? m.next_send_date.slice(0, 10) : todayPhtIso;
                }
              } else {
                // Prelisted missionary with monthsSent > 0 but lastSentAt is null
                if (upcomingDrip) {
                  const nextDripDate = `${upcomingDrip.year}-${String(upcomingDrip.monthNum).padStart(2, '0')}-09`;
                  estimatedNextDate = m.next_send_date ? m.next_send_date.slice(0, 10) : nextDripDate;
                } else {
                  estimatedNextDate = m.next_send_date ? m.next_send_date.slice(0, 10) : todayPhtIso;
                }
              }
            }
          }

          let nextDripInfo = null;
          if (upcomingDrip) {
            const dripRow = dripMap[upcomingDrip.monthNum] || dripMap[((upcomingDrip.monthNum - 1) % 12) + 1] || {};
            const monthLabel = upcomingDrip.monthName;
            const monthYearDisplay = upcomingDrip.display;
            const rawSubject = dripRow.subject || `Monthly Encouragement ({{MONTH}}) • Timeless Creations`;
            const subject = rawSubject.replace(/{{MONTH}}/gi, monthYearDisplay).replace(/{{NAME}}/gi, m.name || 'Missionary');

            nextDripInfo = {
              month_num: upcomingDrip.monthNum,
              tenure_month: upcomingDrip.tenureMonth,
              calendar_month_label: monthLabel,
              calendar_year: upcomingDrip.year,
              month_year: monthYearDisplay,
              display_label: upcomingDrip.displayLabel,
              subject: subject,
              theme: dripRow.theme || 'Missionary Focus & Encouragement',
              scripture: dripRow.scripture || 'Trust in the Lord with all thine heart.',
              message_preview: dripRow.message ? dripRow.message.slice(0, 100) + '...' : '',
              highlight_label: dripRow.highlight_label || '',
              highlight_img: dripRow.highlight_img || ''
            };
          }

          let daysUntilNext = 0;
          try {
            if (estimatedNextDate) {
              const targetTime = new Date(estimatedNextDate + 'T00:00:00Z').getTime();
              const todayTime = new Date(todayPhtIso + 'T00:00:00Z').getTime();
              daysUntilNext = Math.round((targetTime - todayTime) / (1000 * 3600 * 24));
            }
          } catch (_) {
            daysUntilNext = 0;
          }

          let scheduleStatus = 'UPCOMING_30D';
          const isActive = (m.status || 'active').toLowerCase() === 'active';
          const isEligibleForDispatch = !isCompleted && !sentThisMonth && currentMissionMonth > 0 && monthsSent < currentMissionMonth;

          if (!isActive) {
            scheduleStatus = 'PAUSED';
          } else if (isCompleted) {
            scheduleStatus = 'COMPLETED';
            completedCount++;
          } else if (sentToday) {
            scheduleStatus = 'SENT_TODAY';
            sentTodayCount++;
          } else if (isEligibleForDispatch && (daysUntilNext <= 0 || !m.next_send_date)) {
            scheduleStatus = 'DUE_TODAY';
            dueTodayCount++;
            if (isSister) sistersDueToday++; else eldersDueToday++;
          } else if (daysUntilNext <= 7) {
            scheduleStatus = 'UPCOMING_7D';
            upcoming7dCount++;
          } else if (daysUntilNext <= 30) {
            scheduleStatus = 'UPCOMING_30D';
            upcoming30dCount++;
          } else {
            scheduleStatus = 'FUTURE';
          }

          // Add to forecast bucket if active & not completed
          if (isActive && !isCompleted && estimatedNextDate) {
            if (!forecastByDate[estimatedNextDate]) {
              forecastByDate[estimatedNextDate] = { total: 0, elders: 0, sisters: 0 };
            }
            forecastByDate[estimatedNextDate].total++;
            if (isSister) forecastByDate[estimatedNextDate].sisters++;
            else forecastByDate[estimatedNextDate].elders++;
          }

          const progressPct = Math.min(100, Math.round((monthsSent / maxMonths) * 100));

          return {
            email: m.email,
            name: m.name,
            first_name: m.first_name,
            last_name: m.last_name,
            cohort: isSister ? 'sister' : 'elder',
            batch_month: m.batch_month || 'August 2026',
            months_sent: monthsSent,
            max_months: maxMonths,
            progress_percent: progressPct,
            points: m.points || 0,
            referral_code: m.referral_code || '',
            status: m.status || 'active',
            is_active: isActive,
            is_completed: isCompleted,
            sent_today: sentToday,
            last_sent_at: lastSentAt,
            next_send_date: estimatedNextDate,
            days_until_next: daysUntilNext,
            schedule_status: scheduleStatus,
            next_drip: nextDripInfo
          };
        });

        return {
          ok: true,
          today_pht: todayPhtIso,
          current_pht_time: phtNow.toISOString(),
          power_state: powerState,
          is_online: powerState === 'ONLINE',
          stats: {
            total_roster: processedMissionaries.length,
            due_today: dueTodayCount,
            sent_today: sentTodayCount,
            upcoming_7d: upcoming7dCount,
            upcoming_30d: upcoming30dCount,
            completed: completedCount,
            elders_due_today: eldersDueToday,
            sisters_due_today: sistersDueToday,
            cron_limit_per_run: 45
          },
          forecast_by_date: forecastByDate,
          missionaries: processedMissionaries
        };
      }, 30000, ["missionaries", "drips"]);

      return {
        status: 200,
        json: payload
      };
    } catch (err) {
      console.error("Error in get_pending_emails:", err);
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "preview_pending_email" || action === "preview_email" || action === "preview_drip" || action === "get_email_preview" || action === "render_preview") {
    try {
      const phtNow = new Date(Date.now() + 8 * 3600 * 1000);
      const currentCalMonth = phtNow.getMonth() + 1; // e.g. 9 for September
      const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
      const customMonth = Number(bodyData.month || req.query?.month);
      
      let recipientName = "Elder / Sister";
      let tenureMonth = 1;
      let monthToRender = customMonth || currentCalMonth;
      let userPoints = 2;
      let displayLabel = "";

      if (email) {
        const mRows = await runSql("SELECT name, cohort, batch_month, months_sent, max_months, points, next_send_date FROM missionaries WHERE LOWER(email) = ?", [email]).catch(() => []);
        if (mRows && mRows.length > 0) {
          const m = mRows[0];
          const isSister = (m.cohort || '').toLowerCase().includes('sister');
          const maxMonths = Number(m.max_months) || (isSister ? 18 : 24);
          recipientName = m.name || (isSister ? 'Sister' : 'Elder');
          userPoints = m.points || 2;
          
          const upcoming = getUpcomingDripInfo(m.batch_month || 'August 2026', m.months_sent, maxMonths, phtNow);
          if (upcoming) {
            tenureMonth = upcoming.tenureMonth;
            if (!customMonth) {
              monthToRender = upcoming.monthNum;
            }
            displayLabel = upcoming.displayLabel;
          } else {
            tenureMonth = (Number(m.months_sent) || 0) + 1;
            displayLabel = `${getCalendarMonthLabel(monthToRender)} (M${tenureMonth})`;
          }
        }
      }

      const [promoRows, rewardProducts, dripRows, configRows, rewardsVisibleRows] = await Promise.all([
        runSql("SELECT code, points, max_users, claimed_count FROM promo_codes WHERE claimed_count < max_users ORDER BY created_at DESC LIMIT 1").catch(() => []),
        runSql("SELECT name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC").catch(() => []),
        runSql("SELECT * FROM drip_messages WHERE month = ? LIMIT 1", [monthToRender]).catch(() => []),
        runSql("SELECT value FROM system_settings WHERE key = ?", [`drip_${monthToRender}_highlight_meta`]).catch(() => []),
        runSql("SELECT value FROM system_settings WHERE key = 'drip_rewards_visible'").catch(() => [])
      ]);

      let dripData = {
        month: monthToRender,
        name: recipientName,
        points: userPoints
      };

      if (dripRows && dripRows.length > 0) {
        dripData = { ...dripData, ...dripRows[0] };
      }

      if (rewardsVisibleRows && rewardsVisibleRows.length > 0) {
        dripData.show_rewards_category = rewardsVisibleRows[0].value !== 'false';
      }

      if (configRows && configRows.length > 0) {
        try {
          const meta = JSON.parse(configRows[0].value);
          if (meta.sold_1) dripData.highlight_sold_1 = meta.sold_1;
          if (meta.label_2) dripData.highlight_label_2 = meta.label_2;
          if (meta.img_2) dripData.highlight_img_2 = meta.img_2;
          if (meta.sold_2) dripData.highlight_sold_2 = meta.sold_2;
        } catch (_) {}
      }

      const activePromo = (promoRows && promoRows.length > 0) ? promoRows[0] : null;
      const renderedHtml = renderEmailTemplate("monthly_drip", {
        dripData,
        rewardProducts: rewardProducts || [],
        activePromo
      });

      const monthLabel = getCalendarMonthLabel(monthToRender);
      const subject = (dripData.subject && dripData.subject.trim())
        ? dripData.subject.replace(/{{MONTH}}/gi, monthLabel).replace(/{{NAME}}/gi, recipientName)
        : `Monthly Encouragement (${monthLabel}) • Timeless Creations`;

      return {
        status: 200,
        json: {
          ok: true,
          email,
          month: monthToRender,
          tenure_month: tenureMonth,
          display_label: displayLabel || `${monthLabel} (M${tenureMonth})`,
          recipient_name: recipientName,
          subject,
          html: renderedHtml,
          html_content: renderedHtml
        }
      };
    } catch (err) {
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "dispatch_single_pending") {
    try {
      const phtNow = new Date(Date.now() + 8 * 3600 * 1000);
      const currentCalMonth = phtNow.getMonth() + 1; // 9 for September
      const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
      if (!email) return { status: 400, json: { ok: false, error: "Missing missionary email" } };

      const mRows = await runSql("SELECT email, name, cohort, batch_month, months_sent, max_months FROM missionaries WHERE LOWER(email) = ?", [email]);
      if (!mRows || mRows.length === 0) {
        return { status: 404, json: { ok: false, error: `Missionary with email '${email}' not found` } };
      }

      const m = mRows[0];
      const isSister = (m.cohort || '').toLowerCase().includes('sister');
      const maxMonths = Number(m.max_months) || (isSister ? 18 : 24);
      const recipientName = m.name || (isSister ? 'Sister' : 'Elder');
      const upcoming = getUpcomingDripInfo(m.batch_month || 'August 2026', m.months_sent, maxMonths, phtNow);

      const targetCalMonth = Number(bodyData.month || req.query?.month) || (upcoming ? upcoming.monthNum : currentCalMonth);
      const tenureMonth = upcoming ? upcoming.tenureMonth : ((Number(m.months_sent) || 0) + 1);

      const result = await sendDripEmail(m.email, targetCalMonth, recipientName);

      if (result?.ok) {
        // Fast-forward months_sent to match tenure month to skip any backlogged missed months
        const newMonthsSent = Math.max((Number(m.months_sent) || 0) + 1, tenureMonth);
        await runSql(`
          UPDATE missionaries 
          SET months_sent = ?,
              last_sent_at = CURRENT_TIMESTAMP,
              next_send_date = date('now', '+1 month')
          WHERE LOWER(email) = LOWER(?)
        `, [newMonthsSent, m.email]);

        const calLabel = getCalendarMonthLabel(targetCalMonth);
        await runSql(`
          INSERT INTO system_logs (level, message, created_at)
          VALUES ('DISPATCH', ?, CURRENT_TIMESTAMP)
        `, [`[MANUAL_DISPATCH] ${calLabel} (M${tenureMonth}) sent to ${m.name} (${m.email})`]);

        cache.invalidateTag("missionaries");

        return {
          status: 200,
          json: {
            ok: true,
            email: m.email,
            name: m.name,
            month_sent: targetCalMonth,
            tenure_month: tenureMonth,
            message: `Successfully dispatched ${calLabel} (M${tenureMonth}) email to ${m.name}!`,
            details: result
          }
        };
      }

      return {
        status: 500,
        json: {
          ok: false,
          error: result?.error || "Brevo email API rejected dispatch.",
          details: result
        }
      };
    } catch (err) {
      console.error("Error in dispatch_single_pending:", err);
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "reschedule_missionary_email") {
    try {
      const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
      const nextSendDate = (bodyData.next_send_date || req.query?.next_send_date || "").trim();

      if (!email) return { status: 400, json: { ok: false, error: "Missing missionary email" } };
      if (!nextSendDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextSendDate)) {
        return { status: 400, json: { ok: false, error: "Invalid next_send_date format. Expected YYYY-MM-DD." } };
      }

      await runSql("UPDATE missionaries SET next_send_date = ? WHERE LOWER(email) = ?", [nextSendDate, email]);
      await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Rescheduled next email for ${email} to ${nextSendDate}`]);

      cache.invalidateTag("missionaries");

      return {
        status: 200,
        json: {
          ok: true,
          email,
          next_send_date: nextSendDate,
          message: `Successfully rescheduled next email for ${email} to ${nextSendDate}`
        }
      };
    } catch (err) {
      console.error("Error in reschedule_missionary_email:", err);
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "trigger_cron_dispatch") {
    try {
      const powerState = await resolvePowerState();
      if (powerState === "OFFLINE") {
        return { status: 200, json: { ok: false, is_offline: true, message: "System is OFFLINE. Batch dispatches are paused in Settings." } };
      }

      const phtNow = new Date(Date.now() + 8 * 3600 * 1000);
      const todayPhtIso = phtNow.toISOString().slice(0, 10);

      // Cap at 45 total (23 Elders + 22 Sisters)
      const [rawElders, rawSisters] = await Promise.all([
        runSql(`
          SELECT email, name, cohort, batch_month, months_sent, max_months, last_sent_at, next_send_date
          FROM missionaries 
          WHERE status = 'active'
            AND LOWER(cohort) = 'elder'
            AND months_sent < max_months
            AND (last_sent_at IS NULL OR substr(last_sent_at, 1, 7) < strftime('%Y-%m', date('now', '+8 hours')))
            AND (next_send_date <= date('now', '+8 hours') OR next_send_date IS NULL)
          ORDER BY 
            CASE WHEN next_send_date IS NOT NULL AND next_send_date <= date('now', '+8 hours') THEN 0 ELSE 1 END ASC,
            next_send_date ASC,
            CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
            last_sent_at ASC,
            ROWID ASC
          LIMIT 50
        `).catch(() => []),
        runSql(`
          SELECT email, name, cohort, batch_month, months_sent, max_months, last_sent_at, next_send_date
          FROM missionaries 
          WHERE status = 'active'
            AND LOWER(cohort) = 'sister'
            AND months_sent < max_months
            AND (last_sent_at IS NULL OR substr(last_sent_at, 1, 7) < strftime('%Y-%m', date('now', '+8 hours')))
            AND (next_send_date <= date('now', '+8 hours') OR next_send_date IS NULL)
          ORDER BY 
            CASE WHEN next_send_date IS NOT NULL AND next_send_date <= date('now', '+8 hours') THEN 0 ELSE 1 END ASC,
            next_send_date ASC,
            CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
            last_sent_at ASC,
            ROWID ASC
          LIMIT 50
        `).catch(() => [])
      ]);

      const dueElders = (rawElders || []).filter(m => isMissionaryEligibleForDispatch(m, phtNow, todayPhtIso)).slice(0, 23);
      const dueSisters = (rawSisters || []).filter(m => isMissionaryEligibleForDispatch(m, phtNow, todayPhtIso)).slice(0, 22);
      const dueMissionaries = [...dueElders, ...dueSisters].slice(0, 45);

      if (!dueMissionaries || dueMissionaries.length === 0) {
        return { status: 200, json: { ok: true, sentCount: 0, message: "All missionaries are currently up-to-date. No pending emails due right now." } };
      }

      let sentCount = 0;
      const errors = [];
      const dispatchedList = [];
      const CONCURRENCY_CHUNK_SIZE = 5; // Dispatches 5 in parallel to finish all 45 in ~2.5s

      for (let i = 0; i < dueMissionaries.length; i += CONCURRENCY_CHUNK_SIZE) {
        const chunk = dueMissionaries.slice(i, i + CONCURRENCY_CHUNK_SIZE);
        await Promise.all(chunk.map(async (m) => {
          const emailKey = (m.email || '').toLowerCase().trim();
          if (!emailKey || inFlightBatchDispatches.has(emailKey)) return;
          inFlightBatchDispatches.add(emailKey);

          try {
            // Idempotency: verify missionary was not already dispatched today
            const recentSent = await runSql(`
              SELECT email FROM missionaries 
              WHERE LOWER(email) = ? 
                AND last_sent_at IS NOT NULL 
                AND substr(last_sent_at, 1, 10) = ?
            `, [emailKey, todayPhtIso]).catch(() => []);

            if (recentSent && recentSent.length > 0) {
              return; // Already dispatched today, idempotent skip
            }

            const isSister = (m.cohort || '').toLowerCase().includes('sister');
            const maxMonths = Number(m.max_months) || (isSister ? 18 : 24);
            const recipientName = m.name || (isSister ? 'Sister' : 'Elder');
            const upcoming = getUpcomingDripInfo(m.batch_month || 'August 2026', m.months_sent, maxMonths, phtNow);
            const targetCalMonth = upcoming ? upcoming.monthNum : (phtNow.getMonth() + 1);
            const tenureMonth = upcoming ? upcoming.tenureMonth : ((Number(m.months_sent) || 0) + 1);

            const result = await sendDripEmail(m.email, targetCalMonth, recipientName);

            if (result?.ok) {
              const newMonthsSent = Math.max((Number(m.months_sent) || 0) + 1, tenureMonth);
              await runSql(`
                UPDATE missionaries 
                SET months_sent = ?,
                    last_sent_at = CURRENT_TIMESTAMP,
                    next_send_date = date('now', '+1 month')
                WHERE LOWER(email) = LOWER(?)
              `, [newMonthsSent, m.email]);

              const calLabel = getCalendarMonthLabel(targetCalMonth);
              await runSql(`
                INSERT INTO system_logs (level, message, created_at)
                VALUES ('DISPATCH', ?, CURRENT_TIMESTAMP)
              `, [`[BATCH_DISPATCH] ${calLabel} (M${tenureMonth}) sent to ${m.name} (${m.email})`]);

              sentCount++;
              dispatchedList.push({ email: m.email, name: m.name, month: targetCalMonth, tenure: tenureMonth });
            } else {
              errors.push(`Brevo rejected email for ${m.email}: ${result?.error || 'Unknown error'}`);
            }
          } catch (err) {
            errors.push(`Failed for ${m.email}: ${err.message}`);
          } finally {
            inFlightBatchDispatches.delete(emailKey);
          }
        }));
      }

      cache.invalidateTag("missionaries");

      return {
        status: 200,
        json: {
          ok: true,
          sentCount,
          cappedLimit: 45,
          eldersProcessed: dueElders?.length || 0,
          sistersProcessed: dueSisters?.length || 0,
          dispatchedList,
          errors: errors.length > 0 ? errors : undefined,
          message: `Successfully processed batch dispatch: ${sentCount} emails sent (capped at 45).`
        }
      };
    } catch (err) {
      console.error("Error in trigger_cron_dispatch:", err);
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "brevo_webhook") {
    try {
      const rawEvents = Array.isArray(bodyData) ? bodyData : (bodyData.event ? [bodyData] : (bodyData.events || [bodyData]));
      let processed = 0;

      for (const ev of rawEvents) {
        const email = (ev.email || ev.recipient || "").toLowerCase().trim();
        const eventType = (ev.event || "").toLowerCase().trim();

        if (!email || !eventType) continue;

        if (["hard_bounce", "soft_bounce", "blocked", "invalid_email"].includes(eventType)) {
          await runSql("UPDATE missionaries SET status = 'bounced' WHERE LOWER(email) = ?", [email]);
          await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('WARN', ?, CURRENT_TIMESTAMP)", [
            `[BREVO_WEBHOOK] Missionary email bounced (${eventType}): ${email}`
          ]);
          processed++;
        } else if (["unsubscribe", "unsubscribed", "opt_out"].includes(eventType)) {
          await runSql("UPDATE missionaries SET status = 'unsubscribed' WHERE LOWER(email) = ?", [email]);
          await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('WARN', ?, CURRENT_TIMESTAMP)", [
            `[BREVO_WEBHOOK] Missionary unsubscribed: ${email}`
          ]);
          processed++;
        } else if (["spam", "complaint"].includes(eventType)) {
          await runSql("UPDATE missionaries SET status = 'spam' WHERE LOWER(email) = ?", [email]);
          await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('WARN', ?, CURRENT_TIMESTAMP)", [
            `[BREVO_WEBHOOK] Missionary complaint/spam: ${email}`
          ]);
          processed++;
        }
      }

      if (processed > 0) {
        cache.invalidateTag("missionaries");
      }

      return { status: 200, json: { ok: true, processed } };
    } catch (err) {
      console.error("Error in brevo_webhook:", err);
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  return null;
}

