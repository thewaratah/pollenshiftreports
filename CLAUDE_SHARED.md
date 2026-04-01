# SHIFT REPORTS 3.0 - Shared Architecture Guide

**Last Updated:** April 2, 2026
**Project Type:** Google Apps Script (Multi-Venue Hospitality Management System)

> **Note:** This guide covers patterns and systems **shared by both venues**. For venue-specific details, see `CLAUDE_SAKURA.md` or `CLAUDE_WARATAH.md`.

**Recent Updates (Apr 2, 2026):**
- **Both venues:** Added QUERY MONTH() 0-indexing gotcha — QUERY language months are 0-indexed (Jan=0) vs spreadsheet MONTH() which is 1-indexed (Jan=1); fix: use `MONTH(A)+1` in QUERY clauses to display correct months (Sakura buildExecutiveDashboard example provided)

**Previous Updates (Mar 18, 2026):**
- **Both venues:** Small items S1-S9 — setupAllTriggers menu item (S1), post-rollover validation (S2), LockService re-entrancy fix via `skipLock` param (S8), `logPipelineLearning_()` utility appends to LEARNINGS tab (S9)
- **Sakura:** `requirePassword_()` reads from Script Properties (S1); `validateRolloverResult_()` Step 9 in rollover (S2); IntegrationHub auto-builds ANALYTICS tab (S8)
- **Waratah:** `requirePassword_()` reads from MENU_PASSWORD Script Property (S1); WeeklyRolloverInPlace `validateRolloverResult_()` + trigger helper try/catch (S2); NightlyExport duplicate detection checks ALL open tasks (S9)

**Previous Updates (Feb 26, 2026):**
- **Both venues:** `runIntegrations()` fully non-blocking in `continueExport()` — warehouse errors go to `Logger.log()` only; export always proceeds
- **Both venues:** TEST path Slack calls wrapped in try/catch in NightlyExport files
- **Both venues:** `checklist-dialog.html` success UX replaced browser `alert()` with in-dialog green success message + 2-second auto-close

---

## Shared Design Patterns

### 1. Venue Abstraction Pattern

**Problem:** Support multiple venues with different configurations

**Solution:**
```javascript
// 1. Get venue config
const config = getVenueConfig_();

// 2. Conditional logic based on config
if (config.ranges.usesNamedRanges) {
  // Sakura: use named ranges
  const range = getFieldRange(sheet, 'netRevenue');
} else {
  // Waratah: use hardcoded cells
  const range = sheet.getRange('B54');
}

// 3. Abstraction layer hides differences
const value = getRangeValue_(sheet, 'netRevenue');  // Works for both
```

**Benefits:**
- Single codebase serves multiple venues
- Venue-specific config centralized
- Easy to add new venues

---

### 2. Duplicate Detection Pattern

**Problem:** Prevent duplicate entries in data warehouse

**Solution:**
```javascript
// Composite key: date + MOD
const isDuplicate = existingData.some(row =>
  row[0] instanceof Date &&
  row[0].toDateString() === shiftData.date.toDateString() &&
  row[3] === shiftData.mod
);

if (isDuplicate) {
  Logger.log(`Duplicate prevented`);
  return;  // Skip
}

sheet.appendRow([...data]);  // Safe to append
```

**Benefits:**
- Idempotent operations
- Safe to re-run exports
- No data duplication

---

### 3. Clear Content vs Clear Pattern

**CRITICAL PATTERN FOR ROLLOVER:**

```javascript
// ✅ CORRECT - Preserves structure, formatting, named ranges
const range = sheet.getRange('B54');
range.clearContent();

// ❌ WRONG - Destroys formatting, validation, named ranges, formulas
range.clear();
```

**Why This Matters:**
- `clear()` removes named ranges → scripts stop working (critical for Sakura)
- `clear()` removes data validation → dropdowns disappear
- `clear()` removes formulas → calculations break
- `clearContent()` only removes values → everything else survives
- **Always use `clearContent()` for rollover/data clearing**

---

### 4. TASK_CONFIG Does NOT Contain Slack/Email Config ⚠️

**Critical gotcha (discovered Feb 23, 2026):**

`TASK_CONFIG` in both venues contains **only** spreadsheet/sheet/timezone/threshold settings:
```javascript
const TASK_CONFIG = {
  spreadsheetId: "...",
  sheets: { master, audit, archive },
  timezone: "Australia/Sydney",
  escalation: { blockedDaysBeforeEscalate: 14, escalateToName: "Evan" },
  archive: { daysBeforeArchive: 8 }
};
// ❌ NO slack property. NO webhook URLs. NO email addresses.
```

All Slack webhooks and emails are fetched at runtime via Script Properties helpers:
```javascript
// ✅ CORRECT — use these helpers, not TASK_CONFIG.slack.*
getManagersChannelWebhook_()    // SLACK_MANAGERS_CHANNEL_WEBHOOK
getSlackDmWebhooks_()           // SLACK_DM_WEBHOOKS (JSON object)
getEscalationSlackWebhook_()    // ESCALATION_SLACK_WEBHOOK
getEscalationEmail_()           // ESCALATION_EMAIL
```

**Never** add `slack: {}`, `dmWebhooks`, or email addresses directly to `TASK_CONFIG`.

---

### 5. LockService Re-entrancy Prevention Pattern (S8, Mar 18, 2026)

**Problem:** When a function holding a LockService lock calls another function that tries to acquire the same lock, it deadlocks.

**Solution:** Pass `skipLock` parameter to inner functions:
```javascript
// Outer function (holds lock for 30 seconds)
function runWeeklyBackfill_() {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);
  try {
    const shiftData = extractShiftData_();
    // Inner function is also lock-eligible, but we already hold the lock
    logToDataWarehouse_(shiftData, config, skipLock=true);  // ✅ Skips lock acquisition
  } finally {
    lock.releaseLock();
  }
}

// Inner function (can be called with or without outer lock)
function logToDataWarehouse_(shiftData, config, skipLock) {
  if (!skipLock) {
    const lock = LockService.getScriptLock();
    lock.tryLock(30000);
  }
  try {
    // ... write to warehouse ...
  } finally {
    if (!skipLock) {
      lock.releaseLock();
    }
  }
}
```

**Benefits:**
- ✅ Prevents deadlocks in nested calls
- ✅ Inner functions still protect themselves when called independently
- ✅ Clear intent at callsite (skipLock=true signals lock already held)

**Status:** ✅ Implemented in both venues' IntegrationHub (S8, Mar 18)

---

### 6. Pipeline Learning Utility Pattern (S9, Mar 18, 2026)

**Purpose:** Log operational diagnostics to LEARNINGS tab in data warehouse when integrations fail.

**Implementation:**
```javascript
function logPipelineLearning_(context, issue, fix) {
  // Appends to LEARNINGS sheet in data warehouse
  // context: "IntegrationHub.runIntegrations", "NightlyExport.continueExport", etc.
  // issue: "Duplicate detection failed", "Slack webhook timeout", etc.
  // fix: "Retried with backoff", "Logged to Logger.log", etc.

  const warehouse = SpreadsheetApp.openById(config.dataWarehouseId);
  const sheet = warehouse.getSheetByName('LEARNINGS') || warehouse.insertSheet('LEARNINGS');
  sheet.appendRow([new Date(), context, issue, fix]);
}
```

**Called from:**
- `IntegrationHub.js`: catch block of `runIntegrations()` (Waratah S8)
- `IntegrationHubSakura.gs`: catch block of `runIntegrations()` (Sakura S9)
- `SlackBlockKitWaratahSR.js` and `SlackBlockKitSakuraSR.gs`: error handlers

**Benefits:**
- ✅ Non-blocking diagnostic logging
- ✅ Operational insights into system failures
- ✅ Cumulative learning log for improvement tracking

**Status:** ✅ Implemented in both venues (S9, Mar 18)

---

### 7. Script Properties Security Pattern ✅

**CRITICAL:** Never hardcode credentials, webhooks, or passwords in source code. Use Script Properties for all sensitive configuration.

**Implementation:**
```javascript
// Read from Script Properties (secure)
function getMenuPassword_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('MENU_PASSWORD');
}

function getSlackWebhook_() {
  const props = PropertiesService.getScriptProperties();
  const venueName = props.getProperty('VENUE_NAME'); // 'SAKURA' or 'WARATAH'
  return props.getProperty(`${venueName}_SLACK_WEBHOOK_LIVE`);
}

// Interactive setup (no hardcoded values)
function setupScriptProperties() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  // Prompt for password
  const passwordResponse = ui.prompt(
    'Setup: Menu Password',
    'Enter the admin menu password:',
    ui.ButtonSet.OK_CANCEL
  );

  if (passwordResponse.getSelectedButton() === ui.Button.OK) {
    props.setProperty('MENU_PASSWORD', passwordResponse.getResponseText());
  }

  // Repeat for all sensitive values (webhooks, email lists, etc.)
}
```

**Password Protection Pattern:**
```javascript
function requirePassword_() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Password Required',
    'Enter admin password:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return false;
  }

  const correctPassword = getMenuPassword_();
  return response.getResponseText() === correctPassword;
}

function protectedOperation() {
  if (!requirePassword_()) {
    SpreadsheetApp.getUi().alert('Operation cancelled or incorrect password.');
    return;
  }

  // ... destructive operation ...
}
```

**Benefits:**
- ✅ No credentials in source code (safe to commit to git)
- ✅ No cross-venue credential exposure
- ✅ Can rotate webhooks without code changes
- ✅ Interactive setup prevents accidental commits
- ✅ Audit trail via Script Properties UI

**Setup Files:**
- Sakura: `_SETUP_ScriptProperties_SakuraOnly.gs`
- Waratah: `_SETUP_ScriptProperties_WaratahOnly.gs`

**Status:** ✅ Implemented in both venues (Feb 2026)

---

### 8. QUERY MONTH() is 0-indexed (Google Sheets Language Gotcha)

**Problem:** Google Sheets QUERY language uses 0-indexed months (Jan=0, Dec=11), unlike spreadsheet formulas which use 1-indexed months (Jan=1, Dec=12).

**Symptom:**
```javascript
// ❌ WRONG — displays one month behind
sheet.getRange(row, 1).setFormula(
  `=QUERY(${src}!A2:P,"SELECT YEAR(A)*100+MONTH(A) GROUP BY YEAR(A)*100+MONTH(A)")`
);
// Result: April 2026 data shows as "2026/03" instead of "2026/04"
```

**Solution:**
```javascript
// ✅ CORRECT — add 1 to MONTH() in QUERY (only)
sheet.getRange(row, 1).setFormula(
  `=QUERY(${src}!A2:P,` +
  `"SELECT YEAR(A)*100+(MONTH(A)+1) GROUP BY YEAR(A)*100+(MONTH(A)+1)")`
);
// Result: April 2026 data correctly shows as "2026/04"
```

**Key Points:**
- QUERY language only (affects `MONTH()`, `QUARTER()` in QUERY string)
- Regular spreadsheet `=MONTH()` is unaffected (already 1-indexed, correct)
- SUMPRODUCT with `MONTH()` is unaffected (uses spreadsheet engine, 1-indexed)
- Must adjust in all references: SELECT, WHERE, GROUP BY, ORDER BY, LABEL

**Example (Sakura Executive Dashboard Monthly Trend):**
```javascript
// buildExecutiveDashboard() line 355–363
const monthHeaders = ["Month", "Revenue", "Tips", "Production", "Discounts", "Cash Takings", "Shifts"];
sheet.getRange(row, 1).setFormula(
  `=IFERROR(QUERY(${src}!A2:P,` +
  `"SELECT YEAR(A)*100+(MONTH(A)+1), SUM(E), SUM(H), SUM(J), SUM(K), SUM(F), COUNT(A) ` +
  `WHERE A IS NOT NULL ` +
  `GROUP BY YEAR(A)*100+(MONTH(A)+1) ` +
  `ORDER BY YEAR(A)*100+(MONTH(A)+1) DESC ` +
  `LABEL YEAR(A)*100+(MONTH(A)+1) 'Month', SUM(E) 'Revenue', ..."),"")`
);
// Format 202604 as "2026/04" using number format: 0000"/"00
sheet.getRange(12, 1, 50, 1).setNumberFormat("0000\"/\"00");
```

**Status:** ✅ Fixed in Sakura buildExecutiveDashboard() (Apr 2, 2026)

---

### 9. Known Pitfalls from Production Incidents

> Sourced from `docs/pipeline-learnings.md`. After each new incident, add a summary here AND append to that log.

**9a. clearContent() vs clearContents() — Range vs Sheet**

| Method | Works On | Exists? |
|--------|----------|---------|
| `range.clearContent()` | Range | ✅ Yes |
| `sheet.clearContents()` | Sheet | ✅ Yes (plural) |
| `sheet.clearContent()` | Sheet | ❌ **TypeError** |
| `sheet.clear()` | Sheet | ⚠️ **Destroys formatting** — never use |

**Safe pattern:** `sheet.getDataRange().clearContent()` (gets Range first, then clears). Incident: TaskDashboard in both venues, Mar 2026.

**9b. Formula cells must NEVER appear in CLEARABLE_FIELDS**

Rollover CLEARABLE_FIELDS must not include formula cells. Clearing them destroys the formula permanently.

| Venue | Formula cells (never clear) |
|-------|---------------------------|
| Waratah | B15, B16, B26-B29, B34, B36, B38, B39 |
| Sakura | Depends on named range `isFormula: true` flags in FIELD_CONFIG |

Mark formula cells with `isFormula: true` in FIELD_CONFIG. Incident: Waratah B34 (Net Revenue) cleared during rollover, Mar 2026.

**9c. CLEARABLE_FIELDS keys must match FIELD_CONFIG keys exactly**

If CLEARABLE_FIELDS uses `cashDiscount` but FIELD_CONFIG uses `cdDiscount`, the field won't be cleared during rollover (silent mismatch). Always use `getClearableFieldKeys_()` from FIELD_CONFIG — never maintain a parallel list. Incident: Waratah named range migration, Mar 18 2026.

---

## Shared Systems

### 1. Enhanced Task Management (8-Status Workflow)

**Files:**
- Sakura: `EnhancedTaskManagement_Sakura.gs` (1,964 lines)
- Waratah: `EnhancedTaskManagement_Waratah.gs`

**8-Status Workflow:**
```
NEW → TO DO → IN PROGRESS → DONE
              ↓
          BLOCKED (escalates after 14 days)
              ↓
          DEFERRED
              ↓
          CANCELLED
              ↓
          RECURRING (auto-regenerates)
```

**Data Schema (14 columns):**
| Column | Field | Type |
|--------|-------|------|
| A | Status | Dropdown (8 statuses) |
| B | Priority | URGENT, HIGH, MEDIUM, LOW |
| C | Staff Allocated | Dropdown (venue-specific staff) |
| D | Area | FOH, BOH, Bar, Kitchen, Admin, etc. |
| E | Description | Text |
| F | Due Date | Date |
| G | Date Created | Date (auto) |
| H | Date Completed | Date (auto) |
| I | Days Open | Formula: `=TODAY()-G2` |
| J | Blocker Notes | Text |
| K | Source | Shift Report, Meeting, Ad-hoc |
| L | Recurrence | None, Weekly, Fortnightly, Monthly |
| M | Last Updated | Date (auto) |
| N | Updated By | Email (auto) |

**Key Features:**

**1. Auto-Sort on Edit**
- Triggers via `onEdit` installable trigger
- Sort order: Active vs Completed → Priority → Status → Staff (Waratah v1.2.0; was Priority → Staff → Status)

**2. Blocked Task Escalation**
- Tasks blocked > 14 days → escalate to manager
- Email + Slack DM notification

**3. Recurring Task Regeneration**
- DONE tasks with recurrence → auto-create next instance
- Weekly: next Monday
- Fortnightly: 2 weeks ahead
- Monthly: same Monday next month

**4. Auto-Archival (Waratah: Monday 6am; Sakura: Daily 7am)**
- DONE/CANCELLED tasks > 30 days → move to ARCHIVE sheet

**5. Overdue Task DMs (Removed Apr 2, 2026)**
- Overdue summary removed from daily maintenance; no longer posts to Slack
- Previous behavior: posted to #managers channel and sent individual DMs (both removed)

**6. Audit Logging (On Edit)**
- Every edit logged to AUDIT LOG sheet
- Tracks: Timestamp, Action, User, Task ID, Field Changed, Details

**Automation Setup (venue-specific):**
- Waratah: Daily maintenance decomposed into individual triggers (bi-hourly cleanup, daily staff workload, Monday archive). Sunday overdue summary trigger removed (Apr 2, 2026). See `CLAUDE_WARATAH.md` for full schedule.
- Sakura: Bundled `runDailyTaskMaintenance()` trigger (daily 7am) removes overdue summary function call (Apr 2, 2026).
- Both: `createOnEditTrigger()` for auto-sort; `createWeeklyActiveTasksSummary()` for Monday summaries (DM-only to individual staff).

**Conditional Formatting:**
- Status column: Color-coded
- Priority column: URGENT (red), HIGH (orange), MEDIUM (yellow), LOW (blue)
- Entire row: URGENT/BLOCKED (light red tint)
- Strikethrough: DONE/CANCELLED

---

### 2. Slack Block Kit Integration

**Files:**
- Sakura: `SlackBlockKitSAKURA.gs`
- Waratah: `SlackBlockKitWaratah.gs`

**Library Functions:**
```javascript
bk_header(text)                    // Header block
bk_section(text)                   // Text section
bk_divider()                       // Horizontal divider
bk_context([text])                 // Context (gray text)
bk_buttons([{text, url, style}])   // Action buttons
bk_post(webhookUrl, blocks, fallbackText)  // Send message
```

**Common Message Types:**

**1. Shift Report Export:**
```javascript
const blocks = [
  bk_header("Shift Report — Venue Name"),
  bk_section(`*${dayName} ${dateFormatted}*\n\nMOD: ${mod}\nNet Revenue: $${netRevenue}`),
  bk_divider(),
  bk_section(`*Shift Summary*\n${shiftSummary}`),
  bk_section(`*TO-DOs (${count})*\n${todoList}`),
  bk_buttons([{text: "View PDF", url: pdfUrl}])
];
bk_post(webhookUrl, blocks, "Shift Report");
```

**2. Task Escalation:**
```javascript
const blocks = [
  bk_header("Escalation Alert"),
  bk_section(`*${count} Task(s) Blocked > 14 Days*`),
  bk_section(`*1. ${description}*\nAssigned: ${assignee}\nDays Blocked: ${days}`),
  bk_buttons([{text: "Open Task Sheet", url: spreadsheetUrl, style: "danger"}])
];
bk_post(escalationWebhook, blocks, "Task Escalation");
```

**3. Weekly Active Tasks (DM-only as of Apr 2, 2026):**
```javascript
const blocks = [
  bk_header("Your Active Tasks This Week"),
  bk_context([`Week starting ${date}`]),
  bk_section(`*Tasks for you:*\n🔴 ${urgentTask}\n🟠 ${highTask}`),
  bk_buttons([{text: "Open Task Sheet", url: spreadsheetUrl}])
];
bk_post(dmWebhook, blocks, "Weekly Tasks");  // Sent to individual staff member DMs only
```

**Webhook Configuration (Script Properties):**
```javascript
// Live webhooks
SAKURA_SLACK_WEBHOOK_LIVE
WARATAH_SLACK_WEBHOOK_LIVE

// Test webhooks (to individual DMs)
SAKURA_SLACK_WEBHOOK_TEST
WARATAH_SLACK_WEBHOOK_TEST

// Escalation webhooks
ESCALATION_SLACK_WEBHOOK

// Manager channel
SLACK_MANAGERS_CHANNEL_WEBHOOK

// Individual DMs (JSON object)
SLACK_DM_WEBHOOKS: '{"Evan":"...", "Nick":"...", "Gooch":"..."}'

// Sakura only: FOH leads channel — DEPRECATED Apr 2026 (no longer used; getFohLeadsWebhook_() is dead code)
// SLACK_FOH_LEADS_WEBHOOK: "https://hooks.slack.com/services/..."
```

---

### 3. PDF Export & Email System

**Files:**
- Sakura: `NightlyExportSakura.gs` (400 lines)
- Waratah: `NightlyExportWaratah.gs`

**Flow:**
```
exportAndEmailPDF()
    ├─→ validateActiveSheet_()       // Ensure it's a day sheet
    ├─→ extractShiftData_()          // Extract all fields
    ├─→ buildTodoAggregation_()      // Aggregate TODOs from entire week
    ├─→ generatePdfForSheet_()       // Create PDF blob
    │       └─→ DriveApp.createFile(blob)
    ├─→ composeShiftReportEmail_()   // Build HTML email
    │       └─→ MailApp.sendEmail()
    ├─→ buildExportSlackBlocks_()    // Build Slack message
    │       └─→ SlackBlockKit.bk_post()
    └─→ runIntegrations(sheetName)   // Log to data warehouse (non-blocking — errors go to Logger.log() only)
```

**Design Constraints for `continueExport()` (Critical):**

`continueExport()` is invoked by `checklist-dialog.html` via `google.script.run`. Two rules apply without exception:

1. **Must NOT call `SpreadsheetApp.getUi()` or `ui.alert()`** — these throw `'Authorisation is required to perform that action'` in the `google.script.run` context. All UI feedback (success, error messages) must be handled by the dialog's JavaScript `withSuccessHandler` / `withFailureHandler` callbacks.

2. **Must return `{ success: boolean, message: string }`** — the dialog reads this object to decide whether to show the success state or an error message.

**Non-blocking integrations (Feb 26, 2026):** The `runIntegrations()` call inside `continueExport()` is wrapped so warehouse failures do not surface to the manager. Export (PDF, email, Slack) always proceeds. Warehouse errors are logged to `Logger.log()` only. Managers should never see system/warehouse errors — export flow is: Export → Slack/Email only, no other notices or warnings.

**PDF Generation:**
```javascript
const blob = sheet.getParent().getAs('application/pdf');
const pdfFile = DriveApp.createFile(blob);
pdfFile.setName(`${venueName} Shift Report - ${dayName} ${dateFormatted}.pdf`);
```

**Email Configuration (Script Properties):**
```javascript
SAKURA_EMAIL_RECIPIENTS: '["email1@...", "email2@..."]'
WARATAH_EMAIL_RECIPIENTS: '["email1@...", "email2@..."]'
```

**Email Template (HTML):**
- Header: Venue name, date, MOD
- Financials: Net revenue, tips breakdown
- Narrative: Shift summary, guests of note, issues
- TODOs: Aggregated week's tasks
- Footer: PDF attachment link

**Slack Notification:**
- Uses Slack Block Kit library
- Posts to #managers channel (live) or test webhook
- Includes: MOD, date, net revenue, shift summary, todo list, PDF link

---

### 4. Data Warehouse Integration

**Files:**
- Sakura: `IntegrationHubSakura.gs` (502 lines)
- Waratah: `IntegrationHubWaratah.gs`

**Flow:**
```
runIntegrations(sheetName)
    ├─→ extractShiftData_()      // Extract all fields via config
    ├─→ validateShiftData_()     // Validate required fields
    ├─→ logToDataWarehouse_()    // Write to 4 warehouse sheets
    │       ├─→ NIGHTLY_FINANCIAL
    │       ├─→ OPERATIONAL_EVENTS
    │       ├─→ WASTAGE_COMPS
    │       └─→ QUALITATIVE_LOG
    └─→ logIntegrationRun_()     // Log summary
```

**Data Warehouse Sheets (4 sheets per venue):**

**1. NIGHTLY_FINANCIAL** — Full financial breakdown per shift (Waratah: 22 cols A-V; Sakura: 16 cols A-P)
- Duplicate detection: date + MOD

**2. OPERATIONAL_EVENTS** — TO-DOs with assignees (Waratah: 8 cols; one row per TODO)
- Duplicate detection: date + task description

**3. WASTAGE_COMPS** — Wastage notes with context (Waratah: 6 cols)
- Duplicate detection: date + wastage text

**4. QUALITATIVE_LOG** — Shift narratives and observations (Waratah: 11 cols)
- Duplicate detection: date + MOD

**Note:** Column counts and schemas differ between venues. See `CLAUDE_SAKURA.md` or `CLAUDE_WARATAH.md` for exact schemas.

**Configuration (Script Properties):**
```javascript
SAKURA_DATA_WAREHOUSE_ID: "[spreadsheet_id]"
WARATAH_DATA_WAREHOUSE_ID: "[spreadsheet_id]"
```

---

## Common Script Properties

**Both venues require:**

```javascript
// Venue Identifier
VENUE_NAME: "SAKURA" or "WARATAH"

// Slack Webhooks
{VENUE}_SLACK_WEBHOOK_LIVE
{VENUE}_SLACK_WEBHOOK_TEST

// Email Recipients
{VENUE}_EMAIL_RECIPIENTS: '["email1@...", "email2@..."]'

// Spreadsheet IDs
{VENUE}_DATA_WAREHOUSE_ID
TASK_MANAGEMENT_SPREADSHEET_ID

// Task Management (shared webhooks)
ESCALATION_EMAIL
ESCALATION_SLACK_WEBHOOK
SLACK_MANAGERS_CHANNEL_WEBHOOK
SLACK_DM_WEBHOOKS: '{"Name":"webhook_url", ...}'

// Security (TODO: implement)
ADMIN_PASSWORD: "chocolateteapot"
```

**Setup Functions:**
- Sakura: `setupScriptProperties_SakuraShiftReports()`
- Waratah: `setupScriptProperties_WaratahShiftReports()`

---

## Common Development Guidelines

### Universal Patterns

**1. Clear Content Correctly:**
```javascript
// ✅ CORRECT - Preserves structure
range.clearContent();

// ❌ WRONG - Destroys everything
range.clear();
```

**2. Use Venue Configuration:**
```javascript
const config = getVenueConfig_();
// Adapt behavior based on config
```

**3. Validate Before Destructive Operations:**
```javascript
function performDestructiveOperation() {
  validatePreconditions_();  // Check state
  try {
    // ... operation ...
  } catch (error) {
    Logger.log(`❌ FAILED: ${error.message}`);
    throw error;
  }
}
```

**4. Log Consistently:**
```javascript
// Use emoji prefixes
Logger.log('✅ Success: Operation completed');
Logger.log('⚠️ Warning: Week incomplete');
Logger.log('❌ Error: File not found');
```

**5. Handle Errors Gracefully:**
```javascript
try {
  criticalOperation();
} catch (error) {
  Logger.log(`❌ ERROR: ${error.message}`);
  SpreadsheetApp.getUi().alert(
    'Operation Failed',
    error.message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  throw error;  // Re-throw for trigger failure notification
}
```

**6. Deployment: clasp push + git push (independent):**
- `clasp push` deploys to Google Apps Script (production runtime)
- `git push` commits to GitHub at `github.com/thewaratah/pollenshiftreports` (version history only)
- These are independent -- `git push` does not affect production; `clasp push` does not update git
- Standard workflow: edit --> `clasp push` --> `git commit` + `git push`
- `_SETUP_*` files (webhook secrets), `.clasp.json`, and `.claude/` are gitignored

**7. Git branching (venue independence):**
- `main` — stable, merged code only; never commit directly
- `sakura/develop` — ongoing Sakura House work
- `waratah/develop` — ongoing Waratah work
- Feature branches: `sakura/fix-rollover`, `waratah/add-dashboard`, etc.
- Merge to `main` when a venue branch is stable: `git checkout main && git merge [venue]/develop && git push`

---

## Testing Strategy

### Manual Testing Checklist

Before deploying changes:

- [ ] Test on COPY of working file (never test on production)
- [ ] Run preview/dry run mode if available
- [ ] Check Apps Script logs for errors
- [ ] Test menu functionality
- [ ] Confirm Slack notifications send correctly
- [ ] Validate data warehouse writes
- [ ] Verify email delivery

### Shared Test Functions

```javascript
// Integrations
testIntegrations()                 // Test data extraction + validation
runValidationReport()              // Full system health check

// Task Management
testCreateTask()                   // Create sample task
testAuditLog()                     // Log sample entry
previewArchival()                  // Preview what would be archived
```

---

## Performance Considerations

**Bottlenecks:**
1. Range lookups (named ranges or hardcoded)
2. Data warehouse logging (multiple `appendRow()` calls)
3. PDF generation (`getAs('application/pdf')`)
4. Slack webhook POSTs

**Optimizations Applied (Mar 6, Waratah):**
1. `pushTodosDirectToMasterActionables_()` — `appendRow()` loop → single `setValues()` batch write
2. `buildTodoAggregationSheet_()` — nested `appendRow()` loop → single `setValues()` batch write
3. (PDF is acceptable for nightly operation)
4. Combine Slack messages where possible

**Apps Script Quotas:**
- Script runtime: 6 min/execution (consumer) or 30 min (workspace)
- Trigger runtime: 90 min/day
- **Current usage:** Well within limits

---

## Security Best Practices

**Authentication:**
- Container-bound scripts inherit spreadsheet permissions
- Only users with Edit access can run scripts
- Time-based triggers run with script owner's permissions

**Credentials Management:**
- ✅ Stored in Script Properties (not hardcoded)
- ✅ Password stored in Script Properties (`MENU_PASSWORD`) — read via `getMenuPassword_()` in both venues

**Data Security:**
- ✅ No PII in logs
- ✅ Webhook URLs in Script Properties only
- ✅ Duplicate detection prevents data corruption

**Recommendations:**
- Move password to Script Properties
- Add rate limiting for Slack webhooks
- Sanitize user input before HTML rendering
- Use separate Script Properties per venue (no cross-contamination)

---

## Dependencies

**Google Services:**
- Google Sheets API (v4)
- Google Drive API (v3)
- Gmail API (v1)
- Apps Script (V8 runtime)

**External Libraries:**
| Library | ID | Version |
|---------|----|---------|
| SlackBlockKit | `1J1PFjunHm6RErU8i5mE5tAnN3AEwbHBj6aCD3sO_Phs5G9qBx1RpzGFj` | 2 |

**External Services:**
- Slack (webhooks)
- Data Warehouse spreadsheets (venue-specific)

---

## Common Operations Reference

### Update Email Recipients
```javascript
// Script Properties → {VENUE}_EMAIL_RECIPIENTS
'["new.email@venue.com"]'
```

### Add New Staff to Task Management
```javascript
// Edit data validation in column C (Staff Allocated)
// Add new name to dropdown list
```

### Update Slack Webhooks
```javascript
// Script Properties → {VENUE}_SLACK_WEBHOOK_LIVE
"https://hooks.slack.com/services/NEW_WEBHOOK_URL"
```

### Add New Field to Data Warehouse
```javascript
// 1. Update extractShiftData_() to extract new field
// 2. Update logToDataWarehouse_() to write new field
// 3. Add column to appropriate warehouse sheet
```

---

**Last Updated:** April 2, 2026 (Removed overdue summaries, weekly active tasks now DM-only)
**Applies To:** Both Sakura House and The Waratah
