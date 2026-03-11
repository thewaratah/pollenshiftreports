# WeeklyRolloverInPlace.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.js`
**Type:** Full in-place weekly rollover system — the most critical admin operation
**Run from:** Menu > Admin Tools > Weekly Reports > Weekly Rollover (In-Place), or via time-based trigger

---

## What This File Does

This is the largest file in the project (~973 lines) and handles the most critical weekly operation: resetting the shift report spreadsheet for a new week. Instead of creating a new spreadsheet each week, it clears data in-place and updates dates — preserving all formatting, formulas, and structure.

---

## The 7-Step Rollover Process

`performWeeklyRollover()` executes these steps in order:

| Step | What It Does | Can Fail Safely? |
|------|-------------|------------------|
| **1. Validate** | Confirms it's the right time to roll over, checks the current week dates | No — blocks rollover if validation fails |
| **2. Summarize** | Collects a summary of the current week's data before it's cleared | Yes |
| **3. PDF Archive** | Generates a multi-sheet PDF of the entire week and saves to Google Drive | Yes |
| **4. Sheets Snapshot** | Creates a copy of the spreadsheet as a backup in Google Drive | Yes |
| **5. Clear Data** | Clears all data cells using `CLEARABLE_FIELDS` (preserves formulas and formatting) | No — critical step |
| **6. Update Dates** | Advances all date cells by 7 days for the new week | No — critical step |
| **7. Notify** | Posts a Slack notification and sends email confirmation | Yes |

---

## The `CLEARABLE_FIELDS` Constant

This is the most important constant in the file. It maps every cell range that should be cleared during rollover:

| Category | Ranges |
|----------|--------|
| **Header fields** | B3:F3 (date), B4:F4 (MOD), B5:F5 (staff) |
| **Financial data (inputs)** | B8, B9:B10, B11, B13:B14, B17:B18, B19:B20, B21:B22, B23:B24, B25, B30, B32, B33 |
| **Narrative fields** | A43:F43, A45:F45, A47:F47, A49:F49, A51:F51 (merged cells) |
| **TO-DO tasks** | A53:E61 (9 task rows), F53:F61 (assignees) |
| **Incidents** | A63:F63 (wastage), A65:F65 (RSA) |

**Deliberately excluded (formula cells -- clearing destroys them permanently):**
- **B34** (Net Revenue), **B36** (Covers) — removed from CLEARABLE_FIELDS Mar 12 (bug fix)
- **B37:B40** — Total Tips, Labor Hours, Labor Cost — removed from CLEARABLE_FIELDS Mar 3
- **B15, B16, B26, B27, B28, B29** — other formula cells (never were in CLEARABLE_FIELDS)

---

## Other Key Functions

### `previewRollover()`
**Dry run** — runs the validation and summarization steps without actually clearing anything. Returns a preview of what would happen. Used by the rollover wizard dialog.

### Trigger Management

| Function | What It Does |
|----------|-------------|
| `createRolloverTrigger()` | Sets up a weekly time-based trigger (fires Wednesday at 10am AEST) |
| `removeRolloverTrigger()` | Removes the existing rollover trigger |
| `listRolloverTriggers()` | Shows all triggers related to rollover |

### `fixSheetNamesAndDateFormat()`
**One-off utility** — renames sheet tabs to match the expected day names (WEDNESDAY, THURSDAY, etc.) and formats date cells consistently. Run once during initial setup.

---

## Safety Features

| Feature | How It Works |
|---------|-------------|
| **LockService** | Uses `LockService.getScriptLock().tryLock(30000)` to prevent concurrent execution if both the trigger and a manual run happen simultaneously |
| **Validation gate** | Checks that dates are valid and the spreadsheet is in the expected state before proceeding |
| **PDF + snapshot backup** | Archives the old data before clearing, so nothing is permanently lost |
| **Non-blocking notifications** | If Slack or email fails, the rollover still completes |
| **`getUi()` wrapped in try/catch** | The function can be called from both the menu (has UI context) and a trigger (no UI context) — the try/catch handles both |

---

## When Would You Need This File?

- **Adding a new field to the shift report** — Add the cell range to `CLEARABLE_FIELDS` so it gets cleared during rollover
- **Changing when rollover runs** — Update the day/time in `createRolloverTrigger()`
- **Rollover missed some cells** — Check `CLEARABLE_FIELDS` for missing ranges
- **Rollover cleared formulas** — A cell range in `CLEARABLE_FIELDS` includes formula cells — remove it
- **Changing the backup location** — Update the Google Drive folder ID in the PDF/snapshot steps
- **Trigger not firing** — Run `listRolloverTriggers()` to check, or re-create with `createRolloverTrigger()`

---

## Important Notes

- **This is the highest-risk operation in the system.** A bad rollover can destroy a week of data. Always test with `previewRollover()` first.
- **Formula cells (B34, B36, B37:B40, B15, B16, B26-B29) must NEVER be in `CLEARABLE_FIELDS`** — this has been a historical source of bugs (B34/B36 fixed Mar 12, B37:B40 fixed Mar 3).
- **Merged cells (narrative fields) must use `A##:F##` ranges** — clearing only `B##:F##` does nothing because the value lives in column A of the merge.
- **The trigger fires at 10am Wednesday** — chosen to be after the previous week's final shift (Sunday night) and before the new week's first shift (Wednesday evening).
- **Triggers are destroyed by `clasp push`** — after any deployment, re-run `createRolloverTrigger()` from the menu.
- **LockService timeout is 30 seconds** — if a concurrent execution can't get the lock, it fails gracefully instead of corrupting data.

---

## Related Files

- [UIServer.js](../SHIFT REPORT SCRIPTS/UIServer.js) — `getRolloverPreview()` and `executeRollover()` bridge the wizard UI to this file
- [rollover-wizard.html](../SHIFT REPORT SCRIPTS/rollover-wizard.html) — The React UI that provides the interactive rollover experience
- [VenueConfig.js](../SHIFT REPORT SCRIPTS/VenueConfig.js) — Provides cell references and operating day configuration
- [Menu.js](../SHIFT REPORT SCRIPTS/Menu.js) — Wires rollover menu items (password-protected via `pw_*` wrappers)
- [NightlyExport.js](../SHIFT REPORT SCRIPTS/NightlyExport.js) — The nightly export that populates the data this rollover clears
