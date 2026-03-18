/**
 * ============================================================================
 * NAMED RANGE UTILITIES — SAKURA HOUSE
 * ============================================================================
 *
 * Named range configuration, lookup helpers, diagnostics, and setup functions.
 * All other scripts read cell data via getFieldRange() / getFieldValue() etc.
 *
 * Naming convention: {DAY}_SR_{Suffix}
 *   e.g. MONDAY_SR_Date, TUESDAY_SR_NetRevenue
 *
 * Fallback behaviour: if a Named Range is missing, falls back to hardcoded
 * cell references and logs a warning. This keeps reports working while
 * the template is being updated.
 * ============================================================================
 */


// ============================================================================
// CONFIGURATION
// ============================================================================

const VALID_DAY_PREFIXES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/**
 * Maps logical field names to Named Range suffixes and fallback cell references.
 * Only fields the SCRIPT needs to READ are defined here.
 */
const FIELD_CONFIG = {
  // --- HEADER ---
  date: {
    suffix: "SR_Date",
    fallback: "B3:D3",
    isFormula: false,
    description: "Report date (merged cell)"
  },
  mod: {
    suffix: "SR_MOD",
    fallback: "B4:D4",
    isFormula: false,
    description: "Manager on Duty (merged cell)"
  },
  fohStaff: {
    suffix: "SR_FOHStaff",
    fallback: "B6:D6",
    isFormula: false,
    description: "FOH staff on shift"
  },
  bohStaff: {
    suffix: "SR_BOHStaff",
    fallback: "B7:D7",
    isFormula: false,
    description: "BOH staff on shift"
  },

  // --- CASH ---
  cashCount: {
    suffix: "SR_CashCount",
    fallback: "C10:E17",
    isFormula: false,
    description: "Cash count breakdown"
  },
  cashRecord: {
    suffix: "SR_CashRecord",
    fallback: "C22:D23",
    isFormula: false,
    description: "Cash record totals"
  },
  pettyCashTransactions: {
    suffix: "SR_PettyCashTransactions",
    fallback: "B40:B45",
    isFormula: false,
    description: "Petty cash transactions"
  },

  // --- FINANCIALS ---
  netRevenue: {
    suffix: "SR_NetRevenue",
    fallback: "B54",
    isFormula: true,
    description: "Net revenue less tips & accounts (formula — do not clear)"
  },

  // --- SHIFT REPORT ---
  shiftSummary: {
    suffix: "SR_ShiftSummary",
    fallback: "A59:D59",
    isFormula: false,
    description: "General overview / shift summary"
  },

  // --- TO-DO SECTION ---
  todoTasks: {
    suffix: "SR_TodoTasks",
    fallback: "A69:A84",
    isFormula: false,
    description: "To-do task descriptions — cells A69:C69 are merged; value lives in column A (first cell of merge)"
  },
  todoAssignees: {
    suffix: "SR_TodoAssignees",
    fallback: "D69:D84",
    isFormula: false,
    description: "To-do assignee dropdowns"
  },
  // todoFullRange was removed Feb 2026 — it was never read by any production function.
  // Tasks are read via todoTasks (A69:A84) and assignees via todoAssignees (D69:D84).
  // The full block is cleared implicitly when those two fields are cleared during rollover.

  // --- FINANCIAL DETAIL ---
  cashTips: {
    suffix: "SR_CashTips",
    fallback: "C29",
    isFormula: false,
    description: "Tips - Cash"
  },
  cardTips: {
    suffix: "SR_CardTips",
    fallback: "C30",
    isFormula: false,
    description: "Tips - Card"
  },
  surchargeTips: {
    suffix: "SR_SurchargeTips",
    fallback: "C31",
    isFormula: false,
    description: "Tips - Surcharge"
  },
  productionAmount: {
    suffix: "SR_ProductionAmount",
    fallback: "B37",
    isFormula: false,
    description: "Production amount (from Lightspeed)"
  },
  deposit: {
    suffix: "SR_Deposit",
    fallback: "B38",
    isFormula: false,
    description: "Deposit / revenue outside Lightspeed"
  },
  discounts: {
    suffix: "SR_Discounts",
    fallback: "B50",
    isFormula: false,
    description: "Total discounts (from Lightspeed)"
  },

  // --- CONTENT SECTIONS ---
  guestsOfNote: {
    suffix: "SR_GuestsOfNote",
    fallback: "A61:D61",
    isFormula: false,
    description: "Guest of note - VIPs, regulars"
  },
  goodNotes: {
    suffix: "SR_GoodNotes",
    fallback: "A63:D63",
    isFormula: false,
    description: "Good notes - positive feedback"
  },
  issues: {
    suffix: "SR_Issues",
    fallback: "A65:D65",
    isFormula: false,
    description: "Issues / improvements"
  },
  kitchenNotes: {
    suffix: "SR_KitchenNotes",
    fallback: "A67:D67",
    isFormula: false,
    description: "Kitchen notes (from chef)"
  },
  wastageComps: {
    suffix: "SR_WastageComps",
    fallback: "A86:D86",
    isFormula: false,
    description: "Wastage / comps / discounts"
  },
  maintenance: {
    suffix: "SR_Maintenance",
    fallback: "A88:D88",
    isFormula: false,
    description: "Maintenance items"
  },
  rsaIncidents: {
    suffix: "SR_RSAIncidents",
    fallback: "A90:D90",
    isFormula: false,
    description: "RSA / intox / refusals"
  }
};

// Track which fallbacks have been used (to avoid log spam)
const _fallbackWarnings = new Set();


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts the day prefix from a sheet name.
 * "MONDAY 24/11/2025" -> "MONDAY"
 * "Instructions" -> null
 */
function extractDayPrefix(sheetName) {
  for (const day of VALID_DAY_PREFIXES) {
    if (sheetName.startsWith(day)) {
      return day;
    }
  }
  return null;
}

/**
 * Builds the full Named Range name for a field on a specific day.
 * "MONDAY" + "SR_Date" -> "MONDAY_SR_Date"
 */
function buildNamedRangeName(dayPrefix, suffix) {
  return `${dayPrefix}_${suffix}`;
}

/**
 * Gets a range by Named Range name, falling back to hardcoded reference.
 *
 * @param {Sheet} sheet - The sheet to get the range from
 * @param {string} fieldKey - Key from FIELD_CONFIG (e.g., "date", "netRevenue")
 * @returns {Range} - The Google Sheets Range object
 */
function getFieldRange(sheet, fieldKey) {
  const config = FIELD_CONFIG[fieldKey];
  if (!config) {
    throw new Error(`Unknown field key: ${fieldKey}. Check FIELD_CONFIG.`);
  }

  const spreadsheet = sheet.getParent();
  const sheetName = sheet.getName();
  const dayPrefix = extractDayPrefix(sheetName);

  if (!dayPrefix) {
    return sheet.getRange(config.fallback);
  }

  const namedRangeName = buildNamedRangeName(dayPrefix, config.suffix);

  try {
    const namedRange = spreadsheet.getRangeByName(namedRangeName);

    if (namedRange) {
      const rangeSheet = namedRange.getSheet();
      if (rangeSheet.getSheetId() === sheet.getSheetId()) {
        return namedRange;
      } else {
        Logger.log(`Named Range "${namedRangeName}" exists but points to wrong sheet. Using fallback.`);
      }
    }
  } catch (e) {
    Logger.log(`Named range lookup error for ${namedRangeName}: ${e.message}`);
  }

  const warningKey = `${sheetName}:${fieldKey}`;
  if (!_fallbackWarnings.has(warningKey)) {
    Logger.log(`Named Range "${namedRangeName}" not found. Using fallback: ${config.fallback}`);
    _fallbackWarnings.add(warningKey);
  }

  return sheet.getRange(config.fallback);
}

/**
 * Gets the display value from a field (handles merged cells).
 */
function getFieldDisplayValue(sheet, fieldKey) {
  const range = getFieldRange(sheet, fieldKey);
  return range.getDisplayValue().trim();
}

/**
 * Gets the raw value from a field (useful for dates).
 */
function getFieldValue(sheet, fieldKey) {
  const range = getFieldRange(sheet, fieldKey);
  return range.getValue();
}

/**
 * Gets all values from a multi-cell range field.
 */
function getFieldValues(sheet, fieldKey) {
  const range = getFieldRange(sheet, fieldKey);
  return range.getValues();
}


// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Check which Named Ranges exist on a sheet.
 */
function checkNamedRangesOnSheet(sheet) {
  const results = {};
  const sheetName = sheet.getName();
  const spreadsheet = sheet.getParent();
  const dayPrefix = extractDayPrefix(sheetName);

  if (!dayPrefix) {
    return { error: `"${sheetName}" is not a day sheet (must start with MONDAY, TUESDAY, etc.)` };
  }

  for (const [fieldKey, config] of Object.entries(FIELD_CONFIG)) {
    const namedRangeName = buildNamedRangeName(dayPrefix, config.suffix);
    let found = false;
    let location = null;
    let correctSheet = false;

    try {
      const range = spreadsheet.getRangeByName(namedRangeName);
      if (range) {
        found = true;
        location = range.getA1Notation();
        correctSheet = (range.getSheet().getSheetId() === sheet.getSheetId());
      }
    } catch (e) {
      // Not found
    }

    results[fieldKey] = {
      namedRange: namedRangeName,
      found: found,
      location: location,
      correctSheet: correctSheet,
      fallback: config.fallback,
      description: config.description
    };
  }

  return results;
}

/**
 * Menu function: Run diagnostics on the active sheet's Named Ranges.
 */
function diagnoseNamedRanges() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  const results = checkNamedRangesOnSheet(sheet);

  if (results.error) {
    ui.alert("Diagnostic Error", results.error, ui.ButtonSet.OK);
    return;
  }

  let message = `Named Range Status for "${sheetName}":\n\n`;
  let allFound = true;
  let allCorrect = true;

  for (const [fieldKey, status] of Object.entries(results)) {
    let icon;
    if (status.found && status.correctSheet) {
      icon = "OK";
    } else if (status.found && !status.correctSheet) {
      icon = "WARN";
      allCorrect = false;
    } else {
      icon = "MISSING";
      allFound = false;
    }

    message += `${icon} ${status.namedRange}\n`;
    if (status.found) {
      message += `   Location: ${status.location}`;
      if (!status.correctSheet) {
        message += " (WRONG SHEET!)";
      }
      message += "\n";
    } else {
      message += `   Missing! Fallback: ${status.fallback}\n`;
    }
  }

  if (allFound && allCorrect) {
    message += "\nAll Named Ranges configured correctly!";
  } else if (!allFound) {
    message += "\nSome Named Ranges missing. Run 'Create Named Ranges' or create manually.";
  } else {
    message += "\nSome Named Ranges point to wrong sheet. Check template configuration.";
  }

  ui.alert("Named Range Diagnostics", message, ui.ButtonSet.OK);
  Logger.log(message);
}

/**
 * Diagnose Named Ranges across ALL day sheets at once.
 */
function diagnoseAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  let message = "NAMED RANGE STATUS - ALL SHEETS\n";
  message += "================================\n\n";

  for (const dayPrefix of VALID_DAY_PREFIXES) {
    const allSheets = spreadsheet.getSheets();
    const daySheet = allSheets.find(s => s.getName().startsWith(dayPrefix));

    if (!daySheet) {
      message += `${dayPrefix}: Sheet not found\n\n`;
      continue;
    }

    const sheetName = daySheet.getName();
    message += `${sheetName}:\n`;

    const results = checkNamedRangesOnSheet(daySheet);
    let allGood = true;

    for (const [fieldKey, status] of Object.entries(results)) {
      if (!status.found) {
        message += `  MISSING ${status.namedRange}\n`;
        allGood = false;
      } else if (!status.correctSheet) {
        message += `  WARN ${status.namedRange} - Wrong sheet\n`;
        allGood = false;
      }
    }

    if (allGood) {
      message += `  All ${Object.keys(results).length} ranges OK\n`;
    }
    message += "\n";
  }

  ui.alert("All Sheets Diagnostic", message, ui.ButtonSet.OK);
  Logger.log(message);
}


// ============================================================================
// SETUP HELPERS: Create Named Ranges
// ============================================================================

/**
 * Creates all expected Named Ranges on a single sheet using fallback locations.
 */
function createNamedRangesOnSheet_(sheet, spreadsheet) {
  const sheetName = sheet.getName();
  const dayPrefix = extractDayPrefix(sheetName);

  if (!dayPrefix) {
    return { error: `"${sheetName}" is not a day sheet`, created: 0, skipped: 0, details: [] };
  }

  let created = 0;
  let skipped = 0;
  const details = [];

  for (const [fieldKey, config] of Object.entries(FIELD_CONFIG)) {
    const namedRangeName = buildNamedRangeName(dayPrefix, config.suffix);

    try {
      const existing = spreadsheet.getRangeByName(namedRangeName);
      if (existing && existing.getSheet().getSheetId() === sheet.getSheetId()) {
        skipped++;
        details.push(`SKIP ${namedRangeName}: already exists at ${existing.getA1Notation()}`);
        continue;
      }
      if (existing) {
        details.push(`UPDATE ${namedRangeName}: was on wrong sheet`);
      }
    } catch (e) {
      // Doesn't exist, we'll create it
    }

    try {
      const range = sheet.getRange(config.fallback);
      spreadsheet.setNamedRange(namedRangeName, range);
      created++;
      details.push(`CREATED ${namedRangeName}: ${config.fallback}`);
    } catch (e) {
      details.push(`FAILED ${namedRangeName}: ${e.message}`);
    }
  }

  return { created, skipped, details };
}

/**
 * Menu function: Create Named Ranges on the active sheet.
 */
function createNamedRangesOnActiveSheet() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const spreadsheet = sheet.getParent();
  const sheetName = sheet.getName();

  const dayPrefix = extractDayPrefix(sheetName);
  if (!dayPrefix) {
    ui.alert(
      "Invalid Sheet",
      `"${sheetName}" is not a day sheet.\n\nThis function only works on sheets starting with MONDAY, TUESDAY, etc.`,
      ui.ButtonSet.OK
    );
    return;
  }

  const response = ui.alert(
    "Create Named Ranges",
    `This will create Named Ranges on "${sheetName}" using default locations.\n\n` +
    `Existing Named Ranges will be skipped.\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert("Cancelled.");
    return;
  }

  const results = createNamedRangesOnSheet_(sheet, spreadsheet);

  const message = `Setup Complete for ${sheetName}\n\n` +
    `Created: ${results.created}\nSkipped: ${results.skipped}\n\n` +
    results.details.join("\n");

  ui.alert("Setup Results", message, ui.ButtonSet.OK);
  Logger.log(message);
}

/**
 * Menu function: Create Named Ranges on ALL day sheets.
 */
function createNamedRangesOnAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const response = ui.alert(
    "Create Named Ranges on ALL Sheets",
    `This will create Named Ranges on all day sheets (MONDAY-SATURDAY) using default locations.\n\n` +
    `Existing Named Ranges will be skipped.\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert("Cancelled.");
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  const allSheets = spreadsheet.getSheets();
  const summary = [];

  for (const dayPrefix of VALID_DAY_PREFIXES) {
    const daySheet = allSheets.find(s => s.getName().startsWith(dayPrefix));

    if (!daySheet) {
      summary.push(`${dayPrefix}: Sheet not found`);
      continue;
    }

    const results = createNamedRangesOnSheet_(daySheet, spreadsheet);
    totalCreated += results.created;
    totalSkipped += results.skipped;

    summary.push(`${daySheet.getName()}: ${results.created} created, ${results.skipped} skipped`);
  }

  const message = `Named Ranges Setup Complete\n\n` +
    `Total Created: ${totalCreated}\nTotal Skipped: ${totalSkipped}\n\n` +
    summary.join("\n");

  ui.alert("All Sheets Setup Results", message, ui.ButtonSet.OK);
  Logger.log(message);
}


/**
 * Menu function: Force-update all Named Ranges on ALL day sheets.
 *
 * Unlike createNamedRangesOnAllSheets(), this OVERWRITES existing named ranges
 * with the current fallback locations from FIELD_CONFIG. Use after updating
 * fallback cell references (e.g. widening B→A:D).
 */
function forceUpdateNamedRangesOnAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const response = ui.alert(
    "Force Update Named Ranges (ALL Sheets)",
    `This will OVERWRITE all Named Ranges on all day sheets (MONDAY–SATURDAY)\n` +
    `using the current default locations from FIELD_CONFIG.\n\n` +
    `Existing ranges will be updated, not skipped.\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert("Cancelled.");
    return;
  }

  let totalUpdated = 0;
  let totalFailed = 0;
  const allSheets = spreadsheet.getSheets();
  const summary = [];

  for (const dayPrefix of VALID_DAY_PREFIXES) {
    const daySheet = allSheets.find(s => s.getName().startsWith(dayPrefix));

    if (!daySheet) {
      summary.push(`${dayPrefix}: Sheet not found`);
      continue;
    }

    let updated = 0;
    let failed = 0;

    for (const [fieldKey, config] of Object.entries(FIELD_CONFIG)) {
      const namedRangeName = buildNamedRangeName(dayPrefix, config.suffix);
      try {
        const range = daySheet.getRange(config.fallback);
        spreadsheet.setNamedRange(namedRangeName, range);
        updated++;
      } catch (e) {
        failed++;
        Logger.log(`FAILED ${namedRangeName}: ${e.message}`);
      }
    }

    totalUpdated += updated;
    totalFailed += failed;
    summary.push(`${daySheet.getName()}: ${updated} updated, ${failed} failed`);
  }

  const message = `Named Ranges Force-Update Complete\n\n` +
    `Total Updated: ${totalUpdated}\nTotal Failed: ${totalFailed}\n\n` +
    summary.join("\n");

  ui.alert("Force-Update Results", message, ui.ButtonSet.OK);
  Logger.log(message);
}


// ============================================================================
// SHEET PROTECTION
// ============================================================================

/**
 * Returns an array of all FIELD_CONFIG keys. Sakura's FIELD_CONFIG does not
 * use an isFormula flag to exclude formula cells from editable/clearable lists.
 * This mirrors getClearableFieldKeys_() in RunWaratah.js.
 *
 * @returns {string[]}
 */
function getAllFieldKeys_() {
  return Object.keys(FIELD_CONFIG).filter(key => !FIELD_CONFIG[key].isFormula);
}

/**
 * Applies whole-sheet protection to a single day sheet.
 * Protects structural cells (headers, labels, formulas) while leaving
 * all FIELD_CONFIG input fields fully editable.
 *
 * Restricts editing of protected areas to the configured owner email only
 * (SHEET_PROTECTION_OWNER_EMAIL Script Property). GAS scripts bypass sheet
 * protection regardless — rollover, clearContent, triggers are unaffected.
 *
 * @param {Sheet} sheet
 */
function setupSheetProtection_(sheet) {
  // Remove any existing protections on this sheet
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  existing.forEach(p => p.remove());

  // Protect the whole sheet — only configured editor can modify protected areas
  const protection = sheet.protect().setDescription('Shift Report Structure');

  // Restrict editing to owner only (read from Script Properties for configurability)
  const ownerEmail = PropertiesService.getScriptProperties().getProperty('SHEET_PROTECTION_OWNER_EMAIL')
    || Session.getEffectiveUser().getEmail();
  protection.addEditor(ownerEmail);
  const editors = protection.getEditors();
  const othersToRemove = editors.filter(u => u.getEmail() !== ownerEmail);
  if (othersToRemove.length > 0) {
    protection.removeEditors(othersToRemove);
  }
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }

  // Build editable ranges from non-formula FIELD_CONFIG entries only
  // getAllFieldKeys_() filters out isFormula:true fields (e.g. netRevenue B54)
  const inputKeys = getAllFieldKeys_();
  const editableRanges = inputKeys.map(key => getFieldRange(sheet, key));

  protection.setUnprotectedRanges(editableRanges);
  Logger.log(`Protection set on "${sheet.getName()}": ${editableRanges.length} editable ranges carved out, editing restricted to ${ownerEmail}`);
}

/**
 * Menu function: Apply sheet protection to all day sheets (MONDAY–SATURDAY).
 * Loops VALID_DAY_PREFIXES, finds each sheet, and calls setupSheetProtection_().
 * Password-gated via pw_setupAllSheetsProtection() in MenuSakura.gs.
 */
function setupAllSheetsProtection() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = spreadsheet.getSheets();
  const summary = [];

  for (const dayPrefix of VALID_DAY_PREFIXES) {
    const sheet = allSheets.find(s => s.getName().startsWith(dayPrefix));
    if (!sheet) {
      summary.push(`${dayPrefix}: sheet not found — skipped`);
      continue;
    }
    try {
      setupSheetProtection_(sheet);
      summary.push(`${sheet.getName()}: protection applied`);
    } catch (e) {
      summary.push(`${sheet.getName()}: FAILED — ${e.message}`);
      Logger.log(`setupAllSheetsProtection: failed on ${sheet.getName()}: ${e.message}`);
    }
  }

  const message = `Sheet Protection Setup Complete\n\n${summary.join('\n')}`;
  try {
    SpreadsheetApp.getUi().alert('Protection Applied', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(message);
  }
}

/**
 * Menu function: Remove all sheet protections from all day sheets.
 * Use before bulk edits or if protection configuration needs to be
 * rebuilt from scratch.
 * Password-gated via pw_removeAllSheetsProtection() in MenuSakura.gs.
 */
function removeAllSheetsProtection() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = spreadsheet.getSheets();
  let removed = 0;
  const summary = [];

  for (const dayPrefix of VALID_DAY_PREFIXES) {
    const sheet = allSheets.find(s => s.getName().startsWith(dayPrefix));
    if (!sheet) continue;

    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(p => { p.remove(); removed++; });
    summary.push(protections.length > 0
      ? `${sheet.getName()}: ${protections.length} protection(s) removed`
      : `${sheet.getName()}: no protections found`);
  }

  const message = `Removed ${removed} protection(s)\n\n${summary.join('\n')}`;
  try {
    SpreadsheetApp.getUi().alert('Protections Removed', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(message);
  }
}


// ============================================================================
// NAMED RANGE HEALTH MONITOR
// ============================================================================

/**
 * Verifies all 144 expected Named Ranges (24 fields × 6 day sheets) exist
 * and point to non-empty cells.
 *
 * Categorises each range as:
 *   OK      — exists and the cell it points to is non-empty
 *   EMPTY   — exists but the cell is blank (may be normal mid-week)
 *   MISSING — not found in the spreadsheet at all
 *
 * Posts a structured Block Kit report to SAKURA_SLACK_WEBHOOK_TEST.
 * Safe to call from trigger context — no UI calls.
 *
 * @returns {{ ok: number, empty: number, missing: number }}
 */
function namedRangeHealthCheck_Sakura() {
  var EXPECTED_TOTAL = VALID_DAY_PREFIXES.length * Object.keys(FIELD_CONFIG).length;
  Logger.log('namedRangeHealthCheck_Sakura: checking ' + EXPECTED_TOTAL + ' ranges (' +
    VALID_DAY_PREFIXES.length + ' days x ' + Object.keys(FIELD_CONFIG).length + ' fields)');

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = spreadsheet.getSheets();

  var totalOk = 0;
  var totalEmpty = 0;
  var totalMissing = 0;

  var missingRanges = [];
  var emptyRanges = [];
  var dayResults = [];

  for (var di = 0; di < VALID_DAY_PREFIXES.length; di++) {
    var dayPrefix = VALID_DAY_PREFIXES[di];
    var daySheet = null;
    for (var si = 0; si < allSheets.length; si++) {
      if (allSheets[si].getName().startsWith(dayPrefix)) {
        daySheet = allSheets[si];
        break;
      }
    }

    var dayOk = 0;
    var dayEmpty = 0;
    var dayMissing = 0;

    if (!daySheet) {
      var fieldCount = Object.keys(FIELD_CONFIG).length;
      dayMissing = fieldCount;
      totalMissing += fieldCount;
      dayResults.push({ day: dayPrefix, ok: 0, empty: 0, missing: fieldCount, sheetMissing: true });
      Logger.log('namedRangeHealthCheck_Sakura: ' + dayPrefix + ' sheet not found');
      continue;
    }

    var fieldKeys = Object.keys(FIELD_CONFIG);
    for (var fi = 0; fi < fieldKeys.length; fi++) {
      var config = FIELD_CONFIG[fieldKeys[fi]];
      var rangeName = buildNamedRangeName(dayPrefix, config.suffix);

      var namedRange = null;
      try {
        namedRange = spreadsheet.getRangeByName(rangeName);
      } catch (e) {
        // treat as missing
      }

      if (!namedRange) {
        dayMissing++;
        totalMissing++;
        if (missingRanges.length < 10) missingRanges.push(rangeName);
        continue;
      }

      if (namedRange.getSheet().getSheetId() !== daySheet.getSheetId()) {
        dayMissing++;
        totalMissing++;
        if (missingRanges.length < 10) missingRanges.push(rangeName + ' (wrong sheet)');
        continue;
      }

      var displayVal = namedRange.getDisplayValue().trim();
      if (displayVal === '' || displayVal === '0') {
        if (config.isFormula) {
          dayOk++;
          totalOk++;
        } else {
          dayEmpty++;
          totalEmpty++;
          if (emptyRanges.length < 10) emptyRanges.push(rangeName);
        }
      } else {
        dayOk++;
        totalOk++;
      }
    }

    dayResults.push({ day: dayPrefix, ok: dayOk, empty: dayEmpty, missing: dayMissing, sheetMissing: false });
    Logger.log('namedRangeHealthCheck_Sakura: ' + dayPrefix +
      ' — OK:' + dayOk + ' EMPTY:' + dayEmpty + ' MISSING:' + dayMissing);
  }

  Logger.log('namedRangeHealthCheck_Sakura: TOTAL — OK:' + totalOk +
    ' EMPTY:' + totalEmpty + ' MISSING:' + totalMissing);

  try {
    var webhook = getSakuraSlackWebhookTest_();
    if (webhook) {
      var blocks = buildHealthCheckBlocks_Sakura_(dayResults, totalOk, totalEmpty, totalMissing,
        EXPECTED_TOTAL, missingRanges, emptyRanges);
      bk_post(webhook, blocks, 'Sakura Named Range Health: OK=' + totalOk +
        ' EMPTY=' + totalEmpty + ' MISSING=' + totalMissing);
    }
  } catch (slackErr) {
    Logger.log('namedRangeHealthCheck_Sakura: Slack post failed — ' + slackErr.message);
  }

  return { ok: totalOk, empty: totalEmpty, missing: totalMissing };
}

/**
 * Builds Block Kit blocks for the Named Range Health report — Sakura House.
 * Called only by namedRangeHealthCheck_Sakura().
 *
 * @param {Array<Object>} dayResults
 * @param {number} totalOk
 * @param {number} totalEmpty
 * @param {number} totalMissing
 * @param {number} expectedTotal
 * @param {string[]} missingRanges  — up to 10 missing range names
 * @param {string[]} emptyRanges    — up to 10 empty range names
 * @returns {Array<Object>} Block Kit blocks
 */
function buildHealthCheckBlocks_Sakura_(dayResults, totalOk, totalEmpty, totalMissing,
    expectedTotal, missingRanges, emptyRanges) {

  var timestamp = Utilities.formatDate(new Date(), 'Australia/Sydney', 'dd/MM/yyyy HH:mm');
  var blocks = [];

  blocks.push(bk_header('Named Range Health — Sakura House'));

  if (totalMissing === 0 && totalEmpty === 0) {
    blocks.push(bk_section('All ' + expectedTotal + ' named ranges are healthy.'));
    blocks.push(bk_context([timestamp + ' | ' + expectedTotal + '/' + expectedTotal + ' OK']));
    return blocks;
  }

  var statusIcon = totalMissing > 0 ? 'ISSUES FOUND' : 'REVIEW';
  blocks.push(bk_section('*' + statusIcon + '* — ' +
    totalOk + ' OK | ' + totalEmpty + ' empty | ' + totalMissing + ' missing ' +
    '(of ' + expectedTotal + ' expected)'));

  blocks.push(bk_divider());

  var pairs = dayResults.map(function(r) {
    if (r.sheetMissing) {
      return [r.day, 'Sheet not found'];
    }
    var icon = (r.missing > 0) ? 'MISSING ' + r.missing :
               (r.empty > 0)   ? 'EMPTY ' + r.empty : 'All OK';
    return [r.day, icon + ' | OK: ' + r.ok];
  });
  blocks.push(bk_fields(pairs));

  blocks.push(bk_divider());

  if (missingRanges.length > 0) {
    var missingText = '*Missing ranges* (' + missingRanges.length +
      (missingRanges.length === 10 ? '+' : '') + '):\n' +
      missingRanges.map(function(r) { return '• ' + r; }).join('\n');
    blocks.push(bk_section(missingText));
  }

  if (emptyRanges.length > 0) {
    var emptyText = '*Empty ranges* (' + emptyRanges.length +
      (emptyRanges.length === 10 ? '+' : '') + '):\n' +
      emptyRanges.map(function(r) { return '• ' + r; }).join('\n');
    blocks.push(bk_section(emptyText));
  }

  blocks.push(bk_context([timestamp + ' | Run from Sakura House Shift Reports']));

  return blocks;
}
