# Menu.js

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/Menu.js`
**Type:** Custom menu builder + password gate
**Runs automatically:** Every time the spreadsheet is opened (`onOpen`)

---

## What This File Does

This file creates the "Waratah Tools" dropdown menu at the top of the spreadsheet and controls admin password protection. It's the single entry point for all user-facing actions in the system.

---

## Menu Structure

```
Waratah Tools
├── Daily Reports                          (no password)
│   ├── Export & Email PDF (LIVE)
│   ├── Export & Email (TEST to me)
│   ├── Send Basic Report
│   └── Open Export Dashboard
│
└── Admin Tools                            (password required)
    ├── Weekly Reports
    │   ├── Weekly To-Do Summary (LIVE)
    │   ├── Weekly To-Do Summary (TEST to me)
    │   └── Weekly Rollover (In-Place)
    │       ├── Run Rollover Now
    │       ├── Preview Rollover (Dry Run)
    │       ├── Create Rollover Trigger
    │       └── Remove Rollover Trigger
    │
    ├── Weekly Digest
    │   ├── Send Revenue Digest (LIVE)
    │   ├── Send Revenue Digest (TEST)
    │   └── Setup Wednesday Digest Trigger
    │
    ├── Analytics
    │   ├── Build Financial Dashboard
    │   ├── Build Executive Dashboard
    │   └── Open Analytics Viewer
    │
    ├── Data Warehouse
    │   ├── Backfill This Sheet to Warehouse
    │   ├── Show Integration Log (Last 30 Days)
    │   └── Setup Weekly Backfill Trigger
    │
    └── Setup & Utilities
        ├── Fix Tab Names & Date Format (One-Off)
        └── Backfill TO-DOs (All Days)
```

---

## Key Functions

### `onOpen()`
Runs automatically when the spreadsheet opens. Builds the entire menu tree. Wrapped in try/catch — if it fails, it sends an error notification to Slack so you know the menu didn't load.

### `onInstall(e)`
Calls `onOpen()`. Only needed if the script is deployed as a Sheets add-on.

### `requirePassword_()`
Prompts the user for the admin password (stored in Script Properties as `MENU_PASSWORD`). Returns `true` if correct, `false` if wrong or cancelled.

### `pw_*()` wrapper functions
Every admin action has a `pw_` wrapper that calls `requirePassword_()` first. For example:
- `pw_performWeeklyRollover()` — checks password, then calls `performWeeklyRollover()`
- `pw_buildFinancialDashboard()` — checks password, then calls `buildFinancialDashboard()`

This pattern keeps the password gate consistent without modifying the actual functions.

---

## Two Access Levels

| Level | Menu Section | Password | Who Uses It |
|-------|-------------|----------|-------------|
| **Staff** | Daily Reports | No | Managers on duty — export and send the nightly report |
| **Admin** | Admin Tools | Yes | Owners/admins — rollover, analytics, warehouse, triggers |

---

## When Would You Need This File?

- **Adding a new menu item** — Add an `.addItem()` call inside the appropriate submenu in `onOpen()`
- **Creating a new admin function** — Add a `pw_` wrapper function and wire it into the Admin Tools submenu
- **Changing the password** — Update `MENU_PASSWORD` in Script Properties (via `_SETUP_ScriptProperties.js`), not in this file
- **Menu not appearing** — Check Apps Script logs for `onOpen()` errors; the catch block also sends a Slack notification

---

## Important Notes

- **Daily Reports require NO password** — any user with access to the spreadsheet can export reports
- **Admin Tools require the password** — protects destructive operations (rollover, trigger management)
- **The menu replaces all other `onOpen()` functions** — this is the single consolidated menu file (replaces older per-file menus)
- **Error resilience** — if `onOpen()` crashes, the Slack notification in the catch block alerts the team so it doesn't go unnoticed
