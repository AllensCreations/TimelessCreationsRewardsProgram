import { runSql } from '../db.js';

export async function handleDripAction(action, req, bodyData) {
  if (action === "get_drips") {
    const drips = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");
    const configRows = await runSql("SELECT key, value FROM system_config WHERE key LIKE 'drip_%_highlight_2'");
    const highlight2Map = {};
    (configRows || []).forEach(r => {
      try { highlight2Map[r.key] = JSON.parse(r.value); } catch(_) {}
    });

    const mergedDrips = (drips || []).map(d => {
      const extra = highlight2Map[`drip_${d.month}_highlight_2`];
      return {
        ...d,
        highlight_label_2: extra?.label || "",
        highlight_img_2: extra?.img || ""
      };
    });

    return { status: 200, json: { ok: true, drips: mergedDrips } };
  }

  if (action === "save_drip") {
    const { month, subject, theme, scripture, message, highlight_img, highlight_label, highlight_img_2, highlight_label_2, custom_html } = bodyData;
    await runSql(`
      INSERT INTO drip_messages (month, subject, theme, scripture, message, highlight_img, highlight_label, custom_html)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET
        subject = excluded.subject,
        theme = excluded.theme,
        scripture = excluded.scripture,
        message = excluded.message,
        highlight_img = excluded.highlight_img,
        highlight_label = excluded.highlight_label,
        custom_html = excluded.custom_html
    `, [
      Number(month) || 1,
      subject || "",
      theme || "",
      scripture || "",
      message || "",
      highlight_img || "",
      highlight_label || "",
      custom_html || ""
    ]);

    if (highlight_label_2) {
      const val = JSON.stringify({ label: highlight_label_2, img: highlight_img_2 || "" });
      await runSql("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [`drip_${month}_highlight_2`, val]);
    } else {
      await runSql("DELETE FROM system_config WHERE key = ?", [`drip_${month}_highlight_2`]);
    }

    return { status: 200, json: { ok: true } };
  }

  return null;
}
