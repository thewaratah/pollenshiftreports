# SAKURA HOUSE - Claude Code Project Guide

**Last Updated:** April 2, 2026 (Rollover notifications removed, 5 menu items removed, NightlyBasicExportSakura deleted, WeeklyDigest enhanced)
**Project Type:** Google Apps Script (Hospitality Management System)
**Venue:** Sakura House (Single-Venue Documentation)

> **Note:** This is the Sakura-specific guide. For The Waratah, see `CLAUDE_WARATAH.md`. For shared architecture patterns, see `CLAUDE_SHARED.md`.

---

## DEPLOYMENT (April 2, 2026) -- Menu Simplification & Rollover Notification Removal

**Rollover notifications removed from Step 8:**
- `sendRolloverNotifications_()` function deleted from `WeeklyRolloverInPlace.gs`
- `buildRolloverSlackBlocks_()` helper deleted
- `buildRolloverEmailHtml_()` helper deleted
- Step 8 now logs "Rollover notifications removed (email + Slack)" but sends nothing
- PDF archive email (`emailPdfToManagement_()` in Step 3) remains unchanged
- Context: Notifications were duplicate — PDF archive already sent via email; Step 8 added redundant Slack/email posts

**5 menu items removed from MenuSakura.gs:**
1. "Send Basic Report" — no pw_ wrapper existed; handover export removed from production menu
2. "Weekly To-Do Summary (LIVE)" — removed from Weekly Reports submenu
3. "Weekly To-Do Summary (TEST)" — removed from Weekly Reports submenu
4. "Show Integration Log (Last 30 Days)" — removed from Data Warehouse submenu
5. "Setup All SR Triggers" — removed from Setup & Diagnostics submenu

**Context:** Menu simplification focuses production menu on essential operations (nightly report, rollover, dashboards). Removed items were testing/legacy functions. Underlying functions (`setupAllTriggers_Sakura()`, `namedRangeHealthCheck_Sakura()`) retained in code but no longer exposed via menu.

**NightlyBasicExportSakura.gs deleted:**
- File contained legacy `sendShiftReportBasic()` — standalone handover script with hardcoded config
- Never updated to use Script Properties
- Removed from production; legacy pattern replaced by main export system

**WeeklyDigestSakura.gs enhanced:**
- `computeWeeklyStats_Sakura_()` now computes:
  - Day-of-week all-time revenue averages (Mon-Sat) vs this week's daily revenue
  - Rolling 4-week revenue + tips comparison (each of last 4 weeks)
- `buildWeeklyDigestBlocks_Sakura_()` updated to display:
  - Weekly Summary (unchanged)
  - **Day-of-Week Averages (All Time) vs This Week** — shows Monday avg $X, actual $Y, delta %Z for each day
  - **Rolling 4-Week Comparison** — shows revenue + tips for each of last 4 weeks in table format
  - Best Shift (unchanged)
- Currency formatting: whole dollars only ($X,XXX not $X,XXX.XX)
- Digest now provides managers with intra-week and inter-week trend data at a glance

**Files Changed:**
- `MenuSakura.gs` (5 menu items removed)
- `WeeklyRolloverInPlace.gs` (Step 8 notifications deleted)
- `NightlyBasicExportSakura.gs` (entire file deleted)
- `WeeklyDigestSakura.gs` (analytics enhanced, formatting updated)

---

## DEPLOYMENT (April 2, 2026) -- Analytics Dashboard Consolidation

**Dashboard menu restructuring:**
- Removed separate "Build Analytics Dashboard" and "Build Executive Dashboard" menu items from `Shift Report > Admin Tools > Integrations & Analytics`
- Added single consolidated item "Rebuild All Dashboards (Admin)" — calls new function `rebuildAllDashboards()`
- `rebuildAllDashboards()` in `AnalyticsDashboardSakura.gs` — calls both `buildFinancialDashboard()` and `buildExecutiveDashboard()` sequentially
- Old wrappers `pw_buildFinancialDashboard()` and `pw_buildExecutiveDashboard()` retained in `MenuSakura.gs` for backward compatibility (no longer wired to menu items)
- `UIServerSakura.gs`: `refreshDashboard()` updated to call both `buildFinancialDashboard()` and `buildExecutiveDashboard()` (previously only called the former)

**Dashboard layout cleanup:**
- Removed TOP MOD PERFORMANCE section from EXECUTIVE_DASHBOARD (formerly Section 5)
- Removed empty spacer rows between sections for more compact layout
- All cell references (weekRef, prevRef, monthly, etc.) now computed dynamically instead of hardcoded strings
- ANALYTICS tab: THIS WEEK starts row 3, WoW starts row 8, DoW heatmap starts row 15, Extended Trends starts row 25; Weekly Trend on right side starts row 3
- EXECUTIVE_DASHBOARD tab: CURRENT MONTH starts row 3, MONTHLY TREND starts row 9, ROLLING 4-WEEK starts row 24; REVENUE BY DAY (right side) starts row 3
- Code refactor: `modCol` renamed to `rightCol` in dashboard builders for consistency
- `buildExtendedTrends_Sakura()` start row changed from 29 to 25

**Context:** Dashboards use live QUERY/SUMIFS/AVERAGEIFS formulas — data auto-refreshes when NIGHTLY_FINANCIAL gets new rows. No trigger needed. `rebuildAllDashboards()` is a maintenance/setup tool, not a daily operation.

**Files Changed:**
- `AnalyticsDashboardSakura.gs` (new `rebuildAllDashboards()` function + file header comment updated for 16-column schema + TOP MOD PERFORMANCE section removal + layout cleanup)
- `UIServerSakura.gs` (`refreshDashboard()` now calls both dashboard builders)
- `MenuSakura.gs` (menu consolidation + new wrapper `pw_rebuildAllDashboards()`)

---

## DEPLOYMENT (April 2, 2026) -- Date Parsing & Warehouse Write Safety

**Root Cause Identified:**
- Sakura shift report spreadsheet locale was set to US (not Australia) — caused GAS to interpret dates as mm/dd/yyyy instead of dd/mm/yyyy
- Result: April 1 read as January 4; day-of-week columns showed "Sunday" instead of "Wednesday"
- Manual fix applied April 2: Changed spreadsheet locale to Australia (File → Settings → Locale)

**Date Parsing Hardening:**
- New function `parseCellDate_()` in `IntegrationHubSakura.gs` — parses Australian dd/MM/yyyy format safely using `Utilities.parseDate(str, 'Australia/Sydney', 'dd/MM/yyyy')`
- **CRITICAL FIX:** Removed fallback to `new Date(str)` which silently mis-parses AU-format dates as US-format (e.g., "03/04/2026" becomes April 3 instead of March 4). Now returns Invalid Date with Logger warning on parse failure.
- Used in `extractShiftData_()` to parse the date cell value before warehouse write

**New `toDateOnly_()` Helper:**
- New function `toDateOnly_(d)` in `IntegrationHubSakura.gs` — strips time component from Date objects
- Guards against Invalid Date input; returns the input unchanged if invalid
- Applies Australia/Sydney timezone context before stripping time
- Returns Date object at midnight (no time component)

**Warehouse Write Safety:**
- All `appendRow()` calls in `logToDataWarehouse_()` now wrap `shiftData.date` and `shiftData.weekEnding` with `toDateOnly_()`
- Affects 4 warehouse sheets: NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS, WASTAGE_COMPS, QUALITATIVE_NOTES
- Ensures dates written to warehouse have no time components (prevents spreadsheet display ambiguity during manual edits and backfills)
- Non-blocking: if `toDateOnly_()` receives invalid input, it returns as-is; warehouse write proceeds

**NIGHTLY_FINANCIAL Schema Change (16 columns A-P):**
- Deleted column J: "Total Tips (computed)" — redundant field (column H "Tips Total" from cell C32 is the authoritative field)
- Schema remains at 16 columns A-P (was 17 after March 6 expansion)
- Current columns: A=Date, B=Day, C=Week Ending, D=MOD, E=Net Revenue, F=Cash Total, G=Cash Tips, H=Tips Total, I=Logged At, J=Production Amount, K=Discounts, L=Deposit, M=FOH Staff, N=BOH Staff, O=Card Tips, P=Surcharge Tips

**Impact:**
- Backfills and manual date corrections now write clean dates to warehouse
- AU-format date parsing no longer fails silently with US-format misinterpretation
- Data warehouse dates remain consistent across all 4 sheets
- Spreadsheet locale now correctly displays Australian dates as dd/mm/yyyy

**Files Changed:**
- `IntegrationHubSakura.gs` (2 new functions + 6 updated `appendRow()` calls in `logToDataWarehouse_()`)

---

## DEPLOYMENT (April 2, 2026) -- Task Management Changes

**Overdue summaries removed from daily maintenance:**
- `sendOverdueTasksSummary_()` removed from `runDailyTaskMaintenance()` trigger
- Daily 7am maintenance no longer posts overdue task summaries to Slack
- Menu item "Send Overdue Summary Now" removed from Task Management menu

**Weekly active tasks now DM-only:**
- `sendWeeklyActiveTasksSummary()` no longer posts to managers channel (Monday)
- Now sends direct messages to individual staff members only
- FOH leads channel post (`#sakura_foh_leads`) also removed — `sendWeeklyFohLeadsSummary_Live()` and `_sendWeeklyFohLeadsSummary_()` deleted
- Menu items for weekly summary updated accordingly (FOH menu item removed)

**Impact:** Managers channel and FOH leads channel no longer receive task summary posts. Staff receive individual DM notifications only.

---

## DEPLOYMENT (March 18, 2026) -- M2/M3/M5/M7/M8/M9 Full Implementation

**M2 — Revenue Anomaly Detection:**
- New function `detectRevenueAnomalies_Sakura()` in `AIInsightsSakura.gs` — flags revenue deviations >2σ from 4-week rolling average
- Calls Claude Haiku to assess anomaly severity (1-5 scale) and generate brief explanation
- Posts to TEST Slack webhook when anomaly detected (non-blocking; if API fails, no Slack post but shift report still sends)
- Wired into `IntegrationHubSakura.gs`: `logToDataWarehouse_()` called after `financialLogged` check but before warehouse write
- Graceful degradation: if `ANTHROPIC_API_KEY` missing or API fails, `detectRevenueAnomalies_Sakura()` returns `null` and Slack post is skipped

**M3 — AI Task Classification:**
- New function `classifyTask_Sakura()` in `AIInsightsSakura.gs` — auto-classifies tasks with priority (High/Medium/Low) and area (FOH/BOH/Kitchen/Admin)
- Calls Claude Haiku to analyze task description and assign classification
- Wired into `TaskIntegrationSakura.gs`: called when `pushTodosDirectToMasterActionables_()` appends to Master Actionables sheet; priority and area columns populated automatically
- Non-blocking: missing API key or API errors result in unclassified tasks (task still synced, classification left blank)
- Used by task management dashboard for grouping and filtering

**M4-M7 — AI Insights Agent Upgrade (Phases 1-4):**

**M4 — Shift Analytics Engine:**
- New function `computeShiftAnalytics_Sakura(shiftData, warehouseId)` in `AIInsightsSakura.gs` — pure GAS math engine
- Reads NIGHTLY_FINANCIAL warehouse sheet; computes 4-week and 8-week trailing averages, week-over-week delta, revenue trend (linear regression: rising/falling/flat)
- Performs performance attribution (production share %), best/worst comparable shifts, anomaly detection (z-scores)
- **NEW:** Discount impact computation — `discounts / netRevenue` today vs 8-week average; highlights discount-driven revenue shifts
- Returns structured analytics object with all metrics pre-computed; all numeric values standardized to `parseFloat(x.toFixed(2))`
- Non-blocking: returns `null` if insufficient warehouse data; graceful fallback to M1 generic summary

**M5 — Structured Shift Insight:**
- New function `generateShiftInsight_Sakura(shiftData, analytics)` in `AIInsightsSakura.gs` — structured Claude Haiku prompt
- Receives pre-computed analytics from M4; generates insight in PERFORMANCE / TREND / ACTION format
- Enhanced prompt includes: confidence qualifier (high/moderate/low based on data weeks), 4-week revenue/tip benchmarks, discount rate metrics (today vs 8w avg), week-over-week signed delta (e.g., +5.1%), compact anomaly format with z-score (`[z=2.3]` or `[z>3.1 — significant outlier]`)
- Only runs if analytics available (M4 succeeded); falls back to old `generateShiftSummary_Sakura` if insufficient data
- 2-3 sentences, 200 char max; formatted for email and Slack integration (matches Waratah)
- Non-blocking: API errors fall back to generic summary

**M6 — AI Insights Routing:**
- New function `deliverAIInsights_Sakura(insight, shiftDate)` in `AIInsightsSakura.gs` — soft launch routing
- Reads Script Property `AI_INSIGHTS_MODE`: either 'evan_only' or 'live'
- In 'evan_only' (default): Evan receives upgraded `*AI Insights*` via email + TEST Slack webhook; team receives old generic `*AI Summary*`
- In 'live': entire team receives upgraded `*AI Insights*` directly
- Non-blocking: if any step fails, returns structured insight object for fallback routing; caller handles delivery
- Allows safe soft launch without affecting team experience during testing

**M7 — Insight Warehouse Logging:**
- New function `logInsightToWarehouse_Sakura(analytics, insightText)` in `AIInsightsSakura.gs` — appends to AI_INSIGHTS_LOG sheet in warehouse
- Creates sheet with headers (Date, Day, Venue, InsightText, RevenueBenchmark%, TrendDirection, AnomalyDetected) on first use
- One row per shift, stores full insight text, revenue vs benchmark %, trend direction, anomaly flag
- Used for historical insight tracking and pattern analysis
- Non-blocking: if warehouse unavailable, logging skipped but shift export proceeds

**Wiring (M4-M7):**
- Called from `NightlyExportSakura.gs` in both email path (~line 168-205) and Slack path (~line 419-465)
- Flow: computeShiftAnalytics → generateShiftInsight → logInsightToWarehouse → deliverAIInsights → route to email/Slack
- All wrapped in try/catch; failures fall back to old M1 generic summary (resilience maintained)
- Email: shows `*AI Insights*` header when upgraded, `*AI Summary*` when fallback
- Slack: title changed to `*Sakura House Analytics Insights*`; block text shows insight in Block Kit message

**Script Properties Added (M4-M7):**
- `AI_INSIGHTS_MODE`: 'evan_only' (default) or 'live' — controls soft launch routing
- `AI_INSIGHTS_EVAN_EMAIL`: Evan's email — used in 'evan_only' mode for dedicated delivery

**M5 — Shift Input Validation:**
- New function `validateShiftBeforeExport_Sakura()` in `UIServerSakura.gs` — runs before nightly export
- **Blocks export (required):** MOD field empty, or Net Revenue is zero
- **Warns (non-blocking):** Shift Summary empty, Issues/Kitchen notes empty, TO-DO section has unassigned tasks
- Returns `{ canExport: boolean, errors: string[], warnings: string[] }`
- Pre-send checklist dialog shows validation results; user can dismiss warnings but must fix errors
- Integrates into `NightlyExportSakura.gs` before `showPreExportChecklist_()` dialog

**M7 — Extended Analytics Trends:**
- New function `buildExtendedTrends_Sakura()` in `AnalyticsDashboardSakura.gs` — adds 4 new trend visualizations
- Features:
  - 13-week rolling average (tracks medium-term trends)
  - 26-week rolling average (tracks long-term trends)
  - Day-of-week heatmap (which days perform best? colors by performance quartile)
  - Year-to-date aggregation (running total revenue, tips, production since Jan 1)
- Auto-builds in `AnalyticsDashboardSakura.gs` as new section in ANALYTICS tab
- Called on first `logToDataWarehouse_()` write of each week; rebuilds if tab missing
- Safe to re-run anytime via menu: **Shift Report > Admin Tools > Integrations & Analytics > Build Analytics Dashboard**

**M8 — Task SLA Tracking:**
- New functions `buildSLASection_()` and `sendWeeklySLASummary_Sakura()` in `TaskDashboard_Sakura.gs`
- Tracks per-task metrics:
  - Days open (created → now)
  - Days overdue (due date → now if overdue)
  - Escalation time (time from creation to ESCALATED status)
  - % tasks completed on time vs overdue
- Weekly summary (Monday) posts to TEST Slack webhook: ranked list of most overdue tasks, team performance metrics
- Can be switched to LIVE webhook after review in `getTaskEscalationSlackWebhook_()` property change
- Non-blocking: if Slack fails, summary still built and logged internally

**M9 — Named Range Health Monitor:**
- New function `namedRangeHealthCheck_Sakura()` in `RunSakura.gs` — validates and repairs named ranges
- Checks: range exists, points to correct sheet, cell references are valid, no circular references
- Auto-repairs: updates stale ranges to current FIELD_CONFIG fallback cells, recreates missing ranges
- Integrated into `WeeklyRolloverInPlace.gs` Step 10: runs silently post-rollover; logs repairs to LEARNINGS tab if any found
- Menu wrapper `pw_namedRangeHealthCheck_Sakura()` in `MenuSakura.gs` — allows on-demand health check via **Shift Report > Admin Tools > Setup & Diagnostics > Check Named Range Health**
- Non-blocking: rollover completes even if repairs fail; validation errors logged but don't stop export

**Files Changed (M2-M9):**
- `AIInsightsSakura.gs` — M2, M3 detection + classification functions
- `IntegrationHubSakura.gs` — M2 wiring into warehouse flow
- `TaskIntegrationSakura.gs` — M3 wiring into task sync
- `UIServerSakura.gs` — M5 validation function
- `NightlyExportSakura.gs` — M5 validation wiring + M1 AI summary (already deployed)
- `AnalyticsDashboardSakura.gs` — M7 trends building
- `TaskDashboard_Sakura.gs` — M8 SLA tracking + weekly summary
- `RunSakura.gs` — M9 health check function
- `MenuSakura.gs` — M9 menu wrapper
- `WeeklyRolloverInPlace.gs` — M9 integration (Step 10 health check)
- `SlackBlockKitSakuraSR.gs` — M2 Slack post helper

---

## DEPLOYMENT (March 18, 2026) -- Small Items S1-S9

**S1 — Trigger Setup Menu:**
- New function `setupAllTriggers_Sakura()` in `MenuSakura.gs` — installs all 3 SR triggers (rollover Mon 1am, backfill Mon 8am, digest Mon 8am) in one call; deduplicates before creating
- New menu item: Admin Tools → Setup & Diagnostics → "Setup All SR Triggers"
- `onOpen()` now shows "⚠ Admin Tools" warning banner if rollover or digest trigger is missing

**S2 — Post-Rollover Validation:**
- New Step 9 in `WeeklyRolloverInPlace.gs`: `validateRolloverResult_()` — checks date fields and named ranges post-rollover; posts Slack alert to TEST webhook on failure; non-blocking (rollover completes even if validation fails)

**S8 — Data Warehouse Auto-Build & LockService Re-entrancy:**
- `IntegrationHubSakura.gs`: `logToDataWarehouse_(shiftData, skipLock)` — new `skipLock` parameter prevents LockService deadlock when called from within `runWeeklyBackfill_` (which already holds lock)
- Auto-builds ANALYTICS tab on first warehouse write if tab is missing
- `logPipelineLearning_()` called in catch block of `runIntegrations()` to log errors to LEARNINGS tab

**S9 — Pipeline Learning Utility:**
- New utility function `logPipelineLearning_(context, issue, fix)` in `SlackBlockKitSakuraSR.gs` — appends to LEARNINGS tab in data warehouse for operational diagnostics

**M1 — AI Shift Summarisation:**
- New file: `AIInsightsSakura.gs` — `generateShiftSummary_Sakura(shiftData)` calls Claude Haiku to generate a 2-3 sentence shift narrative
- Non-blocking: returns `null` on any failure (missing API key, HTTP error, parse error, exception) — main export always proceeds
- Model: `claude-haiku-4-5-20251001` via UrlFetchApp to `https://api.anthropic.com/v1/messages`
- Credential: `ANTHROPIC_API_KEY` read from Script Properties at call time; never hardcoded
- Input token budget: narrative fields truncated to 300 chars each; max_tokens capped at 300
- Integration in `NightlyExportSakura.gs`:
  - Slack path (`postToSlackFromSheet_`): AI summary called after TO-DOs built; appended as "AI Summary" section in Block Kit only when non-null
  - Email path (`continueExport` LIVE): AI summary called before email body built; inserted as styled block quote above salutation only when non-null
- New required Script Property: `ANTHROPIC_API_KEY` (Anthropic API secret key)

**Rollover Trigger Helpers (patch):**
- New functions `createRolloverTrigger_Sakura()` and `removeRolloverTrigger_Sakura()` added to `MenuSakura.gs`
- These were referenced by menu items and pw-wrappers (lines 67-68, 151-152) but not implemented — clicking them previously threw `ReferenceError`
- `createRolloverTrigger_Sakura()`: deduplicates → installs `performInPlaceRollover` trigger Monday 1am → UI alert (trigger-context safe)
- `removeRolloverTrigura_Sakura()`: removes all `performInPlaceRollover` triggers → UI alert (trigger-context safe)

---

## DEPLOYMENT (March 6, 2026) -- Phases 0-4 Alignment

**Phase 0 -- Error Notification Utility:**
- Added `notifyError_(functionName, error)` to `SlackBlockKitSakuraSR.gs` -- shared Slack error notification utility that reads `SAKURA_SLACK_WEBHOOK_TEST` from Script Properties
- Wired into 4 files: `WeeklyRolloverInPlace.gs` (replaced 8-line inline Slack error block), `IntegrationHubSakura.gs` (added catch to `runWeeklyBackfill_` which was try/finally only), `WeeklyDigestSakura.gs` (added `notifyError_` + re-throw), `NightlyExportSakura.gs` (wrapped `sendWeeklyTodoSummary` in try/catch)

**Phase 1 -- Data Warehouse Schema Expansion (13 to 17 cols):**
- NIGHTLY_FINANCIAL schema expanded from A-M to A-Q using append-only strategy (see updated schema below)
- New columns: N=FOHStaff, O=BOHStaff, P=CardTips, Q=SurchargeTips
- `IntegrationHubSakura.gs`: `extractShiftData_()` now returns fohStaff, bohStaff, cardTips, surchargeTips individually; `appendRow` expanded to 17 columns
- `AnalyticsDashboardSakura.gs`: QUERY ranges updated from `A2:M` to `A2:Q`

**Phase 2 -- Rollover Wizard UI:**
- NEW FILE: `rollover-wizard.html` -- lightweight vanilla HTML/CSS/JS wizard dialog (not React)
- `UIServerSakura.gs`: Added `openRolloverWizard()`, `getRolloverPreview()`, `executeRollover()` (with LockService)
- `MenuSakura.gs`: Added `pw_openRolloverWizard()` wrapper and "Open Rollover Wizard" menu item in Weekly Rollover submenu

**Phase 3 -- Rollover Webhook TEST to LIVE:**
- `WeeklyRolloverInPlace.gs`: Changed rollover success notification from `getSakuraSlackWebhookTest_()` to `getSakuraSlackWebhookLive_()` -- rollover notifications now post to the LIVE Slack channel

**Phase 4 -- Trigger Schedule Alignment:**
- `IntegrationHubSakura.gs`: Changed backfill trigger from Monday 2am to Monday 8am
- Added try/catch around `getUi().alert()` in backfill trigger setup for trigger context safety

---

## DEPLOYMENT (February 28, 2026)

**clasp push — Sakura Shift Reports: 17 files pushed**

**New file: `NightlyBasicExportSakura.gs`**
- Standalone handover export — no cross-file dependencies, hardcoded CONFIG object at top
- Intended for non-technical team use without touching the main export pipeline
- Function: `sendShiftReportBasic()` — PDF export, email, Slack post, TO-DOs to tab

**NIGHTLY_FINANCIAL schema expanded (10 → 13 columns):** *(further expanded to 17 cols Mar 6 -- see Mar 6 deployment above)*
- Previous: 10 columns (Date, Day, Week Ending, MOD, Net Revenue, ... , Logged At)
- New cols added: F=Cash Total (C19), G=Cash Tips (C29), H=Tips Total (C32)
- All existing analytics + digest code updated for new column letters (see schemas below)

**WeeklyRolloverInPlace.gs — key fixes:**
- Rollover PDF now archives **all 6 day sheets** as a single multi-page PDF (previously Monday only)
- `getUi()` trigger safety: `SpreadsheetApp.getUi()` moved out of function scope — each alert is self-contained with try/catch. Prevents silent crash when Monday 1am trigger fires. **First automated rollover: Monday 2 March 2026.**
- `stampDaySheets_()` now uses `getFieldRange(sheet, 'date')` instead of hardcoded `"B3"`
- Archive folder helpers merged into `getOrCreateArchiveSubfolder_(weekEndDateStr, subfolderName)`
- `MailApp.sendEmail()` replaced with `GmailApp.sendEmail()` throughout (single OAuth scope)
- HTTP response code check added to `exportPdfToArchive_()` PDF fetch

**AnalyticsDashboardSakura.gs — fixes:**
- `buildFinancialDashboard()`: MOD Performance section removed
- `buildFinancialDashboard()`: Weekly Trend date column now formatted via `setNumberFormat('dd/MM/yyyy')` — fixes serial number display (e.g. "46082")
- `sheet.clearContent()` → `sheet.getDataRange().clearContent()` (Sheet class has no `clearContent()`)
- Column refs updated for NIGHTLY_FINANCIAL schema (now 17 cols A-Q as of Mar 6; QUERY ranges updated to A2:Q)

**Other changes:**
- `todoFullRange` removed from FIELD_CONFIG and CLEARABLE_FIELDS (was defined, never read)
- `runWeeklyBackfill_()` now protected by `LockService.getScriptLock()` / `tryLock(30000)`
- C19 and C32 direct cell reads wrapped in try/catch with `Logger.log` warning
- `buildTodoAggregationSheet_()` and `pushTodosToActionables()` batch-write via `setValues()` (replaced appendRow loops)
- `SAKURA_TEMPLATE_ID`, `SAKURA_FOLDER_ID`, `SAKURA_ARCHIVE_FOLDER_ID` commented out in `_SETUP_ScriptProperties_SakuraOnly.gs` (vestigial from old duplication rollover)
- `verifyScriptProperties()` corrected to check `TASK_MANAGEMENT_SPREADSHEET_ID` (not `SAKURA_TASK_MANAGEMENT_ID`)
- `VenueConfigSakura.gs`: stale range keys in `SAKURA_CONFIG.ranges` updated to match current FIELD_CONFIG key names

---

## 🆕 DEPLOYMENT (February 26, 2026)

**clasp push — Sakura Shift Reports: 16 files pushed**

**NightlyExportSakura.gs (Feb 26 patch):**
- `runIntegrations()` call in `continueExport()` is now fully non-blocking — any errors/warnings go to `Logger.log()` only; export (PDF, email, Slack) always proceeds regardless of warehouse failures.
- TEST path Slack calls wrapped in try/catch.
- Managers never see warehouse/system errors.

**checklist-dialog.html (Feb 26 patch):**
- Replaced browser `alert()` on success with in-dialog success state.
- On success: buttons hidden, green "Sent successfully" message appears, dialog auto-closes after 2 seconds.
- Root cause fixed: native `alert()` showed confusing "An embedded page at script.googleusercontent.com says..." header.

**Design constraint (confirmed):** `continueExport()` is called from the HTML dialog via `google.script.run`. It MUST return `{ success: boolean, message: string }` and MUST NOT call `SpreadsheetApp.getUi()` or `ui.alert()` — these throw 'Authorisation is required to perform that action' in the google.script.run context. All UI feedback must be handled by the dialog's JavaScript callbacks.

---

## DEPLOYMENT (February 25, 2026)

**clasp push — all 4 projects deployed:**

- Sakura House Shift Reports: 16 files pushed (NightlyExportSakura.gs + checklist-dialog.html updated)
- Sakura House Task Management: 11 files pushed (no code changes since Feb 23)
- Waratah Shift Reports: already up to date
- Waratah Task Management: 8 files pushed (no code changes since Feb 23)

**NightlyExportSakura.gs (Feb 25 patch):** Added explicit JSDoc note to continueExport() clarifying that SpreadsheetApp.getUi() / ui.alert() must NOT be called from google.script.run context — these throw 'Authorisation is required to perform that action'. Return { success, message } and let the dialog handle all UI feedback.

**checklist-dialog.html (both venues):** Pre-send checklist modal — Deputy Timesheets Approved + Fruit Order Done must both be checked before the Confirm & Send button enables. Calls continueExport() via google.script.run.

---

## 🆕 RECENT UPDATES (February 23, 2026)

**Task Management Bug Fix:**

🐛 **Fixed `TypeError: Cannot read properties of undefined (reading 'dmWebhooks')`**
- **Root cause:** `TASK_CONFIG` has no `slack` section — it was removed during the Feb 16 cleanup, but 7 call sites in `EnhancedTaskManagement_Sakura.gs` still referenced `TASK_CONFIG.slack.*` and `TASK_CONFIG.escalation.escalateTo*`
- **Fix:** Replaced all 7 references with the existing Script Properties helper functions:
  - `TASK_CONFIG.slack.managersChannel` → `getManagersChannelWebhook_()`
  - `TASK_CONFIG.slack.dmWebhooks[x]` → `getSlackDmWebhooks_()[x]`
  - `TASK_CONFIG.escalation.escalateToSlackWebhook` → `getEscalationSlackWebhook_()`
  - `TASK_CONFIG.escalation.escalateToEmail` → `getEscalationEmail_()`
- **Affected functions:** `checkAndNotifyOverdueTasks`, `sendOverdueTasksDMs_`, `sendWeeklyActiveTasksSummary`, `sendWeeklyActiveTasksSummary_Test`, `_sendWeeklyActiveTasksDMs_`, `escalateBlockedTasks`
- **Pushed:** ✅ clasp pushed Feb 23, 2026

⚠️ **Pattern to Remember:** `TASK_CONFIG` contains only spreadsheet/sheet/timezone/escalation-threshold/archive settings. All Slack webhooks and emails are fetched at runtime via helper functions from Script Properties. **Never put webhook URLs or emails in `TASK_CONFIG`.**

**Shift Report Scripts Overhaul:**

📝 **`RunSakura.gs` — FIELD_CONFIG expanded to 25 fields**
- New fields added: `fohStaff`, `bohStaff`, `cashCount`, `cashRecord`, `pettyCashTransactions`, `todoTasks`, `todoAssignees`, `todoFullRange`, `goodNotes`
- Renamed: `todoTask` → `todoTasks`/`todoAssignees`/`todoFullRange`
- Fallback cells updated throughout to match current template layout (e.g. `date` = `B3:D3`, `shiftSummary` = `A59:D59`)
- New function: `forceUpdateNamedRangesOnAllSheets()` — overwrites existing named ranges with current FIELD_CONFIG fallbacks (use after updating fallbacks)

🔄 **`WeeklyRolloverInPlace.gs` — Production ready**
- CLEARABLE_FIELDS expanded to include all 25 fields
- Now also clears the **TO-DOs tab** (row 2 onwards) via `config.TODO_SHEET = 'TO-DOs'`
- Rollover Slack notification uses `getSakuraSlackWebhookLive_()` -- switched from TEST to LIVE Mar 6 (Phase 3)
- Error notifications use shared `notifyError_()` from SlackBlockKitSakuraSR.gs (Phase 0)

📋 **`MenuSakura.gs` (Shift Reports) — Restructured**
- `Send Nightly Report` — **no longer password-gated** (runs directly)
- All admin/destructive operations moved into `Admin Tools` submenu
- New item: `Force Update Named Ranges (ALL Sheets)` under Setup & Diagnostics
- Password now read from Script Properties via `getMenuPassword_()` (no hardcoded value in this file)

🖊️ **`NightlyExportSakura.gs` — Pre-send checklist**
- `showPreExportChecklist_()` now shows a modal dialog before export
- User must confirm checklist items before export continues
- `continueExport(sheetName, isTest)` is called by the dialog after confirmation

**Task Management Scripts Overhaul:**

📁 **New file: `_SETUP_ScriptProperties_TaskMgmt_Sakura.gs`**
- Created because the setup file was deleted in the Feb 16 cleanup
- Run `setupScriptProperties_TaskMgmt_Sakura()` once from the **Sakura Actionables Sheet**
- Sets 6 properties: `TASK_MANAGEMENT_SPREADSHEET_ID`, `ESCALATION_EMAIL`, `ESCALATION_SLACK_WEBHOOK`, `SLACK_MANAGERS_CHANNEL_WEBHOOK`, `SLACK_FOH_LEADS_WEBHOOK`, `SLACK_DM_WEBHOOKS`
- **Note:** These are properties for the Actionables Sheet project — separate from Shift Reports project properties

🎯 ~~FOH Leads Summary~~ — **Removed Apr 2026**
- `sendWeeklyFohLeadsSummary_Live()` and `_sendWeeklyFohLeadsSummary_()` deleted
- Menu item "Send Weekly Active Tasks (FOH)" removed
- `SLACK_FOH_LEADS_WEBHOOK` Script Property now unused (can be removed)

📋 **`Menu_Updated_Sakura.gs` — Updated task management menu**
- Added Slack actionables poster (second menu: `Custom Scripts`)
- Admin password read from Script Properties via `getMenuPassword_()` (line 19) — property key: `MENU_PASSWORD` in the Sakura Actionables Sheet project

---

## 🆕 PREVIOUS UPDATES (February 16, 2026)

**System Status - PRODUCTION READY ✅**

**Cleanup & Deployment Complete:**

📦 **Code Cleanup (Phases 1-2):**
- **1,733 lines removed** (15.8% reduction)
- **6 files deleted** (legacy rollover, test files, cross-venue code)
- **Files:** 17 → 12 (.gs files)
- **Storage freed:** ~265KB
- **Venue isolation:** 100% achieved (no shared files)

📋 **New Documentation:**
- **[Deployment Guide](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/DEPLOYMENT_GUIDE.md)** - Complete deployment procedure via clasp
- **[Testing Guide](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/ROLLOVER_TESTING_GUIDE.md)** - 4-phase testing procedure (400+ lines)
- **[Phase 1 Cleanup](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/PHASE1_CLEANUP_COMPLETE.md)** - Legacy code removal (1,363 lines)
- **[Phase 2 Cleanup](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/PHASE2_CLEANUP_COMPLETE.md)** - Additional cleanup (370 lines)
- **[Implementation Summary](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/SESSION_IMPLEMENTATION_SUMMARY.md)** - What changed and why

🔒 **Security Hardening (42 → 75 points):**
- Created Sakura-only setup file (no cross-venue credentials)
- Removed all hardcoded passwords and webhooks
- Interactive Script Properties configuration
- LIVE export now password-protected
- Cross-venue credential exposure eliminated

🚀 **Rollover System:**
- Configuration moved to Script Properties (no hardcoded values)
- PDF export refactored for trigger execution (no UI prompts)
- PDFs now archived to Drive + emailed to management
- Ready for automated Monday 1am trigger
- Legacy rollover system completely removed

✅ **Deployment Status:**
- Deployed via clasp to Apps Script (16 files)
- Script Properties configured (16 properties, including 3 AI properties added Mar 18)
- Menu verified working
- Email recipients: 6 management team members

📊 **Quality Scores:**
- Overall: 63/100 → 76/100 (+13 points)
- Security: 42/100 → 75/100 (+33 points)
- Architecture: 78/100 → 87/100 (+9 points)
- Dead code: 1,733 lines → 0 lines (-100%)

---

## Project Overview

SAKURA HOUSE shift reporting and task management system built on Google Apps Script. Features advanced named range system, in-place weekly rollover, and comprehensive automation.

**Core Capabilities:**
- 📊 **Automated Shift Reporting** - Daily financial reconciliation and operational notes
- ✅ **Enhanced Task Management** - 8-status workflow with auto-escalation and recurring tasks
- 📈 **Data Warehousing** - Centralized analytics database with duplicate prevention
- 🔄 **Weekly Rollover In-Place** - NEW: Automated report cycling without file duplication
- 📧 **PDF Export** - Formatted reports via email and Slack
- 💬 **Slack Integration** - Rich Block Kit notifications

---

## File Structure

```
SAKURA HOUSE/
├── SHIFT REPORT SCRIPTS/         # 18 files, ~7,100 LOC (rollover-wizard.html added Mar 6)
│   ├── Production Scripts (13 .gs files):
│   │   ├── RunSakura.gs             # Named range system (529 lines)
│   │   ├── VenueConfigSakura.gs     # Sakura-only config (range keys updated Feb 28)
│   │   ├── IntegrationHubSakura.gs  # Data integration (17-col schema, LockService, notifyError_)
│   │   ├── NightlyExportSakura.gs   # PDF export (pre-send checklist dialog, batch writes)
│   │   ├── WeeklyRolloverInPlace.gs # In-place rollover (multi-sheet PDF, LIVE webhook Mar 6)
│   │   ├── MenuSakura.gs            # Custom menu (rollover wizard added Mar 6)
│   │   ├── AnalyticsDashboardSakura.gs  # QUERY ranges A2:Q (updated Mar 6)
│   │   ├── AIInsightsSakura.gs      # AI shift summarisation via Claude Haiku (NEW Mar 18)
│   │   ├── SlackBlockKitSakuraSR.gs # Block Kit helpers + notifyError_() utility (Mar 6)
│   │   ├── TaskIntegrationSakura.gs # batch setValues()
│   │   ├── UIServerSakura.gs        # Export/analytics UI + rollover wizard server fns (Mar 6)
│   │   └── WeeklyDigestSakura.gs    # Weekly revenue Slack digest (notifyError_ added Mar 6)
│   ├── Setup (1 file):
│   │   └── _SETUP_ScriptProperties_SakuraOnly.gs  # Secure configuration
│   └── HTML (4 files):
│       ├── analytics-viewer.html    # 207KB
│       ├── export-dashboard.html    # 208KB
│       ├── checklist-dialog.html    # Pre-send checklist modal (150 lines)
│       └── rollover-wizard.html     # Rollover wizard dialog -- vanilla HTML/CSS/JS (NEW Mar 6)
├── TASK MANAGEMENT SCRIPTS/      # 8 files, ~3,000 LOC
│   ├── EnhancedTaskManagement_Sakura.gs  # Task system (1,964 lines, bug-fixed Feb 23)
│   ├── Menu_Updated_Sakura.gs            # Task management + Slack poster menu
│   ├── _SETUP_ScriptProperties_TaskMgmt_Sakura.gs  # NEW: Setup for task management properties
│   ├── TaskDashboard_Sakura.gs
│   ├── SlackActionablesPoster_Sakura.gs
│   ├── VenueConfigSakura.gs, UIServerSakura.gs
│   └── SlackBlockKitSAKURA.gs + task-manager.html
└── CODE_REVIEW_REPORTS_2026-02-16/  # Documentation
    ├── DEPLOYMENT_GUIDE.md
    ├── ROLLOVER_TESTING_GUIDE.md
    ├── PHASE1_CLEANUP_COMPLETE.md
    ├── PHASE2_CLEANUP_COMPLETE.md
    └── SESSION_IMPLEMENTATION_SUMMARY.md
```

**Total:** ~9,700 lines of code across 21 .gs + 4 .html files (12 SR .gs + 8 TM .gs + _SETUP + 4 HTML; NightlyBasicExportSakura deleted Apr 2)

**Removed Files (Apr 2, 2026 & Earlier):**
- ❌ NightlyBasicExportSakura.gs (Apr 2 — legacy handover export, never updated to Script Properties)
- ❌ _SETUP_ScriptProperties.gs (cross-venue security risk)
- ❌ WeeklyRolloverSakura.gs (legacy system)
- ❌ WeeklyDuplicationSakura.gs (legacy system)
- ❌ TEST_SlackBlockKitLibrarySakura.gs (unused test)
- ❌ TEST_VenueConfigSakura.gs (unused test)

**Re-created Files (Mar 6, 2026):**
- rollover-wizard.html -- new lightweight vanilla HTML/CSS/JS wizard (replaces legacy 209KB React version)

---

## Named Range System (Sakura's Key Innovation)

**File:** [`RunSakura.gs`](SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/RunSakura.gs) (529 lines)

### Why Named Ranges?

**Problem:** Hardcoded cell references (`B54`) break when:
- Rows/columns are inserted
- Sheet structure changes
- Rollover operations occur

**Solution:** Named ranges (`MONDAY_SR_NetRevenue`) stay bound to cells regardless of structural changes

### Convention

```
{DAY}_SR_{Suffix}
Examples:
- MONDAY_SR_Date
- TUESDAY_SR_NetRevenue
- WEDNESDAY_SR_ShiftSummary
```

### Fallback Mechanism (Critical)

```javascript
function getFieldRange(sheet, fieldKey) {
  const config = FIELD_CONFIG[fieldKey];
  const namedRangeName = `${dayPrefix}_${config.suffix}`;

  try {
    const namedRange = spreadsheet.getRangeByName(namedRangeName);
    if (namedRange) return namedRange;  // ✅ Found
  } catch (e) { }

  // ⚠️ Fallback to hardcoded cell
  Logger.log(`Named Range not found. Using fallback: ${config.fallback}`);
  return sheet.getRange(config.fallback);
}
```

**Benefits:**
- Graceful degradation if named ranges missing
- Self-healing (can recreate from fallbacks)
- Scripts never fail due to missing named ranges

### Field Configuration (24 fields — todoFullRange removed Feb 28, 2026)

```javascript
const FIELD_CONFIG = {
  // HEADER
  date:                 { suffix: "SR_Date",                  fallback: "B3:D3",    description: "Report date (merged cell)" },
  mod:                  { suffix: "SR_MOD",                   fallback: "B4:D4",    description: "Manager on Duty (merged cell)" },
  fohStaff:             { suffix: "SR_FOHStaff",              fallback: "B6:D6",    description: "FOH staff on shift" },
  bohStaff:             { suffix: "SR_BOHStaff",              fallback: "B7:D7",    description: "BOH staff on shift" },

  // CASH
  cashCount:            { suffix: "SR_CashCount",             fallback: "C10:E17",  description: "Cash count breakdown" },
  cashRecord:           { suffix: "SR_CashRecord",            fallback: "C22:D23",  description: "Cash record totals" },
  pettyCashTransactions:{ suffix: "SR_PettyCashTransactions", fallback: "B40:B45",  description: "Petty cash transactions" },

  // FINANCIALS
  netRevenue:           { suffix: "SR_NetRevenue",            fallback: "B54",      description: "Net revenue less tips & accounts" },

  // SHIFT REPORT
  shiftSummary:         { suffix: "SR_ShiftSummary",          fallback: "A59:D59",  description: "General overview / shift summary" },

  // TO-DO SECTION
  todoTasks:            { suffix: "SR_TodoTasks",             fallback: "A69:C84",  description: "To-do task descriptions" },
  todoAssignees:        { suffix: "SR_TodoAssignees",         fallback: "D69:D84",  description: "To-do assignee dropdowns" },
  // todoFullRange removed Feb 28, 2026 — was defined but never read by any function

  // FINANCIAL DETAIL
  cashTips:             { suffix: "SR_CashTips",              fallback: "C29",      description: "Tips - Cash" },
  cardTips:             { suffix: "SR_CardTips",              fallback: "C30",      description: "Tips - Card" },
  surchargeTips:        { suffix: "SR_SurchargeTips",         fallback: "C31",      description: "Tips - Surcharge" },
  productionAmount:     { suffix: "SR_ProductionAmount",      fallback: "B37",      description: "Production amount (from Lightspeed)" },
  deposit:              { suffix: "SR_Deposit",               fallback: "B38",      description: "Deposit / revenue outside Lightspeed" },
  discounts:            { suffix: "SR_Discounts",             fallback: "B50",      description: "Total discounts (from Lightspeed)" },

  // CONTENT SECTIONS
  guestsOfNote:         { suffix: "SR_GuestsOfNote",          fallback: "A61:D61",  description: "VIPs, regulars" },
  goodNotes:            { suffix: "SR_GoodNotes",             fallback: "A63:D63",  description: "Good notes - positive feedback" },
  issues:               { suffix: "SR_Issues",                fallback: "A65:D65",  description: "Issues / improvements" },
  kitchenNotes:         { suffix: "SR_KitchenNotes",          fallback: "A67:D67",  description: "Kitchen notes (from chef)" },
  wastageComps:         { suffix: "SR_WastageComps",          fallback: "A86:D86",  description: "Wastage / comps / discounts" },
  maintenance:          { suffix: "SR_Maintenance",           fallback: "A88:D88",  description: "Maintenance items" },
  rsaIncidents:         { suffix: "SR_RSAIncidents",          fallback: "A90:D90",  description: "RSA / intox / refusals" }
};
```

**Changed from old docs:** `todoTask` → split into `todoTasks`/`todoAssignees` (Feb 23); `todoFullRange` removed Feb 28 (was defined but never read); all fallback cells match actual template layout.

### Diagnostics & Setup

**Menu → Admin Tools → Setup & Diagnostics:**

```javascript
diagnoseNamedRanges()                   // Check active sheet
diagnoseAllSheets()                     // Check all 6 day sheets
createNamedRangesOnActiveSheet()        // Setup from fallbacks (skips existing)
createNamedRangesOnAllSheets()          // Bulk setup for all days (skips existing)
forceUpdateNamedRangesOnAllSheets()     // NEW: Overwrite ALL named ranges with current FIELD_CONFIG fallbacks
```

**When to use `forceUpdateNamedRangesOnAllSheets()`:**
- After updating fallback cell references in FIELD_CONFIG
- Named ranges are pointing to old cells and need to be refreshed
- Unlike `createNamedRangesOnAllSheets()`, this OVERWRITES existing ranges

**Usage:**
1. Open any day sheet (MONDAY, TUESDAY, etc.)
2. Menu → Setup & Diagnostics → Check Named Ranges
3. If missing: Menu → Create Named Ranges (Active Sheet)

---

## Venue Configuration

**File:** [`VenueConfigSakura.gs`](SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/VenueConfigSakura.gs)

**Key Difference from Waratah:** Uses **named ranges** (not hardcoded cells)

```javascript
const SAKURA_CONFIG = {
  name: 'SAKURA HOUSE',
  days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
  dayCount: 6,  // Closed Sundays
  sheetNames: {
    master: 'SAKURA HOUSE - CURRENT WEEK',
    audit: 'AUDIT LOG',
    archive: 'ARCHIVE'
  },
  ranges: {
    usesNamedRanges: true,  // ✅ Uses named ranges
    todoTask: 'TODO_TASK_RANGE',
    date: 'DATE_RANGE',
    netRevenue: 'NET_REVENUE',
    // ... references to named ranges
  },
  timezone: 'Australia/Sydney',
  features: {
    taskManagement: true,
    nightlyExport: true,
    analytics: true,
    inPlaceRollover: true  // NEW
  }
}
```

---

## Weekly Rollover In-Place ✅

**File:** [`WeeklyRolloverInPlace.gs`](SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/WeeklyRolloverInPlace.gs)
**Plan:** [docs/plans/2026-02-11-feat-in-place-weekly-rollover-plan.md](docs/plans/2026-02-11-feat-in-place-weekly-rollover-plan.md)

### Why In-Place?

**Problem with Duplication (Legacy):**
- `makeCopy()` doesn't duplicate container-bound scripts
- New files have no custom menus ❌
- Complex Apps Script API workaround
- Still fails intermittently

**Solution:**
- Single working file: **"Sakura House - Current Week"**
- Every Monday 1am:
  1. Export PDF + Google Sheets snapshot
  2. Archive to `Archive/YYYY/YYYY-MM/sheets/` and `/pdfs/`
  3. **Clear data** (preserve structure, formulas, named ranges)
  4. Update dates to next week
  5. Send notifications

### Critical Pattern: clearContent() vs clear()

```javascript
// ✅ CORRECT - Preserves named ranges, formatting, validation
const range = getFieldRange(sheet, 'netRevenue');
range.clearContent();

// ❌ WRONG - Destroys named ranges, formatting, formulas
range.clear();
```

**Why This Matters:**
- `clear()` removes named ranges → scripts stop working
- `clearContent()` only removes values → everything else survives
- **Always use `clearContent()` for rollover/data clearing**

### Rollover Flow

```javascript
performInPlaceRollover()
    ├─→ validateRolloverPreconditions_()  // Check file ID, VENUE_NAME, week completion
    ├─→ generateWeekSummary_()
    ├─→ exportPdfToArchive_()
    ├─→ createArchiveSnapshot_()          // makeCopy() to archive folder
    ├─→ clearAllSheetData_()              // FOR EACH field: range.clearContent()
    ├─→ updateDatesToNextWeek_()          // Calculate + stamp next week dates
    ├─→ verifyAndFixNamedRanges_()        // Recreate any missing named ranges
    ├─→ sendRolloverNotifications_()      // Email + Slack
    └─→ validateRolloverResult_()         // NEW (S2): Check dates + named ranges post-rollover; posts Slack alert on failure (non-blocking)
```

### Archive Structure

```
Archive/
├── 2026/
│   ├── 2026-02/
│   │   ├── sheets/
│   │   │   └── Sakura Shift Report W.E. 09.02.2026
│   │   └── pdfs/
│   │       └── Sakura Shift Report W.E. 09.02.2026.pdf
```

### Rollover PDF — All 6 Sheets (updated Feb 28, 2026)

The rollover now exports **all 6 day sheets** as a single multi-page PDF archive (previously only Monday's sheet). Implementation: non-day sheets are hidden before export, all visible sheets are exported together, sheet visibility is restored in a try/finally block.

### Trigger Safety Fix (Feb 28, 2026)

`SpreadsheetApp.getUi()` was previously called at function scope in `performInPlaceRollover()`. When the Monday 1am time trigger fires there is no UI context — the old code would throw a silent uncaught exception and abort the rollover. Fix: each `ui.alert()` call is now wrapped in its own try/catch. The rollover always runs to completion; UI prompts are silently skipped in trigger context.

**First automated trigger run: Monday 2 March 2026.**

### Archive Folder Helpers (updated Feb 28, 2026)

`getOrCreateArchiveFolder_()` and `getOrCreatePdfArchiveFolder_()` merged into a single helper:
```javascript
getOrCreateArchiveSubfolder_(weekEndDateStr, subfolderName)
// subfolderName: 'sheets' or 'pdfs'
```

### Setup Trigger

**Manually create via Apps Script Editor → Triggers:**
- Function: `performInPlaceRollover`
- Event source: Time-driven
- Type: Week timer
- Day: Monday
- Time: 1am to 2am

### Rollover Wizard (NEW Mar 6 -- Phase 2)

**Files:** `rollover-wizard.html` + `UIServerSakura.gs`

A lightweight vanilla HTML/CSS/JS wizard dialog that provides a guided rollover experience:
- `openRolloverWizard()` -- opens the wizard dialog (called from menu)
- `getRolloverPreview()` -- returns preview data for the wizard to display
- `executeRollover()` -- runs the rollover with `LockService.getScriptLock()` protection

Accessed via: **Menu -> Admin Tools -> Weekly Rollover (In-Place) -> Open Rollover Wizard**

### Testing

```javascript
previewInPlaceRollover()  // Dry run - shows what will happen, no changes
```

---

## Critical Notes & Gotchas

**CRITICAL: Spreadsheet Locale Must Be Australia**

> Both the shift report AND data warehouse spreadsheets must have their locale set to Australia. If either is set to US, GAS will misinterpret Australian dd/mm/yyyy dates as mm/dd/yyyy, causing date columns to show wrong values (e.g., April 1 read as January 4, day-of-week columns show "Sunday" instead of "Wednesday"). Root cause identified and fixed April 2, 2026.

- **Fix:** File → Settings → Locale → Select "Australia (Sydney)"
- **Both spreadsheets affected:** Sakura Shift Report (SAKURA HOUSE - CURRENT WEEK) AND Sakura Data Warehouse
- **Why it matters:** AU dates are ambiguous until locale is set (03/04 could be March 4 or April 3). Spreadsheet locale tells GAS which interpretation to use.
- **Verification:** After changing locale, dates should display as dd/mm/yyyy (e.g., 01/04/2026 for April 1, 2026). Check day-of-week columns show correct values (e.g., Wednesday for April 1, 2026).

---

**CRITICAL: QUERY MONTH() is 0-indexed, Spreadsheet MONTH() is 1-indexed**

> Google Sheets QUERY language uses 0-indexed months (Jan=0, Dec=11), while normal spreadsheet formulas use 1-indexed months (Jan=1, Dec=12). If you use `MONTH(A)` in a QUERY without adjustment, months will display one behind (2026/03 instead of 2026/04). Fixed April 2, 2026 in Executive Dashboard Monthly Trend.

- **Symptom:** QUERY grouped by `YEAR(A)*100+MONTH(A)` displays one month behind actual data
- **Fix:** Use `YEAR(A)*100+(MONTH(A)+1)` in SELECT, GROUP BY, ORDER BY, and LABEL clauses
- **Example:** For April 2026 data, `YEAR(A)*100+(MONTH(A)+1)` produces `202604`, which formats as "2026/04" with number format `0000"/"00`
- **Scope:** Only affects QUERY formulas. Regular spreadsheet `=MONTH()` functions are unaffected (they are 1-indexed and correct). SUMPRODUCT with MONTH() is also unaffected.
- **Applied in:** `AnalyticsDashboardSakura.gs` `buildExecutiveDashboard()` Monthly Trend section (line 355-363)

---

## Script Properties Configuration

**Required Properties:**

```javascript
// Venue
VENUE_NAME: "SAKURA"
SHEET_PROTECTION_OWNER_EMAIL: "evan@sakurahousesydney.com"  // Only user allowed to edit protected sheet areas; falls back to script owner if not set

// Slack Webhooks
SAKURA_SLACK_WEBHOOK_LIVE: "https://hooks.slack.com/services/..."
SAKURA_SLACK_WEBHOOK_TEST: "https://hooks.slack.com/services/..."

// Email
SAKURA_EMAIL_RECIPIENTS: '["evan@...", "adam@...", "properties.litster@..."]'

// Spreadsheet IDs
SAKURA_DATA_WAREHOUSE_ID: "1T4WwoedgSdT1MNWJwxPCC_eG9MmU54YE1VYDdjcRzDk"
TASK_MANAGEMENT_SPREADSHEET_ID: "[spreadsheet_id]"

// Task Management
ESCALATION_EMAIL: "evan@sakurahousesydney.com"
ESCALATION_SLACK_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_MANAGERS_CHANNEL_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_DM_WEBHOOKS: '{"Evan":"...", "Nick":"...", "Gooch":"..."}'

// Rollover (for in-place system)
SAKURA_WORKING_FILE_ID: "[current_working_file_id]"
ARCHIVE_ROOT_FOLDER_ID: "1a1AbJN4qU7Lt2oyYPxiTn3kG5EEKOf1K"

// AI Insights (M1-M7 — updated Mar 18, 2026)
ANTHROPIC_API_KEY: "[your_anthropic_api_key]"
AI_INSIGHTS_MODE: "evan_only"  // or "live" for full team rollout
AI_INSIGHTS_EVAN_EMAIL: "evan@pollenhospitality.com"
```

**Setup Function (Shift Reports project):**
```javascript
setupScriptProperties_SakuraShiftReports()
```

**Task Management properties** (separate Actionables Sheet project — run `setupScriptProperties_TaskMgmt_Sakura()` from that sheet):
```javascript
TASK_MANAGEMENT_SPREADSHEET_ID: "13ANpyoohs9RQMpuS026mSLjLxrH9RIVmtp5i-mRhnZk"
ESCALATION_EMAIL: "evan@sakurahousesydney.com"
ESCALATION_SLACK_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_MANAGERS_CHANNEL_WEBHOOK: "https://hooks.slack.com/services/..."
SLACK_FOH_LEADS_WEBHOOK: "https://hooks.slack.com/services/..."  // DEPRECATED Apr 2, 2026 — FOH leads summary removed. Can be safely deleted from Script Properties via Apps Script editor.
SLACK_DM_WEBHOOKS: '{"Evan":"...","Nick":"...","Gooch":"...","Adam":"...","Cynthia":"...","Kalisha":"...","Sabine":"..."}'
```

**⚠️ Two separate projects — two separate Script Property stores:**
- Shift Reports spreadsheet → uses `SAKURA_*` prefixed properties
- Sakura Actionables Sheet → uses un-prefixed task management properties

---

## Integration Hub & Data Warehouse

**File:** [`IntegrationHubSakura.gs`](SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/IntegrationHubSakura.gs)

**Flow:**
```
Shift Report
    ↓
runIntegrations(sheetName)
    ├─→ extractShiftData_()      // Extract via named ranges
    ├─→ validateShiftData_()
    ├─→ logToDataWarehouse_(shiftData, skipLock)    // Write to 4 warehouse sheets (S8: skipLock param prevents re-entrancy deadlock)
    └─→ logIntegrationRun_()

Error handling (S9):
    └─→ logPipelineLearning_(context, issue, fix)   // Appends to LEARNINGS tab on integration failure
```

**Auto-Build Behavior (S8, Mar 18, 2026):**
The ANALYTICS tab is auto-created on first warehouse write if missing. LockService re-entrancy fixed via `skipLock` parameter — when `runWeeklyBackfill_` calls `logToDataWarehouse_()`, it passes `skipLock=true` to prevent deadlock (backfill already holds the lock).

**Data Warehouse Sheets (schemas current as of April 2, 2026):**

**1. NIGHTLY_FINANCIAL** (16 columns A-P -- expanded Mar 6, redundant column J deleted Apr 2)
```
A=Date | B=Day | C=WeekEnding | D=MOD | E=NetRevenue |
F=CashTotal | G=CashTips | H=TipsTotal | I=LoggedAt |
J=ProductionAmount | K=Discounts | L=Deposit |
M=FOHStaff | N=BOHStaff | O=CardTips | P=SurchargeTips
```
Columns M-P added Mar 6 (Phase 1) using append-only strategy. Column J (redundant TipsTotal) deleted Apr 2. Duplicate key: date (A) + MOD (D)

**2. WASTAGE_COMPS** (5 columns — corrected Feb 28)
```
A=Date | B=Day | C=Week Ending | D=MOD | E=COMMENTS
```
Duplicate key: date (A) + MOD (D)

**3. OPERATIONAL_EVENTS** (9 columns — rewritten Feb 28, one row per TO-DO item)
```
A=Date | B=Type ("New") | C=Item (task text) | D=Quantity ("") |
E=Value ("MEDIUM") | F=Staff (assignee) | G=Reason ("") |
H=Category ("TO-DO") | I=Source ("Shift Report")
```
Duplicate key: date (A) + Item text (C)

**4. QUALITATIVE_LOG** - Shift narratives (schema unchanged)

**Duplicate Prevention (hardened Feb 23, 2026):**

Uses `normaliseDateKey_()` to handle both Date objects and string-stored dates:
```javascript
const shiftDateKey = normaliseDateKey_(shiftData.date);
const isDuplicate = existingData.some(row => {
  const rowKey = normaliseDateKey_(row[0]);
  return rowKey !== null && rowKey === shiftDateKey && row[3] === shiftData.mod;
});
```

**New helpers (Feb 23, 2026):**
- `parseCellDate_(value)` — Parses `dd/MM/yyyy` strings using `Utilities.parseDate` with Australia/Sydney timezone
- `normaliseDateKey_(v)` — Normalises Date objects OR string-stored dates to canonical `toDateString()` form for comparison
- `showIntegrationLogStats()` — Legacy function (menu item removed Apr 2); shows 30-day INTEGRATION_LOG summary (retained in code for backward compat)

**Data Warehouse Menu (`Admin Tools → Data Warehouse`):**
- Backfill This Sheet to Warehouse
- Setup Weekly Backfill Trigger

**Backfill Trigger:** Monday 8am (Australia/Sydney) -- changed from 2am in Phase 4, Mar 6. `getUi().alert()` wrapped in try/catch for trigger context safety.

---

## Weekly Revenue Digest

**File:** [`WeeklyDigestSakura.gs`](SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/WeeklyDigestSakura.gs) (NEW Feb 23, 2026)

Posts a weekly revenue performance summary to Slack, comparing this week vs last week.

**Functions:**
```javascript
sendWeeklyRevenueDigest_Sakura()       // Main — posts to LIVE Slack webhook
sendWeeklyRevenueDigest_Sakura_Test()  // Posts to TEST Slack webhook
computeWeeklyStats_Sakura_(warehouseId) // Reads NIGHTLY_FINANCIAL, computes stats
buildWeeklyDigestBlocks_Sakura_(stats)  // Block Kit message with change arrows, best day, tips
setupWeeklyDigestTrigger_Sakura()       // Installs Monday 8am trigger (safe to re-run)
```

**Menu:** `Admin Tools → Weekly Digest`
- Send Revenue Digest (LIVE)
- Send Revenue Digest (TEST)
- Setup Monday Digest Trigger

**Data Source:** NIGHTLY_FINANCIAL sheet in `SAKURA_DATA_WAREHOUSE_ID`
- Column E = Net Revenue
- Column J = Total Tips (index 9; schema now 17 cols A-Q as of Mar 6)
- Error handling via `notifyError_()` from SlackBlockKitSakuraSR.gs (added Mar 6)
- Pipeline learning logged via `logPipelineLearning_()` on errors (S9, Mar 18)

**Trigger:** Monday 8am (Australia/Sydney) -- NOT YET SET UP. Must be installed manually via:
- Menu: `Admin Tools → Weekly Digest → Setup Monday Digest Trigger`, or
- Run `setupWeeklyDigestTrigger_Sakura()` from the Apps Script editor

---

## Menu System

**File:** [`MenuSakura.gs`](SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/MenuSakura.gs)

```
Shift Report
├── Send Nightly Report             ← NO password required
├── Send Test Report                ← password-gated
├── Open Export Dashboard           ← no password
├── ────────────────
└── Admin Tools ▸                   ← all items password-gated
    ├── Weekly Rollover (In-Place) ▸
    │   ├── Open Rollover Wizard          ← Mar 6 (Phase 2)
    │   ├── Run Rollover Now
    │   ├── Preview Rollover (Dry Run)
    │   └── Open Rollover Settings
    ├── Integrations & Analytics ▸
    │   ├── Test Integrations Now
    │   ├── Validate All Systems
    │   ├── Rebuild All Dashboards (Admin)        ← Apr 2 (consolidates separate builders)
    │   └── Open Analytics
    ├── Data Warehouse ▸
    │   ├── Backfill This Sheet to Warehouse
    │   └── Setup Weekly Backfill Trigger
    ├── Weekly Digest ▸
    │   ├── Send Revenue Digest (LIVE)
    │   ├── Send Revenue Digest (TEST)
    │   └── Setup Monday Digest Trigger
    └── Setup & Diagnostics ▸
        ├── Check Named Ranges (This Sheet)
        ├── Check Named Ranges (ALL Sheets)
        ├── Create Named Ranges (This Sheet)
        ├── Create Named Ranges (ALL Sheets)
        ├── Force Update Named Ranges (ALL Sheets)
        └── Test Task Push to Actionables
```

**Password Protection (Shift Reports menu):**
```javascript
// Password read from Script Properties (NOT hardcoded)
function getMenuPassword_() {
  return PropertiesService.getScriptProperties().getProperty('MENU_PASSWORD');
}
```

**Note:** The Task Management sheet (`Menu_Updated_Sakura.gs`) reads the admin password from Script Properties via `getMenuPassword_()` at line 19 — property key: `MENU_PASSWORD` (Sakura Actionables Sheet project).

---

## Common Operations

### Fix Missing Named Ranges

```
Menu → Admin Tools → Setup & Diagnostics → Create Named Ranges (ALL Sheets)
```

or

```javascript
diagnoseNamedRanges()  // Check active sheet
diagnoseAllSheets()    // Check all 6 day sheets
createNamedRangesOnAllSheets()       // Create missing ranges
forceUpdateNamedRangesOnAllSheets()  // Overwrite ALL with current FIELD_CONFIG fallbacks
```

### Test Integrations

```javascript
testIntegrations()       // Test on active sheet
runValidationReport()    // Full system validation
```

### Preview Rollover (Dry Run)

```
Menu → Weekly Rollover (In-Place) → Preview Rollover (Dry Run)
Enter password: chocolateteapot
```

### CLEARABLE_FIELDS (current list in WeeklyRolloverInPlace.gs)

```javascript
CLEARABLE_FIELDS: [
  'mod', 'date', 'fohStaff', 'bohStaff',
  'cashCount', 'cashRecord', 'pettyCashTransactions',
  'netRevenue', 'shiftSummary',
  'todoTasks', 'todoAssignees',  // todoFullRange removed Feb 28
  'cashTips', 'cardTips', 'surchargeTips',
  'productionAmount', 'deposit', 'discounts',
  'guestsOfNote', 'goodNotes', 'issues',
  'kitchenNotes', 'wastageComps', 'maintenance', 'rsaIncidents'
]
// Plus: TODO_SHEET = 'TO-DOs' tab is cleared wholesale (rows 2+)
```

### Add New Field to Clear (Rollover)

```javascript
// 1. Add to FIELD_CONFIG in RunSakura.gs
newField: {
  suffix: "SR_NewField",
  fallback: "B99",
  description: "New field description"
}

// 2. Add to CLEARABLE_FIELDS in WeeklyRolloverInPlace.gs
CLEARABLE_FIELDS: [
  // ... existing fields ...
  'newField'
]
```

---

## Development Guidelines

### When Working on Sakura Code

**1. Always Use Named Range Abstraction:**
```javascript
// ✅ CORRECT
const value = getFieldValue(sheet, 'netRevenue');
setFieldValue(sheet, 'netRevenue', 1234.56);

// ❌ AVOID
const value = sheet.getRange('B54').getValue();  // Hardcoded cell
```

**2. Clear Content Correctly:**
```javascript
// ✅ CORRECT - Preserves named ranges
range.clearContent();

// ❌ WRONG - Destroys named ranges
range.clear();
```

**3. Use Venue Configuration:**
```javascript
const config = getVenueConfig_();
if (config.ranges.usesNamedRanges) {
  // Use named range system
}
```

**4. Deployment workflow (clasp push + git push):**
```
1. git checkout sakura/develop        # Ensure correct branch
2. Edit code locally
3. clasp push                         # Deploy to Google Apps Script (production)
4. git add "SAKURA HOUSE/..." && git commit -m "deploy: Sakura SR — description"
5. git push origin sakura/develop     # Push to GitHub (independent of clasp)
```
Branches: `sakura/develop` for ongoing work, `sakura/*` for features. Never push directly to `main`.
Note: `_SETUP_*` files are gitignored (they contain Slack webhook secrets). `.clasp.json` and `.clasprc.json` are also excluded.

---

## Testing Checklist

- [ ] Test on COPY of working file (never test on production)
- [ ] Run preview/dry run mode if available
- [ ] Check Apps Script logs for errors
- [ ] Verify named ranges still work after data clearing
- [ ] Test menu functionality
- [ ] Confirm Slack notifications send correctly
- [ ] Validate data warehouse writes

---

## Quick Reference

**Working File:** "Sakura House - Current Week" (after rollover deployed)

**Archive Root:** ID `1a1AbJN4qU7Lt2oyYPxiTn3kG5EEKOf1K`

**Data Warehouse:** ID `1T4WwoedgSdT1MNWJwxPCC_eG9MmU54YE1VYDdjcRzDk`

**Admin Password:** Read from Script Properties (`MENU_PASSWORD`) in both the Shift Reports menu and the Task Management menu (`Menu_Updated_Sakura.gs`) — validated via `getMenuPassword_()` ✅

**Operating Days:** 6 days (Monday-Saturday, closed Sundays)

**Timezone:** Australia/Sydney

---

## Resources

- **Shift Report Workflow:** [`WORKFLOW_SHIFT_REPORTS.md`](docs/_archive/WORKFLOW_SHIFT_REPORTS.md) (archived, local only — not in git)
- **Task Management Workflow:** [`WORKFLOW_TASK_MANAGEMENT.md`](docs/_archive/WORKFLOW_TASK_MANAGEMENT.md) (archived, local only — not in git)
- **Shared Architecture:** See `CLAUDE_SHARED.md` for patterns used by both venues
- **Waratah Comparison:** See `CLAUDE_WARATAH.md` for named range + hardcoded cell system

---

**Last Updated:** April 2, 2026
**Total LOC:** ~14,996 lines across 22 .gs + 4 .html files (2 GAS script projects: Shift Reports + Task Management)
