# TaskIntegration.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/TaskIntegration.js`
**Type:** Configuration constants and helpers for task management integration
**Called by:** `NightlyExport.js` when pushing TO-DOs to the Master Actionables Sheet

---

## What This File Does

This is a small configuration file (~60 lines) that defines the column layout of the Master Actionables Sheet and provides helper functions for connecting the shift report's TO-DOs to the task management system.

It acts as the bridge between the shift report side and the task management side — without this file, `NightlyExport.js` wouldn't know which columns to write TO-DOs into.

---

## Key Components

### `TASK_COLS` — Column Mapping Constant

Maps column names to their zero-based index positions in the Master Actionables Sheet:

| Column Index | Field |
|-------------|-------|
| 0 | Priority |
| 1 | Status |
| 2 | Task |
| 3 | Assigned To |
| 4 | Source |
| 5 | Source Date |
| 6 | Due Date |
| 7 | Category |
| 8 | Notes |
| 9 | Created Date |
| 10 | Completed Date |
| 11 | Recurring |
| 12 | Recurrence Rule |
| 13 | Last Recurrence |

**Important:** Column A = Priority, Column B = Status. This is the opposite of what most people assume. See the project MEMORY notes about the A↔B swap issue.

### `getTaskSpreadsheetId_()`
Loads the Master Actionables Sheet spreadsheet ID from Script Properties. Uses the same lazy-loading pattern as other config functions.

### `testPushTodosToMasterActionables()`
A test function that manually triggers the TO-DO push for the active sheet. Useful for verifying the integration works without running the full export pipeline.

---

## When Would You Need This File?

- **Column layout changed on the Master Actionables Sheet** — Update the `TASK_COLS` mapping
- **Adding a new field to pushed TO-DOs** — Add the column index to `TASK_COLS` and update the push logic in `NightlyExport.js`
- **Testing the TO-DO push independently** — Run `testPushTodosToMasterActionables()` from the Apps Script editor
- **Debugging why tasks appear in the wrong columns** — Check that `TASK_COLS` matches the actual spreadsheet layout

---

## Important Notes

- **Column A = Priority, Column B = Status** — This is a known gotcha. Every formula, dashboard, and integration must respect this order.
- **14 columns total** — The Master Actionables Sheet has a fixed 14-column schema.
- **The spreadsheet ID is in Script Properties**, not hardcoded — update it via `_SETUP_ScriptProperties.js` if the task management sheet moves.

---

## Related Files

- [NightlyExport.js](../SHIFT REPORT SCRIPTS/NightlyExport.js) — `pushTodosToMasterActionables()` uses `TASK_COLS` to write TO-DOs
- [_SETUP_ScriptProperties.js](../SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties.js) — Sets the `TASK_MANAGEMENT_SPREADSHEET_ID` property
- Task Management Scripts (separate GAS project) — The other end of this integration
