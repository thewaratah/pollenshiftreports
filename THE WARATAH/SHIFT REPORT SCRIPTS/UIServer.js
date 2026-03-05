/****************************************************
 * UI SERVER — WARATAH
 *
 * Bridge functions for React dialog/sidebar UIs.
 * Each function is callable from the client via gas-client.
 *
 * Dialog openers register with HtmlService to serve
 * the built single-file HTML from the React project.
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
 * Called by the Rollover Wizard React dialog on load.
 */
function getRolloverPreview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var dayNames = ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  var tz = 'Australia/Sydney';

  // Find report name and week end date from Sunday tab
  var reportName = ss.getName();
  var weekEndDate = '';
  var sundaySheet = null;

  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toUpperCase();
    if (name.indexOf('SUNDAY') === 0) {
      sundaySheet = sheets[i];
      var dateVal = sundaySheet.getRange('B3').getValue();
      if (dateVal instanceof Date) {
        weekEndDate = Utilities.formatDate(dateVal, tz, 'dd/MM/yyyy');
      }
      break;
    }
  }

  // Check each day
  var daysCompleted = [];
  var totalRevenue = 0;
  var daysReported = 0;
  var warnings = [];

  dayNames.forEach(function(dayName) {
    var daySheet = null;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().toUpperCase().indexOf(dayName) === 0) {
        daySheet = sheets[i];
        break;
      }
    }

    if (!daySheet) {
      daysCompleted.push({ day: dayName, mod: '', revenue: '', complete: false });
      warnings.push(dayName + ' tab not found');
      return;
    }

    var mod = (daySheet.getRange('B4').getValue() || '').toString().trim();
    var revenue = daySheet.getRange('B34').getValue();
    var revenueStr = revenue ? '$' + Number(revenue).toLocaleString() : '';
    var complete = mod !== '' && revenue > 0;

    if (complete) {
      totalRevenue += Number(revenue);
      daysReported++;
    } else {
      if (!mod) warnings.push(dayName + ': No MOD');
      if (!revenue || revenue <= 0) warnings.push(dayName + ': No revenue');
    }

    daysCompleted.push({
      day: dayName,
      mod: mod,
      revenue: revenueStr,
      complete: complete
    });
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
 * Executes the weekly rollover from the React dialog (non-interactive).
 * Wraps performWeeklyRollover() and returns a result object for the React UI.
 * UI alerts inside performWeeklyRollover() are caught silently (try/catch on getUi).
 */
function executeRollover() {
  try {
    var startTime = new Date();
    performWeeklyRollover();
    var duration = ((new Date()) - startTime) / 1000;
    return {
      success: true,
      message: 'Rollover completed in ' + duration.toFixed(1) + 's.'
    };
  } catch (e) {
    Logger.log('Rollover from UI failed: ' + e.message);
    return { success: false, message: e.message || String(e) };
  }
}


/* ==========================================================================
   EXPORT DASHBOARD — SERVER FUNCTIONS
   ========================================================================== */

/**
 * Returns the current day's export status for the sidebar.
 */
function getExportStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var sheetName = sheet.getName();

  var mod = (sheet.getRange('B4').getValue() || '').toString().trim();
  var revenue = sheet.getRange('B34').getValue();
  var revenueStr = revenue ? '$' + Number(revenue).toLocaleString() : '';

  var errors = [];
  var warnings = [];

  if (!mod) errors.push('MOD name is missing');
  if (!revenue || revenue <= 0) errors.push('Net revenue is missing or zero');

  // Quick pre-checks (full validation runs in IntegrationHub.gs during export)
  var cashTotal = Number(sheet.getRange('B15').getValue()) || 0;
  var tipsTotal = Number(sheet.getRange('B37').getValue()) || 0;
  if (revenue > 0 && cashTotal === 0 && tipsTotal === 0) {
    warnings.push('Cash and tips are both zero — double-check before exporting');
  }

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
 * Runs the TEST export pipeline (sends only to active user).
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
 */
function getAnalyticsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var tz = 'Australia/Sydney';
  var dayNames = ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  var dailyRevenue = [];
  var totalRevenue = 0;
  var topDay = '';
  var topRevenue = 0;

  dayNames.forEach(function(dayName) {
    var daySheet = null;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().toUpperCase().indexOf(dayName) === 0) {
        daySheet = sheets[i];
        break;
      }
    }

    var revenue = 0;
    if (daySheet) {
      revenue = Number(daySheet.getRange('B34').getValue()) || 0;
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

  // Get week range from spreadsheet name
  var weekRange = ss.getName().replace('Waratah Shift Report ', '');

  return {
    venue: 'The Waratah',
    weekRange: weekRange,
    dailyRevenue: dailyRevenue,
    totalRevenue: Math.round(totalRevenue),
    avgRevenue: avgRevenue,
    topDay: topDay
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
   SHARED UTILITIES
   ========================================================================== */

function closeDialog() {
  // Called by client — no-op on server, google.script.host.close() handles it.
}
