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
