/**
 * ============================================================================
 * NAMED RANGE UTILITIES — THE WARATAH
 * ============================================================================
 *
 * Named range configuration, lookup helpers, diagnostics, and setup functions.
 * All other scripts read cell data via getFieldRange() / getFieldValue() etc.
 *
 * Naming convention: {DAY}_SR_{Suffix}
 *   e.g. WEDNESDAY_SR_Date, FRIDAY_SR_NetRevenue
 *
 * Fallback behaviour: if a Named Range is missing, falls back to hardcoded
 * cell references and logs a warning. This keeps reports working while
 * named ranges are being set up or after accidental deletion.
 *
 * Key Waratah difference from Sakura: each FIELD_CONFIG entry has an
 * isFormula flag. Formula cells must never be cleared during rollover.
 * getClearableFieldKeys_() uses this flag to auto-derive the safe list.
 * ============================================================================
 */


// ============================================================================
// CONFIGURATION
// ============================================================================

const VALID_DAY_PREFIXES = ["WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/**
 * Maps logical field names to Named Range suffixes, fallback cell references,
 * formula status, and descriptions.
 *
 * isFormula: true  → cell contains a formula; NEVER clear during rollover
 * isFormula: false → input cell; safe to clearContent() during rollover
 *
 * Only fields the SCRIPT needs to READ or CLEAR are defined here.
 */
const FIELD_CONFIG = {

  // --- HEADER ---
  date: {
    suffix: "SR_Date",
    fallback: "B3:F3",
    isFormula: false,
    description: "Report date (merged B3:F3)"
  },
  mod: {
    suffix: "SR_MOD",
    fallback: "B4:F4",
    isFormula: false,
    description: "Manager on Duty (merged B4:F4)"
  },
  staff: {
    suffix: "SR_Staff",
    fallback: "B5:F5",
    isFormula: false,
    description: "Staff on shift (merged B5:F5)"
  },

  // --- REVENUE & PRODUCTION ---
  productionAmount: {
    suffix: "SR_ProductionAmount",
    fallback: "B8",
    isFormula: false,
    description: "Production amount from Lightspeed (input)"
  },
  deposit: {
    suffix: "SR_Deposit",
    fallback: "B9:B10",
    isFormula: false,
    description: "Deposit"
  },
  airbnbCovers: {
    suffix: "SR_AirbnbCovers",
    fallback: "B11",
    isFormula: false,
    description: "Airbnb covers"
  },
  cancellations: {
    suffix: "SR_Cancellations",
    fallback: "B13:B14",
    isFormula: false,
    description: "Cancellations"
  },

  // --- CASH FLOW (formula cells — read only, do NOT clear) ---
  cashTakings: {
    suffix: "SR_CashTakings",
    fallback: "B15",
    isFormula: true,
    description: "Cash takings (formula — do not clear)"
  },
  grossSalesIncCash: {
    suffix: "SR_GrossSalesIncCash",
    fallback: "B16",
    isFormula: true,
    description: "Gross sales inc cash (formula — do not clear)"
  },

  // --- DEDUCTIONS (merged pairs — value lives in first cell) ---
  cashReturns: {
    suffix: "SR_CashReturns",
    fallback: "B17:B18",
    isFormula: false,
    description: "Cash returns (merged B17:B18 — value in B17)"
  },
  cdDiscount: {
    suffix: "SR_CDDiscount",
    fallback: "B19:B20",
    isFormula: false,
    description: "CD discount (merged B19:B20 — value in B19)"
  },
  refunds: {
    suffix: "SR_Refunds",
    fallback: "B21:B22",
    isFormula: false,
    description: "Refunds (merged B21:B22 — value in B21)"
  },
  cdRedeem: {
    suffix: "SR_CDRedeem",
    fallback: "B23:B24",
    isFormula: false,
    description: "CD redeem (merged B23:B24 — value in B23)"
  },
  totalDiscount: {
    suffix: "SR_TotalDiscount",
    fallback: "B25",
    isFormula: false,
    description: "Total discount (input)"
  },

  // --- CALCULATED DEDUCTIONS (formula cells — read only, do NOT clear) ---
  discountsCompsExcCD: {
    suffix: "SR_DiscountsCompsExcCD",
    fallback: "B26",
    isFormula: true,
    description: "Discounts comps exc CD (formula — do not clear)"
  },
  grossTaxableSales: {
    suffix: "SR_GrossTaxableSales",
    fallback: "B27",
    isFormula: true,
    description: "Gross taxable sales (formula — do not clear)"
  },
  taxes: {
    suffix: "SR_Taxes",
    fallback: "B28",
    isFormula: true,
    description: "Taxes (formula — do not clear)"
  },
  netSalesWTips: {
    suffix: "SR_NetSalesWTips",
    fallback: "B29",
    isFormula: true,
    description: "Net sales with tips (formula — do not clear)"
  },

  // --- TIPS & CASH ---
  pettyCash: {
    suffix: "SR_PettyCash",
    fallback: "B30",
    isFormula: false,
    description: "Petty cash (input)"
  },
  cardTips: {
    suffix: "SR_CardTips",
    fallback: "B32",
    isFormula: false,
    description: "Card tips (input)"
  },
  cashTips: {
    suffix: "SR_CashTips",
    fallback: "B33",
    isFormula: false,
    description: "Cash tips (input)"
  },

  // --- NET REVENUE (formula — do NOT clear) ---
  netRevenue: {
    suffix: "SR_NetRevenue",
    fallback: "B34",
    isFormula: true,
    description: "Net revenue (formula — do not clear)"
  },

  // --- TOTAL TIPS (formula — do NOT clear) ---
  totalTips: {
    suffix: "SR_TotalTips",
    fallback: "B37",
    isFormula: true,
    description: "Total tips (formula — do not clear)"
  },

  // --- NARRATIVE (merged A:F — value lives in col A) ---
  shiftSummary: {
    suffix: "SR_ShiftSummary",
    fallback: "A43:F43",
    isFormula: false,
    description: "Shift summary (merged A43:F43 — value lives in column A)"
  },
  guestsOfNote: {
    suffix: "SR_GuestsOfNote",
    fallback: "A45:F45",
    isFormula: false,
    description: "Guests of note / VIPs (merged A45:F45)"
  },
  theGood: {
    suffix: "SR_TheGood",
    fallback: "A47:F47",
    isFormula: false,
    description: "The good (merged A47:F47)"
  },
  theBad: {
    suffix: "SR_TheBad",
    fallback: "A49:F49",
    isFormula: false,
    description: "The bad (merged A49:F49)"
  },
  kitchenNotes: {
    suffix: "SR_KitchenNotes",
    fallback: "A51:F51",
    isFormula: false,
    description: "Kitchen notes (merged A51:F51)"
  },

  // --- TASKS (9 rows: 53-61) ---
  todoTasks: {
    suffix: "SR_TodoTasks",
    fallback: "A53:E61",
    isFormula: false,
    description: "To-do task descriptions (merged A:E per row — value in col A)"
  },
  todoAssignees: {
    suffix: "SR_TodoAssignees",
    fallback: "F53:F61",
    isFormula: false,
    description: "To-do assignees (col F)"
  },

  // --- INCIDENTS & WASTAGE ---
  wastageComps: {
    suffix: "SR_WastageComps",
    fallback: "A63:F63",
    isFormula: false,
    description: "Wastage / comps (merged A63:F63)"
  },
  rsaIncidents: {
    suffix: "SR_RSAIncidents",
    fallback: "A65:F65",
    isFormula: false,
    description: "RSA incidents (merged A65:F65)"
  }
};

// Track which fallbacks have been warned (avoid log spam)
const _fallbackWarnings = new Set();


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts the day prefix from a sheet name.
 * "WEDNESDAY 19/03/2026" -> "WEDNESDAY"
 * "MASTER ACTIONABLES SHEET" -> null
 *
 * @param {string} sheetName
 * @returns {string|null}
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
 * "WEDNESDAY" + "SR_Date" -> "WEDNESDAY_SR_Date"
 *
 * @param {string} dayPrefix
 * @param {string} suffix
 * @returns {string}
 */
function buildNamedRangeName(dayPrefix, suffix) {
  return `${dayPrefix}_${suffix}`;
}

/**
 * Gets a Range by Named Range name, falling back to hardcoded cell reference.
 *
 * @param {Sheet} sheet - The sheet to get the range from
 * @param {string} fieldKey - Key from FIELD_CONFIG (e.g. "date", "netRevenue")
 * @returns {Range} - The Google Sheets Range object
 */
function getFieldRange(sheet, fieldKey) {
  const config = FIELD_CONFIG[fieldKey];
  if (!config) {
    throw new Error(`Unknown field key: "${fieldKey}". Check FIELD_CONFIG in RunWaratah.js.`);
  }

  const spreadsheet = sheet.getParent();
  const sheetName = sheet.getName();
  const dayPrefix = extractDayPrefix(sheetName);

  // Non-day sheets (e.g. MASTER ACTIONABLES SHEET): skip named range lookup
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

  // Log warning once per sheet+field combo
  const warningKey = `${sheetName}:${fieldKey}`;
  if (!_fallbackWarnings.has(warningKey)) {
    Logger.log(`Named Range "${namedRangeName}" not found. Using fallback: ${config.fallback}`);
    _fallbackWarnings.add(warningKey);
  }

  return sheet.getRange(config.fallback);
}

/**
 * Gets the display value from a field (handles merged cells, trims whitespace).
 *
 * @param {Sheet} sheet
 * @param {string} fieldKey
 * @returns {string}
 */
function getFieldDisplayValue(sheet, fieldKey) {
  const range = getFieldRange(sheet, fieldKey);
  return range.getDisplayValue().trim();
}

/**
 * Gets the raw value from a field (useful for dates and numbers).
 *
 * @param {Sheet} sheet
 * @param {string} fieldKey
 * @returns {*}
 */
function getFieldValue(sheet, fieldKey) {
  const range = getFieldRange(sheet, fieldKey);
  return range.getValue();
}

/**
 * Gets all values from a multi-cell range field as a 2D array.
 *
 * @param {Sheet} sheet
 * @param {string} fieldKey
 * @returns {Array[][]}
 */
function getFieldValues(sheet, fieldKey) {
  const range = getFieldRange(sheet, fieldKey);
  return range.getValues();
}

/**
 * Returns array of FIELD_CONFIG keys that are safe to clear during rollover.
 * Automatically excludes formula cells (isFormula: true).
 *
 * @returns {string[]}
 */
function getClearableFieldKeys_() {
  return Object.keys(FIELD_CONFIG).filter(key => !FIELD_CONFIG[key].isFormula);
}


// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Check which Named Ranges exist on a sheet and whether they point to the
 * correct sheet.
 *
 * @param {Sheet} sheet
 * @returns {Object} Status map per fieldKey
 */
function checkNamedRangesOnSheet(sheet) {
  const results = {};
  const sheetName = sheet.getName();
  const spreadsheet = sheet.getParent();
  const dayPrefix = extractDayPrefix(sheetName);

  if (!dayPrefix) {
    return { error: `"${sheetName}" is not a day sheet (must start with WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, or SUNDAY)` };
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
      // Not found — leave defaults
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
 * Shows a UI alert with status per field.
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
    message += "\nSome Named Ranges missing. Run 'Create Named Ranges' to set them up.";
  } else {
    message += "\nSome Named Ranges point to wrong sheet. Check template configuration.";
  }

  ui.alert("Named Range Diagnostics", message, ui.ButtonSet.OK);
  Logger.log(message);
}

/**
 * Menu function: Diagnose Named Ranges across ALL day sheets at once.
 */
function diagnoseAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  let message = "NAMED RANGE STATUS — ALL SHEETS\n";
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
        message += `  WARN ${status.namedRange} — Wrong sheet\n`;
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
 * Skips ranges that already exist and point to the correct sheet.
 *
 * @param {Sheet} sheet
 * @param {Spreadsheet} spreadsheet
 * @returns {{ created: number, skipped: number, details: string[] }}
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
      // Doesn't exist — we'll create it
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
 * Menu function: Create Named Ranges on the active sheet only.
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
      `"${sheetName}" is not a day sheet.\n\nThis function only works on sheets starting with WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, or SUNDAY.`,
      ui.ButtonSet.OK
    );
    return;
  }

  const response = ui.alert(
    "Create Named Ranges",
    `This will create Named Ranges on "${sheetName}" using default cell locations.\n\n` +
    `Existing Named Ranges (already on this sheet) will be skipped.\n\nContinue?`,
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
 * Menu function: Create Named Ranges on ALL day sheets (WEDNESDAY–SUNDAY).
 * Skips ranges that already exist on the correct sheet.
 */
function createNamedRangesOnAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const response = ui.alert(
    "Create Named Ranges on ALL Sheets",
    `This will create Named Ranges on all day sheets (WEDNESDAY–SUNDAY) using default cell locations.\n\n` +
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
 * fallback cell references in FIELD_CONFIG.
 *
 * ⚠️ DANGEROUS — this overwrites all existing named range locations.
 */
function forceUpdateNamedRangesOnAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const response = ui.alert(
    "Force Update Named Ranges (ALL Sheets)",
    `This will OVERWRITE all Named Ranges on all day sheets (WEDNESDAY–SUNDAY)\n` +
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
// ROLLOVER INTEGRATION
// ============================================================================

/**
 * Verifies and self-heals Named Ranges across all day sheets.
 * Called as a non-blocking step during weekly rollover.
 * Creates any missing ranges using FIELD_CONFIG fallback locations.
 * Silent (logs only — no UI alerts, safe in trigger context).
 *
 * @param {Spreadsheet} spreadsheet
 */
function verifyAndFixNamedRanges_(spreadsheet) {
  let totalCreated = 0;
  let totalSkipped = 0;

  VALID_DAY_PREFIXES.forEach(dayPrefix => {
    const sheets = spreadsheet.getSheets();
    const sheet = sheets.find(s => s.getName().startsWith(dayPrefix));

    if (!sheet) {
      Logger.log(`verifyAndFixNamedRanges_: no sheet found for ${dayPrefix}`);
      return;
    }

    const result = createNamedRangesOnSheet_(sheet, spreadsheet);
    totalCreated += (result.created || 0);
    totalSkipped += (result.skipped || 0);

    if (result.created > 0) {
      Logger.log(`${sheet.getName()}: fixed ${result.created} named range(s)`);
    }
  });

  Logger.log(`Named range verification complete — fixed: ${totalCreated}, already OK: ${totalSkipped}`);
}


// ============================================================================
// SHEET PROTECTION
// ============================================================================

/**
 * Applies whole-sheet protection to a single day sheet.
 * Protects structural cells (headers, labels, formulas) while leaving
 * all FIELD_CONFIG input fields (isFormula: false) fully editable.
 *
 * Uses setWarningOnly(true) so GAS scripts (rollover, clearContent calls)
 * can still write to any cell without restriction. Staff/managers see a
 * warning dialog if they accidentally edit protected structure cells,
 * but are not hard-blocked.
 *
 * @param {Sheet} sheet
 */
function setupSheetProtection_(sheet) {
  // Remove any existing protections on this sheet
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  existing.forEach(p => p.remove());

  // Protect the whole sheet (warning-only — scripts always have full access)
  const protection = sheet.protect().setDescription('Shift Report Structure');
  protection.setWarningOnly(true);

  // Build editable ranges from all non-formula FIELD_CONFIG entries
  const clearableKeys = getClearableFieldKeys_();  // auto-excludes isFormula: true
  const editableRanges = clearableKeys.map(key => getFieldRange(sheet, key));

  protection.setUnprotectedRanges(editableRanges);
  Logger.log(`Protection set on "${sheet.getName()}": ${editableRanges.length} editable ranges carved out`);
}

/**
 * Menu function: Apply sheet protection to all day sheets (WEDNESDAY–SUNDAY).
 * Loops VALID_DAY_PREFIXES, finds each sheet, and calls setupSheetProtection_().
 * Password-gated via pw_setupAllSheetsProtection() in Menu.js.
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
 * Password-gated via pw_removeAllSheetsProtection() in Menu.js.
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
