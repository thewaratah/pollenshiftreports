/****************************************************
 * SAKURA HOUSE FINANCIAL ANALYTICS DASHBOARD
 *
 * Builds and refreshes the ANALYTICS tab in the
 * Data Warehouse spreadsheet using live formulas.
 *
 * Run buildFinancialDashboard() once to set up,
 * then the formulas auto-update as new data arrives.
 *
 * Data source: NIGHTLY_FINANCIAL sheet
 * Columns: A=Date, B=Day, C=WeekEnding, D=MOD,
 *   E=NetRevenue, F=CashTotal, G=CashTips, H=TipsTotal,
 *   I=LoggedAt, J=ProductionAmount, K=Discounts, L=Deposit,
 *   M=FOHStaff, N=BOHStaff, O=CardTips, P=SurchargeTips
 *
 * Sections:
 *   1. This Week snapshot
 *   2. Week-over-Week comparison
 *   3. Day-of-Week averages (Mon-Sat)
 *   4. Weekly Trend (QUERY, columns H+)
 *
 * @version 2.1.0
 ****************************************************/


const ANALYTICS_CONFIG = {
  sourceSheet: "NIGHTLY_FINANCIAL",
  dashboardSheet: "ANALYTICS",
  executiveSheet: "EXECUTIVE_DASHBOARD",
  timezone: "Australia/Sydney"
};


/**
 * Builds the financial analytics dashboard.
 * Sets up headers, formulas, and formatting on the ANALYTICS tab.
 * Safe to re-run — clears and rebuilds each time.
 *
 * Layout (compressed):
 *   Row 1:   Header
 *   Row 2:   Timestamp
 *   Row 3:   THIS WEEK header  |  WEEKLY TREND header (col H)
 *   Row 4:   Week Ending + Shifts  |  Trend column headers (col H)
 *   Row 5:   Total Revenue + Avg Daily  |  Trend QUERY (col H)
 *   Row 6:   Total Tips + Production
 *   Row 7:   Total Discounts
 *   Row 8:   WEEK-OVER-WEEK header
 *   Row 9:   Previous Week Ending
 *   Row 10:  WoW column headers
 *   Rows 11-14: WoW data rows
 *   Row 15:  DAY-OF-WEEK AVERAGES header
 *   Row 16:  DoW column headers
 *   Rows 17-22: DoW data (Mon-Sat)
 *   Row 25+: Extended Trends (M7)
 */
function buildFinancialDashboard() {
  const warehouseId = getDataWarehouseId_();

  if (!warehouseId) {
    try {
      SpreadsheetApp.getUi().alert(
        "Data Warehouse Not Configured",
        "Set SAKURA_DATA_WAREHOUSE_ID in Script Properties before building the dashboard.",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      Logger.log('buildFinancialDashboard: warehouse not configured (UI skipped — trigger context)');
    }
    return;
  }

  const ss = SpreadsheetApp.openById(warehouseId);
  let sheet = ss.getSheetByName(ANALYTICS_CONFIG.dashboardSheet);

  if (!sheet) {
    sheet = ss.insertSheet(ANALYTICS_CONFIG.dashboardSheet);
  }

  sheet.getDataRange().clearContent();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const src = ANALYTICS_CONFIG.sourceSheet;
  const tz = ANALYTICS_CONFIG.timezone;
  const now = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm");

  // ─── SECTION 1: HEADER ─────────────────────────────────────────────
  let row = 1;
  sheet.getRange(row, 1).setValue("SAKURA HOUSE — FINANCIAL ANALYTICS");
  sheet.getRange(row, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(row, 1, 1, 6).merge();

  row = 2;
  sheet.getRange(row, 1).setValue(`Dashboard built: ${now}  •  Data refreshes automatically`);
  sheet.getRange(row, 1).setFontSize(9).setFontColor("#666666").setFontStyle("italic");
  sheet.getRange(row, 1, 1, 6).merge();

  // ─── SECTION 2: THIS WEEK SNAPSHOT ──────────────────────────────────
  row = 3;
  _sectionHeader_(sheet, row, "THIS WEEK");

  row = 4;
  sheet.getRange(row, 1).setValue("Week Ending");
  sheet.getRange(row, 2).setFormula(`=IFERROR(MAX(${src}!C:C),"")`);
  sheet.getRange(row, 2).setNumberFormat("dd/MM/yyyy");

  sheet.getRange(row, 4).setValue("Shifts Reported");
  sheet.getRange(row, 5).setFormula(`=IFERROR(COUNTIF(${src}!C:C,B${row}),0)`);

  const weekRef = `B${row}`; // dynamic: "B4"

  row = 5;
  sheet.getRange(row, 1).setValue("Total Revenue");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Avg Daily Revenue");
  sheet.getRange(row, 5).setFormula(`=IFERROR(AVERAGEIFS(${src}!E:E,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 6;
  sheet.getRange(row, 1).setValue("Total Tips");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!H:H,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Production Amount");
  sheet.getRange(row, 5).setFormula(`=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 7;
  sheet.getRange(row, 1).setValue("Total Discounts");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  // ─── SECTION 3: WEEK-OVER-WEEK COMPARISON ──────────────────────────
  row = 8;
  _sectionHeader_(sheet, row, "WEEK-OVER-WEEK");

  row = 9;
  sheet.getRange(row, 1).setValue("Previous Week Ending");
  sheet.getRange(row, 2).setFormula(`=IFERROR(LARGE(UNIQUE(${src}!C2:C),2),"")`);
  sheet.getRange(row, 2).setNumberFormat("dd/MM/yyyy");

  const prevRef = `B${row}`; // dynamic: "B9"

  row = 10;
  sheet.getRange(row, 1).setValue("");
  sheet.getRange(row, 2).setValue("This Week");
  sheet.getRange(row, 3).setValue("Last Week");
  sheet.getRange(row, 4).setValue("Change");
  sheet.getRange(row, 5).setValue("% Change");
  sheet.getRange(row, 1, 1, 5).setFontWeight("bold").setBackground("#f3f3f3");

  const wowMetrics = [
    { label: "Revenue",    thisFormula: `=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
    { label: "Tips",       thisFormula: `=IFERROR(SUMIFS(${src}!H:H,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!H:H,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
    { label: "Production", thisFormula: `=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
    { label: "Discounts",  thisFormula: `=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
  ];

  const wowStartRow = 11;
  wowMetrics.forEach((m, i) => {
    const r = wowStartRow + i;
    sheet.getRange(r, 1).setValue(m.label);
    sheet.getRange(r, 2).setFormula(m.thisFormula).setNumberFormat(m.fmt);
    sheet.getRange(r, 3).setFormula(m.lastFormula).setNumberFormat(m.fmt);
    sheet.getRange(r, 4).setFormula(`=IFERROR(B${r}-C${r},0)`).setNumberFormat(m.fmt);
    sheet.getRange(r, 5).setFormula(`=IFERROR(D${r}/C${r},0)`).setNumberFormat("+0.0%;-0.0%");
  });

  // ─── SECTION 4: DAY-OF-WEEK AVERAGES ───────────────────────────────
  row = 15;
  _sectionHeader_(sheet, row, "DAY-OF-WEEK AVERAGES (ALL TIME)");

  row = 16;
  const dowHeaders = ["Day", "Avg Revenue", "Avg Tips", "Avg Production", "Avg Discounts", "Count"];
  dowHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, dowHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  const sakuraDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  sakuraDays.forEach((day, i) => {
    const r = 17 + i;
    sheet.getRange(r, 1).setValue(day);
    sheet.getRange(r, 2).setFormula(`=IFERROR(AVERAGEIFS(${src}!E:E,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 3).setFormula(`=IFERROR(AVERAGEIFS(${src}!H:H,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 4).setFormula(`=IFERROR(AVERAGEIFS(${src}!J:J,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 5).setFormula(`=IFERROR(AVERAGEIFS(${src}!K:K,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 6).setFormula(`=COUNTIF(${src}!B:B,"${day}")`).setNumberFormat("#,##0");
  });

  // ─── SECTION 5: WEEKLY TREND (right side) ──────────────────────────
  const trendCol = 8; // Column H

  sheet.getRange(3, trendCol).setValue("WEEKLY TREND");
  sheet.getRange(3, trendCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(3, trendCol, 1, 5).merge();

  const trendHeaders = ["Week Ending", "Revenue", "Tips", "Production", "Shifts"];
  trendHeaders.forEach((h, i) => sheet.getRange(4, trendCol + i).setValue(h));
  sheet.getRange(4, trendCol, 1, trendHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  sheet.getRange(5, trendCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:P,` +
    `"SELECT C, SUM(E), SUM(H), SUM(J), COUNT(A) ` +
    `WHERE C IS NOT NULL ` +
    `GROUP BY C ` +
    `ORDER BY C DESC ` +
    `LABEL C 'Week Ending', SUM(E) 'Revenue', SUM(H) 'Tips', SUM(J) 'Production', COUNT(A) 'Shifts'"),"")`
  );

  // Format the Week Ending column (first column of the query result) as a date
  sheet.getRange(5, trendCol, 50, 1).setNumberFormat("dd/MM/yyyy");

  // ─── FORMATTING ─────────────────────────────────────────────────────
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 100);
  sheet.setColumnWidth(7, 80);
  for (let c = trendCol; c <= trendCol + 4; c++) {
    sheet.setColumnWidth(c, 120);
  }

  // Bold labels — updated to compressed row positions
  sheet.getRange("A4:A7").setFontWeight("bold");
  sheet.getRange("D4:D7").setFontWeight("bold");
  sheet.getRange("A9:A14").setFontWeight("bold");

  // Conditional formatting: negative WoW changes in red, positive in green
  const changeRange = sheet.getRange(`D${wowStartRow}:D${wowStartRow + wowMetrics.length - 1}`);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setFontColor("#ea4335")
      .setRanges([changeRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setFontColor("#34a853")
      .setRanges([changeRange])
      .build()
  ]);

  sheet.setFrozenRows(2);

  // ─── M7: EXTENDED TRENDS ────────────────────────────────────────────
  buildExtendedTrends_Sakura(sheet, src);

  Logger.log("Financial analytics dashboard built successfully.");
  try {
    SpreadsheetApp.getUi().alert("Financial Analytics dashboard has been built on the ANALYTICS tab.");
  } catch (e) {
    Logger.log('buildFinancialDashboard: complete (UI skipped — trigger context)');
  }
}


/**
 * Builds the Executive Dashboard on the EXECUTIVE_DASHBOARD tab.
 * Higher-level monthly/quarterly view for ownership review.
 * Safe to re-run — clears and rebuilds each time.
 *
 * Layout (compressed):
 *   Row 1:   Header
 *   Row 2:   Timestamp
 *   Row 3:   CURRENT MONTH header  |  REVENUE BY DAY header (col H)
 *   Row 4:   Month label/formula   |  DoW rank col headers (col H)
 *   Row 5:   Total Revenue + Shifts  |  DoW rank QUERY (col H)
 *   Row 6:   Avg Daily Revenue + Total Tips
 *   Row 7:   Total Production + Total Discounts
 *   Row 9:   MONTHLY TREND header
 *   Row 10:  Monthly trend column headers
 *   Row 11+: QUERY results (spills ~12 rows)
 *   Row 24:  ROLLING 4-WEEK header
 *   Row 25:  4-Week column headers
 *   Row 26:  Week Ending dates
 *   Rows 27-31: Revenue / Tips / Production / Discounts / Shifts
 *   Rows 32-33: WoW $ and % rows
 *
 * Sections:
 *   1. Header
 *   2. Current Month Snapshot (SUMPRODUCT with MONTH/YEAR)
 *   3. Monthly Trend (QUERY grouped by YEAR*100+MONTH)
 *   4. Rolling 4-Week Comparison (last 4 week-ending dates)
 *   5. Day-of-Week Revenue Ranking (right side, col H)
 */
function buildExecutiveDashboard() {
  const warehouseId = getDataWarehouseId_();

  if (!warehouseId) {
    try {
      SpreadsheetApp.getUi().alert(
        "Data Warehouse Not Configured",
        "Set SAKURA_DATA_WAREHOUSE_ID in Script Properties before building the dashboard.",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      Logger.log('buildExecutiveDashboard: warehouse not configured (UI skipped — trigger context)');
    }
    return;
  }

  const ss = SpreadsheetApp.openById(warehouseId);
  let sheet = ss.getSheetByName(ANALYTICS_CONFIG.executiveSheet);

  if (!sheet) {
    sheet = ss.insertSheet(ANALYTICS_CONFIG.executiveSheet);
  }

  sheet.getDataRange().clearContent();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const src = ANALYTICS_CONFIG.sourceSheet;
  const tz = ANALYTICS_CONFIG.timezone;
  const now = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm");

  // ─── SECTION 1: HEADER ─────────────────────────────────────────────
  let row = 1;
  sheet.getRange(row, 1).setValue("SAKURA HOUSE — EXECUTIVE DASHBOARD");
  sheet.getRange(row, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(row, 1, 1, 7).merge();

  row = 2;
  sheet.getRange(row, 1).setValue(`Dashboard built: ${now}  •  Data refreshes automatically`);
  sheet.getRange(row, 1).setFontSize(9).setFontColor("#666666").setFontStyle("italic");
  sheet.getRange(row, 1, 1, 7).merge();

  // ─── SECTION 2: CURRENT MONTH SNAPSHOT ──────────────────────────────
  row = 3;
  _sectionHeader_(sheet, row, "CURRENT MONTH");

  row = 4;
  sheet.getRange(row, 1).setValue("Month");
  sheet.getRange(row, 2).setFormula('=TEXT(TODAY(),"MMMM YYYY")');
  sheet.getRange(row, 2).setFontWeight("bold");

  row = 5;
  sheet.getRange(row, 1).setValue("Total Revenue");
  sheet.getRange(row, 2).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!E2:E),0)`
  );
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Shifts");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*(${src}!A2:A<>"")*1),0)`
  );

  row = 6;
  sheet.getRange(row, 1).setValue("Avg Daily Revenue");
  sheet.getRange(row, 2).setFormula("=IFERROR(B5/E5,0)");
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Tips");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!H2:H),0)`
  );
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 7;
  sheet.getRange(row, 1).setValue("Total Production");
  sheet.getRange(row, 2).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!J2:J),0)`
  );
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Discounts");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!K2:K),0)`
  );
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  // ─── SECTION 3: MONTHLY TREND ──────────────────────────────────────
  row = 9;
  _sectionHeader_(sheet, row, "MONTHLY TREND");

  row = 10;
  const monthHeaders = ["Month", "Revenue", "Tips", "Production", "Discounts", "Cash Takings", "Shifts"];
  monthHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, monthHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  row = 11;
  // Monthly Trend QUERY: group by YEAR/MONTH using YEAR(A)*100+(MONTH(A)+1).
  // QUERY MONTH() is 0-indexed (Jan=0), so +1 corrects to human months.
  // SELECT must use the same expression as GROUP BY for reliable results.
  // YEAR(A) > 2020 guards against text/invalid dates. headers=0 since range starts at row 2.
  sheet.getRange(row, 1).setFormula(
    `=IFERROR(QUERY(${src}!A2:P, ` +
    `"SELECT YEAR(A)*100+(MONTH(A)+1), SUM(E), SUM(H), SUM(J), SUM(K), SUM(F), COUNT(A) ` +
    `WHERE A IS NOT NULL AND YEAR(A) > 2020 ` +
    `GROUP BY YEAR(A)*100+(MONTH(A)+1) ` +
    `ORDER BY YEAR(A)*100+(MONTH(A)+1) DESC ` +
    `LABEL YEAR(A)*100+(MONTH(A)+1) 'Month', SUM(E) 'Revenue', SUM(H) 'Tips', ` +
    `SUM(J) 'Production', SUM(K) 'Discounts', SUM(F) 'Cash Takings', COUNT(A) 'Shifts'", 0),"")`
  );
  // Format Month column as "0000/00" so 202604 renders as "2026/04"
  sheet.getRange(11, 1, 50, 1).setNumberFormat('0000"/"00');

  // ─── SECTION 4: ROLLING 4-WEEK COMPARISON ──────────────────────────
  // MONTHLY TREND QUERY starts at row 11 and can spill up to ~12 rows (rows 11-22).
  // Row 24 gives a 1-row gap after the longest expected spill.
  row = 24;
  _sectionHeader_(sheet, row, "ROLLING 4-WEEK COMPARISON");

  row = 25;
  const weekCompHeaders = ["", "Week 1 (Latest)", "Week 2", "Week 3", "Week 4"];
  weekCompHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, weekCompHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  const weekEndingRow = 26;
  row = weekEndingRow;
  sheet.getRange(row, 1).setValue("Week Ending");
  for (let w = 1; w <= 4; w++) {
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(LARGE(UNIQUE(${src}!C2:C),${w}),"")`);
    sheet.getRange(row, w + 1).setNumberFormat("dd/MM/yyyy");
  }

  row = 27;
  sheet.getRange(row, 1).setValue("Revenue");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + weekEndingRow;
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 28;
  sheet.getRange(row, 1).setValue("Tips");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + weekEndingRow;
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!H:H,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 29;
  sheet.getRange(row, 1).setValue("Production");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + weekEndingRow;
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 30;
  sheet.getRange(row, 1).setValue("Discounts");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + weekEndingRow;
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 31;
  sheet.getRange(row, 1).setValue("Shifts");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + weekEndingRow;
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(COUNTIF(${src}!C:C,${weekCell}),0)`);
  }

  // WoW change rows — reference Revenue row (27) dynamically
  const revenueRow = 27;
  row = 32;
  sheet.getRange(row, 1).setValue("Revenue WoW $");
  sheet.getRange(row, 2).setFormula(`=IFERROR(B${revenueRow}-C${revenueRow},0)`).setNumberFormat("$#,##0");
  sheet.getRange(row, 3).setFormula(`=IFERROR(C${revenueRow}-D${revenueRow},0)`).setNumberFormat("$#,##0");
  sheet.getRange(row, 4).setFormula(`=IFERROR(D${revenueRow}-E${revenueRow},0)`).setNumberFormat("$#,##0");
  sheet.getRange(row, 5).setValue("—");

  row = 33;
  sheet.getRange(row, 1).setValue("Revenue WoW %");
  sheet.getRange(row, 2).setFormula(`=IFERROR((B${revenueRow}-C${revenueRow})/C${revenueRow},0)`).setNumberFormat("+0.0%;-0.0%");
  sheet.getRange(row, 3).setFormula(`=IFERROR((C${revenueRow}-D${revenueRow})/D${revenueRow},0)`).setNumberFormat("+0.0%;-0.0%");
  sheet.getRange(row, 4).setFormula(`=IFERROR((D${revenueRow}-E${revenueRow})/E${revenueRow},0)`).setNumberFormat("+0.0%;-0.0%");
  sheet.getRange(row, 5).setValue("—");

  // ─── SECTION 5: DAY-OF-WEEK REVENUE RANKING (right side) ───────────
  const rightCol = 8; // Column H

  sheet.getRange(3, rightCol).setValue("REVENUE BY DAY (RANKED)");
  sheet.getRange(3, rightCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(3, rightCol, 1, 4).merge();

  const dowRankHeaders = ["Day", "Avg Revenue", "Total Revenue", "Shifts"];
  dowRankHeaders.forEach((h, i) => sheet.getRange(4, rightCol + i).setValue(h));
  sheet.getRange(4, rightCol, 1, dowRankHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  sheet.getRange(5, rightCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:P,` +
    `"SELECT B, AVG(E), SUM(E), COUNT(A) ` +
    `WHERE B IS NOT NULL ` +
    `GROUP BY B ` +
    `ORDER BY AVG(E) DESC ` +
    `LABEL B 'Day', AVG(E) 'Avg Revenue', SUM(E) 'Total Revenue', COUNT(A) 'Shifts'"),"")`
  );

  // ─── FORMATTING ─────────────────────────────────────────────────────
  for (let c = 1; c <= 7; c++) sheet.setColumnWidth(c, c === 1 ? 160 : 130);
  for (let c = rightCol; c <= rightCol + 3; c++) sheet.setColumnWidth(c, 130);

  // Bold labels — updated to compressed row positions
  sheet.getRange("A5:A7").setFontWeight("bold");
  sheet.getRange("D5:D7").setFontWeight("bold");
  sheet.getRange("A26:A33").setFontWeight("bold");

  // Conditional formatting: WoW changes red/green
  const wowChangeRange = sheet.getRange("B32:D33");
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setFontColor("#ea4335")
      .setRanges([wowChangeRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setFontColor("#34a853")
      .setRanges([wowChangeRange])
      .build()
  ]);

  sheet.setFrozenRows(2);

  Logger.log("Executive dashboard built successfully.");
  try {
    SpreadsheetApp.getUi().alert("Executive Dashboard has been built on the EXECUTIVE_DASHBOARD tab.");
  } catch (e) {
    Logger.log('buildExecutiveDashboard: complete (UI skipped — trigger context)');
  }
}


/**
 * Rebuilds BOTH the ANALYTICS and EXECUTIVE_DASHBOARD tabs.
 * Use for first-time setup, schema changes, or corruption recovery.
 * Not needed for daily data refresh — live formulas handle that.
 */
function rebuildAllDashboards() {
  buildFinancialDashboard();
  buildExecutiveDashboard();
  Logger.log('rebuildAllDashboards: both dashboards rebuilt successfully');
}


/**
 * Helper: writes a section header row.
 */
function _sectionHeader_(sheet, row, title) {
  sheet.getRange(row, 1).setValue(title);
  sheet.getRange(row, 1).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, 1, 1, 6).merge();
}


// ============================================================================
// M7 — EXTENDED TREND WINDOWS (Sakura)
// ============================================================================

/**
 * Appends the "Extended Trends" section to the ANALYTICS sheet.
 * Uses AVERAGEIFS/SUMIFS formulas so the section auto-updates.
 *
 * Starts at row 25, immediately after the DoW Averages section ends at row 22
 * (rows 17-22 for Mon-Sat data), with a 2-row gap.
 *
 * Sections added:
 *   - 13-week & 26-week day-of-week average revenue table (Mon-Sat)
 *   - Day-of-week revenue heatmap (green=best, red=worst)
 *   - Year-to-Date summary (total revenue, shifts, avg per shift)
 *
 * Sakura NIGHTLY_FINANCIAL columns:
 *   A=Date, B=Day, C=WeekEnding, D=MOD, E=NetRevenue, H=TotalTips
 *
 * @param {Sheet} sheet  - The ANALYTICS sheet object.
 * @param {string} src   - Source sheet name ("NIGHTLY_FINANCIAL").
 */
function buildExtendedTrends_Sakura(sheet, src) {
  // DoW section ends at row 22 (17-22 for Mon-Sat). Start with a 2-row gap.
  let row = 25;

  // ── Section header ───────────────────────────────────────────────────
  _sectionHeader_(sheet, row, "EXTENDED TRENDS — DAY-OF-WEEK (13W / 26W)");

  // ── Column headers ───────────────────────────────────────────────────
  row = 26;
  const etHeaders = ["Day", "13-Week Avg Rev", "26-Week Avg Rev", "13-Week Avg Tips", "26-Week Avg Tips", "Heatmap Rank"];
  etHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, etHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  // ── Per-day rows ─────────────────────────────────────────────────────
  const sakuraDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const etDataStartRow = 27;

  sakuraDays.forEach((day, i) => {
    const r = etDataStartRow + i;
    sheet.getRange(r, 1).setValue(day);

    // 13-week avg revenue (91 days)
    sheet.getRange(r, 2).setFormula(
      `=IFERROR(AVERAGEIFS(${src}!E:E,${src}!B:B,"${day}",${src}!A:A,">="&TODAY()-91),0)`
    ).setNumberFormat("$#,##0");

    // 26-week avg revenue (182 days)
    sheet.getRange(r, 3).setFormula(
      `=IFERROR(AVERAGEIFS(${src}!E:E,${src}!B:B,"${day}",${src}!A:A,">="&TODAY()-182),0)`
    ).setNumberFormat("$#,##0");

    // 13-week avg tips
    sheet.getRange(r, 4).setFormula(
      `=IFERROR(AVERAGEIFS(${src}!H:H,${src}!B:B,"${day}",${src}!A:A,">="&TODAY()-91),0)`
    ).setNumberFormat("$#,##0");

    // 26-week avg tips
    sheet.getRange(r, 5).setFormula(
      `=IFERROR(AVERAGEIFS(${src}!H:H,${src}!B:B,"${day}",${src}!A:A,">="&TODAY()-182),0)`
    ).setNumberFormat("$#,##0");

    // Rank by 13-week avg revenue (RANK: 1=highest)
    sheet.getRange(r, 6).setFormula(
      `=IFERROR(RANK(B${r},B${etDataStartRow}:B${etDataStartRow + 5},0),"")`
    );
  });

  // ── Day-of-week heatmap: colour the 13W avg revenue column green→red ──
  // Colours applied at build time from server-side AVERAGEIFS evaluation.
  // Green (#b7e1cd) = highest, Red (#c5221f) = lowest; 6 steps.
  const heatmapColors = ["#34a853", "#81c995", "#b7e1cd", "#f6aea9", "#ea4335", "#c5221f"];

  try {
    const revenueVals = sheet.getRange(etDataStartRow, 2, 6, 1).getValues().map(r => r[0]);
    if (revenueVals.some(v => v > 0)) {
      const sorted = revenueVals
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v - a.v);
      sorted.forEach(({ i }, rank) => {
        sheet.getRange(etDataStartRow + i, 2).setBackground(heatmapColors[rank] || "#ffffff");
      });
    }
  } catch (e) {
    // Heatmap colouring is best-effort; formulas still present
    Logger.log(`Extended Trends heatmap skipped: ${e.message}`);
  }

  // ── Year to Date ─────────────────────────────────────────────────────
  row = 34;
  _sectionHeader_(sheet, row, "YEAR TO DATE");

  row = 35;
  sheet.getRange(row, 1).setValue("YTD Total Revenue");
  sheet.getRange(row, 2).setFormula(
    `=IFERROR(SUMPRODUCT((YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!E2:E),0)`
  ).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("YTD Shifts");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((YEAR(${src}!A2:A)=YEAR(TODAY()))*(${src}!A2:A<>"")*1),0)`
  ).setNumberFormat("#,##0");

  row = 36;
  sheet.getRange(row, 1).setValue("YTD Avg Revenue / Shift");
  sheet.getRange(row, 2).setFormula(`=IFERROR(B35/E35,0)`).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("YTD Total Tips");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!H2:H),0)`
  ).setNumberFormat("$#,##0");

  // Bold labels
  sheet.getRange("A35:A36").setFontWeight("bold");
  sheet.getRange("D35:D36").setFontWeight("bold");

  Logger.log("M7 Extended Trends section built for Sakura.");
}
