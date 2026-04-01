/**
 * ============================================================================
 * SAKURA HOUSE INTEGRATION HUB
 * ============================================================================
 *
 * Central orchestration for all Sakura automation systems.
 * Mirrors The Waratah's IntegrationHub.gs pattern.
 *
 * Current integrations:
 * - Shift Reports -> Sakura Actionables (via TaskIntegration.gs)
 * - Shift Reports -> Data Warehouse (NIGHTLY_FINANCIAL + OPERATIONAL_EVENTS)
 * - Data Warehouse -> Analytics Dashboard (ANALYTICS tab, formula-driven)
 *
 * @version 1.1.0
 * ============================================================================
 */


// ============================================================================
// MASTER CONFIGURATION
// ============================================================================

/** Lazy-load getter for Sakura data warehouse spreadsheet ID. */
function getDataWarehouseId_() {
  return PropertiesService.getScriptProperties().getProperty('SAKURA_DATA_WAREHOUSE_ID');
}

const INTEGRATION_CONFIG = {
  // Core spreadsheets
  // Actionables sheet is configured in TaskIntegration.gs
  // NOTE: dataWarehouseId is intentionally null here — use getDataWarehouseId_() at call sites
  dataWarehouseId: null,

  // Sheet names
  sheets: {
    todos: "TO-DOs",
    tasks: "SAKURA ACTIONABLES SHEET",
    financialLog: "NIGHTLY_FINANCIAL",
    operationalLog: "OPERATIONAL_EVENTS",
    wastageLog: "WASTAGE_COMPS",
    qualitativeLog: "QUALITATIVE_LOG"
  },

  // Settings
  timezone: "Australia/Sydney"
  // Alert email recipients are read from Script Properties at call time:
  // PropertiesService.getScriptProperties().getProperty('INTEGRATION_ALERT_EMAIL_PRIMARY')
};


// ============================================================================
// MAIN INTEGRATION ORCHESTRATOR
// ============================================================================

/**
 * Master integration function - coordinates all systems.
 * Called from NightlyExportSaks.gs during export.
 *
 * @param {string} sheetName - Name of shift report sheet (e.g., "MONDAY 03/02/2025")
 * @returns {Object} {success: boolean, errors: [], warnings: []}
 */
function runIntegrations(sheetName) {
  const startTime = new Date();
  const results = {
    success: true,
    errors: [],
    warnings: [],
    integrations: {}
  };

  try {
    Logger.log(`=== Starting integrations for: ${sheetName} ===`);

    // 1. Extract data from shift report
    Logger.log("Step 1: Extracting shift data...");
    const shiftData = extractShiftData_(sheetName);
    results.integrations.dataExtraction = { success: true };
    Logger.log(`  Extracted: ${shiftData.mod} | ${shiftData.dayOfWeek} | $${shiftData.netRevenue} | Tips: $${shiftData.totalTips}`);

    // 2. Validate data integrity
    Logger.log("Step 2: Validating data...");
    const validation = validateShiftData_(shiftData);
    results.integrations.validation = validation;

    if (validation.errors.length > 0) {
      results.errors.push(...validation.errors);
      results.success = false;
      Logger.log(`  Validation FAILED: ${validation.errors.length} error(s)`);
      return results;
    }
    if (validation.warnings.length > 0) {
      results.warnings.push(...validation.warnings);
      Logger.log(`  Validation warnings: ${validation.warnings.length}`);
    } else {
      Logger.log(`  Validation passed`);
    }

    // 3. Log to data warehouse (if configured, non-blocking)
    if (getDataWarehouseId_()) {
      Logger.log("Step 3: Logging to data warehouse...");
      try {
        const warehouseResult = logToDataWarehouse_(shiftData);
        results.integrations.warehouse = { success: true, ...warehouseResult };
        if (warehouseResult.financialSkipped) {
          results.warnings.push(
            `Warehouse: financial record for ${shiftData.date.toDateString()} / ${shiftData.mod} already exists. ` +
            `Duplicate skipped — re-export will not overwrite. Use backfillShiftToWarehouse() to force-update.`
          );
        }
        Logger.log(`  Warehouse logging complete`);
      } catch (e) {
        results.warnings.push(`Warehouse logging failed: ${e.message}`);
        results.integrations.warehouse = { success: false, error: e.message };
        Logger.log(`  Warehouse logging failed: ${e.message}`);
      }
    } else {
      Logger.log("Step 3: Data warehouse not configured (skipped)");
      results.integrations.warehouse = { success: true, skipped: true };
    }

    appendToIntegrationLog_(sheetName, results, startTime);
    logIntegrationRun_(sheetName, results, startTime);

    const duration = ((new Date() - startTime) / 1000).toFixed(1);
    Logger.log(`=== Integrations complete: ${duration}s ===`);

  } catch (error) {
    results.success = false;
    results.errors.push(`Integration system error: ${error.message}`);
    Logger.log(`=== INTEGRATION ERROR: ${error.message} ===`);
    logPipelineLearning_('runIntegrations', error.message, 'Check integration log for details');
  }

  return results;
}


// ============================================================================
// DATA EXTRACTION
// ============================================================================

/**
 * Parse a cell date value to a JavaScript Date.
 *
 * Two cases:
 *   1. Cell is date-formatted — Google Sheets returns a Date object directly.
 *   2. Cell is unformatted text — staff enter dates as "dd/mm/yyyy".
 *      `new Date("03/02/2025")` parses as MM/DD/YYYY (March 2), not Feb 3.
 *      We use Utilities.parseDate with the correct locale format instead.
 *
 * @param {*} value - Raw cell value from getValue()
 * @returns {Date} Parsed Date, or Invalid Date if unparseable
 */
function parseCellDate_(value) {
  if (value instanceof Date) return value;
  if (!value) return new Date('');
  const str = value.toString().trim();
  if (!str) return new Date('');
  try {
    return Utilities.parseDate(str, 'Australia/Sydney', 'dd/MM/yyyy');
  } catch (e) {
    Logger.log('parseCellDate_: could not parse "' + str + '" as dd/MM/yyyy — returning Invalid Date');
    return new Date(''); // Force invalid rather than US-format misparse via new Date(str)
  }
}


/**
 * Strip time component from a Date, returning midnight Australia/Sydney.
 * Prevents timezone-induced time leakage into warehouse date columns.
 *
 * @param {Date} d - Date object (may include time component)
 * @returns {Date} Date at midnight Australia/Sydney
 */
function toDateOnly_(d) {
  if (!d || isNaN(d.getTime())) return d;
  const str = Utilities.formatDate(d, 'Australia/Sydney', 'yyyy-MM-dd');
  return Utilities.parseDate(str, 'Australia/Sydney', 'yyyy-MM-dd');
}


/**
 * Extract all relevant data from shift report using Named Ranges (via Run.gs).
 */
function extractShiftData_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in this spreadsheet`);
  }

  // Extract core data via Named Ranges
  const dateValue = getFieldValue(sheet, "date");
  const date = parseCellDate_(dateValue);
  const mod = getFieldDisplayValue(sheet, "mod");
  const fohStaff = String(getFieldValue(sheet, "fohStaff") || "").trim();
  const bohStaff = String(getFieldValue(sheet, "bohStaff") || "").trim();
  const netRevenue = parseFloat(getFieldValue(sheet, "netRevenue")) || 0;

  // Extract financial detail via Named Ranges
  const cashTips = parseFloat(getFieldValue(sheet, "cashTips")) || 0;
  const cardTips = parseFloat(getFieldValue(sheet, "cardTips")) || 0;
  const surchargeTips = parseFloat(getFieldValue(sheet, "surchargeTips")) || 0;
  const totalTips = cashTips + cardTips + surchargeTips;
  const productionAmount = parseFloat(getFieldValue(sheet, "productionAmount")) || 0;
  const deposit = parseFloat(getFieldValue(sheet, "deposit")) || 0;
  const discounts = parseFloat(getFieldValue(sheet, "discounts")) || 0;

  // Direct cell reads for warehouse-only fields (not in FIELD_CONFIG named range system)
  // C19 = Cash Total (sum of the cash count section, below the count table)
  // C32 = Tips Total (formula cell: C29 cash + C30 card + C31 surcharge)
  let cashTotal = 0;
  try {
    cashTotal = parseFloat(sheet.getRange("C19").getValue()) || 0;
  } catch (e) {
    Logger.log("extractShiftData_: could not read C19 (Cash Total) — " + e.message + ". Defaulting to 0.");
  }

  let tipsTotal = 0;
  try {
    tipsTotal = parseFloat(sheet.getRange("C32").getValue()) || 0;
  } catch (e) {
    Logger.log("extractShiftData_: could not read C32 (Tips Total) — " + e.message + ". Defaulting to 0.");
  }

  // Calculate week ending (next Sunday from this date)
  const weekEnding = new Date(date);
  const daysUntilSunday = (7 - weekEnding.getDay()) % 7;
  weekEnding.setDate(weekEnding.getDate() + daysUntilSunday);

  // Extract TO-DOs
  const todoTaskValues = getFieldValues(sheet, "todoTasks");
  const todoAssignValues = getFieldValues(sheet, "todoAssignees");
  const todos = [];

  for (let i = 0; i < todoTaskValues.length; i++) {
    const description = (todoTaskValues[i][0] || "").toString().trim();
    const assignee = (todoAssignValues[i] ? todoAssignValues[i][0] || "" : "").toString().trim();
    if (description) {
      todos.push({ description, assignee });
    }
  }

  return {
    date: date,
    dayOfWeek: Utilities.formatDate(date, INTEGRATION_CONFIG.timezone, "EEEE"),
    weekEnding: weekEnding,
    mod: mod,
    fohStaff: fohStaff,
    bohStaff: bohStaff,
    netRevenue: netRevenue,
    cashTotal: cashTotal,
    cashTips: cashTips,
    cardTips: cardTips,
    surchargeTips: surchargeTips,
    tipsTotal: tipsTotal,
    totalTips: totalTips,
    productionAmount: productionAmount,
    deposit: deposit,
    discounts: discounts,
    todos: todos,

    // Qualitative / narrative fields
    shiftSummary: getFieldDisplayValue(sheet, "shiftSummary"),
    guestsOfNote: getFieldDisplayValue(sheet, "guestsOfNote"),
    theGood:      getFieldDisplayValue(sheet, "goodNotes"),
    theBad:       getFieldDisplayValue(sheet, "issues"),
    kitchenNotes: getFieldDisplayValue(sheet, "kitchenNotes"),
    wastageComps: getFieldDisplayValue(sheet, "wastageComps"),
    maintenance:  getFieldDisplayValue(sheet, "maintenance"),
    rsaIncidents: getFieldDisplayValue(sheet, "rsaIncidents"),

    sheetName: sheetName
  };
}


// ============================================================================
// VALIDATION ENGINE
// ============================================================================

/**
 * Validate shift data for errors and warnings.
 */
function validateShiftData_(shiftData) {
  const validation = {
    errors: [],
    warnings: [],
    passed: true
  };

  // Required fields
  if (!shiftData.date || !(shiftData.date instanceof Date) || isNaN(shiftData.date.getTime())) {
    validation.errors.push("Invalid or missing date (cell B3)");
  }
  if (!shiftData.mod || shiftData.mod === "") {
    validation.errors.push("MOD name is required (cell B4)");
  }
  if (shiftData.netRevenue <= 0) {
    validation.warnings.push("Net revenue is $0 or negative (cell B54) — verify before exporting. Continuing.");
  }

  if (validation.errors.length > 0) {
    validation.passed = false;
  }

  return validation;
}


// ============================================================================
// DATA WAREHOUSE LOGGING
// ============================================================================

/**
 * Normalise a date value (Date object or string) to a canonical
 * "Weekday Mon DD YYYY" string for duplicate-detection comparisons.
 * Returns null if the value cannot be parsed as a valid date.
 *
 * @param {*} v - Date object or date string
 * @returns {string|null}
 */
function normaliseDateKey_(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : parseCellDate_(v.toString());
  return (!d || isNaN(d.getTime())) ? null : d.toDateString();
}

/**
 * Returns true if an existing row in the sheet matches the given date key and
 * identifier value, indicating a duplicate that should not be re-appended.
 *
 * Reads all rows from row 2 onwards (skipping the header) and checks whether
 * any row has a matching normalised date at dateCol and an exact string match
 * at matchCol.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet     - Target warehouse sheet.
 * @param {string}                             dateKey   - Pre-normalised date string
 *                                                         from normaliseDateKey_().
 * @param {string}                             matchVal  - Value to match (e.g. MOD name
 *                                                         or task description).
 * @param {number}                             dateCol   - 0-based column index for the
 *                                                         date field in the values array.
 * @param {number}                             matchCol  - 0-based column index for the
 *                                                         match field in the values array.
 * @returns {boolean} true if a duplicate row was found; false otherwise.
 */
function isDuplicateInSheet_(sheet, dateKey, matchVal, dateCol, matchCol) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const numCols = matchCol + 1; // read only as many columns as needed
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  return data.some(row => {
    const rowKey = normaliseDateKey_(row[dateCol]);
    return rowKey !== null && rowKey === dateKey && row[matchCol] === matchVal;
  });
}

/**
 * Log shift data to centralized analytics warehouse.
 * Populates: NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS
 *
 * LockService guard: serialises concurrent calls (e.g. a live export overlapping
 * with the Monday 8am backfill trigger) to prevent duplicate warehouse rows.
 *
 * @param {Object}  shiftData - Extracted shift data from extractShiftData_()
 * @param {boolean} [skipLock=false] - Pass true when the caller already holds
 *   the script lock (e.g. runWeeklyBackfill_). GAS locks are not re-entrant,
 *   so calling tryLock() again from within a held lock always times out.
 */
function logToDataWarehouse_(shiftData, skipLock) {
  if (!getDataWarehouseId_()) {
    throw new Error("Data warehouse ID not configured. Set SAKURA_DATA_WAREHOUSE_ID in Script Properties.");
  }

  let lock = null;
  if (!skipLock) {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      Logger.log('logToDataWarehouse_: Could not acquire lock — skipping to avoid concurrent write');
      return { success: false, financialLogged: false, financialSkipped: false, eventsLogged: 0, wastageLogged: false, qualLogged: false, errors: ['Lock timeout — concurrent write in progress'], warnings: [] };
    }
  }

  const logResult = {
    financialLogged: false,
    financialSkipped: false,
    eventsLogged: 0,
    wastageLogged: false,
    qualLogged: false
  };

  try {

  const warehouse = SpreadsheetApp.openById(getDataWarehouseId_());

  // 1. Log financial data
  const financialSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.financialLog);
  if (!financialSheet) {
    throw new Error(`Sheet "${INTEGRATION_CONFIG.sheets.financialLog}" not found in warehouse`);
  }

  // Duplicate detection (same date + MOD)
  const shiftDateKey = normaliseDateKey_(shiftData.date);
  const isDuplicate = isDuplicateInSheet_(financialSheet, shiftDateKey, shiftData.mod, 0, 3);

  if (isDuplicate) {
    Logger.log(`  Duplicate prevented: ${shiftData.date.toDateString()} (${shiftData.mod}) already logged`);
    logResult.financialSkipped = true;
  } else {
    financialSheet.appendRow([
      toDateOnly_(shiftData.date),       // A: Date (midnight, no time component)
      shiftData.dayOfWeek,               // B: Day
      toDateOnly_(shiftData.weekEnding), // C: Week Ending (midnight, no time component)
      shiftData.mod,              // D: MOD
      shiftData.netRevenue,       // E: Net Revenue
      shiftData.cashTotal,        // F: Cash Total (C19)
      shiftData.cashTips,         // G: Cash Tips (C29)
      shiftData.tipsTotal,        // H: Tips Total (C32)
      new Date(),                 // I: Logged At
      shiftData.productionAmount, // J: Production Amount
      shiftData.discounts,        // K: Discounts
      shiftData.deposit,          // L: Deposit
      shiftData.fohStaff,         // M: FOH Staff
      shiftData.bohStaff,         // N: BOH Staff
      shiftData.cardTips,         // O: Card Tips
      shiftData.surchargeTips     // P: Surcharge Tips
    ]);
    Logger.log(`  Logged financial data to warehouse`);
    logResult.financialLogged = true;
  }

  // 2. Log operational events (TO-DOs) — one row per TO-DO task
  // Schema (9 columns): Date | Type | Item | Quantity | Value | Staff | Reason | Category | Source
  const eventsSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.operationalLog);
  if (eventsSheet && shiftData.todos && shiftData.todos.length > 0) {
    // Duplicate detection: per-row check on Date (col A) + Item text (col C).
    const shiftDateKeyEvt = normaliseDateKey_(shiftData.date);

    shiftData.todos.forEach(todo => {
      // Skip this todo if an identical date + item row already exists
      const isDupeRow = isDuplicateInSheet_(eventsSheet, shiftDateKeyEvt, todo.description, 0, 2);
      if (isDupeRow) {
        Logger.log(`  Skipped OPERATIONAL_EVENTS duplicate: ${shiftData.date.toDateString()} / "${todo.description}"`);
        return;
      }
      eventsSheet.appendRow([
        toDateOnly_(shiftData.date),     // A: Date
        "New",              // B: Type
        todo.description,   // C: Item
        "",                 // D: Quantity (unknown)
        "MEDIUM",           // E: Value (default priority)
        todo.assignee,      // F: Staff
        "",                 // G: Reason (unknown)
        "TO-DO",            // H: Category
        "Shift Report"      // I: Source
      ]);
      logResult.eventsLogged++;
    });
    if (logResult.eventsLogged > 0) {
      Logger.log(`  Logged ${logResult.eventsLogged} TO-DO(s) to OPERATIONAL_EVENTS`);
    }
  }

  // 3. Log wastage/comp notes to WASTAGE_COMPS sheet
  if (shiftData.wastageComps) {
    const wastageSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.wastageLog);
    if (wastageSheet) {
      const shiftDateKeyWast = normaliseDateKey_(shiftData.date);
      const wastDup = isDuplicateInSheet_(wastageSheet, shiftDateKeyWast, shiftData.mod, 0, 3);
      if (!wastDup) {
        wastageSheet.appendRow([
          toDateOnly_(shiftData.date),           // A: Date
          shiftData.dayOfWeek,                   // B: Day
          toDateOnly_(shiftData.weekEnding),     // C: Week Ending
          shiftData.mod,            // D: MOD
          shiftData.wastageComps    // E: COMMENTS
        ]);
        logResult.wastageLogged = true;
        Logger.log(`  Logged wastage/comp notes to warehouse`);
      }
    }
  }

  // 4. Log qualitative/narrative data to QUALITATIVE_LOG sheet
  const qualSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.qualitativeLog);
  if (qualSheet) {
    const shiftDateKeyQual = normaliseDateKey_(shiftData.date);
    const qualDup = isDuplicateInSheet_(qualSheet, shiftDateKeyQual, shiftData.mod, 0, 2);
    if (!qualDup) {
      qualSheet.appendRow([
        toDateOnly_(shiftData.date),           // A: Date
        shiftData.dayOfWeek,      // B: Day
        shiftData.mod,            // C: MOD
        shiftData.shiftSummary,   // D: Shift Summary
        shiftData.guestsOfNote,   // E: Guests of Note
        shiftData.theGood,        // F: The Good
        shiftData.theBad,         // G: The Bad / Issues
        shiftData.kitchenNotes,   // H: Kitchen Notes
        shiftData.maintenance,    // I: Maintenance
        shiftData.rsaIncidents,   // J: RSA/Incidents
        new Date()                // K: Logged At
      ]);
      logResult.qualLogged = true;
      Logger.log(`  Logged qualitative data to warehouse`);
    }
  }

  } finally {
    if (lock) lock.releaseLock();
  }

  // Auto-build analytics dashboard if ANALYTICS tab is missing or empty.
  // Runs after the lock is released so it does not block warehouse writes.
  // Non-blocking — failures are logged only.
  if (logResult.financialLogged) {
    try {
      const warehouseId = getDataWarehouseId_();
      if (warehouseId) {
        const wss = SpreadsheetApp.openById(warehouseId);
        const analyticsSheet = wss.getSheetByName('ANALYTICS');
        if (!analyticsSheet || analyticsSheet.getLastRow() <= 1) {
          buildFinancialDashboard();
        }
      }
    } catch (e) {
      Logger.log('Auto-build analytics: ' + e.message);
    }

    // M2 — Revenue Anomaly Detection (non-blocking)
    try {
      const warehouseId = getDataWarehouseId_();
      if (warehouseId) detectRevenueAnomalies_Sakura(shiftData, warehouseId);
    } catch (e) {
      Logger.log('M2 anomaly check error: ' + e.message);
    }
  }

  return logResult;
}


// ============================================================================
// LOGGING & ALERTS
// ============================================================================

function logIntegrationRun_(sheetName, results, startTime) {
  const duration = ((new Date() - startTime) / 1000).toFixed(2);

  Logger.log(`
===================================================
Integration Summary for ${sheetName}
===================================================
Duration:        ${duration}s
Overall Success: ${results.success ? 'PASS' : 'FAIL'}
Errors:          ${results.errors.length}
Warnings:        ${results.warnings.length}

Component Status:
- Data Extraction: ${results.integrations.dataExtraction?.success ? 'PASS' : 'FAIL'}
- Validation:      ${results.integrations.validation?.passed ? 'PASS' : 'FAIL'}
- Warehouse:       ${results.integrations.warehouse?.success ? (results.integrations.warehouse?.skipped ? 'SKIP' : 'PASS') : 'WARN'}

${results.errors.length > 0 ? 'ERRORS:\n' + results.errors.map(e => '  - ' + e).join('\n') : ''}
${results.warnings.length > 0 ? 'WARNINGS:\n' + results.warnings.map(w => '  - ' + w).join('\n') : ''}
===================================================
  `);
}


/**
 * Append a run record to the INTEGRATION_LOG sheet in the data warehouse.
 * Creates the sheet with headers if it doesn't exist.
 * Non-blocking — if this fails, it is silently swallowed.
 *
 * @param {string} sheetName - Shift report sheet name
 * @param {Object} results   - runIntegrations results object
 * @param {Date}   startTime - When the run started
 */
function appendToIntegrationLog_(sheetName, results, startTime) {
  try {
    const warehouseId = getDataWarehouseId_();
    if (!warehouseId) return;

    const warehouse = SpreadsheetApp.openById(warehouseId);
    let logSheet = warehouse.getSheetByName('INTEGRATION_LOG');

    if (!logSheet) {
      logSheet = warehouse.insertSheet('INTEGRATION_LOG');
      logSheet.appendRow([
        'Timestamp', 'SheetName', 'Success', 'Duration_s',
        'Errors', 'Warnings', 'Financial_Logged', 'Financial_Skipped', 'Events_Logged'
      ]);
      logSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f3f3f3');
      logSheet.setFrozenRows(1);
    }

    const duration = ((new Date() - startTime) / 1000).toFixed(2);
    const wh = results.integrations.warehouse || {};

    logSheet.appendRow([
      new Date(),                                    // A: Timestamp
      sheetName,                                     // B: SheetName
      results.success ? 'TRUE' : 'FALSE',            // C: Success
      duration,                                      // D: Duration (s)
      results.errors.join(' | ') || '',              // E: Errors
      results.warnings.join(' | ') || '',            // F: Warnings
      wh.financialLogged ? 'TRUE' : 'FALSE',         // G: Financial Logged
      wh.financialSkipped ? 'TRUE' : 'FALSE',        // H: Financial Skipped
      wh.eventsLogged || 0                           // I: Events Logged
    ]);
  } catch (e) {
    Logger.log(`appendToIntegrationLog_ failed (non-blocking): ${e.message}`);
  }
}


// ============================================================================
// MANUAL TESTING & UTILITIES
// ============================================================================

/**
 * Show a summary of the last 30 days of integration runs from INTEGRATION_LOG.
 * Run from menu: Admin Tools → Data Warehouse → Show Integration Log
 */
function showIntegrationLogStats() {
  const ui = SpreadsheetApp.getUi();
  const warehouseId = getDataWarehouseId_();
  if (!warehouseId) {
    ui.alert('Not configured', 'SAKURA_DATA_WAREHOUSE_ID not set in Script Properties.', ui.ButtonSet.OK);
    return;
  }

  try {
    const warehouse = SpreadsheetApp.openById(warehouseId);
    const logSheet = warehouse.getSheetByName('INTEGRATION_LOG');
    if (!logSheet || logSheet.getLastRow() < 2) {
      ui.alert('No Data', 'INTEGRATION_LOG is empty or does not exist yet.\n\nRun a shift export first to create it.', ui.ButtonSet.OK);
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const rows = logSheet.getDataRange().getValues().slice(1); // skip header
    const recent = rows.filter(r => r[0] instanceof Date && r[0] >= cutoff);

    const total = recent.length;
    const successes = recent.filter(r => r[2] === 'TRUE').length;
    const failures = total - successes;
    const financialLogged = recent.filter(r => r[6] === 'TRUE').length;
    const financialSkipped = recent.filter(r => r[7] === 'TRUE').length;
    const backfills = recent.filter(r => r[1] && r[1].includes('[BACKFILL]')).length;

    const lastEntry = total > 0 ? recent[recent.length - 1] : null;
    const lastSheet = lastEntry ? lastEntry[1] : 'N/A';
    const lastTime = lastEntry && lastEntry[0] instanceof Date
      ? Utilities.formatDate(lastEntry[0], INTEGRATION_CONFIG.timezone, 'dd/MM/yyyy HH:mm')
      : 'N/A';

    const msg =
      `Integration Log — Last 30 Days\n` +
      `${'─'.repeat(36)}\n` +
      `Total runs:          ${total}\n` +
      `Successful:          ${successes}\n` +
      `Failed/partial:      ${failures}\n\n` +
      `Financial logged:    ${financialLogged}\n` +
      `Duplicate skipped:   ${financialSkipped}\n` +
      `Manual backfills:    ${backfills}\n\n` +
      `Last run: ${lastTime}\n` +
      `Last sheet: ${lastSheet}`;

    ui.alert('Integration Log Stats', msg, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', `Could not read INTEGRATION_LOG: ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Test integrations on the currently active sheet.
 */
function testIntegrations() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  Logger.log("\n" + "=".repeat(60));
  Logger.log("MANUAL TEST RUN");
  Logger.log("=".repeat(60) + "\n");

  const results = runIntegrations(sheetName);

  const ui = SpreadsheetApp.getUi();
  let message = `Integration Test Results:\n\n`;
  message += `Overall: ${results.success ? 'SUCCESS' : 'FAILED'}\n`;
  message += `Errors: ${results.errors.length}\n`;
  message += `Warnings: ${results.warnings.length}\n\n`;

  if (results.errors.length > 0) {
    message += `ERRORS:\n${results.errors.join('\n\n')}\n\n`;
  }
  if (results.warnings.length > 0) {
    message += `WARNINGS:\n${results.warnings.join('\n\n')}`;
  }

  if (results.success && results.errors.length === 0 && results.warnings.length === 0) {
    message += `All systems operational!\n`;
  }

  ui.alert("Integration Test Complete", message, ui.ButtonSet.OK);
}

/**
 * Validate all integration connections (health check).
 */
function runValidationReport() {
  const ui = SpreadsheetApp.getUi();

  let report = "INTEGRATION HEALTH CHECK\n";
  report += "=".repeat(40) + "\n\n";

  // Check actionables sheet
  try {
    const actionablesSS = SpreadsheetApp.openById(getActionablesSheetId_());
    const actionablesSheet = actionablesSS.getSheetByName(SAKURA_ACTIONABLES_TAB_NAME);

    if (!actionablesSheet) {
      report += "WARN Actionables: Connected but tab '" + SAKURA_ACTIONABLES_TAB_NAME + "' not found\n\n";
    } else {
      report += "OK Actionables: Connected\n";
      report += `   -> ${actionablesSS.getName()}\n`;
      report += `   -> ${actionablesSheet.getLastRow() - 1} task rows\n\n`;
    }
  } catch (e) {
    report += "FAIL Actionables: NOT ACCESSIBLE\n";
    report += `   -> Error: ${e.message}\n\n`;
  }

  // Check warehouse
  try {
    const warehouse = SpreadsheetApp.openById(getDataWarehouseId_());
    report += "OK Data Warehouse: Connected\n";
    report += `   -> ${warehouse.getName()}\n`;

    // Check required tabs
    const requiredTabs = [
      INTEGRATION_CONFIG.sheets.financialLog,
      INTEGRATION_CONFIG.sheets.operationalLog,
      INTEGRATION_CONFIG.sheets.wastageLog,
      INTEGRATION_CONFIG.sheets.qualitativeLog,
      ANALYTICS_CONFIG.dashboardSheet,
      ANALYTICS_CONFIG.executiveSheet
    ];
    requiredTabs.forEach(tab => {
      const tabSheet = warehouse.getSheetByName(tab);
      if (tabSheet) {
        report += `   OK Tab "${tab}": ${tabSheet.getLastRow()} rows\n`;
      } else {
        report += `   WARN Tab "${tab}": NOT FOUND\n`;
      }
    });
    report += "\n";
  } catch (e) {
    report += "FAIL Data Warehouse: NOT ACCESSIBLE\n";
    report += `   -> Error: ${e.message}\n\n`;
  }

  // Check current sheet
  try {
    const currentSheet = SpreadsheetApp.getActiveSheet();
    report += "OK Current Sheet: Ready\n";
    report += `   -> ${currentSheet.getName()}\n\n`;
  } catch (e) {
    report += "FAIL Current Sheet: ERROR\n";
    report += `   -> Error: ${e.message}\n\n`;
  }

  report += "=".repeat(40) + "\n";
  report += "Run this check after initial setup to verify\n";
  report += "all systems are properly connected.";

  ui.alert("System Validation Report", report, ui.ButtonSet.OK);
}


/**
 * Manually push a single shift report sheet to the data warehouse.
 * Bypasses the export-blocking validation — useful for:
 *   - Historical shifts that were never exported
 *   - Correcting shifts where warehouse write failed
 *   - Re-pushing shifts with updated data
 *
 * HOW TO USE: Navigate to (or select) the target shift report sheet,
 * then run this function from the Apps Script editor.
 */
function backfillShiftToWarehouse() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  // Guard: must look like a shift report sheet
  const isShiftSheet = VALID_DAY_PREFIXES.some(prefix => sheetName.toUpperCase().startsWith(prefix));
  if (!isShiftSheet) {
    ui.alert(
      'Not a Shift Report Sheet',
      `"${sheetName}" does not look like a shift report sheet.\n\n` +
      'Navigate to the correct sheet (e.g. "MONDAY 03/02/2025") and run again.',
      ui.ButtonSet.OK
    );
    return;
  }

  const confirmResponse = ui.alert(
    'Backfill Shift to Warehouse',
    `Push "${sheetName}" to the data warehouse?\n\n` +
    '• Duplicate records will be skipped\n' +
    '• This does NOT send email or Slack\n' +
    '• Check Apps Script logs for details',
    ui.ButtonSet.YES_NO
  );
  if (confirmResponse !== ui.Button.YES) return;

  const startTime = new Date();
  try {
    const shiftData = extractShiftData_(sheetName);
    const warehouseResult = logToDataWarehouse_(shiftData);

    const duration = ((new Date() - startTime) / 1000).toFixed(1);
    let msg = `Backfill complete (${duration}s)\n\n`;

    if (warehouseResult.financialSkipped) {
      msg += '⚠ Financial record already existed — skipped (duplicate).\n';
    } else if (warehouseResult.financialLogged) {
      msg += '✓ Financial data logged.\n';
    }
    if (warehouseResult.eventsLogged > 0) {
      msg += `✓ ${warehouseResult.eventsLogged} TO-DO(s) logged.\n`;
    }
    if (warehouseResult.wastageLogged) {
      msg += '✓ Wastage/comp notes logged.\n';
    }
    if (warehouseResult.qualLogged) {
      msg += '✓ Qualitative data logged.\n';
    }

    // Write to INTEGRATION_LOG too
    const results = {
      success: true,
      errors: [],
      warnings: warehouseResult.financialSkipped
        ? ['Financial record already existed — duplicate skipped']
        : [],
      integrations: { warehouse: warehouseResult }
    };
    appendToIntegrationLog_(sheetName + ' [BACKFILL]', results, startTime);

    ui.alert('Backfill Complete', msg, ui.ButtonSet.OK);

  } catch (e) {
    ui.alert(
      'Backfill Failed',
      `Error: ${e.message}\n\nCheck Apps Script logs for details.`,
      ui.ButtonSet.OK
    );
    Logger.log(`backfillShiftToWarehouse failed for "${sheetName}": ${e.message}`);
  }
}


/**
 * Iterate all shift report sheets for the current week and backfill any
 * that are not yet in the data warehouse. Run manually or via time trigger.
 *
 * Sheets are matched by day prefix (MONDAY, TUESDAY, etc.).
 * If extraction fails for a sheet (e.g. missing named range), it is logged and skipped.
 *
 * LockService guard: prevents duplicate warehouse rows when a scheduled backfill
 * overlaps with a live export that also calls logToDataWarehouse_(). If the lock
 * cannot be acquired within 30 s the function exits early and logs the contention.
 */
function runWeeklyBackfill_() {
  // Acquire a script-wide lock to serialise against concurrent logToDataWarehouse_() calls.
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(30000);
  if (!acquired) {
    Logger.log('runWeeklyBackfill_: could not acquire LockService lock within 30 s — another operation is in progress. Skipping this run to prevent duplicate warehouse rows.');
    return;
  }

  try {
    const warehouseId = getDataWarehouseId_();
    if (!warehouseId) {
      Logger.log('runWeeklyBackfill_: SAKURA_DATA_WAREHOUSE_ID not configured. Skipping.');
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const warehouse = SpreadsheetApp.openById(warehouseId);
    const financialSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.financialLog);

    if (!financialSheet) {
      Logger.log('runWeeklyBackfill_: NIGHTLY_FINANCIAL sheet not found in warehouse. Skipping.');
      return;
    }

    // Build set of already-logged date+MOD pairs
    const lastFinRowBF = financialSheet.getLastRow();
    const existingData = lastFinRowBF > 1
      ? financialSheet.getRange(2, 1, lastFinRowBF - 1, 4).getValues()
      : [];
    const loggedKeys = new Set(
      existingData
        .filter(row => row[0] instanceof Date)
        .map(row => `${row[0].toDateString()}|${row[3]}`)
    );

    let processed = 0, logged = 0, skipped = 0, failed = 0;

    sheets.forEach(sheet => {
      const name = sheet.getName();
      const isShiftSheet = VALID_DAY_PREFIXES.some(prefix => name.toUpperCase().startsWith(prefix));
      if (!isShiftSheet) return;

      processed++;
      try {
        const shiftData = extractShiftData_(name);
        if (!shiftData.date || isNaN(shiftData.date.getTime())) {
          Logger.log(`  runWeeklyBackfill_: skipping "${name}" — invalid date`);
          skipped++;
          return;
        }

        const key = `${shiftData.date.toDateString()}|${shiftData.mod}`;
        if (loggedKeys.has(key)) {
          Logger.log(`  runWeeklyBackfill_: "${name}" already in warehouse — skipping`);
          skipped++;
          return;
        }

        logToDataWarehouse_(shiftData, true); // caller (runWeeklyBackfill_) holds the lock
        loggedKeys.add(key); // Prevent double-write if same date appears twice
        Logger.log(`  runWeeklyBackfill_: logged "${name}" to warehouse`);
        logged++;

      } catch (e) {
        Logger.log(`  runWeeklyBackfill_: failed for "${name}": ${e.message}`);
        failed++;
      }
    });

    Logger.log(
      `runWeeklyBackfill_ complete: ${processed} sheets checked, ` +
      `${logged} logged, ${skipped} already existed, ${failed} failed`
    );

  } catch (error) {
    notifyError_('runWeeklyBackfill_', error);
    Logger.log('runWeeklyBackfill_ error: ' + error.message);
    throw error;
  } finally {
    lock.releaseLock();
  }
}


/**
 * Install a weekly time-based trigger that runs runWeeklyBackfill_() every Monday morning.
 * Safe to re-run — deletes any existing backfill trigger first.
 *
 * Run once from the Apps Script editor to set up.
 */
function setupWeeklyBackfillTrigger() {
  // Remove any existing backfill trigger
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runWeeklyBackfill_')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('runWeeklyBackfill_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8) // 8am Monday Sydney time (aligned with Waratah)
    .create();

  Logger.log('Weekly backfill trigger installed: runs every Monday at 8am.');
  try {
    SpreadsheetApp.getUi().alert(
      'Trigger Installed',
      'runWeeklyBackfill_() will run every Monday at 8am.\n\n' +
      'To remove: Apps Script editor → Triggers (clock icon) → delete the trigger.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('Backfill trigger created (Monday 8am) — UI skipped in trigger context');
  }
}
