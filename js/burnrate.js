let burnRateTabChartInstance = null;

function getDaysCountForPeriod(filteredItems) {
    const now = new Date();
    if (selectedChartMonths.length > 0) {
        return selectedChartMonths.length * 30.5;
    }

    if (selectedChartPeriod === 'current_month') {
        return Math.max(1, now.getDate());
    } else if (selectedChartPeriod === '3m') {
        return 90;
    } else if (selectedChartPeriod === '6m') {
        return 180;
    } else if (selectedChartPeriod === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diffTime = Math.abs(now - startOfYear);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (selectedChartPeriod === 'all') {
        if (filteredItems.length === 0) return 1;
        const dates = filteredItems.map(i => new Date(getCleanDateStr(i.date)).getTime()).filter(t => !isNaN(t));
        if (dates.length === 0) return 1;
        const minDate = new Date(Math.min(...dates));
        const diffTime = Math.abs(now - minDate);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
    return 30;
}

function updateBurnRateTab() {
    if (document.getElementById('screen-burnrate').classList.contains('hidden')) return;

    const chartType = document.getElementById('burn-chart-type').value;
    const levelMode = document.getElementById('burn-level-mode').value;
    const dataMode = document.getElementById('burn-data-mode').value;
    const userFilter = document.getElementById('burn-user-filter').value;

    let filtered = getAnalyticsDataForPeriod();
    if (userFilter !== 'all') {
        filtered = filtered.filter(d => (d.user || 'Lukáš') === userFilter);
    }

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDark ? '#94a3b8' : '#64748b';

    let backgroundColors = [
        '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', 
        '#06b6d4', '#f97316', '#64748b', '#84cc16', '#a855f7'
    ];

    const statsContainer = document.getElementById('burn-stats-breakdown');
    const metricsContainer = document.getElementById('burn-metrics-cards');
    if(statsContainer) statsContainer.innerHTML = '';
    if(metricsContainer) metricsContainer.innerHTML = '';
    
    const aggregated = {};
    const categoryBreakdown = {};
    let totalAmount = 0;
    
    filtered.forEach(item => {
        let valid = false;
        if (dataMode === 'expense' && item.type === 'expense') valid = true;
        if (dataMode === 'income' && item.type === 'income') valid = true;
        if (dataMode === 'balance') valid = true;
        
        if (!valid) return;
        
        let val = item.amount;
        if (dataMode === 'balance' && item.type === 'expense') val = -val;
        
        let key = item.category;
        if (levelMode === 'sub') {
            key = item.category + (item.sub ? '|' + item.sub : '|');
        }
        
        if (!aggregated[key]) aggregated[key] = 0;
        aggregated[key] += val;

        if (!categoryBreakdown[item.category]) {
            categoryBreakdown[item.category] = { total: 0, subs: {} };
        }
        categoryBreakdown[item.category].total += val;
        
        const subName = item.sub ? item.sub : 'Nezaradené';
        if (!categoryBreakdown[item.category].subs[subName]) {
            categoryBreakdown[item.category].subs[subName] = 0;
        }
        categoryBreakdown[item.category].subs[subName] += val;
    });
    
    const labels = [];
    const dataVals = [];
    const sortedKeys = Object.keys(aggregated).sort((a,b) => Math.abs(aggregated[b]) - Math.abs(aggregated[a]));
    
    sortedKeys.forEach(k => {
        labels.push(k.replace('|', ' - '));
        dataVals.push(Math.abs(aggregated[k]));
        totalAmount += Math.abs(aggregated[k]);
    });

    const daysCount = getDaysCountForPeriod(filtered);
    const dailyBurn = totalAmount / daysCount;
    const monthlyProjected = dailyBurn * 30.5;

    if (metricsContainer) {
        metricsContainer.innerHTML = `
            <div class="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center">
                <span class="text-[7.5px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">Denný priemer</span>
                <span class="text-sm font-extrabold text-amber-500">${dailyBurn.toFixed(2)} €</span>
            </div>
            <div class="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center">
                <span class="text-[7.5px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">Denný Burn</span>
                <span class="text-sm font-extrabold text-amber-500">${dailyBurn.toFixed(2)} €</span>
            </div>
            <div class="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center">
                <span class="text-[7.5px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">Mesačný Odhad</span>
                <span class="text-sm font-extrabold text-amber-500">${monthlyProjected.toFixed(2)} €</span>
            </div>
        `;
    }
    
    const ctx = document.getElementById('burnRateTabChart').getContext('2d');
    if (burnRateTabChartInstance) burnRateTabChartInstance.destroy();
    
    burnRateTabChartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                borderRadius: chartType === 'bar' ? 4 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: chartType === 'doughnut', position: 'bottom', labels: { color: textColor, font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" } } },
                title: { display: false }
            },
            scales: chartType === 'bar' ? {
                y: { beginAtZero: true, ticks: { color: textColor, font: { size: 9 } }, grid: { color: isDark ? '#1e293b' : '#f1f5f9' } },
                x: { ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } }
            } : undefined,
            onClick: (e, elements, chart) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const label = chart.data.labels[idx];
                    let cat = label;
                    let sub = null;
                    if (levelMode === 'sub' && label.includes(' - ')) {
                        const parts = label.split(' - ');
                        cat = parts[0];
                        sub = parts[1] !== '' ? parts[1] : null;
                    }
                    filterFromStats(cat, sub);
                }
            }
        }
    });

    if (statsContainer && Object.keys(categoryBreakdown).length > 0) {
        let html = `<div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
            <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Kategória / Podkategória</span>
                <span>Suma / Podiel</span>
            </div>
            <div class="divide-y divide-slate-100 dark:divide-slate-700/50">`;

        const sortedCats = Object.keys(categoryBreakdown).sort((a,b) => Math.abs(categoryBreakdown[b].total) - Math.abs(categoryBreakdown[a].total));

        sortedCats.forEach((catName, idx) => {
            const catData = categoryBreakdown[catName];
            const catVal = Math.abs(catData.total);
            const catPct = totalAmount > 0 ? Math.round((catVal / totalAmount) * 100) : 0;
            const color = backgroundColors[idx % backgroundColors.length];

            html += `
            <div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div onclick="filterFromStats('${catName}')" class="flex justify-between items-center cursor-pointer mb-1.5">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                        <span class="text-xs font-extrabold uppercase">${catName}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-bold text-slate-400">${catPct}%</span>
                        <span class="text-xs font-extrabold">${catVal.toFixed(2)} €</span>
                    </div>
                </div>
                <div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
                    <div class="h-full rounded-full" style="width: ${catPct}%; background-color: ${color}"></div>
                </div>`;

            const sortedSubs = Object.keys(catData.subs).sort((a,b) => Math.abs(catData.subs[b]) - Math.abs(catData.subs[a]));
            if (sortedSubs.length > 0) {
                html += `<div class="pl-5 space-y-1 mt-2 border-l-2 border-slate-100 dark:border-slate-700 ml-1.5">`;
                sortedSubs.forEach((subName, sIdx) => {
                    const subVal = Math.abs(catData.subs[subName]);
                    const subPct = catVal > 0 ? Math.round((subVal / catVal) * 100) : 0;
                    const isLast = sIdx === sortedSubs.length - 1;
                    const prefixIcon = isLast ? '└── ' : '├── ';

                    html += `
                    <div onclick="filterFromStats('${catName}', '${subName}')" class="flex justify-between items-center text-[11px] py-1 cursor-pointer hover:opacity-80 transition-opacity">
                        <span class="font-medium text-slate-500 dark:text-slate-400 font-mono text-[10px]">${prefixIcon}<span class="font-sans font-bold text-slate-700 dark:text-slate-300">${subName}</span></span>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] text-slate-400 font-medium">${subPct}% z kat.</span>
                            <span class="font-bold text-xs">${subVal.toFixed(2)} €</span>
                        </div>
                    </div>`;
                });
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += `</div></div>`;
        statsContainer.innerHTML = html;
    } else if (statsContainer) {
        statsContainer.innerHTML = '<div class="text-center py-4 text-xs font-bold text-slate-400">Žiadne dáta pre zvolené obdobie</div>';
    }
}
