# THE WARATAH - Cell Reference Map

**Last Updated:** March 6, 2026
**Type:** Authoritative Reference
**Purpose:** Complete mapping of hardcoded cell references for all Waratah day sheets

---

## Overview

The Waratah uses **hardcoded cell references** (not named ranges like Sakura House). This is the single source of truth for all cell positions.

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
Net Revenue:           B34      (formula)
Cash Total:            B35      (NOT warehoused)
Covers:                B36      (formula, NOT warehoused)
Total Tips:            B37      (formula)
Labor Hours:           B38      (formula, NOT warehoused)
Labor Cost:            B39      (formula, NOT warehoused)
B34, B36, B37:B40 = FORMULA CELLS — DO NOT CLEAR during rollover
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

## VenueConfig.js Mapping

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/VenueConfig.js`

```javascript
ranges: {
  usesNamedRanges: false,

  // Header
  date: 'B3:F3',
  mod: 'B4:F4',
  staff: 'B5:F5',

  // Financial
  netRevenue: 'B34',
  cardTips: 'B32',
  cashTips: 'B33',
  totalTips: 'B37',

  // Narrative fields (odd rows = data, even rows = labels)
  shiftSummary: 'A43:F43',
  guestsOfNote: 'A45:F45',
  theGood: 'A47:F47',
  theBad: 'A49:F49',
  kitchenNotes: 'A51:F51',

  // Task management (9 rows: 53-61)
  todoTask: 'A53:E61',
  todoAssignee: 'F53:F61',

  // Incidents and wastage
  wastageComps: 'A63:F63',
  rsaIncidents: 'A65:F65',
}
```

---

## Integration Hub Extraction

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/IntegrationHub.js`

The `extractShiftData_()` function reads these cells for the warehouse (22-col NIGHTLY_FINANCIAL schema, Mar 6 2026):

```javascript
const shiftData = {
  // Core fields
  date: sheet.getRange('B3').getValue(),
  mod: sheet.getRange('B4').getDisplayValue(),
  staff: sheet.getRange('B5').getDisplayValue(),
  netRevenue: sheet.getRange('B34').getValue(),

  // Financial breakdown (B8, B15-B29)
  productionAmount: sheet.getRange('B8').getValue(),
  cashTakings: sheet.getRange('B15').getValue(),
  grossSalesIncCash: sheet.getRange('B16').getValue(),
  cashReturns: sheet.getRange('B17').getValue(),       // merged B17:B18
  cdDiscount: sheet.getRange('B19').getValue(),         // merged B19:B20
  refunds: sheet.getRange('B21').getValue(),            // merged B21:B22
  cdRedeem: sheet.getRange('B23').getValue(),           // merged B23:B24
  totalDiscount: sheet.getRange('B25').getValue(),
  discountsCompsExcCD: sheet.getRange('B26').getValue(),
  grossTaxableSales: sheet.getRange('B27').getValue(),
  taxes: sheet.getRange('B28').getValue(),
  netSalesWTips: sheet.getRange('B29').getValue(),

  // Tips
  cardTips: sheet.getRange('B32').getValue(),
  cashTips: sheet.getRange('B33').getValue(),
  tipsTotal: sheet.getRange('B37').getValue(),

  // Narratives
  shiftSummary: sheet.getRange('A43').getDisplayValue(),
  guestsOfNote: sheet.getRange('A45').getDisplayValue(),
  theGood: sheet.getRange('A47').getDisplayValue(),
  theBad: sheet.getRange('A49').getDisplayValue(),
  kitchenNotes: sheet.getRange('A51').getDisplayValue(),
  wastageComps: sheet.getRange('A63').getDisplayValue(),
  rsaIncidents: sheet.getRange('A65').getDisplayValue(),
  // Tasks extracted separately from A53:F61
};
```

**NOT warehoused (ignored):** B35 (Cash Total), B36 (Covers), B38 (Labor Hours), B39 (Labor Cost)

---

## Rollover Clearable Fields

**File:** `THE WARATAH/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.js`

These fields are cleared during weekly rollover (structure preserved):

```javascript
const CLEARABLE_FIELDS = {
  // Header
  date: 'B3:F3',
  mod: 'B4:F4',
  staff: 'B5:F5',

  // Financial (input cells only)
  // Formula cells — DO NOT CLEAR:
  //   B15, B16, B26, B27, B28, B29, B34, B36, B37, B38, B39
  productionAmount: 'B8',
  deposit: 'B9:B10',
  airbnbCovers: 'B11',
  cancellations: 'B13:B14',
  cashReturns: 'B17:B18',
  cashDiscount: 'B19:B20',
  refunds: 'B21:B22',
  cdRedeem: 'B23:B24',
  totalDiscounts: 'B25',
  pettyCash: 'B30',
  cardTips: 'B32',
  cashTips: 'B33',

  // Narrative fields (merged A:F — value lives in col A, must clear full merge)
  shiftSummary: 'A43:F43',
  vips: 'A45:F45',
  theGood: 'A47:F47',
  theBad: 'A49:F49',
  kitchenComments: 'A51:F51',
  wastageComps: 'A63:F63',
  rsaIncidents: 'A65:F65',

  // To-do fields (9 rows: 53-61, merged A:E for tasks)
  todoTasks: 'A53:E61',
  todoAllocations: 'F53:F61'
};
```

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
| Net Revenue | B34 | Formula | Yes (col F) | No (formula) |
| Cash Total | B35 | Number | No | No |
| Covers | B36 | Formula | No | No (formula) |
| Total Tips | B37 | Formula | Yes (col U) | No (formula) |
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

## Comparison with Sakura House

| Aspect | Waratah | Sakura House |
|--------|---------|--------------|
| **Cell Strategy** | Hardcoded (`B34`) | Named ranges (`MONDAY_SR_NetRevenue`) |
| **Flexibility** | Lower (cells hardcoded) | Higher (ranges can move) |
| **Maintenance** | Simpler (direct references) | Complex (range management) |
| **Risk** | Cell movement breaks scripts | Range deletion breaks scripts |
| **Abstraction** | Via `VenueConfig.js` | Via `getFieldRange()` |

---

**Last Updated:** March 6, 2026
**Key Insight:** All narrative cells are merged A:F — always clear from column A, never B:F
