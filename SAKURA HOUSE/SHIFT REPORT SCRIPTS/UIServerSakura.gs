/****************************************************
 * UI SERVER — SAKURA HOUSE
 *
 * Bridge functions for React dialog/sidebar UIs.
 * Each function is callable from the client via gas-client.
 *
 * Dialog openers register with HtmlService to serve
 * the built single-file HTML from the React project.
 *
 * Dependencies:
 *   Run.gs                  - getFieldValue()
 *   NightlyExportSaks.gs    - exportAndEmailPDF(), exportAndEmailPDF_TestToSelf()
 *   AnalyticsDashboard.gs   - buildFinancialDashboard()
 ****************************************************/


/* ==========================================================================
   DIALOG / SIDEBAR OPENERS
   ========================================================================== */

function openRolloverWizard() {
  var html = HtmlService.createHtmlOutputFromFile('rollover-wizard')
    .setWidth(500)
    .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Weekly Rollover');
}

function openExportDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('export-dashboard');
  SpreadsheetApp.getUi().showSidebar(html);
}

function openAnalyticsViewer() {
  var html = HtmlService.createHtmlOutputFromFile('analytics-viewer');
  SpreadsheetApp.getUi().showSidebar(html);
}


/* ==========================================================================
   ROLLOVER WIZARD — SERVER FUNCTIONS
   ========================================================================== */

/**
 * Returns a preview of the current week's rollover status.
 * Called by the Rollover Wizard dialog on load.
 */
function getRolloverPreview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getRolloverConfig_();
  var dayNames = config.DAY_SHEETS;
  var tz = config.TIMEZONE;

  var reportName = ss.getName();
  var weekEndDate = '';

  // Find week end date from Saturday tab (last operating day)
  var satSheet = findSheetByPrefix_(ss, 'SATURDAY');
  if (satSheet) {
    try {
      var dateVal = getFieldValue(satSheet, 'date');
      if (dateVal instanceof Date) {
        weekEndDate = Utilities.formatDate(dateVal, tz, 'dd/MM/yyyy');
      }
    } catch (e) { /* */ }
  }

  var daysCompleted = [];
  var totalRevenue = 0;
  var daysReported = 0;
  var warnings = [];

  dayNames.forEach(function(dayName) {
    var daySheet = findSheetByPrefix_(ss, dayName);

    if (!daySheet) {
      daysCompleted.push({ day: dayName, mod: '', revenue: '', complete: false });
      warnings.push(dayName + ' tab not found');
      return;
    }

    var mod = '';
    var revenue = 0;
    try { mod = String(getFieldValue(daySheet, 'mod') || '').trim(); } catch (e) { /* */ }
    try { revenue = Number(getFieldValue(daySheet, 'netRevenue')) || 0; } catch (e) { /* */ }

    var revenueStr = revenue > 0 ? '$' + Math.round(revenue).toLocaleString() : '';
    var complete = mod !== '' && revenue > 0;

    if (complete) {
      totalRevenue += revenue;
      daysReported++;
    } else {
      if (!mod) warnings.push(dayName + ': No MOD');
      if (revenue <= 0) warnings.push(dayName + ': No revenue');
    }

    daysCompleted.push({ day: dayName, mod: mod, revenue: revenueStr, complete: complete });
  });

  var avgRevenue = daysReported > 0 ? totalRevenue / daysReported : 0;

  return {
    currentReport: reportName,
    weekEndDate: weekEndDate,
    daysCompleted: daysCompleted,
    allComplete: daysCompleted.every(function(d) { return d.complete; }),
    warnings: warnings,
    summary: {
      totalRevenue: '$' + Math.round(totalRevenue).toLocaleString(),
      avgRevenue: '$' + Math.round(avgRevenue).toLocaleString(),
      daysReported: daysReported
    }
  };
}

/**
 * Executes the weekly rollover from the wizard dialog.
 * Wraps performInPlaceRollover() and returns a result object for the UI.
 */
function executeRollover() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { success: false, message: 'Another rollover is already running. Please wait.' };
  }
  try {
    var startTime = new Date();
    performInPlaceRollover();
    var duration = ((new Date()) - startTime) / 1000;
    return { success: true, message: 'Rollover completed in ' + duration.toFixed(1) + 's.' };
  } catch (e) {
    Logger.log('Rollover from wizard failed: ' + e.message);
    return { success: false, message: e.message || String(e) };
  } finally {
    lock.releaseLock();
  }
}


/* ==========================================================================
   EXPORT DASHBOARD — SERVER FUNCTIONS
   ========================================================================== */

/**
 * Returns the current day's export status for the sidebar.
 * Uses getFieldValue() from Run.gs for data access.
 */
function getExportStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var sheetName = sheet.getName();

  var mod = '';
  var revenue = 0;
  var revenueStr = '';

  try { mod = String(getFieldValue(sheet, 'mod') || '').trim(); } catch (e) { /* */ }
  try { revenue = Number(getFieldValue(sheet, 'netRevenue')) || 0; } catch (e) { /* */ }
  if (revenue > 0) revenueStr = '$' + revenue.toLocaleString();

  var errors = [];
  var warnings = [];

  if (!mod) errors.push('MOD name is missing');
  if (revenue <= 0) errors.push('Net revenue is missing or zero');

  return {
    currentDay: sheetName,
    modName: mod,
    revenue: revenueStr,
    hasRequiredFields: errors.length === 0,
    warnings: warnings,
    errors: errors
  };
}

/**
 * Runs the LIVE export pipeline.
 */
function runExportLive() {
  try {
    exportAndEmailPDF();
    return { success: true, message: 'Report exported and emailed to all recipients.' };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

/**
 * Runs the TEST export pipeline.
 */
function runExportTest() {
  try {
    exportAndEmailPDF_TestToSelf();
    return { success: true, message: 'Test report sent to your email only.' };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}


/* ==========================================================================
   ANALYTICS VIEWER — SERVER FUNCTIONS
   ========================================================================== */

/**
 * Returns weekly analytics data for the sidebar chart.
 * Uses getFieldValue() from Run.gs for data access.
 */
function getAnalyticsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getRolloverConfig_();
  var dayNames = config.DAY_SHEETS;
  var tz = config.TIMEZONE;

  var dailyRevenue = [];
  var totalRevenue = 0;
  var topDay = '';
  var topRevenue = 0;

  dayNames.forEach(function(dayName) {
    var daySheet = findSheetByPrefix_(ss, dayName);
    var revenue = 0;

    if (daySheet) {
      try { revenue = Number(getFieldValue(daySheet, 'netRevenue')) || 0; } catch (e) { /* */ }
    }

    dailyRevenue.push({ day: dayName, revenue: Math.round(revenue) });
    totalRevenue += revenue;

    if (revenue > topRevenue) {
      topRevenue = revenue;
      topDay = dayName;
    }
  });

  var daysWithData = dailyRevenue.filter(function(d) { return d.revenue > 0; }).length;
  var avgRevenue = daysWithData > 0 ? Math.round(totalRevenue / daysWithData) : 0;

  var weekRange = ss.getName();

  return {
    venue: 'Sakura House',
    weekRange: weekRange,
    dailyRevenue: dailyRevenue,
    totalRevenue: Math.round(totalRevenue),
    avgRevenue: avgRevenue,
    topDay: topDay,
    coverData: null // Sakura doesn't track covers
  };
}

/**
 * Refreshes the analytics dashboard tab.
 */
function refreshDashboard() {
  try {
    buildFinancialDashboard();
    return true;
  } catch (e) {
    Logger.log('Dashboard refresh error: ' + e.message);
    return false;
  }
}


/* ==========================================================================
   SHARED
   ========================================================================== */

function closeDialog() {
  // No-op on server — google.script.host.close() handles it on client.
}


/* ==========================================================================
   SHIFT INPUT VALIDATION (M5)
   ========================================================================== */

/**
 * Validates shift report completeness before the export runs.
 *
 * ERRORS (block export — must fix):
 *   - MOD field is empty
 *   - Net revenue is 0 or empty
 *
 * WARNINGS (can override with note):
 *   - No narrative text in Shift Notes (shiftSummary)
 *   - No narrative text in What Went Well (goodNotes)
 *   - TODO items exist with no assignee in the staff column
 *
 * @param {Sheet} sheet - The active shift report sheet
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateShiftBeforeExport_(sheet) {
  var errors = [];
  var warnings = [];

  // --- ERRORS ---
  var mod = '';
  try { mod = String(getFieldValue(sheet, 'mod') || '').trim(); } catch (e) { /* named range missing — treat as empty */ }
  if (!mod) {
    errors.push('MOD field is empty');
  }

  var netRevenue = 0;
  try { netRevenue = Number(getFieldValue(sheet, 'netRevenue')) || 0; } catch (e) { /* treat as 0 */ }
  if (netRevenue <= 0) {
    errors.push('Net revenue is 0 or empty');
  }

  // --- WARNINGS ---
  var shiftSummary = '';
  try { shiftSummary = String(getFieldDisplayValue(sheet, 'shiftSummary') || '').trim(); } catch (e) { /* */ }
  if (!shiftSummary) {
    warnings.push('Shift Notes is empty');
  }

  var goodNotes = '';
  try { goodNotes = String(getFieldDisplayValue(sheet, 'goodNotes') || '').trim(); } catch (e) { /* */ }
  if (!goodNotes) {
    warnings.push('What Went Well is empty');
  }

  // Count TODOs with no assignee
  try {
    var todoTaskValues = getFieldValues(sheet, 'todoTasks');
    var todoAssignValues = getFieldValues(sheet, 'todoAssignees');
    var unassignedCount = 0;
    for (var i = 0; i < todoTaskValues.length; i++) {
      var taskText = (todoTaskValues[i][0] || '').toString().trim();
      var assignee = (todoAssignValues[i] ? todoAssignValues[i][0] || '' : '').toString().trim();
      if (taskText && !assignee) {
        unassignedCount++;
      }
    }
    if (unassignedCount > 0) {
      warnings.push(unassignedCount + ' TODO item' + (unassignedCount > 1 ? 's have' : ' has') + ' no assignee');
    }
  } catch (e) {
    Logger.log('validateShiftBeforeExport_: TODO check failed (non-blocking): ' + e.message);
  }

  return { errors: errors, warnings: warnings };
}
