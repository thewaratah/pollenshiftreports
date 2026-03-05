# TEST_VenueConfig.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/TEST_VenueConfig.js`
**Type:** Test suite for VenueConfig.js
**Run from:** Apps Script editor (not available via menu)

---

## What This File Does

This is a 4-test verification suite (~213 lines) that validates the venue configuration system in `VenueConfig.js`. It ensures that venue detection, config loading, and the cell reference abstraction layer all work correctly.

---

## Test Functions

### Test 1: `testVenueNameDetection()`
Verifies that `getVenueName_()` correctly identifies the current spreadsheet as "WARATAH" based on the spreadsheet name or Script Properties. Tests both positive detection and edge cases.

### Test 2: `testConfigLoading()`
Validates that `getVenueConfig_()` returns a complete config object with all required fields:
- Operating days (WEDNESDAY–SUNDAY for Waratah)
- Cell references for financial, narrative, and TO-DO fields
- Venue-specific settings (name, timezone, email subject prefix)

### Test 3: `testRangeAbstraction()`
Tests `getRangeValue_()` and `setRangeValue_()` — the abstraction functions that handle both hardcoded cells (Waratah) and named ranges (Sakura). Confirms that reading and writing through the abstraction layer produces the same results as direct cell access.

### Test 4: `testVenueSpecificChecks()`
Validates Waratah-specific behavior:
- `usesNamedRanges_()` returns `false` for Waratah (uses hardcoded cells)
- Operating days are exactly Wednesday through Sunday (5 days)
- Sheet names match the expected day names

### `showVenueConfigSummary()`
A bonus function that displays a formatted summary of the current venue's configuration in an alert dialog. Useful for quick verification without reading logs.

---

## When Would You Need This File?

- **After modifying VenueConfig.js** — Run all 4 tests to verify nothing broke
- **Setting up a new venue** — Adapt these tests for the new venue's expected values
- **Debugging cell reference issues** — Test 3 isolates the abstraction layer
- **Verifying the venue detection** — Test 1 confirms the spreadsheet is identified correctly

---

## Important Notes

- **Run from the Apps Script editor only** — not connected to the menu system
- **Tests are read-heavy, write-light** — Test 3 writes a test value and reads it back, but restores the original value
- **Waratah-specific assertions** — If running this in the Sakura project, the expected values will be different (named ranges, 6 operating days, Monday–Saturday)
- **`showVenueConfigSummary()` requires UI context** — it uses `getUi().alert()`, so it won't work from a time-based trigger

---

## Related Files

- [VenueConfig.js](../SHIFT REPORT SCRIPTS/VenueConfig.js) — The configuration system being tested
- [_SETUP_ScriptProperties.js](../SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties.js) — Where venue-related Script Properties are set
