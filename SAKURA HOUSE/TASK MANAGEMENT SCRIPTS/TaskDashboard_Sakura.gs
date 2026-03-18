/****************************************************
 * SAKURA HOUSE TASK ANALYTICS DASHBOARD
 *
 * Builds and refreshes the TASK DASHBOARD tab in the
 * Sakura Actionables spreadsheet using live formulas.
 *
 * Run buildTaskDashboard() once to set up,
 * then the formulas auto-update as data changes.
 *
 * Source sheets:
 *   SAKURA ACTIONABLES SHEET (cols A-N)
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

  // --- SECTION 1: HEADER ---
  let row = 1;
  sheet.getRange(row, 1).setValue("SAKURA HOUSE — TASK DASHBOARD");
  sheet.getRange(row, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(row, 1, 1, 6).merge();

  row = 2;
  sheet.getRange(row, 1).setValue(`Dashboard built: ${now}  •  Data refreshes automatically`);
  sheet.getRange(row, 1).setFontSize(9).setFontColor("#666666").setFontStyle("italic");
  sheet.getRange(row, 1, 1, 6).merge();

  // --- SECTION 2: CURRENT SNAPSHOT ---
  row = 4;
  _taskSectionHeader_(sheet, row, "CURRENT SNAPSHOT");

  row = 5;
  sheet.getRange(row, 1).setValue("Total Active Tasks");
  // Active = everything except DONE and CANCELLED
  sheet.getRange(row, 2).setFormula(
    `=COUNTIFS('${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED",'${master}'!B:B,"<>")`
  );
  sheet.getRange(row, 2).setFontSize(18).setFontWeight("bold").setFontColor("#1a73e8");

  sheet.getRange(row, 4).setValue("Overdue");
  sheet.getRange(row, 5).setFormula(
    `=COUNTIFS('${master}'!F:F,"<"&TODAY(),'${master}'!F:F,"<>",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
  );
  sheet.getRange(row, 5).setFontSize(18).setFontWeight("bold").setFontColor("#ea4335");

  // --- STATUS BREAKDOWN ---
  row = 7;
  sheet.getRange(row, 1).setValue("Status").setFontWeight("bold");
  sheet.getRange(row, 2).setValue("Count").setFontWeight("bold");
  sheet.getRange(row, 3).setValue("% of Active").setFontWeight("bold");
  sheet.getRange(row, 1, 1, 3).setBackground("#f3f3f3");

  const statuses = ["NEW", "TO DO", "IN PROGRESS", "TO DISCUSS", "BLOCKED", "DEFERRED", "RECURRING", "DONE", "CANCELLED"];
  const statusEmoji = { "NEW": "🔵", "TO DO": "🟠", "IN PROGRESS": "🟡", "TO DISCUSS": "💬", "BLOCKED": "🔴", "DEFERRED": "🟠", "RECURRING": "🟣", "DONE": "🟢", "CANCELLED": "⚫" };

  statuses.forEach((status, i) => {
    const r = 8 + i;
    sheet.getRange(r, 1).setValue(`${statusEmoji[status] || ""} ${status}`);
    sheet.getRange(r, 2).setFormula(`=COUNTIF('${master}'!B:B,"${status}")`);
    sheet.getRange(r, 3).setFormula(`=IFERROR(B${r}/SUM(B8:B16),0)`).setNumberFormat("0.0%");
  });

  // --- PRIORITY BREAKDOWN ---
  row = 7;
  sheet.getRange(row, 5).setValue("Priority").setFontWeight("bold");
  sheet.getRange(row, 6).setValue("Count").setFontWeight("bold");
  sheet.getRange(row, 5, 1, 2).setBackground("#f3f3f3");

  const priorities = ["URGENT", "HIGH", "MEDIUM", "LOW"];
  const priorityEmoji = { "URGENT": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🔵" };

  priorities.forEach((p, i) => {
    const r = 8 + i;
    sheet.getRange(r, 5).setValue(`${priorityEmoji[p] || ""} ${p}`);
    // Count only active tasks (exclude DONE/CANCELLED)
    sheet.getRange(r, 6).setFormula(
      `=COUNTIFS('${master}'!A:A,"${p}",'${master}'!B:B,"<>DONE",'${master}'!B:B,"<>CANCELLED")`
    );
  });

  // --- SOURCE BREAKDOWN ---
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

  // --- SECTION 3: THROUGHPUT ---
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
    `=COUNTIFS('${master}'!A:A,"DONE")+COUNTIFS('${master}'!A:A,"CANCELLED")`
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

  // --- SECTION 4: AREA BREAKDOWN ---
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

  // --- SECTION 5: STAFF WORKLOAD (right side) ---
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

  // --- SECTION 6: WEEKLY CREATION/COMPLETION TREND ---
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

  // --- FORMATTING ---
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

  // ── M8: SLA METRICS ─────────────────────────────────────────────────
  const actionablesSheet = ss.getSheetByName(TASK_CONFIG.sheets.master);
  if (actionablesSheet) {
    buildSLASection_(sheet, actionablesSheet);
  }

  Logger.log("Task analytics dashboard built successfully.");
  try {
    SpreadsheetApp.getUi().alert("Task Dashboard has been built on the TASK DASHBOARD tab.");
  } catch (e) {
    Logger.log('buildTaskDashboard: complete (UI skipped — trigger context)');
  }
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

  // Build results array, then write all rows in a single setValues() call
  const results = [];
  const rowOffsets = [];

  staffRange.forEach((nameRow, i) => {
    const name = (nameRow[0] || "").toString().trim();
    if (!name || name === "Staff") return;

    const stats = staffStats[name] || { overdue: 0, completed30d: 0, daysOpenTotal: 0, daysOpenCount: 0 };
    const avgDaysOpen = stats.daysOpenCount > 0
      ? Math.round(stats.daysOpenTotal / stats.daysOpenCount * 10) / 10
      : 0;

    results.push([stats.overdue, stats.completed30d, avgDaysOpen]);
    rowOffsets.push(6 + i);
  });

  // Write each row's 3 values in a single setValues() call per row.
  // Rows are not guaranteed to be contiguous (blank/header rows may be skipped),
  // so we batch by contiguous segments to minimise API calls.
  if (results.length > 0) {
    let segStart = 0;
    while (segStart < results.length) {
      let segEnd = segStart;
      // Extend segment while rows are consecutive
      while (segEnd + 1 < results.length && rowOffsets[segEnd + 1] === rowOffsets[segEnd] + 1) {
        segEnd++;
      }
      const segRows = segEnd - segStart + 1;
      dashboard.getRange(rowOffsets[segStart], staffCol + 2, segRows, 3)
        .setValues(results.slice(segStart, segEnd + 1)); // Col J-L: Overdue, Completed (30d), Avg Days Open
      segStart = segEnd + 1;
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


// ============================================================================
// M8 — TASK SLA TRACKING (Sakura)
// ============================================================================

/**
 * Builds the "SLA Metrics" section in the TASK DASHBOARD sheet.
 *
 * Reads the Actionables sheet directly (server-side calculation):
 *   - Average days to complete by priority (URGENT/HIGH/MEDIUM/LOW)
 *     Only DONE tasks with both DATE_CREATED (G) and DATE_COMPLETED (H).
 *   - Oldest open task age in days (max DATE_CREATED age, non-DONE/CANCELLED).
 *   - This week throughput: tasks created this Mon–today vs completed this Mon–today.
 *
 * Column schema (0-indexed, from COLS in EnhancedTaskManagement_Sakura.gs):
 *   A=Priority(0), B=Status(1), G=DateCreated(6), H=DateCompleted(7), I=DaysOpen(8)
 *
 * Writes to columns A-F starting at row 38 (below Area Breakdown at rows 24-35).
 *
 * @param {Sheet} dashboardSheet   - The "TASK DASHBOARD" sheet.
 * @param {Sheet} actionablesSheet - The master Actionables sheet.
 */
function buildSLASection_(dashboardSheet, actionablesSheet) {
  const today = new Date();
  // Monday of this week (ISO: Monday = day 1)
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
  weekStart.setHours(0, 0, 0, 0);

  const lastRow = actionablesSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("SLA section skipped — no data rows in Actionables sheet.");
    return;
  }

  // Read all data columns A-I (indices 0-8)
  const data = actionablesSheet.getRange(2, 1, lastRow - 1, 9).getValues();

  // Accumulators for avg days by priority
  const priorityTotals = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const priorityCounts = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let oldestOpenAgeDays = 0;
  let createdThisWeek = 0;
  let completedThisWeek = 0;

  data.forEach(row => {
    const priority = (row[0] || "").toString().trim().toUpperCase();
    const status   = (row[1] || "").toString().trim().toUpperCase();
    const dateCreated   = row[6];
    const dateCompleted = row[7];

    const isDone      = status === "DONE";
    const isCancelled = status === "CANCELLED";
    const isActive    = !isDone && !isCancelled;

    // Avg days to complete by priority (DONE tasks with both dates)
    if (isDone &&
        dateCreated instanceof Date && !isNaN(dateCreated) &&
        dateCompleted instanceof Date && !isNaN(dateCompleted) &&
        priorityTotals.hasOwnProperty(priority)) {
      const daysToComplete = (dateCompleted - dateCreated) / (1000 * 60 * 60 * 24);
      if (daysToComplete >= 0) {
        priorityTotals[priority] += daysToComplete;
        priorityCounts[priority]++;
      }
    }

    // Oldest open task
    if (isActive && dateCreated instanceof Date && !isNaN(dateCreated)) {
      const ageDays = Math.floor((today - dateCreated) / (1000 * 60 * 60 * 24));
      if (ageDays > oldestOpenAgeDays) oldestOpenAgeDays = ageDays;
    }

    // This week throughput
    if (dateCreated instanceof Date && !isNaN(dateCreated) && dateCreated >= weekStart) {
      createdThisWeek++;
    }
    if (dateCompleted instanceof Date && !isNaN(dateCompleted) && dateCompleted >= weekStart) {
      completedThisWeek++;
    }
  });

  // ── Write SLA section to dashboard ───────────────────────────────────
  // Placed at row 38 (below Area Breakdown rows 24-35, with gap at 36-37)
  let row = 38;
  _taskSectionHeader_(dashboardSheet, row, "SLA METRICS");

  row = 39;
  dashboardSheet.getRange(row, 1).setValue("Priority").setFontWeight("bold");
  dashboardSheet.getRange(row, 2).setValue("Avg Days to Complete").setFontWeight("bold");
  dashboardSheet.getRange(row, 4).setValue("Sample Size").setFontWeight("bold");
  dashboardSheet.getRange(row, 1, 1, 5).setBackground("#f3f3f3");

  const slaRows = [
    { label: "URGENT", key: "URGENT" },
    { label: "HIGH",   key: "HIGH"   },
    { label: "MEDIUM", key: "MEDIUM" },
    { label: "LOW",    key: "LOW"    }
  ];

  slaRows.forEach(({ label, key }, i) => {
    const r = 40 + i;
    const count = priorityCounts[key];
    const avg   = count > 0 ? Math.round((priorityTotals[key] / count) * 10) / 10 : null;
    dashboardSheet.getRange(r, 1).setValue(label);
    dashboardSheet.getRange(r, 2).setValue(avg !== null ? avg : "—");
    dashboardSheet.getRange(r, 4).setValue(count);
  });

  // Oldest open task
  row = 45;
  dashboardSheet.getRange(row, 1).setValue("Oldest Open Task (days)").setFontWeight("bold");
  dashboardSheet.getRange(row, 2).setValue(oldestOpenAgeDays).setFontSize(14).setFontWeight("bold");
  if (oldestOpenAgeDays > 30) {
    dashboardSheet.getRange(row, 2).setFontColor("#ea4335");
  } else if (oldestOpenAgeDays > 14) {
    dashboardSheet.getRange(row, 2).setFontColor("#f9ab00");
  } else {
    dashboardSheet.getRange(row, 2).setFontColor("#34a853");
  }

  // This week throughput
  row = 47;
  dashboardSheet.getRange(row, 1).setValue("This Week — Created").setFontWeight("bold");
  dashboardSheet.getRange(row, 2).setValue(createdThisWeek);
  dashboardSheet.getRange(row, 4).setValue("This Week — Completed").setFontWeight("bold");
  dashboardSheet.getRange(row, 5).setValue(completedThisWeek);

  Logger.log(`M8 SLA section built — URGENT: ${priorityCounts.URGENT > 0 ? (priorityTotals.URGENT / priorityCounts.URGENT).toFixed(1) : "—"}d avg, oldest open: ${oldestOpenAgeDays}d, week: ${createdThisWeek} created / ${completedThisWeek} completed.`);
}


/**
 * Posts a concise Task SLA weekly summary to the Sakura test Slack webhook.
 *
 * Reads the SLA metrics from the TASK DASHBOARD sheet (built by buildSLASection_).
 * Switch from SAKURA_SLACK_WEBHOOK_TEST to SAKURA_SLACK_WEBHOOK_LIVE when ready.
 *
 * Expected cell positions (written by buildSLASection_):
 *   B40 = URGENT avg days   B41 = HIGH avg days
 *   B42 = MEDIUM avg days   B43 = LOW avg days
 *   B45 = Oldest open (days)
 *   B47 = Created this week  E47 = Completed this week
 */
function sendWeeklySLASummary_Sakura() {
  try {
    const webhookUrl = PropertiesService.getScriptProperties().getProperty('SAKURA_SLACK_WEBHOOK_TEST');
    if (!webhookUrl) {
      Logger.log("sendWeeklySLASummary_Sakura: SAKURA_SLACK_WEBHOOK_TEST not configured — skipped.");
      return;
    }

    const taskId = getTaskSpreadsheetId_();
    if (!taskId) {
      Logger.log("sendWeeklySLASummary_Sakura: TASK_MANAGEMENT_SPREADSHEET_ID not configured — skipped.");
      return;
    }

    const ss = SpreadsheetApp.openById(taskId);
    const dashboard = ss.getSheetByName("TASK DASHBOARD");
    if (!dashboard) {
      Logger.log("sendWeeklySLASummary_Sakura: TASK DASHBOARD sheet not found — run buildTaskDashboard() first.");
      return;
    }

    // Read SLA values written by buildSLASection_
    const urgentAvg   = dashboard.getRange("B40").getValue();
    const highAvg     = dashboard.getRange("B41").getValue();
    const mediumAvg   = dashboard.getRange("B42").getValue();
    const lowAvg      = dashboard.getRange("B43").getValue();
    const oldestOpen  = dashboard.getRange("B45").getValue();
    const created     = dashboard.getRange("B47").getValue();
    const completed   = dashboard.getRange("E47").getValue();

    const fmt = v => (typeof v === "number" && v > 0) ? `${v}d` : "—";

    const text =
      `Task SLA — Sakura | ` +
      `Avg resolution: URGENT ${fmt(urgentAvg)} / HIGH ${fmt(highAvg)} / MEDIUM ${fmt(mediumAvg)} / LOW ${fmt(lowAvg)} | ` +
      `Oldest open: ${fmt(oldestOpen)} | ` +
      `This week: ${created} created, ${completed} completed`;

    const blocks = [
      bk_header("Task SLA — Sakura House"),
      bk_section(
        `*Avg Resolution Time*\n` +
        `URGENT: ${fmt(urgentAvg)}  |  HIGH: ${fmt(highAvg)}  |  MEDIUM: ${fmt(mediumAvg)}  |  LOW: ${fmt(lowAvg)}`
      ),
      bk_section(
        `*Oldest Open Task:* ${fmt(oldestOpen)}    *This Week:* ${created} created, ${completed} completed`
      )
    ];

    try {
      bk_post(webhookUrl, blocks, text);
      Logger.log("SLA summary posted to Sakura Slack (TEST).");
    } catch (e) {
      Logger.log(`sendWeeklySLASummary_Sakura: Slack post failed — ${e.message}`);
    }
  } catch (e) {
    Logger.log('sendWeeklySLASummary_Sakura: error (non-blocking) — ' + e.message);
  }
}
