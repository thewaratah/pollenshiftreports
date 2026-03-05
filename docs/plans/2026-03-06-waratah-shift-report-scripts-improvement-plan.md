---
title: Waratah Shift Report Scripts — Improvement Plan
type: enhancement
date: 2026-03-06
venue: The Waratah
scope: THE WARATAH/SHIFT REPORT SCRIPTS/ (16 .js + 4 .html, ~6,200 LOC)
---

# Waratah Shift Report Scripts — Improvement Plan

## Overview

Deep analysis of the Waratah Shift Report Scripts codebase to identify bugs, performance issues, expansion opportunities, and integration pathways. This plan covers the complete system: nightly export pipeline, data warehouse integration, weekly rollover, analytics dashboards, Slack notifications, and UI dialogs.

The system is production-ready and stable. These improvements are about expanding its capability, closing gaps in data capture, hardening error handling, and opening new integration pathways.

---

## Phase 0: Critical Bug Fixes (Do First)

Three confirmed bugs that should be fixed before any feature work.

### 0.1 Rollover Failure Notification Missing

**File:** `WeeklyRolloverInPlace.js:187-202`
**Bug:** When `performWeeklyRollover()` fails in trigger context, the catch block only logs the error and re-throws. No Slack notification is sent to Evan. In menu context the UI alert works, but in the Monday 10am trigger context, the `getUi()` call is caught and swallowed — the error disappears silently.

**Fix:** Add a Slack error notification in the catch block (same pattern used by `sendWeeklyRevenueDigest_Waratah`):
```javascript
// In the catch block, before throw:
try {
  const testWebhook = PropertiesService.getScriptProperties()
    .getProperty('WARATAH_SLACK_WEBHOOK_TEST');
  if (testWebhook) {
    UrlFetchApp.fetch(testWebhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        text: '❌ Weekly Rollover FAILED: ' + error.message
      }),
      muteHttpExceptions: true
    });
  }
} catch (slackErr) {
  Logger.log('Slack error notification failed: ' + slackErr.message);
}
```

**Impact:** High — a silent rollover failure means no archive, no date update, and nobody knows until the next manager opens the sheet.

---

### 0.2 Rollover Email Recipients Parsing

**File:** `WeeklyRolloverInPlace.js:616`
**Bug:** `sendRolloverNotifications_()` reads `WARATAH_EMAIL_RECIPIENTS` as a raw string and passes it directly to `GmailApp.sendEmail()`. But the property contains a JSON object (`{"email":"Name",...}`). The email `To:` field receives the entire JSON blob as a string, which GmailApp may reject or send to an undeliverable address.

**Fix:** Parse the JSON and extract email addresses:
```javascript
const recipientsProp = scriptProps.getProperty('WARATAH_EMAIL_RECIPIENTS') || '';
let emailTo;
try {
  const recipientsMap = JSON.parse(recipientsProp);
  emailTo = Object.keys(recipientsMap).join(',');
} catch (e) {
  emailTo = recipientsProp; // fallback to raw string
}
```

**Impact:** Medium — rollover emails may silently fail or be malformed.

---

### 0.3 Dead Code in UIServer.js — executeRollover()

**File:** `UIServer.js:128-159`
**Bug:** `executeRollover()` calls `findCurrentReport_Rollover_()`, `generateWeekSummary_Rollover_()`, `archiveReport_Rollover_()`, `duplicateAndRenameSheet()`, and `sendRolloverNotification_Rollover_()` — none of which exist. These are from the old duplication-based rollover system. If the rollover wizard HTML calls this function, it throws a `ReferenceError`.

**Fix:** Either:
- (A) Delete the function entirely and update `rollover-wizard.html` to call `performWeeklyRollover()` directly, OR
- (B) Rewrite `executeRollover()` as a thin wrapper around `performWeeklyRollover()` that catches errors and returns a result object for the React UI

Option B is better because it preserves the React dialog's ability to show success/error feedback:
```javascript
function executeRollover() {
  try {
    var startTime = new Date();
    performWeeklyRollover();
    var duration = ((new Date()) - startTime) / 1000;
    return {
      success: true,
      message: 'Rollover completed in ' + duration.toFixed(1) + 's.'
    };
  } catch (e) {
    Logger.log('Rollover from UI failed: ' + e.message);
    return { success: false, message: e.message || String(e) };
  }
}
```

**Impact:** High — the rollover wizard dialog is broken if used.

---

## Phase 1: Performance & Code Quality

### 1.1 Batch Cell Reads in extractShiftData_()

**File:** `IntegrationHub.js:188-359`
**Current:** Makes 25+ individual `sheet.getRange().getValue()` calls, each wrapped in its own try/catch. Each call is a separate Apps Script API round-trip.

**Improvement:** Read the entire data range in one call and extract values by position:
```javascript
// Read B3:B39 in one batch (covers all financial cells)
const financialValues = sheet.getRange('B3:B39').getValues();
// Read narrative cells (odd rows merged A:F)
const narrativeValues = sheet.getRange('A43:A65').getValues();
// Read TO-DOs
const todoValues = sheet.getRange('A53:F61').getValues();
```

Then map values by row index instead of individual API calls. This reduces ~30 API calls to ~3.

**Impact:** Significant — each `getRange().getValue()` takes ~100-200ms in GAS. Batching could save 3-5 seconds per export.

**Risk:** Low — the cell positions are fixed and well-documented. Unit-testable with `TEST_DataExtractionVerification.js`.

---

### 1.2 Consolidate Error Notification Pattern

**Current:** Some files send Slack error notifications on failure (WeeklyDigestWaratah.js), some don't (WeeklyRolloverInPlace.js), and each uses a slightly different pattern.

**Improvement:** Create a shared `notifyError_(functionName, error)` utility:
```javascript
function notifyError_(functionName, error) {
  Logger.log('❌ ' + functionName + ' failed: ' + error.message);
  try {
    const webhook = PropertiesService.getScriptProperties()
      .getProperty('WARATAH_SLACK_WEBHOOK_TEST');
    if (webhook) {
      UrlFetchApp.fetch(webhook, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          text: '❌ ' + functionName + ' FAILED: ' + error.message
        }),
        muteHttpExceptions: true
      });
    }
  } catch (e) {
    Logger.log('Error notification also failed: ' + e.message);
  }
}
```

Add to: `SlackBlockKitWaratahSR.js` (since it's already the Slack foundation layer).

**Apply to:** All trigger-eligible functions: `performWeeklyRollover()`, `sendWeeklyRevenueDigest_Waratah()`, `runWeeklyBackfill_()`.

---

### 1.3 Activate Weekly Digest Trigger

**Current:** `setupWeeklyDigestTrigger_Waratah()` exists but the trigger has never been installed. The Monday 9am digest only runs when manually triggered from the menu.

**Fix:** Run `setupWeeklyDigestTrigger_Waratah()` from the Apps Script editor or menu. No code change needed — just activation.

---

## Phase 2: Data Capture Expansion

The shift report spreadsheet collects data in 7 cells that are currently NOT warehoused. These represent business intelligence that's being thrown away every rollover.

### 2.1 Warehouse the Un-Captured Fields

| Cell | Field | Current State | Value of Capturing |
|------|-------|---------------|-------------------|
| B9:B10 | Deposit | Cleared on rollover, lost | Cash flow reconciliation |
| B11 | Airbnb Covers | Cleared on rollover, lost | Channel performance tracking |
| B13:B14 | Cancellations | Cleared on rollover, lost | Revenue impact analysis |
| B30 | Petty Cash | Cleared on rollover, lost | Cash management oversight |
| B36 | Covers | Cleared on rollover, lost | Per-head revenue calculation |
| B38 | Labour Hours | Formula, preserved but not logged | Labour cost ratio analysis |
| B39 | Labour Cost | Formula, preserved but not logged | Profitability metrics |

**Implementation:**
1. Extend NIGHTLY_FINANCIAL schema from 22 to 29 columns (W through AC):
   - W: Deposit, X: AirbnbCovers, Y: Cancellations, Z: PettyCash
   - AA: Covers, AB: LabourHours, AC: LabourCost
2. Update `extractShiftData_()` in IntegrationHub.js to read these cells
3. Update `logToDataWarehouse_()` to append the new columns
4. Update `AnalyticsDashboard.js` to include new metrics (covers-based analytics, labour ratios)
5. Update `WeeklyDigestWaratah.js` to include covers and labour in the weekly digest

**New Analytics Unlocked:**
- **Revenue per cover** (net revenue / covers) — the most important hospitality KPI
- **Labour cost ratio** (labour cost / net revenue) — profitability indicator
- **Covers trend** — demand tracking over time
- **Cancellation rate** — revenue leakage indicator
- **Airbnb channel contribution** — multi-channel performance

---

### 2.2 Revenue Per Cover in Weekly Digest

Once covers are warehoused, add to `buildWeeklyDigestBlocks_Waratah_()`:
- Revenue per cover (this week vs last week)
- Covers trend (this week vs last week)
- Best revenue-per-cover day

This is the single most valuable metric a hospitality manager can track.

---

### 2.3 Labour Cost Dashboard Section

Once labour hours and cost are warehoused, add a section to the Financial Dashboard:
- Labour cost as % of revenue (target: 28-32%)
- Labour cost trend (weekly)
- Labour hours per cover
- Flagging when labour cost exceeds threshold

---

## Phase 3: Enhanced Analytics & Intelligence

### 3.1 Operational Analytics Dashboard

**Current gap:** The Financial Dashboard and Executive Dashboard focus entirely on revenue/financial metrics. There's no dashboard for operational data — tasks, incidents, narrative patterns.

**New dashboard: OPERATIONAL_ANALYTICS tab in the warehouse**

Sections:
- **Task Pipeline:** Tasks created per week, completion rate, avg days to close (from OPERATIONAL_EVENTS)
- **Incident Tracking:** Wastage/comps frequency and pattern (from WASTAGE_COMPS)
- **RSA Incident Log:** RSA event timeline for compliance (from QUALITATIVE_LOG)
- **Staff Workload:** Tasks by assignee, completion rates per person
- **Recurring Issues:** Pattern detection — which types of issues recur?

Build as formula-driven dashboard (like the existing ones) so it auto-updates.

---

### 3.2 Monthly Performance Report

**Current gap:** Weekly digest exists but no monthly summary.

**New function: `sendMonthlyPerformanceReport_Waratah()`**

Content:
- Month total revenue vs previous month vs same month last year
- Revenue per cover (monthly)
- Labour cost ratio (monthly)
- Best/worst performing days and MODs
- Task completion rate for the month
- Incident summary
- Trend arrows for all key metrics

**Trigger:** First Wednesday of each month at 9am
**Delivery:** Slack Block Kit message + PDF attachment via email

---

### 3.3 MOD Performance Tracking

**Current:** The Executive Dashboard has MOD performance formulas but the section was removed because "user deleted rows 31+ from the sheet" (noted in AnalyticsDashboard.js:175).

**Improvement:** Rebuild MOD performance as its own dedicated tab:
- Average revenue per MOD
- Average tips per MOD
- Shift count per MOD
- Revenue trend per MOD (last 4 weeks)
- Ranking table

This avoids the conflict with the user's row deletions by using a separate sheet.

---

### 3.4 Day-of-Week Performance Analysis

**Current:** The Financial Dashboard has day-of-week averages but only as a simple row.

**Improvement:** Expand to a dedicated section:
- Average revenue by day of week (Wed, Thu, Fri, Sat, Sun)
- Average covers by day of week
- Average revenue per cover by day of week
- Best MOD by day of week
- Seasonal trends (same day, different months)

This helps with staffing decisions, marketing targeting, and event planning.

---

## Phase 4: Integration Expansion

### 4.1 Deputy API Integration (Rostering + Timesheets)

**Evidence of opportunity:** The pre-export checklist dialog (`checklist-dialog.html:94`) already references "Deputy Timesheets Approved" as a manual checkbox. Deputy is a rostering/timesheet platform used in Australian hospitality.

**Integration scope:**
1. **Read rostered hours** from Deputy API → compare against actual labour hours in B38
2. **Read timesheet data** → auto-populate labour hours/cost instead of formula
3. **Variance alerting** — flag when actual hours exceed rostered hours by >10%
4. **Auto-approval status** — replace the manual checkbox with an API check

**Technical approach:**
- Use `UrlFetchApp` with Deputy API v1 (REST)
- Authentication: API key stored in Script Properties (`DEPUTY_API_KEY`)
- Endpoint: `GET /api/v1/resource/Timesheet` filtered by date
- GAS library: `apps-script-oauth2` if OAuth2 needed (already identified in memory)

**New file:** `DeputyIntegration.js`
**New Script Property:** `DEPUTY_API_KEY`, `DEPUTY_INSTALL_URL`

---

### 4.2 Cash Reconciliation System

**Evidence of opportunity:** `WARATAH_CASH_RECON_FOLDER_ID` already exists as a reserved Script Property but the feature is unbuilt.

**Scope:**
1. Compare cash takings (B15) against POS cash report
2. Track deposit amounts (B9:B10) against bank deposits
3. Flag discrepancies above threshold
4. Weekly cash reconciliation summary
5. Archive reconciliation records

**Implementation:**
- Read POS cash report from a designated Google Sheet or uploaded CSV
- Calculate variance: Expected cash (from POS) vs Actual cash (from shift report)
- Post reconciliation status to Slack
- Store results in a new CASH_RECONCILIATION warehouse tab

---

### 4.3 Slack Interactivity — Two-Way Actions

**Current:** All Slack messages are one-way notifications. Managers can read them but not act on them.

**Expansion:** Add interactive elements to Slack Block Kit messages:

1. **Nightly Export Notification:**
   - "Acknowledge" button → logs that a manager reviewed the report
   - "Flag Issue" button → opens a thread for follow-up

2. **Weekly Task Summary:**
   - "Update Status" buttons on individual tasks → updates task status in Master Actionables
   - "Reassign" button → changes task assignee

3. **Overdue Task Alert:**
   - "Done" button → marks task as completed from Slack
   - "Defer" button → pushes due date by 7 days

**Technical approach:**
- Requires a GAS web app endpoint (doPost) to receive Slack interaction payloads
- Deploy as `Web App` from GAS project settings
- Register the web app URL as Slack's `Request URL` in app settings
- Parse the `action_id` from the payload and route to appropriate handler

**New files:** `SlackInteractivity.js`, `WebApp.js`
**New menu items:** Admin > Setup > Configure Slack Interactivity

---

### 4.4 Cross-System Health Monitor

**Current:** `DiagnoseSlack.js` validates Slack webhooks. `runValidationReport()` validates data extraction. But there's no unified health check.

**New function: `runSystemHealthCheck()`**

Checks:
1. All Script Properties are set and non-empty
2. Slack webhooks are reachable (test POST)
3. Data warehouse is accessible and schema matches
4. Master Actionables spreadsheet is accessible
5. Archive folder exists and is writable
6. All triggers are installed and active
7. Last successful export was within 48 hours
8. Last successful rollover was within 8 days
9. No duplicate dates in NIGHTLY_FINANCIAL

**Output:** Slack Block Kit message with green/red status for each check.
**Trigger:** Daily at 6am (before anything else runs).

---

## Phase 5: UI & UX Improvements

### 5.1 Export Dashboard Enhancements

**Current:** The sidebar shows basic status (MOD, revenue, validation) with LIVE/TEST buttons.

**Improvements:**
- Show last export timestamp and who ran it
- Show which days have been exported this week (checkmarks)
- Show warehouse sync status (last logged date)
- Show task count pending push to Master Actionables
- Progress indicator during export (currently just a spinner)

---

### 5.2 Analytics Viewer Enhancements

**Current:** Bar chart of daily revenue + summary metrics.

**Improvements:**
- Add covers and revenue-per-cover chart (once covers are warehoused)
- Add week-over-week comparison overlay
- Add labour cost ratio indicator
- Allow date range selection (not just current week)
- Add download-as-PDF button for the analytics view

---

### 5.3 Pre-Export Validation Warnings

**Current:** Validation happens at export time. If data is missing, the export still proceeds and warnings are sent to Evan afterward.

**Improvement:** Add real-time validation via `onEdit` trigger:
- When a manager changes a cell, validate the value immediately
- Show cell comments/notes for invalid entries (e.g., "Revenue must be a number")
- Conditional formatting that highlights missing required fields
- A "readiness" indicator in the header showing how many fields are complete

**New file:** `RealtimeValidation.js`
**New trigger:** `onEdit` (installable, not simple)

---

## Phase 6: Future Architecture

### 6.1 Supabase Data Warehouse Migration Path

**Current:** Data warehouse is a Google Sheets spreadsheet. This works but has limitations:
- 10 million cell limit
- Slow formula recalculation at scale
- No SQL querying capability
- No real-time API access

**Future:** Migrate to Supabase (PostgreSQL):
- Structured tables for NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS, WASTAGE_COMPS, QUALITATIVE_LOG
- SQL-based analytics (complex queries, JOINs, window functions)
- REST API for external access
- Real-time subscriptions for live dashboards
- Row-level security for multi-venue access control

**Migration approach:**
1. Dual-write: log to both Sheets and Supabase during transition
2. Verify data parity for 4 weeks
3. Switch analytics to read from Supabase
4. Keep Sheets as a human-readable backup

**GAS integration:** Use `UrlFetchApp` to POST to Supabase REST API.

---

### 6.2 Claude API Integration — AI-Powered Insights

**Current:** All analytics are formula-based. No intelligence layer.

**Potential:**
1. **Shift Narrative Summarization:** When the weekly digest runs, send all 5 days' qualitative notes to Claude API and get a weekly narrative summary
2. **Anomaly Detection:** Feed financial data to Claude and ask it to flag unusual patterns (revenue drops, tip ratio changes, discount spikes)
3. **Trend Commentary:** Auto-generate natural language commentary for the monthly report ("Revenue was up 12% this month, driven primarily by strong Saturday performance...")
4. **Task Prioritization:** Analyze task descriptions and suggest priority levels

**Technical approach:** Claude API calls via `UrlFetchApp` (no SDK in GAS). Must stay within 6-minute execution limit.

**New file:** `ClaudeIntegration.js`
**New Script Property:** `CLAUDE_API_KEY`

---

## Implementation Priority Matrix

| Phase | Effort | Impact | Risk | Priority |
|-------|--------|--------|------|----------|
| 0.1 Rollover failure notification | 15 min | High | None | **DO NOW** |
| 0.2 Email recipients parsing | 15 min | Medium | None | **DO NOW** |
| 0.3 Dead executeRollover() code | 30 min | High | Low | **DO NOW** |
| 1.1 Batch cell reads | 2 hrs | Medium | Low | **Week 1** |
| 1.2 Error notification pattern | 1 hr | Medium | None | **Week 1** |
| 1.3 Activate digest trigger | 5 min | Medium | None | **DO NOW** |
| 2.1 Warehouse un-captured fields | 4 hrs | **High** | Low | **Week 2** |
| 2.2 Revenue per cover in digest | 2 hrs | **High** | None | **Week 2** |
| 2.3 Labour cost dashboard | 3 hrs | High | Low | **Week 2** |
| 3.1 Operational analytics dashboard | 6 hrs | Medium | Low | **Week 3** |
| 3.2 Monthly performance report | 4 hrs | High | Low | **Week 3** |
| 3.3 MOD performance tracking | 3 hrs | Medium | Low | **Week 4** |
| 3.4 Day-of-week analysis | 2 hrs | Medium | None | **Week 4** |
| 4.1 Deputy API integration | 8 hrs | **High** | Medium | **Week 4-5** |
| 4.2 Cash reconciliation | 6 hrs | Medium | Low | **Week 5** |
| 4.3 Slack interactivity | 8 hrs | Medium | Medium | **Week 6** |
| 4.4 System health monitor | 4 hrs | High | None | **Week 3** |
| 5.1 Export dashboard enhancements | 4 hrs | Low | Low | **Week 6** |
| 5.2 Analytics viewer enhancements | 4 hrs | Low | Low | **Week 7** |
| 5.3 Pre-export validation | 6 hrs | Medium | Medium | **Week 7** |
| 6.1 Supabase migration | 20+ hrs | High | High | **Quarter 2** |
| 6.2 Claude API integration | 8 hrs | Medium | Medium | **Quarter 2** |

---

## Acceptance Criteria (Per Phase)

### Phase 0
- [ ] Rollover failures send Slack notification to Evan
- [ ] Rollover emails arrive at correct individual addresses
- [ ] Rollover wizard dialog works without ReferenceError
- [ ] Weekly digest trigger is active

### Phase 1
- [ ] `extractShiftData_()` completes in <2 seconds (down from ~5)
- [ ] All trigger-eligible functions use shared error notification
- [ ] TEST_DataExtractionVerification.js passes after batch read refactor

### Phase 2
- [ ] NIGHTLY_FINANCIAL has 29 columns with all 7 new fields populated
- [ ] Weekly digest includes revenue per cover
- [ ] Financial Dashboard has labour cost ratio section
- [ ] No data lost on rollover — all fields either warehoused or preserved

### Phase 3
- [ ] OPERATIONAL_ANALYTICS dashboard tab exists with live formulas
- [ ] Monthly report sends on first Wednesday of month
- [ ] MOD_PERFORMANCE tab ranks MODs by average revenue

### Phase 4
- [ ] Deputy API returns rostered hours for comparison
- [ ] Cash reconciliation calculates variance and alerts on discrepancy
- [ ] At least one Slack interactive action works end-to-end
- [ ] System health check runs daily and reports status

---

## Files Affected (Summary)

### Modified
- `WeeklyRolloverInPlace.js` — bug fixes (0.1, 0.2)
- `UIServer.js` — dead code fix (0.3)
- `IntegrationHub.js` — batch reads (1.1), new fields (2.1)
- `SlackBlockKitWaratahSR.js` — error notification utility (1.2)
- `WeeklyDigestWaratah.js` — revenue per cover (2.2)
- `AnalyticsDashboard.js` — new dashboard sections (2.3, 3.1, 3.3, 3.4)
- `NightlyExport.js` — validation improvements (5.3)
- `export-dashboard.html` — UI enhancements (5.1)
- `analytics-viewer.html` — UI enhancements (5.2)
- `_SETUP_ScriptProperties.js` — new properties for integrations

### New
- `MonthlyReport.js` — monthly performance report (3.2)
- `DeputyIntegration.js` — Deputy API integration (4.1)
- `CashReconciliation.js` — cash recon system (4.2)
- `SlackInteractivity.js` — two-way Slack actions (4.3)
- `WebApp.js` — GAS web app endpoint for Slack (4.3)
- `SystemHealthCheck.js` — unified health monitor (4.4)
- `RealtimeValidation.js` — onEdit validation (5.3)
- `ClaudeIntegration.js` — AI-powered insights (6.2)

---

*Plan created: March 6, 2026*
*Based on deep analysis of 16 .js + 4 .html files (~6,200 LOC)*
*No Sakura comparison — improvements derived from Waratah's own workflow analysis and code capacity*
