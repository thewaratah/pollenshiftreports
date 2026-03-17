#!/usr/bin/env node

/**
 * sync-explainers-to-drive.js
 *
 * Syncs FILE EXPLAINERS .md files to Google Drive folders.
 *
 * Auth methods (tried in order):
 *   1. Service account at ~/.config/gcloud/service-account.json
 *      (requires both Drive folders shared with the SA email as Editor)
 *   2. Clasp OAuth2 credentials at ~/.clasprc.json (fallback)
 *
 * Usage:
 *   node scripts/sync-explainers-to-drive.js                  # sync all changed files (git diff)
 *   node scripts/sync-explainers-to-drive.js --all            # force sync all 12 files
 *   node scripts/sync-explainers-to-drive.js --venue waratah  # sync only Waratah
 *   node scripts/sync-explainers-to-drive.js --venue sakura   # sync only Sakura
 *   node scripts/sync-explainers-to-drive.js --dry-run        # show what would sync
 *
 * First-time setup:
 *   1. Share both Drive folders with the service account email as Editor:
 *      claude-sheets-access@quick-asset-465310-h5.iam.gserviceaccount.com
 *   2. Run: node scripts/sync-explainers-to-drive.js --all
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── Configuration ──────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');

const VENUES = {
  waratah: {
    name: 'The Waratah',
    localDir: path.join(REPO_ROOT, 'THE WARATAH', 'FILE EXPLAINERS'),
    driveFolderId: '1145EZJ1CKwl3H8wwWEY9UnZBkZWVgOaZ',
  },
  sakura: {
    name: 'Sakura House',
    localDir: path.join(REPO_ROOT, 'SAKURA HOUSE', 'FILE EXPLAINERS'),
    driveFolderId: '1DB5pcCKWlLrkWshxNHpSNiqyOIQsEz_B',
  },
};

const EXPLAINER_FILES = [
  'DAILY_SHIFT_REPORT.md',
  'WEEKLY_AUTOMATED_EVENTS.md',
  'TASK_MANAGEMENT.md',
  'TROUBLESHOOTING.md',
  'CONFIGURATION_REFERENCE.md',
];

const SA_CREDS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.config', 'gcloud', 'service-account.json'
);

const CLASP_CREDS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.clasprc.json'
);

// ── Service Account JWT Auth ───────────────────────────────────────────────

function base64url(data) {
  return Buffer.from(data).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${signInput}.${signature}`;
}

function getServiceAccountToken(sa) {
  return new Promise((resolve, reject) => {
    const jwt = createJwt(sa);
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString();

    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`SA token failed (${res.statusCode}): ${data}`));
            return;
          }
          resolve(JSON.parse(data).access_token);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Clasp OAuth2 Fallback ──────────────────────────────────────────────────

function refreshClaspToken(creds) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }).toString();

    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Clasp token refresh failed (${res.statusCode}): ${data}`));
            return;
          }
          resolve(JSON.parse(data).access_token);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Unified Auth ───────────────────────────────────────────────────────────

async function getAccessToken() {
  // Try service account first
  if (fs.existsSync(SA_CREDS_PATH)) {
    try {
      const sa = JSON.parse(fs.readFileSync(SA_CREDS_PATH, 'utf8'));
      console.log(`  Auth: service account (${sa.client_email})`);
      const token = await getServiceAccountToken(sa);
      return { token, method: 'service-account' };
    } catch (err) {
      console.log(`  SA auth failed: ${err.message}`);
      console.log('  Falling back to clasp credentials...');
    }
  }

  // Fallback to clasp
  if (fs.existsSync(CLASP_CREDS_PATH)) {
    const creds = JSON.parse(fs.readFileSync(CLASP_CREDS_PATH, 'utf8'));
    const tok = creds.tokens?.default;
    if (tok?.refresh_token && tok?.client_id && tok?.client_secret) {
      console.log('  Auth: clasp OAuth2');
      const token = await refreshClaspToken(tok);
      return { token, method: 'clasp' };
    }
  }

  console.error('Error: No credentials found.');
  console.error('  Option 1: Place service account key at ~/.config/gcloud/service-account.json');
  console.error('  Option 2: Run `clasp login` to create ~/.clasprc.json');
  process.exit(1);
}

// ── Google Drive API Helpers ───────────────────────────────────────────────

function driveApiRequest(method, urlPath, accessToken, body, contentType) {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${accessToken}` };

    if (body && contentType) {
      headers['Content-Type'] = contentType;
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(
      { hostname: 'www.googleapis.com', path: urlPath, method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(
              new Error(`Drive API ${method} failed (${res.statusCode}): ${data}`)
            );
            return;
          }
          resolve(data ? JSON.parse(data) : null);
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function listFilesInFolder(folderId, accessToken) {
  const query = encodeURIComponent(
    `'${folderId}' in parents and trashed = false`
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const result = await driveApiRequest(
    'GET',
    `/drive/v3/files?q=${query}&fields=${fields}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    accessToken
  );
  return result.files || [];
}

async function uploadNewFile(folderId, fileName, content, accessToken) {
  const boundary = '-----MultipartBoundary' + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: 'text/markdown',
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/markdown\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  return driveApiRequest(
    'POST',
    '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    accessToken,
    body,
    `multipart/related; boundary=${boundary}`
  );
}

async function updateExistingFile(fileId, content, accessToken) {
  return driveApiRequest(
    'PATCH',
    `/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    accessToken,
    content,
    'text/markdown'
  );
}

async function deleteFile(fileId, accessToken) {
  return driveApiRequest('DELETE', `/drive/v3/files/${fileId}?supportsAllDrives=true`, accessToken);
}

// ── Git Diff Detection ─────────────────────────────────────────────────────

function getChangedExplainers() {
  try {
    const diffOutput = execSync(
      'git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null',
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    const changedFiles = diffOutput.split('\n').filter(Boolean);
    const explainerChanges = { waratah: [], sakura: [] };

    for (const file of changedFiles) {
      if (file.includes('THE WARATAH/FILE EXPLAINERS/') && file.endsWith('.md')) {
        explainerChanges.waratah.push(path.basename(file));
      }
      if (file.includes('SAKURA HOUSE/FILE EXPLAINERS/') && file.endsWith('.md')) {
        explainerChanges.sakura.push(path.basename(file));
      }
    }

    explainerChanges.waratah = [...new Set(explainerChanges.waratah)];
    explainerChanges.sakura = [...new Set(explainerChanges.sakura)];
    return explainerChanges;
  } catch {
    return { waratah: [], sakura: [] };
  }
}

// ── Sync Logic ─────────────────────────────────────────────────────────────

async function syncVenue(venueKey, filesToSync, accessToken, dryRun) {
  const venue = VENUES[venueKey];
  console.log(`\n--- ${venue.name} ---`);
  console.log(`  Local:  ${venue.localDir}`);
  console.log(`  Drive:  ${venue.driveFolderId}`);

  const driveFiles = await listFilesInFolder(venue.driveFolderId, accessToken);
  const driveFileMap = new Map(driveFiles.map((f) => [f.name, f]));

  let uploaded = 0;
  let updated = 0;
  let deleted = 0;

  for (const fileName of filesToSync) {
    const localPath = path.join(venue.localDir, fileName);

    if (!fs.existsSync(localPath)) {
      const existing = driveFileMap.get(fileName);
      if (existing) {
        if (dryRun) {
          console.log(`  [DRY RUN] Would DELETE ${fileName} (${existing.id})`);
        } else {
          await deleteFile(existing.id, accessToken);
          console.log(`  DELETED  ${fileName}`);
        }
        deleted++;
      }
      continue;
    }

    const content = fs.readFileSync(localPath, 'utf8');
    const existing = driveFileMap.get(fileName);

    if (existing) {
      if (dryRun) {
        console.log(`  [DRY RUN] Would UPDATE ${fileName} (${existing.id})`);
      } else {
        await updateExistingFile(existing.id, content, accessToken);
        console.log(`  UPDATED  ${fileName}`);
      }
      updated++;
    } else {
      if (dryRun) {
        console.log(`  [DRY RUN] Would UPLOAD ${fileName} (new)`);
      } else {
        const result = await uploadNewFile(
          venue.driveFolderId,
          fileName,
          content,
          accessToken
        );
        console.log(`  UPLOADED ${fileName} (${result.id})`);
      }
      uploaded++;
    }
  }

  console.log(`  Summary: ${uploaded} uploaded, ${updated} updated, ${deleted} deleted`);
  return { uploaded, updated, deleted };
}

// ── CLI Entry Point ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes('--all');
  const dryRun = args.includes('--dry-run');
  const venueFlag = args.includes('--venue')
    ? args[args.indexOf('--venue') + 1]?.toLowerCase()
    : null;

  console.log('=== FILE EXPLAINERS -> Google Drive Sync ===');
  if (dryRun) console.log('  (DRY RUN — no changes will be made)\n');

  // Determine which files to sync
  let filesToSync;
  if (syncAll) {
    console.log('Mode: --all (syncing all 5 files per venue)');
    filesToSync = {
      waratah: [...EXPLAINER_FILES],
      sakura: [...EXPLAINER_FILES],
    };
  } else {
    const changed = getChangedExplainers();
    if (changed.waratah.length === 0 && changed.sakura.length === 0) {
      console.log('No FILE EXPLAINER changes detected in git diff.');
      console.log('Use --all to force sync all files.');
      return;
    }
    console.log('Mode: git diff (syncing changed files only)');
    filesToSync = changed;
  }

  if (venueFlag) {
    if (!VENUES[venueFlag]) {
      console.error(`Unknown venue: ${venueFlag}. Use 'waratah' or 'sakura'.`);
      process.exit(1);
    }
    console.log(`Venue filter: ${venueFlag} only`);
    for (const key of Object.keys(filesToSync)) {
      if (key !== venueFlag) filesToSync[key] = [];
    }
  }

  // Authenticate
  console.log('\nAuthenticating...');
  const { token: accessToken, method } = await getAccessToken();
  console.log(`Authenticated via ${method}.\n`);

  // Sync
  const totals = { uploaded: 0, updated: 0, deleted: 0 };

  for (const [venueKey, files] of Object.entries(filesToSync)) {
    if (files.length === 0) {
      console.log(`\n--- ${VENUES[venueKey].name} --- (no changes)`);
      continue;
    }
    const result = await syncVenue(venueKey, files, accessToken, dryRun);
    totals.uploaded += result.uploaded;
    totals.updated += result.updated;
    totals.deleted += result.deleted;
  }

  console.log(
    `\n=== Done: ${totals.uploaded} uploaded, ${totals.updated} updated, ${totals.deleted} deleted ===`
  );
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
