# checklist-dialog.html

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/checklist-dialog.html`
**Type:** In-spreadsheet popup dialog (HTML + JavaScript)
**Opened by:** The shift report export flow

---

## What This File Does

This is a small popup dialog that appears when a manager is about to send out the shift report. It acts as a gate — the report won't send until the manager confirms two pre-send checks:

1. **Deputy Timesheets Approved** — Confirms the manager has approved all staff timesheets in Deputy
2. **Fruit Order Done** — Confirms the next day's fruit order has been placed

Both boxes must be ticked before the "Confirm & Send" button becomes active.

---

## How It Works

### User Flow

1. Manager triggers the export (e.g., "Send Shift Report" from the menu)
2. This dialog pops up with two unchecked boxes
3. Manager ticks both checkboxes
4. The "Confirm & Send" button activates
5. Manager clicks it — the button changes to "Sending..." and both buttons disable
6. The dialog calls `google.script.run.continueExport(sheetName, isTest)` on the server
7. On success: shows a green "Sent successfully" message, then auto-closes after 2 seconds
8. On failure: re-enables the buttons and shows an error alert

### Template Variables

The dialog receives two values from the server when it's created:

| Variable | Purpose |
|----------|---------|
| `sheetName` | Which day's sheet to export (e.g., "Wednesday") |
| `isTest` | Whether to send to the test Slack channel or the live channel |

These are injected using GAS templating (`<?!= sheetName ?>` syntax).

---

## Key Technical Details

- **No external dependencies** — pure HTML, CSS, and vanilla JavaScript
- **Google Material-style UI** — styled to look native to Google Sheets dialogs
- Uses `google.script.run` to call back into the server-side GAS code
- Uses `google.script.host.close()` to dismiss the dialog
- Checkbox clicks work on both the checkbox itself and the entire list item row (with `stopPropagation` to prevent double-firing)

---

## When Would You Need This File?

- **Adding a new checklist item** — Add another `<li>` with a checkbox, and update the `updateButton()` function to require it
- **Changing the confirmation flow** — If the export process changes, update the `onConfirm()` function
- **Styling tweaks** — All CSS is inline in the `<style>` block
