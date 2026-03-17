# THE WARATAH - Deep Dive Architecture

**Last Updated:** March 6, 2026
**Type:** Detailed Technical Documentation
**Load:** On-demand only (reference material)

---

## File Structure (Detailed)

```
THE WARATAH/
├── SHIFT REPORT SCRIPTS/         # 13 code files (.js), ~4,700 LOC
│   ├── VenueConfig.js           # Venue configuration (hardcoded cells)
│   ├── IntegrationHub.js        # Data integration orchestrator
│   ├── NightlyExport.js         # PDF export, email, Slack
│   ├── WeeklyRolloverInPlace.js # In-place rollover ✅
│   ├── Menu.js                  # Custom menu system
│   ├── AnalyticsDashboard.js    # Financial dashboards
│   ├── TaskIntegration.js       # Task management constants
│   ├── DiagnoseSlack.js         # Slack webhook diagnostics
│   ├── Run.js                   # Test runner utilities
│   ├── UIServer.js              # HTML UI server
│   ├── TEST_SlackBlockKitLibrary.js  # Slack library test
│   ├── TEST_VenueConfig.js      # Config validation test
│   ├── _SETUP_ScriptProperties.js    # One-time setup
│   ├── analytics-viewer.html    # Analytics dashboard UI
│   ├── export-dashboard.html    # Export management UI
│   ├── rollover-wizard.html     # Rollover management UI
│   ├── appsscript.json          # Apps Script manifest
│   └── _ARCHIVED/               # Legacy files (archived Feb 15, 2026)
│       ├── WeeklyDuplication.js
│       ├── WeeklyRollover.js
│       ├── WeeklyRolloverInPlace.js.backup
│       └── AnalyticsDashboardWaratah
└── TASK MANAGEMENT SCRIPTS/      # 6 code files (.gs), ~3,258 LOC
    ├── EnhancedTaskManagementWaratah.gs  # Main task system (2,103 LOC)
    ├── TaskDashboardWaratah.gs   # Task analytics (409 LOC)
    ├── Menu_Updated_Waratah.gs   # Custom menu (244 LOC)
    ├── SlackBlockKitWaratah.gs   # Slack integration (161 LOC)
    ├── UIServerWaratah.gs        # HTML UI server (115 LOC)
    ├── _SETUP_ScriptProperties.gs # Script properties setup (226 LOC)
    ├── task-manager.html         # Task management UI (React/HTML)
    ├── appsscript.json           # Apps Script manifest
    └── .clasp.json               # Clasp deployment config
```

**Total:** ~7,800 lines of code across 19 code files (.js + .gs) + 4 HTML + 3 config + 4 archived files

---

## Venue Configuration

**File:** [`VenueConfig.js`](../../THE%20WARATAH/SHIFT%20REPORT%20SCRIPTS/VenueConfig.js)

**Key Difference from Sakura:** Uses **hardcoded cell references** (not named ranges)

```javascript
const WARATAH_CONFIG = {
  name: 'THE WARATAH',
  days: ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
  dayCount: 5,  // Open 5 days (Wed-Sun)
  sheetNames: {
    master: 'THE WARATAH - Current Week',
    audit: 'AUDIT LOG',
    archive: 'ARCHIVE'
  },
  ranges: {
    usesNamedRanges: false,  // ⚠️ Uses hardcoded cells
    date: 'B3:F3',
    netRevenue: 'B34',
    cashTips: 'B33',
    cardTips: 'B32',
    staff: 'B5',
    productionAmount: 'B8',
    cashTakings: 'B15',
    // ... 12 financial breakdown ranges (B16-B29) added Mar 6
    // ... Covers (B36), LaborHours (B38), LaborCost (B39) REMOVED Mar 6
    todoTask: 'A53:E61',     // 9 rows, merged A:E
    todoStaff: 'F53:F61',
  },
  timezone: 'Australia/Sydney',
  features: {
    taskManagement: true,
    nightlyExport: true,
    analytics: true,
    weeklyRollover: true  // In-place rollover system
  }
}
```

**Critical Pattern:**
```javascript
// Waratah uses direct cell references
const value = sheet.getRange('B34').getValue();  // Net Revenue
setFieldValue(sheet, 'netRevenue', 1234.56);     // Abstraction still works
```

---

## Script Properties Configuration

**Required Properties:**

```javascript
// Venue
VENUE_NAME: "WARATAH"
MENU_PASSWORD: "chocolateteapot"

// Slack Webhooks
WARATAH_SLACK_WEBHOOK_LIVE: "https://hooks.slack.com/services/..."
WARATAH_SLACK_WEBHOOK_TEST: "https://hooks.slack.com/services/..."

// Email (JSON object: email → name)
WARATAH_EMAIL_RECIPIENTS: '{"evan@...": "Evan", "cynthia@...": "Cynthia", ...}'

// Spreadsheet IDs
WARATAH_SHIFT_REPORT_CURRENT_ID: "[current_week_spreadsheet_id]"
WARATAH_WORKING_FILE_ID: "[current_week_spreadsheet_id]"  // Same as above
WARATAH_DATA_WAREHOUSE_ID: "[warehouse_spreadsheet_id]"
WARATAH_TASK_MANAGEMENT_ID: "[task_spreadsheet_id]"

// Weekly Rollover (In-Place System)
ARCHIVE_ROOT_FOLDER_ID: "[archive_folder_id]"
SLACK_MANAGERS_CHANNEL_WEBHOOK: "https://hooks.slack.com/services/..."

// Task Management
ESCALATION_EMAIL: "manager@thewaratah.com"
ESCALATION_SLACK_WEBHOOK: "https://hooks.slack.com/services/..."

// Integration Hub Alerts
INTEGRATION_ALERT_EMAIL_PRIMARY: "tech@thewaratah.com"
INTEGRATION_ALERT_EMAIL_SECONDARY: "manager@thewaratah.com"
```

**Setup Function:**
```javascript
// Run once in Apps Script Editor to configure all 13 properties
setupScriptProperties()

// Verify setup
verifyScriptProperties()

// Reset if needed (CAUTION: deletes all properties)
resetScriptProperties()
```

**File:** [`_SETUP_ScriptProperties.js`](../../THE%20WARATAH/SHIFT%20REPORT%20SCRIPTS/_SETUP_ScriptProperties.js)

---

## Enhanced Task Management System

**File:** [`EnhancedTaskManagementWaratah.gs`](../../THE%20WARATAH/TASK%20MANAGEMENT%20SCRIPTS/EnhancedTaskManagementWaratah.gs)

**Staff List (with Slack DM integration):**
- Evan, Cynthia, Adam, Lily, Dipti (individual DM webhooks configured)
- Bar Team, Kitchen Team, FOH Team, General Management, Marketing Explicit (group assignments)
- All, Contractor (special categories)

**Data Structure (14 columns):**
1. Status (A) - 9 possible states
2. Priority (B) - 5 levels
3. Staff Allocated (C) - from staff list above
4. Area (D) - FOH, BOH, Bar, Kitchen, Admin, Maintenance, Marketing, Events, Training, General
5. Description (E) - task details
6. Due Date (F) - date tracking
7. Date Created (G) - auto-populated
8. Date Completed (H) - auto-set on DONE/CANCELLED
9. Days Open (I) - calculated formula
10. Blocker Notes (J) - required for BLOCKED status
11. Source (K) - Shift Report, Meeting, Ad-hoc
12. Recurrence (L) - None, Weekly, Fortnightly, Monthly
13. Last Updated (M) - auto-populated
14. Updated By (N) - tracks who made changes

**9-Status Workflow:**
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

**Automation:**
- Daily 6am: Cleanup, escalation, recurring tasks, archival, overdue summary
- Monday 9am: Weekly active tasks summary to Slack
- On Edit: Audit log, auto-sort

**Setup:**
```javascript
createDailyMaintenanceTrigger()
createWeeklySummaryTrigger()
createOnEditTrigger()
```

---

## Menu System

**File:** [`Menu.js`](../../THE%20WARATAH/SHIFT%20REPORT%20SCRIPTS/Menu.js)

```
Waratah Tools
├── Daily Reports ▸
│   ├── Export & Email PDF (LIVE)
│   ├── Export & Email (TEST to me)
│   ├── ────────────────
│   └── Open Export Dashboard
├── ────────────────
├── Weekly Reports ▸
│   ├── Weekly To-Do Summary (LIVE)              [Password Protected]
│   ├── Weekly To-Do Summary (TEST to me)        [Password Protected]
│   ├── ────────────────
│   └── Weekly Rollover (In-Place) ▸
│       ├── Run Rollover Now
│       ├── Preview Rollover (Dry Run)
│       ├── ────────────────
│       ├── Create Rollover Trigger
│       └── Remove Rollover Trigger
├── ────────────────
├── Build Financial Dashboard                     [Password Protected]
├── Build Executive Dashboard                     [Password Protected]
├── Open Analytics Viewer
├── ────────────────
└── Setup & Utilities ▸
    ├── Fix Named Ranges on This File            [Password Protected]
    └── List All Named Ranges                    [Password Protected]
```

**Password:** `chocolateteapot` (stored in Script Properties as `MENU_PASSWORD`)

---

## Development Guidelines

### When Working on Waratah Code

**1. Use Hardcoded Cell References Directly:**
```javascript
// ✅ CORRECT for Waratah
const value = sheet.getRange('B54').getValue();

// OR use abstraction (works for both venues)
const value = getRangeValue_(sheet, 'netRevenue');
```

**2. Never Use `clear()` on Data Ranges:**
```javascript
// ✅ CORRECT - Preserves formatting
range.clearContent();

// ❌ WRONG - Destroys formatting, validation
range.clear();
```

**3. Use Venue Configuration:**
```javascript
const config = getVenueConfig_();
if (config.name === 'THE WARATAH') {
  // Waratah-specific logic
}
```

---

## Testing Checklist

- [ ] Test on COPY of working file
- [ ] Check Apps Script logs for errors
- [ ] Test menu functionality
- [ ] Confirm Slack notifications send
- [ ] Validate data warehouse writes
- [ ] Verify email delivery

---

## Common Operations

### Test Integrations
```javascript
testIntegrations()       // Test on active sheet
runValidationReport()    // Full system validation
```

### Update Email Recipients
```javascript
// Script Properties → WARATAH_EMAIL_RECIPIENTS
// JSON array format:
'["email1@thewaratah.com", "email2@thewaratah.com"]'
```

### Add New Staff to Task Management
```javascript
// Edit data validation in column C (Staff Allocated)
// Add new name to dropdown list
```

---

**Last Updated:** March 6, 2026
**File Count:** 22 code files (16 .js + 6 .gs)
**Total LOC:** ~9,371 lines of code
