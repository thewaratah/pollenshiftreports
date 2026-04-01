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
 * Read NIGHTLY_FINANCIAL and compute this-week vs last-week stats,
 * day-of-week all-time averages, and rolling 4-week comparison.
 *
 * Sakura NIGHTLY_FINANCIAL schema (16 cols A-P):
 *   0=Date, 1=Day, 2=WeekEnding, 3=MOD, 4=NetRevenue, 5=CashTotal,
 *   6=CashTips, 7=TipsTotal, 8=LoggedAt, 9=ProductionAmount,
 *   10=Discounts, 11=Deposit, 12=FOHStaff, 13=BOHStaff, 14=CardTips, 15=SurchargeTips
 *
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
  const tz = 'Australia/Sydney';

  // Parse date helper — returns Date with time zeroed
  var parseDate_ = function(val) {
    if (val instanceof Date) {
      var d = new Date(val);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return parseCellDate_(String(val));
  };

  // Define this week: Mon–Sat of the week just ended
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMon);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  // 4 weeks ago for rolling comparison
  const fourWeeksAgo = new Date(thisMonday);
  fourWeeksAgo.setDate(thisMonday.getDate() - 28);

  // Parse all rows with dates once
  var parsed = rows.map(function(r) {
    return { date: parseDate_(r[0]), row: r };
  }).filter(function(p) { return p.date && !isNaN(p.date.getTime()); });

  var thisWeek = parsed.filter(function(p) { return p.date >= thisMonday && p.date < today; }).map(function(p) { return p.row; });
  var lastWeek = parsed.filter(function(p) { return p.date >= lastMonday && p.date < thisMonday; }).map(function(p) { return p.row; });

  var sum = function(arr, col) { return arr.reduce(function(acc, r) { return acc + (parseFloat(r[col]) || 0); }, 0); };

  var thisRevenue = sum(thisWeek, 4);
  var lastRevenue = sum(lastWeek, 4);
  var thisTips    = sum(thisWeek, 7);

  var revChange = lastRevenue > 0
    ? ((thisRevenue - lastRevenue) / lastRevenue * 100).toFixed(1)
    : null;

  var bestDay = thisWeek.reduce(function(best, r) {
    return (!best || parseFloat(r[4]) > parseFloat(best[4])) ? r : best;
  }, null);

  // === DAY-OF-WEEK ALL-TIME AVERAGES vs THIS WEEK ===
  // Group all historical rows by day-of-week (0=Sun..6=Sat)
  var dowTotals = {};  // { dayNum: { sum: x, count: y } }
  parsed.forEach(function(p) {
    var dow = p.date.getDay();
    if (!dowTotals[dow]) dowTotals[dow] = { sum: 0, count: 0 };
    dowTotals[dow].sum += (parseFloat(p.row[4]) || 0);
    dowTotals[dow].count += 1;
  });

  // Map day names (Sakura operates Mon=1 through Sat=6)
  var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var sakuraDays = [1, 2, 3, 4, 5, 6]; // Mon-Sat

  // Build this week's daily revenue map by day-of-week
  var thisWeekByDow = {};
  thisWeek.forEach(function(r) {
    var d = parseDate_(r[0]);
    if (d) thisWeekByDow[d.getDay()] = parseFloat(r[4]) || 0;
  });

  var dowComparison = sakuraDays.map(function(dow) {
    var allTimeAvg = (dowTotals[dow] && dowTotals[dow].count > 0)
      ? dowTotals[dow].sum / dowTotals[dow].count
      : 0;
    var thisWeekRev = thisWeekByDow[dow] || null; // null = no data yet
    var delta = (thisWeekRev !== null && allTimeAvg > 0)
      ? ((thisWeekRev - allTimeAvg) / allTimeAvg * 100)
      : null;
    return {
      day: dayNames[dow],
      allTimeAvg: allTimeAvg,
      thisWeek: thisWeekRev,
      delta: delta,
      sampleSize: (dowTotals[dow] && dowTotals[dow].count) || 0
    };
  });

  // === ROLLING 4-WEEK COMPARISON ===
  // Split the last 4 weeks into individual weeks
  var rolling4 = [];
  for (var w = 0; w < 4; w++) {
    var weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() - (w * 7));
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    var weekRows = parsed.filter(function(p) {
      return p.date >= weekStart && p.date < weekEnd;
    }).map(function(p) { return p.row; });

    var weekRevenue = sum(weekRows, 4);
    var weekTips = sum(weekRows, 7);
    var daysCount = weekRows.length;

    rolling4.push({
      label: Utilities.formatDate(weekStart, tz, 'dd/MM'),
      revenue: weekRevenue,
      tips: weekTips,
      days: daysCount
    });
  }

  return {
    hasData: thisWeek.length > 0,
    weekStarting: Utilities.formatDate(thisMonday, tz, 'dd/MM/yyyy'),
    daysReported: thisWeek.length,
    thisRevenue: thisRevenue,
    lastRevenue: lastRevenue,
    revChange: revChange,
    thisTips: thisTips,
    bestDay: bestDay ? {
      date: bestDay[0] instanceof Date
        ? Utilities.formatDate(bestDay[0], tz, 'EEE dd/MM')
        : String(bestDay[0]),
      revenue: parseFloat(bestDay[4]) || 0,
      mod: bestDay[3]
    } : null,
    dowComparison: dowComparison,
    rolling4: rolling4
  };
}

/**
 * Build Slack Block Kit blocks for the weekly digest.
 * Sections: Weekly Summary, Day-of-Week Averages, Rolling 4-Week, Best Shift.
 * @param {Object} stats - from computeWeeklyStats_Sakura_
 * @returns {Array} blocks
 */
function buildWeeklyDigestBlocks_Sakura_(stats) {
  if (!stats.hasData) {
    return [
      bk_header('Sakura House — Weekly Digest'),
      bk_section('No shift data found for this week yet. Check the warehouse.')
    ];
  }

  var revChange = parseFloat(stats.revChange);
  var revArrow = stats.revChange === null ? '' :
    revChange >= 0 ? ('+' + stats.revChange + '%') : (stats.revChange + '%');

  var fmtAUD = function(n) {
    if (n === null || n === undefined || isNaN(n)) return 'N/A';
    return '$' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  var blocks = [
    bk_header('Sakura House — Weekly Revenue Digest'),
    bk_context(['Week starting ' + stats.weekStarting + '  ·  ' + stats.daysReported + ' days reported'])
  ];

  // --- WEEKLY SUMMARY ---
  blocks.push(bk_divider());
  blocks.push(bk_fields([
    ['This Week', fmtAUD(stats.thisRevenue)],
    ['vs Last Week', stats.revChange !== null ? revArrow : 'N/A'],
    ['Tips', fmtAUD(stats.thisTips)],
    ['Days', String(stats.daysReported)]
  ]));

  // --- DAY-OF-WEEK AVERAGES (ALL TIME) vs THIS WEEK ---
  if (stats.dowComparison && stats.dowComparison.length > 0) {
    blocks.push(bk_divider());
    blocks.push(bk_section('*Day-of-Week Averages (All Time) vs This Week*'));

    var dowLines = stats.dowComparison.map(function(d) {
      var avgStr = fmtAUD(d.allTimeAvg);
      if (d.thisWeek === null) {
        return '`' + d.day + '`  Avg: ' + avgStr + '  ·  _no data_';
      }
      var actualStr = fmtAUD(d.thisWeek);
      var deltaStr = '';
      if (d.delta !== null) {
        var sign = d.delta >= 0 ? '+' : '';
        deltaStr = '  (' + sign + d.delta.toFixed(0) + '%)';
      }
      return '`' + d.day + '`  Avg: ' + avgStr + '  ·  Actual: ' + actualStr + deltaStr;
    });

    blocks.push(bk_section(dowLines.join('\n')));
  }

  // --- ROLLING 4-WEEK COMPARISON ---
  if (stats.rolling4 && stats.rolling4.length > 0) {
    blocks.push(bk_divider());
    blocks.push(bk_section('*Rolling 4-Week Comparison*'));

    var rollingLines = stats.rolling4.map(function(w, i) {
      var label = i === 0 ? 'This Week' : ('w/c ' + w.label);
      var daysNote = w.days < 6 ? ' (' + w.days + 'd)' : '';
      return '`' + label + '`' + daysNote + '  ' + fmtAUD(w.revenue) + '  ·  Tips: ' + fmtAUD(w.tips);
    });

    blocks.push(bk_section(rollingLines.join('\n')));
  }

  // --- BEST SHIFT ---
  if (stats.bestDay) {
    blocks.push(bk_divider());
    blocks.push(bk_section(
      '*Best shift:*  ' + stats.bestDay.date + ' — ' + fmtAUD(stats.bestDay.revenue) + '  (MOD: ' + stats.bestDay.mod + ')'
    ));
  }

  blocks.push(bk_context(['Sakura House Shift Reports 3.0  ·  Auto-generated weekly digest']));
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
