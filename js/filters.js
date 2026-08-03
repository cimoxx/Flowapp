let currentStatusFilter = 'unprocessed';
let activeCategoryFilter = null;
window.activeSubFilter = null;
let selectedMonths = [new Date().getMonth()];
let selectedChartPeriod = 'current_month';
let selectedChartMonths = [];

function toggleStatusFilter() {
    const toggle = document.getElementById('ui-toggle');
    const optUnprocessed = document.getElementById('opt-unprocessed');
    const optAll = document.getElementById('opt-all');

    if (currentStatusFilter === 'unprocessed') {
        currentStatusFilter = 'all';
        toggle.classList.add('all-active');
        optUnprocessed.classList.remove('active');
        optAll.classList.add('active');
    } else {
        currentStatusFilter = 'unprocessed';
        toggle.classList.remove('all-active');
        optUnprocessed.classList.add('active');
        optAll.classList.remove('active');
    }
    renderList();
}

function resetCategoryFilter() {
    activeCategoryFilter = null;
    window.activeSubFilter = null;
    renderList();
}

function toggleFilter(cat) {
    if (activeCategoryFilter === cat) {
        activeCategoryFilter = null;
        window.activeSubFilter = null;
    } else {
        activeCategoryFilter = cat;
        window.activeSubFilter = null;
    }
    renderList();
}

function toggleSubFilter(sub) {
    if (window.activeSubFilter === sub) {
        window.activeSubFilter = null;
    } else {
        window.activeSubFilter = sub;
    }
    renderList();
}

function filterFromStats(cat, sub = null) {
    activeCategoryFilter = cat;
    window.activeSubFilter = sub;
    
    if (selectedChartMonths && selectedChartMonths.length > 0) {
        selectedMonths = [...selectedChartMonths];
    } else {
        const now = new Date();
        const curMonth = now.getMonth();
        if (selectedChartPeriod === 'current_month') {
            selectedMonths = [curMonth];
        } else if (selectedChartPeriod === '3m') {
            selectedMonths = [curMonth, (curMonth-1+12)%12, (curMonth-2+12)%12];
        } else if (selectedChartPeriod === '6m') {
            selectedMonths = [];
            for (let i = 0; i < 6; i++) {
                selectedMonths.push((curMonth-i+12)%12);
            }
        } else if (selectedChartPeriod === 'year' || selectedChartPeriod === 'all') {
            selectedMonths = [0,1,2,3,4,5,6,7,8,9,10,11];
        }
    }

    showScreen('home');
    renderMonthChips();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMonthSelect(monthIdx) {
    if (selectedMonths.includes(monthIdx)) {
        selectedMonths = selectedMonths.filter(m => m !== monthIdx);
    } else {
        selectedMonths.push(monthIdx);
    }
    renderMonthChips();
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    scrollToActiveMonth(monthIdx);
}

function renderMonthChips() {
    const container = document.getElementById('filter-months-container');
    const months = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];
    container.innerHTML = months.map((m, i) => {
        const isActive = selectedMonths.includes(i);
        return `<button type="button" id="m-chip-${i}" onclick="toggleMonthSelect(${i})" class="month-chip ${isActive ? 'active' : ''}">${m}</button>`;
    }).join('');
    
    if (selectedMonths.length > 0) {
        scrollToActiveMonth(selectedMonths[0]);
    }
}

function scrollToActiveMonth(monthIdx) {
    setTimeout(() => {
        const activeChip = document.getElementById(`m-chip-${monthIdx}`);
        if (activeChip) {
            activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 50);
}

function toggleChartMonthSelect(monthIdx) {
    if (selectedChartMonths.includes(monthIdx)) {
        selectedChartMonths = selectedChartMonths.filter(m => m !== monthIdx);
    } else {
        selectedChartMonths.push(monthIdx);
    }
    renderChartMonthChips();
    updateAnalytics();
    updateBurnRateTab();
}

function renderChartMonthChips() {
    const months = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];
    
    ['chart-months-container', 'burn-months-container'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = months.map((m, i) => {
            const isActive = selectedChartMonths.includes(i);
            return `<button type="button" onclick="toggleChartMonthSelect(${i})" class="chart-month-chip ${isActive ? 'active' : ''}">${m}</button>`;
        }).join('');
    });
}

function getFilteredData() {
    const selYear = parseInt(document.getElementById('filter-year').value);
    return db.filter(d => { 
        const cleanDate = getCleanDateStr(d.date);
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            const itemYear = parseInt(parts[0]);
            const itemMonth = parseInt(parts[1]) - 1; 
            const monthMatches = selectedMonths.length === 0 || selectedMonths.includes(itemMonth);
            return monthMatches && itemYear === selYear;
        }
        return false;
    });
}

