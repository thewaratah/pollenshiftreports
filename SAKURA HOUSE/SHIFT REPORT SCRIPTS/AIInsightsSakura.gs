/****************************************************
 * AI INSIGHTS — SAKURA HOUSE SHIFT REPORTS
 *
 * M1: generateShiftSummary_Sakura — 2-3 sentence AI shift narrative
 * M2: detectRevenueAnomalies_Sakura — 8-week rolling anomaly detection,
 *     posts Slack alert when revenue/tip ratio is >2 std devs from norm
 * M3: classifyTask_Sakura — Claude Haiku task classification
 *     (priority, area, dueDaysOffset) for TO-DOs pushed to Actionables
 *
 * Non-blocking: all failures return null / graceful default so the main
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
