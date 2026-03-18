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
