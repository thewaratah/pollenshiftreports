# IntegrationHub.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/IntegrationHub.js`
**Type:** Central orchestration — connects shift reports to all downstream systems
**Called by:** `NightlyExport.js` during the export pipeline

---

## What This File Does

This is the central wiring layer that connects the shift report to every other system. When a shift report is exported, `IntegrationHub.js` extracts the data from the sheet and routes it to the Data Warehouse, Task Management system, and other targets.

Think of it as a switchboard — it doesn't own any of the downstream systems, but it coordinates the data flowing between them.

---

## Key Functions

### `getIntegrationConfig_()`
**Purpose:** Loads all configuration from Script Properties into a single config object.

Returns spreadsheet IDs, sheet names, validation thresholds, alert recipients, and timezone. Every other function in this file receives this config object so Script Properties are read only once per execution.

| Config Area | What It Contains |
|-------------|-----------------|
| **Spreadsheet IDs** | Shift report, task management, data warehouse |
| **Sheet names** | TO-DOs, MASTER ACTIONABLES SHEET, NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS, WASTAGE_COMPS, QUALITATIVE_LOG |
| **Validation thresholds** | $10 warning, $50 error (blocks send) |
| **Alert recipients** | Who gets emailed when integrations fail |

### `runIntegrations(sheetName)`
**Purpose:** Master orchestration function — called during every shift report export.

Runs a 3-step pipeline:

| Step | What It Does |
|------|-------------|
| **1. Extract** | Reads financial, operational, and narrative data from the shift report sheet |
| **2. Validate** | Checks data integrity (e.g., revenue within expected range). Errors block the pipeline; warnings are logged but don't stop it. |
| **3. Log to warehouse** | Writes extracted data to the Data Warehouse spreadsheet (NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS, etc.) with duplicate detection |

Returns `{success, errors[], warnings[]}` so the caller (`NightlyExport.js`) can decide what to do.

### `extractShiftData_(sheetName, config)`
Reads all data from a shift report sheet — date, MOD, staff, revenue, tips, narrative fields, wastage, RSA incidents, and TO-DOs. Returns a structured object.

### `validateShiftData_(shiftData)`
Validates the extracted data. Checks for missing required fields, out-of-range values, and data integrity issues.

### `logToDataWarehouse_(shiftData, config)`
Writes the extracted data to multiple sheets in the Data Warehouse spreadsheet. Has built-in **duplicate detection** — if a record for the same date and MOD already exists, it skips the write (doesn't overwrite).

### `backfillShiftToWarehouse()`
Admin function for manually re-pushing data to the warehouse. Unlike the nightly auto-log, this can force-update existing records. Available via menu: Admin Tools > Data Warehouse > Backfill This Sheet to Warehouse.

### `setupWeeklyBackfillTrigger()`
Creates a time-based trigger that automatically backfills warehouse data on a schedule.

### `showIntegrationLogStats()`
Displays a summary of integration activity over the last 30 days. Available via menu: Admin Tools > Data Warehouse > Show Integration Log.

---

## Data Flow

```
Shift Report Sheet (e.g. WEDNESDAY)
    │
    ├── extractShiftData_() ─── reads all cells
    │
    ├── validateShiftData_() ── checks data integrity
    │
    └── logToDataWarehouse_()
            ├── NIGHTLY_FINANCIAL  (revenue, tips, covers, labor)
            ├── OPERATIONAL_EVENTS (shift summary, good/bad notes)
            ├── WASTAGE_COMPS      (wastage and comp records)
            └── QUALITATIVE_LOG    (guests of note, kitchen notes)
```

---

## When Would You Need This File?

- **Adding a new data field** — If the shift report layout changes, update `extractShiftData_()` to read the new cell
- **Adding a new warehouse sheet** — Add the write logic in `logToDataWarehouse_()`
- **Changing validation rules** — Update `validateShiftData_()` or the thresholds in `getIntegrationConfig_()`
- **Debugging warehouse issues** — Check the validation and duplicate detection logic here

---

## Important Notes

- **Non-blocking by design** — If warehouse logging fails, the shift report still sends. Errors are collected and reported to Evan via Slack DM, not shown to the end user.
- **Duplicate detection** — Prevents the same shift from being logged twice. Uses date + MOD as the unique key.
- **Config is lazy-loaded** — `getIntegrationConfig_()` reads Script Properties only when called, not at module load time. This prevents `onOpen()` from crashing if properties aren't set yet.
