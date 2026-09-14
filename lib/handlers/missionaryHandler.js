import { runSql } from '../db.js';
import { cache } from '../cache.js';
import { getFirstDispatchDate } from '../utils/batchCalculator.js';
import { parseMissionaryName } from '../utils/nameParser.js';

export async function handleMissionaryAction(action, req, bodyData) {
  if (action === "get_missionaries") {
    const rows = await cache.getOrSet("missionaries_roster", async () => {
      return (await runSql("SELECT * FROM missionaries ORDER BY is_prelisted DESC, name ASC")) || [];
    }, 30000, ["missionaries"]);
    return { status: 200, json: { ok: true, missionaries: rows } };
  }

  if (action === "update_missionary") {
    const { original_email, email, name, cohort, batch_month, points, status, referral_code } = bodyData;
    const targetEmail = (original_email || email || "").toLowerCase().trim();
    const newEmail = (email || targetEmail).toLowerCase().trim();
    if (!targetEmail) return { status: 400, json: { ok: false, error: "Missing missionary email" } };

    let finalTitleName = (name || "").trim();
    let finalLastName = "";
    let finalFirstName = "";

    const parsed = parseMissionaryName(finalTitleName);
    let finalCohort = (cohort || "").toLowerCase();
    if (parsed.valid) {
      finalTitleName = parsed.name; // Title & Name (e.g. 'Elder Dela Cruz')
      finalLastName = parsed.lastName;
      finalFirstName = parsed.firstName;
      finalCohort = parsed.cohort;
    } else if (!finalCohort) {
      finalCohort = /^sister\b/i.test(finalTitleName) ? "sister" : "elder";
    }

    const isSister = finalCohort.includes("sister");
    const maxMonths = isSister ? 18 : 24;
    const finalBatch = batch_month || 'August 2026';
    const initialSendDate = getFirstDispatchDate(finalBatch);

    await runSql(`
      UPDATE missionaries 
      SET email = ?, 
          name = ?, 
          last_name = CASE WHEN ? != '' THEN ? ELSE last_name END,
          first_name = CASE WHEN ? != '' THEN ? ELSE first_name END,
          cohort = ?, 
          batch_month = ?, 
          points = ?, 
          status = ?, 
          referral_code = ?, 
          max_months = ?
      WHERE LOWER(email) = ?
    `, [newEmail, finalTitleName, finalLastName, finalLastName, finalFirstName, finalFirstName, isSister ? 'sister' : 'elder', finalBatch, Number(points) || 0, status || 'active', referral_code || '', maxMonths, targetEmail]);

    // Keep next_send_date aligned with cohort if not yet dispatched
    await runSql(`
      UPDATE missionaries 
      SET next_send_date = ? 
      WHERE LOWER(email) = ? 
        AND (months_sent = 0 OR months_sent IS NULL) 
        AND last_sent_at IS NULL
    `, [initialSendDate, newEmail]).catch(() => {});

    await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Updated profile for ${newEmail}`]);
    cache.invalidateTag("missionaries");
    return { status: 200, json: { ok: true } };
  }

  if (action === "update_missionary_points") {
    const email = (bodyData.email || "").toLowerCase().trim();
    const delta = Number(bodyData.delta) || 0;
    if (!email) return { status: 400, json: { ok: false, error: "Missing email address" } };

    await runSql("UPDATE missionaries SET points = MAX(0, points + ?) WHERE LOWER(email) = ?", [delta, email]);
    await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Updated points for ${email} by delta ${delta}`]);
    cache.invalidateTag("missionaries");
    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_missionary") {
    const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
    if (!email) return { status: 400, json: { ok: false, error: "Missing missionary email address" } };

    const missionary = (await runSql("SELECT psid FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
    if (missionary?.psid) {
      await runSql("DELETE FROM sessions WHERE psid = ?", [missionary.psid]);
    }
    await runSql("DELETE FROM missionaries WHERE LOWER(email) = ?", [email]);
    await runSql("INSERT INTO system_logs (level, message) VALUES ('WARN', ?)", [`Removed missionary ${email} from roster`]);
    cache.invalidateTag("missionaries");

    return { status: 200, json: { ok: true, message: `Successfully deleted missionary ${email}` } };
  }

  if (action === "push_missionaries" || action === "get_push_history") {
    if (req.method === "GET" || action === "get_push_history") {
      const limit = Math.min(Number(req.query?.limit || bodyData.limit) || 50, 150);
      const cacheKey = `push_history_${limit}`;
      const payload = await cache.getOrSet(cacheKey, async () => {
        const [history, statsRow] = await Promise.all([
          runSql(`
            SELECT email, name, last_name, first_name, cohort, batch_month, referral_code, points, status, is_prelisted, ROWID
            FROM missionaries 
            ORDER BY ROWID DESC 
            LIMIT ?
          `, [limit]).catch(() => []),
          runSql(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN LOWER(cohort) = 'elder' THEN 1 ELSE 0 END) as elders,
              SUM(CASE WHEN LOWER(cohort) = 'sister' THEN 1 ELSE 0 END) as sisters
            FROM missionaries
          `).catch(() => [{ total: 0, elders: 0, sisters: 0 }])
        ]);

        const counts = statsRow?.[0] || { total: 0, elders: 0, sisters: 0 };
        return {
          history: history || [],
          total: Number(counts.total) || 0,
          elders: Number(counts.elders) || 0,
          sisters: Number(counts.sisters) || 0
        };
      }, 20000, ["missionaries"]);

      return { 
        status: 200, 
        json: { 
          ok: true, 
          ...payload
        } 
      };
    }

    if (req.method === "POST") {
      const entries = bodyData.entries || [];
      let added = 0;

      for (const item of entries) {
        const rawTitleName = (item.title_name || item.name || "").trim();
        const rawFirstName = (item.first_name || "").trim();
        const combined = rawFirstName ? `${rawTitleName} ${rawFirstName}` : rawTitleName;

        const parsed = parseMissionaryName(combined);

        let titleName = rawTitleName;
        let firstName = rawFirstName;
        let lastName = rawTitleName.replace(/^(elder|sister)\s+/i, '').trim();
        let cohort = /^sister\b/i.test(rawTitleName) ? "sister" : "elder";
        let maxMonths = cohort === "sister" ? 18 : 24;

        if (parsed.valid) {
          titleName = parsed.name;       // "Title & Name" (e.g. "Elder Dela Cruz")
          firstName = parsed.firstName;  // e.g. "Charlie"
          lastName = parsed.lastName;    // e.g. "Dela Cruz"
          cohort = parsed.cohort;
          maxMonths = parsed.maxMonths;
        }

        const email = (item.email || (parsed.valid ? parsed.email : '')).toLowerCase().trim();
        const batchMonth = (item.batch || "August 2026").trim();

        if (!email || !titleName) continue;

        const initialSendDate = getFirstDispatchDate(batchMonth);

        const existing = (await runSql("SELECT email FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
        if (existing) {
          await runSql(
            "UPDATE missionaries SET name = ?, last_name = ?, first_name = ?, cohort = ?, batch_month = ?, max_months = ?, is_prelisted = 1, next_send_date = CASE WHEN (months_sent = 0 OR months_sent IS NULL) AND last_sent_at IS NULL THEN ? ELSE next_send_date END WHERE LOWER(email) = ?",
            [titleName, lastName, firstName, cohort, batchMonth, maxMonths, initialSendDate, email]
          );
          added++;
          continue;
        }

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const nums = "23456789";
        let refCode = "";
        for (let i = 0; i < 3; i++) {
          refCode += chars.charAt(Math.floor(Math.random() * chars.length));
          refCode += nums.charAt(Math.floor(Math.random() * nums.length));
        }

        await runSql(
          "INSERT INTO missionaries (email, name, last_name, first_name, cohort, batch_month, referral_code, max_months, points, status, is_prelisted, next_send_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 1, ?)",
          [email, titleName, lastName, firstName, cohort, batchMonth, refCode, maxMonths, initialSendDate]
        );
        added++;
      }

      await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Successfully bulk pushed ${added} missionaries`]);
      cache.invalidateTag("missionaries");
      return { status: 200, json: { ok: true, added } };
    }
  }

  return null;
}
