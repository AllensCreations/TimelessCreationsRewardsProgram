import { runSql } from '../db.js';
import { cache } from '../cache.js';

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

    const isSister = (cohort || '').toLowerCase().includes('sister') || (name || '').toLowerCase().startsWith('sister');
    const maxMonths = isSister ? 18 : 24;

    await runSql(`
      UPDATE missionaries 
      SET email = ?, name = ?, cohort = ?, batch_month = ?, points = ?, status = ?, referral_code = ?, max_months = ?
      WHERE LOWER(email) = ?
    `, [newEmail, name || '', isSister ? 'sister' : 'elder', batch_month || 'August 2026', Number(points) || 0, status || 'active', referral_code || '', maxMonths, targetEmail]);

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
            SELECT email, name, last_name, first_name, full_name, cohort, batch_month, referral_code, points, status, is_prelisted, ROWID
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
        const email = (item.email || "").toLowerCase().trim();
        const titleName = (item.title_name || item.name || "").trim();
        const firstName = (item.first_name || "").trim();
        const batchMonth = (item.batch || "August 2026").trim();

        if (!email || !titleName) continue;

        let cohort = "elder";
        let maxMonths = 24;
        if (/^sister\b/i.test(titleName)) {
          cohort = "sister";
          maxMonths = 18;
        }

        const lastName = titleName.replace(/^(elder|sister)\s+/i, "").trim();
        const fullName = `${titleName} ${firstName}`.trim();

        const existing = (await runSql("SELECT email FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
        if (existing) {
          await runSql(
            "UPDATE missionaries SET name = ?, last_name = ?, first_name = ?, full_name = ?, cohort = ?, batch_month = ?, max_months = ?, is_prelisted = 1 WHERE LOWER(email) = ?",
            [titleName, lastName, firstName, fullName, cohort, batchMonth, maxMonths, email]
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
          "INSERT INTO missionaries (email, name, last_name, first_name, full_name, cohort, batch_month, referral_code, max_months, points, status, is_prelisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 1)",
          [email, titleName, lastName, firstName, fullName, cohort, batchMonth, refCode, maxMonths]
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
