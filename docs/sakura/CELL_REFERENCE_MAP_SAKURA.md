# SAKURA HOUSE - Cell Reference Map

**Last Updated:** March 18, 2026
**Type:** Authoritative Reference
**Purpose:** Complete mapping of named ranges and fallback cell references for all Sakura day sheets

---

## Overview

> This document is the single source of truth for where every piece of data lives in the Sakura House daily shift report sheets. Unlike The Waratah (which uses hardcoded cell addresses), Sakura uses named ranges — so if the sheet layout changes, the ranges follow. If you need to know which cell holds Net Revenue or where the shift summary text goes, look it up here.

Sakura House uses **named ranges** (not hardcoded cells like The Waratah). Each field is accessed via `getFieldRange(sheet, fieldKey)` which resolves a named range first, then falls back to a hardcoded cell if the range is missing.

**Sheet Names:** MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY (6 days, closed Sundays)

**Named Range Convention:** `{DAY}_SR_{Suffix}`
- Examples: `MONDAY_SR_Date`, `TUESDAY_SR_NetRevenue`, `FRIDAY_SR_ShiftSummary`

---

## Complete Field Reference Map

> Every field used by the automation scripts, grouped by section. The "Named Range Suffix" column shows the suffix used in the `{DAY}_SR_{Suffix}` convention. The "Fallback Cell" is where the script looks if the named range is missing.

### Header Information

> The top of each day sheet — date, manager on duty, and FOH/BOH staff rostered for that shift.

| Field Key | Named Range Suffix | Fallback Cell | Description |
|-----------|-------------------|---------------|-------------|
| `date` | `SR_Date` | `B3:D3` | Report date (merged cell) |
| `mod` | `SR_MOD` | `B4:D4` | Manager on Duty (merged cell) |
| `fohStaff` | `SR_FOHStaff` | `B6:D6` | FOH staff on shift |
| `bohStaff` | `SR_BOHStaff` | `B7:D7` | BOH staff on shift |

### Cash Section

> Where staff record the physical cash count, cash totals, and any petty cash transactions from the shift.

| Field Key | Named Range Suffix | Fallback Cell | Description |
|-----------|-------------------|---------------|-------------|
| `cashCount` | `SR_CashCount` | `C10:E17` | Cash count breakdown |
| `cashRecord` | `SR_CashRecord` | `C22:D23` | Cash record totals |
| `pettyCashTransactions` | `SR_PettyCashTransactions` | `B40:B45` | Petty cash transactions |

### Financial Metrics

> The headline money numbers — net revenue, tips breakdown, production amount, deposits, and discounts. Net Revenue (B54) is a formula cell and must never be cleared during rollover.

| Field Key | Named Range Suffix | Fallback Cell | Description |
|-----------|-------------------|---------------|-------------|
| `netRevenue` | `SR_NetRevenue` | `B54` | Net revenue less tips & accounts (**`isFormula: true` — protected, never cleared**) |
| `cashTips` | `SR_CashTips` | `C29` | Tips - Cash |
| `cardTips` | `SR_CardTips` | `C30` | Tips - Card |
| `surchargeTips` | `SR_SurchargeTips` | `C31` | Tips - Surcharge |
| `productionAmount` | `SR_ProductionAmount` | `B37` | Production amount (from Lightspeed) |
| `deposit` | `SR_Deposit` | `B38` | Deposit / revenue outside Lightspeed |
| `discounts` | `SR_Discounts` | `B50` | Total discounts (from Lightspeed) |

**Warehouse-only fields (not in FIELD_CONFIG — read by direct cell reference):**

> These two cells are read directly by `extractShiftData_()` for the data warehouse. They aren't part of the named range system because they're formula cells that don't need clearing.

| Cell | Description | Notes |
|------|-------------|-------|
| `C19` | Cash Total | Sum of cash count section |
| `C32` | Tips Total | Formula: C29 + C30 + C31 |

### Shift Report & Narrative Fields

> Free-text sections where the MOD writes about the shift — what happened, VIPs, good/bad highlights, kitchen notes. These cells are merged A:D on Sakura (unlike Waratah's A:F merge).

| Field Key | Named Range Suffix | Fallback Cell | Description |
|-----------|-------------------|---------------|-------------|
| `shiftSummary` | `SR_ShiftSummary` | `A59:D59` | General overview / shift summary |
| `guestsOfNote` | `SR_GuestsOfNote` | `A61:D61` | VIPs, regulars |
| `goodNotes` | `SR_GoodNotes` | `A63:D63` | Good notes - positive feedback |
| `issues` | `SR_Issues` | `A65:D65` | Issues / improvements |
| `kitchenNotes` | `SR_KitchenNotes` | `A67:D67` | Kitchen notes (from chef) |

### To-Do Tasks (16 rows: 69-84)

> Up to 16 tasks the MOD can assign during a shift. Each task has a description (columns A-C merged) and a staff member allocation in column D. Sakura has more task slots than Waratah (16 vs 9).

| Field Key | Named Range Suffix | Fallback Cell | Description |
|-----------|-------------------|---------------|-------------|
| `todoTasks` | `SR_TodoTasks` | `A69:A84` | To-do task descriptions (merged A:C — value in col A) |
| `todoAssignees` | `SR_TodoAssignees` | `D69:D84` | To-do assignee dropdowns |

**Note:** `todoFullRange` was removed Feb 2026 — it was defined but never read by any production function.

### Incidents & Maintenance

> Where staff record any wastage, maintenance issues, and RSA (Responsible Service of Alcohol) incidents from the shift.

| Field Key | Named Range Suffix | Fallback Cell | Description |
|-----------|-------------------|---------------|-------------|
| `wastageComps` | `SR_WastageComps` | `A86:D86` | Wastage / comps / discounts |
| `maintenance` | `SR_Maintenance` | `A88:D88` | Maintenance items |
| `rsaIncidents` | `SR_RSAIncidents` | `A90:D90` | RSA / intox / refusals |

---

## Named Range Resolution

> How the code finds data on the sheet. It first tries the named range (e.g. `MONDAY_SR_NetRevenue`); if that's missing, it falls back to the hardcoded cell address. This means the system keeps working even if named ranges get accidentally deleted.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/RunSakura.gs`

```javascript
function getFieldRange(sheet, fieldKey) {
  const config = FIELD_CONFIG[fieldKey];
  const dayPrefix = extractDayPrefix(sheet.getName());  // "MONDAY", "TUESDAY", etc.
  const namedRangeName = `${dayPrefix}_${config.suffix}`;

  try {
    const namedRange = spreadsheet.getRangeByName(namedRangeName);
    if (namedRange) return namedRange;  // ✅ Found named range
  } catch (e) { }

  // ⚠️ Fallback to hardcoded cell
  Logger.log(`Named Range "${namedRangeName}" not found. Using fallback: ${config.fallback}`);
  return sheet.getRange(config.fallback);
}
```

**Helper functions:**

> These are the functions other scripts call to read and write data. They all go through `getFieldRange()` so they automatically use named ranges with fallback.

```javascript
getFieldValue(sheet, fieldKey)         // Raw value (useful for dates, numbers)
getFieldDisplayValue(sheet, fieldKey)  // Formatted display value (useful for text)
getFieldValues(sheet, fieldKey)        // 2D array for multi-cell ranges
```

---

## VenueConfigSakura.gs Mapping

> How the venue config file declares that Sakura uses named ranges. This flag is what tells the rest of the codebase to use `getFieldRange()` instead of direct cell addresses.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/VenueConfigSakura.gs`

```javascript
ranges: {
  usesNamedRanges: true,  // ✅ Uses named range system

  // Keys match FIELD_CONFIG suffixes in RunSakura.gs
  todoTasks:    'SR_TodoTasks',
  todoAssignees: 'SR_TodoAssignees',
  date:         'SR_Date',
  mod:          'SR_MOD',
  netRevenue:   'SR_NetRevenue',
  shiftSummary: 'SR_ShiftSummary',
}
```

---

## Rollover Clearable Fields

> Which fields get wiped clean during the weekly rollover. Only input cells are cleared — formula cells (like Net Revenue), formatting, and named ranges are preserved. `netRevenue` is excluded automatically via `isFormula: true` in FIELD_CONFIG.

**File:** `SAKURA HOUSE/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.gs`

The clearable list is derived from `getAllFieldKeys_()` in `RunSakura.gs`, which filters out all `isFormula: true` entries:

```javascript
// RunSakura.gs
function getAllFieldKeys_() {
  return Object.keys(FIELD_CONFIG).filter(key => !FIELD_CONFIG[key].isFormula);
}
// → all 27 fields except 'netRevenue' (B54)
```

```javascript
// Effective clearable list (26 fields):
['mod', 'date', 'fohStaff', 'bohStaff',
 'cashCount', 'cashRecord', 'pettyCashTransactions',
 'cashTips', 'cardTips', 'surchargeTips',
 'productionAmount', 'deposit', 'discounts',
 'shiftSummary',
 'todoTasks', 'todoAssignees',
 'guestsOfNote', 'goodNotes', 'issues',
 'kitchenNotes', 'wastageComps', 'maintenance', 'rsaIncidents']
// Plus: TO-DOs tab is cleared wholesale (rows 2+)
// netRevenue (B54) is excluded — isFormula: true
```

### CRITICAL: Named Range Preservation

> The most important rule for Sakura's rollover. Using `clearContent()` preserves the named ranges so scripts keep working next week. Using `clear()` would destroy them, breaking every script in the system.

- **`clearContent()`** — only removes values. Named ranges, formatting, validation all survive. **Always use this.**
- **`clear()`** — removes EVERYTHING including named ranges. **Never use this.**
- After rollover, `verifyAndFixNamedRanges_()` runs as a self-healing step to recreate any that got lost.

---

## Sheet Protection

Protects structural cells (headers, labels, formula cells) while keeping all input fields editable. Implemented in `RunSakura.gs`.

**Mode:** `setWarningOnly(true)` — staff see a warning if they accidentally edit protected cells but are not hard-blocked. GAS scripts (rollover, exports) always have full write access.

**Editable ranges:** All `FIELD_CONFIG` entries where `isFormula: false` (26 fields). `netRevenue` (B54) is protected.

**Menu:** `Shift Report → Admin Tools → Set Up & Diagnostics → Sheet Protection`
- `Apply Protection (All Sheets)` — calls `setupAllSheetsProtection()`
- `Remove Protection (All Sheets)` — calls `removeAllSheetsProtection()`

**Functions in RunSakura.gs:**
```javascript
setupSheetProtection_(sheet)     // protect one sheet; carve out 26 input ranges
setupAllSheetsProtection()       // menu-callable; loops all 6 day sheets
removeAllSheetsProtection()      // menu-callable; removes all protections
getAllFieldKeys_()                // returns non-formula field keys for editable range list
```

---

## Data Warehouse Schema (NIGHTLY_FINANCIAL, 13 cols A-M)

> The column layout of the main financial data warehouse sheet. Every night's shift data gets written here as one row, creating a running history of all financial activity.

```
A=Date, B=Day, C=WeekEnding, D=MOD, E=NetRevenue,
F=CashTotal (C19), G=CashTips (C29), H=TipsTotal (C32),
I=LoggedAt, J=TotalTips (computed), K=ProductionAmount,
L=Discounts, M=Deposit
```

**Duplicate key:** Date (A) + MOD (D)

---

## Quick Lookup Table

> A comprehensive cheat sheet — for every field, you can see its named range suffix, fallback cell, whether it's sent to the data warehouse, and whether the weekly rollover clears it.

| Field | Suffix | Fallback | Warehoused | Cleared in Rollover |
|-------|--------|----------|------------|---------------------|
| Date | SR_Date | B3:D3 | Yes (col A) | Yes (updated to next week) |
| MOD | SR_MOD | B4:D4 | Yes (col D) | Yes |
| FOH Staff | SR_FOHStaff | B6:D6 | No | Yes |
| BOH Staff | SR_BOHStaff | B7:D7 | No | Yes |
| Cash Count | SR_CashCount | C10:E17 | No | Yes |
| Cash Record | SR_CashRecord | C22:D23 | No | Yes |
| Cash Total | — (direct C19) | C19 | Yes (col F) | No (formula) |
| Cash Tips | SR_CashTips | C29 | Yes (col G) | Yes |
| Card Tips | SR_CardTips | C30 | No (in computed total) | Yes |
| Surcharge Tips | SR_SurchargeTips | C31 | No (in computed total) | Yes |
| Tips Total | — (direct C32) | C32 | Yes (col H) | No (formula) |
| Total Tips | — (computed) | — | Yes (col J) | — |
| Production Amount | SR_ProductionAmount | B37 | Yes (col K) | Yes |
| Deposit | SR_Deposit | B38 | Yes (col M) | Yes |
| Petty Cash | SR_PettyCashTransactions | B40:B45 | No | Yes |
| Discounts | SR_Discounts | B50 | Yes (col L) | Yes |
| Net Revenue | SR_NetRevenue | B54 | Yes (col E) | No (formula) |
| Shift Summary | SR_ShiftSummary | A59:D59 | Yes (qual) | Yes |
| Guests of Note | SR_GuestsOfNote | A61:D61 | Yes (qual) | Yes |
| Good Notes | SR_GoodNotes | A63:D63 | Yes (qual) | Yes |
| Issues | SR_Issues | A65:D65 | Yes (qual) | Yes |
| Kitchen Notes | SR_KitchenNotes | A67:D67 | Yes (qual) | Yes |
| TODO Tasks | SR_TodoTasks | A69:A84 | Yes (events) | Yes |
| TODO Assignees | SR_TodoAssignees | D69:D84 | Yes (events) | Yes |
| Wastage/Comps | SR_WastageComps | A86:D86 | Yes (wastage) | Yes |
| Maintenance | SR_Maintenance | A88:D88 | Yes (qual) | Yes |
| RSA/Incidents | SR_RSAIncidents | A90:D90 | Yes (qual) | Yes |

---

## Comparison with The Waratah

> How Sakura House's approach differs from The Waratah. Sakura uses named ranges (like `MONDAY_SR_NetRevenue`) that survive layout changes, while Waratah uses direct cell addresses (like `B34`). Each has trade-offs around flexibility and maintenance.

| Aspect | Sakura House | The Waratah |
|--------|-------------|-------------|
| **Cell Strategy** | Named ranges (`MONDAY_SR_NetRevenue`) | Hardcoded (`B34`) |
| **Flexibility** | Higher (ranges follow cell moves) | Lower (cells hardcoded) |
| **Maintenance** | Complex (range management required) | Simpler (direct references) |
| **Risk** | Range deletion breaks scripts | Cell movement breaks scripts |
| **Self-Healing** | `verifyAndFixNamedRanges_()` after rollover | None needed |
| **Abstraction** | Via `getFieldRange()` in RunSakura.gs | Via `VenueConfig.js` |
| **Merge Pattern** | Merged A:D (4 columns) | Merged A:F (6 columns) |
| **Task Slots** | 16 (rows 69-84) | 9 (rows 53-61) |
| **Operating Days** | 6 (Mon-Sat) | 5 (Wed-Sun) |
| **Unique Fields** | `fohStaff`, `bohStaff`, `cashCount`, `cashRecord`, `pettyCashTransactions`, `goodNotes`, `maintenance` | Financial breakdown (B15-B29), Covers, Labor |

---

**Last Updated:** March 18, 2026
**Key Insight:** All narrative cells are merged A:D — always clear via the named range (which targets column A), never directly from B:D
