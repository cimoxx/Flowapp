const APP_VERSION = '2.44.5';
const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwL3Yvp-zAL16wUyslfeqPUOCp9XWPY6BRckXR2Qdnrx6bX5ogu1DZV10xJFpPzQY0DiQ/exec';
// Shared endpoint access token. This is basic endpoint protection, not full user authentication.
const FLOW_API_TOKEN = 'XMdXUXce7yB6d8mle2v_o78BUhNKvR4WOcfN9g5hWg';
const FLOW_USER_ID = 'default';

let db = JSON.parse(localStorage.getItem('f_db_v20') || '[]');
let syncQueue = JSON.parse(localStorage.getItem('f_sync_q_v20') || '[]');

// v2.43.5: Category safety model.
// The old generic starter categories are kept only as a corruption signature.
// They are NEVER used as live data and are NEVER allowed to sync to Google Sheets.
const LEGACY_GENERIC_DEFAULT_CATEGORIES = [
    { id: 'Potraviny', icon: 'shopping-cart', subs: ['Billa','Lidl','Kaufland','Tesco','COOP'] },
    { id: 'Byvanie', icon: 'home', subs: ['Najom','Elektrina','Plyn','Voda','Internet'] },
    { id: 'Doprava', icon: 'car', subs: ['Tankovanie','MHD','Servis','Poistka'] },
    { id: 'Zabava', icon: 'gamepad-2', subs: ['Kino','Restauracia','Bar','Streaming'] },
    { id: 'Zdravie', icon: 'heart-pulse', subs: ['Lekaren','Doktor','Poistenie'] },
    { id: 'Oblecenie', icon: 'shirt', subs: ['Topanky','Bunda','Doplnky'] },
    { id: 'Prijem', icon: 'wallet', subs: ['Vyplata','Bonus','Predaj','Ine'] },
    { id: 'Ine', icon: 'package', subs: ['Darcek','Domacnost','Ostatne'] }
];

// Last confirmed master set. This is an emergency read-only recovery baseline only.
// Normal operation always prefers the Google Sheets copy.
const CATEGORY_RECOVERY_MASTER = [
    {id:'Strava',icon:'utensils',subs:['Dovolenka potraviny','Fitness','Potraviny','Reštaurácie','Škola','Vajcia','Zmrzlina']},
    {id:'Zábava / Dovolenky',icon:'palmtree',subs:['Cvičenie','Dovolenka','Dovolenka atrakcie','Dovolenka PHM','Dovolenka poplatky cesty','Dovolenka reštaurácie','Dovolenka ubytovanie','Fitko','Joga','Kino','Plaváreň']},
    {id:'Doprava',icon:'car',subs:['Bus/vlak','Diaľničné poplatky','Parkovanie','Servis','Tankovanie']},
    {id:'Osobná starostlivosť',icon:'heart',subs:['Drogéria','Kaderníčka','Lieky','Oblečenie','Obuv','Strihanie','Strihanie Jergi','Strihanie Lukáš','Zubár']},
    {id:'Darčeky',icon:'gift',subs:['Hanka','Jergi','Lukáš','Zdenka','Rodičia']},
    {id:'Deti',icon:'baby',subs:['Krúžky Jergi','Krúžky Hanka','Lezenie','Oblečenie','Obuv','Škola','Tábor Hanka','Tábor Jergi','Turnaje Jergi','Vreckové','Sútaže Hanka']},
    {id:'Domácnosť',icon:'home',subs:['Drevo','Energie','Okolo domu','Opravy','Predplatené služby']},
    {id:'Iné',icon:'layers',subs:['Hobby']},
    {id:'Úspory',icon:'trending-up',subs:['Investovanie fondy','Sporenie dovolenka','Sporiaci účet']},
    {id:'Domáce zvieratá',icon:'dog',subs:[]},
    {id:'Poistenie',icon:'shield-check',subs:['Auto PZP','Auto havarijna','Dom','Vozik']},
    {id:'Dane',icon:'landmark',subs:[]},
    {id:'Príjmy',icon:'hand-coins',subs:['Gastrace','Iné','Lukáš','Lukáš gastrace','Prídavky','Preplatky energie','VšZP','Výhra','Zdenka']}
];

function cloneCategorySet(list) {
    return (Array.isArray(list) ? list : []).map(cat => ({
        ...cat,
        subs: Array.isArray(cat.subs) ? [...cat.subs] : []
    }));
}

function categorySignature(list) {
    return JSON.stringify((Array.isArray(list) ? list : []).map(cat => ({
        id: String(cat?.id || ''),
        icon: String(cat?.icon || ''),
        subs: Array.isArray(cat?.subs) ? cat.subs.map(String) : []
    })));
}

function isLegacyGenericDefaultSet(list) {
    return categorySignature(list) === categorySignature(LEGACY_GENERIC_DEFAULT_CATEGORIES);
}

function parseStoredCategories() {
    try {
        const raw = localStorage.getItem('f_cats_v20');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch (_) {
        return null;
    }
}

const storedCategories = parseStoredCategories();
const storedCategorySource = localStorage.getItem('f_categories_source_v2435') || '';
const storedCategoriesAreGeneric = isLegacyGenericDefaultSet(storedCategories);

let categories = storedCategories && !storedCategoriesAreGeneric
    ? storedCategories
    : cloneCategorySet(CATEGORY_RECOVERY_MASTER);

// A trusted source may be edited/pushed. Recovery data is display-only until cloud is checked.
let categorySyncState = {
    source: storedCategories && !storedCategoriesAreGeneric && storedCategorySource !== 'recovery'
        ? 'local'
        : 'recovery',
    baselineLoaded: false,
    repairNeeded: storedCategoriesAreGeneric,
    metadataSupported: false,
    baselineSignature: localStorage.getItem('f_categories_baseline_signature_v2435') || ''
};

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

function stableCategoryUid(name) {
    // FNV-1a style deterministic hash. Legacy categories without uid receive the
    // same id after every cache clear, so transaction categoryId links stay stable.
    const input = String(name || 'Ine').normalize('NFC');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `cat_stable_${(hash >>> 0).toString(36)}`;
}

function persistCategoriesLocally(source = categorySyncState?.source || 'local') {
    localStorage.setItem('f_cats_v20', JSON.stringify(categories));
    localStorage.setItem('f_categories_source_v2435', source);
}

function isCategoryEditingReady() {
    if (categorySyncState.source !== 'recovery' || categorySyncState.baselineLoaded) return true;
    if (typeof showToast === 'function') {
        showToast({
            type: 'info',
            title: 'Načítavam kategórie',
            text: 'Najprv overujem bezpečnú cloudovú kópiu. Skús úpravu o chvíľu.'
        });
    }
    if (typeof syncCategories === 'function') syncCategories('pull');
    return false;
}

function normalizeCategories() {
    const seen = new Set();
    categories = (Array.isArray(categories) ? categories : []).map(cat => {
        const c = { ...cat };
        c.id = String(c.id || 'Ine').trim();
        c.uid = c.uid || c.categoryId || stableCategoryUid(c.id);
        while (seen.has(c.uid)) c.uid = createUid('cat');
        seen.add(c.uid);
        c.icon = c.icon || 'layers';
        c.subs = Array.isArray(c.subs) ? c.subs : [];
        return c;
    });
    if (!categories.length) {
        categories = cloneCategorySet(CATEGORY_RECOVERY_MASTER);
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
        const namedCategory = categories.find(c => c.id === x.category);
        const linkedCategory = x.categoryId ? getCategoryByUid(x.categoryId) : null;
        if (namedCategory && (!x.categoryId || !linkedCategory)) {
            // Repair stale categoryId links after legacy uid regeneration/cache loss.
            x.categoryId = namedCategory.uid;
        } else {
            x.categoryId = x.categoryId || getCategoryUidByName(x.category);
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
    persistCategoriesLocally(categorySyncState.source);
    localStorage.setItem('f_data_schema_version', '2.43.5');
}

ensureDataIntegrity();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    });
}
