# TEST_SlackBlockKitLibrary.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/TEST_SlackBlockKitLibrary.js`
**Type:** Test script for the inline Slack Block Kit functions
**Run from:** Apps Script editor (not available via menu)

---

## What This File Does

This is a test script (~104 lines) that exercises all the `bk_*` functions from `SlackBlockKitWaratahSR.js` by building a complete test message and posting it to the test Slack webhook. It verifies that every Block Kit builder function produces valid output and that the assembled message renders correctly in Slack.

---

## Key Functions

### `testSlackBlockKitLibrary()`
**Comprehensive test** — builds a full Slack message using every `bk_*` function:

| Block Used | Content |
|-----------|---------|
| `bk_header()` | "Test Message — Block Kit Library" |
| `bk_context()` | Test metadata line |
| `bk_divider()` | Separator |
| `bk_section()` | Sample narrative text |
| `bk_fields()` | Two-column financial data layout |
| `bk_list()` | Sample TO-DO items |
| `bk_buttons()` | Sample action buttons |

Posts to the **test Slack webhook** (not the live channel) and logs the result.

### `quickLibraryTest()`
**Minimal test** — sends a simple header + section + divider message to quickly verify the webhook is working. Useful when you just need to confirm Slack connectivity without testing every function.

---

## When Would You Need This File?

- **After modifying any `bk_*` function** — Run the comprehensive test to verify the output
- **Debugging Slack message formatting** — See what each function produces in Slack
- **Verifying the test webhook is alive** — Run `quickLibraryTest()` for a fast connectivity check
- **Onboarding** — Understand what each Block Kit function does by seeing its output

---

## Important Notes

- **Posts to the TEST webhook only** — safe to run without spamming the live Slack channel
- **Non-destructive** — sends a message to Slack, doesn't modify any spreadsheet data
- **The test webhook URL comes from Script Properties** (`SLACK_WEBHOOK_TEST`) — make sure it's configured
- **If the test fails**, check `DiagnoseSlack.js` for webhook troubleshooting

---

## Related Files

- [SlackBlockKitWaratahSR.js](../SHIFT REPORT SCRIPTS/SlackBlockKitWaratahSR.js) — The `bk_*` functions being tested
- [DiagnoseSlack.js](../SHIFT REPORT SCRIPTS/DiagnoseSlack.js) — Webhook troubleshooting if tests fail
- [_SETUP_ScriptProperties.js](../SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties.js) — Where `SLACK_WEBHOOK_TEST` is configured
