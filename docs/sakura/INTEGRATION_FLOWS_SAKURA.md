# SAKURA HOUSE - Integration Flows

**Last Updated:** March 18, 2026
**Type:** Detailed Integration Documentation
**Load:** On-demand only (reference material)

---

## Overview

> This document explains how data flows through the Sakura House automation system — from the moment a manager fills in a shift report to the data landing in the warehouse, Slack, email, and the task management system. If something breaks in the export pipeline, this is where you trace it.

The Sakura integration pipeline is orchestrated by `IntegrationHubSakura.gs`. When a shift report is exported, data flows through extraction, validation, warehouse logging, Slack posting, email delivery, and task push — in that order. Each stage is non-blocking: failures are logged but don't stop the export.

**Key Architectural Principle:** Named ranges are used for all data extraction (via `getFieldRange()` in RunSakura.gs). Direct cell reads (`sheet.getRange('C19')`) are only used for warehouse-only formula cells not in FIELD_CONFIG.

---

## Integration Hub Flow

> The master pipeline that runs when you click "Send Nightly Report". It coordinates data extraction, validation, and distribution. Each step is wrapped in try/catch so a failure in one part (say, Slack) doesn't prevent the others (email, warehouse) from completing.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/IntegrationHubSakura.gs` (918 LOC)

```
User clicks "Send Nightly Report"
    ↓
showPreExportChecklist_(sheetName, false)
    ↓ (user confirms checklist)
continueExport(sheetName, isTest=false)
    ├─→ runIntegrations(sheetName)          [NON-BLOCKING]
    │   ├─→ extractShiftData_(sheetName)
    │   ├─→ validateShiftData_(shiftData)
    │   └─→ logToDataWarehouse_(shiftData)
    ├─→ buildTodoAggregationSheet_()        [NON-BLOCKING]
    ├─→ postToSlackFromSheet_()             [NON-BLOCKING]
    ├─→ pushTodosToActionables()            [NON-BLOCKING]
    └─→ generatePdfForSheet_NoUI_() + GmailApp.sendEmail()
```

**Non-blocking pattern:** Every integration step is wrapped in its own try/catch. If the warehouse fails, Slack still posts. If Slack fails, email still sends. Managers never see system errors.

---

## Data Extraction

> How the system reads data from the shift report sheet. Most fields go through the named range system; two formula cells (C19 Cash Total, C32 Tips Total) are read directly because they're not in FIELD_CONFIG.

**Function:** `extractShiftData_(sheetName)`

```javascript
const shiftData = {
  // Via named ranges (getFieldValue / getFieldDisplayValue)
  date: getFieldValue(sheet, "date"),            // parseCellDate_ handles Date vs string
  mod: getFieldDisplayValue(sheet, "mod"),
  netRevenue: getFieldValue(sheet, "netRevenue"),
  cashTips: getFieldValue(sheet, "cashTips"),
  cardTips: getFieldValue(sheet, "cardTips"),
  surchargeTips: getFieldValue(sheet, "surchargeTips"),
  productionAmount: getFieldValue(sheet, "productionAmount"),
  deposit: getFieldValue(sheet, "deposit"),
  discounts: getFieldValue(sheet, "discounts"),

  // Direct cell reads (warehouse-only, not in FIELD_CONFIG)
  cashTotal: sheet.getRange("C19").getValue(),    // Cash Total (formula)
  tipsTotal: sheet.getRange("C32").getValue(),    // Tips Total (formula)

  // Computed
  totalTips: cashTips + cardTips + surchargeTips,
  weekEnding: /* next Sunday from date */,

  // Narratives (via named ranges)
  shiftSummary: getFieldDisplayValue(sheet, "shiftSummary"),
  guestsOfNote: getFieldDisplayValue(sheet, "guestsOfNote"),
  theGood:      getFieldDisplayValue(sheet, "goodNotes"),
  theBad:       getFieldDisplayValue(sheet, "issues"),
  kitchenNotes: getFieldDisplayValue(sheet, "kitchenNotes"),
  wastageComps: getFieldDisplayValue(sheet, "wastageComps"),
  maintenance:  getFieldDisplayValue(sheet, "maintenance"),
  rsaIncidents: getFieldDisplayValue(sheet, "rsaIncidents"),

  // TO-DOs (via named ranges, multi-cell)
  todos: /* extracted from getFieldValues(sheet, "todoTasks") + "todoAssignees" */
};
```

### Date Parsing

> Dates can arrive as Date objects (if the cell is date-formatted) or as strings like "03/02/2025" (if staff typed it manually). The parser handles both cases and avoids the MM/DD vs DD/MM ambiguity by using `Utilities.parseDate` with the Australian locale.

```javascript
function parseCellDate_(value) {
  if (value instanceof Date) return value;
  try {
    return Utilities.parseDate(str, 'Australia/Sydney', 'dd/MM/yyyy');
  } catch (e) {
    return new Date(str);  // Fallback
  }
}
```

### Task Extraction

> TO-DOs are read as two parallel arrays — one for task descriptions, one for assignee names. They're zipped together and empty rows are filtered out.

```javascript
const todoTaskValues = getFieldValues(sheet, "todoTasks");      // A69:A84
const todoAssignValues = getFieldValues(sheet, "todoAssignees"); // D69:D84
// → [{description: "Fix broken tap", assignee: "Gooch"}, ...]
```

---

## Data Validation

> A quick sanity check before data goes to the warehouse. Errors (missing date, missing MOD) block the warehouse write. Warnings (zero revenue) are logged but don't stop anything.

**Function:** `validateShiftData_(shiftData)`

**Blocking errors (prevent warehouse write):**
- Invalid or missing date
- Empty MOD name

**Non-blocking warnings (logged, export continues):**
- Net revenue ≤ $0

---

## Data Warehouse Logging

> The system writes shift data to four separate sheets in the data warehouse spreadsheet. Each sheet has its own duplicate detection to prevent the same shift being logged twice if someone re-exports.

**Function:** `logToDataWarehouse_(shiftData)`

### Sheet 1: NIGHTLY_FINANCIAL (13 columns A-M)

> The main financial record — one row per shift, tracking revenue, tips, production, and discounts.

```javascript
financialSheet.appendRow([
  shiftData.date,             // A: Date
  shiftData.dayOfWeek,        // B: Day
  shiftData.weekEnding,       // C: Week Ending
  shiftData.mod,              // D: MOD
  shiftData.netRevenue,       // E: Net Revenue
  shiftData.cashTotal,        // F: Cash Total (C19)
  shiftData.cashTips,         // G: Cash Tips (C29)
  shiftData.tipsTotal,        // H: Tips Total (C32)
  new Date(),                 // I: Logged At
  shiftData.totalTips,        // J: Total Tips (computed)
  shiftData.productionAmount, // K: Production Amount
  shiftData.discounts,        // L: Discounts
  shiftData.deposit           // M: Deposit
]);
```

**Duplicate key:** Date (A) + MOD (D)

### Sheet 2: OPERATIONAL_EVENTS (9 columns A-I)

> One row per TO-DO task. This creates a running history of every task assigned across all shifts — useful for spotting recurring issues.

```javascript
eventsSheet.appendRow([
  shiftData.date,     // A: Date
  "New",              // B: Type
  todo.description,   // C: Item
  "",                 // D: Quantity
  "MEDIUM",           // E: Value (default priority)
  todo.assignee,      // F: Staff
  "",                 // G: Reason
  "TO-DO",            // H: Category
  "Shift Report"      // I: Source
]);
```

**Duplicate key:** Date (A) + Item text (C)

### Sheet 3: WASTAGE_COMPS (5 columns A-E)

> Records any wastage, comps, or discount notes the MOD wrote. Only logged if the field has content.

```javascript
wastageSheet.appendRow([
  shiftData.date,        // A: Date
  shiftData.dayOfWeek,   // B: Day
  shiftData.weekEnding,  // C: Week Ending
  shiftData.mod,         // D: MOD
  shiftData.wastageComps // E: COMMENTS
]);
```

**Duplicate key:** Date (A) + MOD (D)

### Sheet 4: QUALITATIVE_LOG (11 columns A-K)

> All the narrative content from the shift — summary, good/bad highlights, kitchen notes, maintenance, RSA incidents. This creates a searchable text archive of what happened each night.

```javascript
qualSheet.appendRow([
  shiftData.date,          // A: Date
  shiftData.dayOfWeek,     // B: Day
  shiftData.mod,           // C: MOD
  shiftData.shiftSummary,  // D: Shift Summary
  shiftData.guestsOfNote,  // E: Guests of Note
  shiftData.theGood,       // F: The Good
  shiftData.theBad,        // G: The Bad / Issues
  shiftData.kitchenNotes,  // H: Kitchen Notes
  shiftData.maintenance,   // I: Maintenance
  shiftData.rsaIncidents,  // J: RSA/Incidents
  new Date()               // K: Logged At
]);
```

**Duplicate key:** Date (A) + MOD (C)

---

## Duplicate Prevention

> Every warehouse sheet uses the same pattern: read existing rows, build a set of date+key pairs, skip if already present. This uses `normaliseDateKey_()` to handle both Date objects and date strings consistently.

```javascript
function normaliseDateKey_(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : parseCellDate_(v.toString());
  return (!d || isNaN(d.getTime())) ? null : d.toDateString();
}

// Usage in each sheet:
const shiftDateKey = normaliseDateKey_(shiftData.date);
const isDuplicate = existingData.some(row => {
  const rowKey = normaliseDateKey_(row[0]);
  return rowKey !== null && rowKey === shiftDateKey && row[3] === shiftData.mod;
});
```

**Why this matters:** If a manager re-exports a shift (e.g. after fixing a typo), the warehouse won't create duplicate rows. This is critical for analytics accuracy.

---

## Slack Integration

> How the nightly shift report gets posted to Slack. The message is built using Block Kit — a structured format with headers, fields, sections, and buttons. The content is all pulled from named ranges.

**Function:** `postToSlackFromSheet_(spreadsheet, sheet, sheetName, webhookUrl)`
**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/NightlyExportSakura.gs`

### Message Structure

> The Slack message is built in sections. Financial data is shown as fields, narrative content is conditional (only included if the MOD wrote something), and action buttons link to the PDF and email.

```
┌─────────────────────────────────────┐
│ Sakura House — Nightly Shift Report │  ← bk_header
├─────────────────────────────────────┤
│ Monday 03/03/2026 · MOD: Nick       │  ← bk_context
│ FOH: Sabine, Kalisha · BOH: Chef    │
├─────────────────────────────────────┤
│ Net Revenue  $2,450.00              │  ← bk_fields
│ Production   $1,800.00              │
│ Tips         Card $120 / Cash $85   │
├─────────────────────────────────────┤
│ *Shift Summary*                     │  ← bk_section (always shown)
│ Busy night, 3 large bookings...     │
├─────────────────────────────────────┤
│ *Guests of Note*                    │  ← conditional sections
│ *The Good* / *Issues*               │
│ *Kitchen Notes*                     │
├─────────────────────────────────────┤
│ *To-Do's* (4)                       │  ← bk_section
│ • Gooch: Fix broken tap             │
│ • Sabine: Restock wine fridge       │
├─────────────────────────────────────┤
│ ⚠️ Wastage/Comps: ...              │  ← conditional incidents
│ 🔧 Maintenance: ...                │
│ 🛡️ RSA/Incidents: ...              │
├─────────────────────────────────────┤
│ [View PDF]  [Email Staff]           │  ← bk_buttons
└─────────────────────────────────────┘
```

### Currency Formatting

> The `fmtAUD()` helper strips any existing currency formatting before parsing, then re-formats as AUD. This fixed a production bug where `parseFloat("$1,234.50")` returned NaN.

```javascript
const fmtAUD = (val) => {
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return "N/A";
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
```

---

## Email Distribution

> The PDF export is emailed to the management team. The recipient list comes from Script Properties (a JSON map of emails to names). The sender's name is looked up from this map so the email appears personal.

**Recipients:** Configured in `SAKURA_EMAIL_RECIPIENTS` Script Property
**Format:** HTML email with PDF attachment
**Sender name:** Looked up from recipients map, falls back to MOD name

```javascript
GmailApp.sendEmail(emailAddresses.join(','), subject, "", {
  htmlBody: htmlBody,
  attachments: [pdfBlob]
});
```

---

## TO-DO Aggregation

> Before the nightly export, all TO-DOs from all 6 day sheets are collected into a single "TO-DOs" tab. This tab is the source for the weekly TO-DO summary Slack message and makes it easy to see all tasks in one place.

**Function:** `buildTodoAggregationSheet_(spreadsheet)`

```
All 6 day sheets → TO-DOs tab
    Column A: Day (e.g. "MONDAY 03/03/2026")
    Column B: Task description
    Column C: Assigned staff
```

**Performance:** Collects all rows into a 2D array first, then writes in a single `setValues()` call (replaced per-row `appendRow` loops).

---

## Task Push to Actionables

> How TO-DOs flow from the shift report into the task management system. Each task becomes a new row in the Sakura Actionables Sheet with MEDIUM priority and NEW status.

**Function:** `pushTodosToActionables(sheet, sheetName)`
**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/TaskIntegrationSakura.gs`

```
Day Sheet TO-DOs
    ↓ (pushTodosToActionables)
Sakura Actionables Sheet
    → Priority: MEDIUM
    → Status: NEW
    → Source: "Shift Report"
    → Area: "General"
```

**Duplicate Prevention:** Checks if a task with the same description was already created today. Prevents double-push if the MOD re-exports.

**Batch Writing:** All rows written in a single `setValues()` call. Days Open formula set in a second pass (GAS can't mix formulas with values in one `setValues()`).

---

## Weekly Backfill

> A safety net that runs every Monday at 2am. It checks all 6 day sheets and pushes any that aren't already in the warehouse. This catches any shifts that were missed (e.g. the nightly export failed, or the manager forgot to click Send).

**Function:** `runWeeklyBackfill_()`
**Trigger:** Monday 2am (Australia/Sydney)

**LockService guard:** Uses `LockService.getScriptLock()` with a 30-second timeout to prevent duplicate rows when a scheduled backfill overlaps with a live export.

```javascript
const lock = LockService.getScriptLock();
const acquired = lock.tryLock(30000);
if (!acquired) {
  Logger.log('Another operation in progress — skipping.');
  return;
}
```

---

## Integration Log

> Every integration run (export or backfill) writes a record to the INTEGRATION_LOG sheet in the data warehouse. This creates an audit trail that helps diagnose failures and track system health.

**Sheet:** `INTEGRATION_LOG` (auto-created in data warehouse)

```
A=Timestamp, B=SheetName, C=Success, D=Duration_s,
E=Errors, F=Warnings, G=Financial_Logged,
H=Financial_Skipped, I=Events_Logged
```

**View stats:** Menu → Admin Tools → Data Warehouse → Show Integration Log (Last 30 Days)

---

## Error Handling Strategy

> The overall philosophy: exports always complete, failures never cascade. Each integration step is independent and wrapped in its own error handling.

### Non-Blocking Integrations (logged, never shown to managers)

> These steps fail silently — errors go to the Apps Script log but don't stop the export or show error dialogs.

- Data warehouse logging
- TO-DO aggregation
- Slack posting
- Task push to Actionables

### Blocking Validations (stop the pipeline)

> These are the only things that can prevent an export from completing.

- Invalid date (cannot extract data)
- Missing MOD name (cannot identify shift)
- PDF generation failure (nothing to email)

---

## Pre-Send Checklist

> Before a shift report is exported, the manager sees a modal dialog with two checkboxes: "Deputy Timesheets Approved" and "Fruit Order Done". Both must be checked before the Confirm button enables. This prevents incomplete reports from being sent.

**Function:** `showPreExportChecklist_(sheetName, isTest)`
**File:** `checklist-dialog.html`

**Design constraint:** `continueExport()` is called via `google.script.run` from the HTML dialog. It MUST return `{success, message}` and MUST NOT call `SpreadsheetApp.getUi()` — this throws in the `google.script.run` context.

---

## Testing Integrations

> Menu functions for verifying the full system is connected and working.

### Test Current Sheet

> Run integrations on the active sheet and show a dialog with results.

```javascript
testIntegrations()       // Test on active sheet
```

### Full Health Check

> Verify all connections — Actionables sheet, data warehouse, required tabs.

```javascript
runValidationReport()    // Full system validation
```

### Manual Backfill

> Push a single sheet to the warehouse without running the full export.

```javascript
backfillShiftToWarehouse()  // Active sheet → warehouse (menu-accessible)
```

### Menu Access

> All testing functions are under Admin Tools → Integrations & Analytics (password-gated) or Admin Tools → Data Warehouse.

---

## Comparison with The Waratah

> How Sakura's integration pipeline differs from Waratah's. The main structural difference is Sakura uses named ranges for extraction while Waratah uses direct cell addresses. Sakura also has more warehouse columns and additional features like the TO-DO aggregation tab and weekly backfill.

| Aspect | Sakura House | The Waratah |
|--------|-------------|-------------|
| **Data Extraction** | Via named ranges (`getFieldValue()`) | Via hardcoded cells (`sheet.getRange('B34')`) |
| **NIGHTLY_FINANCIAL** | 13 columns (A-M) | 22 columns (A-V) |
| **Financial Detail** | Net Revenue, Cash Total, Tips, Production, Discounts, Deposit | Full breakdown: 12 financial sub-categories |
| **Narrative Fields** | 8 fields (includes goodNotes, maintenance) | 5 fields |
| **Task Slots** | 16 (rows 69-84) | 9 (rows 53-61) |
| **TO-DO Aggregation** | Yes (builds TO-DOs tab) | No |
| **Weekly Backfill** | Yes (Mon 2am, LockService) | No |
| **Integration Log** | Yes (INTEGRATION_LOG sheet) | No |
| **Pre-Send Checklist** | Yes (HTML modal) | No |
| **Cash Reconciliation** | No | Yes |
| **Merge Pattern** | A:D (4 cols) | A:F (6 cols) |
| **Email Recipients** | JSON map (email → name) | JSON map (email → name) |
| **Slack Webhooks** | 4 (live, test, warehouse, cash) | 2 (live, test) |

---

**Last Updated:** March 18, 2026
**Key Insight:** All integrations are non-blocking — warehouse, Slack, and task push failures are logged but never prevent the email from being sent.
