# AnalyticsDashboard.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/AnalyticsDashboard.js`
**Type:** Dashboard builder (run once, then auto-updates)
**Run from:** Apps Script editor or custom menu

---

## What This File Does

This script builds two analytics tabs inside the Data Warehouse spreadsheet using live Google Sheets formulas. You run it once to set up the tabs — after that, the formulas automatically recalculate whenever new nightly export data arrives.

It reads from the `NIGHTLY_FINANCIAL` sheet (the raw data) and writes formatted formulas to two output tabs.

---

## The Three Functions

### 1. `buildFinancialDashboard()`
**Creates:** The `ANALYTICS` tab

Builds a complete financial analytics dashboard with five sections:

| Section | What It Shows |
|---------|--------------|
| **This Week Snapshot** | Revenue, covers, avg check, labor cost/%, tips, labor hours for the current week |
| **Week-over-Week** | Side-by-side comparison of this week vs last week, with $ and % change |
| **Day-of-Week Averages** | Average revenue, covers, check, labor %, RevPAH for each day (Wed-Sun) across all time |
| **Weekly Trend** | QUERY formula listing every week's totals in descending order (columns I-O) |

Also applies:
- Conditional formatting (green for positive changes, red for negative)
- Number formatting (currency, percentages, decimals)
- Column widths and frozen header rows

### 2. `buildExecutiveDashboard()`
**Creates:** The `EXECUTIVE_DASHBOARD` tab

A higher-level view designed for ownership review:

| Section | What It Shows |
|---------|--------------|
| **Current Month** | Month-to-date revenue, covers, tips, shifts, labor % |
| **Monthly Trend** | QUERY grouping all data by year/month |
| **Rolling 4-Week Comparison** | Last 4 weeks side-by-side with week-over-week $ and % changes |
| **Top MOD Performance** | Manager-on-duty ranked by average revenue (right side, column H) |
| **Revenue by Day Ranked** | Which day of the week performs best on average |

### 3. `_sectionHeader_(sheet, row, title)`
**Helper function** — writes a blue, bold section title merged across 6 columns. Used internally by both dashboard builders.

---

## Data Source

All formulas reference the `NIGHTLY_FINANCIAL` sheet with this 16-column schema:

| Column | Field | Column | Field |
|--------|-------|--------|-------|
| A | Date | I | Tips Total |
| B | Day | J | Labor Hours |
| C | Week Ending | K | Labor Cost |
| D | MOD | L | Covers |
| E | Revenue | M | Avg Check |
| F | Cash Total | N | Labor % |
| G | Cash Tips | O | RevPAH |
| H | Card Total | P | Logged At |

---

## When Would You Need This File?

- **Initial setup** — Run both functions once when first setting up the Data Warehouse
- **After schema changes** — If columns are added/removed from NIGHTLY_FINANCIAL, formulas here need updating
- **Rebuilding a dashboard** — Safe to re-run anytime; it clears and rebuilds from scratch

---

## Important Notes

- Both functions are **idempotent** — re-running them clears the tab and rebuilds it cleanly
- The dashboards use **live formulas**, not static values. Data refreshes automatically as new rows are added to NIGHTLY_FINANCIAL.
- The MOD Performance section was removed from the ANALYTICS tab (user deleted those rows in Feb 2026). It only exists on the EXECUTIVE_DASHBOARD tab.
