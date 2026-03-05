// ============================================================
// SAKURA HOUSE — BASIC SHIFT REPORT EXPORT
// NightlyBasicExportSakura.gs
//
// Standalone, self-contained. No calls to helpers in other files.
// Safe for non-technical handover — all config is at the top.
// ============================================================


// ============================================================
// CONFIGURATION — edit these values before using
// ============================================================
var BASIC_CONFIG = {
  // Email recipients — add as many as needed
  emailRecipients: [
    'manager@example.com',
    'owner@example.com'
  ],

  // Slack webhook — paste your incoming webhook URL here
  slackWebhook: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',

  // Name of the TO-DOs tab in this spreadsheet
  todoTabName: 'TO-DOs',

  // Email subject prefix (sheet name and date are appended automatically)
  emailSubjectPrefix: 'Sakura House — Shift Report'
};

// Valid day-sheet prefixes (Sakura operates Mon–Sat)
var BASIC_VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];


// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Single entry point. Runs all five steps in order.
 * Progress is visible in the GAS Executions panel via Logger.log().
 */
function sendShiftReportBasic() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    var sheetName = sheet.getName();
    var ui = SpreadsheetApp.getUi();


    // === STEP 1: VALIDATE — must be a day sheet ===
    Logger.log('Step 1: Validating sheet — ' + sheetName);

    var isValidDay = BASIC_VALID_DAYS.some(function(day) { return sheetName.indexOf(day) === 0; });

    if (!isValidDay) {
      ui.alert(
        'Cannot export this sheet.\n\n' +
        '"' + sheetName + '" is not a shift day sheet.\n\n' +
        'Please navigate to a MONDAY–SATURDAY sheet and try again.'
      );
      Logger.log('Aborted — not a day sheet: ' + sheetName);
      return;
    }

    // Read date and MOD directly from the standard Sakura template cells.
    // NOTE: B3 is the date cell (merged B3:D3); B4 is the MOD cell (merged B4:D4).
    var dateValue = sheet.getRange('B3').getDisplayValue().trim() || 'No date';
    var modValue  = sheet.getRange('B4').getDisplayValue().trim() || 'Unknown MOD';
    Logger.log('Date: ' + dateValue + ' | MOD: ' + modValue);


    // === STEP 2: GENERATE PDF ===
    Logger.log('Step 2: Generating PDF');

    var exportUrl =
      'https://docs.google.com/spreadsheets/d/' + spreadsheet.getId() + '/export?' +
      'format=pdf&gid=' + sheet.getSheetId() +
      '&size=A4&portrait=true&fitw=true' +
      '&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5' +
      '&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false';

    var pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });

    if (pdfResponse.getResponseCode() !== 200) {
      throw new Error('PDF fetch returned HTTP ' + pdfResponse.getResponseCode());
    }

    var pdfFilename = BASIC_CONFIG.emailSubjectPrefix + ' — ' + sheetName + ' ' + dateValue + '.pdf';
    var pdfBlob = pdfResponse.getBlob().setName(pdfFilename);
    Logger.log('PDF ready: ' + pdfFilename + ' (' + pdfBlob.getBytes().length + ' bytes)');


    // === STEP 3: SEND EMAIL ===
    Logger.log('Step 3: Sending email');

    GmailApp.sendEmail(
      BASIC_CONFIG.emailRecipients.join(','),
      BASIC_CONFIG.emailSubjectPrefix + ' — ' + sheetName + ' ' + dateValue,
      'Hi team,\n\nPlease find attached the shift report for ' + sheetName +
        ' (' + dateValue + ').\n\nMOD: ' + modValue + '\n\nRegards,\nSakura House',
      { attachments: [pdfBlob] }
    );
    Logger.log('Email sent to: ' + BASIC_CONFIG.emailRecipients.join(', '));


    // === STEP 4: POST TO SLACK ===
    Logger.log('Step 4: Posting to Slack');

    var slackResponse = UrlFetchApp.fetch(BASIC_CONFIG.slackWebhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        text:
          '*Sakura House — Shift Report Sent*\n' +
          'Day: ' + sheetName + '\n' +
          'Date: ' + dateValue + '\n' +
          'MOD: ' + modValue + '\n' +
          'Report sent \u2713'
      }),
      muteHttpExceptions: true
    });
    Logger.log('Slack HTTP ' + slackResponse.getResponseCode());


    // === STEP 5: WRITE TO-DOs TO TAB ===
    Logger.log('Step 5: Updating TO-DOs tab from ' + sheetName);

    // Read tasks and assignees from the standard Sakura fallback cells.
    // NOTE: Tasks live in A69:A84 (rows A–C are merged; value is in column A).
    //       Assignees live in D69:D84. These match FIELD_CONFIG in RunSakura.gs.
    var taskValues     = sheet.getRange('A69:A84').getValues(); // 16 rows x 1 col
    var assigneeValues = sheet.getRange('D69:D84').getValues(); // 16 rows x 1 col

    // Find or create the TO-DOs tab
    var todoSheet = spreadsheet.getSheetByName(BASIC_CONFIG.todoTabName);
    if (!todoSheet) {
      todoSheet = spreadsheet.insertSheet(BASIC_CONFIG.todoTabName);
    }

    // Clear rows 2+ (preserves the header row)
    var lastRow = todoSheet.getLastRow();
    if (lastRow >= 2) {
      todoSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
    }

    // Write header if sheet is empty
    if (todoSheet.getLastRow() === 0) {
      todoSheet.getRange(1, 1, 1, 4).setValues([['Day', 'Task', 'Assigned To', 'Date Added']]);
    }

    // Collect non-empty tasks, then write in one batch with setValues()
    var today = Utilities.formatDate(new Date(), 'Australia/Sydney', 'dd/MM/yyyy');
    var rows = [];
    for (var i = 0; i < taskValues.length; i++) {
      var task     = (taskValues[i][0] || '').toString().trim();
      var assignee = (assigneeValues[i][0] || '').toString().trim();
      if (task !== '') {
        rows.push([sheetName, task, assignee, today]);
      }
    }

    if (rows.length > 0) {
      todoSheet.getRange(2, 1, rows.length, 4).setValues(rows);
    }
    Logger.log('TO-DOs written: ' + rows.length + ' item(s)');


    // === DONE ===
    Logger.log('sendShiftReportBasic complete for ' + sheetName);
    ui.alert('Done! Report sent for ' + sheetName + '.\n\nEmailed to: ' + BASIC_CONFIG.emailRecipients.join(', ') + '\nTO-DOs tab updated.');

  } catch (error) {
    Logger.log('sendShiftReportBasic ERROR: ' + error.message + '\n' + error.stack);
    SpreadsheetApp.getUi().alert('Something went wrong: ' + error.message);
  }
}


// ============================================================
// TO ADD TO MENU: In MenuSakura.gs, add this line inside onOpen()
// near the other "Send" items (e.g. after 'Send Nightly Report'):
//
//   .addItem('Send Basic Report', 'sendShiftReportBasic')
//
// Place it near the other "Send" items. No changes to MenuSakura.gs
// are made automatically — add the line manually when ready.
// ============================================================
