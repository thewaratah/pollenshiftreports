# Pipeline Learnings

> Lightweight post-deployment capture. One row per pipeline run where something was learned.
> Read by `documentation-agent` at the start of each doc update cycle.
> Read by `gas-code-review-agent` as a "previously seen issues" list.

| Date | Task | What went wrong / was unexpected | Fix applied | Rule added to which agent |
|------|------|----------------------------------|-------------|--------------------------|
| 2026-03-18 | Named range migration (Waratah) | `CLEARABLE_FIELDS` used different key names than `FIELD_CONFIG` (`cashDiscount` vs `cdDiscount`, `vips` vs `guestsOfNote`, etc.) — silent mismatch meant some fields weren't cleared | Fixed key names in `WeeklyRolloverInPlace.js` to match `FIELD_CONFIG` | `waratah-gas-agent` P0: use `getClearableFieldKeys_()`, never maintain a parallel clearable list |
| 2026-03-xx | Formula cell B34 cleared during rollover | `CLEARABLE_FIELDS` included `netRevenue` (formula cell) — rollover destroyed the formula | Removed from clearable list; added `isFormula: true` guard | `waratah-gas-agent` + `gas-code-review-agent`: formula cells flagged in FIELD_CONFIG must never appear in clearable lists |
| 2026-02-23 | TypeError on both venues | `TASK_CONFIG` was extended with `slack: {}` keys — caused `Cannot read properties of undefined (reading 'dmWebhooks')` | Removed all Slack config from TASK_CONFIG; use Script Properties helpers only | `task-management-agent` P0: TASK_CONFIG must NOT contain Slack/email config |
| 2026-03-xx | `sheet.clearContent()` TypeError | Called `clearContent()` on a Sheet object (not a Range) — Sheet has `clearContents()` (plural), not `clearContent()` | Changed to `sheet.getDataRange().clearContent()` | Both venue agents + review agent: `clearContent()` only on Range objects; `clearContents()` only on Sheet objects |

---

**How to add an entry:** After any pipeline run that uncovered a non-obvious issue, append a row with today's date. Keep each entry to the 4 fields. If a rule was added to an agent file, note which one. Entries never get deleted — they become the institutional memory that prevents the same mistake twice.
