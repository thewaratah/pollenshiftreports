# Sakura House - Deployment Guide

**Date:** February 16, 2026
**Target:** Apps Script Project `15Z5K4HUwMM8UcYbtarDLAGBQGV-LsjZu7W0txj-Xn8Qxat1l7csXmRCy`
**Spreadsheet:** `1-IwePImFP9o7Oxt6ehjhx69F1_l77dXrnNC0YbCLu1g`
**Status:** Ready for first deployment

---

## ⚠️ CRITICAL: Pre-Deployment Checklist

**DO NOT DEPLOY without completing these steps:**

- [ ] **Backup current Apps Script project**
  - Go to: https://script.google.com/d/15Z5K4HUwMM8UcYbtarDLAGBQGV-LsjZu7W0txj-Xn8Qxat1l7csXmRCy/edit
  - File → Make a copy → Name: "Sakura Backup BEFORE Feb 16 Deployment"
  - Save the copy's Script ID for rollback if needed

- [ ] **Verify you're logged into the correct Google account**
  - Should have edit access to Sakura House spreadsheet
  - Should have write access to Apps Script project

- [ ] **Read this entire guide before deploying**

---

## 📦 What Will Be Deployed

### Files Being Pushed (10 files):

**Production Scripts:**
1. `AnalyticsDashboardSakura.gs` - Analytics and charts
2. `IntegrationHubSakura.gs` - Data warehouse integration
3. `MenuSakura.gs` - **MODIFIED** (password protection added)
4. `NightlyExportSakura.gs` - **MODIFIED** (PDF automation added)
5. `RunSakura.gs` - Named range helpers
6. `TaskIntegrationSakura.gs` - Task management bridge
7. `UIServerSakura.gs` - **MODIFIED** (legacy rollover removed)
8. `VenueConfigSakura.gs` - **MODIFIED** (Waratah code removed)
9. `WeeklyRolloverInPlace.gs` - **NEW/MODIFIED** (complete rollover system)

**Setup:**
10. `_SETUP_ScriptProperties_SakuraOnly.gs` - **NEW** (secure configuration)

**HTML Dashboards:**
- `analytics-viewer.html` - Analytics UI (207KB)
- `export-dashboard.html` - Export UI (208KB)

### Files Being Deleted (from Apps Script):
1. `_SETUP_ScriptProperties.gs` - Cross-venue security risk
2. `WeeklyRolloverSakura.gs` - Legacy system
3. `WeeklyDuplicationSakura.gs` - Legacy system
4. `TEST_SlackBlockKitLibrarySakura.gs` - Unused test
5. `TEST_VenueConfigSakura.gs` - Unused test
6. `rollover-wizard.html` - Legacy UI

**Total:** 6 files will be removed from Apps Script on deployment

---

## 🚀 Deployment Commands

### Step 1: Navigate to Sakura Scripts Directory

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/SHIFT REPORTS 3.0/SAKURA HOUSE/SHIFT REPORT SCRIPTS"
```

### Step 2: Verify clasp is logged in

```bash
clasp login --status
```

**Expected:** Shows your Google account email

**If not logged in:**
```bash
clasp login
```

### Step 3: Verify connection to correct project

```bash
clasp open
```

**Expected:** Opens the correct Apps Script project in browser
**Verify URL contains:** `15Z5K4HUwMM8UcYbtarDLAGBQGV-LsjZu7W0txj-Xn8Qxat1l7csXmRCy`

### Step 4: Deploy the changes

```bash
clasp push
```

**Expected output:**
```
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/AnalyticsDashboardSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/IntegrationHubSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/MenuSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/NightlyExportSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/RunSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/TaskIntegrationSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/UIServerSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/VenueConfigSakura.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/WeeklyRolloverInPlace.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/_SETUP_ScriptProperties_SakuraOnly.gs
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/analytics-viewer.html
└─ SAKURA HOUSE/SHIFT REPORT SCRIPTS/export-dashboard.html
Pushed 12 files.
```

**If you see errors:**
- Check you're in the correct directory
- Verify .clasp.json exists and has correct scriptId
- Ensure you're logged into the correct Google account

---

## ⚙️ Post-Deployment Configuration

### Step 1: Open Apps Script Editor

```bash
clasp open
```

Or manually: https://script.google.com/d/15Z5K4HUwMM8UcYbtarDLAGBQGV-LsjZu7W0txj-Xn8Qxat1l7csXmRCy/edit

### Step 2: Run Script Properties Setup

1. In Apps Script editor, open `_SETUP_ScriptProperties_SakuraOnly.gs`
2. Select function: `setupScriptProperties_Sakura`
3. Click **Run** (▶️ button)
4. **Authorize** when prompted (first-time setup)

**Follow the prompts:**

#### Prompt 1: Menu Password
```
Enter the admin menu password:
→ [Enter: chocolateteapot]
```

#### Prompt 2-5: Slack Webhooks
```
LIVE Slack Webhook URL:
→ [Enter your Sakura LIVE webhook]

TEST Slack Webhook URL:
→ [Enter your Sakura TEST webhook]

Data Warehouse Slack Webhook URL:
→ [Enter your Sakura warehouse webhook]

Cash Notifications Slack Webhook URL:
→ [Enter your Sakura cash webhook]
```

**⚠️ Important:** URLs must start with `https://hooks.slack.com/`

#### Prompt 6: Working File ID
```
Enter the Working File ID for in-place rollover.
Suggested (current file): 1-IwePImFP9o7Oxt6ehjhx69F1_l77dXrnNC0YbCLu1g

→ [Press OK to use suggested, or enter different ID]
```

**Recommendation:** Use the suggested ID (your current spreadsheet)

### Step 3: Verify Configuration

1. In Apps Script editor, select function: `verifyScriptProperties`
2. Click **Run**
3. View → Logs (Ctrl+Enter or Cmd+Enter)

**Expected output:**
```
=== SAKURA SHIFT REPORTS - SCRIPT PROPERTIES VERIFICATION ===
Total properties: 13
Expected: 13 properties

--- REQUIRED PROPERTIES CHECK ---
✅ MENU_PASSWORD
✅ VENUE_NAME
✅ SAKURA_SLACK_WEBHOOK_LIVE
✅ SAKURA_SLACK_WEBHOOK_TEST
✅ SAKURA_SLACK_WEBHOOK_DATAWAREHOUSE
✅ SAKURA_SLACK_WEBHOOK_CASH_NOTIFICATIONS
✅ SAKURA_EMAIL_RECIPIENTS
✅ SAKURA_WORKING_FILE_ID
✅ SAKURA_DATA_WAREHOUSE_ID
✅ SAKURA_TASK_MANAGEMENT_ID
✅ ARCHIVE_ROOT_FOLDER_ID
✅ INTEGRATION_ALERT_EMAIL_PRIMARY
✅ INTEGRATION_ALERT_EMAIL_SECONDARY

✅ All required properties are set.
```

**If any ❌ appear:** Run `setupScriptProperties_Sakura` again

---

## ✅ Verification Tests

### Test 1: Menu Appears

1. Open Sakura spreadsheet: https://docs.google.com/spreadsheets/d/1-IwePImFP9o7Oxt6ehjhx69F1_l77dXrnNC0YbCLu1g/edit
2. Refresh the page
3. Wait ~10 seconds for menu to load

**Expected:** Menu appears: "Sakura Shift Reports"

**Submenu structure:**
- Nightly Reports
  - Export & Email (LIVE) 🔒
  - Export & Email (TEST)
- Weekly Reports
  - Weekly TO-DO Summary (LIVE)
  - Weekly TO-DO Summary (TEST)
- Weekly Rollover (In-Place)
  - Run Rollover Now 🔒
  - Preview Rollover (Dry Run) 🔒
  - Show Rollover Config
- Waratah Tools (Export Dashboard, Analytics Viewer)
- Diagnostics

🔒 = Password protected

### Test 2: Password Protection Works

1. Click: Sakura Shift Reports → Nightly Reports → Export & Email (LIVE)
2. **Expected:** Password prompt appears
3. Enter: `chocolateteapot`
4. **Expected:** Function proceeds (or cancels if you click Cancel)

### Test 3: Rollover Configuration Display

1. Click: Sakura Shift Reports → Weekly Rollover (In-Place) → Show Rollover Config
2. **Expected:** Alert showing:
   ```
   IN-PLACE ROLLOVER CONFIGURATION

   Working File ID: 1-IwePImFP9o7Oxt6ehjhx69F1_l77dXrnNC0YbCLu1g
   Archive Root ID: 1a1AbJN4qU7Lt2oyYPxiTn3kG5EEKOf1K
   Timezone: Australia/Sydney
   Days: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY

   Management Emails:
     • evan@sakurahousesydney.com
     • kalisha@sakurahousesydney.com
     • tom@sakurahousesydney.com
     • nick@sakurahousesydney.com
     • cynthia@sakurahousesydney.com
     • adam@pollenhospitality.com
     • properties.litster@gmail.com
   ```

**Verify:**
- Working File ID matches your spreadsheet
- 7 management emails listed
- 6 day sheets (Mon-Sat)

### Test 4: Rollover Preview (Dry Run)

**⚠️ This is safe - makes no changes**

1. Click: Sakura Shift Reports → Weekly Rollover (In-Place) → Preview Rollover (Dry Run)
2. Enter password: `chocolateteapot`
3. **Expected:** Preview showing:
   - Current week ending date
   - Total revenue
   - Days reported
   - Actions that would be executed

**If errors occur:** Check Apps Script logs (View → Logs)

### Test 5: Export Dashboard Opens

1. Click: Sakura Shift Reports → Waratah Tools → Export Dashboard
2. **Expected:** Sidebar opens with export UI

### Test 6: Analytics Viewer Opens

1. Click: Sakura Shift Reports → Waratah Tools → Analytics Viewer
2. **Expected:** Sidebar opens with analytics UI

---

## 🔧 Common Issues & Solutions

### Issue: Menu doesn't appear

**Causes:**
- Script not deployed
- Authorization not granted
- Cache issue

**Solutions:**
1. Refresh the spreadsheet (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
2. Check Apps Script logs for errors
3. Verify deployment succeeded: `clasp deployments`
4. Re-authorize: Run `onOpen()` manually in Apps Script editor

### Issue: Password prompt doesn't work

**Causes:**
- MENU_PASSWORD not set in Script Properties
- Using wrong password

**Solutions:**
1. Run `verifyScriptProperties()` in Apps Script
2. Check logs for MENU_PASSWORD value (masked)
3. Re-run `setupScriptProperties_Sakura()` if missing

### Issue: Rollover preview shows errors

**Possible causes:**
1. WORKING_FILE_ID mismatch
2. VENUE_NAME not set to 'SAKURA'
3. Named ranges missing

**Debug:**
1. Run `validateRolloverPreconditions_(SpreadsheetApp.getActiveSpreadsheet())`
2. Check logs for specific error
3. Verify Script Properties with `verifyScriptProperties()`

### Issue: "Function not found" errors

**Cause:** Old code still cached in Apps Script

**Solution:**
1. Apps Script editor → View → Logs
2. Clear any cached errors
3. Make a trivial edit to force recompile (add a space, save)
4. Refresh spreadsheet

---

## 🔄 Rollback Procedure (If Needed)

### If deployment causes issues:

1. **Open your backup Apps Script project**
   - Find the backup you made in Step 1
   - Copy all code

2. **Replace current code**
   ```bash
   # Pull from backup
   clasp clone [BACKUP_SCRIPT_ID]

   # Push to current
   cd "SAKURA HOUSE/SHIFT REPORT SCRIPTS"
   clasp push --force
   ```

3. **Or manually copy-paste:**
   - Open backup project
   - Copy each file's code
   - Paste into current project
   - Save

---

## 📊 Post-Deployment Verification Checklist

After successful deployment and configuration:

- [ ] Menu appears in spreadsheet
- [ ] Password protection works on LIVE functions
- [ ] Rollover config displays correctly
- [ ] Rollover preview works (dry run)
- [ ] Export dashboard opens
- [ ] Analytics viewer opens
- [ ] No errors in Apps Script logs
- [ ] Script Properties show 13 properties configured
- [ ] WORKING_FILE_ID matches current spreadsheet
- [ ] VENUE_NAME is 'SAKURA'

---

## 🎯 Next Steps After Deployment

### Recommended Testing Sequence:

1. **Create a test copy of the spreadsheet**
   - File → Make a copy
   - Name: "TEST - Sakura Shift Report"
   - Note the new file ID

2. **Configure test file for rollover testing**
   - Run `updateProperty('SAKURA_WORKING_FILE_ID')` in Apps Script
   - Enter the TEST file ID
   - Follow [ROLLOVER_TESTING_GUIDE.md](ROLLOVER_TESTING_GUIDE.md)

3. **Test all 4 phases on TEST copy**
   - Phase 1: Preview (safe)
   - Phase 2: Config display (safe)
   - Phase 3: PDF export test
   - Phase 4: Full rollover (destructive on test copy only)

4. **After successful testing, reconfigure for production**
   - Run `updateProperty('SAKURA_WORKING_FILE_ID')` again
   - Enter production file ID: `1-IwePImFP9o7Oxt6ehjhx69F1_l77dXrnNC0YbCLu1g`

5. **Set up automated trigger (optional)**
   - Apps Script editor → Triggers (clock icon)
   - Add trigger for `performInPlaceRollover`
   - Time-driven → Day timer → Monday → 1am-2am

---

## 📞 Support

**If deployment fails:**
1. Check Apps Script execution logs
2. Verify .clasp.json has correct scriptId
3. Ensure logged into correct Google account
4. Review error messages in terminal

**If configuration fails:**
1. Run `verifyScriptProperties()` to check what's set
2. Check Apps Script logs for specific errors
3. Re-run `setupScriptProperties_Sakura()` if needed

**Documentation:**
- [ROLLOVER_TESTING_GUIDE.md](ROLLOVER_TESTING_GUIDE.md) - Complete testing procedure
- [SESSION_IMPLEMENTATION_SUMMARY.md](SESSION_IMPLEMENTATION_SUMMARY.md) - What changed
- [PHASE1_CLEANUP_COMPLETE.md](PHASE1_CLEANUP_COMPLETE.md) - Cleanup details
- [PHASE2_CLEANUP_COMPLETE.md](PHASE2_CLEANUP_COMPLETE.md) - Additional cleanup

---

**Deployment Guide Created:** February 16, 2026
**Target Project:** 15Z5K4HUwMM8UcYbtarDLAGBQGV-LsjZu7W0txj-Xn8Qxat1l7csXmRCy
**Status:** Ready for first deployment ✅
