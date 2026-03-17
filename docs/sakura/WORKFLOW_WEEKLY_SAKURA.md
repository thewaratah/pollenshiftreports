# SAKURA HOUSE - Weekly Rollover Workflow

**Last Updated:** March 18, 2026
**Status:** ✅ DEPLOYED & AUTOMATED
**Type:** Detailed Workflow Documentation

---

## Overview

> What this does: Every Monday morning the system automatically saves last week's shift reports as a permanent archive (PDF + Google Sheets snapshot), wipes the spreadsheet clean, sets new dates for the upcoming week, and verifies that all named ranges are intact — so managers always open the same file and it's ready to go.

The Weekly Rollover (In-Place) system archives the previous week's data and prepares the spreadsheet for the next week — all **without creating duplicate files**.

**File:** [`WeeklyRolloverInPlace.gs`](../../SAKURA%20HOUSE/SHIFT%20REPORT%20SCRIPTS/WeeklyRolloverInPlace.gs)

**Key Concept:**
- ONE permanent working file: "Sakura House - Current Week"
- Weekly rollover clears data and updates dates IN PLACE
- Archives static snapshots (multi-page PDF + Google Sheets copy)
- Menus always work (no script duplication issues)
- Named ranges are verified and repaired after every rollover

**Key Difference from Waratah:**
- Sakura uses **named ranges** (not hardcoded cells) — rollover clears fields via `getFieldRange(sheet, fieldKey)` rather than direct cell references
- Sakura operates **6 days** (Mon–Sat, closed Sundays) vs Waratah's 5 days (Wed–Sun)
- Sakura has an extra rollover step: **verify and fix named ranges** after clearing data
- Sakura also clears the **TO-DOs tab** (separate sheet, rows 2+) during rollover
- PDF export includes **all 6 day sheets** as a multi-page PDF (non-day sheets are hidden during export)
- Date calculation targets **next Saturday** (week ending) vs Waratah's next Wednesday (week starting)
- Sheet tabs are **renamed** with the date (e.g. "MONDAY 10/03/2026") — Waratah keeps static names

---

## Automation

> How this runs on its own: A scheduled trigger fires every Monday at 10am Sydney time. You don't need to do anything — it just happens. If you ever need to turn it on or off, there are menu options and script functions for that.

**Trigger:** Monday 10:00am (Australia/Sydney)

**Setup:**

> These functions let you turn the automatic Monday rollover on or off. You'd only need these if the trigger gets deleted (e.g. after a `clasp push`) or you want to pause automation temporarily.

```javascript
// Create automation (removes existing first to avoid duplicates)
createRolloverTrigger_Sakura()

// Remove automation
removeRolloverTrigger_Sakura()

// View active triggers
// Apps Script Editor → Triggers (clock icon)
```

> **WARNING: `clasp push` destroys all time-based triggers.** After every deployment, re-create triggers via the menu or Apps Script editor.

**Menu Access:**

> Managers can also run or preview the rollover manually from the spreadsheet menu bar — no code needed. All rollover operations are under Admin Tools (password-protected).

```
Shift Report → Admin Tools → Weekly Rollover (In-Place)
    ├── Run Rollover Now
    ├── Preview Rollover (Dry Run)
    ├── Open Rollover Settings
    ├── ────────────────
    ├── Create Rollover Trigger (Mon 10am)
    └── Remove Rollover Trigger
```

---

## Execution Flow

> Step by step, here's what happens when rollover runs — whether triggered automatically on Monday or run manually from the menu. It checks safety conditions, generates a summary, archives the old week, clears all sheets, sets new dates, repairs named ranges, then notifies managers. This is an 8-step process (vs Waratah's 7 steps — the extra step is named range verification).

### Function: `performInPlaceRollover()` (Lines 103-192)

```javascript
1. VALIDATE PRECONDITIONS (Line 111)
   validateRolloverPreconditions_() checks:
   ├─ Working file ID matches SAKURA_WORKING_FILE_ID
   ├─ Venue name is 'SAKURA'
   └─ Week completion status (warns if incomplete, doesn't block)

2. GENERATE WEEK SUMMARY (Line 114)
   generateWeekSummary_RolloverSaks_() collects:
   ├─ Iterate DAY_SHEETS: ['MONDAY', 'TUESDAY', ..., 'SATURDAY']
   ├─ For each sheet:
   │   ├─ Read date via getFieldRange(sheet, 'date')
   │   ├─ Read MOD via getFieldValue(sheet, 'mod')
   │   ├─ Read revenue via getFieldValue(sheet, 'netRevenue')
   │   └─ Last sheet (SATURDAY) date = weekEndDate
   └─ Return {weekEndDate, totalRevenue, avgRevenue, daysReported, days, displayText}

3. EXPORT PDF TO ARCHIVE (Line 119)
   exportPdfToArchive_() creates multi-page PDF:
   ├─ Hide all non-day sheets (warehouse tabs, TO-DOs, etc.)
   ├─ Export all visible sheets as single PDF (6 pages)
   ├─ Restore original sheet visibility (try/finally)
   ├─ Save PDF to: Archive/YYYY/YYYY-MM/pdfs/
   ├─ Email PDF to management (Evan only, via INTEGRATION_ALERT_EMAIL_PRIMARY)
   └─ Return {archivePath, fileUrl, emailed}

4. CREATE ARCHIVE SNAPSHOT (Line 123)
   createArchiveSnapshot_() copies entire spreadsheet:
   ├─ makeCopy() of working file
   ├─ Rename: "Sakura Shift Report W.E. DD.MM.YYYY"
   ├─ Move to: Archive/YYYY/YYYY-MM/sheets/
   └─ Return {fileName, fileUrl, archivePath}

5. CLEAR ALL SHEET DATA (Line 127)
   clearAllSheetData_() preserves structure:
   ├─ For each DAY_SHEETS (6 sheets):
   │   └─ For each field in CLEARABLE_FIELDS (23 fields):
   │       ├─ range = getFieldRange(sheet, fieldKey)  // Named range lookup
   │       └─ range.clearContent()  // NOT clear()!
   ├─ Also clears TO-DOs tab (row 2 onwards, header preserved)
   └─ Preserves: formatting, formulas, validation, named ranges

   CLEARABLE_FIELDS = [
     'mod', 'date', 'fohStaff', 'bohStaff',
     'cashCount', 'cashRecord', 'pettyCashTransactions',
     'shiftSummary',
     'todoTasks', 'todoAssignees',
     'cashTips', 'cardTips', 'surchargeTips',
     'productionAmount', 'deposit', 'discounts',
     'guestsOfNote', 'goodNotes', 'issues',
     'kitchenNotes', 'wastageComps', 'maintenance', 'rsaIncidents'
   ]
   // Note: netRevenue is NOT cleared — it's a formula field

6. UPDATE DATES TO NEXT WEEK (Line 131)
   updateDatesToNextWeek_() calculates from TODAY:
   ├─ Calculate next Saturday (week ending date)
   │   const dayOfWeek = today.getDay()
   │   const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
   │   nextSunday = today + daysToSunday
   ├─ For each DAY_SHEETS with DAY_OFFSETS [-6, -5, -4, -3, -2, -1]:
   │   ├─ targetDate = nextSunday + offset
   │   ├─ Write date via getFieldRange(sheet, 'date')
   │   └─ Rename tab: "MONDAY DD/MM/YYYY"
   └─ Return formatted week ending date

7. VERIFY NAMED RANGES (Line 135)        ← SAKURA-ONLY STEP
   verifyAndFixNamedRanges_() ensures integrity:
   ├─ For each DAY_SHEETS:
   │   └─ createNamedRangesOnSheet_(sheet, spreadsheet)
   │       ├─ Check all 24 expected named ranges
   │       ├─ Create any that are missing
   │       └─ Skip ranges that already exist and point correctly
   └─ Log: "fixed N, already OK: M"

8. SEND NOTIFICATIONS (Line 139)
   sendRolloverNotifications_():
   ├─ Email (rollover summary) → Evan only (INTEGRATION_ALERT_EMAIL_PRIMARY)
   │   ├─ HTML table: day-by-day revenue + MOD
   │   ├─ Totals: revenue, average, days reported
   │   └─ Links to archived snapshot + PDF
   ├─ Slack (Block Kit) → SAKURA_SLACK_WEBHOOK_TEST
   │   ├─ Header: "📅 Weekly Rollover — Sakura House"
   │   ├─ Day fields with revenue + MOD
   │   ├─ Totals section
   │   └─ Button: "Open Archived Snapshot"
   └─ Both are non-blocking (try/catch)
```

---

## Fresh Template Behavior

> What happens the very first time rollover runs on a brand-new spreadsheet — unlike Waratah, Sakura does NOT have special fresh-template detection. If sheets have no dates, the summary will show "Unknown" for the week ending date and $0 revenue, but the rollover still proceeds (archive, clear, stamp dates).

**First Rollover Behavior:**

1. **Archives anyway** — creates snapshot and PDF (may be empty)
2. **Clears all fields** — `clearContent()` on all named range fields
3. **Sets dates to next week** — calculates from TODAY
4. **Verifies named ranges** — creates any that are missing
5. **Sends notifications** — summary will show $0 / 0 days reported
6. **Subsequent rollovers** — include full data

**Week Completion Validation:**

> The system checks how many day sheets have dates filled in, but an incomplete week does NOT block rollover — it just logs a warning. This is intentional: the Monday trigger should always run, even if some shifts weren't completed.

```javascript
validateWeekCompletion_RolloverSaks_()
// Returns: { allComplete: bool, completedDays: N, totalDays: 6, details: string }
// Warning only — does not throw
```

---

## Archive Structure

> Where your old reports end up in Google Drive. Every week gets a PDF (all 6 day sheets as one multi-page document) and a Sheets snapshot (full copy of the working file). They're organised by year and month.

```
Archive/
├── 2026/
│   ├── 2026-02/
│   │   ├── pdfs/
│   │   │   ├── Sakura Shift Report W.E. 09.02.2026.pdf
│   │   │   ├── Sakura Shift Report W.E. 16.02.2026.pdf
│   │   │   └── Sakura Shift Report W.E. 23.02.2026.pdf
│   │   └── sheets/
│   │       ├── Sakura Shift Report W.E. 09.02.2026
│   │       ├── Sakura Shift Report W.E. 16.02.2026
│   │       └── Sakura Shift Report W.E. 23.02.2026
│   └── 2026-03/
│       ├── pdfs/
│       └── sheets/
└── 2027/
    └── ...
```

**Archive Root Folder ID:** Stored in Script Properties as `ARCHIVE_ROOT_FOLDER_ID`

**Folder Creation:**

> The system automatically creates year, month, and type subfolders as needed — no manual folder setup required.

```javascript
getOrCreateArchiveSubfolder_(weekEndDateStr, subfolderName)
// weekEndDateStr: "DD/MM/YYYY"
// subfolderName: 'sheets' or 'pdfs'
// Creates: Archive/YYYY/YYYY-MM/{subfolderName}/
```

---

## Critical Implementation Details

> Technical details that matter if you're debugging or modifying the rollover code. These are the "gotchas" that have caused issues in the past.

### 1. Named Range Clearing (Sakura-Specific)

> Unlike Waratah which clears hardcoded cell ranges directly, Sakura clears fields via the named range abstraction. This means you add/remove clearable fields by name (e.g. 'netRevenue'), not by cell address.

**Uses named range abstraction:**
```javascript
// ✅ CORRECT for Sakura — uses named range lookup
const range = getFieldRange(sheet, 'netRevenue');
range.clearContent();

// ❌ WRONG for Sakura — bypasses named range system
sheet.getRange('B54').clearContent();
```

**Use `clearContent()` NOT `clear()`:**

> The most critical rule: `clearContent()` removes only values. `clear()` destroys named ranges, formatting, formulas — everything. Using `clear()` in Sakura would break the entire named range system.

```javascript
// ✅ CORRECT - Preserves named ranges, formatting, validation
range.clearContent();

// ❌ WRONG - Destroys named ranges, formatting, formulas
range.clear();
```

### 2. Date Calculation

> How the system figures out what dates to put on next week's sheets. It calculates from today's date, targeting the next Sunday as the week-ending anchor, then works backwards using day offsets to get Monday through Saturday.

**From TODAY (not spreadsheet dates):**

```javascript
function calculateWeekDates_() {
  const today = new Date();
  const dayOfWeek = today.getDay();  // 0=Sun, 1=Mon, ..., 6=Sat

  // Calculate next Sunday (week ending anchor)
  const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysToSunday);

  return { nextSunday, formattedEndDate };
}

function stampDaySheets_(spreadsheet, weekDates) {
  const DAY_OFFSETS = [-6, -5, -4, -3, -2, -1];
  // MONDAY = Sunday - 6, TUESDAY = Sunday - 5, ..., SATURDAY = Sunday - 1

  DAY_SHEETS.forEach((dayName, index) => {
    const targetDate = nextSunday + DAY_OFFSETS[index];
    // Write date via named range
    const dateRange = getFieldRange(sheet, 'date');
    dateRange.clearContent();
    dateRange.getCell(1, 1).setValue(formattedDate);
    // Rename tab: "MONDAY 10/03/2026"
    sheet.setName(`${dayName} ${formattedDate}`);
  });
}
```

**Why from TODAY?**
- Ensures correct future dates even if spreadsheet dates are wrong
- Prevents cascading date errors
- Works on fresh templates (no existing dates)

**Key difference from Waratah:** Waratah targets next Wednesday (week start); Sakura targets next Sunday (week end) and works backwards. Sakura also renames sheet tabs with the date; Waratah keeps static tab names.

---

### 3. Multi-Page PDF Export

> The PDF archive captures all 6 day sheets in a single document. Non-day sheets (warehouse tabs, TO-DOs, Instructions) are temporarily hidden so only the shift reports appear. Sheet visibility is always restored, even if the export fails.

```javascript
exportPdfToArchive_(spreadsheet, weekEndDate):
  1. Record original visibility of all sheets
  2. Hide every non-day sheet
  3. Show every day sheet
  4. Export all visible sheets as single PDF (no gid param)
  5. FINALLY: restore original visibility (always runs)
  6. Save PDF to Archive/YYYY/YYYY-MM/pdfs/
  7. Email PDF to management
```

**Parameters:** A4, portrait, fit-to-width, 0.5" margins, no gridlines, no titles, no sheet names.

---

### 4. TO-DOs Tab Clearing

> In addition to clearing the 6 day sheets, rollover also wipes the separate TO-DOs tab. This is a standalone sheet that aggregates tasks — row 1 (header) is preserved, all data rows below are cleared.

```javascript
// Clear TO-DOs tab from row 2 onwards
const todoSheet = spreadsheet.getSheetByName('TO-DOs');
if (todoSheet && todoSheet.getLastRow() >= 2) {
  todoSheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
}
```

**Waratah difference:** Waratah has no separate TO-DOs tab — tasks are cleared as part of the day sheet fields (A53:E61).

---

### 5. Named Range Verification (Step 7)

> After clearing data and stamping new dates, the system checks that all 24 expected named ranges still exist and point to the right cells. If any are missing (e.g. due to a sheet restructure), they're recreated from FIELD_CONFIG fallbacks. This self-healing step is unique to Sakura.

```javascript
verifyAndFixNamedRanges_(spreadsheet):
  For each of 6 day sheets:
    createNamedRangesOnSheet_(sheet, spreadsheet)
    // Checks all 24 FIELD_CONFIG entries
    // Creates missing ranges from fallback cells
    // Skips ranges that already exist and are correct
```

**Waratah difference:** Waratah uses hardcoded cells, so there's nothing to verify. This step only exists because named ranges can become detached if sheets are restructured.

---

### 6. Validation Checks

> Safety checks that run before anything else. They make sure rollover is running on the correct file, for the correct venue. Week completion is checked but does NOT block — the trigger should always succeed.

```javascript
validateRolloverPreconditions_(spreadsheet):
  // Check 1: Correct file
  if (spreadsheet.getId() !== config.WORKING_FILE_ID)
    throw new Error('Wrong file');

  // Check 2: Correct venue
  if (VENUE_NAME !== 'SAKURA')
    throw new Error('Wrong venue');

  // Check 3: Week completion (warning only, no throw)
  const validation = validateWeekCompletion_RolloverSaks_();
  if (!validation.allComplete)
    Logger.log('⚠️ Week incomplete');
```

---

## Preview Rollover (Dry Run)

> A safe way to see exactly what rollover would do without actually doing it. Great for checking things look right before running for real, or for verifying that the automation will behave correctly.

**Menu:** `Shift Report → Admin Tools → Weekly Rollover (In-Place) → Preview Rollover (Dry Run)`

**Function:** `previewInPlaceRollover()`

**Shows (without making changes):**
1. Week ending date and validity check
2. Total revenue and days reported
3. Day-by-day summary (date, MOD, revenue)
4. Archive paths that would be created
5. Number of notification recipients

**Example Output:**
```
=== ROLLOVER PREVIEW (NO CHANGES) ===

Current week ending: 15/03/2026
Total revenue: $18,250
Days reported: 6/6

--- Summary ---
MONDAY       10/03/2026   Evan                 $2,850
TUESDAY      11/03/2026   Adam                 $3,100
WEDNESDAY    12/03/2026   Gooch                $2,950
THURSDAY     13/03/2026   Sabine               $3,200
FRIDAY       14/03/2026   Evan                 $3,400
SATURDAY     15/03/2026   Kalisha              $2,750

--- Actions (if executed) ---
1. Export PDF to: Archive/2026/2026-03/pdfs/
2. Create snapshot to: Archive/2026/2026-03/sheets/
3. Clear data from all 6 day sheets
4. Update dates to week ending: 22/03/2026
5. Verify named ranges
6. Send notifications to 1 recipients

=== NO CHANGES MADE ===
```

---

## Manual Execution

> If the automatic Monday rollover didn't fire (e.g. after a `clasp push` that destroyed triggers), or you need to run it at a different time, you can trigger it yourself from the menu. It shows a success summary when done.

**Menu:** `Shift Report → Admin Tools → Weekly Rollover (In-Place) → Run Rollover Now`

**When to Use:**
- After a `clasp push` that destroyed the trigger
- Testing rollover before automating
- Manually triggering outside of Monday 10:00am
- Recovering from a missed automated rollover

**UI Feedback:**
- Success: Shows summary dialog with revenue, archive details, duration
- Failure: Shows error dialog; data has NOT been cleared
- Trigger context: UI dialogs are silently skipped (all wrapped in try/catch)

---

## Notifications

> After each rollover, managers get notified via email and Slack with a summary of the archived week and links to the saved files.

### Email Notification

> An email goes to Evan (via INTEGRATION_ALERT_EMAIL_PRIMARY) with an HTML-formatted table showing day-by-day revenue, MODs, totals, and links to the archived files.

**To:** Evan only (from Script Properties `INTEGRATION_ALERT_EMAIL_PRIMARY`)

**Subject:** "Weekly Rollover Complete - Sakura House W.E. [Date]"

**Body:**
```
📅 Weekly Rollover Complete — Sakura House

Week Ending: DD/MM/YYYY

Weekly Summary:
┌─────────────┬──────────┬───────────┐
│ Day (Date)  │ MOD      │ Revenue   │
├─────────────┼──────────┼───────────┤
│ MONDAY ...  │ Evan     │ $2,850    │
│ ...         │ ...      │ ...       │
└─────────────┴──────────┴───────────┘

Totals:
• Total Revenue: $18,250
• Daily Average: $3,042
• Days Reported: 6 / 6

Archive Details:
• Sheets Archive: [link]
• PDF Export: Archive/2026/2026-03/pdfs/...

✅ Working file has been cleared and reset for the new week.
```

### Slack Notification

> A rich formatted message posted to the test Slack webhook with Block Kit formatting — day-by-day breakdown, totals, and a button to open the archived snapshot.

**To:** Test webhook (from `SAKURA_SLACK_WEBHOOK_TEST`)

**Format:** Rich Block Kit message with:
- Header: "📅 Weekly Rollover — Sakura House"
- Context: Week ending date
- Day fields: each day with MOD and revenue
- Totals: revenue, average, days reported
- Archive info: snapshot filename, PDF path
- Button: "Open Archived Snapshot" (links to Google Drive)

**Note:** Currently posting to TEST webhook. Switch to LIVE when ready by changing `getSakuraSlackWebhookTest_()` to `getSakuraSlackWebhookLive_()` in `sendRolloverNotifications_()`.

---

## Error Handling

> If rollover fails at any step, data is NOT cleared — the failure happens before clearing begins or the error is caught and re-thrown. A Slack error notification is also sent to the test channel.

**On failure:**
1. Error logged to Apps Script execution log
2. Slack notification sent to test webhook: "❌ [performInPlaceRollover] failed: {message}"
3. UI alert shown (if running manually): "Rollover Failed — Data has NOT been cleared"
4. Error re-thrown (marks execution as failed in trigger logs)

**UI in trigger context:**
- All `SpreadsheetApp.getUi()` calls wrapped in try/catch
- Silently skipped when running from time-based trigger (no UI available)
- Rollover always runs to completion — UI is informational only

---

## Trigger Management

> How to create, remove, and verify the automated Monday trigger. The key thing to remember: `clasp push` destroys all triggers, so you must recreate them after every deployment.

**Create:**
```javascript
createRolloverTrigger_Sakura()
// Removes existing rollover trigger first (prevents duplicates)
// Creates: Monday 10:00am (Australia/Sydney)
```

**Remove:**
```javascript
removeRolloverTrigger_Sakura()
// Removes all triggers for performInPlaceRollover
```

**View Settings:**
```javascript
showRolloverConfig()
// Shows: file ID, archive root, timezone, days, email recipients
// No password required (read-only)
```

**Post-deployment checklist:**
After every `clasp push`, re-create ALL triggers:
1. Rollover: Monday 10am — `createRolloverTrigger_Sakura()`
2. Weekly Digest: Monday 8am — `setupWeeklyDigestTrigger_Sakura()`
3. Weekly Backfill: Monday 2am — (see IntegrationHubSakura.gs)
4. Daily Task Maintenance: 7am — `createDailyMaintenanceTrigger()`
5. Weekly Task Summary: Monday 6am — `createWeeklySummaryTrigger()`
6. Overdue Summary: Sunday 9am — (see EnhancedTaskManagement_Sakura.gs)
7. onEdit auto-sort — `createOnEditTrigger()`

---

## Comparison: Sakura vs Waratah Rollover

> Side-by-side comparison of how the two venues handle weekly rollover. The core concept is the same, but the implementation details differ significantly.

| Aspect | Sakura House | The Waratah |
|--------|-------------|-------------|
| **Cell System** | Named ranges (`getFieldRange()`) | Hardcoded cells (`'B34'`) |
| **Operating Days** | 6 (Mon–Sat) | 5 (Wed–Sun) |
| **Date Anchor** | Next Sunday (week ending) | Next Wednesday (week starting) |
| **Day Offsets** | `[-6, -5, -4, -3, -2, -1]` from Sunday | `[0, 1, 2, 3, 4]` from Wednesday |
| **Tab Renaming** | Yes ("MONDAY 10/03/2026") | No (static names) |
| **Clearable Fields** | 23 named range keys | 20+ hardcoded cell ranges |
| **TO-DOs Tab** | Cleared separately (rows 2+) | Cleared as part of day sheet fields |
| **Named Range Verify** | Yes (Step 7) | N/A (no named ranges) |
| **netRevenue Clearing** | NOT cleared (formula) | NOT cleared (formula) |
| **PDF Export** | Multi-page (all 6 sheets) | Multi-page (all 5 sheets) |
| **Email Recipients** | Evan only | Management team |
| **Slack Webhook** | Test webhook | Managers channel |
| **Fresh Template** | No special handling | Detects and skips archiving |
| **Week Validation** | Warning only (non-blocking) | N/A (throws if no dates) |
| **Rollover Steps** | 8 (includes named range verify) | 7 |

---

## Comparison: In-Place vs. Duplication

> Why we use the current approach instead of the old one. The previous system created a brand-new spreadsheet copy every week, which caused container-bound scripts (and therefore menus) to disappear from the new file.

| Aspect | In-Place System (Current) | Duplication System (Deprecated) |
|--------|---------------------------|--------------------------------|
| **Working Files** | 1 permanent file | 52+ files per year |
| **Menu Scripts** | Always work | Break with each duplicate |
| **Named Ranges** | Preserved via `clearContent()` | Lost on copy (GAS limitation) |
| **Triggers** | Stable (same file ID) | Need reconfiguration weekly |
| **Storage** | Minimal (archives only) | Massive (every week duplicated) |
| **Maintenance** | Low | High |
| **Risk** | Data loss if mistake | Duplication clutter |

---

## Troubleshooting

> Common problems and how to fix them. Each issue includes the likely cause and a script you can run in the Apps Script editor to diagnose and resolve it.

### Issue: Rollover Fails with "Wrong file" Error

> This means the rollover script is running on a different spreadsheet than the one it's configured for — usually happens if the file was duplicated or the ID property was changed.

**Cause:** Running on wrong spreadsheet

**Solution:**
```javascript
// Check current file ID
Logger.log(SpreadsheetApp.getActiveSpreadsheet().getId());

// Check configured working file ID
const props = PropertiesService.getScriptProperties();
Logger.log(props.getProperty('SAKURA_WORKING_FILE_ID'));

// Update if needed
props.setProperty('SAKURA_WORKING_FILE_ID', '[correct_id]');
```

---

### Issue: Named Ranges Missing After Rollover

> If fields aren't being read correctly after a rollover, some named ranges may have been lost. The rollover includes a self-healing step, but you can also run it manually.

**Cause:** Named ranges detached during sheet restructure

**Solution:**
```javascript
// Diagnose which ranges are missing
diagnoseAllSheets()

// Recreate from FIELD_CONFIG fallbacks (skips existing)
createNamedRangesOnAllSheets()

// Force overwrite ALL ranges with current fallbacks
forceUpdateNamedRangesOnAllSheets()
```

---

### Issue: Trigger Not Firing

> After a `clasp push`, all time-based triggers are destroyed. The rollover won't run automatically until the trigger is recreated.

**Cause:** `clasp push` destroyed triggers

**Solution:**
```javascript
// Recreate rollover trigger
createRolloverTrigger_Sakura()

// Verify in Apps Script Editor → Triggers (clock icon)
```

---

### Issue: PDF Export Shows Wrong Sheets

> The PDF should contain only the 6 day sheets. If warehouse tabs or other sheets appear, the visibility restoration may have failed.

**Cause:** Sheet visibility not restored after export error

**Solution:**
```javascript
// Check which sheets are hidden
SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(s => {
  Logger.log(`${s.getName()}: ${s.isSheetHidden() ? 'HIDDEN' : 'visible'}`);
});

// Manually show/hide as needed via the sheet tab right-click menu
```

---

### Issue: Dates Landing on Wrong Days

> If dates are off or landing on the wrong weekday, the spreadsheet's timezone may be wrong, or the day-of-week calculation is off.

**Cause:** Timezone mismatch

**Solution:**
```javascript
// Check timezone
const ss = SpreadsheetApp.getActiveSpreadsheet();
Logger.log('Timezone: ' + ss.getSpreadsheetTimeZone());

// Should be: Australia/Sydney
// If wrong:
ss.setSpreadsheetTimeZone('Australia/Sydney');
```

---

**Last Updated:** March 18, 2026
**Status:** ✅ Deployed and automated (Mondays 10:00am)
**Key File:** `WeeklyRolloverInPlace.gs` (1,109 LOC)
