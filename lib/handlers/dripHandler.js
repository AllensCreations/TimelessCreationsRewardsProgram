import { runSql } from '../db.js';
import { formatMetricK as formatK, loadTemplateFile } from '../mailer.js';

export async function handleDripAction(action, req, bodyData) {
  if (action === "get_master_template" || action === "get_drip_template") {
    const template = loadTemplateFile('monthly-drip.html') || "";
    return { status: 200, json: { ok: true, template } };
  }

  if (action === "get_drips") {
    const drips = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");
    const configRows = await runSql("SELECT key, value FROM system_settings WHERE key LIKE 'drip_%_highlight_meta'");
    const essGridRows = await runSql("SELECT key, value FROM system_settings WHERE key LIKE 'drip_%_essentials_grid'").catch(() => []);
    const metaMap = {};
    const essGridMap = {};
    
    (configRows || []).forEach(r => {
      try { metaMap[r.key] = JSON.parse(r.value); } catch(_) {}
    });
    (essGridRows || []).forEach(r => {
      try { essGridMap[r.key] = JSON.parse(r.value); } catch(_) {}
    });

    const mergedDrips = (drips || []).map(d => {
      const meta = metaMap[`drip_${d.month}_highlight_meta`] || {};
      const eg = essGridMap[`drip_${d.month}_essentials_grid`] || {};
      return {
        ...d,
        highlight_sold_1: meta.sold_1 || "",
        highlight_label_2: meta.label_2 || "",
        highlight_img_2: meta.img_2 || "",
        highlight_sold_2: meta.sold_2 || "",
        ess1_name: eg.ess1_name || "",
        ess1_img: eg.ess1_img || "",
        ess2_name: eg.ess2_name || "",
        ess2_img: eg.ess2_img || "",
        grid1: eg.grid1 || "",
        grid2: eg.grid2 || "",
        grid3: eg.grid3 || "",
        grid4: eg.grid4 || "",
        grid5: eg.grid5 || "",
        grid6: eg.grid6 || "",
        grid7: eg.grid7 || "",
        grid8: eg.grid8 || "",
        grid9: eg.grid9 || ""
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
        INSERT INTO system_settings (key, value) 
        VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [metaKey, metaVal]).catch(async () => {
        await runSql("UPDATE system_settings SET value = ? WHERE key = ?", [metaVal, metaKey]).catch(() => {});
      });
    }

    return { status: 200, json: { ok: true, message: "Applied top sellers across all 24 months!" } };
  }

  if (action === "apply_featured_and_rewards_to_months") {
    const {
      months = [],
      p1Name, p1Img, p1Sold,
      p2Name, p2Img, p2Sold,
      enabled = true,
      drip_rewards_visible
    } = bodyData;

    const targetMonths = Array.isArray(months) && months.length > 0
      ? months.map(Number)
      : Array.from({ length: 24 }, (_, i) => i + 1);

    const isEnabled = enabled !== false;
    const finalLabel1 = isEnabled ? (p1Name || '') : '__DISABLED__';

    for (const m of targetMonths) {
      await runSql(`
        UPDATE drip_messages 
        SET highlight_label = ?, highlight_img = ? 
        WHERE month = ?
      `, [finalLabel1, p1Img || '', m]);

      const metaKey = `drip_${m}_highlight_meta`;
      const metaVal = JSON.stringify({
        sold_1: formatK(p1Sold),
        label_2: isEnabled ? (p2Name || '') : '',
        img_2: p2Img || '',
        sold_2: formatK(p2Sold),
        enabled: isEnabled,
        drip_rewards_visible: drip_rewards_visible !== undefined ? Boolean(drip_rewards_visible) : true
      });

      await runSql(`
        INSERT INTO system_settings (key, value) 
        VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [metaKey, metaVal]).catch(async () => {
        await runSql("UPDATE system_settings SET value = ? WHERE key = ?", [metaVal, metaKey]).catch(() => {});
      });
    }

    if (drip_rewards_visible !== undefined) {
      const visVal = String(Boolean(drip_rewards_visible));
      await runSql(`
        INSERT INTO system_settings (key, value)
        VALUES ('drip_rewards_visible', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [visVal]).catch(async () => {
        await runSql("UPDATE system_settings SET value = ? WHERE key = 'drip_rewards_visible'", [visVal]).catch(() => {});
      });
    }

    return {
      status: 200,
      json: {
        ok: true,
        count: targetMonths.length,
        message: `Applied featured products and rewards to ${targetMonths.length} month(s)!`
      }
    };
  }

  if (action === "apply_essentials_grid_all_months") {
    const {
      ess1_name, ess1_img, ess2_name, ess2_img,
      grid1, grid2, grid3, grid4, grid5, grid6, grid7, grid8, grid9
    } = bodyData;

    const egVal = JSON.stringify({
      ess1_name: ess1_name || "Wooden Nametag",
      ess1_img: ess1_img || "",
      ess2_name: ess2_name || "POS Kit",
      ess2_img: ess2_img || "",
      grid1: grid1 || "",
      grid2: grid2 || "",
      grid3: grid3 || "",
      grid4: grid4 || "",
      grid5: grid5 || "",
      grid6: grid6 || "",
      grid7: grid7 || "",
      grid8: grid8 || "",
      grid9: grid9 || ""
    });

    for (let m = 1; m <= 24; m++) {
      const egKey = `drip_${m}_essentials_grid`;
      await runSql(`
        INSERT INTO system_settings (key, value) 
        VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [egKey, egVal]).catch(async () => {
        await runSql("UPDATE system_settings SET value = ? WHERE key = ?", [egVal, egKey]).catch(() => {});
      });
    }

    return { status: 200, json: { ok: true, message: "Applied Essentials and Grid across all 24 months!" } };
  }

  if (action === "save_drip") {
    const { 
      month, subject, theme, scripture, message, 
      highlight_img, highlight_label, highlight_sold_1,
      highlight_img_2, highlight_label_2, highlight_sold_2, 
      custom_html,
      ess1_name, ess1_img, ess2_name, ess2_img,
      grid1, grid2, grid3, grid4, grid5, grid6, grid7, grid8, grid9
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
      INSERT INTO system_settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [metaKey, metaVal]).catch(async () => {
      await runSql("UPDATE system_settings SET value = ? WHERE key = ?", [metaVal, metaKey]).catch(() => {});
    });

    if (ess1_name !== undefined || ess1_img !== undefined || grid1 !== undefined) {
      const egKey = `drip_${month}_essentials_grid`;
      const egVal = JSON.stringify({
        ess1_name: ess1_name || "Wooden Nametag",
        ess1_img: ess1_img || "",
        ess2_name: ess2_name || "POS Kit",
        ess2_img: ess2_img || "",
        grid1: grid1 || "",
        grid2: grid2 || "",
        grid3: grid3 || "",
        grid4: grid4 || "",
        grid5: grid5 || "",
        grid6: grid6 || "",
        grid7: grid7 || "",
        grid8: grid8 || "",
        grid9: grid9 || ""
      });
      await runSql(`
        INSERT INTO system_settings (key, value) 
        VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [egKey, egVal]).catch(async () => {
        await runSql("UPDATE system_settings SET value = ? WHERE key = ?", [egVal, egKey]).catch(() => {});
      });
    }

    return { status: 200, json: { ok: true } };
  }

  return null;
}
