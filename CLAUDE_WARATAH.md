# THE WARATAH - Quick Reference

**Last Updated:** March 6, 2026
**Status:** 🟢 PRODUCTION READY
**Operating Days:** 5 days (Wed-Sun)
**Cell References:** Hardcoded (see [CELL_REFERENCE_MAP.md](docs/waratah/CELL_REFERENCE_MAP.md))
**Rollover:** In-place system ✅ Automated

---

## 🆕 DEPLOYMENT (March 6, 2026)

**clasp push — Waratah Shift Reports: 21 files + Task Management: 8 files**

**Task Management Restructure (Mar 6) — EnhancedTaskManagementWaratah.gs v1.2.0 + Menu_Updated_Waratah.gs:**
- Sort order changed: Active/Completed → Priority → **Status → Staff** (was Staff → Status)
- Daily maintenance decomposed: `runDailyTaskMaintenance()` removed; replaced with individual triggers (staff workload daily 6am, archive Monday 6am, overdue summary Sunday 9am)
- Menu items removed: Migrate to Enhanced Schema, Run Daily Maintenance Now, Remove Daily Maintenance Trigger, Process Recurring Tasks Now, Create Test Task, Preview What Would Archive
- Bug fixes: `MailApp` → `GmailApp` in `escalateBlockedTasks_()`, `sheet.clear()` → `sheet.getDataRange().clearContent()`, LockService on `cleanupAndSortMasterActionables()`, try/catch + Slack error notification on all trigger-fired functions, `getUi()` wrapped for trigger context safety

**Weekly Functions Audit (Mar 6) — 4 functions reviewed, fixed, deployed:**

1. **NightlyExport.js `continueExport()`** — Silent failure → Slack warning notifications
   - Added warning collection across all 4 non-blocking steps (PDF, email, Slack, warehouse)
   - New `_notifyExportWarnings_()` sends failures to Evan via `WARATAH_SLACK_WEBHOOK_TEST`
   - `pushTodosDirectToMasterActionables_()`: `appendRow()` loop → batch `setValues()` (single API call)
   - `buildTodoAggregationSheet_()`: `appendRow()` loop → batch `setValues()`

2. **EnhancedTaskManagementWaratah.gs `sendWeeklyActiveTasksSummary()`**
   - Trigger timing: 6am → **9am** (`.atHour(9).nearMinute(0)`)
   - BLOCKED tasks remain excluded from weekly summary (by design)

3. **WeeklyRolloverInPlace.js `performWeeklyRollover()`**
   - **P1 BUG FIXED:** `generateWeekSummary_()` read `B53:E61` → `A53:E61` (todo count was always 0)
   - Trigger timing: 5:15am → **10am** (`.atHour(10).nearMinute(0)`)
   - `MailApp.sendEmail` → `GmailApp.sendEmail` (positional args: `recipient, subject, '', {htmlBody}`)
   - Email recipient: hardcoded → reads `WARATAH_EMAIL_RECIPIENTS` Script Property
   - Slack webhook: added `muteHttpExceptions: true` + HTTP response code check

**Previous Deployment (March 3, 2026):**

- Cell Reference Audit: All 8 SR files corrected; narrative fields odd rows for data (43,45,47,49,51); TODO A53:E61; Wastage/RSA A63:F63, A65:F65
- Merged Cell Clearing Fix: `A##:F##` for merged narrative/TODO fields; formula cells B37:B40 removed from CLEARABLE_FIELDS
- `getUi()` try/catch for trigger safety; `LockService` on `performWeeklyRollover()` and `cleanupAndSortMasterActionables()`
- `getTaskSpreadsheetId_()` added to TaskIntegration.js

**Design constraint (confirmed):** `continueExport()` is called from the HTML dialog via `google.script.run`. It MUST return `{ success: boolean, message: string }` and MUST NOT call `SpreadsheetApp.getUi()` or `ui.alert()` — these throw 'Authorisation is required to perform that action' in the google.script.run context. All UI feedback must be handled by the dialog's JavaScript callbacks.

---

## DEPLOYMENT (February 25, 2026)

**clasp push results:**
- Waratah Shift Reports: already up to date (no new local changes since Feb 23)
- Waratah Task Management: 8 files pushed (no code changes since Feb 23)

**checklist-dialog.html (updated Feb 25):** Pre-send checklist modal — Deputy Timesheets Approved + Fruit Order Done must both be confirmed before export proceeds. Calls continueExport() via google.script.run. Identical implementation to Sakura House version.

**NightlyExport.js continueExport() note:** Explicit JSDoc added clarifying that SpreadsheetApp.getUi() must NOT be called from google.script.run context. Returns { success, message } object for dialog-side handling.

---

## 🆕 RECENT UPDATES (February 23, 2026)

🐛 **Fixed `TypeError: Cannot read properties of undefined (reading 'dmWebhooks')`** in `EnhancedTaskManagementWaratah.gs` — same fix as Sakura. All `TASK_CONFIG.slack.*` references replaced with Script Properties helper functions.

🔄 **`WeeklyRolloverInPlace.js` — Fresh template handling added**
- If no previous week data exists, rollover skips archiving (Steps 3-4) and still clears + updates dates
- Tab renaming now appends short date: `"WEDNESDAY 26/02"` etc.
- `previewRollover()` function added (dry run before executing)
- Trigger management: `createWeeklyRolloverTrigger()` / `removeWeeklyRolloverTrigger()` built in

---

## 📁 File Structure

```
THE WARATAH/
├── SHIFT REPORT SCRIPTS/    (16 .js files, ~6,022 LOC + 4 .html)
│   ├── NightlyExport.js              # Daily PDF export, email, Slack (1,016 LOC)
│   ├── IntegrationHub.js             # Data warehouse orchestrator (1,064 LOC)
│   ├── WeeklyRolloverInPlace.js      # Weekly rollover automation (965 LOC)
│   ├── AnalyticsDashboard.js         # Financial + executive dashboards (517 LOC)
│   ├── NightlyBasicExport.js         # Standalone basic report (261 LOC)
│   ├── TEST_DataExtractionVerification.js  # Data extraction tests (332 LOC)
│   ├── UIServer.js                   # HTML dialog serving (308 LOC)
│   ├── VenueConfig.js                # Hardcoded cell configuration (276 LOC)
│   ├── _SETUP_ScriptProperties.js    # Script Properties setup (222 LOC)
│   ├── TEST_VenueConfig.js           # VenueConfig tests (212 LOC)
│   ├── WeeklyDigestWaratah.js        # Weekly revenue Slack digest (202 LOC)
│   ├── DiagnoseSlack.js              # Webhook diagnostics (170 LOC)
│   ├── SlackBlockKitWaratahSR.js     # Block Kit message builders (159 LOC)
│   ├── Menu.js                       # Menu system (156 LOC)
│   ├── TEST_SlackBlockKitLibrary.js  # Block Kit tests (103 LOC)
│   ├── TaskIntegration.js            # Bridge to task management (59 LOC)
│   └── 4 .html: analytics-viewer, checklist-dialog, export-dashboard, rollover-wizard
│
└── TASK MANAGEMENT SCRIPTS/ (6 .gs files, ~3,349 LOC + 1 .html)
    ├── EnhancedTaskManagementWaratah.gs  # Main task system (2,131 LOC)
    ├── TaskDashboardWaratah.gs       # Dashboard (429 LOC)
    ├── Menu_Updated_Waratah.gs       # Task menu (270 LOC)
    ├── _SETUP_ScriptProperties.gs    # Task Properties setup (237 LOC)
    ├── SlackBlockKitWaratah.gs       # Task Slack messages (161 LOC)
    ├── UIServerWaratah.gs            # Task UI server (121 LOC)
    └── task-manager.html
```

**Total:** ~9,371 LOC across 22 code files + 5 HTML files

---

## 🚀 Quick Operations

### Daily: Export Shift Report PDF
```
Menu: Waratah Tools → Daily Reports → Export & Email PDF (LIVE)

Workflow:
1. Fill out shift sheet (date, MOD, revenue, tasks)
2. Click menu item
3. Confirm prompts (Deputy timesheets, fruit order)
4. System processes (~10 seconds)
5. PDF emailed + Slack posted + warehouse logged
```

### Weekly: Rollover (Automated Monday 10:00am)
```
Manual Run: Waratah Tools → Weekly Reports → Weekly Rollover (In-Place) → Run Rollover Now
Preview: → Preview Rollover (Dry Run)

Automation:
- Create Trigger: → Create Rollover Trigger
- Remove Trigger: → Remove Rollover Trigger
```

### Test Integrations
```javascript
// Apps Script Editor → Run
testIntegrations()       // Test on active sheet
runValidationReport()    // Full system validation
```

---

## ⚠️ Critical Rules

1. **Use `clearContent()` NOT `clear()`**
   - `clearContent()` = clears data only (preserves formatting) ✅
   - `clear()` = destroys everything (formatting, validation, formulas) ❌

2. **Password:** `chocolateteapot`
   - Stored in Script Properties as `MENU_PASSWORD`
   - TODO: Rotate and document securely

3. **Test on Copies**
   - Never test destructive operations on production files
   - Create copies for testing rollover and menu changes

4. **Hardcoded Cells**
   - The Waratah uses hardcoded cell references (B34, A43, etc.)
   - NOT named ranges (that's Sakura House)

5. **Merged Cell Clearing**
   - Narrative cells are merged A:F — value lives in column A
   - `clearContent()` on B:F of a merged A:F range does **NOT** clear the value
   - Always use `A##:F##` (not `B##:F##`) when clearing merged narrative cells

6. **Formula Cells (B34, B36, B37:B40) — DO NOT CLEAR**
   - B34 (Net Revenue) is a formula — warehoused in col F
   - B36 (Covers) is a formula — NOT warehoused (ignored)
   - B37 (Total Tips) is a formula — warehoused in col U
   - B38 (Labor Hours), B39 (Labor Cost) are formulas — NOT warehoused (ignored)
   - Clearing any of them during rollover destroys the formulas
   - Additional formula cells (B15, B16, B26-B29) were never in CLEARABLE_FIELDS

---

## 📖 Detailed Guides (Load on Demand)

**Architecture & Setup:**
- 📘 [DEEP_DIVE_ARCHITECTURE.md](docs/waratah/DEEP_DIVE_ARCHITECTURE.md) - File structure, venue config, script properties, task system

**Workflows:**
- 📗 [WORKFLOW_SHIFT_REPORTS.md](WORKFLOW_SHIFT_REPORTS.md) - Daily shift report workflow (user + backend perspective)
- 📗 [WORKFLOW_WEEKLY.md](docs/waratah/WORKFLOW_WEEKLY.md) - Weekly rollover workflow (automation, archiving, dates)

**Reference:**
- 📙 [CELL_REFERENCE_MAP.md](docs/waratah/CELL_REFERENCE_MAP.md) - All hardcoded cell references (B34, B52, etc.)
- 📙 [INTEGRATION_FLOWS.md](docs/waratah/INTEGRATION_FLOWS.md) - Data warehouse, Slack, email, task integrations

---

## 🔑 Key Files & Functions

### NightlyExport.js
```javascript
exportAndEmailPDF()              // Line 299 - Opens checklist dialog
continueExport(sheetName, isTest) // Line 170 - Main export (called from dialog)
postToSlackFromSheet()           // Line 657 - Block Kit Slack message
pushTodosToMasterActionables()   // Line 362 - Push TODOs to task sheet
generatePdfForSheet_NoUI_()      // Line 826 - Generate PDF (no UI context)
_getExportConfig_()              // Line 96 - Lazy-load venue config
```

### IntegrationHub.js
```javascript
runIntegrations(sheetName)       // Line 73 - Orchestrate all integrations
extractShiftData_(sheetName)     // Line 188 - Read cells B3, B4, B34, etc.
logToDataWarehouse_(shiftData)   // Line 339 - Write to 4 warehouse sheets
validateShiftData_(shiftData)    // Line 511 - Check revenue logic, required fields
```

### WeeklyRolloverInPlace.js
```javascript
performWeeklyRollover()          // Main rollover function
validatePreconditions_()         // Check file ID, venue, archive folder
generateWeekSummary_()           // Calculate week stats (throws 'No valid dates found' on fresh template)
exportPdfToArchive_(summary)     // Create PDF in Archive/YYYY/YYYY-MM/pdfs/
createArchiveSnapshot_(summary)  // Copy spreadsheet to Archive/YYYY/YYYY-MM/sheets/
clearAllSheetData_()             // Clear data via clearContent() (preserves structure)
updateDatesToNextWeek_()         // Calculate & set Wed-Sun dates + rename tabs; returns nextWednesday Date
sendRolloverNotifications_()     // Email + Slack to managers
previewRollover()                // Dry run — shows what would happen, no changes made
createWeeklyRolloverTrigger()    // Create Monday 10:00am trigger
removeWeeklyRolloverTrigger()    // Delete the rollover trigger
getSheetByDayPrefix_(ss, day)    // Find sheet by day prefix (handles renamed tabs like "WEDNESDAY 26/02")
```

**Fresh template handling:** If `generateWeekSummary_()` throws `'No valid dates found'`, rollover skips archiving (Steps 3-4) and continues with clearing + date update. First rollover after deploying to a new file is safe.

### EnhancedTaskManagementWaratah.gs
```javascript
createTask(taskData)             // Create new task (9-status workflow)
updateTask(row, updates)         // Update existing task
escalateBlockedTasks()           // Auto-escalate after 14 days
archiveCompletedTasks()          // Auto-archive after 30 days
```

---

## 🔧 Script Properties (18 Total)

**File:** `_SETUP_ScriptProperties.js`

```javascript
setupScriptProperties()     // Run once to configure all properties
verifyScriptProperties()    // Verify setup is correct
resetScriptProperties()     // CAUTION: Deletes all properties
```

**Key Properties:**
```
VENUE_NAME: "WARATAH"
MENU_PASSWORD: "chocolateteapot"
WARATAH_WORKING_FILE_ID: "[current_week_spreadsheet_id]"
WARATAH_DATA_WAREHOUSE_ID: "[warehouse_spreadsheet_id]"
ARCHIVE_ROOT_FOLDER_ID: "[archive_folder_id]"
WARATAH_SLACK_WEBHOOK_LIVE: "https://hooks.slack.com/..."
WARATAH_EMAIL_RECIPIENTS: '["email1@...", "email2@..."]'
```

See [DEEP_DIVE_ARCHITECTURE.md](docs/waratah/DEEP_DIVE_ARCHITECTURE.md#script-properties-configuration) for complete list.

---

## 📊 Data Warehouse (4 Sheets)

**Warehouse ID:** Script Properties → `WARATAH_DATA_WAREHOUSE_ID`

**Schema overhaul (Mar 6, 2026):** All 4 sheets redesigned — misaligned headers fixed, covers/labor removed, full financial breakdown (B8, B15-B29) added. Existing data cleared and backfilled fresh.

```
1. NIGHTLY_FINANCIAL      (22 cols A-V) - Full financial breakdown
   A=Date, B=Day, C=WeekEnding, D=MOD, E=Staff,
   F=NetRevenue, G=ProductionAmount, H=CashTakings,
   I=GrossSalesIncCash, J=CashReturns, K=CDDiscount,
   L=Refunds, M=CDRedeem, N=TotalDiscount,
   O=DiscountsCompsExcCD, P=GrossTaxableSales,
   Q=Taxes, R=NetSalesWTips, S=CardTips, T=CashTips,
   U=TotalTips, V=LoggedAt

2. OPERATIONAL_EVENTS     (8 cols A-H) - TO-DOs (one row per TODO)
   A=Date, B=Day, C=MOD, D=Description, E=Assignee,
   F=Priority, G=Source, H=LoggedAt

3. WASTAGE_COMPS          (6 cols A-F) - Wastage notes
   A=Date, B=Day, C=WeekEnding, D=MOD, E=Notes, F=LoggedAt

4. QUALITATIVE_LOG        (11 cols A-K) - Shift narratives
   A=Date, B=Day, C=MOD, D=ShiftSummary, E=GuestsOfNote,
   F=TheGood, G=TheBad, H=KitchenNotes, I=Maintenance,
   J=RSAIncidents, K=LoggedAt
```

**Removed fields:** Covers (B36), LaborHours (B38), LaborCost (B39), AvgCheck, Labor%, RevPAH, CardTotal (duplicate of CardTips)

**Duplicate Prevention (hardened Feb 23, 2026):** Uses `normaliseDateKey_()` to handle both Date objects and string-stored dates. Date + MOD composite key checked across all 4 sheets before logging.

**New helpers (Feb 23, 2026) in IntegrationHub.js:**
- `parseCellDate_(value)` -- Parses `dd/MM/yyyy` strings using `Utilities.parseDate` with Australia/Sydney timezone
- `normaliseDateKey_(v)` -- Normalises Date objects OR string-stored dates to canonical `toDateString()` form
- `showIntegrationLogStats()` -- 30-day summary dialog of INTEGRATION_LOG

**Data Warehouse Menu (`Admin Tools → Data Warehouse`):**
- Backfill This Sheet to Warehouse
- Show Integration Log (Last 30 Days)
- Setup Weekly Backfill Trigger

See [INTEGRATION_FLOWS.md](docs/waratah/INTEGRATION_FLOWS.md) for detailed schema.

---

## 📈 Weekly Revenue Digest

**File:** `WeeklyDigestWaratah.js` (NEW Feb 23, 2026)

Posts a weekly revenue performance summary to Slack, comparing this week vs last week.

**Functions:**
```javascript
sendWeeklyRevenueDigest_Waratah()       // Main — posts to LIVE Slack webhook
sendWeeklyRevenueDigest_Waratah_Test()  // Posts to TEST Slack webhook
computeWeeklyStats_Waratah_(warehouseId) // Reads NIGHTLY_FINANCIAL, computes stats
buildWeeklyDigestBlocks_Waratah_(stats)  // Block Kit message with change arrows, best day, tips
setupWeeklyDigestTrigger_Waratah()       // Installs Wednesday 8am trigger (safe to re-run)
```

**Menu:** `Admin Tools → Weekly Digest`
- Send Revenue Digest (LIVE)
- Send Revenue Digest (TEST)
- Setup Wednesday Digest Trigger

**Data Source:** NIGHTLY_FINANCIAL sheet via `getIntegrationConfig_().dataWarehouseId`

**Trigger:** Wednesday 8am (Australia/Sydney) -- NOT YET SET UP. Must be installed manually via:
- Menu: `Admin Tools → Weekly Digest → Setup Wednesday Digest Trigger`, or
- Run `setupWeeklyDigestTrigger_Waratah()` from the Apps Script editor

---

## 📅 Weekly Rollover Details

**Automated:** Monday 10:00am (Australia/Sydney)

**What It Does:**
1. Archives previous week (PDF + Sheets snapshot)
2. Clears all data fields (preserves structure)
3. Updates dates to next Wednesday-Sunday
4. Sends notifications (email + Slack)

**Archive Structure:**
```
Archive/
└── 2026/
    └── 2026-02/
        ├── pdfs/Waratah_Shift_Report_WE_2026-02-23.pdf
        └── sheets/Waratah_Week_Ending_2026-02-23 (SNAPSHOT)
```

**Fresh Template:** First rollover skips archiving (no previous data)

See [WORKFLOW_WEEKLY.md](docs/waratah/WORKFLOW_WEEKLY.md) for complete details.

---

## 🎯 Task Management System (v1.2.0)

**8-Status Workflow:**
```
NEW → TO DO → IN PROGRESS → DONE
              ↓
          BLOCKED (escalates after 14 days)
              ↓
          DEFERRED → CANCELLED → RECURRING
```

**14-Column Structure (A=Status, B=Priority):**
- Status, Priority, Staff Allocated, Area, Description
- Due Date, Date Created, Date Completed, Days Open
- Blocker Notes, Source, Recurrence, Last Updated, Updated By

**Sort Order:** Active/Completed → Priority → Status → Staff

**Scheduled Triggers:**

| Trigger | Schedule | Handler |
|---------|----------|---------|
| Bi-hourly Cleanup | Every 2hrs | `cleanupAndSortMasterActionables()` |
| Staff Workload Refresh | Daily 6am | `runScheduledStaffWorkload()` |
| Archive Old Tasks | Monday 6am | `runScheduledArchive()` |
| Overdue Summary | Sunday 9am | `runScheduledOverdueSummary()` |
| Weekly Summary | Mon 9am (optional) | `sendWeeklyActiveTasksSummary()` |
| onEdit Auto-sort | Every edit | `onTaskSheetEditWithAutoSort()` |
| Weekly Rollover | Monday 10am | `performWeeklyRollover()` |

**Note:** Daily maintenance was decomposed into individual triggers (Mar 6, 2026). `runDailyTaskMaintenance()` no longer exists as a bundled function.

**Staff with Slack DM:**
- Evan, Cynthia, Andie, Adam, Lily, Blade, Dipti

See [DEEP_DIVE_ARCHITECTURE.md](docs/waratah/DEEP_DIVE_ARCHITECTURE.md#enhanced-task-management-system) for full details.

---

## 🧪 Testing Checklist

- [ ] Test on COPY of working file (not production)
- [ ] Check Apps Script logs for errors (Executions tab)
- [ ] Test menu functionality (all items accessible)
- [ ] Confirm Slack notifications send (check #managers)
- [ ] Validate data warehouse writes (check 4 sheets)
- [ ] Verify email delivery (check 9 recipients)
- [ ] Preview rollover before running live

---

## 🆘 Common Issues

### "TypeError: Cannot read properties of undefined (reading 'dmWebhooks')"
**Fixed in BOTH venues** (Feb 23, 2026) — `EnhancedTaskManagement_Sakura.gs` and `EnhancedTaskManagementWaratah.gs`.
- `TASK_CONFIG` contains **only** spreadsheet/sheet/threshold settings — no Slack config
- Use helper functions: `getManagersChannelWebhook_()`, `getSlackDmWebhooks_()`, `getEscalationSlackWebhook_()`, `getEscalationEmail_()`
- See CLAUDE_SHARED.md §4 for details

### "Prompt is too long" in Claude
**Solution:** You're reading this file! Detailed guides are now modular:
- Load [DEEP_DIVE_ARCHITECTURE.md](docs/waratah/DEEP_DIVE_ARCHITECTURE.md) for architecture details
- Load [WORKFLOW_WEEKLY.md](docs/waratah/WORKFLOW_WEEKLY.md) for rollover details
- Load [INTEGRATION_FLOWS.md](docs/waratah/INTEGRATION_FLOWS.md) for integration details

### Rollover Fails with "Wrong file"
```javascript
// Check file ID matches Script Property
const currentId = SpreadsheetApp.getActiveSpreadsheet().getId();
const configuredId = PropertiesService.getScriptProperties()
  .getProperty('WARATAH_WORKING_FILE_ID');
Logger.log(`Current: ${currentId}\nConfigured: ${configuredId}`);
```

### Email Not Sending
```javascript
// Verify recipients configured
const recipients = PropertiesService.getScriptProperties()
  .getProperty('WARATAH_EMAIL_RECIPIENTS');
Logger.log(recipients);  // Should be JSON array
```

### Slack Not Posting
```javascript
// Test webhook
const webhook = PropertiesService.getScriptProperties()
  .getProperty('WARATAH_SLACK_WEBHOOK_LIVE');
// Run DiagnoseSlack.js functions to test
```

---

## 📝 Quick Lookup

| Item | Value | Notes |
|------|-------|-------|
| **Venue Name** | THE WARATAH | Script Property: VENUE_NAME |
| **Operating Days** | 5 (Wed-Sun) | Closed Mon-Tue |
| **Sheet Names** | WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY | Exactly 5 sheets |
| **Cell Strategy** | Hardcoded | B34, A53, etc. (not named ranges) |
| **Rollover Type** | In-place | Same file ID persists |
| **Rollover Time** | Monday 10:00am | Australia/Sydney timezone |
| **Admin Password** | chocolateteapot | TODO: Rotate |
| **Timezone** | Australia/Sydney | Critical for triggers |

---

## 🔗 Related Documentation

- **Sakura House:** See `CLAUDE_SAKURA.md` (uses named ranges instead of hardcoded cells)
- **Shared Patterns:** See `CLAUDE_SHARED.md` (duplicate prevention, clear vs clearContent, etc.)
- **Full Analysis:** See `CODE_ANALYSIS.md` (complete code structure)
- **Improvement Plan:** See `THE WARATAH/ARCHITECTURE_IMPROVEMENT_PLAN.md` (optimization roadmap)

---

## ⚡ Development Quick Tips

**Deployment workflow (clasp push + git push):**
```
1. Edit code locally
2. clasp push                    # Deploy to Google Apps Script (production)
3. git add <files> && git commit # Version history
4. git push origin main          # Push to GitHub (independent of clasp)
```
Note: `_SETUP_*` files are gitignored (they contain Slack webhook secrets). `.clasp.json` and `.clasprc.json` are also excluded.

**Read a value:**
```javascript
const netRevenue = sheet.getRange('B34').getValue();  // Direct reference
```

**Write a value:**
```javascript
sheet.getRange('B34').setValue(2450.00);  // Direct reference
```

**Clear content (rollover):**
```javascript
sheet.getRange('B34').clearContent();  // NOT clear()!
```

**Get venue config:**
```javascript
const config = getVenueConfig_();
if (config.name === 'THE WARATAH') {
  // Waratah-specific logic
}
```

---

**Last Updated:** March 6, 2026
**Version:** 3.1
**Status:** ✅ Fully operational and production-ready
**Total LOC:** ~9,371 lines across 22 code files + 5 HTML files

**For detailed information, load the specific guide you need from `docs/waratah/`**
