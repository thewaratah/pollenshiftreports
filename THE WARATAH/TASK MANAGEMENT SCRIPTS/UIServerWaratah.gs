/****************************************************
 * UI SERVER — WARATAH TASK MANAGEMENT
 *
 * Bridge functions for the Task Manager React dialog.
 * Called from the Waratah Actionables Sheet GAS project.
 *
 * Dependencies:
 *   EnhancedTaskManagement.gs - TASK_CONFIG, COLS, TOTAL_COLS,
 *                               ACTIVE_STATUSES, createTask(), logAuditEntry_()
 ****************************************************/


function openTaskManager() {
  var html = HtmlService.createHtmlOutputFromFile('task-manager')
    .setWidth(600)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Task Manager');
}


/**
 * Returns all active tasks for the Task Manager UI.
 */
function getActiveTasks() {
  var ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  var sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  var tz = TASK_CONFIG.timezone;
  var tasks = [];

  data.forEach(function(row, index) {
    var status = (row[COLS.STATUS] || '').toString().trim().toUpperCase();
    var description = (row[COLS.DESCRIPTION] || '').toString().trim();
    if (!description) return;

    var dueDate = row[COLS.DUE_DATE];
    var dateCreated = row[COLS.DATE_CREATED];
    var dateCompleted = row[COLS.DATE_COMPLETED];
    var daysOpen = row[COLS.DAYS_OPEN];

    tasks.push({
      rowNum: index + 2,
      status: status,
      priority: (row[COLS.PRIORITY] || '').toString().trim().toUpperCase(),
      staff: (row[COLS.STAFF] || '').toString().trim(),
      area: (row[COLS.AREA] || '').toString().trim(),
      description: description,
      dueDate: dueDate instanceof Date ? Utilities.formatDate(dueDate, tz, 'dd/MM/yyyy') : '',
      dateCreated: dateCreated instanceof Date ? Utilities.formatDate(dateCreated, tz, 'dd/MM/yyyy') : '',
      dateCompleted: dateCompleted instanceof Date ? Utilities.formatDate(dateCompleted, tz, 'dd/MM/yyyy') : '',
      daysOpen: typeof daysOpen === 'number' ? daysOpen : 0,
      blockerNotes: (row[COLS.BLOCKER_NOTES] || '').toString().trim(),
      source: (row[COLS.SOURCE] || '').toString().trim(),
      recurrence: (row[COLS.RECURRENCE] || '').toString().trim()
    });
  });

  return tasks;
}


/**
 * Updates a task's fields by row number.
 * Uses !== undefined checks so empty-string values can clear fields.
 * Auto-sets Date Completed when status changes to DONE or CANCELLED.
 */
function updateTask(rowNum, updates) {
  var ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  var sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  if (!sheet) return false;

  var now = new Date();
  var user = Session.getActiveUser().getEmail() || 'System';

  // Read the entire row once, then update indices, then write back in a single call
  var rowData = sheet.getRange(rowNum, 1, 1, TOTAL_COLS).getValues()[0];

  if (updates.status !== undefined) {
    rowData[COLS.STATUS] = updates.status;
    // Auto-set Date Completed when marking DONE or CANCELLED
    if (updates.status === 'DONE' || updates.status === 'CANCELLED') {
      rowData[COLS.DATE_COMPLETED] = now;
    }
  }
  if (updates.priority !== undefined) rowData[COLS.PRIORITY] = updates.priority;
  if (updates.staff !== undefined) rowData[COLS.STAFF] = updates.staff;
  if (updates.area !== undefined) rowData[COLS.AREA] = updates.area;
  if (updates.description !== undefined) rowData[COLS.DESCRIPTION] = updates.description;
  if (updates.blockerNotes !== undefined) rowData[COLS.BLOCKER_NOTES] = updates.blockerNotes;

  // Audit trail
  rowData[COLS.LAST_UPDATED] = now;
  rowData[COLS.UPDATED_BY] = user;

  // Write back the entire row in a single API call
  sheet.getRange(rowNum, 1, 1, TOTAL_COLS).setValues([rowData]);

  return true;
}


/**
 * Creates a new task from the React UI.
 * Adapter: maps UI field names to canonical createTask() in EnhancedTaskManagement.gs.
 */
function createTaskFromUI(taskData) {
  createTask({
    description: taskData.description || '',
    priority: taskData.priority || 'MEDIUM',
    assignee: taskData.staff || '',
    area: taskData.area || 'General',
    dueDate: taskData.dueDate || '',
    source: 'Manual'
  });
  return true;
}
