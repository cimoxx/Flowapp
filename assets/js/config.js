const APP_VERSION = '2.33.0';
const DATA_SCHEMA_VERSION = 3;

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwL3Yvp-zAL16wUyslfeqPUOCp9XWPY6BRckXR2Qdnrx6bX5ogu1DZV10xJFpPzQY0DiQ/exec';

let db = JSON.parse(localStorage.getItem('f_db_v20') || '[]');
let syncQueue = JSON.parse(localStorage.getItem('f_sync_q_v20') || '[]');
let categories = JSON.parse(localStorage.getItem('f_cats_v20') || 'null') || [
    { id: 'Potraviny', icon: 'shopping-cart', subs: ['Billa','Lidl','Kaufland','Tesco','COOP'] },
    { id: 'Byvanie', icon: 'home', subs: ['Najom','Elektrina','Plyn','Voda','Internet'] },
    { id: 'Doprava', icon: 'car', subs: ['Tankovanie','MHD','Servis','Poistka'] },
    { id: 'Zabava', icon: 'gamepad-2', subs: ['Kino','Restauracia','Bar','Streaming'] },
    { id: 'Zdravie', icon: 'heart-pulse', subs: ['Lekaren','Doktor','Poistenie'] },
    { id: 'Oblecenie', icon: 'shirt', subs: ['Topanky','Bunda','Doplnky'] },
    { id: 'Prijem', icon: 'wallet', subs: ['Vyplata','Bonus','Predaj','Ine'] },
    { id: 'Ine', icon: 'package', subs: ['Darcek','Domacnost','Ostatne'] }
];

let selectedCat = null;
let selectedSub = null;
let curType = 'expense';

let currentStatusFilter = 'unprocessed';
let selectedMonths = [new Date().getMonth()];
let selectedChartMonths = [];
let selectedChartPeriod = 'current_month';

let transactionSearchQuery = '';
let activeCategoryFilter = null;
window.activeSubFilter = null;

let activeSettingsCat = null;
let pendingCatSync = localStorage.getItem('f_pending_cat_sync_v20') === 'true';

let isSyncing = false;
let analyticsChartInstance = null;
let burnRateTabChartInstance = null;

let analyticsBreakdownExpanded = {};
let burnBreakdownExpanded = {};

let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

let toastTimeouts = [];

let lastDeletedEntry = null;
let lastDeletedSyncSnapshot = null;

let hasShownSwipeHint = localStorage.getItem('f_swipe_hint_seen_v20') === 'true';

let budgetState = {
    month: new Date().getMonth(),
    year: new Date().getFullYear()
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    });
}


function generateStableId(prefix = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCategoryRecord(category, index = 0) {
    const c = category && typeof category === 'object' ? { ...category } : { id: String(category || `Kategoria ${index + 1}`) };
    c.id = String(c.id || `Kategoria ${index + 1}`).trim();
    c.uid = String(c.uid || c.categoryId || '').trim() || generateStableId('cat');
    c.icon = c.icon || 'layers';
    c.subs = Array.isArray(c.subs) ? c.subs.map(s => String(s)).filter(Boolean) : [];
    c.createdAt = c.createdAt || new Date().toISOString();
    c.updatedAt = c.updatedAt || c.createdAt;
    c.version = Math.max(1, Number(c.version) || 1);
    return c;
}

function normalizeTransactionRecord(item, index = 0, categoryList = categories) {
    const now = new Date().toISOString();
    const tx = item && typeof item === 'object' ? { ...item } : {};
    tx.id = String(tx.id || tx.transactionId || generateStableId('tx'));
    tx.transactionId = String(tx.transactionId || tx.id);
    tx.date = getCleanDateStr(tx.date);
    tx.full_date = tx.full_date || `${tx.date} 00:00:00`;
    tx.amount = Number(tx.amount) || 0;
    tx.type = tx.type === 'income' ? 'income' : 'expense';
    tx.category = String(tx.category || 'Ine');
    tx.sub = String(tx.sub || '');
    tx.note = String(tx.note || '');
    tx.processed = Boolean(tx.processed);
    tx.isRecurring = Boolean(tx.isRecurring);
    tx.frequency = tx.frequency || null;
    tx.createdAt = tx.createdAt || now;
    tx.updatedAt = tx.updatedAt || tx.createdAt || now;
    tx.version = Math.max(1, Number(tx.version) || 1);

    const category = categoryList.find(c => c.uid === tx.categoryId) || categoryList.find(c => c.id === tx.category);
    if (category) {
        tx.categoryId = category.uid;
        tx.category = category.id;
    } else {
        tx.categoryId = String(tx.categoryId || '');
    }

    delete tx.action;
    return tx;
}

function ensureDataIntegrity() {
    const rawCategories = Array.isArray(categories) ? categories : [];
    const seenCategoryUids = new Set();
    categories = rawCategories.map((c, i) => normalizeCategoryRecord(c, i)).map(c => {
        if (seenCategoryUids.has(c.uid)) c.uid = generateStableId('cat');
        seenCategoryUids.add(c.uid);
        return c;
    });

    db = Array.isArray(db) ? db.map((item, i) => normalizeTransactionRecord(item, i, categories)) : [];

    const seenTxIds = new Set();
    db.forEach(item => {
        if (seenTxIds.has(item.id)) {
            item.id = generateStableId('tx');
            item.transactionId = item.id;
        }
        seenTxIds.add(item.id);
    });

    syncQueue = Array.isArray(syncQueue) ? syncQueue.map(item => {
        if (!item || typeof item !== 'object') return null;
        if (item.action === 'delete') {
            const now = new Date().toISOString();
            return {
                ...item,
                id: String(item.id || item.transactionId || ''),
                transactionId: String(item.transactionId || item.id || ''),
                updatedAt: item.updatedAt || now,
                deletedAt: item.deletedAt || now,
                version: Math.max(1, Number(item.version) || 1)
            };
        }
        return { ...normalizeTransactionRecord(item, 0, categories), action: item.action || 'save' };
    }).filter(Boolean) : [];

    // Keep only the newest queued mutation per transaction.
    const latestById = new Map();
    syncQueue.forEach(item => {
        const key = String(item.id || item.transactionId || '');
        if (!key) return;
        const previous = latestById.get(key);
        if (!previous || Number(item.version || 1) >= Number(previous.version || 1)) latestById.set(key, item);
    });
    syncQueue = Array.from(latestById.values());

    localStorage.setItem('f_db_v20', JSON.stringify(db));
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    localStorage.setItem('f_cats_v20', JSON.stringify(categories));
    localStorage.setItem('f_data_schema_v20', String(DATA_SCHEMA_VERSION));
}

function touchTransaction(item, isNew = false) {
    const now = new Date().toISOString();
    if (!item.id) item.id = generateStableId('tx');
    item.transactionId = String(item.transactionId || item.id);
    if (isNew || !item.createdAt) item.createdAt = now;
    item.updatedAt = now;
    item.version = Math.max(0, Number(item.version) || 0) + 1;
    return item;
}

function touchCategory(category, isNew = false) {
    const now = new Date().toISOString();
    if (!category.uid) category.uid = generateStableId('cat');
    if (isNew || !category.createdAt) category.createdAt = now;
    category.updatedAt = now;
    category.version = Math.max(0, Number(category.version) || 0) + 1;
    return category;
}

