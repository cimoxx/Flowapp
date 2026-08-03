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

function renderSummary(sums, currentFiltered) {
    const container = document.getElementById('category-summary');
    if (!container) return;
    
    // Zoradenie hlavných kategórií od najvyššej sumy po najnižšiu[span_0](start_span)[span_0](end_span)
    const sortedKeys = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);

    if (sortedKeys.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="flex gap-1.5 overflow-x-auto no-scrollbar py-1">';
    sortedKeys.forEach(k => {
        const isActive = activeCategoryFilter === k;
        html += `
            <div onclick="toggleFilter('${k}')" class="summary-card ${isActive ? 'active-filter' : ''} p-2 cursor-pointer flex flex-col justify-between shrink-0">
                <span class="text-[8px] font-black uppercase text-slate-400 truncate">${k}</span>
                <span class="text-xs font-extrabold">${sums[k].toFixed(2)} €</span>
            </div>
        `;
    });
    html += '</div>';

    // Ak je zvolená hlavná kategória, vykreslíme podkategórie tiež zoradené od najvyššej sumy[span_1](start_span)[span_1](end_span)
    if (activeCategoryFilter !== null) {
        const subSums = {};
        currentFiltered.forEach(item => {
            if (item.type === 'expense' && item.category === activeCategoryFilter) {
                const subName = item.sub ? item.sub : 'Nezaradené';
                if (!subSums[subName]) subSums[subName] = 0;
                subSums[subName] += item.amount;
            }
        });

        // Zoradenie podkategórií od najvyššej sumy po najnižšiu
        const sortedSubs = Object.keys(subSums).sort((a, b) => subSums[b] - subSums[a]);
        if (sortedSubs.length > 0) {
            html += '<div class="flex gap-1.5 overflow-x-auto no-scrollbar py-1 mt-1 border-t border-slate-100 dark:border-slate-800/60 pt-2">';
            sortedSubs.forEach(s => {
                const isSubActive = window.activeSubFilter === s;
                html += `
                    <div onclick="toggleSubFilter('${s}')" class="summary-card ${isSubActive ? 'active-filter' : ''} p-2 cursor-pointer flex flex-col justify-between shrink-0">
                        <span class="text-[8px] font-black uppercase text-amber-500/80 truncate">${s}</span>
                        <span class="text-xs font-extrabold">${subSums[s].toFixed(2)} €</span>
                    </div>
                `;
            });
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

function renderList() {
    const list = document.getElementById('transaction-list');
    let currentFiltered = getFilteredData();
    
    if (currentStatusFilter === 'unprocessed') {
        currentFiltered = currentFiltered.filter(d => !d.processed);
    }

    const sums = {}; 
    currentFiltered.forEach(item => { 
        if (item.type === 'expense') {
            if (!sums[item.category]) sums[item.category] = 0;
            sums[item.category] += item.amount; 
        }
    });
    renderSummary(sums, currentFiltered);

    if (activeCategoryFilter) {
        currentFiltered = currentFiltered.filter(d => d.category === activeCategoryFilter);
        if (window.activeSubFilter) {
            currentFiltered = currentFiltered.filter(d => (d.sub ? d.sub : 'Nezaradené') === window.activeSubFilter);
        }
    }

    updateTotals(currentFiltered);

    document.getElementById('clear-cat-filter').classList.toggle('hidden', !activeCategoryFilter);
    
    const sortedItems = [...currentFiltered].sort((a, b) => {
        const dateA = getCleanDateStr(a.date);
        const dateB = getCleanDateStr(b.date);
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(b.id).localeCompare(String(a.id));
    });

    const grouped = {};
    sortedItems.forEach(item => {
        const dayKey = getCleanDateStr(item.date) || 'Neznámy dátum';
        if (!grouped[dayKey]) grouped[dayKey] = [];
        grouped[dayKey].push(item);
    });

    if (Object.keys(grouped).length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-slate-400 font-extrabold text-xs uppercase">Žiadne transakcie</div>`;
        return;
    }

    let html = '';
    Object.keys(grouped).forEach(dayKey => {
        const dayItems = grouped[dayKey];
        const daySum = dayItems.reduce((acc, curr) => curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount), 0);
        
        html += `
        <div class="day-group mb-3">
            <div class="flex justify-between items-center px-2 py-1 mb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <span>${formatDayLabel(dayKey)}</span>
                <span class="${daySum >= 0 ? 'text-emerald-500' : 'text-slate-400'}">${daySum >= 0 ? '+' : ''}${daySum.toFixed(2)} €</span>
            </div>
            <div class="space-y-1">
                ${dayItems.map(item => `
                    <div class="swipe-wrapper" id="wrapper-${item.id}">
                        <div class="swipe-bg" id="bg-${item.id}">
                            <span class="left-action flex items-center gap-1.5"><i data-lucide="check" class="w-4 h-4"></i> <span id="bg-left-text-${item.id}">Zapísaná</span></span>
                            <span class="right-action flex items-center gap-1.5"><span>Vymazať</span> <i data-lucide="trash-2" class="w-4 h-4"></i></span>
                        </div>
                        <div class="swipe-content p-4 flex items-center justify-between ${item.processed ? 'processed' : ''}" 
                             id="item-${item.id}"
                             ontouchstart="handleSwipeStart(event, '${item.id}')"
                             ontouchmove="handleSwipeMove(event, '${item.id}')"
                             ontouchend="handleSwipeEnd(event, '${item.id}', ${item.processed})">
                            
                            <div class="flex-1">
                                <div class="flex justify-between items-center pr-3">
                                    <span class="font-bold text-xs tracking-tight">${item.category}${item.sub ? ' <span class="text-slate-400 font-medium">/</span> '+item.sub : ''}</span>
                                    <span class="font-extrabold text-xs ${item.type === 'income' ? 'text-emerald-500' : ''}">${parseFloat(item.amount).toFixed(2)}€</span>
                                </div>
                                <div class="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide mt-1">${item.note ? item.note : ''}</div>
                            </div>

                            <div onclick="event.stopPropagation(); toggleProcessed('${item.id}')" class="w-7 h-7 rounded-lg flex items-center justify-center border ml-3 cursor-pointer shrink-0 ${item.processed ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 dark:border-slate-800 text-slate-300'}">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    });

    list.innerHTML = html;
    lucide.createIcons();
}
