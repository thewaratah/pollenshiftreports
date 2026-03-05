/****************************************************
 * UNIFIED NIGHTLY & WEEKLY REPORT SCRIPT (Multi-Venue)
 * Version: 2.0.0-unified
 *
 * Handles PDF generation, email distribution, Slack posting,
 * TO-DO aggregation, and weekly summaries for BOTH venues.
 *
 * Dependencies:
 *   VenueConfig.gs     - Venue-specific configuration
 *   Menu.gs            - onOpen() menu
 *   Run.gs             - Named range helpers (Sakura only)
 *   TaskIntegration.js - pushTodosToActionables()
 *   IntegrationHub.js  - runIntegrations()
 *
 * NOTE: Venue-aware - works for both Waratah and Sakura.
 * Venue configuration loaded from VenueConfig.gs via getVenueConfig_().
 *
 * @version 2.0.0-unified
 * @updated 2026-02-08
 ****************************************************/


/* ==========================================================================
   CREDENTIAL GETTERS (Venue-Aware, loaded from Script Properties)
   See _SETUP_ScriptProperties.js for initial setup instructions
   ========================================================================== */

/**
 * Get LIVE Slack webhook for current venue
 * Automatically detects venue and loads appropriate webhook
 */
function getSlackWebhookLive_() {
  const venueName = getVenueName_();  // From VenueConfig.gs
  const propName = `${venueName}_SLACK_WEBHOOK_LIVE`;
  const webhook = PropertiesService.getScriptProperties().getProperty(propName);
  if (!webhook) {
    throw new Error(`${propName} not configured in Script Properties. Run the appropriate setupScriptProperties function first.`);
  }
  return webhook;
}

/**
 * Get TEST Slack webhook for current venue
 */
function getSlackWebhookTest_() {
  const venueName = getVenueName_();
  const propName = `${venueName}_SLACK_WEBHOOK_TEST`;
  const webhook = PropertiesService.getScriptProperties().getProperty(propName);
  if (!webhook) {
    throw new Error(`${propName} not configured in Script Properties. Run the appropriate setupScriptProperties function first.`);
  }
  return webhook;
}

/**
 * Get email recipients map for current venue
 */
function getEmailRecipients_() {
  const venueName = getVenueName_();
  const propName = `${venueName}_EMAIL_RECIPIENTS`;
  const json = PropertiesService.getScriptProperties().getProperty(propName);
  if (!json) {
    throw new Error(`${propName} not configured in Script Properties. Run the appropriate setupScriptProperties function first.`);
  }
  return JSON.parse(json);
}


/* ==========================================================================
   CACHED CONFIGURATION (Venue-Aware, Loaded once per execution)
   ========================================================================== */

// Safe module-level constant — hardcoded string, no Script Properties dependency
const TODO_SLACK_RANGE = 'A53:F61';  // Hardcoded — covers A53:E61 task cols + F61 assignee col

/**
 * Lazy-load getter for all venue configuration values that depend on Script Properties.
 * Called at the top of each function that needs these values, rather than at module load
 * time, so that a missing Script Property does NOT crash onOpen() or hide the menu.
 *
 * @returns {{
 *   VENUE_CONFIG: Object,
 *   SLACK_WEBHOOK_URL_LIVE: string,
 *   SLACK_WEBHOOK_URL_TEST: string,
 *   RECIPIENTS: Object,
 *   NIGHTLY_EMAIL_RECIPIENTS: string[],
 *   DAYS: string[],
 *   TODO_TASK_RANGE: string,
 *   TODO_ASSIGNEE_RANGE: string,
 *   DATE_RANGE: string,
 *   MOD_RANGE: string,
 *   NET_REVENUE_CELL: string,
 *   SHIFT_SUMMARY_RANGE: string
 * }}
 */
function _getExportConfig_() {
  // Load venue configuration
  const VENUE_CONFIG = getVenueConfig_();  // From VenueConfig.gs

  // Slack webhooks (loaded from Script Properties based on venue)
  const SLACK_WEBHOOK_URL_LIVE = getSlackWebhookLive_();
  const SLACK_WEBHOOK_URL_TEST = getSlackWebhookTest_();

  // Email recipients and names (loaded from Script Properties based on venue)
  const RECIPIENTS = getEmailRecipients_();
  const NIGHTLY_EMAIL_RECIPIENTS = Object.keys(RECIPIENTS);

  // Operating days (from venue config)
  const DAYS = VENUE_CONFIG.days;

  // Cell ranges (from venue config)
  // NOTE: Waratah uses hardcoded cells, Sakura uses named ranges
  // The VenueConfig abstraction handles both approaches
  const TODO_TASK_RANGE     = VENUE_CONFIG.ranges.todoTask;
  const TODO_ASSIGNEE_RANGE = VENUE_CONFIG.ranges.todoAssignee;
  const DATE_RANGE          = VENUE_CONFIG.ranges.date;
  const MOD_RANGE           = VENUE_CONFIG.ranges.mod;
  const NET_REVENUE_CELL    = VENUE_CONFIG.ranges.netRevenue;
  const SHIFT_SUMMARY_RANGE = VENUE_CONFIG.ranges.shiftSummary;

  return {
    VENUE_CONFIG,
    SLACK_WEBHOOK_URL_LIVE,
    SLACK_WEBHOOK_URL_TEST,
    RECIPIENTS,
    NIGHTLY_EMAIL_RECIPIENTS,
    DAYS,
    TODO_TASK_RANGE,
    TODO_ASSIGNEE_RANGE,
    DATE_RANGE,
    MOD_RANGE,
    NET_REVENUE_CELL,
    SHIFT_SUMMARY_RANGE
  };
}

/**
 * Show the pre-send checklist modal.
 * The dialog's Confirm button calls continueExport_() to do the actual work.
 *
 * @param {string} sheetName - The shift report sheet name
 * @param {boolean} isTest - Whether this is a test run
 */
function showPreExportChecklist_(sheetName, isTest) {
  const template = HtmlService.createTemplateFromFile('checklist-dialog');
  template.sheetName = JSON.stringify(sheetName);
  template.isTest = isTest ? 'true' : 'false';
  const html = template.evaluate()
    .setWidth(380)
    .setHeight(240)
    .setTitle('Pre-Send Checklist');
  SpreadsheetApp.getUi().showModalDialog(html, 'Pre-Send Checklist');
}

/**
 * CONTINUATION: Called by the checklist dialog after user confirms both items.
 * Handles the full export pipeline for both LIVE and TEST runs.
 *
 * @param {string} sheetName - The shift report sheet name
 * @param {boolean} isTest - Whether this is a test run
 */
/**
 * NOTE: This function is invoked via google.script.run from the HTML dialog.
 * Do NOT call SpreadsheetApp.getUi() or ui.alert() — these do not work in that
 * context and will throw "Authorisation is required to perform that action."
 * Instead, return { success, message } and let the dialog handle all UI feedback.
 *
 * @returns {{ success: boolean, message: string }}
 */
function continueExport(sheetName, isTest) {
  try {
    const { SLACK_WEBHOOK_URL_LIVE, SLACK_WEBHOOK_URL_TEST, DAYS, TODO_TASK_RANGE, TODO_ASSIGNEE_RANGE, NIGHTLY_EMAIL_RECIPIENTS, RECIPIENTS } = _getExportConfig_();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.getActiveSheet();

    if (isTest) {
      // === TEST PATH ===
      if (SLACK_WEBHOOK_URL_TEST) {
        try {
          postToSlackFromSheet(spreadsheet, sheet, sheetName, SLACK_WEBHOOK_URL_TEST);
        } catch (e) {
          Logger.log('postToSlackFromSheet (TEST) failed (non-blocking): ' + e.message);
        }
      }

      // Skip task push in TEST mode to avoid writing test data to production Actionables
      // TEST emails always go to evan@pollenhospitality.com regardless of who triggers the run
      const testRecipient = 'evan@pollenhospitality.com';
      const filename = `TEST – The Waratah Nightly Shift Report - ${sheetName}.pdf`;
      const pdfBlob = generatePdfForSheet_NoUI_(spreadsheet, sheet, filename);
      if (!pdfBlob) return { success: false, message: 'PDF generation failed. See logs for details.' };

      const sheetUrl = spreadsheet.getUrl();
      const subject = `TEST – The Waratah Nightly Shift Report: ${sheetName}`;
      const htmlBody = `
        <p>Test email only to <strong>${testRecipient}</strong>.</p>
        <p>Attached: <strong>${sheetName}</strong> nightly report (test mode).</p>
        <hr>
        <p><strong>Access the live Google Sheet:</strong><br>
        <a href="${sheetUrl}">${sheetUrl}</a></p>
      `;

      GmailApp.sendEmail(testRecipient, subject, "", { htmlBody: htmlBody, attachments: [pdfBlob] });
      Logger.log("✅ TEST email sent to: " + testRecipient);
      return { success: true, message: 'TEST run complete. Check your email' + (SLACK_WEBHOOK_URL_TEST ? ' and Slack.' : '.') };

    } else {
      // === LIVE PATH ===
      const warnings = [];

      // Run integrations — non-blocking. Errors collected for Evan notification.
      try {
        const integrationResults = runIntegrations(sheetName);
        const allMessages = [...(integrationResults.errors || []), ...(integrationResults.warnings || [])];
        if (allMessages.length > 0) {
          Logger.log('Integration non-blocking: ' + allMessages.join(' | '));
          warnings.push('Warehouse sync warnings: ' + allMessages.join('; '));
        }
      } catch (e) {
        Logger.log('runIntegrations failed (non-blocking): ' + e.message);
        warnings.push('Warehouse sync: ' + e.message);
      }

      // Build the TO-DOs sheet (WED–SUN aggregation) — non-blocking
      try {
        buildTodoAggregationSheet_(spreadsheet, DAYS, TODO_TASK_RANGE, TODO_ASSIGNEE_RANGE);
      } catch (e) {
        Logger.log('TO-DOs aggregation failed (non-blocking): ' + e.message);
        warnings.push('TO-DOs aggregation: ' + e.message);
      }

      // Slack (LIVE) — non-blocking
      try {
        postToSlackFromSheet(spreadsheet, sheet, sheetName, SLACK_WEBHOOK_URL_LIVE);
      } catch (e) {
        Logger.log('postToSlackFromSheet failed (non-blocking): ' + e.message);
        warnings.push('Slack post: ' + e.message);
      }

      // Push TO-DOs to Master Actionables Sheet — non-blocking
      try {
        pushTodosToMasterActionables(sheet, sheetName);
      } catch (e) {
        Logger.log('pushTodosToMasterActionables failed (non-blocking): ' + e.message);
        warnings.push('TODO push to Actionables: ' + e.message);
      }

      // PDF generation
      const filename = `The Waratah Nightly Shift Report - ${sheetName}.pdf`;
      const pdfBlob = generatePdfForSheet_NoUI_(spreadsheet, sheet, filename);
      if (!pdfBlob) return { success: false, message: 'PDF generation failed. See logs for details.' };

      // Email (LIVE recipients)
      const emailAddresses = NIGHTLY_EMAIL_RECIPIENTS.slice();
      const senderEmail = Session.getActiveUser().getEmail();
      const fallback = sheet.getRange("B4").getDisplayValue().trim() || "The Waratah Management Team";
      const senderName = RECIPIENTS[senderEmail] || fallback;

      const sheetUrl = spreadsheet.getUrl();
      const subject = `The Waratah Nightly Shift Report: ${sheetName}`;
      const htmlBody = `
        <p>Dear Team,</p>
        <p>Please find attached the PDF export of the nightly report: <strong>${sheetName}</strong>.</p>
        <p>Best regards,<br>${senderName}</p>
        <hr>
        <p><strong>Access the live Google Sheet:</strong><br>
        <a href="${sheetUrl}">${sheetUrl}</a></p>
      `;

      GmailApp.sendEmail(emailAddresses.join(','), subject, "", {
        htmlBody: htmlBody,
        attachments: [pdfBlob]
      });
      Logger.log("✅ Email sent to: " + emailAddresses.join(', '));

      // Notify Evan of any pipeline warnings via Slack DM (non-blocking)
      if (warnings.length > 0) {
        _notifyExportWarnings_(sheetName, warnings);
      }

      return { success: true, message: 'Export complete. Emails sent.' };
    }

  } catch (err) {
    Logger.log("❌ Export failed: " + err.message + "\n" + err.stack);
    return { success: false, message: 'Export failed: ' + err.message };
  }
}

/**
 * MAIN FUNCTION – LIVE RUN
 * 1. Blocks export on instruction tabs.
 * 2. Rebuilds "TO-DOs" sheet from WED–SUN tabs.
 * 3. Posts formatted nightly summary + To-Dos to Slack.
 * 4. Pushes TO-DOs to Master Actionables Sheet.
 * 5. Generates a one-tab PDF.
 * 6. Emails the PDF to full Waratah distro.
 */
function exportAndEmailPDF() {
  const excludedSheets = ["Instructions", "Read Me"];
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const sheetName = sheet.getName();
  const ui = SpreadsheetApp.getUi();

  if (excludedSheets.includes(sheetName)) {
    ui.alert(`The sheet "${sheetName}" cannot be exported.`);
    return;
  }

  const response = ui.alert(
    "Export Confirmation",
    `You are about to export the sheet: "${sheetName}". Continue?`,
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    ui.alert("Export cancelled.");
    return;
  }

  // Show pre-send checklist (timesheets + fruit); export continues from there
  showPreExportChecklist_(sheetName, false);
}

/**
 * TEST FUNCTION – DM / EMAIL ONLY TO THE ACTIVE USER
 * Uses Waratah layout but:
 *  - Does NOT hit full distro.
 *  - Emails only you.
 *  - Posts to TEST Slack webhook.
 */
function exportAndEmailPDF_TestToSelf() {
  const { SLACK_WEBHOOK_URL_TEST } = _getExportConfig_();
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const sheetName = sheet.getName();
  const testRecipient = 'evan@pollenhospitality.com';

  ui.alert(
    "TEST MODE: This will email ONLY " + testRecipient +
    (SLACK_WEBHOOK_URL_TEST ? " and post to the TEST Slack webhook." : ".")
  );

  // Show pre-send checklist (timesheets + fruit); export continues from there
  showPreExportChecklist_(sheetName, true);
}

/**
 * HELPER: Push TO-DOs from the active shift report sheet to the Master Actionables Sheet.
 *
 * Integrates with EnhancedTaskManagement.gs via createTask().
 * If createTask() is not available, falls back to direct append.
 *
 * @param {Sheet} sheet - The active shift report sheet (e.g., "WEDNESDAY 29/01/2025")
 * @param {string} sheetName - The name of the sheet (used for source tracking)
 * @param {Object} [preloadedConfig] - Optional: pre-loaded config from _getExportConfig_().
 *   When provided, the internal _getExportConfig_() call is skipped — avoids a redundant
 *   Script Properties read (and potential throw on missing webhook keys) when called in a
 *   loop that has already loaded config (e.g. backfillAllDaysTodos()).
 */
function pushTodosToMasterActionables(sheet, sheetName, preloadedConfig) {
  const { TODO_TASK_RANGE, TODO_ASSIGNEE_RANGE } = preloadedConfig || _getExportConfig_();
  // Read TO-DOs from the shift report
  const todoValues   = sheet.getRange(TODO_TASK_RANGE).getValues();     // 9 x 5 (A53:E61)
  const assignValues = sheet.getRange(TODO_ASSIGNEE_RANGE).getValues(); // 9 x 1 (F53:F61)

  const todos = [];

  for (let i = 0; i < todoValues.length; i++) {
    const taskText = todoValues[i][0];  // Column A (merged A-E, value in A)
    const assignee = assignValues[i][0];

    if (taskText && taskText.toString().trim() !== "") {
      todos.push({
        description: taskText.toString().trim(),
        assignee: assignee ? assignee.toString().trim() : "",
        source: sheetName  // e.g., "WEDNESDAY 29/01/2025"
      });
    }
  }

  if (todos.length === 0) {
    Logger.log("No TO-DOs to push to Master Actionables Sheet.");
    return;
  }

  // Duplicate detection: filter out tasks already pushed today
  try {
    const masterSS = SpreadsheetApp.openById(getTaskSpreadsheetId_());
    const masterSheet = masterSS.getSheetByName("MASTER ACTIONABLES SHEET");
    if (masterSheet && masterSheet.getLastRow() > 1) {
      const todayStr = Utilities.formatDate(new Date(), "Australia/Sydney", "yyyy-MM-dd");
      const existingDesc = masterSheet.getRange(2, 5, masterSheet.getLastRow() - 1, 1).getValues(); // col E
      const existingDates = masterSheet.getRange(2, 7, masterSheet.getLastRow() - 1, 1).getValues(); // col G
      const todayDescs = new Set();
      for (let i = 0; i < existingDesc.length; i++) {
        const d = existingDates[i][0];
        if (d instanceof Date && Utilities.formatDate(d, "Australia/Sydney", "yyyy-MM-dd") === todayStr) {
          todayDescs.add((existingDesc[i][0] || "").toString().trim());
        }
      }
      const beforeCount = todos.length;
      const filtered = todos.filter(t => !todayDescs.has(t.description));
      const skipped = beforeCount - filtered.length;
      if (skipped > 0) {
        Logger.log(`Skipped ${skipped} duplicate TO-DO(s) (already pushed today).`);
      }
      todos.length = 0;
      filtered.forEach(t => todos.push(t));
      if (todos.length === 0) {
        Logger.log("All TO-DOs already pushed today — nothing new to push.");
        return;
      }
    }
  } catch (e) {
    Logger.log("Duplicate detection check failed (non-blocking): " + e.message);
  }

  // Try to use createTask() from EnhancedTaskManagement.gs (same-project only).
  // In the Shift Report project, createTask is NOT available — it lives in the
  // Task Management project. The else branch (direct append) is the normal path.
  if (typeof createTask === "function") {
    // Enhanced Task Management system is available (same-project deployment)
    todos.forEach(t => {
      createTask({
        description: t.description,
        assignee: t.assignee,
        source: "Shift Report",
        area: "General",
        priority: "MEDIUM",
        recurrence: "None"
      });
    });
    Logger.log('Pushed ' + todos.length + ' TO-DOs to Master Actionables via Enhanced Task Management.');
  } else {
    // Direct append to Master Actionables Sheet (cross-project).
    // Errors propagate to the caller so backfillAllDaysTodos() can report them.
    pushTodosDirectToMasterActionables_(todos, sheetName);
  }
}

/**
 * FALLBACK: Direct append to Master Actionables Sheet if EnhancedTaskManagement.gs
 * is not available or fails.
 *
 * @param {Array} todos - Array of {description, assignee, source}
 * @param {string} sheetName - Source sheet name for logging
 */
function pushTodosDirectToMasterActionables_(todos, sheetName) {
  // Master Actionables Sheet ID loaded via getTaskSpreadsheetId_()
  // (reads TASK_MANAGEMENT_SPREADSHEET_ID from Script Properties)
  const MASTER_SHEET_NAME = "MASTER ACTIONABLES SHEET";

  const taskSpreadsheetId = getTaskSpreadsheetId_();
  const masterSS = SpreadsheetApp.openById(taskSpreadsheetId);
  const masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);

  if (!masterSheet) {
    throw new Error('Sheet "' + MASTER_SHEET_NAME + '" not found in spreadsheet ' + taskSpreadsheetId);
  }

  const now = new Date();
  const user = Session.getActiveUser().getEmail() || "System";

  // Batch write — single setValues() call instead of per-row appendRow()
  const rows = todos.map(t => [
    "MEDIUM",           // Priority
    "NEW",              // Status
    t.assignee,         // Staff Allocated
    "General",          // Area
    t.description,      // Description
    "",                 // Due Date
    now,                // Date Created
    "",                 // Date Completed
    "",                 // Days Open
    "",                 // Blocker Notes
    "Shift Report",     // Source
    "None",             // Recurrence
    now,                // Last Updated
    user                // Updated By
  ]);
  const startRow = masterSheet.getLastRow() + 1;
  masterSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('Pushed ' + todos.length + ' TO-DOs directly to Master Actionables Sheet.');
}

/**
 * HELPER: Send export pipeline warnings to Evan via Slack DM.
 * Uses WARATAH_SLACK_WEBHOOK_TEST from Script Properties.
 *
 * @param {string} sheetName - The sheet that was exported
 * @param {string[]} warnings - Array of warning messages
 */
function _notifyExportWarnings_(sheetName, warnings) {
  const venueName = getVenueName_();
  const webhook = PropertiesService.getScriptProperties().getProperty(venueName + '_SLACK_WEBHOOK_TEST');
  if (!webhook) {
    Logger.log(venueName + '_SLACK_WEBHOOK_TEST not set — warnings logged only: ' + warnings.join(' | '));
    return;
  }
  try {
    const resp = UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        text: '⚠️ ' + venueName + ' Export Warnings (' + sheetName + '):\n• ' + warnings.join('\n• ')
      }),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Export warning Slack POST failed HTTP ' + code + ': ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Export warning Slack notification failed: ' + e.message);
  }
}

/**
 * HELPER: Rebuild the "TO-DOs" aggregation tab from all day sheets.
 *
 * Clears and repopulates the TO-DOs sheet with a header row followed by
 * one data row per non-empty task found on any day sheet. Day sheets are
 * matched by prefix (e.g. "WEDNESDAY" matches "WEDNESDAY 26/02"). Columns:
 *   A: Day (sheet name)  B: To-Do  C: Assigned To
 *
 * Called from both continueExport() (nightly, non-blocking) and
 * backfillAllDaysTodos() (manual admin backfill).
 *
 * @param {Spreadsheet} ss - The active spreadsheet
 * @param {string[]} days - Ordered day prefixes, e.g. ['WEDNESDAY', ...]
 * @param {string} todoTaskRange - A1 range for task text column (e.g. 'A53:E61')
 * @param {string} todoAssigneeRange - A1 range for assignee column (e.g. 'F53:F61')
 */
function buildTodoAggregationSheet_(ss, days, todoTaskRange, todoAssigneeRange) {
  const todoSheetName = "TO-DOs";
  let todoSheet = ss.getSheetByName(todoSheetName);
  if (!todoSheet) todoSheet = ss.insertSheet(todoSheetName);

  // clearContent() preserves formatting and data-validations on the tab
  todoSheet.clearContents();

  // Collect all rows in memory, then write header + data in a single batch
  const allRows = [["Day", "To-Do", "Assigned To"]];

  const allSheets = ss.getSheets();
  allSheets.forEach(s => {
    const sName = s.getName();
    const matchedDay = days.find(day => sName.startsWith(day));
    if (!matchedDay) return;

    const todoValues   = s.getRange(todoTaskRange).getValues();    // e.g. A53:E61 — value in col A (merged)
    const assignValues = s.getRange(todoAssigneeRange).getValues(); // e.g. F53:F61

    for (let i = 0; i < todoValues.length; i++) {
      const todo    = todoValues[i][0];  // col A of the merged task range
      const assignee = assignValues[i][0];
      if (todo && todo.toString().trim() !== "") {
        allRows.push([sName, todo, assignee]);
      }
    }
  });

  // Batch write — single setValues() call instead of per-row appendRow()
  todoSheet.getRange(1, 1, allRows.length, 3).setValues(allRows);

  if (allRows.length > 1) {
    todoSheet.getRange(2, 1, allRows.length - 1, 3).setWrap(true);
  }
}

/**
 * ADMIN: Backfill TO-DOs (All Days)
 *
 * Rebuilds the "TO-DOs" aggregation tab from all five Waratah day sheets
 * (WEDNESDAY–SUNDAY), then pushes each day's tasks to the Master Actionables
 * Sheet via pushTodosToMasterActionables(). Duplicate detection inside
 * pushTodosToMasterActionables() prevents double-entries.
 *
 * Password-gated via pw_backfillAllDaysTodos() in Menu.js.
 * Menu: Admin Tools → Setup & Utilities → Backfill TO-DOs (All Days)
 *
 * TO-DO ranges used (from VenueConfig.js, row 53 authoritative):
 *   Tasks:    A53:E61  (9 rows; merged A-E, value read from col A)
 *   Assignee: F53:F61  (9 rows)
 */
function backfillAllDaysTodos() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Load config via the standard lazy getter so Script Property errors
    // surface clearly rather than crashing silently.
    const config = _getExportConfig_();
    const { DAYS, TODO_TASK_RANGE, TODO_ASSIGNEE_RANGE } = config;

    // Step 1: Rebuild the TO-DOs aggregation tab
    buildTodoAggregationSheet_(ss, DAYS, TODO_TASK_RANGE, TODO_ASSIGNEE_RANGE);
    Logger.log('[backfillAllDaysTodos] TO-DOs aggregation tab rebuilt.');

    // Step 2: Push each day sheet's tasks to Master Actionables.
    // Pass the pre-loaded config to avoid a redundant _getExportConfig_() call
    // (and a potential throw on missing Script Properties) for each of the 5 days.
    let pushedDays = 0;
    let skippedDays = 0;
    const errors = [];

    DAYS.forEach(dayName => {
      // getSheetByDayPrefix_ handles renamed tabs like "WEDNESDAY 26/02"
      const daySheet = getSheetByDayPrefix_(ss, dayName);
      if (!daySheet) {
        Logger.log('[backfillAllDaysTodos] Sheet not found for day: ' + dayName + ' — skipping.');
        errors.push(dayName + ': sheet not found');
        skippedDays++;
        return;
      }

      try {
        pushTodosToMasterActionables(daySheet, daySheet.getName(), config);
        Logger.log('[backfillAllDaysTodos] Pushed TO-DOs for: ' + daySheet.getName());
        pushedDays++;
      } catch (e) {
        Logger.log('[backfillAllDaysTodos] Failed to push for ' + daySheet.getName() + ': ' + e.message);
        errors.push(daySheet.getName() + ': ' + e.message);
        skippedDays++;
      }
    });

    // Step 3: Confirmation dialog — show errors explicitly so failures are visible
    const errorMsg = errors.length > 0
      ? '\n\nErrors (' + errors.length + '):\n' + errors.join('\n')
      : '';
    ui.alert(
      'Backfill Complete',
      'TO-DOs aggregation tab rebuilt.\n' +
      pushedDays + ' of ' + DAYS.length + ' day sheet(s) pushed to Master Actionables.' +
      errorMsg,
      ui.ButtonSet.OK
    );

  } catch (e) {
    Logger.log('[backfillAllDaysTodos] Fatal error: ' + e.message + '\n' + e.stack);
    ui.alert(
      'Backfill Failed',
      'An error occurred: ' + e.message + '\n\nCheck Apps Script logs for details.',
      ui.ButtonSet.OK
    );
  }
}

/**
 * HELPER: Post formatted nightly report to Slack (Waratah layout).
 */
function postToSlackFromSheet(spreadsheet, sheet, sheetName, webhookUrl) {
  const config = getVenueConfig_();
  const ranges = config.ranges;
  if (!webhookUrl) {
    Logger.log("Slack webhook not configured (Waratah).");
    return;
  }

  const tz = Session.getScriptTimeZone() || "Australia/Sydney";

  // --- Helper: read display value safely ---
  const readCell = (range) => {
    try { return sheet.getRange(range).getDisplayValue().trim(); }
    catch (e) { return ""; }
  };

  // --- Helper: format currency ---
  const fmtAUD = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return "N/A";
    return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // --- Date & Day ---
  const dateRange = sheet.getRange(ranges.date);
  const dateValue = dateRange.getValue();
  let dateStr, dayStr;

  if (dateValue instanceof Date) {
    dateStr = Utilities.formatDate(dateValue, tz, "dd/MM/yyyy");
    dayStr  = Utilities.formatDate(dateValue, tz, "EEEE");
  } else {
    dateStr = dateRange.getDisplayValue().trim() || "N/A";
    dayStr  = "N/A";
  }

  // --- Core fields ---
  const modText    = readCell(ranges.mod) || "N/A";
  const staffText  = readCell(ranges.staff);
  const netRevenue = readCell(ranges.netRevenue);
  const cardTips   = readCell(ranges.cardTips);
  const cashTips   = readCell(ranges.cashTips);
  const totalTips  = readCell(ranges.totalTips);

  // --- Narrative fields (only include sections with content) ---
  const shiftSummary = readCell("A43") || "";
  const guestsOfNote = readCell("A45") || "";
  const theGood      = readCell("A47") || "";
  const theBad       = readCell("A49") || "";
  const kitchenNotes = readCell("A51") || "";
  const wastageComps = readCell("A63") || "";
  const rsaIncidents = readCell("A65") || "";

  // --- To-Do's: A53:F61 (task text in A, assignee in F) ---
  const todoRange = sheet.getRange(TODO_SLACK_RANGE).getValues();
  const todoLines = [];

  todoRange.forEach(row => {
    const taskText = (row[0] || "").toString().trim();
    const assignee = (row[5] || "").toString().trim();
    if (taskText) {
      todoLines.push(assignee ? `\u2022 *${assignee}:* ${taskText}` : `\u2022 _Unassigned:_ ${taskText}`);
    }
  });

  // --- Build links ---
  const spreadsheetId = spreadsheet.getId();
  const sheetId = sheet.getSheetId();
  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
    `format=pdf&gid=${sheetId}&size=A4&portrait=true&fitw=true&top_margin=0.5&bottom_margin=0.5` +
    `&left_margin=0.5&right_margin=0.5&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false`;
  const sheetUrl = spreadsheet.getUrl();

  // ===== BUILD BLOCK KIT MESSAGE =====
  const blocks = [];

  // --- Header ---
  blocks.push(bk_header("The Waratah \u2014 Nightly Shift Report"));

  // --- Metadata line ---
  const metaParts = [dayStr + " " + dateStr, "MOD: " + modText];
  if (staffText) metaParts.push("Staff: " + staffText);
  blocks.push(bk_context(metaParts));

  // --- Financial Dashboard ---
  blocks.push(bk_divider());
  const finFields = [
    ["Net Revenue", fmtAUD(netRevenue)]
  ];
  if (totalTips) finFields.push(["Total Tips", fmtAUD(totalTips)]);
  if (cardTips || cashTips) {
    const tipParts = [];
    if (cardTips) tipParts.push("Card " + fmtAUD(cardTips));
    if (cashTips) tipParts.push("Cash " + fmtAUD(cashTips));
    finFields.push(["Tip Split", tipParts.join(" / ")]);
  }
  blocks.push(bk_fields(finFields));

  // --- Shift Summary (always shown) ---
  blocks.push(bk_divider());
  blocks.push(bk_section("*Shift Summary*\n" + (shiftSummary || "_No summary recorded._")));

  // --- Guests of Note (conditional) ---
  if (guestsOfNote) {
    blocks.push(bk_section("*Guests of Note*\n" + guestsOfNote));
  }

  // --- The Good (conditional) ---
  if (theGood) {
    blocks.push(bk_section("*The Good*\n" + theGood));
  }

  // --- The Bad / Issues (conditional) ---
  if (theBad) {
    blocks.push(bk_section("*Issues*\n" + theBad));
  }

  // --- Kitchen Notes (conditional) ---
  if (kitchenNotes) {
    blocks.push(bk_section("*Kitchen Notes*\n" + kitchenNotes));
  }

  // --- To-Do's ---
  blocks.push(bk_divider());
  if (todoLines.length > 0) {
    blocks.push(bk_section("*To-Do's* (" + todoLines.length + ")\n" + todoLines.join("\n")));
  } else {
    blocks.push(bk_section("*To-Do's*\n_No tasks recorded._"));
  }

  // --- Incidents (conditional — wastage + RSA) ---
  if (wastageComps || rsaIncidents) {
    blocks.push(bk_divider());
    const incidentLines = [];
    if (wastageComps) incidentLines.push(":warning: *Wastage/Comps:* " + wastageComps);
    if (rsaIncidents) incidentLines.push(":shield: *RSA/Incidents:* " + rsaIncidents);
    blocks.push(bk_context(incidentLines));
  }

  // --- Action buttons ---
  blocks.push(bk_buttons([
    { text: "View PDF", url: exportUrl, style: "primary" },
    { text: "Open Shift Report", url: sheetUrl }
  ]));

  // --- Footer ---
  blocks.push(bk_context(["The Waratah \u00b7 Shift Reports 3.0 \u00b7 " + dayStr + " " + dateStr]));

  const sent = bk_post(webhookUrl, blocks, "Waratah Shift Report: " + dayStr + " " + dateStr + " \u2014 MOD: " + modText + " \u2014 Revenue: " + fmtAUD(netRevenue));
  if (sent) {
    Logger.log("\u2705 Waratah Block Kit message sent for sheet: " + sheetName);
  }
}

/**
 * HELPER: Generate a single-sheet PDF blob.
 */
function generatePdfForSheet_(spreadsheet, sheet, filename, ui) {
  const pdfBlob = generatePdfForSheet_NoUI_(spreadsheet, sheet, filename);
  if (!pdfBlob && ui) {
    ui.alert("PDF generation failed. See logs for details.");
  }
  return pdfBlob;
}

/** Non-interactive PDF generation — safe to call from google.script.run context. */
function generatePdfForSheet_NoUI_(spreadsheet, sheet, filename) {
  const spreadsheetId = spreadsheet.getId();
  const sheetId = sheet.getSheetId();
  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
    `format=pdf&gid=${sheetId}&size=A4&portrait=true&fitw=true&top_margin=0.5&bottom_margin=0.5` +
    `&left_margin=0.5&right_margin=0.5&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false`;

  try {
    const token = ScriptApp.getOAuthToken();
    const resp = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log(`❌ PDF export returned HTTP ${resp.getResponseCode()}: ${resp.getContentText().substring(0, 200)}`);
      return null;
    }
    const pdfBlob = resp.getBlob().setName(filename);
    Logger.log(
      `PDF generated for sheet ${sheet.getName()}. ` +
      `Type: ${pdfBlob.getContentType()} | Bytes: ${pdfBlob.getBytes().length}`
    );
    return pdfBlob;
  } catch (err) {
    Logger.log("❌ PDF generation failed (Waratah): " + err.message);
    return null;
  }
}

/************************************************************
 * WEEKLY SUMMARY – WARATAH (FROM TO-DOs TAB)
 *
 * TO-DOs sheet layout:
 *   A: Day string (sheet name, e.g. "WEDNESDAY 26/11/2025")
 *   B: Task text
 *   C: Staff member (may be blank -> General/Unallocated)
 ************************************************************/

// LIVE – for trigger or menu
function sendWeeklyTodoSummary_WARATAH() {
  const { SLACK_WEBHOOK_URL_LIVE } = _getExportConfig_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    _sendWeeklyTodoSummaryCore(ss, SLACK_WEBHOOK_URL_LIVE, false);
  } catch (error) {
    notifyError_('sendWeeklyTodoSummary_WARATAH', error);
  }
}

// TEST – DM only to Evan (uses TEST webhook)
function sendWeeklyTodoSummary_WARATAH_TestToSelf() {
  const { SLACK_WEBHOOK_URL_TEST } = _getExportConfig_();
  const ui = SpreadsheetApp.getUi();
  ui.alert("TEST MODE: Weekly To-Do summary will be posted ONLY to your TEST Waratah Slack webhook.");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  _sendWeeklyTodoSummaryCore(ss, SLACK_WEBHOOK_URL_TEST, true);
}

// Core implementation – groups TO-DOs by staff and posts to Slack
function _sendWeeklyTodoSummaryCore(ss, webhookUrl, isTest) {
  if (!webhookUrl) {
    Logger.log("❌ Weekly summary webhook URL not configured (Waratah).");
    return;
  }

  const todoSheet = ss.getSheetByName("TO-DOs");
  const tz = Session.getScriptTimeZone() || "Australia/Sydney";

  if (!todoSheet) {
    Logger.log("❌ TO-DOs sheet not found (Waratah).");
    return;
  }

  const lastRow = todoSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No TO-DOs data to summarise (rows < 2).");
    return;
  }

  // Read A (Day string), B (Task), C (Staff)
  const data = todoSheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const staffMap = {};
  const staffOrder = [];
  let minDate = null;
  let maxDate = null;

  data.forEach(row => {
    const dayStrRaw = row[0] || "";
    const taskRaw   = row[1] || "";
    const staffRaw  = row[2] || "";

    const dayStr = dayStrRaw.toString().trim();
    const task   = taskRaw.toString().trim();
    let staff    = staffRaw.toString().trim();

    if (!task) return; // skip empty tasks

    if (!staff) {
      staff = "General/Unallocated";
    }

    if (!staffMap[staff]) {
      staffMap[staff] = [];
      staffOrder.push(staff);
    }

    staffMap[staff].push({ dayStr, task });

    // Try to pull a date from the day string (e.g. "WEDNESDAY 24/11/2025")
    const m = dayStr.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (m) {
      let [_, d, mo, yRaw] = m;
      let y = yRaw;
      if (y.length === 2) {
        const num = Number(y);
        y = (num < 50 ? "20" : "19") + y;
      }
      const dt = new Date(Number(y), Number(mo) - 1, Number(d));
      if (!isNaN(dt.getTime())) {
        if (!minDate || dt < minDate) minDate = dt;
        if (!maxDate || dt > maxDate) maxDate = dt;
      }
    }
  });

  if (staffOrder.length === 0) {
    Logger.log("No valid tasks found in TO-DOs sheet (Waratah).");
    return;
  }

  // General/Unallocated first, others alpha
  staffOrder.sort((a, b) => {
    if (a === "General/Unallocated") return -1;
    if (b === "General/Unallocated") return 1;
    return a.localeCompare(b);
  });

  // Build Block Kit message
  const titlePrefix = isTest ? "TEST — " : "";
  const blocks = [
    bk_header(titlePrefix + "The Waratah — Weekly TO-DO Summary")
  ];

  if (minDate && maxDate) {
    const startStr = Utilities.formatDate(minDate, tz, "dd/MM");
    const endStr   = Utilities.formatDate(maxDate, tz, "dd/MM");
    blocks.push(bk_context(["Week: " + startStr + " – " + endStr]));
  }

  staffOrder.forEach(staff => {
    blocks.push(bk_divider());
    const tasks = staffMap[staff];
    const taskLines = tasks.map(t =>
      t.dayStr ? "• " + t.task + " _(" + t.dayStr + ")_" : "• " + t.task
    );
    blocks.push(bk_section("*" + staff + "*\n" + taskLines.join("\n")));
  });

  // Link back to TO-DOs tab
  const spreadsheetId = ss.getId();
  const todoSheetId = todoSheet.getSheetId();
  const todoUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${todoSheetId}`;
  blocks.push(bk_divider());
  blocks.push(bk_buttons([{ text: "Open TO-DOs Sheet", url: todoUrl }]));

  const sent = bk_post(webhookUrl, blocks, titlePrefix + "Waratah Weekly TO-DO Summary");
  if (sent) {
    Logger.log(`✅ Waratah Weekly To-Do summary sent to Slack (${isTest ? "TEST" : "LIVE"}).`);
  } else {
    Logger.log("❌ Waratah Weekly Slack summary error.");
  }
}
