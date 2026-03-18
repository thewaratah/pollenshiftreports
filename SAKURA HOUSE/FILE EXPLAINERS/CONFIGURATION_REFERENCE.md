# Configuration Reference — Sakura House

**Last Updated:** March 18, 2026 (ANTHROPIC_API_KEY, M2-M9 features)
**Type:** Handover guide for managers
**Audience:** Restaurant managers taking over operations, comfortable with spreadsheets, no coding required
**Tone:** Clear, practical, friendly

---

## Two Spreadsheets, Two Sets of Settings

> Sakura House runs as two completely separate systems, each with its own spreadsheet and settings. This is the single most important thing to understand about configuration.

| System | Spreadsheet | Purpose | Settings Count |
|--------|-------------|---------|-----------------|
| **Shift Reports** | Sakura House - Current Week | Daily financial reporting and shift documentation | 13 Script Properties |
| **Task Management** | Sakura Actionables Sheet | Team task tracking, escalation, and scheduling | 7 Script Properties |

**Critical Rule:** If you change a setting in the wrong spreadsheet, nothing will happen. Always make sure you're in the right one before making changes.

---

## How to View or Change Script Properties

> Script Properties are settings stored securely inside each spreadsheet's Apps Script project. Here's how to access and edit them.

### Step 1: Open the Right Spreadsheet
- For Shift Report settings: open **"Sakura House - Current Week"**
- For Task Management settings: open **"Sakura Actionables Sheet"**

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
1. Back in the spreadsheet, go to **Shift Report > Admin Tools > Setup & Diagnostics** (for SR) or **Task Management > Admin Tools** (for TM)
2. Look for a "Verify" or "Check Configuration" option to confirm the property was saved

---

## Shift Report Settings (13 Properties)

> These settings control the Shift Report system — daily exports, Slack notifications, email recipients, and data warehousing. Found in the **Sakura House - Current Week** spreadsheet.

### Core Settings

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `VENUE_NAME` | Venue Identifier | Identifies this spreadsheet as Sakura House (value: `SAKURA`) | Never — don't change this |
| `MENU_PASSWORD` | Admin Password | Admin password for protected menu items | When you want to change the password (default: `chocolateteapot`) |
| `ANTHROPIC_API_KEY` | Claude API Key | Enables AI features: shift summarisation, anomaly detection, task classification | When you renew the API key, or to disable AI features by leaving blank |

**Note on ANTHROPIC_API_KEY:** This is optional. If you don't set it, or if it's invalid, the system will skip AI features gracefully — reports still send, anomaly detection won't post alerts, and tasks won't be auto-classified. The system was designed to keep working even without an API key, so you can enable AI features later if you want.

### Slack Webhooks

> Slack webhooks are URLs that let the system post messages to specific Slack channels. If messages stop appearing in Slack, one of these webhooks may have expired.

| Property | Friendly Name | Posts To | When You'd Change It |
|----------|---------------|----------|---------------------|
| `SAKURA_SLACK_WEBHOOK_LIVE` | Live Reports Hook | Main Slack channel for nightly shift reports | If the webhook expires or the channel changes |
| `SAKURA_SLACK_WEBHOOK_TEST` | Test/Dev Hook | Testing channel (used during setup and troubleshooting) | If the webhook expires |
| `SAKURA_SLACK_WEBHOOK_DATAWAREHOUSE` | Data Warehouse Hook | Data warehouse integration alerts | If the webhook expires |
| `SAKURA_SLACK_WEBHOOK_CASH_NOTIFICATIONS` | Cash Alerts Hook | Cash-related alerts and notifications | If the webhook expires |

### Email Recipients

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `SAKURA_EMAIL_RECIPIENTS` | PDF Email List | Who gets the nightly shift report PDF emailed | When staff join or leave |
| `INTEGRATION_ALERT_EMAIL_PRIMARY` | Primary Alert Email | Primary email for system problems (usually Evan) | When the primary contact person changes |
| `INTEGRATION_ALERT_EMAIL_SECONDARY` | Backup Alert Email | Backup email for system problems | When the backup contact person changes |

### Data & Files

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `SAKURA_DATA_WAREHOUSE_ID` | Data Warehouse ID | Spreadsheet ID of the central analytics database | If the warehouse is moved or rebuilt |
| `SAKURA_WORKING_FILE_ID` | Current Spreadsheet ID | Identifies the active shift report file | If the working file is replaced |
| `ARCHIVE_ROOT_FOLDER_ID` | Archive Folder | Google Drive folder where weekly reports are saved | If the archive folder is moved |
| `TASK_MANAGEMENT_SPREADSHEET_ID` | Task Sheet ID | Links shift reports to task management system | If the Actionables Sheet is recreated |

---

## Task Management Settings (7 Properties)

> These settings control the task system — who gets alerts, which Slack channels receive notifications, and individual staff direct messages. Found in the **Sakura Actionables Sheet** spreadsheet.

| Property | Friendly Name | What It Controls | When You'd Change It |
|----------|---------------|-----------------|---------------------|
| `TASK_MANAGEMENT_SPREADSHEET_ID` | This Sheet's ID | The Actionables Sheet's own ID | If the sheet is recreated |
| `MENU_PASSWORD` | Admin Password | Admin password for task management menu (should match Shift Report password) | When you want to change the password |
| `ESCALATION_EMAIL` | Escalation Alert Email | Who gets notified about overdue/blocked tasks | When the responsible manager changes |
| `ESCALATION_SLACK_WEBHOOK` | Escalation Hook | Slack DM webhook for urgent task alerts | If the webhook expires or person changes |
| `SLACK_MANAGERS_CHANNEL_WEBHOOK` | Managers Channel Hook | Slack channel for weekly task summaries | If the webhook expires or channel changes |
| `SLACK_FOH_LEADS_WEBHOOK` | FOH Leads Hook | Slack channel for front-of-house team (Evan, Gooch, Sabine, Kalisha) | If the webhook expires or team changes |
| `SLACK_DM_WEBHOOKS` | Individual Staff DMs | Slack direct message webhooks for each staff member | When staff join, leave, or webhooks expire |

---

## Changing Email Recipients

> The email recipient list is stored as a special text format (JSON). Here's how to read and edit it safely.

### Current Email Recipients

The `SAKURA_EMAIL_RECIPIENTS` property currently contains:

```
{"evan@sakurahousesydney.com":"Evan","kalisha@sakurahousesydney.com":"Kalisha","tom@sakurahousesydney.com":"Gooch","nick@sakurahousesydney.com":"Nick","cynthia@sakurahousesydney.com":"Cynthia","adam@pollenhospitality.com":"Adam"}
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
3. Before that `}`, add: `,"newemail@example.com":"Their Name"`
4. Save

**Example — adding Lily:**
```
{"evan@sakurahousesydney.com":"Evan","kalisha@sakurahousesydney.com":"Kalisha","tom@sakurahousesydney.com":"Gooch","nick@sakurahousesydney.com":"Nick","cynthia@sakurahousesydney.com":"Cynthia","adam@pollenhospitality.com":"Adam","lily@sakurahousesydney.com":"Lily"}
```

### To Remove Someone

1. Find their line: `,"email@example.com":"Name"` or `"email@example.com":"Name",`
2. Delete the entire line (including the comma)
3. Save

**Example — removing Cynthia:**
```
{"evan@sakurahousesydney.com":"Evan","kalisha@sakurahousesydney.com":"Kalisha","tom@sakurahousesydney.com":"Gooch","nick@sakurahousesydney.com":"Nick","adam@pollenhospitality.com":"Adam"}
```

### Common Mistakes to Avoid

| Mistake | What Happens | How to Fix |
|---------|--------------|-----------|
| Forgetting quotes around email | System rejects the value | Wrap email in `"` like `"email@example.com"` |
| Forgetting quotes around name | System rejects the value | Wrap name in `"` like `"John"` |
| Using single quotes `'` instead of double quotes `"` | System rejects the value | Replace all `'` with `"` |
| Leaving a trailing comma before the closing `}` | System rejects the value | Delete the comma before `}` |
| Comma between email and name instead of colon | System rejects the value | Use `:` between email and name, not `,` |

### How to Test Your Changes

After editing `SAKURA_EMAIL_RECIPIENTS`:
1. Go back to the spreadsheet
2. Go to **Shift Report > Admin Tools > Setup & Diagnostics**
3. Run "Check Named Ranges (THIS Sheet)" or similar
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
| `SAKURA_SLACK_WEBHOOK_LIVE` | Shift reports | Daily (messages should appear after 11pm) |
| `SAKURA_SLACK_WEBHOOK_TEST` | Testing only | Only when testing |
| `SAKURA_SLACK_WEBHOOK_DATAWAREHOUSE` | Data warehouse | Weekly (if using warehouse features) |
| `SAKURA_SLACK_WEBHOOK_CASH_NOTIFICATIONS` | Cash alerts | Varies (depends on usage) |
| `ESCALATION_SLACK_WEBHOOK` | Escalation alerts | When overdue tasks exist |
| `SLACK_MANAGERS_CHANNEL_WEBHOOK` | Manager summaries | Weekly (Monday mornings) |
| `SLACK_FOH_LEADS_WEBHOOK` | FOH team summaries | Weekly (Monday mornings) |

---

## Changing Staff for Task Notifications

> When someone joins or leaves the team, you need to update settings so they get (or stop getting) individual task notifications and appear in the staff dropdown menus.

### Three Things to Update

#### 1. Update Task Staff DM Webhooks (SLACK_DM_WEBHOOKS)

This is in the **Sakura Actionables Sheet** Script Properties.

**Current format:**
```
{"Evan":"https://hooks.slack.com/services/...","Nick":"...","Gooch":"...","Adam":"...","Cynthia":"...","Kalisha":"...","Sabine":"..."}
```

**To add someone:**
- Get their Slack DM webhook URL from your Slack admin
- Add: `,"Their Name":"webhook_url"` before the closing `}`
- Staff names MUST match exactly what's in the "Staff Allocated" dropdown

**To remove someone:**
- Delete their entry: `,"Name":"webhook_url"`

#### 2. Update Staff Dropdown (in the Actionables Sheet)

The "Staff Allocated" column (Column C) has a dropdown list.

**To update the dropdown:**
1. Open the Sakura Actionables Sheet
2. Click on any cell in the "Staff Allocated" column
3. Go to **Data > Data Validation**
4. Update the list to match your current team
5. Click Done

**Alternative:** Run the menu option to reapply:
- **Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting**

#### 3. Update Shift Report Staff Dropdown

If the staff member should appear as assignees for shift TO-DOs, update the dropdown on the day sheets too.

**To find it:**
1. Open the Sakura House - Current Week spreadsheet
2. Go to any day sheet (MONDAY, TUESDAY, etc.)
3. Look for the "Staff" column in the TO-DOs section
4. If there's a dropdown, click Data > Data Validation to edit it

---

## Complete Trigger Reference

> Automated triggers make the system run on a schedule. After any code deployment, ALL triggers need to be recreated. Here's the complete list.

### What is a Trigger?

> A trigger is an instruction that makes the system do something automatically on a schedule — like sending a digest email every Monday morning or resetting the spreadsheet weekly.

### All Triggers in Sakura House

#### Shift Report Spreadsheet

| Trigger Name | What It Does | When It Runs | Menu Path to Set Up |
|--------------|-------------|--------------|-------------------|
| **Weekly Rollover** | Resets the spreadsheet and archives last week | Monday 10:00 AM | Shift Report > Admin Tools > Weekly Rollover (In-Place) > Create Rollover Trigger (Mon 10am) |
| **Revenue Digest** | Posts weekly revenue comparison to Slack | Monday 8:00 AM | Shift Report > Admin Tools > Weekly Digest > Setup Monday Digest Trigger |
| **Weekly Backfill** | Backfills old data to the data warehouse | Monday 2:00 AM | Shift Report > Admin Tools > Data Warehouse > Setup Weekly Backfill Trigger |
| **Backfill This Sheet** *(on-demand, not a trigger)* | Manually pushes the active day sheet to the warehouse — navigate to the target day sheet first | Run manually when needed | Shift Report > Admin Tools > Data Warehouse > Backfill This Sheet to Warehouse |

#### Task Management Spreadsheet (Sakura Actionables Sheet)

| Trigger Name | What It Does | When It Runs | Menu Path to Set Up |
|--------------|-------------|--------------|-------------------|
| **Daily Maintenance** | Processes daily task updates and notifications | Daily 7:00 AM | Task Management > Admin Tools > Setup Triggers > Create Daily Trigger (7am) |
| **Auto-sort** | Automatically sorts and formats tasks | On every edit | Task Management > Admin Tools > Setup Triggers > Create Edit Trigger (Auto-sort) |
| **Weekly Summary** | Sends weekly task summary to Slack | Monday 6:00 AM | Task Management > Admin Tools > Setup Triggers > Create Weekly Summary Trigger (Mon 6am) |
| **Overdue Summary** | Notifies about overdue tasks | Sunday 9:00 AM | Task Management > Admin Tools > Setup Triggers > Create Overdue Summary Trigger (Sun 9am) |

### After Code Deployment

> After someone deploys new code (via `clasp push`), all triggers are destroyed. Here's what to do:

1. Open the **Shift Report** spreadsheet
2. Go to **Shift Report > Admin Tools > Weekly Rollover (In-Place) > Create Rollover Trigger (Mon 10am)**
3. Go to **Shift Report > Admin Tools > Weekly Digest > Setup Monday Digest Trigger**
4. Open the **Sakura Actionables Sheet** spreadsheet
5. Go to **Task Management > Admin Tools > Setup Triggers** and recreate all 4 triggers

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
        │   │   ├── Sakura Shift Report W.E. 09.02.2026.pdf
        │   │   └── Sakura Shift Report W.E. 16.02.2026.pdf
        │   └── sheets/
        │       ├── Sakura Shift Report W.E. 09.02.2026
        │       └── Sakura Shift Report W.E. 16.02.2026
        └── 2026-03/
            ├── pdfs/
            └── sheets/
```

### What Gets Stored

- **pdfs/** — PDF files of all 6 day sheets from that week
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

### Formula Cells (Never Type Into)

| Cell | Formula | Why | What It Calculates |
|------|---------|-----|-------------------|
| **B54** | Net Revenue | Automatic calculation from other inputs | Total revenue minus tips and account adjustments |

The system auto-calculates this value. If you type into it, the formula disappears and must be manually re-entered.

**Rule:** If a cell has a formula, don't type into it.

### Named Ranges (Never Delete Manually)

> Sakura House uses "named ranges" — special names that point to cells. The system looks them up automatically. If you accidentally delete one, the menu has a repair option.

**If you delete a named range by accident:**
1. Go to **Shift Report > Admin Tools > Setup & Diagnostics**
2. Click **Force Update Named Ranges (ALL Sheets)**
3. This will recreate any missing ones automatically

### Sheet Tab Names (Never Rename)

> Sheet tabs must start with the day name. The system uses this to know which tab is Monday, which is Tuesday, etc.

**Don't do this:**
- ❌ Rename `MONDAY 18/03/2026` to `Monday Week 1`
- ❌ Delete and recreate `TUESDAY 18/03/2026`

**What happens after rollover:**
- Tab names are automatically updated by the system to the next week's dates
- This is normal and expected

### VENUE_NAME Property (Never Change)

> This setting MUST stay as `SAKURA`. Changing it to something else will confuse every part of the system.

### Spreadsheet IDs (Update Only If File Replaced)

> These IDs link to other spreadsheets. Only change them if you've actually recreated or moved a spreadsheet.

| Property | Links To | When to Update |
|----------|----------|-----------------|
| `SAKURA_DATA_WAREHOUSE_ID` | The central analytics spreadsheet | Only if the warehouse is recreated |
| `SAKURA_WORKING_FILE_ID` | This spreadsheet (current week) | Only if the working file is replaced |
| `TASK_MANAGEMENT_SPREADSHEET_ID` | The Actionables Sheet | Only if the Actionables Sheet is recreated |

**If you get a wrong ID:** The integrations will silently fail — data won't flow between systems but you won't see an error message.

---

## Passwords

> Sakura House has two admin passwords (which should be the same).

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
- All **Admin Tools** in the Shift Report menu
- All **Admin Tools** in the Task Management menu
- Test/development functions

These menu items do NOT require the password:
- "Send Nightly Report" (staff can run this anytime)
- "Send Test Report" (for verification)
- "Open Task Manager" (opens the task tracker)

---

## Common Configuration Tasks

> Quick reference for the most common changes you'll make.

### Task: Update Email Recipients

**Steps:**
1. Open "Sakura House - Current Week"
2. Go to Extensions > Apps Script
3. Click gear icon > Script Properties
4. Find `SAKURA_EMAIL_RECIPIENTS`
5. Click the pencil icon and edit (follow the instructions under "Changing Email Recipients" above)
6. Click Save

### Task: Update Slack Webhook

**Steps:**
1. Get the new webhook URL from your Slack admin
2. Open the relevant spreadsheet (Shift Report or Task Management)
3. Go to Extensions > Apps Script
4. Click gear icon > Script Properties
5. Find the webhook property (e.g., `SAKURA_SLACK_WEBHOOK_LIVE`)
6. Click the pencil icon and paste the new URL
7. Click Save
8. Test by running the associated command or waiting for the scheduled time

### Task: Add a New Staff Member

**Steps:**
1. Add their name to "Staff Allocated" column in Sakura Actionables Sheet
2. Get their Slack DM webhook from your Slack admin
3. Open "Sakura Actionables Sheet" > Extensions > Apps Script
4. Click gear icon > Script Properties
5. Find `SLACK_DM_WEBHOOKS`
6. Click pencil, add: `,"Their Name":"webhook_url"` before the closing `}`
7. Click Save
8. Run: Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting

### Task: Change Admin Password

**Steps:**
1. Open "Sakura House - Current Week" > Extensions > Apps Script
2. Click gear icon > Script Properties
3. Find `MENU_PASSWORD`
4. Click pencil, change to new password, Save
5. Repeat for "Sakura Actionables Sheet"

### Task: Check if System is Working

**Steps:**
1. Open "Sakura House - Current Week"
2. Go to **Shift Report > Admin Tools > Setup & Diagnostics**
3. Run "Check Named Ranges (ALL Sheets)" — should show "OK" status
4. Open "Sakura Actionables Sheet"
5. Go to **Task Management > Admin Tools** and look for a verification or status option

---

## When Things Go Wrong

> Quick troubleshooting for common issues.

| Issue | Possible Cause | First Steps |
|-------|---|---|
| Slack messages stopped | Webhook expired or was revoked | Get new webhook from Slack admin, update in Script Properties |
| Email not received | Email list wrong or provider issue | Verify `SAKURA_EMAIL_RECIPIENTS` format (see "Changing Email Recipients" above) |
| Rollover didn't run Monday morning | Trigger destroyed after code deployment | Recreate triggers (see "Complete Trigger Reference" above) |
| Staff dropdown missing someone | Dropdown wasn't updated | Run Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting |
| Named ranges missing error | Ranges accidentally deleted | Run Shift Report > Admin Tools > Setup & Diagnostics > Force Update Named Ranges (ALL Sheets) |
| System says "File ID wrong" | SAKURA_WORKING_FILE_ID doesn't match | Don't change unless the working file was actually replaced |
| Task notifications not sending | Staff DM webhooks out of date | Update `SLACK_DM_WEBHOOKS` in Script Properties (see "Changing Staff for Task Notifications" above) |

---

## Need More Detail?

> These guides have deeper technical information if you need it.

| Topic | Document | Where to Find |
|-------|----------|----------------|
| Named ranges and field system | SETUP_AND_CONFIG.md | SAKURA HOUSE/FILE EXPLAINERS/ |
| Weekly rollover details | WEEKLY_ROLLOVER_AND_DIGEST.md | SAKURA HOUSE/FILE EXPLAINERS/ |
| All file code explanations | DAILY_SHIFT_REPORT.md, NIGHTLY_EXPORT_PIPELINE.md, SLACK_INTEGRATION.md, etc. | SAKURA HOUSE/FILE EXPLAINERS/ |
| Deep architecture | DEEP_DIVE_ARCHITECTURE_SAKURA.md | docs/sakura/ |
| Integration flows | INTEGRATION_FLOWS_SAKURA.md | docs/sakura/ |
| Cell reference map | CELL_REFERENCE_MAP_SAKURA.md | docs/sakura/ |

---

**Quick Links:**
- **Shift Report menu:** Shift Report > Admin Tools > [what you need]
- **Task Management menu:** Task Management > Admin Tools > [what you need]
- **Script Properties:** Any spreadsheet > Extensions > Apps Script > Gear icon > Script Properties
- **Apps Script Triggers:** Any spreadsheet > Extensions > Apps Script > Alarm clock icon > Triggers

---

**Last Updated:** March 18, 2026
**Version:** 1.0 — Manager Handover Edition
**Status:** Ready for production use
