/**
 * FLOW V20 / Flowapp - BACKEND v2.33.0
 * Data integrity backend for Google Sheets.
 *
 * Sheet1 existing columns A:J are preserved.
 * New metadata columns are appended:
 * K categoryId
 * L createdAt
 * M updatedAt
 * N version
 * O deleted
 * P userId
 *
 * IMPORTANT:
 * This improves data integrity and conflict handling.
 * It does NOT provide real authentication. If the Web App deployment
 * is public, anyone who knows the endpoint URL may still call it.
 */

const FLOW_BACKEND_VERSION = '2.33.0';

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowIso_() {
  return new Date().toISOString();
}

function toIso_(value, fallback) {
  if (!value) return fallback || nowIso_();
  const d = new Date(value);
  return isNaN(d.getTime()) ? (fallback || nowIso_()) : d.toISOString();
}

function toVersion_(value) {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

function ensureTransactionHeaders_(sheet) {
  const headers = [
    'id', 'date', 'category', 'sub', 'amount', 'type', 'note',
    'processed', 'rok', 'mesiac',
    'categoryId', 'createdAt', 'updatedAt', 'version', 'deleted', 'userId'
  ];

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const next = headers.map((h, i) => current[i] || h);
  sheet.getRange(1, 1, 1, headers.length).setValues([next]);
}

function findTransactionRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = String(id);

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === target) return i + 2;
  }
  return -1;
}

function transactionFromRow_(row) {
  const fallbackNow = toIso_(row[1], '2000-01-01T00:00:00.000Z');

  return {
    id: String(row[0]),
    date: row[1],
    category: String(row[2] || ''),
    sub: String(row[3] || ''),
    amount: parseFloat(row[4]) || 0,
    type: String(row[5] || 'expense'),
    note: String(row[6] || ''),
    processed:
      row[7] === true ||
      String(row[7]).toUpperCase() === 'TRUE' ||
      String(row[7]).toUpperCase() === 'ÁNO',
    categoryId: String(row[10] || ''),
    createdAt: toIso_(row[11], fallbackNow),
    updatedAt: toIso_(row[12], row[11] || fallbackNow),
    version: toVersion_(row[13]),
    deleted:
      row[14] === true ||
      String(row[14]).toUpperCase() === 'TRUE' ||
      String(row[14]).toUpperCase() === 'ÁNO',
    userId: String(row[15] || 'default'),
    user: String(row[15] || 'default')
  };
}

function transactionRow_(item, existing) {
  const now = nowIso_();
  const createdAt = toIso_(item.createdAt, existing ? existing.createdAt : now);
  const updatedAt = toIso_(item.updatedAt, now);

  const d = new Date(item.date || now);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  return [
    String(item.id),
    item.date || '',
    item.category || '',
    item.sub || '',
    Number(item.amount) || 0,
    item.type || 'expense',
    item.note || '',
    Boolean(item.processed),
    validDate.getFullYear(),
    String(validDate.getMonth() + 1).padStart(2, '0'),
    item.categoryId || (existing ? existing.categoryId : ''),
    createdAt,
    updatedAt,
    toVersion_(item.version),
    Boolean(item.deleted),
    item.userId || item.user || (existing ? existing.userId : 'default')
  ];
}

function compareIncoming_(item, existing) {
  if (!existing) return 1;

  const incomingVersion = toVersion_(item.version);
  const currentVersion = toVersion_(existing.version);

  if (incomingVersion !== currentVersion) {
    return incomingVersion > currentVersion ? 1 : -1;
  }

  const incomingTime = new Date(item.updatedAt || 0).getTime() || 0;
  const currentTime = new Date(existing.updatedAt || 0).getTime() || 0;

  if (incomingTime === currentTime) return 0;
  return incomingTime > currentTime ? 1 : -1;
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const get = e && e.parameter ? e.parameter.get : '';

  try {
    if (get === 'transactions') {
      const sheet = ss.getSheetByName('Sheet1');
      if (!sheet) return json_({ status: 'error', message: 'Sheet1 not found' });

      ensureTransactionHeaders_(sheet);

      const data = sheet.getDataRange().getValues();
      const result = data.slice(1)
        .filter(row => row[0])
        .map(transactionFromRow_);

      return json_(result);
    }

    if (get === 'categories') {
      const sheet = ss.getSheetByName('Categories');
      if (!sheet || sheet.getLastRow() < 2) return json_([]);

      const content = String(sheet.getRange(2, 1).getValue() || '');
      let categories = [];

      try {
        categories = content ? JSON.parse(content) : [];
      } catch (_) {
        categories = [];
      }

      return json_(Array.isArray(categories) ? categories : []);
    }

    return json_({
      status: 'success',
      backend: 'Flowapp',
      version: FLOW_BACKEND_VERSION
    });
  } catch (error) {
    return json_({
      status: 'error',
      message: String(error && error.stack ? error.stack : error)
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const item = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (item.action === 'save' || item.action === 'delete') {
      const sheet = ss.getSheetByName('Sheet1');
      if (!sheet) return json_({ status: 'error', message: 'Sheet1 not found' });

      ensureTransactionHeaders_(sheet);

      if (!item.id) {
        return json_({ status: 'error', message: 'Missing transaction id' });
      }

      const rowIndex = findTransactionRow_(sheet, item.id);
      const existing = rowIndex > -1
        ? transactionFromRow_(sheet.getRange(rowIndex, 1, 1, 16).getValues()[0])
        : null;

      const incoming = {
        ...item,
        deleted: item.action === 'delete' ? true : Boolean(item.deleted),
        version: toVersion_(item.version),
        updatedAt: toIso_(item.updatedAt, nowIso_())
      };

      const comparison = compareIncoming_(incoming, existing);

      if (comparison < 0) {
        return json_({
          status: 'conflict',
          reason: 'server_newer',
          id: String(item.id),
          server: existing
        });
      }

      if (comparison === 0 && existing) {
        return json_({
          status: 'success',
          result: 'already_current',
          id: String(item.id),
          server: existing
        });
      }

      const row = transactionRow_(incoming, existing);

      if (rowIndex > -1) {
        sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }

      return json_({
        status: 'success',
        result: item.action === 'delete' ? 'deleted' : 'saved',
        id: String(item.id),
        version: incoming.version,
        updatedAt: incoming.updatedAt
      });
    }

    if (item.action === 'sync_categories') {
      const sheet = ss.getSheetByName('Categories');
      if (!sheet) return json_({ status: 'error', message: 'Categories sheet not found' });

      const incomingVersion = toVersion_(item.version);
      const incomingUpdatedAt = toIso_(item.updatedAt, nowIso_());

      if (sheet.getMaxColumns() < 3) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), 3 - sheet.getMaxColumns());
      }

      if (sheet.getLastRow() < 1) sheet.insertRows(1);
      sheet.getRange(1, 1, 1, 3).setValues([['Data', 'Version', 'UpdatedAt']]);

      const serverVersion = toVersion_(sheet.getRange(2, 2).getValue());
      const serverUpdatedAt = toIso_(sheet.getRange(2, 3).getValue(), '1970-01-01T00:00:00.000Z');

      if (incomingVersion < serverVersion ||
          (incomingVersion === serverVersion &&
           new Date(incomingUpdatedAt).getTime() <= new Date(serverUpdatedAt).getTime())) {
        return json_({
          status: 'conflict',
          reason: 'server_newer',
          version: serverVersion,
          updatedAt: serverUpdatedAt
        });
      }

      sheet.getRange(2, 1, 1, 3).setValues([[
        JSON.stringify(Array.isArray(item.categories) ? item.categories : []),
        incomingVersion,
        incomingUpdatedAt
      ]]);

      return json_({
        status: 'success',
        result: 'categories_saved',
        version: incomingVersion,
        updatedAt: incomingUpdatedAt
      });
    }

    return json_({ status: 'error', message: 'Unknown action' });

  } catch (error) {
    return json_({
      status: 'error',
      message: String(error && error.stack ? error.stack : error)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
