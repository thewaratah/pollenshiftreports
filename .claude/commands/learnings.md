---
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [venue|category|file|all]
---

# /learnings — Review Pattern Intelligence

> Surface what the code review agent has learned from past reviews.
> Reads `docs/patterns/review-outcomes.json` and `docs/pipeline-learnings.md` to show trends, recurring issues, and venue-specific patterns.

**Query:** $ARGUMENTS

---

## Your Role

You are a pattern analyst. You read the review outcome history and present actionable insights. You do not modify any files.

---

## How to Run

1. Read `docs/patterns/review-outcomes.json`
2. Read `docs/pipeline-learnings.md`
3. Analyze based on the query type (see below)
4. Present findings in the output format

---

## Query Types

### `/learnings all` — Full dashboard

Show everything:
- Total reviews, block rate, fix success rate
- Top finding categories (sorted by frequency)
- Venue breakdown (which venue has more issues)
- Files with repeat findings (flagged 2+ times)
- Most recent 5 outcomes
- Gotchas promoted to CLAUDE_SHARED.md

### `/learnings sakura` or `/learnings waratah` — Venue-specific

Filter to one venue:
- All findings for that venue
- Top categories for that venue
- Files with repeat findings
- Lessons learned (from `learnings` arrays)

### `/learnings [category]` — Category deep-dive

Filter by finding category (e.g., `/learnings schema-drift`, `/learnings formula-protection`):
- All findings in that category across both venues
- Timeline (when did these occur)
- Which files were affected
- What rules were added as a result
- Whether the pattern is still recurring or was resolved

### `/learnings [filename]` — File history

Show all review outcomes that involved a specific file:
- Every time the file was reviewed
- What was found each time
- Whether issues were fixed or recurred
- The file's "risk score" (P0 findings / total reviews of that file)

### `/learnings trends` — Trend analysis

Compare recent reviews (last 5) vs older reviews:
- Are we finding fewer P0s over time? (improvement signal)
- Are new categories appearing? (emerging risk)
- Which rules added from past reviews are preventing issues now?
- Fix cycle count trend (are fixes taking more or fewer cycles?)

---

## Output Format

```
## Review Pattern Intelligence
**Query:** [what was asked]
**Data range:** [earliest date] to [latest date]
**Total reviews:** [N]

### Key Metrics
- Block rate: [N blocked / N total] ([%])
- Fix success rate: [%]
- Gotchas promoted: [N]
- Avg fix cycles: [N]

### [Section based on query type]
[findings, trends, file history, etc.]

### Actionable Insights
- [1-3 specific recommendations based on the data]
- [e.g., "schema-drift has occurred 3 times in Waratah rollover files — consider adding a pre-rollover schema check to waratah-gas-agent"]
- [e.g., "No P0 findings in last 5 reviews — review rules may be working effectively"]
```

---

## Cross-Reference with Instincts

After presenting findings, check if any high-frequency categories (3+ occurrences) do NOT have a corresponding instinct in `~/.claude/homunculus/instincts/`. If a gap exists, note it:

```
### Missing Instincts
- Category [X] has [N] occurrences but no instinct file — consider seeding one
```

This closes the loop: outcomes → patterns → instincts → prevention.
