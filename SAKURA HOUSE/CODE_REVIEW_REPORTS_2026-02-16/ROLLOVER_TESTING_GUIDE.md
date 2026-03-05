# Sakura House - Rollover Testing Guide

**Created:** February 16, 2026
**Purpose:** Test the newly configured in-place weekly rollover system
**Status:** Ready for user testing

---

## ⚠️ CRITICAL: Test on COPY First, Never on Production

**DO NOT test on the production spreadsheet!** Always test on a copy.

---

## Pre-Testing Setup

### Step 1: Create Test Copy

1. Open the production Sakura House shift report spreadsheet
2. **File → Make a copy**
3. Name it: `TEST - Sakura Shift Reports W.E. [DATE]`
4. Note the file ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/FILE_ID_HERE/edit
   ```

### Step 2: Configure Script Properties for Test File

Open Apps Script editor (Extensions → Apps Script) and run this in the console:

```javascript
// Set test file ID temporarily
PropertiesService.getScriptProperties().setProperty(
  'SAKURA_WORKING_FILE_ID_TEST',
  'PASTE_TEST_FILE_ID_HERE'
);
```

Or update via the setup function:

```javascript
function setTestFileId() {
  const testFileId = 'PASTE_TEST_FILE_ID_HERE';
  PropertiesService.getScriptProperties().setProperty('SAKURA_WORKING_FILE_ID', testFileId);
  Logger.log('Test file ID configured: ' + testFileId);
}
```

### Step 3: Verify Script Properties

Run in Apps Script console:

```javascript
verifyScriptProperties();
```

Check the logs (Ctrl+Enter or Cmd+Enter) and verify:
- ✅ `SAKURA_WORKING_FILE_ID` = your test file ID
- ✅ `ARCHIVE_ROOT_FOLDER_ID` is set
- ✅ `SAKURA_EMAIL_RECIPIENTS` is set
- ✅ All 13 required properties exist

---

## Testing Checklist

### Phase 1: Preview (Dry Run) ✅ SAFE

**Purpose:** Verify rollover logic without making changes

**Steps:**
1. Open your TEST copy spreadsheet
2. From the menu: **Sakura Shift Reports → Rollover → Preview Rollover**
3. Enter admin password when prompted
4. Review the preview output

**Expected Output:**
```
=== ROLLOVER PREVIEW (NO CHANGES) ===

Current week ending: [DATE]
Total revenue: $[AMOUNT]
Days reported: 6/6

--- Summary ---
[Week summary text]

--- Actions (if executed) ---
1. Export PDF to: Archive/2026/2026-02/pdfs/
2. Create snapshot to: Archive/2026/2026-02/sheets/
3. Clear data from all 6 day sheets
4. Update dates to week ending: [NEXT_WEEK_DATE]
5. Verify named ranges
6. Send notifications to 7 recipients
```

**Verify:**
- [ ] Current week ending date is correct
- [ ] Revenue total matches your test data
- [ ] Days reported shows 6/6 (if all days filled)
- [ ] Archive paths look correct
- [ ] Management emails count is 7

**⚠️ If preview fails:**
- Check error message in popup
- Open Apps Script logs: Extensions → Apps Script → View → Logs
- Common issues:
  - Wrong file ID in Script Properties
  - VENUE_NAME not set to 'SAKURA'
  - Named ranges missing (run diagnostics)

---

### Phase 2: Configuration Display ✅ SAFE

**Purpose:** Verify rollover configuration is loaded correctly

**Steps:**
1. From menu: **Sakura Shift Reports → Rollover → Show Rollover Config**
2. Review the configuration

**Expected Output:**
```
IN-PLACE ROLLOVER CONFIGURATION

Working File ID: [YOUR_TEST_FILE_ID]
Archive Root ID: 1a1AbJN4qU7Lt2oyYPxiTn3kG5EEKOf1K
Timezone: Australia/Sydney
Days: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY

Management Emails:
  • evan@sakurahousesydney.com
  • kalisha@sakurahousesydney.com
  • tom@sakurahousesydney.com
  • nick@sakurahousesydney.com
  • cynthia@sakurahousesydney.com
  • adam@pollenhospitality.com
  • properties.litster@gmail.com
```

**Verify:**
- [ ] Working File ID matches your test copy
- [ ] Archive Root ID is correct
- [ ] Timezone is Australia/Sydney
- [ ] 6 day sheets listed (Mon-Sat)
- [ ] 7 management emails listed

---

### Phase 3: PDF Export Test ✅ SAFE (Emails will be sent)

**Purpose:** Test PDF generation and archiving (non-destructive)

**Steps:**
1. Ensure test data exists on MONDAY sheet
2. From menu: **Sakura Shift Reports → Rollover → Test PDF Export**
   (You may need to add this function temporarily - see below)

**Test Function (Add to WeeklyRolloverInPlace.gs):**
```javascript
/**
 * Test PDF export without full rollover.
 * Accessible via menu for testing.
 */
function testPdfExport() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Validate we're on test file
  const config = getRolloverConfig_();
  if (spreadsheet.getId() !== config.WORKING_FILE_ID) {
    ui.alert('Wrong file!',
      'This must run on the configured working file.\n\n' +
      'Expected: ' + config.WORKING_FILE_ID + '\n' +
      'Current: ' + spreadsheet.getId(),
      ui.ButtonSet.OK
    );
    return;
  }

  ui.alert('PDF Export Test',
    'This will:\n' +
    '1. Generate PDF of first day sheet\n' +
    '2. Save to archive folder\n' +
    '3. Email to all management\n\n' +
    'Continue?',
    ui.ButtonSet.OK_CANCEL
  );

  const summary = generateWeekSummary_RolloverSaks_(spreadsheet);
  const result = exportPdfToArchive_(spreadsheet, summary.weekEndDate);

  const msg =
    'PDF Export Test Complete\n\n' +
    'Exported: ' + (result.exported ? 'YES' : 'NO') + '\n' +
    'Archive Path: ' + result.archivePath + '\n' +
    'Emailed: ' + (result.emailed ? 'YES' : 'NO') + '\n\n' +
    (result.fileUrl ? 'Drive URL:\n' + result.fileUrl : '');

  ui.alert(msg);
}
```

**Then add to menu (MenuSakura.gs):**
```javascript
// In createRolloverMenu_() function, add:
rolloverMenu.addItem('🧪 Test PDF Export', 'testPdfExport');
```

**Expected Result:**
- [ ] PDF appears in Drive under Archive/[YEAR]/[YEAR-MONTH]/pdfs/
- [ ] Email received by all 7 management recipients
- [ ] Email contains PDF attachment
- [ ] Email contains Drive link to PDF

---

### Phase 4: Full Rollover Test ⚠️ DESTRUCTIVE

**⚠️ WARNING: This will CLEAR DATA from your test copy!**

Only proceed if you:
- ✅ Confirmed this is a TEST copy, not production
- ✅ Completed Phases 1-3 successfully
- ✅ Have production file backed up separately

**Steps:**

1. **Backup your test copy first:**
   - File → Make a copy
   - Name it: `BACKUP - Sakura Test Before Rollover`

2. **Execute rollover:**
   - From menu: **Sakura Shift Reports → Rollover → Execute Rollover**
   - Enter admin password when prompted
   - Confirm all prompts

3. **Monitor execution:**
   - Watch the status messages
   - Check Apps Script logs for errors

**Expected Flow:**
```
1. Validating preconditions...
2. Generating week summary...
3. Exporting PDF to archive...
4. Creating snapshot...
5. Clearing sheet data...
6. Updating dates...
7. Verifying named ranges...
8. Sending notifications...
✅ Rollover complete!
```

**Verify After Execution:**
- [ ] All 6 day sheets are cleared (data removed, structure intact)
- [ ] Sheet names updated to next week's dates
- [ ] PDF in archive folder (Archive/YYYY/YYYY-MM/pdfs/)
- [ ] Snapshot in archive folder (Archive/YYYY/YYYY-MM/sheets/)
- [ ] Email received with rollover summary
- [ ] Slack notification posted (if configured)
- [ ] Named ranges still exist (check: Data → Named ranges)

**Check Named Ranges:**
```javascript
// Run in Apps Script console:
function checkNamedRanges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ranges = ss.getNamedRanges();
  Logger.log('Named ranges found: ' + ranges.length);
  ranges.forEach(r => Logger.log('  - ' + r.getName()));
}
```

Expected: ~100+ named ranges (18 fields × 6 days)

---

## Common Issues & Solutions

### Issue: "Wrong file!" error

**Cause:** Script Properties `SAKURA_WORKING_FILE_ID` doesn't match current file

**Solution:**
```javascript
// Update to current file:
PropertiesService.getScriptProperties().setProperty(
  'SAKURA_WORKING_FILE_ID',
  SpreadsheetApp.getActiveSpreadsheet().getId()
);
```

### Issue: Named ranges disappear

**Cause:** Using `clear()` instead of `clearContent()`

**Solution:** Verify the code uses `clearContent()` everywhere:
```javascript
// ✅ CORRECT:
range.clearContent();

// ❌ WRONG:
range.clear();
```

### Issue: PDF generation fails

**Possible causes:**
1. Missing OAuth token permissions
2. Sheet ID mismatch
3. Export URL malformed

**Debug:**
```javascript
// Test PDF generation directly:
function testPdfGeneration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('MONDAY');
  const pdfBlob = generatePdfForSheet_NoUI_(ss, sheet, 'test.pdf');

  if (pdfBlob) {
    Logger.log('✅ PDF generated: ' + pdfBlob.getBytes().length + ' bytes');
  } else {
    Logger.log('❌ PDF generation failed - check logs above');
  }
}
```

### Issue: Emails not sending

**Possible causes:**
1. `SAKURA_EMAIL_RECIPIENTS` not configured
2. Email quota exceeded (100/day for free accounts)
3. Invalid email addresses

**Debug:**
```javascript
function testEmailConfig() {
  const config = getRolloverConfig_();
  Logger.log('Management emails: ' + config.MANAGEMENT_EMAILS.length);
  config.MANAGEMENT_EMAILS.forEach(e => Logger.log('  - ' + e));
}
```

### Issue: Archive folder not found

**Cause:** `ARCHIVE_ROOT_FOLDER_ID` incorrect or Drive permissions missing

**Solution:**
1. Verify folder ID: https://drive.google.com/drive/folders/[FOLDER_ID]
2. Check folder exists: 1a1AbJN4qU7Lt2oyYPxiTn3kG5EEKOf1K
3. Verify Drive permissions for Apps Script

---

## Rollback Procedure

If rollover fails mid-execution:

### Option 1: Restore from Snapshot (Recommended)

If snapshot was created before failure:

1. Go to Archive folder in Drive
2. Find most recent snapshot: `Sakura Shift Report W.E. [DATE]`
3. Make a copy
4. Update Script Properties to point to this copy
5. Investigate failure cause before re-attempting

### Option 2: Manual Restore

If no snapshot exists:

1. Restore from your backup copy
2. Copy file ID of restored file
3. Update Script Properties:
   ```javascript
   PropertiesService.getScriptProperties().setProperty(
     'SAKURA_WORKING_FILE_ID',
     'RESTORED_FILE_ID_HERE'
   );
   ```

---

## Production Deployment Checklist

**DO NOT deploy to production until:**

- [ ] All 4 test phases passed on TEST copy
- [ ] Named ranges verified intact after rollover
- [ ] PDF archived correctly to Drive
- [ ] Emails sent to all recipients
- [ ] Snapshot created successfully
- [ ] Data cleared correctly (no residual values)
- [ ] Dates updated correctly to next week
- [ ] Script Properties configured correctly for PRODUCTION file ID
- [ ] Slack notifications tested (if used)
- [ ] Backup of production file created before first run
- [ ] User training completed (how to trigger rollover)
- [ ] Rollback procedure documented and tested

---

## Production Setup

When ready to deploy to production:

### 1. Update Script Properties

```javascript
// Run setupScriptProperties_Sakura() and provide:
// - SAKURA_WORKING_FILE_ID: [production file ID]
// - All webhooks (if not already set)
// - Menu password (if not already set)
```

### 2. Verify Configuration

```javascript
verifyScriptProperties();
```

Ensure `SAKURA_WORKING_FILE_ID` points to **production file**, not test.

### 3. Schedule Automated Trigger (Optional)

If you want rollover to run automatically:

1. Apps Script Editor → Triggers (clock icon)
2. Add Trigger:
   - Function: `executeInPlaceRollover`
   - Event: Time-driven
   - Day timer: Every Monday
   - Time: 1am - 2am
3. Save

**⚠️ WARNING:** Automated triggers will run WITHOUT password protection!
Only enable after thoroughly testing and ensuring Script Properties are correct.

### 4. First Production Run

**Recommended approach:**
1. Run manually first (not via trigger)
2. Use "Preview Rollover" first
3. Then "Execute Rollover"
4. Verify results before enabling automated trigger

---

## Support & Troubleshooting

### Debug Mode

Enable verbose logging:

```javascript
// Add to top of WeeklyRolloverInPlace.gs:
const DEBUG_MODE = true;

// Then in functions, add:
if (DEBUG_MODE) {
  Logger.log('[DEBUG] Variable state: ' + JSON.stringify(variable));
}
```

### Check Execution Logs

**View logs:**
1. Apps Script Editor
2. View → Logs (Ctrl+Enter or Cmd+Enter)
3. Or: Executions (left sidebar) → View execution logs

**Look for:**
- ✅ Success messages: "PDF generated", "Snapshot created", etc.
- ⚠️ Warnings: Usually non-blocking
- ❌ Errors: Blocking issues that stopped execution

### Test Individual Components

```javascript
// Test config loading:
function testConfig() {
  const config = getRolloverConfig_();
  Logger.log('Config loaded: ' + JSON.stringify(config, null, 2));
}

// Test sheet finding:
function testSheetFinding() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = findSheetByPrefix_(ss, 'MONDAY');
  Logger.log('Found sheet: ' + (sheet ? sheet.getName() : 'NOT FOUND'));
}

// Test validation:
function testValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    validateRolloverPreconditions_(ss);
    Logger.log('✅ Validation passed');
  } catch (error) {
    Logger.log('❌ Validation failed: ' + error.message);
  }
}
```

---

**Last Updated:** February 16, 2026
**Next Steps:** Complete Phase 1-4 testing on TEST copy before production deployment
