/****************************************************
 * THE WARATAH — ENHANCED TASK MANAGEMENT SYSTEM
 * Version: 1.2.0
 *
 * Features:
 *   - 8-status workflow system
 *   - Priority levels with visual highlighting
 *   - Due date tracking with overdue escalation
 *   - Recurring task regeneration
 *   - Full audit logging
 *   - Automatic archival (30 days)
 *   - Blocked task escalation (14 days → Evan)
 *   - Auto-sort and empty row cleanup
 *   - Bi-hourly cleanup trigger
 *
 * Triggers Required:
 *   - Bi-hourly: cleanupAndSortMasterActionables()
 *   - Daily 6am: runScheduledStaffWorkload()
 *   - Weekly Mon 6am: runScheduledArchive()
 *   - Weekly Mon 9am: sendWeeklyActiveTasksSummary() [optional]
 *   - Weekly Sun 9am: runScheduledOverdueSummary()
 *   - onEdit: onTaskSheetEditWithAutoSort(e) [installable trigger]
 *
 * @author Claude (Anthropic) for Pollen Hospitality
 * @version 1.2.0
 * @updated 2026-03-06
 ****************************************************/


/* ==========================================================================
   CREDENTIAL GETTERS (loaded from Script Properties)
   ========================================================================== */

/** Get the Task Management spreadsheet ID from Script Properties */
function getTaskSpreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('TASK_MANAGEMENT_SPREADSHEET_ID');
  if (!id) {
    throw new Error('TASK_MANAGEMENT_SPREADSHEET_ID not configured in Script Properties. Run _SETUP_ScriptProperties.gs first.');
  }
  return id;
}

/** Get escalation email address from Script Properties */
function getEscalationEmail_() {
  const email = PropertiesService.getScriptProperties().getProperty('ESCALATION_EMAIL');
  if (!email) {
    throw new Error('ESCALATION_EMAIL not configured in Script Properties. Run _SETUP_ScriptProperties.gs first.');
  }
  return email;
}

/** Get escalation Slack webhook from Script Properties */
function getEscalationSlackWebhook_() {
  const webhook = PropertiesService.getScriptProperties().getProperty('ESCALATION_SLACK_WEBHOOK');
  if (!webhook) {
    throw new Error('ESCALATION_SLACK_WEBHOOK not configured in Script Properties. Run _SETUP_ScriptProperties.gs first.');
  }
  return webhook;
}

/** Get managers channel Slack webhook from Script Properties */
function getManagersChannelWebhook_() {
  const webhook = PropertiesService.getScriptProperties().getProperty('SLACK_MANAGERS_CHANNEL_WEBHOOK');
  if (!webhook) {
    throw new Error('SLACK_MANAGERS_CHANNEL_WEBHOOK not configured in Script Properties. Run _SETUP_ScriptProperties.gs first.');
  }
  return webhook;
}

/** Get Slack DM webhooks map from Script Properties */
function getSlackDmWebhooks_() {
  const json = PropertiesService.getScriptProperties().getProperty('SLACK_DM_WEBHOOKS');
  if (!json) {
    throw new Error('SLACK_DM_WEBHOOKS not configured in Script Properties. Run _SETUP_ScriptProperties.gs first.');
  }
  return JSON.parse(json);
}


/* ==========================================================================
   CONFIGURATION
   ========================================================================== */

const TASK_CONFIG = {
  // Sheet names
  sheets: {
    master: "MASTER ACTIONABLES SHEET",
    audit: "AUDIT LOG",
    archive: "ARCHIVE"
  },

  // Timezone
  timezone: "Australia/Sydney",

  // Escalation settings
  escalation: {
    blockedDaysBeforeEscalate: 14,  // 2 weeks
    escalateToName: "Evan"
  },

  // Archive settings
  archive: {
    daysBeforeArchive: 30  // 1 month
  }
};


/* ==========================================================================
   COLUMN DEFINITIONS (0-indexed for arrays)
   ========================================================================== */

const COLS = {
  PRIORITY: 0,         // A: Priority
  STATUS: 1,           // B: Status
  STAFF: 2,            // C: Staff Allocated
  AREA: 3,             // D: Area
  DESCRIPTION: 4,      // E: Description
  DUE_DATE: 5,         // F: Due Date
  DATE_CREATED: 6,     // G: Date Created
  DATE_COMPLETED: 7,   // H: Date Completed
  DAYS_OPEN: 8,        // I: Days Open (formula)
  BLOCKER_NOTES: 9,    // J: Blocker Notes
  SOURCE: 10,          // K: Source
  RECURRENCE: 11,      // L: Recurrence
  LAST_UPDATED: 12,    // M: Last Updated
  UPDATED_BY: 13       // N: Updated By
};

// Total columns in new schema
const TOTAL_COLS = 14;

// Header row for new schema
const HEADERS = [
  "Priority",
  "Status",
  "Staff Allocated",
  "Area",
  "Description",
  "Due Date",
  "Date Created",
  "Date Completed",
  "Days Open",
  "Blocker Notes",
  "Source",
  "Recurrence",
  "Last Updated",
  "Updated By"
];


/* ==========================================================================
   STATUS & PRIORITY DEFINITIONS
   ========================================================================== */

const STATUSES = {
  NEW: "NEW",
  TODO: "TO DO",
  IN_PROGRESS: "IN PROGRESS",
  TO_DISCUSS: "TO DISCUSS",
  BLOCKED: "BLOCKED",
  DEFERRED: "DEFERRED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
  RECURRING: "RECURRING"
};

const STATUS_LIST = [
  STATUSES.NEW,
  STATUSES.TODO,
  STATUSES.IN_PROGRESS,
  STATUSES.TO_DISCUSS,
  STATUSES.BLOCKED,
  STATUSES.DEFERRED,
  STATUSES.DONE,
  STATUSES.CANCELLED,
  STATUSES.RECURRING
];

const STATUS_EMOJI = {
  [STATUSES.NEW]: "🔵",
  [STATUSES.TODO]: "⚪",
  [STATUSES.IN_PROGRESS]: "🟡",
  [STATUSES.TO_DISCUSS]: "💬",
  [STATUSES.BLOCKED]: "🔴",
  [STATUSES.DEFERRED]: "🟠",
  [STATUSES.DONE]: "🟢",
  [STATUSES.CANCELLED]: "⚫",
  [STATUSES.RECURRING]: "🟣"
};

const STATUS_COLORS = {
  [STATUSES.NEW]: "#4285f4",        // Blue
  [STATUSES.TODO]: "#ff6d01",       // Orange
  [STATUSES.IN_PROGRESS]: "#fbbc04", // Yellow
  [STATUSES.TO_DISCUSS]: "#e2b3ff", // Light Purple
  [STATUSES.BLOCKED]: "#ea4335",    // Red
  [STATUSES.DEFERRED]: "#ff6d01",   // Orange
  [STATUSES.DONE]: "#34a853",       // Green
  [STATUSES.CANCELLED]: "#9aa0a6",  // Grey
  [STATUSES.RECURRING]: "#a142f4"   // Purple
};

// Statuses that are "active" (not completed/cancelled)
const ACTIVE_STATUSES = [
  STATUSES.NEW,
  STATUSES.TODO,
  STATUSES.IN_PROGRESS,
  STATUSES.TO_DISCUSS,
  STATUSES.BLOCKED,
  STATUSES.DEFERRED,
  STATUSES.RECURRING
];

// Statuses eligible for recurrence regeneration
const RECURRENCE_ELIGIBLE_STATUSES = [
  STATUSES.TODO,
  STATUSES.IN_PROGRESS,
  STATUSES.TO_DISCUSS,
  STATUSES.DEFERRED,
  STATUSES.RECURRING
];

const PRIORITIES = {
  URGENT: "URGENT",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  ONE_DAY: "ONE DAY"
};

const PRIORITY_LIST = [
  PRIORITIES.URGENT,
  PRIORITIES.HIGH,
  PRIORITIES.MEDIUM,
  PRIORITIES.LOW,
  PRIORITIES.ONE_DAY
];

const PRIORITY_EMOJI = {
  [PRIORITIES.URGENT]: "🔴",
  [PRIORITIES.HIGH]: "🟠",
  [PRIORITIES.MEDIUM]: "🟡",
  [PRIORITIES.LOW]: "🔵",
  [PRIORITIES.ONE_DAY]: "⚪"
};

const AREAS = [
  "FOH",
  "BOH", 
  "Bar",
  "Kitchen",
  "Admin",
  "Maintenance",
  "Marketing",
  "Events",
  "Training",
  "General"
];

const SOURCES = [
  "Shift Report",
  "Meeting",
  "Ad-hoc"
];

const RECURRENCE_OPTIONS = [
  "None",
  "Weekly",
  "Fortnightly",
  "Monthly"
];

const STAFF_LIST = [
  "Evan",
  "Cynthia",
  "Adam",
  "Lily",
  "Bar Team",
  "Dipti",
  "Howie",
  "Kitchen Team",
  "All",
  "Contractor",
  "FOH Team",
  "General Management",
  "Marketing Explicit"
];


/* ==========================================================================
   AUTO-SORT & CLEANUP FUNCTIONS
   ========================================================================== */

/**
 * Advanced sort with custom status and priority ordering.
 * Sorts: Active first → Priority → Status → Staff (alphabetical).
 */
function sortMasterActionablesAdvanced() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) {
    Logger.log("Master sheet not found.");
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No data to sort.");
    return;
  }
  
  // Define sort order for statuses (lower = higher priority)
  const statusOrder = {
    "NEW": 1,
    "TO DO": 2,
    "IN PROGRESS": 3,
    "TO DISCUSS": 4,
    "BLOCKED": 5,
    "DEFERRED": 6,
    "RECURRING": 7,
    "DONE": 8,
    "CANCELLED": 9
  };

  // Define sort order for priorities
  const priorityOrder = {
    "URGENT": 1,
    "HIGH": 2,
    "MEDIUM": 3,
    "LOW": 4,
    "ONE DAY": 5
  };

  // Get all data
  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();

  // Sort the data
  data.sort((a, b) => {
    // 1. Active vs completed (active first, done/recurring/cancelled last)
    const statusA = statusOrder[a[COLS.STATUS]] || 99;
    const statusB = statusOrder[b[COLS.STATUS]] || 99;
    const activeA = statusA <= 6 ? 0 : 1;  // DEFERRED (6) and below = active
    const activeB = statusB <= 6 ? 0 : 1;
    if (activeA !== activeB) return activeA - activeB;

    // 2. Priority order (urgent first)
    const priorityA = priorityOrder[a[COLS.PRIORITY]] || 99;
    const priorityB = priorityOrder[b[COLS.PRIORITY]] || 99;
    if (priorityA !== priorityB) return priorityA - priorityB;

    // 3. Status order within same priority group
    if (statusA !== statusB) return statusA - statusB;

    // 4. Group by staff (alphabetical, blanks last)
    const staffA = (a[COLS.STAFF] || "").toString().trim();
    const staffB = (b[COLS.STAFF] || "").toString().trim();
    if (!staffA && staffB) return 1;
    if (staffA && !staffB) return -1;
    if (staffA !== staffB) return staffA.localeCompare(staffB);

    return 0;
  });
  
  // Write sorted data back
  sheet.getRange(2, 1, data.length, TOTAL_COLS).setValues(data);
  
  // Reapply Days Open formula
  addDaysOpenFormula_(sheet);
  
  Logger.log(`Sorted ${data.length} rows in Master Actionables.`);
}


/**
 * Removes empty rows from the Master Actionables Sheet.
 * A row is considered empty if both Status (A) and Priority (B) are blank.
 */
function removeEmptyRows() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);

  if (!sheet) {
    Logger.log("Master sheet not found.");
    return;
  }

  // Use getMaxRows() to check ALL rows, including empty ones with data validation
  const maxRows = sheet.getMaxRows();
  if (maxRows < 2) {
    Logger.log("No data rows to check.");
    return;
  }

  const data = sheet.getRange(2, 1, maxRows - 1, TOTAL_COLS).getValues();
  const rowsToDelete = [];

  // Find empty rows - ALL data columns must be empty (excluding formula columns)
  data.forEach((row, index) => {
    // Check if all cells are empty, EXCEPT skip Days Open column (index 8) which contains a formula
    // Note: Empty dropdown selections appear as empty strings
    const isRowEmpty = row.every((cell, colIndex) => {
      // Skip Days Open column (COLS.DAYS_OPEN = 8) - it always contains a formula
      if (colIndex === COLS.DAYS_OPEN) {
        return true;  // Ignore this column in empty check
      }

      // Handle dates, strings, and other types
      if (cell === null || cell === undefined || cell === "") {
        return true;  // Cell is empty
      }

      // Convert to string and trim
      const cellValue = cell.toString().trim();
      return cellValue === "";  // Cell is empty after trimming
    });

    if (isRowEmpty) {
      rowsToDelete.push(index + 2);  // +2 for header and 0-index
    }
  });
  
  if (rowsToDelete.length === 0) {
    Logger.log("No empty rows found.");
    return;
  }
  
  // Delete in reverse order to maintain row indices
  rowsToDelete.sort((a, b) => b - a).forEach(rowNum => {
    sheet.deleteRow(rowNum);
  });
  
  Logger.log(`Removed ${rowsToDelete.length} empty row(s).`);
  
  // Log to audit
  logAuditEntry_("CLEANUP", "System", `Removed ${rowsToDelete.length} empty rows`);
}


/**
 * DEBUG: Check what's actually in a specific row
 * Helps diagnose why "empty" rows aren't being deleted
 */
function debugRowContent() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Debug Row Content',
    'Enter row number to inspect (e.g., 219):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const rowNum = parseInt(response.getResponseText());
  if (isNaN(rowNum) || rowNum < 2) {
    ui.alert('Invalid row number');
    return;
  }

  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);

  if (!sheet) {
    ui.alert('Master sheet not found');
    return;
  }

  const data = sheet.getRange(rowNum, 1, 1, TOTAL_COLS).getValues()[0];

  let report = `Row ${rowNum} Content:\n\n`;
  const headers = HEADERS;

  data.forEach((cell, index) => {
    const cellType = typeof cell;
    const cellValue = cell === null ? 'null' : cell === undefined ? 'undefined' : cell;
    const cellStr = cell === null || cell === undefined ? '' : cell.toString();
    const isEmpty = cell === null || cell === undefined || cell === "" || cellStr.trim() === "";

    report += `${headers[index]} (Col ${String.fromCharCode(65 + index)}):\n`;
    report += `  Type: ${cellType}\n`;
    report += `  Value: "${cellValue}"\n`;
    report += `  Length: ${cellStr.length}\n`;
    report += `  Empty: ${isEmpty}\n\n`;
  });

  Logger.log(report);
  ui.alert('Row Content', report, ui.ButtonSet.OK);
}


/**
 * Runs both cleanup and sort in one operation.
 * Called by bi-hourly trigger, daily maintenance, and menu.
 * Uses LockService to prevent concurrent execution.
 */
function cleanupAndSortMasterActionables() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Could not acquire lock — skipping cleanup & sort');
    return;
  }
  try {
    Logger.log("=== Starting Cleanup & Sort ===");
    removeEmptyRows();
    sortMasterActionablesAdvanced();
    Logger.log("=== Cleanup & Sort Complete ===");
  } catch (e) {
    Logger.log('❌ [cleanupAndSortMasterActionables] failed: ' + e.message + '\n' + e.stack);
    try {
      const webhook = getEscalationSlackWebhook_();
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [cleanupAndSortMasterActionables] Waratah cleanup failed: ' + e.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ Slack notification also failed: ' + slackErr.message);
    }
  } finally {
    lock.releaseLock();
  }
}


/* ==========================================================================
   SHEET SETUP & MIGRATION
   ========================================================================== */

/**
 * One-time setup: Migrates existing sheet to new schema.
 * Run this manually once to upgrade the sheet structure.
 * 
 * IMPORTANT: Back up your sheet before running!
 */
function migrateToEnhancedSchema() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    "⚠️ Schema Migration",
    "This will restructure your MASTER ACTIONABLES SHEET to the new enhanced schema.\n\n" +
    "BACK UP YOUR SHEET FIRST!\n\n" +
    "Continue?",
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    ui.alert("Migration cancelled.");
    return;
  }
  
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) {
    ui.alert(`Sheet "${TASK_CONFIG.sheets.master}" not found.`);
    return;
  }
  
  // Read existing data
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < 2) {
    ui.alert("No data rows found. Setting up fresh schema.");
    setupFreshSchema_(sheet);
    return;
  }
  
  // Old schema: A:Status, B:Staff, C:Area, D:Description, E:DateCreated, F:Notes
  const oldData = sheet.getRange(2, 1, lastRow - 1, Math.min(lastCol, 6)).getValues();
  
  // Map old data to new schema
  const newData = oldData.map(row => {
    const oldStatus = (row[0] || "").toString().trim().toUpperCase();
    const oldStaff = (row[1] || "").toString().trim();
    const oldArea = (row[2] || "").toString().trim();
    const oldDescription = (row[3] || "").toString().trim();
    const oldDateCreated = row[4];
    const oldNotes = (row[5] || "").toString().trim();
    
    // Skip empty rows
    if (!oldDescription) return null;
    
    // Map old status to new
    let newStatus = STATUSES.TODO;
    if (oldStatus === "DONE") newStatus = STATUSES.DONE;
    else if (oldStatus === "TO DO") newStatus = STATUSES.TODO;
    else if (oldStatus) newStatus = oldStatus;
    
    return [
      PRIORITIES.MEDIUM,                      // A: Priority (default)
      newStatus,                              // B: Status
      oldStaff,                               // C: Staff Allocated
      oldArea || "General",                   // D: Area
      oldDescription,                         // E: Description
      "",                                     // F: Due Date (blank)
      oldDateCreated || new Date(),           // G: Date Created
      newStatus === STATUSES.DONE ? new Date() : "", // H: Date Completed
      "",                                     // I: Days Open (formula)
      "",                                     // J: Blocker Notes
      "Meeting",                              // K: Source (assume meeting for existing)
      "None",                                 // L: Recurrence
      new Date(),                             // M: Last Updated
      "Migration"                             // N: Updated By
    ];
  }).filter(row => row !== null);
  
  // Clear sheet data and rebuild (preserves sheet-level properties)
  sheet.getDataRange().clearContent();
  
  // Set headers
  sheet.getRange(1, 1, 1, TOTAL_COLS).setValues([HEADERS]);
  
  // Write migrated data
  if (newData.length > 0) {
    sheet.getRange(2, 1, newData.length, TOTAL_COLS).setValues(newData);
  }
  
  // Apply formatting and validation
  applySheetFormatting_(sheet);
  applyDataValidation_(sheet);
  applyConditionalFormatting_(sheet);
  addDaysOpenFormula_(sheet);
  
  // Create audit log sheet if doesn't exist
  ensureAuditLogSheet_(ss);
  
  // Create archive sheet if doesn't exist
  ensureArchiveSheet_(ss);
  
  // Log migration
  logAuditEntry_("MIGRATION", "System", "Schema migrated to enhanced task management v1.0");
  
  ui.alert(
    "✅ Migration Complete",
    `Migrated ${newData.length} tasks to new schema.\n\n` +
    "New features enabled:\n" +
    "• 8-status workflow\n" +
    "• Priority levels\n" +
    "• Due dates\n" +
    "• Audit logging\n" +
    "• Auto-archival\n" +
    "• Blocked task escalation",
    ui.ButtonSet.OK
  );
}


/**
 * Sets up a fresh schema on an empty sheet.
 */
function setupFreshSchema_(sheet) {
  sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, 1, TOTAL_COLS).setValues([HEADERS]);
  applySheetFormatting_(sheet);
  applyDataValidation_(sheet);
  applyConditionalFormatting_(sheet);
  addDaysOpenFormula_(sheet);
}


/**
 * Applies standard formatting to the sheet.
 */
function applySheetFormatting_(sheet) {
  // Header formatting
  const headerRange = sheet.getRange(1, 1, 1, TOTAL_COLS);
  headerRange
    .setFontWeight("bold")
    .setBackground("#4a4a4a")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  const columnWidths = {
    1: 80,   // Priority
    2: 110,  // Status
    3: 120,  // Staff
    4: 100,  // Area
    5: 350,  // Description
    6: 100,  // Due Date
    7: 100,  // Date Created
    8: 100,  // Date Completed
    9: 80,   // Days Open
    10: 200, // Blocker Notes
    11: 100, // Source
    12: 100, // Recurrence
    13: 140, // Last Updated
    14: 150  // Updated By
  };
  
  Object.entries(columnWidths).forEach(([col, width]) => {
    sheet.setColumnWidth(parseInt(col), width);
  });
  
  // Date format for date columns
  const lastRow = Math.max(sheet.getLastRow(), 100);
  sheet.getRange(2, COLS.DUE_DATE + 1, lastRow, 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(2, COLS.DATE_CREATED + 1, lastRow, 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(2, COLS.DATE_COMPLETED + 1, lastRow, 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(2, COLS.LAST_UPDATED + 1, lastRow, 1).setNumberFormat("dd/mm/yyyy hh:mm");
}


/**
 * Applies data validation dropdowns.
 */
function applyDataValidation_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 500);
  
  // Status dropdown
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_LIST, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COLS.STATUS + 1, lastRow, 1).setDataValidation(statusRule);
  
  // Priority dropdown
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PRIORITY_LIST, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COLS.PRIORITY + 1, lastRow, 1).setDataValidation(priorityRule);
  
  // Staff dropdown
  const staffRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STAFF_LIST, true)
    .setAllowInvalid(false)  // Required - no custom entries
    .build();
  sheet.getRange(2, COLS.STAFF + 1, lastRow, 1).setDataValidation(staffRule);
  
  // Area dropdown
  const areaRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(AREAS, true)
    .setAllowInvalid(true)  // Allow custom areas
    .build();
  sheet.getRange(2, COLS.AREA + 1, lastRow, 1).setDataValidation(areaRule);
  
  // Source dropdown
  const sourceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SOURCES, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, COLS.SOURCE + 1, lastRow, 1).setDataValidation(sourceRule);
  
  // Recurrence dropdown
  const recurrenceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RECURRENCE_OPTIONS, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COLS.RECURRENCE + 1, lastRow, 1).setDataValidation(recurrenceRule);
}


/**
 * Applies conditional formatting for status and priority colors.
 */
function applyConditionalFormatting_(sheet) {
  // Clear existing conditional format rules
  sheet.clearConditionalFormatRules();
  
  const rules = [];
  const lastRow = 500;
  
  // Status column coloring (column B) - excluding DONE/CANCELLED which get grey text
  const statusRange = sheet.getRange(2, COLS.STATUS + 1, lastRow, 1);

  Object.entries(STATUS_COLORS).forEach(([status, color]) => {
    // Skip DONE and CANCELLED - they'll get special formatting later
    if (status === STATUSES.DONE || status === STATUSES.CANCELLED) {
      return;
    }

    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status)
      .setBackground(color)
      .setFontColor(color === "#ffffff" ? "#000000" : "#ffffff")
      .setRanges([statusRange])
      .build();
    rules.push(rule);
  });

  // Priority column coloring (column A) - excluding DONE/CANCELLED which get green
  const priorityRange = sheet.getRange(2, COLS.PRIORITY + 1, lastRow, 1);

  // URGENT - red background (excluding DONE/CANCELLED)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2="URGENT",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#ea4335")
    .setFontColor("#ffffff")
    .setBold(true)
    .setRanges([priorityRange])
    .build());

  // HIGH - orange background (excluding DONE/CANCELLED)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2="HIGH",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#ff6d01")
    .setFontColor("#ffffff")
    .setRanges([priorityRange])
    .build());

  // MEDIUM - yellow background (excluding DONE/CANCELLED)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2="MEDIUM",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#fbbc04")
    .setFontColor("#000000")
    .setRanges([priorityRange])
    .build());

  // LOW - light blue background (excluding DONE/CANCELLED)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2="LOW",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#c9daf8")
    .setFontColor("#000000")
    .setRanges([priorityRange])
    .build());

  // ONE DAY - light grey background (excluding DONE/CANCELLED)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2="ONE DAY",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#e0e0e0")
    .setFontColor("#000000")
    .setRanges([priorityRange])
    .build());

  // Row-level highlighting
  const rowRange = sheet.getRange(2, 1, lastRow, TOTAL_COLS);

  // URGENT tasks - Light red tint (exclude DONE/CANCELLED so green styling wins)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2="URGENT",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#fce8e6")
    .setRanges([rowRange])
    .build());

  // BLOCKED tasks - Light red tint (exclude DONE/CANCELLED)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($B2="BLOCKED",NOT(OR($B2="DONE",$B2="CANCELLED")))')
    .setBackground("#fce8e6")
    .setRanges([rowRange])
    .build());

  // DONE or CANCELLED tasks - light green background, grey text, strikethrough
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR($B2="DONE",$B2="CANCELLED")')
    .setBackground("#f3ffe2")
    .setStrikethrough(true)
    .setFontColor("#a1a6ae")
    .setRanges([rowRange])
    .build());
  
  sheet.setConditionalFormatRules(rules);
}


/**
 * Adds the Days Open formula to column I.
 */
function addDaysOpenFormula_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 100);
  const formula = '=IF(G2="","",IF(H2="",TODAY()-G2,H2-G2))';
  
  // Set formula for first data row
  sheet.getRange(2, COLS.DAYS_OPEN + 1).setFormula(formula);
  
  // Copy down
  if (lastRow > 2) {
    sheet.getRange(2, COLS.DAYS_OPEN + 1).copyTo(
      sheet.getRange(2, COLS.DAYS_OPEN + 1, lastRow - 1, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
      false
    );
  }
}


/* ==========================================================================
   AUDIT LOG
   ========================================================================== */

/**
 * Ensures the audit log sheet exists.
 */
function ensureAuditLogSheet_(ss) {
  let auditSheet = ss.getSheetByName(TASK_CONFIG.sheets.audit);
  
  if (!auditSheet) {
    auditSheet = ss.insertSheet(TASK_CONFIG.sheets.audit);
    auditSheet.getRange(1, 1, 1, 6).setValues([[
      "Timestamp", "Action", "User", "Task ID", "Field Changed", "Details"
    ]]);
    auditSheet.getRange(1, 1, 1, 6)
      .setFontWeight("bold")
      .setBackground("#4a4a4a")
      .setFontColor("#ffffff");
    auditSheet.setFrozenRows(1);
    auditSheet.setColumnWidth(1, 150);
    auditSheet.setColumnWidth(2, 120);
    auditSheet.setColumnWidth(3, 150);
    auditSheet.setColumnWidth(4, 80);
    auditSheet.setColumnWidth(5, 120);
    auditSheet.setColumnWidth(6, 400);
    
    Logger.log("Created AUDIT LOG sheet.");
  }
  
  return auditSheet;
}


/**
 * Logs an entry to the audit log.
 * 
 * @param {string} action - The action type (e.g., "STATUS_CHANGE", "CREATED", "ARCHIVED")
 * @param {string} user - The user who performed the action
 * @param {string} details - Description of what changed
 * @param {number} taskId - Optional row number of the task
 * @param {string} fieldChanged - Optional specific field that changed
 */
function logAuditEntry_(action, user, details, taskId, fieldChanged) {
  try {
    const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
    const auditSheet = ensureAuditLogSheet_(ss);
    
    const timestamp = Utilities.formatDate(
      new Date(), 
      TASK_CONFIG.timezone, 
      "yyyy-MM-dd HH:mm:ss"
    );
    
    auditSheet.appendRow([
      timestamp,
      action || "",
      user || "",
      taskId || "",
      fieldChanged || "",
      details || ""
    ]);
    
  } catch (e) {
    Logger.log("Audit log error: " + e.message);
  }
}


/* ==========================================================================
   ARCHIVE
   ========================================================================== */

/**
 * Ensures the archive sheet exists.
 */
function ensureArchiveSheet_(ss) {
  let archiveSheet = ss.getSheetByName(TASK_CONFIG.sheets.archive);
  
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(TASK_CONFIG.sheets.archive);
    
    // Add archive-specific headers (same as master + archive date)
    const archiveHeaders = [...HEADERS, "Archived Date"];
    archiveSheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]);
    archiveSheet.getRange(1, 1, 1, archiveHeaders.length)
      .setFontWeight("bold")
      .setBackground("#4a4a4a")
      .setFontColor("#ffffff");
    archiveSheet.setFrozenRows(1);
    
    Logger.log("Created ARCHIVE sheet.");
  }
  
  return archiveSheet;
}


/**
 * Archives completed/cancelled tasks older than configured threshold.
 * Called by daily maintenance trigger.
 */
function archiveOldCompletedTasks_() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const masterSheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  const archiveSheet = ensureArchiveSheet_(ss);
  
  if (!masterSheet) {
    Logger.log("Master sheet not found for archival.");
    return;
  }
  
  const lastRow = masterSheet.getLastRow();
  if (lastRow < 2) return;
  
  const data = masterSheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const today = new Date();
  const cutoffDate = new Date(today.getTime() - (TASK_CONFIG.archive.daysBeforeArchive * 24 * 60 * 60 * 1000));
  
  const rowsToArchive = [];
  const rowIndicesToDelete = [];
  
  data.forEach((row, index) => {
    const status = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    const dateCompleted = row[COLS.DATE_COMPLETED];
    
    // Only archive DONE or CANCELLED
    if (status !== STATUSES.DONE && status !== STATUSES.CANCELLED) return;

    // Use Date Completed if available, otherwise fall back to Last Updated, then Date Created
    const effectiveDate = (dateCompleted instanceof Date) ? dateCompleted :
                          (row[COLS.LAST_UPDATED] instanceof Date) ? row[COLS.LAST_UPDATED] :
                          (row[COLS.DATE_CREATED] instanceof Date) ? row[COLS.DATE_CREATED] : null;

    if (effectiveDate && effectiveDate < cutoffDate) {
      // Backfill Date Completed if it was empty
      if (!(dateCompleted instanceof Date)) {
        row[COLS.DATE_COMPLETED] = effectiveDate;
      }
      const archiveRow = [...row, new Date()];
      rowsToArchive.push(archiveRow);
      rowIndicesToDelete.push(index + 2); // +2 for header and 0-index
    }
  });
  
  if (rowsToArchive.length === 0) {
    Logger.log("No tasks to archive.");
    return;
  }
  
  // Append to archive sheet
  const archiveLastRow = archiveSheet.getLastRow();
  archiveSheet.getRange(
    archiveLastRow + 1, 
    1, 
    rowsToArchive.length, 
    rowsToArchive[0].length
  ).setValues(rowsToArchive);
  
  // Delete from master (in reverse order to maintain row indices)
  rowIndicesToDelete.sort((a, b) => b - a).forEach(rowNum => {
    masterSheet.deleteRow(rowNum);
  });
  
  // Log
  logAuditEntry_(
    "ARCHIVE", 
    "System", 
    `Archived ${rowsToArchive.length} tasks older than ${TASK_CONFIG.archive.daysBeforeArchive} days`
  );
  
  Logger.log(`Archived ${rowsToArchive.length} tasks.`);
}


/* ==========================================================================
   ESCALATION (BLOCKED TASKS)
   ========================================================================== */

/**
 * Checks for blocked tasks and escalates those blocked > 14 days.
 * Called by daily maintenance trigger.
 */
function escalateBlockedTasks_() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const today = new Date();
  const escalationThreshold = TASK_CONFIG.escalation.blockedDaysBeforeEscalate;
  
  const tasksToEscalate = [];
  
  data.forEach((row, index) => {
    const status = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    const dateCreated = row[COLS.DATE_CREATED];
    const lastUpdated = row[COLS.LAST_UPDATED];
    const description = row[COLS.DESCRIPTION];
    const assignee = row[COLS.STAFF];
    const blockerNotes = row[COLS.BLOCKER_NOTES];
    
    if (status !== STATUSES.BLOCKED) return;
    
    // Calculate days blocked (from last update or creation)
    const referenceDate = lastUpdated instanceof Date ? lastUpdated : 
                          dateCreated instanceof Date ? dateCreated : null;
    
    if (!referenceDate) return;
    
    const daysBlocked = Math.floor((today - referenceDate) / (24 * 60 * 60 * 1000));
    
    if (daysBlocked >= escalationThreshold) {
      tasksToEscalate.push({
        rowNum: index + 2,
        description: description,
        assignee: assignee,
        blockerNotes: blockerNotes,
        daysBlocked: daysBlocked
      });
    }
  });
  
  if (tasksToEscalate.length === 0) {
    Logger.log("No blocked tasks require escalation.");
    return;
  }
  
  // Build escalation Block Kit message
  const escBlocks = [
    bk_header("Escalation Alert"),
    bk_section(`*${tasksToEscalate.length} Task(s) Blocked > ${escalationThreshold} Days*`)
  ];

  tasksToEscalate.forEach((task, i) => {
    escBlocks.push(bk_divider());
    let detail = `*${i + 1}. ${task.description}*\n`;
    detail += `Assigned: ${task.assignee || "Unassigned"}\n`;
    detail += `Days Blocked: ${task.daysBlocked}`;
    if (task.blockerNotes) detail += `\nBlocker: ${task.blockerNotes}`;
    escBlocks.push(bk_section(detail));
  });

  escBlocks.push(bk_divider());
  escBlocks.push(bk_buttons([{ text: "Open Task Sheet", url: `https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}`, style: "danger" }]));

  // Send to Evan's DM
  bk_post(getEscalationSlackWebhook_(), escBlocks,
    `Escalation: ${tasksToEscalate.length} task(s) blocked > ${escalationThreshold} days`);
  
  // Also send email
  try {
    const subject = `⚠️ Waratah Task Escalation: ${tasksToEscalate.length} Blocked Tasks`;
    const htmlBody = buildEscalationEmailHtml_(tasksToEscalate);
    
    GmailApp.sendEmail(getEscalationEmail_(), subject, '', { htmlBody: htmlBody });
    Logger.log(`Escalation email sent to ${getEscalationEmail_()}`);
  } catch (e) {
    Logger.log("Escalation email error: " + e.message);
  }
  
  // Log
  logAuditEntry_(
    "ESCALATION",
    "System",
    `Escalated ${tasksToEscalate.length} blocked tasks to ${TASK_CONFIG.escalation.escalateToName}`
  );
}


/**
 * Builds HTML email body for escalation notification.
 */
function buildEscalationEmailHtml_(tasks) {
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #ea4335;">🚨 Task Escalation Alert</h2>
      <p>The following tasks have been <strong>BLOCKED</strong> for more than 
         ${TASK_CONFIG.escalation.blockedDaysBeforeEscalate} days and require attention:</p>
      <hr>
  `;
  
  tasks.forEach((task, i) => {
    html += `
      <div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-left: 4px solid #ea4335;">
        <h3 style="margin: 0 0 10px 0;">${i + 1}. ${task.description}</h3>
        <p style="margin: 5px 0;"><strong>Assigned To:</strong> ${task.assignee || "Unassigned"}</p>
        <p style="margin: 5px 0;"><strong>Days Blocked:</strong> ${task.daysBlocked}</p>
        ${task.blockerNotes ? `<p style="margin: 5px 0;"><strong>Blocker Notes:</strong> ${task.blockerNotes}</p>` : ""}
      </div>
    `;
  });
  
  html += `
      <hr>
      <p><a href="https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}">Open Task Sheet</a></p>
    </div>
  `;
  
  return html;
}


/* ==========================================================================
   RECURRING TASKS
   ========================================================================== */

/**
 * Processes recurring tasks that have been marked DONE.
 * Regenerates them with new dates and resets status.
 * Called by daily maintenance trigger.
 */
function processRecurringTasks_() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const today = new Date();
  
  const newTasks = [];
  const rowsToMarkProcessed = [];
  
  data.forEach((row, index) => {
    const status = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    const recurrence = (row[COLS.RECURRENCE] || "").toString().trim();
    const description = row[COLS.DESCRIPTION];
    
    // Only process DONE tasks with recurrence set
    if (status !== STATUSES.DONE) return;
    if (!recurrence || recurrence === "None") return;
    
    // Calculate next due date based on recurrence
    const lastDueDate = row[COLS.DUE_DATE] instanceof Date ? row[COLS.DUE_DATE] : today;
    let nextDueDate;
    
    switch (recurrence) {
      case "Weekly":
        nextDueDate = getNextMonday_(lastDueDate, 1);
        break;
      case "Fortnightly":
        nextDueDate = getNextMonday_(lastDueDate, 2);
        break;
      case "Monthly":
        nextDueDate = new Date(lastDueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        nextDueDate = getNextMonday_(nextDueDate, 0);
        break;
      default:
        return;
    }
    
    // Create new task
    const newTask = [
      row[COLS.PRIORITY],
      STATUSES.TODO,
      row[COLS.STAFF],
      row[COLS.AREA],
      description,
      nextDueDate,
      today,
      "",
      "",
      "",
      row[COLS.SOURCE],
      recurrence,
      today,
      "System (Recurring)"
    ];
    
    newTasks.push(newTask);
    rowsToMarkProcessed.push({
      rowNum: index + 2,
      description: description,
      recurrence: recurrence
    });
    
    // Update the original task's recurrence to "None"
    sheet.getRange(index + 2, COLS.RECURRENCE + 1).setValue("None");
  });
  
  if (newTasks.length === 0) {
    Logger.log("No recurring tasks to regenerate.");
    return;
  }
  
  // Append new tasks
  const newStartRow = sheet.getLastRow() + 1;
  sheet.getRange(newStartRow, 1, newTasks.length, TOTAL_COLS).setValues(newTasks);
  
  // Add Days Open formula to new rows
  const formula = `=IF(G${newStartRow}="","",IF(H${newStartRow}="",TODAY()-G${newStartRow},H${newStartRow}-G${newStartRow}))`;
  sheet.getRange(newStartRow, COLS.DAYS_OPEN + 1).setFormula(formula);
  if (newTasks.length > 1) {
    sheet.getRange(newStartRow, COLS.DAYS_OPEN + 1).copyTo(
      sheet.getRange(newStartRow, COLS.DAYS_OPEN + 1, newTasks.length, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
      false
    );
  }
  
  // Log
  rowsToMarkProcessed.forEach(item => {
    logAuditEntry_(
      "RECURRING_REGENERATED",
      "System",
      `Regenerated ${item.recurrence} task: ${item.description}`,
      item.rowNum,
      "Status"
    );
  });
  
  Logger.log(`Regenerated ${newTasks.length} recurring tasks.`);
}


/**
 * Calculates the next Monday after a given date plus specified weeks.
 */
function getNextMonday_(fromDate, weeksAhead) {
  const result = new Date(fromDate);
  result.setDate(result.getDate() + (weeksAhead * 7));
  
  const dayOfWeek = result.getDay();
  
  if (dayOfWeek === 0) {
    result.setDate(result.getDate() + 1);
  } else if (dayOfWeek === 1) {
    if (weeksAhead === 0) {
      result.setDate(result.getDate() + 7);
    }
  } else {
    const daysUntilMonday = 8 - dayOfWeek;
    result.setDate(result.getDate() + daysUntilMonday);
  }
  
  return result;
}


/* ==========================================================================
   OVERDUE TRACKING
   ========================================================================== */

/**
 * Sends a daily summary of overdue tasks.
 * Called by daily maintenance trigger.
 */
function sendOverdueTasksSummary_() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = [];
  
  data.forEach((row, index) => {
    const status = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    const dueDate = row[COLS.DUE_DATE];
    
    if (!ACTIVE_STATUSES.includes(status)) return;
    
    if (dueDate instanceof Date) {
      const dueDateOnly = new Date(dueDate);
      dueDateOnly.setHours(0, 0, 0, 0);
      
      if (dueDateOnly < today) {
        const daysOverdue = Math.floor((today - dueDateOnly) / (24 * 60 * 60 * 1000));
        
        overdueTasks.push({
          rowNum: index + 2,
          description: row[COLS.DESCRIPTION],
          assignee: row[COLS.STAFF] || "Unassigned",
          dueDate: Utilities.formatDate(dueDate, TASK_CONFIG.timezone, "dd/MM/yyyy"),
          daysOverdue: daysOverdue,
          priority: row[COLS.PRIORITY],
          status: status
        });
      }
    }
  });
  
  if (overdueTasks.length === 0) {
    Logger.log("No overdue tasks today.");
    return;
  }
  
  overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue);
  
  const byAssignee = {};
  overdueTasks.forEach(task => {
    if (!byAssignee[task.assignee]) byAssignee[task.assignee] = [];
    byAssignee[task.assignee].push(task);
  });

  // Build overdue Block Kit message
  const overdueBlocks = [
    bk_header("Daily Overdue Tasks"),
    bk_section(`*${overdueTasks.length} task(s) past their due date*`)
  ];

  Object.entries(byAssignee).forEach(([assignee, tasks]) => {
    overdueBlocks.push(bk_divider());
    let staffSection = `*${assignee}* (${tasks.length}):\n`;
    tasks.forEach(task => {
      const priorityEmoji = PRIORITY_EMOJI[task.priority] || "";
      staffSection += `${priorityEmoji} ${task.description} _(${task.daysOverdue}d overdue)_\n`;
    });
    overdueBlocks.push(bk_section(staffSection));
  });

  overdueBlocks.push(bk_divider());
  overdueBlocks.push(bk_buttons([{ text: "View All Tasks", url: `https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}` }]));

  bk_post(getManagersChannelWebhook_(), overdueBlocks,
    `Daily Overdue: ${overdueTasks.length} task(s) past due`);
  
  sendOverdueTasksDMs_(byAssignee);
}


/**
 * Sends individual Slack DMs to assignees about their overdue tasks.
 */
function sendOverdueTasksDMs_(tasksByAssignee) {
  Object.entries(tasksByAssignee).forEach(([assignee, tasks]) => {
    const webhook = getSlackDmWebhooks_()[assignee];
    
    if (!webhook) {
      Logger.log(`No DM webhook for "${assignee}", skipping individual notification.`);
      return;
    }
    
    const dmBlocks = [
      bk_header("Your Overdue Tasks"),
      bk_section(`_You have ${tasks.length} task(s) past their due date_`)
    ];

    tasks.forEach(task => {
      const priorityEmoji = PRIORITY_EMOJI[task.priority] || "";
      let detail = `${priorityEmoji} *${task.description}*\nDue: ${task.dueDate} (${task.daysOverdue}d overdue)`;
      if (task.status === STATUSES.BLOCKED) detail += `\nStatus: BLOCKED`;
      dmBlocks.push(bk_section(detail));
    });

    dmBlocks.push(bk_divider());
    dmBlocks.push(bk_buttons([{ text: "Update Your Tasks", url: `https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}` }]));

    const sent = bk_post(webhook, dmBlocks, `You have ${tasks.length} overdue task(s)`);
    Logger.log(sent ? `Overdue DM sent to ${assignee}` : `Failed to DM ${assignee}`);
  });
}


/* ==========================================================================
   ONEDIT TRIGGER (Audit Logging + Auto-Sort)
   ========================================================================== */

/**
 * Installable onEdit trigger for the task sheet.
 * Logs all changes to the audit log and auto-sorts on status/priority changes.
 * 
 * To install:
 *   1. Run createOnEditTrigger() once
 *   2. Or manually create via Edit > Current project's triggers
 */
function onTaskSheetEditWithAutoSort(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Could not obtain lock — skipping concurrent edit handler');
    return;
  }
  try {
    if (!e || !e.range) return;

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    // Only track edits to the master sheet
    if (sheetName !== TASK_CONFIG.sheets.master) return;

    const row = e.range.getRow();
    const col = e.range.getColumn();

    // Ignore header row
    if (row < 2) return;

    // Ignore Days Open column (formula)
    if (col === COLS.DAYS_OPEN + 1) return;

    const oldValue = e.oldValue || "";
    const newValue = e.value || "";

    // No change
    if (oldValue === newValue) return;

    const user = Session.getActiveUser().getEmail() || "Unknown";
    const fieldName = HEADERS[col - 1] || `Column ${col}`;

    // Get task description for context
    const description = sheet.getRange(row, COLS.DESCRIPTION + 1).getValue() || `Row ${row}`;

    const details = `"${description}" — ${fieldName}: "${oldValue}" → "${newValue}"`;

    // Log the change
    logAuditEntry_("EDIT", user, details, row, fieldName);

    // Auto-update Last Updated and Updated By
    const now = new Date();
    sheet.getRange(row, COLS.LAST_UPDATED + 1).setValue(now);
    sheet.getRange(row, COLS.UPDATED_BY + 1).setValue(user);

    // Special handling for status changes
    if (col === COLS.STATUS + 1) {
      handleStatusChange_(sheet, row, oldValue, newValue, user);
    }

    // Auto-sort if Status or Priority changed
    if (col === COLS.STATUS + 1 || col === COLS.PRIORITY + 1) {
      Utilities.sleep(500);
      sortMasterActionablesAdvanced();
    }
  } finally {
    lock.releaseLock();
  }
}


/**
 * Handles special logic when status changes.
 */
function handleStatusChange_(sheet, row, oldStatus, newStatus, user) {
  const normalizedNew = (newStatus || "").toString().trim().toUpperCase();
  
  // If changed to DONE or CANCELLED, set Date Completed
  if (normalizedNew === STATUSES.DONE || normalizedNew === STATUSES.CANCELLED) {
    const dateCompletedCell = sheet.getRange(row, COLS.DATE_COMPLETED + 1);
    if (!dateCompletedCell.getValue()) {
      dateCompletedCell.setValue(new Date());
    }
  }
  
  // If changed to BLOCKED, ensure blocker notes are present
  if (normalizedNew === STATUSES.BLOCKED) {
    const blockerNotes = sheet.getRange(row, COLS.BLOCKER_NOTES + 1).getValue();
    if (!blockerNotes || blockerNotes.toString().trim() === "") {
      sheet.getRange(row, COLS.BLOCKER_NOTES + 1)
        .setBackground("#ffcdd2")
        .setNote("⚠️ Please describe what's blocking this task");
    }
  } else {
    sheet.getRange(row, COLS.BLOCKER_NOTES + 1)
      .setBackground(null)
      .clearNote();
  }
  
  // If changed FROM DONE/CANCELLED back to active, clear Date Completed
  const normalizedOld = (oldStatus || "").toString().trim().toUpperCase();
  if ((normalizedOld === STATUSES.DONE || normalizedOld === STATUSES.CANCELLED) &&
      ACTIVE_STATUSES.includes(normalizedNew)) {
    sheet.getRange(row, COLS.DATE_COMPLETED + 1).setValue("");
  }
}


/* ==========================================================================
   DAILY MAINTENANCE TRIGGER
   ========================================================================== */

/**
 * Main daily maintenance function.
 * Run this via time-based trigger at 7am daily.
 */
function runDailyTaskMaintenance() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('❌ Could not acquire lock — another maintenance run may be in progress.');
    return;
  }

  Logger.log("=== Starting Daily Task Maintenance ===");

  try {
    // 1. Cleanup and sort
    Logger.log("Cleaning up and sorting...");
    cleanupAndSortMasterActionables();
    
    // 2. Process recurring tasks
    Logger.log("Processing recurring tasks...");
    processRecurringTasks_();
    
    // 3. Archive old completed/cancelled tasks
    Logger.log("Archiving old tasks...");
    archiveOldCompletedTasks_();
    
    // 4. Escalate blocked tasks
    Logger.log("Checking blocked tasks for escalation...");
    escalateBlockedTasks_();
    
    // 5. Send overdue summary
    Logger.log("Sending overdue tasks summary...");
    sendOverdueTasksSummary_();
    
    Logger.log("=== Daily Task Maintenance Complete ===");
    
  } catch (e) {
    Logger.log('❌ [runDailyTaskMaintenance] failed: ' + e.message + '\n' + e.stack);
    logAuditEntry_("MAINTENANCE_ERROR", "System", e.message);
    try {
      const webhook = getEscalationSlackWebhook_();
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [runDailyTaskMaintenance] Waratah Task Maintenance failed: ' + e.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ [runDailyTaskMaintenance] Slack notification also failed: ' + slackErr.message);
    }
  }
}


/* ==========================================================================
   WEEKLY ACTIVE TASKS SUMMARY (Monday 9am)
   ========================================================================== */

/**
 * Posts all active tasks (excluding DONE, BLOCKED, CANCELLED) to the
 * managers Slack channel, grouped by staff member.
 * Designed to run automatically every Monday at 9am via trigger.
 */
function sendWeeklyActiveTasksSummary() {
  try {
    _sendWeeklyActiveTasksSummaryCore(getManagersChannelWebhook_(), false);
  } catch (error) {
    Logger.log('❌ [sendWeeklyActiveTasksSummary] failed: ' + error.message + '\n' + error.stack);
    try {
      const webhook = getEscalationSlackWebhook_();
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [sendWeeklyActiveTasksSummary] Waratah weekly summary failed: ' + error.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ [sendWeeklyActiveTasksSummary] Slack notification also failed: ' + slackErr.message);
    }
  }
}

/**
 * TEST variant — posts to Evan's DM only.
 */
function sendWeeklyActiveTasksSummary_Test() {
  _sendWeeklyActiveTasksSummaryCore(getSlackDmWebhooks_()["Evan"], true);
}

/**
 * Core implementation: reads Master Actionables, filters out DONE/BLOCKED/CANCELLED,
 * groups by staff, and posts a formatted summary to Slack.
 */
function _sendWeeklyActiveTasksSummaryCore(webhookUrl, isTest) {
  if (!webhookUrl) {
    Logger.log("No webhook URL configured for weekly summary.");
    return;
  }

  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);

  if (!sheet) {
    Logger.log("Master sheet not found for weekly summary.");
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No tasks in Master Actionables.");
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const tz = TASK_CONFIG.timezone;
  const today = new Date();

  // Statuses to EXCLUDE
  const excludedStatuses = [STATUSES.DONE, STATUSES.BLOCKED, STATUSES.CANCELLED];

  // Filter and collect active tasks
  const staffMap = {};
  const staffOrder = [];

  data.forEach(row => {
    const status = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    if (excludedStatuses.includes(status)) return;

    const description = (row[COLS.DESCRIPTION] || "").toString().trim();
    if (!description) return;

    const staff = (row[COLS.STAFF] || "").toString().trim() || "Unassigned";
    const priority = (row[COLS.PRIORITY] || "").toString().trim();
    const dueDate = row[COLS.DUE_DATE];
    const source = (row[COLS.SOURCE] || "").toString().trim();

    if (!staffMap[staff]) {
      staffMap[staff] = [];
      staffOrder.push(staff);
    }

    staffMap[staff].push({ description, priority, status, dueDate, source });
  });

  if (staffOrder.length === 0) {
    Logger.log("No active tasks to summarise.");
    return;
  }

  // Sort: Unassigned first, then alphabetical
  staffOrder.sort((a, b) => {
    if (a === "Unassigned") return -1;
    if (b === "Unassigned") return 1;
    return a.localeCompare(b);
  });

  // Build Block Kit weekly summary
  const titlePrefix = isTest ? "TEST — " : "";
  const dateStr = Utilities.formatDate(today, tz, "dd/MM/yyyy");
  let totalCount = 0;

  const weeklyBlocks = [
    bk_header(`${titlePrefix}Waratah — Weekly Active Tasks`),
    bk_context([`Week starting ${dateStr}`])
  ];

  staffOrder.forEach(staff => {
    const tasks = staffMap[staff];
    totalCount += tasks.length;

    const priorityOrder = { "URGENT": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4 };
    tasks.sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99));

    weeklyBlocks.push(bk_divider());
    let staffSection = `*${staff}* (${tasks.length}):\n`;
    tasks.forEach(t => {
      const emoji = PRIORITY_EMOJI[t.priority] || "";
      let line = `${emoji} ${t.description}`;
      if (t.dueDate instanceof Date) {
        const dueFmt = Utilities.formatDate(t.dueDate, tz, "dd/MM");
        const isOverdue = t.dueDate < today;
        line += isOverdue ? ` _(due ${dueFmt} — OVERDUE)_` : ` _(due ${dueFmt})_`;
      }
      staffSection += line + "\n";
    });
    weeklyBlocks.push(bk_section(staffSection));
  });

  weeklyBlocks.push(bk_divider());
  weeklyBlocks.push(bk_context([`${totalCount} active task(s) across ${staffOrder.length} staff member(s)`]));
  weeklyBlocks.push(bk_buttons([{ text: "Open Task Sheet", url: `https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}` }]));

  bk_post(webhookUrl, weeklyBlocks,
    `${titlePrefix}Waratah Weekly: ${totalCount} active tasks`);
  Logger.log(`Weekly active tasks summary posted to Slack (${isTest ? "TEST" : "LIVE"}).`);

  logAuditEntry_("WEEKLY_SUMMARY", "System", `Posted ${totalCount} active tasks to Slack (${isTest ? "TEST" : "LIVE"})`);

  // Send individual DMs to each staff member with their tasks
  _sendWeeklyActiveTasksDMs_(staffMap, today, tz, isTest);
}


/**
 * Sends individual Slack DMs to each staff member with their active tasks.
 */
function _sendWeeklyActiveTasksDMs_(staffMap, today, tz, isTest) {
  const dateStr = Utilities.formatDate(today, tz, "dd/MM/yyyy");
  const priorityOrder = { "URGENT": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4 };

  Object.entries(staffMap).forEach(([staff, tasks]) => {
    // Skip generic groups that don't have a DM webhook
    const webhook = getSlackDmWebhooks_()[staff];
    if (!webhook) {
      Logger.log(`No DM webhook for "${staff}", skipping.`);
      return;
    }

    // If test mode, only DM Evan
    if (isTest && staff !== "Evan") return;

    // Group tasks by priority
    const byPriority = {};
    tasks.forEach(t => {
      const p = t.priority || "MEDIUM";
      if (!byPriority[p]) byPriority[p] = [];
      byPriority[p].push(t);
    });

    const dmBlocks = [
      bk_header(`THE WARATAH WEEKLY TASKS — Week of ${dateStr}`),
      bk_section(`_You have ${tasks.length} task(s) requiring action_`)
    ];

    ["URGENT", "HIGH", "MEDIUM", "LOW"].forEach(priority => {
      const group = byPriority[priority];
      if (!group || group.length === 0) return;

      const emoji = PRIORITY_EMOJI[priority] || "";
      dmBlocks.push(bk_divider());
      let groupText = `${emoji} *${priority}*\n`;
      group.forEach(t => {
        let line = `${emoji} ${t.description}`;
        if (t.dueDate instanceof Date) {
          const dueFmt = Utilities.formatDate(t.dueDate, tz, "dd/MM");
          const isOverdue = t.dueDate < today;
          line += isOverdue ? ` _(due ${dueFmt} — OVERDUE)_` : ` _(due ${dueFmt})_`;
        }
        groupText += line + "\n";
      });
      dmBlocks.push(bk_section(groupText));
    });

    dmBlocks.push(bk_divider());
    dmBlocks.push(bk_buttons([{ text: "Open Task Sheet", url: `https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}` }]));

    const sent = bk_post(webhook, dmBlocks, `${staff}: ${tasks.length} active task(s)`);
    Logger.log(sent ? `Weekly DM sent to ${staff}` : `Failed to DM ${staff}`);
  });
}


/* ==========================================================================
   TRIGGER MANAGEMENT
   ========================================================================== */

/**
 * Creates the daily maintenance trigger.
 * Run once to set up.
 */
function createDailyMaintenanceTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "runDailyTaskMaintenance") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("runDailyTaskMaintenance")
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();

  Logger.log("Created daily maintenance trigger (6-7am daily).");
  try {
    SpreadsheetApp.getUi().alert(
      "✅ Daily Trigger Created",
      "Daily maintenance and sort will run between 6-7am every day.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Creates the weekly summary trigger (Monday 9am).
 * Run once to set up.
 */
function createWeeklySummaryTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "sendWeeklyActiveTasksSummary") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("sendWeeklyActiveTasksSummary")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .nearMinute(0)
    .create();

  Logger.log("Created weekly summary trigger (Monday 9am).");
  try {
    SpreadsheetApp.getUi().alert(
      "✅ Weekly Summary Trigger Created",
      "Weekly active tasks summary will be posted to Slack every Monday at 9am.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Creates the onEdit trigger for audit logging and auto-sort.
 * Run once to set up.
 */
function createOnEditTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "onTaskSheetEditWithAutoSort") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger("onTaskSheetEditWithAutoSort")
    .forSpreadsheet(getTaskSpreadsheetId_())
    .onEdit()
    .create();
  
  Logger.log("Created onEdit trigger for audit logging and auto-sort.");
}


/**
 * Removes the daily maintenance trigger (7am).
 */
function removeDailyMaintenanceTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "runDailyTaskMaintenance") {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  if (removed > 0) {
    Logger.log(`Removed ${removed} daily maintenance trigger(s).`);
    try { SpreadsheetApp.getUi().alert(`✅ Removed ${removed} daily maintenance trigger(s).`); }
    catch (e) { Logger.log('UI alert skipped — trigger context'); }
  } else {
    Logger.log("No daily maintenance triggers found.");
    try { SpreadsheetApp.getUi().alert("ℹ️ No daily maintenance triggers found."); }
    catch (e) { Logger.log('UI alert skipped — trigger context'); }
  }
}


/**
 * Creates a bi-hourly (every 2 hours) cleanup trigger.
 * Runs cleanupAndSortMasterActionables() to remove empty rows and re-sort.
 * Safe to re-run — removes any existing bi-hourly trigger first.
 */
function createBiHourlyCleanupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "cleanupAndSortMasterActionables") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("cleanupAndSortMasterActionables")
    .timeBased()
    .everyHours(2)
    .create();

  Logger.log("Created bi-hourly cleanup trigger (every 2 hours).");
  try {
    SpreadsheetApp.getUi().alert(
      "✅ Bi-Hourly Cleanup Trigger Created",
      "Cleanup & sort will run automatically every 2 hours.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Removes the bi-hourly cleanup trigger.
 */
function removeBiHourlyCleanupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "cleanupAndSortMasterActionables") {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  if (removed > 0) {
    Logger.log(`Removed ${removed} bi-hourly cleanup trigger(s).`);
    try {
      SpreadsheetApp.getUi().alert(`✅ Removed ${removed} bi-hourly cleanup trigger(s).`);
    } catch (e) { Logger.log('UI alert skipped — trigger context'); }
  } else {
    Logger.log("No bi-hourly cleanup triggers found.");
    try {
      SpreadsheetApp.getUi().alert("ℹ️ No bi-hourly cleanup triggers found.");
    } catch (e) { Logger.log('UI alert skipped — trigger context'); }
  }
}


/**
 * Public wrapper for archiveOldCompletedTasks_ — callable by time trigger.
 * Runs weekly (Monday 6am).
 */
function runScheduledArchive() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Could not acquire lock — skipping scheduled archive');
    return;
  }
  try {
    archiveOldCompletedTasks_();
  } catch (e) {
    Logger.log('❌ [runScheduledArchive] failed: ' + e.message + '\n' + e.stack);
    try {
      const webhook = getEscalationSlackWebhook_();
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [runScheduledArchive] Waratah archive failed: ' + e.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ Slack notification also failed: ' + slackErr.message);
    }
  } finally {
    lock.releaseLock();
  }
}


/**
 * Public wrapper for sendOverdueTasksSummary_ — callable by time trigger.
 * Runs weekly (Sunday).
 */
function runScheduledOverdueSummary() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Could not acquire lock — skipping scheduled overdue summary');
    return;
  }
  try {
    sendOverdueTasksSummary_();
  } catch (e) {
    Logger.log('❌ [runScheduledOverdueSummary] failed: ' + e.message + '\n' + e.stack);
    try {
      const webhook = getEscalationSlackWebhook_();
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [runScheduledOverdueSummary] Waratah overdue summary failed: ' + e.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ Slack notification also failed: ' + slackErr.message);
    }
  } finally {
    lock.releaseLock();
  }
}


/**
 * Public wrapper for refreshStaffWorkload() — callable by time trigger.
 * Runs daily at 6am.
 */
function runScheduledStaffWorkload() {
  try {
    refreshStaffWorkload();
  } catch (e) {
    Logger.log('❌ [runScheduledStaffWorkload] failed: ' + e.message + '\n' + e.stack);
    try {
      const webhook = getEscalationSlackWebhook_();
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [runScheduledStaffWorkload] Waratah staff workload refresh failed: ' + e.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ Slack notification also failed: ' + slackErr.message);
    }
  }
}


/**
 * Creates a daily trigger for runScheduledStaffWorkload() at 6am.
 * Safe to re-run — removes existing trigger first.
 */
function createDailyStaffWorkloadTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runScheduledStaffWorkload') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runScheduledStaffWorkload')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();

  Logger.log('Created daily staff workload trigger (6am).');
  try {
    SpreadsheetApp.getUi().alert(
      '✅ Daily Staff Workload Trigger Created',
      'Staff workload stats will refresh daily at 6am.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Creates a weekly trigger for runScheduledArchive() every Monday at 6am.
 * Safe to re-run — removes existing trigger first.
 */
function createWeeklyArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runScheduledArchive') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runScheduledArchive')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .create();

  Logger.log('Created weekly archive trigger (Monday 6am).');
  try {
    SpreadsheetApp.getUi().alert(
      '✅ Weekly Archive Trigger Created',
      'Old completed tasks will be archived every Monday at 6am.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Creates a weekly trigger for runScheduledOverdueSummary() every Sunday.
 * Safe to re-run — removes existing trigger first.
 */
function createWeeklyOverdueSummaryTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runScheduledOverdueSummary') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runScheduledOverdueSummary')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(9)
    .create();

  Logger.log('Created weekly overdue summary trigger (Sunday 9am).');
  try {
    SpreadsheetApp.getUi().alert(
      '✅ Weekly Overdue Summary Trigger Created',
      'Overdue task summary will be posted to Slack every Sunday at 9am.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Removes all triggers for this script.
 */
function removeAllTaskTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const handlerFunctions = [
    "onTaskSheetEditWithAutoSort",
    "onTaskSheetEdit",
    "sendWeeklyActiveTasksSummary",
    "cleanupAndSortMasterActionables",
    "runScheduledStaffWorkload",
    "refreshStaffWorkload",
    "runScheduledArchive",
    "runScheduledOverdueSummary",
    "runDailyTaskMaintenance"
  ];

  let removed = 0;
  triggers.forEach(trigger => {
    if (handlerFunctions.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  Logger.log(`Removed ${removed} trigger(s).`);
  try {
    SpreadsheetApp.getUi().alert(
      removed > 0 ? `✅ Removed ${removed} task trigger(s).` : 'ℹ️ No task triggers found to remove.'
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/* ==========================================================================
   TASK CREATION HELPERS
   ========================================================================== */

/**
 * Creates a new task with all required fields.
 */
function createTask(taskData) {
  if (!taskData || !taskData.description) {
    throw new Error("Task description is required");
  }
  
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) {
    throw new Error("Master sheet not found");
  }
  
  const now = new Date();
  const user = Session.getActiveUser().getEmail() || "System";
  
  const newRow = [
    taskData.priority || PRIORITIES.MEDIUM,
    STATUSES.NEW,
    taskData.assignee || "",
    taskData.area || "General",
    taskData.description,
    taskData.dueDate || "",
    now,
    "",
    "",
    taskData.notes || "",
    taskData.source || "Ad-hoc",
    taskData.recurrence || "None",
    now,
    user
  ];
  
  const newRowNum = sheet.getLastRow() + 1;
  sheet.getRange(newRowNum, 1, 1, TOTAL_COLS).setValues([newRow]);
  
  const formula = `=IF(G${newRowNum}="","",IF(H${newRowNum}="",TODAY()-G${newRowNum},H${newRowNum}-G${newRowNum}))`;
  sheet.getRange(newRowNum, COLS.DAYS_OPEN + 1).setFormula(formula);
  
  logAuditEntry_("CREATED", user, `New task: ${taskData.description}`, newRowNum);
  
  return newRowNum;
}


/**
 * Enhanced version for shift report integration.
 */
function appendShiftReportTodos(todos, weekEndingDate) {
  if (!todos || todos.length === 0) {
    Logger.log("No To-Dos to append.");
    return;
  }
  
  todos.forEach(t => {
    if (!t.todo) return;
    
    createTask({
      description: t.todo,
      assignee: t.assignee || "",
      source: "Shift Report",
      area: "General",
      priority: PRIORITIES.MEDIUM,
      recurrence: "None"
    });
  });
  
  Logger.log(`Appended ${todos.length} tasks from shift reports.`);
}


/* ==========================================================================
   REAPPLY FORMATTING & VALIDATION
   ========================================================================== */

/**
 * Reapplies dropdowns, conditional formatting, and column formatting
 * to the Master Actionables Sheet without touching any data.
 * Use this to fix missing dropdowns on new/pasted rows.
 */
function reapplyFormattingAndValidation() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);

  if (!sheet) {
    try { SpreadsheetApp.getUi().alert("Master sheet not found."); }
    catch (e) { Logger.log('Master sheet not found.'); }
    return;
  }

  applySheetFormatting_(sheet);
  applyDataValidation_(sheet);
  applyConditionalFormatting_(sheet);
  addDaysOpenFormula_(sheet);

  try {
    SpreadsheetApp.getUi().alert(
      "✅ Formatting Reapplied",
      "Dropdowns, conditional formatting, column widths, and Days Open formulas have been refreshed.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }

  logAuditEntry_("REFORMAT", Session.getActiveUser().getEmail() || "Unknown", "Reapplied formatting and validation");
}


/* ==========================================================================
   TEST FUNCTIONS
   ========================================================================== */

/**
 * Test: Creates a sample task.
 */
function testCreateTask() {
  const rowNum = createTask({
    description: "Test task from script",
    assignee: "Evan",
    area: "Admin",
    priority: PRIORITIES.HIGH,
    source: "Ad-hoc",
    recurrence: "None"
  });
  
  Logger.log(`Created test task at row ${rowNum}`);
}


/**
 * Test: Logs a sample audit entry.
 */
function testAuditLog() {
  logAuditEntry_(
    "TEST",
    "evan@pollenhospitality.com",
    "This is a test audit entry",
    null,
    null
  );
  Logger.log("Test audit entry created.");
}


/**
 * Preview what would be archived (dry run).
 */
function previewArchival() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  
  if (!sheet) {
    Logger.log("Master sheet not found.");
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No data rows.");
    return;
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const today = new Date();
  const cutoffDate = new Date(today.getTime() - (TASK_CONFIG.archive.daysBeforeArchive * 24 * 60 * 60 * 1000));
  
  let count = 0;
  
  data.forEach((row, index) => {
    const status = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    const dateCompleted = row[COLS.DATE_COMPLETED];
    const description = row[COLS.DESCRIPTION];
    
    if (status !== STATUSES.DONE && status !== STATUSES.CANCELLED) return;

    // Same fallback chain as archiveOldCompletedTasks_():
    // Date Completed → Last Updated → Date Created
    const effectiveDate = (dateCompleted instanceof Date) ? dateCompleted :
                          (row[COLS.LAST_UPDATED] instanceof Date) ? row[COLS.LAST_UPDATED] :
                          (row[COLS.DATE_CREATED] instanceof Date) ? row[COLS.DATE_CREATED] : null;

    if (effectiveDate && effectiveDate < cutoffDate) {
      const source = (dateCompleted instanceof Date) ? "completed" :
                     (row[COLS.LAST_UPDATED] instanceof Date) ? "last updated" : "created";
      Logger.log(`Would archive: Row ${index + 2} - "${description}" (${source} ${effectiveDate})`);
      count++;
    }
  });

  Logger.log(`\nTotal tasks that would be archived: ${count}`);
}