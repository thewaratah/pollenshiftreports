/**
 * WeeklyRolloverInPlace.gs
 *
 * In-place weekly rollover system for The Waratah.
 * Eliminates duplication-based approach that breaks menus.
 *
 * Flow:
 * 1. Archive previous week (PDF + snapshot)
 * 2. Clear data (using clearContent() to preserve structure)
 * 3. Update dates to next week
 * 4. Send notifications
 *
 * Created: 2026-02-15
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Day sheets in order (5 days - Waratah operates Wed-Sun)
 */
const DAY_SHEETS = [
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

/**
 * Fields to clear during rollover
 * Each field specifies the range to clear for each day sheet
 */
const CLEARABLE_FIELDS = {
  // Header fields (clear for fresh entry)
  date: 'B3:F3',
  mod: 'B4:F4',
  staff: 'B5:F5',

  // Financial fields (B37:B40 are formulas — DO NOT CLEAR)
  netRevenue: 'B34',
  covers: 'B36',
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

/**
 * Date field to UPDATE (not clear)
 */
const DATE_FIELD = 'B3:F3';

// ============================================================================
// MAIN ROLLOVER FUNCTION
// ============================================================================

/**
 * Performs weekly in-place rollover
 *
 * Password-protected function that:
 * 1. Validates preconditions
 * 2. Generates week summary
 * 3. Exports PDF to archive
 * 4. Creates Google Sheets snapshot to archive
 * 5. Clears all data fields
 * 6. Updates dates to next week
 * 7. Sends notifications
 *
 * Triggered automatically: Monday 10:00am
 * Can also be run manually via menu (with password)
 */
function performWeeklyRollover() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('❌ Could not acquire lock — another rollover may be running.');
    return;
  }

  try {
    Logger.log('========================================');
    Logger.log('WEEKLY ROLLOVER - Starting');
    Logger.log('========================================');

    // 1. Validate preconditions
    Logger.log('Step 1: Validating preconditions...');
    validatePreconditions_();
    Logger.log('✅ Preconditions valid');

    // 2. Generate week summary (if previous week exists)
    Logger.log('Step 2: Generating week summary...');
    let summary;
    let pdfFile;
    let snapshotFile;

    try {
      summary = generateWeekSummary_();
      Logger.log(`✅ Week summary: ${summary.weekEnding}`);

      // 3. Export PDF to archive (only if previous week exists)
      Logger.log('Step 3: Exporting PDF to archive...');
      pdfFile = exportPdfToArchive_(summary);
      Logger.log(`✅ PDF created: ${pdfFile.getName()}`);

      // 4. Create archive snapshot (only if previous week exists)
      Logger.log('Step 4: Creating Google Sheets snapshot...');
      snapshotFile = createArchiveSnapshot_(summary);
      Logger.log(`✅ Snapshot created: ${snapshotFile.getName()}`);

    } catch (e) {
      if (e.message.includes('No valid dates found')) {
        // Fresh template - no previous data to archive
        summary = null;
        pdfFile = null;
        snapshotFile = null;
        Logger.log('⚠️ No previous week data found (fresh template)');
        Logger.log('Skipping archiving steps (Steps 3-4)');
      } else {
        throw e; // Re-throw if it's a different error
      }
    }

    // 5. Clear all sheet data
    Logger.log('Step 5: Clearing all data fields...');
    clearAllSheetData_();
    Logger.log('✅ All data cleared');

    // 6. Update dates to next week
    Logger.log('Step 6: Updating dates to next week...');
    const nextWeekStart = updateDatesToNextWeek_();
    Logger.log(`✅ Dates updated to week starting: ${nextWeekStart}`);

    // 7. Send notifications (only if previous week was archived)
    if (summary && pdfFile && snapshotFile) {
      Logger.log('Step 7: Sending rollover notifications...');
      sendRolloverNotifications_(summary, nextWeekStart, pdfFile, snapshotFile);
      Logger.log('✅ Notifications sent');
    } else {
      Logger.log('Step 7: Skipping notifications (fresh template - no archive)');
    }

    Logger.log('========================================');
    Logger.log('WEEKLY ROLLOVER - Completed Successfully');
    Logger.log('========================================');

    // Show appropriate completion message (safe for trigger context)
    try {
      if (summary && pdfFile && snapshotFile) {
        SpreadsheetApp.getUi().alert(
          'Weekly Rollover Complete',
          `Previous week archived successfully.\n\nPDF: ${pdfFile.getName()}\nSnapshot: ${snapshotFile.getName()}\n\nDates updated to week starting: ${Utilities.formatDate(nextWeekStart, 'Australia/Sydney', 'dd/MM/yyyy')}`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } else {
        SpreadsheetApp.getUi().alert(
          'Weekly Rollover Complete (Fresh Template)',
          `No previous week data found (fresh template).\n\nDates updated to week starting: ${Utilities.formatDate(nextWeekStart, 'Australia/Sydney', 'dd/MM/yyyy')}\n\nNext rollover will include archiving.`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      }
    } catch (uiErr) {
      Logger.log('(UI alert skipped — running from trigger context)');
    }

  } catch (error) {
    Logger.log(`❌ ERROR: ${error.message}`);
    Logger.log(error.stack);

    // Notify Evan via Slack (works in trigger context where UI alerts don't)
    notifyError_('performWeeklyRollover', error);

    try {
      SpreadsheetApp.getUi().alert(
        'Rollover Failed',
        `Error: ${error.message}\n\nCheck Apps Script logs for details.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiErr) {
      Logger.log('(UI error alert skipped — running from trigger context)');
    }

    throw error;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates preconditions before rollover
 *
 * Checks:
 * - Correct spreadsheet (working file ID matches)
 * - Venue name is WARATAH
 * - Archive folder exists
 * - Previous week dates are complete
 *
 * @throws {Error} If any validation fails
 */
function validatePreconditions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProps = PropertiesService.getScriptProperties();

  // 1. Check we're in the correct file
  const workingFileId = scriptProps.getProperty('WARATAH_WORKING_FILE_ID');
  if (!workingFileId) {
    throw new Error('WARATAH_WORKING_FILE_ID not set in Script Properties');
  }

  if (ss.getId() !== workingFileId) {
    throw new Error(`Wrong file! This is not "The Waratah - Current Week". Expected ID: ${workingFileId}, Got: ${ss.getId()}`);
  }

  // 2. Check venue name
  const venueName = scriptProps.getProperty('VENUE_NAME');
  if (venueName !== 'WARATAH') {
    throw new Error(`Wrong venue! Expected WARATAH, got: ${venueName}`);
  }

  // 3. Check archive folder exists
  const archiveFolderId = scriptProps.getProperty('ARCHIVE_ROOT_FOLDER_ID');
  if (!archiveFolderId) {
    throw new Error('ARCHIVE_ROOT_FOLDER_ID not set in Script Properties');
  }

  try {
    DriveApp.getFolderById(archiveFolderId);
  } catch (e) {
    throw new Error(`Archive folder not found: ${archiveFolderId}`);
  }

  // 4. Check WEDNESDAY sheet exists (date validation happens in summary generation)
  const wednesdaySheet = getSheetByDayPrefix_(ss, 'WEDNESDAY');
  if (!wednesdaySheet) {
    throw new Error('WEDNESDAY sheet not found');
  }

  const wednesdayDate = wednesdaySheet.getRange('B3').getValue();
  if (wednesdayDate && wednesdayDate instanceof Date) {
    Logger.log(`Validation passed. Working file: ${ss.getName()}, Previous week starting: ${wednesdayDate}`);
  } else {
    Logger.log(`Validation passed. Working file: ${ss.getName()}. No previous week data (fresh template).`);
  }
}

// ============================================================================
// WEEK SUMMARY FUNCTIONS
// ============================================================================

/**
 * Generates summary of previous week
 *
 * Calculates:
 * - Week ending date
 * - Total net revenue
 * - Total tips
 * - Number of shifts completed
 * - Total to-dos
 *
 * @returns {Object} Summary object with week statistics
 */
function generateWeekSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let totalNetRevenue = 0;
  let totalCashTips = 0;
  let totalCardTips = 0;
  let shiftsCompleted = 0;
  let totalTodos = 0;
  let weekEndingDate = null;

  // Iterate through all day sheets
  DAY_SHEETS.forEach((dayName, index) => {
    const sheet = getSheetByDayPrefix_(ss, dayName);
    if (!sheet) {
      Logger.log(`⚠️ Warning: ${dayName} sheet not found, skipping`);
      return;
    }

    // Get date
    const date = sheet.getRange('B3').getValue();
    if (date && date instanceof Date) {
      weekEndingDate = date; // Last day (Sunday) will be week ending
      shiftsCompleted++;

      // Get financial data
      const netRev = parseFloat(sheet.getRange('B34').getValue()) || 0;
      const cashTips = parseFloat(sheet.getRange('B33').getValue()) || 0;
      const cardTips = parseFloat(sheet.getRange('B32').getValue()) || 0;

      totalNetRevenue += netRev;
      totalCashTips += cashTips;
      totalCardTips += cardTips;

      // Count to-dos (A53:E61 = 9 rows, merged A:E — value lives in col A)
      const todoRange = sheet.getRange('A53:E61');
      const todoValues = todoRange.getValues();
      todoValues.forEach(row => {
        if (row[0]) totalTodos++; // If first column has content, count as todo
      });
    }
  });

  if (!weekEndingDate) {
    throw new Error('No valid dates found in week. Cannot generate summary.');
  }

  return {
    weekEnding: Utilities.formatDate(weekEndingDate, 'Australia/Sydney', 'dd.MM.yyyy'),
    weekEndingDate: weekEndingDate,
    totalNetRevenue: totalNetRevenue,
    totalCashTips: totalCashTips,
    totalCardTips: totalCardTips,
    totalTips: totalCashTips + totalCardTips,
    shiftsCompleted: shiftsCompleted,
    totalTodos: totalTodos
  };
}

// ============================================================================
// ARCHIVE EXPORT FUNCTIONS
// ============================================================================

/**
 * Exports PDF of entire spreadsheet to archive
 *
 * Creates PDF in: Archive/YYYY/YYYY-MM/pdfs/
 * Filename: "Waratah Shift Report W.E. DD.MM.YYYY.pdf"
 *
 * @param {Object} summary - Week summary object
 * @returns {File} Created PDF file
 */
function exportPdfToArchive_(summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProps = PropertiesService.getScriptProperties();

  // 1. Get archive folder
  const archiveRootId = scriptProps.getProperty('ARCHIVE_ROOT_FOLDER_ID');
  const archiveRoot = DriveApp.getFolderById(archiveRootId);

  // 2. Create/get year/month/pdfs folder structure
  const year = Utilities.formatDate(summary.weekEndingDate, 'Australia/Sydney', 'yyyy');
  const yearMonth = Utilities.formatDate(summary.weekEndingDate, 'Australia/Sydney', 'yyyy-MM');

  let yearFolder = getOrCreateFolder_(archiveRoot, year);
  let monthFolder = getOrCreateFolder_(yearFolder, yearMonth);
  let pdfsFolder = getOrCreateFolder_(monthFolder, 'pdfs');

  // 3. Generate PDF
  const blob = ss.getAs('application/pdf');
  const filename = `Waratah Shift Report W.E. ${summary.weekEnding}.pdf`;

  // 4. Create file in pdfs folder
  const pdfFile = pdfsFolder.createFile(blob);
  pdfFile.setName(filename);

  Logger.log(`PDF created: ${filename} in ${pdfsFolder.getName()}`);

  return pdfFile;
}

/**
 * Creates Google Sheets snapshot in archive
 *
 * Creates copy in: Archive/YYYY/YYYY-MM/sheets/
 * Filename: "Waratah Shift Report W.E. DD.MM.YYYY"
 *
 * Note: This is a static snapshot (scripts don't copy, which is fine)
 *
 * @param {Object} summary - Week summary object
 * @returns {File} Created snapshot file
 */
function createArchiveSnapshot_(summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProps = PropertiesService.getScriptProperties();

  // 1. Get archive folder
  const archiveRootId = scriptProps.getProperty('ARCHIVE_ROOT_FOLDER_ID');
  const archiveRoot = DriveApp.getFolderById(archiveRootId);

  // 2. Create/get year/month/sheets folder structure
  const year = Utilities.formatDate(summary.weekEndingDate, 'Australia/Sydney', 'yyyy');
  const yearMonth = Utilities.formatDate(summary.weekEndingDate, 'Australia/Sydney', 'yyyy-MM');

  let yearFolder = getOrCreateFolder_(archiveRoot, year);
  let monthFolder = getOrCreateFolder_(yearFolder, yearMonth);
  let sheetsFolder = getOrCreateFolder_(monthFolder, 'sheets');

  // 3. Make copy
  const filename = `Waratah Shift Report W.E. ${summary.weekEnding}`;
  const driveFile = DriveApp.getFileById(ss.getId());
  const snapshot = driveFile.makeCopy(filename, sheetsFolder);

  Logger.log(`Snapshot created: ${filename} in ${sheetsFolder.getName()}`);

  return snapshot;
}

/**
 * Finds a sheet whose name starts with the given day name
 *
 * Handles tab names with appended dates (e.g. "WEDNESDAY 26/02")
 * so lookups work before and after renaming.
 *
 * @param {Spreadsheet} ss - The spreadsheet
 * @param {string} dayName - Day prefix to match (e.g. "WEDNESDAY")
 * @returns {Sheet|null} The sheet, or null if not found
 */
function getSheetByDayPrefix_(ss, dayName) {
  return ss.getSheets().find(s => s.getName().startsWith(dayName)) || null;
}

/**
 * Gets existing folder or creates new one
 *
 * @param {Folder} parentFolder - Parent folder
 * @param {string} folderName - Name of folder to get/create
 * @returns {Folder} The folder
 */
function getOrCreateFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

// ============================================================================
// DATA CLEARING FUNCTIONS
// ============================================================================

/**
 * Clears all data fields on all day sheets
 *
 * CRITICAL: Uses clearContent() NOT clear()
 * - clearContent() removes values only (preserves formatting, validation, formulas)
 * - clear() destroys everything (breaks merged cells, validation, formulas)
 *
 * Clears all fields defined in CLEARABLE_FIELDS constant
 */
function clearAllSheetData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let totalFieldsCleared = 0;

  // Iterate through all day sheets
  DAY_SHEETS.forEach(dayName => {
    const sheet = getSheetByDayPrefix_(ss, dayName);
    if (!sheet) {
      Logger.log(`⚠️ Warning: ${dayName} sheet not found, skipping`);
      return;
    }

    Logger.log(`Clearing ${sheet.getName()}...`);

    // Clear each field
    Object.keys(CLEARABLE_FIELDS).forEach(fieldKey => {
      const rangeNotation = CLEARABLE_FIELDS[fieldKey];

      try {
        const range = sheet.getRange(rangeNotation);
        range.clearContent(); // ✅ CRITICAL: clearContent() not clear()
        totalFieldsCleared++;
      } catch (e) {
        Logger.log(`⚠️ Warning: Failed to clear ${dayName} ${fieldKey} (${rangeNotation}): ${e.message}`);
      }
    });
  });

  Logger.log(`✅ Cleared ${totalFieldsCleared} fields across ${DAY_SHEETS.length} sheets`);
}

// ============================================================================
// DATE UPDATE FUNCTIONS
// ============================================================================

/**
 * Updates all day sheet dates to next week
 *
 * Calculates next Wednesday based on TODAY'S date and sets:
 * - WEDNESDAY: next Wednesday
 * - THURSDAY: next Wednesday + 1 day
 * - FRIDAY: next Wednesday + 2 days
 * - SATURDAY: next Wednesday + 3 days
 * - SUNDAY: next Wednesday + 4 days
 *
 * Updates DATE_FIELD (B3:F3) on each sheet
 *
 * @returns {Date} Next Wednesday's date
 */
function updateDatesToNextWeek_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Get TODAY's date (in Australia/Sydney timezone)
  const today = new Date();

  // 2. Calculate next Wednesday from today
  // Wednesday = day 3 (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, ...)
  const todayDayOfWeek = today.getDay();
  let daysUntilWednesday;

  if (todayDayOfWeek === 0) {
    // Sunday → Wednesday is 3 days away
    daysUntilWednesday = 3;
  } else if (todayDayOfWeek === 1) {
    // Monday → Wednesday is 2 days away
    daysUntilWednesday = 2;
  } else if (todayDayOfWeek === 2) {
    // Tuesday → Wednesday is 1 day away
    daysUntilWednesday = 1;
  } else {
    // Wednesday (3) through Saturday (6) → next Wednesday is 7 - dayOfWeek + 3 days away
    daysUntilWednesday = (7 - todayDayOfWeek) + 3;
  }

  const nextWednesday = new Date(today);
  nextWednesday.setDate(today.getDate() + daysUntilWednesday);

  Logger.log(`Today: ${Utilities.formatDate(today, 'Australia/Sydney', 'EEE dd/MM/yyyy')}`);
  Logger.log(`Next Wednesday: ${Utilities.formatDate(nextWednesday, 'Australia/Sydney', 'dd/MM/yyyy')}`);

  // 3. Update each day sheet
  DAY_SHEETS.forEach((dayName, index) => {
    const sheet = getSheetByDayPrefix_(ss, dayName);
    if (!sheet) {
      Logger.log(`⚠️ Warning: ${dayName} sheet not found, skipping`);
      return;
    }

    // Calculate this day's date (Wednesday + index days)
    const thisDate = new Date(nextWednesday);
    thisDate.setDate(thisDate.getDate() + index);

    // Set date in B3:F3 (merged range)
    const dateRange = sheet.getRange(DATE_FIELD);
    dateRange.setValue(thisDate);
    dateRange.setNumberFormat('dd/MM/yyyy'); // Enforce AU date format regardless of template default

    // Rename tab to include the date (e.g. "WEDNESDAY 26/02")
    const dateLabel = Utilities.formatDate(thisDate, 'Australia/Sydney', 'dd/MM/yyyy');
    sheet.setName(`${dayName} ${dateLabel}`);

    Logger.log(`${dayName}: ${Utilities.formatDate(thisDate, 'Australia/Sydney', 'dd/MM/yyyy')}`);
  });

  return nextWednesday;
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Sends rollover notifications via email and Slack
 *
 * @param {Object} summary - Week summary object
 * @param {Date} nextWeekStart - Next week's Monday date
 * @param {File} pdfFile - Archived PDF file
 * @param {File} snapshotFile - Archived snapshot file
 */
function sendRolloverNotifications_(summary, nextWeekStart, pdfFile, snapshotFile) {
  const scriptProps = PropertiesService.getScriptProperties();

  // 1. Build notification content
  const weekEndingFormatted = summary.weekEnding;
  const nextWeekFormatted = Utilities.formatDate(nextWeekStart, 'Australia/Sydney', 'dd/MM/yyyy');

  const emailBody = `
    <h2>Weekly Rollover Complete - The Waratah</h2>

    <p><strong>Previous Week Archived:</strong> W.E. ${weekEndingFormatted}</p>

    <h3>Week Summary</h3>
    <ul>
      <li>Shifts Completed: ${summary.shiftsCompleted}/5</li>
      <li>Total Net Revenue: $${summary.totalNetRevenue.toFixed(2)}</li>
      <li>Total Tips: $${summary.totalTips.toFixed(2)} (Cash: $${summary.totalCashTips.toFixed(2)}, Card: $${summary.totalCardTips.toFixed(2)})</li>
      <li>Total To-Dos: ${summary.totalTodos}</li>
    </ul>

    <h3>Archived Files</h3>
    <ul>
      <li>PDF: <a href="${pdfFile.getUrl()}">${pdfFile.getName()}</a></li>
      <li>Google Sheets Snapshot: <a href="${snapshotFile.getUrl()}">${snapshotFile.getName()}</a></li>
    </ul>

    <h3>New Week</h3>
    <p><strong>Week Starting:</strong> ${nextWeekFormatted}</p>
    <p>All data cleared. Dates updated. Ready for new week.</p>
  `;

  // 2. Send email
  try {
    const recipientsProp = scriptProps.getProperty('WARATAH_EMAIL_RECIPIENTS') || '';
    let emailTo;
    try {
      const recipientsMap = JSON.parse(recipientsProp);
      emailTo = Object.keys(recipientsMap).join(',');
    } catch (parseErr) {
      // Fallback: treat as comma-separated string or single address
      emailTo = recipientsProp || 'evan@pollenhospitality.com';
    }
    GmailApp.sendEmail(
      emailTo,
      `Waratah Weekly Rollover - W.E. ${weekEndingFormatted}`,
      '',
      { htmlBody: emailBody }
    );
    Logger.log('✅ Email sent to: ' + emailTo);
  } catch (e) {
    Logger.log(`⚠️ Email notification failed: ${e.message}`);
  }

  // 3. Send Slack notification
  try {
    const slackWebhook = scriptProps.getProperty('WARATAH_SLACK_WEBHOOK_LIVE');

    if (slackWebhook) {
      const slackBlocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'Weekly Rollover Complete - The Waratah' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Previous Week Archived:* W.E. ${weekEndingFormatted}\n*New Week Starting:* ${nextWeekFormatted}`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Shifts:*\n${summary.shiftsCompleted}/5` },
            { type: 'mrkdwn', text: `*Net Revenue:*\n$${summary.totalNetRevenue.toFixed(2)}` },
            { type: 'mrkdwn', text: `*Total Tips:*\n$${summary.totalTips.toFixed(2)}` },
            { type: 'mrkdwn', text: `*To-Dos:*\n${summary.totalTodos}` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View PDF' },
              url: pdfFile.getUrl()
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Snapshot' },
              url: snapshotFile.getUrl()
            }
          ]
        }
      ];

      const slackResp = UrlFetchApp.fetch(slackWebhook, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          blocks: slackBlocks,
          text: `Weekly Rollover Complete - W.E. ${weekEndingFormatted}`
        }),
        muteHttpExceptions: true
      });
      const slackCode = slackResp.getResponseCode();
      if (slackCode < 200 || slackCode >= 300) {
        Logger.log('⚠️ Slack webhook returned HTTP ' + slackCode + ': ' + slackResp.getContentText());
      } else {
        Logger.log('✅ Slack notification sent');
      }
    }
  } catch (e) {
    Logger.log(`⚠️ Slack notification failed: ${e.message}`);
  }
}

// ============================================================================
// PREVIEW / DRY RUN FUNCTIONS
// ============================================================================

/**
 * Preview rollover without making changes (dry run)
 *
 * Shows what WOULD happen without actually:
 * - Clearing data
 * - Updating dates
 * - Creating archive files
 * - Sending notifications
 *
 * Use this to test before running actual rollover
 */
function previewRollover() {
  const ui = SpreadsheetApp.getUi();

  try {
    Logger.log('========================================');
    Logger.log('PREVIEW ROLLOVER (DRY RUN)');
    Logger.log('========================================');

    // 1. Validate
    Logger.log('Validating preconditions...');
    validatePreconditions_();
    Logger.log('✅ Validation passed');

    // 2. Generate summary (if previous week exists)
    Logger.log('Generating week summary...');
    let summary;
    try {
      summary = generateWeekSummary_();
    } catch (e) {
      if (e.message.includes('No valid dates found')) {
        // Fresh template - no previous week to summarize
        summary = null;
        Logger.log('⚠️ No previous week data found (fresh template)');
      } else {
        throw e;
      }
    }

    // 3. Calculate next week based on today
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    let daysUntilWednesday;

    if (todayDayOfWeek === 0) {
      daysUntilWednesday = 3; // Sunday → Wednesday
    } else if (todayDayOfWeek === 1) {
      daysUntilWednesday = 2; // Monday → Wednesday
    } else if (todayDayOfWeek === 2) {
      daysUntilWednesday = 1; // Tuesday → Wednesday
    } else {
      daysUntilWednesday = (7 - todayDayOfWeek) + 3; // Wed-Sat → next Wednesday
    }

    const nextWednesday = new Date(today);
    nextWednesday.setDate(today.getDate() + daysUntilWednesday);

    // 4. Build preview report
    let report = '=== ROLLOVER PREVIEW ===\n\n';

    if (summary) {
      // Previous week exists - show summary and archive info
      report += '📋 PREVIOUS WEEK SUMMARY:\n';
      report += `  Week Ending: ${summary.weekEnding}\n`;
      report += `  Shifts Completed: ${summary.shiftsCompleted}/5\n`;
      report += `  Total Net Revenue: $${summary.totalNetRevenue.toFixed(2)}\n`;
      report += `  Total Tips: $${summary.totalTips.toFixed(2)}\n`;
      report += `  Total To-Dos: ${summary.totalTodos}\n\n`;

      report += '📁 ARCHIVE FILES (would create):\n';
      report += `  PDF: Waratah Shift Report W.E. ${summary.weekEnding}.pdf\n`;
      report += `  Snapshot: Waratah Shift Report W.E. ${summary.weekEnding}\n\n`;
    } else {
      // Fresh template - no previous week
      report += '📋 PREVIOUS WEEK SUMMARY:\n';
      report += `  No previous week data found (fresh template)\n`;
      report += `  Archiving will be skipped\n\n`;
    }

    report += '🗑️ FIELDS TO CLEAR (per day sheet):\n';
    Object.keys(CLEARABLE_FIELDS).forEach(fieldKey => {
      report += `  ${fieldKey}: ${CLEARABLE_FIELDS[fieldKey]}\n`;
    });
    report += `\n  Total: ${Object.keys(CLEARABLE_FIELDS).length} fields × 5 days = ${Object.keys(CLEARABLE_FIELDS).length * 5} ranges\n\n`;

    report += '📅 NEW WEEK DATES (would update):\n';
    DAY_SHEETS.forEach((dayName, index) => {
      const thisDate = new Date(nextWednesday);
      thisDate.setDate(thisDate.getDate() + index);
      report += `  ${dayName}: ${Utilities.formatDate(thisDate, 'Australia/Sydney', 'dd/MM/yyyy')}\n`;
    });

    report += '\n✅ PREVIEW COMPLETE - No changes made\n';
    report += 'Run performWeeklyRollover() to execute actual rollover';

    Logger.log(report);

    ui.alert(
      'Rollover Preview (Dry Run)',
      report,
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`❌ Preview failed: ${error.message}`);
    ui.alert(
      'Preview Failed',
      `Error: ${error.message}\n\nCheck Apps Script logs for details.`,
      ui.ButtonSet.OK
    );
  }
}

// ============================================================================
// TRIGGER SETUP FUNCTIONS
// ============================================================================

/**
 * Creates time-based trigger for weekly rollover
 *
 * Trigger: Monday 10:00am (every week)
 *
 * Run this once to set up automation.
 * Check Apps Script Editor → Triggers to verify.
 */
function createWeeklyRolloverTrigger() {
  // Remove existing rollover triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'performWeeklyRollover') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`Deleted existing trigger: ${trigger.getUniqueId()}`);
    }
  });

  // Create new trigger
  ScriptApp.newTrigger('performWeeklyRollover')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(0)
    .create();

  Logger.log('✅ Weekly rollover trigger created: Monday 10:00am');

  SpreadsheetApp.getUi().alert(
    'Trigger Created',
    'Weekly rollover trigger created successfully.\n\nSchedule: Monday 10:00am\n\nVerify in Apps Script Editor → Triggers',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================================
// ONE-OFF UTILITY FUNCTIONS
// ============================================================================

/**
 * ONE-OFF UTILITY — fixSheetNamesAndDateFormat
 *
 * Immediately renames the 5 day sheet tabs and fixes the B3 display format
 * without waiting for or running the full rollover.
 *
 * Use this when:
 *   - Tabs are currently bare names (e.g. "WEDNESDAY") and need the date appended
 *   - B3 is showing the wrong date format and needs to be set to dd/MM/yyyy
 *
 * What it does for each day sheet:
 *   1. Reads the date value from B3:F3 (the DATE_FIELD merged range)
 *   2. Formats it as 'dd/MM/yyyy' using Australia/Sydney timezone
 *   3. Renames the tab to "{DAYNAME} {formattedDate}" (e.g. "WEDNESDAY 26/02/2026")
 *   4. Calls setNumberFormat('dd/MM/yyyy') on B3:F3 to fix the display
 *
 * Safety:
 *   - If B3 is empty or contains a non-Date value, the sheet is skipped with a warning
 *   - Only the 5 day sheets are touched (matched by DAY_SHEETS prefix); all others
 *     (e.g. ADMIN, DATA) are ignored
 *
 * Usage: Run directly from the Apps Script editor (no parameters needed).
 *        Also available via: Admin Tools → Setup & Utilities → Fix Tab Names & Date Format
 */
function fixSheetNamesAndDateFormat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timezone = 'Australia/Sydney';
  const dateFormat = 'dd/MM/yyyy';

  let fixed = 0;
  let skipped = 0;

  Logger.log('========================================');
  Logger.log('fixSheetNamesAndDateFormat — Starting');
  Logger.log('========================================');

  DAY_SHEETS.forEach(function(dayName) {
    // Locate the sheet — works for bare names ("WEDNESDAY") and
    // already-renamed names ("WEDNESDAY 26/02/2026") via startsWith match
    const sheet = getSheetByDayPrefix_(ss, dayName);

    if (!sheet) {
      Logger.log('WARNING: No sheet found with prefix "' + dayName + '" — skipping');
      skipped++;
      return;
    }

    // Read the raw value from B3 (left-most cell of the DATE_FIELD merged range)
    const rawValue = sheet.getRange('B3').getValue();

    // Validate: must be a JavaScript Date object (Sheets returns Date for date cells)
    if (!rawValue || !(rawValue instanceof Date) || isNaN(rawValue.getTime())) {
      Logger.log(
        'WARNING: ' + sheet.getName() + ' — B3 is empty or not a valid Date ' +
        '(got: ' + rawValue + ', type: ' + typeof rawValue + ') — skipping'
      );
      skipped++;
      return;
    }

    // Format the date value
    const formattedDate = Utilities.formatDate(rawValue, timezone, dateFormat);

    // Fix the cell number format so the display renders correctly
    sheet.getRange(DATE_FIELD).setNumberFormat(dateFormat);

    // Build and apply the new tab name: e.g. "WEDNESDAY 26/02/2026"
    const newTabName = dayName + ' ' + formattedDate;
    sheet.setName(newTabName);

    Logger.log('Fixed: "' + sheet.getName() + '" — B3 = ' + formattedDate + ', tab renamed to "' + newTabName + '"');
    fixed++;
  });

  Logger.log('========================================');
  Logger.log('fixSheetNamesAndDateFormat — Done. Fixed: ' + fixed + ', Skipped: ' + skipped);
  Logger.log('========================================');

  // Surface result to the user when run from the editor or menu
  try {
    SpreadsheetApp.getUi().alert(
      'Fix Tab Names & Date Format — Complete',
      'Fixed: ' + fixed + ' sheet(s)\n' +
      'Skipped: ' + skipped + ' sheet(s) (empty B3 or sheet not found)\n\n' +
      'Check Apps Script logs for details.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (uiErr) {
    // getUi() is unavailable in trigger context — log only
    Logger.log('(UI alert skipped — not running in a UI context)');
  }
}

// ============================================================================
// TRIGGER SETUP FUNCTIONS
// ============================================================================

/**
 * Removes weekly rollover trigger
 *
 * Use this to stop automatic rollover
 */
function removeWeeklyRolloverTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'performWeeklyRollover') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  Logger.log(`Removed ${removed} rollover trigger(s)`);

  SpreadsheetApp.getUi().alert(
    'Trigger Removed',
    `Removed ${removed} weekly rollover trigger(s).\n\nAutomatic rollover is now disabled.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
