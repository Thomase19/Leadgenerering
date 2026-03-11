# Testing that generated leads appear on the dashboard

Use these steps to verify that leads created in the widget (chat qualification or offline form) show up on the **Leads** page in the dashboard.

---

## 1. Manual end-to-end test (recommended)

### Prerequisites

- App running: `pnpm dev` or `pnpm dev:web`
- You have a user and at least one site (add one via **Sider → Tilføj side** if needed)
- Widget config exists for that site (configure at **Sider → [your site] → Konfigurer**)

### Steps

1. **Get your site ID**
   - Log in to the dashboard: `http://localhost:3000` (or your app URL)
   - Go to **Sider** and open **Konfigurer** for the site you want to use
   - Copy the `siteId` from the install snippet (e.g. `data-site-id="clxxx..."`)

2. **Open the demo page with the widget**
   - In the same browser, open:  
     `http://localhost:3000/demo?siteId=YOUR_SITE_ID`

3. **Generate a lead via chat**
   - Click the chat bubble and send messages until the bot has enough to qualify (score above threshold and at least email or phone).
   - Example: share name, email, and something that triggers intent/urgency so the score passes the lead threshold (e.g. 60).
   - When the conversation qualifies, the backend creates a lead and you should see `[lead]` logs in the terminal where `pnpm dev:web` is running.

4. **Check the dashboard**
   - Go to **Leads** in the dashboard: `http://localhost:3000/leads`
   - Refresh the page.
   - The new lead should appear in the table (contact, side, score, CRM, oprettet).

5. **Optional: test offline lead capture**
   - On the demo page, if the widget shows an offline form (e.g. outside business hours or after a certain flow), fill in name, email or phone, and submit.
   - Check **Leads** again; the new lead should appear.

---

## 2. Using logs to trace the flow

With the `[lead]` logging in place, you can confirm each step in the terminal:

| Log message | Meaning |
|-------------|--------|
| `[lead] widget/message: received` | Widget sent a message; backend is processing. |
| `[lead] qualified in chat` | This message qualified (score + contact). |
| `[lead] created in database` | Lead row was inserted. |
| `[lead] qualified response sent to widget` | Response with `leadId` was returned to the widget. |
| `[lead] dashboard leads page: fetched N leads` | Dashboard loaded; N leads were returned for the tenant. |

**Quick check:** After qualifying in the widget, you should see in order:  
`qualified in chat` → `created in database` (or `lead already exists`) → `qualified response sent to widget`.  
Then when you open **Leads**, you should see: `dashboard leads page: fetched N leads` with N including the new lead.

If a lead does **not** appear on the dashboard:

- Look for `[lead] create failed` or other `[lead]` errors in the terminal.
- If you see `dashboard query capped: showing 1000 of X leads`, the list is truncated; use filters (e.g. by side or date) to find the lead.

---

## 3. Verify via database (optional)

To confirm leads are stored regardless of the UI:

```bash
pnpm db:studio
```

In Prisma Studio, open the **Lead** table and check that new rows appear with the expected `sessionId`, `siteId`, and `createdAt` after you qualify in the widget. The **ChatSession** for that `sessionId` should have `status = QUALIFIED`.

---

## 4. Checklist summary

- [ ] Dev server running (`pnpm dev` or `pnpm dev:web`)
- [ ] Logged into dashboard and have a site with widget config
- [ ] Opened `/demo?siteId=YOUR_SITE_ID` and qualified a lead in chat (or submitted offline form)
- [ ] Saw `[lead] created in database` (or `lead already exists`) in the terminal
- [ ] Opened **Leads** and saw the new lead in the table
- [ ] (Optional) Checked **Lead** table in Prisma Studio for the new row

If all steps pass, leads generated in the widget are being stored and displayed on the dashboard correctly.
