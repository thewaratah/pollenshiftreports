# TEST_DataExtractionVerification.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/TEST_DataExtractionVerification.js`
**Type:** Verification/test script for the IntegrationHub data extraction pipeline
**Run from:** Apps Script editor (not available via menu)

---

## What This File Does

This is a comprehensive test script (~274 lines) that verifies the data extraction logic in `IntegrationHub.js` is reading the correct cells and producing valid data. It tests that every field the integration pipeline relies on is being read accurately from the shift report sheet.

It was built after the NIGHTLY_FINANCIAL schema was expanded to 22 columns, to ensure the extraction still maps correctly.

---

## What It Tests

### Cell Reading Accuracy
Verifies that `extractShiftData_()` reads the expected values from known cells:
- Date, MOD name, staff list
- Revenue, card tips, cash tips, covers
- Narrative fields (shift summary, VIP, good, bad, kitchen notes)
- TO-DO tasks and assignees
- Wastage and RSA incidents

### Required Fields Validation
Checks that required fields (date, MOD, revenue) are present and non-empty after extraction.

### Tips Sanity Check
Verifies that card tips + cash tips = total tips (matches the formula in B37).

### Narrative Fields
Confirms that narrative fields from merged cells (A43, A45, A47, A49, A51) are read correctly — important because merged cell reading in GAS has known gotchas.

### 22-Column NIGHTLY_FINANCIAL Schema
Validates that the extracted data maps correctly to all 22 columns in the warehouse schema, including the newer columns added during the schema expansion.

---

## Key Functions

| Function | What It Does |
|----------|-------------|
| `runFullDataExtractionTest()` | Runs all tests in sequence and reports results |
| `testCellReadAccuracy()` | Compares extracted values against direct cell reads |
| `testRequiredFields()` | Checks for missing required data |
| `testTipsSanity()` | Validates the tips arithmetic |
| `testNarrativeFields()` | Tests merged cell reading |
| `testWarehouseMapping()` | Verifies 22-column schema alignment |

---

## When Would You Need This File?

- **After changing cell references** — Run the tests to verify extraction still works
- **After modifying `extractShiftData_()`** — Validate that the data mapping is correct
- **After expanding the warehouse schema** — Confirm new columns are populated
- **Debugging warehouse data issues** — Run individual test functions to isolate the problem

---

## Important Notes

- **Run from the Apps Script editor only** — not connected to the menu system
- **Non-destructive** — reads data only, does not write or modify anything
- **Designed for the 22-column schema** — if the schema changes again, these tests need updating
- **Tests run against the active sheet** — make sure you have a populated day sheet selected

---

## Related Files

- [IntegrationHub.js](../SHIFT REPORT SCRIPTS/IntegrationHub.js) — The extraction logic being tested (`extractShiftData_()`, `validateShiftData_()`)
- [VenueConfig.js](../SHIFT REPORT SCRIPTS/VenueConfig.js) — Cell reference configuration used during extraction
