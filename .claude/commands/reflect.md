---
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [decision or approach to analyze]
---

# /reflect — Self-Analysis & Decision Reflection

> Structured reasoning review for decisions, approaches, and trade-offs.
> Use when facing multiple viable approaches, after a non-obvious decision, or when asked to analyze reasoning.

**Subject:** $ARGUMENTS

---

## Auto-Activation Triggers

This command should be invoked (or suggested) when:
- User says "analyze my reasoning", "reflect on this decision", "evaluate this approach"
- There are 2+ viable implementation approaches and no obvious winner
- A fix was applied but the user isn't sure it's the right one
- After a complex pipeline run with unexpected results
- When a trade-off needs explicit documentation (performance vs readability, DRY vs clarity)

---

## Reflection Framework

### Step 1: Frame the Decision

State clearly:
- **What decision is being made?** (1 sentence)
- **What are the constraints?** (GAS 6-min limit, venue conventions, production stability, etc.)
- **What prior art exists?** Check:
  - `docs/patterns/review-outcomes.json` — has this type of decision been made before?
  - `~/.claude/homunculus/instincts/` — do any instincts apply?
  - `docs/pipeline-learnings.md` — any past lessons relevant?

### Step 2: Enumerate Approaches

For each viable approach:

```
### Approach [N]: [Name]

**How it works:** [1-2 sentences]
**Pros:**
- [concrete benefit, not abstract]
**Cons:**
- [concrete cost, not abstract]
**Risk:** [what could go wrong in production]
**Precedent:** [has the project done this before? cite file/commit if so]
**Effort:** [trivial / small / medium / large]
```

### Step 3: Apply Project Heuristics

Score each approach against these project-specific criteria (not generic best practices):

| Criterion | Weight | Why it matters here |
|-----------|--------|---------------------|
| Production safety | HIGH | Both venues serve live restaurants; bugs = operational disruption |
| GAS platform fit | HIGH | Some "best practices" don't apply in GAS (no npm, no modules, 6-min limit) |
| Venue symmetry | MEDIUM | If it works for one venue, can it work for both? |
| Rollover safety | MEDIUM | Will this survive weekly rollover without side effects? |
| Future readability | LOW-MEDIUM | Next developer (or future Claude session) needs to understand it |
| Minimal diff | LOW-MEDIUM | Smaller changes = less review burden, fewer bugs |

### Step 4: Recommendation

```
## Recommendation: [Approach N]

**Confidence:** [high/medium/low] — [why this confidence level]
**Key reason:** [the single most important factor]
**What to watch for:** [the biggest risk with this approach]
**Reversibility:** [easy/moderate/hard to undo if wrong]
```

### Step 5: Log the Reflection (if the decision is non-trivial)

If this reflection involved a genuine trade-off (not just confirming an obvious choice), append to `docs/patterns/reflections-log.json`:

```json
{
  "date": "[YYYY-MM-DD]",
  "subject": "[what was decided]",
  "approaches_considered": N,
  "chosen": "[approach name]",
  "confidence": "[high/medium/low]",
  "key_factor": "[the deciding factor]",
  "outcome": null
}
```

The `outcome` field is updated later by `/learnings trends` or the next session if the decision proved right or wrong.

---

## Output Format

```
## Reflection: [Subject]

### Decision
[1 sentence]

### Approaches
[Approach cards as above]

### Scoring
[Table with criteria scores]

### Recommendation
[Structured recommendation]

### Instinct Check
- [List any matching instincts from ~/.claude/homunculus/instincts/]
- [List any matching patterns from docs/patterns/review-outcomes.json]
- If none match: "No prior patterns — this is a novel decision."
```
