import { runSql } from '../db.js';

export async function handlePromoAction(action, req, bodyData) {
  if (action === "get_promo_codes") {
    const rows = await runSql("SELECT * FROM promo_codes ORDER BY created_at DESC");
    return { status: 200, json: { ok: true, promo_codes: rows || [] } };
  }

  if (action === "save_promo_code") {
    const { code, points, max_users } = bodyData;
    const cleanCode = (code || "").trim().toUpperCase();
    const pts = Number(points) || 1;
    const maxUsr = Number(max_users) || 30;

    if (!cleanCode) return { status: 400, json: { ok: false, error: "Missing promo code" } };

    await runSql(`
      INSERT INTO promo_codes (code, points, max_users, claimed_count)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(code) DO UPDATE SET points = excluded.points, max_users = excluded.max_users
    `, [cleanCode, pts, maxUsr]);

    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_promo_code") {
    const { code } = bodyData;
    await runSql("DELETE FROM promo_codes WHERE code = ?", [code]);
    await runSql("DELETE FROM promo_redemptions WHERE code = ?", [code]);
    return { status: 200, json: { ok: true } };
  }

  return null;
}
