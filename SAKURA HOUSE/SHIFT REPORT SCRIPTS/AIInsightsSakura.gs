/****************************************************
 * AI INSIGHTS — SAKURA HOUSE SHIFT REPORTS
 *
 * M1 — Shift Summary: generateShiftSummary_Sakura()
 * M2 — Revenue Anomaly Detection: detectRevenueAnomalies_Sakura()
 * M3 — Task Classification: classifyTask_Sakura()
 *
 * All calls use the Claude API (claude-haiku-4-5-20251001) via
 * UrlFetchApp (no Node SDK — GAS sandboxed V8 runtime).
 *
 * Non-blocking: all failures return null/default so the main
 * export pipeline always continues regardless of API status.
 *
 * Credential: ANTHROPIC_API_KEY in Script Properties only.
 * Never hardcoded.
 *
 * @version 1.2.0
 * @updated 2026-03-18
 ****************************************************/


/**
 * Generate a 2-3 sentence AI shift summary for Sakura House.
 *
 * Reads the ANTHROPIC_API_KEY from Script Properties and calls
 * the Claude API (Haiku) with a hospitality-specific prompt.
 * Returns the summary string on success, null on any failure.
 *
 * Input token budget: kept under 2000 tokens by truncating
 * narrative fields to 300 chars each.
 * Output token budget: max_tokens capped at 300.
 *
 * @param {Object} shiftData - Fields extracted from the shift sheet:
 *   {string}  date          - e.g. "18/03/2026"
 *   {string}  day           - e.g. "Tuesday"
 *   {string}  mod           - MOD name
 *   {string}  netRevenue    - e.g. "4250.00"
 *   {string}  cardTips      - e.g. "180.00"
 *   {string}  cashTips      - e.g. "40.00"
 *   {string}  surchargeTips - e.g. "25.00"
 *   {string}  fohStaff      - FOH staff count / names
 *   {string}  bohStaff      - BOH staff count / names
 *   {string}  shiftSummary  - Free-text shift summary
 *   {string}  guestsOfNote  - VIP / guests of note
 *   {string}  goodNotes     - What went well
 *   {string}  issues        - What to improve / issues
 *   {string}  kitchenNotes  - Kitchen notes
 *   {number}  todoCount     - Number of TO-DOs recorded
 * @returns {string|null} AI-generated summary, or null on failure
 */
function generateShiftSummary_Sakura(shiftData) {
  // --- Load API key from Script Properties (never hardcode) ---
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    Logger.log('AI Insights (Sakura): ANTHROPIC_API_KEY not set in Script Properties — skipping.');
    return null;
  }

  // --- Truncate narrative fields to stay under 2000 input tokens ---
  const MAX_FIELD = 300;
  const truncate = (str) => {
    if (!str) return '';
    const s = str.toString().trim();
    return s.length > MAX_FIELD ? s.substring(0, MAX_FIELD) + '...' : s;
  };

  // --- Build prompt ---
  const systemPrompt =
    'You are a shift report assistant for Sakura House, a Japanese restaurant in Sydney. ' +
    'Write a concise 2-3 sentence summary of this shift for management. ' +
    'Be specific about revenue performance, any operational highlights, and key action items. ' +
    'Tone: professional, direct, factual.';

  const userPrompt =
    'Shift data:\n' +
    '- Date: ' + (shiftData.date || 'N/A') + ', Day: ' + (shiftData.day || 'N/A') + '\n' +
    '- MOD: ' + (shiftData.mod || 'N/A') + '\n' +
    '- Net Revenue: $' + (shiftData.netRevenue || '0') + '\n' +
    '- Card Tips: $' + (shiftData.cardTips || '0') +
    ', Cash Tips: $' + (shiftData.cashTips || '0') +
    ', Surcharge Tips: $' + (shiftData.surchargeTips || '0') + '\n' +
    '- FOH Staff: ' + (shiftData.fohStaff || 'N/A') + '\n' +
    '- BOH Staff: ' + (shiftData.bohStaff || 'N/A') + '\n' +
    '- Shift Notes: ' + truncate(shiftData.shiftSummary) + '\n' +
    '- VIP Notes: ' + truncate(shiftData.guestsOfNote) + '\n' +
    '- What went well: ' + truncate(shiftData.goodNotes) + '\n' +
    '- What to improve: ' + truncate(shiftData.issues) + '\n' +
    '- Kitchen Notes: ' + truncate(shiftData.kitchenNotes) + '\n' +
    '- TO-DOs created: ' + (shiftData.todoCount || 0) + '\n\n' +
    'Write the 2-3 sentence summary now. Return plain text only — no headers, no bullet points.';

  // --- Call Claude API via UrlFetchApp ---
  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    const code = response.getResponseCode();

    if (code !== 200) {
      Logger.log(
        'AI Insights (Sakura): Claude API returned HTTP ' + code +
        ' — ' + response.getContentText().substring(0, 300)
      );
      return null;
    }

    const json = JSON.parse(response.getContentText());
    const summary = json.content && json.content[0] && json.content[0].text
      ? json.content[0].text.trim()
      : null;

    if (!summary) {
      Logger.log('AI Insights (Sakura): Unexpected API response shape — content missing.');
      return null;
    }

    Logger.log('AI Insights (Sakura): Summary generated successfully (' + summary.length + ' chars).');
    return summary;

  } catch (e) {
    Logger.log('AI Insights (Sakura): API call failed — ' + e.message);
    return null;
  }
}


// ============================================================================
// M2 — REVENUE ANOMALY DETECTION
// ============================================================================

/**
 * Detect revenue anomalies for Sakura House by comparing today's shift against
 * the last 8 occurrences of the same day of week in the data warehouse.
 *
 * Metrics compared (2-stddev threshold):
 *   - NetRevenue (warehouse col E, index 4)
 *   - TipRatio   (TotalTips / NetRevenue; warehouse col H index 7 for TotalTips)
 *
 * On anomaly: posts a plain-text Slack alert to SAKURA_SLACK_WEBHOOK_TEST.
 * Non-blocking: wrapped in try/catch, never throws.
 *
 * Sakura NIGHTLY_FINANCIAL col indexes (0-based):
 *   A=0 Date, B=1 Day, C=2 WeekEnding, D=3 MOD,
 *   E=4 NetRevenue, F=5 CashTotal, G=6 CashTips, H=7 TipsTotal,
 *   I=8 LoggedAt, J=9 TotalTips (computed), K=10 ProductionAmount,
 *   L=11 Discounts, M=12 Deposit, N=13 FOHStaff, O=14 BOHStaff,
 *   P=15 CardTips, Q=16 SurchargeTips
 *
 * @param {Object} shiftData   - Extracted shift data (from extractShiftData_())
 * @param {string} warehouseId - Spreadsheet ID of the data warehouse
 * @returns {{ anomalyDetected: boolean, details: string[] }}
 */
function detectRevenueAnomalies_Sakura(shiftData, warehouseId) {
  try {
    // --- Minimum data guard ---
    if (!shiftData || !shiftData.netRevenue || !warehouseId) {
      return { anomalyDetected: false, details: [] };
    }

    const todayRevenue = parseFloat(shiftData.netRevenue) || 0;
    const todayTips    = parseFloat(shiftData.totalTips)  || 0;
    const todayDay     = shiftData.dayOfWeek || '';  // e.g. "Tuesday"
    const todayMod     = shiftData.mod || 'Unknown';

    if (todayRevenue <= 0) {
      Logger.log('M2 Anomaly (Sakura): netRevenue is 0 — skipping anomaly check.');
      return { anomalyDetected: false, details: [] };
    }

    // --- Read warehouse NIGHTLY_FINANCIAL ---
    const warehouse      = SpreadsheetApp.openById(warehouseId);
    const financialSheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
    if (!financialSheet || financialSheet.getLastRow() < 2) {
      Logger.log('M2 Anomaly (Sakura): NIGHTLY_FINANCIAL empty or missing — insufficient data.');
      return { anomalyDetected: false, details: [] };
    }

    const lastRow  = financialSheet.getLastRow();
    const allRows  = financialSheet.getRange(2, 1, lastRow - 1, 17).getValues();

    // Filter rows matching today's day of week (col B, index 1); exclude today's own row
    const todayDateKey = shiftData.date instanceof Date ? shiftData.date.toDateString() : '';
    const sameDay = allRows.filter(function(row) {
      const rowDay     = (row[1] || '').toString().trim();
      const rowDateRaw = row[0];
      const rowDateKey = rowDateRaw instanceof Date ? rowDateRaw.toDateString() : '';
      return rowDay === todayDay && rowDateKey !== todayDateKey;
    });

    // Take the last 8 matching rows (chronological tail)
    const history = sameDay.slice(-8);

    if (history.length < 4) {
      Logger.log(
        'M2 Anomaly (Sakura): only ' + history.length +
        ' historical rows for ' + todayDay + ' — need ≥4. Skipping.'
      );
      return { anomalyDetected: false, details: [] };
    }

    // --- Statistical helpers ---
    function mean_(arr) {
      return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
    }
    function stddev_(arr, m) {
      var variance = arr.reduce(function(s, v) { return s + Math.pow(v - m, 2); }, 0) / arr.length;
      return Math.sqrt(variance);
    }

    // --- NetRevenue stats ---
    var historicRevenues = history.map(function(row) { return parseFloat(row[4]) || 0; });
    var revMean   = mean_(historicRevenues);
    var revStddev = stddev_(historicRevenues, revMean);

    // --- TipRatio stats ---
    var historicRatios = history.map(function(row) {
      var rev  = parseFloat(row[4]) || 0;
      var tips = parseFloat(row[7]) || 0;  // H = TipsTotal (index 7)
      return rev > 0 ? tips / rev : 0;
    });
    var ratioMean   = mean_(historicRatios);
    var ratioStddev = stddev_(historicRatios, ratioMean);

    var todayRatio = todayRevenue > 0 ? todayTips / todayRevenue : 0;

    // --- Anomaly detection (>2 stddev) ---
    var anomalies = [];

    var revZScore = revStddev > 0 ? Math.abs(todayRevenue - revMean) / revStddev : 0;
    if (revZScore > 2) {
      var pct     = revMean > 0 ? Math.round(((todayRevenue - revMean) / revMean) * 100) : 0;
      var dir     = todayRevenue > revMean ? 'above' : 'below';
      var meanFmt = '$' + revMean.toFixed(0);
      var todayFmt = '$' + todayRevenue.toFixed(0);
      anomalies.push(
        'Revenue anomaly: Sakura ' + todayDay + ' revenue ' + todayFmt +
        ' is ' + Math.abs(pct) + '% ' + dir + ' 8-week average (' + meanFmt + ').'
      );
    }

    var ratioZScore = ratioStddev > 0 ? Math.abs(todayRatio - ratioMean) / ratioStddev : 0;
    if (ratioZScore > 2) {
      var pctRatio    = ratioMean > 0 ? Math.round(((todayRatio - ratioMean) / ratioMean) * 100) : 0;
      var dirRatio    = todayRatio > ratioMean ? 'above' : 'below';
      anomalies.push(
        'Tip ratio anomaly: Sakura ' + todayDay + ' tip ratio ' +
        (todayRatio * 100).toFixed(1) + '% is ' + Math.abs(pctRatio) + '% ' +
        dirRatio + ' 8-week average (' + (ratioMean * 100).toFixed(1) + '%).'
      );
    }

    // --- Post Slack alert if anomaly found ---
    if (anomalies.length > 0) {
      var webhook = PropertiesService.getScriptProperties().getProperty('SAKURA_SLACK_WEBHOOK_TEST');
      if (webhook) {
        var text = ':warning: Unusual shift — ' + anomalies.join(' | ') + ' MOD: ' + todayMod + '.';
        try {
          var resp = UrlFetchApp.fetch(webhook, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({ text: text }),
            muteHttpExceptions: true
          });
          var code = resp.getResponseCode();
          if (code < 200 || code >= 300) {
            Logger.log('M2 Anomaly (Sakura): Slack POST failed HTTP ' + code);
          } else {
            Logger.log('M2 Anomaly (Sakura): Slack alert posted — ' + text);
          }
        } catch (slackErr) {
          Logger.log('M2 Anomaly (Sakura): Slack post error — ' + slackErr.message);
        }
      } else {
        Logger.log('M2 Anomaly (Sakura): SAKURA_SLACK_WEBHOOK_TEST not set — alert logged only: ' + anomalies.join(' | '));
      }
      return { anomalyDetected: true, details: anomalies };
    }

    Logger.log('M2 Anomaly (Sakura): no anomalies detected for ' + todayDay + '.');
    return { anomalyDetected: false, details: [] };

  } catch (e) {
    Logger.log('M2 Anomaly (Sakura): error (non-blocking) — ' + e.message);
    return { anomalyDetected: false, details: [] };
  }
}


// ============================================================================
// M3 — AI TASK CLASSIFICATION
// ============================================================================

/**
 * Classify a single task description using Claude Haiku.
 *
 * Returns a structured object with priority, area, and due-date offset.
 * Returns null on any failure — callers must treat null as "use defaults".
 *
 * Model: claude-haiku-4-5-20251001 (fast + cheap; 60 output tokens max)
 * Credential: ANTHROPIC_API_KEY in Script Properties only — never hardcoded.
 *
 * @param {string} taskDescription - Free-text task from the shift report TO-DO list
 * @returns {{ priority: string, area: string, dueDaysOffset: number }|null}
 *   priority:     'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
 *   area:         'FOH' | 'BOH' | 'Kitchen' | 'Management' | 'General'
 *   dueDaysOffset: 0 (today) | 1 (tomorrow) | 3 (within 3 days) | 7 (within a week)
 */
function classifyTask_Sakura(taskDescription) {
  try {
    // --- Guard: need API key and a non-empty description ---
    const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) {
      Logger.log('M3 Classify (Sakura): ANTHROPIC_API_KEY not set — skipping.');
      return null;
    }
    if (!taskDescription || !taskDescription.toString().trim()) {
      return null;
    }

    const systemPrompt =
      'You are a hospitality operations classifier. Respond with ONLY valid JSON, no markdown.';

    const userPrompt =
      'Classify this restaurant task: "' + taskDescription.toString().trim() + '"\n' +
      'Return: {"priority":"URGENT|HIGH|MEDIUM|LOW","area":"FOH|BOH|Kitchen|Management|General","dueDaysOffset":0|1|3|7}\n' +
      'Guidelines: URGENT=safety/broken equipment blocking service, HIGH=customer complaints/revenue impact, ' +
      'MEDIUM=maintenance/improvements, LOW=nice-to-have. ' +
      'dueDaysOffset: 0=today, 1=tomorrow, 3=within 3 days, 7=within a week.';

    const payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    const code = response.getResponseCode();

    if (code !== 200) {
      Logger.log(
        'M3 Classify (Sakura): Claude API returned HTTP ' + code +
        ' — ' + response.getContentText().substring(0, 200)
      );
      return null;
    }

    const json = JSON.parse(response.getContentText());
    const raw  = json.content && json.content[0] && json.content[0].text
      ? json.content[0].text.trim()
      : null;

    if (!raw) {
      Logger.log('M3 Classify (Sakura): Empty response from API.');
      return null;
    }

    // Strip any accidental markdown fences before parsing
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result  = JSON.parse(cleaned);

    // Validate expected keys are present
    const validPriorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
    const validAreas      = ['FOH', 'BOH', 'Kitchen', 'Management', 'General'];
    const validOffsets    = [0, 1, 3, 7];

    const priority     = validPriorities.includes(result.priority)     ? result.priority     : null;
    const area         = validAreas.includes(result.area)              ? result.area         : null;
    const dueDaysOffset = validOffsets.includes(result.dueDaysOffset)  ? result.dueDaysOffset : null;

    if (!priority || !area || dueDaysOffset === null) {
      Logger.log('M3 Classify (Sakura): Invalid classification values — ' + raw);
      return null;
    }

    Logger.log(
      'M3 Classify (Sakura): "' + taskDescription.substring(0, 60) + '" → ' +
      priority + ' / ' + area + ' / +' + dueDaysOffset + ' days'
    );
    return { priority: priority, area: area, dueDaysOffset: dueDaysOffset };

  } catch (e) {
    Logger.log('M3 Classify (Sakura): error (non-blocking) — ' + e.message);
    return null;
  }
}


// ============================================================================
// M4 — SHIFT ANALYTICS (PHASE 1): computeShiftAnalytics_Sakura
// ============================================================================

/**
 * Compute pre-calculated analytics for today's shift against the warehouse
 * history (same day-of-week, up to 8 trailing occurrences).
 *
 * Pure GAS math — NO Claude API calls. Non-blocking: returns
 * { hasSufficientData: false } on any error or insufficient history.
 *
 * Sakura NIGHTLY_FINANCIAL col indexes (0-based, 17 cols A-Q):
 *   A=0 Date, B=1 Day, C=2 WeekEnding, D=3 MOD,
 *   E=4 NetRevenue, F=5 CashTotal, G=6 CashTips, H=7 TipsTotal,
 *   I=8 LoggedAt, J=9 TotalTips (computed), K=10 ProductionAmount,
 *   L=11 Discounts, M=12 Deposit, N=13 FOHStaff, O=14 BOHStaff,
 *   P=15 CardTips, Q=16 SurchargeTips
 *
 * Column constants used for index access:
 *   date=0, day=1, netRevenue=4, totalTips=7 (H=TipsTotal, consistent with M2),
 *   production=10, discounts=11
 *
 * @param {Object} shiftData   - Extracted shift data (from NightlyExport caller)
 *   {string} shiftData.netRevenue    - e.g. "4250.00"
 *   {string} shiftData.cardTips      - e.g. "180.00"
 *   {string} shiftData.cashTips      - e.g. "40.00"
 *   {string} shiftData.surchargeTips - e.g. "25.00"
 *   {string} shiftData.date          - e.g. "18/03/2026" (DD/MM/YYYY string)
 *   {string} shiftData.day           - e.g. "Tuesday" (from NightlyExport path)
 *   {string} shiftData.dayOfWeek     - e.g. "Tuesday" (from extractShiftData_ path)
 *   {string} shiftData.mod           - MOD name
 *   {number} shiftData.productionAmount - production cost (may be numeric)
 * @param {string} warehouseId - Spreadsheet ID of the data warehouse
 * @returns {Object} Analytics result object, or { hasSufficientData: false }
 */
function computeShiftAnalytics_Sakura(shiftData, warehouseId) {
  // Column index map (0-based) — matches M2 and warehouse append order exactly
  var COLS = { date: 0, day: 1, netRevenue: 4, tipsTotal: 7, production: 10, discounts: 11 };

  try {
    // --- Input guards ---
    if (!shiftData || !shiftData.netRevenue || !warehouseId) {
      Logger.log('M4 Analytics (Sakura): missing shiftData or warehouseId — skipping.');
      return { hasSufficientData: false };
    }

    var todayRevenue    = parseFloat(shiftData.netRevenue) || 0;
    var todayCardTips   = parseFloat(shiftData.cardTips)      || 0;
    var todayCashTips   = parseFloat(shiftData.cashTips)      || 0;
    var todaySurchTips  = parseFloat(shiftData.surchargeTips) || 0;
    var todayTips       = todayCardTips + todayCashTips + todaySurchTips;
    var todayProduction = parseFloat(shiftData.productionAmount) || 0;
    // Accept either shiftData.day (NightlyExport) or shiftData.dayOfWeek (extractShiftData_)
    var todayDay        = (shiftData.day || shiftData.dayOfWeek || '').toString().trim();
    var todayMod        = (shiftData.mod || 'Unknown').toString().trim();

    if (todayRevenue <= 0 || !todayDay) {
      Logger.log('M4 Analytics (Sakura): revenue=0 or day missing — skipping.');
      return { hasSufficientData: false };
    }

    // Parse today's date from DD/MM/YYYY string for exclusion matching
    var todayDateObj = null;
    try {
      var rawDate = (shiftData.date || '').toString().trim();
      if (rawDate) {
        todayDateObj = Utilities.parseDate(rawDate, 'Australia/Sydney', 'dd/MM/yyyy');
      }
    } catch (dateErr) {
      Logger.log('M4 Analytics (Sakura): could not parse shiftData.date "' + shiftData.date + '" — ' + dateErr.message);
    }
    var todayDateKey = todayDateObj ? todayDateObj.toDateString() : '';

    // --- Read warehouse NIGHTLY_FINANCIAL ---
    var warehouse      = SpreadsheetApp.openById(warehouseId);
    var financialSheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
    if (!financialSheet || financialSheet.getLastRow() < 2) {
      Logger.log('M4 Analytics (Sakura): NIGHTLY_FINANCIAL empty or missing.');
      return { hasSufficientData: false };
    }

    var lastRow = financialSheet.getLastRow();
    var allRows = financialSheet.getRange(2, 1, lastRow - 1, 17).getValues();

    // Filter: same day-of-week, exclude today's own row
    var sameDay = allRows.filter(function(row) {
      var rowDay     = (row[COLS.day] || '').toString().trim();
      var rowDateRaw = row[COLS.date];
      var rowDateKey = rowDateRaw instanceof Date ? rowDateRaw.toDateString() : '';
      return rowDay === todayDay && (todayDateKey === '' || rowDateKey !== todayDateKey);
    });

    // Last 8 same-day rows (chronological tail) for full trailing window
    var history  = sameDay.slice(-8);
    // Last 4 for the 4-week trailing window
    var history4 = sameDay.slice(-4);

    if (history4.length < 4) {
      Logger.log(
        'M4 Analytics (Sakura): only ' + sameDay.length + ' historical rows for ' +
        todayDay + ' — need ≥4. Skipping.'
      );
      return { hasSufficientData: false };
    }

    // =========================================================
    // Statistical helper functions (inner — no outer scope leak)
    // =========================================================
    function mean_(arr) {
      return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
    }

    function stddev_(arr, m) {
      var variance = arr.reduce(function(s, v) { return s + Math.pow(v - m, 2); }, 0) / arr.length;
      return Math.sqrt(variance);
    }

    /**
     * Ordinary least-squares slope over an array of values (0-indexed positions).
     * Returns $/week change across the series.
     */
    function linearSlope_(values) {
      var n = values.length;
      if (n < 2) return 0;
      var sumI  = 0, sumY = 0, sumIY = 0, sumI2 = 0;
      for (var i = 0; i < n; i++) {
        sumI  += i;
        sumY  += values[i];
        sumIY += i * values[i];
        sumI2 += i * i;
      }
      var denom = n * sumI2 - sumI * sumI;
      return denom !== 0 ? (n * sumIY - sumI * sumY) / denom : 0;
    }

    function percentChange_(current, baseline) {
      if (!baseline || baseline === 0) return null;
      return (current - baseline) / baseline * 100;
    }

    function rankInHistory_(todayValue, historicValues) {
      // Rank 1 = highest. Sort descending, find first position where value <= today.
      var sorted = historicValues.slice().sort(function(a, b) { return b - a; });
      var rank = 1;
      for (var i = 0; i < sorted.length; i++) {
        if (sorted[i] > todayValue) rank++;
      }
      return { rank: rank, total: historicValues.length + 1 }; // +1 to include today
    }

    // =========================================================
    // Extract metric arrays from history rows
    // =========================================================
    var histRevenues8  = history.map(function(row)  { return parseFloat(row[COLS.netRevenue]) || 0; });
    var histTips8      = history.map(function(row)  { return parseFloat(row[COLS.tipsTotal]) || 0; });
    var histProd8      = history.map(function(row)  { return parseFloat(row[COLS.production]) || 0; });
    var histRevenues4  = history4.map(function(row) { return parseFloat(row[COLS.netRevenue]) || 0; });
    var histTips4      = history4.map(function(row) { return parseFloat(row[COLS.tipsTotal]) || 0; });

    // Tip ratios
    var histRatios8 = history.map(function(row) {
      var rev  = parseFloat(row[COLS.netRevenue]) || 0;
      var tips = parseFloat(row[COLS.tipsTotal])  || 0;
      return rev > 0 ? tips / rev : 0;
    });
    var histRatios4 = history4.map(function(row) {
      var rev  = parseFloat(row[COLS.netRevenue]) || 0;
      var tips = parseFloat(row[COLS.tipsTotal])  || 0;
      return rev > 0 ? tips / rev : 0;
    });

    // =========================================================
    // Compute trailing benchmarks
    // =========================================================
    var revMean8   = mean_(histRevenues8);
    var revStddev8 = stddev_(histRevenues8, revMean8);
    var tipRatioMean8   = mean_(histRatios8);
    var productionMean8 = mean_(histProd8);

    var revMean4      = mean_(histRevenues4);
    var tipRatioMean4 = mean_(histRatios4);

    // =========================================================
    // Week-over-week (compare today vs most recent same-day row)
    // =========================================================
    var lastWeekRow     = history[history.length - 1];
    var lastWeekRevenue = lastWeekRow ? (parseFloat(lastWeekRow[COLS.netRevenue]) || 0) : 0;
    var wowDeltaAbs     = todayRevenue - lastWeekRevenue;
    var wowDeltaPct     = percentChange_(todayRevenue, lastWeekRevenue);

    // Format last-week date as DD/MM/YYYY for readability
    var lastWeekDateRaw = lastWeekRow ? lastWeekRow[COLS.date] : null;
    var lastWeekDateStr = '';
    if (lastWeekDateRaw instanceof Date) {
      var lwd = lastWeekDateRaw;
      lastWeekDateStr = (
        ('0' + lwd.getDate()).slice(-2) + '/' +
        ('0' + (lwd.getMonth() + 1)).slice(-2) + '/' +
        lwd.getFullYear()
      );
    }

    // =========================================================
    // Trend: linear slope across 8-week revenue series
    // =========================================================
    var slope = linearSlope_(histRevenues8);
    var trendThreshold = revMean8 * 0.005; // 0.5% of mean per week
    var trendDirection = slope > trendThreshold ? 'rising' : slope < -trendThreshold ? 'falling' : 'flat';

    // =========================================================
    // Attribution: production share delta
    // =========================================================
    var todayProdShare  = todayRevenue > 0 ? todayProduction / todayRevenue : 0;
    var avgProdShare8   = revMean8 > 0 ? productionMean8 / revMean8 : 0;
    var prodShareDelta  = todayProdShare - avgProdShare8;  // positive = costs grew faster

    var attributionDesc;
    if (Math.abs(prodShareDelta) <= 0.01) {
      attributionDesc = 'proportional';
    } else if (prodShareDelta > 0) {
      attributionDesc = 'cost-driven';       // production growing faster than revenue
    } else {
      attributionDesc = 'volume-driven';     // revenue growing faster than production
    }

    // =========================================================
    // Comparables: best, worst, today's rank from 8-week history
    // =========================================================
    var bestRow   = null;
    var worstRow  = null;
    var bestRev   = -Infinity;
    var worstRev  = Infinity;

    history.forEach(function(row) {
      var rev = parseFloat(row[COLS.netRevenue]) || 0;
      if (rev > bestRev)  { bestRev  = rev;  bestRow  = row; }
      if (rev < worstRev) { worstRev = rev;  worstRow = row; }
    });

    function formatRowDate_(row) {
      if (!row) return 'N/A';
      var d = row[COLS.date];
      if (!(d instanceof Date)) return 'N/A';
      return ('0' + d.getDate()).slice(-2) + '/' +
             ('0' + (d.getMonth() + 1)).slice(-2) + '/' +
             d.getFullYear();
    }

    var rankResult = rankInHistory_(todayRevenue, histRevenues8);

    // =========================================================
    // Anomaly detection (mirrors M2 logic, structured output)
    // =========================================================
    var todayTipRatio = todayRevenue > 0 ? todayTips / todayRevenue : 0;

    var ratioMean8   = mean_(histRatios8);
    var ratioStddev8 = stddev_(histRatios8, ratioMean8);

    var revZScore    = revStddev8 > 0 ? (todayRevenue - revMean8) / revStddev8 : 0;
    var ratioZScore  = ratioStddev8 > 0 ? (todayTipRatio - ratioMean8) / ratioStddev8 : 0;

    var revAnomalyPct   = percentChange_(todayRevenue, revMean8);
    var ratioAnomalyPct = percentChange_(todayTipRatio, ratioMean8);

    // =========================================================
    // Build and return result object
    // =========================================================
    return {
      hasSufficientData: true,
      dataWeeks:         history.length,

      today: {
        revenue:    todayRevenue,
        tips:       todayTips,
        tipRatio:   todayTipRatio * 100,   // stored as % (e.g. 4.2)
        production: todayProduction,
        day:        todayDay,
        date:       (shiftData.date || '').toString().trim(),
        mod:        todayMod
      },

      trailing8w: {
        revenueMean:    revMean8,
        revenueStddev:  revStddev8,
        tipRatioMean:   tipRatioMean8 * 100,   // as %
        productionMean: productionMean8
      },

      trailing4w: {
        revenueMean:  revMean4,
        tipRatioMean: tipRatioMean4 * 100      // as %
      },

      weekOverWeek: {
        lastWeekDate:    lastWeekDateStr,
        lastWeekRevenue: lastWeekRevenue,
        deltaAbs:        wowDeltaAbs,
        deltaPct:        wowDeltaPct !== null ? parseFloat(wowDeltaPct.toFixed(1)) : null
      },

      trend: {
        direction:    trendDirection,
        slopePerWeek: slope
      },

      attribution: {
        productionShareDelta: parseFloat((prodShareDelta * 100).toFixed(2)),  // as % points
        description:          attributionDesc
      },

      comparables: {
        best:  { date: formatRowDate_(bestRow),  revenue: bestRev  === -Infinity ? 0 : bestRev  },
        worst: { date: formatRowDate_(worstRow), revenue: worstRev === Infinity  ? 0 : worstRev },
        rank:  rankResult.rank,
        total: rankResult.total
      },

      anomalies: {
        revenueAnomaly: {
          detected:  Math.abs(revZScore) > 2,
          zScore:    parseFloat(revZScore.toFixed(2)),
          deltaPct:  revAnomalyPct !== null ? parseFloat(revAnomalyPct.toFixed(1)) : null,
          direction: todayRevenue >= revMean8 ? 'above' : 'below'
        },
        tipRatioAnomaly: {
          detected:  Math.abs(ratioZScore) > 2,
          zScore:    parseFloat(ratioZScore.toFixed(2)),
          deltaPct:  ratioAnomalyPct !== null ? parseFloat(ratioAnomalyPct.toFixed(1)) : null,
          direction: todayTipRatio >= ratioMean8 ? 'above' : 'below'
        }
      }
    };

  } catch (e) {
    Logger.log('M4 Analytics (Sakura): error (non-blocking) — ' + e.message);
    return { hasSufficientData: false };
  }
}


// ============================================================================
// M4 — SHIFT ANALYTICS (PHASE 2): generateShiftInsight_Sakura
// ============================================================================

/**
 * Generate a management-grade AI shift insight for Sakura House using
 * pre-computed analytics from computeShiftAnalytics_Sakura.
 *
 * If analytics is null or analytics.hasSufficientData is false, falls back
 * to calling generateShiftSummary_Sakura(shiftData) and returns its result.
 *
 * On success returns a plain-text string with three labelled sections:
 *   PERFORMANCE: ...
 *   TREND: ...
 *   ACTION: ...
 *
 * Non-blocking: returns null on any API failure (main export always proceeds).
 *
 * Model: claude-haiku-4-5-20251001 (Haiku, max_tokens 300)
 * Credential: ANTHROPIC_API_KEY in Script Properties only — never hardcoded.
 *
 * @param {Object}      shiftData - Shift data object (same shape as M1)
 * @param {Object|null} analytics - Output of computeShiftAnalytics_Sakura, or null
 * @returns {string|null} Insight text, or null on failure
 */
function generateShiftInsight_Sakura(shiftData, analytics) {
  // --- Fallback: insufficient data or analytics not computed ---
  if (!analytics || !analytics.hasSufficientData) {
    Logger.log('M4 Insight (Sakura): analytics unavailable — falling back to generateShiftSummary_Sakura.');
    return generateShiftSummary_Sakura(shiftData);
  }

  // --- Load API key ---
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    Logger.log('M4 Insight (Sakura): ANTHROPIC_API_KEY not set — falling back to generateShiftSummary_Sakura.');
    return generateShiftSummary_Sakura(shiftData);
  }

  try {
    // --- Truncate narrative fields (same guard as M1) ---
    var MAX_FIELD = 300;
    var truncate  = function(str) {
      if (!str) return '';
      var s = str.toString().trim();
      return s.length > MAX_FIELD ? s.substring(0, MAX_FIELD) + '...' : s;
    };

    var t8   = analytics.trailing8w;
    var wow  = analytics.weekOverWeek;
    var comp = analytics.comparables;
    var anom = analytics.anomalies;
    var tod  = analytics.today;
    var tr   = analytics.trend;

    // Compute variance % against 8w mean for the prompt
    var variancePct = t8.revenueMean > 0
      ? ((tod.revenue - t8.revenueMean) / t8.revenueMean * 100).toFixed(1)
      : '0.0';
    var varianceDir = tod.revenue >= t8.revenueMean ? 'above average' : 'below average';

    // Week-over-week text
    var wowPctStr = wow.deltaPct !== null ? wow.deltaPct.toFixed(1) : 'N/A';

    // --- Build anomaly section (only included if either anomaly fires) ---
    var anomalySection = '';
    if (anom.revenueAnomaly.detected || anom.tipRatioAnomaly.detected) {
      anomalySection = '\nANOMALIES DETECTED:';
      if (anom.revenueAnomaly.detected) {
        var revDeltaStr = anom.revenueAnomaly.deltaPct !== null
          ? Math.abs(anom.revenueAnomaly.deltaPct).toFixed(1) + '%'
          : 'significantly';
        anomalySection +=
          '\n- Revenue is ' + revDeltaStr + ' ' + anom.revenueAnomaly.direction +
          ' the ' + analytics.dataWeeks + '-week average (z-score: ' +
          anom.revenueAnomaly.zScore.toFixed(1) + ')';
      }
      if (anom.tipRatioAnomaly.detected) {
        var ratioDeltaStr = anom.tipRatioAnomaly.deltaPct !== null
          ? Math.abs(anom.tipRatioAnomaly.deltaPct).toFixed(1) + '%'
          : 'significantly';
        anomalySection +=
          '\n- Tip ratio is ' + ratioDeltaStr + ' ' + anom.tipRatioAnomaly.direction +
          ' the ' + analytics.dataWeeks + '-week average (z-score: ' +
          anom.tipRatioAnomaly.zScore.toFixed(1) + ')';
      }
    }

    // --- System prompt ---
    var systemPrompt =
      'You are a hospitality financial analyst for Sakura House, a Japanese restaurant in Sydney ' +
      'operating Mon-Sat. You receive pre-calculated metrics alongside raw shift notes. ' +
      'Your role is to INTERPRET the numbers (not recalculate them) and produce actionable management insights.\n\n' +
      'Output format (plain text, no markdown):\n' +
      'PERFORMANCE: [1 sentence on revenue vs benchmark, with specific $ and % figures from the metrics provided]\n' +
      'TREND: [1 sentence on the multi-week trend direction and what it means operationally]\n' +
      'ACTION: [1 sentence — the single most important thing management should focus on tomorrow, based on the data]\n\n' +
      'Rules:\n' +
      '- Every claim must reference a specific number from the metrics provided\n' +
      '- If a metric shows "insufficient data", say so — do not invent benchmarks\n' +
      '- Use confidence qualifiers: "high confidence" (8+ weeks data), "moderate" (4-7 weeks), "low" (<4 weeks)\n' +
      '- If ANOMALIES DETECTED section is present, PERFORMANCE must acknowledge the anomaly\n' +
      '- Anomalies with z-score > 3 should be flagged as "significant outlier — verify data accuracy before acting"\n' +
      '- Do not repeat raw shift notes — focus on what the NUMBERS reveal';

    // --- User prompt ---
    var userPrompt =
      'SHIFT CONTEXT:\n' +
      'Date: ' + tod.date + ', Day: ' + tod.day + ', MOD: ' + tod.mod + '\n\n' +

      'TODAY\'S NUMBERS:\n' +
      'Net Revenue: $' + tod.revenue.toFixed(0) +
      ' | Tips: $' + tod.tips.toFixed(0) +
      ' (' + tod.tipRatio.toFixed(1) + '% of revenue)' +
      ' | Production: $' + tod.production.toFixed(0) + '\n\n' +

      'BENCHMARKS (same ' + tod.day + ', ' + analytics.dataWeeks + '-week trailing):\n' +
      'Revenue avg: $' + t8.revenueMean.toFixed(0) +
      ' (stddev: $' + t8.revenueStddev.toFixed(0) + ')\n' +
      'Revenue vs avg: ' + variancePct + '% (' + varianceDir + ')\n' +
      'Tip ratio avg: ' + t8.tipRatioMean.toFixed(1) + '%\n' +
      'Week-over-week: ' + wowPctStr + '%\n\n' +

      'TREND: Revenue over ' + analytics.dataWeeks + ' weeks: ' + tr.direction +
      ' ($' + tr.slopePerWeek.toFixed(0) + '/week)\n' +

      'RANKING: Today ranks #' + comp.rank + ' of ' + comp.total + ' recent ' + tod.day + 's\n' +
      'Best: ' + comp.best.date + ' at $' + comp.best.revenue.toFixed(0) +
      ' | Worst: ' + comp.worst.date + ' at $' + comp.worst.revenue.toFixed(0) +
      '\n' +

      anomalySection +

      '\n\nOPERATIONAL NOTES (context only — do not summarize these):\n' +
      '- Shift notes: ' + truncate(shiftData.shiftSummary) + '\n' +
      '- Issues: ' + truncate(shiftData.issues) + '\n\n' +

      'Write PERFORMANCE, TREND, and ACTION now.';

    // --- Call Claude API (same pattern as M1/M3) ---
    var payload = {
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }]
    };

    var options = {
      method:          'post',
      contentType:     'application/json',
      headers: {
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01'
      },
      payload:          JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var code     = response.getResponseCode();

    if (code !== 200) {
      Logger.log(
        'M4 Insight (Sakura): Claude API returned HTTP ' + code +
        ' — ' + response.getContentText().substring(0, 300)
      );
      return null;
    }

    var json    = JSON.parse(response.getContentText());
    var insight = json.content && json.content[0] && json.content[0].text
      ? json.content[0].text.trim()
      : null;

    if (!insight) {
      Logger.log('M4 Insight (Sakura): Unexpected API response shape — content missing.');
      return null;
    }

    Logger.log('M4 Insight (Sakura): Insight generated successfully (' + insight.length + ' chars).');
    return insight;

  } catch (e) {
    Logger.log('M4 Insight (Sakura): error (non-blocking) — ' + e.message);
    return null;
  }
}


// ============================================================================
// M6 — SOFT LAUNCH ROUTING: deliverAIInsights_Sakura
// ============================================================================

/**
 * Route upgraded AI insights based on AI_INSIGHTS_MODE Script Property.
 *
 * - 'live':      Returns the insight string for team email/Slack.
 * - 'evan_only': Sends insight to Evan via separate email + TEST Slack,
 *                returns null so team gets the old generic summary.
 * - not set:     Same as 'evan_only' (safe default).
 *
 * Non-blocking: all delivery failures are logged, never thrown.
 *
 * @param {string|null} insight  - The upgraded insight text from generateShiftInsight_Sakura
 * @param {string}      shiftDate - Date string for subject line (e.g. "18/03/2026")
 * @returns {string|null} The insight if mode='live', null otherwise
 */
function deliverAIInsights_Sakura(insight, shiftDate) {
  var mode = PropertiesService.getScriptProperties().getProperty('AI_INSIGHTS_MODE') || 'evan_only';

  if (mode === 'live') {
    return insight;
  }

  // --- evan_only mode: send separately to Evan ---
  if (!insight) return null;

  // 1. Email to Evan
  var evanEmail = PropertiesService.getScriptProperties().getProperty('AI_INSIGHTS_EVAN_EMAIL');
  if (evanEmail) {
    try {
      MailApp.sendEmail({
        to: evanEmail,
        subject: 'Sakura House AI Insights: ' + shiftDate,
        htmlBody: '<h3>Sakura House Shift Insights — ' + shiftDate + '</h3>' +
                  '<pre style="font-family:monospace;white-space:pre-wrap;background:#f5f5f5;padding:12px;border-left:4px solid #e60026;">' +
                  insight + '</pre>' +
                  '<p style="color:#888;font-size:12px;">Soft launch — only you receive this. Set AI_INSIGHTS_MODE=live in Script Properties to send to team.</p>'
      });
      Logger.log('M6 Route (Sakura): evan_only email sent to ' + evanEmail);
    } catch (e) {
      Logger.log('M6 Route (Sakura): evan_only email failed — ' + e.message);
    }
  }

  // 2. Post to TEST Slack webhook (already Evan-only)
  var testWebhook = PropertiesService.getScriptProperties().getProperty('SAKURA_SLACK_WEBHOOK_TEST');
  if (testWebhook) {
    try {
      UrlFetchApp.fetch(testWebhook, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          text: ':chart_with_upwards_trend: *Sakura House AI Insights* (' + shiftDate + ')\n' + insight
        }),
        muteHttpExceptions: true
      });
      Logger.log('M6 Route (Sakura): evan_only Slack posted to TEST webhook.');
    } catch (e) {
      Logger.log('M6 Route (Sakura): evan_only Slack failed — ' + e.message);
    }
  }

  // Return null — team email/Slack gets OLD generic summary
  return null;
}


// ============================================================================
// M7 — INSIGHT LOGGING: logInsightToWarehouse_Sakura
// ============================================================================

/**
 * Append a row to AI_INSIGHTS_LOG in the data warehouse.
 * Creates the sheet with headers on first use.
 * Non-blocking: all errors are logged, never thrown.
 *
 * @param {Object} analytics   - Return from computeShiftAnalytics_Sakura (or null)
 * @param {string} insightText - The generated insight text (or null)
 */
function logInsightToWarehouse_Sakura(analytics, insightText) {
  try {
    var warehouseId = getDataWarehouseId_();
    if (!warehouseId || !insightText) return;

    var warehouse = SpreadsheetApp.openById(warehouseId);
    var logSheet = warehouse.getSheetByName('AI_INSIGHTS_LOG');

    // Auto-create sheet with headers on first use
    if (!logSheet) {
      logSheet = warehouse.insertSheet('AI_INSIGHTS_LOG');
      logSheet.appendRow(['Date', 'Day', 'Venue', 'InsightText', 'RevenueVsBenchmarkPct', 'TrendDirection', 'AnomalyDetected', 'LoggedAt']);
      logSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      Logger.log('M7 Log (Sakura): AI_INSIGHTS_LOG sheet created with headers.');
    }

    var revVsBenchmark = '';
    var trendDir = '';
    var anomalyDetected = false;
    if (analytics && analytics.hasSufficientData) {
      revVsBenchmark = analytics.weekOverWeek && analytics.weekOverWeek.deltaPct != null
        ? analytics.weekOverWeek.deltaPct.toFixed(1)
        : '';
      trendDir = analytics.trend ? analytics.trend.direction : '';
      anomalyDetected = (analytics.anomalies && (
        (analytics.anomalies.revenueAnomaly && analytics.anomalies.revenueAnomaly.detected) ||
        (analytics.anomalies.tipRatioAnomaly && analytics.anomalies.tipRatioAnomaly.detected)
      )) || false;
    }

    logSheet.appendRow([
      new Date(),               // Date
      analytics && analytics.today ? analytics.today.day : '',  // Day
      'Sakura House',           // Venue
      insightText.substring(0, 1000),  // InsightText (truncated to 1000 chars)
      revVsBenchmark,           // RevenueVsBenchmarkPct
      trendDir,                 // TrendDirection
      anomalyDetected,          // AnomalyDetected
      new Date()                // LoggedAt
    ]);
    Logger.log('M7 Log (Sakura): Insight logged to AI_INSIGHTS_LOG.');
  } catch (e) {
    Logger.log('M7 Log (Sakura): logging failed (non-blocking) — ' + e.message);
  }
}
