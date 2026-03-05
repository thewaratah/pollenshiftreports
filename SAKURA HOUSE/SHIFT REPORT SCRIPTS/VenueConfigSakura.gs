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
  let venueName = PropertiesService.getScriptProperties().getProperty('VENUE_NAME');

  // Default to SAKURA if not set (happens when spreadsheet is duplicated and Script Properties aren't copied)
  if (!venueName) {
    Logger.log('⚠️ VENUE_NAME not set in Script Properties. Defaulting to SAKURA.');
    Logger.log('   To fix this permanently, run setupScriptProperties_SakuraShiftReports() from _SETUP_ScriptProperties.js');
    venueName = 'SAKURA';
  }

  const configs = {
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
        // Sakura uses the named-range abstraction in RunSakura.gs.
        // All field access goes through getFieldRange() / getFieldValue() etc.
        // The bridge functions below (getRangeValue_, setRangeValue_, ...) are
        // currently bypassed — all SR files call RunSakura.gs helpers directly.
        // They are kept for potential future use but NOT active code paths.
        //
        // Keys here match FIELD_CONFIG in RunSakura.gs (updated Feb 2026;
        // old keys todoTask/todoAssignee/date/mod/netRevenue/shiftSummary removed).
        usesNamedRanges: true,

        // TO-DO fields
        todoTasks:    'SR_TodoTasks',
        todoAssignees: 'SR_TodoAssignees',

        // Header fields
        date:         'SR_Date',
        mod:          'SR_MOD',

        // Financial fields
        netRevenue:   'SR_NetRevenue',
        shiftSummary: 'SR_ShiftSummary',
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
 * @returns {string} Venue name ("SAKURA")
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
 * Handles named ranges (Sakura uses named range abstraction)
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
    // Fallback: use hardcoded range
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
    // Fallback: use hardcoded range
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
