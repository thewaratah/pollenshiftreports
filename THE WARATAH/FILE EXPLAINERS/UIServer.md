# UIServer.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/UIServer.js`
**Type:** Server-side bridge between React UIs and Google Apps Script
**Called by:** Menu items that open sidebars/dialogs, and by `google.script.run` from HTML files

---

## What This File Does

This is the bridge layer (~304 lines) that connects the three React-based UI files to the server-side GAS functions. It handles two responsibilities:

1. **Opening UIs** — Serves the HTML files as sidebars or modal dialogs
2. **Server functions** — Provides the `google.script.run` endpoints that the React apps call

---

## Dialog/Sidebar Openers

| Function | What It Opens | Type | Size |
|----------|--------------|------|------|
| `openRolloverWizard()` | `rollover-wizard.html` | Modal dialog | 500 x 640 |
| `openExportDashboard()` | `export-dashboard.html` | Sidebar | Default width |
| `openAnalyticsViewer()` | `analytics-viewer.html` | Sidebar | Default width |

Each opener uses `HtmlService.createHtmlOutputFromFile()` and sets the title for the sidebar/dialog.

---

## Server Functions for Rollover Wizard

| Function | What It Does | Called By |
|----------|-------------|-----------|
| `getRolloverPreview()` | Runs a dry-run rollover and returns preview data (what will be cleared, dates to update) | `rollover-wizard.html` |
| `executeRollover()` | Triggers the actual `performWeeklyRollover()` and returns the result | `rollover-wizard.html` |

---

## Server Functions for Export Dashboard

| Function | What It Does | Called By |
|----------|-------------|-----------|
| `getExportStatus()` | Returns the current state of the active sheet (name, date, whether it's been exported) | `export-dashboard.html` |
| `runExportLive()` | Triggers `continueExport(sheetName, false)` for a live export | `export-dashboard.html` |
| `runExportTest()` | Triggers `continueExport(sheetName, true)` for a test export | `export-dashboard.html` |

---

## Server Functions for Analytics Viewer

| Function | What It Does | Called By |
|----------|-------------|-----------|
| `getAnalyticsData()` | Reads from the ANALYTICS and EXECUTIVE_DASHBOARD tabs and returns the data as JSON | `analytics-viewer.html` |
| `refreshDashboard()` | Triggers `buildFinancialDashboard()` or `buildExecutiveDashboard()` to rebuild the data, then returns fresh data | `analytics-viewer.html` |

---

## When Would You Need This File?

- **Adding a new React UI** — Add an opener function and any server-side endpoints it needs
- **Adding a new server function for an existing UI** — Add the function here and call it via `google.script.run` in the HTML file
- **Debugging UI ↔ server communication** — Check that the function names match between the HTML's `google.script.run.functionName()` calls and this file
- **Changing dialog dimensions** — Update the `.setWidth()` / `.setHeight()` calls in the opener

---

## Important Notes

- **All server functions must be top-level** — `google.script.run` can only call top-level functions in the GAS project. Functions nested inside objects or returned from other functions won't be accessible.
- **Return values go through `withSuccessHandler` / `withFailureHandler`** — The React apps use these callbacks to handle responses.
- **No `getUi()` in server functions called via `google.script.run`** — UI methods (alerts, prompts) don't work when called from an HTML dialog context. Return data instead and let the HTML UI handle display.
- **Error handling** — Each server function wraps its logic in try/catch and returns `{success: false, error: message}` on failure, so the React UI can show appropriate error states.

---

## Related Files

- [rollover-wizard.html](../SHIFT REPORT SCRIPTS/rollover-wizard.html) — Rollover UI that calls `getRolloverPreview()` and `executeRollover()`
- [export-dashboard.html](../SHIFT REPORT SCRIPTS/export-dashboard.html) — Export UI that calls `getExportStatus()`, `runExportLive()`, `runExportTest()`
- [analytics-viewer.html](../SHIFT REPORT SCRIPTS/analytics-viewer.html) — Analytics UI that calls `getAnalyticsData()` and `refreshDashboard()`
- [Menu.js](../SHIFT REPORT SCRIPTS/Menu.js) — Wires menu items to the opener functions
- [WeeklyRolloverInPlace.js](../SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.js) — `performWeeklyRollover()` called by `executeRollover()`
- [NightlyExport.js](../SHIFT REPORT SCRIPTS/NightlyExport.js) — `continueExport()` called by `runExportLive()` / `runExportTest()`
- [AnalyticsDashboard.js](../SHIFT REPORT SCRIPTS/AnalyticsDashboard.js) — Dashboard builders called by `refreshDashboard()`
