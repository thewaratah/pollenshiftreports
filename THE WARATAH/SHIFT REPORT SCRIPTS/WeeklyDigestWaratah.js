/**
 * ============================================================================
 * THE WARATAH — WEEKLY REVENUE DIGEST
 * ============================================================================
 * Posts a weekly revenue performance summary to Slack.
 * Scheduled to run every Wednesday via time-based trigger.
 *
 * Reads from: NIGHTLY_FINANCIAL in WARATAH_DATA_WAREHOUSE_ID
 * Posts to:   WARATAH_SLACK_WEBHOOK_LIVE
 * @version 1.0.0
 * ============================================================================
 */

/**
 * Main weekly digest function — called by time trigger or manually from menu.
 * Safe to run manually at any time.
 */
function sendWeeklyRevenueDigest_Waratah() {
  const config = getIntegrationConfig_();
  const warehouseId = config.dataWarehouseId;
  if (!warehouseId) {
    Logger.log('sendWeeklyRevenueDigest_Waratah: WARATAH_DATA_WAREHOUSE_ID not configured. Skipping.');
    return;
  }

  try {
    const webhook = PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_LIVE');
    if (!webhook) {
      Logger.log('sendWeeklyRevenueDigest_Waratah: WARATAH_SLACK_WEBHOOK_LIVE not configured. Skipping.');
      return;
    }
    const stats = computeWeeklyStats_Waratah_(warehouseId);
    const blocks = buildWeeklyDigestBlocks_Waratah_(stats);
    bk_post(webhook, blocks, 'The Waratah — Weekly Revenue Digest');
    Logger.log('Weekly revenue digest sent successfully.');
  } catch (e) {
    Logger.log('sendWeeklyRevenueDigest_Waratah failed: ' + e.message);
    try {
      const testWebhook = PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST');
      if (testWebhook) {
        UrlFetchApp.fetch(testWebhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ text: '❌ Weekly Revenue Digest (Waratah) FAILED: ' + e.message }),
          muteHttpExceptions: true
        });
      }
    } catch (slackErr) {
      Logger.log('Slack error notification also failed: ' + slackErr.message);
    }
  }
}

/** Send to test webhook instead of live */
function sendWeeklyRevenueDigest_Waratah_Test() {
  const config = getIntegrationConfig_();
  const warehouseId = config.dataWarehouseId;
  if (!warehouseId) { Logger.log('No warehouse ID.'); return; }
  try {
    const webhook = PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST');
    if (!webhook) { Logger.log('WARATAH_SLACK_WEBHOOK_TEST not configured.'); return; }
    const stats = computeWeeklyStats_Waratah_(warehouseId);
    const blocks = buildWeeklyDigestBlocks_Waratah_(stats);
    bk_post(webhook, blocks, '[TEST] The Waratah — Weekly Revenue Digest');
  } catch (e) {
    Logger.log('sendWeeklyRevenueDigest_Waratah_Test failed: ' + e.message);
  }
}

/**
 * Read NIGHTLY_FINANCIAL and compute this-week vs last-week stats.
 * "This week" = Wed–Sun of the week just ended.
 * @param {string} warehouseId
 * @returns {Object} stats
 */
function computeWeeklyStats_Waratah_(warehouseId) {
  const warehouse = SpreadsheetApp.openById(warehouseId);
  const sheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
  if (!sheet || sheet.getLastRow() < 2) {
    return { hasData: false };
  }

  const rows = sheet.getDataRange().getValues().slice(1); // skip header

  // Define this week: Wed–Sun of the week just ended
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 3=Wed...
  // Days since last Wednesday (3)
  let daysToWed = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4;
  const thisWednesday = new Date(today);
  thisWednesday.setDate(today.getDate() - daysToWed);
  thisWednesday.setHours(0, 0, 0, 0);

  const lastWednesday = new Date(thisWednesday);
  lastWednesday.setDate(thisWednesday.getDate() - 7);

  const thisWeek = rows.filter(function(r) {
    const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
    return d >= thisWednesday && d < today;
  });

  const lastWeek = rows.filter(function(r) {
    const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
    return d >= lastWednesday && d < thisWednesday;
  });

  const sum = function(arr, col) { return arr.reduce(function(acc, r) { return acc + (parseFloat(r[col]) || 0); }, 0); };

  const thisRevenue = sum(thisWeek, 5);   // col F = Net Revenue (index 5 in new 22-col schema)
  const lastRevenue = sum(lastWeek, 5);
  const thisTips    = sum(thisWeek, 20);  // col U = Total Tips (index 20 in new 22-col schema)
  const lastTips    = sum(lastWeek, 20);

  const revChange = lastRevenue > 0
    ? ((thisRevenue - lastRevenue) / lastRevenue * 100).toFixed(1)
    : null;

  const bestDay = thisWeek.reduce(function(best, r) {
    return (!best || parseFloat(r[5]) > parseFloat(best[5])) ? r : best;
  }, null);

  return {
    hasData: thisWeek.length > 0,
    weekStarting: Utilities.formatDate(thisWednesday, 'Australia/Sydney', 'dd/MM/yyyy'),
    daysReported: thisWeek.length,
    thisRevenue: thisRevenue,
    lastRevenue: lastRevenue,
    revChange: revChange,
    thisTips: thisTips,
    lastTips: lastTips,
    bestDay: bestDay ? {
      date: bestDay[0] instanceof Date
        ? Utilities.formatDate(bestDay[0], 'Australia/Sydney', 'EEE dd/MM')
        : String(bestDay[0]),
      revenue: parseFloat(bestDay[5]) || 0,
      mod: bestDay[3]
    } : null
  };
}

/**
 * Build Slack Block Kit blocks for the weekly digest.
 * @param {Object} stats - from computeWeeklyStats_Waratah_
 * @returns {Array} blocks
 */
function buildWeeklyDigestBlocks_Waratah_(stats) {
  if (!stats.hasData) {
    return [
      bk_header('🌿 The Waratah — Weekly Digest'),
      bk_section('No shift data found for this week yet. Check the warehouse.')
    ];
  }

  const revChange = parseFloat(stats.revChange);
  const revArrow = stats.revChange === null ? '' :
    revChange >= 0 ? ('▲ ' + stats.revChange + '%') : ('▼ ' + Math.abs(revChange) + '%');

  const formatAUD = function(n) { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  const blocks = [
    bk_header('🌿 The Waratah — Weekly Revenue Digest'),
    bk_context(['Week starting ' + stats.weekStarting + ' · ' + stats.daysReported + ' days reported']),
    bk_divider(),
    bk_fields([
      ['This Week Revenue', formatAUD(stats.thisRevenue)],
      ['vs Last Week', stats.revChange !== null ? revArrow : 'N/A'],
      ['Total Tips', formatAUD(stats.thisTips)],
      ['Days Reported', String(stats.daysReported)]
    ])
  ];

  if (stats.bestDay) {
    blocks.push(bk_section(
      '*Best shift:* ' + stats.bestDay.date + ' — ' + formatAUD(stats.bestDay.revenue) + ' (MOD: ' + stats.bestDay.mod + ')'
    ));
  }

  blocks.push(bk_context(['The Waratah Shift Reports 3.0 · Auto-generated weekly digest']));
  return blocks;
}

/**
 * Install a Wednesday morning trigger for the weekly digest.
 * Safe to re-run — removes any existing digest trigger first.
 */
function setupWeeklyDigestTrigger_Waratah() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'sendWeeklyRevenueDigest_Waratah'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('sendWeeklyRevenueDigest_Waratah')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(8)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      'Trigger Installed',
      'Weekly revenue digest will be sent every Wednesday at 8am.\n\nTo remove: Apps Script editor → Triggers → delete.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}
