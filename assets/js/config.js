if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbybTaD_vfOjOooWjKEHY7_wJxrvlSaYbqRqQM8OO_Q6VyV9V-BLkOg8f4Esu74X5sSFfQ/exec';

let db = JSON.parse(localStorage.getItem('f_db_v20')) || [];
let syncQueue = JSON.parse(localStorage.getItem('f_sync_q_v20')) || [];
let categories = JSON.parse(localStorage.getItem('f_cats_v20')) || [];
let pendingCatSync = JSON.parse(localStorage.getItem('f_pending_cat_sync_v20')) || false;
let chartPresets = JSON.parse(localStorage.getItem('f_chart_presets_v20')) || [];
let curUser = localStorage.getItem('f_last_user') || 'Lukáš';

let curType = 'expense',
    selectedCat = '',
    selectedSub = '',
    activeCategoryFilter = null,
    isSyncing = false;

let currentStatusFilter = 'unprocessed',
    activeSettingsCat = null;

window.activeSubFilter = null;

let analyticsChartInstance = null;
let burnRateTabChartInstance = null;

let selectedChartPeriod = 'current_month';
let selectedChartMonths = [];
let selectedMonths = [new Date().getMonth()];

let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
