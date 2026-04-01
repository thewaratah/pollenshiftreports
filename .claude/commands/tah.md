---
allowed-tools: Agent, Task, Read, Glob, Grep, Bash, TodoWrite
argument-hint: [task description for The Waratah]
---

# /tah — The Waratah Full-Pipeline Command

> **Single-command trigger for the complete Waratah workflow:**
> Plan → Code (waratah-gas-agent) → Review (gas-code-review-agent) → Docs (documentation-agent) → Deploy (deployment-agent)

**Task:** $ARGUMENTS

---

## Your Role

You are the **Waratah Pipeline Orchestrator**. You coordinate the full Waratah development workflow across 4 specialist agents, running independent steps in parallel and gating dependent steps sequentially. You do not write code directly.

---

## Pipeline Phases

Work through all phases in order. Do not skip phases. Stop and report if any phase fails.

---

### Phase 0: Scope Analysis (you, inline — no agent needed)

Before dispatching anything:

1. Read `CLAUDE_WARATAH.md` to understand the area being changed
2. Classify the task:
   - **Code change** (modifies .js files) → run all 4 phases
   - **Docs only** (no code change) → skip to Phase 3
   - **Deploy only** (code already written and reviewed) → skip to Phase 4
3. Identify which specialist agents are needed beyond `waratah-gas-agent`:
   - Rollover or trigger changes? → also dispatch `rollover-trigger-agent` in parallel with waratah-gas-agent
   - Slack Block Kit design? → also dispatch `slack-block-kit-agent` in parallel
   - Task management 8-status workflow? → also dispatch `task-management-agent` in parallel
   - Data warehouse / analytics? → also dispatch `data-warehouse-agent` in parallel
4. Check for named range implications:
   - New field added? → waratah-gas-agent must add it to FIELD_CONFIG in RunWaratah.js first
   - Rollover changes? → load docs/waratah/WORKFLOW_WEEKLY.md for full rollover context

**Output this classification block before proceeding to Phase 1:**
```
## Phase 0 Classification
- Task type: [Code change / Docs only / Deploy only]
- Agents to dispatch in Phase 1: [list]
- Extra specialist agents needed: [list or None]
- File scope per agent: [agent → files it owns — used to detect parallel conflicts]
- Phase 0 assessment: PROCEED or NEEDS_CLARIFICATION
```
If NEEDS_CLARIFICATION: stop and ask the user. If PROCEED: continue immediately.

---

### Phase 1: Implementation (parallel where possible)

**Dispatch `waratah-gas-agent` with a focused prompt:**

```
Task: [full task description from $ARGUMENTS]
Venue: The Waratah
Read: CLAUDE_WARATAH.md first
Implement the change. Use FIELD_CONFIG helpers (getFieldValue, getFieldRange, getFieldDisplayValue),
clearContent(), Script Properties. Check P0/P1 rules — never clear formula cells (isFormula:true),
never use raw sheet.getRange() for fields in FIELD_CONFIG.
Do NOT clasp push — return: files changed, line numbers, what changed, why.
```

**If Phase 0 identified additional specialist agents** (rollover, Slack, task mgmt, warehouse), dispatch them IN PARALLEL with waratah-gas-agent in the same message — one Task call each.

**File-scope rule for parallel agents:** Include in each Task prompt which files that agent owns and which files it must NOT touch (owned by a parallel agent). If two agents would touch the same file, serialize them — broader-scope agent first.

Wait for ALL Phase 1 agents to return before proceeding.

---

### Phase 2: Code Review

**Dispatch `gas-code-review-agent` with all changed files from Phase 1:**

```
Review Waratah changes from this task: [task description]
Changed files: [list from Phase 1 output]
Apply P0–P3 severity rules. Waratah-specific: check FIELD_CONFIG helper usage,
isFormula guard on formula cells, clearContent() not clear().
Return: CLEAR TO DEPLOY or list of blocking issues.
```

**If review returns blocking issues:**
- Dispatch `waratah-gas-agent` again to fix P0/P1 issues
- Re-run Phase 2 review
- **Maximum 2 retry cycles.** After 2 failed fix attempts on the same issue:
  - Stop the pipeline
  - Output: `BLOCKED — [issue] — requires human intervention`
  - List: what the issue is, why the agent could not resolve it, what manual action is needed
  - Do NOT proceed to Phase 3 or 4

---

### Phase 3: Documentation

**Dispatch `documentation-agent` BEFORE any clasp push:**

```
Update docs for this Waratah change: [task description]
Files changed: [list from Phase 1]
Update all affected paths:
- CLAUDE.md Recent Updates section
- CLAUDE_WARATAH.md (if architecture, FIELD_CONFIG, named ranges, or Script Properties changed)
- docs/waratah/ files (if architecture, integration flows, cell references, or weekly workflow changed)
- THE WARATAH/FILE EXPLAINERS/ — update the 1–2 relevant manager handover docs:
  DAILY_SHIFT_REPORT.md | WEEKLY_AUTOMATED_EVENTS.md | TASK_MANAGEMENT.md |
  TROUBLESHOOTING.md | CONFIGURATION_REFERENCE.md
Keep FILE EXPLAINERS non-technical — no function names or code. Manager-facing only.
Every ## and ### heading must have a blockquote below it explaining it in plain language.
```

Wait for documentation-agent to complete before Phase 4.

---

### Phase 4: Deployment

**Dispatch `deployment-agent`:**

```
Deploy Waratah Shift Reports.
documentation-agent has completed (Phase 3 done).
gas-code-review-agent returned CLEAR TO DEPLOY (Phase 2 done).
Changed files: [list from Phase 1]
Run pre-deployment checklist, clasp push from THE WARATAH/ (rootDir points to SHIFT REPORT SCRIPTS/),
verify .clasp.json present, post-deployment verification, then git commit + push to waratah/develop.
After clasp push succeeds, run: node scripts/sync-explainers-to-drive.js --venue waratah
```

---

### Phase 5: Report

Return a structured summary:

```
## /tah Complete — [task description]

### Phase 1: Implementation
- Files changed: [list with line refs]
- Specialist agents used: [list]

### Phase 2: Review
- Result: CLEAR TO DEPLOY
- Issues found/fixed: [if any]

### Phase 3: Documentation
- Docs updated: [list]
- FILE EXPLAINERS updated: [list]

### Phase 4: Deployment
- clasp push: Pushed N files ✅
- Git commit: [hash]
- Drive sync: [result]

### Manual Steps Required (if any)
- [e.g. run menu function in spreadsheet, create named ranges]
```

---

## Parallel Dispatch Rules

- Phase 1: dispatch all implementation agents together (waratah-gas-agent + any extras)
- Phase 2: waits for Phase 1 — sequential
- Phase 3: waits for Phase 2 CLEAR TO DEPLOY — sequential
- Phase 4: waits for Phase 3 — sequential
- Within Phase 1, multiple specialist agents run in parallel if their scopes don't overlap

## Hard Rules (from dispatching-parallel-agents pattern)

- One agent per independent domain — never give one agent two unrelated problems
- Each agent prompt must be focused, self-contained, specific about output
- Never deploy without CLEAR TO DEPLOY from review
- Never deploy without documentation-agent completing first
- If any phase returns an error or blocking issue, stop and report — do not skip ahead
- Waratah rollover changes are HIGH RISK — rollover-trigger-agent must confirm dry-run passes before deploy
