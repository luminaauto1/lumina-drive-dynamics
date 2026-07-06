/**
 * Application Sheet Lumina -> Lumina Auto website sync.
 *
 * Reads rows from the "New Applications" tab, POSTs them in batches to the
 * sheet-apps-receiver Supabase edge function, and MOVES successfully processed
 * rows to the "Apps in website" tab (created automatically on first run).
 * Rows that fail stay in "New Applications" and retry on the next run.
 *
 * Install (one time):
 *   1. Open the spreadsheet -> Extensions -> Apps Script.
 *   2. Paste this whole file into Code.gs (replace anything there).
 *   3. In Project Settings -> Script properties, add:
 *        SYNC_SECRET = <the SHEET_SYNC_SECRET value>
 *   4. Run setupTriggers() once (grant permissions when asked).
 *   5. Run syncNewApplications() once to start draining the backlog.
 *
 * The website answers per row:
 *   created  -> new app on the website (Pipeline -> New Applications, source WhatsApp)
 *   updated/exists -> the person already had an app; blanks were filled, status untouched
 *   skipped  -> row has no usable name/phone (moved out with reason so the queue drains)
 *   error    -> temporary failure; row stays and retries next run
 */

var ENDPOINT = 'https://gkghazemorbxmzzcbaty.supabase.co/functions/v1/sheet-apps-receiver';
var SOURCE_TAB = 'New Applications';
var DEST_TAB = 'Apps in website';
var BATCH_SIZE = 40;
var MAX_ROWS_PER_RUN = 200; // stays well inside Apps Script's 6-minute limit

// Owner decision (2026-07-06): rows above 507 are the pre-website backlog and
// must NEVER be sent or moved. Only sheet row 507 and below sync. As synced
// rows are moved out, new arrivals land right below the frozen backlog and
// keep being picked up. Do not sort or delete rows in the backlog block.
var START_ROW = 507;

// Sheet column order (A..W). Header typos intentionally match the sheet.
var COLUMN_KEYS = [
  'fullName', 'surname', 'phone', 'email', 'idNumber', 'qualification',
  'street', 'province', 'city', 'areaCode', 'timeAtAddress', 'kinName',
  'kinNumber', 'company', 'jobTitle', 'duration', 'workAddress', 'gross',
  'net', 'expenses', 'bank', 'accountNumber', 'accountType',
];

function setupTriggers() {
  // Clear previous copies of our triggers so re-running is safe.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncNewApplications') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncNewApplications').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('syncNewApplications')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();
}

function syncNewApplications() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // another run is busy

  try {
    var secret = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
    if (!secret) throw new Error('Script property SYNC_SECRET is not set.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var source = ss.getSheetByName(SOURCE_TAB);
    if (!source) throw new Error('Tab "' + SOURCE_TAB + '" not found.');

    var lastRow = source.getLastRow();
    if (lastRow < START_ROW) return; // nothing at or below the sync boundary

    // Display values: keeps ID numbers / account numbers exactly as shown,
    // no scientific notation or float mangling.
    var numRows = Math.min(lastRow - START_ROW + 1, MAX_ROWS_PER_RUN);
    var values = source
      .getRange(START_ROW, 1, numRows, COLUMN_KEYS.length)
      .getDisplayValues();

    var dest = ensureDestSheet_(ss, source);
    var moves = []; // { rowIndex (1-based sheet row), outcome }

    for (var start = 0; start < values.length; start += BATCH_SIZE) {
      var slice = values.slice(start, start + BATCH_SIZE);
      var rows = [];
      var sheetRowIndexes = [];

      for (var i = 0; i < slice.length; i++) {
        var v = slice[i];
        if (isRowEmpty_(v)) continue;
        var obj = {};
        for (var c = 0; c < COLUMN_KEYS.length; c++) obj[COLUMN_KEYS[c]] = v[c];
        rows.push(obj);
        sheetRowIndexes.push(START_ROW + start + i);
      }
      if (rows.length === 0) continue;

      var response = UrlFetchApp.fetch(ENDPOINT, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-sync-secret': secret },
        payload: JSON.stringify({ rows: rows }),
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() !== 200) {
        console.error('Sync batch failed: HTTP ' + response.getResponseCode() + ' ' +
          response.getContentText().slice(0, 300));
        break; // leave remaining rows for the next run
      }

      var results = JSON.parse(response.getContentText()).results || [];
      for (var r = 0; r < results.length; r++) {
        var outcome = results[r].outcome;
        // created/updated/exists -> the app is on the website; skipped -> row is
        // unusable and would clog the queue forever, move it out with its reason.
        if (outcome === 'created' || outcome === 'updated' || outcome === 'exists' || outcome === 'skipped') {
          moves.push({
            row: sheetRowIndexes[r],
            outcome: outcome + (results[r].reason ? ' (' + results[r].reason + ')' : ''),
          });
        }
      }
    }

    moveRows_(source, dest, moves);
    if (moves.length) console.log('Synced & moved ' + moves.length + ' row(s).');
  } finally {
    lock.releaseLock();
  }
}

function ensureDestSheet_(ss, source) {
  var dest = ss.getSheetByName(DEST_TAB);
  if (!dest) {
    dest = ss.insertSheet(DEST_TAB);
    var header = source.getRange(1, 1, 1, COLUMN_KEYS.length).getDisplayValues()[0];
    header.push('Synced At', 'Sync Result');
    dest.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  }
  return dest;
}

function moveRows_(source, dest, moves) {
  if (!moves.length) return;
  var stamp = Utilities.formatDate(new Date(), 'Africa/Johannesburg', 'yyyy-MM-dd HH:mm');

  // Append the full row values to the destination tab first...
  var appended = moves.map(function (m) {
    var rowValues = source.getRange(m.row, 1, 1, COLUMN_KEYS.length).getDisplayValues()[0];
    rowValues.push(stamp, m.outcome);
    return rowValues;
  });
  dest
    .getRange(dest.getLastRow() + 1, 1, appended.length, COLUMN_KEYS.length + 2)
    .setValues(appended);

  // ...then delete from the source bottom-up so indexes stay valid.
  moves
    .map(function (m) { return m.row; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (row) { source.deleteRow(row); });
}

function isRowEmpty_(v) {
  // Needs at least a name or a phone to be worth sending.
  return !(String(v[0] || '').trim() || String(v[1] || '').trim() || String(v[2] || '').trim());
}
