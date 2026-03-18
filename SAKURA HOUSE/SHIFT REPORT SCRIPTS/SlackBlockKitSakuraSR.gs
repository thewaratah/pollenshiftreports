/****************************************************
 * SLACK BLOCK KIT BUILDER UTILITIES — SAKURA SHIFT REPORTS
 *
 * Inline implementation (no library dependency).
 * Identical to SlackBlockKitSAKURA.gs used in Task Management.
 *
 * Usage:
 *   const blocks = [
 *     bk_header("Report Title"),
 *     bk_fields([["Day", "Monday"], ["MOD", "Evan"]]),
 *     bk_divider(),
 *     bk_section("*Summary:*\nGood night..."),
 *     bk_buttons([{ text: "Open Report", url: "https://..." }])
 *   ];
 *   bk_post(webhookUrl, blocks, "Fallback text");
 *
 * @version 1.0.0
 ****************************************************/


/**
 * Header block — large bold text at the top of a message.
 * @param {string} text — plain text (max 150 chars, emoji supported)
 */
function bk_header(text) {
  return {
    type: "header",
    text: { type: "plain_text", text: text, emoji: true }
  };
}


/**
 * Section block — markdown-formatted text.
 * @param {string} mrkdwn — Slack mrkdwn text (supports *bold*, _italic_, `code`, links)
 */
function bk_section(mrkdwn) {
  return {
    type: "section",
    text: { type: "mrkdwn", text: mrkdwn }
  };
}


/**
 * Section block with 2-column field grid.
 * @param {Array<Array<string>>} pairs — [["Label", "Value"], ...] (max 10 fields)
 */
function bk_fields(pairs) {
  return {
    type: "section",
    fields: pairs.map(function(pair) {
      return { type: "mrkdwn", text: "*" + pair[0] + ":*\n" + pair[1] };
    })
  };
}


/**
 * Divider block — horizontal rule.
 */
function bk_divider() {
  return { type: "divider" };
}


/**
 * Context block — small metadata text below content.
 * @param {Array<string>} texts — array of mrkdwn strings
 */
function bk_context(texts) {
  return {
    type: "context",
    elements: texts.map(function(t) {
      return { type: "mrkdwn", text: t };
    })
  };
}


/**
 * Actions block — row of buttons with URLs.
 * @param {Array<Object>} buttons — [{ text: "Label", url: "https://...", style?: "primary"|"danger" }]
 */
function bk_buttons(buttons) {
  return {
    type: "actions",
    elements: buttons.map(function(btn, i) {
      var el = {
        type: "button",
        text: { type: "plain_text", text: btn.text, emoji: true },
        url: btn.url,
        action_id: "btn_" + i
      };
      if (btn.style) el.style = btn.style;
      return el;
    })
  };
}


/**
 * Rich text list block — for numbered or bulleted lists.
 * @param {Array<string>} items — list of text items
 * @param {string} style — "bullet" or "ordered"
 */
function bk_list(items, style) {
  return {
    type: "rich_text",
    elements: [{
      type: "rich_text_list",
      style: style || "bullet",
      elements: items.map(function(item) {
        return {
          type: "rich_text_section",
          elements: [{ type: "text", text: item }]
        };
      })
    }]
  };
}


/**
 * Send an error notification to Evan via Slack (TEST webhook).
 * Safe to call from any context (trigger, menu, editor).
 * Use in catch blocks of trigger-eligible functions.
 *
 * @param {string} functionName — name of the function that failed
 * @param {Error} error — the caught error object
 */
function notifyError_(functionName, error) {
  Logger.log('❌ ' + functionName + ' failed: ' + error.message);
  try {
    var webhook = PropertiesService.getScriptProperties()
      .getProperty('SAKURA_SLACK_WEBHOOK_TEST');
    if (webhook) {
      UrlFetchApp.fetch(webhook, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          text: '❌ ' + functionName + ' FAILED: ' + error.message
        }),
        muteHttpExceptions: true
      });
    }
  } catch (e) {
    Logger.log('Error notification also failed: ' + e.message);
  }
}


/**
 * Appends a learning entry to the LEARNINGS tab in the data warehouse.
 * Non-blocking — failures are logged only.
 *
 * @param {string} context - Function or pipeline stage where the issue occurred
 * @param {string} issue   - Description of what went wrong
 * @param {string} fix     - What was done (or should be done) to resolve it
 */
function logPipelineLearning_(context, issue, fix) {
  try {
    const warehouseId = PropertiesService.getScriptProperties().getProperty('SAKURA_DATA_WAREHOUSE_ID');
    if (!warehouseId) return;
    const wss = SpreadsheetApp.openById(warehouseId);
    let sheet = wss.getSheetByName('LEARNINGS');
    if (!sheet) {
      sheet = wss.insertSheet('LEARNINGS');
      sheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Venue', 'Context', 'Issue', 'Fix Applied']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f3f3f3');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date(), 'SAKURA', context, issue, fix || '']);
  } catch (e) {
    Logger.log('logPipelineLearning_ error: ' + e.message);
  }
}


/**
 * Post Block Kit message to a Slack webhook.
 * @param {string} webhookUrl — Slack incoming webhook URL
 * @param {Array<Object>} blocks — array of Block Kit blocks
 * @param {string} fallbackText — plain text fallback for notifications/accessibility
 * @return {boolean} — true if sent successfully
 */
function bk_post(webhookUrl, blocks, fallbackText) {
  if (!webhookUrl) {
    Logger.log("Block Kit post skipped: no webhook URL.");
    return false;
  }

  var payload = {
    text: fallbackText || "Notification",
    blocks: blocks
  };

  try {
    var response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log("Slack returned HTTP " + code + ": " + response.getContentText());
      return false;
    }
    return true;
  } catch (e) {
    Logger.log("Block Kit post error: " + e.message);
    return false;
  }
}
