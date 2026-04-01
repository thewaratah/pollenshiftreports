# Task Management — Sakura House

**Last Updated:** April 2, 2026 (Overdue summaries removed, weekly summary DM-only, FOH leads summary removed)
**Type:** Handover guide for managers
**Audience:** Tech-savvy restaurant managers, non-developers

---

## What This System Does

> The task management system keeps track of everything that needs to be done at the venue — from shift report TO-DOs to ad-hoc requests. It automatically sorts, escalates, archives, and notifies.

Tasks arrive in two ways:

1. **Automatically from shift reports** — when you send a nightly report, any TO-DOs you wrote go directly to the Actionables Sheet
2. **Manually** — you can create tasks on the spot using the Task Manager dialog

The system automatically sorts tasks by priority and status, escalates blocked items that need attention, regenerates recurring tasks, archives completed tasks, and sends Slack summaries to the team each week.

---

## Two Separate Spreadsheets

> This is really important: the task management system lives in its own spreadsheet, completely separate from the shift report.

**The separation:**

| | Shift Report | Task Management |
|---|---|---|
| **Spreadsheet Name** | Sakura House - Current Week | Sakura Actionables Sheet |
| **Menu Label** | "Shift Report" | "Task Management" |
| **Script Properties** | 13 properties (shift reports) | 7 properties (tasks only) |
| **Triggers** | 3 time-based triggers | 4 time-based triggers |

If you change a password in the Shift Report's Script Properties, the Task Management sheet is not affected. They are completely independent — like two separate apps running side by side.

**Why separate?** So that shift report changes never accidentally break task management, and vice versa.

---

## Opening the Task Manager

> The Task Manager is a dialog box (small popup window) that lets you see all tasks, create new ones, and update status without scrolling through the spreadsheet.

**To open it:**

1. Open the **Sakura Actionables Sheet** (the task management spreadsheet)
2. Click **Task Management** → **Open Task Manager**
3. A dialog box appears

**What you can do in the dialog:**
- View all active tasks with their priority, due date, and assignee
- Create new tasks with a simple form
- Update a task's status or due date
- Assign tasks to staff

**You can also work directly in the spreadsheet** if you prefer — the dialog is optional. Some managers like the spreadsheet view for scanning lots of tasks at once.

---

## Understanding Task Statuses

> Every task has a status that tells you exactly where it is in its lifecycle. Here are all eight statuses and what they mean.

**Active statuses** (tasks still needing attention):

| Status | What It Means | Next Step |
|--------|--------------|-----------|
| **NEW** | Just created, hasn't been looked at yet | Move to TO DO when ready to work on it |
| **TO DO** | Acknowledged and ready to be worked on | Start work and move to IN PROGRESS |
| **IN PROGRESS** | Someone is actively working on it | Move to DONE or BLOCKED if stuck |
| **TO DISCUSS** | Needs to be talked about at the next meeting or huddle | Discuss and then move to TO DO or DONE |
| **DEFERRED** | Postponed intentionally — will come back to it later | Move back to TO DO when ready |
| **BLOCKED** | Can't proceed — waiting on something (needs a note explaining what) | Resolve the blocker and unblock |
| **RECURRING** | A repeating task that creates new copies automatically | Mark DONE and a new one appears next week |

**Completed statuses** (tasks that are done):

| Status | What It Means |
|--------|--------------|
| **DONE** | Completed successfully |
| **CANCELLED** | No longer needed |

Completed tasks (DONE and CANCELLED) are shown with strikethrough text and automatically sorted to the bottom of the sheet.

---

## How Tasks Flow Through the System

> Tasks move from left to right through the statuses. Here's the typical journey from creation to completion.

```
NEW → TO DO → IN PROGRESS → DONE
                 ↓
            BLOCKED (waiting on something)
                 ↓
        (Auto-escalated after 14 days)
```

**Key automatic behaviors:**

- **When you mark a task DONE or CANCELLED:** the "Date Completed" column fills in automatically with today's date
- **When you mark a task BLOCKED:** the "Blocker Notes" cell highlights in red — you must fill in what's blocking it
- **If a task stays BLOCKED for 14+ days:** the system auto-escalates it (sends an email and Slack DM to Evan)
- **If a task has RECURRING enabled:** when you mark it DONE, the system automatically creates a new copy with the same description and priority, but a new due date

---

## Priority Levels

> Priority determines the sort order and how the task row looks on the sheet. Higher priority tasks always appear at the top.

| Priority | Row Color | Sort Position |
|----------|-----------|----------------|
| **URGENT** | Light red | Top — these are critical |
| **HIGH** | Light orange | Second — important |
| **MEDIUM** | Light yellow | Third — normal |
| **LOW** | Light blue | Bottom — can wait |

**Default:** New tasks start at MEDIUM priority. Change it immediately if a task needs more or less attention.

---

## What Happens Automatically (Daily at 7am)

> Every morning at 7am Sydney time, the system runs a maintenance routine that keeps everything tidy.

**The daily maintenance does:**

1. **Cleanup and sort** — removes any empty rows and re-sorts all tasks by priority, status, and staff assignment
2. **Process recurring tasks** — checks if any completed recurring tasks need a new copy created
3. **Archive old tasks** — moves tasks that have been DONE or CANCELLED for more than 8 days to the ARCHIVE tab (out of your way, but still there for reference)
4. **Escalate blocked tasks** — if anything has been BLOCKED for 14+ days, sends an escalation email to Evan and posts a Slack DM

**What you see:** Most mornings, you won't notice anything. The sheet just looks cleaner and more organized.

---

## Recurring Tasks (Auto-Regenerating)

> Some tasks repeat on a schedule. The system handles this completely automatically.

**How to set up a recurring task:**

1. Create or edit a task
2. Set the **Recurrence** column to one of: **Weekly**, **Fortnightly**, or **Monthly**
3. That's it — the system takes care of the rest

**What happens next:**

1. When you mark that task as **DONE**, the system automatically creates a new copy
2. The new copy has:
   - Same description, priority, staff assignment, and area
   - A new due date calculated from the recurrence interval
   - Status reset to **TO DO** (ready to work on)
3. The original task stays as **DONE** (for the audit trail — you can always see what was done before)

**Timing of recurrence:**

- **Weekly** → next copy is due the following Monday
- **Fortnightly** → next copy is due two Mondays from now
- **Monthly** → next copy is due on the same date next month (but if that date falls on Saturday or Sunday, it moves to Monday)

**Example:** You have a recurring "Check fridge temperatures" task due every Monday. When you mark it DONE on Monday, a new one automatically appears for next Monday.

---

## Slack Notifications from the Task System

> The task system sends several types of Slack messages to keep the team informed. Here's what triggers each one and where it goes.

**Weekly notifications:**

| When | What Gets Sent | Where | Who Sees It |
|------|----------------|-------|------------|
| **Monday 6am** | Summary of all active tasks (grouped by staff member) | Individual DMs to each staff member only | Everyone with tasks |

**As-needed notifications:**

| When | What Gets Sent | Where | Who Sees It |
|------|----------------|-------|------------|
| **When a task is blocked 14+ days** | Escalation alert (what's blocking it, who's assigned, how long it's been blocked) | Email + Slack DM to Evan | Evan (usually) |

**Note (Apr 2, 2026):** Overdue task summaries and FOH leads channel summaries have been removed. Staff receive only their individual Monday morning task summaries via DM.

---

## The Task Dashboard

> The TASK DASHBOARD tab in the Actionables Sheet is a visual overview — it shows you task counts by status, priority, staff workload, and trends.

**What it shows:**

- **Total count** — how many active tasks are there right now
- **Overdue count** — how many tasks are past their due date
- **Status breakdown** — pie chart or numbers showing how many are NEW, IN PROGRESS, BLOCKED, etc.
- **Priority breakdown** — how many URGENT, HIGH, MEDIUM, LOW
- **Staff workload** — tasks assigned to each person (and overdue per person)
- **Throughput** — how many tasks were created vs completed in the last 7 and 30 days
- **Weekly trend** — graph showing activity over the last 8 weeks

**If the dashboard looks wrong or is missing:**

1. Go to **Task Management** → **Admin Tools** → **Dashboard** → **Build / Rebuild Task Dashboard**
2. You'll be asked for the admin password
3. It rebuilds everything from scratch

**To refresh just the staff workload numbers:**

1. Go to **Task Management** → **Admin Tools** → **Dashboard** → **Refresh Staff Workload Stats**

---

## Common Tasks You'll Do

**Creating a task manually:**

1. Open **Task Manager** (Task Management > Open Task Manager)
2. Click "Create New Task"
3. Fill in:
   - Description (what needs to be done)
   - Priority (URGENT, HIGH, MEDIUM, LOW)
   - Staff Allocated (who's doing it)
   - Area (FOH, BOH, Kitchen, Admin, etc.)
   - Due Date (when it needs to be done)
   - Recurrence (if it repeats: None, Weekly, Fortnightly, Monthly)
4. Click Create

**Changing a task's status:**

- Click the Status cell in the spreadsheet and choose from the dropdown
- Or use the Task Manager dialog

**Assigning a task to someone:**

- Click the "Staff Allocated" cell and choose from the dropdown
- Names must match exactly: Evan, Nick, Gooch, Adam, Cynthia, Kalisha, Sabine

**Moving tasks back to TO DO after discussion:**

- If a task was in TO DISCUSS, change its status to TO DO once the discussion is done

**Blocking a task:**

1. Change status to BLOCKED
2. The "Blocker Notes" cell turns red
3. Type what's blocking it: "Waiting for supplier to deliver", "Needs Evan's approval", etc.
4. Once unblocked, change status back to IN PROGRESS or TO DO

**Viewing the audit log:**

- Click the **AUDIT LOG** tab
- This sheet records every change made to tasks: who changed what, when, and what the change was
- It's never cleared — permanent record for accountability

---

## Troubleshooting: What Can Go Wrong + Fixes

| Problem | Likely Cause | How to Fix |
|---------|-------------|-----------|
| **TO-DOs from shift reports not appearing in the Actionables Sheet** | The Shift Report spreadsheet has the wrong Task Management spreadsheet ID in its Script Properties | Open the Shift Report spreadsheet → Tools > Script Editor → Project Settings (gear icon) → View Script Properties (in left sidebar) → Check TASK_MANAGEMENT_SPREADSHEET_ID matches the Actionables Sheet's ID (usually starts with "13AN...") |
| **Staff not getting Slack DMs with task summaries** | Staff name doesn't match exactly in the SLACK_DM_WEBHOOKS setting | Go to Task Management spreadsheet → Tools > Script Editor → Project Settings → View Script Properties → Find SLACK_DM_WEBHOOKS (it's a JSON object) → check the names are exactly "Evan", "Nick", "Gooch", "Adam", "Cynthia", "Kalisha", "Sabine" (case-sensitive) |
| **Tasks not auto-sorting when you edit them** | The on-edit trigger was destroyed (usually happens after clasp deployment) | Go to Task Management > Admin Tools > Setup Triggers > Create Edit Trigger (Auto-sort) — choose the Actionables sheet and confirm |
| **Recurring tasks not creating new copies** | The daily maintenance trigger was destroyed | Go to Task Management > Admin Tools > Setup Triggers > Create Daily Trigger (7am) — confirm the trigger is set |
| **Dashboard tab is missing or shows errors** | The tab was accidentally deleted or needs rebuild | Task Management > Admin Tools > Dashboard > Build / Rebuild Task Dashboard — it will recreate the entire tab from scratch |
| **"Days Open" column shows 0 for all tasks** | The formula was accidentally overwritten | Task Management > Admin Tools > Cleanup > Reapply Dropdowns & Formatting — this fixes all formulas and dropdowns |
| **Getting "Cannot read property dmWebhooks" error** | Slack webhook configuration is incomplete | Run Task Management > Admin Tools > Setup Triggers > Reapply Script Properties — this reloads all Slack webhook settings |

**For more detailed troubleshooting:** See [4_TROUBLESHOOTING.md](4_TROUBLESHOOTING.md) in this folder.

---

## Staff Names and Assignments

> The system knows about your current staff and validates their names. If someone leaves or joins, the dropdown list in "Staff Allocated" needs to be updated.

**Current staff (as of Mar 18, 2026):**
- Evan
- Nick
- Gooch
- Adam
- Cynthia
- Kalisha
- Sabine

**To update staff list:**

1. Go to Task Management > Admin Tools > Setup > Update Staff List
2. Enter the new list (one name per line, must match SLACK_DM_WEBHOOKS exactly)
3. The dropdown lists in all rows update automatically

---

## Script Properties (Advanced)

> Script Properties are settings stored securely in Google Apps Script. Managers normally don't need to touch these, but here's what they control.

**For Task Management spreadsheet (6 properties):**

```
TASK_MANAGEMENT_SPREADSHEET_ID          → Points to this sheet (don't change)
ESCALATION_EMAIL                        → Where escalation emails go (evan@...)
ESCALATION_SLACK_WEBHOOK                → Escalation alerts post here
SLACK_MANAGERS_CHANNEL_WEBHOOK          → #sakura_managers posts here (task SLA summary only; FOH removed Apr 2)
SLACK_DM_WEBHOOKS                       → JSON object: {"Evan":"...", "Nick":"...", ...}
MENU_PASSWORD                           → Password for Admin Tools menu
```

**To access them:**

1. Open the Task Management spreadsheet
2. Go to Tools → Script Editor
3. Click the gear icon (⚙️) in the left sidebar → "Project Settings"
4. Scroll down → "Script Properties" (this shows you the values, but you can't edit them here)
5. To change them, run Task Management > Admin Tools > Setup > Reconfigure Script Properties

**You shouldn't need to change these normally.** They're set once and left alone. If you do need to change something (like an email address), Evan or another developer can update them.

---

## Advanced: When Staff or Venues Change

> If staff leave, new staff join, or the system configuration changes, here are the things to update.

**Staff joining the team:**

1. Get their name (e.g., "Jamie")
2. Get their Slack direct message webhook URL from Evan
3. Go to Task Management > Admin Tools > Setup > Reconfigure Script Properties
4. Update SLACK_DM_WEBHOOKS to include the new person: `{"Evan":"...", "Nick":"...", "Jamie":"..."}`
5. Run Task Management > Admin Tools > Setup > Update Staff List (add "Jamie")
6. Dropdowns update automatically

**Staff leaving the team:**

1. Go to Task Management > Admin Tools > Setup > Reconfigure Script Properties
2. Remove them from SLACK_DM_WEBHOOKS
3. Run Task Management > Admin Tools > Setup > Update Staff List (remove their name)
4. Reassign their open tasks to someone else
5. Dropdowns update automatically

**Email address changes (for escalation emails):**

1. If the manager who receives escalations changes, update ESCALATION_EMAIL in Script Properties
2. If the managers channel webhook changes, update SLACK_MANAGERS_CHANNEL_WEBHOOK

---

## Audit Trail

> Every single change to a task is recorded in the AUDIT LOG tab. This is your accountability trail.

**What gets logged:**

- **Timestamp** — when the change was made
- **Action** — what changed (status update, priority change, staff assignment, etc.)
- **User** — who made the change (usually your email address)
- **Task ID** — which task was changed
- **Field Changed** — which column was edited (Status, Priority, Due Date, etc.)
- **Details** — what the change was (e.g., "Status: TO DO → IN PROGRESS")

**How to use it:**

- Click the **AUDIT LOG** tab anytime
- Scroll through to see the history of changes
- This is especially useful if you need to track when a task was started, who escalated it, etc.

**It's never cleared** — every change since the system started is there.

---

## When to Create Tasks (Best Practices)

| Scenario | Create As | Priority | Who Assigns |
|----------|-----------|----------|------------|
| Issue spotted in the shift report | From within the nightly export — it auto-pushes to Actionables | MEDIUM (default) | Person reporting |
| Kitchen needs a repair | Manual task, same shift | HIGH or URGENT | Manager |
| Staff training needed | Manual task | MEDIUM | Manager |
| Monthly inventory count | Recurring task (Monthly) | MEDIUM | Manager |
| Supplier follow-up | Manual task | HIGH | Assigned staff member |
| Ongoing maintenance | Recurring task (Weekly or Fortnightly) | LOW or MEDIUM | Manager |
| Emergency (power out, supplier cancel) | Manual task, immediately | URGENT | Anyone |

---

## Integration with Shift Reports

> When you send a nightly shift report, any TO-DOs you wrote automatically become tasks in the Task Management sheet. Here's how it works.

**The flow:**

1. You fill out the shift report for the night, including TO-DOs
2. You click "Send Nightly Report"
3. The PDF exports, emails go out, Slack gets notified
4. **At the same time:** the system reads the TO-DOs and pushes them to the Actionables Sheet
5. Those tasks appear as **NEW** with **MEDIUM** priority, ready to be sorted and assigned

**Important:** TO-DOs from shift reports are separate from manually created tasks. They both live on the same sheet and are processed the same way.

---

## FAQ

**Q: Can I delete a task permanently?**
A: No, mark it CANCELLED instead. This preserves the audit trail. CANCELLED tasks are moved to ARCHIVE after 8 days, keeping the active sheet clean.

**Q: What if I don't know who to assign a task to?**
A: Leave it unassigned (blank in Staff Allocated) and set it to TO DISCUSS. When you talk about it at the next huddle, assign it and move to TO DO.

**Q: Can I change a task's due date retroactively?**
A: Yes. Click the Due Date cell and change it. The system tracks when it was last updated (Last Updated column).

**Q: What if a recurring task should stop repeating?**
A: Change the Recurrence column to "None" — the next time it's marked DONE, it won't create a copy.

**Q: Can I export tasks to a spreadsheet or report?**
A: Yes — use Task Management > Weekly Summary > Send Weekly Active Tasks (LIVE) to post to Slack, or view the Task Dashboard for a visual summary. For custom exports, Evan can build them.

**Q: How long are completed tasks kept?**
A: DONE and CANCELLED tasks stay visible for 8 days, then move to ARCHIVE. You can view the ARCHIVE tab anytime to see historical tasks.

**Q: What happens if I'm blocked on a task for more than 14 days?**
A: The system escalates it — Evan gets an email and Slack DM. He'll reach out to help resolve it. Don't ignore blocks!

---

## Getting Help

> If something feels wrong or you're stuck, here's who to contact.

**For task system issues:** Email Evan or post in #shift-reports Slack channel

**For Slack notification problems:** Usually a missing or misconfigured webhook — Evan can fix

**For staff list or access issues:** Evan or whoever manages Script Properties

**For feature requests** (e.g., "I want to add a priority level"): Post in #shift-reports or email Evan

---

**Last Updated:** March 18, 2026
**System Status:** Fully operational, production-ready
**Questions?** Contact Evan or check the [4_TROUBLESHOOTING.md](4_TROUBLESHOOTING.md) guide.
