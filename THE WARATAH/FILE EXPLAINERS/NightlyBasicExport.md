# NightlyBasicExport.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/NightlyBasicExport.js`
**Type:** Standalone export script — no dependencies on other project files
**Run from:** Menu (Daily Reports > Send Basic Report) or Apps Script editor

---

## What This File Does

This is a **self-contained, simplified version** of the shift report export. Unlike `NightlyExport.js` (which integrates with the data warehouse, task management, Slack Block Kit, and checklist dialog), this file does everything in one function with zero dependencies on other project files.

It was designed for non-technical handover — someone unfamiliar with the codebase can edit the CONFIG block at the top and run it.

---

## The Five Steps

`sendShiftReportBasic()` runs these steps in order:

| Step | What It Does |
|------|-------------|
| **1. Validate** | Checks that the active sheet is a valid Waratah day sheet (WEDNESDAY–SUNDAY). Blocks export on instruction/readme tabs. |
| **2. Generate PDF** | Exports the active sheet as a PDF using the Google Sheets export API with Bearer token auth. |
| **3. Send Email** | Emails the PDF to all recipients listed in the CONFIG block. Uses `GmailApp.sendEmail()`. |
| **4. Post to Slack** | Sends a plain-text summary (no Block Kit formatting) to the configured webhook. |
| **5. Move TO-DOs** | Reads tasks from rows 53–61, clears the TO-DOs tab, and writes the current day's tasks. |

---

## Configuration

All settings are in the `CONFIG` object at the top of the file:

```javascript
var CONFIG = {
  emailRecipients: ['manager@example.com', 'owner@example.com'],
  slackWebhook: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
  todoTabName: 'TO-DOs',
  emailSubjectPrefix: 'The Waratah — Shift Report'
};
```

---

## How It Differs from NightlyExport.js

| Feature | NightlyBasicExport | NightlyExport |
|---------|-------------------|---------------|
| **Dependencies** | None — fully standalone | VenueConfig, IntegrationHub, SlackBlockKit, checklist-dialog |
| **Slack format** | Plain text | Rich Block Kit with buttons and formatting |
| **Pre-send checklist** | None | Requires Deputy timesheets + fruit order confirmation |
| **Data warehouse** | Not connected | Logs to NIGHTLY_FINANCIAL and other warehouse sheets |
| **Task management** | Writes to TO-DOs tab only | Pushes to Master Actionables Sheet |
| **Configuration** | Hardcoded CONFIG block | Script Properties via `_SETUP_ScriptProperties.js` |
| **Test mode** | None | Separate test function that emails only Evan |

---

## When Would You Use This File?

- **Emergency fallback** — If the main export pipeline (`NightlyExport.js`) breaks, this can still send reports
- **Simple setup** — For a new venue or environment where you don't need the full integration pipeline
- **Handover** — When someone non-technical needs to export a report without understanding the full system

---

## Cell References Used

| Cell | Content |
|------|---------|
| B3 | Shift date (merged B3:F3) |
| B4 | MOD name (merged B4:F4) |
| B34 | Net Revenue |
| A43 | Shift Summary (merged A43:F43) |
| A53:E61 | TO-DO tasks (9 rows, merged A-E) |
| F53:F61 | TO-DO assignees |
