# SHIFT REPORTS 3.0 - Navigation Guide

**Project Type:** Google Apps Script (Multi-Venue Hospitality Management System)
**Venues:** Sakura House, The Waratah

---

## Agent Auto-Routing Rules

**Claude must follow these dispatch rules automatically — no user prompt required.**

| Trigger | Agent to dispatch |
|---------|------------------|
| Any task touching Sakura House files | `sakura-gas-agent` |
| Any task touching Waratah files | `waratah-gas-agent` |
| Task spans both venues | `shift-report-orchestrator` → parallelises into both venue agents |
| After any code change (>5 lines modified) | `gas-code-review-agent` |
| Before any `clasp push` | `deployment-agent` |
| Any rollover, trigger create/remove, schedule | `rollover-trigger-agent` |
| Any Slack Block Kit design or webhook debug | `slack-block-kit-agent` |
| Any CLAUDE.md / doc update | `documentation-agent` |
| Multi-step feature with 3+ files across venues | `shift-report-orchestrator` |
| Claude API calls via UrlFetchApp in GAS | `claude-api-agent` |
| Warehouse queries, backfill, analytics | `data-warehouse-agent` |
| Deputy API, OAuth2, external REST | `external-integrations-agent` |
| Task management 8-status workflow, escalation | `task-management-agent` |

**Slash commands** (type in chat):
| Command | Purpose |
|---------|---------|
| `/review [files]` | Run gas-code-review-agent on changed files |
| `/sakura [task]` | Dispatch sakura-gas-agent |
| `/waratah [task]` | Dispatch waratah-gas-agent |
| `/plan [feature]` | Orchestrator plans without writing code |
| `/orchestrate [task]` | Orchestrator plans + executes end-to-end |
| `/deploy [venue]` | Run deployment checklist + clasp push |
| `/docs [what changed]` | Patch affected CLAUDE.md files |
| `/rollover [task]` | Rollover/trigger management |
| `/slack [task]` | Block Kit design or webhook debug |

---

## 🧭 Which Guide Do You Need?

**Documentation has been split to avoid token limits in Claude conversations.**

### Working on SAKURA HOUSE?
→ **Read [`CLAUDE_SAKURA.md`](CLAUDE_SAKURA.md)** 🟢 **PRODUCTION READY**
- Named range system
- In-place weekly rollover ✅
- 6-day operation (closed Sundays)
- ~9,500 lines of code (13 .gs + 9 .gs task mgmt + HTML)

### Working on THE WARATAH?

**Quick Reference (START HERE):**
→ **[`CLAUDE_WARATAH.md`](CLAUDE_WARATAH.md)** 🟢 **PRODUCTION READY**
- 343 lines - Modular with on-demand detail links
- Hardcoded cell references
- In-place weekly rollover ✅
- 5-day operation (Wed-Sun)

**Deep Dive (Load Only When Needed):**
- 📋 Task Management: [`WORKFLOW_TASK_MANAGEMENT.md`](docs/_archive/WORKFLOW_TASK_MANAGEMENT.md) (866 lines - detailed backend flows)
- 📋 Shift Reports: [`WORKFLOW_SHIFT_REPORTS.md`](WORKFLOW_SHIFT_REPORTS.md) (updated Mar 6)
- 🏗️ Architecture: [`docs/waratah/DEEP_DIVE_ARCHITECTURE.md`](docs/waratah/DEEP_DIVE_ARCHITECTURE.md)
- 🔌 Integrations: [`docs/waratah/INTEGRATION_FLOWS.md`](docs/waratah/INTEGRATION_FLOWS.md)

### Need Shared Patterns?
→ **Read [`CLAUDE_SHARED.md`](CLAUDE_SHARED.md)**
- Task management system (8-status workflow)
- Slack Block Kit integration
- PDF export & email system
- Data warehouse integration
- Common design patterns

---

## Quick Overview

SHIFT REPORTS 3.0 is a comprehensive hospitality automation system that manages daily shift reporting, task management, data warehousing, and business analytics for two restaurant venues. Built entirely on Google Apps Script, it provides automated workflows, Slack integrations, PDF exports, and centralized data analytics.

**Core Capabilities:**
- 📊 **Automated Shift Reporting** - Daily financial reconciliation and operational notes
- ✅ **Enhanced Task Management** - 8-status workflow with auto-escalation and recurring tasks
- 📈 **Data Warehousing** - Centralized analytics database with duplicate prevention
- 🔄 **Weekly Rollover** - Automated report cycling
- 📧 **PDF Export** - Formatted reports via email and Slack
- 💬 **Slack Integration** - Rich Block Kit notifications
- 🏢 **Multi-Venue Support** - Independent systems per venue

---

## Project Structure

```
SHIFT REPORTS 3.0/                       # Git repo: github.com/thewaratah/pollenshiftreports
├── SAKURA HOUSE/
│   ├── SHIFT REPORT SCRIPTS/         # 13 .gs + 3 .html, ~5,700 LOC
│   ├── TASK MANAGEMENT SCRIPTS/      # 9 .gs + 1 .html, ~3,800 LOC
│   └── CODE_REVIEW_REPORTS_2026-02-16/  # Deployment & testing guides
├── THE WARATAH/
│   ├── SHIFT REPORT SCRIPTS/         # 16 .js + 4 .html, ~6,300 LOC
│   └── TASK MANAGEMENT SCRIPTS/      # 6 .gs + 1 .html, ~3,400 LOC
├── docs/
│   ├── brainstorms/                  # Design documents
│   └── plans/                        # Implementation plans
├── .claude/
│   └── agents/                       # 12 specialist agents (excluded from git)
├── .gitignore                        # Excludes _SETUP_*, .clasp*, .claude/, etc.
├── CLAUDE.md                         # This navigation file
├── CLAUDE_SAKURA.md                  # Sakura House guide
├── CLAUDE_WARATAH.md                 # The Waratah guide
├── CLAUDE_SHARED.md                  # Shared patterns guide
└── CODE_ANALYSIS.md                  # Full code analysis
```

**Total:** ~19,200 lines of code across 44 .gs/.js files + 9 .html files (53 files total)

---

## Key Differences Between Venues

| Feature | Sakura House | The Waratah |
|---------|--------------|-------------|
| **Cell References** | Named ranges (`MONDAY_SR_NetRevenue`) | Hardcoded cells (`B34`) |
| **Operating Days** | 6 days (Mon-Sat) | 5 days (Wed-Sun) |
| **Weekly Rollover** | In-place system ✅ | In-place system ✅ |
| **Code Volume** | ~9,500 LOC (22 files) | ~9,700 LOC (22 files) |
| **Documentation** | `CLAUDE_SAKURA.md` | `CLAUDE_WARATAH.md` |
| **Status** | Production Ready ✅ | Production Ready ✅ |

---

## Common Operations

### For Sakura House:
- **Start with:** [`CLAUDE_SAKURA.md`](CLAUDE_SAKURA.md) - Production-ready system
- Deployment guide: [`DEPLOYMENT_GUIDE.md`](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/DEPLOYMENT_GUIDE.md)
- Testing rollover: [`ROLLOVER_TESTING_GUIDE.md`](SAKURA%20HOUSE/CODE_REVIEW_REPORTS_2026-02-16/ROLLOVER_TESTING_GUIDE.md)
- Fix missing named ranges: See [`CLAUDE_SAKURA.md`](CLAUDE_SAKURA.md#diagnostics--setup)

### For The Waratah:
- **Start with:** [`CLAUDE_WARATAH.md`](CLAUDE_WARATAH.md) (343 lines - quick reference with links)
- Update email recipients: See [`CLAUDE_WARATAH.md`](CLAUDE_WARATAH.md#script-properties)
- Test integrations: See [`CLAUDE_WARATAH.md`](CLAUDE_WARATAH.md#quick-operations)
- Task management deep dive: Load [`WORKFLOW_TASK_MANAGEMENT.md`](docs/_archive/WORKFLOW_TASK_MANAGEMENT.md) only when needed

### For Both Venues:
- Task management setup: See [`CLAUDE_SHARED.md`](CLAUDE_SHARED.md#1-enhanced-task-management-8-status-workflow)
- Slack integration: See [`CLAUDE_SHARED.md`](CLAUDE_SHARED.md#2-slack-block-kit-integration)
- PDF export: See [`CLAUDE_SHARED.md`](CLAUDE_SHARED.md#3-pdf-export--email-system)

---

## Agent Auto-Use Rules

Specialist agents live in `.claude/agents/`. Claude uses the Task tool to invoke them. The following rules apply to every session — no manual invocation needed when these conditions are met:

| Condition | Agent to invoke |
|-----------|----------------|
| Any `.gs` file edited | `gas-code-review-agent` before reporting work complete |
| Task touches both venues | `shift-report-orchestrator` first to parallelise |
| Rollover or trigger code changed | `rollover-trigger-agent` — never touch rollover without it |
| Slack notification added or changed | `slack-block-kit-agent` |
| Task management workflow changed | `task-management-agent` |
| Ready to `clasp push` | `deployment-agent` must run pre-deploy checklist first |
| Significant code change completed | `documentation-agent` to update relevant CLAUDE_*.md |
| External API integration needed | `external-integrations-agent` |

**Single entry point for non-trivial tasks:** describe the task to `shift-report-orchestrator` and it will route and parallelise automatically.

---

## Development Guidelines

**Before working on any code:**

1. **Identify the venue** - Sakura or Waratah?
2. **Read the appropriate guide** - Don't try to load everything at once
3. **Check shared patterns** - If working on common systems (tasks, Slack, PDF)
4. **Test on copies** - Never test destructive operations on production files
5. **NEVER use `sheet.clear()`** — destroys formatting. Use `Range.clearContent()` (singular) for ranges; `Sheet.clearContents()` (PLURAL) for sheets. `sheet.clearContent()` does NOT exist — TypeError.

**Git Repository & Deployment Workflow:**

The project is version-controlled at `https://github.com/thewaratah/pollenshiftreports.git` (branch: `main`, remote: `origin`).

`clasp push` and `git push` are **independent** and go to **different places:**
- `clasp push` deploys code to Google Apps Script (production runtime)
- `git push` commits to GitHub (version history only -- does not affect production)

Standard workflow: **edit code --> `clasp push` (deploy to Google) --> `git commit` + `git push` (save to GitHub)**

The `.gitignore` excludes: `_SETUP_*` files (contain Slack webhook secrets), `docs/_archive/`, `docs/_archive_analysis/`, `.clasp.json`, `.clasprc.json`, `.DS_Store`, `.claude/`, `node_modules/`, `.vscode/`, `.idea/`

---

## Quick Reference

**Admin Password:** Stored in Script Properties (secure configuration)

**Timezone:** Australia/Sydney

**Dependencies:**
- Google Sheets API (v4)
- Google Drive API (v3)
- Gmail API (v1)
- SlackBlockKit Library (v2)

---


**Last Updated:** March 12, 2026
**Status:** Both venues fully operational and production-ready ✅

**Recent Updates (Mar 12, 2026):**
- Sakura Task Mgmt: Sort/formatting overhaul — RECURRING moved to active, BLOCKED to inactive; priority row banding; Slack emoji to shortcodes; 15-col schema (Notes col O); STAFF_LIST updated (Ian out, Sabine/Kalisha in)
- Both venues: Fixed `fmtAUD()` NaN bug in nightly Slack export — `parseFloat(val)` returned NaN on display-formatted currency strings ("$1,234.50"); now strips non-numeric chars before parsing (NightlyExport files)
- Sakura SR Alignment Phases 0-4: notifyError_ utility, NIGHTLY_FINANCIAL 13->17 cols, rollover wizard UI, webhook TEST->LIVE, backfill trigger Mon 2am->8am (9 files, 1 new)
- Waratah SR Phase 0+1: 3 critical bug fixes + performance/code quality improvements (6 files, net -42 lines)
- Waratah: 6-tier manager-facing explainer docs added to `docs/waratah/explainers/`

**Deployment (Mar 6, 2026):**
- Waratah Shift Reports: 21 files pushed (NightlyExport.js + WeeklyRolloverInPlace.js hardened)
- Waratah Task Management: 8 files pushed (v1.2.0 restructure)

**Previous Deployment (Feb 28, 2026):**
- Sakura Shift Reports: 17 files pushed (NightlyBasicExportSakura.gs added; NIGHTLY_FINANCIAL schema 10→13 cols; rollover multi-sheet PDF + trigger safety; analytics fixes)

**💡 To avoid "prompt too long" errors:**
- Start with venue-specific quick references (CLAUDE_WARATAH.md or CLAUDE_SAKURA.md)
- Load detailed workflow/architecture docs only when you need implementation details
- The quick references link to all detailed docs on-demand
