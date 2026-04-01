---
title: Sakura Shift Report Scripts — Waratah Alignment Plan
type: enhancement
date: 2026-03-06
venue: Sakura House
scope: SAKURA HOUSE/SHIFT REPORT SCRIPTS/ (13 .gs + 3 .html, ~5,720 LOC)
reference: THE WARATAH/SHIFT REPORT SCRIPTS/ (16 .js + 4 .html, ~6,300 LOC)
---

# Sakura Shift Report Scripts — Waratah Alignment Plan

## Overview

Bring Sakura House's shift report system to parity with The Waratah's improved codebase. The Waratah received Phase 0+1 improvements on March 6, 2026 (bug fixes, performance, error handling, shared utilities). Sakura needs the same hardening and feature expansions.

**What this plan does NOT change:**
- Sakura's named range system (FIELD_CONFIG + `getFieldValue()`) — this is Sakura's architectural strength and stays
- Operating days (Mon-Sat, 6 days) — venue-specific, correct as-is
- Cell reference conventions — Sakura uses named ranges, Waratah uses hardcoded cells

**What this plan aligns:**
- Error notification patterns
- Data warehouse schema (13 → 22 columns)
- Batch cell read optimisation
- Rollover wizard UI
- Menu structure parity
- Trigger schedule conventions

---

## Gap Analysis Summary

| Feature | Waratah (Current) | Sakura (Current) | Gap |
|---------|-------------------|-------------------|-----|
| `notifyError_()` shared utility | Yes — `SlackBlockKitWaratahSR.js:132` | No — inline per function | **Add** |
| NIGHTLY_FINANCIAL columns | 22 (A-V) | 13 (A-M) | **Expand** |
| Batch cell reads | Yes — 3 batched `getRange().getValues()` | No — individual `getFieldValue()` calls | **Evaluate** |
| Rollover wizard HTML | Yes — `rollover-wizard.html` (React modal) | Removed Feb 16 (was legacy) | **Add back** |
| UIServer functions | 11 functions | 8 functions | **Add 3** |
| Trigger error notifications | All 5 trigger-eligible functions notify | 0 notify | **Add** |
| Menu items | ~25 items | ~22 items | **Add 3** |
| Weekly backfill LockService | Yes + `notifyError_()` catch | Yes (LockService) but no error notification | **Add** |
| Rollover Slack webhook | Uses LIVE webhook | Still on TEST webhook | **Switch** |
| `VenueConfig` abstraction | `VenueConfig.js` with hardcoded cells | `VenueConfigSakura.gs` with named ranges | **Already aligned** |

---

## Phase 0: Shared Error Notification Utility

**Priority:** P0 — Required before all other phases
**Files:** `SlackBlockKitSakuraSR.gs`
**Estimated changes:** ~30 lines added

### 0.1 Add `notifyError_()` to SlackBlockKitSakuraSR.gs

Port the shared error notification utility from Waratah's `SlackBlockKitWaratahSR.js:132-158`.

```javascript
/**
 * Shared Slack error notification — posts to TEST webhook.
 * Call from any catch block in trigger-eligible functions.
 *
 * @param {string} functionName - Name of the calling function
 * @param {Error} error - The caught error object
 */
function notifyError_(functionName, error) {
  try {
    const webhook = PropertiesService.getScriptProperties()
      .getProperty('SAKURA_SLACK_WEBHOOK_TEST');
    if (!webhook) return;

    const payload = {
      text: '❌ *Sakura SR Error*\n' +
            '• Function: `' + functionName + '`\n' +
            '• Error: ' + (error.message || String(error)) + '\n' +
            '• Time: ' + Utilities.formatDate(new Date(), 'Australia/Sydney', 'dd/MM/yyyy HH:mm:ss')
    };

    UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (slackErr) {
    Logger.log('notifyError_ Slack delivery failed: ' + slackErr.message);
  }
}
```

**Why TEST webhook?** Error notifications go to the dev/test channel, not the managers' live channel. Same pattern as Waratah.

### 0.2 Wire `notifyError_()` into all trigger-eligible functions

Add `notifyError_(functionName, e)` to the catch blocks of:

| Function | File | Currently |
|----------|------|-----------|
| `performInPlaceRollover()` | `WeeklyRolloverInPlace.gs` | Logs + re-throws, no Slack |
| `runWeeklyBackfill_()` | `IntegrationHubSakura.gs` | try/finally, no catch at all |
| `sendWeeklyRevenueDigest_Sakura()` | `WeeklyDigestSakura.gs` | Logs + re-throws, no Slack |
| `sendWeeklyTodoSummary()` | `NightlyExportSakura.gs` | Inline 15-line error handler |
| `runScheduledOverdueSummary()` | Task Mgmt (separate project) | Out of scope for SR alignment |

**Pattern for each:**
```javascript
} catch (e) {
  notifyError_('functionName', e);
  Logger.log('functionName error: ' + e.message);
  throw e;  // Re-throw so GAS trigger system marks execution as failed
}
```

For `sendWeeklyTodoSummary()` in NightlyExportSakura.gs — replace the inline 15-line Slack error notification with the single `notifyError_()` call.

---

## Phase 1: Data Warehouse Schema Expansion (13 → 22 columns)

**Priority:** P1 — Brings analytics parity
**Files:** `IntegrationHubSakura.gs`, `AnalyticsDashboardSakura.gs`, `WeeklyDigestSakura.gs`
**Estimated changes:** ~150 lines modified

### 1.1 Expand NIGHTLY_FINANCIAL schema

**Current Sakura (13 columns A-M):**
```
A=Date | B=Day | C=WeekEnding | D=MOD | E=NetRevenue |
F=CashTotal | G=CashTips | H=TipsTotal |
I=LoggedAt | J=TotalTips | K=ProductionAmount | L=Discounts | M=Deposit
```

**Target (22 columns A-V, matching Waratah):**
```
A=Date | B=Day | C=WeekEnding | D=MOD | E=Staff | F=NetRevenue |
G=ProductionAmount | H=CashTakings | I=GrossSalesIncCash |
J=CashReturns | K=CDDiscount | L=Refunds | M=CDRedeem |
N=TotalDiscount | O=DiscountsCompsExcCD | P=GrossTaxableSales |
Q=Taxes | R=NetSalesWTips | S=CardTips | T=CashTips |
U=TotalTips | V=LoggedAt
```

**Key decisions:**
- Sakura's sheet layout has different financial fields than Waratah (e.g. Sakura has `SurchargeTips`, `Deposit`, `CashCount`, `CashRecord` — Waratah has `GrossSalesIncCash`, `CashReturns`, `CDDiscount`, `Refunds`, etc.)
- **Not all 22 Waratah columns have equivalents in Sakura's template** — Sakura doesn't have cells for `GrossSalesIncCash`, `CashReturns`, `CDDiscount`, `Refunds`, `CDRedeem`, `GrossTaxableSales`, `Taxes`, `NetSalesWTips`
- **Recommendation:** Add columns that Sakura CAN populate from its template (Staff, CardTips, CashTips, TotalTips, SurchargeTips — which Waratah doesn't have). Leave Waratah-only columns empty or omit them.

### 1.2 Sakura-specific expanded schema (recommended)

Rather than force-fitting Waratah's Lightspeed POS columns onto Sakura, create a Sakura-appropriate expansion:

```
A=Date | B=Day | C=WeekEnding | D=MOD | E=FOHStaff | F=BOHStaff |
G=NetRevenue | H=ProductionAmount | I=Deposit | J=Discounts |
K=CashTotal | L=CashTips | M=CardTips | N=SurchargeTips |
O=TotalTips | P=LoggedAt
```

**16 columns (A-P) — up from 13, captures all Sakura template data:**
- Adds: E=FOHStaff, F=BOHStaff (Sakura has both, Waratah doesn't)
- Adds: N=SurchargeTips (Sakura-specific field)
- Reorders tips columns for consistency (CardTips, CashTips, SurchargeTips, TotalTips)

### 1.3 Update `extractShiftData_()` in IntegrationHubSakura.gs

Add FOH/BOH staff extraction:
```javascript
const fohStaff = String(getFieldValue(sheet, 'fohStaff') || '').trim();
const bohStaff = String(getFieldValue(sheet, 'bohStaff') || '').trim();
```

Add `surchargeTips` to the return object (already extracted but not returned).

### 1.4 Update `logToFinancialSheet_()` column mapping

Update the row array to match the new 16-column schema.

### 1.5 Update AnalyticsDashboardSakura.gs column references

All column index references (currently E=4 for revenue, J=9 for tips, etc.) need updating to match the new schema positions.

### 1.6 Update WeeklyDigestSakura.gs column references

Revenue column index and tips column index need updating.

---

## Phase 2: Rollover Wizard UI

**Priority:** P2 — UX improvement
**Files:** New `rollover-wizard.html`, `UIServerSakura.gs`, `MenuSakura.gs`
**Estimated changes:** ~250 lines new HTML, ~40 lines .gs

### 2.1 Add rollover-wizard.html

Port from Waratah's `rollover-wizard.html` (React-compiled modal). Adapts:
- Day list: 6 days (Mon-Sat) instead of 5 (Wed-Sun)
- Preview data source: uses `getFieldValue()` named range calls instead of hardcoded cells
- Rollover function: calls `performInPlaceRollover()` (same as Waratah)

The wizard shows:
- Current week summary (MOD, revenue per day)
- Preview of what will be cleared
- Confirm/Cancel buttons
- Progress feedback during rollover execution

### 2.2 Add UIServer functions

Add to `UIServerSakura.gs`:
```javascript
function openRolloverWizard() {
  var html = HtmlService.createHtmlOutputFromFile('rollover-wizard')
    .setWidth(520).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Weekly Rollover');
}

function getRolloverPreviewData() {
  // Return current week summary for the wizard preview
}

function executeRolloverFromWizard() {
  // Thin wrapper around performInPlaceRollover()
}
```

### 2.3 Update MenuSakura.gs

Replace the current rollover menu section:
```
Admin Tools → Weekly Rollover (In-Place) ▸
├── Open Rollover Wizard        ← NEW (opens the React modal)
├── Run Rollover Now            ← keeps as direct-run option
├── Preview Rollover (Dry Run)  ← keeps
└── Open Rollover Settings      ← keeps
```

---

## Phase 3: Rollover Webhook Switch (TEST → LIVE)

**Priority:** P2 — Production readiness
**Files:** `WeeklyRolloverInPlace.gs`
**Estimated changes:** ~5 lines

### 3.1 Switch rollover Slack notification to LIVE webhook

Currently `WeeklyRolloverInPlace.gs` uses `SAKURA_SLACK_WEBHOOK_URL_TEST` for rollover notifications. The system has been in production since March 2, 2026 — this should now use the LIVE webhook so managers see rollover confirmations.

```javascript
// Change from:
const SLACK_WEBHOOK_URL = 'SAKURA_SLACK_WEBHOOK_URL_TEST';
// To:
const SLACK_WEBHOOK_URL = getSakuraSlackWebhookLive_();
```

---

## Phase 4: Trigger Schedule Alignment

**Priority:** P2 — Consistency
**Files:** `WeeklyRolloverInPlace.gs`, `IntegrationHubSakura.gs`, `WeeklyDigestSakura.gs`
**Estimated changes:** ~15 lines

### Current Sakura trigger schedule:
| Function | Current Schedule | Notes |
|----------|-----------------|-------|
| `performInPlaceRollover` | Monday 1am | Set manually in GAS editor |
| `runWeeklyBackfill_` | Not set up? | Needs setup trigger function |
| `sendWeeklyRevenueDigest_Sakura` | Monday 8am | Not yet installed per CLAUDE_SAKURA.md |

### 4.1 Confirm with user

Before changing any trigger times, confirm desired schedule. The Waratah uses:
- Backfill: Mon 8am
- Digest: Mon 9am
- Rollover: Mon 10am

Sakura could follow the same pattern, but rollover at 1am has the advantage of running before business hours. **Recommend keeping Sakura rollover at 1am** and aligning only:
- Backfill: Mon 8am (same as Waratah)
- Digest: Mon 9am (same as Waratah)

### 4.2 Add `setupWeeklyBackfillTrigger_Sakura()` function

IntegrationHubSakura.gs currently has `runWeeklyBackfill_()` but may lack a trigger setup helper. Add one matching Waratah's pattern:

```javascript
function setupWeeklyBackfillTrigger_Sakura() {
  // Remove any existing backfill triggers
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runWeeklyBackfill_') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('runWeeklyBackfill_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  try {
    SpreadsheetApp.getUi().alert('Backfill trigger set: Monday 8am');
  } catch (e) {
    Logger.log('Backfill trigger created (Monday 8am) — UI skipped in trigger context');
  }
}
```

### 4.3 Add trigger setup to menu

```
Admin Tools → Data Warehouse ▸
├── Backfill This Sheet to Warehouse
├── Show Integration Log (Last 30 Days)
└── Setup Weekly Backfill Trigger    ← already exists per CLAUDE_SAKURA.md
```

Verify the existing menu item calls the right function.

---

## Phase 5: Menu Structure Alignment

**Priority:** P3 — Polish
**Files:** `MenuSakura.gs`
**Estimated changes:** ~20 lines

### 5.1 Add missing menu items

Items Waratah has that Sakura is missing:
1. **Open Rollover Wizard** (from Phase 2)
2. **Setup Monday Digest Trigger** — verify this exists in the Weekly Digest submenu
3. **Test Slack Notification** — useful for debugging

### 5.2 Verify password protection consistency

Waratah gates all admin operations behind password. Verify Sakura's `getMenuPassword_()` is consistently applied to all destructive operations.

---

## Phase 6: Performance — Batch Cell Reads (Evaluate)

**Priority:** P3 — Nice to have
**Files:** `IntegrationHubSakura.gs`
**Estimated changes:** ~30 lines if implemented

### 6.1 Evaluation

Waratah batches hardcoded cell reads: `sheet.getRange("B3:B39").getValues()` → single API call for ~30 values.

**Sakura is different:** It uses `getFieldValue(sheet, fieldKey)` which resolves named ranges. Each call is:
1. Look up FIELD_CONFIG for the suffix
2. Try `spreadsheet.getRangeByName(namedRangeName)`
3. If found, `.getValue()`
4. If not, fallback to hardcoded cell

**Batching is harder with named ranges** because:
- Named ranges can point to arbitrary cells (not a contiguous block)
- The fallback path would need batching separately from the named range path
- The named range API doesn't support batch resolution

**Recommendation:** Skip batching for now. The named range overhead is modest (~10-15 API calls for `extractShiftData_`) and the code clarity of `getFieldValue()` is worth preserving. Revisit only if GAS execution time approaches the 6-minute limit.

---

## Implementation Order

```
Phase 0  →  notifyError_() utility + wire into all trigger functions
Phase 1  →  Warehouse schema expansion (13 → 16 cols)
Phase 2  →  Rollover wizard HTML + UIServer functions + menu update
Phase 3  →  Rollover webhook TEST → LIVE
Phase 4  →  Trigger schedule confirmation + setup helpers
Phase 5  →  Menu alignment + password verification
Phase 6  →  Batch reads evaluation (likely skip)
```

**Phases 0-1** are the highest value — they bring error visibility and data parity.
**Phase 2** is the biggest UX win — the rollover wizard gives managers a safe, guided rollover process.
**Phases 3-5** are small but important polish.
**Phase 6** is deprioritised due to Sakura's named range architecture.

---

## Files Modified (Summary)

| File | Phase | Changes |
|------|-------|---------|
| `SlackBlockKitSakuraSR.gs` | 0 | Add `notifyError_()` function |
| `WeeklyRolloverInPlace.gs` | 0, 3 | Wire `notifyError_()`, switch to LIVE webhook |
| `IntegrationHubSakura.gs` | 0, 1, 4 | Wire `notifyError_()`, expand schema, add backfill trigger |
| `WeeklyDigestSakura.gs` | 0, 1 | Wire `notifyError_()`, update column refs |
| `NightlyExportSakura.gs` | 0, 1 | Replace inline error handler, update column refs |
| `AnalyticsDashboardSakura.gs` | 1 | Update column refs for new schema |
| `UIServerSakura.gs` | 2 | Add rollover wizard functions |
| `MenuSakura.gs` | 2, 5 | Add rollover wizard menu item, align structure |
| `rollover-wizard.html` | 2 | New file — React rollover modal |

**New files:** 1 (`rollover-wizard.html`)
**Modified files:** 8

---

## Acceptance Criteria

- [ ] `notifyError_()` exists in `SlackBlockKitSakuraSR.gs` and posts to TEST webhook
- [ ] All 4 trigger-eligible SR functions call `notifyError_()` in their catch blocks
- [ ] NIGHTLY_FINANCIAL schema expanded with FOHStaff, BOHStaff, SurchargeTips columns
- [ ] `extractShiftData_()` returns all new fields
- [ ] Analytics dashboard and weekly digest use correct column indices
- [ ] Rollover wizard HTML works as modal dialog
- [ ] Rollover notifications use LIVE Slack webhook
- [ ] Backfill trigger setup function exists and is accessible from menu
- [ ] All menu items match Waratah structure (adjusted for Sakura context)
- [ ] No named range conventions broken — `getFieldValue()` pattern preserved throughout

---

## Preserves (Do NOT Change)

- **Named range system** — FIELD_CONFIG, `getFieldValue()`, `getFieldValues()`, `setFieldValue()`, `getFieldDisplayValue()`, fallback mechanism
- **6-day operation** — Monday through Saturday, closed Sundays
- **`NightlyBasicExportSakura.gs`** — standalone handover script, no cross-file dependencies
- **FOH/BOH staff split** — Sakura has separate fields; Waratah has one `Staff` field
- **Surcharge tips** — Sakura-specific financial field
- **Cash count / cash record sections** — Sakura-specific template layout
- **Pre-send checklist** — `checklist-dialog.html` already matches Waratah
- **Task management system** — separate project, separate alignment scope

---

## References

- Waratah improvement plan: `docs/plans/2026-03-06-waratah-shift-report-scripts-improvement-plan.md`
- Waratah `notifyError_()`: `THE WARATAH/SHIFT REPORT SCRIPTS/SlackBlockKitWaratahSR.js:132-158`
- Waratah NIGHTLY_FINANCIAL schema: `CLAUDE_WARATAH.md` and `docs/waratah/DEEP_DIVE_ARCHITECTURE.md`
- Sakura FIELD_CONFIG: `SAKURA HOUSE/SHIFT REPORT SCRIPTS/RunSakura.gs:1-345`
- Sakura named range guide: `CLAUDE_SAKURA.md` §Named Range System
