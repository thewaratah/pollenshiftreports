# NightlyExport.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/NightlyExport.js`
**Type:** Primary shift report export pipeline — the main script managers run daily
**Run from:** Menu (Daily Reports > Export & Email PDF)

---

## What This File Does

This is the **core daily workflow** for The Waratah. When a manager finishes their shift report, they trigger this script to:
1. Show a pre-send checklist (timesheets approved? fruit order done?)
2. Post a rich Slack message with financials, narrative, and TO-DOs
3. Push TO-DOs to the Master Actionables Sheet
4. Sync data to the Data Warehouse
5. Generate a PDF and email it to the whole team

It's venue-aware (works for both Waratah and Sakura) and fully non-blocking — if any integration fails, the report still sends.

---

## Main Entry Points

### `exportAndEmailPDF()` — LIVE
The function managers call daily. Flow:
1. Validates the active sheet isn't an instruction tab
2. Asks "Are you sure?" confirmation
3. Opens the checklist dialog (`checklist-dialog.html`)
4. After both checklist items are ticked, calls `continueExport(sheetName, false)`

### `exportAndEmailPDF_TestToSelf()` — TEST
Same flow, but emails only `evan@pollenhospitality.com` and posts to the test Slack channel. Does not push TO-DOs to Actionables (prevents test data polluting production).

### `continueExport(sheetName, isTest)`
The actual export engine, called by the checklist dialog after confirmation. Returns `{success, message}` to the dialog for UI feedback.

**LIVE path:**

| Step | What It Does | Blocking? |
|------|-------------|-----------|
| Run integrations | `runIntegrations()` — extracts data, validates, logs to warehouse | Non-blocking |
| Build TO-DOs tab | Aggregates tasks from all 5 day sheets into the TO-DOs tab | Non-blocking |
| Post to Slack | Rich Block Kit message with financials, narrative, buttons | Non-blocking |
| Push TO-DOs | Writes tasks to Master Actionables Sheet (with duplicate detection) | Non-blocking |
| Generate PDF | Exports the sheet as a formatted A4 PDF | **Required** |
| Send email | Emails PDF to all recipients | **Required** |
| Notify warnings | If any non-blocking step failed, Slack DMs Evan with details | Non-blocking |

---

## Other Key Functions

### `postToSlackFromSheet()`
Builds and sends the rich Slack notification. Reads all shift report fields (date, MOD, staff, revenue, tips, narrative sections, TO-DOs, wastage, RSA incidents) and constructs a Block Kit message with:
- Header with venue name
- Metadata line (day, date, MOD, staff)
- Financial dashboard (revenue, tips breakdown)
- Narrative sections (only included if they have content)
- TO-DO list with assignees
- Incident alerts (wastage/comps, RSA — only if present)
- Action buttons (View PDF, Open Shift Report)

### `pushTodosToMasterActionables()`
Reads TO-DOs from the shift report and writes them to the Task Management spreadsheet. Features:
- **Duplicate detection** — checks if the same task was already pushed today
- **Two modes** — uses `createTask()` if available (same-project), otherwise falls back to direct `setValues()` append (cross-project)
- **Batch writes** — single `setValues()` call instead of per-row `appendRow()`

### `buildTodoAggregationSheet_()`
Rebuilds the TO-DOs tab by scanning all 5 day sheets (Wednesday–Sunday) and collecting every non-empty task. Clears and rewrites each time.

### `backfillAllDaysTodos()`
Admin function that re-runs the TO-DO aggregation and push for all days at once. Useful for recovering from errors. Password-protected via menu.

### Weekly Summary Functions
- `sendWeeklyTodoSummary_WARATAH()` — Posts a weekly TO-DO summary to Slack (LIVE)
- `sendWeeklyTodoSummary_WARATAH_TestToSelf()` — Same, but to test channel
- `_sendWeeklyTodoSummaryCore()` — Groups tasks by staff member and builds Block Kit message

---

## Credential/Config Loading

All credentials are loaded lazily via helper functions that read Script Properties:

| Function | What It Returns |
|----------|----------------|
| `getSlackWebhookLive_()` | Live Slack webhook URL for the current venue |
| `getSlackWebhookTest_()` | Test Slack webhook URL |
| `getEmailRecipients_()` | JSON map of email → name |
| `_getExportConfig_()` | All of the above plus venue config, cell ranges, operating days |

This lazy-loading pattern prevents `onOpen()` from crashing if Script Properties are missing.

---

## When Would You Need This File?

- **Changing who gets emailed** — Update recipients in `_SETUP_ScriptProperties.js`, not here
- **Modifying the Slack message** — Edit `postToSlackFromSheet()` to add/remove sections
- **Adding a new checklist item** — Edit `checklist-dialog.html`
- **Changing how TO-DOs are pushed** — Edit `pushTodosToMasterActionables()`
- **Adding a new narrative field** — Add a `readCell()` call in `postToSlackFromSheet()` and include it in the blocks

---

## Important Notes

- **Non-blocking design** — Every integration step is wrapped in try/catch. If Slack fails, the email still sends. If the warehouse fails, Slack and email still send. Only PDF generation failure stops the export.
- **Warning pipeline** — Failed steps collect warnings that are Slack DM'd to Evan via `_notifyExportWarnings_()`, so nothing fails silently.
- **Don't call `getUi()` in `continueExport()`** — This function is called via `google.script.run` from the HTML dialog. UI methods don't work in that context. Return `{success, message}` instead.
