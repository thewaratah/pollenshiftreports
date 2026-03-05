/****************************************************
 * SLACK WEBHOOK DIAGNOSTICS
 *
 * Run diagnoseSlackWebhook() to test your Slack setup
 * and identify any configuration issues.
 ****************************************************/

/**
 * Comprehensive diagnostic test for Slack webhooks
 * Checks all configurations and attempts to send test messages
 */
function diagnoseSlackWebhook() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  Logger.log('=== SLACK WEBHOOK DIAGNOSTICS ===');

  // Step 1: Check VENUE_NAME
  const venueName = props.getProperty('VENUE_NAME');
  Logger.log(`\n1. VENUE_NAME: ${venueName || '❌ NOT SET'}`);

  if (!venueName) {
    ui.alert('❌ Error', 'VENUE_NAME not set in Script Properties.\n\nRun setupScriptProperties_WaratahShiftReports() first.', ui.ButtonSet.OK);
    return;
  }

  // Step 2: Check TEST webhook
  const testWebhookPropName = `${venueName}_SLACK_WEBHOOK_TEST`;
  const testWebhook = props.getProperty(testWebhookPropName);

  Logger.log(`\n2. ${testWebhookPropName}:`);
  if (testWebhook) {
    Logger.log(`   ✅ Set: ${testWebhook.substring(0, 40)}...`);
  } else {
    Logger.log(`   ❌ NOT SET`);
    ui.alert('❌ Error', `${testWebhookPropName} not set in Script Properties.\n\nRun setupScriptProperties_WaratahShiftReports() first.`, ui.ButtonSet.OK);
    return;
  }

  // Step 3: Check LIVE webhook
  const liveWebhookPropName = `${venueName}_SLACK_WEBHOOK_LIVE`;
  const liveWebhook = props.getProperty(liveWebhookPropName);

  Logger.log(`\n3. ${liveWebhookPropName}:`);
  if (liveWebhook) {
    Logger.log(`   ✅ Set: ${liveWebhook.substring(0, 40)}...`);
  } else {
    Logger.log(`   ❌ NOT SET`);
  }

  // Step 4: Check inline Slack functions
  Logger.log('\n4. Slack Block Kit functions:');
  if (typeof bk_post === 'undefined') {
    Logger.log('   ❌ bk_post not found — SlackBlockKitWaratahSR.js may be missing!');
    ui.alert('❌ Error', 'Slack Block Kit functions not available.\n\nCheck that SlackBlockKitWaratahSR.js is in the project.', ui.ButtonSet.OK);
    return;
  } else {
    Logger.log('   ✅ Inline functions loaded (bk_header, bk_section, bk_fields, bk_divider, bk_context, bk_buttons, bk_post)');
  }

  // Step 5: Test webhook with simple message
  Logger.log('\n5. Testing TEST webhook with simple message...');

  try {
    const testBlocks = [
      bk_header('🔧 Diagnostic Test'),
      bk_section(`Test message sent at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`),
      bk_divider(),
      bk_fields([
        ['Venue', venueName],
        ['Status', '✅ Webhook Working']
      ])
    ];

    const sent = bk_post(testWebhook, testBlocks, 'Diagnostic Test');

    if (sent) {
      Logger.log('   ✅ SUCCESS: Message sent to Slack!');
      ui.alert('✅ Success', 'Diagnostic test message sent successfully!\n\nCheck your Slack test channel.', ui.ButtonSet.OK);
    } else {
      Logger.log('   ❌ FAILED: bk_post() returned false');
      ui.alert('❌ Failed', 'bk_post() returned false.\n\nPossible issues:\n- Webhook URL is invalid/expired\n- Slack app is disabled\n- Network issue\n\nCheck Apps Script logs for details.', ui.ButtonSet.OK);
    }

  } catch (error) {
    Logger.log(`   ❌ ERROR: ${error.message}`);
    Logger.log(error.stack);
    ui.alert('❌ Error', `Exception thrown:\n\n${error.message}\n\nCheck Apps Script logs for full stack trace.`, ui.ButtonSet.OK);
  }

  Logger.log('\n=== DIAGNOSTICS COMPLETE ===');
  Logger.log('Check the logs above for any issues.');
}


/**
 * Test with raw fetch (bypasses SlackBlockKit library)
 * Useful for determining if the issue is with the library or the webhook
 */
function testWebhookRaw() {
  const props = PropertiesService.getScriptProperties();
  const venueName = props.getProperty('VENUE_NAME');
  const webhook = props.getProperty(`${venueName}_SLACK_WEBHOOK_TEST`);

  if (!webhook) {
    Logger.log('❌ Webhook not configured');
    return;
  }

  Logger.log('Testing webhook with raw UrlFetchApp...');

  try {
    const payload = {
      text: 'Raw webhook test - ' + new Date().toISOString()
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(webhook, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log(`Response Code: ${responseCode}`);
    Logger.log(`Response Text: ${responseText}`);

    if (responseCode === 200) {
      Logger.log('✅ Raw webhook test SUCCESS');
      SpreadsheetApp.getUi().alert('✅ Success', 'Raw webhook test succeeded!\n\nCheck your Slack channel.', SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      Logger.log('❌ Raw webhook test FAILED');
      SpreadsheetApp.getUi().alert('❌ Failed', `Webhook returned code ${responseCode}\n\n${responseText}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (error) {
    Logger.log(`❌ ERROR: ${error.message}`);
    SpreadsheetApp.getUi().alert('❌ Error', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


/**
 * Display all Script Properties (useful for debugging)
 */
function showScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();

  Logger.log('=== ALL SCRIPT PROPERTIES ===');

  Object.keys(allProps).sort().forEach(key => {
    let value = allProps[key];

    // Mask sensitive values
    if (key.includes('WEBHOOK') || key.includes('PASSWORD')) {
      value = value.substring(0, 30) + '...[MASKED]';
    } else if (key.includes('EMAIL') && value.length > 100) {
      value = '[JSON OBJECT]';
    }

    Logger.log(`${key} = ${value}`);
  });

  Logger.log('\n=== END PROPERTIES ===');
  SpreadsheetApp.getUi().alert('Properties Listed', 'Check Apps Script logs (View → Logs) for full list.', SpreadsheetApp.getUi().ButtonSet.OK);
}
