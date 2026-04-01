---
title: Update Waratah Explainer Documentation (01-06)
type: docs
date: 2026-03-07
venue: Waratah
---

# Update Waratah Explainer Documentation (01-06)

## Overview

Six manager-facing explainer documents live in `docs/waratah/explainers/` as `.docx` files. They were last updated March 6, 2026. Several code changes have since shipped that make parts of the docs inaccurate. Additionally, all em dashes need replacing per style rules.

**Files:**
1. `waratah-01-basic-shift-report-guide.docx` - Daily shift report walkthrough for managers
2. `waratah-02-intermediate-how-the-system-works.docx` - Behind-the-scenes explanation
3. `waratah-03-advanced-backend-reference.docx` - Full technical backend reference
4. `waratah-04-basic-task-management-guide.docx` - Task management walkthrough
5. `waratah-05-intermediate-task-management-system.docx` - Task management behind the scenes
6. `waratah-06-advanced-task-management-backend.docx` - Task management backend reference

**Constraints:**
- Files are binary `.docx` - cannot be edited with text editors
- User rule #1: **No em dashes** (replace `—` with ` - ` or restructure sentence)
- User rule #2: **Use existing formatting on Google Docs** (these live on Google Docs; `.docx` files are exports)

## Approach

Since these files live on Google Docs and the `.docx` copies are exports, the deliverable is a **precise change list per document** that the user applies in Google Docs, preserving all existing formatting. This avoids binary file manipulation and respects the Google Docs source of truth.

Alternative: Use `python-docx` to programmatically edit the `.docx` files. But this risks corrupting Google Docs formatting (styles, fonts, spacing, headers). **Not recommended.**

---

## Change List by Document

### Doc 01: Basic Shift Report Guide (11 em dashes, 2 en dashes)

**Em dash replacements (11 instances):**

| Location | Current text | Replace with |
|----------|-------------|--------------|
| Subtitle line | `Level 01 — Basic` | `Level 01 - Basic` |
| Tab description | `you'll see tabs across the bottom — one for each` | `you'll see tabs across the bottom. One for each` |
| Financial section | `discounts, refunds, etc.) — enter the values` | `discounts, refunds, etc.). Enter the values` |
| Narrative intro | `Write what happened tonight — be concise` | `Write what happened tonight. Be concise` |
| Wastage field | `Wastage/comps — Record any wastage` | `Wastage/comps: Record any wastage` |
| RSA field | `RSA incidents — Record any Responsible` | `RSA incidents: Record any Responsible` |
| Confirmation box | `tonight's sheet name — click Yes` | `tonight's sheet name. Click Yes` |
| Checklist dialog | `A checklist dialog appears — tick Deputy` | `A checklist dialog appears. Tick Deputy` |
| Success message | `Wait for the green success message — it takes` | `Wait for the green success message. It takes` |
| Final line | `Done — go home.` | `Done. Go home.` |

**En dash replacements (2 instances):**

| Location | Current text | Replace with |
|----------|-------------|--------------|
| Shift summary | `2–3 sentences` | `2-3 sentences` |
| Timer estimate | `10–15 seconds` | `10-15 seconds` |

**Content updates: None required** - Doc 01 is a user-facing workflow guide with no technical details that changed.

**Date update:** Change "Last Updated: March 6, 2026" to "Last Updated: March 7, 2026"

---

### Doc 02: Intermediate - How the System Works (18 em dashes)

**Em dash replacements (18 instances):**

| Location | Current text | Replace with |
|----------|-------------|--------------|
| Subtitle | `Level 02 — Intermediate` | `Level 02 - Intermediate` |
| Warehouse step | `saves the data to the Data Warehouse — a separate` | `saves the data to the Data Warehouse, a separate` |
| Task push | `copied to the Master Actionables spreadsheet — a separate` | `copied to the Master Actionables spreadsheet, a separate` |
| Error step | (error notification description with em dash) | Replace with period or comma |
| Nightly timer | `Automatic timer — no one presses anything` | `Automatic timer. No one presses anything` |
| Rollover step 1 | `Safety check — verifies` | `Safety check: verifies` |
| Rollover step 2 | `Generate week summary — reads` | `Generate week summary: reads` |
| Rollover step 3 | `Archive as PDF — saved to` | `Archive as PDF: saved to` |
| Rollover step 4 | `Archive as spreadsheet copy — full copy` | `Archive as spreadsheet copy: full copy` |
| Rollover step 5 | `Clear all data — every data` | `Clear all data: every data` |
| Rollover step 6 | `Update dates — each tab` | `Update dates: each tab` |
| Rollover step 7 | `Notify the team — email to all` | `Notify the team: email to all` |
| Backfill description | (safety net description with em dash) | Replace with period |
| Tell Evan | `Tell Evan — he can check` | `Tell Evan. He can check` |
| Don't fix | `Don't try to fix it yourself — the formula` | `Don't try to fix it yourself. The formula` |
| MOD definition | `Manager on Duty — whoever ran` | `Manager on Duty: whoever ran` |
| Block Kit definition | `formatting system used for Slack messages — makes them` | `formatting system used for Slack messages. Makes them` |

**Content accuracy checks:**

| Item | Doc says | Actual | Action |
|------|----------|--------|--------|
| Nightly export steps | "9 steps" | Verify - may still be 9 | **Verify against code** |
| Email recipients | "all 7 recipients" | 7 confirmed (Evan, Cynthia, Dipti, Chef, Howie, Adam, Lily) | **Correct** |
| Weekly backfill | "Wednesday at 2am" | Code confirms "Wednesday at 2am" | **Correct** |
| NIGHTLY_FINANCIAL | "22 columns" | 22 columns A-V confirmed | **Correct** |
| Archive path format | `Archive > 2026 > 2026-03 > pdfs > Waratah_Shift_Report_WE_DD.MM.YYYY.pdf` | Verify format | **Verify** |

**Date update:** March 6 -> March 7, 2026

---

### Doc 03: Advanced Backend Reference (20 em dashes)

**Em dash replacements (20 instances):**

| Location | Current text | Replace with |
|----------|-------------|--------------|
| Subtitle | `Level 03 — Advanced` | `Level 03 - Advanced` |
| Setup note | `Contains webhook secrets — excluded from version control` | `Contains webhook secrets. Excluded from version control` |
| VenueConfig dep | `VenueConfig.js — every file that reads` | `VenueConfig.js: every file that reads` |
| SlackBlockKit dep | `SlackBlockKitWaratahSR.js — every file that posts` | `SlackBlockKitWaratahSR.js: every file that posts` |
| IntegrationHub dep | (with em dash) | Replace with colon |
| TaskIntegration dep | (with em dash) | Replace with colon |
| Menu dep | `Menu.js — calls functions` | `Menu.js: calls functions` |
| NightlyExport header | `NightlyExport.js — Daily Export Functions` | `NightlyExport.js: Daily Export Functions` |
| IntegrationHub header | `IntegrationHub.js — Data Warehouse Functions` | `IntegrationHub.js: Data Warehouse Functions` |
| Rollover header | `WeeklyRolloverInPlace.js — Rollover Functions` | `WeeklyRolloverInPlace.js: Rollover Functions` |
| Formula cells (x6) | `FORMULA — do not edit` / `FORMULA — do not clear` | `FORMULA - do not edit` / `FORMULA - do not clear` |
| VENUE_NAME | `Set to "WARATAH" — used to load` | `Set to "WARATAH". Used to load` |
| Merged cells note | (merged cell description with em dash) | Replace with period |

**Content accuracy checks:**

| Item | Doc says | Actual | Action |
|------|----------|--------|--------|
| File count | "16 JS + 4 HTML" | 11 production JS + 4 HTML = 15 files (excluding _SETUP, TEST, Diagnose) | **Update if doc counts TEST/SETUP** |
| LOC | "~6,200 lines" | 5,342 (production only) or ~6,300 including test/setup | **Verify which files doc counts** |
| NIGHTLY_FINANCIAL schema | 22 cols A-V | Confirmed correct | **Correct** |
| Cell reference map | Full B3-B34 map | Verify all cells match VenueConfig.js | **Cross-check** |
| CLEARABLE_FIELDS | Lists what gets cleared | Must use A##:F## for merged narrative fields | **Verify includes fmtAUD fix context** |
| fmtAUD function | May describe old parseFloat behavior | Now strips `$` and `,` before parsing | **Add note about currency string handling** |

**Date update:** March 6 -> March 7, 2026

---

### Doc 04: Basic Task Management Guide (0 em dashes)

**Em dash replacements: None needed.**

**Content accuracy checks:**

| Item | Check | Action |
|------|-------|--------|
| Menu items | v1.2.0 removed 6 menu items | **Verify doc matches current menu** |
| Status workflow | 8 statuses | **Verify doc lists correct statuses** |
| Sort order | v1.2.0 changed sort order | **Verify doc describes current sort** |

**Date update:** March 6 -> March 7, 2026

---

### Doc 05: Intermediate Task Management System (0 em dashes)

**Em dash replacements: None needed.**

**Content accuracy checks:**

| Item | Check | Action |
|------|-------|--------|
| Daily maintenance | v1.2.0 decomposed daily maintenance | **Verify doc describes current behavior** |
| Auto-escalation timing | Check escalation rules | **Verify timing matches code** |
| Recurring task behavior | Check recurrence logic | **Verify against code** |

**Date update:** March 6 -> March 7, 2026

---

### Doc 06: Advanced Task Management Backend (0 em dashes)

**Em dash replacements: None needed.**

**Content accuracy checks:**

| Item | Check | Action |
|------|-------|--------|
| File inventory | 6 .gs + 1 .html | Confirmed: 6 .gs + 1 .html (3,689 LOC) | **Correct** |
| Function reference | Complete list | **Verify against current code, especially v1.2.0 changes** |
| Column positions | Task sheet columns | **Verify match current code** |
| Menu structure | v1.2.0 removed 6 items | **Update to reflect current menu** |

**Date update:** March 6 -> March 7, 2026

---

## Execution Plan

### Phase 1: Generate exact change instructions
1. For each doc (01-06), produce a numbered list of find-and-replace operations
2. Each entry: exact current text -> exact replacement text
3. Group by: em dash fixes, then content accuracy fixes

### Phase 2: User applies in Google Docs
1. User opens each doc in Google Docs
2. Uses Find & Replace (Ctrl+H) for bulk em dash changes
3. Manually updates content accuracy items
4. Updates "Last Updated" date

### Phase 3: Re-export .docx
1. User downloads updated Google Docs as .docx
2. Replaces files in `docs/waratah/explainers/`
3. Git commit

## Summary

| Doc | Em dashes | En dashes | Content fixes | Effort |
|-----|-----------|-----------|--------------|--------|
| 01 - Basic SR | 11 | 2 | 0 | Low |
| 02 - Intermediate SR | 18 | 0 | 2-3 verify | Medium |
| 03 - Advanced SR | 20 | 0 | 5-6 verify/update | High |
| 04 - Basic TM | 0 | 0 | 2-3 verify (v1.2.0) | Medium |
| 05 - Intermediate TM | 0 | 0 | 2-3 verify | Medium |
| 06 - Advanced TM | 0 | 0 | 3-4 verify (v1.2.0) | Medium |
| **Total** | **49** | **2** | **~15 items** | |

## Acceptance Criteria

- [ ] All 49 em dashes replaced across docs 01-03
- [ ] All 2 en dashes replaced in doc 01
- [ ] "Last Updated" date set to March 7, 2026 on all 6 docs
- [ ] Task Management docs (04-06) reflect v1.2.0 changes (menu items removed, sort order, daily maintenance)
- [ ] Doc 03 backend reference accurately reflects current file inventory and LOC
- [ ] Doc 03 notes fmtAUD currency parsing fix
- [ ] All changes applied in Google Docs preserving existing formatting
- [ ] Updated .docx files re-exported and committed to git
