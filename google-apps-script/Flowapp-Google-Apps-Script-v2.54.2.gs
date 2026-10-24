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
 * PRIHLÁSENIE (v2.51.0):
 * Prístup k dátam vyžaduje Google prihlásenie. Povolené účty sú v hárku FlowUsers.
 * Po nasadení raz ručne spusti setupFlowAuth (vytvorí hárky a vyžiada povolenia).
 * Starý zdieľaný FLOW_API_TOKEN funguje len počas prechodu; keď prihlásenie v appke
 * funguje, spusti disableLegacyToken. Vrátiť sa dá cez enableLegacyToken.
 */

const FLOW_BACKEND_VERSION = '2.54.2';
// Starý zdieľaný token. Platí iba kým nespustíš disableLegacyToken().
const FLOW_API_TOKEN = 'XMdXUXce7yB6d8mle2v_o78BUhNKvR4WOcfN9g5hWg';

// Google OAuth Web Client ID (Google Cloud → Google Auth Platform → Clients → Flow web).
const FLOW_GOOGLE_CLIENT_ID = '729250002198-q7rnsnqci5nnegi9u12bjvuibe8bfjku.apps.googleusercontent.com';

// Účty, ktoré sa zapíšu do prázdneho hárku FlowUsers. Ďalšie účty sa pridávajú priamo v hárku.
const FLOW_BOOTSTRAP_EMAILS = [
  'lukas.cimerman@gmail.com',
  'zdenka.cimermanova@gmail.com',
  'lukas.slovakia@gmail.com',
  'zdenka.slovakia@gmail.com'
];

// Prihlásenie platí 90 dní a pri používaní sa automaticky predlžuje.
const FLOW_SESSION_DAYS = 90;
const FLOW_SESSION_RENEW_BELOW_DAYS = 60;

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

function categorySignature_(list) {
  const normalized = (Array.isArray(list) ? list : []).map(function(cat) {
    return {
      id: String(cat && cat.id || ''),
      icon: String(cat && cat.icon || ''),
      subs: Array.isArray(cat && cat.subs) ? cat.subs.map(String) : []
    };
  });
  return JSON.stringify(normalized);
}

function legacyGenericDefaultCategories_() {
  return [
    { id: 'Potraviny', icon: 'shopping-cart', subs: ['Billa','Lidl','Kaufland','Tesco','COOP'] },
    { id: 'Byvanie', icon: 'home', subs: ['Najom','Elektrina','Plyn','Voda','Internet'] },
    { id: 'Doprava', icon: 'car', subs: ['Tankovanie','MHD','Servis','Poistka'] },
    { id: 'Zabava', icon: 'gamepad-2', subs: ['Kino','Restauracia','Bar','Streaming'] },
    { id: 'Zdravie', icon: 'heart-pulse', subs: ['Lekaren','Doktor','Poistenie'] },
    { id: 'Oblecenie', icon: 'shirt', subs: ['Topanky','Bunda','Doplnky'] },
    { id: 'Prijem', icon: 'wallet', subs: ['Vyplata','Bonus','Predaj','Ine'] },
    { id: 'Ine', icon: 'package', subs: ['Darcek','Domacnost','Ostatne'] }
  ];
}

function isLegacyGenericDefaultCategories_(list) {
  return categorySignature_(list) === categorySignature_(legacyGenericDefaultCategories_());
}

function readCategoriesState_(ss) {
  const sheet = ss.getSheetByName('Categories');
  if (!sheet || sheet.getLastRow() < 2) {
    return { sheet: sheet, categories: [], version: 1, updatedAt: '1970-01-01T00:00:00.000Z' };
  }
  const content = String(sheet.getRange(2, 1).getValue() || '');
  let categories = [];
  try { categories = content ? JSON.parse(content) : []; } catch (_) { categories = []; }
  return {
    sheet: sheet,
    categories: Array.isArray(categories) ? categories : [],
    version: toVersion_(sheet.getRange(2, 2).getValue()),
    updatedAt: toIso_(sheet.getRange(2, 3).getValue(), '1970-01-01T00:00:00.000Z')
  };
}

function backupCategories_(ss, state, userId, reason) {
  if (!state || !Array.isArray(state.categories) || !state.categories.length) return;
  let sheet = ss.getSheetByName('CategoriesBackup');
  if (!sheet) sheet = ss.insertSheet('CategoriesBackup');
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 6).setValues([['BackedUpAt','Version','UpdatedAt','UserId','Reason','Data']]);
  }
  sheet.appendRow([
    nowIso_(),
    state.version || 1,
    state.updatedAt || '',
    String(userId || ''),
    String(reason || 'before_write'),
    JSON.stringify(state.categories)
  ]);

  // Keep a practical rolling history. Header + last 100 snapshots.
  const lastRow = sheet.getLastRow();
  if (lastRow > 101) sheet.deleteRows(2, lastRow - 101);
}


function ensureBackupLog_(ss) {
  let sheet=ss.getSheetByName('FlowBackups');
  if(!sheet) sheet=ss.insertSheet('FlowBackups');
  if(sheet.getLastRow()<1) sheet.getRange(1,1,1,6).setValues([['CreatedAt','FileId','Name','UserId','Reason','Status']]);
  return sheet;
}
function getBackupState_(ss) {
  const sheet=ss.getSheetByName('FlowBackups');
  if(!sheet||sheet.getLastRow()<2)return {count:0,lastBackupAt:'',lastBackupName:''};
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().filter(r=>String(r[5]||'')==='ok');
  if(!rows.length)return {count:0,lastBackupAt:'',lastBackupName:''};
  rows.sort(function(a,b){ return new Date(a[0]).getTime()-new Date(b[0]).getTime(); });
  const last=rows[rows.length-1];
  return {count:Math.min(rows.length,5),lastBackupAt:toIso_(last[0],''),lastBackupName:String(last[2]||'')};
}
function overwriteBackupSpreadsheet_(sourceSs, targetId, newName) {
  const target=SpreadsheetApp.openById(String(targetId));
  target.rename(newName);

  // A spreadsheet must always contain at least one sheet.
  let temp=target.getSheetByName('__FLOW_TEMP__');
  if(!temp) temp=target.insertSheet('__FLOW_TEMP__');

  target.getSheets().forEach(function(sheet){
    if(sheet.getSheetId()!==temp.getSheetId()) target.deleteSheet(sheet);
  });

  sourceSs.getSheets().forEach(function(sourceSheet){
    const copied=sourceSheet.copyTo(target);
    copied.setName(sourceSheet.getName());
  });

  target.deleteSheet(temp);
  return target;
}

function createFullBackup_(ss,userId,reason) {
  const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Europe/Bratislava','yyyy-MM-dd_HH-mm-ss');
  const name='Flow_Backup_'+stamp;
  const log=ensureBackupLog_(ss);

  let rows=[];
  if(log.getLastRow()>=2){
    rows=log.getRange(2,1,log.getLastRow()-1,6).getValues()
      .map(function(r,idx){return {row:idx+2,data:r};})
      .filter(function(x){return String(x.data[5]||'')==='ok' && x.data[1];})
      .sort(function(a,b){return new Date(a.data[0]).getTime()-new Date(b.data[0]).getTime();});
  }

  let fileId='';
  let reused=false;

  if(rows.length<5){
    const copy=ss.copy(name);
    fileId=copy.getId();
    log.appendRow([nowIso_(),fileId,name,String(userId||''),String(reason||'manual'),'ok']);
  }else{
    // Reuse the oldest backup slot. No sixth backup file is created.
    const oldest=rows[0];
    fileId=String(oldest.data[1]);
    overwriteBackupSpreadsheet_(ss,fileId,name);
    log.getRange(oldest.row,1,1,6).setValues([[nowIso_(),fileId,name,String(userId||''),String(reason||'manual'),'ok']]);
    reused=true;
  }

  return {status:'success',createdAt:nowIso_(),fileId:fileId,name:name,reused:reused,backupCount:5,backendVersion:FLOW_BACKEND_VERSION};
}

function getAutoBackupTrigger_() {
  const triggers=ScriptApp.getProjectTriggers();
  for(let i=0;i<triggers.length;i++){
    if(triggers[i].getHandlerFunction()==='runFlowAutoBackup') return triggers[i];
  }
  return null;
}

function setupAutoBackup_(ss) {
  const props=PropertiesService.getScriptProperties();
  props.setProperty('FLOW_SPREADSHEET_ID', ss.getId());
  let trigger=getAutoBackupTrigger_();
  if(!trigger){
    trigger=ScriptApp.newTrigger('runFlowAutoBackup').timeBased().everyDays(1).atHour(23).create();
  }
  // Read-only health checks must never need ScriptApp permission.
  props.setProperty('FLOW_AUTO_BACKUP_ENABLED','true');
  return {status:'success',enabled:true,backendVersion:FLOW_BACKEND_VERSION};
}

function getAutoBackupState_() {
  // Deliberately does NOT call ScriptApp.getProjectTriggers().
  // This makes data_health safe even when trigger scope has not been authorized.
  const props=PropertiesService.getScriptProperties();
  const value=props.getProperty('FLOW_AUTO_BACKUP_ENABLED');
  return {enabled:value==='true',known:value==='true'||value==='false'};
}

function runFlowAutoBackup() {
  const props=PropertiesService.getScriptProperties();
  const spreadsheetId=props.getProperty('FLOW_SPREADSHEET_ID');
  if(!spreadsheetId) return;

  const now=new Date();
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const isLastDay=tomorrow.getMonth()!==now.getMonth();
  if(!isLastDay) return;

  const ss=SpreadsheetApp.openById(spreadsheetId);
  createFullBackup_(ss,'system','monthly_auto');
}

function normalizeHistoricalText_(value) {
  return String(value == null ? '' : value)
    .trim().toLowerCase()
    .replace(/\s+/g,' ')
    .replace(/\s*\/\s*/g,' / ')
    .replace(/(?:\s*\/\s*dovolenky){2,}$/i,' / dovolenky');
}

function historicalDuplicateSignature_(tx) {
  if (!tx || !/^HIST-/i.test(String(tx.id || ''))) return '';
  const date=String(tx.date || '').slice(0,10);
  const type=normalizeHistoricalText_(tx.type);
  const category=normalizeHistoricalText_(tx.category);
  const sub=normalizeHistoricalText_(tx.sub);
  const note=normalizeHistoricalText_(tx.note);
  const amount=Number(tx.amount);
  if (!date || !category || !Number.isFinite(amount)) return '';
  return [date,type,category,sub,amount.toFixed(2),note].join('|');
}

function historicalSurvivorScore_(tx) {
  let score=0;
  if (String(tx.categoryId || '').trim()) score+=100;
  if (/^cat_stable_/i.test(String(tx.categoryId || ''))) score+=20;
  if (!/\/\s*dovolenky\s*\/\s*dovolenky/i.test(String(tx.id || ''))) score+=5;
  if (String(tx.userId || '') !== 'default') score+=1;
  return score;
}

function auditHistoricalDuplicates_(ss) {
  const sheet=ss.getSheetByName('Sheet1');
  if(!sheet) return {status:'error',message:'Sheet1 not found'};
  ensureTransactionHeaders_(sheet);
  const values=sheet.getDataRange().getValues();
  const groups=new Map();
  values.slice(1).forEach((row,i)=>{
    if(!row[0]) return;
    const tx=transactionFromRow_(row);
    if(tx.deleted) return;
    const signature=historicalDuplicateSignature_(tx);
    if(!signature) return;
    const list=groups.get(signature)||[];
    list.push({rowIndex:i+2,tx:tx});
    groups.set(signature,list);
  });
  const duplicates=[];
  groups.forEach((list,signature)=>{
    if(list.length<2) return;
    const ranked=list.slice().sort((a,b)=>historicalSurvivorScore_(b.tx)-historicalSurvivorScore_(a.tx) || a.rowIndex-b.rowIndex);
    duplicates.push({
      signature:signature,
      keepRow:ranked[0].rowIndex,
      keepId:String(ranked[0].tx.id||''),
      removeRows:ranked.slice(1).map(x=>x.rowIndex),
      removeIds:ranked.slice(1).map(x=>String(x.tx.id||'')),
      date:String(ranked[0].tx.date||''),
      category:String(ranked[0].tx.category||''),
      amount:Number(ranked[0].tx.amount)||0
    });
  });
  const removeCount=duplicates.reduce((n,g)=>n+g.removeRows.length,0);
  return {status:'success',groups:duplicates.length,removeCount:removeCount,duplicates:duplicates.slice(0,25)};
}

function cleanHistoricalDuplicates_(ss,userId,options) {
  const opts=options||{};
  const pending=Number(opts.syncQueueCount)||0;
  if(pending>0){
    return {status:'error',message:'Čistenie zablokované: lokálne zmeny ešte čakajú na synchronizáciu. Sheet1 zostal nezmenený.'};
  }

  const audit=auditHistoricalDuplicates_(ss);
  if(audit.status!=='success') return {...audit,cleaned:0,backup:null};
  if(!audit.removeCount) return {...audit,cleaned:0,backup:null};

  const expected=Number(opts.expectedDuplicateRows);
  if(Number.isFinite(expected) && expected>=0 && expected!==Number(audit.removeCount||0)){
    return {
      status:'error',
      message:`Audit sa medzitým zmenil (${expected} → ${audit.removeCount}). Pre bezpečnosť spusti kontrolu znova. Sheet1 zostal nezmenený.`
    };
  }

  // Safety invariant: never mutate Sheet1 without a successful full backup first.
  const backup=createFullBackup_(ss,userId||'default','before_historical_dedup');
  if(!backup || backup.status!=='success'){
    return {status:'error',message:'Bezpečnostná záloha zlyhala. Sheet1 zostal nezmenený.',backup:backup||null};
  }

  // Re-audit AFTER backup. If data changed during backup, abort rather than deleting
  // rows based on stale row indexes.
  const afterBackupAudit=auditHistoricalDuplicates_(ss);
  if(afterBackupAudit.status!=='success' || Number(afterBackupAudit.removeCount||0)!==Number(audit.removeCount||0)){
    return {
      status:'error',
      message:'Dáta sa počas zálohy zmenili. Čistenie bolo z bezpečnostných dôvodov zastavené; záloha je vytvorená, Sheet1 zostal nezmenený.',
      backup:backup
    };
  }

  const sheet=ss.getSheetByName('Sheet1');
  const values=sheet.getDataRange().getValues();
  const groups=new Map();

  values.slice(1).forEach((row,i)=>{
    if(!row[0]) return;
    const tx=transactionFromRow_(row);
    if(tx.deleted) return;
    const sig=historicalDuplicateSignature_(tx);
    if(!sig) return;
    const list=groups.get(sig)||[];
    list.push({rowIndex:i+2,tx:tx});
    groups.set(sig,list);
  });

  const allRows=[];
  const removedIds=[];
  groups.forEach(list=>{
    if(list.length<2) return;
    const ranked=list.slice().sort((a,b)=>historicalSurvivorScore_(b.tx)-historicalSurvivorScore_(a.tx) || a.rowIndex-b.rowIndex);
    ranked.slice(1).forEach(x=>{
      allRows.push(x.rowIndex);
      removedIds.push(String(x.tx.id||''));
    });
  });

  const uniqueRows=[...new Set(allRows)].sort((a,b)=>b-a);
  const uniqueRemovedIds=[...new Set(removedIds.filter(Boolean))];

  // Persist cloud tombstones BEFORE deleting rows. If an old phone/browser later
  // tries to upload one of these HIST ids, the backend refuses to recreate it.
  addHistoricalTombstones_(ss,uniqueRemovedIds,'historical_dedup');

  uniqueRows.forEach(rowIndex=>sheet.deleteRow(rowIndex));

  const remaining=auditHistoricalDuplicates_(ss).removeCount || 0;
  return {
    status:'success',
    cleaned:uniqueRows.length,
    groups:audit.groups,
    backup:backup,
    remaining:remaining,
    removedIds:uniqueRemovedIds
  };
}

function getDataHealth_(ss) {
  // Read-only health check. Do not call getPlanningData_ here because that
  // helper may create missing planning sheets and makes a simple status check heavier.
  const tx=ss.getSheetByName('Sheet1');
  const cat=readCategoriesState_(ss);
  const recurring=ss.getSheetByName('FlowRecurringPlans');
  const events=ss.getSheetByName('FlowPlannedEvents');
  const backup=getBackupState_(ss);

  return {
    status:'success',
    backendVersion:FLOW_BACKEND_VERSION,
    transactions:tx?Math.max(0,tx.getLastRow()-1):0,
    categories:Array.isArray(cat.categories)?cat.categories.length:0,
    recurring:recurring?Math.max(0,recurring.getLastRow()-1):0,
    events:events?Math.max(0,events.getLastRow()-1):0,
    lastBackupAt:backup.lastBackupAt,
    lastBackupName:backup.lastBackupName,
    backupCount:backup.count,
    autoBackupEnabled:getAutoBackupState_().known ? getAutoBackupState_().enabled : null,
    historicalDuplicateRows:auditHistoricalDuplicates_(ss).removeCount || 0
  };
}

function ensureTransactionHeaders_(sheet) {
  const headers = [
    'id', 'date', 'category', 'sub', 'amount', 'type', 'note',
    'processed', 'rok', 'mesiac',
    'categoryId', 'createdAt', 'updatedAt', 'version', 'deleted', 'userId',
    'isRecurring', 'frequency', 'recurringPlanId'
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

// Index id -> číslo riadku načítaný raz pre celý batch (predtým sa celý stĺpec ID
// čítal znova pri každej položke). Pri duplicitnom ID platí prvý riadok, ako vo findTransactionRow_.
function buildTransactionRowIndex_(sheet) {
  const index = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return index;
  sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(row, i) {
    const id = String(row[0]);
    if (id && !index.has(id)) index.set(id, i + 2);
  });
  return index;
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
    user: String(row[15] || 'default'),
    isRecurring:
      row[16] === true ||
      String(row[16]).toUpperCase() === 'TRUE' ||
      String(row[16]).toUpperCase() === 'ÁNO',
    frequency: String(row[17] || ''),
    recurringPlanId: String(row[18] || '')
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
    item.userId || item.user || (existing ? existing.userId : 'default'),
    item.isRecurring !== undefined ? Boolean(item.isRecurring) : Boolean(existing && existing.isRecurring),
    item.frequency !== undefined ? String(item.frequency || '') : String(existing && existing.frequency || ''),
    item.recurringPlanId !== undefined ? String(item.recurringPlanId || '') : String(existing && existing.recurringPlanId || '')
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


// ---------------------------------------------------------------------------
// Google prihlásenie
// ---------------------------------------------------------------------------

function ensureAuthSheets_(ss) {
  const users=ensureSheet_(ss,'FlowUsers',['Email','GoogleSub','Name','Role','Active','LastLogin']);
  const sessions=ensureSheet_(ss,'FlowSessions',['TokenHash','GoogleSub','Email','Name','Picture','ExpiresAt','Active','CreatedAt']);
  return {users:users,sessions:sessions};
}

function bootstrapFlowUsers_(sheets) {
  // Iba do prázdneho hárku: zmazaný alebo vypnutý účet sa nesmie sám vrátiť.
  if (sheets.users.getLastRow() > 1) return 0;
  const emails=[...new Set(FLOW_BOOTSTRAP_EMAILS.map(function(e){return String(e||'').trim().toLowerCase();}).filter(Boolean))];
  if (!emails.length) return 0;
  const rows=emails.map(function(email,i){return [email,'','',i===0?'owner':'member',true,''];});
  sheets.users.getRange(2,1,rows.length,6).setValues(rows);
  return rows.length;
}

// Spusti raz ručne v Apps Script editore: vytvorí FlowUsers/FlowSessions a vyžiada povolenie
// na volanie Google (overenie prihlásenia).
function setupFlowAuth() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sheets=ensureAuthSheets_(ss);
  const added=bootstrapFlowUsers_(sheets);
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo',{muteHttpExceptions:true});
  const result={users:Math.max(0,sheets.users.getLastRow()-1),added:added,legacyTokenEnabled:legacyTokenEnabled_()};
  Logger.log(JSON.stringify(result));
  return result;
}

function legacyTokenEnabled_() {
  return PropertiesService.getScriptProperties().getProperty('FLOW_LEGACY_TOKEN_DISABLED')!=='true';
}

// Spusti, keď prihlásenie v appke funguje na všetkých zariadeniach. Starý token prestane platiť.
function disableLegacyToken() {
  PropertiesService.getScriptProperties().setProperty('FLOW_LEGACY_TOKEN_DISABLED','true');
  Logger.log('Starý token je vypnutý.');
}

function enableLegacyToken() {
  PropertiesService.getScriptProperties().deleteProperty('FLOW_LEGACY_TOKEN_DISABLED');
  Logger.log('Starý token znova platí.');
}

function hashSessionToken_(token) {
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(token||''),Utilities.Charset.UTF_8);
  return bytes.map(function(b){const n=(b+256)%256;return ('0'+n.toString(16)).slice(-2);}).join('');
}

function verifyGoogleIdToken_(credential) {
  if(!credential) throw new Error('Chýba Google credential');
  // tokeninfo overí podpis aj platnosť ID tokenu priamo u Google.
  const url='https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(String(credential));
  const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200) throw new Error('Google účet sa nepodarilo overiť');
  const payload=JSON.parse(response.getContentText()||'{}');

  if(String(payload.aud||'')!==FLOW_GOOGLE_CLIENT_ID) throw new Error('Neplatný Google Client ID');
  if(['accounts.google.com','https://accounts.google.com'].indexOf(String(payload.iss||''))<0) throw new Error('Neplatný vydavateľ Google tokenu');
  if(Number(payload.exp||0)*1000<=Date.now()) throw new Error('Google prihlásenie vypršalo');
  if(String(payload.email_verified)!=='true') throw new Error('Google email nie je overený');

  return {
    sub:String(payload.sub||''),
    email:String(payload.email||'').trim().toLowerCase(),
    name:String(payload.name||payload.given_name||payload.email||'Google účet'),
    picture:String(payload.picture||'')
  };
}

function getAuthorizedUser_(ss,googleUser) {
  const sheets=ensureAuthSheets_(ss);
  bootstrapFlowUsers_(sheets);
  if(sheets.users.getLastRow()<2) return null;
  const rows=sheets.users.getRange(2,1,sheets.users.getLastRow()-1,6).getValues();

  let matchIndex=-1;
  for(let i=0;i<rows.length;i++){
    const email=String(rows[i][0]||'').trim().toLowerCase();
    const sub=String(rows[i][1]||'').trim();
    const active=rows[i][4]===true || String(rows[i][4]).toLowerCase()==='true';
    if(!active) continue;
    if(sub && sub===googleUser.sub){matchIndex=i;break;}
    if(!sub && email && email===googleUser.email){matchIndex=i;break;}
  }
  if(matchIndex<0) return null;

  const row=rows[matchIndex];
  // Pri prvom prihlásení sa účet natrvalo spáruje cez stabilné Google `sub`.
  if(!String(row[1]||'').trim()) sheets.users.getRange(matchIndex+2,2).setValue(googleUser.sub);
  sheets.users.getRange(matchIndex+2,3).setValue(googleUser.name);
  sheets.users.getRange(matchIndex+2,6).setValue(nowIso_());

  return {sub:googleUser.sub,email:googleUser.email,name:googleUser.name,picture:googleUser.picture,role:String(row[3]||'member')};
}

function isActiveFlowUser_(ss,sub) {
  const sheet=ss.getSheetByName('FlowUsers');
  if(!sub || !sheet || sheet.getLastRow()<2) return false;
  return sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().some(function(row){
    const active=row[4]===true || String(row[4]).toLowerCase()==='true';
    return active && String(row[1]||'').trim()===sub;
  });
}

function createFlowSession_(ss,user) {
  const sheets=ensureAuthSheets_(ss);
  const raw=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();
  const expires=new Date(Date.now()+FLOW_SESSION_DAYS*86400000).toISOString();
  sheets.sessions.appendRow([hashSessionToken_(raw),user.sub,user.email,user.name,user.picture,expires,true,nowIso_()]);
  return {token:raw,expiresAt:expires};
}

function getSessionUser_(ss,token) {
  if(!token) return null;
  const cache=CacheService.getScriptCache();
  const hash=hashSessionToken_(token);
  const cached=cache.get('flow_session_'+hash);
  if(cached){try{return JSON.parse(cached);}catch(_){}}

  const sheet=ss.getSheetByName('FlowSessions');
  if(!sheet || sheet.getLastRow()<2) return null;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  for(let i=rows.length-1;i>=0;i--){
    if(String(rows[i][0]||'')!==hash) continue;
    const active=rows[i][6]===true || String(rows[i][6]).toLowerCase()==='true';
    const expires=new Date(rows[i][5]).getTime();
    if(!active || !Number.isFinite(expires) || expires<=Date.now()) return null;
    // Vypnutý účet (Active = FALSE vo FlowUsers) stráca prístup aj na prihlásených zariadeniach.
    if(!isActiveFlowUser_(ss,String(rows[i][1]||''))) return null;
    // Používané prihlásenie sa predlžuje, aby sa nebolo treba často prihlasovať znova.
    if(expires-Date.now()<FLOW_SESSION_RENEW_BELOW_DAYS*86400000){
      sheet.getRange(i+2,6).setValue(new Date(Date.now()+FLOW_SESSION_DAYS*86400000).toISOString());
    }
    const user={sub:String(rows[i][1]||''),email:String(rows[i][2]||''),name:String(rows[i][3]||''),picture:String(rows[i][4]||'')};
    cache.put('flow_session_'+hash,JSON.stringify(user),600);
    return user;
  }
  return null;
}

function revokeFlowSession_(ss,token) {
  if(!token) return false;
  const hash=hashSessionToken_(token);
  CacheService.getScriptCache().remove('flow_session_'+hash);
  const sheet=ss.getSheetByName('FlowSessions');
  if(!sheet || sheet.getLastRow()<2) return false;
  const hashes=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  for(let i=0;i<hashes.length;i++){
    if(String(hashes[i][0]||'')===hash){sheet.getRange(i+2,7).setValue(false);return true;}
  }
  return false;
}

function getRequestToken_(eOrItem) {
  return eOrItem && eOrItem.parameter ? String(eOrItem.parameter.token||'') : String(eOrItem&&eOrItem.token||'');
}

function processGoogleLogin_(ss,credential) {
  try {
    const googleUser=verifyGoogleIdToken_(credential);
    const user=getAuthorizedUser_(ss,googleUser);
    if(!user) return {status:'error',code:'not_allowed',message:'Účet '+googleUser.email+' nemá povolený prístup do Flow.'};
    const session=createFlowSession_(ss,user);
    return {status:'success',sessionToken:session.token,expiresAt:session.expiresAt,user:user,backendVersion:FLOW_BACKEND_VERSION};
  } catch (error) {
    return {status:'error',code:'login_failed',message:String(error && error.message ? error.message : error)};
  }
}

function unauthorized_() {
  return json_({ status:'error', code:'unauthorized', message:'Unauthorized' });
}

function validToken_(eOrItem) {
  const token=getRequestToken_(eOrItem);
  if(!token) return false;
  if(legacyTokenEnabled_() && FLOW_API_TOKEN && token===FLOW_API_TOKEN) return true;
  return Boolean(getSessionUser_(SpreadsheetApp.getActiveSpreadsheet(),token));
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  if (sheet.getLastRow() < 1) sheet.insertRows(1);
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  return sheet;
}

const FLOW_PLAN_ACCURACY_HEADERS_ = ['targetMonth','budgetAmount','forecastAmount','modelVersion','createdAt','updatedAt'];

const PLANNING_HEADERS_ = {
  recurring: ['id','name','category','categoryId','sub','amount','type','frequency','dayOfMonth','startDate','endDate','active','amountMode','notes','createdAt','updatedAt','version'],
  event: ['id','date','title','amount','type','category','categoryId','sub','notes','createdAt','updatedAt','version','deleted','status','matchedTransactionId','completedAt'],
  override: ['id','monthKey','category','amount','notes','createdAt','updatedAt','version','deleted'],
  archive: ['id','targetMonth','category','forecastAmount','budgetAmount','actualAmount','modelVersion','generatedAt','dataMonths','confidence','method','inputsJson','errorAmount','absoluteError','errorPct','evaluatedAt','backtest','dataYears','seasonalYears','actualVariableAmount','recurringBaseline'],
  model: ['key','value','updatedAt']
};

function planningSheet_(ss, type) { return ensureSheet_(ss, type === 'recurring' ? 'FlowRecurringPlans' : type === 'event' ? 'FlowPlannedEvents' : 'FlowBudgetOverrides', PLANNING_HEADERS_[type]); }

function objectToRow_(type, obj) {
  const h = PLANNING_HEADERS_[type];
  return h.map(k => obj[k] !== undefined ? obj[k] : '');
}

// v2.54.0: kľúč mesiaca je vždy text YYYY-MM. Google Sheets ho z textu rád urobí dátum
// (a naspäť ho vracia ako ISO časovú značku), čo rozbíjalo párovanie porovnaní odhad vs. skutočnosť.
function flowTimeZone_() {
  try { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }
  catch (_) { return Session.getScriptTimeZone(); }
}

function normalizeMonthKey_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, flowTimeZone_(), 'yyyy-MM');
  const s = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : Utilities.formatDate(d, flowTimeZone_(), 'yyyy-MM');
}

function rowToObject_(headers, row) {
  const o = {};
  headers.forEach((h,i) => {
    let v = row[i];
    if (h === 'targetMonth' || h === 'monthKey') v = normalizeMonthKey_(v);
    // v2.49.21: Sheets converts YYYY-MM-DD text into Date cells. Return plan
    // dates as plain YYYY-MM-DD strings, otherwise the client cannot parse them.
    if ((h === 'startDate' || h === 'endDate') && v instanceof Date && !isNaN(v.getTime())) {
      v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    o[h] = v;
  });
  return o;
}

function findById_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  for (let i=0;i<ids.length;i++) if (String(ids[i][0]) === String(id)) return i+2;
  return -1;
}

function getPlanningData_(ss, archiveModel) {
  const out = { recurring: [], events: [], overrides: [], archive: [], accuracy: [], snapshots: [], modelState: {} };
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
  const accuracy = ensureSheet_(ss,'FlowPlanAccuracy',FLOW_PLAN_ACCURACY_HEADERS_);
  if (accuracy.getLastRow() >= 2) {
    out.accuracy = accuracy.getRange(2,1,accuracy.getLastRow()-1,FLOW_PLAN_ACCURACY_HEADERS_.length)
      .getValues().filter(r=>r[0]).map(r=>{
        const o={};
        FLOW_PLAN_ACCURACY_HEADERS_.forEach((h,i)=>o[h]=r[i]);
        return o;
      });
  }

  out.snapshots = readMonthSnapshots_(ss);

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
  const targetRow = index > -1 ? index : sheet.getLastRow() + 1;
  if (type === 'recurring') {
    // Keep startDate/endDate (columns J:K) as text so Sheets does not turn them into Dates.
    sheet.getRange(targetRow, 10, 1, 2).setNumberFormat('@');
  }
  sheet.getRange(targetRow,1,1,row.length).setValues([row]);
  return { status:'success', result:'saved', id:String(entity.id) };
}

function deletePlanning_(ss, type, entity) {
  entity.deleted = true;
  entity.updatedAt = new Date().toISOString();
  entity.version = Math.max(1, Number(entity.version)||1);
  return savePlanning_(ss,type,entity);
}

function savePlanAccuracySnapshot_(ss, item) {
  const key=String(item && item.targetMonth || '');
  if(!/^\d{4}-\d{2}$/.test(key)) return {status:'error',message:'Invalid targetMonth'};

  const sheet=ensureSheet_(ss,'FlowPlanAccuracy',FLOW_PLAN_ACCURACY_HEADERS_);
  const last=sheet.getLastRow();
  if(last>=2){
    const keys=sheet.getRange(2,1,last-1,1).getValues();
    for(let i=0;i<keys.length;i++){
      if(String(keys[i][0]||'')===key){
        const values=sheet.getRange(i+2,1,1,FLOW_PLAN_ACCURACY_HEADERS_.length).getValues()[0];
        const row={};
        FLOW_PLAN_ACCURACY_HEADERS_.forEach((h,j)=>row[h]=values[j]);
        // Historical baseline is immutable. Never overwrite it later.
        return {status:'success',result:'already_saved',row:row};
      }
    }
  }

  const now=nowIso_();
  const row={
    targetMonth:key,
    budgetAmount:Number(item.budgetAmount)||0,
    forecastAmount:Number(item.forecastAmount)||0,
    modelVersion:String(item.modelVersion||''),
    createdAt:now,
    updatedAt:now
  };
  sheet.appendRow(FLOW_PLAN_ACCURACY_HEADERS_.map(h=>row[h]===undefined?'':row[h]));
  return {status:'success',result:'saved',row:row};
}


// ---------------------------------------------------------------------------
// v2.54.0: Snímky porovnania odhad vs. skutočnosť za ukončené mesiace
// ---------------------------------------------------------------------------
// Jeden riadok na mesiac. Raz uložená snímka sa neprepisuje. Výnimky: spätne dopočítaná snímka
// (source = 'backtest') sa smie nahradiť snímkou uloženou počas mesiaca (source = 'snapshot') a snímka
// staršej verzie sa smie nahradiť novšou.

const FLOW_MONTH_SNAPSHOT_HEADERS_ = ['monthKey','source','modelVersion','budgetAmount','forecastAmount','actualAmount','budgetDelta','forecastDelta','createdAt','updatedAt','payloadJson'];

function ensureMonthSnapshotSheet_(ss) {
  const sheet = ensureSheet_(ss,'FlowMonthSnapshots',FLOW_MONTH_SNAPSHOT_HEADERS_);
  // Stĺpec s kľúčom mesiaca musí byť text, inak z '2026-09' vznikne dátum.
  if (sheet.getRange(2,1).getNumberFormat() !== '@') {
    sheet.getRange(2,1,Math.max(1,sheet.getMaxRows()-1),1).setNumberFormat('@');
  }
  return sheet;
}

function snapshotFromRow_(row) {
  let payload = null;
  try { payload = row[10] ? JSON.parse(String(row[10])) : null; } catch (_) { payload = null; }
  const key = normalizeMonthKey_(row[0]);
  if (payload && typeof payload === 'object') {
    payload.monthKey = key;
    payload.source = payload.source || String(row[1] || 'snapshot');
    return payload;
  }
  return {
    monthKey:key, source:String(row[1]||'snapshot'), modelVersion:String(row[2]||''), createdAt:String(row[8]||''),
    total:{budget:Number(row[3])||0,forecast:Number(row[4])||0,actual:Number(row[5])||0,budgetDelta:Number(row[6])||0,forecastDelta:Number(row[7])||0},
    categories:[], income:null
  };
}

function readMonthSnapshots_(ss) {
  const sheet = ss.getSheetByName('FlowMonthSnapshots');
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,FLOW_MONTH_SNAPSHOT_HEADERS_.length).getValues()
    .filter(r => r[0]).map(snapshotFromRow_);
}

function validSnapshot_(item) {
  return item && /^\d{4}-\d{2}$/.test(normalizeMonthKey_(item.monthKey)) && item.total && Number.isFinite(Number(item.total.forecast)) && Number.isFinite(Number(item.total.actual));
}

function savePlanSnapshots_(ss, items) {
  const sheet = ensureMonthSnapshotSheet_(ss);
  const list = Array.isArray(items) ? items : [];
  const last = sheet.getLastRow();
  const existingRows = last >= 2 ? sheet.getRange(2,1,last-1,FLOW_MONTH_SNAPSHOT_HEADERS_.length).getValues() : [];
  const rowIndex = new Map();
  existingRows.forEach((r,i) => { if (r[0]) rowIndex.set(normalizeMonthKey_(r[0]), {row:i+2, values:r}); });

  const now = nowIso_();
  const results = list.map(item => {
    if (!validSnapshot_(item)) return {status:'error', monthKey:String(item && item.monthKey || ''), message:'Invalid snapshot'};
    const key = normalizeMonthKey_(item.monthKey);
    const source = item.source === 'backtest' ? 'backtest' : 'snapshot';
    const existing = rowIndex.get(key);
    // Nahradiť sa smie iba: spätne dopočítaná snímka živou, alebo snímka staršej verzie novšou (v2.54.1 opravila
    // sčítanie duplicitných riadkov archívu). Inak je uložená snímka nemenná.
    const upgrade = existing && (
      (String(existing.values[1]) === 'backtest' && source === 'snapshot') ||
      ((Number(item.version) || 1) > (Number(snapshotFromRow_(existing.values).version) || 1))
    );
    if (existing && !upgrade) return {status:'already_saved', monthKey:key, snapshot:snapshotFromRow_(existing.values)};

    const total = item.total;
    const payload = {...item, monthKey:key, source:source, createdAt:item.createdAt || now};
    delete payload.synced;
    const row = [key, source, String(item.modelVersion||''), Number(total.budget)||0, Number(total.forecast)||0, Number(total.actual)||0,
      Number(total.budgetDelta)||0, Number(total.forecastDelta)||0, payload.createdAt, now, JSON.stringify(payload)];
    if (existing) {
      sheet.getRange(existing.row,1).setNumberFormat('@');
      sheet.getRange(existing.row,1,1,row.length).setValues([row]);
      existing.values = row;
      return {status:'upgraded', monthKey:key, snapshot:snapshotFromRow_(row)};
    }
    const target = sheet.getLastRow()+1;
    sheet.getRange(target,1).setNumberFormat('@');
    sheet.getRange(target,1,1,row.length).setValues([row]);
    rowIndex.set(key,{row:target, values:row});
    return {status:'saved', monthKey:key, snapshot:snapshotFromRow_(row)};
  });
  return {status:'success', results:results, backendVersion:FLOW_BACKEND_VERSION};
}

// Len na čítanie: vypíše, koľko kópií toho istého odhadu (mesiac + kategória + model + typ) má archív.
// Duplicity vznikali pri opakovanom prepočte histórie. Nič nemení ani nemaže.
function reportForecastArchiveDuplicates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FlowForecastArchive');
  if (!sheet || sheet.getLastRow() < 2) return {rows:0, uniqueKeys:0, extraCopies:0};
  const headers = PLANNING_HEADERS_.archive;
  const idx = n => headers.indexOf(n);
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues().filter(r => r[0]);
  const counts = new Map();
  values.forEach(r => {
    const key = [normalizeMonthKey_(r[idx('targetMonth')]), r[idx('category')], r[idx('modelVersion')], r[idx('backtest')]].join('|');
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let extra = 0, worst = 0;
  counts.forEach(n => { if (n > 1) extra += n - 1; if (n > worst) worst = n; });
  const result = {rows:values.length, uniqueKeys:counts.size, extraCopies:extra, mostCopiesOfOne:worst};
  Logger.log(JSON.stringify(result));
  return result;
}

// Údržba (spusti raz ručne v editore Apps Script): prevedie stĺpec s mesiacom v FlowForecastArchive
// na text YYYY-MM. Opraví zmes dátumov a ISO časových značiek, ktorá rozbíjala porovnania.
function repairForecastArchiveMonths() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FlowForecastArchive');
  if (!sheet || sheet.getLastRow() < 2) return {repaired:0, total:0};
  const col = PLANNING_HEADERS_.archive.indexOf('targetMonth') + 1;
  const range = sheet.getRange(2,col,sheet.getLastRow()-1,1);
  const before = range.getValues();
  const after = before.map(r => [normalizeMonthKey_(r[0])]);
  let repaired = 0;
  before.forEach((r,i) => { if (String(r[0]) !== after[i][0]) repaired++; });
  range.setNumberFormat('@');
  range.setValues(after);
  const result = {repaired:repaired, total:before.length};
  Logger.log(JSON.stringify(result));
  return result;
}

// v2.54.2: konštantný počet volaní Sheets bez ohľadu na počet riadkov. Predtým sa každý aktualizovaný riadok
// zapisoval zvlášť (2 volania na riadok), takže požiadavka s tisíckami riadkov držala zámok scriptu minúty
// a blokovala ostatné požiadavky vrátane prihlásenia.
function archiveForecasts_(ss, rows) {
  const sheet = ensureSheet_(ss,'FlowForecastArchive',PLANNING_HEADERS_.archive);
  if (!Array.isArray(rows) || !rows.length) return { status:'success', saved:0 };
  const headers = PLANNING_HEADERS_.archive;
  const monthCol = headers.indexOf('targetMonth');
  const last = sheet.getLastRow();
  const existingRows = last >= 2 ? sheet.getRange(2,1,last-1,headers.length).getValues() : [];
  const indexById = new Map();
  existingRows.forEach((r,i)=>{ if(r[0]) indexById.set(String(r[0]), i); });

  let firstChanged = -1, lastChanged = -1;
  const inserts = [];
  let saved = 0;
  rows.filter(r=>r && r.id).forEach(r=>{
    const row = objectToRow_('archive',{...r,targetMonth:normalizeMonthKey_(r.targetMonth)});
    const idx = indexById.get(String(r.id));
    if (idx !== undefined) {
      existingRows[idx] = row;
      if (firstChanged < 0 || idx < firstChanged) firstChanged = idx;
      if (idx > lastChanged) lastChanged = idx;
    } else {
      inserts.push(row);
      indexById.set(String(r.id), existingRows.length + inserts.length - 1);
    }
    saved++;
  });

  // Aktualizácie: jeden zápis súvislého bloku. Mesiac v nezmenených riadkoch bloku sa zároveň zjednotí na text YYYY-MM.
  if (lastChanged >= 0) {
    const block = existingRows.slice(firstChanged, lastChanged + 1).map(r => {
      const copy = r.slice();
      copy[monthCol] = normalizeMonthKey_(copy[monthCol]);
      return copy;
    });
    const range = sheet.getRange(2 + firstChanged, 1, block.length, headers.length);
    // Stĺpec s mesiacom musí byť text, inak z '2026-09' vznikne dátum.
    sheet.getRange(2 + firstChanged, monthCol + 1, block.length, 1).setNumberFormat('@');
    range.setValues(block);
  }
  if (inserts.length) {
    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, monthCol + 1, inserts.length, 1).setNumberFormat('@');
    sheet.getRange(start, 1, inserts.length, headers.length).setValues(inserts);
  }
  return { status:'success', saved:saved };
}

const FLOW_HIST_TOMBSTONE_HEADERS_ = ['id','deletedAt','reason'];

function ensureHistoricalTombstones_(ss) {
  return ensureSheet_(ss,'FlowHistoricalTombstones',FLOW_HIST_TOMBSTONE_HEADERS_);
}

function readHistoricalTombstoneSet_(ss) {
  const sheet=ss.getSheetByName('FlowHistoricalTombstones');
  const set=new Set();
  if(!sheet || sheet.getLastRow()<2) return set;

  sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().forEach(function(row){
    const id=String(row[0]||'');
    if(id) set.add(id);
  });
  return set;
}

function addHistoricalTombstones_(ss,ids,reason) {
  const clean=[...new Set((Array.isArray(ids)?ids:[])
    .map(function(id){return String(id||'');})
    .filter(function(id){return /^HIST-/i.test(id);}))];

  if(!clean.length) return 0;

  const sheet=ensureHistoricalTombstones_(ss);
  const existing=readHistoricalTombstoneSet_(ss);
  const now=nowIso_();
  const rows=clean
    .filter(function(id){return !existing.has(id);})
    .map(function(id){return [id,now,String(reason||'historical_dedup')];});

  if(rows.length){
    sheet.getRange(sheet.getLastRow()+1,1,rows.length,FLOW_HIST_TOMBSTONE_HEADERS_.length).setValues(rows);
  }
  return rows.length;
}

function processTransactionMutation_(ss, item, historicalTombstones, batchCtx) {
  const sheet = batchCtx ? batchCtx.sheet : ss.getSheetByName('Sheet1');
  if (!sheet) return { status:'error', message:'Sheet1 not found', id:String(item.id||'') };
  if (!batchCtx) ensureTransactionHeaders_(sheet);
  if (!item.id) return { status:'error', message:'Missing transaction id' };

  const id=String(item.id||'');
  const tombstones=historicalTombstones instanceof Set ? historicalTombstones : readHistoricalTombstoneSet_(ss);
  if(item.action!=='delete' && /^HIST-/i.test(id) && tombstones.has(id)){
    return {status:'historical_tombstoned',id:id,result:'ignored_cleaned_historical_duplicate'};
  }

  const rowIndex = batchCtx ? (batchCtx.rowIndex.has(id) ? batchCtx.rowIndex.get(id) : -1) : findTransactionRow_(sheet,item.id);
  const existing = rowIndex > -1 ? transactionFromRow_(sheet.getRange(rowIndex,1,1,19).getValues()[0]) : null;
  const incoming = { ...item, deleted:item.action==='delete' ? true : Boolean(item.deleted), version:toVersion_(item.version), updatedAt:toIso_(item.updatedAt,nowIso_()) };
  const comparison = compareIncoming_(incoming,existing);
  if(comparison<0) return { status:'conflict', reason:'server_newer', id:String(item.id), server:existing };
  if(comparison===0 && existing) return { status:'already_current', id:String(item.id), server:existing };
  const row = transactionRow_(incoming,existing);
  if(rowIndex>-1) sheet.getRange(rowIndex,1,1,row.length).setValues([row]);
  else {
    sheet.appendRow(row);
    if (batchCtx) batchCtx.rowIndex.set(id, sheet.getLastRow());
  }
  return { status:'success', result:item.action==='delete'?'deleted':'saved', id:String(item.id), version:incoming.version, updatedAt:incoming.updatedAt };
}


function normalizeRecurringRepairText_(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g,' ');
}

function recurringPlanOccurrenceDatesForRepair_(plan, fromDate, toDate) {
  const out=[];
  if(!plan || !plan.active) return out;
  const startRaw=String(plan.startDate||'');
  const start=new Date(startRaw ? startRaw+'T00:00:00' : fromDate);
  const from=new Date(fromDate); from.setHours(0,0,0,0);
  const to=new Date(toDate); to.setHours(23,59,59,999);
  if(isNaN(start.getTime())) return out;

  const endRaw=String(plan.endDate||'');
  const end=endRaw ? new Date(endRaw+'T23:59:59') : null;
  const freq=String(plan.frequency||'monthly');
  const day=Math.max(1,Math.min(31,Number(plan.dayOfMonth)||start.getDate()||1));

  if(freq==='weekly'){
    let cursor=new Date(start);
    while(cursor<from) cursor.setDate(cursor.getDate()+7);
    while(cursor<=to){
      if(!end || cursor<=end) out.push(Utilities.formatDate(cursor,Session.getScriptTimeZone()||'Europe/Bratislava','yyyy-MM-dd'));
      cursor.setDate(cursor.getDate()+7);
    }
    return out;
  }

  const step=freq==='yearly'?12:freq==='quarterly'?3:1;
  let cursor=new Date(start.getFullYear(),start.getMonth(),1);
  cursor.setDate(Math.min(day,new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()));
  while(cursor<from){
    const y=cursor.getFullYear(),m=cursor.getMonth()+step;
    cursor=new Date(y,m,1);
    cursor.setDate(Math.min(day,new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()));
  }
  while(cursor<=to){
    if(!end || cursor<=end) out.push(Utilities.formatDate(cursor,Session.getScriptTimeZone()||'Europe/Bratislava','yyyy-MM-dd'));
    const y=cursor.getFullYear(),m=cursor.getMonth()+step;
    cursor=new Date(y,m,1);
    cursor.setDate(Math.min(day,new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()));
  }
  return out;
}

function getRecurringPlansForRepair_(ss) {
  const sheet=ss.getSheetByName('FlowRecurringPlans');
  if(!sheet || sheet.getLastRow()<2) return [];
  const headers=PLANNING_HEADERS_.recurring;
  return sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues()
    .filter(r=>r[0])
    .map(r=>rowToObject_(headers,r))
    .filter(p=>p.active===true || String(p.active).toUpperCase()==='TRUE');
}

function matchLegacyRecurringPlan_(tx, plans) {
  if(!tx || !/^tx_/i.test(String(tx.id||''))) return null;
  const date=String(tx.date||'').slice(0,10);
  if(!date) return null;

  const candidates=(plans||[]).filter(plan=>{
    if(normalizeRecurringRepairText_(plan.category)!==normalizeRecurringRepairText_(tx.category)) return false;
    if(normalizeRecurringRepairText_(plan.sub)!==normalizeRecurringRepairText_(tx.sub)) return false;
    if(normalizeRecurringRepairText_(plan.type||'expense')!==normalizeRecurringRepairText_(tx.type||'expense')) return false;
    if(normalizeRecurringRepairText_(plan.name)!==normalizeRecurringRepairText_(tx.note)) return false;

    const start=String(plan.startDate||'').slice(0,10);
    const end=String(plan.endDate||'').slice(0,10);
    if(start && date<start) return false;
    if(end && date>end) return false;

    // Validate date against the plan cadence around this exact date.
    const d=new Date(date+'T00:00:00');
    const from=new Date(d); from.setDate(from.getDate()-2);
    const to=new Date(d); to.setDate(to.getDate()+2);
    return recurringPlanOccurrenceDatesForRepair_(plan,from,to).indexOf(date)>=0;
  });

  return candidates.length===1 ? candidates[0] : null;
}

function buildRecurringRepairAudit_(ss, includeRows) {
  const sheet=ss.getSheetByName('Sheet1');
  if(!sheet) return {status:'error',message:'Sheet1 not found'};
  ensureTransactionHeaders_(sheet);

  const plans=getRecurringPlansForRepair_(ss);
  if(!plans.length) return {status:'success',duplicateRows:0,metadataRows:0,groups:0,repairs:[],deletes:[]};

  const values=sheet.getDataRange().getValues();
  const grouped=new Map();
  const metadataRepairs=[];

  values.slice(1).forEach((row,i)=>{
    if(!row[0]) return;
    const tx=transactionFromRow_(row);
    if(tx.deleted) return;

    let plan=null;
    if(tx.recurringPlanId){
      plan=plans.find(p=>String(p.id)===String(tx.recurringPlanId))||null;
    }
    if(!plan) plan=matchLegacyRecurringPlan_(tx,plans);
    if(!plan) return;

    const date=String(tx.date||'').slice(0,10);
    const key=String(plan.id)+'|'+date;
    const list=grouped.get(key)||[];
    list.push({rowIndex:i+2,tx:tx,plan:plan});
    grouped.set(key,list);

    if(!tx.isRecurring || String(tx.recurringPlanId||'')!==String(plan.id) || String(tx.frequency||'')!==String(plan.frequency||'')){
      metadataRepairs.push({rowIndex:i+2,id:String(tx.id||''),planId:String(plan.id),frequency:String(plan.frequency||'monthly')});
    }
  });

  const deletes=[];
  const repairs=[];
  let groups=0;

  grouped.forEach(list=>{
    if(!list.length) return;
    const rank=x=>{
      let score=0;
      if(String(x.tx.recurringPlanId||'')===String(x.plan.id)) score+=1000;
      if(x.tx.isRecurring) score+=500;
      if(/^RPOCC_/i.test(String(x.tx.id||''))) score+=300;
      if(/^tx_/i.test(String(x.tx.id||''))) score+=100;
      return score;
    };
    const ranked=list.slice().sort((a,b)=>rank(b)-rank(a) || a.rowIndex-b.rowIndex);
    const keep=ranked[0];
    repairs.push({rowIndex:keep.rowIndex,id:String(keep.tx.id||''),planId:String(keep.plan.id),frequency:String(keep.plan.frequency||'monthly')});

    const dupes=ranked.slice(1).filter(x=>{
      // Destructive cleanup is intentionally limited to generator-shaped rows.
      return /^tx_/i.test(String(x.tx.id||'')) || /^RPOCC_/i.test(String(x.tx.id||'')) || String(x.tx.recurringPlanId||'')===String(x.plan.id);
    });
    if(dupes.length){
      groups++;
      dupes.forEach(x=>deletes.push({rowIndex:x.rowIndex,id:String(x.tx.id||'')}));
    }
  });

  const repairMap=new Map();
  metadataRepairs.concat(repairs).forEach(r=>repairMap.set(String(r.rowIndex),r));

  return {
    status:'success',
    duplicateRows:deletes.length,
    metadataRows:repairMap.size,
    groups:groups,
    repairs:includeRows ? [...repairMap.values()] : [],
    deletes:includeRows ? deletes : []
  };
}

function repairExistingRecurringTransactions_(ss,userId,options) {
  const opts=options||{};
  if((Number(opts.syncQueueCount)||0)>0){
    return {status:'error',message:'Oprava zablokovaná: čakajú zmeny na synchronizáciu. Sheet1 zostal nezmenený.'};
  }

  const audit=buildRecurringRepairAudit_(ss,true);
  if(audit.status!=='success') return audit;

  const expectedDup=Number(opts.expectedDuplicateRows);
  const expectedMeta=Number(opts.expectedMetadataRows);
  if((Number.isFinite(expectedDup)&&expectedDup!==Number(audit.duplicateRows||0)) ||
     (Number.isFinite(expectedMeta)&&expectedMeta!==Number(audit.metadataRows||0))){
    return {status:'error',message:'Stav dát sa od kontroly zmenil. Spusti opravu znova; nič som nezmenil.'};
  }

  if(!audit.duplicateRows && !audit.metadataRows){
    return {status:'success',cleanedDuplicates:0,repairedMetadata:0,removedIds:[],backup:null};
  }

  const backup=createFullBackup_(ss,userId||'default','before_recurring_repair');
  if(!backup || backup.status!=='success'){
    return {status:'error',message:'Bezpečnostná záloha zlyhala. Sheet1 zostal nezmenený.',backup:backup||null};
  }

  const audit2=buildRecurringRepairAudit_(ss,true);
  if(Number(audit2.duplicateRows||0)!==Number(audit.duplicateRows||0) ||
     Number(audit2.metadataRows||0)!==Number(audit.metadataRows||0)){
    return {status:'error',message:'Dáta sa počas zálohy zmenili. Oprava bola zastavená; Sheet1 zostal nezmenený.',backup:backup};
  }

  const sheet=ss.getSheetByName('Sheet1');

  // Repair metadata first.
  (audit2.repairs||[]).forEach(r=>{
    const row=sheet.getRange(r.rowIndex,1,1,19).getValues()[0];
    row[16]=true;
    row[17]=r.frequency||'monthly';
    row[18]=r.planId||'';
    sheet.getRange(r.rowIndex,1,1,19).setValues([row]);
  });

  // Delete from bottom to top so row indexes remain valid.
  const deleteRows=(audit2.deletes||[]).slice().sort((a,b)=>b.rowIndex-a.rowIndex);
  deleteRows.forEach(r=>sheet.deleteRow(r.rowIndex));

  const verify=buildRecurringRepairAudit_(ss,false);
  return {
    status:'success',
    cleanedDuplicates:deleteRows.length,
    repairedMetadata:Number(audit2.metadataRows||0),
    removedIds:deleteRows.map(r=>r.id),
    remainingDuplicates:Number(verify.duplicateRows||0),
    remainingMetadata:Number(verify.metadataRows||0),
    backup:backup
  };
}

// v2.54.2: odpoveď servera na neočakávanú chybu má vždy kód, aby appka vedela pomenovať, čo sa stalo.
function serverErrorResponse_(error) {
  const text = String(error && error.message ? error.message : error);
  const busy = /lock/i.test(text) && /timeout|too long|another process/i.test(text);
  return {
    status: 'error',
    code: busy ? 'busy' : 'server_error',
    message: String(error && error.stack ? error.stack : error).slice(0, 400)
  };
}

function doGet(e) {
  // Bez tokenu: iba verzia backendu (nič z dát). Slúži na diagnostiku nasadenia a prihlásenia.
  if (e && e.parameter && e.parameter.get === 'ping') {
    return json_({ status:'success', backend:'Flowapp', backendVersion:FLOW_BACKEND_VERSION, loginSupported:true });
  }
  if (!validToken_(e)) return unauthorized_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const get = e && e.parameter ? e.parameter.get : '';

  if (get === 'whoami') {
    const user = getSessionUser_(ss, getRequestToken_(e));
    return json_({ status:'success', user:user, legacy:!user, backendVersion:FLOW_BACKEND_VERSION });
  }

  try {
    if (get === 'data_health') return json_(getDataHealth_(ss));
    if (get === 'historical_duplicate_audit') return json_(auditHistoricalDuplicates_(ss));
    if (get === 'recurring_repair_audit') return json_(buildRecurringRepairAudit_(ss,false));

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

    if (get === 'categories_meta') {
      const state = readCategoriesState_(ss);
      return json_({
        status: 'success',
        categories: state.categories,
        version: state.version,
        updatedAt: state.updatedAt,
        backendVersion: FLOW_BACKEND_VERSION
      });
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
    return json_(serverErrorResponse_(error));
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const item = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Prihlásenie a odhlásenie sú jediné akcie bez platného tokenu.
    if (item.action === 'googleLogin') return json_(processGoogleLogin_(ss, item.credential));
    if (item.action === 'logout') return json_({ status:'success', revoked:revokeFlowSession_(ss, getRequestToken_(item)) });

    if (!validToken_(item)) return unauthorized_();

    if (item.action === 'createBackup') return json_(createFullBackup_(ss,item.userId,'manual'));

    if (item.action === 'setupAutoBackup') return json_(setupAutoBackup_(ss));

    if (item.action === 'cleanHistoricalDuplicates') return json_(cleanHistoricalDuplicates_(ss,item.userId,{syncQueueCount:item.syncQueueCount,expectedDuplicateRows:item.expectedDuplicateRows}));

    if (item.action === 'repairRecurringTransactions') return json_(repairExistingRecurringTransactions_(ss,item.userId,{syncQueueCount:item.syncQueueCount,expectedDuplicateRows:item.expectedDuplicateRows,expectedMetadataRows:item.expectedMetadataRows}));

    if (item.action === 'batchSync') {
      const items = Array.isArray(item.items) ? item.items : [];
      const hasHistoricalItems=items.some(function(entry){
        return /^HIST-/i.test(String(entry && entry.id || ''));
      });
      const historicalTombstones=hasHistoricalItems ? readHistoricalTombstoneSet_(ss) : new Set();
      const txSheet = ss.getSheetByName('Sheet1');
      let batchCtx = null;
      if (txSheet) {
        ensureTransactionHeaders_(txSheet);
        batchCtx = { sheet: txSheet, rowIndex: buildTransactionRowIndex_(txSheet) };
      }
      const results = items.map(function(entry){
        return processTransactionMutation_(ss, entry, historicalTombstones, batchCtx);
      });
      return json_({ status:'success', results:results, backendVersion:FLOW_BACKEND_VERSION });
    }

    if (item.action === 'save' || item.action === 'delete') {
      const isHistorical=/^HIST-/i.test(String(item && item.id || ''));
      return json_(processTransactionMutation_(ss,item,isHistorical ? readHistoricalTombstoneSet_(ss) : new Set()));
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

    if (item.action === 'savePlanAccuracySnapshot') return json_(savePlanAccuracySnapshot_(ss,item));

    if (item.action === 'savePlanSnapshots') return json_(savePlanSnapshots_(ss,item.items));

    if (item.action === 'sync_categories') {
      const sheet = ss.getSheetByName('Categories');
      if (!sheet) return json_({ status: 'error', message: 'Categories sheet not found' });

      const incomingCategories = Array.isArray(item.categories) ? item.categories : [];
      if (!incomingCategories.length) {
        return json_({ status: 'error', message: 'Refusing to save empty categories' });
      }
      if (isLegacyGenericDefaultCategories_(incomingCategories)) {
        return json_({ status: 'error', message: 'Protected: generic default categories cannot overwrite cloud data' });
      }

      const incomingVersion = toVersion_(item.version);
      const incomingUpdatedAt = toIso_(item.updatedAt, nowIso_());

      if (sheet.getMaxColumns() < 3) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), 3 - sheet.getMaxColumns());
      }
      if (sheet.getLastRow() < 1) sheet.insertRows(1);
      sheet.getRange(1, 1, 1, 3).setValues([['Data', 'Version', 'UpdatedAt']]);

      const serverState = readCategoriesState_(ss);
      const serverVersion = serverState.version;
      const serverUpdatedAt = serverState.updatedAt;

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

      if (categorySignature_(serverState.categories) !== categorySignature_(incomingCategories)) {
        backupCategories_(ss, serverState, item.userId, 'before_category_update');
      }

      sheet.getRange(2, 1, 1, 3).setValues([[
        JSON.stringify(incomingCategories),
        incomingVersion,
        incomingUpdatedAt
      ]]);

      return json_({
        status: 'success',
        result: 'categories_saved',
        version: incomingVersion,
        updatedAt: incomingUpdatedAt,
        backupCreated: categorySignature_(serverState.categories) !== categorySignature_(incomingCategories)
      });
    }

    return json_({ status: 'error', code: 'unknown_action', message: 'Unknown action' });

  } catch (error) {
    return json_(serverErrorResponse_(error));
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
