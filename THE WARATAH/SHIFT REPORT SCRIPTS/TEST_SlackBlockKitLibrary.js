/****************************************************
 * SLACK BLOCK KIT LIBRARY TEST
 *
 * Run testSlackBlockKitLibrary() to verify the shared
 * library is working correctly.
 *
 * Expected: Test message posted to Slack test channel
 ****************************************************/

/**
 * Test the SlackBlockKit library by sending a test message.
 * Verifies that all Block Kit functions are accessible through the library.
 */
function testSlackBlockKitLibrary() {
  Logger.log("=== Testing SlackBlockKit Library ===");

  // Get test webhook from Script Properties
  const webhook = PropertiesService.getScriptProperties()
    .getProperty('WARATAH_SLACK_WEBHOOK_TEST');

  if (!webhook) {
    Logger.log("❌ ERROR: WARATAH_SLACK_WEBHOOK_TEST not configured in Script Properties");
    throw new Error("Test webhook not configured. Run _SETUP_ScriptProperties.gs first.");
  }

  Logger.log("Using test webhook: " + webhook.substring(0, 40) + "...");

  // Build test message using all library functions
  const blocks = [
    bk_header("🎉 SlackBlockKit Library Test"),

    bk_section("*Testing all Block Kit builder functions:*\n" +
                             "This message confirms that the shared library is working correctly!"),

    bk_divider(),

    bk_fields([
      ["Status", "✅ Success"],
      ["Library Version", "v1"],
      ["Project", "Waratah Shift Reports"],
      ["Test Date", new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })],
      ["Test Time", new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })]
    ]),

    bk_divider(),

    bk_list([
      "bk_header() ✅",
      "bk_section() ✅",
      "bk_divider() ✅",
      "bk_fields() ✅",
      "bk_list() ✅",
      "bk_context() ✅",
      "bk_buttons() ✅",
      "bk_post() ✅"
    ], "bullet"),

    bk_context([
      "🔧 Deployed via SlackBlockKit Library (Script ID: 1J1PFjunHm6RErU8i5mE5tAnN3AEwbHBj6aCD3sO_Phs5G9qBx1RpzGFj)"
    ]),

    bk_divider(),

    bk_buttons([
      {
        text: "View Library Code",
        url: "https://script.google.com/home/projects/1J1PFjunHm6RErU8i5mE5tAnN3AEwbHBj6aCD3sO_Phs5G9qBx1RpzGFj/edit",
        style: "primary"
      }
    ])
  ];

  // Send the test message
  Logger.log("Sending test message...");
  const sent = bk_post(webhook, blocks, "SlackBlockKit Library Test - Waratah");

  if (sent) {
    Logger.log("✅ SUCCESS: Test message sent to Slack!");
    Logger.log("Check your #test channel for the message.");
    return true;
  } else {
    Logger.log("❌ FAILED: Could not send test message.");
    Logger.log("Check the webhook URL and try again.");
    return false;
  }
}


/**
 * Quick test - just sends a simple message
 */
function quickLibraryTest() {
  const webhook = PropertiesService.getScriptProperties()
    .getProperty('WARATAH_SLACK_WEBHOOK_TEST');

  const blocks = [
    bk_header("Quick Test"),
    bk_section("Library is working! ✅")
  ];

  const sent = bk_post(webhook, blocks, "Quick Test");
  Logger.log(sent ? "✅ Success" : "❌ Failed");
}
