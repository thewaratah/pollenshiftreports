/****************************************************
 * SAKURA HOUSE — NIGHTLY & WEEKLY REPORT SCRIPT
 *
 * Handles PDF generation, email, Slack posting,
 * TO-DO aggregation, and weekly summaries.
 *
 * Dependencies:
 *   Menu.gs            - onOpen() menu
 *   Run.gs             - Named range helpers (getFieldValue, etc.)
 *   TaskIntegration.js - pushTodosToActionables()
 *   IntegrationHub.js  - runIntegrations()
 *
 * NOTE: onOpen() is in Menu.gs — do NOT define it here.
 ****************************************************/


/* ==========================================================================
   CREDENTIAL GETTERS (loaded from Script Properties)
   See _SETUP_ScriptProperties.js for initial setup instructions
   ========================================================================== */

/** Get Sakura LIVE Slack webhook from Script Properties */
function getSakuraSlackWebhookLive_() {
  const webhook = PropertiesService.getScriptProperties().getProperty('SAKURA_SLACK_WEBHOOK_LIVE');
  if (!webhook) {
    throw new Error('SAKURA_SLACK_WEBHOOK_LIVE not configured in Script Properties. Run setupScriptProperties_SakuraShiftReports() first.');
  }
  return webhook;
}

/** Get Sakura TEST Slack webhook from Script Properties */
function getSakuraSlackWebhookTest_() {
  const webhook = PropertiesService.getScriptProperties().getProperty('SAKURA_SLACK_WEBHOOK_TEST');
  if (!webhook) {
    throw new Error('SAKURA_SLACK_WEBHOOK_TEST not configured in Script Properties. Run setupScriptProperties_SakuraShiftReports() first.');
  }
  return webhook;
}

/** Get Sakura email recipients map from Script Properties */
function getSakuraRecipients_() {
  const json = PropertiesService.getScriptProperties().getProperty('SAKURA_EMAIL_RECIPIENTS');
  if (!json) {
    throw new Error('SAKURA_EMAIL_RECIPIENTS not configured in Script Properties. Run setupScriptProperties_SakuraShiftReports() first.');
  }
  return JSON.parse(json);
}


/* ==========================================================================
   LAZY-LOAD CONFIGURATION GETTERS
   Loaded on demand to avoid onOpen() failures when Script Properties
   are not yet configured.
   ========================================================================== */

/** Returns the Sakura LIVE Slack webhook URL (lazy-loaded). */
function getSakuraSlackWebhookUrlLive_() {
  return getSakuraSlackWebhookLive_();
}

/** Returns the Sakura TEST Slack webhook URL (lazy-loaded). */
function getSakuraSlackWebhookUrlTest_() {
  return getSakuraSlackWebhookTest_();
}

/** Returns the Sakura email recipients map (lazy-loaded). */
function getSakuraRecipientsMap_() {
  return getSakuraRecipients_();
}

/** Returns the nightly email recipient addresses array (lazy-loaded). */
function getNightlyEmailRecipients_() {
  return Object.keys(getSakuraRecipients_());
}


// ============================================================================
// TO-DO & LAYOUT CONFIGURATION
// ============================================================================

const SAKURA_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];


// ============================================================================
// PRE-SEND CHECKLIST
// ============================================================================

/**
 * Show the pre-send checklist modal.
 * The dialog's Confirm button calls continueExport() to do the actual work.
 *
 * @param {string} sheetName - The shift report sheet name
 * @param {boolean} isTest - Whether this is a test run
 */
function showPreExportChecklist_(sheetName, isTest) {
  const template = HtmlService.createTemplateFromFile('checklist-dialog');
  template.sheetName = JSON.stringify(sheetName);
  template.isTest = isTest ? 'true' : 'false';
  const html = template.evaluate()
    .setWidth(380)
    .setHeight(240)
    .setTitle('Pre-Send Checklist');
  SpreadsheetApp.getUi().showModalDialog(html, 'Pre-Send Checklist');
}

/**
 * CONTINUATION: Called by the checklist dialog after user confirms both items.
 * Handles the full export pipeline for both LIVE and TEST runs.
 *
 * NOTE: This function is invoked via google.script.run from the HTML dialog.
 * Do NOT call SpreadsheetApp.getUi() or ui.alert() — these do not work in that
 * context and will throw "Authorisation is required to perform that action."
 * Instead, return { success, message } and let the dialog handle all UI feedback.
 *
 * @param {string} sheetName - The shift report sheet name
 * @param {boolean} isTest - Whether this is a test run
 * @returns {{ success: boolean, message: string }}
 */
function continueExport(sheetName, isTest) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.getActiveSheet();

  try {
    if (isTest) {
      // === TEST PATH ===
      try {
        const slackSentTest = postToSlackFromSheet_(spreadsheet, sheet, sheetName, getSakuraSlackWebhookUrlTest_());
        if (!slackSentTest) {
          Logger.log('⚠️ Slack post failed (TEST) — export completed but Slack notification was not delivered');
        }
      } catch (e) {
        Logger.log('postToSlackFromSheet_ (TEST) failed (non-blocking): ' + e.message);
      }

      const me = Session.getActiveUser().getEmail();
      const pdfBlob = generatePdfForSheet_NoUI_(
        spreadsheet, sheet,
        `TEST - Sakura House Report - ${sheetName}.pdf`
      );
      if (!pdfBlob) return { success: false, message: 'PDF generation failed. See logs for details.' };

      const sheetUrl = spreadsheet.getUrl();
      const subject = `TEST - Sakura House Report: ${sheetName}`;
      const htmlBody = `
        <p>Test email to <strong>${me}</strong>.</p>
        <p>Attached: <strong>${sheetName}</strong> (test mode).</p>
        <hr>
        <p><a href="${sheetUrl}">Open Google Sheet</a></p>
      `;

      GmailApp.sendEmail(me, subject, "", { htmlBody: htmlBody, attachments: [pdfBlob] });
      Logger.log("TEST email sent to: " + me);
      return { success: true, message: 'TEST complete. Check your email and Slack DM.' };

    } else {
      // === LIVE PATH ===
      // Run integrations — fully non-blocking. Warehouse/system errors are logged, never surfaced.
      try {
        const integrationResults = runIntegrations(sheetName);
        const allMessages = [...(integrationResults.errors || []), ...(integrationResults.warnings || [])];
        if (allMessages.length > 0) {
          Logger.log('Integration non-blocking: ' + allMessages.join(' | '));
        }
      } catch (e) {
        Logger.log('runIntegrations failed (non-blocking): ' + e.message);
      }

      // AI Shift Summary for email — non-blocking, collected before email body is built
      let aiSummaryEmail = null;
      try {
        const tz_ = Session.getScriptTimeZone() || 'Australia/Sydney';
        const readF_ = (key) => { try { return getFieldDisplayValue(sheet, key).trim(); } catch (e_) { return ''; } };
        const dateVal_ = getFieldValue(sheet, 'date');
        const aiShiftData_ = {
          date: dateVal_ instanceof Date ? Utilities.formatDate(dateVal_, tz_, 'dd/MM/yyyy') : readF_('date'),
          day:  dateVal_ instanceof Date ? Utilities.formatDate(dateVal_, tz_, 'EEEE') : '',
          mod:           readF_('mod'),
          netRevenue:    readF_('netRevenue'),
          cardTips:      readF_('cardTips'),
          cashTips:      readF_('cashTips'),
          surchargeTips: readF_('surchargeTips'),
          fohStaff:      readF_('fohStaff'),
          bohStaff:      readF_('bohStaff'),
          shiftSummary:  readF_('shiftSummary'),
          guestsOfNote:  readF_('guestsOfNote'),
          goodNotes:     readF_('goodNotes'),
          issues:        readF_('issues'),
          kitchenNotes:  readF_('kitchenNotes'),
          todoCount:     0
        };
        aiSummaryEmail = generateShiftSummary_Sakura(aiShiftData_);
      } catch (e) {
        Logger.log('AI Insights (Sakura) email: generateShiftSummary_Sakura failed (non-blocking): ' + e.message);
      }

      try {
        buildTodoAggregationSheet_(spreadsheet);
      } catch (e) {
        Logger.log('buildTodoAggregationSheet_ failed (non-blocking): ' + e.message);
      }

      try {
        const slackSentLive = postToSlackFromSheet_(spreadsheet, sheet, sheetName, getSakuraSlackWebhookUrlLive_());
        if (!slackSentLive) {
          Logger.log('Slack post failed — export completed but Slack notification was not delivered');
        }
      } catch (e) {
        Logger.log('postToSlackFromSheet_ failed (non-blocking): ' + e.message);
      }

      try {
        pushTodosToActionables(sheet, sheetName);
      } catch (e) {
        Logger.log('pushTodosToActionables failed (non-blocking): ' + e.message);
      }

      const pdfBlob = generatePdfForSheet_NoUI_(
        spreadsheet, sheet,
        `Sakura House Nightly Shift Report - ${sheetName}.pdf`
      );
      if (!pdfBlob) return { success: false, message: 'PDF generation failed. See logs for details.' };

      const emailAddresses = getNightlyEmailRecipients_().slice();
      const senderEmail = Session.getActiveUser().getEmail();
      const fallbackName = getFieldDisplayValue(sheet, "mod") || "Sakura House Management Team";
      const senderName = getSakuraRecipientsMap_()[senderEmail] || fallbackName;

      const sheetUrl = spreadsheet.getUrl();
      const subject = `Sakura House Nightly Shift Report: ${sheetName}`;
      const aiEmailBlock = aiSummaryEmail
        ? `<p style="background:#f5f5f5;padding:10px 14px;border-left:4px solid #e60026;font-style:italic;margin-bottom:16px;">${aiSummaryEmail}</p>`
        : '';
      const htmlBody = `
        ${aiEmailBlock}<p>Dear Team,</p>
        <p>Please find attached the PDF export of the nightly report: <strong>${sheetName}</strong>.</p>
        <p>Best regards,<br>${senderName}</p>
        <hr>
        <p><strong>Access the live Google Sheet:</strong><br>
        <a href="${sheetUrl}">${sheetUrl}</a></p>
      `;

      GmailApp.sendEmail(emailAddresses.join(','), subject, "", {
        htmlBody: htmlBody,
        attachments: [pdfBlob]
      });
      Logger.log("Email sent to: " + emailAddresses.join(', '));
      return { success: true, message: 'Export complete. Emails sent.' };
    }

  } catch (err) {
    Logger.log("Export failed: " + err.message + "\n" + err.stack);
    return { success: false, message: 'Export failed: ' + err.message };
  }
}


// ============================================================================
// MAIN EXPORT FUNCTION (LIVE)
// ============================================================================

function exportAndEmailPDF() {
  const excludedSheets = ["Instructions", "Read Me", "SHIFT REPORT INSTRUCTIONS", "TO-DOs", "README"];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const sheetName = sheet.getName();
  const ui = SpreadsheetApp.getUi();

  if (excludedSheets.includes(sheetName)) {
    ui.alert(`The sheet "${sheetName}" cannot be exported.`);
    return;
  }

  const response = ui.alert(
    "Export Confirmation",
    `You are about to export the sheet: "${sheetName}". Continue?`,
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    ui.alert("Export cancelled.");
    return;
  }

  // Show pre-send checklist (timesheets + fruit); export continues from there
  showPreExportChecklist_(sheetName, false);
}


// ============================================================================
// TEST EXPORT FUNCTION
// ============================================================================

function exportAndEmailPDF_TestToSelf() {
  const ui = SpreadsheetApp.getUi();
  const me = Session.getActiveUser().getEmail();
  ui.alert("TEST MODE\n\nSlack: Your DM webhook\nEmail: " + me);

  const sheetName = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();

  // Show pre-send checklist (timesheets + fruit); export continues from there
  showPreExportChecklist_(sheetName, true);
}


// ============================================================================
// SLACK POSTING (Uses Named Ranges from Run.gs)
// ============================================================================

function postToSlackFromSheet_(spreadsheet, sheet, sheetName, webhookUrl) {
  if (!webhookUrl) {
    Logger.log("Slack webhook not configured.");
    return;
  }

  const tz = Session.getScriptTimeZone() || "Australia/Sydney";

  // --- Helper: read display value safely via named ranges ---
  const readField = (key) => {
    try { return getFieldDisplayValue(sheet, key).trim(); }
    catch (e) { return ""; }
  };

  // --- Helper: format currency ---
  const fmtAUD = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return "N/A";
    return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // --- Date & Day ---
  const dateValue = getFieldValue(sheet, "date");
  let dateStr, dayStr;

  if (dateValue instanceof Date) {
    dateStr = Utilities.formatDate(dateValue, tz, "dd/MM/yyyy");
    dayStr = Utilities.formatDate(dateValue, tz, "EEEE");
  } else {
    dateStr = readField("date") || "N/A";
    dayStr = "N/A";
  }

  // --- Core fields ---
  const modText        = readField("mod") || "N/A";
  const fohStaff       = readField("fohStaff");
  const bohStaff       = readField("bohStaff");
  const netRevenue     = readField("netRevenue");
  const cardTips       = readField("cardTips");
  const cashTips       = readField("cashTips");
  const surchargeTips  = readField("surchargeTips");
  const productionAmt  = readField("productionAmount");
  const discounts      = readField("discounts");

  // --- Narrative fields (only include sections with content) ---
  const shiftSummary   = readField("shiftSummary");
  const guestsOfNote   = readField("guestsOfNote");
  const goodNotes      = readField("goodNotes");
  const issues         = readField("issues");
  const kitchenNotes   = readField("kitchenNotes");
  const wastageComps   = readField("wastageComps");
  const maintenance    = readField("maintenance");
  const rsaIncidents   = readField("rsaIncidents");

  // --- To-Do items ---
  const todoTaskValues = getFieldValues(sheet, "todoTasks");
  const todoAssignValues = getFieldValues(sheet, "todoAssignees");
  const todoLines = [];

  for (let i = 0; i < todoTaskValues.length; i++) {
    const taskText = (todoTaskValues[i][0] || "").toString().trim();
    const assignee = (todoAssignValues[i] ? todoAssignValues[i][0] || "" : "").toString().trim();
    if (taskText) {
      todoLines.push(assignee ? "\u2022 *" + assignee + ":* " + taskText : "\u2022 _Unassigned:_ " + taskText);
    }
  }

  // --- AI Shift Summary (non-blocking) ---
  let aiSummary = null;
  try {
    const shiftDataForAI = {
      date: dateStr,
      day: dayStr,
      mod: modText,
      netRevenue: netRevenue,
      cardTips: cardTips,
      cashTips: cashTips,
      surchargeTips: surchargeTips,
      fohStaff: fohStaff,
      bohStaff: bohStaff,
      shiftSummary: shiftSummary,
      guestsOfNote: guestsOfNote,
      goodNotes: goodNotes,
      issues: issues,
      kitchenNotes: kitchenNotes,
      todoCount: todoLines.length
    };
    aiSummary = generateShiftSummary_Sakura(shiftDataForAI);
  } catch (e) {
    Logger.log('AI Insights (Sakura): generateShiftSummary_Sakura failed (non-blocking): ' + e.message);
  }

  // --- Build links ---
  const spreadsheetId = spreadsheet.getId();
  const sheetId = sheet.getSheetId();
  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
    `format=pdf&gid=${sheetId}&size=A4&portrait=true&fitw=true&top_margin=0.5&bottom_margin=0.5` +
    `&left_margin=0.5&right_margin=0.5&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false`;

  const emailAddresses = Object.keys(getSakuraRecipientsMap_());
  const mailto = emailAddresses.length > 0 ? `mailto:${emailAddresses.join(',')}` : "";

  // ===== BUILD BLOCK KIT MESSAGE =====
  const blocks = [];

  // --- Header ---
  blocks.push(bk_header("Sakura House \u2014 Nightly Shift Report"));

  // --- Metadata line ---
  const metaParts = [dayStr + " " + dateStr, "MOD: " + modText];
  if (fohStaff) metaParts.push("FOH: " + fohStaff);
  if (bohStaff) metaParts.push("BOH: " + bohStaff);
  blocks.push(bk_context(metaParts));

  // --- Financial Dashboard ---
  blocks.push(bk_divider());
  const finFields = [["Net Revenue", fmtAUD(netRevenue)]];
  if (productionAmt) finFields.push(["Production", fmtAUD(productionAmt)]);
  // Tips breakdown
  const tipParts = [];
  if (cardTips) tipParts.push("Card " + fmtAUD(cardTips));
  if (cashTips) tipParts.push("Cash " + fmtAUD(cashTips));
  if (surchargeTips) tipParts.push("Surcharge " + fmtAUD(surchargeTips));
  if (tipParts.length > 0) finFields.push(["Tips", tipParts.join(" / ")]);
  if (discounts) finFields.push(["Discounts", fmtAUD(discounts)]);
  blocks.push(bk_fields(finFields));

  // --- Shift Summary (always shown) ---
  blocks.push(bk_divider());
  blocks.push(bk_section("*Shift Summary*\n" + (shiftSummary || "_No summary recorded._")));

  // --- Guests of Note (conditional) ---
  if (guestsOfNote) {
    blocks.push(bk_section("*Guests of Note*\n" + guestsOfNote));
  }

  // --- The Good (conditional) ---
  if (goodNotes) {
    blocks.push(bk_section("*The Good*\n" + goodNotes));
  }

  // --- Issues (conditional) ---
  if (issues) {
    blocks.push(bk_section("*Issues*\n" + issues));
  }

  // --- Kitchen Notes (conditional) ---
  if (kitchenNotes) {
    blocks.push(bk_section("*Kitchen Notes*\n" + kitchenNotes));
  }

  // --- To-Do's ---
  blocks.push(bk_divider());
  if (todoLines.length > 0) {
    blocks.push(bk_section("*To-Do's* (" + todoLines.length + ")\n" + todoLines.join("\n")));
  } else {
    blocks.push(bk_section("*To-Do's*\n_No tasks recorded._"));
  }

  // --- Incidents (conditional — wastage, maintenance, RSA) ---
  if (wastageComps || maintenance || rsaIncidents) {
    blocks.push(bk_divider());
    const incidentLines = [];
    if (wastageComps)  incidentLines.push(":warning: *Wastage/Comps:* " + wastageComps);
    if (maintenance)   incidentLines.push(":wrench: *Maintenance:* " + maintenance);
    if (rsaIncidents)  incidentLines.push(":shield: *RSA/Incidents:* " + rsaIncidents);
    blocks.push(bk_context(incidentLines));
  }

  // --- AI Summary (conditional — only shown when API call succeeded) ---
  if (aiSummary) {
    blocks.push(bk_divider());
    blocks.push(bk_section("*AI Summary*\n" + aiSummary));
  }

  // --- Action buttons ---
  const linkButtons = [{ text: "View PDF", url: exportUrl, style: "primary" }];
  if (mailto) linkButtons.push({ text: "Email Staff", url: mailto });
  blocks.push(bk_buttons(linkButtons));

  // --- Footer ---
  blocks.push(bk_context(["Sakura House \u00b7 Shift Reports 3.0 \u00b7 " + dayStr + " " + dateStr]));

  const sent = bk_post(webhookUrl, blocks, "Sakura Shift Report: " + dayStr + " " + dateStr + " \u2014 MOD: " + modText + " \u2014 Revenue: " + fmtAUD(netRevenue));
  if (sent) {
    Logger.log("\u2705 Sakura Block Kit message sent for sheet: " + sheetName);
  }
  return sent;
}


// ============================================================================
// TO-DO AGGREGATION (Uses Named Ranges from Run.gs)
// ============================================================================

function buildTodoAggregationSheet_(spreadsheet) {
  const todoSheetName = "TO-DOs";

  let todoSheet = spreadsheet.getSheetByName(todoSheetName);
  if (!todoSheet) {
    todoSheet = spreadsheet.insertSheet(todoSheetName);
  }
  const lastClearRow = todoSheet.getLastRow();
  if (lastClearRow > 0) {
    todoSheet.getRange(1, 1, lastClearRow, Math.max(todoSheet.getLastColumn(), 3)).clearContent();
  }
  todoSheet.getRange(1, 1, 1, 3).setValues([["Day", "To-Do", "Assigned To"]]);

  const allSheets = spreadsheet.getSheets();

  // Collect all rows into a 2-D array first, then write in a single setValues() call.
  const rows = [];

  allSheets.forEach(s => {
    const sName = s.getName();
    const matchedDay = SAKURA_DAYS.find(day => sName.startsWith(day));
    if (!matchedDay) return;

    const todoValues = getFieldValues(s, "todoTasks");
    const assignValues = getFieldValues(s, "todoAssignees");

    for (let i = 0; i < todoValues.length; i++) {
      const todo = todoValues[i][0];
      const assignee = assignValues[i] ? assignValues[i][0] : "";
      if (todo && todo.toString().trim() !== "") {
        rows.push([sName, todo, assignee]);
      }
    }
  });

  if (rows.length > 0) {
    // Single Sheets write for all rows (replaces per-item appendRow calls).
    const dataRange = todoSheet.getRange(2, 1, rows.length, 3);
    dataRange.setValues(rows);
    dataRange.setWrap(true);
  }

  Logger.log("TO-DOs sheet rebuilt with " + rows.length + " items.");
}


// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generates PDF for a sheet (non-interactive, suitable for automation).
 * @param {Spreadsheet} spreadsheet
 * @param {Sheet} sheet
 * @param {string} filename
 * @returns {Blob|null} PDF blob or null on failure
 */
function generatePdfForSheet_NoUI_(spreadsheet, sheet, filename) {
  const spreadsheetId = spreadsheet.getId();
  const sheetId = sheet.getSheetId();
  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
    `format=pdf&gid=${sheetId}&size=A4&portrait=true&fitw=true&top_margin=0.5&bottom_margin=0.5` +
    `&left_margin=0.5&right_margin=0.5&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false`;

  try {
    const token = ScriptApp.getOAuthToken();
    const resp = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const pdfBlob = resp.getBlob().setName(filename);
    Logger.log(`PDF generated: ${filename} (${pdfBlob.getBytes().length} bytes)`);
    return pdfBlob;
  } catch (err) {
    Logger.log("PDF generation failed: " + err.message);
    return null;
  }
}

/**
 * Generates PDF for a sheet (interactive, with UI alerts).
 * @param {Spreadsheet} spreadsheet
 * @param {Sheet} sheet
 * @param {string} filename
 * @param {Ui} ui - SpreadsheetApp.getUi()
 * @returns {Blob|null} PDF blob or null on failure
 */
function generatePdfForSheet_(spreadsheet, sheet, filename, ui) {
  const pdfBlob = generatePdfForSheet_NoUI_(spreadsheet, sheet, filename);
  if (!pdfBlob && ui) {
    ui.alert("PDF generation failed. See logs for details.");
  }
  return pdfBlob;
}


// ============================================================================
// WEEKLY TO-DO SUMMARY
// ============================================================================

function sendWeeklyTodoSummary() {
  try {
    _sendWeeklyTodoSummaryCore(getSakuraSlackWebhookUrlLive_(), false);
  } catch (e) {
    notifyError_('sendWeeklyTodoSummary', e);
    Logger.log('sendWeeklyTodoSummary error: ' + e.message);
    throw e;
  }
}

function sendWeeklyTodoSummary_TestToSelf() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("TEST MODE: Weekly summary will post to your DM webhook only.");
  _sendWeeklyTodoSummaryCore(getSakuraSlackWebhookUrlTest_(), true);
}

function _sendWeeklyTodoSummaryCore(webhookUrl, isTest) {
  if (!webhookUrl) {
    Logger.log("Weekly summary webhook not configured.");
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const todoSheet = ss.getSheetByName("TO-DOs");
  const tz = Session.getScriptTimeZone() || "Australia/Sydney";

  if (!todoSheet) {
    Logger.log("TO-DOs sheet not found.");
    return;
  }

  const lastRow = todoSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No TO-DOs data to summarise.");
    return;
  }

  const data = todoSheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const staffMap = {};
  const staffOrder = [];
  let minDate = null;
  let maxDate = null;

  data.forEach(row => {
    const dayStr = (row[0] || "").toString().trim();
    const task = (row[1] || "").toString().trim();
    let staff = (row[2] || "").toString().trim();

    if (!task) return;

    if (!staff) staff = "General/Unallocated";

    if (!staffMap[staff]) {
      staffMap[staff] = [];
      staffOrder.push(staff);
    }

    staffMap[staff].push({ dayStr, task });

    const m = dayStr.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (m) {
      let [_, d, mo, yRaw] = m;
      let y = yRaw.length === 2 ? (Number(yRaw) < 50 ? "20" : "19") + yRaw : yRaw;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d));
      if (!isNaN(dt.getTime())) {
        if (!minDate || dt < minDate) minDate = dt;
        if (!maxDate || dt > maxDate) maxDate = dt;
      }
    }
  });

  if (staffOrder.length === 0) {
    Logger.log("No valid tasks found.");
    return;
  }

  staffOrder.sort((a, b) => {
    if (a === "General/Unallocated") return -1;
    if (b === "General/Unallocated") return 1;
    return a.localeCompare(b);
  });

  // Build Block Kit message
  const titlePrefix = isTest ? "TEST — " : "";
  const blocks = [
    bk_header(titlePrefix + "Sakura House — Weekly TO-DO Summary")
  ];

  if (minDate && maxDate) {
    blocks.push(bk_context([
      "Week: " + Utilities.formatDate(minDate, tz, "dd/MM") + " – " + Utilities.formatDate(maxDate, tz, "dd/MM")
    ]));
  }

  staffOrder.forEach(staff => {
    blocks.push(bk_divider());
    const taskLines = staffMap[staff].map(t =>
      t.dayStr ? "• " + t.task + " _(" + t.dayStr + ")_" : "• " + t.task
    );
    blocks.push(bk_section("*" + staff + "*\n" + taskLines.join("\n")));
  });

  const todoUrl = `https://docs.google.com/spreadsheets/d/${ss.getId()}/edit#gid=${todoSheet.getSheetId()}`;
  blocks.push(bk_divider());
  blocks.push(bk_buttons([{ text: "Open TO-DOs Sheet", url: todoUrl }]));

  const sent = bk_post(webhookUrl, blocks, titlePrefix + "Sakura Weekly TO-DO Summary");
  if (sent) {
    Logger.log(`Weekly summary sent (${isTest ? "TEST" : "LIVE"}).`);
  } else {
    Logger.log("Weekly summary error.");
  }
}
