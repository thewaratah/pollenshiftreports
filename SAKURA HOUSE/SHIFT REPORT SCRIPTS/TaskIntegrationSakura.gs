/****************************************************
 * TASK INTEGRATION — SAKURA HOUSE
 *
 * Pushes shift report TO-DOs to the Sakura Actionables
 * Sheet. Called by NightlyExportSaks.gs during export.
 *
 * Target spreadsheet:
 *   https://docs.google.com/spreadsheets/d/13ANpyoohs9RQMpuS026mSLjLxrH9RIVmtp5i-mRhnZk/edit
 *
 * 14-column schema (aligned with Waratah Master Actionables):
 *   A: Priority, B: Status, C: Staff, D: Area,
 *   E: Description, F: Due Date, G: Date Created,
 *   H: Date Completed, I: Days Open (formula),
 *   J: Blocker Notes, K: Source, L: Recurrence,
 *   M: Last Updated, N: Updated By
 ****************************************************/


// === CONFIG: SAKURA ACTIONABLES SHEET ===
function getActionablesSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('TASK_MANAGEMENT_SPREADSHEET_ID');
}
const SAKURA_ACTIONABLES_TAB_NAME = "SAKURA ACTIONABLES SHEET";
const TASK_TIMEZONE = "Australia/Sydney";

// Column positions (1-indexed, matches Waratah TaskIntegration.gs)
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


// ============================================================================
// MAIN PUSH FUNCTION
// ============================================================================

/**
 * Push TO-DOs from a day sheet to the Sakura Actionables spreadsheet.
 * Non-blocking: failures are logged but do not abort the export.
 * Duplicate detection: skips tasks where the same description was already
 * created today (prevents double-push on re-export).
 *
 * @param {Sheet} sheet - The active day sheet
 * @param {string} sheetName - Sheet name for logging (e.g., "MONDAY 03/02/2025")
 */
function pushTodosToActionables(sheet, sheetName) {
  try {
    // Read TO-DOs using Named Ranges (from Run.gs)
    const todoValues = getFieldValues(sheet, "todoTasks");       // A69:A84 (merged cells A:C — value in column A)
    const assignValues = getFieldValues(sheet, "todoAssignees"); // D69:D84

    const todos = [];
    for (let i = 0; i < todoValues.length; i++) {
      const task = (todoValues[i][0] || "").toString().trim();
      const assignee = (assignValues[i] ? assignValues[i][0] || "" : "").toString().trim();
      if (task) {
        todos.push({ description: task, assignee: assignee });
      }
    }

    if (todos.length === 0) {
      Logger.log("No TO-DOs to push to Sakura Actionables.");
      return;
    }

    // Open the Actionables sheet
    const masterSS = SpreadsheetApp.openById(getActionablesSheetId_());
    const masterSheet = masterSS.getSheetByName(SAKURA_ACTIONABLES_TAB_NAME);

    if (!masterSheet) {
      Logger.log(`"${SAKURA_ACTIONABLES_TAB_NAME}" tab not found in Actionables spreadsheet.`);
      return;
    }

    // Build a set of open-task descriptions (duplicate detection).
    // A task is considered a duplicate if it already exists with a status that
    // is not DONE or CANCELLED — regardless of when it was created.
    // This prevents re-pushing tasks that were created on a previous day but
    // have not yet been completed or cancelled.
    const existingDescriptions = new Set();

    const lastRow = masterSheet.getLastRow();
    if (lastRow > 1) {
      // Batch-read STATUS (col B) and DESCRIPTION (col E) together.
      // We read from column 2 (STATUS) through column 5 (DESCRIPTION): 4 columns wide.
      const existingData = masterSheet.getRange(2, TASK_COLS.STATUS, lastRow - 1, 4).getValues();
      // Columns within each row: [0]=Status, [1]=Staff, [2]=Area, [3]=Description

      for (let i = 0; i < existingData.length; i++) {
        const status = (existingData[i][0] || "").toString().trim().toUpperCase();
        const desc = (existingData[i][3] || "").toString().trim();
        const isOpen = status && !['DONE', 'CANCELLED'].includes(status);
        if (isOpen && desc) {
          existingDescriptions.add(desc);
        }
      }
    }

    const now = new Date();
    const user = Session.getActiveUser().getEmail() || "System";
    let pushed = 0;
    let skipped = 0;

    // Build all rows to write in a single batch rather than one appendRow per task.
    const newRows = [];
    todos.forEach(t => {
      if (existingDescriptions.has(t.description)) {
        skipped++;
        return;
      }
      newRows.push([
        "MEDIUM",         // A: Priority
        "NEW",            // B: Status
        t.assignee,       // C: Staff Allocated
        "General",        // D: Area
        t.description,    // E: Description
        "",               // F: Due Date
        now,              // G: Date Created
        "",               // H: Date Completed
        "",               // I: Days Open (formula set below)
        "",               // J: Blocker Notes
        "Shift Report",   // K: Source
        "None",           // L: Recurrence
        now,              // M: Last Updated
        user              // N: Updated By
      ]);
    });

    if (newRows.length > 0) {
      // Write all data rows in one Sheets API call.
      const firstNewRow = masterSheet.getLastRow() + 1;
      masterSheet
        .getRange(firstNewRow, 1, newRows.length, TOTAL_TASK_COLS)
        .setValues(newRows);

      // Set the Days Open formula for each new row in a second batch pass.
      // Formula column (I = col 9) is separated because setValues() cannot write formulas
      // when the array also contains plain values in other columns of the same range
      // — GAS treats the entire range as plain values in that case.
      const formulaValues = [];
      for (let r = firstNewRow; r < firstNewRow + newRows.length; r++) {
        formulaValues.push([
          `=IF(G${r}="","",IF(H${r}="",TODAY()-G${r},H${r}-G${r}))`
        ]);
      }
      masterSheet
        .getRange(firstNewRow, TASK_COLS.DAYS_OPEN, newRows.length, 1)
        .setFormulas(formulaValues);

      // M3 — AI Task Classification (non-blocking, per-row).
      // For each newly written row, call classifyTask_Sakura() and update
      // Priority (col A), Area (col D), and Source (col K) if a result is returned.
      // Failures are silently logged; the row retains its defaults.
      for (let i = 0; i < newRows.length; i++) {
        try {
          const description = newRows[i][TASK_COLS.DESCRIPTION - 1]; // E = index 4
          const classification = classifyTask_Sakura(description);
          if (classification) {
            const targetRow = firstNewRow + i;
            masterSheet.getRange(targetRow, TASK_COLS.PRIORITY).setValue(classification.priority);
            masterSheet.getRange(targetRow, TASK_COLS.AREA).setValue(classification.area);
            masterSheet.getRange(targetRow, TASK_COLS.SOURCE).setValue('Shift Report (AI)');
          }
        } catch (classifyErr) {
          Logger.log('M3 Classify (Sakura) row ' + (firstNewRow + i) + ' error (non-blocking): ' + classifyErr.message);
        }
      }

      pushed = newRows.length;
    }

    if (skipped > 0) {
      Logger.log(`Skipped ${skipped} duplicate TO-DO(s) (already exists as an open task).`);
    }
    Logger.log(`Pushed ${pushed} TO-DO(s) from "${sheetName}" to Sakura Actionables.`);

  } catch (e) {
    Logger.log(`Task push to Sakura Actionables failed (non-blocking): ${e.message}`);
  }
}


// ============================================================================
// TEST UTILITY
// ============================================================================

/**
 * Diagnostic: log the spreadsheet ID from Script Properties and attempt to
 * open it, reporting the full error stack if it fails.
 * Run this directly from the GAS editor to diagnose openById failures.
 */
function diagnoseTMAccess() {
  const id = PropertiesService.getScriptProperties().getProperty('TASK_MANAGEMENT_SPREADSHEET_ID');
  Logger.log('TASK_MANAGEMENT_SPREADSHEET_ID = ' + id);
  if (!id) { Logger.log('ERROR: property not set'); return; }
  try {
    const ss = SpreadsheetApp.openById(id);
    Logger.log('Opened: ' + ss.getName());
    const sheet = ss.getSheetByName(SAKURA_ACTIONABLES_TAB_NAME);
    Logger.log('Tab "' + SAKURA_ACTIONABLES_TAB_NAME + '": ' + (sheet ? 'FOUND' : 'NOT FOUND'));
  } catch (e) {
    Logger.log('FAILED: ' + e.message);
    Logger.log('STACK: ' + e.stack);
  }
}

/**
 * Test function: Push TO-DOs from the active sheet without running the full export.
 */
function testPushTodosToActionables() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();
  const ui = SpreadsheetApp.getUi();

  ui.alert(
    "TEST: Task Push",
    `Will push TO-DOs from "${sheetName}" to Sakura Actionables.\n\n` +
    `Target: ${SAKURA_ACTIONABLES_TAB_NAME}\n\nThis is a test run.`,
    ui.ButtonSet.OK
  );

  pushTodosToActionables(sheet, sheetName);

  ui.alert("Done. Check the Sakura Actionables sheet and the Apps Script logs.");
}

/**
 * Backfill all day sheets: rebuilds the TO-DOs aggregation tab then pushes
 * every day sheet's TO-DOs to the Sakura Actionables spreadsheet.
 *
 * Run this manually from the Apps Script editor when you need to re-sync all
 * six day sheets in a single pass (e.g. after a rollover or data repair).
 *
 * Steps:
 *   1. Rebuilds the TO-DOs tab via buildTodoAggregationSheet_().
 *   2. Loops every sheet; skips non-day sheets using SAKURA_DAYS prefix match.
 *   3. Calls pushTodosToActionables() for each day sheet found.
 *   4. Logs a completion summary and shows a UI alert.
 */
function backfillAllDaysTodos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Step 1: Rebuild the TO-DOs aggregation tab.
  buildTodoAggregationSheet_(ss);

  // Step 2: Loop all sheets, push day sheets to Actionables.
  const allSheets = ss.getSheets();
  let count = 0;

  allSheets.forEach(function(sheet) {
    const name = sheet.getName();
    if (SAKURA_DAYS.some(function(day) { return name.startsWith(day); })) {
      pushTodosToActionables(sheet, name);
      count++;
    }
  });

  // Step 3: Log summary.
  Logger.log('Backfill done: ' + count + ' day sheets processed.');

  // Step 4: Alert the user.
  SpreadsheetApp.getUi().alert(
    'Backfill Complete',
    count + ' day sheet(s) processed. Check Apps Script logs for details.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Push TO-DOs from the currently active day sheet to the Sakura Actionables
 * spreadsheet. Does not rebuild the TO-DOs tab and does not loop other sheets.
 *
 * Run from the menu while the target day sheet is active (e.g. "MONDAY 03/03/2025").
 * Duplicate detection prevents re-adding tasks already pushed today.
 */
function pushCurrentSheetTodosToActionables() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const name = sheet.getName();

  if (!SAKURA_DAYS.some(function(day) { return name.startsWith(day); })) {
    ui.alert('Wrong Sheet', 'Navigate to a day sheet (e.g. MONDAY, TUESDAY…) before running this.', ui.ButtonSet.OK);
    return;
  }

  pushTodosToActionables(sheet, name);

  ui.alert('Done', 'TO-DOs from "' + name + '" pushed to Actionables.\nCheck Apps Script logs for details.', ui.ButtonSet.OK);
}
