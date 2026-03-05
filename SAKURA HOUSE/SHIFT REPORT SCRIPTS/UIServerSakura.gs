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

function openExportDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('export-dashboard');
  SpreadsheetApp.getUi().showSidebar(html);
}

function openAnalyticsViewer() {
  var html = HtmlService.createHtmlOutputFromFile('analytics-viewer');
  SpreadsheetApp.getUi().showSidebar(html);
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
