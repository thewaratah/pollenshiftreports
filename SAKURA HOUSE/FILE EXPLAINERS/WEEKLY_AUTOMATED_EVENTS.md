# Weekly Automated Events — Sakura House

**Last Updated:** March 18, 2026
**Type:** Handover guide for managers

> This document explains everything that happens automatically in the Sakura House system each week. You don't need to be technical to understand it — just know that these are all handled by scheduled triggers and rarely need your attention.

---

## Weekly Schedule at a Glance

> Here's the complete weekly automation calendar. Everything is set to Sydney time (AEST/AEDT).

| Day & Time | What Happens | Where You'll See It |
|---|---|---|
| **Monday 2:00 AM** | Weekly backfill to Data Warehouse | Runs silently — no notification |
| **Monday 6:00 AM** | Weekly task summary | Slack: #managers channel + team DMs |
| **Monday 8:00 AM** | Revenue digest (this week vs last) | Slack: #managers channel |
| **Monday 10:00 AM** | Weekly rollover (archive + reset) | Email to management + Slack notification |
| **Daily 7:00 AM** | Task maintenance (cleanup, archive, escalation) | Slack DMs for urgent overdue items |
| **Sunday 9:00 AM** | Overdue task summary | Slack: #managers channel |

All of these run on their own. You don't need to do anything unless something goes wrong.

---

## The Weekly Rollover — Monday 10am

> This is the most important automated event. Every Monday at 10am, the system archives last week's data and resets the spreadsheet for a new week. It takes about 1-2 minutes to run.

### What Happens (In Order)

1. **Validates the file** — Checks that it's opening the right spreadsheet for Sakura House
2. **Generates a summary** — Prepares a record of the week's total revenue and which managers were on duty
3. **Creates a PDF archive** — Exports all 6 days (Mon–Sat) as a single multi-page document
4. **Creates a spreadsheet backup** — Saves a complete copy of the working file to Google Drive
5. **Clears all data fields** — Removes shift data from every day tab (only what you typed in — not formulas)
6. **Updates all dates** — Stamps next week's dates on each tab and renames them (e.g., "MONDAY 10/03/2026")
7. **Verifies named ranges** — Automatically repairs any that went missing during deployment
8. **Sends notifications** — Emails a summary to management and posts confirmation to Slack

### Important: Formula Cells Are Never Cleared

> The system is smart about what it clears. It only removes data you typed in — never formulas.

Cells like **Net Revenue**, **Covers**, **Total Tips**, and others with calculation formulas are preserved. They'll automatically recalculate when you enter new shift data.

**Example:** If Net Revenue on Monday shows $4,200 after rollover, that's correct — it's a formula that will recalculate when you enter sales data.

### How to Verify Rollover Worked

> After Monday morning, do a quick 5-minute spot check to make sure rollover completed successfully.

1. **Open the Monday tab** — Does the date say this week's Monday?
2. **Check empty fields** — Are the cash, revenue, and notes fields blank?
3. **Check formula cells** — Does Net Revenue show a formula result (usually a number or $0.00)?
4. **Check tab names** — Are tabs renamed to this week's dates (e.g., "MONDAY 17/03")?
5. **Check Google Drive** — Is last week's PDF in the Archive folder under `Archive > 2026 > 2026-03 > pdfs/`?
6. **Check Slack** — Did a rollover notification post to #managers?

If all six pass, rollover worked perfectly. If any fail, see [Troubleshooting](#troubleshooting) below.

---

## What Gets Archived

> Every week's work is automatically saved in two formats on Google Drive so you can always reference past weeks.

### Archive Structure

```
Archive/
├── 2026/
│   ├── 2026-01/
│   ├── 2026-02/
│   └── 2026-03/
│       ├── pdfs/
│       │   └── Sakura Shift Report W.E. 09.03.2026.pdf
│       │   └── Sakura Shift Report W.E. 16.03.2026.pdf
│       └── sheets/
│           └── Sakura Shift Report W.E. 09.03.2026
│           └── Sakura Shift Report W.E. 16.03.2026
```

### Two Archive Formats

**PDF Archive**
- Multi-page, formatted report (all 6 days in one file)
- Good for quick reference, printing, or emailing
- Read-only — can't edit

**Spreadsheet Archive**
- Full copy with all formulas and calculations
- Good for detailed lookups or re-calculating past weeks
- Every formula and data point is preserved

Both are saved automatically. You never need to do anything — just browse Google Drive when you need to look up old data.

---

## The Revenue Digest — Monday 8am

> A quick snapshot that posts to Slack showing how this week's revenue compares to last week. It's designed to take 30 seconds to read.

### What You'll See in Slack

The digest shows:
- **Total revenue for the week** (this week vs last week with a % change)
- **Number of shifts reported** (how many days have nightly reports)
- **Best shift of the week** (date, revenue amount, and MOD name)
- **Week-over-week trend arrow** (up/down indicator)

### Where the Data Comes From

Every nightly report you send automatically feeds into the **Data Warehouse** spreadsheet's `NIGHTLY_FINANCIAL` sheet. The revenue digest pulls from there.

### If Numbers Look Wrong

Check that:
- Nightly reports were sent for all shifts in the week
- If any days are missing, the digest will show incomplete data
- If all reports are sent but numbers still look off, re-trigger the digest manually via **Shift Report > Admin Tools > Weekly Digest > Send Revenue Digest (LIVE)**

---

## Analytics Dashboards — Real-Time Updated

> The Data Warehouse spreadsheet has two auto-updating dashboard tabs that refresh as new nightly reports arrive. No action needed from you — they just keep themselves current.

### ANALYTICS Tab (Operational View)

This week at a glance:
- Shifts reported this week
- Total and average revenue
- Tips breakdown
- Production amount
- Day-of-week averages (historical — which days perform best?)

Week-over-week comparison with % changes.

### EXECUTIVE_DASHBOARD Tab (High-Level View)

Broader trends:
- Month-to-date snapshot
- Monthly trends
- Rolling 4-week comparison
- Top MOD performance (ranked by average revenue)

### If Dashboards Look Broken or Blank

This is rare, but if either dashboard looks wrong:

1. Open the Data Warehouse spreadsheet
2. Go to **Shift Report > Admin Tools > Integrations & Analytics**
3. Choose either **Build Analytics Dashboard** or **Build Executive Dashboard**
4. Enter the admin password
5. The dashboard formulas will rebuild from scratch — safe to re-run anytime

You'll see a completion message when it's done.

---

## Daily Task Maintenance — 7am Every Day

> Every morning at 7am, the Task Management system automatically runs cleanup: archiving completed tasks, escalating overdue items, and posting urgent reminders to Slack.

### What Happens

- **Completed tasks** marked as DONE more than 3 days ago are archived
- **Overdue tasks** are flagged and escalated (moved to high-priority status)
- **Urgent items** (tasks due today or overdue) post as Slack DMs to assigned staff
- **Recurring tasks** are automatically re-created for the next cycle

### What You'll See

If you have overdue or urgent tasks:
- Slack DM from the Task Bot with your name and task details
- Tasks are automatically escalated in the actionables sheet (status changes to ESCALATED)

### If Tasks Aren't Being Escalated

Check that:
- The task date is actually in the past (escalation only happens for overdue tasks)
- The task is assigned to someone (unassigned tasks aren't escalated)
- Task status is not already DONE or ARCHIVED

---

## Weekly Task Summary — Monday 6am

> A digest of all active tasks for the coming week posts to Slack and individual DMs, grouped by status and assignee.

### What You'll See

The summary shows:
- **By status:** How many tasks are Active, In Progress, Waiting, and Escalated
- **By assignee:** Who has how many tasks
- **Critical items:** Any escalated or overdue tasks highlighted

### This Is a Planning Tool

Use the Monday 6am summary to:
- Plan your week
- Identify bottlenecks (who's overloaded?)
- Spot escalations early and resolve them

---

## Sunday Overdue Summary — 9am

> A quick report of any tasks that will be or are overdue at the end of the weekend. Posted to Slack #managers so the team can catch them Sunday before Monday morning.

### What You'll See

- Any tasks due today (Sunday) that aren't marked DONE
- Any tasks that are already overdue
- Assigned staff member and task description

### Purpose

This is an early warning. If you see a task on Sunday that's due Monday, you can chase it down Sunday night so it doesn't escalate Monday morning.

---

## Monday 2am Weekly Backfill — Warehouse Data Sync

> Every Monday at 2am, the system syncs a week's worth of nightly reports from both the Sakura and Waratah systems into the central Data Warehouse. This is silent and requires no action from you.

### What Happens

- All nightly reports sent from Sakura in the past week are collected
- Revenue, production, tips, and staffing data are extracted
- Duplicate checks are run (same shift, same MOD, same date = skip to avoid duplicates)
- Data is inserted into the `NIGHTLY_FINANCIAL` table in the Data Warehouse
- Dashboards automatically refresh with new data

### How You Know It Worked

- Analytics dashboards show current week's data
- Revenue digest on Monday 8am has numbers
- If data is missing, nightly reports may not have been sent

### On-Demand: Backfill the Entire Week Manually

> If the scheduled Monday backfill didn't run, or you need to resync an entire week's data, you can trigger a full-week backfill yourself without waiting for Monday night.

**How to use it:**
1. Open the **"Sakura House - Current Week"** spreadsheet
2. Go to **Shift Report > Admin Tools > Data Warehouse > Backfill Entire Week to Warehouse**
3. Enter the admin password
4. The system will process all 6 day sheets (Monday through Saturday) in sequence and write any missing records to the warehouse
5. Duplicate records are automatically skipped — it's safe to run multiple times

---

## Triggers Were Destroyed After Code Deployment

> This is the single most important section. After any code deployment (called a "clasp push"), ALL automated triggers are destroyed and must be recreated manually. This is normal and expected — it only takes 5 minutes.

### How Do You Know Triggers Are Broken?

- Monday morning comes and rollover didn't run
- Revenue digest never posted
- Task summaries stopped appearing
- Someone mentions they did a "clasp push" or "deployed code"
- Slack messages from the Task Bot stop arriving

### Trigger Recreation Checklist

You'll need the admin password. Open each menu item and select "Create [X] Trigger."

#### On the **Sakura House - Current Week** Spreadsheet:

1. **Rollover Trigger (Mon 10am)**
   - Menu: **Shift Report > Admin Tools > Weekly Rollover > Create Rollover Trigger (Mon 10am)**
   - Confirm the time is 10:00 AM

2. **Revenue Digest Trigger (Mon 8am)**
   - Menu: **Shift Report > Admin Tools > Weekly Digest > Setup Monday Digest Trigger**
   - Confirm the time is 8:00 AM

3. **Weekly Backfill Trigger (Mon 2am)**
   - Menu: **Shift Report > Admin Tools > Data Warehouse > Setup Weekly Backfill Trigger**
   - Confirm the time is 2:00 AM

#### On the **Sakura Actionables** Spreadsheet (Task Management):

4. **Daily Maintenance Trigger (7am)**
   - Menu: **Task Management > Admin Tools > Setup Triggers > Create Daily Trigger (7am)**

5. **Auto-Sort Trigger (on edit)**
   - Menu: **Task Management > Admin Tools > Setup Triggers > Create Edit Trigger (Auto-sort)**

6. **Weekly Task Summary Trigger (Mon 6am)**
   - Menu: **Task Management > Admin Tools > Setup Triggers > Create Weekly Summary Trigger (Mon 6am)**

7. **Overdue Summary Trigger (Sun 9am)**
   - Menu: **Task Management > Admin Tools > Setup Triggers > Create Overdue Summary Trigger (Sun 9am)**

**Do all 7.** Skipping any means that automation stays broken until you create it.

---

## Troubleshooting

> Quick solutions to the most common issues.

### Rollover Didn't Run on Monday

**Most likely cause:** Trigger was destroyed (usually by a code deployment).

**Fix:**
1. Recreate the rollover trigger (see [Triggers Were Destroyed](#triggers-were-destroyed-after-code-deployment) above)
2. Open **Shift Report > Admin Tools > Weekly Rollover > Run Rollover Now**
3. Enter admin password
4. Wait 1-2 minutes for completion

---

### Rollover Ran But Sheets Still Have Data

**This is not a bug.** Some cells contain formulas and are designed to keep showing values.

**Examples:**
- Net Revenue (a formula that calculates from other inputs)
- Covers (a formula)
- Total Tips (a formula)

Data fields like revenue, cash, and notes should be empty. Formula fields will show a number — that's correct.

---

### Revenue Digest Shows $0 or Didn't Post

**Most likely cause:** Nightly reports weren't sent (no data in warehouse).

**Fix:**
1. Check that nightly reports were sent for all days this week
2. If any are missing, send them now
3. Manually trigger the digest: **Shift Report > Admin Tools > Weekly Digest > Send Revenue Digest (LIVE)**
4. Wait 30 seconds for the message to post to Slack

---

### Dates Are Wrong After Rollover

**Very rare.** This sometimes happens if there's a timezone mismatch.

**Fix:**
1. Run rollover again: **Shift Report > Admin Tools > Weekly Rollover > Run Rollover Now**
2. If dates are still wrong, contact technical support

---

### Archive PDF Is Missing from Google Drive

**Cause:** Rollover failed partway through.

**Fix:**
1. Run rollover again: **Shift Report > Admin Tools > Weekly Rollover > Run Rollover Now**
2. It will re-create the archive and finish cleanup

---

### Task Summaries Didn't Post Monday Morning

**Most likely cause:** Task management trigger was destroyed.

**Fix:**
1. Open the **Sakura Actionables** spreadsheet
2. Go to **Task Management > Admin Tools > Setup Triggers > Create Weekly Summary Trigger (Mon 6am)**
3. Enter admin password
4. Trigger is recreated; next Monday it will post

---

### Dashboard Shows Blank or Error

**Cause:** Dashboard formulas need to be rebuilt.

**Fix:**
1. Open **Data Warehouse** spreadsheet
2. Go to **Shift Report > Admin Tools > Integrations & Analytics**
3. Choose **Build Analytics Dashboard** (or **Build Executive Dashboard**)
4. Enter admin password
5. Wait for completion message

---

## Need More Help?

> If you're still stuck, here's what to do.

- **For deployment issues or trigger problems:** Contact your technical support (they can verify triggers in Google Apps Script's trigger list)
- **For data warehouse or analytics questions:** Check the Data Warehouse spreadsheet's README sheet
- **For task management issues:** Check the Sakura Actionables spreadsheet's instructions tab
- **For rollover-specific help:** Run the dry-run preview first (**Shift Report > Admin Tools > Weekly Rollover > Preview Rollover (Dry Run)**) to see what would happen without making changes

---

**Document Version:** 1.0
**Last Updated:** March 18, 2026
**For:** Sakura House Managers
**Technical Review:** gas-code-review-agent
**Peer Review:** documentation-agent
