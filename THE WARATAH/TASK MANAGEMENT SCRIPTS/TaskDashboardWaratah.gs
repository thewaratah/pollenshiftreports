/****************************************************
 * WARATAH TASK ANALYTICS DASHBOARD
 *
 * Builds and refreshes the TASK DASHBOARD tab in the
 * Master Actionables spreadsheet using live formulas.
 *
 * Run buildTaskDashboard() once to set up,
 * then the formulas auto-update as data changes.
 *
 * Source sheets:
 *   MASTER ACTIONABLES SHEET (cols A-N)
 *   ARCHIVE (cols A-N + O=Archived Date)
 *
 * @version 1.0.0
 ****************************************************/


/**
 * Builds the full task analytics dashboard.
 * Sets up headers, formulas, and formatting on the TASK DASHBOARD tab.
 * Safe to re-run — clears and rebuilds each time.
 */
function buildTaskDashboard() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());

  // Ensure ARCHIVE sheet exists before building formulas that reference it
  ensureArchiveSheet_(ss);

  let sheet = ss.getSheetByName("TASK DASHBOARD");

  if (!sheet) {
    sheet = ss.insertSheet("TASK DASHBOARD");
  }

  // Clear everything
  sheet.clearContents();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const master = TASK_CONFIG.sheets.master;
  const archive = TASK_CONFIG.sheets.archive;
  const tz = TASK_CONFIG.timezone;
  const now = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm");

  // ─── SECTION 1: HEADER ─────────────────────────────────────────────
  let row = 1;
  sheet.getRange(row, 1).setValue("THE WARATAH — TASK DASHBOARD");
  sheet.getRange(row, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(row, 1, 1, 6).merge();

  row = 2;
  sheet.getRange(row, 1).setValue(`Dashboard built: ${now}  •  Data refreshes automatically`);
  sheet.getRange(row, 1).setFontSize(9).setFontColor("#666666").setFontStyle("italic");
  sheet.getRange(row, 1, 1, 6).merge();

  // ─── SECTION 2: CURRENT SNAPSHOT ────────────────────────────────────
  row = 4;
  _taskSectionHeader_(sheet, row, "CURRENT SNAPSHOT");

  row = 5;
  sheet.getRange(row, 1).setValue("Total Active Tasks");
  // Active = everything except DONE and CANCELLED (Status is col B)
  sheet.getRange(row, 2).setFormula(
    `=COUNTIFS('${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED",'${master}'!B:B,"<>")`
  );
  sheet.getRange(row, 2).setFontSize(18).setFontWeight("bold").setFontColor("#1a73e8");

  sheet.getRange(row, 4).setValue("Overdue");
  sheet.getRange(row, 5).setFormula(
    `=COUNTIFS('${master}'!F:F,"<"&TODAY(),'${master}'!F:F,"<>",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
  );
  sheet.getRange(row, 5).setFontSize(18).setFontWeight("bold").setFontColor("#ea4335");

  // ─── STATUS BREAKDOWN ───────────────────────────────────────────────
  row = 7;
  sheet.getRange(row, 1).setValue("Status").setFontWeight("bold");
  sheet.getRange(row, 2).setValue("Count").setFontWeight("bold");
  sheet.getRange(row, 3).setValue("% of Active").setFontWeight("bold");
  sheet.getRange(row, 1, 1, 3).setBackground("#f3f3f3");

  const statuses = ["NEW", "TO DO", "IN PROGRESS", "TO DISCUSS", "BLOCKED", "DEFERRED", "RECURRING", "DONE", "CANCELLED"];
  const statusEmoji = { "NEW": "🔵", "TO DO": "🟠", "IN PROGRESS": "🟡", "TO DISCUSS": "🟤", "BLOCKED": "🔴", "DEFERRED": "🟠", "RECURRING": "🟣", "DONE": "🟢", "CANCELLED": "⚫" };

  statuses.forEach((status, i) => {
    const r = 8 + i;
    sheet.getRange(r, 1).setValue(`${statusEmoji[status] || ""} ${status}`);
    sheet.getRange(r, 2).setFormula(`=COUNTIF('${master}'!B:B,"${status}")`);
    sheet.getRange(r, 3).setFormula(`=IFERROR(B${r}/SUM(B8:B16),0)`).setNumberFormat("0.0%");
  });

  // ─── PRIORITY BREAKDOWN ─────────────────────────────────────────────
  row = 7;
  sheet.getRange(row, 5).setValue("Priority").setFontWeight("bold");
  sheet.getRange(row, 6).setValue("Count").setFontWeight("bold");
  sheet.getRange(row, 5, 1, 2).setBackground("#f3f3f3");

  const priorities = ["URGENT", "ONE DAY", "HIGH", "MEDIUM", "LOW"];
  const priorityEmoji = { "URGENT": "🔴", "ONE DAY": "🟤", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🔵" };

  priorities.forEach((p, i) => {
    const r = 8 + i;
    sheet.getRange(r, 5).setValue(`${priorityEmoji[p] || ""} ${p}`);
    // Count only active tasks (exclude DONE/CANCELLED) — Priority=A, Status=B
    sheet.getRange(r, 6).setFormula(
      `=COUNTIFS('${master}'!A:A,"${p}",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
    );
  });

  // ─── SOURCE BREAKDOWN ───────────────────────────────────────────────
  row = 13;
  sheet.getRange(row, 5).setValue("Source").setFontWeight("bold");
  sheet.getRange(row, 6).setValue("Count").setFontWeight("bold");
  sheet.getRange(row, 5, 1, 2).setBackground("#f3f3f3");

  const sources = ["Shift Report", "Meeting", "Ad-hoc"];
  sources.forEach((s, i) => {
    const r = 14 + i;
    sheet.getRange(r, 5).setValue(s);
    sheet.getRange(r, 6).setFormula(
      `=COUNTIFS('${master}'!K:K,"${s}",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
    );
  });

  // ─── SECTION 3: THROUGHPUT ──────────────────────────────────────────
  row = 17;
  _taskSectionHeader_(sheet, row, "THROUGHPUT");

  row = 18;
  sheet.getRange(row, 1).setValue("").setFontWeight("bold");
  sheet.getRange(row, 2).setValue("Created").setFontWeight("bold");
  sheet.getRange(row, 3).setValue("Completed").setFontWeight("bold");
  sheet.getRange(row, 4).setValue("Net Open").setFontWeight("bold");
  sheet.getRange(row, 1, 1, 4).setBackground("#f3f3f3");

  // This Week (last 7 days)
  row = 19;
  sheet.getRange(row, 1).setValue("Last 7 Days");
  sheet.getRange(row, 2).setFormula(
    `=COUNTIFS('${master}'!G:G,">="&TODAY()-7,'${master}'!G:G,"<>")`
    + `+COUNTIFS('${archive}'!G:G,">="&TODAY()-7,'${archive}'!G:G,"<>")`
  );
  sheet.getRange(row, 3).setFormula(
    `=COUNTIFS('${master}'!H:H,">="&TODAY()-7,'${master}'!H:H,"<>")`
    + `+COUNTIFS('${archive}'!H:H,">="&TODAY()-7,'${archive}'!H:H,"<>")`
  );
  sheet.getRange(row, 4).setFormula(`=B${row}-C${row}`);

  // This Month (last 30 days)
  row = 20;
  sheet.getRange(row, 1).setValue("Last 30 Days");
  sheet.getRange(row, 2).setFormula(
    `=COUNTIFS('${master}'!G:G,">="&TODAY()-30,'${master}'!G:G,"<>")`
    + `+COUNTIFS('${archive}'!G:G,">="&TODAY()-30,'${archive}'!G:G,"<>")`
  );
  sheet.getRange(row, 3).setFormula(
    `=COUNTIFS('${master}'!H:H,">="&TODAY()-30,'${master}'!H:H,"<>")`
    + `+COUNTIFS('${archive}'!H:H,">="&TODAY()-30,'${archive}'!H:H,"<>")`
  );
  sheet.getRange(row, 4).setFormula(`=B${row}-C${row}`);

  // All Time
  row = 21;
  sheet.getRange(row, 1).setValue("All Time");
  sheet.getRange(row, 2).setFormula(
    `=COUNTIFS('${master}'!G:G,"<>")+COUNTIFS('${archive}'!G:G,"<>")`
  );
  sheet.getRange(row, 3).setFormula(
    `=COUNTIFS('${master}'!B:B,"DONE")+COUNTIFS('${master}'!B:B,"CANCELLED")`
    + `+COUNTA('${archive}'!A2:A)`
  );
  sheet.getRange(row, 4).setFormula(`=B${row}-C${row}`);

  // Completion Rate
  row = 22;
  sheet.getRange(row, 1).setValue("Completion Rate");
  sheet.getRange(row, 1).setFontWeight("bold");
  sheet.getRange(row, 2).setFormula(`=IFERROR(C21/B21,0)`).setNumberFormat("0.0%");
  sheet.getRange(row, 2).setFontSize(14).setFontWeight("bold");

  // Avg Days to Close
  sheet.getRange(row, 4).setValue("Avg Days to Close");
  sheet.getRange(row, 4).setFontWeight("bold");
  sheet.getRange(row, 5).setFormula(
    `=IFERROR(AVERAGEIFS('${master}'!I:I,'${master}'!B:B,"DONE"),0)`
  ).setNumberFormat("0.0");
  sheet.getRange(row, 5).setFontSize(14).setFontWeight("bold");

  // ─── SECTION 4: AREA BREAKDOWN ──────────────────────────────────────
  row = 24;
  _taskSectionHeader_(sheet, row, "AREA BREAKDOWN (ACTIVE)");

  row = 25;
  sheet.getRange(row, 1).setValue("Area").setFontWeight("bold");
  sheet.getRange(row, 2).setValue("Active").setFontWeight("bold");
  sheet.getRange(row, 3).setValue("Overdue").setFontWeight("bold");
  sheet.getRange(row, 1, 1, 3).setBackground("#f3f3f3");

  const areas = ["FOH", "BOH", "Bar", "Kitchen", "Admin", "Maintenance", "Marketing", "Events", "Training", "General"];
  areas.forEach((area, i) => {
    const r = 26 + i;
    sheet.getRange(r, 1).setValue(area);
    sheet.getRange(r, 2).setFormula(
      `=COUNTIFS('${master}'!D:D,"${area}",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
    );
    sheet.getRange(r, 3).setFormula(
      `=COUNTIFS('${master}'!D:D,"${area}",'${master}'!F:F,"<"&TODAY(),'${master}'!F:F,"<>",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
    );
  });

  // ─── SECTION 5: STAFF WORKLOAD (right side) ─────────────────────────
  // Uses QUERY for dynamic staff list — placed in columns H-L
  const staffCol = 8; // Column H

  row = 4;
  sheet.getRange(row, staffCol).setValue("STAFF WORKLOAD");
  sheet.getRange(row, staffCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, staffCol, 1, 5).merge();

  row = 5;
  const staffHeaders = ["Staff", "Active", "Overdue", "Completed (30d)", "Avg Days Open"];
  staffHeaders.forEach((h, i) => sheet.getRange(row, staffCol + i).setValue(h));
  sheet.getRange(row, staffCol, 1, staffHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");

  row = 6;
  // QUERY: count active tasks per staff member
  sheet.getRange(row, staffCol).setFormula(
    `=IFERROR(QUERY('${master}'!A2:N,` +
    `"SELECT C, COUNT(C) ` +
    `WHERE B<>'DONE' AND B<>'CANCELLED' AND C IS NOT NULL ` +
    `GROUP BY C ` +
    `ORDER BY COUNT(C) DESC ` +
    `LABEL C 'Staff', COUNT(C) 'Active'"),"")`
  );

  // Note: Overdue, Completed (30d), and Avg Days Open can't easily be done as
  // auto-expanding QUERYs that align with the staff QUERY above.
  // Instead, we'll use a helper column approach with VLOOKUP-style formulas.
  // These will be populated by the refresh function below.

  // ─── SECTION 6: WEEKLY CREATION/COMPLETION TREND ────────────────────
  row = 17;
  sheet.getRange(row, staffCol).setValue("WEEKLY TREND (Last 8 Weeks)");
  sheet.getRange(row, staffCol).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, staffCol, 1, 4).merge();

  row = 18;
  sheet.getRange(row, staffCol).setValue("Week Starting").setFontWeight("bold");
  sheet.getRange(row, staffCol + 1).setValue("Created").setFontWeight("bold");
  sheet.getRange(row, staffCol + 2).setValue("Completed").setFontWeight("bold");
  sheet.getRange(row, staffCol + 3).setValue("Net").setFontWeight("bold");
  sheet.getRange(row, staffCol, 1, 4).setBackground("#f3f3f3");

  // Last 8 weeks of Monday dates
  for (let w = 0; w < 8; w++) {
    const r = 19 + w;
    const daysBack = (w * 7);
    // Calculate Monday of that week
    sheet.getRange(r, staffCol).setFormula(
      `=TODAY()-WEEKDAY(TODAY(),3)-${daysBack}`
    ).setNumberFormat("dd/MM");

    const weekStart = `H${r}`;
    sheet.getRange(r, staffCol + 1).setFormula(
      `=COUNTIFS('${master}'!G:G,">="&${weekStart},'${master}'!G:G,"<"&${weekStart}+7)`
      + `+COUNTIFS('${archive}'!G:G,">="&${weekStart},'${archive}'!G:G,"<"&${weekStart}+7)`
    );
    sheet.getRange(r, staffCol + 2).setFormula(
      `=COUNTIFS('${master}'!H:H,">="&${weekStart},'${master}'!H:H,"<"&${weekStart}+7)`
      + `+COUNTIFS('${archive}'!H:H,">="&${weekStart},'${archive}'!H:H,"<"&${weekStart}+7)`
    );
    sheet.getRange(r, staffCol + 3).setFormula(`=I${r}-J${r}`);
  }

  // ─── FORMATTING ─────────────────────────────────────────────────────
  // Column widths
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 80);
  sheet.setColumnWidth(7, 30); // spacer
  for (let c = staffCol; c <= staffCol + 4; c++) {
    sheet.setColumnWidth(c, 120);
  }

  // Conditional formatting: overdue count > 0 in red
  const overdueCell = sheet.getRange("E5");
  const overdueAreaCells = sheet.getRange("C26:C35");
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground("#fce8e6")
    .setFontColor("#ea4335")
    .setRanges([overdueCell, overdueAreaCells])
    .build());

  // Net open positive = red (growing backlog), negative = green (shrinking)
  const netCells = sheet.getRange("D19:D21");
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setFontColor("#ea4335")
    .setRanges([netCells])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)
    .setFontColor("#34a853")
    .setRanges([netCells])
    .build());

  sheet.setConditionalFormatRules(rules);

  // Freeze header
  sheet.setFrozenRows(2);

  Logger.log("Task analytics dashboard built successfully.");
  SpreadsheetApp.getUi().alert("Task Dashboard has been built on the TASK DASHBOARD tab.");
}


/**
 * Refreshes the staff workload detail columns (Overdue, Completed 30d, Avg Days Open).
 * Call after buildTaskDashboard() or on its own to update dynamic staff stats.
 * The QUERY in column H auto-populates staff names and active counts;
 * this function fills in columns J, K, L for each staff member found.
 */
function refreshStaffWorkload() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const dashboard = ss.getSheetByName("TASK DASHBOARD");
  const master = ss.getSheetByName(TASK_CONFIG.sheets.master);

  if (!dashboard || !master) {
    Logger.log("Dashboard or master sheet not found.");
    return;
  }

  const lastRow = master.getLastRow();
  if (lastRow < 2) return;

  const data = master.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Build staff stats
  const staffStats = {};
  data.forEach(row => {
    const staff = (row[COLS.STAFF] || "").toString().trim();
    if (!staff) return;

    if (!staffStats[staff]) {
      staffStats[staff] = { overdue: 0, completed30d: 0, daysOpenTotal: 0, daysOpenCount: 0 };
    }

    const status = (row[COLS.STATUS] || "").toString().trim();
    const dueDate = row[COLS.DUE_DATE];
    const dateCompleted = row[COLS.DATE_COMPLETED];
    const daysOpen = row[COLS.DAYS_OPEN];

    // Overdue: has due date in the past, not done/cancelled
    if (dueDate instanceof Date && dueDate < today && status !== "DONE" && status !== "CANCELLED") {
      staffStats[staff].overdue++;
    }

    // Completed in last 30 days
    if (dateCompleted instanceof Date && dateCompleted >= thirtyDaysAgo &&
        (status === "DONE" || status === "CANCELLED")) {
      staffStats[staff].completed30d++;
    }

    // Days open (for active tasks only)
    if (typeof daysOpen === "number" && status !== "DONE" && status !== "CANCELLED") {
      staffStats[staff].daysOpenTotal += daysOpen;
      staffStats[staff].daysOpenCount++;
    }
  });

  // Read staff names from column H (populated by QUERY)
  const staffCol = 8;  // Column H
  const dashboardLastRow = dashboard.getLastRow();
  if (dashboardLastRow < 6) return;

  const staffRange = dashboard.getRange(6, staffCol, Math.min(dashboardLastRow - 5, 30), 1).getValues();

  // Accumulate row values and row numbers, then batch-write contiguous segments
  const results = [];      // { r, values: [overdue, completed30d, avgDaysOpen] }
  const rowOffsets = [];   // absolute sheet row numbers for each result

  staffRange.forEach((nameRow, i) => {
    const name = (nameRow[0] || "").toString().trim();
    if (!name || name === "Staff") return;

    const r = 6 + i;
    const stats = staffStats[name] || { overdue: 0, completed30d: 0, daysOpenTotal: 0, daysOpenCount: 0 };
    const avgDaysOpen = stats.daysOpenCount > 0
      ? Math.round(stats.daysOpenTotal / stats.daysOpenCount * 10) / 10
      : 0;

    results.push([stats.overdue, stats.completed30d, avgDaysOpen]);  // Col J, K, L
    rowOffsets.push(r);
  });

  // Write contiguous segments in a single setValues() call each
  if (rowOffsets.length > 0) {
    let segStart = 0;
    for (let j = 1; j <= rowOffsets.length; j++) {
      const isLast = (j === rowOffsets.length);
      const isContiguous = !isLast && (rowOffsets[j] === rowOffsets[j - 1] + 1);
      if (!isContiguous) {
        const segRows = j - segStart;
        const startRow = rowOffsets[segStart];
        const segment = results.slice(segStart, j);
        dashboard.getRange(startRow, staffCol + 2, segRows, 3).setValues(segment);
        segStart = j;
      }
    }
  }

  Logger.log("Staff workload details refreshed.");
}


/**
 * Helper: writes a section header row.
 */
function _taskSectionHeader_(sheet, row, title) {
  sheet.getRange(row, 1).setValue(title);
  sheet.getRange(row, 1).setFontSize(11).setFontWeight("bold").setFontColor("#1a73e8");
  sheet.getRange(row, 1, 1, 6).merge();
}
