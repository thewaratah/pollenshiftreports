/****************************************************
 * SLACK ACTIONABLES POSTER — SAKURA HOUSE
 *
 * Posts active actionable items to Slack, grouped
 * by staff with priority sorting.
 *
 * Replaces the standalone MEETING ROLLING ACTIONABLES.gs.
 * Uses TASK_CONFIG, COLS, and STATUSES from
 * EnhancedTaskManagement_Sakura.gs (same GAS project).
 *
 * Menu wiring: Not currently wired to any menu — call directly
 *   from the script editor if needed.
 ****************************************************/


// Slack webhooks (retrieved from Script Properties)
// Note: These are initialized at runtime, not at load time
function getPosterWebhookLive_() {
  return getManagersChannelWebhook_();
}

function getPosterWebhookTest_() {
  const dmWebhooks = getSlackDmWebhooks_();
  return dmWebhooks["Evan"];
}

// Priority sort order (highest first)
const POSTER_PRIORITY_ORDER = { "URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3 };

// Status sort order within same priority
const POSTER_STATUS_ORDER = {
  [STATUSES.BLOCKED]: 1,
  [STATUSES.IN_PROGRESS]: 2,
  [STATUSES.TO_DISCUSS]: 3,
  [STATUSES.NEW]: 4,
  [STATUSES.TODO]: 5,
  [STATUSES.DEFERRED]: 6,
  [STATUSES.RECURRING]: 7
};


/**
 * LIVE: Post active actionables to Slack (management channel).
 */
function postMeetingActionablesToSlack_LIVE() {
  postActionablesToSlack_(getPosterWebhookLive_(), false);
}

/**
 * TEST: Post active actionables to Slack (Evan DM only).
 */
function postMeetingActionablesToSlack_TEST() {
  postActionablesToSlack_(getPosterWebhookTest_(), true);
}

/**
 * Core poster: reads active tasks, groups by staff, posts to Slack.
 */
function postActionablesToSlack_(webhookUrl, isTest) {
  if (!webhookUrl) {
    Logger.log("Slack webhook URL is not configured.");
    SpreadsheetApp.getUi().alert("Slack webhook URL is not configured.");
    return;
  }

  const actions = readActiveActionables_();
  if (actions.length === 0) {
    const msg = "No active items found in " + TASK_CONFIG.sheets.master + ".";
    Logger.log(msg);
    SpreadsheetApp.getUi().alert(msg);
    return;
  }

  // Group by staff
  const staffMap = {};
  actions.forEach(a => {
    const key = a.staff || "Unassigned";
    if (!staffMap[key]) staffMap[key] = [];
    staffMap[key].push(a);
  });

  const staffNames = Object.keys(staffMap).sort((a, b) => a.localeCompare(b));
  const titlePrefix = isTest ? "TEST — " : "";

  // Build Block Kit message
  const blocks = [
    bk_header(`${titlePrefix}Sakura Actionables — Active Items`)
  ];

  staffNames.forEach(name => {
    const items = staffMap[name].slice().sort((a, b) => {
      const aPri = POSTER_PRIORITY_ORDER[a.priority] || 99;
      const bPri = POSTER_PRIORITY_ORDER[b.priority] || 99;
      if (aPri !== bPri) return aPri - bPri;

      const aStat = POSTER_STATUS_ORDER[a.status] || 99;
      const bStat = POSTER_STATUS_ORDER[b.status] || 99;
      if (aStat !== bStat) return aStat - bStat;

      const ad = a.created instanceof Date ? a.created.getTime() : 0;
      const bd = b.created instanceof Date ? b.created.getTime() : 0;
      return ad - bd;
    });

    blocks.push(bk_divider());
    let staffSection = `*${name}* (${items.length}):\n`;

    items.forEach(a => {
      const tz = TASK_CONFIG.timezone;
      const createdStr = a.created instanceof Date
        ? Utilities.formatDate(a.created, tz, "dd/MM/yyyy")
        : "";
      const dueDateStr = a.dueDate instanceof Date
        ? Utilities.formatDate(a.dueDate, tz, "dd/MM/yyyy")
        : "";

      const emoji = ETM_STATUS_EMOJI[a.status] || "";

      let line = `${emoji} ${a.description}`;
      if (a.area && a.area !== "General") line += ` [${a.area}]`;
      if (a.priority && a.priority !== "MEDIUM") line += ` (${a.priority})`;
      if (createdStr) line += ` — created ${createdStr}`;
      if (dueDateStr) line += ` — due ${dueDateStr}`;
      if (a.blockerNotes) line += ` — ${a.blockerNotes}`;

      staffSection += line + "\n";
    });

    blocks.push(bk_section(staffSection));
  });

  // Summary footer
  const totalCount = actions.length;
  const statusCounts = {};
  ETM_ACTIVE_STATUSES.forEach(s => {
    statusCounts[s] = actions.filter(a => a.status === s).length;
  });

  blocks.push(bk_divider());
  blocks.push(bk_context([
    `Total: ${totalCount} active items — ` +
    `${ETM_STATUS_EMOJI[STATUSES.NEW]} ${statusCounts[STATUSES.NEW] || 0} NEW` +
    ` · ${ETM_STATUS_EMOJI[STATUSES.IN_PROGRESS]} ${statusCounts[STATUSES.IN_PROGRESS] || 0} IN PROGRESS` +
    ` · ${ETM_STATUS_EMOJI[STATUSES.TO_DISCUSS]} ${statusCounts[STATUSES.TO_DISCUSS] || 0} TO DISCUSS` +
    ` · ${ETM_STATUS_EMOJI[STATUSES.BLOCKED]} ${statusCounts[STATUSES.BLOCKED] || 0} BLOCKED` +
    ` · ${ETM_STATUS_EMOJI[STATUSES.TODO]} ${statusCounts[STATUSES.TODO] || 0} TO DO` +
    ` · ${ETM_STATUS_EMOJI[STATUSES.DEFERRED]} ${statusCounts[STATUSES.DEFERRED] || 0} DEFERRED`
  ]));
  blocks.push(bk_buttons([{ text: "Open Task Sheet", url: `https://docs.google.com/spreadsheets/d/${getTaskSpreadsheetId_()}` }]));

  const sent = bk_post(webhookUrl, blocks, `${titlePrefix}Sakura Actionables: ${totalCount} active items`);

  if (sent) {
    Logger.log("Actionables posted to Slack successfully.");
    SpreadsheetApp.getUi().alert(
      isTest
        ? "TEST: Actionables posted to your Slack DM."
        : "LIVE: Actionables posted to the management Slack channel."
    );
  } else {
    SpreadsheetApp.getUi().alert("Failed to post to Slack. Check logs.");
  }
}


/**
 * Read all active items from the Sakura Actionables sheet.
 * Uses COLS and ETM_ACTIVE_STATUSES from EnhancedTaskManagement_Sakura.gs.
 */
function readActiveActionables_() {
  const ss = SpreadsheetApp.openById(getTaskSpreadsheetId_());
  const sheet = ss.getSheetByName(TASK_CONFIG.sheets.master);

  if (!sheet) {
    Logger.log(`Sheet "${TASK_CONFIG.sheets.master}" not found.`);
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const actions = [];

  values.forEach((row, index) => {
    const status      = (row[COLS.STATUS] || "").toString().trim().toUpperCase();
    const priority    = (row[COLS.PRIORITY] || "").toString().trim().toUpperCase();
    const staff       = (row[COLS.STAFF] || "").toString().trim();
    const area        = (row[COLS.AREA] || "").toString().trim();
    const description = (row[COLS.DESCRIPTION] || "").toString().trim();
    const dueDate     = row[COLS.DUE_DATE];
    const created     = row[COLS.DATE_CREATED];
    const blockerNotes = (row[COLS.BLOCKER_NOTES] || "").toString().trim();

    if (!description) return;
    if (!ETM_ACTIVE_STATUSES.includes(status)) return;

    actions.push({
      staff: staff || "Unassigned",
      area,
      description,
      created,
      status,
      priority: priority || "MEDIUM",
      dueDate,
      blockerNotes
    });
  });

  Logger.log(`Found ${actions.length} active actionable items.`);
  return actions;
}
