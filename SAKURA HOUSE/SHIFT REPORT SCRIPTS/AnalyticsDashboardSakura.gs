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
 *   I=LoggedAt, J=TotalTips, K=ProductionAmount, L=Discounts, M=Deposit
 *
 * Sections:
 *   1. This Week snapshot
 *   2. Week-over-Week comparison
 *   3. Day-of-Week averages (Mon-Sat)
 *   4. Weekly Trend (QUERY, columns H+)
 *
 * @version 2.0.0
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
 */
function buildFinancialDashboard() {
  const warehouseId = getDataWarehouseId_();

  if (!warehouseId) {
    SpreadsheetApp.getUi().alert(
      "Data Warehouse Not Configured",
      "Set SAKURA_DATA_WAREHOUSE_ID in Script Properties before building the dashboard.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
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
  row = 4;
  _sectionHeader_(sheet, row, "THIS WEEK");

  row = 5;
  sheet.getRange(row, 1).setValue("Week Ending");
  sheet.getRange(row, 2).setFormula(`=IFERROR(MAX(${src}!C:C),"")`);
  sheet.getRange(row, 2).setNumberFormat("dd/MM/yyyy");

  sheet.getRange(row, 4).setValue("Shifts Reported");
  sheet.getRange(row, 5).setFormula(`=IFERROR(COUNTIF(${src}!C:C,B5),0)`);

  row = 6;
  const weekRef = "B5";
  sheet.getRange(row, 1).setValue("Total Revenue");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Avg Daily Revenue");
  sheet.getRange(row, 5).setFormula(`=IFERROR(AVERAGEIFS(${src}!E:E,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 7;
  sheet.getRange(row, 1).setValue("Total Tips");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Production Amount");
  sheet.getRange(row, 5).setFormula(`=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 8;
  sheet.getRange(row, 1).setValue("Total Discounts");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!L:L,${src}!C:C,${weekRef}),0)`);
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  // ─── SECTION 3: WEEK-OVER-WEEK COMPARISON ──────────────────────────
  row = 10;
  _sectionHeader_(sheet, row, "WEEK-OVER-WEEK");

  row = 11;
  sheet.getRange(row, 1).setValue("Previous Week Ending");
  sheet.getRange(row, 2).setFormula(`=IFERROR(LARGE(UNIQUE(${src}!C2:C),2),"")`);
  sheet.getRange(row, 2).setNumberFormat("dd/MM/yyyy");

  const prevRef = "B11";

  row = 12;
  sheet.getRange(row, 1).setValue("");
  sheet.getRange(row, 2).setValue("This Week");
  sheet.getRange(row, 3).setValue("Last Week");
  sheet.getRange(row, 4).setValue("Change");
  sheet.getRange(row, 5).setValue("% Change");
  sheet.getRange(row, 1, 1, 5).setFontWeight("bold").setBackground("#f3f3f3");

  const wowMetrics = [
    { label: "Revenue", thisFormula: `=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
    { label: "Tips", thisFormula: `=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
    { label: "Production", thisFormula: `=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
    { label: "Discounts", thisFormula: `=IFERROR(SUMIFS(${src}!L:L,${src}!C:C,${weekRef}),0)`, lastFormula: `=IFERROR(SUMIFS(${src}!L:L,${src}!C:C,${prevRef}),0)`, fmt: "$#,##0" },
  ];

  wowMetrics.forEach((m, i) => {
    const r = 13 + i;
    sheet.getRange(r, 1).setValue(m.label);
    sheet.getRange(r, 2).setFormula(m.thisFormula).setNumberFormat(m.fmt);
    sheet.getRange(r, 3).setFormula(m.lastFormula).setNumberFormat(m.fmt);
    sheet.getRange(r, 4).setFormula(`=IFERROR(B${r}-C${r},0)`).setNumberFormat(m.fmt);
    sheet.getRange(r, 5).setFormula(`=IFERROR(D${r}/C${r},0)`).setNumberFormat("+0.0%;-0.0%");
  });

  // ─── SECTION 4: DAY-OF-WEEK AVERAGES ───────────────────────────────
  row = 18;
  _sectionHeader_(sheet, row, "DAY-OF-WEEK AVERAGES (ALL TIME)");

  row = 19;
  const dowHeaders = ["Day", "Avg Revenue", "Avg Tips", "Avg Production", "Avg Discounts", "Count"];
  dowHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, dowHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  const sakuraDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  sakuraDays.forEach((day, i) => {
    const r = 20 + i;
    sheet.getRange(r, 1).setValue(day);
    sheet.getRange(r, 2).setFormula(`=IFERROR(AVERAGEIFS(${src}!E:E,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 3).setFormula(`=IFERROR(AVERAGEIFS(${src}!J:J,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 4).setFormula(`=IFERROR(AVERAGEIFS(${src}!K:K,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 5).setFormula(`=IFERROR(AVERAGEIFS(${src}!L:L,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");
    sheet.getRange(r, 6).setFormula(`=COUNTIF(${src}!B:B,"${day}")`).setNumberFormat("#,##0");
  });

  // ─── SECTION 5: WEEKLY TREND ────────────────────────────────────────
  const trendCol = 8; // Column H

  sheet.getRange(4, trendCol).setValue("WEEKLY TREND");
  sheet.getRange(4, trendCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(4, trendCol, 1, 5).merge();

  const trendHeaders = ["Week Ending", "Revenue", "Tips", "Production", "Shifts"];
  trendHeaders.forEach((h, i) => sheet.getRange(5, trendCol + i).setValue(h));
  sheet.getRange(5, trendCol, 1, trendHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  sheet.getRange(6, trendCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:M,` +
    `"SELECT C, SUM(E), SUM(J), SUM(K), COUNT(A) ` +
    `WHERE C IS NOT NULL ` +
    `GROUP BY C ` +
    `ORDER BY C DESC ` +
    `LABEL C 'Week Ending', SUM(E) 'Revenue', SUM(J) 'Tips', SUM(K) 'Production', COUNT(A) 'Shifts'"),"")`
  );

  // Format the Week Ending column (first column of the query result) as a date
  sheet.getRange(6, trendCol, 50, 1).setNumberFormat("dd/MM/yyyy");

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

  // Bold labels
  sheet.getRange("A5:A8").setFontWeight("bold");
  sheet.getRange("D5:D7").setFontWeight("bold");
  sheet.getRange("A12:A16").setFontWeight("bold");

  // Conditional formatting: negative WoW changes in red, positive in green
  const changeRange = sheet.getRange("D13:D16");
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

  Logger.log("Financial analytics dashboard built successfully.");
  SpreadsheetApp.getUi().alert("Financial Analytics dashboard has been built on the ANALYTICS tab.");
}


/**
 * Builds the Executive Dashboard on the EXECUTIVE_DASHBOARD tab.
 * Higher-level monthly/quarterly view for ownership review.
 * Safe to re-run — clears and rebuilds each time.
 *
 * Sections:
 *   1. Header
 *   2. Current Month Snapshot (SUMPRODUCT with MONTH/YEAR)
 *   3. Monthly Trend (QUERY grouped by YEAR*100+MONTH)
 *   4. Rolling 4-Week Comparison (last 4 week-ending dates)
 *   5. Top MOD Performance (right side, col H)
 *   6. Day-of-Week Revenue Ranking (right side, col H)
 */
function buildExecutiveDashboard() {
  const warehouseId = getDataWarehouseId_();

  if (!warehouseId) {
    SpreadsheetApp.getUi().alert(
      "Data Warehouse Not Configured",
      "Set SAKURA_DATA_WAREHOUSE_ID in Script Properties before building the dashboard.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
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
  row = 4;
  _sectionHeader_(sheet, row, "CURRENT MONTH");

  row = 5;
  sheet.getRange(row, 1).setValue("Month");
  sheet.getRange(row, 2).setFormula('=TEXT(TODAY(),"MMMM YYYY")');
  sheet.getRange(row, 2).setFontWeight("bold");

  row = 6;
  sheet.getRange(row, 1).setValue("Total Revenue");
  sheet.getRange(row, 2).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!E2:E),0)`
  );
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Shifts");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*(${src}!A2:A<>"")*1),0)`
  );

  row = 7;
  sheet.getRange(row, 1).setValue("Avg Daily Revenue");
  sheet.getRange(row, 2).setFormula("=IFERROR(B6/E6,0)");
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Tips");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!J2:J),0)`
  );
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 8;
  sheet.getRange(row, 1).setValue("Total Production");
  sheet.getRange(row, 2).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!K2:K),0)`
  );
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Discounts");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!L2:L),0)`
  );
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  // ─── SECTION 3: MONTHLY TREND ──────────────────────────────────────
  row = 10;
  _sectionHeader_(sheet, row, "MONTHLY TREND");

  row = 11;
  const monthHeaders = ["Month", "Revenue", "Tips", "Production", "Discounts", "Shifts"];
  monthHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, monthHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  row = 12;
  sheet.getRange(row, 1).setFormula(
    `=IFERROR(QUERY(${src}!A2:M,` +
    `"SELECT YEAR(A)*100+MONTH(A), SUM(E), SUM(J), SUM(K), SUM(L), COUNT(A) ` +
    `WHERE A IS NOT NULL ` +
    `GROUP BY YEAR(A)*100+MONTH(A) ` +
    `ORDER BY YEAR(A)*100+MONTH(A) DESC ` +
    `LABEL YEAR(A)*100+MONTH(A) 'Month', SUM(E) 'Revenue', SUM(J) 'Tips', ` +
    `SUM(K) 'Production', SUM(L) 'Discounts', COUNT(A) 'Shifts'"),"")`
  );

  // ─── SECTION 4: ROLLING 4-WEEK COMPARISON ──────────────────────────
  row = 26;
  _sectionHeader_(sheet, row, "ROLLING 4-WEEK COMPARISON");

  row = 27;
  const weekCompHeaders = ["", "Week 1 (Latest)", "Week 2", "Week 3", "Week 4"];
  weekCompHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, weekCompHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  row = 28;
  sheet.getRange(row, 1).setValue("Week Ending");
  for (let w = 1; w <= 4; w++) {
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(LARGE(UNIQUE(${src}!C2:C),${w}),"")`);
    sheet.getRange(row, w + 1).setNumberFormat("dd/MM/yyyy");
  }

  row = 29;
  sheet.getRange(row, 1).setValue("Revenue");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + "28";
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!E:E,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 30;
  sheet.getRange(row, 1).setValue("Tips");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + "28";
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!J:J,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 31;
  sheet.getRange(row, 1).setValue("Production");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + "28";
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!K:K,${src}!C:C,${weekCell}),0)`);
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 32;
  sheet.getRange(row, 1).setValue("Shifts");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + "28";
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(COUNTIF(${src}!C:C,${weekCell}),0)`);
  }

  // WoW change rows
  row = 33;
  sheet.getRange(row, 1).setValue("Revenue WoW $");
  sheet.getRange(row, 2).setFormula("=IFERROR(B29-C29,0)").setNumberFormat("$#,##0");
  sheet.getRange(row, 3).setFormula("=IFERROR(C29-D29,0)").setNumberFormat("$#,##0");
  sheet.getRange(row, 4).setFormula("=IFERROR(D29-E29,0)").setNumberFormat("$#,##0");
  sheet.getRange(row, 5).setValue("—");

  row = 34;
  sheet.getRange(row, 1).setValue("Revenue WoW %");
  sheet.getRange(row, 2).setFormula("=IFERROR((B29-C29)/C29,0)").setNumberFormat("+0.0%;-0.0%");
  sheet.getRange(row, 3).setFormula("=IFERROR((C29-D29)/D29,0)").setNumberFormat("+0.0%;-0.0%");
  sheet.getRange(row, 4).setFormula("=IFERROR((D29-E29)/E29,0)").setNumberFormat("+0.0%;-0.0%");
  sheet.getRange(row, 5).setValue("—");

  // ─── SECTION 5: TOP MOD PERFORMANCE (right side) ───────────────────
  const modCol = 8; // Column H
  let modRow = 4;
  sheet.getRange(modRow, modCol).setValue("TOP MOD PERFORMANCE");
  sheet.getRange(modRow, modCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(modRow, modCol, 1, 4).merge();

  modRow = 5;
  const execModHeaders = ["MOD", "Shifts", "Avg Revenue", "Avg Tips"];
  execModHeaders.forEach((h, i) => sheet.getRange(modRow, modCol + i).setValue(h));
  sheet.getRange(modRow, modCol, 1, execModHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  modRow = 6;
  sheet.getRange(modRow, modCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:M,` +
    `"SELECT D, COUNT(D), AVG(E), AVG(J) ` +
    `WHERE D IS NOT NULL ` +
    `GROUP BY D ` +
    `ORDER BY AVG(E) DESC ` +
    `LABEL D 'MOD', COUNT(D) 'Shifts', AVG(E) 'Avg Revenue', AVG(J) 'Avg Tips'"),"")`
  );

  // ─── SECTION 6: DAY-OF-WEEK REVENUE RANKING (right side) ──────────
  let dowRow = 16;
  sheet.getRange(dowRow, modCol).setValue("REVENUE BY DAY (RANKED)");
  sheet.getRange(dowRow, modCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(dowRow, modCol, 1, 4).merge();

  dowRow = 17;
  const dowRankHeaders = ["Day", "Avg Revenue", "Total Revenue", "Shifts"];
  dowRankHeaders.forEach((h, i) => sheet.getRange(dowRow, modCol + i).setValue(h));
  sheet.getRange(dowRow, modCol, 1, dowRankHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  dowRow = 18;
  sheet.getRange(dowRow, modCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:M,` +
    `"SELECT B, AVG(E), SUM(E), COUNT(A) ` +
    `WHERE B IS NOT NULL ` +
    `GROUP BY B ` +
    `ORDER BY AVG(E) DESC ` +
    `LABEL B 'Day', AVG(E) 'Avg Revenue', SUM(E) 'Total Revenue', COUNT(A) 'Shifts'"),"")`
  );

  // ─── FORMATTING ─────────────────────────────────────────────────────
  for (let c = 1; c <= 7; c++) sheet.setColumnWidth(c, c === 1 ? 160 : 130);
  for (let c = modCol; c <= modCol + 3; c++) sheet.setColumnWidth(c, 130);

  // Bold labels
  sheet.getRange("A5:A8").setFontWeight("bold");
  sheet.getRange("D6:D8").setFontWeight("bold");
  sheet.getRange("A28:A34").setFontWeight("bold");

  // Conditional formatting: WoW changes red/green
  const wowChangeRange = sheet.getRange("B33:D34");
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
  SpreadsheetApp.getUi().alert("Executive Dashboard has been built on the EXECUTIVE_DASHBOARD tab.");
}


/**
 * Helper: writes a section header row.
 */
function _sectionHeader_(sheet, row, title) {
  sheet.getRange(row, 1).setValue(title);
  sheet.getRange(row, 1).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, 1, 1, 6).merge();
}
