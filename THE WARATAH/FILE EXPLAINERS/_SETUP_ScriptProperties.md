# _SETUP_ScriptProperties.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties.js`
**Type:** One-time configuration script
**Run from:** Google Apps Script editor (manually)

---

## What This File Does

This file stores all the configuration values that The Waratah's shift report and task management systems need to run. Think of it as the master settings file — it tells every other script where to find spreadsheets, who to email, and where to send Slack messages.

You run it **once** when setting up the system (or again if settings need to change). It writes 18 "Script Properties" into the Apps Script project, which all other scripts then read at runtime.

---

## The Three Functions

### 1. `setupScriptProperties()`
**Purpose:** Writes all 18 configuration values into the project.

What it configures:

| Category | Properties | What They Control |
|----------|-----------|-------------------|
| Venue Config | `VENUE_NAME`, `MENU_PASSWORD` | Identifies the venue; password for admin menus |
| Slack Webhooks | `WARATAH_SLACK_WEBHOOK_LIVE`, `_TEST` | Where shift report notifications are sent in Slack |
| Email Recipients | `WARATAH_EMAIL_RECIPIENTS` | JSON list of who receives emailed PDF reports |
| Spreadsheet IDs | `WARATAH_SHIFT_REPORT_CURRENT_ID`, `_WORKING_FILE_ID`, `_TASK_MANAGEMENT_ID`, `_DATA_WAREHOUSE_ID`, `_CASH_RECON_FOLDER_ID` | Links to the Google Sheets and Drive folders the system uses |
| Rollover | `ARCHIVE_ROOT_FOLDER_ID`, `SLACK_MANAGERS_CHANNEL_WEBHOOK` | Where archived reports are saved; managers channel for rollover alerts |
| Task Escalation | `ESCALATION_EMAIL`, `ESCALATION_SLACK_WEBHOOK` | Where overdue task alerts are sent |
| Staff DM Webhooks | `SLACK_DM_WEBHOOKS` | JSON map of staff names to their personal Slack DM webhooks for task notifications |
| Integration Alerts | `INTEGRATION_ALERT_EMAIL_PRIMARY`, `_SECONDARY` | Who gets notified if an integration fails |

### 2. `verifyScriptProperties()`
**Purpose:** Checks that all 18 required properties exist and shows which (if any) are missing.

- Shows a checkmark for each property that's set
- Masks sensitive values (webhooks, passwords) in the log
- Pops up an alert summarising the result

Run this after `setupScriptProperties()` to confirm everything took.

### 3. `resetScriptProperties()`
**Purpose:** Deletes ALL Script Properties. Use with caution.

- Prompts for confirmation before deleting
- After reset, you must run `setupScriptProperties()` again to restore settings

---

## When Would You Need This File?

- **Initial setup** — First time deploying The Waratah's scripts to a new Apps Script project
- **Changing a webhook** — If a Slack webhook URL is rotated or a new channel is added
- **Adding/removing email recipients** — Update the `emailRecipients` object, then re-run setup
- **Adding new staff DM webhooks** — Update the `slackDmWebhooks` object, then re-run setup
- **Troubleshooting** — Run `verifyScriptProperties()` if scripts are failing with "property not found" errors

---

## How to Run

1. Open the Apps Script editor (Extensions > Apps Script from the spreadsheet)
2. Select `_SETUP_ScriptProperties.js` from the file list
3. Choose `setupScriptProperties` from the function dropdown
4. Click **Run**
5. Verify with `verifyScriptProperties`

---

## Important Notes

- **Run manually only** — This is not triggered automatically. You choose when to run it.
- **Idempotent** — Running `setupScriptProperties()` multiple times is safe. It overwrites existing values with the same data.
- **Sensitive data** — This file contains webhook URLs and spreadsheet IDs. Don't share it publicly.
- **One property has an alias** — `TASK_MANAGEMENT_SPREADSHEET_ID` and `WARATAH_TASK_MANAGEMENT_ID` point to the same spreadsheet. Both exist because different scripts reference different names.
