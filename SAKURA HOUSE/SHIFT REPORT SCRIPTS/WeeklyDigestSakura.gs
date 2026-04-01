/**
 * ============================================================================
 * SAKURA HOUSE — WEEKLY REVENUE DIGEST
 * ============================================================================
 * Posts a weekly revenue performance summary to Slack.
 * Scheduled to run every Monday via time-based trigger.
 *
 * Reads from: NIGHTLY_FINANCIAL in SAKURA_DATA_WAREHOUSE_ID
 * Posts to:   SAKURA_SLACK_WEBHOOK_LIVE
 * @version 1.0.0
 * ============================================================================
 */

/**
 * Main weekly digest function — called by time trigger or manually from menu.
 * Safe to run manually at any time.
 */
function sendWeeklyRevenueDigest_Sakura() {
  const warehouseId = getDataWarehouseId_();
  if (!warehouseId) {
    Logger.log('sendWeeklyRevenueDigest_Sakura: SAKURA_DATA_WAREHOUSE_ID not configured. Skipping.');
    return;
  }

  try {
    const webhook = getSakuraSlackWebhookLive_();
    const stats = computeWeeklyStats_Sakura_(warehouseId);
    const blocks = buildWeeklyDigestBlocks_Sakura_(stats);
    bk_post(webhook, blocks, 'Sakura House — Weekly Revenue Digest');
    Logger.log('Weekly revenue digest sent successfully.');
  } catch (e) {
    notifyError_('sendWeeklyRevenueDigest_Sakura', e);
    Logger.log('sendWeeklyRevenueDigest_Sakura failed: ' + e.message);
    throw e;
  }
}

/** Send to test webhook instead of live */
function sendWeeklyRevenueDigest_Sakura_Test() {
  const warehouseId = getDataWarehouseId_();
  if (!warehouseId) { Logger.log('No warehouse ID.'); return; }
  try {
    const webhook = getSakuraSlackWebhookTest_();
    const stats = computeWeeklyStats_Sakura_(warehouseId);
    const blocks = buildWeeklyDigestBlocks_Sakura_(stats);
    bk_post(webhook, blocks, '[TEST] Sakura House — Weekly Revenue Digest');
  } catch (e) {
    Logger.log('sendWeeklyRevenueDigest_Sakura_Test failed: ' + e.message);
  }
}

/**
 * Read NIGHTLY_FINANCIAL and compute this-week vs last-week stats.
 * "This week" = Mon–Sat ending yesterday.
 * @param {string} warehouseId
 * @returns {Object} stats
 */
function computeWeeklyStats_Sakura_(warehouseId) {
  const warehouse = SpreadsheetApp.openById(warehouseId);
  const sheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
  if (!sheet || sheet.getLastRow() < 2) {
    return { hasData: false };
  }

  const rows = sheet.getDataRange().getValues().slice(1); // skip header

  // Define this week: Mon–Sat of the week just ended
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  // Days since last Monday
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMon);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const thisWeek = rows.filter(function(r) {
    const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
    return d >= thisMonday && d < today;
  });

  const lastWeek = rows.filter(function(r) {
    const d = r[0] instanceof Date ? r[0] : parseCellDate_(String(r[0]));
    return d >= lastMonday && d < thisMonday;
  });

  const sum = function(arr, col) { return arr.reduce(function(acc, r) { return acc + (parseFloat(r[col]) || 0); }, 0); };

  const thisRevenue = sum(thisWeek, 4);   // col E = Net Revenue
  const lastRevenue = sum(lastWeek, 4);
  const thisTips    = sum(thisWeek, 7);   // col H = Tips Total
  const lastTips    = sum(lastWeek, 7);

  const revChange = lastRevenue > 0
    ? ((thisRevenue - lastRevenue) / lastRevenue * 100).toFixed(1)
    : null;

  const bestDay = thisWeek.reduce(function(best, r) {
    return (!best || parseFloat(r[4]) > parseFloat(best[4])) ? r : best;
  }, null);

  return {
    hasData: thisWeek.length > 0,
    weekStarting: Utilities.formatDate(thisMonday, 'Australia/Sydney', 'dd/MM/yyyy'),
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
      revenue: parseFloat(bestDay[4]) || 0,
      mod: bestDay[3]
    } : null
  };
}

/**
 * Build Slack Block Kit blocks for the weekly digest.
 * @param {Object} stats - from computeWeeklyStats_Sakura_
 * @returns {Array} blocks
 */
function buildWeeklyDigestBlocks_Sakura_(stats) {
  if (!stats.hasData) {
    return [
      bk_header('🌸 Sakura House — Weekly Digest'),
      bk_section('No shift data found for this week yet. Check the warehouse.')
    ];
  }

  const revChange = parseFloat(stats.revChange);
  const revArrow = stats.revChange === null ? '' :
    revChange >= 0 ? ('▲ ' + stats.revChange + '%') : ('▼ ' + Math.abs(revChange) + '%');

  const formatAUD = function(n) { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  const blocks = [
    bk_header('🌸 Sakura House — Weekly Revenue Digest'),
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

  blocks.push(bk_context(['Sakura House Shift Reports 3.0 · Auto-generated weekly digest']));
  return blocks;
}

/**
 * Install a Monday morning trigger for the weekly digest.
 * Safe to re-run — removes any existing digest trigger first.
 */
function setupWeeklyDigestTrigger_Sakura() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'sendWeeklyRevenueDigest_Sakura'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('sendWeeklyRevenueDigest_Sakura')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger Installed',
    'Weekly revenue digest will be sent every Monday at 8am.\n\nTo remove: Apps Script editor → Triggers → delete.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
