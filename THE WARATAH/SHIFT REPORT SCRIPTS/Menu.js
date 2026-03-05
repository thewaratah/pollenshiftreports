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
 * Get admin password from Script Properties.
 */
function getMenuPassword_() {
  return PropertiesService.getScriptProperties().getProperty('MENU_PASSWORD');
}

/**
 * Prompts the user for the admin password.
 * Returns true if correct, false otherwise.
 */
function requirePassword_() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Password Required",
    "Enter the admin password to continue:",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return false;

  if (response.getResponseText() !== getMenuPassword_()) {
    ui.alert("Incorrect password.");
    return false;
  }
  return true;
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

// === PASSWORD-GATED WRAPPERS: Weekly Digest ===
function pw_sendWeeklyRevenueDigest_Waratah()      { if (requirePassword_()) sendWeeklyRevenueDigest_Waratah(); }
function pw_sendWeeklyRevenueDigest_Waratah_Test() { if (requirePassword_()) sendWeeklyRevenueDigest_Waratah_Test(); }
function pw_setupWeeklyDigestTrigger_Waratah()     { if (requirePassword_()) setupWeeklyDigestTrigger_Waratah(); }

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

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
      .addSubMenu(ui.createMenu('Admin Tools')
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
          .addItem('Setup Wednesday Digest Trigger', 'pw_setupWeeklyDigestTrigger_Waratah'))

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
          .addItem('Fix Tab Names & Date Format (One-Off)', 'pw_fixSheetNamesAndDateFormat')
          .addSeparator()
          .addItem('Backfill TO-DOs (All Days)', 'pw_backfillAllDaysTodos')))

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
 * Optional: For add-on compatibility
 * Ensures menu appears when script is installed as add-on
 */
function onInstall(e) {
  onOpen(e);
}
