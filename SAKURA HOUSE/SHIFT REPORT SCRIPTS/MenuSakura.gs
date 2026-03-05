/****************************************************
 * CONSOLIDATED MENU FOR SAKURA HOUSE
 *
 * Single onOpen() function for the entire script project.
 * All other files must NOT define onOpen().
 *
 * Menu structure mirrors The Waratah's pattern.
 * Password-gated items: TEST functions, Integrations
 * & Analytics, Setup & Diagnostics.
 ****************************************************/


/**
 * Admin password for protected menus
 * ✅ SECURITY: Password now read from Script Properties (no hardcoded value)
 */
function getMenuPassword_() {
  const password = PropertiesService.getScriptProperties().getProperty('MENU_PASSWORD');
  if (!password) {
    Logger.log('⚠️ MENU_PASSWORD not configured in Script Properties');
    return null;
  }
  return password;
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

  const correctPassword = getMenuPassword_();
  if (!correctPassword) {
    ui.alert("Setup Error", "Menu password not configured in Script Properties.\n\nRun setupScriptProperties_Sakura() to configure.");
    return false;
  }

  if (response.getResponseText() !== correctPassword) {
    ui.alert("Incorrect password.");
    return false;
  }
  return true;
}


// === PASSWORD-GATED WRAPPERS: Daily Reports ===
function pw_exportAndEmailPDF()               { if (requirePassword_()) exportAndEmailPDF(); }  // kept for backward-compat
function pw_exportAndEmailPDF_TestToSelf()    { if (requirePassword_()) exportAndEmailPDF_TestToSelf(); }

// === PASSWORD-GATED WRAPPERS: Weekly Reports ===
function pw_sendWeeklyTodoSummary()           { if (requirePassword_()) sendWeeklyTodoSummary(); }
function pw_sendWeeklyTodoSummary_TestToSelf() { if (requirePassword_()) sendWeeklyTodoSummary_TestToSelf(); }

// === PASSWORD-GATED WRAPPERS: Weekly Rollover (In-Place) ===
function pw_performInPlaceRollover()           { if (requirePassword_()) performInPlaceRollover(); }
function pw_previewInPlaceRollover()           { if (requirePassword_()) previewInPlaceRollover(); }
function pw_showRolloverConfig()              { if (requirePassword_()) showRolloverConfig(); }

// === PASSWORD-GATED WRAPPERS: Integrations & Analytics ===
function pw_testIntegrations()                { if (requirePassword_()) testIntegrations(); }
function pw_runValidationReport()             { if (requirePassword_()) runValidationReport(); }
function pw_buildFinancialDashboard()         { if (requirePassword_()) buildFinancialDashboard(); }
function pw_buildExecutiveDashboard()         { if (requirePassword_()) buildExecutiveDashboard(); }
function pw_openAnalyticsViewer()             { if (requirePassword_()) openAnalyticsViewer(); }

// === PASSWORD-GATED WRAPPERS: Setup & Diagnostics ===
function pw_diagnoseNamedRanges()             { if (requirePassword_()) diagnoseNamedRanges(); }
function pw_diagnoseAllSheets()               { if (requirePassword_()) diagnoseAllSheets(); }
function pw_createNamedRangesOnActiveSheet()   { if (requirePassword_()) createNamedRangesOnActiveSheet(); }
function pw_createNamedRangesOnAllSheets()     { if (requirePassword_()) createNamedRangesOnAllSheets(); }
function pw_testPushTodosToActionables()       { if (requirePassword_()) testPushTodosToActionables(); }
function pw_forceUpdateNamedRangesOnAllSheets() { if (requirePassword_()) forceUpdateNamedRangesOnAllSheets(); }
function pw_backfillAllDaysTodos()             { if (requirePassword_()) backfillAllDaysTodos(); }
function pw_pushCurrentSheetTodosToActionables() { if (requirePassword_()) pushCurrentSheetTodosToActionables(); }

// === PASSWORD-GATED WRAPPERS: Data Warehouse ===
function pw_backfillShiftToWarehouse()      { if (requirePassword_()) backfillShiftToWarehouse(); }
function pw_setupWeeklyBackfillTrigger()    { if (requirePassword_()) setupWeeklyBackfillTrigger(); }
function pw_showIntegrationLogStats()       { if (requirePassword_()) showIntegrationLogStats(); }

// === PASSWORD-GATED WRAPPERS: Weekly Digest ===
function pw_sendWeeklyRevenueDigest_Sakura()      { if (requirePassword_()) sendWeeklyRevenueDigest_Sakura(); }
function pw_sendWeeklyRevenueDigest_Sakura_Test() { if (requirePassword_()) sendWeeklyRevenueDigest_Sakura_Test(); }
function pw_setupWeeklyDigestTrigger_Sakura()     { if (requirePassword_()) setupWeeklyDigestTrigger_Sakura(); }


function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('Shift Report')
      // Daily Reports
      .addItem('Send Nightly Report', 'exportAndEmailPDF')
      .addItem('Send Test Report', 'exportAndEmailPDF_TestToSelf')
      .addItem('Send Basic Report', 'sendShiftReportBasic')

      .addSeparator()

      // Admin Tools (all password-gated)
      .addSubMenu(ui.createMenu('Admin Tools')
        .addSubMenu(ui.createMenu('Weekly Reports')
          .addItem('Weekly To-Do Summary (LIVE)', 'pw_sendWeeklyTodoSummary')
          .addItem('Weekly To-Do Summary (TEST)', 'pw_sendWeeklyTodoSummary_TestToSelf'))

        .addSubMenu(ui.createMenu('Weekly Digest')
          .addItem('Send Revenue Digest (LIVE)', 'pw_sendWeeklyRevenueDigest_Sakura')
          .addItem('Send Revenue Digest (TEST)', 'pw_sendWeeklyRevenueDigest_Sakura_Test')
          .addSeparator()
          .addItem('Setup Monday Digest Trigger', 'pw_setupWeeklyDigestTrigger_Sakura'))

        .addSubMenu(ui.createMenu('Weekly Rollover')
          .addItem('Run Rollover Now', 'pw_performInPlaceRollover')
          .addItem('Preview Rollover (Dry Run)', 'pw_previewInPlaceRollover')
          .addItem('Open Rollover Settings', 'pw_showRolloverConfig'))

        .addSubMenu(ui.createMenu('Integrations & Analytics')
          .addItem('Test Integrations Now', 'pw_testIntegrations')
          .addItem('Validate All Systems', 'pw_runValidationReport')
          .addItem('Build Analytics Dashboard', 'pw_buildFinancialDashboard')
          .addItem('Build Executive Dashboard', 'pw_buildExecutiveDashboard')
          .addItem('Open Analytics', 'pw_openAnalyticsViewer'))

        .addSubMenu(ui.createMenu('Data Warehouse')
          .addItem('Backfill This Sheet to Warehouse', 'pw_backfillShiftToWarehouse')
          .addItem('Show Integration Log (Last 30 Days)', 'pw_showIntegrationLogStats')
          .addSeparator()
          .addItem('Setup Weekly Backfill Trigger', 'pw_setupWeeklyBackfillTrigger'))

        .addSubMenu(ui.createMenu('Set Up & Diagnostics')
          .addItem('Check Named Ranges (This Sheet)', 'pw_diagnoseNamedRanges')
          .addItem('Check Named Ranges (ALL Sheets)', 'pw_diagnoseAllSheets')
          .addItem('Create Named Ranges (This Sheet)', 'pw_createNamedRangesOnActiveSheet')
          .addItem('Create Named Ranges (ALL Sheets)', 'pw_createNamedRangesOnAllSheets')
          .addItem('Force Update Named Ranges (ALL Sheets)', 'pw_forceUpdateNamedRangesOnAllSheets')
          .addItem('Test Task Push to Actionables', 'pw_testPushTodosToActionables')
          .addItem('Backfill TO-DOs (All Days)', 'pw_backfillAllDaysTodos')
          .addItem('Push TO-DOs (This Sheet)', 'pw_pushCurrentSheetTodosToActionables')))

      .addToUi();
  } catch (error) {
    Logger.log('❌ [onOpen] failed: ' + error.message + '\n' + error.stack);
    try {
      const webhook = getSakuraSlackWebhookTest_();
      bk_post(webhook, [bk_section('❌ *[onOpen] failed (Sakura Shift Reports)*\n' + error.message)], 'onOpen error');
    } catch (slackErr) {
      Logger.log('Could not send Slack error notification: ' + slackErr.message);
    }
  }
}

function onInstall(e) {
  onOpen(e);
}
