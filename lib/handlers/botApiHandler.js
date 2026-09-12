export async function handleBotApiAction(action, req, bodyData) {
  if (action === "setup_messenger_profile") {
    const pageToken = (process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || "").trim();
    if (!pageToken) return { status: 400, json: { ok: false, error: "Missing PAGE_ACCESS_TOKEN" } };

    const profilePayload = {
      get_started: { payload: "GET_STARTED" },
      greeting: [
        {
          locale: "default",
          text: "Welcome to Timeless Creations Rewards Program (TCRP)! Exclusive rewards & gear for LDS full-time missionaries."
        }
      ],
      persistent_menu: [
        {
          locale: "default",
          composer_input_disabled: false,
          call_to_actions: [
            { type: "postback", title: "Check", payload: "ACTION_CHECK" },
            { type: "postback", title: "Help & FAQs", payload: "MENU_HELP" },
            { type: "postback", title: "Redeem Promo", payload: "PROMO_INFO" }
          ]
        }
      ]
    };

    try {
      const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${pageToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload)
      });
      const fbData = await fbRes.json();
      return { status: 200, json: { ok: !fbData.error, fb_response: fbData } };
    } catch (err) {
      return { status: 500, json: { ok: false, error: err.message } };
    }
  }

  return null;
}
