# Daily Shift Report — The Waratah

**Last Updated:** March 18, 2026 (M1: AI shift summary added to email + Slack)
**Type:** Handover guide for managers
**Audience:** Restaurant managers, non-developers

> This document is written for you — the manager on duty who fills in the shift report at the end of service and sends it to the team. No coding knowledge required. Everything here is about using the spreadsheet and sending reports.

---

## What This System Does

> At the end of your shift, you fill in the day's financial data, staff names, and shift notes on your sheet tab (Wednesday through Sunday). When you're ready, you click a menu button called "Export & Email PDF (LIVE)." The system then creates a professional PDF, emails it to the management team, posts a summary to Slack, saves all the financial numbers to a central database for analytics, and automatically creates tasks for the team if you've written any TO-DOs. All this happens in about 10 seconds after you click Send. You don't do anything extra — the spreadsheet handles it all.

---

## Before You Click Send — What Needs to Be Filled In

> The spreadsheet expects certain fields to be completed before you send. Here's the checklist of what needs to be entered on your shift sheet (e.g., "WEDNESDAY 05/03/2026").

**Required (Financial & Staff):**
- MOD (Manager on Duty) — your name
- Staff on shift — names of FOH and BOH team members
- Production amount — from your till system
- Cash takings — total cash reconciliation
- Card tips and cash tips — separated
- All financial breakdown fields (discounts, refunds, taxes, gross sales, etc.)

**Strongly Recommended (Operational Notes):**
- Shift summary — what happened during the shift (busy night, slow service, special events, etc.)
- Guests of note — VIPs, regulars, anniversaries
- Good notes — positive feedback, compliments, things that went well
- Issues — problems encountered, areas for improvement
- Kitchen notes — chef's feedback or kitchen-specific comments

**Optional (Special Incidents):**
- TO-DO items — up to 9 tasks with assignees (these sync automatically to the task management sheet)
- Wastage / comps — items removed from revenue
- Maintenance issues — things that need fixing
- RSA incidents — intoxication refusals or safety incidents

**Important Notes:**
- Net Revenue is a formula cell — it calculates automatically based on your other entries. Don't try to type a number into that cell; it won't work. The spreadsheet does the math for you.
- Covers is also a formula cell — same rule applies.

---

## Sending the Nightly Report — Step by Step

> Follow these exact steps to send your report. The process takes about 30 seconds and requires a two-step confirmation.

**Step 1: Make sure you're on the correct day tab**
- Check the tab at the bottom of the spreadsheet
- It should say something like "WEDNESDAY 05/03/2026" or just "WEDNESDAY"
- The Waratah operates Wednesday through Sunday only
- Never send from the "Read Me", "Task Management", or "Analytics" tabs

**Step 2: Open the menu**
- At the top of Google Sheets, find the "Waratah Tools" menu
- Click on it

**Step 3: Navigate to Daily Reports**
- Hover over "Daily Reports" (this is a submenu)
- You'll see several options

**Step 4: Click "Export & Email PDF (LIVE)"**
- A dialog box will appear saying "You are about to export a shift report"
- Click OK to continue

**Step 5: Confirm the pre-flight checklist**
- A checklist dialog will pop up with two checkboxes:
  - "Deputy Timesheets have been approved"
  - "Fruit order has been done"
- Tick both boxes (check the checkboxes)
- Click the "Confirm & Send" button

**Step 6: Wait for the success message**
- The system will show "Report sent successfully"
- The dialog will close automatically after 2 seconds
- You're done

No password is required. Managers can send reports directly from the menu.

---

## What Happens Behind the Scenes

> Once you click "Confirm & Send", four things happen automatically in the next 10 seconds. You don't need to do anything — just wait for the confirmation message.

**1. PDF is emailed to managers**
- A formatted, professional PDF of your shift report is created
- It's emailed to all managers on the recipient list (Evan, Cynthia, Dipti, Chef, Howie, Adam, Lily as of March 2026)
- The email includes a short AI-written summary at the top — 2-3 sentences capturing the shift highlights (net revenue, key events, action items). This is generated automatically from your shift notes and does not require any extra input from you. If the AI system is unavailable, the email sends normally without the summary.

**2. Slack message is posted**
- A summary message appears in the Waratah Slack channel
- It includes financials, shift summary, and any TO-DOs
- Team members get notified so they know what happened during your shift

**3. Financial data is saved to the warehouse**
- All your financial numbers (net revenue, tips, production amount, discounts, taxes, and more) are recorded in a central database
- This data is used for analytics, trend tracking, and weekly reports
- The Waratah captures more detailed financial breakdown than other systems
- If a day's data was missed or lost, tech support can recover it via **Admin Tools → Data Warehouse → Backfill Entire Week to Warehouse** — this re-pushes all five day sheets at once without needing to send each report again

**4. TO-DOs sync to the task management sheet**
- Any tasks you wrote in the TO-DO section automatically appear on the "Waratah Task Management" sheet
- Assigned staff are notified via Slack DM that they have a new task

**Resilience:** If any of these steps fails (e.g., Slack is down), the others still run. You'll still get your PDF and email even if one system has a problem.

---

## Sending a Test Report

> Use this when you want to check that everything looks right before sending the real thing to the whole team.

**How to send a test report:**
1. Go to **Waratah Tools > Daily Reports > Export & Email (TEST to me)**
2. Follow the same checklist process as above
3. The PDF is emailed only to you (not the whole team)
4. The Slack message goes to a test channel (not the live one)
5. No data is written to the warehouse
6. TO-DOs are NOT synced

**When to use:** When you want to preview the formatting, or when training a new manager.

---

## The Basic Report — Emergency Fallback

> If the main export system is broken for any reason, there's a simpler standalone backup you can use.

**When to use this:**
- The main "Export & Email PDF (LIVE)" button isn't working
- You need to send a report but something is broken
- It's a last-resort option only

**How to use it:**
1. Go to **Waratah Tools > Daily Reports > Send Basic Report**
2. No checklist dialog — it goes straight through
3. Sends a PDF email and a simple Slack message
4. Does NOT sync TO-DOs or save data to the warehouse

**Trade-offs:** This is simpler and less integrated, but it gets your report sent. Use the main export when everything's working; use this only as an emergency fallback.

---

## What Gets Posted to Slack

> The Slack message is rich and formatted nicely. Here's what's included.

**Always Shown:**
- Title and date of the report
- Manager on Duty name
- Staff on shift (FOH and BOH names)
- Financial dashboard:
  - Net revenue
  - Production amount
  - Cash takings
  - Discounts and refunds
  - Taxes and gross sales
  - Tips breakdown (cash, card)
- Shift summary

**Only Shown If Filled In:**
- Guests of note (VIPs, regulars)
- Good notes (positive feedback)
- Issues (problems encountered)
- Kitchen notes (chef feedback)

**Task Section:**
- TO-DO list with assigned staff names
- Only appears if you wrote any TO-DOs

**Incident Section:**
- Wastage, maintenance, RSA items
- Only appears if you filled in any incidents

**AI Summary (optional):**
- A 2-3 sentence AI-written summary of the shift appears at the bottom of the Slack message
- It's generated automatically from your shift notes and is only shown when the AI system is available
- If the AI system is unavailable or not configured, this section is simply omitted — everything else still sends

**Action Buttons:**
- A button to view the full PDF report
- A button to email the team

---

## Who Gets the Report

> The email is sent to a configured list of managers. You can check or update this list if needed.

**Current recipients (as of March 2026):**
- Evan
- Cynthia
- Dipti
- Chef
- Howie
- Adam
- Lily

**To change who gets the email:**
See [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md) — search for "Changing Email Recipients" for step-by-step instructions.

---

## What Can Go Wrong + Quick Fixes

> Most issues are easy to fix. Here's a troubleshooting table.

| Problem | What It Means | What to Do |
|---------|--------------|-----------|
| Checklist dialog doesn't appear | Your browser is blocking popups | Go to Chrome/Safari settings and allow popups for Google Sheets |
| "Report sent" but no email arrived | Recipient is not on the list, or email went to spam | Email the Slack admin to check the recipient list. Check your spam folder. |
| Slack message didn't post | The Slack connection is broken or expired | The Slack admin needs to generate a new webhook URL. Contact your tech support. |
| PDF is blank or missing data | You didn't fill in the fields before sending | Check all fields, then try sending again. The Basic Report will work even with blank fields. |
| TO-DOs didn't appear on the Task Management Sheet | The task management system is not connected | Ask your tech support to check the spreadsheet IDs in Script Properties. |
| "Cannot call SpreadsheetApp.getUi()" error | The report was triggered by an automated timer, not by you | This is normal for scheduled automatic runs. The report still sends — the error only affects the on-screen dialog. |
| Spreadsheet layout was changed (rows/columns deleted) | Someone inserted or deleted rows/columns in the sheet | If the cell references changed, the hardcoded cell locations may now point to wrong data. Contact technical support — this requires a code update. |

**For detailed troubleshooting and other issues:**
See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for a full list of known issues and advanced fixes.

---

## Key Reminders

> Keep these in mind when using the shift report system.

**Before You Send:**
- Make sure you're on the correct day tab (WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, or SUNDAY)
- Fill in the MOD name and staff list
- Fill in all financial fields (production amount, cash takings, tips, discounts, etc.)
- Net Revenue and Covers will calculate automatically — don't type them in

**Checklist Items:**
- Deputy timesheets should be approved before you send
- Fruit order should be placed before you send
- Both boxes must be ticked to proceed

**Data That Matters:**
- Everything you write goes to the warehouse and is used for analytics
- TO-DOs are automatically pushed to the task management sheet and Slack
- Good notes and issues are logged and reviewed for trends

**If Something Breaks:**
- Try the Basic Report first (fallback option)
- Check the troubleshooting guide
- Contact your tech support

---

## Need Help?

> These documents have more detailed information if you need it.

- **[SETUP_AND_CONFIG.md](SETUP_AND_CONFIG.md)** — How to configure email recipients, Slack, and other settings
- **[SLACK_INTEGRATION.md](SLACK_INTEGRATION.md)** — How Slack messages are formatted and posted
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — Detailed troubleshooting guide for all known issues

---

**Last Updated:** March 18, 2026
**Questions?** Contact your tech support or system administrator
