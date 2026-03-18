/****************************************************
 * MENU FOR MASTER ACTIONABLES SHEET
 * Version 2.3 - Task Management Only (with password protection)
 *
 * Password-protected actions:
 * - All Cleanup, Setup Triggers, Manual Actions, Testing
 * @updated 2026-03-06
 ****************************************************/

/**
 * Prompts for password and returns true if correct.
 * Password is read from Script Properties (MENU_PASSWORD),
 * with a fallback to the default value during migration.
 */
function requirePassword_(actionName) {
  const stored = PropertiesService.getScriptProperties().getProperty('MENU_PASSWORD');
  const password = stored || 'chocolateteapot'; // fallback during migration
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
      'Password Required',
      'Enter password to ' + actionName + ':',
      ui.ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== ui.Button.OK) return false;
    if (response.getResponseText().trim() !== password) {
      ui.alert('Incorrect password. Action cancelled.');
      return false;
    }
    return true;
  } catch (e) {
    Logger.log('requirePassword_: UI not available');
    return false;
  }
}

// ============ PASSWORD-PROTECTED WRAPPERS ============

// Cleanup
function protected_removeEmptyRows() {
  if (requirePassword_('remove empty rows')) {
    removeEmptyRows();
  }
}

function protected_sortMasterActionablesAdvanced() {
  if (requirePassword_('sort tasks')) {
    sortMasterActionablesAdvanced();
  }
}

function protected_cleanupAndSortMasterActionables() {
  if (requirePassword_('cleanup and sort')) {
    cleanupAndSortMasterActionables();
  }
}

// Setup Triggers
function protected_createOnEditTrigger() {
  if (requirePassword_('create edit trigger')) {
    createOnEditTrigger();
  }
}

function protected_removeAllTaskTriggers() {
  if (requirePassword_('remove all triggers')) {
    removeAllTaskTriggers();
  }
}

// Manual Actions
function protected_archiveOldCompletedTasks() {
  if (requirePassword_('archive old tasks')) {
    archiveOldCompletedTasks_();
  }
}

function protected_escalateBlockedTasks() {
  if (requirePassword_('check blocked escalations')) {
    escalateBlockedTasks_();
  }
}

function protected_sendOverdueTasksSummary() {
  if (requirePassword_('send overdue summary')) {
    sendOverdueTasksSummary_();
  }
}

// Testing
function protected_testAuditLog() {
  if (requirePassword_('test audit log')) {
    testAuditLog();
  }
}

function protected_debugRowContent() {
  if (requirePassword_('debug row content')) {
    debugRowContent();
  }
}

// Weekly Summary
function protected_sendWeeklyActiveTasksSummary() {
  if (requirePassword_('send weekly active tasks summary')) {
    sendWeeklyActiveTasksSummary();
  }
}

function protected_sendWeeklyActiveTasksSummary_Test() {
  if (requirePassword_('send weekly summary (TEST)')) {
    sendWeeklyActiveTasksSummary_Test();
  }
}

function protected_createWeeklySummaryTrigger() {
  if (requirePassword_('create weekly summary trigger')) {
    createWeeklySummaryTrigger();
  }
}

// Reapply Formatting
function protected_reapplyFormattingAndValidation() {
  if (requirePassword_('reapply formatting and validation')) {
    reapplyFormattingAndValidation();
  }
}

// Dashboard
function protected_buildTaskDashboard() {
  if (requirePassword_('build task dashboard')) {
    buildTaskDashboard();
  }
}

function protected_refreshStaffWorkload() {
  if (requirePassword_('refresh staff workload')) {
    refreshStaffWorkload();
  }
}

// Bi-Hourly Cleanup Trigger
function protected_createBiHourlyCleanupTrigger() {
  if (requirePassword_('create bi-hourly cleanup trigger')) {
    createBiHourlyCleanupTrigger();
  }
}

function protected_removeBiHourlyCleanupTrigger() {
  if (requirePassword_('remove bi-hourly cleanup trigger')) {
    removeBiHourlyCleanupTrigger();
  }
}

// New Scheduled Triggers
function protected_createDailyStaffWorkloadTrigger() {
  if (requirePassword_('create daily staff workload trigger')) {
    createDailyStaffWorkloadTrigger();
  }
}

function protected_createWeeklyArchiveTrigger() {
  if (requirePassword_('create weekly archive trigger')) {
    createWeeklyArchiveTrigger();
  }
}

function protected_createWeeklyOverdueSummaryTrigger() {
  if (requirePassword_('create weekly overdue summary trigger')) {
    createWeeklyOverdueSummaryTrigger();
  }
}

// ============ MENU ============

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('Task Management')
      .addItem('Open Task Manager', 'openTaskManager')
      .addSeparator()
      .addSubMenu(ui.createMenu('🔐 Admin Tools')
        .addSubMenu(ui.createMenu('Weekly Summary')
          .addItem('Send Weekly Active Tasks (LIVE)', 'protected_sendWeeklyActiveTasksSummary')
          .addItem('Send Weekly Active Tasks (TEST to Evan)', 'protected_sendWeeklyActiveTasksSummary_Test'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Dashboard')
          .addItem('Build / Rebuild Task Dashboard', 'protected_buildTaskDashboard')
          .addItem('Refresh Staff Workload Stats', 'protected_refreshStaffWorkload'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Cleanup')
          .addItem('Remove Empty Rows', 'protected_removeEmptyRows')
          .addItem('Sort Tasks', 'protected_sortMasterActionablesAdvanced')
          .addSeparator()
          .addItem('✨ Cleanup & Sort (Both)', 'protected_cleanupAndSortMasterActionables')
          .addSeparator()
          .addItem('🔧 Reapply Dropdowns & Formatting', 'protected_reapplyFormattingAndValidation'))
        .addSeparator()
        .addSubMenu(ui.createMenu('🔧 Setup Triggers')
          .addItem('Create Edit Trigger (Auto-sort)', 'protected_createOnEditTrigger')
          .addItem('Create Weekly Summary Trigger (Mon 10am)', 'protected_createWeeklySummaryTrigger')
          .addItem('Create Bi-Hourly Cleanup Trigger (Every 2hrs)', 'protected_createBiHourlyCleanupTrigger')
          .addItem('Create Daily Staff Workload Trigger (6am)', 'protected_createDailyStaffWorkloadTrigger')
          .addItem('Create Weekly Archive Trigger (Mon 6am)', 'protected_createWeeklyArchiveTrigger')
          .addItem('Create Overdue Summary Trigger (Sun 9am)', 'protected_createWeeklyOverdueSummaryTrigger')
          .addSeparator()
          .addItem('Remove All Task Triggers', 'protected_removeAllTaskTriggers'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Manual Actions')
          .addItem('Archive Old Tasks Now', 'protected_archiveOldCompletedTasks')
          .addItem('Check Blocked Escalations Now', 'protected_escalateBlockedTasks')
          .addItem('Send Overdue Summary Now', 'protected_sendOverdueTasksSummary'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Testing')
          .addItem('Test Audit Log Entry', 'protected_testAuditLog')
          .addItem('Debug Row Content', 'protected_debugRowContent')))
      .addToUi();

    // Auto-sort tasks on open (ensures NEW tasks are always at top)
    try {
      sortMasterActionablesAdvanced();
    } catch (e) {
      // Silently fail if sheet not ready or permissions issue
      Logger.log('Auto-sort on open failed: ' + e.message);
    }
  } catch (error) {
    Logger.log('❌ [onOpen] failed: ' + error.message + '\n' + error.stack);
    try {
      const webhook = PropertiesService.getScriptProperties().getProperty('ESCALATION_SLACK_WEBHOOK');
      if (webhook) {
        const slackResp = UrlFetchApp.fetch(webhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ [onOpen] Waratah Task Management failed: ' + error.message }),
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

function onInstall(e) {
  onOpen(e);
}
