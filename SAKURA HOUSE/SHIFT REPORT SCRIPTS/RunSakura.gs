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
    description: "Report date (merged cell)"
  },
  mod: {
    suffix: "SR_MOD",
    fallback: "B4:D4",
    description: "Manager on Duty (merged cell)"
  },
  fohStaff: {
    suffix: "SR_FOHStaff",
    fallback: "B6:D6",
    description: "FOH staff on shift"
  },
  bohStaff: {
    suffix: "SR_BOHStaff",
    fallback: "B7:D7",
    description: "BOH staff on shift"
  },

  // --- CASH ---
  cashCount: {
    suffix: "SR_CashCount",
    fallback: "C10:E17",
    description: "Cash count breakdown"
  },
  cashRecord: {
    suffix: "SR_CashRecord",
    fallback: "C22:D23",
    description: "Cash record totals"
  },
  pettyCashTransactions: {
    suffix: "SR_PettyCashTransactions",
    fallback: "B40:B45",
    description: "Petty cash transactions"
  },

  // --- FINANCIALS ---
  netRevenue: {
    suffix: "SR_NetRevenue",
    fallback: "B54",
    description: "Net revenue less tips & accounts"
  },

  // --- SHIFT REPORT ---
  shiftSummary: {
    suffix: "SR_ShiftSummary",
    fallback: "A59:D59",
    description: "General overview / shift summary"
  },

  // --- TO-DO SECTION ---
  todoTasks: {
    suffix: "SR_TodoTasks",
    fallback: "A69:A84",
    description: "To-do task descriptions — cells A69:C69 are merged; value lives in column A (first cell of merge)"
  },
  todoAssignees: {
    suffix: "SR_TodoAssignees",
    fallback: "D69:D84",
    description: "To-do assignee dropdowns"
  },
  // todoFullRange was removed Feb 2026 — it was never read by any production function.
  // Tasks are read via todoTasks (A69:A84) and assignees via todoAssignees (D69:D84).
  // The full block is cleared implicitly when those two fields are cleared during rollover.

  // --- FINANCIAL DETAIL ---
  cashTips: {
    suffix: "SR_CashTips",
    fallback: "C29",
    description: "Tips - Cash"
  },
  cardTips: {
    suffix: "SR_CardTips",
    fallback: "C30",
    description: "Tips - Card"
  },
  surchargeTips: {
    suffix: "SR_SurchargeTips",
    fallback: "C31",
    description: "Tips - Surcharge"
  },
  productionAmount: {
    suffix: "SR_ProductionAmount",
    fallback: "B37",
    description: "Production amount (from Lightspeed)"
  },
  deposit: {
    suffix: "SR_Deposit",
    fallback: "B38",
    description: "Deposit / revenue outside Lightspeed"
  },
  discounts: {
    suffix: "SR_Discounts",
    fallback: "B50",
    description: "Total discounts (from Lightspeed)"
  },

  // --- CONTENT SECTIONS ---
  guestsOfNote: {
    suffix: "SR_GuestsOfNote",
    fallback: "A61:D61",
    description: "Guest of note - VIPs, regulars"
  },
  goodNotes: {
    suffix: "SR_GoodNotes",
    fallback: "A63:D63",
    description: "Good notes - positive feedback"
  },
  issues: {
    suffix: "SR_Issues",
    fallback: "A65:D65",
    description: "Issues / improvements"
  },
  kitchenNotes: {
    suffix: "SR_KitchenNotes",
    fallback: "A67:D67",
    description: "Kitchen notes (from chef)"
  },
  wastageComps: {
    suffix: "SR_WastageComps",
    fallback: "A86:D86",
    description: "Wastage / comps / discounts"
  },
  maintenance: {
    suffix: "SR_Maintenance",
    fallback: "A88:D88",
    description: "Maintenance items"
  },
  rsaIncidents: {
    suffix: "SR_RSAIncidents",
    fallback: "A90:D90",
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
