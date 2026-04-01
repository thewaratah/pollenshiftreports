/****************************************************
 * MENU FOR SAKURA ACTIONABLES SHEET
 * Version 2.3 - Task Management
 *
 * This is the UNIFIED onOpen() for the Sakura Actionables
 * spreadsheet. It builds the Task Management menu.
 *
 * Dependencies:
 *   EnhancedTaskManagement_Sakura.gs - Task lifecycle system
 *   TaskDashboard_Sakura.gs          - Dashboard builder
 *
 * Password-protected actions:
 * - All Cleanup, Setup Triggers, Manual Actions, Testing
 ****************************************************/

function getMenuPassword_() {
  return PropertiesService.getScriptProperties().getProperty('MENU_PASSWORD');
}

/**
 * Prompts for password and returns true if correct
 */
function requirePassword_(actionName) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Password Required',
    `Enter password to ${actionName}:`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return false;
  }

  if (response.getResponseText() !== getMenuPassword_()) {
    ui.alert('Incorrect password. Action cancelled.');
    return false;
  }

  return true;
}

// ============ PASSWORD-PROTECTED WRAPPERS ============

// Cleanup
function protected_cleanupAndSortMasterActionables() {
  if (requirePassword_('cleanup and sort')) {
    cleanupAndSortMasterActionables();
  }
}

// Setup Triggers
function protected_createDailyMaintenanceTrigger() {
  if (requirePassword_('create daily trigger')) {
    createDailyMaintenanceTrigger();
  }
}

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

function protected_processRecurringTasks() {
  if (requirePassword_('process recurring tasks')) {
    processRecurringTasks_();
  }
}

function protected_escalateBlockedTasks() {
  if (requirePassword_('check blocked escalations')) {
    escalateBlockedTasks_();
  }
}

// Testing
function protected_testCreateTask() {
  if (requirePassword_('create test task')) {
    testCreateTask();
  }
}

function protected_testAuditLog() {
  if (requirePassword_('test audit log')) {
    testAuditLog();
  }
}

function protected_previewArchival() {
  if (requirePassword_('preview archival')) {
    previewArchival();
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

// protected_sendWeeklyFohLeadsSummary_Live() removed (Apr 2026) — FOH leads channel post discontinued

// Reapply Formatting
function protected_reapplyFormattingAndValidation() {
  if (requirePassword_('reapply formatting and validation')) {
    reapplyFormattingAndValidation();
  }
}

// Manual Actions (Daily Maintenance)
function protected_runDailyTaskMaintenance() {
  if (requirePassword_('run daily maintenance')) {
    runDailyTaskMaintenance();
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

// ============ UNIFIED MENU ============

/**
 * Unified onOpen for the Sakura Actionables Sheet.
 *
 * Builds one menu:
 *   "Task Management" — with Admin Tools submenu containing all admin/protected actions
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    // -- Task Management menu --
    ui.createMenu('Task Management')
      .addItem('Open Task Manager', 'openTaskManager')
      .addSeparator()
      .addSubMenu(ui.createMenu('Admin Tools')
        .addSubMenu(ui.createMenu('Weekly Summary')
          .addItem('Send Weekly Active Tasks (LIVE)', 'protected_sendWeeklyActiveTasksSummary')
          .addItem('Send Weekly Active Tasks (TEST to Evan)', 'protected_sendWeeklyActiveTasksSummary_Test'))
        .addSubMenu(ui.createMenu('Dashboard')
          .addItem('Build / Rebuild Task Dashboard', 'protected_buildTaskDashboard')
          .addItem('Refresh Staff Workload Stats', 'protected_refreshStaffWorkload'))
        .addSubMenu(ui.createMenu('Cleanup')
          .addItem('Cleanup & Sort (Both)', 'protected_cleanupAndSortMasterActionables')
          .addItem('Reapply Dropdowns & Formatting', 'protected_reapplyFormattingAndValidation'))
        .addSubMenu(ui.createMenu('Setup Triggers')
          .addItem('Create Daily Trigger (7am)', 'protected_createDailyMaintenanceTrigger')
          .addItem('Create Edit Trigger (Auto-sort)', 'protected_createOnEditTrigger')
          .addItem('Create Weekly Summary Trigger (Mon 6am)', 'protected_createWeeklySummaryTrigger')
          .addItem('Remove All Task Triggers', 'protected_removeAllTaskTriggers'))
        .addSubMenu(ui.createMenu('Manual Actions')
          .addItem('Run Daily Maintenance Now', 'protected_runDailyTaskMaintenance')
          .addSeparator()
          .addItem('Archive Old Tasks Now', 'protected_archiveOldCompletedTasks')
          .addItem('Process Recurring Tasks Now', 'protected_processRecurringTasks')
          .addItem('Check Blocked Escalations Now', 'protected_escalateBlockedTasks'))
        .addSubMenu(ui.createMenu('Testing')
          .addItem('Create Test Task', 'protected_testCreateTask')
          .addItem('Test Audit Log Entry', 'protected_testAuditLog')
          .addItem('Preview What Would Archive', 'protected_previewArchival')))
      .addToUi();
  } catch (error) {
    Logger.log('❌ [onOpen] failed: ' + error.message + '\n' + error.stack);
    try {
      const webhook = getManagersChannelWebhook_();
      bk_post(webhook, [bk_section('❌ *[onOpen] failed (Sakura Task Management)*\n' + error.message)], 'onOpen error');
    } catch (slackErr) {
      Logger.log('Could not send Slack error notification: ' + slackErr.message);
    }
  }
}

function onInstall(e) {
  onOpen(e);
}
