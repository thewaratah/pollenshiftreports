# Weekly Automated Events — The Waratah

**Last Updated:** April 2, 2026 (Cell reference correction: Total Tips B36, Covers B37)
**Type:** Handover guide for managers

> This document explains everything that happens automatically in The Waratah system each week. You don't need to be technical to understand it — just know that these are all handled by scheduled triggers and rarely need your attention.

---

## Weekly Schedule at a Glance

> Here's the complete weekly automation calendar. Everything is set to Sydney time (AEST/AEDT).

| Day & Time | What Happens | Where You'll See It |
|---|---|---|
| **Monday 2:00 AM** | Weekly backfill to Data Warehouse | Runs silently — no notification |
| **Monday 6:00 AM** | Weekly task archive | Task Management spreadsheet auto-updated |
| **Monday 10:00 AM** | Weekly task summary | Slack: individual staff DMs |
| **Monday 10:00 AM** | Weekly rollover (archive + reset) | Email to management + Slack notification |
| **Wednesday 8:00 AM** | Revenue digest (this week vs last) | Slack: #managers channel |
| **Every 2 hours** | Task cleanup & auto-sort | Task Management spreadsheet auto-updated |
| **Daily 6:00 AM** | Staff workload refresh | Task Management spreadsheet auto-updated |

All of these run on their own. You don't need to do anything unless something goes wrong.

---

## The Weekly Rollover — Monday 10am

> This is the most important automated event. Every Monday at 10am, the system archives last week's data and resets the spreadsheet for a new week. It takes about 1-2 minutes to run.

### What Happens (In Order)

1. **Validates the file** — Checks that it's opening the right spreadsheet for The Waratah
2. **Generates a summary** — Prepares a record of the week's total revenue and which managers were on duty
3. **Creates a PDF archive** — Exports all 5 days (Wed–Sun) as a single multi-page document
4. **Creates a spreadsheet backup** — Saves a complete copy of the working file to Google Drive
5. **Clears all data fields** — Removes shift data from every day tab (only what you typed in — not formulas)
6. **Updates all dates** — Stamps next week's dates on each tab and renames them (e.g., "WEDNESDAY 26/03/2026")
7. **Sends notifications** — Emails a summary to management and posts confirmation to Slack

### Important: Formula Cells Are Never Cleared

> The system is smart about what it clears. It only removes data you typed in — never formulas.

Cells like **Net Revenue** (B34), **Total Tips** (B36), and **Labor Hours/Cost** (B38–B39) contain calculation formulas and are preserved. They'll automatically recalculate when you enter new shift data.

**Example:** If Net Revenue on Wednesday shows $4,200 after rollover, that's correct — it's a formula that will recalculate when you enter sales data.

### How to Verify Rollover Worked

> After Monday morning, do a quick 5-minute spot check to make sure rollover completed successfully.

1. **Open the Wednesday tab** — Does the date say this week's Wednesday?
2. **Check empty fields** — Are the cash, revenue, and notes fields blank?
3. **Check formula cells** — Does Net Revenue show a formula result (usually a number or $0.00)?
4. **Check tab names** — Are tabs renamed to this week's dates (e.g., "WEDNESDAY 26/03")?
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
│       │   └── Waratah_Shift_Report_WE_09.03.2026.pdf
│       │   └── Waratah_Shift_Report_WE_16.03.2026.pdf
│       └── sheets/
│           └── Waratah Week Ending 09.03.2026
│           └── Waratah Week Ending 16.03.2026
```

### Two Archive Formats

**PDF Archive**
- Multi-page, formatted report (all 5 days in one file)
- Good for quick reference, printing, or emailing
- Read-only — can't edit

**Spreadsheet Archive**
- Full copy with all formulas and calculations
- Good for detailed lookups or re-calculating past weeks
- Every formula and data point is preserved

Both are saved automatically. You never need to do anything — just browse Google Drive when you need to look up old data.

---

## The Revenue Digest — Wednesday 8am

> A quick snapshot that posts to Slack showing how this week's revenue compares to last week. It's designed to take 30 seconds to read. Note: The Waratah's week runs Wednesday–Sunday, so the digest posts on Wednesday morning to show the week ahead.

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
- If all reports are sent but numbers still look off, re-trigger the digest manually via **Waratah Tools > Admin Tools > Weekly Digest > Send Revenue Digest (LIVE)**

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
- Week-to-date snapshot
- Weekly trends
- Rolling 4-week comparison
- Top MOD performance (ranked by average revenue)

### If Dashboards Look Broken or Blank

This is rare, but if either dashboard looks wrong:

1. Open the Data Warehouse spreadsheet
2. Go to **Waratah Tools > Admin Tools > Analytics > Rebuild Analytics Dashboard**
3. Enter the admin password
4. The dashboard formulas will rebuild from scratch — safe to re-run anytime

You'll see a completion message when it's done.

---

## Daily Staff Workload Refresh — 6am Every Day

> Every morning at 6am, the Task Management system automatically refreshes which staff members have assigned tasks for the day. This helps with workload planning.

### What Happens

- All tasks assigned to staff for today are collected
- The number of active tasks per person is calculated
- The task dashboard is updated with current workload

### What You'll See

If you check the Task Management spreadsheet in the morning, you'll see the latest staff workload counts. Staff with multiple tasks see their task counts increase.

### If Workload Numbers Look Wrong

Check that:
- All tasks are properly assigned to staff members
- The task dates are set correctly
- If a task should count toward today's workload, make sure it's marked as active (not DONE or ARCHIVED)

---

## Weekly Task Maintenance — Various Times

> The Task Management system runs several automated maintenance tasks throughout the week to keep everything organized.

### Monday 6am: Weekly Task Archive

Completed tasks marked as DONE more than 3 days ago are automatically archived and moved out of the active list.

### Monday 10am: Weekly Task Summary

A digest of all active tasks for the coming week posts to Slack and individual DMs, grouped by status and assignee.

**What you'll see:**
- How many tasks are Active, In Progress, Waiting, and Escalated
- Who has how many tasks
- Any escalated or overdue tasks highlighted

Use this Monday morning to plan your week and identify bottlenecks.

### Sunday 9am: Overdue Task Summary

A quick report of any tasks that will be or are overdue at the end of the weekend posts to Slack #managers so the team can catch them before Monday morning.

**What you'll see:**
- Any tasks due today (Sunday) that aren't marked DONE
- Any tasks that are already overdue
- Assigned staff member and task description

This is an early warning. If you see a task on Sunday that's due Monday, you can chase it down Sunday night so it doesn't escalate Monday morning.

### Every 2 Hours: Bi-Hourly Cleanup

The task sheet is automatically sorted and cleaned up every 2 hours to keep it organized. Active tasks stay at the top, completed tasks move down.

---

## Monday 2am Weekly Backfill — Warehouse Data Sync

> Every Monday at 2am, the system syncs a week's worth of nightly reports from both the Waratah and Sakura systems into the central Data Warehouse. This is silent and requires no action from you.

### What Happens

- All nightly reports sent from The Waratah in the past week are collected
- Revenue, production, tips, and staffing data are extracted
- Duplicate checks are run (same shift, same MOD, same date = skip to avoid duplicates)
- Data is inserted into the `NIGHTLY_FINANCIAL` table in the Data Warehouse
- Dashboards automatically refresh with new data

### How You Know It Worked

- Analytics dashboards show current week's data
- Revenue digest on Wednesday 8am has numbers
- If data is missing, nightly reports may not have been sent

---

## Triggers Were Destroyed After Code Deployment

> This is the single most important section. After any code deployment (called a "clasp push"), ALL automated triggers are destroyed and must be recreated manually. This is normal and expected — it only takes 10 minutes.

### How Do You Know Triggers Are Broken?

- Monday morning comes and rollover didn't run
- Wednesday morning comes and revenue digest never posted
- Task summaries stopped appearing
- Someone mentions they did a "clasp push" or "deployed code"
- Slack messages from the Task Bot stop arriving

### Trigger Recreation Checklist

You'll need the admin password. Open each menu item and select "Create [X] Trigger" or "Setup [X] Trigger."

#### On the **Waratah - Current Week** Spreadsheet (Shift Reports):

1. **Rollover Trigger (Mon 10am)**
   - Menu: **Waratah Tools > Admin Tools > Weekly Reports > Weekly Rollover (In-Place) > Create Rollover Trigger**
   - Confirm the time is 10:00 AM

2. **Revenue Digest Trigger (Wed 8am)**
   - Menu: **Waratah Tools > Admin Tools > Weekly Digest > Setup Wednesday Digest Trigger**
   - Confirm the time is 8:00 AM

3. **Weekly Backfill Trigger (Mon 2am)**
   - Menu: **Waratah Tools > Admin Tools > Data Warehouse > Setup Weekly Backfill Trigger**
   - Confirm the time is 2:00 AM

#### On the **Waratah - Master Actionables** Spreadsheet (Task Management):

4. **Daily Staff Workload Trigger (6am)**
   - Menu: **Waratah Tools > Admin Tools > Setup Triggers > Create Daily Staff Workload Trigger (6am)**

5. **Auto-Sort Trigger (on edit)**
   - Menu: **Waratah Tools > Admin Tools > Setup Triggers > Create Edit Trigger (Auto-sort)**

6. **Weekly Task Summary Trigger (Mon 10am)**
   - Menu: **Waratah Tools > Admin Tools > Setup Triggers > Create Weekly Summary Trigger (Mon 10am)**

7. **Weekly Archive Trigger (Mon 6am)**
   - Menu: **Waratah Tools > Admin Tools > Setup Triggers > Create Weekly Archive Trigger (Mon 6am)**

8. **Overdue Summary Trigger (Sun 9am)**
   - Menu: **Waratah Tools > Admin Tools > Setup Triggers > Create Overdue Summary Trigger (Sun 9am)**

9. **Bi-Hourly Cleanup Trigger (Every 2hrs)**
   - Menu: **Waratah Tools > Admin Tools > Setup Triggers > Create Bi-Hourly Cleanup Trigger (Every 2hrs)**

**Do all 9.** Skipping any means that automation stays broken until you create it.

---

## Troubleshooting

> Quick solutions to the most common issues.

### Rollover Didn't Run on Monday

**Most likely cause:** Trigger was destroyed (usually by a code deployment).

**Fix:**
1. Recreate the rollover trigger (see [Triggers Were Destroyed](#triggers-were-destroyed-after-code-deployment) above)
2. Open **Waratah Tools > Admin Tools > Weekly Reports > Weekly Rollover (In-Place) > Run Rollover Now**
3. Enter admin password
4. Wait 1-2 minutes for completion

---

### Rollover Ran But Sheets Still Have Data

**This is not a bug.** Some cells contain formulas and are designed to keep showing values.

**Examples:**
- Net Revenue B34 (a formula that calculates from other inputs)
- Total Tips B36 (a formula)
- Labor Hours B38, Labor Cost B39 (formulas)

Data fields like revenue, cash, and notes should be empty. Formula fields will show a number — that's correct.

---

### Revenue Digest Shows $0 or Didn't Post

**Most likely cause:** Nightly reports weren't sent (no data in warehouse).

**Fix:**
1. Check that nightly reports were sent for all days this week
2. If any are missing, send them now
3. Manually trigger the digest: **Waratah Tools > Admin Tools > Weekly Digest > Send Revenue Digest (LIVE)**
4. Wait 30 seconds for the message to post to Slack

---

### Dates Are Wrong After Rollover

**Very rare.** This sometimes happens if there's a timezone mismatch.

**Fix:**
1. Run rollover again: **Waratah Tools > Admin Tools > Weekly Reports > Weekly Rollover (In-Place) > Run Rollover Now**
2. If dates are still wrong, contact technical support

---

### Archive PDF Is Missing from Google Drive

**Cause:** Rollover failed partway through.

**Fix:**
1. Run rollover again: **Waratah Tools > Admin Tools > Weekly Reports > Weekly Rollover (In-Place) > Run Rollover Now**
2. It will re-create the archive and finish cleanup

---

### Task Summaries Didn't Post Monday Morning

**Most likely cause:** Task management trigger was destroyed.

**Fix:**
1. Open the **Waratah - Master Actionables** spreadsheet
2. Go to **Waratah Tools > Admin Tools > Setup Triggers > Create Weekly Summary Trigger (Mon 10am)**
3. Enter admin password
4. Trigger is recreated; next Monday it will post

---

### Dashboard Shows Blank or Error

**Cause:** Dashboard formulas need to be rebuilt.

**Fix:**
1. Open **Data Warehouse** spreadsheet
2. Go to **Waratah Tools > Admin Tools > Analytics > Rebuild Analytics Dashboard** (or **Build Executive Dashboard**)
3. Enter admin password
4. Wait for completion message

---

## Need More Help?

> If you're still stuck, here's what to do.

- **For deployment issues or trigger problems:** Contact your technical support (they can verify triggers in Google Apps Script's trigger list)
- **For data warehouse or analytics questions:** Check the Data Warehouse spreadsheet's README sheet
- **For task management issues:** Check the Waratah - Master Actionables spreadsheet's instructions tab
- **For rollover-specific help:** Run the dry-run preview first (**Waratah Tools > Admin Tools > Weekly Reports > Weekly Rollover (In-Place) > Preview Rollover (Dry Run)**) to see what would happen without making changes

---

**Document Version:** 1.0
**Last Updated:** April 2, 2026 (Cell reference correction: Total Tips B36, Covers B37)
**For:** Waratah Managers
**Technical Review:** gas-code-review-agent
**Peer Review:** documentation-agent
