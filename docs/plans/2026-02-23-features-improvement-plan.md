# Features Improvement Plan — Both Venues (Shift Reports 3.0)

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Improve operational reliability, staff/management experience, and business intelligence across Sakura House and The Waratah, building on the P0–P3 fixes already deployed.

**Architecture:** Four phased workstreams — each phase is independently deployable. Phases 1–3 are low-risk additions to existing files. Phase 4 introduces new GAS files per venue. Phase 5 wires in Claude API via UrlFetchApp. Apply to both venues in parallel where possible.

**Tech Stack:** Google Apps Script, Slack Block Kit (`bk_post`), `UrlFetchApp`, `ScriptApp.newTrigger`, `PropertiesService`, Anthropic Claude API (Phase 5)

**Codebase Reference:**
- Sakura SR scripts: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/`
- Waratah SR scripts: `THE WARATAH/SHIFT REPORT SCRIPTS/`
- Sakura TM scripts: `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/`
- Waratah TM scripts: `THE WARATAH/TASK MANAGEMENT SCRIPTS/`

---

## Status

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | Tasks 1-4 | COMPLETE (deployed 2026-02-23) |
| Phase 2 | Tasks 5-6 | COMPLETE (deployed 2026-02-23) |
| Phase 3 | Task 7 | Pending |
| Phase 4 | Task 8 | Pending |
| Phase 5 | Task 9 | Pending |

**Notes:**
- No triggers have been set. Use menus to run manually until triggers are installed.
- Task 6 (overdue task alerts) was already implemented as `sendOverdueTasksSummary_()` in both TM projects -- called automatically by `runDailyTaskMaintenance()` daily.
- To test weekly digest: `Admin Tools → Weekly Digest → Send Revenue Digest (TEST)`

---

## Phase 1 — Accessibility & Robustness (Quick Wins)
**Estimated effort:** ~1 hour | **Risk:** Low

Both `backfillShiftToWarehouse` and `setupWeeklyBackfillTrigger` are already implemented but unreachable without opening the GAS editor. This phase surfaces them in the menu and hardens the duplicate-detection logic.

---

### Task 1: Add Data Warehouse submenu to Sakura menu

**Files:**
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/MenuSakura.gs`

The menu currently has no way to reach the new backfill and trigger functions. Add them under `Admin Tools → Data Warehouse`.

**Step 1: Read the current menu structure**

Open `MenuSakura.gs` and find the `onOpen` function. The `Integrations & Analytics` submenu (lines ~107–112) is the right place to extend — add a `Data Warehouse` sub-section nearby.

**Step 2: Add password-gated wrappers**

In the wrappers section (after line ~80), add:

```javascript
// === PASSWORD-GATED WRAPPERS: Data Warehouse ===
function pw_backfillShiftToWarehouse()      { if (requirePassword_()) backfillShiftToWarehouse(); }
function pw_setupWeeklyBackfillTrigger()    { if (requirePassword_()) setupWeeklyBackfillTrigger(); }
function pw_showIntegrationLogStats()       { if (requirePassword_()) showIntegrationLogStats(); }
```

**Step 3: Add submenu to onOpen**

Inside `Admin Tools`, after the `Integrations & Analytics` submenu block, add:

```javascript
.addSubMenu(ui.createMenu('Data Warehouse')
  .addItem('Backfill This Sheet to Warehouse', 'pw_backfillShiftToWarehouse')
  .addItem('Show Integration Log (Last 30 Days)', 'pw_showIntegrationLogStats')
  .addSeparator()
  .addItem('Setup Weekly Backfill Trigger', 'pw_setupWeeklyBackfillTrigger'))
```

**Step 4: Verify menu renders (manual)**

Open the spreadsheet → reload → `Admin Tools → Data Warehouse` should appear. The `showIntegrationLogStats` function will be added in Task 3 — for now the menu item will just show an error if clicked, which is acceptable.

**Step 5: Push to GAS**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS"
clasp push
```

---

### Task 2: Add Data Warehouse submenu to Waratah menu

**Files:**
- Modify: `THE WARATAH/SHIFT REPORT SCRIPTS/Menu.js`

Same as Task 1 but for Waratah.

**Step 1: Add password-gated wrappers** (after line ~57):

```javascript
// === PASSWORD-GATED WRAPPERS: Data Warehouse ===
function pw_backfillShiftToWarehouse()      { if (requirePassword_()) backfillShiftToWarehouse(); }
function pw_setupWeeklyBackfillTrigger()    { if (requirePassword_()) setupWeeklyBackfillTrigger(); }
function pw_showIntegrationLogStats()       { if (requirePassword_()) showIntegrationLogStats(); }
```

**Step 2: Add submenu to onOpen**

Inside `Admin Tools`, after the `Analytics` submenu:

```javascript
.addSeparator()
.addSubMenu(ui.createMenu('Data Warehouse')
  .addItem('Backfill This Sheet to Warehouse', 'pw_backfillShiftToWarehouse')
  .addItem('Show Integration Log (Last 30 Days)', 'pw_showIntegrationLogStats')
  .addSeparator()
  .addItem('Setup Weekly Backfill Trigger', 'pw_setupWeeklyBackfillTrigger'))
```

**Step 3: Push to GAS**

```bash
cd "THE WARATAH/SHIFT REPORT SCRIPTS"
clasp push
```

---

### Task 3: Integration log stats viewer (both venues)

**Files:**
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/IntegrationHubSakura.gs`
- Modify: `THE WARATAH/SHIFT REPORT SCRIPTS/IntegrationHub.js`

Add `showIntegrationLogStats()` to both files — reads the last 30 days from INTEGRATION_LOG and shows a summary dialog.

**Step 1: Add to Sakura IntegrationHubSakura.gs** (in MANUAL TESTING & UTILITIES section):

```javascript
/**
 * Show a summary of the last 30 days of integration runs from INTEGRATION_LOG.
 * Run from menu: Admin Tools → Data Warehouse → Show Integration Log
 */
function showIntegrationLogStats() {
  const ui = SpreadsheetApp.getUi();
  const warehouseId = getDataWarehouseId_();
  if (!warehouseId) {
    ui.alert('Not configured', 'SAKURA_DATA_WAREHOUSE_ID not set in Script Properties.', ui.ButtonSet.OK);
    return;
  }

  try {
    const warehouse = SpreadsheetApp.openById(warehouseId);
    const logSheet = warehouse.getSheetByName('INTEGRATION_LOG');
    if (!logSheet || logSheet.getLastRow() < 2) {
      ui.alert('No Data', 'INTEGRATION_LOG is empty or does not exist yet.', ui.ButtonSet.OK);
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const rows = logSheet.getDataRange().getValues().slice(1); // skip header
    const recent = rows.filter(r => r[0] instanceof Date && r[0] >= cutoff);

    const total = recent.length;
    const successes = recent.filter(r => r[2] === 'TRUE').length;
    const failures = total - successes;
    const financialLogged = recent.filter(r => r[6] === 'TRUE').length;
    const financialSkipped = recent.filter(r => r[7] === 'TRUE').length;
    const backfills = recent.filter(r => r[1] && r[1].includes('[BACKFILL]')).length;

    const msg =
      `Integration Log — Last 30 Days\n` +
      `${'─'.repeat(36)}\n` +
      `Total runs:          ${total}\n` +
      `Successful:          ${successes}\n` +
      `Failed/partial:      ${failures}\n\n` +
      `Financial logged:    ${financialLogged}\n` +
      `Duplicate skipped:   ${financialSkipped}\n` +
      `Manual backfills:    ${backfills}\n\n` +
      `Most recent: ${total > 0 ? recent[recent.length - 1][1] : 'N/A'}`;

    ui.alert('Integration Log Stats', msg, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', `Could not read INTEGRATION_LOG: ${e.message}`, ui.ButtonSet.OK);
  }
}
```

**Step 2: Add identical function to Waratah IntegrationHub.js**

The function body is identical except:
- Replace `getDataWarehouseId_()` with `getIntegrationConfig_().dataWarehouseId`
- The first line of the try block becomes:
  ```javascript
  const INTEGRATION_CONFIG = getIntegrationConfig_();
  if (!INTEGRATION_CONFIG.dataWarehouseId) { ... }
  const warehouse = SpreadsheetApp.openById(INTEGRATION_CONFIG.dataWarehouseId);
  ```

**Step 3: Push both projects**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS" && clasp push
cd "THE WARATAH/SHIFT REPORT SCRIPTS" && clasp push
```

---

### Task 4: Harden warehouse duplicate detection — string dates

**Files:**
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/IntegrationHubSakura.gs`
- Modify: `THE WARATAH/SHIFT REPORT SCRIPTS/IntegrationHub.js`

**Problem:** `row[0] instanceof Date` fails if the warehouse cell contains a text string instead of a true Date object (can happen if rows were pasted manually or imported via CSV). The `toDateString()` comparison then never matches, causing false duplicates to be written.

**Step 1: Add a normalization helper to both files**

Add this near the top of the `DATA WAREHOUSE LOGGING` section in both files:

```javascript
/**
 * Normalise a date value that may be a Date object or a date string
 * to a canonical "Weekday Mon DD YYYY" string for comparison.
 * Returns null if the value cannot be parsed as a valid date.
 *
 * @param {*} v - Date object or string
 * @returns {string|null}
 */
function normaliseDateKey_(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : parseCellDate_(v.toString());
  return (!d || isNaN(d.getTime())) ? null : d.toDateString();
}
```

**Step 2: Update duplicate detection in `logToDataWarehouse_` for both files**

Find the duplicate detection block (currently uses `row[0] instanceof Date && row[0].toDateString() === ...`). Replace every instance with:

```javascript
// Before (fragile — only matches Date objects, misses string-stored dates):
const isDuplicate = existingData.some(row =>
  row[0] instanceof Date &&
  row[0].toDateString() === shiftData.date.toDateString() &&
  row[3] === shiftData.mod
);

// After (handles both Date objects and string-stored dates):
const shiftDateKey = normaliseDateKey_(shiftData.date);
const isDuplicate = existingData.some(row => {
  const rowKey = normaliseDateKey_(row[0]);
  return rowKey !== null && rowKey === shiftDateKey && row[3] === shiftData.mod;
});
```

There are **4 duplicate-detection blocks** in each file (NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS, WASTAGE_COMPS, QUALITATIVE_LOG). Update all of them. The QUALITATIVE_LOG block uses `row[2]` for MOD (not `row[3]`) — preserve that.

**Step 3: Push both projects**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS" && clasp push
cd "THE WARATAH/SHIFT REPORT SCRIPTS" && clasp push
```

---

## Phase 2 — Weekly Intelligence Digest
**Estimated effort:** 3–4 hours | **Risk:** Low–Medium

Weekly Slack notifications: (a) revenue performance summary, (b) overdue task alerts. These are the highest-value operational improvements — management gets a weekly digest without opening any spreadsheet.

---

### Task 5: Weekly revenue digest — new files for both venues

**Files:**
- Create: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/WeeklyDigestSakura.gs`
- Create: `THE WARATAH/SHIFT REPORT SCRIPTS/WeeklyDigestWaratah.js`
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/MenuSakura.gs` — add wrapper + menu item
- Modify: `THE WARATAH/SHIFT REPORT SCRIPTS/Menu.js` — add wrapper + menu item

**What it does:** Reads NIGHTLY_FINANCIAL from the data warehouse, computes current week vs prior week revenue, posts a Slack Block Kit summary every Monday morning.

**Step 1: Create `WeeklyDigestSakura.gs`**

```javascript
/**
 * ============================================================================
 * SAKURA HOUSE — WEEKLY REVENUE DIGEST
 * ============================================================================
 * Posts a weekly revenue performance summary to Slack.
 * Scheduled to run every Monday via time-based trigger.
 *
 * Reads from: NIGHTLY_FINANCIAL in SAKURA_DATA_WAREHOUSE_ID
 * Posts to:   SAKURA_SLACK_WEBHOOK_LIVE
 * @version 1.0.0
 * ============================================================================
 */

/**
 * Main weekly digest function — called by time trigger or manually from menu.
 * Safe to run manually at any time.
 */
function sendWeeklyRevenueDigest_Sakura() {
  const warehouseId = getDataWarehouseId_();
  if (!warehouseId) {
    Logger.log('sendWeeklyRevenueDigest_Sakura: SAKURA_DATA_WAREHOUSE_ID not configured. Skipping.');
    return;
  }

  try {
    const webhook = getSakuraSlackWebhookLive_();
    const stats = computeWeeklyStats_Sakura_(warehouseId);
    const blocks = buildWeeklyDigestBlocks_Sakura_(stats);
    bk_post(webhook, blocks, `Sakura House — Weekly Revenue Digest`);
    Logger.log('Weekly revenue digest sent successfully.');
  } catch (e) {
    Logger.log(`sendWeeklyRevenueDigest_Sakura failed: ${e.message}`);
  }
}

/** Send to test webhook instead of live */
function sendWeeklyRevenueDigest_Sakura_Test() {
  const warehouseId = getDataWarehouseId_();
  if (!warehouseId) { Logger.log('No warehouse ID.'); return; }
  const webhook = getSakuraSlackWebhookTest_();
  const stats = computeWeeklyStats_Sakura_(warehouseId);
  const blocks = buildWeeklyDigestBlocks_Sakura_(stats);
  bk_post(webhook, blocks, `[TEST] Sakura House — Weekly Revenue Digest`);
}

/**
 * Read NIGHTLY_FINANCIAL and compute this-week vs last-week stats.
 * "This week" = Mon–Sat ending yesterday.
 * @param {string} warehouseId
 * @returns {Object} stats
 */
function computeWeeklyStats_Sakura_(warehouseId) {
  const warehouse = SpreadsheetApp.openById(warehouseId);
  const sheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
  if (!sheet || sheet.getLastRow() < 2) {
    return { hasData: false };
  }

  const rows = sheet.getDataRange().getValues().slice(1); // skip header

  // Define this week: Mon–Sat of the week just ended
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  // Days since last Monday
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMon);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const thisWeek = rows.filter(r => {
    const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
    return d >= thisMonday && d < today;
  });

  const lastWeek = rows.filter(r => {
    const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
    return d >= lastMonday && d < thisMonday;
  });

  const sum = (arr, col) => arr.reduce((acc, r) => acc + (parseFloat(r[col]) || 0), 0);

  const thisRevenue = sum(thisWeek, 4);   // col E = Net Revenue
  const lastRevenue = sum(lastWeek, 4);
  const thisTips    = sum(thisWeek, 6);   // col G = Total Tips
  const lastTips    = sum(lastWeek, 6);

  const revChange = lastRevenue > 0
    ? ((thisRevenue - lastRevenue) / lastRevenue * 100).toFixed(1)
    : null;

  const bestDay = thisWeek.reduce((best, r) =>
    (!best || parseFloat(r[4]) > parseFloat(best[4])) ? r : best, null);

  return {
    hasData: thisWeek.length > 0,
    weekStarting: Utilities.formatDate(thisMonday, 'Australia/Sydney', 'dd/MM/yyyy'),
    daysReported: thisWeek.length,
    thisRevenue,
    lastRevenue,
    revChange,
    thisTips,
    lastTips,
    bestDay: bestDay ? {
      date: bestDay[0] instanceof Date
        ? Utilities.formatDate(bestDay[0], 'Australia/Sydney', 'EEE dd/MM')
        : String(bestDay[0]),
      revenue: parseFloat(bestDay[4]) || 0,
      mod: bestDay[3]
    } : null
  };
}

/**
 * Build Slack Block Kit blocks for the weekly digest.
 */
function buildWeeklyDigestBlocks_Sakura_(stats) {
  if (!stats.hasData) {
    return [
      bk_header('🌸 Sakura House — Weekly Digest'),
      bk_section('No shift data found for this week yet. Check the warehouse.')
    ];
  }

  const revArrow = stats.revChange === null ? '' :
    parseFloat(stats.revChange) >= 0 ? `▲ ${stats.revChange}%` : `▼ ${Math.abs(stats.revChange)}%`;

  const blocks = [
    bk_header('🌸 Sakura House — Weekly Revenue Digest'),
    bk_context([`Week starting ${stats.weekStarting} · ${stats.daysReported} days reported`]),
    bk_divider(),
    bk_fields([
      ['This Week Revenue', `$${stats.thisRevenue.toLocaleString('en-AU', {minimumFractionDigits: 2})}`],
      ['vs Last Week', stats.revChange !== null ? revArrow : 'N/A'],
      ['Total Tips',  `$${stats.thisTips.toLocaleString('en-AU', {minimumFractionDigits: 2})}`],
      ['Days Reported', String(stats.daysReported)]
    ])
  ];

  if (stats.bestDay) {
    blocks.push(bk_section(
      `*Best shift:* ${stats.bestDay.date} — $${stats.bestDay.revenue.toLocaleString('en-AU', {minimumFractionDigits: 2})} (MOD: ${stats.bestDay.mod})`
    ));
  }

  blocks.push(bk_context(['Sakura House Shift Reports 3.0 · Auto-generated weekly digest']));
  return blocks;
}

/**
 * Install a Monday morning trigger for the weekly digest.
 * Safe to re-run — removes any existing digest trigger first.
 */
function setupWeeklyDigestTrigger_Sakura() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendWeeklyRevenueDigest_Sakura')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('sendWeeklyRevenueDigest_Sakura')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8) // 8am Monday Sydney time
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger Installed',
    'Weekly revenue digest will be sent every Monday at 8am.\n\n' +
    'To remove: Apps Script editor → Triggers → delete.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
```

**Step 2: Create `WeeklyDigestWaratah.js`**

Structurally identical to `WeeklyDigestSakura.gs` with these substitutions:
- `_Sakura` suffix → `_Waratah` everywhere
- `getDataWarehouseId_()` → `getIntegrationConfig_().dataWarehouseId`
- `getSakuraSlackWebhookLive_()` → `PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_LIVE')`
- `getSakuraSlackWebhookTest_()` → `PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST')`
- Header emoji: `🌸` → `🌿`
- Header text: `Sakura House` → `The Waratah`
- NIGHTLY_FINANCIAL column indices are the same (both schemas identical)
- Monday trigger → Wednesday trigger (Waratah week starts Wednesday)
- Script Property name: `WARATAH_DATA_WAREHOUSE_ID` (read via `getIntegrationConfig_().dataWarehouseId`)

**Step 3: Add wrappers + menu items**

In `MenuSakura.gs`, add:
```javascript
// === PASSWORD-GATED WRAPPERS: Weekly Digest ===
function pw_sendWeeklyRevenueDigest_Sakura()      { if (requirePassword_()) sendWeeklyRevenueDigest_Sakura(); }
function pw_sendWeeklyRevenueDigest_Sakura_Test() { if (requirePassword_()) sendWeeklyRevenueDigest_Sakura_Test(); }
function pw_setupWeeklyDigestTrigger_Sakura()     { if (requirePassword_()) setupWeeklyDigestTrigger_Sakura(); }
```

In `onOpen`, extend the `Admin Tools` menu with a `Weekly Digest` submenu:
```javascript
.addSubMenu(ui.createMenu('Weekly Digest')
  .addItem('Send Revenue Digest (LIVE)', 'pw_sendWeeklyRevenueDigest_Sakura')
  .addItem('Send Revenue Digest (TEST)', 'pw_sendWeeklyRevenueDigest_Sakura_Test')
  .addSeparator()
  .addItem('Setup Monday Digest Trigger', 'pw_setupWeeklyDigestTrigger_Sakura'))
```

Repeat for `Menu.js` (Waratah), using `_Waratah` variants.

**Step 4: Push both SR projects**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS" && clasp push
cd "THE WARATAH/SHIFT REPORT SCRIPTS" && clasp push
```

**Step 5: Manual test**

In each spreadsheet: `Admin Tools → Weekly Digest → Send Revenue Digest (TEST)`. Check that a Slack message appears in the test channel with correct figures. If the warehouse has no data yet, run backfill first (Phase 1, Task 1 must be done).

---

### Task 6: Overdue task Slack alerts — both venues' task management

**Files:**
- Modify: `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs`
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs`
- Modify: `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/Menu_Updated_Sakura.gs`
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/Menu_Updated_Waratah.gs`

**Before starting:** Read `EnhancedTaskManagement_Sakura.gs` to understand the task data schema (column positions, status values, date column). The 8-status workflow uses statuses including `OVERDUE` — check if auto-escalation already marks overdue tasks, or if we need to detect them.

**Step 1: Read the task management schema**

Open `EnhancedTaskManagement_Sakura.gs` and find:
- What column is "Due Date"?
- What column is "Status"?
- What are the valid status strings? (e.g., `OVERDUE`, `IN_PROGRESS`, `PENDING`)
- What webhook property does it use for Slack? (search for `getProperty` or `SLACK_WEBHOOK`)

**Step 2: Add `sendOverdueTaskAlert_` function**

Add to each `EnhancedTaskManagement_*.gs` file:

```javascript
/**
 * Find all tasks that are overdue (due date < today, status not DONE/CANCELLED)
 * and post a Slack summary. Run weekly via time trigger or manually.
 */
function sendOverdueTaskAlert() {
  // --- CONFIG: adjust these to match actual column indices (0-based) ---
  const STATUS_COL   = 3;   // D = Status
  const DUE_DATE_COL = 6;   // G = Due Date (adjust if different)
  const TASK_COL     = 1;   // B = Task description
  const ASSIGNEE_COL = 4;   // E = Assignee

  const DONE_STATUSES = ['DONE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
  // ---

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName('MASTER ACTIONABLES SHEET') // adjust name
    || ss.getSheets().find(s => s.getName().includes('ACTIONABLE'));

  if (!taskSheet) {
    Logger.log('sendOverdueTaskAlert: actionables sheet not found.');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = taskSheet.getDataRange().getValues().slice(1);
  const overdue = rows.filter(r => {
    const status = (r[STATUS_COL] || '').toString().toUpperCase();
    if (DONE_STATUSES.includes(status)) return false;
    const due = r[DUE_DATE_COL];
    if (!due) return false;
    const dueDate = due instanceof Date ? due : new Date(due);
    return !isNaN(dueDate.getTime()) && dueDate < today;
  });

  const webhook = PropertiesService.getScriptProperties()
    .getProperty('SAKURA_SLACK_WEBHOOK_LIVE'); // swap to WARATAH_ for Waratah

  if (!webhook) {
    Logger.log('sendOverdueTaskAlert: webhook not configured.');
    return;
  }

  if (overdue.length === 0) {
    Logger.log('sendOverdueTaskAlert: no overdue tasks. Skipping Slack post.');
    return;
  }

  const listItems = overdue.slice(0, 10).map(r => {
    const due = r[DUE_DATE_COL] instanceof Date
      ? Utilities.formatDate(r[DUE_DATE_COL], 'Australia/Sydney', 'dd/MM/yyyy')
      : String(r[DUE_DATE_COL]);
    const assignee = r[ASSIGNEE_COL] || 'Unassigned';
    return `${r[TASK_COL] || 'Unknown task'} (due ${due}, ${assignee})`;
  });

  const moreLine = overdue.length > 10
    ? `\n_...and ${overdue.length - 10} more overdue tasks_`
    : '';

  const blocks = [
    bk_header('⚠️ Overdue Tasks — Action Required'),
    bk_section(`*${overdue.length} task${overdue.length !== 1 ? 's' : ''} overdue* as of today:`),
    bk_list(listItems, 'ordered'),
    bk_section(moreLine || ' '),
    bk_context([`Sakura House Task Management · ${Utilities.formatDate(new Date(), 'Australia/Sydney', 'dd/MM/yyyy')}`])
  ];

  bk_post(webhook, blocks, `${overdue.length} overdue task(s) require attention`);
  Logger.log(`sendOverdueTaskAlert: posted ${overdue.length} overdue tasks to Slack.`);
}
```

> **Important:** Before writing this code, read the actual `EnhancedTaskManagement_Sakura.gs` to confirm column indices and status strings. The numbers above (STATUS_COL=3, etc.) are estimates — adjust to match reality.

**Step 3: Add to menu and set up trigger**

Add a menu item in each TM menu file, and a `setupOverdueAlertTrigger` function that installs a Monday 9am trigger.

**Step 4: Push both TM projects**

```bash
cd "SAKURA HOUSE/TASK MANAGEMENT SCRIPTS" && clasp push
cd "THE WARATAH/TASK MANAGEMENT SCRIPTS" && clasp push
```

---

## Phase 3 — Post-Rollover Validation
**Estimated effort:** 2 hours | **Risk:** Low

After the weekly rollover runs, automatically validate that the new week's sheets were created correctly and that named ranges exist. Posts a Slack alert if something is wrong.

---

### Task 7: Add post-rollover validation to both venues

**Files:**
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.gs`
- Modify: `THE WARATAH/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.js`

**Before starting:** Read both rollover files. Find:
- The function that performs the rollover (`performInPlaceRollover` / `performWeeklyRollover`)
- What sheets it creates (what naming pattern)
- How it ends — does it return a result? Does it call `ui.alert`?

**Step 1: Understand rollover output**

The rollover likely creates sheets named like `MONDAY 03/03/2025`. After rollover completes, we want to verify:
1. Expected day sheets were created
2. For Sakura: named ranges exist on new sheets (call `diagnoseNamedRanges()` logic)
3. No sheets were accidentally deleted

**Step 2: Add `validateRolloverResult_` to each rollover file**

```javascript
/**
 * Validate that the rollover created the expected sheets.
 * Called automatically at the end of performInPlaceRollover().
 * Posts a Slack warning if validation fails.
 *
 * @param {string[]} expectedSheetNames - list of sheet names just created
 * @returns {Object} {passed: boolean, issues: string[]}
 */
function validateRolloverResult_(expectedSheetNames) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const issues = [];

  expectedSheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      issues.push(`Sheet "${name}" was NOT created`);
      return;
    }
    // Check sheet has content (not empty)
    if (sheet.getLastRow() < 5) {
      issues.push(`Sheet "${name}" appears empty (${sheet.getLastRow()} rows)`);
    }
  });

  const passed = issues.length === 0;

  if (!passed) {
    Logger.log(`Rollover validation FAILED:\n${issues.join('\n')}`);
    try {
      const webhook = getSakuraSlackWebhookLive_(); // swap for Waratah
      bk_post(webhook, [
        bk_header('⚠️ Rollover Validation Warning'),
        bk_section(`Rollover completed but *${issues.length} issue(s)* were detected:`),
        bk_list(issues, 'bullet'),
        bk_context(['Check the spreadsheet and re-run rollover if needed.'])
      ], `Rollover validation warning: ${issues.length} issue(s)`);
    } catch (slackErr) {
      Logger.log(`Could not send rollover validation alert: ${slackErr.message}`);
    }
  } else {
    Logger.log('Rollover validation passed: all expected sheets created.');
  }

  return { passed, issues };
}
```

**Step 3: Call `validateRolloverResult_` at the end of the rollover function**

After the rollover creates sheets, collect the new sheet names and call:
```javascript
validateRolloverResult_(newlyCreatedSheetNames);
```

**Step 4: Push both SR projects**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS" && clasp push
cd "THE WARATAH/SHIFT REPORT SCRIPTS" && clasp push
```

---

## Phase 4 — Claude AI Shift Summaries
**Estimated effort:** 4–5 hours | **Risk:** Medium (external API dependency)

Use the Claude API via `UrlFetchApp` to generate a one-paragraph narrative summary of each shift. This summary is appended to the Slack shift report notification, giving management an immediate "read" on the night without opening the PDF.

---

### Task 8: Add Claude API integration module — both venues

**Files:**
- Create: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/AIInsightsSakura.gs`
- Create: `THE WARATAH/SHIFT REPORT SCRIPTS/AIInsightsWaratah.js`
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/NightlyExportSakura.gs` — call AI after export
- Modify: `THE WARATAH/SHIFT REPORT SCRIPTS/NightlyExport.js` — call AI after export

**Script Property required:** `ANTHROPIC_API_KEY` — add to both venues' `_SETUP_ScriptProperties` files.

**Step 1: Add `ANTHROPIC_API_KEY` to setup files**

In `_SETUP_ScriptProperties_SakuraOnly.gs` and `_SETUP_ScriptProperties.js`, add:
```javascript
props.setProperty('ANTHROPIC_API_KEY', 'sk-ant-...'); // replace with real key
```
Also add it to the "Required properties" documentation comment at the top of each setup file.

**Step 2: Create `AIInsightsSakura.gs`**

```javascript
/**
 * ============================================================================
 * SAKURA HOUSE — AI SHIFT INSIGHTS
 * ============================================================================
 * Uses Claude API via UrlFetchApp to generate a concise shift narrative.
 * Called after PDF export, result appended to Slack notification.
 *
 * Script Property: ANTHROPIC_API_KEY
 * @version 1.0.0
 * ============================================================================
 */

/**
 * Generate a concise AI narrative for a shift using Claude API.
 * Non-blocking — returns empty string on any failure.
 *
 * @param {Object} shiftData - From extractShiftData_ in IntegrationHubSakura.gs
 * @returns {string} One-paragraph narrative, or "" if AI unavailable
 */
function generateShiftInsight_Sakura(shiftData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    Logger.log('generateShiftInsight_Sakura: ANTHROPIC_API_KEY not configured. Skipping.');
    return '';
  }

  const prompt = buildShiftInsightPrompt_(shiftData, 'Sakura House');

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // cheapest Claude model — good enough for summaries
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code !== 200) {
      Logger.log(`generateShiftInsight_Sakura: Claude API returned ${code}: ${response.getContentText()}`);
      return '';
    }

    const data = JSON.parse(response.getContentText());
    return (data.content && data.content[0] && data.content[0].text) || '';

  } catch (e) {
    Logger.log(`generateShiftInsight_Sakura: UrlFetchApp error: ${e.message}`);
    return '';
  }
}

/**
 * Build the prompt for the shift insight.
 * Keep it focused — we want a concise, factual summary.
 */
function buildShiftInsightPrompt_(shiftData, venueName) {
  const date = shiftData.date instanceof Date
    ? Utilities.formatDate(shiftData.date, 'Australia/Sydney', 'EEEE dd/MM/yyyy')
    : String(shiftData.date);

  const todosText = shiftData.todos && shiftData.todos.length > 0
    ? shiftData.todos.map(t => `- ${t.description}`).join('\n')
    : 'None';

  return `You are a hospitality operations assistant. Write a single concise paragraph (2-3 sentences max) summarising this shift for management. Focus on financial performance, any standout items, and operational notes. Be specific with numbers. Do not use bullet points.

Venue: ${venueName}
Date: ${date}
MOD: ${shiftData.mod || 'Unknown'}
Net Revenue: $${(shiftData.netRevenue || 0).toFixed(2)}
Tips: $${(shiftData.totalTips || shiftData.tipsTotal || 0).toFixed(2)}
${shiftData.covers ? `Covers: ${shiftData.covers}` : ''}
${shiftData.laborCost ? `Labor Cost: $${shiftData.laborCost.toFixed(2)}` : ''}

Shift Summary (staff-written): ${shiftData.shiftSummary || 'Not provided'}
Notable Guests: ${shiftData.guestsOfNote || 'None'}
Issues/Bad: ${shiftData.theBad || 'None'}
Kitchen Notes: ${shiftData.kitchenNotes || 'None'}
TO-DOs raised:
${todosText}`;
}
```

**Step 3: Create `AIInsightsWaratah.js`**

Identical to `AIInsightsSakura.gs` with:
- `_Sakura` → `_Waratah` everywhere
- Function name: `generateShiftInsight_Waratah`
- Venue name: `The Waratah`
- `shiftData.totalTips` → `shiftData.tipsTotal` (Waratah schema uses `tipsTotal`)

**Step 4: Wire into Nightly Export — Sakura**

Read `NightlyExportSakura.gs` and find the function that posts to Slack (likely `sendSlackNotification_` or similar). After the shift data is available but before the Slack post, call:

```javascript
// Get AI insight (non-blocking — empty string if fails)
const aiInsight = generateShiftInsight_Sakura(shiftData);
```

Then append `aiInsight` to the Slack message if non-empty:

```javascript
if (aiInsight) {
  blocks.push(bk_divider());
  blocks.push(bk_section(`*AI Summary:*\n${aiInsight}`));
}
```

**Step 5: Wire into Nightly Export — Waratah**

Same approach in `NightlyExport.js`, using `generateShiftInsight_Waratah(shiftData)`.

**Step 6: Test manually**

From the GAS editor, run `generateShiftInsight_Sakura` with a manually constructed `shiftData` object. Verify the API call succeeds and the response is a readable paragraph. Check the Claude API console for usage.

**Step 7: Push both SR projects**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS" && clasp push
cd "THE WARATAH/SHIFT REPORT SCRIPTS" && clasp push
```

---

## Phase 5 — Cross-Venue Daily Comparison (Optional)
**Estimated effort:** 2–3 hours | **Risk:** Low–Medium

A single daily Slack message comparing both venues side-by-side: "Sakura: $8,240 (+12%) vs Waratah: $6,100 (-3%)". Requires one GAS project to have read access to both warehouses.

---

### Task 9: Cross-venue comparison Slack message

**Decision required before starting:** Which GAS project hosts this? Options:
1. **Sakura SR project** reads Sakura warehouse (already has access) + Waratah warehouse via `WARATAH_DATA_WAREHOUSE_ID` Script Property
2. **Standalone GAS project** (new project, neutral host)

Recommendation: host in Sakura SR project — it already has the Block Kit library and webhook infrastructure.

**Files:**
- Create: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/CrossVenueDailyDigest.gs`
- Modify: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/MenuSakura.gs` — add wrapper + menu item
- Add Script Properties: `WARATAH_DATA_WAREHOUSE_ID` and `CROSS_VENUE_SLACK_WEBHOOK` to Sakura SR project

**Step 1: Add `WARATAH_DATA_WAREHOUSE_ID` to Sakura's Script Properties**

In `_SETUP_ScriptProperties_SakuraOnly.gs`, add:
```javascript
props.setProperty('WARATAH_DATA_WAREHOUSE_ID', '...'); // Waratah warehouse sheet ID
props.setProperty('CROSS_VENUE_SLACK_WEBHOOK', '...'); // A shared channel webhook
```

**Step 2: Create `CrossVenueDailyDigest.gs`**

```javascript
/**
 * ============================================================================
 * CROSS-VENUE DAILY COMPARISON DIGEST
 * ============================================================================
 * Posts a side-by-side daily comparison of both venues to a shared Slack channel.
 * Reads: SAKURA_DATA_WAREHOUSE_ID + WARATAH_DATA_WAREHOUSE_ID (both via Script Props)
 * Posts to: CROSS_VENUE_SLACK_WEBHOOK
 *
 * @version 1.0.0
 * ============================================================================
 */

function sendCrossVenueDailyDigest() {
  const props = PropertiesService.getScriptProperties();
  const crossWebhook = props.getProperty('CROSS_VENUE_SLACK_WEBHOOK');
  if (!crossWebhook) {
    Logger.log('sendCrossVenueDailyDigest: CROSS_VENUE_SLACK_WEBHOOK not configured.');
    return;
  }

  // Yesterday's date (since reports are submitted end-of-night)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yesterdayStr = Utilities.formatDate(yesterday, 'Australia/Sydney', 'EEEE dd/MM/yyyy');

  const sakuraRow = getLastShiftRow_(getDataWarehouseId_(), 'NIGHTLY_FINANCIAL', yesterday);
  const waratahId = props.getProperty('WARATAH_DATA_WAREHOUSE_ID');
  const waratahRow = waratahId
    ? getLastShiftRow_(waratahId, 'NIGHTLY_FINANCIAL', yesterday)
    : null;

  const blocks = [
    bk_header(`📊 Daily Comparison — ${yesterdayStr}`),
    bk_divider(),
    bk_fields([
      ['🌸 Sakura Revenue', sakuraRow ? `$${parseFloat(sakuraRow[4]).toFixed(2)}` : 'No data'],
      ['🌿 Waratah Revenue', waratahRow ? `$${parseFloat(waratahRow[4]).toFixed(2)}` : 'No data'],
      ['Sakura MOD', sakuraRow ? (sakuraRow[3] || '—') : '—'],
      ['Waratah MOD', waratahRow ? (waratahRow[3] || '—') : '—']
    ]),
    bk_context(['Shift Reports 3.0 · Cross-venue daily digest'])
  ];

  bk_post(crossWebhook, blocks, `Daily comparison — ${yesterdayStr}`);
}

/**
 * Find the most recent row in NIGHTLY_FINANCIAL matching a given date.
 * @param {string} warehouseId
 * @param {string} sheetName
 * @param {Date} targetDate
 * @returns {Array|null} row values or null if not found
 */
function getLastShiftRow_(warehouseId, sheetName, targetDate) {
  try {
    const sheet = SpreadsheetApp.openById(warehouseId).getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return null;
    const rows = sheet.getDataRange().getValues().slice(1);
    const match = rows.filter(r => {
      const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
      return d && d.toDateString() === targetDate.toDateString();
    });
    return match.length > 0 ? match[match.length - 1] : null;
  } catch (e) {
    Logger.log(`getLastShiftRow_ for ${warehouseId}: ${e.message}`);
    return null;
  }
}

/**
 * Install a daily 10am trigger for the cross-venue digest.
 */
function setupCrossVenueDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendCrossVenueDailyDigest')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('sendCrossVenueDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();

  SpreadsheetApp.getUi().alert('Daily cross-venue digest trigger set for 10am.', SpreadsheetApp.getUi().ButtonSet.OK);
}
```

**Step 3: Add to Sakura menu**

```javascript
function pw_sendCrossVenueDailyDigest()   { if (requirePassword_()) sendCrossVenueDailyDigest(); }
function pw_setupCrossVenueDailyTrigger() { if (requirePassword_()) setupCrossVenueDailyTrigger(); }
```

```javascript
.addSubMenu(ui.createMenu('Cross-Venue')
  .addItem('Send Cross-Venue Daily Digest', 'pw_sendCrossVenueDailyDigest')
  .addItem('Setup Daily Digest Trigger', 'pw_setupCrossVenueDailyTrigger'))
```

**Step 4: Push Sakura SR project**

```bash
cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS" && clasp push
```

---

## Implementation Order Recommendation

| Phase | Tasks | Priority | When |
|-------|-------|----------|------|
| Phase 1 | Tasks 1–4 | **Do first** — no dependencies, immediate value | Next session |
| Phase 2 | Tasks 5–6 | High value, moderate effort | After Phase 1 verified |
| Phase 3 | Task 7 | Safety net — do before next rollover | After Phase 2 |
| Phase 4 | Task 8 | AI features — requires Anthropic API key + testing | When ready for Phase 3 |
| Phase 5 | Task 9 | Cross-venue — requires both warehouses to have data | After Phase 4 working |

---

## Script Properties Reference (new additions)

| Venue | Property Key | Purpose | Phase |
|-------|-------------|---------|-------|
| Sakura SR | *(no new ones)* | All existing properties sufficient | 1–3 |
| Waratah SR | *(no new ones)* | All existing properties sufficient | 1–3 |
| Sakura SR | `ANTHROPIC_API_KEY` | Claude API calls | 4 |
| Waratah SR | `ANTHROPIC_API_KEY` | Claude API calls | 4 |
| Sakura SR | `WARATAH_DATA_WAREHOUSE_ID` | Cross-venue read access | 5 |
| Sakura SR | `CROSS_VENUE_SLACK_WEBHOOK` | Shared Slack channel | 5 |

---

## Testing Checklist (per phase)

**Phase 1:**
- [ ] Both menus reload without error
- [ ] `Admin Tools → Data Warehouse → Backfill This Sheet` works on a shift sheet
- [ ] `Admin Tools → Data Warehouse → Show Integration Log` shows stats dialog
- [ ] Duplicate-detection works for a string-date row in NIGHTLY_FINANCIAL

**Phase 2:**
- [ ] `sendWeeklyRevenueDigest_Sakura_Test()` posts to test Slack channel
- [ ] `sendWeeklyRevenueDigest_Waratah_Test()` posts to test Slack channel
- [ ] Revenue figures in digest match what's in NIGHTLY_FINANCIAL
- [ ] `sendOverdueTaskAlert()` only fires when overdue tasks exist

**Phase 3:**
- [ ] Run rollover in dry-run mode, confirm validation function is called
- [ ] Manually pass in a missing sheet name and verify Slack alert fires

**Phase 4:**
- [ ] `generateShiftInsight_Sakura(shiftData)` returns a paragraph (check API console for usage)
- [ ] AI summary appears in Slack shift notification
- [ ] Empty shiftData (all nulls) doesn't crash — returns `""` gracefully

**Phase 5:**
- [ ] `sendCrossVenueDailyDigest()` posts correct figures for yesterday
- [ ] Works even if one venue has no data for yesterday (shows "No data")
