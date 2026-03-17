# Troubleshooting — Sakura House

**Last Updated:** March 18, 2026
**Type:** Handover guide for managers
**Audience:** Tech-savvy restaurant manager without coding knowledge

> This guide helps you diagnose and fix the most common problems that arise when managing the Sakura House shift reporting and task management systems. No code required — just follow the step-by-step instructions.

---

## Quick Diagnosis Checklist

> When something isn't working right, start here to figure out what kind of problem you're dealing with. It will point you to the exact section below.

Ask yourself these questions:

- **Did something stop running automatically?** (Like rollover didn't happen, digest didn't post, tasks didn't get cleaned up) → Go to **"Nothing Is Running Automatically"**

- **Is Slack not getting messages?** (Reports send to email but nothing appears in Slack) → Go to **"Slack Messages Aren't Posting"**

- **Are emails not arriving?** (PDF reports sent but didn't reach inboxes) → Go to **"Email Reports Aren't Arriving"**

- **Did the weekly rollover fail?** (Monday came and the sheets didn't clear for a new week) → Go to **"Rollover Didn't Work"**

- **Are you seeing error messages about named ranges?** (Script menu isn't working, extraction fails) → Go to **"Named Range Errors"**

- **Can't access the custom menu?** (The "Shift Report" or "Task Management" dropdowns disappeared) → Go to **"The Menu Disappeared"**

- **Don't know the admin password?** → Go to **"I Need to Change the Password"**

---

## Nothing Is Running Automatically

> The most common issue after a code deployment. Google Apps Script destroys scheduled triggers whenever anyone pushes an update. This isn't a bug — it's how Google Apps Script works. You need to recreate them.

### What Just Happened

All the scheduled jobs that run on their own (Monday rollover at 10am, revenue digest at 8am, daily task cleanup at 7am, etc.) were deleted when the code was updated. The spreadsheets are fine, but nothing automatic will happen until you recreate the triggers.

### How to Fix It — Shift Report Spreadsheet

Open the **"Sakura House - Current Week"** spreadsheet and recreate these four triggers:

| Trigger | What It Does | Menu Path |
|---------|-------------|-----------|
| **Rollover (Monday 10am)** | Clears all day sheets for a new week, archives last week's data | Shift Report > Admin Tools > Weekly Rollover > **Create Rollover Trigger (Mon 10am)** |
| **Revenue Digest (Monday 8am)** | Posts a summary to Slack comparing this week to last week | Shift Report > Admin Tools > Weekly Digest > **Setup Monday Digest Trigger** |
| **Weekly Backfill (Monday 2am)** | Backs up financial data to the warehouse for analytics | Shift Report > Admin Tools > Data Warehouse > **Setup Weekly Backfill Trigger** |

**Steps to recreate each trigger:**
1. Go to the menu path listed above
2. Click the menu item that says "Create..." or "Setup..."
3. When prompted, enter the admin password
4. You'll get a confirmation message — you're done for that trigger

All three triggers require the **admin password** (if you don't know it, see "I Need to Change the Password" below).

### How to Fix It — Sakura Actionables Sheet (Task Management)

Open the **"Sakura Actionables Sheet"** and recreate these four triggers:

| Trigger | What It Does | Menu Path |
|---------|-------------|-----------|
| **Daily Cleanup (7am)** | Removes old completed tasks, escalates overdue ones | Task Management > Admin Tools > Setup Triggers > **Create Daily Trigger (7am)** |
| **Edit Auto-sort (on edit)** | Automatically sorts tasks whenever someone edits the sheet | Task Management > Admin Tools > Setup Triggers > **Create Edit Trigger (Auto-sort)** |
| **Weekly Summary (Monday 6am)** | Posts a task summary to Slack | Task Management > Admin Tools > Setup Triggers > **Create Weekly Summary Trigger (Mon 6am)** |
| **Overdue Summary (Sunday 9pm)** | Posts overdue tasks to Slack on Sunday | Task Management > Admin Tools > Setup Triggers > **Create Overdue Summary Trigger (Sun 9pm)** |

**Steps to recreate each trigger:**
1. Go to the menu path listed above
2. Click the menu item that says "Create..."
3. When prompted, enter the admin password
4. Confirmation message = trigger is active

All four triggers also require the **admin password**.

---

## Slack Messages Aren't Posting

> Slack communicates with Google Apps Script via "webhook URLs" — special links that tell Slack where to send messages. These can expire or get revoked.

### How to Tell if This Is the Problem

1. Check your inbox — did the **email** arrive? (If yes, the export worked)
2. Check the test Slack channel — is there **anything there**?
3. If email arrived but Slack channel is empty, the webhook URL has likely expired or been deleted

### How to Fix It

You need to update the webhook URL in the Script Properties. This is a one-time fix.

**Steps:**

1. Open the **"Sakura House - Current Week"** spreadsheet
2. Go to **Extensions > Apps Script** (in the top menu)
3. On the left sidebar, click the **gear icon** (⚙️) next to "Project Settings"
4. Scroll down to **"Script Properties"** (it's a table)
5. Find the row that starts with `SAKURA_SLACK_WEBHOOK_LIVE` (or `_TEST` if you're fixing test notifications)
6. Click in the Value column for that row
7. Delete the old URL and paste the new one
8. Click **Save** button
9. Go back to the spreadsheet and try sending a test report: **Shift Report > Send Test Report**

If the test message appears in Slack, you're fixed.

**How to get a new webhook URL:**
- Contact your Slack workspace admin
- Ask them to create a new "Incoming Webhook" for the channel
- Copy the full URL (it starts with `https://hooks.slack.com/services/...`)
- Paste it into Script Properties as described above

---

## Email Reports Aren't Arriving

> PDF reports are sent through Gmail. If they're not arriving, it's usually because the recipient list is wrong or Gmail's spam filters caught them.

### Check These Things (In Order)

1. **Check spam/junk folder** — Google-generated PDFs sometimes get flagged as spam. Check your spam folder first.

2. **Check the recipient list** — The person expecting the email might not be in the system. See [SETUP_AND_CONFIG.md](SETUP_AND_CONFIG.md) for how to add someone to `SAKURA_EMAIL_RECIPIENTS`.

3. **Check Gmail daily limits** — Google Apps Script can send about 100 emails per day. If other scripts are also sending (very rare), you might hit the limit. Wait until the next day.

4. **Try a test report** — Go to **Shift Report > Send Test Report** and check if you receive it. If you get the test but not regular reports, the issue is with the recipient list, not the system.

### If None of That Works

1. Go to the Shift Reports spreadsheet
2. Open **Extensions > Apps Script**
3. Click **Executions** in the left sidebar
4. Look for a recent "NightlyExportSakura" entry with a red X
5. Click on it to see the error message
6. Take a screenshot and share it with your technical contact

---

## Rollover Didn't Work

> The rollover is the automated job that runs every Monday at 10am. It clears the data from the previous week, archives it, and gets the sheets ready for the new week.

### How to Check If Rollover Actually Ran

1. Look at the **MONDAY** tab of the Shift Reports spreadsheet
2. Does the date at the top say **this week**? (e.g., if today is March 18, does it show "W.E. March 25"?)
3. Are all the **data fields blank** except for the totals like Net Revenue? (It's normal for formulas like Net Revenue to still show values)
4. Check your **Google Drive** > **Archive** folder — is there a PDF with last week's data?

If all three are yes, rollover worked fine.

### If Rollover Didn't Run

**Check if the trigger exists:**
- Go to **Shift Report > Admin Tools > Weekly Rollover > Create Rollover Trigger (Mon 10am)**
- This will either create the trigger (if it's missing) or confirm it already exists
- Enter the admin password if prompted
- If it says "Created" or "Already exists," the trigger is now active

**Run it manually if needed:**
- Go to **Shift Report > Admin Tools > Weekly Rollover > Preview Rollover (Dry Run)** first
  - This shows you exactly what will happen **without changing anything**
  - Review the preview carefully
- If the preview looks right, go to **Shift Report > Admin Tools > Weekly Rollover > Run Rollover Now**
  - This actually performs the rollover
  - Password required

### If Rollover Ran But Data Wasn't Cleared

Some cells contain formulas (like the Net Revenue cell) and are intentionally not cleared — this is by design. But if regular data cells still have last week's values, there may be a named range issue.

**Fix it:**
1. Go to **Shift Report > Admin Tools > Set Up & Diagnostics**
2. Click **Force Update Named Ranges (ALL Sheets)**
3. Enter the admin password
4. Wait for the confirmation message

---

## Named Range Errors

> Sakura House uses a system called "named ranges" to find data reliably. These are like bookmarks for cells — they're labeled with names like "MONDAY_SR_NetRevenue" instead of relying on cell numbers. Sometimes these bookmarks go missing.

### What Are Named Ranges?

A named range is a label attached to a cell or group of cells. Instead of the system saying "go to cell B54," it says "go to the cell labeled MONDAY_SR_NetRevenue." This makes the system more resilient — if someone inserts a row, the labeled cell moves with it.

### If You See "Named Range Not Found" Errors

**Diagnose the problem:**
1. Go to **Shift Report > Admin Tools > Set Up & Diagnostics**
2. Click **Check Named Ranges (ALL Sheets)**
3. Enter the admin password
4. You'll see a report showing which ranges are missing

**Fix the missing ranges:**
1. Go back to **Shift Report > Admin Tools > Set Up & Diagnostics**
2. Click **Force Update Named Ranges (ALL Sheets)**
3. Enter the admin password
4. Wait for confirmation

This recreates all 144 named ranges based on the current cell layout.

### When Do Named Ranges Break?

- Someone manually deleted a named range in the Sheet menu (unlikely for managers)
- Columns or rows were inserted/deleted on a day sheet (edits to the template)
- After a rollover (the system auto-repairs these, but occasionally one is missed)

---

## The Menu Disappeared

> The custom "Shift Report" and "Task Management" menus should appear automatically when you open the spreadsheet. If they're gone, here's how to get them back.

### Quick Fixes (Try These First)

1. **Refresh the page** — Press **F5** (or **Cmd+R** on Mac) to reload the spreadsheet. Menus load when the page opens, so a fresh load usually fixes it.

2. **Wait 5-10 seconds** — Menus can take a moment to appear, especially on slow internet. Give the page a few seconds to finish loading.

3. **Close and reopen the spreadsheet** — Sometimes closing the tab and opening the sheet fresh fixes it.

### If That Doesn't Work

There may be an error in the script code preventing the menu from loading.

**Check for errors:**
1. Open the spreadsheet
2. Go to **Extensions > Apps Script** (in the top menu)
3. Look at the left sidebar — you might see a **red circle with an X** or **red error indicator**
4. Click on the file name that has the red indicator
5. You'll see red text highlighting the error in the code
6. Take a screenshot and share it with your technical contact

### Menu Still Missing?

Contact your technical support. Include:
- Which spreadsheet (Shift Report or Actionables?)
- When did the menu disappear? (After a deployment, after an edit, etc.)
- Did you see any error messages?

---

## I Need to Change the Password

> The admin password protects sensitive menu items in **BOTH** spreadsheets. If you change it, you must change it in **both places** so it matches.

### Steps

**Step 1: Update the Shift Reports Password**

1. Open the **"Sakura House - Current Week"** spreadsheet
2. Go to **Extensions > Apps Script**
3. On the left sidebar, click the **gear icon** (⚙️) next to "Project Settings"
4. Scroll down to **"Script Properties"**
5. Find the row with `MENU_PASSWORD`
6. Click in the Value column and replace the old password with the new one
7. Click **Save**

**Step 2: Update the Task Management Password**

1. Open the **"Sakura Actionables Sheet"** spreadsheet
2. Go to **Extensions > Apps Script**
3. On the left sidebar, click the **gear icon** (⚙️) next to "Project Settings"
4. Scroll down to **"Script Properties"**
5. Find the row with `MENU_PASSWORD`
6. Click in the Value column and replace the old password with the new one
7. Click **Save**

**Test it:**
- Go to either spreadsheet
- Try accessing an admin menu item (e.g., **Shift Report > Admin Tools > Setup & Diagnostics > Check Named Ranges**)
- Enter the new password
- If it works, you're done

> **Important:** Both properties must have the **exact same password** for the system to work correctly. If they don't match, one of the menus will have a password that doesn't work.

---

## How to View Logs (For Troubleshooting)

> If you need to see what happened behind the scenes — for example, to diagnose why an export failed — you can look at the script logs. This is useful information to share with technical support.

### Find the Logs

1. Open the relevant spreadsheet (**Shift Report** or **Actionables Sheet**)
2. Go to **Extensions > Apps Script**
3. In the left sidebar, click **Executions**
4. You'll see a list of recent script runs with timestamps
5. Look for a red **X mark** — that indicates an error

### Read the Error

1. Click on the row with the red X
2. Expand the error message (it may be long)
3. The text will show you what went wrong
4. Copy the error text and share it with support

### Useful Information to Include

When reporting a problem, share:
- Which spreadsheet (Shift Report or Actionables?)
- What were you trying to do? (Send a report? Run rollover?)
- When did it happen?
- Screenshot of the error message from the Executions log
- Screenshot of any error dialogs that appeared

---

## Emergency Contacts

> If you've tried the troubleshooting steps above and nothing worked, reach out for help.

| Contact Type | Who to Call | How to Reach |
|--------------|------------|-------------|
| Technical support | [Your technical contact] | [Email/phone] |
| Slack workspace admin | [Slack admin name] | Via Slack |

### What to Send When Reporting a Problem

To help your technical contact fix the issue quickly, include:

1. **What you were doing** — Step-by-step what you clicked or what action triggered the problem
2. **What you expected to happen** — What should have happened next?
3. **What actually happened** — Be specific (error message, nothing happened, wrong result, etc.)
4. **Screenshots** — Include screenshots of error messages or unexpected behavior
5. **Logs** — If applicable, copy the error text from the Apps Script Executions log (see "How to View Logs" above)
6. **When it happened** — Date and time (or "it was working yesterday but not today")

The more details you provide, the faster the fix.

---

## Most Common Problems (Quick Summary)

| Problem | Solution |
|---------|----------|
| Rollover didn't happen Monday morning | Recreate the Monday 10am trigger (see "Nothing Is Running Automatically") |
| No Slack messages but emails arrived | Update the webhook URL in Script Properties (see "Slack Messages Aren't Posting") |
| Emails not arriving | Check spam, verify recipient list, send test report (see "Email Reports Aren't Arriving") |
| Named range errors in menu | Run "Force Update Named Ranges (ALL Sheets)" from Admin Tools (see "Named Range Errors") |
| Menu disappeared | Refresh the page or reopen the spreadsheet (see "The Menu Disappeared") |
| Don't remember the password | Change it in both projects' Script Properties (see "I Need to Change the Password") |

---

**Need more help?**

- For shift reporting questions: See [DAILY_SHIFT_REPORT.md](DAILY_SHIFT_REPORT.md)
- For task management questions: See [WEEKLY_ROLLOVER_AND_DIGEST.md](WEEKLY_ROLLOVER_AND_DIGEST.md)
- For configuration questions: See [SETUP_AND_CONFIG.md](SETUP_AND_CONFIG.md)
