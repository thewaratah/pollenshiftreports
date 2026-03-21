/****************************************************
 * AI INSIGHTS — THE WARATAH SHIFT REPORTS
 *
 * M1 — Shift Summary: generateShiftSummary_Waratah()
 * M2 — Revenue Anomaly Detection: detectRevenueAnomalies_Waratah()
 * M3 — Task Classification: classifyTask_Waratah()
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
 * Generate a 2-3 sentence AI shift summary for The Waratah.
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
 *   {string}  day           - e.g. "Wednesday"
 *   {string}  mod           - MOD name
 *   {string}  netRevenue    - e.g. "4250.00"
 *   {string}  cardTips      - e.g. "180.00"
 *   {string}  cashTips      - e.g. "40.00"
 *   {string}  totalTips     - e.g. "220.00"
 *   {string}  staff         - Staff count / list
 *   {string}  shiftSummary  - Free-text shift summary (A43)
 *   {string}  guestsOfNote  - VIP / guests of note (A45)
 *   {string}  theGood       - What went well (A47)
 *   {string}  theBad        - Issues / what to improve (A49)
 *   {string}  kitchenNotes  - Kitchen notes (A51)
 *   {number}  todoCount     - Number of TO-DOs recorded
 * @returns {string|null} AI-generated summary, or null on failure
 */
function generateShiftSummary_Waratah(shiftData) {
  // --- Load API key from Script Properties (never hardcode) ---
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    Logger.log('AI Insights (Waratah): ANTHROPIC_API_KEY not set in Script Properties — skipping.');
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
    'You are a shift report assistant for The Waratah, a modern Australian restaurant in Sydney. ' +
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
    ', Total Tips: $' + (shiftData.totalTips || '0') + '\n' +
    '- Staff: ' + (shiftData.staff || 'N/A') + '\n' +
    '- Shift Notes: ' + truncate(shiftData.shiftSummary) + '\n' +
    '- VIP Notes: ' + truncate(shiftData.guestsOfNote) + '\n' +
    '- What went well: ' + truncate(shiftData.theGood) + '\n' +
    '- What to improve: ' + truncate(shiftData.theBad) + '\n' +
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
        'AI Insights (Waratah): Claude API returned HTTP ' + code +
        ' — ' + response.getContentText().substring(0, 300)
      );
      return null;
    }

    const json = JSON.parse(response.getContentText());
    const summary = json.content && json.content[0] && json.content[0].text
      ? json.content[0].text.trim()
      : null;

    if (!summary) {
      Logger.log('AI Insights (Waratah): Unexpected API response shape — content missing.');
      return null;
    }

    Logger.log('AI Insights (Waratah): Summary generated successfully (' + summary.length + ' chars).');
    return summary;

  } catch (e) {
    Logger.log('AI Insights (Waratah): API call failed — ' + e.message);
    return null;
  }
}


// ============================================================================
// M2 — REVENUE ANOMALY DETECTION
// ============================================================================

/**
 * Detect revenue anomalies for The Waratah by comparing today's shift against
 * the last 8 occurrences of the same day of week in the data warehouse.
 *
 * Metrics compared (2-stddev threshold):
 *   - NetRevenue (warehouse col F, index 5)
 *   - TipRatio   (TotalTips / NetRevenue; warehouse col U index 20 for TotalTips)
 *
 * On anomaly: posts a plain-text Slack alert to WARATAH_SLACK_WEBHOOK_TEST.
 * Non-blocking: wrapped in try/catch, never throws.
 *
 * Waratah NIGHTLY_FINANCIAL col indexes (0-based, 22 cols A-V):
 *   A=0 Date, B=1 Day, C=2 WeekEnding, D=3 MOD, E=4 Staff,
 *   F=5 NetRevenue, G=6 ProductionAmount, H=7 CashTakings,
 *   I=8 GrossSalesIncCash, J=9 CashReturns, K=10 CDDiscount,
 *   L=11 Refunds, M=12 CDRedeem, N=13 TotalDiscount,
 *   O=14 DiscountsCompsExcCD, P=15 GrossTaxableSales,
 *   Q=16 Taxes, R=17 NetSalesWTips, S=18 CardTips,
 *   T=19 CashTips, U=20 TotalTips, V=21 LoggedAt
 *
 * @param {Object} shiftData   - Extracted shift data (from logToDataWarehouse_())
 * @param {string} warehouseId - Spreadsheet ID of the data warehouse
 * @returns {{ anomalyDetected: boolean, details: string[] }}
 */
function detectRevenueAnomalies_Waratah(shiftData, warehouseId) {
  try {
    // --- Minimum data guard ---
    if (!shiftData || !shiftData.netRevenue || !warehouseId) {
      return { anomalyDetected: false, details: [] };
    }

    const todayRevenue = parseFloat(shiftData.netRevenue) || 0;
    const todayTips    = parseFloat(shiftData.totalTips)  || 0;
    const todayDay     = shiftData.dayOfWeek || '';  // e.g. "Wednesday"
    const todayMod     = shiftData.mod || 'Unknown';

    if (todayRevenue <= 0) {
      Logger.log('M2 Anomaly (Waratah): netRevenue is 0 — skipping anomaly check.');
      return { anomalyDetected: false, details: [] };
    }

    // --- Read warehouse NIGHTLY_FINANCIAL ---
    const warehouse      = SpreadsheetApp.openById(warehouseId);
    const financialSheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
    if (!financialSheet || financialSheet.getLastRow() < 2) {
      Logger.log('M2 Anomaly (Waratah): NIGHTLY_FINANCIAL empty or missing — insufficient data.');
      return { anomalyDetected: false, details: [] };
    }

    const lastRow = financialSheet.getLastRow();
    const allRows = financialSheet.getRange(2, 1, lastRow - 1, 22).getValues();

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
        'M2 Anomaly (Waratah): only ' + history.length +
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

    // --- NetRevenue stats (col F = index 5) ---
    var historicRevenues = history.map(function(row) { return parseFloat(row[5]) || 0; });
    var revMean   = mean_(historicRevenues);
    var revStddev = stddev_(historicRevenues, revMean);

    // --- TipRatio stats (col U = index 20 for TotalTips) ---
    var historicRatios = history.map(function(row) {
      var rev  = parseFloat(row[5])  || 0;  // F = NetRevenue
      var tips = parseFloat(row[20]) || 0;  // U = TotalTips
      return rev > 0 ? tips / rev : 0;
    });
    var ratioMean   = mean_(historicRatios);
    var ratioStddev = stddev_(historicRatios, ratioMean);

    var todayRatio = todayRevenue > 0 ? todayTips / todayRevenue : 0;

    // --- Anomaly detection (>2 stddev) ---
    var anomalies = [];

    var revZScore = revStddev > 0 ? Math.abs(todayRevenue - revMean) / revStddev : 0;
    if (revZScore > 2) {
      var pct      = revMean > 0 ? Math.round(((todayRevenue - revMean) / revMean) * 100) : 0;
      var dir      = todayRevenue > revMean ? 'above' : 'below';
      var meanFmt  = '$' + revMean.toFixed(0);
      var todayFmt = '$' + todayRevenue.toFixed(0);
      anomalies.push(
        'Revenue anomaly: Waratah ' + todayDay + ' revenue ' + todayFmt +
        ' is ' + Math.abs(pct) + '% ' + dir + ' 8-week average (' + meanFmt + ').'
      );
    }

    var ratioZScore = ratioStddev > 0 ? Math.abs(todayRatio - ratioMean) / ratioStddev : 0;
    if (ratioZScore > 2) {
      var pctRatio = ratioMean > 0 ? Math.round(((todayRatio - ratioMean) / ratioMean) * 100) : 0;
      var dirRatio = todayRatio > ratioMean ? 'above' : 'below';
      anomalies.push(
        'Tip ratio anomaly: Waratah ' + todayDay + ' tip ratio ' +
        (todayRatio * 100).toFixed(1) + '% is ' + Math.abs(pctRatio) + '% ' +
        dirRatio + ' 8-week average (' + (ratioMean * 100).toFixed(1) + '%).'
      );
    }

    // --- Post Slack alert if anomaly found ---
    if (anomalies.length > 0) {
      var webhook = PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST');
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
            Logger.log('M2 Anomaly (Waratah): Slack POST failed HTTP ' + code);
          } else {
            Logger.log('M2 Anomaly (Waratah): Slack alert posted — ' + text);
          }
        } catch (slackErr) {
          Logger.log('M2 Anomaly (Waratah): Slack post error — ' + slackErr.message);
        }
      } else {
        Logger.log('M2 Anomaly (Waratah): WARATAH_SLACK_WEBHOOK_TEST not set — alert logged only: ' + anomalies.join(' | '));
      }
      return { anomalyDetected: true, details: anomalies };
    }

    Logger.log('M2 Anomaly (Waratah): no anomalies detected for ' + todayDay + '.');
    return { anomalyDetected: false, details: [] };

  } catch (e) {
    Logger.log('M2 Anomaly (Waratah): error (non-blocking) — ' + e.message);
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
function classifyTask_Waratah(taskDescription) {
  try {
    // --- Guard: need API key and a non-empty description ---
    const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) {
      Logger.log('M3 Classify (Waratah): ANTHROPIC_API_KEY not set — skipping.');
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
        'M3 Classify (Waratah): Claude API returned HTTP ' + code +
        ' — ' + response.getContentText().substring(0, 200)
      );
      return null;
    }

    const json = JSON.parse(response.getContentText());
    const raw  = json.content && json.content[0] && json.content[0].text
      ? json.content[0].text.trim()
      : null;

    if (!raw) {
      Logger.log('M3 Classify (Waratah): Empty response from API.');
      return null;
    }

    // Strip any accidental markdown fences before parsing
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result  = JSON.parse(cleaned);

    // Validate expected keys are present
    const validPriorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
    const validAreas      = ['FOH', 'BOH', 'Kitchen', 'Management', 'General'];
    const validOffsets    = [0, 1, 3, 7];

    const priority      = validPriorities.includes(result.priority)    ? result.priority      : null;
    const area          = validAreas.includes(result.area)             ? result.area          : null;
    const dueDaysOffset = validOffsets.includes(result.dueDaysOffset)  ? result.dueDaysOffset : null;

    if (!priority || !area || dueDaysOffset === null) {
      Logger.log('M3 Classify (Waratah): Invalid classification values — ' + raw);
      return null;
    }

    Logger.log(
      'M3 Classify (Waratah): "' + taskDescription.substring(0, 60) + '" → ' +
      priority + ' / ' + area + ' / +' + dueDaysOffset + ' days'
    );
    return { priority: priority, area: area, dueDaysOffset: dueDaysOffset };

  } catch (e) {
    Logger.log('M3 Classify (Waratah): error (non-blocking) — ' + e.message);
    return null;
  }
}


// ============================================================================
// M4 — SHIFT ANALYTICS (Pure Math — No Claude API)
// ============================================================================

/**
 * Compute pre-calculated shift analytics for The Waratah by comparing today's
 * shift against historical same-day-of-week rows in the NIGHTLY_FINANCIAL
 * warehouse sheet.
 *
 * Pure math function — makes NO Claude API calls.
 * Non-blocking: returns { hasSufficientData: false } on any error or
 * insufficient history (<4 same-day rows).
 *
 * Waratah NIGHTLY_FINANCIAL col indexes (0-based, 22 cols A-V):
 *   A=0 Date, B=1 Day, C=2 WeekEnding, D=3 MOD, E=4 Staff,
 *   F=5 NetRevenue, G=6 ProductionAmount, H=7 CashTakings,
 *   I=8 GrossSalesIncCash, J=9 CashReturns, K=10 CDDiscount,
 *   L=11 Refunds, M=12 CDRedeem, N=13 TotalDiscount,
 *   O=14 DiscountsCompsExcCD, P=15 GrossTaxableSales,
 *   Q=16 Taxes, R=17 NetSalesWTips, S=18 CardTips,
 *   T=19 CashTips, U=20 TotalTips, V=21 LoggedAt
 *
 * @param {Object} shiftData   - Extracted shift data (same shape as M1 caller)
 * @param {string} warehouseId - Spreadsheet ID of the data warehouse
 * @returns {Object} Analytics result object — see return shape below.
 *   { hasSufficientData: false }  on insufficient data or any error
 *   { hasSufficientData: true, dataWeeks, today, trailing8w, trailing4w,
 *     weekOverWeek, trend, attribution, comparables, anomalies, discountImpact }
 */
function computeShiftAnalytics_Waratah(shiftData, warehouseId) {
  // Column index constants for NIGHTLY_FINANCIAL (0-based)
  const WARATAH_COLS_ = {
    date: 0, day: 1, netRevenue: 5, totalTips: 20,
    production: 6, grossSales: 8, totalDiscount: 13
  };

  try {
    // --- Guard: minimum required inputs ---
    if (!shiftData || !shiftData.netRevenue || !warehouseId) {
      return { hasSufficientData: false };
    }

    const todayRevenue    = parseFloat(shiftData.netRevenue)  || 0;
    const todayTips       = parseFloat(shiftData.totalTips)   || 0;
    const todayProduction = parseFloat(shiftData.production)  || 0;
    const todayDay        = (shiftData.day || '').toString().trim();  // e.g. "Wednesday"
    const todayMod        = shiftData.mod || 'Unknown';
    const todayDateStr    = shiftData.date || '';  // e.g. "18/03/2026"

    if (todayRevenue <= 0 || !todayDay) {
      Logger.log('M4 Analytics (Waratah): zero revenue or missing day — skipping.');
      return { hasSufficientData: false };
    }

    // --- Read warehouse NIGHTLY_FINANCIAL (same pattern as M2 lines 187-195) ---
    const warehouse      = SpreadsheetApp.openById(warehouseId);
    const financialSheet = warehouse.getSheetByName('NIGHTLY_FINANCIAL');
    if (!financialSheet || financialSheet.getLastRow() < 2) {
      Logger.log('M4 Analytics (Waratah): NIGHTLY_FINANCIAL empty or missing.');
      return { hasSufficientData: false };
    }

    const lastRow = financialSheet.getLastRow();
    const allRows = financialSheet.getRange(2, 1, lastRow - 1, 22).getValues();

    // Build a normalised date key for today to exclude today's own warehouse row
    // shiftData.date is a string like "18/03/2026" — parse to compare with Date objects
    let todayDateKey = '';
    if (todayDateStr) {
      const parsed = Utilities.parseDate(todayDateStr, 'Australia/Sydney', 'dd/MM/yyyy');
      if (parsed) todayDateKey = parsed.toDateString();
    }

    // Filter rows matching today's day of week; exclude today's own row
    const sameDay = allRows.filter(function(row) {
      const rowDay     = (row[WARATAH_COLS_.day] || '').toString().trim();
      const rowDateRaw = row[WARATAH_COLS_.date];
      const rowDateKey = rowDateRaw instanceof Date ? rowDateRaw.toDateString() : '';
      return rowDay === todayDay && rowDateKey !== todayDateKey;
    });

    // Take the last 8 and last 4 same-day rows (chronological tail) — same as M2 pattern
    const history  = sameDay.slice(-8);
    const history4 = sameDay.slice(-4);

    if (history4.length < 4) {
      Logger.log(
        'M4 Analytics (Waratah): only ' + history4.length +
        ' historical rows for ' + todayDay + ' — need ≥4. Skipping.'
      );
      return { hasSufficientData: false };
    }

    // -------------------------------------------------------------------------
    // Statistical helper inner functions
    // -------------------------------------------------------------------------
    function mean_(arr) {
      return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
    }

    function stddev_(arr, m) {
      var variance = arr.reduce(function(s, v) { return s + Math.pow(v - m, 2); }, 0) / arr.length;
      return Math.sqrt(variance);
    }

    // Least-squares slope over ordered values (i is 0-indexed position)
    function linearSlope_(values) {
      var n = values.length;
      if (n < 2) return 0;
      var sumI = 0, sumY = 0, sumIY = 0, sumI2 = 0;
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

    // Sort descending by value; find today's rank (1 = best)
    function rankInHistory_(todayValue, historicValues) {
      var all = historicValues.concat([todayValue]).sort(function(a, b) { return b - a; });
      var rank = all.indexOf(todayValue) + 1;
      return { rank: rank, total: all.length };
    }

    // -------------------------------------------------------------------------
    // Extract raw arrays from warehouse rows
    // -------------------------------------------------------------------------
    var hist8Revenues  = history.map(function(r) { return parseFloat(r[WARATAH_COLS_.netRevenue])  || 0; });
    var hist8Tips      = history.map(function(r) { return parseFloat(r[WARATAH_COLS_.totalTips])   || 0; });
    var hist8Prod      = history.map(function(r) { return parseFloat(r[WARATAH_COLS_.production])  || 0; });
    var hist8Gross     = history.map(function(r) { return parseFloat(r[WARATAH_COLS_.grossSales])  || 0; });
    var hist8Discount  = history.map(function(r) { return parseFloat(r[WARATAH_COLS_.totalDiscount]) || 0; });

    var hist8TipRatios = hist8Revenues.map(function(rev, i) {
      return rev > 0 ? hist8Tips[i] / rev : 0;
    });

    var hist4Revenues  = history4.map(function(r) { return parseFloat(r[WARATAH_COLS_.netRevenue]) || 0; });
    var hist4Tips      = history4.map(function(r) { return parseFloat(r[WARATAH_COLS_.totalTips])  || 0; });
    var hist4TipRatios = hist4Revenues.map(function(rev, i) {
      return rev > 0 ? hist4Tips[i] / rev : 0;
    });

    // -------------------------------------------------------------------------
    // trailing8w metrics
    // -------------------------------------------------------------------------
    var revMean8      = mean_(hist8Revenues);
    var revStddev8    = stddev_(hist8Revenues, revMean8);
    var tipRatioMean8 = mean_(hist8TipRatios);
    var prodMean8     = mean_(hist8Prod);

    // -------------------------------------------------------------------------
    // trailing4w metrics
    // -------------------------------------------------------------------------
    var revMean4      = mean_(hist4Revenues);
    var tipRatioMean4 = mean_(hist4TipRatios);

    // -------------------------------------------------------------------------
    // weekOverWeek: compare today vs the most recent same-day row
    // -------------------------------------------------------------------------
    var lastWeekRow     = history[history.length - 1];
    var lastWeekRevenue = lastWeekRow ? (parseFloat(lastWeekRow[WARATAH_COLS_.netRevenue]) || 0) : 0;
    var wowDeltaAbs     = todayRevenue - lastWeekRevenue;
    var wowDeltaPct     = percentChange_(todayRevenue, lastWeekRevenue);

    // -------------------------------------------------------------------------
    // trend: linear slope on the 8 revenue values
    // -------------------------------------------------------------------------
    var slope     = linearSlope_(hist8Revenues);
    var trendThreshold = revMean8 * 0.005; // 0.5% of mean per week — matches Sakura
    var direction = slope > trendThreshold ? 'upward' : slope < -trendThreshold ? 'downward' : 'flat';

    // -------------------------------------------------------------------------
    // attribution: production share today vs 8w avg
    // -------------------------------------------------------------------------
    var todayProdShare    = todayRevenue > 0 ? todayProduction / todayRevenue : 0;
    var avgProdShare8     = revMean8 > 0 ? prodMean8 / revMean8 : 0;
    var prodShareDelta    = todayProdShare - avgProdShare8;
    var prodShareDesc;
    if (Math.abs(prodShareDelta) < 0.01) {
      prodShareDesc = 'Production share in line with average.';
    } else if (prodShareDelta > 0) {
      prodShareDesc = 'Production contributed more than usual to revenue today.';
    } else {
      prodShareDesc = 'Production contributed less than usual to revenue today.';
    }

    // -------------------------------------------------------------------------
    // comparables: best and worst from history8, today's rank
    // -------------------------------------------------------------------------
    var bestRow  = history.reduce(function(best, row) {
      return (parseFloat(row[WARATAH_COLS_.netRevenue]) || 0) > (parseFloat(best[WARATAH_COLS_.netRevenue]) || 0) ? row : best;
    }, history[0]);
    var worstRow = history.reduce(function(worst, row) {
      return (parseFloat(row[WARATAH_COLS_.netRevenue]) || 0) < (parseFloat(worst[WARATAH_COLS_.netRevenue]) || 0) ? row : worst;
    }, history[0]);

    // Format warehouse Date objects as DD/MM/YYYY for prompt display
    function formatDateDMY_(d) {
      if (!(d instanceof Date)) return String(d);
      var dd = ('0' + d.getDate()).slice(-2);
      var mm = ('0' + (d.getMonth() + 1)).slice(-2);
      var yyyy = d.getFullYear();
      return dd + '/' + mm + '/' + yyyy;
    }

    var rankResult = rankInHistory_(todayRevenue, hist8Revenues);

    // -------------------------------------------------------------------------
    // anomalies: z-score (>2σ) for revenue and tip ratio
    // -------------------------------------------------------------------------
    var todayTipRatio  = todayRevenue > 0 ? todayTips / todayRevenue : 0;
    var revZScore      = revStddev8 > 0 ? (todayRevenue - revMean8) / revStddev8 : 0;
    var ratioStddev8   = stddev_(hist8TipRatios, tipRatioMean8);
    var ratioZScore    = ratioStddev8 > 0 ? (todayTipRatio - tipRatioMean8) / ratioStddev8 : 0;

    var revAnomalyDeltaPct   = percentChange_(todayRevenue, revMean8);
    var ratioAnomalyDeltaPct = percentChange_(todayTipRatio, tipRatioMean8);

    // -------------------------------------------------------------------------
    // discountImpact (Waratah-only): today's discount rate vs 8w avg
    // -------------------------------------------------------------------------
    var todayGross        = parseFloat(shiftData.grossSales || shiftData.grossSalesIncCash || 0) || 0;
    var todayDiscount     = parseFloat(shiftData.totalDiscount || 0) || 0;
    var todayDiscRate     = todayGross > 0 ? todayDiscount / todayGross : 0;

    // Compute 8w average discount rate from warehouse
    var hist8DiscRates = hist8Gross.map(function(gross, i) {
      return gross > 0 ? hist8Discount[i] / gross : 0;
    });
    var avgDiscRate8 = mean_(hist8DiscRates);
    var discDelta    = todayDiscRate - avgDiscRate8;

    // -------------------------------------------------------------------------
    // Build and return result
    // -------------------------------------------------------------------------
    return {
      hasSufficientData: true,
      dataWeeks:         history.length,

      today: {
        revenue:    todayRevenue,
        tips:       todayTips,
        tipRatio:   parseFloat((todayTipRatio * 100).toFixed(2)),
        production: todayProduction,
        day:        todayDay,
        date:       todayDateStr,
        mod:        todayMod
      },

      trailing8w: {
        revenueMean:    parseFloat(revMean8.toFixed(2)),
        revenueStddev:  parseFloat(revStddev8.toFixed(2)),
        tipRatioMean:   parseFloat((tipRatioMean8 * 100).toFixed(2)),
        productionMean: parseFloat(prodMean8.toFixed(2))
      },

      trailing4w: {
        revenueMean:  parseFloat(revMean4.toFixed(2)),
        tipRatioMean: parseFloat((tipRatioMean4 * 100).toFixed(2))
      },

      weekOverWeek: {
        lastWeekRevenue: parseFloat(lastWeekRevenue.toFixed(2)),
        deltaAbs:        parseFloat(wowDeltaAbs.toFixed(2)),
        deltaPct:        wowDeltaPct !== null ? parseFloat(wowDeltaPct.toFixed(1)) : null
      },

      trend: {
        direction:    direction,
        slopePerWeek: parseFloat(slope.toFixed(2))
      },

      attribution: {
        productionShareDelta: parseFloat((prodShareDelta * 100).toFixed(2)),
        description:          prodShareDesc
      },

      comparables: {
        best:  { date: formatDateDMY_(bestRow[WARATAH_COLS_.date]),  revenue: parseFloat((parseFloat(bestRow[WARATAH_COLS_.netRevenue])  || 0).toFixed(2)) },
        worst: { date: formatDateDMY_(worstRow[WARATAH_COLS_.date]), revenue: parseFloat((parseFloat(worstRow[WARATAH_COLS_.netRevenue]) || 0).toFixed(2)) },
        rank:  rankResult.rank,
        total: rankResult.total
      },

      anomalies: {
        revenueAnomaly: {
          detected:  Math.abs(revZScore) > 2,
          zScore:    parseFloat(revZScore.toFixed(2)),
          deltaPct:  revAnomalyDeltaPct !== null ? parseFloat(revAnomalyDeltaPct.toFixed(1)) : null,
          direction: todayRevenue >= revMean8 ? 'above' : 'below'
        },
        tipRatioAnomaly: {
          detected:  Math.abs(ratioZScore) > 2,
          zScore:    parseFloat(ratioZScore.toFixed(2)),
          deltaPct:  ratioAnomalyDeltaPct !== null ? parseFloat(ratioAnomalyDeltaPct.toFixed(1)) : null,
          direction: todayTipRatio >= tipRatioMean8 ? 'above' : 'below'
        }
      },

      discountImpact: {
        todayRate: parseFloat((todayDiscRate * 100).toFixed(2)),
        avgRate:   parseFloat((avgDiscRate8 * 100).toFixed(2)),
        delta:     parseFloat((discDelta * 100).toFixed(2))
      }
    };

  } catch (e) {
    Logger.log('M4 Analytics (Waratah): error (non-blocking) — ' + e.message);
    return { hasSufficientData: false };
  }
}


// ============================================================================
// M5 — STRUCTURED SHIFT INSIGHT (Analytics → Claude Haiku)
// ============================================================================

/**
 * Generate a structured 3-line management insight for The Waratah using
 * pre-computed analytics from computeShiftAnalytics_Waratah().
 *
 * If analytics is null or analytics.hasSufficientData is false, falls back
 * to calling generateShiftSummary_Waratah(shiftData) and returning its result.
 *
 * Otherwise: builds a metrics-rich prompt, calls Claude Haiku, and returns
 * a 3-line plain-text insight (PERFORMANCE / TREND / ACTION).
 *
 * Non-blocking: returns null on any failure.
 * Credential: ANTHROPIC_API_KEY in Script Properties — never hardcoded.
 *
 * @param {Object}      shiftData  - Extracted shift data (same shape as M1)
 * @param {Object|null} analytics  - Result of computeShiftAnalytics_Waratah(), or null
 * @returns {string|null} 3-line insight string, or null on failure
 */
function generateShiftInsight_Waratah(shiftData, analytics) {
  // --- Fallback: insufficient data → delegate to M1 basic summary ---
  if (!analytics || !analytics.hasSufficientData) {
    Logger.log('M5 Insight (Waratah): insufficient analytics data — falling back to M1 summary.');
    return generateShiftSummary_Waratah(shiftData);
  }

  // --- Load API key ---
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    Logger.log('M5 Insight (Waratah): ANTHROPIC_API_KEY not set — skipping.');
    return null;
  }

  try {
    // --- Truncate helper for raw narrative fields ---
    const MAX_FIELD = 200;
    const truncate = function(str) {
      if (!str) return '';
      var s = str.toString().trim();
      return s.length > MAX_FIELD ? s.substring(0, MAX_FIELD) + '...' : s;
    };

    // --- Destructure analytics for readability ---
    var t8   = analytics.trailing8w;
    var t4   = analytics.trailing4w;
    var wow  = analytics.weekOverWeek;
    var trd  = analytics.trend;
    var cmp  = analytics.comparables;
    var anm  = analytics.anomalies;
    var disc = analytics.discountImpact;
    var tod  = analytics.today;
    var dw   = analytics.dataWeeks;

    // Confidence qualifier based on weeks of data
    var confidence = dw >= 8 ? 'high confidence' : dw >= 4 ? 'moderate confidence' : 'low confidence';

    // Variance from 8w mean
    var variancePct  = t8.revenueMean > 0
      ? ((tod.revenue - t8.revenueMean) / t8.revenueMean * 100).toFixed(1)
      : '0.0';
    var varianceDir  = tod.revenue >= t8.revenueMean ? 'above' : 'below';

    // Week-over-week display
    var wowPctStr = wow.deltaPct !== null ? (wow.deltaPct >= 0 ? '+' : '') + wow.deltaPct + '%' : 'N/A';

    // Anomaly section — only included when detected
    var anomalySection = '';
    if (anm.revenueAnomaly.detected || anm.tipRatioAnomaly.detected) {
      anomalySection = '\nANOMALIES DETECTED:';
      if (anm.revenueAnomaly.detected) {
        var revFlag = Math.abs(anm.revenueAnomaly.zScore) > 3 ? ' [z>' + anm.revenueAnomaly.zScore.toFixed(1) + ' — significant outlier, verify data]' : ' [z=' + anm.revenueAnomaly.zScore.toFixed(1) + ']';
        anomalySection += '\n- Revenue ' + anm.revenueAnomaly.direction + ' average by ' +
          (anm.revenueAnomaly.deltaPct !== null ? Math.abs(anm.revenueAnomaly.deltaPct) + '%' : 'N/A') + revFlag;
      }
      if (anm.tipRatioAnomaly.detected) {
        var ratFlag = Math.abs(anm.tipRatioAnomaly.zScore) > 3 ? ' [z>' + anm.tipRatioAnomaly.zScore.toFixed(1) + ' — significant outlier, verify data]' : ' [z=' + anm.tipRatioAnomaly.zScore.toFixed(1) + ']';
        anomalySection += '\n- Tip ratio ' + anm.tipRatioAnomaly.direction + ' average by ' +
          (anm.tipRatioAnomaly.deltaPct !== null ? Math.abs(anm.tipRatioAnomaly.deltaPct) + '%' : 'N/A') + ratFlag;
      }
    }

    // --- System prompt ---
    var systemPrompt =
      'You are a hospitality financial analyst for The Waratah, a modern Australian restaurant in Sydney ' +
      'operating Wed-Sun. You receive pre-calculated metrics alongside raw shift notes. ' +
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
      'Date: ' + tod.date + ', Day: ' + tod.day + ', MOD: ' + tod.mod + '\n' +
      'Data confidence: ' + confidence + ' (' + dw + '-week trailing)\n\n' +

      "TODAY'S NUMBERS:\n" +
      'Net Revenue: $' + tod.revenue.toFixed(2) +
      ' | Tips: $' + tod.tips.toFixed(2) + ' (' + tod.tipRatio + '% of revenue)' +
      ' | Production: $' + tod.production.toFixed(2) + '\n\n' +

      'BENCHMARKS (same ' + tod.day + ', trailing averages):\n' +
      '8-week revenue avg: $' + t8.revenueMean.toFixed(2) + ' (stddev: $' + t8.revenueStddev.toFixed(2) + ')\n' +
      '4-week revenue avg: $' + t4.revenueMean.toFixed(2) + ' | 4-week tip ratio avg: ' + t4.tipRatioMean + '%\n' +
      'Revenue vs 8w avg: ' + Math.abs(variancePct) + '% ' + varianceDir + '\n' +
      '8-week tip ratio avg: ' + t8.tipRatioMean + '%\n' +
      'Week-over-week: ' + wowPctStr + ' (vs last ' + tod.day + ' $' + wow.lastWeekRevenue.toFixed(2) + ')\n' +
      'Discount rate today: ' + disc.todayRate + '% | 8-week avg: ' + disc.avgRate + '%\n' +
      '  (discount delta: ' + (disc.delta >= 0 ? '+' : '') + disc.delta + '%)\n\n' +

      'TREND: Revenue over ' + dw + ' weeks: ' + trd.direction + ' ($' + trd.slopePerWeek.toFixed(0) + '/week slope)\n' +
      'RANKING: Today ranks #' + cmp.rank + ' of ' + cmp.total + ' recent ' + tod.day + 's\n' +
      'Best: ' + cmp.best.date + ' at $' + cmp.best.revenue.toFixed(2) +
      ' | Worst: ' + cmp.worst.date + ' at $' + cmp.worst.revenue.toFixed(2) + '\n' +

      anomalySection +

      '\n\nOPERATIONAL NOTES (context only — do not summarize these):\n' +
      '- Shift notes: ' + truncate(shiftData.shiftSummary) + '\n' +
      '- Issues: ' + truncate(shiftData.theBad) + '\n\n' +

      'Write PERFORMANCE, TREND, and ACTION now.';

    // --- Call Claude API (same pattern as M1) ---
    var payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var code = response.getResponseCode();

    if (code !== 200) {
      Logger.log(
        'M5 Insight (Waratah): Claude API returned HTTP ' + code +
        ' — ' + response.getContentText().substring(0, 300)
      );
      return null;
    }

    var json    = JSON.parse(response.getContentText());
    var insight = json.content && json.content[0] && json.content[0].text
      ? json.content[0].text.trim()
      : null;

    if (!insight) {
      Logger.log('M5 Insight (Waratah): Unexpected API response shape — content missing.');
      return null;
    }

    Logger.log('M5 Insight (Waratah): Insight generated successfully (' + insight.length + ' chars).');
    return insight;

  } catch (e) {
    Logger.log('M5 Insight (Waratah): error (non-blocking) — ' + e.message);
    return null;
  }
}


// ============================================================================
// M6 — SOFT LAUNCH ROUTING: deliverAIInsights_Waratah
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
 * @param {string|null} insight  - The upgraded insight text from generateShiftInsight_Waratah
 * @param {string}      shiftDate - Date string for subject line (e.g. "18/03/2026")
 * @returns {string|null} The insight if mode='live', null otherwise
 */
function deliverAIInsights_Waratah(insight, shiftDate) {
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
        subject: 'The Waratah AI Insights: ' + shiftDate,
        htmlBody: '<h3>The Waratah Shift Insights — ' + shiftDate + '</h3>' +
                  '<pre style="font-family:monospace;white-space:pre-wrap;background:#f5f5f5;padding:12px;border-left:4px solid #2d6a4f;">' +
                  insight + '</pre>' +
                  '<p style="color:#888;font-size:12px;">Soft launch — only you receive this. Set AI_INSIGHTS_MODE=live in Script Properties to send to team.</p>'
      });
      Logger.log('M6 Route (Waratah): evan_only email sent to ' + evanEmail);
    } catch (e) {
      Logger.log('M6 Route (Waratah): evan_only email failed — ' + e.message);
    }
  }

  // 2. Post to TEST Slack webhook (already Evan-only)
  var testWebhook = PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST');
  if (testWebhook) {
    try {
      UrlFetchApp.fetch(testWebhook, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          text: ':chart_with_upwards_trend: *The Waratah AI Insights* (' + shiftDate + ')\n' + insight
        }),
        muteHttpExceptions: true
      });
      Logger.log('M6 Route (Waratah): evan_only Slack posted to TEST webhook.');
    } catch (e) {
      Logger.log('M6 Route (Waratah): evan_only Slack failed — ' + e.message);
    }
  }

  // Return null — team email/Slack gets OLD generic summary
  return null;
}


// ============================================================================
// M7 — INSIGHT LOGGING: logInsightToWarehouse_Waratah
// ============================================================================

/**
 * Append a row to AI_INSIGHTS_LOG in the data warehouse.
 * Creates the sheet with headers on first use.
 * Non-blocking: all errors are logged, never thrown.
 *
 * @param {Object} analytics   - Return from computeShiftAnalytics_Waratah (or null)
 * @param {string} insightText - The generated insight text (or null)
 */
function logInsightToWarehouse_Waratah(analytics, insightText) {
  try {
    var warehouseId = PropertiesService.getScriptProperties().getProperty('WARATAH_DATA_WAREHOUSE_ID');
    if (!warehouseId || !insightText) return;

    var warehouse = SpreadsheetApp.openById(warehouseId);
    var logSheet = warehouse.getSheetByName('AI_INSIGHTS_LOG');

    // Auto-create sheet with headers on first use
    if (!logSheet) {
      logSheet = warehouse.insertSheet('AI_INSIGHTS_LOG');
      logSheet.appendRow(['Date', 'Day', 'Venue', 'InsightText', 'RevenueVsBenchmarkPct', 'TrendDirection', 'AnomalyDetected', 'LoggedAt']);
      logSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      Logger.log('M7 Log (Waratah): AI_INSIGHTS_LOG sheet created with headers.');
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
      'The Waratah',            // Venue
      insightText.substring(0, 1000),  // InsightText (truncated to 1000 chars)
      revVsBenchmark,           // RevenueVsBenchmarkPct
      trendDir,                 // TrendDirection
      anomalyDetected,          // AnomalyDetected
      new Date()                // LoggedAt
    ]);
    Logger.log('M7 Log (Waratah): Insight logged to AI_INSIGHTS_LOG.');
  } catch (e) {
    Logger.log('M7 Log (Waratah): logging failed (non-blocking) — ' + e.message);
  }
}
