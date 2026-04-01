---
allowed-tools: Agent, Task, Read, Glob, Grep, Bash, TodoWrite
argument-hint: [what went wrong or what's unexpected]
---

# /investigate — Error Recovery & Unexpected Results

> Structured investigation when something doesn't work as expected.
> Combines the gas-debugging skill's methodology with pattern store lookups and instinct cross-referencing.

**Problem:** $ARGUMENTS

---

## Auto-Activation Triggers

This command should be invoked (or suggested) when:
- A GAS trigger fails silently or produces wrong output
- A deployment succeeds but the spreadsheet shows wrong data
- Rollover didn't clear expected fields, or cleared formula cells
- Warehouse rows have wrong dates, missing columns, or duplicates
- A menu function throws an error managers can see
- A Slack notification wasn't sent or has wrong content
- Any "it worked yesterday but not today" scenario

---

## Investigation Protocol

### Phase 1: Scope & Classify (before reading any code)

```
## Investigation Scope
- **Symptom:** [exactly what the user observed]
- **Venue:** [Sakura / Waratah / Both / Unknown]
- **System:** [shift report / rollover / task mgmt / warehouse / Slack / trigger / other]
- **Severity:** [data loss / wrong data / missing feature / cosmetic]
- **Reproducible:** [always / sometimes / once]
- **When:** [after deploy / after rollover / after trigger fired / random]
```

### Phase 2: Pattern Matching (check before investigating from scratch)

Read these three sources in parallel — the answer may already exist:

1. **`docs/patterns/review-outcomes.json`** — Search findings for matching categories or files
2. **`~/.claude/homunculus/instincts/`** — Read all 8 instinct files; does any instinct describe this exact symptom?
3. **`docs/pipeline-learnings.md`** — Has this exact problem been seen and solved before?

If a match is found:
```
## Pattern Match Found
- **Source:** [instinct file / review outcome / pipeline learning]
- **Prior incident:** [date and description]
- **Prior fix:** [what was done]
- **Applicable now?** [yes — apply same fix / no — different root cause / partial — same category but different trigger]
```

If a match is found and applicable, skip to Phase 5 (apply the known fix). Do NOT re-investigate from scratch.

### Phase 3: Root Cause Analysis (only if no pattern match)

Dispatch the appropriate venue agent to investigate (do NOT fix yet):

```
Investigate only — do NOT make changes.
Symptom: [from Phase 1]
Venue: [from Phase 1]

Read the relevant files and answer:
1. What function produces this output?
2. What inputs does it receive? (cell values, Script Properties, trigger context)
3. Where does the logic diverge from expected behavior?
4. Is this a GAS platform quirk or a code bug?

Return: root cause hypothesis with file:line evidence.
```

### Phase 4: Hypothesis Validation

Before applying any fix, validate the hypothesis:

1. **Check the hypothesis against instincts** — does the root cause match a known GAS gotcha?
   - If yes: high confidence, proceed to fix
   - If no: medium confidence, consider testing on a copy first

2. **Check for blast radius** — will the fix affect other functions?
   - Grep for all callers of the affected function
   - Check if the fix changes any function signature

3. **Check for venue parity** — if this is a GAS platform bug, does the other venue have the same issue?

### Phase 5: Resolution

Two paths:

**Path A: Known pattern (from Phase 2 match)**
- Apply the documented fix
- Route to `/saks` or `/tah` pipeline for implementation + review + deploy

**Path B: Novel issue (from Phase 3-4)**
- Route to `/saks` or `/tah` pipeline for implementation + review + deploy
- After fix is deployed, log the investigation:

### Phase 6: Learning Capture

After resolution, append to `docs/patterns/review-outcomes.json` with:
- Category matching the root cause
- Learnings array describing the non-obvious finding
- `gotcha_promoted: true` if this was a GAS platform quirk (and propose instinct)

Also append to `docs/pipeline-learnings.md` if the root cause was non-obvious.

If the root cause reveals a new GAS platform gotcha not covered by existing instincts, create a new instinct file:

```
~/.claude/homunculus/instincts/[descriptive-name].md
```

With frontmatter: name, domain (gas-platform), confidence (start at 75), observations (1), trigger, created date, source.

---

## Output Format

```
## Investigation: [Problem Summary]

### Scope
[Phase 1 classification]

### Pattern Check
[Phase 2 results — match found or no match]

### Root Cause
[Phase 3-4 findings or "Known pattern — see [source]"]

### Fix
[What was done or what should be done]
[Route: /saks or /tah pipeline for implementation]

### Learning Captured
- Review outcome logged: [yes/no]
- Pipeline learning logged: [yes/no]
- New instinct created: [yes/no — if yes, filename]
- Gotcha promoted to CLAUDE_SHARED.md: [yes/no]

### Prevention
[What rule or check would have caught this before it reached production]
```
