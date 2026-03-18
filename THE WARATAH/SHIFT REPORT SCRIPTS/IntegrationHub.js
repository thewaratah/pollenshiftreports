/**
 * ============================================================================
 * WARATAH INTEGRATION HUB
 * ============================================================================
 *
 * Central orchestration for all Waratah automation systems
 *
 * Connects:
 * - Shift Reports → Data Warehouse
 * - Shift Reports → Task Management
 * - Task Management → Weekly Agenda (live sync)
 *
 * @version 3.0.0
 * @updated 2026-03-06
 */


/* ==========================================================================
   MASTER CONFIGURATION
   ========================================================================== */

/**
 * Lazy-load getter for integration configuration.
 * Reads Script Properties on demand (not at module load) to prevent
 * onOpen() failures when Script Properties are not yet configured.
 */
function getIntegrationConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Core spreadsheets (loaded from Script Properties — see _SETUP_ScriptProperties.js)
    shiftReportCurrentId: props.getProperty('WARATAH_SHIFT_REPORT_CURRENT_ID'),
    taskManagementId: props.getProperty('WARATAH_TASK_MANAGEMENT_ID'),
    dataWarehouseId: props.getProperty('WARATAH_DATA_WAREHOUSE_ID'),

    // Sheet names
    sheets: {
      todos: "TO-DOs",
      tasks: "MASTER ACTIONABLES SHEET",
      financialLog: "NIGHTLY_FINANCIAL",
      operationalLog: "OPERATIONAL_EVENTS",
      wastageLog: "WASTAGE_COMPS",
      qualitativeLog: "QUALITATIVE_LOG"
    },

    // Settings
    timezone: "Australia/Sydney",
    validationThresholds: {
      maxDiscrepancy: 10.00,       // Max $ difference for warnings
      criticalDiscrepancy: 50.00   // Max $ difference for errors (blocks send)
    },

    // Alert recipients (loaded from Script Properties)
    alerts: {
      integrationErrors: props.getProperty('INTEGRATION_ALERT_EMAIL_PRIMARY'),
      validationWarnings: props.getProperty('INTEGRATION_ALERT_EMAIL_PRIMARY')
    }
  };
}


/* ==========================================================================
   MAIN INTEGRATION ORCHESTRATOR
   Called from shift report "Export & Email PDF" button
   ========================================================================== */

/**
 * Master integration function - coordinates all systems
 * Returns validation results to calling function
 *
 * @param {string} sheetName - Name of shift report sheet (e.g., "FRIDAY 31/01/2025")
 * @returns {Object} {success: boolean, errors: [], warnings: []}
 */
function runIntegrations(sheetName) {
  const startTime = new Date();
  const INTEGRATION_CONFIG = getIntegrationConfig_(); // Read once, pass down
  const results = {
    success: true,
    errors: [],
    warnings: [],
    integrations: {}
  };

  try {
    Logger.log(`═══ Starting integrations for: ${sheetName} ═══`);

    // 1. Extract data from shift report
    Logger.log("Step 1/3: Extracting shift data...");
    const shiftData = extractShiftData_(sheetName, INTEGRATION_CONFIG);
    results.integrations.dataExtraction = {success: true};
    Logger.log(`  ✓ Extracted: ${shiftData.mod} | ${shiftData.dayOfWeek} | Revenue $${shiftData.netRevenue} | Staff: ${shiftData.staff}`);

    // 2. Validate data integrity FIRST (before any writes)
    Logger.log("Step 2/3: Validating data...");
    const validation = validateShiftData_(shiftData);
    results.integrations.validation = validation;

    if (validation.errors.length > 0) {
      results.errors.push(...validation.errors);
      results.success = false;
      Logger.log(`  ✗ Validation FAILED: ${validation.errors.length} error(s)`);
      // Don't continue if validation fails
      return results;
    }
    if (validation.warnings.length > 0) {
      results.warnings.push(...validation.warnings);
      Logger.log(`  ⚠ Validation warnings: ${validation.warnings.length}`);
    } else {
      Logger.log(`  ✓ Validation passed`);
    }

    // 3. Log to data warehouse (non-blocking - don't fail entire process if this fails)
    Logger.log("Step 3/3: Logging to data warehouse...");
    try {
      const warehouseResult = logToDataWarehouse_(shiftData, INTEGRATION_CONFIG);
      results.integrations.warehouse = { success: true, ...warehouseResult };
      if (warehouseResult.financialSkipped) {
        results.warnings.push(
          `Warehouse: financial record for ${shiftData.date.toDateString()} / ${shiftData.mod} already exists. ` +
          `Duplicate skipped — re-export will not overwrite. Use backfillShiftToWarehouse() to force-update.`
        );
      }
      Logger.log(`  ✓ Warehouse logging complete`);
    } catch (e) {
      results.warnings.push(`Warehouse logging failed: ${e.message}`);
      results.integrations.warehouse = {success: false, error: e.message};
      Logger.log(`  ⚠ Warehouse logging failed: ${e.message}`);
    }

    // Append run record to INTEGRATION_LOG sheet in data warehouse
    appendToIntegrationLog_(sheetName, results, startTime, INTEGRATION_CONFIG);

    // Log integration run summary to Apps Script logs
    logIntegrationRun_(sheetName, results, startTime);

    const duration = ((new Date() - startTime) / 1000).toFixed(1);
    Logger.log(`═══ Integrations complete: ${duration}s ═══`);

  } catch (error) {
    results.success = false;
    results.errors.push(`Integration system error: ${error.message}`);
    Logger.log(`═══ INTEGRATION ERROR: ${error.message} ═══`);

    // Send alert
    sendIntegrationAlert_("Integration System Failure", error.message, sheetName, INTEGRATION_CONFIG);

    // Log to pipeline learnings
    logPipelineLearning_('runIntegrations', error.message, 'Check integration log for details');
  }

  return results;
}


/* ==========================================================================
   DATA EXTRACTION
   ========================================================================== */

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
    return new Date(str); // Fallback for unexpected formats
  }
}


/**
 * Extract all relevant data from shift report
 * Returns standardized data object
 *
 * Uses batched reads (3 API calls) instead of individual cell reads (~30 calls)
 * for significantly better performance in GAS.
 *
 * @param {string} sheetName - Name of the shift report sheet
 * @param {Object} [config]  - Optional pre-loaded INTEGRATION_CONFIG
 * @returns {Object} Standardized shift data
 */
function extractShiftData_(sheetName, config) {
  const INTEGRATION_CONFIG = config || getIntegrationConfig_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in this spreadsheet`);
  }

  // --- BATCH READ 1: Financial data B3:B39 (37 rows) ---
  // Single API call replaces ~20 individual getRange().getValue() calls.
  // Intentionally bypasses getFieldRange() helpers for performance — GAS charges
  // per API call, so one batch read is significantly faster than 20 named range lookups.
  // Cell mapping: FIELD_CONFIG fallback cells in RunWaratah.js are authoritative.
  let finValues;
  try {
    finValues = sheet.getRange("B3:B39").getValues(); // 37 rows x 1 col → [[val], [val], ...]
  } catch (e) {
    Logger.log('extractShiftData_: could not read B3:B39 — ' + e.message);
    return null;
  }

  // Helper: extract value by row number (1-indexed cell ref → 0-indexed array)
  const fin = (row) => finValues[row - 3] ? finValues[row - 3][0] : null;
  const finNum = (row) => parseFloat(fin(row)) || 0;

  // Also need display values for text fields (MOD, staff)
  let finDisplay;
  try {
    finDisplay = sheet.getRange("B3:B5").getDisplayValues();
  } catch (e) {
    Logger.log('extractShiftData_: could not read B3:B5 display — ' + e.message);
    finDisplay = [[""], [""], [""]];
  }

  const dateValue = fin(3);
  if (!dateValue) {
    Logger.log('extractShiftData_: B3 (date) is empty');
    return null;
  }
  const date = parseCellDate_(dateValue);

  const mod = (finDisplay[1][0] || "").trim();   // B4 display
  if (!mod) {
    Logger.log('extractShiftData_: B4 (MOD) is empty');
    // Don't return null — MOD can be empty for partial data
  }
  const staff = (finDisplay[2][0] || "").trim();  // B5 display

  // --- BATCH READ 2: Narrative + incident cells (A43:A65, odd rows) ---
  // Single API call replaces 7 individual getDisplayValue() calls.
  // Narrative fields are merged A:F — value lives in col A only (see FIELD_CONFIG in RunWaratah.js).
  let narrativeValues;
  try {
    narrativeValues = sheet.getRange("A43:A65").getDisplayValues(); // 23 rows
  } catch (e) {
    Logger.log('extractShiftData_: could not read A43:A65 — ' + e.message);
    narrativeValues = [];
  }
  // Helper: extract by row number (A43 = index 0, A45 = index 2, etc.)
  const narr = (row) => {
    const idx = row - 43;
    return (narrativeValues[idx] && narrativeValues[idx][0]) ? narrativeValues[idx][0].trim() : "";
  };

  // --- BATCH READ 3: TO-DOs A53:F61 (9 rows) ---
  // Combined A:F read — intentional. Accesses task description (col A, merged A:E)
  // and assignee (col F) in one call. FIELD_CONFIG splits these into todoTasks/todoAssignees
  // but this single batch read is more efficient for extraction.
  let todoRange = [];
  try { todoRange = sheet.getRange("A53:F61").getValues(); } catch(e) { Logger.log("extractShiftData_: could not read A53:F61 — " + e.message); }
  const todos = [];
  todoRange.forEach(row => {
    const description = row[0]; // Column A (merged A-E, value in A)
    const assignee = row[5];    // Column F
    if (description && description.toString().trim() !== "") {
      todos.push({
        description: description.toString().trim(),
        assignee: assignee ? assignee.toString().trim() : ""
      });
    }
  });

  // Calculate week ending (next Sunday from this date)
  const weekEnding = new Date(date);
  const daysUntilSunday = (7 - weekEnding.getDay()) % 7;
  weekEnding.setDate(weekEnding.getDate() + daysUntilSunday);

  return {
    // Core identifiers
    date: date,
    dayOfWeek: Utilities.formatDate(date, INTEGRATION_CONFIG.timezone, "EEEE"),
    weekEnding: weekEnding,
    mod: mod,
    staff: staff,

    // Revenue & production
    netRevenue: finNum(34),         // B34
    productionAmount: finNum(8),    // B8

    // Cash flow
    cashTakings: finNum(15),        // B15 (formula)
    grossSalesIncCash: finNum(16),  // B16 (formula)

    // Deductions (merged cell pairs — value in first cell of pair)
    cashReturns: finNum(17),        // B17 (merged B17:B18)
    cdDiscount: finNum(19),         // B19 (merged B19:B20)
    refunds: finNum(21),            // B21 (merged B21:B22)
    cdRedeem: finNum(23),           // B23 (merged B23:B24)
    totalDiscount: finNum(25),      // B25 (input)
    discountsCompsExcCD: finNum(26), // B26 (formula)

    // Tax
    grossTaxableSales: finNum(27),  // B27 (formula)
    taxes: finNum(28),              // B28 (formula)
    netSalesWTips: finNum(29),      // B29 (formula)

    // Tips
    cardTips: finNum(32),           // B32
    cashTips: finNum(33),           // B33
    tipsTotal: finNum(37),          // B37 (formula)

    // Operational events
    todos: todos,

    // Qualitative / narrative fields (merged A:F, value in col A)
    shiftSummary: narr(43),         // A43
    guestsOfNote: narr(45),         // A45
    theGood: narr(47),              // A47
    theBad: narr(49),               // A49
    kitchenNotes: narr(51),         // A51
    wastageComps: narr(63),         // A63
    maintenance: "",
    rsaIncidents: narr(65),         // A65

    // Metadata
    sheetName: sheetName
  };
}


/* ==========================================================================
   INTEGRATION 1: DATA WAREHOUSE LOGGING
   ========================================================================== */

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
 * Log shift data to centralized analytics warehouse.
 * Populates: NIGHTLY_FINANCIAL (22 cols), OPERATIONAL_EVENTS (8 cols),
 *            WASTAGE_COMPS (6 cols), QUALITATIVE_LOG (11 cols).
 *
 * Schema updated 2026-03-06: removed Covers/Labor/derived metrics,
 * added full financial breakdown (B8, B15-B29).
 *
 * @param {Object}  shiftData  - Standardized shift data from extractShiftData_()
 * @param {Object}  [config]   - Optional pre-loaded INTEGRATION_CONFIG
 * @param {boolean} [skipLock] - Pass true when the caller already holds the script lock
 *                               (e.g. runWeeklyBackfill_). GAS locks are not re-entrant;
 *                               acquiring the same lock twice will always time out.
 * @returns {Object} {financialLogged, financialSkipped, eventsLogged, wastageLogged, qualLogged}
 */
function logToDataWarehouse_(shiftData, config, skipLock) {
  const INTEGRATION_CONFIG = config || getIntegrationConfig_();
  if (!INTEGRATION_CONFIG.dataWarehouseId) {
    throw new Error("Data warehouse ID not configured. Update INTEGRATION_CONFIG.dataWarehouseId");
  }

  // Concurrency guard — prevents duplicate writes if triggered simultaneously.
  // Skipped when caller (e.g. runWeeklyBackfill_) already holds the lock.
  let lock = null;
  if (!skipLock) {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      Logger.log('logToDataWarehouse_: Could not acquire lock — skipping concurrent write');
      return {
        success: false,
        financialLogged: false,
        financialSkipped: false,
        eventsLogged: 0,
        wastageLogged: false,
        qualLogged: false,
        errors: ['Lock timeout — concurrent write in progress'],
        warnings: []
      };
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

  const warehouse = SpreadsheetApp.openById(INTEGRATION_CONFIG.dataWarehouseId);

  // 1. Log financial data to NIGHTLY_FINANCIAL sheet (22 columns A-V)
  const financialSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.financialLog);
  if (!financialSheet) {
    throw new Error(`Sheet "${INTEGRATION_CONFIG.sheets.financialLog}" not found in warehouse`);
  }

  // Check for duplicates (same date + same MOD = duplicate)
  const lastFinRow = financialSheet.getLastRow();
  const existingData = lastFinRow > 1
    ? financialSheet.getRange(2, 1, lastFinRow - 1, 4).getValues()
    : [];
  const shiftDateKey = normaliseDateKey_(shiftData.date);
  const isDuplicate = existingData.some(row => {
    const rowKey = normaliseDateKey_(row[0]);
    return rowKey !== null && rowKey === shiftDateKey && row[3] === shiftData.mod;
  });

  if (isDuplicate) {
    Logger.log(`  ⚠ Duplicate prevented: ${shiftData.date.toDateString()} (${shiftData.mod}) already logged`);
    logResult.financialSkipped = true;
  } else {
    financialSheet.appendRow([
      shiftData.date,               // A: Date
      shiftData.dayOfWeek,          // B: Day
      shiftData.weekEnding,         // C: Week Ending
      shiftData.mod,                // D: MOD
      shiftData.staff,              // E: Staff
      shiftData.netRevenue,         // F: Net Revenue
      shiftData.productionAmount,   // G: Production Amount
      shiftData.cashTakings,        // H: Cash Takings (B15)
      shiftData.grossSalesIncCash,  // I: Gross Sales Inc Cash (B16)
      shiftData.cashReturns,        // J: Cash Returns (B17)
      shiftData.cdDiscount,         // K: CD Discount (B19)
      shiftData.refunds,            // L: Refunds (B21)
      shiftData.cdRedeem,           // M: CD Redeem (B23)
      shiftData.totalDiscount,      // N: Total Discount (B25)
      shiftData.discountsCompsExcCD, // O: Discounts Comps Exc CD (B26)
      shiftData.grossTaxableSales,  // P: Gross Taxable Sales (B27)
      shiftData.taxes,              // Q: Taxes (B28)
      shiftData.netSalesWTips,      // R: Net Sales w Tips (B29)
      shiftData.cardTips,           // S: Card Tips (B32)
      shiftData.cashTips,           // T: Cash Tips (B33)
      shiftData.tipsTotal,          // U: Total Tips (B37)
      new Date()                    // V: Logged At
    ]);
    Logger.log(`  → Logged financial data to warehouse (22 cols)`);
    logResult.financialLogged = true;
  }

  // 2. Log operational events (TO-DOs) to OPERATIONAL_EVENTS sheet (8 columns A-H)
  const eventsSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.operationalLog);
  if (eventsSheet && shiftData.todos && shiftData.todos.length > 0) {
    // Duplicate detection: Date (col A, index 0) + Description (col D, index 3)
    const lastEvtRow = eventsSheet.getLastRow();
    const existingEvents = lastEvtRow > 1
      ? eventsSheet.getRange(2, 1, lastEvtRow - 1, 4).getValues()
      : [];
    const shiftDateKeyEvt = normaliseDateKey_(shiftData.date);

    const newEventRows = [];
    shiftData.todos.forEach(todo => {
      const isDupeRow = existingEvents.some(row => {
        const rowKey = normaliseDateKey_(row[0]);
        return rowKey !== null && rowKey === shiftDateKeyEvt && row[3] === todo.description;
      });
      if (isDupeRow) {
        Logger.log(`  → Skipped OPERATIONAL_EVENTS duplicate: ${shiftData.date.toDateString()} / "${todo.description}"`);
        return;
      }
      newEventRows.push([
        shiftData.date,       // A: Date
        shiftData.dayOfWeek,  // B: Day
        shiftData.mod,        // C: MOD
        todo.description,     // D: Description
        todo.assignee,        // E: Assignee
        "MEDIUM",             // F: Priority
        "Shift Report",       // G: Source
        new Date()            // H: Logged At
      ]);
      logResult.eventsLogged++;
    });
    if (newEventRows.length > 0) {
      eventsSheet.getRange(eventsSheet.getLastRow() + 1, 1, newEventRows.length, 8).setValues(newEventRows);
      Logger.log(`  → Logged ${logResult.eventsLogged} TO-DO(s) to warehouse`);
    }
  }

  // 3. Log wastage/comp notes to WASTAGE_COMPS sheet (6 columns A-F)
  if (shiftData.wastageComps) {
    const wastageSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.wastageLog);
    if (wastageSheet) {
      const shiftDateKeyWast = normaliseDateKey_(shiftData.date);
      const lastWastRow = wastageSheet.getLastRow();
      const wastDup = (lastWastRow > 1
        ? wastageSheet.getRange(2, 1, lastWastRow - 1, 4).getValues()
        : []
      ).some(row => {
        const rowKey = normaliseDateKey_(row[0]);
        return rowKey !== null && rowKey === shiftDateKeyWast && row[3] === shiftData.mod;
      });
      if (!wastDup) {
        wastageSheet.appendRow([
          shiftData.date,           // A: Date
          shiftData.dayOfWeek,      // B: Day
          shiftData.weekEnding,     // C: Week Ending
          shiftData.mod,            // D: MOD
          shiftData.wastageComps,   // E: Notes
          new Date()                // F: Logged At
        ]);
        Logger.log(`  → Logged wastage/comp notes to warehouse`);
        logResult.wastageLogged = true;
      }
    }
  }

  // 4. Log qualitative/narrative data to QUALITATIVE_LOG sheet (11 columns A-K)
  const qualSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.qualitativeLog);
  if (qualSheet) {
    const shiftDateKeyQual = normaliseDateKey_(shiftData.date);
    const lastQualRow = qualSheet.getLastRow();
    const qualDup = (lastQualRow > 1
      ? qualSheet.getRange(2, 1, lastQualRow - 1, 3).getValues()
      : []
    ).some(row => {
      const rowKey = normaliseDateKey_(row[0]);
      return rowKey !== null && rowKey === shiftDateKeyQual && row[2] === shiftData.mod;
    });
    if (!qualDup) {
      qualSheet.appendRow([
        shiftData.date,           // A: Date
        shiftData.dayOfWeek,      // B: Day
        shiftData.mod,            // C: MOD
        shiftData.shiftSummary,   // D: Shift Summary
        shiftData.guestsOfNote,   // E: Guests of Note
        shiftData.theGood,        // F: The Good
        shiftData.theBad,         // G: The Bad
        shiftData.kitchenNotes,   // H: Kitchen Notes
        shiftData.maintenance,    // I: Maintenance
        shiftData.rsaIncidents,   // J: RSA/Incidents
        new Date()                // K: Logged At
      ]);
      Logger.log(`  → Logged qualitative data to warehouse`);
      logResult.qualLogged = true;
    }
  }

  // Auto-build analytics dashboard if ANALYTICS tab is missing or empty
  if (logResult.financialLogged) {
    try {
      const warehouseId = PropertiesService.getScriptProperties().getProperty('WARATAH_DATA_WAREHOUSE_ID');
      if (warehouseId) {
        const wss = SpreadsheetApp.openById(warehouseId);
        const analyticsSheet = wss.getSheetByName('ANALYTICS');
        if (!analyticsSheet || analyticsSheet.getLastRow() <= 1) {
          buildFinancialDashboard(); // defined in AnalyticsDashboard.js
          Logger.log('logToDataWarehouse_: auto-built financial dashboard (ANALYTICS tab was missing/empty)');
        }
      }
    } catch (e) {
      Logger.log('logToDataWarehouse_: auto-build analytics failed (non-blocking): ' + e.message);
    }

    // M2 — Revenue Anomaly Detection (non-blocking)
    try {
      const warehouseId = PropertiesService.getScriptProperties().getProperty('WARATAH_DATA_WAREHOUSE_ID');
      if (warehouseId) detectRevenueAnomalies_Waratah(shiftData, warehouseId);
    } catch (e) {
      Logger.log('M2 anomaly check error: ' + e.message);
    }
  }

  return logResult;

  } finally {
    if (lock) lock.releaseLock();
  }
}


/* ==========================================================================
   VALIDATION ENGINE
   ========================================================================== */

/**
 * Validate shift data for errors and warnings
 *
 * @param {Object} shiftData - Standardized shift data object
 * @returns {Object} {errors: [], warnings: [], passed: boolean}
 */
function validateShiftData_(shiftData) {
  const validation = {
    errors: [],
    warnings: [],
    passed: true
  };

  // 1. Required fields validation
  if (!shiftData.date || !(shiftData.date instanceof Date) || isNaN(shiftData.date.getTime())) {
    validation.errors.push("Invalid or missing date (cell B3)");
  }
  if (!shiftData.mod || shiftData.mod === "") {
    validation.errors.push("MOD name is required (cell B4)");
  }
  if (shiftData.netRevenue <= 0) {
    validation.warnings.push("Net revenue is $0 or negative (cell B34) — verify before exporting. Continuing.");
  }

  // 2. Financial logic checks
  // DISABLED 2026-02-15: This validation was comparing Cash Tips + Card Tips to Net Revenue,
  // which will always fail since tips are only ~5-15% of revenue. The template doesn't
  // capture cash/card revenue breakdown, only cash/card tips breakdown.
  // Validation removed to allow staff to send shift reports without being blocked.
  //
  // const calculatedTotal = shiftData.cashTotal + shiftData.cardTotal;
  // const discrepancy = Math.abs(calculatedTotal - shiftData.netRevenue);
  //
  // // Critical error - blocks send
  // if (discrepancy > INTEGRATION_CONFIG.validationThresholds.criticalDiscrepancy) {
  //   validation.errors.push(
  //     `CRITICAL: Cash + Cards ($${calculatedTotal.toFixed(2)}) differs from Net Revenue ` +
  //     `($${shiftData.netRevenue.toFixed(2)}) by $${discrepancy.toFixed(2)}. ` +
  //     `Maximum allowed discrepancy is $${INTEGRATION_CONFIG.validationThresholds.criticalDiscrepancy}.`
  //   );
  // }
  // // Warning - allows send but flags issue
  // else if (discrepancy > INTEGRATION_CONFIG.validationThresholds.maxDiscrepancy) {
  //   validation.warnings.push(
  //     `Cash + Cards ($${calculatedTotal.toFixed(2)}) differs from Net Revenue ` +
  //     `($${shiftData.netRevenue.toFixed(2)}) by $${discrepancy.toFixed(2)}. Please verify.`
  //   );
  // }

  // 3. Set overall status
  if (validation.errors.length > 0) {
    validation.passed = false;
  }

  return validation;
}


/* ==========================================================================
   LOGGING & ALERTS
   ========================================================================== */

/**
 * Log integration run to execution log
 *
 * @param {string} sheetName - Name of the shift report sheet
 * @param {Object} results - Integration results object
 * @param {Date} startTime - When integration started
 */
function logIntegrationRun_(sheetName, results, startTime) {
  const duration = ((new Date() - startTime) / 1000).toFixed(2);

  Logger.log(`
═══════════════════════════════════════════════════════
Integration Summary for ${sheetName}
═══════════════════════════════════════════════════════
Duration:        ${duration}s
Overall Success: ${results.success ? '✓' : '✗'}
Errors:          ${results.errors.length}
Warnings:        ${results.warnings.length}

Component Status:
- Data Extraction: ${results.integrations.dataExtraction?.success ? '✓' : '✗'}
- Validation:      ${results.integrations.validation?.passed ? '✓' : '✗'}
- Warehouse:       ${results.integrations.warehouse?.success ? '✓' : '⚠'}

${results.errors.length > 0 ? 'ERRORS:\n' + results.errors.map(e => '  • ' + e).join('\n') : ''}
${results.warnings.length > 0 ? 'WARNINGS:\n' + results.warnings.map(w => '  • ' + w).join('\n') : ''}
═══════════════════════════════════════════════════════
  `);

  // Send alert email if there were errors
  if (results.errors.length > 0) {
    sendIntegrationAlert_(
      "Integration Errors Detected",
      results.errors.join("\n\n"),
      sheetName
    );
  }
}

/**
 * Send integration alert email
 *
 * @param {string} subject - Email subject
 * @param {string} message - Alert message
 * @param {string} sheetName - Name of the shift report sheet
 * @param {Object} [config]  - Optional pre-loaded INTEGRATION_CONFIG
 */
function sendIntegrationAlert_(subject, message, sheetName, config) {
  const INTEGRATION_CONFIG = config || getIntegrationConfig_();
  const fullSubject = `[Waratah Integrations] ${subject}`;
  const body = `
Shift Report: ${sheetName}
Time: ${Utilities.formatDate(new Date(), INTEGRATION_CONFIG.timezone, "dd/MM/yyyy HH:mm:ss")}

${message}

═══════════════════════════════════════════════════════
This is an automated alert from the Waratah Integration Hub.
Check the Apps Script execution logs for full details.
═══════════════════════════════════════════════════════
  `;

  try {
    GmailApp.sendEmail(
      INTEGRATION_CONFIG.alerts.integrationErrors,
      fullSubject,
      body
    );
    Logger.log(`📧 Alert email sent to ${INTEGRATION_CONFIG.alerts.integrationErrors}`);
  } catch (e) {
    Logger.log(`❌ Failed to send alert email: ${e.message}`);
  }
}

/**
 * Append a run record to the INTEGRATION_LOG sheet in the data warehouse.
 * Creates the sheet with headers if it doesn't exist.
 * Non-blocking — if this fails, it is silently swallowed.
 *
 * @param {string} sheetName - Shift report sheet name
 * @param {Object} results   - runIntegrations results object
 * @param {Date}   startTime - When the run started
 * @param {Object} [config]  - Optional pre-loaded INTEGRATION_CONFIG
 */
function appendToIntegrationLog_(sheetName, results, startTime, config) {
  try {
    const INTEGRATION_CONFIG = config || getIntegrationConfig_();
    if (!INTEGRATION_CONFIG.dataWarehouseId) return;

    const warehouse = SpreadsheetApp.openById(INTEGRATION_CONFIG.dataWarehouseId);
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
      new Date(),
      sheetName,
      results.success ? 'TRUE' : 'FALSE',
      duration,
      results.errors.join(' | ') || '',
      results.warnings.join(' | ') || '',
      wh.financialLogged ? 'TRUE' : 'FALSE',
      wh.financialSkipped ? 'TRUE' : 'FALSE',
      wh.eventsLogged || 0
    ]);
  } catch (e) {
    Logger.log(`appendToIntegrationLog_ failed (non-blocking): ${e.message}`);
  }
}


/* ==========================================================================
   MANUAL TESTING & UTILITIES
   ========================================================================== */

/**
 * Show a summary of the last 30 days of integration runs from INTEGRATION_LOG.
 * Run from menu: Admin Tools → Data Warehouse → Show Integration Log
 */
function showIntegrationLogStats() {
  const ui = SpreadsheetApp.getUi();
  const INTEGRATION_CONFIG = getIntegrationConfig_();
  if (!INTEGRATION_CONFIG.dataWarehouseId) {
    ui.alert('Not configured', 'WARATAH_DATA_WAREHOUSE_ID not set in Script Properties.', ui.ButtonSet.OK);
    return;
  }

  try {
    const warehouse = SpreadsheetApp.openById(INTEGRATION_CONFIG.dataWarehouseId);
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
 * Test integrations on the currently active sheet
 * Run this manually from the script editor to test
 */
function testIntegrations() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  Logger.log(`\n\n${'═'.repeat(60)}`);
  Logger.log(`MANUAL TEST RUN`);
  Logger.log(`${'═'.repeat(60)}\n`);

  const results = runIntegrations(sheetName);

  // Build UI message
  const ui = SpreadsheetApp.getUi();
  let message = `Integration Test Results:\n\n`;
  message += `Overall: ${results.success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
  message += `Errors: ${results.errors.length}\n`;
  message += `Warnings: ${results.warnings.length}\n\n`;

  if (results.errors.length > 0) {
    message += `ERRORS:\n${results.errors.join('\n\n')}\n\n`;
  }
  if (results.warnings.length > 0) {
    message += `WARNINGS:\n${results.warnings.join('\n\n')}`;
  }

  if (results.success && results.errors.length === 0 && results.warnings.length === 0) {
    message += `✅ All systems operational!\n`;
    message += `✅ Data logged to warehouse\n`;
  }

  ui.alert("Integration Test Complete", message, ui.ButtonSet.OK);
}

/**
 * Validate all integration connections (health check)
 * Run this to verify all systems are accessible
 */
function runValidationReport() {
  const INTEGRATION_CONFIG = getIntegrationConfig_();
  const ui = SpreadsheetApp.getUi();

  let report = "INTEGRATION HEALTH CHECK\n";
  report += "═".repeat(40) + "\n\n";

  // Check warehouse connection
  try {
    if (!INTEGRATION_CONFIG.dataWarehouseId) {
      report += "❌ Data Warehouse: NOT CONFIGURED\n";
      report += "   → Update INTEGRATION_CONFIG.dataWarehouseId\n\n";
    } else {
      const warehouse = SpreadsheetApp.openById(INTEGRATION_CONFIG.dataWarehouseId);
      const financialSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.financialLog);
      const eventsSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.operationalLog);

      const wastageSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.wastageLog);
      const qualSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.qualitativeLog);

      if (!financialSheet) {
        report += "⚠️  Data Warehouse: Connected but missing NIGHTLY_FINANCIAL sheet\n\n";
      } else if (!eventsSheet) {
        report += "⚠️  Data Warehouse: Connected but missing OPERATIONAL_EVENTS sheet\n\n";
      } else {
        report += "✅ Data Warehouse: Connected\n";
        report += `   → ${warehouse.getName()}\n`;
        const finCols = financialSheet.getLastColumn();
        const evtCols = eventsSheet.getLastColumn();
        report += `   → NIGHTLY_FINANCIAL: ${financialSheet.getLastRow() - 1} rows, ${finCols} cols (expected 22)\n`;
        report += `   → OPERATIONAL_EVENTS: ${eventsSheet.getLastRow() - 1} rows, ${evtCols} cols (expected 8)\n`;
        if (wastageSheet) {
          const wstCols = wastageSheet.getLastColumn();
          report += `   → WASTAGE_COMPS: ${wastageSheet.getLastRow() - 1} rows, ${wstCols} cols (expected 6)\n`;
        } else {
          report += "   ⚠️  WASTAGE_COMPS tab missing\n";
        }
        if (qualSheet) {
          const qualCols = qualSheet.getLastColumn();
          report += `   → QUALITATIVE_LOG: ${qualSheet.getLastRow() - 1} rows, ${qualCols} cols (expected 11)\n\n`;
        } else {
          report += "   ⚠️  QUALITATIVE_LOG tab missing\n\n";
        }
      }
    }
  } catch (e) {
    report += "❌ Data Warehouse: NOT ACCESSIBLE\n";
    report += `   → Error: ${e.message}\n\n`;
  }

  // Check task management
  try {
    const taskSheet = SpreadsheetApp.openById(INTEGRATION_CONFIG.taskManagementId);
    report += "✅ Task Management: Connected\n";
    report += `   → ${taskSheet.getName()}\n\n`;
  } catch (e) {
    report += "❌ Task Management: NOT ACCESSIBLE\n";
    report += `   → Error: ${e.message}\n\n`;
  }

  // Check current shift report
  try {
    const currentSheet = SpreadsheetApp.getActiveSheet();
    report += "✅ Current Sheet: Ready\n";
    report += `   → ${currentSheet.getName()}\n\n`;
  } catch (e) {
    report += "❌ Current Sheet: ERROR\n";
    report += `   → Error: ${e.message}\n\n`;
  }

  report += "═".repeat(40) + "\n";
  report += "Run this check after initial setup to verify\n";
  report += "all systems are properly connected.";

  ui.alert("System Validation Report", report, ui.ButtonSet.OK);
}

/**
 * Manually push a single shift report sheet to the data warehouse.
 * Bypasses export-blocking validation — useful for historical shifts or corrections.
 *
 * HOW TO USE: Navigate to the target shift report sheet, then run this function
 * from the Apps Script editor (or add to menu).
 */
function backfillShiftToWarehouse() {
  const ui = SpreadsheetApp.getUi();
  const INTEGRATION_CONFIG = getIntegrationConfig_();
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  const DAYS = ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const isShiftSheet = DAYS.some(day => sheetName.toUpperCase().startsWith(day));
  if (!isShiftSheet) {
    ui.alert(
      'Not a Shift Report Sheet',
      `"${sheetName}" does not look like a shift report sheet.\n\n` +
      'Navigate to the correct day sheet and run again.',
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
    const shiftData = extractShiftData_(sheetName, INTEGRATION_CONFIG);
    const warehouseResult = logToDataWarehouse_(shiftData, INTEGRATION_CONFIG);

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

    const results = {
      success: true,
      errors: [],
      warnings: warehouseResult.financialSkipped
        ? ['Financial record already existed — duplicate skipped']
        : [],
      integrations: { warehouse: warehouseResult }
    };
    appendToIntegrationLog_(sheetName + ' [BACKFILL]', results, startTime, INTEGRATION_CONFIG);

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
 * Iterate all shift report sheets and backfill any not yet in the data warehouse.
 * Designed to be called by a weekly time-based trigger (Monday 8am).
 */
function runWeeklyBackfill_() {
  const INTEGRATION_CONFIG = getIntegrationConfig_();
  if (!INTEGRATION_CONFIG.dataWarehouseId) {
    Logger.log('runWeeklyBackfill_: WARATAH_DATA_WAREHOUSE_ID not configured. Skipping.');
    return;
  }

  // Concurrency guard — prevents duplicate runs if trigger fires while a prior instance is still running
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('runWeeklyBackfill_: could not acquire lock — another instance is running');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const warehouse = SpreadsheetApp.openById(INTEGRATION_CONFIG.dataWarehouseId);
    const financialSheet = warehouse.getSheetByName(INTEGRATION_CONFIG.sheets.financialLog);

    if (!financialSheet) {
      Logger.log('runWeeklyBackfill_: NIGHTLY_FINANCIAL sheet not found in warehouse. Skipping.');
      return;
    }

    const lastFinRowBF = financialSheet.getLastRow();
    const existingData = lastFinRowBF > 1
      ? financialSheet.getRange(2, 1, lastFinRowBF - 1, 4).getValues()
      : [];
    const loggedKeys = new Set(
      existingData
        .filter(row => row[0] instanceof Date)
        .map(row => `${row[0].toDateString()}|${row[3]}`)
    );

    const DAYS = ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    let processed = 0, logged = 0, skipped = 0, failed = 0;

    sheets.forEach(sheet => {
      const name = sheet.getName();
      if (!DAYS.some(day => name.toUpperCase().startsWith(day))) return;

      processed++;
      try {
        const shiftData = extractShiftData_(name, INTEGRATION_CONFIG);
        if (!shiftData.date || isNaN(shiftData.date.getTime())) {
          Logger.log(`  runWeeklyBackfill_: skipping "${name}" — invalid date`);
          skipped++;
          return;
        }

        const key = `${shiftData.date.toDateString()}|${shiftData.mod}`;
        if (loggedKeys.has(key)) {
          skipped++;
          return;
        }

        logToDataWarehouse_(shiftData, INTEGRATION_CONFIG, true); // skipLock: caller holds the lock
        loggedKeys.add(key);
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
  } catch (e) {
    notifyError_('runWeeklyBackfill_', e);
    throw e;
  } finally {
    lock.releaseLock();
  }
}


/**
 * Install a weekly time-based trigger for runWeeklyBackfill_().
 * Safe to re-run — removes any existing trigger first.
 */
function setupWeeklyBackfillTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runWeeklyBackfill_')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('runWeeklyBackfill_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  Logger.log('Weekly backfill trigger installed: runs every Monday at 8am.');
  try {
    SpreadsheetApp.getUi().alert(
      'Trigger Installed',
      'runWeeklyBackfill_() will run every Monday at 8am.\n\n' +
      'To remove: Apps Script editor → Triggers (clock icon) → delete the trigger.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { Logger.log('UI alert skipped — trigger context'); }
}
