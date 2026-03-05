# VenueConfig.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/VenueConfig.js`
**Type:** Central venue configuration and cell reference abstraction layer
**Called by:** Nearly every other file in the project

---

## What This File Does

This is the configuration backbone of the project (~274 lines). It defines all venue-specific settings and provides an abstraction layer that lets the same code work across both Waratah (hardcoded cell references) and Sakura House (named ranges).

Every function that reads or writes shift report data goes through VenueConfig to resolve the correct cell reference for the current venue.

---

## Venue Configurations

### WARATAH Config
| Setting | Value |
|---------|-------|
| **Operating days** | Wednesday, Thursday, Friday, Saturday, Sunday |
| **Cell reference style** | Hardcoded (e.g., `B34` for net revenue) |
| **Timezone** | Australia/Sydney |

### SAKURA Config
| Setting | Value |
|---------|-------|
| **Operating days** | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday |
| **Cell reference style** | Named ranges (e.g., `MONDAY_SR_NetRevenue`) |
| **Timezone** | Australia/Sydney |

---

## Key Functions

### `getVenueConfig_()`
Returns the full configuration object for the current venue. Detects which venue the script is running in (based on spreadsheet name or Script Properties) and returns the corresponding config.

### `getVenueName_()`
Returns the venue identifier string — either `"WARATAH"` or `"SAKURA"`. Used throughout the project for venue-aware logic.

### `usesNamedRanges_()`
Returns `true` for Sakura (named ranges), `false` for Waratah (hardcoded cells). Used to determine which cell access method to use.

### Cell Reference Abstraction

These functions are the core abstraction — they let calling code use a logical field name (like `"netRevenue"`) and get the correct cell value regardless of venue:

| Function | What It Does |
|----------|-------------|
| `getRangeValue_(sheet, fieldName)` | Reads a single cell value using the venue's reference style |
| `setRangeValue_(sheet, fieldName, value)` | Writes a single cell value using the venue's reference style |
| `getRangeValues_(sheet, fieldName)` | Reads a range of values (e.g., TO-DO rows) |
| `setRangeValues_(sheet, fieldName, values)` | Writes a range of values |

**How it works:**
- For Waratah: Looks up the field name in the config to get a hardcoded cell reference (e.g., `"B34"`), then calls `sheet.getRange("B34").getValue()`
- For Sakura: Looks up the field name to get a named range (e.g., `"MONDAY_SR_NetRevenue"`), then calls `ss.getRangeByName("MONDAY_SR_NetRevenue").getValue()`

---

## When Would You Need This File?

- **Adding a new field to the shift report** — Add the cell reference (Waratah) or named range (Sakura) to the venue configs
- **Changing a cell location** — Update the reference in the WARATAH or SAKURA config object
- **Adding a new venue** — Create a new config object following the same structure
- **Debugging "wrong cell" issues** — Check that the field name maps to the correct cell reference in the config

---

## Important Notes

- **Waratah uses hardcoded cells, Sakura uses named ranges** — this is the fundamental architectural difference between the two venues. VenueConfig abstracts it away.
- **Cell references for Waratah are documented in `docs/waratah/CELL_REFERENCE_MAP.md`** — the authoritative source.
- **Formula cells (B37:B40) are in the config but should NEVER be cleared** — they contain formulas for Total Tips, Labor Hours, Labor Cost. The `CLEARABLE_FIELDS` constant in `WeeklyRolloverInPlace.js` intentionally excludes them.
- **Lazy-loaded** — `getVenueConfig_()` reads Script Properties only when called, not at module load time, preventing `onOpen()` crashes.

---

## Related Files

- [IntegrationHub.js](../SHIFT REPORT SCRIPTS/IntegrationHub.js) — Uses `getRangeValue_()` to extract shift data
- [NightlyExport.js](../SHIFT REPORT SCRIPTS/NightlyExport.js) — Uses venue config for cell references in Slack messages
- [WeeklyRolloverInPlace.js](../SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.js) — Uses venue config to know which cells to clear
- [TEST_VenueConfig.js](../SHIFT REPORT SCRIPTS/TEST_VenueConfig.js) — Test suite that validates this file
- [_SETUP_ScriptProperties.js](../SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties.js) — Sets venue-related Script Properties
