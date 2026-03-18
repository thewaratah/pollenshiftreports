/****************************************************
 * CONSOLIDATED MENU FOR THE WARATAH
 *
 * This file replaces all other onOpen() functions in:
 * - Export & Email PDF.gs
 * - Duplicate & Rename Sheet.gs
 *
 * Place this in a new file called Menu.gs or replace
 * the onOpen() function in Duplicate & Rename Sheet.gs
 ****************************************************/

/**
 * Prompts the user for the admin password.
 * Returns true if correct, false otherwise.
 * Password is read from Script Properties (MENU_PASSWORD),
 * with a fallback to the default value during migration.
 */
function requirePassword_() {
  const stored = PropertiesService.getScriptProperties().getProperty('MENU_PASSWORD');
  const password = stored || 'chocolateteapot'; // fallback during migration
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Admin Access', 'Enter admin password:', ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return false;
    if (response.getResponseText().trim() !== password) {
      ui.alert('Incorrect password.');
      return false;
    }
    return true;
  } catch (e) {
    Logger.log('requirePassword_: UI not available');
    return false;
  }
}

// === PASSWORD-GATED WRAPPERS: Setup & Utilities ===
function pw_fixSheetNamesAndDateFormat()             { if (requirePassword_()) fixSheetNamesAndDateFormat(); }
function pw_buildFinancialDashboard()                { if (requirePassword_()) buildFinancialDashboard(); }
function pw_buildExecutiveDashboard()                { if (requirePassword_()) buildExecutiveDashboard(); }
function pw_backfillAllDaysTodos()                   { if (requirePassword_()) backfillAllDaysTodos(); }

// === PASSWORD-GATED WRAPPERS: Weekly Reports ===
function pw_sendWeeklyTodoSummary_WARATAH()             { if (requirePassword_()) sendWeeklyTodoSummary_WARATAH(); }
function pw_sendWeeklyTodoSummary_WARATAH_TestToSelf()  { if (requirePassword_()) sendWeeklyTodoSummary_WARATAH_TestToSelf(); }

// === PASSWORD-GATED WRAPPERS: Weekly Rollover ===
function pw_performWeeklyRollover()                  { if (requirePassword_()) performWeeklyRollover(); }
function pw_previewRollover()                        { if (requirePassword_()) previewRollover(); }
function pw_createWeeklyRolloverTrigger()            { if (requirePassword_()) createWeeklyRolloverTrigger(); }
function pw_removeWeeklyRolloverTrigger()            { if (requirePassword_()) removeWeeklyRolloverTrigger(); }

// === PASSWORD-GATED WRAPPERS: Analytics ===
function pw_openAnalyticsViewer()                    { if (requirePassword_()) openAnalyticsViewer(); }

// === PASSWORD-GATED WRAPPERS: Data Warehouse ===
function pw_backfillShiftToWarehouse()      { if (requirePassword_()) backfillShiftToWarehouse(); }
function pw_setupWeeklyBackfillTrigger()    { if (requirePassword_()) setupWeeklyBackfillTrigger(); }
function pw_showIntegrationLogStats()       { if (requirePassword_()) showIntegrationLogStats(); }

// === PASSWORD-GATED WRAPPERS: Named Ranges ===
function pw_diagnoseNamedRanges()               { if (requirePassword_()) diagnoseNamedRanges(); }
function pw_diagnoseAllSheets()                 { if (requirePassword_()) diagnoseAllSheets(); }
function pw_createNamedRangesOnActiveSheet()    { if (requirePassword_()) createNamedRangesOnActiveSheet(); }
function pw_createNamedRangesOnAllSheets()      { if (requirePassword_()) createNamedRangesOnAllSheets(); }
function pw_forceUpdateNamedRangesOnAllSheets() { if (requirePassword_()) forceUpdateNamedRangesOnAllSheets(); }
// === PASSWORD-GATED WRAPPERS: Sheet Protection ===
function pw_setupAllSheetsProtection()  { if (requirePassword_()) setupAllSheetsProtection(); }
function pw_removeAllSheetsProtection() { if (requirePassword_()) removeAllSheetsProtection(); }

// === PASSWORD-GATED WRAPPERS: Trigger Setup ===
function pw_setupAllTriggers_Waratah() { if (requirePassword_()) setupAllTriggers_Waratah(); }


// === PASSWORD-GATED WRAPPERS: Weekly Digest ===
function pw_sendWeeklyRevenueDigest_Waratah()      { if (requirePassword_()) sendWeeklyRevenueDigest_Waratah(); }
function pw_sendWeeklyRevenueDigest_Waratah_Test() { if (requirePassword_()) sendWeeklyRevenueDigest_Waratah_Test(); }
function pw_setupWeeklyDigestTrigger_Waratah()     { if (requirePassword_()) setupWeeklyDigestTrigger_Waratah(); }

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Silent trigger check — warn if key SR triggers are missing
    let adminMenuLabel = 'Admin Tools';
    try {
      const triggers = ScriptApp.getProjectTriggers();
      const handlerNames = triggers.map(function(t) { return t.getHandlerFunction(); });
      const hasDigest = handlerNames.indexOf('sendWeeklyRevenueDigest_Waratah') !== -1;
      const hasRollover = handlerNames.indexOf('performWeeklyRollover') !== -1;
      if (!hasDigest || !hasRollover) {
        adminMenuLabel = '⚠ Admin Tools';
        Logger.log('onOpen trigger check: missing triggers — digest=' + hasDigest + ', rollover=' + hasRollover);
      }
    } catch (triggerCheckErr) {
      // Non-blocking: fall back to normal label silently
      Logger.log('onOpen trigger check failed (non-blocking): ' + triggerCheckErr.message);
    }

    ui.createMenu('Waratah Tools')
      // Daily Reports (no password)
      .addSubMenu(ui.createMenu('Daily Reports')
        .addItem('Export & Email PDF (LIVE)', 'exportAndEmailPDF')
        .addItem('Export & Email (TEST to me)', 'exportAndEmailPDF_TestToSelf')
        .addItem('Send Basic Report', 'sendShiftReportBasic')
        .addSeparator()
        .addItem('Open Export Dashboard', 'openExportDashboard'))

      .addSeparator()

      // Admin Tools (all password-protected)
      .addSubMenu(ui.createMenu(adminMenuLabel)
        // Weekly Reports
        .addSubMenu(ui.createMenu('Weekly Reports')
          .addItem('Weekly To-Do Summary (LIVE)', 'pw_sendWeeklyTodoSummary_WARATAH')
          .addItem('Weekly To-Do Summary (TEST to me)', 'pw_sendWeeklyTodoSummary_WARATAH_TestToSelf')
          .addSeparator()
          .addSubMenu(ui.createMenu('Weekly Rollover (In-Place)')
            .addItem('Run Rollover Now', 'pw_performWeeklyRollover')
            .addItem('Preview Rollover (Dry Run)', 'pw_previewRollover')
            .addSeparator()
            .addItem('Create Rollover Trigger', 'pw_createWeeklyRolloverTrigger')
            .addItem('Remove Rollover Trigger', 'pw_removeWeeklyRolloverTrigger')))

        .addSubMenu(ui.createMenu('Weekly Digest')
          .addItem('Send Revenue Digest (LIVE)', 'pw_sendWeeklyRevenueDigest_Waratah')
          .addItem('Send Revenue Digest (TEST)', 'pw_sendWeeklyRevenueDigest_Waratah_Test')
          .addSeparator()
          .addItem('Setup Monday Digest Trigger', 'pw_setupWeeklyDigestTrigger_Waratah'))

        .addSeparator()

        // Analytics
        .addSubMenu(ui.createMenu('Analytics')
          .addItem('Build Financial Dashboard', 'pw_buildFinancialDashboard')
          .addItem('Build Executive Dashboard', 'pw_buildExecutiveDashboard')
          .addItem('Open Analytics Viewer', 'pw_openAnalyticsViewer'))

        .addSeparator()
        .addSubMenu(ui.createMenu('Data Warehouse')
          .addItem('Backfill This Sheet to Warehouse', 'pw_backfillShiftToWarehouse')
          .addItem('Show Integration Log (Last 30 Days)', 'pw_showIntegrationLogStats')
          .addSeparator()
          .addItem('Setup Weekly Backfill Trigger', 'pw_setupWeeklyBackfillTrigger'))

        .addSeparator()

        // Setup & Utilities
        .addSubMenu(ui.createMenu('Setup & Utilities')
          .addItem('Setup All SR Triggers', 'pw_setupAllTriggers_Waratah')
          .addSeparator()
          .addItem('Fix Tab Names & Date Format (One-Off)', 'pw_fixSheetNamesAndDateFormat')
          .addSeparator()
          .addItem('Backfill TO-DOs (All Days)', 'pw_backfillAllDaysTodos')
          .addSeparator()
          .addSubMenu(ui.createMenu('Named Ranges')
            .addItem('Diagnose Active Sheet', 'pw_diagnoseNamedRanges')
            .addItem('Diagnose All Sheets', 'pw_diagnoseAllSheets')
            .addSeparator()
            .addItem('Create on Active Sheet', 'pw_createNamedRangesOnActiveSheet')
            .addItem('Create on ALL Sheets', 'pw_createNamedRangesOnAllSheets')
            .addSeparator()
            .addItem('Force Update ALL Sheets', 'pw_forceUpdateNamedRangesOnAllSheets'))
          .addSeparator()
          .addSubMenu(ui.createMenu('Sheet Protection')
            .addItem('Apply Protection (All Sheets)', 'pw_setupAllSheetsProtection')
            .addItem('Remove Protection (All Sheets)', 'pw_removeAllSheetsProtection'))))

      .addToUi();
  } catch (error) {
    Logger.log('❌ [onOpen] failed: ' + error.message + '\n' + error.stack);
    try {
      const webhook = PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST');
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [onOpen] Waratah Shift Reports failed: ' + error.message }),
          muteHttpExceptions: true
        });
        const slackCode = slackResp.getResponseCode();
        if (slackCode < 200 || slackCode >= 300) {
          Logger.log('❌ HTTP error ' + slackCode + ': ' + slackResp.getContentText());
        }
      }
    } catch (slackErr) {
      Logger.log('❌ [onOpen] Slack notification also failed: ' + slackErr.message);
    }
  }
}

/**
 * Installs all required Shift Report triggers in one call.
 * Deletes any existing triggers with the same handler names first to avoid duplicates.
 *
 * Triggers installed:
 *   - performWeeklyRollover: Monday 10:00am
 *   - runWeeklyBackfill_:    Monday 8:00am
 *   - sendWeeklyRevenueDigest_Waratah: Wednesday 8:00am (Waratah digest runs Wed)
 */
function setupAllTriggers_Waratah() {
  const handlers = [
    'performWeeklyRollover',
    'runWeeklyBackfill_',
    'sendWeeklyRevenueDigest_Waratah'
  ];

  // Remove any existing triggers for these handlers
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing trigger: ' + trigger.getHandlerFunction());
    }
  });

  // Weekly Rollover: Monday 10:00am
  ScriptApp.newTrigger('performWeeklyRollover')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(0)
    .create();

  // Weekly Backfill: Monday 8:00am
  ScriptApp.newTrigger('runWeeklyBackfill_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .nearMinute(0)
    .create();

  // Weekly Digest: Wednesday 8:00am (Waratah digest runs on Wednesday)
  ScriptApp.newTrigger('sendWeeklyRevenueDigest_Waratah')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(8)
    .nearMinute(0)
    .create();

  Logger.log('setupAllTriggers_Waratah: 3 triggers installed successfully.');

  try {
    SpreadsheetApp.getUi().alert(
      'SR Triggers Installed',
      '3 triggers installed successfully:\n\n' +
      '• Weekly Rollover — Monday 10:00am\n' +
      '• Weekly Backfill — Monday 8:00am\n' +
      '• Weekly Digest   — Wednesday 8:00am\n\n' +
      'Verify in Apps Script Editor → Triggers (clock icon).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('setupAllTriggers_Waratah: UI alert skipped — trigger context');
  }
}

/**
 * Optional: For add-on compatibility
 * Ensures menu appears when script is installed as add-on
 */
function onInstall(e) {
  onOpen(e);
}
