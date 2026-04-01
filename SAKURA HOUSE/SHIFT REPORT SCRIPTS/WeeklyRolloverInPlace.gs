/****************************************************
 * WEEKLY ROLLOVER - IN-PLACE IMPLEMENTATION
 *
 * Single working file approach: clears and resets
 * weekly data instead of creating new files.
 *
 * KEY BENEFIT: Menus always work (same file = same
 * container-bound script = menus never disappear).
 *
 * PROCESS:
 * 1. Validate preconditions
 * 2. Generate week summary
 * 3. Export PDF to archive
 * 4. Create Google Sheets snapshot
 * 5. Clear data (preserving structure)
 * 6. Update dates to next week
 * 7. Verify named ranges
 * 8. (Removed Apr 2026) Rollover notifications
 *
 * TRIGGER: Monday 1:00 AM (Australia/Sydney)
 * MANUAL: Shift Report > Weekly Rollover (In-Place)
 *
 * @version 1.0.0
 * @date 2026-02-11
 ****************************************************/


// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get rollover configuration from Script Properties
 * ✅ SECURITY: No hardcoded file IDs or email addresses
 *
 * @returns {Object} Rollover configuration object
 */
function getRolloverConfig_() {
  const props = PropertiesService.getScriptProperties();

  // Get emails from Script Properties (same as used for shift reports)
  const emailRecipientsJson = props.getProperty('SAKURA_EMAIL_RECIPIENTS');
  const emailRecipients = emailRecipientsJson ? JSON.parse(emailRecipientsJson) : {};
  const managementEmails = Object.keys(emailRecipients);

  return {
    // Working file ID from Script Properties
    WORKING_FILE_ID: props.getProperty('SAKURA_WORKING_FILE_ID'),

    // Archive root from Script Properties
    ARCHIVE_ROOT_ID: (() => {
      const v = props.getProperty('ARCHIVE_ROOT_FOLDER_ID');
      if (!v) throw new Error('Script Property ARCHIVE_ROOT_FOLDER_ID is not set');
      return v;
    })(),

    // Day sheets (static configuration)
    DAY_SHEETS: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    DAY_OFFSETS: [-6, -5, -4, -3, -2, -1],

    // File naming (static configuration)
    ARCHIVE_FILE_PREFIX: 'Sakura Shift Report W.E. ',

    // Management emails from Script Properties
    MANAGEMENT_EMAILS: managementEmails,

    // Evan's email (rollover notifications go to Evan only)
    EVAN_EMAIL: (() => {
      const v = props.getProperty('INTEGRATION_ALERT_EMAIL_PRIMARY');
      if (!v) throw new Error('Script Property INTEGRATION_ALERT_EMAIL_PRIMARY is not set');
      return v;
    })(),

    // Timezone (static configuration)
    TIMEZONE: 'Australia/Sydney',

    // Separate tab cleared wholesale each rollover (row 1 = header preserved)
    TODO_SHEET: 'TO-DOs',

    // Fields to clear (static configuration - all clearable named ranges)
    CLEARABLE_FIELDS: [
      'mod', 'date', 'fohStaff', 'bohStaff',
      'cashCount', 'cashRecord', 'pettyCashTransactions',
      'shiftSummary',  // netRevenue removed — formula field, depends on other inputs
      'todoTasks', 'todoAssignees',
      'cashTips', 'cardTips', 'surchargeTips',
      'productionAmount', 'deposit', 'discounts',
      'guestsOfNote', 'goodNotes', 'issues',
      'kitchenNotes', 'wastageComps', 'maintenance', 'rsaIncidents'
    ]
  };
}


// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

/**
 * Main in-place rollover function.
 * Called by time-based trigger or manually from menu.
 */
function performInPlaceRollover() {
  const startTime = new Date();
  Logger.log('========== IN-PLACE ROLLOVER STARTED ==========');

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Step 1: Validation
    validateRolloverPreconditions_(spreadsheet);

    // Step 2: Generate week summary (reuse existing)
    const summary = generateWeekSummary_RolloverSaks_(spreadsheet);
    Logger.log(`Week ending: ${summary.weekEndDate}`);
    Logger.log(`Total revenue: $${summary.totalRevenue}`);

    // Step 3: Export PDF to archive (reuse existing)
    const pdfResult = exportPdfToArchive_(spreadsheet, summary.weekEndDate);
    Logger.log(`PDF archived: ${pdfResult.archivePath}`);

    // Step 4: Create Google Sheets snapshot
    const snapshotResult = createArchiveSnapshot_(spreadsheet, summary.weekEndDate);
    Logger.log(`Sheets snapshot: ${snapshotResult.archivePath}`);

    // Step 5: Clear data safely
    clearAllSheetData_(spreadsheet);
    Logger.log('Data cleared successfully');

    // Step 6: Update dates to next week
    updateDatesToNextWeek_(spreadsheet);
    Logger.log('Dates updated to next week');

    // Step 7: Verify named ranges
    verifyAndFixNamedRanges_(spreadsheet);
    Logger.log('Named ranges verified');

    // Step 8: Notifications removed (Apr 2026) — PDF archive email in Step 3 remains
    Logger.log('Step 8: Rollover notifications removed (email + Slack)');

    // Step 9: Post-rollover validation (non-blocking)
    const validation = validateRolloverResult_(spreadsheet);
    if (validation.valid) {
      Logger.log('Post-rollover validation: PASSED');
    } else {
      Logger.log('Post-rollover validation: FAILED — ' + validation.issues.join('; '));
    }

    // Step 10: Named range health check (non-blocking)
    Logger.log('Step 10: Running named range health check...');
    try {
      namedRangeHealthCheck_Sakura();
    } catch (e) {
      Logger.log('Step 10: Named range health check failed (non-blocking): ' + e.message);
    }

    const duration = ((new Date()) - startTime) / 1000;
    Logger.log(`========== ROLLOVER COMPLETE: ${duration.toFixed(1)}s ==========`);

    // UI success message — skipped silently when running from a time-based trigger
    // (SpreadsheetApp.getUi() throws in trigger context)
    try {
      const successUi = SpreadsheetApp.getUi();
      successUi.alert(
        'Rollover Complete',
        `Week ending ${summary.weekEndDate} archived.\n\n` +
        `Total revenue: $${summary.totalRevenue.toLocaleString()}\n` +
        `New week ready for entries.\n\n` +
        `Duration: ${duration.toFixed(1)}s`,
        successUi.ButtonSet.OK
      );
    } catch (uiErr) {
      // Running from trigger — no UI available, skip alert
    }

    return { success: true, weekEndDate: summary.weekEndDate, duration };

  } catch (error) {
    Logger.log('❌ [performInPlaceRollover] failed: ' + error.message + '\n' + error.stack);
    notifyError_('performInPlaceRollover', error);

    try {
      const ui = SpreadsheetApp.getUi();
      if (ui) {
        ui.alert(
          'Rollover Failed',
          `Error: ${error.message}\n\n` +
          'Check Apps Script logs for details.\n' +
          'Data has NOT been cleared.',
          ui.ButtonSet.OK
        );
      }
    } catch (uiErr) {
      Logger.log('Could not show UI alert (trigger context): ' + uiErr.message);
    }

    throw error;
  }
}


// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates preconditions before rollover.
 * Throws error if any check fails.
 */
function validateRolloverPreconditions_(spreadsheet) {
  const config = getRolloverConfig_();

  // Check 1: Verify file ID
  const currentFileId = spreadsheet.getId();
  if (currentFileId !== config.WORKING_FILE_ID) {
    throw new Error(
      `Wrong file! This script must run on the working file.\n` +
      `Expected: ${config.WORKING_FILE_ID}\n` +
      `Current: ${currentFileId}`
    );
  }

  // Check 2: Verify VENUE_NAME
  const venueName = PropertiesService.getScriptProperties().getProperty('VENUE_NAME');
  if (venueName !== 'SAKURA') {
    throw new Error(`VENUE_NAME must be SAKURA, got: ${venueName}`);
  }

  // Check 3: Validate week completion (reuse existing)
  const validation = validateWeekCompletion_RolloverSaks_(spreadsheet);

  if (!validation.allComplete) {
    Logger.log(`⚠️ Week incomplete: ${validation.completedDays}/${validation.totalDays} days`);
    Logger.log(validation.details);

    // For automated trigger, proceed with warning
    // For manual trigger, user will be prompted by main function
    // (We can't show UI prompts from time-based triggers)
  }

  Logger.log('✅ Validation passed');
}

/**
 * Validates week completion status.
 * Checks which day sheets have been filled out.
 *
 * @param {Spreadsheet} spreadsheet
 * @returns {Object} Validation result with completion status
 */
function validateWeekCompletion_RolloverSaks_(spreadsheet) {
  const config = getRolloverConfig_();
  let completedDays = 0;
  const details = [];

  config.DAY_SHEETS.forEach(dayPrefix => {
    const sheet = findSheetByPrefix_(spreadsheet, dayPrefix);

    if (!sheet) {
      details.push(`❌ ${dayPrefix}: Sheet not found`);
      return;
    }

    // Check if date field is filled (indicates sheet has been started)
    try {
      const dateRange = getFieldRange(sheet, 'date');
      const dateValue = dateRange.getValue();

      if (dateValue && dateValue !== '') {
        completedDays++;
        details.push(`✅ ${dayPrefix}: ${dateValue}`);
      } else {
        details.push(`⚠️  ${dayPrefix}: No date (not started)`);
      }
    } catch (error) {
      details.push(`⚠️  ${dayPrefix}: Error reading date - ${error.message}`);
    }
  });

  return {
    allComplete: completedDays === config.DAY_SHEETS.length,
    completedDays: completedDays,
    totalDays: config.DAY_SHEETS.length,
    details: details.join('\n')
  };
}


// ============================================================================
// WEEK SUMMARY GENERATION
// ============================================================================

/**
 * Generates a summary of the completed week.
 * Collects data from all day sheets for reporting and archiving.
 *
 * @param {Spreadsheet} spreadsheet
 * @returns {Object} Week summary with revenue, dates, and completion status
 */
function generateWeekSummary_RolloverSaks_(spreadsheet) {
  const config = getRolloverConfig_();

  let totalRevenue = 0;
  let daysReported = 0;
  let weekEndDate = null;
  const days = [];

  config.DAY_SHEETS.forEach((dayPrefix, index) => {
    const sheet = findSheetByPrefix_(spreadsheet, dayPrefix);

    if (!sheet) {
      Logger.log(`⚠️ Sheet not found: ${dayPrefix}`);
      days.push({
        name: dayPrefix,
        date: 'N/A',
        mod: '',
        revenue: 0
      });
      return;
    }

    // Get date and check if day is filled out
    let dateValue = '';
    try {
      const dateRange = getFieldRange(sheet, 'date');
      dateValue = dateRange.getValue() || '';
    } catch (error) {
      Logger.log(`⚠️ Could not read date for ${dayPrefix}: ${error.message}`);
    }

    // Get MOD
    let modValue = '';
    try {
      modValue = getFieldValue(sheet, 'mod') || '';
    } catch (error) {
      Logger.log(`⚠️ Could not read MOD for ${dayPrefix}: ${error.message}`);
    }

    // Get revenue
    let revenueValue = 0;
    try {
      const revStr = getFieldValue(sheet, 'netRevenue') || '0';
      revenueValue = parseFloat(revStr) || 0;
      if (revenueValue > 0) {
        daysReported++;
      }
    } catch (error) {
      Logger.log(`⚠️ Could not read revenue for ${dayPrefix}: ${error.message}`);
    }

    totalRevenue += revenueValue;

    // Format date for display
    let dateDisplay = String(dateValue || '');
    if (dateValue && dateValue instanceof Date) {
      const day = String(dateValue.getDate()).padStart(2, '0');
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const year = dateValue.getFullYear();
      dateDisplay = `${day}/${month}/${year}`;

      // Last day (Saturday for Sakura) is the week ending date
      if (index === config.DAY_SHEETS.length - 1) {
        weekEndDate = dateDisplay;
      }
    } else if (dateValue && typeof dateValue === 'string') {
      dateDisplay = dateValue;

      // Last day (Saturday for Sakura) is the week ending date
      if (index === config.DAY_SHEETS.length - 1) {
        weekEndDate = dateValue;
      }
    }

    days.push({
      name: dayPrefix,
      date: dateDisplay,
      mod: modValue,
      revenue: revenueValue
    });
  });

  // Calculate week ending date if not set (use last day's date)
  if (!weekEndDate && days.length > 0) {
    weekEndDate = days[days.length - 1].date || 'Unknown';
  }

  // Calculate average revenue (only counting days with revenue)
  const avgRevenue = daysReported > 0 ? Math.round(totalRevenue / daysReported) : 0;

  // Build display text for preview/notifications
  const displayLines = days.map(d =>
    `${d.name.padEnd(12)} ${d.date.padEnd(12)} ${d.mod.padEnd(20)} $${d.revenue.toLocaleString()}`
  );
  const displayText = displayLines.join('\n');

  return {
    weekEndDate: weekEndDate,
    totalRevenue: totalRevenue,
    avgRevenue: avgRevenue,
    daysReported: daysReported,
    days: days,
    displayText: displayText
  };
}


// ============================================================================
// DATA CLEARING
// ============================================================================

/**
 * Clears data from all day sheets while preserving structure.
 * Uses clearContent() to preserve named ranges.
 */
function clearAllSheetData_(spreadsheet) {
  const config = getRolloverConfig_();
  const daySheets = config.DAY_SHEETS;
  const clearableFields = config.CLEARABLE_FIELDS;

  daySheets.forEach(dayPrefix => {
    // Find sheet (may be renamed with date)
    const sheet = findSheetByPrefix_(spreadsheet, dayPrefix);

    if (!sheet) {
      Logger.log(`⚠️ Sheet not found for day: ${dayPrefix}`);
      return;
    }

    Logger.log(`Clearing data on: ${sheet.getName()}`);

    // Clear each field using named ranges
    clearableFields.forEach(fieldKey => {
      try {
        const range = getFieldRange(sheet, fieldKey);
        range.clearContent();  // Preserves structure, formatting, named ranges
      } catch (error) {
        Logger.log(`⚠️ Could not clear ${fieldKey}: ${error.message}`);
      }
    });

    Logger.log(`✅ ${sheet.getName()} cleared`);
  });

  // Clear the TO-DOs tab from row 2 onwards (row 1 = header)
  const todoSheet = spreadsheet.getSheetByName(config.TODO_SHEET);
  if (todoSheet) {
    const lastRow = todoSheet.getLastRow();
    if (lastRow >= 2) {
      todoSheet.getRange(2, 1, lastRow - 1, todoSheet.getLastColumn()).clearContent();
      Logger.log(`✅ ${config.TODO_SHEET} tab cleared (rows 2–${lastRow})`);
    } else {
      Logger.log(`${config.TODO_SHEET} tab: nothing to clear (no data below header)`);
    }
  } else {
    Logger.log(`⚠️ Tab "${config.TODO_SHEET}" not found — skipped`);
  }
}

/**
 * Finds a sheet by its day name prefix.
 * Handles renamed sheets like "MONDAY 03/02/2026".
 */
function findSheetByPrefix_(spreadsheet, dayPrefix) {
  const sheets = spreadsheet.getSheets();
  return sheets.find(s => s.getName().toUpperCase().startsWith(dayPrefix)) || null;
}


// ============================================================================
// ARCHIVE SNAPSHOT
// ============================================================================

/**
 * Creates Google Sheets snapshot and moves to archive.
 */
function createArchiveSnapshot_(spreadsheet, weekEndDate) {
  const config = getRolloverConfig_();
  const workingFile = DriveApp.getFileById(spreadsheet.getId());
  const archiveName = config.ARCHIVE_FILE_PREFIX +
    weekEndDate.replace(/\//g, '.');  // 09/02/2026 → 09.02.2026

  // Get or create archive folder structure
  const archiveFolder = getOrCreateArchiveSubfolder_(weekEndDate, 'sheets');

  // Create snapshot
  const snapshot = workingFile.makeCopy(archiveName, archiveFolder);

  Logger.log(`Snapshot created: ${snapshot.getName()}`);

  return {
    fileName: snapshot.getName(),
    fileUrl: snapshot.getUrl(),
    archivePath: getArchivePath_(weekEndDate) + '/sheets/' + archiveName
  };
}

/**
 * Gets or creates a named subfolder inside the dated archive path.
 * Structure: Archive/YYYY/YYYY-MM/{subfolderName}/
 *
 * Replaces the former getOrCreateArchiveFolder_() ('sheets') and
 * getOrCreatePdfArchiveFolder_() ('pdfs') — both had identical logic.
 *
 * @param {string} weekEndDateStr - "DD/MM/YYYY"
 * @param {string} subfolderName  - 'sheets' or 'pdfs'
 * @returns {Folder}
 */
function getOrCreateArchiveSubfolder_(weekEndDateStr, subfolderName) {
  const config = getRolloverConfig_();

  // Parse date: "09/02/2026" → year/month integers
  const dateParts = weekEndDateStr.split('/');
  const month = parseInt(dateParts[1], 10);
  const year = parseInt(dateParts[2], 10);

  // Get archive root
  const archiveRoot = DriveApp.getFolderById(config.ARCHIVE_ROOT_ID);

  // Get/create year folder
  const yearStr = String(year);
  const yearFolder = getOrCreateSubfolder_(archiveRoot, yearStr);

  // Get/create year-month folder
  const monthStr = String(month).padStart(2, '0');
  const yearMonthStr = `${yearStr}-${monthStr}`;
  const yearMonthFolder = getOrCreateSubfolder_(yearFolder, yearMonthStr);

  // Get/create named subfolder (e.g. 'sheets' or 'pdfs')
  return getOrCreateSubfolder_(yearMonthFolder, subfolderName);
}

/**
 * Helper: Get or create subfolder.
 */
function getOrCreateSubfolder_(parentFolder, name) {
  const existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) {
    return existing.next();
  }
  return parentFolder.createFolder(name);
}

/**
 * Gets archive path string for logging.
 */
function getArchivePath_(weekEndDateStr) {
  const dateParts = weekEndDateStr.split('/');
  const year = dateParts[2];
  const month = dateParts[1].padStart(2, '0');
  return `Archive/${year}/${year}-${month}`;
}


// ============================================================================
// PDF EXPORT
// ============================================================================

/**
 * Exports all 6 day sheets as a single multi-page PDF to the archive folder,
 * then emails the PDF to management.
 *
 * Each visible day sheet becomes one page in the PDF (Monday = page 1,
 * Tuesday = page 2, ..., Saturday = page 6). Non-day sheets (warehouse tabs,
 * TO-DOs, Instructions, etc.) are hidden before the export and then fully
 * restored afterwards via a try/finally block.
 *
 * Non-interactive — suitable for automated triggers.
 *
 * @param {Spreadsheet} spreadsheet
 * @param {string} weekEndDate - Formatted date string (DD/MM/YYYY)
 * @returns {Object} Result with archivePath, fileUrl, and email status
 */
function exportPdfToArchive_(spreadsheet, weekEndDate) {
  Logger.log('Generating multi-page PDF for archive (all 6 day sheets)...');

  const config = getRolloverConfig_();
  const pdfFileName = `Sakura Shift Report W.E. ${weekEndDate.replace(/\//g, '.')}.pdf`;

  // Collect all sheets and record their original visibility state.
  const allSheets = spreadsheet.getSheets();
  const originallyHidden = new Map(); // sheetId → wasHidden
  allSheets.forEach(s => {
    originallyHidden.set(s.getSheetId(), s.isSheetHidden());
  });

  // Determine which sheets are day sheets (to keep visible for export).
  const daySheetIds = new Set(
    config.DAY_SHEETS
      .map(dayName => findSheetByPrefix_(spreadsheet, dayName))
      .filter(s => s !== null)
      .map(s => s.getSheetId())
  );

  if (daySheetIds.size === 0) {
    Logger.log('⚠️ No day sheets found. Skipping PDF export.');
    return {
      exported: false,
      archivePath: 'N/A - No day sheets found',
      fileUrl: '',
      emailed: false
    };
  }

  let pdfBlob = null;

  try {
    // Hide every sheet that is NOT a day sheet (and isn't already hidden).
    // Reveal every day sheet that IS currently hidden so it appears in the PDF.
    allSheets.forEach(s => {
      const id = s.getSheetId();
      if (daySheetIds.has(id)) {
        if (s.isSheetHidden()) s.showSheet();
      } else {
        if (!s.isSheetHidden()) s.hideSheet();
      }
    });

    // Export spreadsheet as PDF with NO gid parameter → all visible sheets.
    // Parameters mirror generatePdfForSheet_NoUI_(): A4, portrait, fit-to-width,
    // 0.5" margins, no gridlines, no titles, no sheet names.
    const spreadsheetId = spreadsheet.getId();
    const exportUrl =
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
      `format=pdf&size=A4&portrait=true&fitw=true` +
      `&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5` +
      `&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false`;

    try {
      const token = ScriptApp.getOAuthToken();
      const resp = UrlFetchApp.fetch(exportUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.getResponseCode() !== 200) {
        throw new Error(`PDF export failed — HTTP ${resp.getResponseCode()}: ${resp.getContentText().substring(0, 200)}`);
      }
      pdfBlob = resp.getBlob().setName(pdfFileName);
      Logger.log(`Multi-page PDF generated: ${pdfFileName} (${pdfBlob.getBytes().length} bytes)`);
    } catch (fetchErr) {
      Logger.log(`⚠️ PDF fetch failed: ${fetchErr.message}`);
    }

  } finally {
    // Always restore original visibility state.
    allSheets.forEach(s => {
      const id = s.getSheetId();
      const wasHidden = originallyHidden.get(id);
      if (wasHidden && !s.isSheetHidden()) {
        s.hideSheet();
      } else if (!wasHidden && s.isSheetHidden()) {
        s.showSheet();
      }
    });
    Logger.log('Sheet visibility restored after PDF export.');
  }

  if (!pdfBlob) {
    return {
      exported: false,
      archivePath: 'N/A - Generation failed',
      fileUrl: '',
      emailed: false
    };
  }

  // Save PDF to Drive archive
  const archiveFolder = getOrCreateArchiveSubfolder_(weekEndDate, 'pdfs');
  const pdfFile = archiveFolder.createFile(pdfBlob);
  Logger.log(`PDF saved to Drive: ${pdfFile.getName()}`);

  // Email PDF to management
  const emailSent = emailPdfToManagement_(pdfBlob, pdfFile.getUrl(), weekEndDate);

  return {
    exported: true,
    archivePath: getArchivePath_(weekEndDate) + '/pdfs/' + pdfFileName,
    fileUrl: pdfFile.getUrl(),
    emailed: emailSent
  };
}

/**
 * Emails PDF to management team (non-interactive).
 *
 * @param {Blob} pdfBlob
 * @param {string} pdfUrl - Drive URL of PDF
 * @param {string} weekEndDate
 * @returns {boolean} True if email sent successfully
 */
function emailPdfToManagement_(pdfBlob, pdfUrl, weekEndDate) {
  const config = getRolloverConfig_();

  const subject = `Sakura House Weekly Report - W.E. ${weekEndDate}`;
  const htmlBody = `
    <p>Dear Team,</p>
    <p>Please find attached the weekly shift report for the week ending <strong>${weekEndDate}</strong>.</p>
    <p><a href="${pdfUrl}">View PDF in Google Drive</a></p>
    <hr>
    <p>This is an automated export from the Sakura House shift reporting system.</p>
  `;

  try {
    GmailApp.sendEmail(config.EVAN_EMAIL, subject, '', {
      htmlBody: htmlBody,
      attachments: [pdfBlob]
    });

    Logger.log(`PDF emailed to ${config.EVAN_EMAIL}`);
    return true;
  } catch (error) {
    Logger.log(`⚠️ Email failed: ${error.message}`);
    return false;
  }
}


// ============================================================================
// DATE UPDATE
// ============================================================================

/**
 * Calculates dates for the next week.
 * Returns the next Sunday (week ending) and formatted date string.
 *
 * @returns {Object} { nextSunday: Date, formattedEndDate: string }
 */
function calculateWeekDates_() {
  const today = new Date();

  // Calculate next Sunday (week ending date)
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysToSunday);

  // Format the end date
  const day = String(nextSunday.getDate()).padStart(2, "0");
  const month = String(nextSunday.getMonth() + 1).padStart(2, "0");
  const year = nextSunday.getFullYear();
  const formattedEndDate = `${day}/${month}/${year}`;

  Logger.log(`📅 Week ending: ${formattedEndDate}`);

  return {
    nextSunday,
    formattedEndDate
  };
}

/**
 * Stamps dates on all day sheets and renames tabs.
 * Uses config from Script Properties.
 *
 * Writes the formatted date to the first cell of the named-range-backed
 * 'date' field (B3:D3 merged) via getFieldRange() so that if the fallback
 * cell ever changes this function stays in sync automatically.
 *
 * @param {Spreadsheet} spreadsheet
 * @param {Object} weekDates - { nextSunday: Date, formattedEndDate: string }
 */
function stampDaySheets_(spreadsheet, weekDates) {
  const config = getRolloverConfig_();
  const { nextSunday } = weekDates;

  config.DAY_SHEETS.forEach((dayName, index) => {
    const sheet = findSheetByPrefix_(spreadsheet, dayName);

    if (!sheet) {
      Logger.log(`⚠️ Sheet "${dayName}" not found in spreadsheet.`);
      return;
    }

    // Calculate this day's date
    const targetDate = new Date(nextSunday);
    targetDate.setDate(nextSunday.getDate() + config.DAY_OFFSETS[index]);

    const day = String(targetDate.getDate()).padStart(2, "0");
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const year = targetDate.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // Stamp date via named range abstraction.
    // clearContent() first to avoid stale value remaining in merged cell,
    // then write to the first cell of the (possibly merged) date range.
    const dateRange = getFieldRange(sheet, 'date');
    dateRange.clearContent();
    dateRange.getCell(1, 1).setValue(formattedDate);

    // Rename the tab
    const newTabName = `${dayName} ${formattedDate}`;
    sheet.setName(newTabName);

    Logger.log(`✅ ${dayName} → "${newTabName}"`);
  });
}

/**
 * Updates dates to next week on all day sheets.
 * Calculates next week and stamps dates on each sheet.
 */
function updateDatesToNextWeek_(spreadsheet) {
  // Calculate next week dates
  const weekDates = calculateWeekDates_();

  Logger.log(`Next week ending: ${weekDates.formattedEndDate}`);

  // Stamp dates on each sheet
  stampDaySheets_(spreadsheet, weekDates);

  Logger.log('All day sheets updated with new dates');
}


// ============================================================================
// NAMED RANGE VERIFICATION
// ============================================================================

/**
 * Verifies all expected named ranges exist on all day sheets after rollover.
 * Creates any that are missing or pointing to the wrong sheet.
 * Silent — logs results but shows no UI alerts.
 *
 * Called from Step 7 of performInPlaceRollover_.
 * Delegates to createNamedRangesOnSheet_() from RunSakura.gs.
 */
function verifyAndFixNamedRanges_(spreadsheet) {
  const config = getRolloverConfig_();
  let totalCreated = 0;
  let totalSkipped = 0;

  config.DAY_SHEETS.forEach(dayPrefix => {
    const sheet = findSheetByPrefix_(spreadsheet, dayPrefix);
    if (!sheet) {
      Logger.log(`⚠️ verifyAndFixNamedRanges_: sheet not found for ${dayPrefix}`);
      return;
    }

    const result = createNamedRangesOnSheet_(sheet, spreadsheet);
    totalCreated += result.created || 0;
    totalSkipped += result.skipped || 0;

    if (result.created > 0) {
      Logger.log(`${sheet.getName()}: fixed ${result.created} named range(s)`);
    }
  });

  Logger.log(`Named range verification complete — fixed: ${totalCreated}, already OK: ${totalSkipped}`);
}


// ============================================================================
// NOTIFICATIONS
// ============================================================================


/**
 * Post-rollover validation — step 9 of performInPlaceRollover().
 *
 * Checks that each day sheet received a date stamp and that the netRevenue
 * named range still resolves on the MONDAY sheet. Non-blocking: any failure
 * is Slack-notified (TEST webhook) but does NOT throw or abort the rollover
 * (which has already completed by the time this runs).
 *
 * @param {Spreadsheet} spreadsheet
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateRolloverResult_(spreadsheet) {
  const config = getRolloverConfig_();
  const issues = [];

  config.DAY_SHEETS.forEach(function(dayPrefix) {
    const sheet = findSheetByPrefix_(spreadsheet, dayPrefix);
    if (!sheet) {
      issues.push(dayPrefix + ': sheet not found after rollover');
      return;
    }

    // Check: date field is non-empty
    try {
      const dateVal = getFieldRange(sheet, 'date').getValue();
      if (!dateVal || dateVal === '') {
        issues.push(dayPrefix + ': date field is empty after rollover');
      }
    } catch (e) {
      issues.push(dayPrefix + ': could not read date field — ' + e.message);
    }
  });

  // Check: netRevenue named range still resolves on MONDAY sheet
  try {
    const mondaySheet = findSheetByPrefix_(spreadsheet, 'MONDAY');
    if (mondaySheet) {
      const revRange = getFieldRange(mondaySheet, 'netRevenue');
      if (!revRange) {
        issues.push('MONDAY: netRevenue named range did not resolve');
      }
    } else {
      issues.push('MONDAY: sheet not found during named range check');
    }
  } catch (e) {
    issues.push('MONDAY: netRevenue named range error — ' + e.message);
  }

  const valid = issues.length === 0;

  if (!valid) {
    try {
      const webhook = PropertiesService.getScriptProperties().getProperty('SAKURA_SLACK_WEBHOOK_TEST');
      if (webhook) {
        const blocks = [
          bk_header('Post-Rollover Validation FAILED'),
          bk_section('*Sakura House* — rollover completed but validation found issues:'),
          bk_section(issues.map(function(i) { return '• ' + i; }).join('\n'))
        ];
        bk_post(webhook, blocks, 'Post-Rollover Validation FAILED — Sakura House');
      }
    } catch (e) {
      Logger.log('validateRolloverResult_: could not send Slack alert — ' + e.message);
    }
  }

  return { valid: valid, issues: issues };
}





// ============================================================================
// PREVIEW / DRY RUN
// ============================================================================

/**
 * Dry run: shows what would happen without executing.
 */
function previewInPlaceRollover() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = getRolloverConfig_();

  try {
    // Validate
    validateRolloverPreconditions_(spreadsheet);

    // Generate summary
    const summary = generateWeekSummary_RolloverSaks_(spreadsheet);

    // Calculate next week
    const weekDates = calculateWeekDates_();

    // Check if week ending date is valid (must be in DD/MM/YYYY format)
    const isValidDate = summary.weekEndDate &&
                        summary.weekEndDate !== 'Unknown' &&
                        summary.weekEndDate.split('/').length === 3;

    // Build preview message
    let preview = '=== ROLLOVER PREVIEW (NO CHANGES) ===\n\n';

    if (!isValidDate) {
      preview += '⚠️ WARNING: Week ending date not found!\n';
      preview += 'The Saturday sheet appears to be empty or missing a date.\n';
      preview += 'Please fill in at least the Saturday date before running rollover.\n\n';
    }

    preview += `Current week ending: ${summary.weekEndDate}\n`;
    preview += `Total revenue: $${summary.totalRevenue.toLocaleString()}\n`;
    preview += `Days reported: ${summary.daysReported}/${summary.days.length}\n\n`;
    preview += `--- Summary ---\n${summary.displayText}\n\n`;
    preview += `--- Actions (if executed) ---\n`;

    if (isValidDate) {
      preview += `1. Export PDF to: ${getArchivePath_(summary.weekEndDate)}/pdfs/\n`;
      preview += `2. Create snapshot to: ${getArchivePath_(summary.weekEndDate)}/sheets/\n`;
    } else {
      preview += `1. Export PDF to: Archive/[YEAR]/[YEAR-MONTH]/pdfs/\n`;
      preview += `2. Create snapshot to: Archive/[YEAR]/[YEAR-MONTH]/sheets/\n`;
    }

    preview += `3. Clear data from all ${config.DAY_SHEETS.length} day sheets\n`;
    preview += `4. Update dates to week ending: ${weekDates.formattedEndDate}\n`;
    preview += `5. Verify named ranges\n`;
    preview += `6. Send notifications to ${config.MANAGEMENT_EMAILS.length} recipients`;

    Logger.log(preview);
    ui.alert('Rollover Preview', preview, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Preview Failed', `Error: ${error.message}`, ui.ButtonSet.OK);
  }
}


// ============================================================================
// UTILITY / DISPLAY
// ============================================================================

/**
 * Show configuration (no password needed, read-only).
 */
function showRolloverConfig() {
  const ui = SpreadsheetApp.getUi();
  const config = getRolloverConfig_();

  const info =
    'IN-PLACE ROLLOVER CONFIGURATION\n\n' +
    `Working File ID: ${config.WORKING_FILE_ID}\n` +
    `Archive Root ID: ${config.ARCHIVE_ROOT_ID}\n` +
    `Timezone: ${config.TIMEZONE}\n` +
    `Days: ${config.DAY_SHEETS.join(', ')}\n\n` +
    `Management Emails:\n` +
    config.MANAGEMENT_EMAILS.map(e => `  • ${e}`).join('\n');

  ui.alert('Rollover Configuration', info, ui.ButtonSet.OK);
}
