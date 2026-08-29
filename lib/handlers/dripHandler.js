import { runSql } from '../db.js';

export async function handleDripAction(action, req, bodyData) {
  if (action === "get_drips") {
    const drips = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");
    const configRows = await runSql("SELECT key, value FROM system_config WHERE key LIKE 'drip_%_highlight_meta'");
    const metaMap = {};
    
    (configRows || []).forEach(r => {
      try { metaMap[r.key] = JSON.parse(r.value); } catch(_) {}
    });

    const mergedDrips = (drips || []).map(d => {
      const meta = metaMap[`drip_${d.month}_highlight_meta`] || {};
      return {
        ...d,
        highlight_sold_1: meta.sold_1 || "",
        highlight_label_2: meta.label_2 || "",
        highlight_img_2: meta.img_2 || "",
        highlight_sold_2: meta.sold_2 || ""
      };
    });

    return { status: 200, json: { ok: true, drips: mergedDrips } };
  }

  if (action === "get_top_sales") {
    try {
      const orderSales = await runSql(`
        SELECT item as name, COUNT(*) as count 
        FROM orders 
        WHERE status != 'CANCELLED' 
        GROUP BY item 
        ORDER BY count DESC 
        LIMIT 5
      `);
      return { status: 200, json: { ok: true, topSales: orderSales || [] } };
    } catch (e) {
      return { status: 200, json: { ok: true, topSales: [] } };
    }
  }

  if (action === "save_drip") {
    const { 
      month, subject, theme, scripture, message, 
      highlight_img, highlight_label, highlight_sold_1,
      highlight_img_2, highlight_label_2, highlight_sold_2, 
      custom_html 
    } = bodyData;

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

    const metaKey = `drip_${month}_highlight_meta`;
    const metaVal = JSON.stringify({
      sold_1: highlight_sold_1 || "",
      label_2: highlight_label_2 || "",
      img_2: highlight_img_2 || "",
      sold_2: highlight_sold_2 || ""
    });

    await runSql(`
      INSERT INTO system_config (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [metaKey, metaVal]);

    return { status: 200, json: { ok: true } };
  }

  return null;
}
