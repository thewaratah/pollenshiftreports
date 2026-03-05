/**
 * NightlyBasicExport.js — The Waratah
 *
 * STANDALONE shift report export. No calls to other files.
 * Designed for non-technical handover — edit CONFIG, run, done.
 *
 * HOW TO USE:
 *   1. Edit the CONFIG block below (email addresses, Slack webhook).
 *   2. Open the sheet you want to export (WEDNESDAY, THURSDAY, etc.).
 *   3. Run sendShiftReportBasic() from the Apps Script editor,
 *      OR add it to the menu (see comment at the bottom of this file).
 *
 * CELL REFERENCES (Waratah hardcoded layout):
 *   B3      — Shift date (merged B3:F3, value in B3)
 *   B4      — MOD name (merged B4:F4, value in B4)
 *   B34     — Net Revenue
 *   A43     — Shift Summary (merged A43:F43, value in A43)
 *   A53:E61 — TO-DO tasks (9 rows, merged A-E, value in col A)
 *   F53:F61 — TO-DO assignees (9 rows, matches task rows)
 *
 * @version 1.0.0
 * @updated 2026-02-28
 */

// ============================================================
// CONFIGURATION — edit these values before using
// ============================================================
var CONFIG = {
  // Email recipients — add as many as needed
  emailRecipients: [
    'manager@example.com',
    'owner@example.com'
  ],

  // Slack webhook URL — paste your incoming webhook URL here
  slackWebhook: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',

  // Name of the TO-DOs tab in this spreadsheet
  todoTabName: 'TO-DOs',

  // Email subject prefix (date will be appended automatically)
  emailSubjectPrefix: 'The Waratah — Shift Report'
};

// Valid Waratah day sheet names — used for validation in Step 1
var VALID_DAY_SHEETS = ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];


// ============================================================
// MAIN FUNCTION — single entry point, runs all five steps
// ============================================================

/**
 * Export the active shift report sheet:
 *   1. Validate the active sheet is a Waratah day sheet
 *   2. Generate a PDF of the active sheet
 *   3. Email the PDF to all CONFIG.emailRecipients
 *   4. Post a plain-text summary to Slack
 *   5. Copy TO-DOs from this sheet into the TO-DOs tab
 */
function sendShiftReportBasic() {
  try {

    // === STEP 1: VALIDATE ===
    // Confirm the active sheet is a valid Waratah day sheet before doing anything.
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var sheetName = sheet.getName();

    var isValidDay = VALID_DAY_SHEETS.some(function(day) {
      return sheetName.toUpperCase().indexOf(day) === 0;
    });

    if (!isValidDay) {
      SpreadsheetApp.getUi().alert(
        'Cannot export "' + sheetName + '".\n\n' +
        'Please switch to a day sheet (WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, or SUNDAY) and try again.'
      );
      Logger.log('[NightlyBasicExport] Aborted — invalid sheet: ' + sheetName);
      return;
    }

    Logger.log('[NightlyBasicExport] Starting export for sheet: ' + sheetName);

    // Read header fields — B3=date, B4=MOD, B34=net revenue, A43=shift summary
    var dateValue    = sheet.getRange('B3').getValue();                          // Date (merged B3:F3)
    var modText      = sheet.getRange('B4').getDisplayValue().trim() || 'N/A';  // MOD (merged B4:F4)
    var netRevenue   = sheet.getRange('B34').getDisplayValue().trim() || 'N/A'; // Net revenue
    var shiftSummary = sheet.getRange('A43').getDisplayValue().trim() || 'N/A'; // Shift summary (merged A43:F43)

    // Format the date for display (dd/MM/yyyy)
    var tz = 'Australia/Sydney';
    var dateStr;
    if (dateValue instanceof Date) {
      dateStr = Utilities.formatDate(dateValue, tz, 'dd/MM/yyyy');
    } else {
      dateStr = dateValue ? dateValue.toString().trim() : 'N/A';
    }

    Logger.log('[NightlyBasicExport] Date: ' + dateStr + ' | MOD: ' + modText + ' | Net Revenue: ' + netRevenue);


    // === STEP 2: GENERATE PDF ===
    // UrlFetchApp with Bearer token — same pattern as NightlyExport.js. No extra setup needed.
    var spreadsheetId = ss.getId();
    var sheetId       = sheet.getSheetId();

    var exportUrl =
      'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' +
      'format=pdf&gid=' + sheetId + '&size=A4&portrait=true&fitw=true' +
      '&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5' +
      '&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false';

    var token = ScriptApp.getOAuthToken();
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    var httpCode = response.getResponseCode();
    if (httpCode < 200 || httpCode >= 300) {
      throw new Error('PDF generation failed — HTTP ' + httpCode + ': ' + response.getContentText());
    }

    var pdfFilename = 'The Waratah Shift Report - ' + sheetName + ' ' + dateStr + '.pdf';
    var pdfBlob = response.getBlob().setName(pdfFilename);
    Logger.log('[NightlyBasicExport] PDF generated: ' + pdfFilename + ' (' + pdfBlob.getBytes().length + ' bytes)');


    // === STEP 3: SEND EMAIL ===
    // Sends the PDF to every address in CONFIG.emailRecipients.
    var subject = CONFIG.emailSubjectPrefix + ' — ' + sheetName + ' ' + dateStr;
    var body    =
      'Hi team,\n\n' +
      'Please find attached the shift report for ' + sheetName + ' (' + dateStr + ').\n\n' +
      'MOD: ' + modText + '\n' +
      'Net Revenue: ' + netRevenue + '\n\n' +
      'Best regards,\nThe Waratah';

    if (CONFIG.emailRecipients && CONFIG.emailRecipients.length > 0) {
      GmailApp.sendEmail(
        CONFIG.emailRecipients.join(','),
        subject,
        body,
        { attachments: [pdfBlob] }
      );
      Logger.log('[NightlyBasicExport] Email sent to: ' + CONFIG.emailRecipients.join(', '));
    } else {
      Logger.log('[NightlyBasicExport] No email recipients configured — skipping email.');
    }


    // === STEP 4: POST TO SLACK ===
    // Plain text message — no Block Kit. Easy to read, nothing to break.
    if (CONFIG.slackWebhook && CONFIG.slackWebhook.indexOf('hooks.slack.com') !== -1) {
      var slackMessage =
        'The Waratah — Shift Report\n' +
        'Day: ' + sheetName + ' (' + dateStr + ')\n' +
        'MOD: ' + modText + '\n' +
        'Net Revenue: ' + netRevenue + '\n' +
        'Report sent.';

      var slackPayload = JSON.stringify({ text: slackMessage });

      var slackResponse = UrlFetchApp.fetch(CONFIG.slackWebhook, {
        method: 'post',
        contentType: 'application/json',
        payload: slackPayload,
        muteHttpExceptions: true
      });

      var slackCode = slackResponse.getResponseCode();
      if (slackCode >= 200 && slackCode < 300) {
        Logger.log('[NightlyBasicExport] Slack message sent.');
      } else {
        Logger.log('[NightlyBasicExport] Slack post failed — HTTP ' + slackCode + ': ' + slackResponse.getContentText());
      }
    } else {
      Logger.log('[NightlyBasicExport] Slack webhook not configured or looks like placeholder — skipping Slack.');
    }


    // === STEP 5: MOVE TO-DOs TO TAB ===
    // Tasks: A53:E61 (value in col A — merged across A-E). Assignees: F53:F61.
    var todoTaskValues   = sheet.getRange('A53:E61').getValues(); // 9 rows x 5 cols, text in col 0
    var todoAssignValues = sheet.getRange('F53:F61').getValues(); // 9 rows x 1 col

    // Collect non-empty tasks from this sheet only
    var newRows = [];
    var today   = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');

    for (var i = 0; i < todoTaskValues.length; i++) {
      var taskText = todoTaskValues[i][0];   // col A of the merged range
      var assignee = todoAssignValues[i][0];

      taskText = taskText ? taskText.toString().trim() : '';
      assignee = assignee ? assignee.toString().trim() : '';

      if (taskText !== '') {
        // Row columns: Day | Task | Assigned To | Date Added
        newRows.push([sheetName, taskText, assignee, today]);
      }
    }

    // Find or create the TO-DOs tab
    var todoSheet = ss.getSheetByName(CONFIG.todoTabName);
    if (!todoSheet) {
      todoSheet = ss.insertSheet(CONFIG.todoTabName);
      Logger.log('[NightlyBasicExport] Created new tab: ' + CONFIG.todoTabName);
    }

    // Clear existing data rows (rows 2 onward) — clearContent() preserves formatting
    var lastRow = todoSheet.getLastRow();
    if (lastRow >= 2) {
      todoSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
    }

    // Write header row if the sheet is empty
    if (todoSheet.getLastRow() === 0) {
      todoSheet.appendRow(['Day', 'Task', 'Assigned To', 'Date Added']);
    } else {
      // Ensure header row is correct even on subsequent runs
      todoSheet.getRange(1, 1, 1, 4).setValues([['Day', 'Task', 'Assigned To', 'Date Added']]);
    }

    // Batch-write all task rows at once (setValues is faster than repeated appendRow)
    if (newRows.length > 0) {
      todoSheet.getRange(2, 1, newRows.length, 4).setValues(newRows);
      Logger.log('[NightlyBasicExport] Wrote ' + newRows.length + ' TO-DO(s) to ' + CONFIG.todoTabName + ' tab.');
    } else {
      Logger.log('[NightlyBasicExport] No TO-DOs found on ' + sheetName + ' — TO-DOs tab cleared.');
    }


    // === DONE ===
    Logger.log('[NightlyBasicExport] Export complete for: ' + sheetName);
    SpreadsheetApp.getUi().alert(
      'Export complete.\n\n' +
      'PDF emailed to ' + CONFIG.emailRecipients.length + ' recipient(s).\n' +
      'Slack notified.\n' +
      'TO-DOs tab updated (' + newRows.length + ' task(s)).'
    );

  } catch (err) {
    Logger.log('[NightlyBasicExport] ERROR: ' + err.message + '\n' + err.stack);
    SpreadsheetApp.getUi().alert(
      'Export failed.\n\n' +
      'Error: ' + err.message + '\n\n' +
      'Check Apps Script Executions (Extensions > Apps Script > Executions) for details.'
    );
  }
}


// TO ADD TO MENU: In Menu.js, add this line inside the 'Daily Reports' submenu:
//   .addItem('Send Basic Report', 'sendShiftReportBasic')
//
// Example placement (after the existing TEST item):
//   .addItem('Export & Email (TEST to me)', 'exportAndEmailPDF_TestToSelf')
//   .addSeparator()
//   .addItem('Send Basic Report (Standalone)', 'sendShiftReportBasic')
