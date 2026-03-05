/**
 * Test Suite for VenueConfig System
 *
 * Run these tests in Apps Script Editor to verify venue configuration
 * works correctly for both Waratah and Sakura.
 *
 * IMPORTANT: Run setupScriptProperties functions first to set VENUE_NAME
 *
 * @version 1.0.0
 * @date 2026-02-08
 */

/**
 * Test 1: Verify VENUE_NAME is set
 */
function testVenueName() {
  const venueName = getVenueName_();

  if (!venueName) {
    Logger.log('❌ FAILED: VENUE_NAME not set in Script Properties');
    Logger.log('Run the appropriate setupScriptProperties function first');
    return false;
  }

  if (venueName !== 'WARATAH' && venueName !== 'SAKURA') {
    Logger.log(`❌ FAILED: Invalid VENUE_NAME: ${venueName}`);
    Logger.log('Expected: WARATAH or SAKURA');
    return false;
  }

  Logger.log(`✅ PASSED: VENUE_NAME = ${venueName}`);
  return true;
}

/**
 * Test 2: Verify venue config loads correctly
 */
function testGetVenueConfig() {
  try {
    const config = getVenueConfig_();

    Logger.log('✅ PASSED: getVenueConfig_() loaded successfully');
    Logger.log(`   Venue: ${config.name} (${config.displayName})`);
    Logger.log(`   Days: ${config.days.join(', ')} (${config.dayCount} days)`);
    Logger.log(`   Master Sheet: ${config.sheetNames.master}`);
    Logger.log(`   Uses Named Ranges: ${config.ranges.usesNamedRanges}`);

    return true;
  } catch (error) {
    Logger.log('❌ FAILED: getVenueConfig_() threw error');
    Logger.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Verify range abstraction works
 */
function testRangeAbstraction() {
  try {
    const config = getVenueConfig_();

    Logger.log('✅ PASSED: Range abstraction layer loaded');
    Logger.log(`   Venue: ${config.name}`);
    Logger.log(`   Range mode: ${config.ranges.usesNamedRanges ? 'Named Ranges' : 'Hardcoded Cells'}`);

    // Test range key access
    const todoRange = config.ranges.todoTask;
    Logger.log(`   TODO range: ${todoRange}`);

    return true;
  } catch (error) {
    Logger.log('❌ FAILED: Range abstraction error');
    Logger.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Verify specific venue configurations
 */
function testVenueSpecificConfig() {
  const config = getVenueConfig_();
  const venueName = getVenueName_();

  if (venueName === 'SAKURA') {
    // Sakura-specific checks
    if (config.dayCount !== 6) {
      Logger.log(`❌ FAILED: Sakura should have 6 days, got ${config.dayCount}`);
      return false;
    }

    if (config.sheetNames.master !== 'SAKURA ACTIONABLES SHEET') {
      Logger.log(`❌ FAILED: Sakura master sheet name incorrect`);
      return false;
    }

    if (config.ranges.usesNamedRanges !== true) {
      Logger.log(`❌ FAILED: Sakura should use named ranges`);
      return false;
    }

    Logger.log('✅ PASSED: Sakura configuration correct');
  }

  return true;
}

/**
 * Run all tests
 */
function runAllVenueConfigTests() {
  Logger.log('=== VENUE CONFIGURATION TEST SUITE ===');
  Logger.log('');

  const tests = [
    { name: 'Test 1: Venue Name', fn: testVenueName },
    { name: 'Test 2: Config Loading', fn: testGetVenueConfig },
    { name: 'Test 3: Range Abstraction', fn: testRangeAbstraction },
    { name: 'Test 4: Venue-Specific Config', fn: testVenueSpecificConfig },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(function(test) {
    Logger.log(`Running: ${test.name}`);
    const result = test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    Logger.log('');
  });

  Logger.log('=== TEST RESULTS ===');
  Logger.log(`Total: ${tests.length} tests`);
  Logger.log(`Passed: ${passed}`);
  Logger.log(`Failed: ${failed}`);
  Logger.log('');

  if (failed === 0) {
    Logger.log('✅ ALL TESTS PASSED!');
    Logger.log('Venue configuration system ready for deployment');
  } else {
    Logger.log('❌ SOME TESTS FAILED');
    Logger.log('Fix errors before proceeding to Phase 2');
  }
}

/**
 * Quick configuration summary (run this first)
 */
function showVenueConfigSummary() {
  try {
    const venueName = getVenueName_();
    const config = getVenueConfig_();

    Logger.log('=== VENUE CONFIGURATION SUMMARY ===');
    Logger.log('');
    Logger.log(`Venue Name: ${venueName}`);
    Logger.log(`Display Name: ${config.displayName}`);
    Logger.log(`Operating Days: ${config.days.join(', ')}`);
    Logger.log(`Day Count: ${config.dayCount}`);
    Logger.log('');
    Logger.log('Sheet Names:');
    Logger.log(`  - Master: ${config.sheetNames.master}`);
    Logger.log(`  - Audit: ${config.sheetNames.audit}`);
    Logger.log(`  - Archive: ${config.sheetNames.archive}`);
    Logger.log('');
    Logger.log('Range Configuration:');
    Logger.log(`  - Uses Named Ranges: ${config.ranges.usesNamedRanges}`);
    Logger.log(`  - TODO Tasks: ${config.ranges.todoTask}`);
    Logger.log(`  - Date Range: ${config.ranges.date}`);
    Logger.log('');
    Logger.log('Features:');
    Logger.log(`  - Task Management: ${config.features.taskManagement}`);
    Logger.log(`  - Nightly Export: ${config.features.nightlyExport}`);
    Logger.log(`  - Analytics: ${config.features.analytics}`);
    Logger.log(`  - Data Warehouse: ${config.features.dataWarehouse}`);
    Logger.log('');
    Logger.log('✅ Configuration loaded successfully');

  } catch (error) {
    Logger.log('❌ ERROR loading configuration');
    Logger.log(`Error: ${error.message}`);
    Logger.log('');
    Logger.log('Troubleshooting:');
    Logger.log('1. Ensure VENUE_NAME is set in Script Properties');
    Logger.log('2. Run the appropriate setupScriptProperties function');
    Logger.log('3. Verify VenueConfig.gs is deployed to this project');
  }
}
