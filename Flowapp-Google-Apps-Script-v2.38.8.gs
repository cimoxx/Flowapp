/**
 * FLOW V20 / Flowapp - BACKEND v2.35.0
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

const FLOW_BACKEND_VERSION = '2.38.8';
const FLOW_API_TOKEN = 'XMdXUXce7yB6d8mle2v_o78BUhNKvR4WOcfN9g5hWg';

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


function validToken_(eOrItem) {
  const token = eOrItem && eOrItem.parameter ? eOrItem.parameter.token : (eOrItem ? eOrItem.token : '');
  return !FLOW_API_TOKEN || String(token || '') === FLOW_API_TOKEN;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  if (sheet.getLastRow() < 1) sheet.insertRows(1);
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  return sheet;
}

const PLANNING_HEADERS_ = {
  recurring: ['id','name','category','categoryId','sub','amount','type','frequency','dayOfMonth','startDate','endDate','active','amountMode','notes','createdAt','updatedAt','version'],
  event: ['id','date','title','amount','type','category','categoryId','sub','notes','createdAt','updatedAt','version','deleted'],
  override: ['id','monthKey','category','amount','notes','createdAt','updatedAt','version','deleted'],
  archive: ['id','targetMonth','category','forecastAmount','budgetAmount','actualAmount','modelVersion','generatedAt','dataMonths','confidence','method','inputsJson','errorAmount','absoluteError','errorPct','evaluatedAt','backtest','dataYears','seasonalYears','actualVariableAmount','recurringBaseline'],
  model: ['key','value','updatedAt']
};

function planningSheet_(ss, type) { return ensureSheet_(ss, type === 'recurring' ? 'FlowRecurringPlans' : type === 'event' ? 'FlowPlannedEvents' : 'FlowBudgetOverrides', PLANNING_HEADERS_[type]); }

function objectToRow_(type, obj) {
  const h = PLANNING_HEADERS_[type];
  return h.map(k => obj[k] !== undefined ? obj[k] : '');
}

function rowToObject_(headers, row) {
  const o = {}; headers.forEach((h,i) => o[h] = row[i]); return o;
}

function findById_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  for (let i=0;i<ids.length;i++) if (String(ids[i][0]) === String(id)) return i+2;
  return -1;
}

function getPlanningData_(ss, archiveModel) {
  const out = { recurring: [], events: [], overrides: [], archive: [], modelState: {} };
  ['recurring','event','override'].forEach(type => {
    const sheet = planningSheet_(ss,type);
    if (sheet.getLastRow() >= 2) {
      const rows = sheet.getRange(2,1,sheet.getLastRow()-1,PLANNING_HEADERS_[type].length).getValues();
      const arr = rows.filter(r => r[0]).map(r => rowToObject_(PLANNING_HEADERS_[type],r)).filter(o => o.deleted !== true && String(o.deleted).toUpperCase() !== 'TRUE');
      if(type==='recurring') out.recurring=arr;
      if(type==='event') out.events=arr;
      if(type==='override') out.overrides=arr;
    }
  });
  const archive = ensureSheet_(ss,'FlowForecastArchive',PLANNING_HEADERS_.archive);
  if (archive.getLastRow() >= 2) {
    const archiveRows = archive.getRange(2,1,archive.getLastRow()-1,PLANNING_HEADERS_.archive.length).getValues().filter(r=>r[0]);
    const modelIndex = PLANNING_HEADERS_.archive.indexOf('modelVersion');
    const filtered = archiveModel
      ? archiveRows.filter(r => String(r[modelIndex] || '') === String(archiveModel))
      : archiveRows;
    out.archive = filtered.map(r=>rowToObject_(PLANNING_HEADERS_.archive,r));
  }
  const model = ensureSheet_(ss,'FlowModelState',PLANNING_HEADERS_.model);
  if (model.getLastRow() >= 2) {
    model.getRange(2,1,model.getLastRow()-1,3).getValues().filter(r=>r[0]).forEach(r=>out.modelState[String(r[0])] = r[1]);
  }
  return out;
}

function savePlanning_(ss, type, entity) {
  const sheet = planningSheet_(ss,type);
  const row = objectToRow_(type, entity);
  const index = findById_(sheet, entity.id);
  if (index > -1) sheet.getRange(index,1,1,row.length).setValues([row]);
  else sheet.appendRow(row);
  return { status:'success', result:'saved', id:String(entity.id) };
}

function deletePlanning_(ss, type, entity) {
  entity.deleted = true;
  entity.updatedAt = new Date().toISOString();
  entity.version = Math.max(1, Number(entity.version)||1);
  return savePlanning_(ss,type,entity);
}

function archiveForecasts_(ss, rows) {
  const sheet = ensureSheet_(ss,'FlowForecastArchive',PLANNING_HEADERS_.archive);
  if (!Array.isArray(rows) || !rows.length) return { status:'success', saved:0 };
  const headers = PLANNING_HEADERS_.archive;
  const last = sheet.getLastRow();
  const existingRows = last >= 2 ? sheet.getRange(2,1,last-1,headers.length).getValues() : [];
  const rowById = new Map();
  existingRows.forEach((r,i)=>{ if(r[0]) rowById.set(String(r[0]), i+2); });

  const updates=[];
  const inserts=[];
  rows.filter(r=>r && r.id).forEach(r=>{
    const row=objectToRow_('archive',r);
    const idx=rowById.get(String(r.id));
    if(idx) updates.push({idx,row}); else inserts.push(row);
  });
  updates.forEach(u=>sheet.getRange(u.idx,1,1,headers.length).setValues([u.row]));
  if(inserts.length) sheet.getRange(sheet.getLastRow()+1,1,inserts.length,headers.length).setValues(inserts);
  return { status:'success', saved:updates.length+inserts.length };
}

function processTransactionMutation_(ss, item) {
  const sheet = ss.getSheetByName('Sheet1');
  if (!sheet) return { status:'error', message:'Sheet1 not found', id:String(item.id||'') };
  ensureTransactionHeaders_(sheet);
  if (!item.id) return { status:'error', message:'Missing transaction id' };
  const rowIndex = findTransactionRow_(sheet,item.id);
  const existing = rowIndex > -1 ? transactionFromRow_(sheet.getRange(rowIndex,1,1,16).getValues()[0]) : null;
  const incoming = { ...item, deleted:item.action==='delete' ? true : Boolean(item.deleted), version:toVersion_(item.version), updatedAt:toIso_(item.updatedAt,nowIso_()) };
  const comparison = compareIncoming_(incoming,existing);
  if(comparison<0) return { status:'conflict', reason:'server_newer', id:String(item.id), server:existing };
  if(comparison===0 && existing) return { status:'already_current', id:String(item.id), server:existing };
  const row = transactionRow_(incoming,existing);
  if(rowIndex>-1) sheet.getRange(rowIndex,1,1,row.length).setValues([row]); else sheet.appendRow(row);
  return { status:'success', result:item.action==='delete'?'deleted':'saved', id:String(item.id), version:incoming.version, updatedAt:incoming.updatedAt };
}

function doGet(e) {
  if (!validToken_(e)) return json_({ status:'error', message:'Unauthorized' });
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

    if (get === 'planning') {
      return json_(getPlanningData_(ss, e.parameter.archiveModel || ''));
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
    if (!validToken_(item)) return json_({ status:'error', message:'Unauthorized' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (item.action === 'batchSync') {
      const items = Array.isArray(item.items) ? item.items : [];
      const results = items.map(entry => processTransactionMutation_(ss, entry));
      return json_({ status:'success', results });
    }

    if (item.action === 'save' || item.action === 'delete') {
      return json_(processTransactionMutation_(ss, item));
    }

    if (item.action === 'savePlanning' || item.action === 'deletePlanning') {
      const type = String(item.type || '');
      if (!['recurring','event','override'].includes(type)) return json_({status:'error',message:'Invalid planning type'});
      if (!item.entity || !item.entity.id) return json_({status:'error',message:'Missing planning entity'});
      const result = item.action === 'deletePlanning' ? deletePlanning_(ss,type,item.entity) : savePlanning_(ss,type,item.entity);
      return json_(result);
    }

    if (item.action === 'archiveForecasts') {
      return json_(archiveForecasts_(ss, item.rows || []));
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
