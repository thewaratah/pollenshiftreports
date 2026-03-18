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
function pw_openRolloverWizard()              { if (requirePassword_()) openRolloverWizard(); }
function pw_performInPlaceRollover()           { if (requirePassword_()) performInPlaceRollover(); }
function pw_previewInPlaceRollover()           { if (requirePassword_()) previewInPlaceRollover(); }
function pw_showRolloverConfig()              { if (requirePassword_()) showRolloverConfig(); }
function pw_createRolloverTrigger_Sakura()    { if (requirePassword_()) createRolloverTrigger_Sakura(); }
function pw_removeRolloverTrigger_Sakura()    { if (requirePassword_()) removeRolloverTrigger_Sakura(); }

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
function pw_namedRangeHealthCheck_Sakura()    { if (requirePassword_()) namedRangeHealthCheck_Sakura(); }
// === PASSWORD-GATED WRAPPERS: Sheet Protection ===
function pw_setupAllSheetsProtection()  { if (requirePassword_()) setupAllSheetsProtection(); }
function pw_removeAllSheetsProtection() { if (requirePassword_()) removeAllSheetsProtection(); }

function pw_backfillAllDaysTodos()             { if (requirePassword_()) backfillAllDaysTodos(); }
function pw_pushCurrentSheetTodosToActionables() { if (requirePassword_()) pushCurrentSheetTodosToActionables(); }

// === PASSWORD-GATED WRAPPERS: Data Warehouse ===
function pw_backfillShiftToWarehouse()      { if (requirePassword_()) backfillShiftToWarehouse(); }
function pw_setupWeeklyBackfillTrigger()    { if (requirePassword_()) setupWeeklyBackfillTrigger(); }
function pw_showIntegrationLogStats()       { if (requirePassword_()) showIntegrationLogStats(); }

// === PASSWORD-GATED WRAPPERS: Trigger Setup ===
function pw_setupAllTriggers_Sakura()       { if (requirePassword_()) setupAllTriggers_Sakura(); }

// === PASSWORD-GATED WRAPPERS: Weekly Digest ===
function pw_sendWeeklyRevenueDigest_Sakura()      { if (requirePassword_()) sendWeeklyRevenueDigest_Sakura(); }
function pw_sendWeeklyRevenueDigest_Sakura_Test() { if (requirePassword_()) sendWeeklyRevenueDigest_Sakura_Test(); }
function pw_setupWeeklyDigestTrigger_Sakura()     { if (requirePassword_()) setupWeeklyDigestTrigger_Sakura(); }


function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    // S5: Silent trigger check — warn in Admin Tools label if key SR triggers are missing.
    // Falls back to 'Admin Tools' if anything goes wrong.
    let adminToolsLabel = 'Admin Tools';
    try {
      const triggers = ScriptApp.getProjectTriggers();
      const handlers = triggers.map(function(t) { return t.getHandlerFunction(); });
      const hasRollover = handlers.indexOf('performInPlaceRollover') !== -1;
      const hasDigest = handlers.indexOf('sendWeeklyRevenueDigest_Sakura') !== -1;
      if (!hasRollover || !hasDigest) {
        adminToolsLabel = '\u26a0 Admin Tools'; // ⚠ Admin Tools
      }
    } catch (triggerCheckErr) {
      // Silently fall back to normal label
      Logger.log('[onOpen] Trigger check failed (non-blocking): ' + triggerCheckErr.message);
    }

    ui.createMenu('Shift Report')
      // Daily Reports
      .addItem('Send Nightly Report', 'exportAndEmailPDF')
      .addItem('Send Test Report', 'exportAndEmailPDF_TestToSelf')
      .addItem('Send Basic Report', 'sendShiftReportBasic')

      .addSeparator()

      // Admin Tools (all password-gated)
      .addSubMenu(ui.createMenu(adminToolsLabel)
        .addSubMenu(ui.createMenu('Weekly Reports')
          .addItem('Weekly To-Do Summary (LIVE)', 'pw_sendWeeklyTodoSummary')
          .addItem('Weekly To-Do Summary (TEST)', 'pw_sendWeeklyTodoSummary_TestToSelf'))

        .addSubMenu(ui.createMenu('Weekly Digest')
          .addItem('Send Revenue Digest (LIVE)', 'pw_sendWeeklyRevenueDigest_Sakura')
          .addItem('Send Revenue Digest (TEST)', 'pw_sendWeeklyRevenueDigest_Sakura_Test')
          .addSeparator()
          .addItem('Setup Monday Digest Trigger', 'pw_setupWeeklyDigestTrigger_Sakura'))

        .addSubMenu(ui.createMenu('Weekly Rollover')
          .addItem('Open Rollover Wizard', 'pw_openRolloverWizard')
          .addItem('Run Rollover Now', 'pw_performInPlaceRollover')
          .addItem('Preview Rollover (Dry Run)', 'pw_previewInPlaceRollover')
          .addItem('Open Rollover Settings', 'pw_showRolloverConfig')
          .addSeparator()
          .addItem('Create Rollover Trigger (Mon 10am)', 'pw_createRolloverTrigger_Sakura')
          .addItem('Remove Rollover Trigger', 'pw_removeRolloverTrigger_Sakura'))

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
          .addItem('Setup All SR Triggers', 'pw_setupAllTriggers_Sakura')
          .addSeparator()
          .addItem('Named Range Health Check', 'pw_namedRangeHealthCheck_Sakura')
          .addSeparator()
          .addItem('Check Named Ranges (This Sheet)', 'pw_diagnoseNamedRanges')
          .addItem('Check Named Ranges (ALL Sheets)', 'pw_diagnoseAllSheets')
          .addItem('Create Named Ranges (This Sheet)', 'pw_createNamedRangesOnActiveSheet')
          .addItem('Create Named Ranges (ALL Sheets)', 'pw_createNamedRangesOnAllSheets')
          .addItem('Force Update Named Ranges (ALL Sheets)', 'pw_forceUpdateNamedRangesOnAllSheets')
          .addItem('Test Task Push to Actionables', 'pw_testPushTodosToActionables')
          .addItem('Backfill TO-DOs (All Days)', 'pw_backfillAllDaysTodos')
          .addItem('Push TO-DOs (This Sheet)', 'pw_pushCurrentSheetTodosToActionables')
          .addSeparator()
          .addSubMenu(ui.createMenu('Sheet Protection')
            .addItem('Apply Protection (All Sheets)', 'pw_setupAllSheetsProtection')
            .addItem('Remove Protection (All Sheets)', 'pw_removeAllSheetsProtection'))))

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


// ============================================================================
// TRIGGER SETUP
// ============================================================================

/**
 * Install all required Shift Report triggers in one call.
 * Safe to re-run — deletes any existing trigger with the same handler name
 * before creating a new one to prevent duplicates.
 *
 * Triggers installed:
 *   - performInPlaceRollover  : Monday 1:00 AM  (weekly rollover)
 *   - runWeeklyBackfill_      : Monday 8:00 AM  (warehouse backfill)
 *   - sendWeeklyRevenueDigest_Sakura : Monday 8:00 AM (weekly digest)
 *
 * NOTE: Task Management triggers (runDailyTaskMaintenance etc.) must be
 * installed separately from the Sakura Actionables Sheet project — they
 * belong to a different GAS project and cannot be set up from here.
 */
function setupAllTriggers_Sakura() {
  const triggerDefs = [
    { handler: 'performInPlaceRollover',           day: ScriptApp.WeekDay.MONDAY, hour: 1,  label: 'Weekly Rollover (Mon 1am)' },
    { handler: 'runWeeklyBackfill_',               day: ScriptApp.WeekDay.MONDAY, hour: 8,  label: 'Weekly Backfill (Mon 8am)' },
    { handler: 'sendWeeklyRevenueDigest_Sakura',   day: ScriptApp.WeekDay.MONDAY, hour: 8,  label: 'Weekly Digest (Mon 8am)' }
  ];

  const lines = [];

  triggerDefs.forEach(function(def) {
    try {
      // Delete any existing trigger for this handler
      ScriptApp.getProjectTriggers()
        .filter(function(t) { return t.getHandlerFunction() === def.handler; })
        .forEach(function(t) { ScriptApp.deleteTrigger(t); });

      // Create fresh trigger
      ScriptApp.newTrigger(def.handler)
        .timeBased()
        .onWeekDay(def.day)
        .atHour(def.hour)
        .create();

      lines.push('OK  ' + def.label + ' (' + def.handler + ')');
      Logger.log('setupAllTriggers_Sakura: installed ' + def.handler);
    } catch (e) {
      lines.push('FAIL ' + def.label + ': ' + e.message);
      Logger.log('setupAllTriggers_Sakura: failed to install ' + def.handler + ' — ' + e.message);
    }
  });

  lines.push('');
  lines.push('NOTE: Task Management triggers (runDailyTaskMaintenance etc.)');
  lines.push('must be installed from the Sakura Actionables Sheet project.');

  try {
    SpreadsheetApp.getUi().alert(
      'SR Triggers Setup',
      lines.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('setupAllTriggers_Sakura summary:\n' + lines.join('\n'));
  }
}

/**
 * Install the weekly rollover trigger for performInPlaceRollover.
 * Safe to re-run — deletes any existing rollover trigger first.
 * Schedule: every Monday at 1:00 AM (Australia/Sydney).
 *
 * Called via pw_createRolloverTrigger_Sakura() (password-gated).
 */
function createRolloverTrigger_Sakura() {
  // Remove any existing rollover trigger to avoid duplicates
  var removed = 0;
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'performInPlaceRollover'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); removed++; });

  ScriptApp.newTrigger('performInPlaceRollover')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(1)
    .create();

  Logger.log('createRolloverTrigger_Sakura: installed performInPlaceRollover Monday 1am' +
    (removed > 0 ? ' (replaced ' + removed + ' existing trigger(s))' : ''));

  try {
    SpreadsheetApp.getUi().alert(
      'Rollover Trigger Installed',
      'performInPlaceRollover will run every Monday at 1:00 AM.\n\n' +
        (removed > 0 ? removed + ' existing trigger(s) replaced.\n\n' : '') +
        'To remove: Apps Script editor \u2192 Triggers (clock icon) \u2192 delete the trigger.\n' +
        'Or use: Admin Tools \u2192 Weekly Rollover \u2192 Remove Rollover Trigger.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('createRolloverTrigger_Sakura: UI skipped (trigger context)');
  }
}


/**
 * Remove all rollover triggers for performInPlaceRollover.
 * Safe to run even if no trigger exists.
 *
 * Called via pw_removeRolloverTrigger_Sakura() (password-gated).
 */
function removeRolloverTrigger_Sakura() {
  var removed = 0;
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'performInPlaceRollover'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); removed++; });

  Logger.log('removeRolloverTrigger_Sakura: removed ' + removed + ' trigger(s)');

  try {
    SpreadsheetApp.getUi().alert(
      'Rollover Trigger Removed',
      removed > 0
        ? removed + ' rollover trigger(s) removed.\n\nThe weekly rollover will no longer run automatically.\n' +
          'To reinstall: Admin Tools \u2192 Weekly Rollover \u2192 Create Rollover Trigger (Mon 10am).'
        : 'No rollover trigger found — nothing to remove.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('removeRolloverTrigger_Sakura: UI skipped (trigger context)');
  }
}
