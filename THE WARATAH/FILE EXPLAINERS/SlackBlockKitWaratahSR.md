# SlackBlockKitWaratahSR.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/SlackBlockKitWaratahSR.js`
**Type:** Inline Slack Block Kit builder utilities
**Called by:** `NightlyExport.js`, `WeeklyRolloverInPlace.js`, `WeeklyDigestWaratah.js`, and other files that post to Slack

---

## What This File Does

This file provides a set of helper functions for building Slack Block Kit messages directly in code, without relying on the external SlackBlockKit library. Each function returns a Block Kit JSON structure that can be assembled into a complete Slack message.

Think of it as a lightweight, inline alternative to the SlackBlockKit library — it gives you the same Block Kit building blocks but with zero external dependencies.

---

## Functions

| Function | What It Returns | Example Use |
|----------|----------------|-------------|
| `bk_header(text)` | Header block | Section titles like "The Waratah — Shift Report" |
| `bk_section(text)` | Section block with markdown | Narrative text, summaries |
| `bk_fields(fieldArray)` | Section with 2-column field layout | Financial data (Revenue / Tips side by side) |
| `bk_divider()` | Horizontal divider block | Visual separation between sections |
| `bk_context(textArray)` | Context block with small text | Metadata lines (date, MOD, staff list) |
| `bk_buttons(buttonArray)` | Actions block with buttons | "View PDF" and "Open Shift Report" links |
| `bk_list(items)` | Bulleted list as a section block | TO-DO items, incident lists |
| `bk_post(webhookUrl, blocks)` | Sends the assembled blocks to Slack | Final delivery step |

---

## How `bk_post()` Works

```
bk_post(webhookUrl, blocks)
```

1. Wraps the blocks array in a `{ blocks: [...] }` payload
2. Sends it via `UrlFetchApp.fetch()` to the webhook URL
3. Returns the HTTP response for error checking

---

## When Would You Need This File?

- **Adding a new section to Slack messages** — Create a new block using the `bk_*` functions
- **Changing the Slack message format** — Modify how blocks are assembled in the calling file (e.g., `postToSlackFromSheet()` in NightlyExport.js)
- **Debugging Slack formatting** — Check that the correct `bk_*` function is being used for each content type
- **Building a new Slack notification** — Use these functions to construct the Block Kit payload

---

## Important Notes

- **No external library dependency** — These functions are fully self-contained. They don't use the SlackBlockKit GAS library.
- **~160 lines** — Small, focused file. Each function is a simple JSON builder.
- **`bk_post()` is the only function that makes an HTTP call** — all others just return JSON objects.
- **Block Kit has limits** — Slack allows a maximum of 50 blocks per message and 3000 characters per text field. Keep this in mind when building large messages.

---

## Related Files

- [NightlyExport.js](../SHIFT REPORT SCRIPTS/NightlyExport.js) — `postToSlackFromSheet()` assembles blocks using these functions
- [WeeklyRolloverInPlace.js](../SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.js) — Posts rollover notifications to Slack
- [WeeklyDigestWaratah.js](../SHIFT REPORT SCRIPTS/WeeklyDigestWaratah.js) — Posts weekly revenue digest to Slack
- [DiagnoseSlack.js](../SHIFT REPORT SCRIPTS/DiagnoseSlack.js) — Troubleshoots Slack webhook delivery issues
