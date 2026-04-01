---
name: gas-debugging
description: Use when encountering any GAS bug, unexpected trigger behavior, rollover failure, or sheet not clearing as expected. Applies a 4-phase investigation methodology before any fix attempt. Prevents repeated gotchas specific to this codebase.
tags: [gas, debugging, waratah, sakura, rollover, triggers]
---

# GAS Debugging Skill

## Iron Law: No Fix Without Root Cause

Do not attempt to fix a GAS bug until you have identified the root cause. Retrying the same fix or increasing timeouts without understanding the cause makes the problem harder to diagnose later.

## Phase 1: Root Cause Investigation

Batch-read the relevant files in parallel before forming any hypothesis:

1. Read the failing function in full — not just the erroring line
2. Read `Logger.log` output if available (Executions tab in GAS editor)
3. Grep for the function name across the venue's scripts directory — is it called from multiple places?
4. Check: is this function trigger-fired or menu-called? (Determines whether `getUi()` can be used)

**Known GAS gotchas — check these first:**

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Row not clearing after rollover | `clear()` instead of `clearContent()` — or correct method on wrong range | Use `range.clearContent()` on the merged range starting cell (e.g. `A43:F43`, not `B43:F43`) |
| Formula cell cleared/zeroed | Field is `isFormula: true` in FIELD_CONFIG but included in clearable list | Check `getClearableFieldKeys_()` — formula cells must be excluded |
| Trigger function fails silently | No try/catch + `getUi()` called in trigger context | Wrap in try/catch; replace `getUi().alert()` with `Logger.log()` + Slack notification |
| Named range returns null | Named range not created in spreadsheet yet | Run `createNamedRangesOnAllSheets()` from the Named Ranges menu |
| `getUi()` throws in trigger | Time-based triggers cannot call `SpreadsheetApp.getUi()` | Wrap in `try { SpreadsheetApp.getUi()... } catch(e) { Logger.log('UI skipped'); }` |
| `clearContent()` TypeError | Called as `sheet.clearContent()` (no method on Sheet) | Use `sheet.getDataRange().clearContent()` or `range.clearContent()` |
| Duplicate trigger created | `ScriptApp.newTrigger()` called without removing existing first | Call `removeTriggerByFunction_(name)` before creating new trigger |
| Trigger 21+ silently missing | Hit 20-trigger GAS hard limit | Run `checkTriggerCount_()` — remove unused triggers before adding new |
| UrlFetchApp 200 but wrong data | `muteHttpExceptions: true` hides non-200 response codes | Always check `response.getResponseCode()` explicitly after fetch |
| Merged cell not reading value | Reading col B of an A:F merge — value is always in col A | Use `sheet.getRange('A43').getValue()` not `sheet.getRange('B43').getValue()` |

## Phase 2: Pattern Match

After reading the code, answer these questions before writing any fix:

- Does this match one of the known gotchas above?
- Is the same bug pattern present elsewhere in the same file or venue?
- Has this specific function been changed recently? (Check git log for the file)

## Phase 3: Hypothesize

State the root cause explicitly before writing any fix:

```
Root cause: [one sentence]
Evidence: [what in the code or logs confirms this]
Fix: [one sentence describing the change]
Risk: [what else might this touch]
```

If you cannot state the root cause confidently, do Phase 1 again with broader scope.

## Phase 4: Implement

Apply the smallest possible fix that addresses the root cause:

- Fix only what was diagnosed — do not clean up surrounding code
- If the fix touches a formula cell, verify `isFormula: true` is in FIELD_CONFIG
- If the fix touches a trigger, run `checkTriggerCount_()` before and after
- If the fix touches rollover, test on a copy — never on production

## Escalation

If after 2 investigation cycles the root cause is still unclear:
- Stop and describe exactly what was tried and what the logs showed
- Ask the user for the full Executions log from the GAS editor
- Do not make further guesses
