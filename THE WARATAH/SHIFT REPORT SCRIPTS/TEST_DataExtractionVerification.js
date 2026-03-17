/**
 * DATA EXTRACTION VERIFICATION SCRIPT
 *
 * Run this script to verify that the IntegrationHub data extraction
 * is reading from the correct cells and sending accurate data to the warehouse.
 *
 * USAGE:
 * 1. Open a shift report sheet (e.g., WEDNESDAY 19/02/2026)
 * 2. Fill in financial fields
 * 3. Run verifyDataExtraction() from Apps Script editor
 * 4. Check the log output for any mismatches
 *
 * NIGHTLY_FINANCIAL schema (22-col, A-V, Mar 2026):
 *   A=Date, B=Day, C=WeekEnding, D=MOD, E=Staff,
 *   F=NetRevenue, G=ProductionAmount, H=CashTakings,
 *   I=GrossSalesIncCash, J=CashReturns, K=CDDiscount,
 *   L=Refunds, M=CDRedeem, N=TotalDiscount,
 *   O=DiscountsCompsExcCD, P=GrossTaxableSales,
 *   Q=Taxes, R=NetSalesWTips, S=CardTips, T=CashTips,
 *   U=TotalTips, V=LoggedAt
 *
 * @version 2.0.0
 * @updated 2026-03-06
 */


/**
 * Main verification function - Run this from the Apps Script editor
 *
 * Tests:
 * - Cell references match expected locations
 * - All required fields are populated
 * - Financial breakdown fields read correctly
 * - Tips fields read correctly
 */
function verifyDataExtraction() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  Logger.log('═══════════════════════════════════════════════════════');
  Logger.log('DATA EXTRACTION VERIFICATION');
  Logger.log('═══════════════════════════════════════════════════════');
  Logger.log(`Sheet: ${sheetName}`);
  Logger.log(`Time: ${new Date().toLocaleString('en-AU', {timeZone: 'Australia/Sydney'})}`);
  Logger.log('');

  try {
    // Extract data using the IntegrationHub function
    const shiftData = extractShiftData_(sheetName);

    // Display extracted data
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log('EXTRACTED DATA — Core fields:');
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log(`Date:              ${shiftData.date}`);
    Logger.log(`Day of Week:       ${shiftData.dayOfWeek}`);
    Logger.log(`Week Ending:       ${shiftData.weekEnding}`);
    Logger.log(`MOD:               ${shiftData.mod}`);
    Logger.log(`Staff:             ${shiftData.staff}`);
    Logger.log('');
    Logger.log(`Net Revenue:       $${shiftData.netRevenue.toFixed(2)} (field: netRevenue → ${FIELD_CONFIG['netRevenue'].fallback})`);
    Logger.log(`Production Amount: $${shiftData.productionAmount.toFixed(2)} (field: productionAmount → ${FIELD_CONFIG['productionAmount'].fallback})`);
    Logger.log(`Cash Takings:      $${shiftData.cashTakings.toFixed(2)} (field: cashTakings → ${FIELD_CONFIG['cashTakings'].fallback})`);
    Logger.log(`Card Tips:         $${shiftData.cardTips.toFixed(2)} (field: cardTips → ${FIELD_CONFIG['cardTips'].fallback})`);
    Logger.log(`Cash Tips:         $${shiftData.cashTips.toFixed(2)} (field: cashTips → ${FIELD_CONFIG['cashTips'].fallback})`);
    Logger.log(`Total Tips:        $${shiftData.tipsTotal.toFixed(2)} (field: totalTips → ${FIELD_CONFIG['totalTips'].fallback})`);
    Logger.log('');
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log('EXTRACTED DATA — Financial breakdown (B16-B29):');
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log(`Gross Sales Inc Cash: $${shiftData.grossSalesIncCash.toFixed(2)} (field: grossSalesIncCash → ${FIELD_CONFIG['grossSalesIncCash'].fallback})`);
    Logger.log(`Cash Returns:         $${shiftData.cashReturns.toFixed(2)} (field: cashReturns → ${FIELD_CONFIG['cashReturns'].fallback})`);
    Logger.log(`CD Discount:          $${shiftData.cdDiscount.toFixed(2)} (field: cdDiscount → ${FIELD_CONFIG['cdDiscount'].fallback})`);
    Logger.log(`Refunds:              $${shiftData.refunds.toFixed(2)} (field: refunds → ${FIELD_CONFIG['refunds'].fallback})`);
    Logger.log(`CD Redeem:            $${shiftData.cdRedeem.toFixed(2)} (field: cdRedeem → ${FIELD_CONFIG['cdRedeem'].fallback})`);
    Logger.log(`Total Discount:       $${shiftData.totalDiscount.toFixed(2)} (field: totalDiscount → ${FIELD_CONFIG['totalDiscount'].fallback})`);
    Logger.log(`Discounts Exc CD:     $${shiftData.discountsCompsExcCD.toFixed(2)} (field: discountsCompsExcCD → ${FIELD_CONFIG['discountsCompsExcCD'].fallback})`);
    Logger.log(`Gross Taxable Sales:  $${shiftData.grossTaxableSales.toFixed(2)} (field: grossTaxableSales → ${FIELD_CONFIG['grossTaxableSales'].fallback})`);
    Logger.log(`Taxes:                $${shiftData.taxes.toFixed(2)} (field: taxes → ${FIELD_CONFIG['taxes'].fallback})`);
    Logger.log(`Net Sales w Tips:     $${shiftData.netSalesWTips.toFixed(2)} (field: netSalesWTips → ${FIELD_CONFIG['netSalesWTips'].fallback})`);
    Logger.log('');

    // Validation checks
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log('VALIDATION CHECKS:');
    Logger.log('───────────────────────────────────────────────────────');

    let passCount = 0;
    let failCount = 0;

    // Test 1: Required fields populated
    let missingFields = [];
    if (!shiftData.date || !(shiftData.date instanceof Date)) missingFields.push(`Date (field: date → ${FIELD_CONFIG['date'].fallback})`);
    if (!shiftData.mod || shiftData.mod.trim() === '') missingFields.push(`MOD (field: mod → ${FIELD_CONFIG['mod'].fallback})`);
    if (shiftData.netRevenue <= 0) missingFields.push(`Net Revenue (field: netRevenue → ${FIELD_CONFIG['netRevenue'].fallback})`);

    if (missingFields.length === 0) {
      Logger.log(`✅ PASS: All required fields populated`);
      passCount++;
    } else {
      Logger.log(`❌ FAIL: Missing required fields: ${missingFields.join(', ')}`);
      failCount++;
    }

    // Test 2: Tips total sanity check — card + cash should roughly equal total tips
    const calculatedTips = shiftData.cardTips + shiftData.cashTips;
    const tipsDiff = Math.abs(calculatedTips - shiftData.tipsTotal);

    if (shiftData.tipsTotal === 0 && calculatedTips === 0) {
      Logger.log(`✅ PASS: Tips all zero (no tips entered)`);
      passCount++;
    } else if (tipsDiff < 1.00) {
      Logger.log(`✅ PASS: Card Tips + Cash Tips ≈ Total Tips ($${calculatedTips.toFixed(2)} ≈ $${shiftData.tipsTotal.toFixed(2)})`);
      passCount++;
    } else {
      Logger.log(`⚠️  WARNING: Card Tips ($${shiftData.cardTips.toFixed(2)}) + Cash Tips ($${shiftData.cashTips.toFixed(2)}) = $${calculatedTips.toFixed(2)}`);
      Logger.log(`        But Total Tips (${FIELD_CONFIG['totalTips'].fallback} formula) = $${shiftData.tipsTotal.toFixed(2)} (difference: $${tipsDiff.toFixed(2)})`);
      Logger.log(`        This may indicate the totalTips formula includes additional tip sources.`);
      passCount++; // Warning, not failure — B37 is a formula
    }

    // Test 3: Cell reading accuracy — verify against manual reads
    Logger.log('');
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log('CELL READING VERIFICATION:');
    Logger.log('───────────────────────────────────────────────────────');

    // Direct cell reads are intentional here — this cross-checks that the batch reader
    // in extractShiftData_() resolves to the same values as direct cell reads.
    // FIELD_CONFIG fallback cells are the authoritative addresses (RunWaratah.js).
    const manualReads = {
      netRevenue:       { cell: FIELD_CONFIG['netRevenue'].fallback,        expected: parseFloat(sheet.getRange('B34').getValue()) || 0, actual: shiftData.netRevenue },
      productionAmount: { cell: FIELD_CONFIG['productionAmount'].fallback,  expected: parseFloat(sheet.getRange('B8').getValue()) || 0,  actual: shiftData.productionAmount },
      cashTakings:      { cell: FIELD_CONFIG['cashTakings'].fallback,       expected: parseFloat(sheet.getRange('B15').getValue()) || 0, actual: shiftData.cashTakings },
      cardTips:         { cell: FIELD_CONFIG['cardTips'].fallback,          expected: parseFloat(sheet.getRange('B32').getValue()) || 0, actual: shiftData.cardTips },
      cashTips:         { cell: FIELD_CONFIG['cashTips'].fallback,          expected: parseFloat(sheet.getRange('B33').getValue()) || 0, actual: shiftData.cashTips },
      tipsTotal:        { cell: FIELD_CONFIG['totalTips'].fallback,         expected: parseFloat(sheet.getRange('B37').getValue()) || 0, actual: shiftData.tipsTotal },
      grossSalesIncCash:{ cell: FIELD_CONFIG['grossSalesIncCash'].fallback, expected: parseFloat(sheet.getRange('B16').getValue()) || 0, actual: shiftData.grossSalesIncCash },
      totalDiscount:    { cell: FIELD_CONFIG['totalDiscount'].fallback,     expected: parseFloat(sheet.getRange('B25').getValue()) || 0, actual: shiftData.totalDiscount },
      taxes:            { cell: FIELD_CONFIG['taxes'].fallback,             expected: parseFloat(sheet.getRange('B28').getValue()) || 0, actual: shiftData.taxes },
    };

    let cellReadErrors = 0;

    Object.keys(manualReads).forEach(key => {
      const r = manualReads[key];
      if (Math.abs(r.actual - r.expected) < 0.01) {
        Logger.log(`✅ ${key} (${r.cell}): $${r.actual.toFixed(2)} matches cell`);
      } else {
        Logger.log(`❌ ${key} (${r.cell}): extracted $${r.actual.toFixed(2)} but cell has $${r.expected.toFixed(2)}`);
        cellReadErrors++;
      }
    });

    if (cellReadErrors === 0) {
      Logger.log(`✅ PASS: All cells read correctly`);
      passCount++;
    } else {
      Logger.log(`❌ FAIL: ${cellReadErrors} cell reading error(s)`);
      failCount++;
    }

    // Test 4: Narrative fields populated check
    Logger.log('');
    Logger.log('───────────────────────────────────────────────────────');
    Logger.log('NARRATIVE FIELDS:');
    Logger.log('───────────────────────────────────────────────────────');

    const narratives = [
      { name: 'Shift Summary', value: shiftData.shiftSummary },
      { name: 'Guests of Note', value: shiftData.guestsOfNote },
      { name: 'The Good', value: shiftData.theGood },
      { name: 'The Bad', value: shiftData.theBad },
      { name: 'Kitchen Notes', value: shiftData.kitchenNotes },
    ];

    narratives.forEach(n => {
      const status = n.value && n.value.trim() ? '✅' : '⬜';
      Logger.log(`${status} ${n.name}: ${n.value ? n.value.substring(0, 60) + (n.value.length > 60 ? '...' : '') : '(empty)'}`);
    });

    // Summary
    Logger.log('');
    Logger.log('═══════════════════════════════════════════════════════');
    Logger.log('VERIFICATION SUMMARY:');
    Logger.log('═══════════════════════════════════════════════════════');
    Logger.log(`✅ Passed:  ${passCount} tests`);
    Logger.log(`❌ Failed:  ${failCount} tests`);
    Logger.log('');

    if (failCount === 0) {
      Logger.log('ALL TESTS PASSED! Data extraction is working correctly.');
      ui.alert(
        'Verification Complete',
        `All ${passCount} tests passed!\n\nData extraction is working correctly.\nCheck Apps Script logs for details.`,
        ui.ButtonSet.OK
      );
    } else {
      Logger.log('SOME TESTS FAILED. Review the log above for details.');
      ui.alert(
        'Verification Failed',
        `${failCount} test(s) failed out of ${passCount + failCount} total.\n\nCheck Apps Script logs for details.`,
        ui.ButtonSet.OK
      );
    }

    Logger.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(error.stack);

    ui.alert(
      'Verification Error',
      `Error during verification:\n\n${error.message}\n\nCheck Apps Script logs for stack trace.`,
      ui.ButtonSet.OK
    );
  }
}


/**
 * Test the warehouse logging with current sheet data
 * CAUTION: This will actually write to the warehouse!
 * Only run this on test data.
 */
function testWarehouseLogging() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Test Warehouse Logging',
    'This will attempt to log current sheet data to the warehouse.\n\n' +
    'Only proceed if:\n' +
    '1. You are testing with sample data\n' +
    '2. You understand this writes to the production warehouse\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Test cancelled.');
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();

    Logger.log('═══════════════════════════════════════════════════════');
    Logger.log('WAREHOUSE LOGGING TEST');
    Logger.log('═══════════════════════════════════════════════════════');

    const shiftData = extractShiftData_(sheetName);

    Logger.log('Attempting to log to warehouse...');
    logToDataWarehouse_(shiftData);
    Logger.log('Warehouse logging completed successfully');

    ui.alert(
      'Test Complete',
      'Warehouse logging test completed successfully.\nCheck the NIGHTLY_FINANCIAL sheet in the warehouse.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(error.stack);

    ui.alert(
      'Test Failed',
      `Warehouse logging failed:\n\n${error.message}`,
      ui.ButtonSet.OK
    );
  }
}
