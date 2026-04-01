# Remove Overdue Slack Summaries & Redirect Weekly Active Tasks to DMs Only

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop `sendOverdueTasksSummary_` from posting to Slack entirely (both venues), and change `sendWeeklyActiveTasksSummary` to send only individual DMs — no channel posts.

**Architecture:** Remove the overdue summary function calls from daily maintenance and delete the standalone Sunday trigger wrapper (Waratah only). For weekly active tasks, change `_sendWeeklyActiveTasksSummaryCore` to skip the channel `bk_post` call and only run the DM sub-functions. Keep all menu items functional for manual testing. Keep error notifications on escalation/managers webhook (ops visibility).

**Tech Stack:** Google Apps Script, Slack Block Kit (`bk_post`), Script Properties webhooks

---

## Scope of Changes

### Files to modify (4 total):

| Venue | File | Changes |
|-------|------|---------|
| Sakura | `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs` | Remove overdue call from daily maintenance; weekly core skips channel post |
| Waratah | `THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs` | Remove overdue call from daily maintenance; weekly core skips channel post; gut `runScheduledOverdueSummary` |
| Sakura | `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/Menu_Updated_Sakura.gs` | Remove "Send Overdue Summary Now" menu item |
| Waratah | `THE WARATAH/TASK MANAGEMENT SCRIPTS/Menu.js` | Remove "Send Overdue Summary Now" menu item; remove "Create Overdue Summary Trigger" menu item |

### What we are NOT changing:
- `sendOverdueTasksDMs_` — these per-staff DMs are useful; but the function is only called by `sendOverdueTasksSummary_` which we're removing entirely, so it becomes dead code. Leave it for now (harmless, may be re-used later).
- `sendWeeklyActiveTasksSummary_Test()` — keep as-is (already DM-only to Evan).
- Error notification webhooks — keep posting failures to escalation/managers channels.
- Trigger creation/removal functions — keep `createWeeklySummaryTrigger()` (still needed for weekly DMs). Remove `createWeeklyOverdueSummaryTrigger()` (Waratah only — no longer needed).
- `_sendWeeklyFohLeadsSummary_` (Sakura only) — this posts to FOH leads channel, not managers. **Ask user:** should this also be removed, or is it acceptable? Plan assumes KEEP for now.

---

## Task 1: Sakura — Remove overdue summary from daily maintenance

**Files:**
- Modify: `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs:1394-1396`

**Step 1: Comment out the overdue summary call in `runDailyTaskMaintenance()`**

At lines 1394-1396, remove step 5:

```javascript
// BEFORE (lines 1394-1396):
    // 5. Send overdue summary
    Logger.log("Sending overdue tasks summary...");
    sendOverdueTasksSummary_();

// AFTER:
    // 5. Overdue summary removed — was clogging management Slack channel (Apr 2026)
```

**Step 2: Verify no other callers of `sendOverdueTasksSummary_` in Sakura besides the menu wrapper**

Run: `grep -n "sendOverdueTasksSummary" "SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/"*`
Expected: Only `EnhancedTaskManagement_Sakura.gs` (function definition + the line we just removed) and `Menu_Updated_Sakura.gs` (protected wrapper).

**Step 3: Commit**

```bash
git add "SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs"
git commit -m "fix(sakura): remove daily overdue task summary from Slack channel

Removes sendOverdueTasksSummary_() call from runDailyTaskMaintenance step 5.
Function definition and DM sub-function left as dead code for potential re-use.
Addresses management Slack channel noise."
```

---

## Task 2: Waratah — Remove overdue summary from daily maintenance + gut Sunday trigger

**Files:**
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs:1606-1608` (daily maintenance)
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs:2058-2088` (`runScheduledOverdueSummary`)
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs:2181-2201` (`createWeeklyOverdueSummaryTrigger`)

**Step 1: Comment out the overdue summary call in `runDailyTaskMaintenance()`**

At lines 1606-1608:

```javascript
// BEFORE (lines 1606-1608):
    // 5. Send overdue summary
    Logger.log("Sending overdue tasks summary...");
    sendOverdueTasksSummary_();

// AFTER:
    // 5. Overdue summary removed — was clogging management Slack channel (Apr 2026)
```

**Step 2: Gut `runScheduledOverdueSummary()` (lines 2058-2088)**

Replace the body with a no-op + log, keeping the function signature so existing triggers don't error:

```javascript
// BEFORE: full function body with lock + sendOverdueTasksSummary_() call

// AFTER:
function runScheduledOverdueSummary() {
  Logger.log('runScheduledOverdueSummary — disabled (Apr 2026). Remove this trigger via Admin Tools menu.');
}
```

**Step 3: Gut `createWeeklyOverdueSummaryTrigger()` (lines 2181-2201)**

Replace with a no-op:

```javascript
function createWeeklyOverdueSummaryTrigger() {
  Logger.log('createWeeklyOverdueSummaryTrigger — disabled (Apr 2026). Overdue summaries no longer sent to Slack.');
}
```

**Step 4: Remove `"runScheduledOverdueSummary"` from `removeAllTaskTriggers()` handler list (line 2218)**

This is optional cleanup — the trigger won't exist after removal, but leaving the string in the array is harmless. **Skip for now** to minimise diff.

**Step 5: Commit**

```bash
git add "THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs"
git commit -m "fix(waratah): remove daily+weekly overdue task summaries from Slack

Removes sendOverdueTasksSummary_() from runDailyTaskMaintenance step 5.
Guts runScheduledOverdueSummary (Sun 9am trigger) and createWeeklyOverdueSummaryTrigger.
Function definitions left as dead code for potential re-use."
```

---

## Task 3: Sakura — Weekly active tasks: skip channel post, DMs only

**Files:**
- Modify: `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs:1546-1547` (channel bk_post in `_sendWeeklyActiveTasksSummaryCore`)

**Step 1: Comment out the channel bk_post call**

At lines 1546-1548:

```javascript
// BEFORE:
  bk_post(webhookUrl, weeklyBlocks,
    `${titlePrefix}Sakura Weekly: ${totalCount} active tasks`);
  Logger.log(`Weekly active tasks summary posted to Slack (${isTest ? "TEST" : "LIVE"}).`);

// AFTER:
  // Channel post removed — weekly summary now DM-only (Apr 2026)
  // bk_post(webhookUrl, weeklyBlocks,
  //   `${titlePrefix}Sakura Weekly: ${totalCount} active tasks`);
  Logger.log(`Weekly active tasks summary — channel post skipped, sending DMs only (${isTest ? "TEST" : "LIVE"}).`);
```

**Step 2: Update `sendWeeklyActiveTasksSummary()` — the LIVE entry point no longer needs `getManagersChannelWebhook_()`**

At line 1424, the webhook URL is passed to `_sendWeeklyActiveTasksSummaryCore` but now isn't used for the channel post. The DM functions get their own webhooks internally. Change the call to pass `null` (or any truthy placeholder — the function checks for `!webhookUrl` at the top):

```javascript
// BEFORE (line 1424):
    _sendWeeklyActiveTasksSummaryCore(getManagersChannelWebhook_(), false);

// AFTER:
    _sendWeeklyActiveTasksSummaryCore("DM_ONLY", false);
```

And update the `!webhookUrl` guard at line 1448 — it should now just proceed since we're not posting to a channel:

Actually — simpler approach: **leave the webhookUrl parameter as-is** (keep passing `getManagersChannelWebhook_()`). It just won't be used for the channel post anymore. The blocks are still built (used for audit log context), and the DMs still fire. This avoids touching the function signature and the Test variant.

**Revised Step 2: No change to entry points.** The `webhookUrl` param is now effectively unused for posting but the function still works. This is the minimal-diff approach.

**Step 3: Verify `_sendWeeklyFohLeadsSummary_` still fires** (Sakura only)

The FOH leads post happens at line 1557, after the channel post we just commented out. It's a separate call — unaffected. Confirm by reading line 1557.

**Step 4: Update error notification in `sendWeeklyActiveTasksSummary()` (line 1428)**

Currently errors post to `getManagersChannelWebhook_()`. This is operational visibility — **keep as-is**. Error notifications are rare and important.

**Step 5: Commit**

```bash
git add "SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagement_Sakura.gs"
git commit -m "fix(sakura): weekly active task summary now DM-only, no channel post

Comments out bk_post to managers channel in _sendWeeklyActiveTasksSummaryCore.
Individual staff DMs and FOH leads channel post still fire.
Error notifications still go to managers channel (ops visibility)."
```

---

## Task 4: Waratah — Weekly active tasks: skip channel post, DMs only

**Files:**
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs:1780-1782` (channel bk_post in `_sendWeeklyActiveTasksSummaryCore`)

**Step 1: Comment out the channel bk_post call**

At lines 1780-1782:

```javascript
// BEFORE:
  bk_post(webhookUrl, weeklyBlocks,
    `${titlePrefix}Waratah Weekly: ${totalCount} active tasks`);
  Logger.log(`Weekly active tasks summary posted to Slack (${isTest ? "TEST" : "LIVE"}).`);

// AFTER:
  // Channel post removed — weekly summary now DM-only (Apr 2026)
  // bk_post(webhookUrl, weeklyBlocks,
  //   `${titlePrefix}Waratah Weekly: ${totalCount} active tasks`);
  Logger.log(`Weekly active tasks summary — channel post skipped, sending DMs only (${isTest ? "TEST" : "LIVE"}).`);
```

**Step 2: Leave entry points unchanged** (same rationale as Sakura — minimal diff).

**Step 3: Leave error notifications unchanged** (Waratah uses `getEscalationSlackWebhook_()` for errors — keep).

**Step 4: Commit**

```bash
git add "THE WARATAH/TASK MANAGEMENT SCRIPTS/EnhancedTaskManagementWaratah.gs"
git commit -m "fix(waratah): weekly active task summary now DM-only, no channel post

Comments out bk_post to managers channel in _sendWeeklyActiveTasksSummaryCore.
Individual staff DMs still fire.
Error notifications still go to escalation channel (ops visibility)."
```

---

## Task 5: Menu cleanup — Remove overdue summary menu items

**Files:**
- Modify: `SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/Menu_Updated_Sakura.gs` — remove "Send Overdue Summary Now" menu item
- Modify: `THE WARATAH/TASK MANAGEMENT SCRIPTS/Menu.js` — remove "Send Overdue Summary Now" + "Create Overdue Summary Trigger" menu items

**Step 1: Read both menu files to find exact line numbers**

**Step 2: Remove menu entries** (both the `addItem()` calls in `onOpen()` and the `protected_` wrapper functions)

For Sakura:
- Remove `addItem("Send Overdue Summary Now", "protected_sendOverdueTasksSummary")` from the menu builder
- Remove `protected_sendOverdueTasksSummary()` function definition

For Waratah:
- Remove `addItem("Send Overdue Summary Now", "protected_sendOverdueTasksSummary")` from the menu builder
- Remove `protected_sendOverdueTasksSummary()` function definition
- Remove `addItem("Create Overdue Summary Trigger (Sun 9am)", "protected_createWeeklyOverdueSummaryTrigger")` from the menu builder
- Remove `protected_createWeeklyOverdueSummaryTrigger()` function definition

**Step 3: Commit**

```bash
git add "SAKURA HOUSE/TASK MANAGEMENT SCRIPTS/Menu_Updated_Sakura.gs" "THE WARATAH/TASK MANAGEMENT SCRIPTS/Menu.js"
git commit -m "fix(both): remove overdue summary menu items from both venues

Removes manual 'Send Overdue Summary Now' menu option and
'Create Overdue Summary Trigger' (Waratah only) since overdue
summaries are no longer sent to Slack."
```

---

## Task 6: Manual post-deploy step — Remove Waratah Sunday trigger

**After `clasp push` to Waratah:**

The existing `runScheduledOverdueSummary` Sunday 9am trigger is still registered in GAS. Since we gutted the function body (Task 2), it will harmlessly log and return. But to clean up:

1. Open The Waratah task management spreadsheet
2. Go to **Task Management > Admin Tools > Setup Triggers > Remove All Triggers**
3. Then re-create the ones you still need:
   - **Task Management > Admin Tools > Setup Triggers > Create Daily Maintenance Trigger**
   - **Task Management > Admin Tools > Setup Triggers > Create Weekly Summary Trigger**
   - (Do NOT re-create the overdue summary trigger)

Or: Run `removeAllTaskTriggers()` from the Script Editor, then re-create only the triggers you want.

---

## Summary of What Changes

| What | Before | After |
|------|--------|-------|
| **Overdue daily (both venues)** | Posts to managers channel + DMs staff | Removed entirely |
| **Overdue weekly (Waratah only)** | Sunday 9am post to managers channel + DMs | Gutted (no-op) |
| **Weekly active (both venues)** | Posts to managers channel + DMs staff | DMs staff only |
| **Weekly FOH leads (Sakura only)** | Posts to FOH leads channel | Unchanged (kept) |
| **Error notifications** | Posts to managers/escalation channel | Unchanged (kept) |
| **Menu: Send Overdue Summary** | Available in both venues | Removed from both |
| **Menu: Create Overdue Trigger** | Available in Waratah | Removed |
| **Test variants** | DM Evan only | Unchanged |

---

## Open Question for User

**Sakura FOH Leads channel post** (`_sendWeeklyFohLeadsSummary_`): This posts a subset of weekly active tasks to `SLACK_FOH_LEADS_WEBHOOK`. It's separate from the managers channel. Should this also be removed/redirected to DMs, or is it fine as-is?
