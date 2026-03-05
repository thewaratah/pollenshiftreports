# WeeklyDigestWaratah.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/WeeklyDigestWaratah.js`
**Type:** Weekly revenue digest — automated Slack summary
**Run from:** Time-based trigger (Wednesday 8am) or Menu > Admin Tools > Weekly Digest

---

## What This File Does

This file (~203 lines) generates and posts a weekly revenue comparison to Slack every Wednesday morning. It reads from the NIGHTLY_FINANCIAL sheet in the Data Warehouse, compares this week's numbers against last week's, and posts a formatted summary showing trends.

---

## Key Functions

### `sendRevenueDigest_Waratah()`
**LIVE function** — posts the revenue digest to the live Slack channel.

### `sendRevenueDigest_Waratah_TestToSelf()`
**TEST function** — posts to the test Slack channel instead.

### `computeWeeklyStats_Waratah_()`
The core logic function that:

1. **Reads NIGHTLY_FINANCIAL** — pulls all rows from the Data Warehouse
2. **Filters by date range** — identifies this week's entries (last 7 days) and last week's entries (8–14 days ago)
3. **Calculates totals** — sums revenue, tips, and covers for each week
4. **Computes deltas** — calculates the percentage change between weeks
5. **Returns a stats object** — with all figures ready for formatting

### `formatDigestMessage_Waratah_(stats)`
Takes the stats object and builds a Slack Block Kit message with:
- Header with venue name and date range
- This week's total revenue, tips, and covers
- Last week's totals for comparison
- Percentage change indicators (up/down arrows)
- Per-day breakdown if available

### `setupWeeklyDigestTrigger_Waratah()`
Creates a time-based trigger that fires every **Wednesday at 8am AEST**. Removes any existing digest trigger first to prevent duplicates.

---

## When Would You Need This File?

- **Changing when the digest fires** — Update the day/time in `setupWeeklyDigestTrigger_Waratah()`
- **Adding new metrics to the digest** — Update `computeWeeklyStats_Waratah_()` to pull additional columns from NIGHTLY_FINANCIAL, then update `formatDigestMessage_Waratah_()` to display them
- **Changing the comparison period** — Modify the date range filtering in `computeWeeklyStats_Waratah_()`
- **Digest not posting** — Check that the trigger exists (Admin Tools > Weekly Digest > Setup Wednesday Digest Trigger) and that the Slack webhook is valid

---

## Important Notes

- **Depends on the Data Warehouse** — If NIGHTLY_FINANCIAL is empty or has missing days, the digest will show incomplete data or zero values.
- **Wednesday timing is intentional** — The Waratah operates Wed–Sun, so Wednesday morning is the start of a new week. The digest covers the previous full operating week.
- **The trigger must be re-created after deployment** — `clasp push` does not preserve time-based triggers. Run `setupWeeklyDigestTrigger_Waratah()` after any deployment.
- **Uses `bk_*` functions from SlackBlockKitWaratahSR.js** for Block Kit message formatting.

---

## Related Files

- [SlackBlockKitWaratahSR.js](../SHIFT REPORT SCRIPTS/SlackBlockKitWaratahSR.js) — Block Kit builder functions used for the Slack message
- [IntegrationHub.js](../SHIFT REPORT SCRIPTS/IntegrationHub.js) — Populates the NIGHTLY_FINANCIAL data this digest reads
- [Menu.js](../SHIFT REPORT SCRIPTS/Menu.js) — Adds "Weekly Digest" menu items under Admin Tools
- [_SETUP_ScriptProperties.js](../SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties.js) — Slack webhook URLs and Data Warehouse spreadsheet ID
