/****************************************************
 * TASK INTEGRATION CONFIG & TEST UTILITIES
 *
 * Constants and test helpers for Master Actionables.
 * The main pushTodosToMasterActionables() lives in
 * NightlyExport.gs (single source of truth).
 ****************************************************/

// === CONFIG: MASTER ACTIONABLES SHEET ===
const TASK_SHEET_NAME = "MASTER ACTIONABLES SHEET";

/** Load the Master Actionables spreadsheet ID from Script Properties. */
function getTaskSpreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('TASK_MANAGEMENT_SPREADSHEET_ID');
  if (!id) {
    throw new Error('TASK_MANAGEMENT_SPREADSHEET_ID not configured. Run setupScriptProperties() first.');
  }
  return id;
}
const TASK_TIMEZONE = "Australia/Sydney";

// Column positions in MASTER ACTIONABLES SHEET (1-indexed for setValue)
// Matches actual sheet layout: A=Priority, B=Status, C=Staff, ...
const TASK_COLS = {
  PRIORITY: 1,
  STATUS: 2,
  STAFF: 3,
  AREA: 4,
  DESCRIPTION: 5,
  DUE_DATE: 6,
  DATE_CREATED: 7,
  DATE_COMPLETED: 8,
  DAYS_OPEN: 9,
  BLOCKER_NOTES: 10,
  SOURCE: 11,
  RECURRENCE: 12,
  LAST_UPDATED: 13,
  UPDATED_BY: 14
};

const TOTAL_TASK_COLS = 14;


/**
 * TEST FUNCTION: Run this to test the integration without running the full report.
 * Calls pushTodosToMasterActionables() from NightlyExport.gs.
 */
function testPushTodosToMasterActionables() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();

  const ui = SpreadsheetApp.getUi();
  ui.alert("TEST: Will push TO-DOs from '" + sheetName + "' to Master Actionables.\n\nThis is a test run.");

  pushTodosToMasterActionables(sheet, sheetName);

  ui.alert("Done. Check the Master Actionables sheet and the Apps Script logs.");
}
