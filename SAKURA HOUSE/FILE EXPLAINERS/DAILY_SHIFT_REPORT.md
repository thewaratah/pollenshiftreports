# Daily Shift Report — Sakura House

**Last Updated:** March 18, 2026 (M5 validation, M2 anomaly detection)
**Type:** Handover guide for managers
**Audience:** Restaurant managers, non-developers

> This document is written for you — the manager on duty who fills in the shift report at the end of service and sends it to the team. No coding knowledge required. Everything here is about using the spreadsheet and sending reports.

---

## What This System Does

> At the end of your shift, you fill in the day's financial data, staff names, and shift notes on your sheet tab (Monday through Saturday). When you're ready, you click a menu button called "Send Nightly Report." The system then creates a professional PDF, emails it to the management team, posts a summary to Slack, saves all the financial numbers to a central database for analytics, and automatically creates tasks for the team if you've written any TO-DOs. All this happens in about 10 seconds after you click Send. You don't do anything extra — the spreadsheet handles it all.

---

## Validation Rules — What's Required vs Optional

> When you click "Confirm & Send", the system checks your data. Some fields must be filled (the system blocks export if they're empty), and some are just warnings if left blank. Here's what falls into each category.

**Must Be Filled (Export Blocked If Empty):**
- MOD (Manager on Duty) — your name
- Net Revenue — must be greater than zero (the spreadsheet calculates this from your entries)

**Will Warn If Empty (But Export Still Proceeds):**
- Shift summary (what happened during the shift)
- Issues/notes section (problems encountered)
- Kitchen notes (chef feedback)
- TO-DO tasks without assigned staff (tasks must have someone assigned)

If any required field is missing, the pre-send checklist dialog will show red error messages. You must fix these before the "Confirm & Send" button works. Warnings appear in yellow but don't block export — use your judgment whether to fill them in.

---

## Before You Click Send — What Needs to Be Filled In

> The spreadsheet expects certain fields to be completed before you send. Here's the checklist of what needs to be entered on your shift sheet (e.g., "MONDAY 03/03/2026").

**Required (Financial & Staff):**
- MOD (Manager on Duty) — your name
- Staff on shift — names of FOH and BOH team members
- Cash count — the denomination breakdown (coins and notes)
- Cash record — the total cash reconciliation
- Tips — cash tips, card tips, and surcharge amounts
- Production amount — from your till system (Lightspeed)
- Deposit — any revenue outside the till

**Strongly Recommended (Operational Notes):**
- Shift summary — what happened during the shift (busy night, slow service, special events, etc.)
- Guests of note — VIPs, regulars, anniversaries
- Good notes — positive feedback, compliments, things that went well
- Issues — problems encountered, areas for improvement
- Kitchen notes — chef's feedback or kitchen-specific comments

**Optional (Special Incidents):**
- TO-DO items — up to 16 tasks with assignees (these sync automatically to the task management sheet)
- Wastage / comps — items removed from revenue
- Maintenance issues — things that need fixing
- RSA incidents — intoxication refusals or safety incidents

**Important Note:** Net Revenue is a formula cell — it calculates automatically based on your other entries. Don't try to type a number into that cell; it won't work. The spreadsheet does the math for you.

---

## Sending the Nightly Report — Step by Step

> Follow these exact steps to send your report. The process takes about 30 seconds and requires a two-step confirmation.

**Step 1: Make sure you're on the correct day tab**
- Check the tab at the bottom of the spreadsheet
- It should say something like "MONDAY 03/03/2026" or just "MONDAY"
- Never send from the "Instructions", "TO-DOs", or "Read Me" tabs

**Step 2: Open the menu**
- At the top of Google Sheets, find the "Shift Report" menu
- Click on it

**Step 3: Click "Send Nightly Report"**
- A dialog box will appear saying "You are about to export a shift report"
- Click OK to continue

**Step 4: Confirm the pre-flight checklist**
- A checklist dialog will pop up with two checkboxes:
  - "Deputy Timesheets have been approved"
  - "Fruit order has been done"
- Tick both boxes (check the checkboxes)
- Click the "Confirm & Send" button

**Step 5: Wait for the success message**
- The system will show "Report sent successfully"
- The dialog will close automatically after 2 seconds
- You're done

No password is required. Managers can send reports directly from the menu.

---

## What Happens Behind the Scenes

> Once you click "Confirm & Send", four things happen automatically in the next 10 seconds. You don't need to do anything — just wait for the confirmation message.

**1. PDF is emailed to managers**
- A formatted, professional PDF of your shift report is created
- It's emailed to all managers on the recipient list (Evan, Adam, Kalisha, Gooch, Nick, Cynthia as of March 2026)

**2. Slack message is posted**
- A summary message appears in the Sakura Slack channel
- It includes financials, shift summary, and any TO-DOs
- Team members get notified so they know what happened during your shift

**3. Financial data is saved to the warehouse**
- All your financial numbers (net revenue, tips, production amount, discounts) are recorded in a central database
- This data is used for analytics, trend tracking, and weekly reports

**4. TO-DOs sync to the task management sheet**
- Any tasks you wrote in the TO-DO section automatically appear on the "Sakura Actionables Sheet"
- Assigned staff are notified via Slack DM that they have a new task

**Resilience:** If any of these steps fails (e.g., Slack is down), the others still run. You'll still get your PDF and email even if one system has a problem.

---

## Anomaly Detection — When Revenue Looks Unusual

> The system watches for unusual revenue patterns and alerts management if something looks out of the ordinary. This helps catch data entry errors, system issues, or genuinely unusual shifts.

**How It Works:**
- The system compares your shift's net revenue to the average from the past 4 weeks
- If revenue is very different from that average (statistically >2 standard deviations), it's flagged as an anomaly
- An AI assessment rates the severity on a scale of 1 to 5 and explains why it looks unusual
- If an anomaly is detected, an alert posts to the management Slack channel

**Examples of What Triggers an Anomaly Alert:**
- A Sunday that usually brings $3,500 but this week shows $500 (unusually low)
- A Saturday that normally averages $4,200 but shows $8,900 (unusually high)
- Data entry error: revenue shows $42,000 instead of $4,200

**What Happens When an Anomaly Is Detected:**
1. A Slack message posts to the management channel
2. The message includes the anomaly severity, the unusual value, and an AI-generated explanation
3. Management is prompted to review and either confirm the unusual shift happened, or alert you to check your entries

**This Does NOT:**
- Block your report from being sent (export still proceeds normally)
- Prevent data from going to analytics (the data is recorded as-is)
- Require any action from you (just be aware alerts may come)

---

## Sending a Test Report

> Use this when you want to check that everything looks right before sending the real thing to the whole team.

**How to send a test report:**
1. Go to **Shift Report > Send Test Report** (requires the admin password)
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
- The main "Send Nightly Report" button isn't working
- You need to send a report but something is broken
- It's a last-resort option only

**How to use it:**
1. Go to **Shift Report > Send Basic Report** (no password required)
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
  - Tips breakdown (cash, card, surcharge)
  - Production amount
  - Total discounts
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

**Action Buttons:**
- A button to view the full PDF report
- A button to email the team

---

## Who Gets the Report

> The email is sent to a configured list of managers. You can check or update this list if needed.

**Current recipients (as of March 2026):**
- Evan
- Adam
- Kalisha
- Gooch
- Nick
- Cynthia

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
| "Error: named range not found" | Part of the spreadsheet system was deleted | Go to **Shift Report > Admin Tools > Setup & Diagnostics > Force Update Named Ranges (ALL Sheets)**. Enter the admin password. |
| PDF is blank or missing data | You didn't fill in the fields before sending | Check all fields, then try sending again. The Basic Report will work even with blank fields. |
| TO-DOs didn't appear on the Actionables Sheet | The task management system is not connected | Ask your tech support to check the spreadsheet IDs in Script Properties. |
| "Cannot call SpreadsheetApp.getUi()" error | The report was triggered by an automated timer, not by you | This is normal for scheduled automatic runs. The report still sends — the error only affects the on-screen dialog. |

**For detailed troubleshooting and other issues:**
See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for a full list of known issues and advanced fixes.

---

## Key Reminders

> Keep these in mind when using the shift report system.

**Before You Send:**
- Make sure you're on the correct day tab (MONDAY, TUESDAY, etc.)
- Fill in the MOD name and staff list
- Fill in financials (cash, tips, production)
- Net Revenue will calculate automatically — don't type it in

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
