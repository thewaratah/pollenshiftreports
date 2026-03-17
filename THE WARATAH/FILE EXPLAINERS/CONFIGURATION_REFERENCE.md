# Configuration Reference — The Waratah

**Last Updated:** March 18, 2026
**Type:** Handover guide for managers
**Audience:** Restaurant managers taking over operations, comfortable with spreadsheets, no coding required
**Tone:** Clear, practical, friendly

---

## Two Spreadsheets, Two Sets of Settings

> The Waratah runs as two completely separate systems, each with its own spreadsheet and settings. Understanding this separation is the single most important thing to know about configuration.

| System | Spreadsheet | Purpose | Settings Count |
|--------|-------------|---------|-----------------|
| **Shift Reports** | The Waratah - Current Week | Daily financial reporting and shift documentation | 18 Script Properties |
| **Task Management** | Master Actionables Sheet | Team task tracking, escalation, and scheduling | 6 Script Properties |

**Critical Rule:** If you change a setting in the wrong spreadsheet, nothing will happen. Always make sure you're in the right one before making changes.

---

## How to View or Change Script Properties

> Script Properties are settings stored securely inside each spreadsheet's Apps Script project. Here's how to access and edit them.

### Step 1: Open the Right Spreadsheet
- For Shift Report settings: open **"The Waratah - Current Week"**
- For Task Management settings: open **"Master Actionables Sheet"**

### Step 2: Access the Script Editor
1. Click **Extensions** in the top menu
2. Click **Apps Script**
3. A new tab will open showing the Apps Script editor

### Step 3: View Script Properties
1. Click the **gear icon** (Project Settings) in the left sidebar
2. Scroll down to find **Script Properties**
3. You'll see a table with property names and values

### Step 4: Edit a Property
1. Find the property you need to change in the table
2. Click the **pencil icon** next to its value
3. Update the value (instructions for each property are below)
4. Click **Save**
5. Close the Apps Script tab to return to the spreadsheet

### Step 5: Verify Changes
1. Back in the spreadsheet, go to **Waratah Tools > Admin Tools > Setup & Diagnostics** (for SR) or look for a verification option in Task Management
2. Look for a "Verify" or "Check Configuration" option to confirm the property was saved

---

## Shift Report Settings (18 Properties)

> These settings control the Shift Report system — daily exports, Slack notifications, email recipients, and data warehousing. Found in the **The Waratah - Current Week** spreadsheet.

### Core Settings

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `VENUE_NAME` | Venue Identifier | Identifies this spreadsheet as The Waratah (value: `WARATAH`) | Never — don't change this |
| `MENU_PASSWORD` | Admin Password | Admin password for protected menu items | When you want to change the password (default: `chocolateteapot`) |

### Slack Webhooks

> Slack webhooks are URLs that let the system post messages to specific Slack channels. If messages stop appearing in Slack, one of these webhooks may have expired.

| Property | Friendly Name | Posts To | When You'd Change It |
|----------|---------------|----------|---------------------|
| `WARATAH_SLACK_WEBHOOK_LIVE` | Live Reports Hook | Main Slack channel for nightly shift reports | If the webhook expires or the channel changes |
| `WARATAH_SLACK_WEBHOOK_TEST` | Test/Dev Hook | Testing channel (used during setup and troubleshooting) | If the webhook expires |

### Email Recipients

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `WARATAH_EMAIL_RECIPIENTS` | PDF Email List | Who gets the nightly shift report PDF emailed | When staff join or leave |
| `INTEGRATION_ALERT_EMAIL_PRIMARY` | Primary Alert Email | Primary email for system problems (usually Evan) | When the primary contact person changes |
| `INTEGRATION_ALERT_EMAIL_SECONDARY` | Backup Alert Email | Backup email for system problems | When the backup contact person changes |

### Data & Files

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `WARATAH_DATA_WAREHOUSE_ID` | Data Warehouse ID | Spreadsheet ID of the central analytics database | If the warehouse is moved or rebuilt |
| `WARATAH_WORKING_FILE_ID` | Current Spreadsheet ID | Identifies the active shift report file | If the working file is replaced |
| `WARATAH_SHIFT_REPORT_CURRENT_ID` | Shift Report Backup ID | Backup reference to the current shift report file | If the working file is replaced |
| `WARATAH_CASH_RECON_FOLDER_ID` | Cash Reconciliation Folder | Google Drive folder for cash recon documents | If the folder is moved |
| `ARCHIVE_ROOT_FOLDER_ID` | Archive Folder | Google Drive folder where weekly reports are saved | If the archive folder is moved |
| `SLACK_MANAGERS_CHANNEL_WEBHOOK` | Managers Channel Hook | Slack channel where manager summaries are posted | If the webhook expires or channel changes |

### Task Management Links

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `WARATAH_TASK_MANAGEMENT_ID` | Task Sheet ID | Links shift reports to task management system | If the Actionables Sheet is recreated |
| `TASK_MANAGEMENT_SPREADSHEET_ID` | Task Sheet ID (Alias) | Alternative reference to the same Actionables Sheet | If the Actionables Sheet is recreated |

---

## Task Management Settings (6 Properties)

> These settings control the task system — who gets alerts, which Slack channels receive notifications, and individual staff direct messages. Found in the **Master Actionables Sheet** spreadsheet.

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `TASK_MANAGEMENT_SPREADSHEET_ID` | This Sheet's ID | The Master Actionables Sheet's own ID | If the sheet is recreated |
| `MENU_PASSWORD` | Admin Password | Admin password for task management menu (should match Shift Report password) | When you want to change the password |
| `ESCALATION_EMAIL` | Escalation Alert Email | Who gets notified about overdue/blocked tasks | When the responsible manager changes |
| `ESCALATION_SLACK_WEBHOOK` | Escalation Hook | Slack DM webhook for urgent task alerts | If the webhook expires or person changes |
| `SLACK_MANAGERS_CHANNEL_WEBHOOK` | Managers Channel Hook | Slack channel for weekly task summaries | If the webhook expires or channel changes |
| `SLACK_DM_WEBHOOKS` | Individual Staff DMs | Slack direct message webhooks for each staff member | When staff join, leave, or webhooks expire |

---

## Changing Email Recipients

> The email recipient list is stored as a special text format (JSON). Here's how to read and edit it safely.

### Current Email Recipients

The `WARATAH_EMAIL_RECIPIENTS` property currently contains:

```
{"evan@pollenhospitality.com":"Evan","cynthia@pollenhospitality.com":"Cynthia","dipti@pollenhospitality.com":"Dipti","chef@pollenhospitality.com":"Chef","howie@pollenhospitality.com":"Howie","adam@pollenhospitality.com":"Adam","lily@pollenhospitality.com":"Lily"}
```

### How to Read the Format

Breaking down the structure:
- Start with `{` and end with `}`
- Each person is: `"email@address.com":"Display Name"`
- People are separated by commas `,`
- No comma after the last person

### To Add Someone

1. Copy the current value from Script Properties
2. Find the closing `}` at the end
3. Before that `}`, add: `,"newemail@pollenhospitality.com":"Their Name"`
4. Save

**Example — adding a new staff member:**
```
{"evan@pollenhospitality.com":"Evan","cynthia@pollenhospitality.com":"Cynthia","dipti@pollenhospitality.com":"Dipti","chef@pollenhospitality.com":"Chef","howie@pollenhospitality.com":"Howie","adam@pollenhospitality.com":"Adam","lily@pollenhospitality.com":"Lily","newperson@pollenhospitality.com":"New Person"}
```

### To Remove Someone

1. Find their line: `,"email@example.com":"Name"` or `"email@example.com":"Name",`
2. Delete the entire line (including the comma)
3. Save

**Example — removing Howie from the list:**
```
{"evan@pollenhospitality.com":"Evan","cynthia@pollenhospitality.com":"Cynthia","dipti@pollenhospitality.com":"Dipti","chef@pollenhospitality.com":"Chef","adam@pollenhospitality.com":"Adam","lily@pollenhospitality.com":"Lily"}
```

### Common Mistakes to Avoid

| Mistake | What Happens | How to Fix |
|---------|--------------|-----------|
| Forgetting quotes around email | System rejects the value | Wrap email in `"` like `"email@pollenhospitality.com"` |
| Forgetting quotes around name | System rejects the value | Wrap name in `"` like `"John"` |
| Using single quotes `'` instead of double quotes `"` | System rejects the value | Replace all `'` with `"` |
| Leaving a trailing comma before the closing `}` | System rejects the value | Delete the comma before `}` |
| Comma between email and name instead of colon | System rejects the value | Use `:` between email and name, not `,` |

### How to Test Your Changes

After editing `WARATAH_EMAIL_RECIPIENTS`:
1. Go back to the spreadsheet
2. Go to **Waratah Tools > Admin Tools > Setup & Diagnostics**
3. Run a verification command if available
4. Look for any error messages about the email property

---

## Changing Slack Webhooks

> Slack webhooks are URLs that let the system post messages. They can expire or be revoked by a Slack admin. Here's when and how to update them.

### When You Need a New Webhook

- **Messages stopped appearing in Slack** but emails still work
- A Slack admin revoked the old webhook
- You want to post to a different channel
- The webhook shows an error in the system logs

### How to Get a New Webhook

1. Go to your Slack workspace
2. Click the workspace name in the top left, then **Settings & administration > App management**
3. Find **Incoming Webhooks** (or ask your Slack admin where it is)
4. Create a new webhook for the channel where you want messages to appear
5. Copy the webhook URL (it starts with `https://hooks.slack.com/services/...`)
6. Update the appropriate property in Script Properties (see the tables above)

### Webhook Property Reference

| Property | Channel/Purpose | How Often to Check |
|----------|-----------------|-------------------|
| `WARATAH_SLACK_WEBHOOK_LIVE` | Shift reports | Daily (messages should appear after ~11pm) |
| `WARATAH_SLACK_WEBHOOK_TEST` | Testing and diagnostics | Only when testing |
| `SLACK_MANAGERS_CHANNEL_WEBHOOK` | Manager summaries and alerts | Weekly (Monday mornings) |
| `ESCALATION_SLACK_WEBHOOK` | Escalation alerts | When overdue/blocked tasks exist |

---

## Changing Staff for Task Notifications

> When someone joins or leaves the team, you need to update settings so they get (or stop getting) individual task notifications and appear in the staff dropdown menus.

### Three Things to Update

#### 1. Update Task Staff DM Webhooks (SLACK_DM_WEBHOOKS)

This is in the **Master Actionables Sheet** Script Properties.

**Current format:**
```
{"Evan":"https://hooks.slack.com/services/...","Cynthia":"...","Adam":"...","Lily":"...","Dipti":"..."}
```

Note: Howie is configured with an empty webhook (no DM notifications).

**To add someone:**
- Get their Slack DM webhook URL from your Slack admin
- Add: `,"Their Name":"webhook_url"` before the closing `}`
- Staff names MUST match exactly what's in the "Staff Allocated" dropdown

**To remove someone:**
- Delete their entry: `,"Name":"webhook_url"`

#### 2. Update Staff Dropdown (in the Master Actionables Sheet)

The "Staff Allocated" column (Column C) has a dropdown list.

**To update the dropdown:**
1. Open the Master Actionables Sheet
2. Click on any cell in the "Staff Allocated" column
3. Go to **Data > Data Validation**
4. Update the list to match your current team
5. Click Done

**Alternative:** Run the menu option to reapply:
- **Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting**

#### 3. Update Task Assignment Staff (Column F)

The task assignment column (Column F in the task rows) may also have a staff dropdown.

**To update it:**
1. Open the Master Actionables Sheet
2. Go to the task rows (rows 53-61 or wherever tasks are)
3. Click on any cell in Column F (staff assignment)
4. Go to **Data > Data Validation**
5. Update the list to match your current team

---

## Complete Trigger Reference

> Automated triggers make the system run on a schedule. After any code deployment, ALL triggers need to be recreated. Here's the complete list.

### What is a Trigger?

> A trigger is an instruction that makes the system do something automatically on a schedule — like sending a digest email every Monday morning or resetting the spreadsheet weekly.

### All Triggers in The Waratah

#### Shift Report Spreadsheet (The Waratah - Current Week)

| Trigger Name | What It Does | When It Runs | Menu Path to Set Up |
|--------------|-------------|--------------|-------------------|
| **Weekly Rollover** | Resets the spreadsheet for the new week and archives previous week | Monday 10:00 AM | Waratah Tools > Weekly Reports > Weekly Rollover (In-Place) > Create Rollover Trigger |
| **Revenue Digest** | Posts weekly revenue comparison and summary to Slack | Wednesday 8:00 AM | Waratah Tools > Weekly Digest > Setup Wednesday Digest Trigger |
| **Weekly Backfill** | Backfills shift data to the central data warehouse | Monday 2:00 AM | Waratah Tools > Data Warehouse > Setup Weekly Backfill Trigger |

#### Task Management Spreadsheet (Master Actionables Sheet)

| Trigger Name | What It Does | When It Runs | Menu Path to Set Up |
|--------------|-------------|--------------|-------------------|
| **Auto-sort** | Automatically sorts and formats tasks when spreadsheet is edited | On every edit | Task Management > Admin Tools > Setup Triggers > Create Edit Trigger (Auto-sort) |
| **Weekly Summary** | Sends weekly task summary to Slack on Monday morning | Monday 9:00 AM | Task Management > Admin Tools > Setup Triggers > Create Weekly Summary Trigger (Mon 9am) |
| **Bi-hourly Cleanup** | Cleans up completed tasks and maintains data integrity | Every 2 hours | Task Management > Admin Tools > Setup Triggers > Create Bi-Hourly Cleanup Trigger (Every 2hrs) |
| **Daily Staff Workload** | Sends daily workload summary to each staff member | Daily 6:00 AM | Task Management > Admin Tools > Setup Triggers > Create Daily Staff Workload Trigger (6am) |
| **Weekly Archive** | Archives completed tasks to maintain clean tracking | Monday 6:00 AM | Task Management > Admin Tools > Setup Triggers > Create Weekly Archive Trigger (Mon 6am) |
| **Overdue Summary** | Notifies about overdue tasks that need attention | Sunday 9:00 AM | Task Management > Admin Tools > Setup Triggers > Create Overdue Summary Trigger (Sun 9am) |

### After Code Deployment

> After someone deploys new code (via `clasp push`), all triggers are destroyed. Here's what to do:

1. Open the **Shift Report** spreadsheet (The Waratah - Current Week)
2. Go to **Waratah Tools > Weekly Reports > Weekly Rollover (In-Place) > Create Rollover Trigger**
3. Go to **Waratah Tools > Weekly Digest > Setup Wednesday Digest Trigger**
4. Go to **Waratah Tools > Data Warehouse > Setup Weekly Backfill Trigger**
5. Open the **Master Actionables Sheet** spreadsheet
6. Go to **Task Management > Admin Tools > Setup Triggers** and recreate all 6 triggers

**How to know if it worked:**
- The menu should show a success message (green dialog)
- You can verify in the Apps Script editor by going to Extensions > Apps Script, then clicking **Triggers** (the alarm clock icon) in the left sidebar

---

## Google Drive Folder Structure

> Weekly archives are saved to a specific folder in Google Drive. Keep this structure intact.

### Archive Folder Layout

```
Archive Root (the folder with ID in ARCHIVE_ROOT_FOLDER_ID)
    └── 2026/
        ├── 2026-02/
        │   ├── pdfs/
        │   │   ├── Waratah Shift Report W.E. 09.02.2026.pdf
        │   │   └── Waratah Shift Report W.E. 16.02.2026.pdf
        │   └── sheets/
        │       ├── Waratah Shift Report W.E. 09.02.2026
        │       └── Waratah Shift Report W.E. 16.02.2026
        └── 2026-03/
            ├── pdfs/
            └── sheets/
```

### What Gets Stored

- **pdfs/** — PDF files of all 5 day sheets (Wed-Sun) from that week
- **sheets/** — Full spreadsheet snapshots (copies of the entire working file)

### Why This Matters

> Don't move or rename the archive folder. The system looks for it by ID stored in Script Properties. If it's moved, the rollover will fail when it tries to save archives.

### Manually Finding the Archive Folder

If you need to access archives:
1. Copy the value of `ARCHIVE_ROOT_FOLDER_ID` from Script Properties
2. Go to Google Drive and use the search box
3. Paste the ID to find the folder
4. Do NOT rename or move it

---

## Things You Should Never Change

> Some parts of the system are load-bearing. Changing these will break functionality.

### Spreadsheet Layout (Never Insert/Delete Rows or Columns)

> The Waratah uses hardcoded cell references, not named ranges. Every cell address is built into the code. If you add or remove rows and columns, the entire system breaks.

**Don't do this:**
- ❌ Insert a new row in the middle of the financial section
- ❌ Delete a column to rearrange data
- ❌ Move cells around on the day sheets

**What happens if you do:**
- The code looks for B34 (Net Revenue) but finds something else
- Formulas break
- Data doesn't get warehoused correctly
- Reports export with wrong values

**If you need to rearrange:** Contact the development team to update the hardcoded cell references first.

### Formula Cells (Never Type Into)

> The Waratah calculates certain values automatically using formulas. If you type into these cells, the formula disappears and must be manually re-entered.

| Cell | Formula | Why | What It Calculates |
|------|---------|-----|-------------------|
| **B34** | Net Revenue | Automatic calculation | Total revenue minus tips and adjustments |
| **B36** | Covers | Automatic calculation | Guest count for the shift |
| **B37** | Total Tips | Automatic calculation | Card tips + Cash tips |
| **B38** | Labor Hours | Automatic calculation | Total staff hours worked |
| **B39** | Labor Cost | Automatic calculation | Total payroll cost |
| **B15, B16** | Cash calculations | Automatic calculations | Cash takings breakdown |
| **B26-B29** | Discount/tax breakdowns | Automatic calculations | Sales adjustments and taxes |

**Rule:** If a cell shows a calculated value (like $5,234.50), don't type into it.

### Sheet Tab Names (Never Rename)

> Sheet tabs must start with the day name. The system uses this to know which tab is Wednesday, which is Thursday, etc.

**Don't do this:**
- ❌ Rename `WEDNESDAY 20/03/2026` to `Wednesday Week 1`
- ❌ Delete and recreate `THURSDAY 20/03/2026`
- ❌ Change the operating day order

**What happens after rollover:**
- Tab names are automatically updated by the system to the next week's dates
- This is normal and expected
- Always use the standard format: `WEDNESDAY 20/03/2026`

### VENUE_NAME Property (Never Change)

> This setting MUST stay as `WARATAH`. Changing it to something else will confuse every part of the system.

### Spreadsheet IDs (Update Only If File Replaced)

> These IDs link to other spreadsheets. Only change them if you've actually recreated or moved a spreadsheet.

| Property | Links To | When to Update |
|----------|----------|-----------------|
| `WARATAH_DATA_WAREHOUSE_ID` | The central analytics spreadsheet | Only if the warehouse is recreated |
| `WARATAH_WORKING_FILE_ID` | This spreadsheet (current week) | Only if the working file is replaced |
| `WARATAH_TASK_MANAGEMENT_ID` | The Master Actionables Sheet | Only if the Actionables Sheet is recreated |

**If you get a wrong ID:** The integrations will silently fail — data won't flow between systems but you won't see an error message.

---

## Passwords

> The Waratah has two admin passwords (which should be the same).

### Password Locations

| Password | Used For | Stored In |
|----------|----------|-----------|
| `MENU_PASSWORD` | Shift Report admin menu | Shift Report Script Properties |
| `MENU_PASSWORD` | Task Management admin menu | Task Management Script Properties |

### How to Change Passwords

1. Update `MENU_PASSWORD` in the **Shift Report** Script Properties
2. Update `MENU_PASSWORD` in the **Task Management** Script Properties (same value)
3. Close and re-open the spreadsheets to test

### Current Password

> Default password: `chocolateteapot` (you should change this to something secure)

### Password Protection

These menu items require the password:
- All **Admin Tools** in the Waratah Tools menu
- All **Admin Tools** in the Task Management menu
- Test/development functions

These menu items do NOT require the password:
- "Export & Email PDF (LIVE)" (staff can run this anytime)
- "Export & Email PDF (TEST)" (for verification)
- "Open Task Manager" (opens the task tracker)

---

## Common Configuration Tasks

> Quick reference for the most common changes you'll make.

### Task: Update Email Recipients

**Steps:**
1. Open "The Waratah - Current Week"
2. Go to Extensions > Apps Script
3. Click gear icon > Script Properties
4. Find `WARATAH_EMAIL_RECIPIENTS`
5. Click the pencil icon and edit (follow the instructions under "Changing Email Recipients" above)
6. Click Save

### Task: Update Slack Webhook

**Steps:**
1. Get the new webhook URL from your Slack admin
2. Open the relevant spreadsheet (Shift Report or Task Management)
3. Go to Extensions > Apps Script
4. Click gear icon > Script Properties
5. Find the webhook property (e.g., `WARATAH_SLACK_WEBHOOK_LIVE`)
6. Click the pencil icon and paste the new URL
7. Click Save
8. Test by running the associated command or waiting for the scheduled time

### Task: Add a New Staff Member

**Steps:**
1. Add their name to "Staff Allocated" column in Master Actionables Sheet
2. Get their Slack DM webhook from your Slack admin
3. Open "Master Actionables Sheet" > Extensions > Apps Script
4. Click gear icon > Script Properties
5. Find `SLACK_DM_WEBHOOKS`
6. Click pencil, add: `,"Their Name":"webhook_url"` before the closing `}`
7. Click Save
8. Run: Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting

### Task: Change Admin Password

**Steps:**
1. Open "The Waratah - Current Week" > Extensions > Apps Script
2. Click gear icon > Script Properties
3. Find `MENU_PASSWORD`
4. Click pencil, change to new password, Save
5. Repeat for "Master Actionables Sheet"

### Task: Check if System is Working

**Steps:**
1. Open "The Waratah - Current Week"
2. Go to **Waratah Tools > Admin Tools > Setup & Diagnostics**
3. Run any available verification command — should show "OK" status
4. Open "Master Actionables Sheet"
5. Go to **Task Management > Admin Tools** and look for a verification or status option

---

## When Things Go Wrong

> Quick troubleshooting for common issues.

| Issue | Possible Cause | First Steps |
|-------|---|---|
| Slack messages stopped | Webhook expired or was revoked | Get new webhook from Slack admin, update in Script Properties |
| Email not received | Email list wrong or provider issue | Verify `WARATAH_EMAIL_RECIPIENTS` format (see "Changing Email Recipients" above) |
| Rollover didn't run Monday morning | Trigger destroyed after code deployment | Recreate triggers (see "Complete Trigger Reference" above) |
| Staff dropdown missing someone | Dropdown wasn't updated | Run Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting |
| System says "Cell reference wrong" | Spreadsheet layout was modified | Check that all rows/columns are intact (see "Spreadsheet Layout" above) |
| System says "File ID wrong" | WARATAH_WORKING_FILE_ID doesn't match | Don't change unless the working file was actually replaced |
| Task notifications not sending | Staff DM webhooks out of date | Update `SLACK_DM_WEBHOOKS` in Script Properties (see "Changing Staff for Task Notifications" above) |
| Formula cells showing #ERROR | Formula was accidentally cleared during rollover | Wait for next rollover or manually re-enter formula |

---

## Need More Detail?

> These guides have deeper technical information if you need it.

| Topic | Document | Where to Find |
|-------|----------|----------------|
| Script Properties and initial setup | SETUP_AND_CONFIG.md | THE WARATAH/FILE EXPLAINERS/ |
| Weekly rollover details | WEEKLY_ROLLOVER_AND_DIGEST.md | THE WARATAH/FILE EXPLAINERS/ |
| Slack message setup | SLACK_INTEGRATION.md | THE WARATAH/FILE EXPLAINERS/ |
| All file code explanations | NIGHTLY_EXPORT_PIPELINE.md, UI_AND_HTML.md, ANALYTICS_AND_TESTING.md | THE WARATAH/FILE EXPLAINERS/ |
| Deep architecture | DEEP_DIVE_ARCHITECTURE.md | docs/waratah/ |
| Integration flows | INTEGRATION_FLOWS.md | docs/waratah/ |
| Cell reference map | CELL_REFERENCE_MAP.md | docs/waratah/ |

---

## Quick Links

- **Shift Report menu:** Waratah Tools > Admin Tools > [what you need]
- **Task Management menu:** Task Management > Admin Tools > [what you need]
- **Script Properties:** Any spreadsheet > Extensions > Apps Script > Gear icon > Script Properties
- **Apps Script Triggers:** Any spreadsheet > Extensions > Apps Script > Alarm clock icon > Triggers

---

**Last Updated:** March 18, 2026
**Version:** 1.0 — Manager Handover Edition
**Status:** Ready for production use
