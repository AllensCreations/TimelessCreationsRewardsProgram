import { runSql } from '../db.js';
import { formatMetricK as formatK } from '../mailer.js';


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

  if (action === "get_top_sales" || action === "auto_detect_top_products") {
    try {
      const catalog = await runSql("SELECT id, name, price, image_url, type FROM product_catalog ORDER BY id ASC");
      const orders = await runSql("SELECT item, items_json FROM orders WHERE UPPER(status) != 'CANCELLED'");
      const invoices = await runSql("SELECT items_json FROM cash_invoices WHERE UPPER(status) != 'CANCELLED'");
      
      const salesCountMap = {};

      const tally = (name, qty = 1) => {
        if (!name) return;
        const clean = name.replace(/^🎁\s*/, '').replace(/\s*\(Free Reward\)$/i, '').trim();
        salesCountMap[clean] = (salesCountMap[clean] || 0) + (Number(qty) || 1);
      };

      (orders || []).forEach(o => {
        if (o.items_json) {
          try {
            const parsed = JSON.parse(o.items_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed.forEach(p => tally(p.name, p.qty));
              return;
            }
          } catch (_) {}
        }
        if (o.item) tally(o.item, 1);
      });

      (invoices || []).forEach(inv => {
        if (inv.items_json) {
          try {
            const parsed = JSON.parse(inv.items_json);
            if (Array.isArray(parsed)) {
              parsed.forEach(p => tally(p.name, p.qty));
            }
          } catch (_) {}
        }
      });

      const ranked = [];
      (catalog || []).forEach(p => {
        let count = 0;
        for (const [sName, cnt] of Object.entries(salesCountMap)) {
          if (sName.toLowerCase() === p.name.toLowerCase() || sName.toLowerCase().includes(p.name.toLowerCase())) {
            count += cnt;
          }
        }
        if (count > 0) {
          ranked.push({
            name: p.name,
            image_url: p.image_url || "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE",
            count
          });
        }
      });

      ranked.sort((a, b) => b.count - a.count);

      if (ranked.length === 0) {
        return { status: 200, json: { ok: true, totalSales: 0, topSales: [] } };
      }

      const top1 = ranked[0];
      const top2 = ranked[1] || null;

      const topSales = [
        {
          name: top1.name,
          image_url: top1.image_url,
          sold_formatted: formatK(top1.count)
        }
      ];

      if (top2) {
        topSales.push({
          name: top2.name,
          image_url: top2.image_url,
          sold_formatted: formatK(top2.count)
        });
      }

      return { status: 200, json: { ok: true, totalSales: ranked.length, topSales } };
    } catch (e) {
      return { status: 200, json: { ok: true, totalSales: 0, topSales: [] } };
    }
  }

  if (action === "apply_top_sales_all_months") {
    const { p1Name, p1Img, p1Sold, p2Name, p2Img, p2Sold } = bodyData;
    
    for (let m = 1; m <= 24; m++) {
      await runSql(`
        UPDATE drip_messages 
        SET highlight_label = ?, highlight_img = ? 
        WHERE month = ?
      `, [p1Name || '', p1Img || '', m]);

      const metaKey = `drip_${m}_highlight_meta`;
      const metaVal = JSON.stringify({
        sold_1: formatK(p1Sold),
        label_2: p2Name || '',
        img_2: p2Img || '',
        sold_2: formatK(p2Sold)
      });

      await runSql(`
        INSERT INTO system_config (key, value) 
        VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [metaKey, metaVal]);
    }

    return { status: 200, json: { ok: true, message: "Applied top sellers across all 24 months!" } };
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
      sold_1: formatK(highlight_sold_1),
      label_2: highlight_label_2 || "",
      img_2: highlight_img_2 || "",
      sold_2: formatK(highlight_sold_2)
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
