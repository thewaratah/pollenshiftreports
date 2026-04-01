# THE WARATAH - Weekly Rollover Workflow

**Last Updated:** February 15, 2026
**Status:** ✅ DEPLOYED & AUTOMATED
**Type:** Detailed Workflow Documentation

---

## Overview

The Weekly Rollover (In-Place) system archives the previous week's data and prepares the spreadsheet for the next week—all **without creating duplicate files**.

**File:** [`WeeklyRolloverInPlaceWaratah.js`](../../THE%20WARATAH/SHIFT%20REPORT%20SCRIPTS/WeeklyRolloverInPlaceWaratah.js)

**Key Concept:**
- ONE permanent working file: "The Waratah - Current Week"
- Weekly rollover clears data and updates dates IN PLACE
- Archives static snapshots (PDF + Google Sheets copy)
- Menus always work (no script duplication issues)

---

## Automation

**Trigger:** Monday 10:00am (Australia/Sydney)

**Setup:**
```javascript
// Create automation
createWeeklyRolloverTrigger()

// Remove automation
removeWeeklyRolloverTrigger()

// View active triggers
// Apps Script Editor → Triggers (clock icon)
```

**Menu Access:**
```
Waratah Tools → Weekly Reports → Weekly Rollover (In-Place)
    ├── Run Rollover Now
    ├── Preview Rollover (Dry Run)
    ├── ────────────────
    ├── Create Rollover Trigger
    └── Remove Rollover Trigger
```

---

## Execution Flow

### Function: `performWeeklyRollover()` (Lines 90-184)

```javascript
1. VALIDATE PRECONDITIONS (Lines 97-99)
   validatePreconditions_() checks:
   ├─ Working file ID matches WARATAH_WORKING_FILE_ID
   ├─ Venue name is 'WARATAH'
   ├─ Archive folder exists (ARCHIVE_ROOT_FOLDER_ID)
   └─ WEDNESDAY sheet exists

2. GENERATE WEEK SUMMARY (Lines 102-132)
   try {
     summary = generateWeekSummary_()
     ├─ Iterate DAY_SHEETS: ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
     ├─ For each sheet:
     │   ├─ Read date from B3
     │   ├─ If date exists (instanceof Date):
     │   │   ├─ shiftsCompleted++
     │   │   ├─ totalNetRevenue += B34
     │   │   ├─ totalCashTips += B33
     │   │   ├─ totalCardTips += B32
     │   │   └─ Count to-dos in B52:E59
     │   └─ Last sheet date = weekEndingDate
     └─ Return {weekEnding, totalNetRevenue, totalTips, shiftsCompleted, totalTodos}
   } catch (e) {
     if 'No valid dates found':
       summary = null  // Fresh template
       Skip archiving steps
   }

3. EXPORT PDF TO ARCHIVE (Lines 112-114)
   if summary exists:
     pdfFile = exportPdfToArchive_(summary)
     ├─ Generate filename: "Waratah_Shift_Report_WE_2026-02-22.pdf"
     ├─ Create year/month folder structure: Archive/2026/2026-02/pdfs/
     ├─ Generate PDF blob from entire spreadsheet
     └─ Save to folder, return File object

4. CREATE ARCHIVE SNAPSHOT (Lines 117-119)
   if summary exists:
     snapshotFile = createArchiveSnapshot_(summary)
     ├─ Create copy of entire spreadsheet
     ├─ Rename: "Waratah_Week_Ending_2026-02-22 (SNAPSHOT)"
     ├─ Move to: Archive/2026/2026-02/sheets/
     └─ Return File object

5. CLEAR ALL SHEET DATA (Lines 135-137)
   clearAllSheetData_()
   ├─ For each DAY_SHEETS:
   │   ├─ Get sheet
   │   └─ For each field in CLEARABLE_FIELDS:
   │       └─ sheet.getRange(field).clearContent()  // NOT clear()!
   └─ Preserves: formatting, formulas, validation, conditional formatting

   CLEARABLE_FIELDS = {
     mod: 'B4:F4',
     staff: 'B5:F5',
     netRevenue: 'B34',
     cashTips: 'B33',
     cardTips: 'B32',
     shiftSummary: 'B42:F42',
     todoTasks: 'B52:E59',
     todoAllocations: 'F52:F59',
     // ... 20+ fields
   }

6. UPDATE DATES TO NEXT WEEK (Lines 140-142)
   nextWeekStart = updateDatesToNextWeek_()
   ├─ Calculate next Wednesday from TODAY:
   │   const today = new Date()
   │   const dayOfWeek = today.getDay()
   │   const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7
   │   nextWednesday = today + daysUntilWednesday days
   ├─ For each DAY_SHEETS (index 0-4):
   │   ├─ newDate = nextWednesday + index days
   │   └─ sheet.getRange('B3:F3').setValue(newDate)
   └─ Return nextWednesday

7. SEND NOTIFICATIONS (Lines 145-151)
   if summary && pdfFile && snapshotFile:
     sendRolloverNotifications_(summary, nextWeekStart, pdfFile, snapshotFile)
     ├─ Compose email with week summary, archive file links
     ├─ Send to SLACK_MANAGERS_CHANNEL_WEBHOOK
     └─ Email to management team
   else:
     Skip (fresh template - nothing to notify)
```

---

## Fresh Template Behavior

**First Rollover on Fresh Template:**

1. **No archiving** - No previous data exists
2. **Clears empty fields** - `clearContent()` on all ranges
3. **Sets dates to next week** - Calculates from TODAY
4. **No notifications** - Nothing to report
5. **Subsequent rollovers** - Include full archiving

**Detection:**
```javascript
try {
  const summary = generateWeekSummary_();
  // summary found - perform archiving
} catch (e) {
  if (e.message.includes('No valid dates found')) {
    summary = null;  // Fresh template
    // Skip archiving, proceed with clearing and date updates
  }
}
```

---

## Archive Structure

```
Archive/
├── 2026/
│   ├── 2026-02/
│   │   ├── pdfs/
│   │   │   ├── Waratah_Shift_Report_WE_2026-02-09.pdf
│   │   │   ├── Waratah_Shift_Report_WE_2026-02-16.pdf
│   │   │   └── Waratah_Shift_Report_WE_2026-02-23.pdf
│   │   └── sheets/
│   │       ├── Waratah_Week_Ending_2026-02-09 (SNAPSHOT)
│   │       ├── Waratah_Week_Ending_2026-02-16 (SNAPSHOT)
│   │       └── Waratah_Week_Ending_2026-02-23 (SNAPSHOT)
│   └── 2026-03/
│       ├── pdfs/
│       └── sheets/
└── 2027/
    └── ...
```

**Folder ID:** Stored in Script Properties as `ARCHIVE_ROOT_FOLDER_ID`

---

## Critical Implementation Details

### 1. Date Calculation

**From TODAY (not spreadsheet dates):**

```javascript
function updateDatesToNextWeek_() {
  const today = new Date();
  const dayOfWeek = today.getDay();  // 0 (Sun) - 6 (Sat)

  // Calculate days until next Wednesday (day 3)
  const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;

  const nextWednesday = new Date(today);
  nextWednesday.setDate(today.getDate() + daysUntilWednesday);

  // Set dates: Wed, Thu, Fri, Sat, Sun
  const sheets = ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  sheets.forEach((sheetName, index) => {
    const sheet = ss.getSheetByName(sheetName);
    const newDate = new Date(nextWednesday);
    newDate.setDate(nextWednesday.getDate() + index);
    sheet.getRange('B3:F3').setValue(newDate);
  });

  return nextWednesday;
}
```

**Why from TODAY?**
- Ensures correct future dates even if spreadsheet dates are wrong
- Prevents cascading date errors
- Works on fresh templates (no existing dates)

---

### 2. Data Clearing Strategy

**Use `clearContent()` NOT `clear()`:**

```javascript
// ✅ CORRECT - Preserves structure
range.clearContent();

// ❌ WRONG - Destroys everything
range.clear();
```

**What's Preserved:**
- Cell formatting (colors, borders, fonts)
- Data validation (dropdowns)
- Conditional formatting rules
- Formulas (if any)
- Named ranges (critical for Sakura, irrelevant for Waratah)
- Merged cells

**What's Cleared:**
- Cell values only

---

### 3. Validation Checks

```javascript
function validatePreconditions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();

  // Check 1: Correct file
  const workingFileId = props.getProperty('WARATAH_WORKING_FILE_ID');
  if (ss.getId() !== workingFileId) {
    throw new Error('Wrong file - must run on working file');
  }

  // Check 2: Correct venue
  const venueName = props.getProperty('VENUE_NAME');
  if (venueName !== 'WARATAH') {
    throw new Error('Wrong venue - this is Waratah rollover');
  }

  // Check 3: Archive folder exists
  const archiveFolderId = props.getProperty('ARCHIVE_ROOT_FOLDER_ID');
  try {
    DriveApp.getFolderById(archiveFolderId);
  } catch (e) {
    throw new Error('Archive folder not found');
  }

  // Check 4: Required sheet exists
  if (!ss.getSheetByName('WEDNESDAY')) {
    throw new Error('WEDNESDAY sheet not found');
  }

  return true;
}
```

---

## Preview Rollover (Dry Run)

**Menu:** `Waratah Tools → Weekly Reports → Weekly Rollover (In-Place) → Preview Rollover (Dry Run)`

**Function:** `previewWeeklyRollover()`

**Shows (without making changes):**
1. Previous week summary (if data exists)
2. New week dates that would be set
3. Archive files that would be created
4. Notifications that would be sent

**Example Output:**
```
=== WEEKLY ROLLOVER PREVIEW ===

Previous Week Summary:
- Week Ending: 2026-02-23
- Total Revenue: $12,450.00
- Total Tips: $845.50
- Shifts Completed: 5/5
- Total To-Dos: 18

Archive Files (would create):
- PDF: Archive/2026/2026-02/pdfs/Waratah_Shift_Report_WE_2026-02-23.pdf
- Snapshot: Archive/2026/2026-02/sheets/Waratah_Week_Ending_2026-02-23 (SNAPSHOT)

New Week Dates (would set):
- WEDNESDAY: 2026-02-26
- THURSDAY: 2026-02-27
- FRIDAY: 2026-02-28
- SATURDAY: 2026-03-01
- SUNDAY: 2026-03-02

Notifications (would send):
- Email to management team
- Slack to #managers channel

=== NO CHANGES MADE ===
```

---

## Manual Execution

**Menu:** `Waratah Tools → Weekly Reports → Weekly Rollover (In-Place) → Run Rollover Now`

**When to Use:**
- Testing rollover before automating
- Manually triggering outside of Monday 10:00am
- Recovering from a missed automated rollover

**Confirmation Prompts:**
1. "You are about to run weekly rollover. Continue?"
2. Shows preview of what will happen
3. Final confirmation: "Proceed with rollover?"

---

## Notifications

### Email Notification

**To:** Management team (from Script Properties)

**Subject:** "The Waratah - Week Ending [Date] Archived"

**Body:**
```
The Waratah shift reports for the week ending [date] have been archived.

Week Summary:
• Total Revenue: $[amount]
• Total Tips: $[amount]
• Shifts Completed: [count]/5
• Total To-Dos: [count]

Archive Files:
• PDF: [link to Google Drive]
• Snapshot: [link to Google Drive]

Next Week:
The spreadsheet has been cleared and prepared for the week of [date] - [date].

---
Automated by Shift Reports 3.0
```

### Slack Notification

**To:** `#managers` channel (from `SLACK_MANAGERS_CHANNEL_WEBHOOK`)

**Format:** Rich Block Kit message with:
- Week summary stats
- Links to archive files
- Next week date range
- Quick action buttons (if applicable)

---

## Troubleshooting

### Issue: Rollover Fails with "Wrong file" Error

**Cause:** Running on wrong spreadsheet

**Solution:**
```javascript
// Check current file ID
Logger.log(SpreadsheetApp.getActiveSpreadsheet().getId());

// Check configured working file ID
const props = PropertiesService.getScriptProperties();
Logger.log(props.getProperty('WARATAH_WORKING_FILE_ID'));

// Update if needed
props.setProperty('WARATAH_WORKING_FILE_ID', '[correct_id]');
```

---

### Issue: No Archive Folder Created

**Cause:** Archive root folder ID incorrect or missing

**Solution:**
```javascript
// Verify archive folder ID
const props = PropertiesService.getScriptProperties();
const folderId = props.getProperty('ARCHIVE_ROOT_FOLDER_ID');
Logger.log('Archive folder ID: ' + folderId);

// Test access
try {
  const folder = DriveApp.getFolderById(folderId);
  Logger.log('Folder name: ' + folder.getName());
} catch (e) {
  Logger.log('ERROR: ' + e.message);
  // Update to correct ID
  props.setProperty('ARCHIVE_ROOT_FOLDER_ID', '[correct_id]');
}
```

---

### Issue: Dates Not Updating Correctly

**Cause:** Timezone mismatch or TODAY() calculation error

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

## Comparison: In-Place vs. Duplication

| Aspect | In-Place System (Current) | Duplication System (Deprecated) |
|--------|---------------------------|--------------------------------|
| **Working Files** | 1 permanent file | 52+ files per year |
| **Menu Scripts** | Always work | Break with each duplicate |
| **Triggers** | Stable (same file ID) | Need reconfiguration weekly |
| **Storage** | Minimal (archives only) | Massive (every week duplicated) |
| **Maintenance** | Low | High |
| **Risk** | Data loss if mistake | Duplication clutter |

---

**Last Updated:** March 6, 2026
**Status:** ✅ Deployed and automated (Mondays 10:00am)
**Key File:** `WeeklyRolloverInPlaceWaratah.js` (680 LOC)
