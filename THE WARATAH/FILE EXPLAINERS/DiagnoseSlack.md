# DiagnoseSlack.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/DiagnoseSlack.js`
**Type:** Diagnostic/troubleshooting utility
**Run from:** Apps Script editor (manually)

---

## What This File Does

This is a troubleshooting toolkit for when Slack notifications aren't working. It runs a series of checks to pinpoint where the problem is — missing configuration, broken webhook, or a code issue.

---

## The Three Functions

### 1. `diagnoseSlackWebhook()`
**Purpose:** Full diagnostic test that checks everything in sequence.

Runs through 5 steps:

| Step | What It Checks |
|------|---------------|
| 1 | `VENUE_NAME` exists in Script Properties |
| 2 | Test webhook URL is configured (`WARATAH_SLACK_WEBHOOK_TEST`) |
| 3 | Live webhook URL is configured (`WARATAH_SLACK_WEBHOOK_LIVE`) |
| 4 | Slack Block Kit functions are loaded (`bk_post`, `bk_header`, etc. from `SlackBlockKitWaratahSR.js`) |
| 5 | Sends a test message to the test channel using Block Kit formatting |

Stops at the first failure and tells you exactly what's wrong via a popup alert. If everything passes, you'll see a diagnostic test message appear in the Slack test channel.

### 2. `testWebhookRaw()`
**Purpose:** Sends a plain text message directly via `UrlFetchApp`, bypassing the Block Kit library entirely.

Use this when `diagnoseSlackWebhook()` fails at step 5. If the raw test works but the Block Kit test doesn't, the problem is in the Block Kit code, not the webhook.

Returns the HTTP response code and body, so you can see exactly what Slack says.

### 3. `showScriptProperties()`
**Purpose:** Dumps all Script Properties to the Apps Script log (View > Logs).

Masks sensitive values (webhooks, passwords) in the output. Useful for verifying that all properties are set without having to navigate to Project Settings.

---

## When Would You Need This File?

- **Slack notifications stopped working** — Run `diagnoseSlackWebhook()` first
- **New webhook URL** — After updating a webhook in `_SETUP_ScriptProperties.js`, run the diagnostic to confirm it works
- **"bk_post not found" errors** — Means `SlackBlockKitWaratahSR.js` is missing or broken
- **Debugging property values** — Run `showScriptProperties()` to see what's currently stored

---

## Diagnostic Decision Tree

```
Slack not working?
  └─ Run diagnoseSlackWebhook()
       ├─ Step 1 fails → Run setupScriptProperties()
       ├─ Step 2/3 fails → Webhook URL missing → Check _SETUP_ScriptProperties.js
       ├─ Step 4 fails → SlackBlockKitWaratahSR.js missing from project
       └─ Step 5 fails → Run testWebhookRaw()
            ├─ Raw works → Problem is in Block Kit code
            └─ Raw fails → Webhook URL is expired/invalid → Get new URL from Slack
```
