# THE WARATAH - Cell Reference Map

**Last Updated:** April 2, 2026 (Cell reference correction: Total Tips B36, Covers B37)
**Type:** Authoritative Reference
**Purpose:** Complete mapping of cell references for all Waratah day sheets

---

## Overview

The Waratah uses a **named range system** mirroring Sakura House. Cell positions are defined in `FIELD_CONFIG` in `RunWaratah.js` — the single source of truth for all field-to-cell mappings.

**Named range convention:** `{DAY}_SR_{Suffix}` — e.g. `WEDNESDAY_SR_NetRevenue`

All helpers fall back to hardcoded cells automatically when named ranges haven't been created in the spreadsheet yet (graceful degradation). To create named ranges: `Waratah Tools → Admin Tools → Setup & Utilities → Named Ranges → Create on ALL Sheets`.

**Sheet Names:** WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY

**Layout Pattern:** Narrative section uses **odd rows for data**, even rows for labels.
- Row 42 = "SHIFT REPORT" label, Row 43 = shift report data
- Row 44 = "VIP/GUESTS OF NOTE" label, Row 45 = VIP data
- etc.

---

## Complete Cell Reference Map

### Header Information
```
Day Title:      A1:F1     (merged, day name)
Date:           B3:F3     (merged)
MOD:            B4:F4     (merged)
Staff:          B5:F5     (merged)
```

### Financial Metrics (Column B, rows 8-39)
```
Production Amount:     B8
Function/Deposit:      B9:B10
Airbnb:                B11
Cancellation Fees:     B13:B14
Cash Takings:          B15      (formula)
Gross Sales Inc Cash:  B16      (formula)
Cash Returns:          B17:B18  (merged)
CD Discounts:          B19:B20  (merged)
Genuine Refunds:       B21:B22  (merged)
CD Redeem:             B23:B24  (merged)
Total Discounts:       B25      (input)
Discounts Comps Exc CD: B26     (formula)
Gross Taxable Sales:   B27      (formula)
Taxes:                 B28      (formula)
Net Sales w Tips:      B29      (formula)
Petty Cash:            B30
Card Tips:             B32
Cash Tips:             B33
Net Revenue:           B34
Cash Total:            B35      (NOT warehoused)
Total Tips:            B36      (formula)
Covers:                B37      (NOT warehoused)
Labor Hours:           B38      (formula, NOT warehoused)
Labor Cost:            B39      (formula, NOT warehoused)
B36, B38:B39 = FORMULA CELLS — DO NOT CLEAR during rollover
```

### Narrative Fields (merged A:F, odd rows = data)
```
Row 42 = label          Row 43 = SHIFT REPORT data      → A43:F43
Row 44 = label          Row 45 = VIP/GUESTS OF NOTE     → A45:F45
Row 46 = label          Row 47 = THE GOOD               → A47:F47
Row 48 = label          Row 49 = THE BAD                → A49:F49
Row 50 = label          Row 51 = KITCHEN NOTES           → A51:F51
```

### To-Do Tasks (9 rows: 53-61)
```
Task descriptions:     A53:E61   (merged A:E per row, 9 task slots)
Staff allocations:     F53:F61   (one staff name per task)

  Task 1:  A53:E53  |  Staff: F53
  Task 2:  A54:E54  |  Staff: F54
  Task 3:  A55:E55  |  Staff: F55
  Task 4:  A56:E56  |  Staff: F56
  Task 5:  A57:E57  |  Staff: F57
  Task 6:  A58:E58  |  Staff: F58
  Task 7:  A59:E59  |  Staff: F59
  Task 8:  A60:E60  |  Staff: F60
  Task 9:  A61:E61  |  Staff: F61
```

### Wastage & Incidents
```
Row 62 = label          Row 63 = WASTAGE/COMPS           → A63:F63
Row 64 = label          Row 65 = RSA/INJURIES            → A65:F65
```

---

## RunWaratah.js FIELD_CONFIG (Authoritative)

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/RunWaratah.js`

This is the single source of truth. All consumer files call `getFieldValue()`, `getFieldDisplayValue()`, or `getFieldValues()` using these keys. `isFormula: true` entries are excluded from rollover clearing.

| Field Key | Suffix | Fallback Cell | isFormula | Named Range (WEDNESDAY example) |
|-----------|--------|---------------|-----------|--------------------------------|
| `date` | `SR_Date` | `B3:F3` | false | `WEDNESDAY_SR_Date` |
| `mod` | `SR_MOD` | `B4:F4` | false | `WEDNESDAY_SR_MOD` |
| `staff` | `SR_Staff` | `B5:F5` | false | `WEDNESDAY_SR_Staff` |
| `productionAmount` | `SR_ProductionAmount` | `B8` | false | `WEDNESDAY_SR_ProductionAmount` |
| `deposit` | `SR_Deposit` | `B9:B10` | false | `WEDNESDAY_SR_Deposit` |
| `airbnbCovers` | `SR_AirbnbCovers` | `B11` | false | `WEDNESDAY_SR_AirbnbCovers` |
| `cancellations` | `SR_Cancellations` | `B13:B14` | false | `WEDNESDAY_SR_Cancellations` |
| `cashTakings` | `SR_CashTakings` | `B15` | **true** | `WEDNESDAY_SR_CashTakings` |
| `grossSalesIncCash` | `SR_GrossSalesIncCash` | `B16` | **true** | `WEDNESDAY_SR_GrossSalesIncCash` |
| `cashReturns` | `SR_CashReturns` | `B17:B18` | false | `WEDNESDAY_SR_CashReturns` |
| `cdDiscount` | `SR_CDDiscount` | `B19:B20` | false | `WEDNESDAY_SR_CDDiscount` |
| `refunds` | `SR_Refunds` | `B21:B22` | false | `WEDNESDAY_SR_Refunds` |
| `cdRedeem` | `SR_CDRedeem` | `B23:B24` | false | `WEDNESDAY_SR_CDRedeem` |
| `totalDiscount` | `SR_TotalDiscount` | `B25` | false | `WEDNESDAY_SR_TotalDiscount` |
| `discountsCompsExcCD` | `SR_DiscountsCompsExcCD` | `B26` | **true** | `WEDNESDAY_SR_DiscountsCompsExcCD` |
| `grossTaxableSales` | `SR_GrossTaxableSales` | `B27` | **true** | `WEDNESDAY_SR_GrossTaxableSales` |
| `taxes` | `SR_Taxes` | `B28` | **true** | `WEDNESDAY_SR_Taxes` |
| `netSalesWTips` | `SR_NetSalesWTips` | `B29` | **true** | `WEDNESDAY_SR_NetSalesWTips` |
| `pettyCash` | `SR_PettyCash` | `B30` | false | `WEDNESDAY_SR_PettyCash` |
| `cardTips` | `SR_CardTips` | `B32` | false | `WEDNESDAY_SR_CardTips` |
| `cashTips` | `SR_CashTips` | `B33` | false | `WEDNESDAY_SR_CashTips` |
| `netRevenue` | `SR_NetRevenue` | `B34` | **true** | `WEDNESDAY_SR_NetRevenue` |
| `totalTips` | `SR_TotalTips` | `B36` | **true** | `WEDNESDAY_SR_TotalTips` |
| `shiftSummary` | `SR_ShiftSummary` | `A43:F43` | false | `WEDNESDAY_SR_ShiftSummary` |
| `guestsOfNote` | `SR_GuestsOfNote` | `A45:F45` | false | `WEDNESDAY_SR_GuestsOfNote` |
| `theGood` | `SR_TheGood` | `A47:F47` | false | `WEDNESDAY_SR_TheGood` |
| `theBad` | `SR_TheBad` | `A49:F49` | false | `WEDNESDAY_SR_TheBad` |
| `kitchenNotes` | `SR_KitchenNotes` | `A51:F51` | false | `WEDNESDAY_SR_KitchenNotes` |
| `todoTasks` | `SR_TodoTasks` | `A53:E61` | false | `WEDNESDAY_SR_TodoTasks` |
| `todoAssignees` | `SR_TodoAssignees` | `F53:F61` | false | `WEDNESDAY_SR_TodoAssignees` |
| `wastageComps` | `SR_WastageComps` | `A63:F63` | false | `WEDNESDAY_SR_WastageComps` |
| `rsaIncidents` | `SR_RSAIncidents` | `A65:F65` | false | `WEDNESDAY_SR_RSAIncidents` |

**Clearable fields (isFormula: false):** date, mod, staff, productionAmount, deposit, airbnbCovers, cancellations, cashReturns, cdDiscount, refunds, cdRedeem, totalDiscount, pettyCash, cardTips, cashTips, shiftSummary, guestsOfNote, theGood, theBad, kitchenNotes, todoTasks, todoAssignees, wastageComps, rsaIncidents (24 fields)

**Formula cells — never clear:** cashTakings(B15), grossSalesIncCash(B16), discountsCompsExcCD(B26), grossTaxableSales(B27), taxes(B28), netSalesWTips(B29), netRevenue(B34), totalTips(B36) (8 fields)

## VenueConfig.js (Legacy)

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/VenueConfig.js`

`usesNamedRanges: true` — routes through `getFieldValue()` helpers from RunWaratah.js.

---

## Integration Hub Extraction

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/IntegrationHubWaratah.js`

The `extractShiftData_()` function uses **batch reads** (3 GAS API calls) for performance, then maps values against FIELD_CONFIG fallback positions. The batch-read approach was intentionally preserved — individual `getFieldValue()` calls per field would be ~20× more API calls.

```javascript
// BATCH READ 1: Financial data B3:B39
// Maps to FIELD_CONFIG fallback cells (RunWaratah.js is authoritative)
const financialValues = sheet.getRange("B3:B39").getValues();

// BATCH READ 2: Narrative fields A43:A65
const narrativeValues = sheet.getRange("A43:A65").getValues();

// BATCH READ 3: TO-DOs A53:F61 (combined — accesses task + assignee in one call)
const todoValues = sheet.getRange("A53:F61").getValues();
```

**NOT warehoused (ignored):** B35 (Cash Total), B36 (Covers), B38 (Labor Hours), B39 (Labor Cost)

---

## Rollover Clearable Fields

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlaceWaratah.js`

Clearable fields are now derived programmatically from FIELD_CONFIG (no separate list to maintain):

```javascript
// In RunWaratah.js:
function getClearableFieldKeys_() {
  return Object.keys(FIELD_CONFIG).filter(key => !FIELD_CONFIG[key].isFormula);
}

// In WeeklyRolloverInPlaceWaratah.js:
const CLEARABLE_FIELD_KEYS = getClearableFieldKeys_();
// → ['date','mod','staff','productionAmount','deposit','airbnbCovers','cancellations',
//    'cashReturns','cdDiscount','refunds','cdRedeem','totalDiscount','pettyCash',
//    'cardTips','cashTips','shiftSummary','guestsOfNote','theGood','theBad',
//    'kitchenNotes','todoTasks','todoAssignees','wastageComps','rsaIncidents']
```

Formula cells are automatically excluded. No manual list to keep in sync.

### CRITICAL: Merged Cell Clearing

Narrative cells are merged A:F. The value lives in column A of the merge. Using `clearContent()` on `B:F` of a merged `A:F` range does **NOT** clear the value. You **must** target the full merge range starting at column A.

**Wrong:** `sheet.getRange('B43:F43').clearContent()` — does nothing
**Right:** `sheet.getRange('A43:F43').clearContent()` — clears the value

This also applies to TODO tasks which are merged A:E per row.

---

## Data Warehouse Schema (NIGHTLY_FINANCIAL, 22 cols A-V)

```
A=Date, B=Day, C=WeekEnding, D=MOD, E=Staff,
F=NetRevenue, G=ProductionAmount, H=CashTakings,
I=GrossSalesIncCash, J=CashReturns, K=CDDiscount,
L=Refunds, M=CDRedeem, N=TotalDiscount,
O=DiscountsCompsExcCD, P=GrossTaxableSales,
Q=Taxes, R=NetSalesWTips, S=CardTips, T=CashTips,
U=TotalTips, V=LoggedAt
```

---

## Quick Lookup Table

| Field | Cell | Type | Warehoused | Cleared in Rollover |
|-------|------|------|------------|---------------------|
| Day Title | A1:F1 | Text | No | No |
| Date | B3:F3 | Date | Yes (col A) | No (updated) |
| MOD | B4:F4 | Text | Yes (col D) | Yes |
| Staff | B5:F5 | Text | Yes (col E) | Yes |
| Production Amount | B8 | Number | Yes (col G) | No |
| Cash Takings | B15 | Formula | Yes (col H) | No |
| Gross Sales Inc Cash | B16 | Formula | Yes (col I) | No |
| Cash Returns | B17:B18 | Number | Yes (col J) | No |
| CD Discounts | B19:B20 | Number | Yes (col K) | No |
| Refunds | B21:B22 | Number | Yes (col L) | No |
| CD Redeem | B23:B24 | Number | Yes (col M) | No |
| Total Discounts | B25 | Input | Yes (col N) | No |
| Discounts Comps Exc CD | B26 | Formula | Yes (col O) | No |
| Gross Taxable Sales | B27 | Formula | Yes (col P) | No |
| Taxes | B28 | Formula | Yes (col Q) | No |
| Net Sales w Tips | B29 | Formula | Yes (col R) | No |
| Card Tips | B32 | Number | Yes (col S) | Yes |
| Cash Tips | B33 | Number | Yes (col T) | Yes |
| Net Revenue | B34 | Number | Yes (col F) | Yes |
| Cash Total | B35 | Number | No | No |
| Total Tips | B36 | Formula | Yes (col U) | No (formula) |
| Covers | B37 | Number | No | No |
| Labor Hours | B38 | Formula | No | No (formula) |
| Labor Cost | B39 | Formula | No | No (formula) |
| Shift Report | A43:F43 | Text | Yes (col D) | Yes |
| VIP/Guests | A45:F45 | Text | Yes (col E) | Yes |
| The Good | A47:F47 | Text | Yes (col F) | Yes |
| The Bad | A49:F49 | Text | Yes (col G) | Yes |
| Kitchen Notes | A51:F51 | Text | Yes (col H) | Yes |
| TODO Tasks | A53:E61 | Text | Yes (events) | Yes |
| TODO Staff | F53:F61 | Text | Yes (events) | Yes |
| Wastage/Comps | A63:F63 | Text | Yes (wastage) | Yes |
| RSA/Injuries | A65:F65 | Text | Yes (qual) | Yes |

---

## Sheet Protection

Protects structural cells (headers, labels, formula cells) while keeping all input fields editable. Implemented in `RunWaratah.js`.

**Mode:** `setWarningOnly(true)` — staff see a warning if they accidentally edit protected cells but are not hard-blocked. GAS scripts (rollover, exports) always have full write access.

**Editable ranges:** All `FIELD_CONFIG` entries where `isFormula: false` (24 fields). The 8 formula cells are protected: cashTakings(B15), grossSalesIncCash(B16), discountsCompsExcCD(B26), grossTaxableSales(B27), taxes(B28), netSalesWTips(B29), netRevenue(B34), totalTips(B36).

**Menu:** `Waratah Tools → Admin Tools → Setup & Utilities → Sheet Protection`
- `Apply Protection (All Sheets)` — calls `setupAllSheetsProtection()`
- `Remove Protection (All Sheets)` — calls `removeAllSheetsProtection()`

**Functions in RunWaratah.js:**
```javascript
setupSheetProtection_(sheet)     // protect one sheet; carve out 24 input ranges
setupAllSheetsProtection()       // menu-callable; loops all 5 day sheets
removeAllSheetsProtection()      // menu-callable; removes all protections
getClearableFieldKeys_()         // returns non-formula field keys (used by both rollover + protection)
```

---

## Comparison with Sakura House

| Aspect | Waratah | Sakura House |
|--------|---------|--------------|
| **Cell Strategy** | Named ranges (`WEDNESDAY_SR_NetRevenue`) | Named ranges (`MONDAY_SR_NetRevenue`) |
| **Fallback** | Hardcoded cells (graceful degradation) | Hardcoded cells (graceful degradation) |
| **Infrastructure File** | `RunWaratah.js` (FIELD_CONFIG + helpers) | `RunSakura.gs` (FIELD_CONFIG + helpers) |
| **Day Prefixes** | WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY | MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY |
| **Formula protection** | `isFormula` flag (8 formula cells) + `getClearableFieldKeys_()` | `isFormula` flag (1 formula cell: B54) + `getAllFieldKeys_()` |
| **Self-healing** | `verifyAndFixNamedRanges_()` called during rollover | Same pattern |

---

**Last Updated:** March 18, 2026
**Key Insight:** All narrative cells are merged A:F — always clear from column A, never B:F
