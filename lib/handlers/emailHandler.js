import { runSql } from '../db.js';
import { 
  sendDripEmail, 
  sendOTPEmail, 
  sendReceiptEmail, 
  sendThankYouEmail, 
  sendDeliveredEmail, 
  renderEmailTemplate, 
  sendEmail 
} from '../mailer.js';

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

  return null;
}
