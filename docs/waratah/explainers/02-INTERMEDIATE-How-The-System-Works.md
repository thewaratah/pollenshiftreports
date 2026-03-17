**Last updated:** March 6, 2026
**Audience:** Managers who want to understand what happens behind the scenes
**Prerequisite:** Read 01-BASIC first — this guide builds on it

# How the Shift Report System Works

You know how to fill in the shift report and send it. This guide explains what happens after you click "Confirm & Send", what the automated systems do overnight and weekly, and how all the pieces connect.

---

## The System at a Glance

The Waratah shift report system has four main components:

| Component | What It Does | When It Runs |
|-----------|-------------|--------------|
| **The Nightly Export** | Sends tonight's report (PDF, email, Slack, data logging) | When you click "Export & Email PDF (LIVE)" |
| **The Weekly Rollover** | Archives last week and resets the spreadsheet | Monday at 10am (automatic) |
| **The Weekly Digest** | Posts a revenue comparison (this week vs last) to Slack | Monday at 9am (automatic) |
| **The Weekly Backfill** | Catches any days that didn't get logged to the data warehouse | Monday at 8am (automatic) |

---

## The Nightly Export: What Happens Step by Step

When you click **Waratah Tools > Daily Reports > Export & Email PDF (LIVE)** and confirm the checklist, the system runs 9 steps in sequence. If any step fails, the others still complete — one broken step doesn't stop the rest.

### Step 1: Validation

The system checks that you're on a valid shift report tab (WEDNESDAY through SUNDAY). If you're on the Instructions tab or TO-DOs tab, it stops and tells you to switch.

### Step 2: Pre-Send Checklist

The checklist dialog appears. It requires you to confirm two things before the report can be sent:

- **Deputy Timesheets Approved** — confirms you've approved staff timesheets in Deputy
- **Fruit Order Done** — confirms the fruit order has been placed

The "Confirm & Send" button is physically disabled until both are ticked. This is the only gate between you and the report going out.

### Step 3: Data Warehouse Logging

The system reads approximately 30 cells from tonight's sheet and saves the data to the **Data Warehouse** — a separate Google Spreadsheet used for long-term analytics.

It saves to four different sheets in the warehouse:

| Warehouse Sheet | What Gets Saved |
|-----------------|----------------|
| **NIGHTLY_FINANCIAL** | All financial figures: revenue, tips, production, discounts, taxes (22 columns) |
| **OPERATIONAL_EVENTS** | Each task from your TO-DOs section (one row per task) |
| **WASTAGE_COMPS** | Wastage and comp notes (if you entered any) |
| **QUALITATIVE_LOG** | All five narrative fields plus wastage and RSA text |

**Duplicate prevention:** The system checks if tonight's data has already been logged (matching on date + MOD name). If it finds a match, it skips the write. This means you can safely re-send a report without creating duplicate entries.

### Step 4: TO-DO Aggregation

The system scans all 5 day tabs and collects every non-empty task into the **TO-DOs** summary tab. This gives you a single view of all outstanding tasks for the week, organised by day.

### Step 5: Slack Notification

A formatted message is posted to the Waratah Slack channel. It includes:

- Header with the date and day of the week
- MOD name and staff on shift
- Financial dashboard (net revenue, card tips, cash tips, total tips)
- Shift summary, VIP notes, good, bad, and kitchen notes
- Task list with assignees
- Wastage and RSA incidents (if any)
- Buttons to view the PDF and open the spreadsheet

### Step 6: Task Push to Master Actionables

Your tasks from the TO-DOs section get copied to the **Master Actionables** spreadsheet — a separate Google Sheet that tracks tasks across both venues. Each task is written as a new row with:

- Priority, status, assigned staff, area
- Task description and due date
- The date it was created and which shift report it came from

**Duplicate prevention:** If a task with the same description was already logged today, it's skipped.

### Step 7: PDF Generation

The system creates a PDF of tonight's shift report tab. It uses A4 portrait layout, no gridlines, and includes only the active sheet (not the whole spreadsheet).

### Step 8: Email Distribution

The PDF is emailed to 9 recipients:

Evan, Andie, Cynthia, Dipti, Chef, Howie, Adam, Lily, Blade

The email includes the PDF as an attachment and a link to the live Google Sheet.

### Step 9: Warning Notification

If any of the previous steps had errors (but didn't stop the pipeline), a notification is sent to Evan via Slack with details of what went wrong. You won't see this — it's a behind-the-scenes alert so problems get caught.

---

## TEST vs LIVE Mode

| | LIVE Mode | TEST Mode |
|---|-----------|-----------|
| **Menu path** | Export & Email PDF (LIVE) | Export & Email (TEST to me) |
| **Email goes to** | All 9 recipients | Evan only |
| **Slack posts to** | Live Waratah channel | Test channel only |
| **Tasks pushed to Master Actionables** | Yes | No |
| **Data warehouse logging** | Yes | Yes (but flagged as test) |

**When to use TEST:** When you're unsure if the data looks right, or when you're training and want to practice the workflow without sending to the whole team.

---

## The Weekly Rollover: What Happens Monday Morning

**Triggered by:** An automatic timer — no one presses anything
**When:** Monday at 10:00am Sydney time
**What you'll notice:** When you open the spreadsheet on Wednesday, it will be clean with new dates

Here's what the rollover does, step by step:

### 1. Safety Check

The system verifies it's operating on the correct spreadsheet and that the Waratah configuration is valid. If anything looks wrong, it stops and sends an error notification.

### 2. Generate Week Summary

It reads all 5 day sheets and compiles stats: total shifts worked, total revenue, total tips, and all outstanding tasks.

### 3. Archive as PDF

A PDF of the entire spreadsheet (all 5 days) is saved to Google Drive:

**Archive > 2026 > 2026-03 > pdfs > Waratah_Shift_Report_WE_09.03.2026.pdf**

### 4. Archive as Spreadsheet Copy

A full copy of the spreadsheet is saved alongside the PDF:

**Archive > 2026 > 2026-03 > sheets > Waratah_Shift_Report_WE_09.03.2026**

This preserves everything including formulas, in case you need to go back and check raw data.

### 5. Clear All Data

Every data entry field across all 5 day sheets is cleared: financial figures, narrative fields, tasks, wastage, RSA notes. **Formula cells are preserved** — they are never touched during the rollover.

### 6. Update Dates

Each tab gets updated with the new week's dates (next Wednesday through Sunday) and renamed to match. For example, "WEDNESDAY 05/03/2026" becomes "WEDNESDAY 12/03/2026".

### 7. Notify the Team

An email goes to all 9 recipients with:
- Last week's summary (total revenue, tips, number of shifts)
- Links to the archived PDF and spreadsheet copy
- Confirmation that the new week is ready

A Slack message with the same information is posted to the Waratah channel.

---

## The Weekly Digest: Revenue at a Glance

**Triggered by:** Automatic timer
**When:** Monday at 9:00am Sydney time
**What it does:** Posts a revenue comparison to Slack

The digest reads from the data warehouse and compares:
- This week's total revenue vs last week's
- This week's average revenue per shift vs last week's
- Tip trends

It's designed to give the management team a quick pulse check on how the venue is performing week-over-week, without anyone having to open a spreadsheet.

---

## The Weekly Backfill: Catching Missed Data

**Triggered by:** Automatic timer
**When:** Monday at 8:00am Sydney time
**What it does:** Scans all 5 day sheets and logs any that weren't captured by the nightly export

This is a safety net. If the nightly export failed for a particular day (network error, script timeout, etc.), the backfill catches it and logs the data to the warehouse. It uses the same duplicate prevention — days that were already logged are skipped.

---

## The Data Warehouse: Where Your Numbers Go

The data warehouse is a separate Google Spreadsheet that stores historical data from every shift report. It has four main sheets:

### NIGHTLY_FINANCIAL (22 columns)

This is where the money goes. Every night's financial figures are logged as a single row:

| Column | Data |
|--------|------|
| Date | Tonight's date |
| Day | Day of the week |
| Week Ending | The Sunday of this week |
| MOD | Manager on Duty |
| Staff | Staff on shift |
| Net Revenue | From cell B34 |
| Production Amount | From cell B8 |
| Cash Takings | From cell B15 |
| Gross Sales | From cell B16 |
| Cash Returns, CD Discount, Refunds, CD Redeem | From cells B17-B24 |
| Total Discount | From cell B25 |
| Discounts/Comps exc CD, Gross Taxable, Taxes, Net Sales w/ Tips | From cells B26-B29 |
| Card Tips, Cash Tips, Total Tips | From cells B32, B33, B37 |
| Logged At | Timestamp when this row was written |

### OPERATIONAL_EVENTS (8 columns)

One row per task from your TO-DOs section. Tracks what tasks were raised on which days, by which MOD.

### WASTAGE_COMPS (6 columns)

One row per shift that had wastage or comp notes. Records the date, MOD, and your wastage text.

### QUALITATIVE_LOG (11 columns)

One row per shift with all narrative content: shift summary, VIP notes, the good, the bad, kitchen notes, wastage text, and RSA text.

---

## The Waratah Tools Menu: What Each Item Does

### Daily Reports

| Menu Item | What It Does |
|-----------|-------------|
| **Export & Email PDF (LIVE)** | The main send button. Runs the full 9-step pipeline to everyone. |
| **Export & Email (TEST to me)** | Same pipeline but email goes only to Evan, Slack goes to test channel, tasks not pushed. |
| **Send Basic Report** | A simplified version that generates a PDF, emails it, and posts a plain-text Slack message. No warehouse logging, no task push. Use this if the main export is broken. |
| **Open Export Dashboard** | Opens a visual interface showing the export status for each day this week. |

### Admin (Password Required)

These items are behind a password. They're used for system maintenance, not daily operations.

| Menu Item | What It Does |
|-----------|-------------|
| **Weekly Rollover > Preview (Dry Run)** | Shows what the rollover would do without actually doing it. |
| **Weekly Rollover > Run Rollover Now** | Manually triggers the weekly rollover. Use if the Monday timer didn't fire. |
| **Weekly Rollover > Create/Remove Trigger** | Manages the Monday 10am timer. |
| **Data Warehouse > Show Integration Log** | Shows a history of all data warehouse writes. |
| **Data Warehouse > Backfill Current Sheet** | Manually pushes the current day's data to the warehouse. |
| **Analytics > Build Dashboards** | Creates formula-driven analytics dashboards in the warehouse. |
| **Weekly Reports > Weekly To-Do Summary** | Posts a summary of all week's tasks to Slack. |
| **Weekly Reports > Weekly Revenue Digest** | Posts the revenue comparison to Slack. |
| **Setup > System Validation** | Runs a health check on all connections (warehouse, task management, Slack). |
| **Setup > Fix Tab Names** | Repairs tab names if they've been accidentally renamed. |
| **Setup > Backfill TO-DOs (All Days)** | Pushes all 5 days' tasks to Master Actionables at once. |

---

## The Task Management Intersection

When you add tasks in the TO-DOs section of the shift report, they flow to two places:

1. **TO-DOs summary tab** — collected from all 5 days into one view, right in the shift report spreadsheet
2. **Master Actionables** — a separate spreadsheet that tracks tasks across both Waratah and Sakura House, with priority levels, status tracking, and due dates

The Master Actionables spreadsheet is the central task management system. Tasks created in shift reports appear there automatically after the nightly export runs.

---

## If Something Goes Wrong

### The nightly export didn't send

**How to tell:** No email arrived, no Slack message appeared.

**What to do:**
1. Check you're on the correct day tab
2. Try again — Waratah Tools > Daily Reports > Export & Email PDF (LIVE)
3. If it fails again, try the basic export: Waratah Tools > Daily Reports > Send Basic Report
4. If nothing works, contact Evan with a screenshot of any error message

### The rollover didn't happen

**How to tell:** It's Monday afternoon and the spreadsheet still shows last week's dates.

**What to do:**
1. Tell Evan — he can check if the trigger is still active
2. The rollover can be run manually from the Admin menu (password required)

### A formula cell was accidentally deleted

**How to tell:** A cell that used to calculate automatically now shows a number you typed, or is blank.

**What to do:**
1. Don't try to fix it yourself — the formula needs to be restored from the archived copy
2. Tell Evan which cell was affected and which day's tab

### Duplicate data in the warehouse

**How to tell:** Someone mentions the same day appears twice in the analytics.

**This shouldn't happen** — the system prevents duplicates automatically. If it does happen, it's a bug. Let Evan know.

---

## Glossary of System Terms

| Term | What It Means |
|------|--------------|
| **The Nightly Export** | The full pipeline that runs when you send the shift report (PDF, email, Slack, data logging, task push) |
| **The Weekly Rollover** | Monday morning automation that archives last week and resets the spreadsheet |
| **The Weekly Digest** | Monday morning Slack post comparing this week's revenue to last week's |
| **The Weekly Backfill** | Monday morning safety net that catches any days not logged to the warehouse |
| **The Data Warehouse** | Separate spreadsheet storing all historical financial, task, and narrative data |
| **Master Actionables** | Separate spreadsheet tracking tasks across both venues |
| **MOD** | Manager on Duty — whoever ran tonight's service |
| **Script Properties** | Configuration settings stored securely inside the system (email addresses, webhook URLs, etc.) |
| **Block Kit** | The formatting system used for Slack messages — makes them look structured with headers, fields, and buttons |
