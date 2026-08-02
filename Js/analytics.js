let analyticsChartInstance = null;

function setChartPeriod(period) {
    selectedChartPeriod = period;
    selectedChartMonths = [];
    renderChartMonthChips();

    document.querySelectorAll('.period-chip').forEach(btn => btn.classList.remove('active'));
    
    ['p-chip-', 'bp-chip-'].forEach(prefix => {
        const btn = document.getElementById(`${prefix}${period}`);
        if(btn) btn.classList.add('active');
    });

    updateAnalytics();
    updateBurnRateTab();
}

function getAnalyticsDataForPeriod() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    return db.filter(d => {
        const cleanD = getCleanDateStr(d.date);
        const parts = cleanD.split('-');
        if (parts.length !== 3) return false;

        const itemYear = parseInt(parts[0]);
        const itemMonth = parseInt(parts[1]) - 1;
        const itemDate = new Date(itemYear, itemMonth, parseInt(parts[2]));

        if (selectedChartMonths.length > 0) {
            return selectedChartMonths.includes(itemMonth);
        }

        if (selectedChartPeriod === 'current_month') {
            return itemYear === curYear && itemMonth === curMonth;
        } else if (selectedChartPeriod === '3m') {
            const cutoff = new Date();
            cutoff.setMonth(now.getMonth() - 3);
            return itemDate >= cutoff;
        } else if (selectedChartPeriod === '6m') {
            const cutoff = new Date();
            cutoff.setMonth(now.getMonth() - 6);
            return itemDate >= cutoff;
        } else if (selectedChartPeriod === 'year') {
            return itemYear === curYear;
        } else if (selectedChartPeriod === 'all') {
            return true;
        }
        return true;
    });
}

function saveCurrentPreset() {
    const name = prompt("Zadajte názov pohľadu:");
    if (name && name.trim() !== "") {
        const isBurn = !document.getElementById('screen-burnrate').classList.contains('hidden');
        const prefix = isBurn ? 'burn-' : 'chart-';
        const preset = {
            id: 'P-' + Date.now(),
            name: name.trim(),
            isBurn: isBurn,
            period: selectedChartPeriod,
            months: [...selectedChartMonths],
            type: document.getElementById(prefix + 'type').value,
            level: document.getElementById(prefix + 'level-mode').value,
            data: document.getElementById(prefix + 'data-mode').value,
            user: document.getElementById(prefix + 'user-filter').value
        };
        chartPresets.push(preset);
        localStorage.setItem('f_chart_presets_v20', JSON.stringify(chartPresets));
        renderPresets();
    }
}

function applyPreset(id) {
    const p = chartPresets.find(x => x.id === id);
    if (p) {
        selectedChartPeriod = p.period;
        selectedChartMonths = [...(p.months || [])];
        renderChartMonthChips();

        const prefix = p.isBurn ? 'burn-' : 'chart-';
        if (document.getElementById(prefix + 'type')) document.getElementById(prefix + 'type').value = p.type;
        if (document.getElementById(prefix + 'level-mode')) document.getElementById(prefix + 'level-mode').value = p.level;
        if (document.getElementById(prefix + 'data-mode')) document.getElementById(prefix + 'data-mode').value = p.data;
        if (document.getElementById(prefix + 'user-filter')) document.getElementById(prefix + 'user-filter').value = p.user;

        if (p.isBurn) updateBurnRateTab(); else updateAnalytics();
    }
}

function deletePreset(id, e) {
    e.stopPropagation();
    if (confirm("Zmazať uložený pohľad?")) {
        chartPresets = chartPresets.filter(x => x.id !== id);
        localStorage.setItem('f_chart_presets_v20', JSON.stringify(chartPresets));
        renderPresets();
    }
}

function renderPresets() {
    const isBurn = !document.getElementById('screen-burnrate').classList.contains('hidden');
    const containerId = isBurn ? 'burn-presets-container' : 'presets-container';
    const container = document.getElementById(containerId);
    if (!container) return;

    const filteredPresets = chartPresets.filter(p => !!p.isBurn === isBurn);

    if (filteredPresets.length === 0) {
        container.innerHTML = `<span class="text-[9px] text-slate-400 font-bold px-1">Žiadne uložené pohľady</span>`;
        return;
    }

    container.innerHTML = filteredPresets.map(p => `
        <div onclick="applyPreset('${p.id}')" class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-[9.5px] font-extrabold cursor-pointer shrink-0">
            <span>${p.name}</span>
            <button type="button" onclick="deletePreset('${p.id}', event)" class="text-slate-400 hover:text-red-500 ml-1"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>
    `).join('');
    lucide.createIcons();
}

function updateAnalytics() {
    if (document.getElementById('screen-analytics').classList.contains('hidden')) return;

    const chartType = document.getElementById('chart-type').value;
    const levelMode = document.getElementById('chart-level-mode').value;
    const dataMode = document.getElementById('chart-data-mode').value;
    const userFilter = document.getElementById('chart-user-filter').value;

    let filtered = getAnalyticsDataForPeriod();

    if (userFilter !== 'all') {
        filtered = filtered.filter(d => (d.user || 'Lukáš') === userFilter);
    }

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDark ? '#94a3b8' : '#64748b';

    let backgroundColors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', 
        '#06b6d4', '#f97316', '#64748b', '#84cc16', '#a855f7',
        '#14b8a6', '#6366f1', '#d97706', '#f43f5e', '#a855f7'
    ];

    const statsContainer = document.getElementById('chart-stats-summary');
    if(statsContainer) statsContainer.innerHTML = '';
    
    const aggregated = {};
    let totalAmount = 0;
    
    filtered.forEach(item => {
        let valid = false;
        if (dataMode === 'expense' && item.type === 'expense') valid = true;
        if (dataMode === 'income' && item.type === 'income') valid = true;
        if (dataMode === 'balance') valid = true;
        
        if (!valid) return;
        
        let key = item.category;
        if (levelMode === 'sub') {
            key = item.category + (item.sub ? '|' + item.sub : '|');
        }
        
        if (!aggregated[key]) aggregated[key] = 0;
        
        let val = item.amount;
        if (dataMode === 'balance' && item.type === 'expense') val = -val;
        
        aggregated[key] += val;
    });
    
    const labels = [];
    const dataVals = [];
    const sortedKeys = Object.keys(aggregated).sort((a,b) => Math.abs(aggregated[b]) - Math.abs(aggregated[a]));
    
    sortedKeys.forEach(k => {
        labels.push(k.replace('|', ' - '));
        dataVals.push(Math.abs(aggregated[k]));
        totalAmount += Math.abs(aggregated[k]);
    });

    const ctx = document.getElementById('analyticsChart').getContext('2d');
    if (analyticsChartInstance) analyticsChartInstance.destroy();
    
    analyticsChartInstance = new Chart(ctx, {
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

    if(statsContainer && labels.length > 0) {
        let html = '';
        sortedKeys.forEach((k, idx) => {
            const val = Math.abs(aggregated[k]);
            const pct = totalAmount > 0 ? Math.round((val/totalAmount)*100) : 0;
            const color = backgroundColors[idx % backgroundColors.length];
            
            let cat = k;
            let sub = null;
            if (levelMode === 'sub' && k.includes('|')) {
                const parts = k.split('|');
                cat = parts[0];
                sub = parts[1] !== '' ? parts[1] : null;
            }

            html += `
            <div onclick="filterFromStats('${cat}', ${sub ? "'" + sub + "'" : 'null'})" class="flex flex-col gap-1 cursor-pointer bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                        <span class="text-xs font-bold">${cat}${sub ? ' <span class="text-slate-400 font-medium">/</span> ' + sub : ''}</span>
                    </div>
                    <div class="text-xs font-extrabold">${val.toFixed(2)} €</div>
                </div>
                <div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${color}"></div>
                </div>
            </div>`;
        });
        statsContainer.innerHTML = html;
    } else if (statsContainer) {
        statsContainer.innerHTML = '<div class="text-center py-4 text-xs font-bold text-slate-400">Žiadne dáta pre zvolené obdobie</div>';
    }
}
