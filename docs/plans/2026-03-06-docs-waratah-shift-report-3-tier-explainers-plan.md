---
title: 3-Tier Waratah Shift Report Explainer Documentation
type: docs
date: 2026-03-06
venue: The Waratah
scope: Shift Reports (primary), Task Management (briefly at intersections)
---

# 3-Tier Waratah Shift Report Explainer Documentation

## Overview

Create three progressive explainer documents for The Waratah's Shift Report system, targeting different levels of technical depth. All three are aimed at managers (both new hires and existing staff) and progressively build on each other.

**Output:** 3 markdown files in `docs/waratah/explainers/` designed to copy into Google Docs.

## Problem Statement / Motivation

Managers currently have no documentation explaining how the shift report system works. The only documentation is developer-facing (`CLAUDE_WARATAH.md`, `WORKFLOW_SHIFT_REPORTS.md`) — written for Claude/developers, not for the people who use the system daily. New hires have to learn by shadowing. Existing managers may not understand what happens after they click "Export & Email PDF" or why certain fields must not be edited.

## Proposed Solution

Three progressive documents, each building on the last:

### Tier 1: Basic (Front-End Walkthrough)
**File:** `docs/waratah/explainers/01-BASIC-Daily-Shift-Report-Guide.md`
**Audience:** Any manager, day one
**Format:** Chronological day walkthrough — "here's what you do from open to close"
**Covers:**
- What the spreadsheet looks like (5 day tabs + TO-DOs tab)
- Which cells to fill in (financials, narratives, tasks)
- Which cells NOT to touch (formulas: B37, B38, B39, B15, B16, B26-B29)
- How to send the report (menu path, checklist dialog, what gets sent)
- What happens after you send (who gets emailed, what Slack sees)
- What "weekly rollover" means for your day-to-day (Monday morning, fresh week)
- Where to find your TO-DOs and archived reports
- Common mistakes and how to avoid them

**Tone:** Friendly, direct, no jargon. Written as if talking to a new MOD on their first shift.

**Estimated length:** 1,500-2,000 words

### Tier 2: Intermediate (Behind the Scenes)
**File:** `docs/waratah/explainers/02-INTERMEDIATE-How-The-System-Works.md`
**Audience:** Managers who want to understand the machinery
**Prerequisite:** Tier 1
**Format:** Process-oriented — "here's what each button actually triggers"
**Covers:**
- The full export pipeline: what happens step-by-step when you click "Export & Email PDF (LIVE)"
  1. Validation (sheet name check)
  2. Pre-send checklist dialog (Deputy timesheets + fruit order)
  3. Data warehouse logging (financial, operational, wastage, qualitative)
  4. TO-DO aggregation (builds the TO-DOs summary tab)
  5. Slack notification (Block Kit formatted message)
  6. TO-DO push to Master Actionables (cross-spreadsheet)
  7. PDF generation
  8. Email distribution (9 recipients)
  9. Warning notifications (if anything failed)
- What the data warehouse is and what it stores (4 sheets, 22 financial columns)
- How duplicate prevention works (Date + MOD key)
- What the weekly rollover actually does (archive → clear → update dates → notify)
- What the 3 automated triggers do (Monday rollover, Wednesday digest, Wednesday backfill)
- TEST vs LIVE mode — what's different
- The basic export alternative (NightlyBasicExport) and when to use it
- The "Waratah Tools" menu — every item explained

**Tone:** Informative, explains concepts without showing code. Uses tables and flow descriptions.

**Estimated length:** 3,000-4,000 words

### Tier 3: Advanced (Complete Backend Architecture)
**File:** `docs/waratah/explainers/03-ADVANCED-Complete-Backend-Reference.md`
**Audience:** Managers who want the full picture (or a technical handover doc)
**Prerequisite:** Tiers 1 and 2
**Format:** File-by-file architecture reference
**Covers:**
- File inventory: all 16 .js files + 4 .html files with purpose and line counts
- Dependency graph: which files call which (Mermaid diagram)
- Function reference: every exported function, what it does, how it's triggered
- Cell reference map: every spreadsheet cell the system reads/writes
- Script Properties: all 18 configuration values and what they control
- Data flow diagram: Spreadsheet → GAS → Slack/Email/Warehouse (Mermaid)
- Warehouse schema: NIGHTLY_FINANCIAL (22 cols), OPERATIONAL_EVENTS (8 cols), WASTAGE_COMPS (6 cols), QUALITATIVE_LOG (11 cols)
- Trigger schedule: all 3 time-based triggers + the onOpen event trigger
- Password-gated functions and the admin password system
- Error handling philosophy: non-blocking try/catch, warning notifications to Evan
- Key gotchas: formula cells, merged cell clearing, clearContent vs clearContents, getUi() in trigger context, LockService for concurrency
- The Task Management intersection: how TO-DOs flow from shift reports to Master Actionables

**Tone:** Technical reference. Tables, diagrams, specific cell references. Still written for managers, not developers — explains what code *does*, not how to write it.

**Estimated length:** 5,000-7,000 words

## Technical Approach

### Content Sources (Already Gathered)
The Waratah agent has completed a full codebase research producing:
- Chronological daily workflow walkthrough
- Function-level map for all 16 .js + 4 .html files
- File-level architecture with dependency graph
- All automated processes documented
- Complete data flow from spreadsheet through GAS to external systems

### Writing Strategy
1. **Tier 1** — Rewrite the agent's daily workflow walkthrough in plain English, removing all function names and cell references. Add "common mistakes" section.
2. **Tier 2** — Restructure the agent's pipeline documentation into process explanations. Keep cell references (managers can verify), remove function names. Add tables for warehouse schema and trigger schedule.
3. **Tier 3** — Directly adapt the agent's complete research into a formatted reference. Include Mermaid diagrams, full function tables, dependency graph. The audience can handle technical depth but the language should explain *what* not *how to code*.

### Visual Aids
- **Tables** for structured data (cell maps, trigger schedules, file inventories)
- **Numbered lists** for sequential processes (export pipeline, rollover steps)
- **Mermaid diagrams** in markdown for:
  - File dependency graph (Tier 3)
  - Export pipeline flowchart (Tier 2)
  - Data flow diagram (Tier 3)
- Note: User will screenshot Mermaid diagrams for Google Docs

### File Structure
```
docs/waratah/explainers/
├── 01-BASIC-Daily-Shift-Report-Guide.md
├── 02-INTERMEDIATE-How-The-System-Works.md
└── 03-ADVANCED-Complete-Backend-Reference.md
```

## Implementation Phases

### Phase 1: Tier 1 (Basic)
- Write chronological day walkthrough
- Cover every field a manager touches
- Add "do not touch" warnings for formula cells
- Add common mistakes section
- Review for plain English / no jargon

### Phase 2: Tier 2 (Intermediate)
- Write export pipeline step-by-step
- Explain warehouse, triggers, rollover
- Add Mermaid flowchart for export pipeline
- Document every menu item
- Review for consistency with Tier 1 terminology

### Phase 3: Tier 3 (Advanced)
- Write file inventory table
- Create Mermaid dependency graph
- Build function reference tables (per file)
- Document cell reference map
- Add data flow and warehouse schema
- Review for accuracy against codebase

## Acceptance Criteria

### Functional Requirements
- [ ] Three markdown files created in `docs/waratah/explainers/`
- [ ] Tier 1 is understandable by someone who has never seen the spreadsheet
- [ ] Tier 2 explains the full export pipeline without showing code
- [ ] Tier 3 covers every .js file, every exported function, every trigger
- [ ] Each tier references the previous as prerequisite
- [ ] No developer jargon in Tier 1; minimal in Tier 2; acceptable in Tier 3
- [ ] All cell references in Tier 2/3 are accurate against current codebase

### Quality Gates
- [ ] All Mermaid diagrams render correctly in VS Code preview
- [ ] Tables copy cleanly into Google Docs
- [ ] No references to "Claude", "CLAUDE.md", or developer tooling
- [ ] Formula cells (B37, B38, B39, B15, B16, B26-B29) clearly marked as "do not edit"

## Dependencies & Prerequisites
- Waratah codebase research: **COMPLETE** (33k-character research document from waratah-gas-agent)
- CLAUDE_WARATAH.md: Current (Mar 6, 2026)
- WORKFLOW_SHIFT_REPORTS.md: Current (Mar 6, 2026)

## Risk Analysis & Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
| Cell references change | Docs become inaccurate | Tier 3 includes cell map — single source to update |
| New features added | Docs incomplete | Each tier is self-contained — can be updated independently |
| Tier 1 too long for new hires | Won't be read | Target 2,000 words max, use scannable headers |
| Mermaid doesn't render in Google Docs | Visual aids lost | Note to screenshot for Docs; text descriptions also present |

## References

### Internal
- [CLAUDE_WARATAH.md](../../CLAUDE_WARATAH.md) — Developer quick reference
- [WORKFLOW_SHIFT_REPORTS.md](../../WORKFLOW_SHIFT_REPORTS.md) — Developer workflow docs
- [CELL_REFERENCE_MAP.md](../waratah/CELL_REFERENCE_MAP.md) — Full cell reference map
- Waratah agent research (33k chars) — Available in session context

### Codebase Files Covered
- 16 .js files in `THE WARATAH/SHIFT REPORT SCRIPTS/`
- 4 .html files (checklist-dialog, rollover-wizard, export-dashboard, analytics-viewer)
- Total: ~6,200 LOC
