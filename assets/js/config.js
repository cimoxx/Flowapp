const APP_VERSION = '2.42.1';
const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwL3Yvp-zAL16wUyslfeqPUOCp9XWPY6BRckXR2Qdnrx6bX5ogu1DZV10xJFpPzQY0DiQ/exec';
// Shared endpoint access token. This is basic endpoint protection, not full user authentication.
const FLOW_API_TOKEN = 'XMdXUXce7yB6d8mle2v_o78BUhNKvR4WOcfN9g5hWg';
const FLOW_USER_ID = 'default';

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
let selectedAnalyticsYear = new Date().getFullYear();

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


function createUid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCategories() {
    const seen = new Set();
    categories = (Array.isArray(categories) ? categories : []).map(cat => {
        const c = { ...cat };
        c.id = String(c.id || 'Ine').trim();
        c.uid = c.uid || c.categoryId || createUid('cat');
        while (seen.has(c.uid)) c.uid = createUid('cat');
        seen.add(c.uid);
        c.icon = c.icon || 'layers';
        c.subs = Array.isArray(c.subs) ? c.subs : [];
        return c;
    });
    if (!categories.length) {
        categories = [{ id: 'Ine', uid: createUid('cat'), icon: 'package', subs: ['Ostatne'] }];
    }
}

function getCategoryByUid(uid) {
    return categories.find(c => String(c.uid) === String(uid));
}

function getCategoryUidByName(name) {
    const cat = categories.find(c => String(c.id) === String(name));
    return cat ? cat.uid : '';
}

function ensureDataIntegrity() {
    normalizeCategories();
    const now = new Date().toISOString();

    db = (Array.isArray(db) ? db : []).map(item => {
        const x = { ...item };
        x.id = String(x.id || createUid('tx'));
        x.category = String(x.category || '');
        x.categoryId = x.categoryId || getCategoryUidByName(x.category);
        if (!x.categoryId && x.category) {
            const cat = categories.find(c => c.id === x.category);
            if (cat) x.categoryId = cat.uid;
        }
        x.sub = x.sub || '';
        x.createdAt = x.createdAt || x.full_date || x.date || now;
        x.updatedAt = x.updatedAt || x.createdAt || now;
        x.version = Math.max(1, parseInt(x.version, 10) || 1);
        x.deleted = Boolean(x.deleted);
        x.processed = Boolean(x.processed);
        return x;
    });

    syncQueue = (Array.isArray(syncQueue) ? syncQueue : []).map(q => ({
        ...q,
        id: String(q.id || createUid('tx')),
        version: Math.max(1, parseInt(q.version, 10) || 1),
        updatedAt: q.updatedAt || now
    }));

    // Keep only the newest pending mutation per entity.
    const latest = new Map();
    syncQueue.forEach(item => {
        const key = String(item.id);
        const prev = latest.get(key);
        if (!prev || (Number(item.version) || 0) >= (Number(prev.version) || 0)) latest.set(key, item);
    });
    syncQueue = Array.from(latest.values());

    localStorage.setItem('f_db_v20', JSON.stringify(db));
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    localStorage.setItem('f_cats_v20', JSON.stringify(categories));
    localStorage.setItem('f_data_schema_version', '2.37.0');
}

ensureDataIntegrity();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    });
}
