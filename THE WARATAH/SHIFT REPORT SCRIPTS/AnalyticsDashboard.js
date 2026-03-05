/****************************************************
 * WARATAH FINANCIAL ANALYTICS DASHBOARD
 *
 * Builds and refreshes the ANALYTICS tab in the
 * Data Warehouse spreadsheet using live formulas.
 *
 * Run buildFinancialDashboard() once to set up,
 * then the formulas auto-update as new data arrives.
 *
 * Source: NIGHTLY_FINANCIAL sheet
 * Columns (22-col schema as of Mar 2026):
 *   A=Date, B=Day, C=WeekEnding, D=MOD, E=Staff,
 *   F=NetRevenue, G=ProductionAmount, H=CashTakings,
 *   I=GrossSalesIncCash, J=CashReturns, K=CDDiscount,
 *   L=Refunds, M=CDRedeem, N=TotalDiscount,
 *   O=DiscountsCompsExcCD, P=GrossTaxableSales,
 *   Q=Taxes, R=NetSalesWTips, S=CardTips, T=CashTips,
 *   U=TotalTips, V=LoggedAt
 *
 * @version 3.0.0
 ****************************************************/


function getAnalyticsConfig() {
  const config = getIntegrationConfig_();
  return {
    warehouseId: config.dataWarehouseId,
    sourceSheet: "NIGHTLY_FINANCIAL",
    dashboardSheet: "ANALYTICS",
    executiveSheet: "EXECUTIVE_DASHBOARD",
    timezone: "Australia/Sydney"
  };
}


/**
 * Builds the full financial analytics dashboard.
 * Sets up headers, formulas, and formatting on the ANALYTICS tab.
 * Safe to re-run — clears and rebuilds each time.
 */
function buildFinancialDashboard() {
  const config = getAnalyticsConfig();
  const ss = SpreadsheetApp.openById(config.warehouseId);
  let sheet = ss.getSheetByName(config.dashboardSheet);

  if (!sheet) {
    sheet = ss.insertSheet(config.dashboardSheet);
  }

  // Clear everything
  sheet.getDataRange().clearContent();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const src = config.sourceSheet;
  const tz = config.timezone;
  const now = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm");

  // ─── SECTION 1: HEADER ─────────────────────────────────────────────
  let row = 1;
  sheet.getRange(row, 1).setValue("THE WARATAH — FINANCIAL ANALYTICS");
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
  // Find the most recent week-ending date
  sheet.getRange(row, 1).setValue("Week Ending");
  sheet.getRange(row, 2).setFormula(`=IFERROR(MAX(${src}!C:C),"")`);
  sheet.getRange(row, 2).setNumberFormat("dd/MM/yyyy");

  sheet.getRange(row, 4).setValue("Shifts Reported");
  sheet.getRange(row, 5).setFormula(`=IFERROR(COUNTIF(${src}!C:C,B5),0)`);

  row = 6;
  const weekRef = "B5"; // points to the current week-ending date
  sheet.getRange(row, 1).setValue("Total Revenue");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!F:F,${src}!C:C,${weekRef}),0)`); // F=NetRevenue
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Avg Daily Revenue");
  sheet.getRange(row, 5).setFormula(`=IFERROR(AVERAGEIFS(${src}!F:F,${src}!C:C,${weekRef}),0)`); // F=NetRevenue
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 7;
  sheet.getRange(row, 1).setValue("Total Cash Takings");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!H:H,${src}!C:C,${weekRef}),0)`); // H=CashTakings
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Tips");
  sheet.getRange(row, 5).setFormula(`=IFERROR(SUMIFS(${src}!U:U,${src}!C:C,${weekRef}),0)`); // U=TotalTips
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 8;
  sheet.getRange(row, 1).setValue("Total Discounts");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!N:N,${src}!C:C,${weekRef}),0)`); // N=TotalDiscount
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Taxes");
  sheet.getRange(row, 5).setFormula(`=IFERROR(SUMIFS(${src}!Q:Q,${src}!C:C,${weekRef}),0)`); // Q=Taxes
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 9;
  sheet.getRange(row, 1).setValue("Production Amount");
  sheet.getRange(row, 2).setFormula(`=IFERROR(SUMIFS(${src}!G:G,${src}!C:C,${weekRef}),0)`); // G=ProductionAmount
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  // ─── SECTION 3: WEEK-OVER-WEEK COMPARISON ──────────────────────────
  row = 11;
  _sectionHeader_(sheet, row, "WEEK-OVER-WEEK");

  row = 12;
  sheet.getRange(row, 1).setValue("Previous Week Ending");
  // Second most recent week-ending date
  sheet.getRange(row, 2).setFormula(`=IFERROR(LARGE(UNIQUE(${src}!C2:C),2),"")`);
  sheet.getRange(row, 2).setNumberFormat("dd/MM/yyyy");

  const prevRef = "B12";

  row = 13;
  sheet.getRange(row, 1).setValue("");
  sheet.getRange(row, 2).setValue("This Week");
  sheet.getRange(row, 3).setValue("Last Week");
  sheet.getRange(row, 4).setValue("Change");
  sheet.getRange(row, 5).setValue("% Change");
  sheet.getRange(row, 1, 1, 5).setFontWeight("bold").setBackground("#f3f3f3");

  const wowMetrics = [
    { label: "Revenue",     col: "F", fmt: "$#,##0" },
    { label: "Cash Takings",col: "H", fmt: "$#,##0" },
    { label: "Tips",        col: "U", fmt: "$#,##0" },
    { label: "Discounts",   col: "N", fmt: "$#,##0" },
    { label: "Taxes",       col: "Q", fmt: "$#,##0" },
    { label: "Production",  col: "G", fmt: "$#,##0" },
  ];

  wowMetrics.forEach((m, i) => {
    const r = 14 + i;
    sheet.getRange(r, 1).setValue(m.label);
    sheet.getRange(r, 2).setFormula(`=IFERROR(SUMIFS(${src}!${m.col}:${m.col},${src}!C:C,${weekRef}),0)`).setNumberFormat(m.fmt);
    sheet.getRange(r, 3).setFormula(`=IFERROR(SUMIFS(${src}!${m.col}:${m.col},${src}!C:C,${prevRef}),0)`).setNumberFormat(m.fmt);
    sheet.getRange(r, 4).setFormula(`=IFERROR(B${r}-C${r},0)`).setNumberFormat(m.fmt);
    sheet.getRange(r, 5).setFormula(`=IFERROR(D${r}/C${r},0)`).setNumberFormat("+0.0%;-0.0%");
  });

  // ─── SECTION 4: DAY-OF-WEEK AVERAGES ───────────────────────────────
  row = 21;
  _sectionHeader_(sheet, row, "DAY-OF-WEEK AVERAGES (ALL TIME)");

  row = 22;
  const dowHeaders = ["Day", "Avg Revenue", "Avg Cash Takings", "Avg Tips", "Avg Discounts", "Avg Production", "Count"];
  dowHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, dowHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  const days = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  days.forEach((day, i) => {
    const r = 23 + i;
    sheet.getRange(r, 1).setValue(day);
    sheet.getRange(r, 2).setFormula(`=IFERROR(AVERAGEIFS(${src}!F:F,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");         // F=NetRevenue
    sheet.getRange(r, 3).setFormula(`=IFERROR(AVERAGEIFS(${src}!H:H,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");         // H=CashTakings
    sheet.getRange(r, 4).setFormula(`=IFERROR(AVERAGEIFS(${src}!U:U,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");         // U=TotalTips
    sheet.getRange(r, 5).setFormula(`=IFERROR(AVERAGEIFS(${src}!N:N,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");         // N=TotalDiscount
    sheet.getRange(r, 6).setFormula(`=IFERROR(AVERAGEIFS(${src}!G:G,${src}!B:B,"${day}"),0)`).setNumberFormat("$#,##0");         // G=ProductionAmount
    sheet.getRange(r, 7).setFormula(`=COUNTIF(${src}!B:B,"${day}")`).setNumberFormat("#,##0");
  });

  // MOD PERFORMANCE section removed — user deleted rows 31+ from the sheet (Feb 2026).
  // Do not add code here that writes to rows 31 or beyond on the ANALYTICS tab.

  // ─── SECTION 5: WEEKLY TREND ────────────────────────────────────────
  // Place in columns I-N to avoid colliding with left-side data
  const trendCol = 9; // Column I

  row = 4;
  sheet.getRange(row, trendCol).setValue("WEEKLY TREND");
  sheet.getRange(row, trendCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, trendCol, 1, 6).merge();

  row = 5;
  const trendHeaders = ["Week Ending", "Revenue", "Cash Takings", "Tips", "Discounts", "Taxes"];
  trendHeaders.forEach((h, i) => sheet.getRange(row, trendCol + i).setValue(h));
  sheet.getRange(row, trendCol, 1, trendHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  row = 6;
  sheet.getRange(row, trendCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:V,` +
    `"SELECT C, SUM(F), SUM(H), SUM(U), SUM(N), SUM(Q) ` +
    `WHERE C IS NOT NULL ` +
    `GROUP BY C ` +
    `ORDER BY C DESC ` +
    `LABEL C 'Week Ending', SUM(F) 'Revenue', SUM(H) 'Cash Takings', SUM(U) 'Tips', SUM(N) 'Discounts', SUM(Q) 'Taxes'"),"")`
  );
  // Format the Week Ending column as a date (QUERY returns serial numbers otherwise)
  sheet.getRange(7, trendCol, 50, 1).setNumberFormat("dd/MM/yyyy");

  // ─── FORMATTING ─────────────────────────────────────────────────────
  // Column widths
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 80);
  // Trend columns
  for (let c = trendCol; c <= trendCol + 5; c++) {
    sheet.setColumnWidth(c, 120);
  }

  // Bold labels in column A
  sheet.getRange("A5:A9").setFontWeight("bold");
  sheet.getRange("A13:A19").setFontWeight("bold");
  sheet.getRange("D5:D9").setFontWeight("bold");

  // Conditional formatting: negative WoW changes in red, positive in green
  const changeRange = sheet.getRange("D14:D19");
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

  // Freeze header
  sheet.setFrozenRows(2);

  Logger.log("Financial analytics dashboard built successfully.");
  try { SpreadsheetApp.getUi().alert("Financial Analytics dashboard has been built on the ANALYTICS tab."); }
  catch (e) { Logger.log('UI alert skipped — trigger context'); }
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
  const config = getAnalyticsConfig();
  const ss = SpreadsheetApp.openById(config.warehouseId);
  let sheet = ss.getSheetByName(config.executiveSheet);

  if (!sheet) {
    sheet = ss.insertSheet(config.executiveSheet);
  }

  sheet.getDataRange().clearContent();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const src = config.sourceSheet;
  const tz = config.timezone;
  const now = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm");

  // ─── SECTION 1: HEADER ─────────────────────────────────────────────
  let row = 1;
  sheet.getRange(row, 1).setValue("THE WARATAH — EXECUTIVE DASHBOARD");
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
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!F2:F),0)` // F=NetRevenue
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
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!U2:U),0)` // U=TotalTips
  );
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  row = 8;
  sheet.getRange(row, 1).setValue("Total Discounts");
  sheet.getRange(row, 2).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!N2:N),0)` // N=TotalDiscount
  );
  sheet.getRange(row, 2).setNumberFormat("$#,##0");

  sheet.getRange(row, 4).setValue("Total Taxes");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(SUMPRODUCT((MONTH(${src}!A2:A)=MONTH(TODAY()))*(YEAR(${src}!A2:A)=YEAR(TODAY()))*${src}!Q2:Q),0)` // Q=Taxes
  );
  sheet.getRange(row, 5).setNumberFormat("$#,##0");

  // ─── SECTION 3: MONTHLY TREND ──────────────────────────────────────
  row = 10;
  _sectionHeader_(sheet, row, "MONTHLY TREND");

  row = 11;
  const monthHeaders = ["Month", "Revenue", "Tips", "Discounts", "Taxes", "Shifts"];
  monthHeaders.forEach((h, i) => sheet.getRange(row, i + 1).setValue(h));
  sheet.getRange(row, 1, 1, monthHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  row = 12;
  sheet.getRange(row, 1).setFormula(
    `=IFERROR(QUERY(${src}!A2:V,` +
    `"SELECT YEAR(A)*100+MONTH(A), SUM(F), SUM(U), SUM(N), SUM(Q), COUNT(A) ` +
    `WHERE A IS NOT NULL ` +
    `GROUP BY YEAR(A)*100+MONTH(A) ` +
    `ORDER BY YEAR(A)*100+MONTH(A) DESC ` +
    `LABEL YEAR(A)*100+MONTH(A) 'Month', SUM(F) 'Revenue', SUM(U) 'Tips', SUM(N) 'Discounts', ` +
    `SUM(Q) 'Taxes', COUNT(A) 'Shifts'"),"")`
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
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!F:F,${src}!C:C,${weekCell}),0)`); // F=NetRevenue
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 30;
  sheet.getRange(row, 1).setValue("Tips");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + "28";
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!U:U,${src}!C:C,${weekCell}),0)`); // U=TotalTips
    sheet.getRange(row, w + 1).setNumberFormat("$#,##0");
  }

  row = 31;
  sheet.getRange(row, 1).setValue("Discounts");
  for (let w = 1; w <= 4; w++) {
    const weekCell = String.fromCharCode(65 + w) + "28";
    sheet.getRange(row, w + 1).setFormula(`=IFERROR(SUMIFS(${src}!N:N,${src}!C:C,${weekCell}),0)`); // N=TotalDiscount
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
  sheet.getRange(modRow, modCol, 1, 3).merge();

  modRow = 5;
  const execModHeaders = ["MOD", "Shifts", "Avg Revenue"];
  execModHeaders.forEach((h, i) => sheet.getRange(modRow, modCol + i).setValue(h));
  sheet.getRange(modRow, modCol, 1, execModHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  modRow = 6;
  sheet.getRange(modRow, modCol).setFormula(
    `=IFERROR(QUERY(${src}!A2:V,` +
    `"SELECT D, COUNT(D), AVG(F) ` +
    `WHERE D IS NOT NULL ` +
    `GROUP BY D ` +
    `ORDER BY AVG(F) DESC ` +
    `LABEL D 'MOD', COUNT(D) 'Shifts', AVG(F) 'Avg Revenue'"),"")`
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
    `=IFERROR(QUERY(${src}!A2:V,` +
    `"SELECT B, AVG(F), SUM(F), COUNT(A) ` +
    `WHERE B IS NOT NULL ` +
    `GROUP BY B ` +
    `ORDER BY AVG(F) DESC ` +
    `LABEL B 'Day', AVG(F) 'Avg Revenue', SUM(F) 'Total Revenue', COUNT(A) 'Shifts'"),"")`
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
  try { SpreadsheetApp.getUi().alert("Executive Dashboard has been built on the EXECUTIVE_DASHBOARD tab."); }
  catch (e) { Logger.log('UI alert skipped — trigger context'); }
}


/**
 * Helper: writes a section header row.
 */
function _sectionHeader_(sheet, row, title) {
  sheet.getRange(row, 1).setValue(title);
  sheet.getRange(row, 1).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, 1, 1, 6).merge();
}
