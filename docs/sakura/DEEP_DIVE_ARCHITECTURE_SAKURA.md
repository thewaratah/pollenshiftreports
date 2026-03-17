# SAKURA HOUSE - Deep Dive Architecture

**Last Updated:** March 18, 2026
**Type:** Detailed Technical Documentation
**Load:** On-demand only (reference material)

---

## File Structure (Detailed)

> Every file in the Sakura House codebase and what it does. The system is split into two Google Apps Script projects — one for shift reports and one for task management — each deployed to its own spreadsheet.

```
SAKURA HOUSE/
├── SHIFT REPORT SCRIPTS/         # 13 code files (.gs), ~5,700 LOC
│   ├── RunSakura.gs              # Named range system & FIELD_CONFIG (529 LOC)
│   ├── VenueConfigSakura.gs      # Venue configuration (named ranges)
│   ├── IntegrationHubSakura.gs   # Data integration orchestrator (918 LOC)
│   ├── NightlyExportSakura.gs    # PDF export, email, Slack, TO-DO aggregation
│   ├── NightlyBasicExportSakura.gs  # Standalone handover export (no deps)
│   ├── WeeklyRolloverInPlace.gs  # In-place rollover system
│   ├── MenuSakura.gs             # Custom menu system
│   ├── AnalyticsDashboardSakura.gs  # Financial dashboards
│   ├── TaskIntegrationSakura.gs  # Push TO-DOs to Actionables sheet
│   ├── WeeklyDigestSakura.gs     # Weekly revenue Slack digest
│   ├── SlackBlockKitSakuraSR.gs  # Block Kit helper library
│   ├── UIServerSakura.gs         # HTML UI server
│   └── _SETUP_ScriptProperties_SakuraOnly.gs  # One-time setup
├── SHIFT REPORT SCRIPTS/ (HTML)
│   ├── analytics-viewer.html     # Analytics dashboard UI
│   ├── export-dashboard.html     # Export management UI
│   └── checklist-dialog.html     # Pre-send checklist modal
├── TASK MANAGEMENT SCRIPTS/      # 9 code files (.gs), ~3,800 LOC
│   ├── EnhancedTaskManagement_Sakura.gs  # Main task system (~2,050 LOC)
│   ├── TaskDashboard_Sakura.gs   # Task analytics
│   ├── Menu_Updated_Sakura.gs    # Custom menu (task mgmt + Slack poster)
│   ├── SlackBlockKitSAKURA.gs    # Slack integration
│   ├── SlackActionablesPoster_Sakura.gs  # Actionables poster to Slack
│   ├── UIServerSakura.gs         # HTML UI server
│   ├── VenueConfigSakura.gs      # Venue config (task mgmt copy)
│   ├── _SETUP_ScriptProperties_TaskMgmt_Sakura.gs  # Task mgmt setup
│   └── TEST_VenueConfigSakura.gs # Config validation test
├── TASK MANAGEMENT SCRIPTS/ (HTML)
│   └── task-manager.html         # Task management UI
└── CODE_REVIEW_REPORTS_2026-02-16/  # Documentation
    ├── DEPLOYMENT_GUIDE.md
    ├── ROLLOVER_TESTING_GUIDE.md
    └── SESSION_IMPLEMENTATION_SUMMARY.md
```

**Total:** ~9,500 lines of code across 22 code files (.gs) + 4 HTML + 3 docs

---

## Named Range System (Sakura's Key Innovation)

> The core architectural difference between Sakura and Waratah. Instead of hardcoding "B54" everywhere, Sakura uses named ranges like `MONDAY_SR_NetRevenue` that stay bound to cells even if rows are inserted or moved. This makes the system much more resilient to spreadsheet layout changes.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/RunSakura.gs` (529 LOC)

### Convention

> The naming pattern every named range follows. The day prefix matches the sheet, and the suffix identifies the field.

```
{DAY}_SR_{Suffix}
Examples:
- MONDAY_SR_Date
- TUESDAY_SR_NetRevenue
- WEDNESDAY_SR_ShiftSummary
```

### Fallback Mechanism

> What happens when a named range goes missing. The system doesn't crash — it falls back to the hardcoded cell address and logs a warning. This means shifts still get exported even if something goes wrong with the named ranges.

```javascript
function getFieldRange(sheet, fieldKey) {
  const config = FIELD_CONFIG[fieldKey];
  const namedRangeName = `${dayPrefix}_${config.suffix}`;

  try {
    const namedRange = spreadsheet.getRangeByName(namedRangeName);
    if (namedRange) return namedRange;  // ✅ Found
  } catch (e) { }

  // ⚠️ Fallback to hardcoded cell
  Logger.log(`Named Range not found. Using fallback: ${config.fallback}`);
  return sheet.getRange(config.fallback);
}
```

### FIELD_CONFIG (24 fields)

> The master configuration that maps every logical field name to its named range suffix and fallback cell. If you need to add a new field to the system, this is where it starts.

```javascript
const FIELD_CONFIG = {
  // HEADER
  date:                  { suffix: "SR_Date",                  fallback: "B3:D3" },
  mod:                   { suffix: "SR_MOD",                   fallback: "B4:D4" },
  fohStaff:              { suffix: "SR_FOHStaff",              fallback: "B6:D6" },
  bohStaff:              { suffix: "SR_BOHStaff",              fallback: "B7:D7" },

  // CASH
  cashCount:             { suffix: "SR_CashCount",             fallback: "C10:E17" },
  cashRecord:            { suffix: "SR_CashRecord",            fallback: "C22:D23" },
  pettyCashTransactions: { suffix: "SR_PettyCashTransactions", fallback: "B40:B45" },

  // FINANCIALS
  netRevenue:            { suffix: "SR_NetRevenue",            fallback: "B54" },

  // SHIFT REPORT
  shiftSummary:          { suffix: "SR_ShiftSummary",          fallback: "A59:D59" },

  // TO-DO SECTION
  todoTasks:             { suffix: "SR_TodoTasks",             fallback: "A69:A84" },
  todoAssignees:         { suffix: "SR_TodoAssignees",         fallback: "D69:D84" },

  // FINANCIAL DETAIL
  cashTips:              { suffix: "SR_CashTips",              fallback: "C29" },
  cardTips:              { suffix: "SR_CardTips",              fallback: "C30" },
  surchargeTips:         { suffix: "SR_SurchargeTips",         fallback: "C31" },
  productionAmount:      { suffix: "SR_ProductionAmount",      fallback: "B37" },
  deposit:               { suffix: "SR_Deposit",               fallback: "B38" },
  discounts:             { suffix: "SR_Discounts",             fallback: "B50" },

  // CONTENT SECTIONS
  guestsOfNote:          { suffix: "SR_GuestsOfNote",          fallback: "A61:D61" },
  goodNotes:             { suffix: "SR_GoodNotes",             fallback: "A63:D63" },
  issues:                { suffix: "SR_Issues",                fallback: "A65:D65" },
  kitchenNotes:          { suffix: "SR_KitchenNotes",          fallback: "A67:D67" },
  wastageComps:          { suffix: "SR_WastageComps",          fallback: "A86:D86" },
  maintenance:           { suffix: "SR_Maintenance",           fallback: "A88:D88" },
  rsaIncidents:          { suffix: "SR_RSAIncidents",          fallback: "A90:D90" }
};
```

### Diagnostics & Self-Healing

> Tools for checking and fixing named ranges. The "force update" function is the nuclear option — it rewrites all ranges from FIELD_CONFIG, useful after template layout changes.

```javascript
diagnoseNamedRanges()                    // Check active sheet
diagnoseAllSheets()                      // Check all 6 day sheets
createNamedRangesOnActiveSheet()         // Setup from fallbacks (skips existing)
createNamedRangesOnAllSheets()           // Bulk setup for all days (skips existing)
forceUpdateNamedRangesOnAllSheets()      // Overwrite ALL with current FIELD_CONFIG
```

---

## Venue Configuration

> The central config file that defines everything specific to Sakura House — operating days, sheet names, feature toggles, and the key flag `usesNamedRanges: true` that tells the rest of the codebase how to access data.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/VenueConfigSakura.gs`

```javascript
const SAKURA_CONFIG = {
  name: 'SAKURA HOUSE',
  days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
  dayCount: 6,  // Closed Sundays
  sheetNames: {
    master: 'SAKURA ACTIONABLES SHEET',
    audit: 'AUDIT LOG',
    archive: 'ARCHIVE'
  },
  ranges: {
    usesNamedRanges: true,  // ✅ Uses named ranges
    todoTasks:    'SR_TodoTasks',
    todoAssignees: 'SR_TodoAssignees',
    date:         'SR_Date',
    mod:          'SR_MOD',
    netRevenue:   'SR_NetRevenue',
    shiftSummary: 'SR_ShiftSummary',
  },
  timezone: 'Australia/Sydney',
  features: {
    taskManagement: true,
    nightlyExport: true,
    analytics: true,
    dataWarehouse: true
  }
}
```

**Critical Pattern:**

> How code reads data using the named range abstraction. Never hardcode cell addresses in Sakura code — always go through `getFieldValue()`.

```javascript
// ✅ CORRECT for Sakura — uses named range system
const value = getFieldValue(sheet, 'netRevenue');
setFieldValue(sheet, 'netRevenue', 1234.56);

// ❌ AVOID — hardcoded cell address
const value = sheet.getRange('B54').getValue();
```

---

## Script Properties Configuration

> Secrets and settings stored securely inside Google Apps Script (not in the code). These include Slack webhook URLs, email recipients, spreadsheet IDs, and the admin password. They're set once and rarely change.

### Shift Reports Project (13 properties)

> Properties stored in the Shift Reports spreadsheet's Apps Script project. These power the nightly export, rollover, data warehouse, and Slack integrations.

```javascript
// Venue
VENUE_NAME: "SAKURA"
MENU_PASSWORD: "[configured interactively]"

// Slack Webhooks
SAKURA_SLACK_WEBHOOK_LIVE: "https://hooks.slack.com/services/..."
SAKURA_SLACK_WEBHOOK_TEST: "https://hooks.slack.com/services/..."
SAKURA_SLACK_WEBHOOK_DATAWAREHOUSE: "https://hooks.slack.com/services/..."
SAKURA_SLACK_WEBHOOK_CASH_NOTIFICATIONS: "https://hooks.slack.com/services/..."

// Email (JSON map: email → name)
SAKURA_EMAIL_RECIPIENTS: '{"evan@...": "Evan", "kalisha@...": "Kalisha", ...}'

// Spreadsheet IDs
SAKURA_DATA_WAREHOUSE_ID: "1T4WwoedgSdT1MNWJwxPCC_eG9MmU54YE1VYDdjcRzDk"
SAKURA_WORKING_FILE_ID: "[current_working_file_id]"

// Rollover
ARCHIVE_ROOT_FOLDER_ID: "1a1AbJN4qU7Lt2oyYPxiTn3kG5EEKOf1K"

// Integration alerts
INTEGRATION_ALERT_EMAIL_PRIMARY: "evan@sakurahousesydney.com"
INTEGRATION_ALERT_EMAIL_SECONDARY: "kalisha@sakurahousesydney.com"
```

### Task Management Project (6 properties)

> Properties stored in the Sakura Actionables Sheet's separate Apps Script project. These power task notifications, escalations, and Slack DMs.

```javascript
TASK_MANAGEMENT_SPREADSHEET_ID: "13ANpyoohs9RQMpuS026mSLjLxrH9RIVmtp5i-mRhnZk"
ESCALATION_EMAIL: "evan@sakurahousesydney.com"
ESCALATION_SLACK_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_MANAGERS_CHANNEL_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_FOH_LEADS_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_DM_WEBHOOKS: '{"Evan":"...","Nick":"...","Gooch":"...","Adam":"...",...}'
```

### Setup Functions

> Run these once when setting up a new deployment. They write all the required properties into Google Apps Script's secure storage.

```javascript
// Shift Reports project — interactive setup
setupScriptProperties_Sakura()

// Task Management project — run from Actionables Sheet
setupScriptProperties_TaskMgmt_Sakura()

// Verify setup
verifyScriptProperties()

// Reset if needed (CAUTION: deletes all properties)
resetAllProperties_DANGER()
```

**⚠️ Two separate projects — two separate Script Property stores.** The Shift Reports spreadsheet and the Sakura Actionables Sheet have independent properties. Setting a property in one does NOT affect the other.

---

## Enhanced Task Management System

> The task tracker that lives in its own spreadsheet. Managers create tasks from shift reports or ad-hoc, assign them to staff, and track progress through a 9-status workflow. It handles auto-escalation, recurring tasks, and Slack notifications.

**File:** `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs` (~2,050 LOC)

### Staff List

> Everyone who can be assigned tasks. Individual staff get direct Slack messages; team/group assignments go to shared channels.

- Evan, Nick, Gooch, Adam, Cynthia, Kalisha, Sabine (individual DM webhooks)
- Bar Team, Kitchen Team, FOH Team, General Management (group assignments)
- All, General/Unallocated (special categories)

### Data Structure (15 columns, A-O)

> Each task is one row in the spreadsheet with these 15 fields. The system auto-populates dates and tracks changes automatically.

| Col | Field | Description |
|-----|-------|-------------|
| A | Priority | URGENT, HIGH, MEDIUM, LOW |
| B | Status | 9 possible states |
| C | Staff Allocated | From staff list |
| D | Area | FOH, BOH, Bar, Kitchen, Admin, Maintenance, Marketing, Events, Training, General |
| E | Description | Task details |
| F | Due Date | Date tracking |
| G | Date Created | Auto-populated |
| H | Date Completed | Auto-set on DONE/CANCELLED |
| I | Days Open | Calculated formula |
| J | Blocker Notes | Required for BLOCKED status |
| K | Source | Shift Report, Meeting, Ad-hoc |
| L | Recurrence | None, Weekly, Fortnightly, Monthly |
| M | Last Updated | Auto-populated |
| N | Updated By | Tracks who made changes |
| O | Notes | Free-text notes (added Mar 2026) |

### 9-Status Workflow

> The lifecycle a task moves through. Most go NEW → TO DO → IN PROGRESS → DONE. Tasks that get stuck can be blocked, deferred, or cancelled. Recurring tasks auto-regenerate after completion.

```
NEW → TO DO → IN PROGRESS → TO DISCUSS → DONE
              ↓
          BLOCKED (escalates after 14 days)
              ↓
          DEFERRED
              ↓
          CANCELLED
              ↓
          RECURRING (auto-regenerates)
```

**Active statuses:** NEW, TO DO, IN PROGRESS, TO DISCUSS, DEFERRED, RECURRING
**Inactive statuses (bottom-sorted, strikethrough):** BLOCKED, DONE, CANCELLED

### Sort Order (Mar 2026 overhaul)

> How tasks are arranged in the spreadsheet. Active tasks sort to the top by priority, then status, then staff name. Inactive tasks (done, cancelled, blocked) sort to the bottom with muted formatting.

1. Active/Inactive group (active first)
2. Priority: URGENT > HIGH > MEDIUM > LOW > RECURRING
3. Status
4. Staff name
5. Due date (ascending)

### Conditional Formatting

> Visual cues that help managers scan the task list quickly. Priority levels get colour-coded row backgrounds, and completed/cancelled tasks get dimmed with strikethrough text.

- DONE/CANCELLED/BLOCKED: strikethrough + muted grey
- HIGH priority rows: light orange
- MEDIUM priority rows: light yellow
- LOW priority rows: light blue
- RECURRING rows: light purple

### Automation

> Scheduled triggers that run the task system hands-free — daily maintenance at 7am, a weekly summary on Mondays, and real-time sorting whenever someone edits a task.

- **Daily 7am:** Cleanup, escalation (14-day blocked → Evan), recurring task regeneration, archival (8-day DONE/CANCELLED), overdue summary
- **Monday 6am:** Weekly active tasks summary to Slack (`#sakura_managers`)
- **On Edit:** Audit log, auto-sort, formatting refresh

### FOH Leads Summary

> A weekly Slack message specifically for the FOH leadership team — Evan, Gooch, Sabine, Kalisha. Posts to `#sakura_foh_leads` channel.

```javascript
sendWeeklyFohLeadsSummary_Live()   // Posts to #sakura_foh_leads
```

### Setup

> Create these triggers after every `clasp push` deployment (which destroys existing triggers).

```javascript
createDailyMaintenanceTrigger()     // Daily 7am
createWeeklySummaryTrigger()        // Monday 6am
createOnEditTrigger()               // On edit auto-sort
```

---

## Task Integration (Shift Reports → Actionables)

> How TO-DOs from the daily shift report automatically flow into the task management system. When a nightly export runs, any tasks the MOD recorded get pushed to the Sakura Actionables Sheet as new task rows.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/TaskIntegrationSakura.gs`

```
Shift Report Day Sheet
    ↓ (pushTodosToActionables)
Sakura Actionables Sheet
    → New rows: MEDIUM priority, NEW status, "Shift Report" source
```

**Duplicate Prevention:** Checks if a task with the same description was already created today. Prevents double-push on re-export.

**Batch Writing:** All new task rows are written in a single `setValues()` call, then Days Open formulas are set in a second pass (GAS cannot mix formulas with plain values in the same `setValues()`).

---

## Menu System

> The custom menu that appears in the spreadsheet toolbar under "Shift Report". This is how managers interact with the system — exporting reports, running rollovers, and viewing dashboards — without touching any code.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/MenuSakura.gs`

```
Shift Report
├── Send Nightly Report              ← NO password required
├── Send Test Report                 ← no password
├── Send Basic Report                ← no password
├── ────────────────
└── Admin Tools ▸                    ← all items password-gated
    ├── Weekly Reports ▸
    │   ├── Weekly To-Do Summary (LIVE)
    │   └── Weekly To-Do Summary (TEST)
    ├── Weekly Digest ▸
    │   ├── Send Revenue Digest (LIVE)
    │   ├── Send Revenue Digest (TEST)
    │   └── Setup Monday Digest Trigger
    ├── Weekly Rollover ▸
    │   ├── Run Rollover Now
    │   ├── Preview Rollover (Dry Run)
    │   ├── Open Rollover Settings
    │   ├── ────────────────
    │   ├── Create Rollover Trigger (Mon 10am)
    │   └── Remove Rollover Trigger
    ├── Integrations & Analytics ▸
    │   ├── Test Integrations Now
    │   ├── Validate All Systems
    │   ├── Build Analytics Dashboard
    │   ├── Build Executive Dashboard
    │   └── Open Analytics
    ├── Data Warehouse ▸
    │   ├── Backfill This Sheet to Warehouse
    │   ├── Show Integration Log (Last 30 Days)
    │   └── Setup Weekly Backfill Trigger
    └── Set Up & Diagnostics ▸
        ├── Check Named Ranges (This Sheet)
        ├── Check Named Ranges (ALL Sheets)
        ├── Create Named Ranges (This Sheet)
        ├── Create Named Ranges (ALL Sheets)
        ├── Force Update Named Ranges (ALL Sheets)
        ├── Test Task Push to Actionables
        ├── Backfill TO-DOs (All Days)
        └── Push TO-DOs (This Sheet)
```

**Password:** Read from Script Properties via `getMenuPassword_()` — not hardcoded.

---

## Weekly Revenue Digest

> A Slack message that goes out every Monday morning comparing this week's revenue to last week's. Helps managers see trends at a glance without opening spreadsheets.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/WeeklyDigestSakura.gs`

```javascript
sendWeeklyRevenueDigest_Sakura()       // LIVE — posts to main channel
sendWeeklyRevenueDigest_Sakura_Test()  // TEST — posts to test webhook
setupWeeklyDigestTrigger_Sakura()      // Install Monday 8am trigger
```

**Data Source:** NIGHTLY_FINANCIAL sheet, Column E = Net Revenue, Column J = Total Tips

---

## Development Guidelines

> Rules to follow when writing or modifying Sakura code. These exist because past mistakes taught us the hard way.

### When Working on Sakura Code

**1. Always Use Named Range Abstraction:**

> Never hardcode cell references in Sakura. Always go through `getFieldValue()` or `getFieldRange()`.

```javascript
// ✅ CORRECT
const value = getFieldValue(sheet, 'netRevenue');

// ❌ AVOID
const value = sheet.getRange('B54').getValue();
```

**2. Never Use `clear()` on Data Ranges:**

> `clear()` destroys named ranges, formatting, and validation. `clearContent()` only removes values.

```javascript
// ✅ CORRECT - Preserves named ranges
range.clearContent();

// ❌ WRONG - Destroys named ranges, formatting
range.clear();
```

**3. Use Venue Configuration:**

> Check the venue config when writing code that might apply to both venues.

```javascript
const config = getVenueConfig_();
if (config.ranges.usesNamedRanges) {
  // Use named range system
}
```

**4. TASK_CONFIG Has No Slack Section:**

> A gotcha that caused a production bug. `TASK_CONFIG` only has spreadsheet settings. All Slack webhooks and emails come from Script Properties helper functions.

```javascript
// ❌ WRONG — TASK_CONFIG.slack was removed
TASK_CONFIG.slack.dmWebhooks

// ✅ CORRECT — use helper functions
getSlackDmWebhooks_()
getManagersChannelWebhook_()
getEscalationSlackWebhook_()
```

---

## Testing Checklist

> Before deploying any changes, run through this list. Always test on a copy of the live spreadsheet — never on the real one.

- [ ] Test on COPY of working file (never test on production)
- [ ] Run preview/dry run mode if available
- [ ] Check Apps Script logs for errors
- [ ] Verify named ranges still work after data clearing
- [ ] Test menu functionality
- [ ] Confirm Slack notifications send
- [ ] Validate data warehouse writes
- [ ] Verify email delivery

---

## Common Operations

> Frequently needed tasks and the code to run them. These are quick-reference snippets for day-to-day maintenance.

### Fix Missing Named Ranges

> If named ranges go missing (common after copying spreadsheets or manual edits), run these from the menu to recreate them.

```javascript
diagnoseNamedRanges()                    // Check active sheet
diagnoseAllSheets()                      // Check all 6 day sheets
createNamedRangesOnAllSheets()           // Create missing (skips existing)
forceUpdateNamedRangesOnAllSheets()      // Overwrite all with FIELD_CONFIG
```

### Test Integrations

> Run these in the Apps Script editor to verify that data warehouse logging, Slack, and email are all working.

```javascript
testIntegrations()       // Test on active sheet
runValidationReport()    // Full system validation
```

### Update Email Recipients

> Change who gets the nightly shift report emails by editing this Script Property — it's a JSON map of email addresses to names.

```javascript
// Script Properties → SAKURA_EMAIL_RECIPIENTS
// JSON map format:
'{"evan@sakurahousesydney.com": "Evan", "kalisha@sakurahousesydney.com": "Kalisha"}'
```

### Trigger Recreation After Deployment

> `clasp push` destroys all time-based triggers. After every deployment, recreate all triggers.

```javascript
// Shift Reports triggers
createRolloverTrigger_Sakura()           // Mon 10am rollover
setupWeeklyDigestTrigger_Sakura()        // Mon 8am revenue digest
setupWeeklyBackfillTrigger()             // Mon 2am warehouse backfill

// Task Management triggers
createDailyMaintenanceTrigger()          // Daily 7am
createWeeklySummaryTrigger()             // Mon 6am
createOnEditTrigger()                    // On edit auto-sort
```

---

**Last Updated:** March 18, 2026
**File Count:** 22 code files (.gs) + 4 HTML
**Total LOC:** ~9,500 lines of code
