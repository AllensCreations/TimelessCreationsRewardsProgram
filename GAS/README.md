# 📬 TCRP Zero-Code Setup (Google Apps Script Engine)

---

## ⚡ 1-Click Install & Setup (No Code Editing Required!)

You do **not** need to manually edit any code, timers, or handlers inside `Code.gs`.

### 🚀 Option A: Shortcut via Google Apps Script Editor (Fastest)

1. Open [script.google.com](https://script.google.com) and create a **New Project** named `TCRP Mailer`.
2. Copy and paste the contents of [`Code.gs`](./Code.gs) into the editor (replace all existing text).
3. At the top toolbar, select **`INSTALL`** from the function dropdown:
   - Click **"▷ Run"**.
   - Google will show a standard one-time permission popup: Click **Review permissions** ➔ choose your account ➔ **Advanced** ➔ **Go to TCRP Mailer (unsafe)** ➔ **Allow**.
4. **Done! 🎉**
   - Automatically configures the **7:00 AM, 8:00 AM, and 9:00 AM** daily triggers.
   - Automatically verifies your Gmail quota and prepares the engine.

---

### 🌐 Option B: Interactive Web Control Dashboard (Visual UI)

1. In the Apps Script editor, click **Deploy** ➔ **New deployment**.
   - **Type:** Web app
   - **Execute as:** `Me (<your-email>@gmail.com)`
   - **Who has access:** `Anyone`
2. Click **Deploy** and copy the **Web App URL**.
3. Open that Web App URL in any web browser. You will see the **TCRP Control Dashboard**:
   - Live **Gmail Daily Quota meter** (e.g. `100 / 100 remaining`).
   - Enter your **Vercel Backend URL** in the box.
   - Click **"💾 Save & Auto-Activate Daily Triggers"**.
   - You can also test your email delivery instantly using the built-in **"🧪 Dispatch Test Email Now"** form!

---

## 🎯 Architecture Summary

- **Timeout Immunity:** Vercel has a 10-second serverless timeout. By letting Google Apps Script pull the batch (`get_cron_batch` in ~300ms) and report back (`confirm_cron_batch` in ~150ms), Vercel never times out.
- **3-Wave Schedule (80 sends/day total, 20 reserved for OTPs & transactional):**
  - 7:00 AM: Wave 1 (up to 27 due missionaries)
  - 8:00 AM: Wave 2 (up to 27 due missionaries)
  - 9:00 AM: Wave 3 (up to 26 due missionaries)
  - Total batch: **80 emails/day**
  - Reserved quota: **20 emails/day strictly saved** for OTP passcodes, redemption receipts, and other notifications, never exceeding Gmail's 100/day limit.
- **Nearest Estimate Send:** Prioritizes nearest scheduled send date, without rigid cohort splits.
