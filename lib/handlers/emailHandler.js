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
          const nextMonthNum = isCompleted ? null : (monthsSent + 1);

          let nextDripInfo = null;
          if (nextMonthNum) {
            const mappedMonth = ((nextMonthNum - 1) % 24) + 1;
            const dripRow = dripMap[mappedMonth] || {};
            const monthLabel = getCalendarMonthLabel(mappedMonth);
            const rawSubject = dripRow.subject || `Monthly Encouragement ({{MONTH}}) • Timeless Creations`;
            const subject = rawSubject.replace(/{{MONTH}}/gi, monthLabel).replace(/{{NAME}}/gi, m.name || 'Missionary');

            nextDripInfo = {
              month_num: nextMonthNum,
              calendar_month_label: monthLabel,
              subject: subject,
              theme: dripRow.theme || 'Missionary Focus & Encouragement',
              scripture: dripRow.scripture || 'Trust in the Lord with all thine heart.',
              message_preview: dripRow.message ? dripRow.message.slice(0, 100) + '...' : '',
              highlight_label: dripRow.highlight_label || '',
              highlight_img: dripRow.highlight_img || ''
            };
          }

          const lastSentAt = m.last_sent_at || null;
          const sentToday = !!(lastSentAt && lastSentAt.slice(0, 10) === todayPhtIso);

          let estimatedNextDate = m.next_send_date ? m.next_send_date.slice(0, 10) : null;
          if (!estimatedNextDate) {
            if (!lastSentAt) {
              estimatedNextDate = todayPhtIso;
            } else {
              try {
                const lastD = new Date(lastSentAt);
                lastD.setMonth(lastD.getMonth() + 1);
                estimatedNextDate = lastD.toISOString().slice(0, 10);
              } catch (_) {
                estimatedNextDate = todayPhtIso;
              }
            }
          }

          let daysUntilNext = 0;
          try {
            const targetTime = new Date(estimatedNextDate + 'T00:00:00Z').getTime();
            const todayTime = new Date(todayPhtIso + 'T00:00:00Z').getTime();
            daysUntilNext = Math.round((targetTime - todayTime) / (1000 * 3600 * 24));
          } catch (_) {
            daysUntilNext = 0;
          }

          let scheduleStatus = 'UPCOMING_30D';
          const isActive = (m.status || 'active').toLowerCase() === 'active';

          if (!isActive) {
            scheduleStatus = 'PAUSED';
          } else if (isCompleted) {
            scheduleStatus = 'COMPLETED';
            completedCount++;
          } else if (sentToday) {
            scheduleStatus = 'SENT_TODAY';
            sentTodayCount++;
          } else if (daysUntilNext <= 0 || !m.next_send_date || !lastSentAt) {
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
            cron_limit_per_run: 56
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

  if (action === "preview_pending_email") {
    try {
      const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
      const customMonth = Number(bodyData.month || req.query?.month);
      
      let recipientName = "Elder / Sister";
      let monthToRender = customMonth || (new Date().getMonth() + 1);
      let userPoints = 2;

      if (email) {
        const mRows = await runSql("SELECT name, cohort, months_sent, max_months, points FROM missionaries WHERE LOWER(email) = ?", [email]).catch(() => []);
        if (mRows && mRows.length > 0) {
          const m = mRows[0];
          recipientName = m.name || (m.cohort === 'sister' ? 'Sister' : 'Elder');
          userPoints = m.points || 2;
          if (!customMonth) {
            monthToRender = ((Number(m.months_sent) || 0) % 24) + 1;
          }
        }
      }

      const [promoRows, rewardProducts, dripRows, configRows] = await Promise.all([
        runSql("SELECT code, points, max_users, claimed_count FROM promo_codes WHERE claimed_count < max_users ORDER BY created_at DESC LIMIT 1").catch(() => []),
        runSql("SELECT name, CAST(price AS INTEGER) as price, image_url FROM product_catalog WHERE type = 'reward' ORDER BY price ASC").catch(() => []),
        runSql("SELECT * FROM drip_messages WHERE month = ? LIMIT 1", [monthToRender]).catch(() => []),
        runSql("SELECT value FROM system_settings WHERE key = ?", [`drip_${monthToRender}_highlight_meta`]).catch(() => [])
      ]);

      let dripData = {
        month: monthToRender,
        name: recipientName,
        points: userPoints
      };

      if (dripRows && dripRows.length > 0) {
        dripData = { ...dripData, ...dripRows[0] };
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
          recipient_name: recipientName,
          subject,
          html_content: renderedHtml
        }
      };
    } catch (err) {
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "dispatch_single_pending") {
    try {
      const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
      if (!email) return { status: 400, json: { ok: false, error: "Missing missionary email" } };

      const mRows = await runSql("SELECT email, name, cohort, months_sent, max_months FROM missionaries WHERE LOWER(email) = ?", [email]);
      if (!mRows || mRows.length === 0) {
        return { status: 404, json: { ok: false, error: `Missionary with email '${email}' not found` } };
      }

      const m = mRows[0];
      const nextMonthNum = ((Number(m.months_sent) || 0) % 24) + 1;
      const isSister = (m.cohort || '').toLowerCase().includes('sister');
      const recipientName = m.name || (isSister ? 'Sister' : 'Elder');

      const result = await sendDripEmail(m.email, nextMonthNum, recipientName);

      if (result?.ok) {
        await runSql(`
          UPDATE missionaries 
          SET months_sent = months_sent + 1,
              last_sent_at = CURRENT_TIMESTAMP,
              next_send_date = date('now', '+1 month')
          WHERE LOWER(email) = LOWER(?)
        `, [m.email]);

        await runSql(`
          INSERT INTO system_logs (level, message, created_at)
          VALUES ('DISPATCH', ?, CURRENT_TIMESTAMP)
        `, [`[MANUAL_DISPATCH] M${nextMonthNum} (${getCalendarMonthLabel(nextMonthNum)}) sent to ${m.name} (${m.email})`]);

        cache.invalidateTag("missionaries");

        return {
          status: 200,
          json: {
            ok: true,
            email: m.email,
            name: m.name,
            month_sent: nextMonthNum,
            message: `Successfully dispatched Month ${nextMonthNum} email to ${m.name}!`,
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
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  if (action === "trigger_cron_dispatch") {
    try {
      const powerState = await resolvePowerState();
      if (powerState === "OFFLINE") {
        return { status: 200, json: { ok: false, is_offline: true, message: "System is OFFLINE. Batch dispatches are paused in Settings." } };
      }

      const dueElders = await runSql(`
        SELECT email, name, cohort, months_sent, max_months, last_sent_at, next_send_date
        FROM missionaries 
        WHERE status = 'active'
          AND LOWER(cohort) = 'elder'
          AND months_sent < max_months
          AND (next_send_date <= date('now', '+8 hours') OR next_send_date IS NULL OR last_sent_at IS NULL)
        ORDER BY 
          CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
          last_sent_at ASC,
          ROWID ASC
        LIMIT 28
      `).catch(() => []);

      const dueSisters = await runSql(`
        SELECT email, name, cohort, months_sent, max_months, last_sent_at, next_send_date
        FROM missionaries 
        WHERE status = 'active'
          AND LOWER(cohort) = 'sister'
          AND months_sent < max_months
          AND (next_send_date <= date('now', '+8 hours') OR next_send_date IS NULL OR last_sent_at IS NULL)
        ORDER BY 
          CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
          last_sent_at ASC,
          ROWID ASC
        LIMIT 28
      `).catch(() => []);

      const dueMissionaries = [...(dueElders || []), ...(dueSisters || [])];

      if (!dueMissionaries || dueMissionaries.length === 0) {
        return { status: 200, json: { ok: true, sentCount: 0, message: "All missionaries are currently up-to-date. No pending emails due right now." } };
      }

      let sentCount = 0;
      const errors = [];
      const dispatchedList = [];

      for (const m of dueMissionaries) {
        const nextMonthNum = ((Number(m.months_sent) || 0) % 24) + 1;
        const isSister = (m.cohort || '').toLowerCase().includes('sister');
        const recipientName = m.name || (isSister ? 'Sister' : 'Elder');

        try {
          const result = await sendDripEmail(m.email, nextMonthNum, recipientName);

          if (result?.ok) {
            await runSql(`
              UPDATE missionaries 
              SET months_sent = months_sent + 1,
                  last_sent_at = CURRENT_TIMESTAMP,
                  next_send_date = date('now', '+1 month')
              WHERE LOWER(email) = LOWER(?)
            `, [m.email]);

            await runSql(`
              INSERT INTO system_logs (level, message, created_at)
              VALUES ('DISPATCH', ?, CURRENT_TIMESTAMP)
            `, [`[BATCH_DISPATCH] M${nextMonthNum} (${getCalendarMonthLabel(nextMonthNum)}) sent to ${m.name} (${m.email})`]);

            sentCount++;
            dispatchedList.push({ email: m.email, name: m.name, month: nextMonthNum });
          } else {
            errors.push(`Brevo rejected email for ${m.email}: ${result?.error || 'Unknown error'}`);
          }
        } catch (err) {
          errors.push(`Failed for ${m.email}: ${err.message}`);
        }
      }

      cache.invalidateTag("missionaries");

      return {
        status: 200,
        json: {
          ok: true,
          sentCount,
          eldersProcessed: dueElders?.length || 0,
          sistersProcessed: dueSisters?.length || 0,
          dispatchedList,
          errors: errors.length > 0 ? errors : undefined,
          message: `Successfully processed batch dispatch: ${sentCount} emails sent.`
        }
      };
    } catch (err) {
      console.error("Error in trigger_cron_dispatch:", err);
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  return null;
}

