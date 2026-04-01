# THE WARATAH - Integration Flows

**Last Updated:** April 2, 2026 (Date parsing hardening: `parseCellDate_()`, `toDateOnly_()`)
**Type:** Detailed Integration Documentation
**Purpose:** Data orchestration, warehouse logging, and external integrations

---

## Overview

The Integration Hub orchestrates data flow between:
1. **Shift Reports** → Data Warehouse (4 sheets)
2. **Shift Reports** → Cash Reconciliation
3. **Shift Reports** → Slack (#managers)
4. **Shift Reports** → Email (7 recipients)
5. **Shift Reports** → Master Actionables (tasks)

**Primary File:** [`IntegrationHub.js`](../../THE%20WARATAH/SHIFT%20REPORT%20SCRIPTS/IntegrationHub.js)

---

## Integration Hub Flow

### Function: `runIntegrations(sheetName)`

```
Shift Report (Daily)
    ↓
runIntegrations(sheetName)
    ├─→ extractShiftData_()          // Parse cells B3-B5, B8, B15-B34, A43-A65
    ├─→ validateShiftData_()         // Check revenue logic, required fields
    ├─→ logToDataWarehouse_()        // 4 sheets with duplicate prevention
    └─→ syncToCashReconciliation_()  // Find weekly file, populate row
```

---

## 1. Data Extraction

### Function: `extractShiftData_(sheet)`

**Reads from hardcoded cells:**

```javascript
const shiftData = {
  // Header
  date: sheet.getRange('B3').getValue(),              // Date
  mod: sheet.getRange('B4').getValue(),               // MOD name
  staff: sheet.getRange('B5').getValue(),             // Staff names

  // Financial (core)
  netRevenue: sheet.getRange('B34').getValue(),       // Net revenue
  cashTips: sheet.getRange('B33').getValue(),         // Cash tips
  cardTips: sheet.getRange('B32').getValue(),         // Card tips
  totalTips: sheet.getRange('B36').getValue(),        // Total tips (formula)
  productionAmount: sheet.getRange('B8').getValue(),  // Production amount
  cashTakings: sheet.getRange('B15').getValue(),      // Cash takings (formula)

  // Financial breakdown (B16-B29, includes merged cell pairs)
  grossSalesIncCash: sheet.getRange('B16').getValue(),
  cashReturns: sheet.getRange('B17').getValue(),      // Merged B17:B18
  cdDiscount: sheet.getRange('B19').getValue(),       // Merged B19:B20
  refunds: sheet.getRange('B21').getValue(),          // Merged B21:B22
  cdRedeem: sheet.getRange('B23').getValue(),         // Merged B23:B24
  totalDiscount: sheet.getRange('B25').getValue(),
  discountsCompsExcCD: sheet.getRange('B26').getValue(),
  grossTaxableSales: sheet.getRange('B27').getValue(),
  taxes: sheet.getRange('B28').getValue(),
  netSalesWTips: sheet.getRange('B29').getValue(),

  // Narratives (merged A:F, value in col A)
  shiftSummary: sheet.getRange('A43').getValue(),
  vips: sheet.getRange('A45').getValue(),
  theGood: sheet.getRange('A47').getValue(),
  theBad: sheet.getRange('A49').getValue(),
  kitchenNotes: sheet.getRange('A51').getValue(),

  // Tasks (extracted separately)
  tasks: extractTasks_(sheet),                        // A53:E61

  // Incidents (merged A:F)
  rsaIncidents: sheet.getRange('A65').getValue(),
  wastage: sheet.getRange('A63').getValue()
};

// REMOVED (Mar 6): covers (B36), laborHours (B38), laborCost (B39),
// averageCheck, laborPercentage, revPAH

return shiftData;
```

**Task Extraction:**

```javascript
function extractTasks_(sheet) {
  const taskRange = sheet.getRange('A53:E61');  // 9 tasks, merged A:E
  const allocationRange = sheet.getRange('F53:F61');  // Staff allocated

  const taskValues = taskRange.getValues();
  const allocationValues = allocationRange.getValues();

  const tasks = [];
  taskValues.forEach((row, index) => {
    const taskText = row.join(' ').trim();
    if (taskText) {
      tasks.push({
        description: taskText,
        allocatedTo: allocationValues[index][0] || ''
      });
    }
  });

  return tasks;
}
```

---

## 2. Data Validation

### Function: `validateShiftData_(shiftData)`

**Validation Rules:**

```javascript
const validations = [];

// 1. Required fields
if (!shiftData.date || !(shiftData.date instanceof Date)) {
  validations.push({
    severity: 'ERROR',
    message: 'Date is missing or invalid'
  });
}

if (!shiftData.mod || shiftData.mod.trim() === '') {
  validations.push({
    severity: 'ERROR',
    message: 'MOD name is required'
  });
}

if (!shiftData.netRevenue || shiftData.netRevenue <= 0) {
  validations.push({
    severity: 'ERROR',
    message: 'Net revenue must be greater than 0'
  });
}

// 2. Financial logic checks
const calculatedTips = shiftData.cashTips + shiftData.cardTips;
const reportedTips = shiftData.totalTips;

if (Math.abs(calculatedTips - reportedTips) > 1) {  // Allow $1 rounding
  validations.push({
    severity: 'WARNING',
    message: `Tip mismatch: Calculated $${calculatedTips} vs Reported $${reportedTips}`
  });
}

// NOTE (Mar 6): laborPercentage and averageCheck checks removed —
// these fields are no longer extracted after schema overhaul.

return validations;
```

**Validation Handling:**

```javascript
const validations = validateShiftData_(shiftData);

// Errors block export
const errors = validations.filter(v => v.severity === 'ERROR');
if (errors.length > 0) {
  ui.alert('Export Blocked', errors.map(e => e.message).join('\n'), ui.ButtonSet.OK);
  return;  // ABORT
}

// Warnings allow export
const warnings = validations.filter(v => v.severity === 'WARNING');
if (warnings.length > 0) {
  const response = ui.alert(
    'Data Warnings',
    warnings.map(w => w.message).join('\n') + '\n\nContinue anyway?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;  // User aborted
  }
}
```

---

## 2b. Date Parsing & Warehouse Formatting (April 2, 2026)

> Dates extracted from Google Sheets cells can include time components or be mis-parsed if fallback conversion is needed. These helpers ensure warehouse dates are consistently formatted (midnight, no time) and that parsing errors are caught early.

### Function: `parseCellDate_(value)`

**Purpose:** Parse cell date values safely, handling both Date objects and string representations.

```javascript
function parseCellDate_(value) {
  // If already a Date object, return as-is
  if (value instanceof Date) {
    return value;
  }

  // String fallback: try parsing as dd/MM/yyyy
  // NOTE: JavaScript new Date() is locale-unaware and unreliable for dd/MM/yyyy
  // If parsing fails, return Invalid Date + warn
  const str = value.toString().trim();
  // Parsing logic here...
  Logger.log('parseCellDate_: could not parse "' + str + '" as dd/MM/yyyy — returning Invalid Date');
  return new Date('invalid');
}
```

**Behavior:**
- Returns the Date object unchanged if input is already a Date
- For string inputs, attempts dd/MM/yyyy parsing
- Returns `Invalid Date` (not null or undefined) if parsing fails
- Logs a warning for debugging; non-blocking — system continues to operate

**Why:** `new Date("dd/mm/yyyy")` is unreliable across browsers and timezones; it silently assumes mm/dd/yyyy in some environments and UTC in others. Hardening removes the ambiguity by rejecting unparseable dates early.

### Function: `toDateOnly_(d)`

**Purpose:** Strip time component from Date objects before warehouse writes.

```javascript
function toDateOnly_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    Logger.log('toDateOnly_: invalid Date input, returning Invalid Date');
    return new Date('invalid');
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
```

**Behavior:**
- Takes a Date object
- Returns a new Date at midnight (00:00:00) of that same day
- Rejects Invalid Date input with a warning

**Applied to:** All warehouse writes in `logToDataWarehouse_()`:
- NIGHTLY_FINANCIAL: columns A (Date), C (Week Ending)
- OPERATIONAL_EVENTS: column A (Date)
- WASTAGE_COMPS: column A (Date)
- QUALITATIVE_NOTES: column A (Date)

**Impact:** Warehouse dates are now consistently midnight, matching Google Sheets date-only conventions.

---

## 3. Data Warehouse Logging

### Function: `logToDataWarehouse_(shiftData)`

**Logs to 4 sheets in the Data Warehouse spreadsheet:**

```javascript
const warehouseId = PropertiesService.getScriptProperties()
  .getProperty('WARATAH_DATA_WAREHOUSE_ID');
const warehouse = SpreadsheetApp.openById(warehouseId);

// 1. NIGHTLY_FINANCIAL - Revenue, tips, production
logToNightlyFinancial_(warehouse, shiftData);

// 2. OPERATIONAL_EVENTS - TO-DOs with dates
logToOperationalEvents_(warehouse, shiftData);

// 3. WASTAGE_COMPS - Wastage notes
logToWastageComps_(warehouse, shiftData);

// 4. QUALITATIVE_LOG - Narratives, shift summary
logToQualitativeLog_(warehouse, shiftData);
```

---

### Sheet 1: NIGHTLY_FINANCIAL

**Columns (22 total, A-V) — schema overhauled Mar 6, 2026:**

```javascript
[
  shiftData.date,                   // A: Date
  dayName,                          // B: Day (e.g. "Wednesday")
  weekEnding,                       // C: WeekEnding
  shiftData.mod,                    // D: MOD
  shiftData.staff,                  // E: Staff
  shiftData.netRevenue,             // F: NetRevenue
  shiftData.productionAmount,       // G: ProductionAmount
  shiftData.cashTakings,            // H: CashTakings
  shiftData.grossSalesIncCash,      // I: GrossSalesIncCash
  shiftData.cashReturns,            // J: CashReturns
  shiftData.cdDiscount,             // K: CDDiscount
  shiftData.refunds,                // L: Refunds
  shiftData.cdRedeem,               // M: CDRedeem
  shiftData.totalDiscount,          // N: TotalDiscount
  shiftData.discountsCompsExcCD,    // O: DiscountsCompsExcCD
  shiftData.grossTaxableSales,      // P: GrossTaxableSales
  shiftData.taxes,                  // Q: Taxes
  shiftData.netSalesWTips,          // R: NetSalesWTips
  shiftData.cardTips,               // S: CardTips
  shiftData.cashTips,               // T: CashTips
  shiftData.totalTips,              // U: TotalTips
  new Date()                        // V: LoggedAt
]
```

**Removed fields (Mar 6):** Covers, AvgCheck, Labor%, Production%, RSA Incidents, Source, TO-DO Count

**Duplicate Prevention:**

```javascript
// Check if date + MOD combo already exists
// Uses normaliseDateKey_() to handle both Date objects and string-stored dates
const isDuplicate = existingData.some((row, index) => {
  if (index === 0) return false;  // Skip header
  return normaliseDateKey_(row[0]) === normaliseDateKey_(shiftData.date) &&
         row[3] === shiftData.mod;  // col D = MOD
});

if (isDuplicate) {
  Logger.log('SKIP: Duplicate entry prevented (same date + MOD)');
  return;
}

// Batch write via setValues() (not appendRow)
```

---

### Sheet 2: OPERATIONAL_EVENTS

**Purpose:** Track TO-DOs from shift reports (one row per TODO)

**Columns (8 total, A-H) — schema updated Mar 6, 2026:**

```javascript
// All tasks collected into rows array, then batch-written via setValues()
const rows = shiftData.tasks.map(task => [
  shiftData.date,                   // A: Date
  dayName,                          // B: Day
  shiftData.mod,                    // C: MOD
  task.description,                 // D: Description
  task.allocatedTo,                 // E: Assignee
  'Shift Report',                   // F: Priority (source label)
  'Shift Report',                   // G: Source
  new Date()                        // H: LoggedAt
]);

// Batch write (not appendRow loop)
if (rows.length > 0) {
  sheet.getRange(nextRow, 1, rows.length, 8).setValues(rows);
}
```

**Duplicate Prevention:**
- Date + task description composite key checked before logging

---

### Sheet 3: WASTAGE_COMPS

**Purpose:** Track wastage and comps for analytics

**Columns (6 total, A-F) — schema updated Mar 6, 2026:**

```javascript
if (shiftData.wastage && shiftData.wastage.trim() !== '') {
  const row = [
    shiftData.date,                 // A: Date
    dayName,                        // B: Day
    weekEnding,                     // C: WeekEnding
    shiftData.mod,                  // D: MOD
    shiftData.wastage,              // E: Notes
    new Date()                      // F: LoggedAt
  ];

  sheet.appendRow(row);
}
```

**Duplicate Prevention:**
- Applied (same date + wastage text)

---

### Sheet 4: QUALITATIVE_LOG

**Purpose:** Store narratives and observations

**Columns (11 total, A-K) — schema updated Mar 6, 2026:**

```javascript
const row = [
  shiftData.date,                   // A: Date
  dayName,                          // B: Day
  shiftData.mod,                    // C: MOD
  shiftData.shiftSummary,           // D: ShiftSummary
  shiftData.vips,                   // E: GuestsOfNote
  shiftData.theGood,                // F: TheGood
  shiftData.theBad,                 // G: TheBad
  shiftData.kitchenNotes,           // H: KitchenNotes
  shiftData.maintenance || '',      // I: Maintenance
  shiftData.rsaIncidents || '',     // J: RSAIncidents
  new Date()                        // K: LoggedAt
];

sheet.appendRow(row);
```

**Duplicate Prevention:**
- Applied (same date + MOD)

---

## 4. Cash Reconciliation Sync

### Function: `syncToCashReconciliation_(shiftData)`

**Purpose:** Auto-populate weekly cash recon file with shift data

**Flow:**

```javascript
1. Find weekly cash recon file
   ├─ Search Drive for file matching pattern: "W.E. DD/MM/YYYY"
   ├─ Example: "W.E. 23/02/2026"
   └─ Based on shift date, calculate week ending (next Sunday)

2. Locate correct sheet within file
   ├─ Sheet name matches day: "WEDNESDAY", "THURSDAY", etc.
   └─ Get sheet by name

3. Write shift data to predefined cells
   ├─ Net Revenue → specific cell
   ├─ Cash Tips → specific cell
   └─ Card Tips → specific cell

4. Mark as synced
   └─ Add checkmark or timestamp
```

**Error Handling:**

```javascript
try {
  syncToCashReconciliation_(shiftData);
  Logger.log('✅ Cash recon synced');
} catch (e) {
  Logger.log(`⚠️ Cash recon sync failed: ${e.message}`);
  // NON-BLOCKING - doesn't prevent export
}
```

---

## 5. Slack Integration

### Function: `postToSlackFromSheet(sheet, testMode)`

**Builds Block Kit message:**

```javascript
const blocks = [
  // Header
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `📊 ${sheetName} Shift Report`
    }
  },

  // Date & MOD
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Date:*\n${formatDate(date)}` },
      { type: 'mrkdwn', text: `*MOD:*\n${mod}` }
    ]
  },

  // Financial summary (covers removed Mar 6)
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Net Revenue:*\n$${netRevenue.toFixed(2)}` },
      { type: 'mrkdwn', text: `*Total Tips:*\n$${totalTips.toFixed(2)}` },
      { type: 'mrkdwn', text: `*Card Tips:*\n$${cardTips.toFixed(2)}` },
      { type: 'mrkdwn', text: `*Cash Tips:*\n$${cashTips.toFixed(2)}` }
    ]
  },

  // Shift summary
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Shift Summary:*\n${shiftSummary}`
    }
  },

  // TO-DOs
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*TO-DOs (${tasks.length}):*\n${tasks.map(t => `• ${t}`).join('\n')}`
    }
  },

  // Divider
  { type: 'divider' }
];
```

**Send to Slack:**

```javascript
const webhook = testMode
  ? PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_TEST')
  : PropertiesService.getScriptProperties().getProperty('WARATAH_SLACK_WEBHOOK_LIVE');

const payload = {
  blocks: blocks,
  username: 'Shift Reports',
  icon_emoji: ':clipboard:'
};

const options = {
  method: 'post',
  contentType: 'application/json',
  payload: JSON.stringify(payload)
};

UrlFetchApp.fetch(webhook, options);
Logger.log('✅ Slack notification sent');
```

---

## 6. Email Distribution

### Function: `composeShiftReportEmail_(shiftData, pdfBlob)`

**Email Structure:**

```javascript
const subject = `The Waratah Shift Report - ${formatDate(shiftData.date)}`;

const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .summary { background: #f4f4f4; padding: 15px; border-radius: 5px; }
    .stat { display: inline-block; margin-right: 20px; }
  </style>
</head>
<body>
  <h2>📊 ${sheetName} Shift Report</h2>

  <div class="summary">
    <p><strong>Date:</strong> ${formatDate(shiftData.date)}</p>
    <p><strong>MOD:</strong> ${shiftData.mod}</p>

    <div class="stat">
      <strong>Net Revenue:</strong><br>
      $${shiftData.netRevenue.toFixed(2)}
    </div>

    <div class="stat">
      <strong>Tips:</strong><br>
      $${shiftData.totalTips.toFixed(2)}
    </div>
  </div>

  <h3>Shift Summary</h3>
  <p>${shiftData.shiftSummary}</p>

  <h3>TO-DOs (${shiftData.tasks.length})</h3>
  <ul>
    ${shiftData.tasks.map(t => `<li>${t.description} - <em>${t.allocatedTo}</em></li>`).join('')}
  </ul>

  <p style="color: #666; font-size: 0.9em;">
    Automated by Shift Reports 3.0<br>
    PDF attached
  </p>
</body>
</html>
`;

const recipients = JSON.parse(
  PropertiesService.getScriptProperties().getProperty('WARATAH_EMAIL_RECIPIENTS')
);

GmailApp.sendEmail(
  recipients.join(','),
  subject,
  'Please view this email in HTML mode.',
  {
    htmlBody: htmlBody,
    attachments: [pdfBlob],
    name: 'The Waratah Shift Reports'
  }
);
```

---

## 7. Master Actionables (Task System)

### Function: `pushTodosToMasterActionables(tasks)`

**Pushes tasks to spreadsheet-based task tracker:**

```javascript
const taskMgmtId = PropertiesService.getScriptProperties()
  .getProperty('WARATAH_TASK_MANAGEMENT_ID');
const taskSheet = SpreadsheetApp.openById(taskMgmtId)
  .getSheetByName('Master Actionables');

// Try enhanced task system first
try {
  tasks.forEach(task => {
    createTask({
      description: task.description,
      allocatedTo: task.allocatedTo,
      status: 'NEW',
      priority: 'NORMAL',
      area: 'General',
      source: 'Shift Report',
      dueDate: null  // Optional
    });
  });
  Logger.log('✅ Tasks created via enhanced system');
} catch (e) {
  // Fallback: direct append
  Logger.log('⚠️ Enhanced system failed, using fallback');

  tasks.forEach(task => {
    const row = [
      'NEW',                          // A: Status
      'NORMAL',                       // B: Priority
      task.allocatedTo,               // C: Staff Allocated
      'General',                      // D: Area
      task.description,               // E: Description
      null,                           // F: Due Date
      new Date(),                     // G: Date Created
      null,                           // H: Date Completed
      '',                             // I: Days Open (formula)
      '',                             // J: Blocker Notes
      'Shift Report',                 // K: Source
      'None',                         // L: Recurrence
      new Date(),                     // M: Last Updated
      'System'                        // N: Updated By
    ];

    taskSheet.appendRow(row);
  });

  Logger.log('✅ Tasks appended directly');
}
```

**Duplicate Detection:**

```javascript
// Check if task already pushed today
const today = new Date().toDateString();
const existingTasks = taskSheet.getDataRange().getValues();

const isDuplicate = existingTasks.some((row, index) => {
  if (index === 0) return false;  // Skip header

  const taskDescription = row[4];  // Column E
  const createdDate = row[6];      // Column G

  return createdDate instanceof Date &&
         createdDate.toDateString() === today &&
         taskDescription === task.description;
});

if (isDuplicate) {
  Logger.log(`SKIP: Task already pushed today - "${task.description}"`);
  return;
}
```

---

## Error Handling Strategy

### Non-Blocking Integrations

```javascript
// Data warehouse logging
try {
  logToDataWarehouse_(shiftData);
  Logger.log('✅ Data warehouse logged');
} catch (e) {
  Logger.log(`⚠️ Warehouse logging failed: ${e.message}`);
  ui.alert('Warning', `Data warehouse logging failed but export will continue.\n\n${e.message}`, ui.ButtonSet.OK);
  // CONTINUE - don't block export
}

// Cash recon sync
try {
  syncToCashReconciliation_(shiftData);
  Logger.log('✅ Cash recon synced');
} catch (e) {
  Logger.log(`⚠️ Cash recon sync failed: ${e.message}`);
  // CONTINUE - don't block export
}
```

### Blocking Validations

```javascript
// Data validation
const validations = validateShiftData_(shiftData);
const errors = validations.filter(v => v.severity === 'ERROR');

if (errors.length > 0) {
  ui.alert('Export Blocked', errors.map(e => e.message).join('\n'), ui.ButtonSet.OK);
  return;  // ABORT - don't continue
}
```

---

## Testing Integrations

### Test Function

```javascript
function testIntegrations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const sheetName = sheet.getName();

  if (!['WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(sheetName)) {
    ui.alert('Error', 'Please select a shift report sheet (Wed-Sun)', ui.ButtonSet.OK);
    return;
  }

  try {
    runIntegrations(sheetName);
    ui.alert('Success', 'Integrations test completed. Check Apps Script logs for details.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', `Integration test failed:\n\n${e.message}`, ui.ButtonSet.OK);
  }
}
```

**Menu Access:**
```
Apps Script Editor → Run → testIntegrations
```

**Check Logs:**
```
Apps Script Editor → Executions (list icon)
```

---

**Last Updated:** March 6, 2026
**Key Files:** IntegrationHub.js (v3.0.0), NightlyExport.js
**Data Warehouse:** 4 sheets with duplicate prevention (schemas overhauled Mar 6, 2026)
**Error Strategy:** Non-blocking integrations, blocking validations
