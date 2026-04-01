/**
 * Venue Configuration System
 *
 * Central configuration loader for venue-specific settings.
 * Reads VENUE_NAME from Script Properties and returns appropriate config.
 *
 * Usage:
 *   const config = getVenueConfig_();
 *   const sheetName = config.sheetNames.master;
 *   const todoRange = config.ranges.todoTask;
 *
 * @version 1.0.0
 * @date 2026-02-08
 */

/**
 * Get venue-specific configuration
 *
 * @returns {Object} Venue configuration object
 * @throws {Error} If VENUE_NAME not set or unknown venue
 */
function getVenueConfig_() {
  const venueName = PropertiesService.getScriptProperties().getProperty('VENUE_NAME');

  if (!venueName) {
    throw new Error('VENUE_NAME not set in Script Properties. Run the appropriate setupScriptProperties function first.');
  }

  const configs = {
    'WARATAH': {
      name: 'THE WARATAH',
      displayName: 'The Waratah',

      // Operating schedule
      days: ['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      dayCount: 5,

      // Sheet names
      sheetNames: {
        master: 'MASTER ACTIONABLES SHEET',
        audit: 'AUDIT LOG',
        archive: 'ARCHIVE',
      },

      // Cell ranges (hardcoded for Waratah)
      ranges: {
        // Header fields
        date: 'B3:F3',
        mod: 'B4:F4',
        staff: 'B5:F5',

        // Financial metrics
        netRevenue: 'B34',
        cardTips: 'B32',
        cashTips: 'B33',
        totalTips: 'B36',
        productionAmount: 'B8',
        cashTakings: 'B15',
        grossSalesIncCash: 'B16',
        cashReturns: 'B17',
        cdDiscount: 'B19',
        refunds: 'B21',
        cdRedeem: 'B23',
        totalDiscount: 'B25',
        discountsCompsExcCD: 'B26',
        grossTaxableSales: 'B27',
        taxes: 'B28',
        netSalesWTips: 'B29',

        // Narrative fields (odd rows = data, even rows = labels)
        shiftSummary: 'A43:F43',
        guestsOfNote: 'A45:F45',
        theGood: 'A47:F47',
        theBad: 'A49:F49',
        kitchenNotes: 'A51:F51',

        // Task management
        todoTask: 'A53:E61',
        todoAssignee: 'F53:F61',

        // Incidents and wastage
        wastageComps: 'A63:F63',
        rsaIncidents: 'A65:F65',

        // Uses named ranges (WEDNESDAY_SR_NetRevenue etc.) via RunWaratah.js
        // Fallback to hardcoded cells when named ranges don't exist in spreadsheet
        usesNamedRanges: true,
      },

      // Timezone
      timezone: 'Australia/Sydney',

      // Feature flags
      features: {
        taskManagement: true,
        nightlyExport: true,
        analytics: true,
        dataWarehouse: true,
      },
    },

    'SAKURA': {
      name: 'SAKURA HOUSE',
      displayName: 'Sakura House',

      // Operating schedule
      days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      dayCount: 6,

      // Sheet names
      sheetNames: {
        master: 'SAKURA ACTIONABLES SHEET',
        audit: 'AUDIT LOG',
        archive: 'ARCHIVE',
      },

      // Cell ranges (uses named ranges for Sakura)
      ranges: {
        // Sakura uses named ranges abstraction (via Run.gs helpers)
        usesNamedRanges: true,

        // Named range keys (actual ranges defined in spreadsheet)
        todoTask: 'TODO_TASK_RANGE',
        todoAssignee: 'TODO_ASSIGNEE_RANGE',
        date: 'DATE_RANGE',
        mod: 'MOD_RANGE',
        netRevenue: 'NET_REVENUE',
        shiftSummary: 'SHIFT_SUMMARY_RANGE',
      },

      // Timezone
      timezone: 'Australia/Sydney',

      // Feature flags
      features: {
        taskManagement: true,
        nightlyExport: true,
        analytics: true,
        dataWarehouse: true,
      },
    },
  };

  const config = configs[venueName];

  if (!config) {
    throw new Error(`Unknown venue: ${venueName}. Valid options: ${Object.keys(configs).join(', ')}`);
  }

  return config;
}

/**
 * Get venue name (convenience method)
 *
 * @returns {string} Venue name (e.g., "WARATAH" or "SAKURA")
 */
function getVenueName_() {
  return PropertiesService.getScriptProperties().getProperty('VENUE_NAME');
}

/**
 * Check if current venue uses named ranges
 *
 * @returns {boolean} True if named ranges, false if hardcoded cells
 */
function usesNamedRanges_() {
  const config = getVenueConfig_();
  return config.ranges.usesNamedRanges;
}

/**
 * Get range value with automatic abstraction handling
 *
 * Handles both named ranges (Sakura) and hardcoded cells (Waratah)
 *
 * @param {Sheet} sheet - The sheet to read from
 * @param {string} rangeKey - The range key (e.g., 'todoTask', 'netRevenue')
 * @returns {*} The value from the range
 */
function getRangeValue_(sheet, rangeKey) {
  const config = getVenueConfig_();

  if (config.ranges.usesNamedRanges) {
    // Sakura: use named range helper from Run.gs
    // This assumes getFieldValue() exists in Run.gs
    if (typeof getFieldValue === 'function') {
      return getFieldValue(sheet, rangeKey);
    } else {
      // Fallback: try to get named range directly
      const namedRange = config.ranges[rangeKey];
      const range = sheet.getRange(namedRange);
      return range.getValue();
    }
  } else {
    // Waratah: use hardcoded range
    const rangeA1 = config.ranges[rangeKey];
    if (!rangeA1) {
      throw new Error(`Range not found in config: ${rangeKey}`);
    }
    return sheet.getRange(rangeA1).getValue();
  }
}

/**
 * Set range value with automatic abstraction handling
 *
 * @param {Sheet} sheet - The sheet to write to
 * @param {string} rangeKey - The range key
 * @param {*} value - The value to set
 */
function setRangeValue_(sheet, rangeKey, value) {
  const config = getVenueConfig_();

  if (config.ranges.usesNamedRanges) {
    // Sakura: use named range helper
    if (typeof setFieldValue === 'function') {
      setFieldValue(sheet, rangeKey, value);
    } else {
      const namedRange = config.ranges[rangeKey];
      const range = sheet.getRange(namedRange);
      range.setValue(value);
    }
  } else {
    // Waratah: use hardcoded range
    const rangeA1 = config.ranges[rangeKey];
    if (!rangeA1) {
      throw new Error(`Range not found in config: ${rangeKey}`);
    }
    sheet.getRange(rangeA1).setValue(value);
  }
}

/**
 * Get range values (for multi-cell ranges)
 *
 * @param {Sheet} sheet - The sheet to read from
 * @param {string} rangeKey - The range key
 * @returns {Array} 2D array of values
 */
function getRangeValues_(sheet, rangeKey) {
  const config = getVenueConfig_();

  if (config.ranges.usesNamedRanges) {
    if (typeof getFieldValues === 'function') {
      return getFieldValues(sheet, rangeKey);
    } else {
      const namedRange = config.ranges[rangeKey];
      const range = sheet.getRange(namedRange);
      return range.getValues();
    }
  } else {
    const rangeA1 = config.ranges[rangeKey];
    if (!rangeA1) {
      throw new Error(`Range not found in config: ${rangeKey}`);
    }
    return sheet.getRange(rangeA1).getValues();
  }
}

/**
 * Set range values (for multi-cell ranges)
 *
 * @param {Sheet} sheet - The sheet to write to
 * @param {string} rangeKey - The range key
 * @param {Array} values - 2D array of values
 */
function setRangeValues_(sheet, rangeKey, values) {
  const config = getVenueConfig_();

  if (config.ranges.usesNamedRanges) {
    if (typeof setFieldValues === 'function') {
      setFieldValues(sheet, rangeKey, values);
    } else {
      const namedRange = config.ranges[rangeKey];
      const range = sheet.getRange(namedRange);
      range.setValues(values);
    }
  } else {
    const rangeA1 = config.ranges[rangeKey];
    if (!rangeA1) {
      throw new Error(`Range not found in config: ${rangeKey}`);
    }
    sheet.getRange(rangeA1).setValues(values);
  }
}
