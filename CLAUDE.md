# SHIFT REPORTS 3.0 - Navigation Guide

**Last Updated:** March 22, 2026
**Project Type:** Google Apps Script (Multi-Venue Hospitality Management System)
**Venues:** Sakura House, The Waratah

---

## Agent Auto-Routing Rules

**Claude must follow these dispatch rules automatically — no user prompt required.**

### Pipeline commands (preferred — run the full chain)

| Command | What it does |
|---------|-------------|
| `/saks [task]` | **Full Sakura pipeline:** scope → sakura-gas-agent (+extras in parallel) → gas-code-review-agent → documentation-agent → deployment-agent + Drive sync |
| `/tah [task]` | **Full Waratah pipeline:** scope → waratah-gas-agent (+extras in parallel) → gas-code-review-agent → documentation-agent → deployment-agent + Drive sync |
| `/orchestrate [task]` | **Both venues in parallel:** orchestrator dispatches `/saks` + `/tah` streams simultaneously; use for cross-venue features |

### Single-agent commands (use when you need one step only)

| Command | Agent dispatched | When to use |
|---------|-----------------|-------------|
| `/sakura [task]` | `sakura-gas-agent` | Code-only investigation or quick fix — no review/deploy needed |
| `/waratah [task]` | `waratah-gas-agent` | Code-only investigation or quick fix — no review/deploy needed |
| `/review [files]` | `gas-code-review-agent` | Review already-written code before deploy |
| `/deploy [venue]` | `deployment-agent` | Deploy code that has already been reviewed and documented |
| `/docs [what changed]` | `documentation-agent` | Update docs without deploying |
| `/plan [feature]` | `shift-report-orchestrator` | Plan only — no code written |
| `/rollover [task]` | `rollover-trigger-agent` | Rollover/trigger management |
| `/slack [task]` | `slack-block-kit-agent` | Block Kit design or webhook debug |

### Auto-routing (triggered without slash commands)

| Trigger | Agent to dispatch |
|---------|------------------|
| Task touching Sakura files only | `/saks` pipeline |
| Task touching Waratah files only | `/tah` pipeline |
| Task spans both venues | `/orchestrate` → parallelises `/saks` + `/tah` |
| Any code change >5 lines | `gas-code-review-agent` (auto, before deploy) |
| Before any `clasp push` | `documentation-agent` first, then `deployment-agent` |
| Rollover / trigger create / remove / schedule | `rollover-trigger-agent` |
| Slack Block Kit design or webhook debug | `slack-block-kit-agent` |
| Doc update only (no code) | `documentation-agent` |
| Claude API via UrlFetchApp | `claude-api-agent` |
| Warehouse queries / backfill / analytics | `data-warehouse-agent` |
| Deputy API / OAuth2 / external REST | `external-integrations-agent` |
| Task management 8-status workflow | `task-management-agent` |

### Pipeline architecture (`/saks` and `/tah`)

```
Phase 0 — Scope analysis (inline, no agent)
  ↓ classifies: code change / docs only / deploy only
  ↓ identifies extra agents needed (rollover, Slack, task mgmt, warehouse)

Phase 1 — Implementation  ←── PARALLEL
  sakura-gas-agent (or waratah-gas-agent)
  + rollover-trigger-agent   (if rollover/trigger changes)
  + slack-block-kit-agent    (if Slack notification changes)
  + task-management-agent    (if 8-status workflow changes)
  + data-warehouse-agent     (if warehouse schema changes)

Phase 2 — Review  ←── sequential (waits for Phase 1)
  gas-code-review-agent
  → if blocking issues: re-dispatch venue agent → re-review (loop until CLEAR TO DEPLOY)

Phase 3 — Documentation  ←── sequential (waits for CLEAR TO DEPLOY)
  documentation-agent
  → updates CLAUDE_*.md + docs/sakura/ or docs/waratah/ + FILE EXPLAINERS/

Phase 4 — Deployment  ←── sequential (waits for Phase 3)
  deployment-agent
  → clasp push → git commit → sync-explainers-to-drive.js
```

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
- Named range system active (`WEDNESDAY_SR_NetRevenue`) via `RunWaratah.js` — fallback to hardcoded cells
- In-place weekly rollover ✅
- 5-day operation (Wed-Sun)

**Deep Dive (Load Only When Needed):**
- 📋 Task Management: [`WORKFLOW_TASK_MANAGEMENT.md`](docs/_archive/WORKFLOW_TASK_MANAGEMENT.md) (866 lines - detailed backend flows)
- 📋 Shift Reports: [`WORKFLOW_SHIFT_REPORTS.md`](WORKFLOW_SHIFT_REPORTS.md) (updated Mar 6)
- 🏗️ Architecture: [`docs/waratah/DEEP_DIVE_ARCHITECTURE.md`](docs/waratah/DEEP_DIVE_ARCHITECTURE.md)
- 🔌 Integrations: [`docs/waratah/INTEGRATION_FLOWS.md`](docs/waratah/INTEGRATION_FLOWS.md)
- 📖 Manager Explainers: [`docs/waratah/explainers/`](docs/waratah/explainers/) (6-tier: Basic/Intermediate/Advanced for Shift Reports + Task Mgmt)

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
│   ├── plans/                        # Implementation plans
│   └── waratah/
│       └── explainers/              # 6-tier manager-facing explainers (Shift Reports + Task Mgmt)
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
| **Cell References** | Named ranges (`MONDAY_SR_NetRevenue`) | Named ranges (`WEDNESDAY_SR_NetRevenue`) — fallback to hardcoded |
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

**Git Branching (Venue Independence):**

```
main                          ← stable, merged code only
├── sakura/develop            ← ongoing Sakura House work
└── waratah/develop           ← ongoing Waratah work
```

- **`main`** — receives merges only; never commit directly
- **`sakura/develop`** — all Sakura House development; `clasp push` from `SAKURA HOUSE/` directories
- **`waratah/develop`** — all Waratah development; `clasp push` from `THE WARATAH/` directories
- **Feature branches** — for larger changes, branch off the venue branch: `sakura/fix-rollover`, `waratah/add-dashboard`
- **Shared file edits** (CLAUDE.md, docs/, FILE EXPLAINERS/) — commit on whichever venue branch you're on; then **immediately cross-merge** into the other venue branch to keep them in sync
- **Cross-merge rule (CRITICAL):** After any commit to `waratah/develop` that touches shared files, run: `git checkout sakura/develop && git merge waratah/develop`. And vice versa. Never let the branches diverge on shared files.
- **Merging to main** — when a venue branch is stable: `git checkout main && git merge sakura/develop && git push`
- **Check for drift:** Before starting any session, run `git log --oneline waratah/develop ^sakura/develop` and `git log --oneline sakura/develop ^waratah/develop` — if either has commits the other doesn't, merge immediately before doing any work.

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

**Last Updated:** April 2, 2026 (Dashboard layout cleanup, analytics consolidation, date handling, task management)
**Status:** Both venues fully operational and production-ready ✅

**Deployment (Apr 2, 2026) — Sakura Analytics Dashboard Layout Cleanup:**
- Sakura: EXECUTIVE_DASHBOARD — removed TOP MOD PERFORMANCE section (Section 5)
- Sakura: Dashboard layout compression — empty spacer rows removed between sections; all cell references dynamically computed instead of hardcoded
- Sakura: ANALYTICS tab — THIS WEEK starts row 3, WoW starts row 8, DoW heatmap starts row 15, Extended Trends starts row 25; Weekly Trend (right side) starts row 3
- Sakura: EXECUTIVE_DASHBOARD tab — CURRENT MONTH starts row 3, MONTHLY TREND starts row 9, ROLLING 4-WEEK starts row 24; REVENUE BY DAY (right side) starts row 3
- Sakura: Code refactor — `modCol` renamed to `rightCol` in dashboard builders

**Deployment (Apr 2, 2026) — Sakura Analytics Dashboard Consolidation & QUERY MONTH() Fix:**
- Sakura: Menu consolidation — removed separate "Build Analytics Dashboard" and "Build Executive Dashboard" items under `Shift Report > Admin Tools > Integrations & Analytics`
- Sakura: Added single consolidated menu item "Rebuild All Dashboards (Admin)" — calls new `rebuildAllDashboards()` function that invokes both `buildFinancialDashboard()` and `buildExecutiveDashboard()` sequentially
- Sakura: `UIServerSakura.gs` `refreshDashboard()` updated to call both dashboard builders (previously only called the former)
- Sakura: `AnalyticsDashboardSakura.gs` file header comment updated to reflect 16-column NIGHTLY_FINANCIAL schema (deleted redundant column J)
- Sakura: Old wrappers `pw_buildFinancialDashboard()` and `pw_buildExecutiveDashboard()` retained in `MenuSakura.gs` for backward compatibility (no longer wired to menu items)
- **Sakura: Fixed Monthly Trend QUERY month display** — Google Sheets QUERY language `MONTH()` is 0-indexed (Jan=0, Dec=11), unlike spreadsheet formulas which are 1-indexed. Executive Dashboard Monthly Trend now uses `YEAR(A)*100+(MONTH(A)+1)` in SELECT, GROUP BY, ORDER BY, and LABEL to show correct months (2026/04 for April, not 2026/03). Number format `0000"/"00` renders output as "2026/04".
- Documentation: CLAUDE_SAKURA.md, docs/sakura/DEEP_DIVE_ARCHITECTURE_SAKURA.md, SAKURA HOUSE/FILE EXPLAINERS/3_WEEKLY_AUTOMATED_EVENTS.md, CLAUDE_SHARED.md updated

**Deployment (Apr 2, 2026) — Task Management Restructuring:**
- Both venues: `sendOverdueTasksSummary_()` removed from daily task maintenance; no longer posts overdue summaries to Slack
- Both venues: `sendWeeklyActiveTasksSummary()` changed to DM-only (no longer posts to managers channel)
- Waratah: `runScheduledOverdueSummary()` trigger (Sun 9am) gutted to no-op; kept for backward compatibility but does nothing
- Sakura: Daily `runDailyTaskMaintenance()` trigger updated (removed overdue summary call)
- Sakura: FOH leads summary (`sendWeeklyFohLeadsSummary_Live()` and `_sendWeeklyFohLeadsSummary_()`) removed; #sakura_foh_leads channel post discontinued
- Both venues: Menu items "Send Overdue Summary Now" and "Create Overdue Summary Trigger" removed
- Documentation: CLAUDE_SHARED.md, CLAUDE_SAKURA.md, CLAUDE_WARATAH.md updated; FILE EXPLAINERS task management sections refreshed

**Deployment (Apr 2, 2026) — Warehouse Date Fix:**
- **Root cause identified:** Sakura shift report spreadsheet locale was set to US (not Australia) — caused GAS to interpret dates as mm/dd/yyyy instead of dd/mm/yyyy (e.g., April 1 read as January 4; day-of-week columns showed "Sunday" instead of "Wednesday")
- **Spreadsheet locale fix (manual):** Changed Sakura shift report AND data warehouse spreadsheets to Australia locale (File → Settings → Locale) — April 2, 2026
- Both venues: `parseCellDate_()` fallback hardened — replaced `new Date(str)` with `new Date('')` to prevent US-format misparse of AU dd/mm/yyyy dates; Logger.log warning added
- Both venues: New `toDateOnly_(d)` helper — strips time component from dates before warehouse writes; guards against Invalid Date input
- Both venues: All `appendRow()` calls in `logToDataWarehouse_()` now wrap `shiftData.date` and `shiftData.weekEnding` with `toDateOnly_()` — NIGHTLY_FINANCIAL, OPERATIONAL_EVENTS, WASTAGE_COMPS, QUALITATIVE_NOTES
- **Sakura schema change:** NIGHTLY_FINANCIAL column J "Total Tips" deleted (redundant with H "Tips Total" from cell C32); schema now 16 columns (A-P) after March 6's expansion to 17 columns minus deleted J
- Manual action required: Fix the `1/4/2026 19:00:00` row in NIGHTLY_FINANCIAL — correct to April 1, 2026 with no time component

**Deployment (Mar 22, 2026) — AI Insights Refinement:**
- Sakura: M4 discount impact metrics added to `computeShiftAnalytics_Sakura()` — discounts/netRevenue today vs 8w avg; M5 prompt enriched with confidence qualifier, 4-week benchmarks, discount rates, signed WoW delta, compact anomaly format with z-scores, truncation standardized to 200 chars (matches Waratah); Slack title `*Sakura House Analytics Insights*`; all numeric returns standardized to `parseFloat(x.toFixed(2))`
- Waratah: M4 trend threshold unified to dynamic 0.5% of 8w mean (replaces fixed $50); Slack title `*The Waratah Analytics Insights*`; all numeric returns standardized to `parseFloat(x.toFixed(2))`
- Both venues: AI insights prompts now symmetrical — confidence qualifier, 4-week benchmarks, discount metrics, compact anomaly format, signed WoW; venues now have parity in analytics depth

**Deployment (Mar 18, 2026) — Sakura Shift Reports:**
- Sakura: M4–M7 AI Insights Agent upgrade — `computeShiftAnalytics_Sakura()` (4-week/8-week averages, z-score anomalies), `generateShiftInsight_Sakura()` (PERFORMANCE/TREND/ACTION format), `deliverAIInsights_Sakura()` (evan_only soft launch routing), `logInsightToWarehouse_Sakura()` (AI_INSIGHTS_LOG sheet); NightlyExportSakura rewired with try/catch fallback to M1 generic summary; new Script Properties AI_INSIGHTS_MODE, AI_INSIGHTS_EVAN_EMAIL
- Sakura: M1 AI Shift Summarisation — new `AIInsightsSakura.gs` (`generateShiftSummary_Sakura()`), Claude Haiku, non-blocking; integrated into Slack BK and email body in `NightlyExportSakura.gs`
- Sakura: M2 Revenue Anomaly Detection — `detectRevenueAnomalies_Sakura()` flags >2σ deviations, posts to test Slack channel, wired into IntegrationHub after financialLogged check
- Sakura: M3 AI Task Classification — `classifyTask_Sakura()` auto-classifies tasks with priority (High/Medium/Low) and area (FOH/BOH/Kitchen/Admin) when pushed to Master Actionables; wired into TaskIntegrationSakura.gs
- Sakura: M5 Shift Input Validation — `validateShiftBeforeExport_Sakura()` blocks export if MOD empty or revenue zero; warns if notes/task assignments missing; non-blocking; wired into UIServerSakura.gs
- Sakura: M7 Extended Analytics Trends — `buildExtendedTrends_Sakura()` adds 13-week rolling average, 26-week rolling average, day-of-week heatmap, YTD aggregation to AnalyticsDashboardSakura.gs; auto-builds on first warehouse write
- Sakura: M8 Task SLA Tracking — `buildSLASection_()` + `sendWeeklySLASummary_Sakura()` in TaskDashboard_Sakura.gs tracks due dates, days open, escalation time; weekly summary posts to TEST webhook
- Sakura: M9 Named Range Health Monitor — `namedRangeHealthCheck_Sakura()` in RunSakura.gs + `pw_namedRangeHealthCheck_Sakura()` wrapper in MenuSakura.gs; Step 10 of rollover validates + repairs named ranges; fixes stale ranges silently
- Sakura: New Script Property `ANTHROPIC_API_KEY` required for M1/M2/M3 AI features (optional — AI skipped gracefully if not set)
- Sakura: S1-S9 small items verified complete — trigger setup, post-rollover validation, onOpen trigger check, LockService skipLock, todo dedup, analytics auto-build, pipeline learning
- Sakura: Fixed P1 bug — `createRolloverTrigger_Sakura()` and `removeRolloverTrigger_Sakura()` added to `MenuSakura.gs` (were referenced by menu items but not implemented)
- Sakura: Fixed FILE EXPLAINERS — "Backfill Entire Week to Warehouse" menu path corrected to "Backfill This Sheet to Warehouse" in `WEEKLY_AUTOMATED_EVENTS.md` and `CONFIGURATION_REFERENCE.md`
- Sakura: 21 files changed (M1-M9 + S1-S9 integration); clasp pushed to Google Apps Script

**Deployment (Mar 18, 2026) — Waratah Shift Reports & Task Management:**
- Waratah SR: M4–M7 AI Insights Agent upgrade — `computeShiftAnalytics_Waratah()` (4w/8w trailing averages, ww delta, linear regression trend, discount impact, anomaly z-scores, best/worst comparables), `generateShiftInsight_Waratah()` (PERFORMANCE/TREND/ACTION output format with pre-computed metrics), `deliverAIInsights_Waratah()` (evan_only soft launch routing), `logInsightToWarehouse_Waratah()` (AI_INSIGHTS_LOG auto-creates); NightlyExport rewired email + Slack paths (lines 224–262, 829–862); new Script Properties AI_INSIGHTS_MODE ('evan_only' | 'live'), AI_INSIGHTS_EVAN_EMAIL; Waratah-specific discount impact metric (TotalDiscount/GrossSalesIncCash vs trailing avg) in analytics; total 21 Script Properties
- Waratah SR: Full M2/M3/M5/M7/M8/M9 implementation — revenue anomaly detection, AI task classification, shift input validation, extended analytics trends, task SLA tracking, named range health monitor
- Waratah SR M2: `detectRevenueAnomalies_Waratah()` — flags >2σ revenue deviations, posts to test Slack channel on anomaly, wired into IntegrationHub after financialLogged check
- Waratah SR M3: `classifyTask_Waratah()` — auto-classifies tasks with priority (High/Medium/Low) and area (FOH/BOH/Kitchen/Admin) when pushed to Master Actionables, wired into NightlyExport pushTodosDirectToMasterActionables_
- Waratah SR M5: `validateShiftBeforeExport_Waratah()` — blocks export if MOD empty or revenue is zero; warns if notes or task assignments missing; non-blocking; wired into UIServer.js
- Waratah SR M7: `buildExtendedTrends_Waratah()` — new analytics dashboard features: 13-week rolling average, 26-week rolling average, day-of-week heatmap, year-to-date aggregation; auto-builds in AnalyticsDashboard
- Waratah TM M8: `buildSLASection_()` + `sendWeeklySLASummary_Waratah()` — task SLA tracking (due dates, days open, escalation time); weekly summary posts to TEST webhook (switch to LIVE after review); TaskDashboardWaratah.gs
- Waratah SR M9: `namedRangeHealthCheck_Waratah()` in RunWaratah.js + `pw_namedRangeHealthCheck_Waratah()` wrapper in Menu.js — Step 9 of rollover validates named range integrity; fixes stale ranges silently
- Waratah: S1-S9 all verified complete; M1 AI shift summaries + M4-M7 analytics upgrade operational; 11 SR files + 2 TM files changed; clasp pushed to Google Apps Script

**Recent Updates (Apr 2, 2026):**
- Sakura: Dashboard layout cleanup — TOP MOD PERFORMANCE section removed; empty spacer rows eliminated; all cell references now dynamic; Extended Trends moved to row 25
- Sakura: Menu consolidation — single "Rebuild All Dashboards (Admin)" replaces separate builder menu items; dashboard auto-builds on demand
- Both venues: Task management — overdue summaries removed from daily maintenance; weekly active task summary changed to DM-only (no channel post)

**Recent Updates (Mar 22, 2026):**
- Both venues: AI Insights parity achieved — M4 discount impact (Sakura added; Waratah unified to 0.5% threshold), M5 prompt enriched (confidence qualifier, 4-week benchmarks, discount rates, signed WoW delta, compact anomaly format, 200 char truncation), Slack titles venue-specific

**Recent Updates (Mar 18, 2026):**
- Sakura: M4–M7 AI Insights Agent upgrade — analytics engine, structured insight generation, soft launch routing, insight warehouse logging; new Script Properties AI_INSIGHTS_MODE and AI_INSIGHTS_EVAN_EMAIL
- Sakura: M2–M9 full implementation — revenue anomaly detection, AI task classification, shift input validation, extended analytics trends, task SLA tracking, named range health monitor
- Waratah: Named range system active; M1 AI shift summaries + M4-M7 analytics upgrade operational

**Recent Updates (Mar 6, 2026):**
- Waratah SR Phase 0+1: 3 critical bug fixes + performance/code quality improvements (6 files, net -42 lines)
- Both venues: Git branching strategy documented in CLAUDE.md (main, sakura/develop, waratah/develop)
- Waratah: Task Management v1.2.0 — sort order, daily maintenance decomposed, 6 menu items removed, bug fixes
- Waratah: Data warehouse schema overhaul — NIGHTLY_FINANCIAL 22 cols; covers/labor/avgCheck removed; full B5-B29 financial breakdown added

**Deployment (Mar 6, 2026):**
- Waratah Shift Reports Phase 0+1: 6 files (IntegrationHub, NightlyExport, SlackBlockKit, UIServer, WeeklyDigest, WeeklyRollover)
- Waratah Shift Reports: 21 files pushed (NightlyExport.js + WeeklyRolloverInPlace.js hardened)
- Waratah Task Management: 8 files pushed (v1.2.0 restructure)

**Previous Deployment (Feb 28, 2026):**
- Sakura Shift Reports: 17 files pushed (NightlyBasicExportSakura.gs added; NIGHTLY_FINANCIAL schema 10→13 cols; rollover multi-sheet PDF + trigger safety; analytics fixes)

**💡 To avoid "prompt too long" errors:**
- Start with venue-specific quick references (CLAUDE_WARATAH.md or CLAUDE_SAKURA.md)
- Load detailed workflow/architecture docs only when you need implementation details
- The quick references link to all detailed docs on-demand
