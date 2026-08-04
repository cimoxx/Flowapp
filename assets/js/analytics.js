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

function setChartPeriod(period) {
    selectedChartPeriod = period;
    selectedChartMonths = [];
    renderChartMonthChips();

    document.querySelectorAll('.period-chip').forEach(btn => btn.classList.remove('active'));

    ['p-chip-', 'bp-chip-'].forEach(prefix => {
        const btn = document.getElementById(`${prefix}${period}`);
        if (btn) btn.classList.add('active');
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

function getDaysCountForPeriod(filteredItems) {
    const now = new Date();

    if (selectedChartMonths.length > 0) return selectedChartMonths.length * 30.5;

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

        showToast({
            type: 'success',
            title: 'Pohľad uložený',
            text: name.trim()
        });
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

        if (p.isBurn) updateBurnRateTab();
        else updateAnalytics();

        showToast({
            type: 'info',
            title: 'Pohľad načítaný',
            text: p.name
        });
    }
}

function deletePreset(id, e) {
    if (e) e.stopPropagation();
    const preset = chartPresets.find(x => x.id === id);
    chartPresets = chartPresets.filter(x => x.id !== id);
    localStorage.setItem('f_chart_presets_v20', JSON.stringify(chartPresets));
    renderPresets();

    showToast({
        type: 'warning',
        title: 'Pohľad odstránený',
        text: preset ? preset.name : ''
    });
}

function renderPresets() {
    const isBurn = !document.getElementById('screen-burnrate').classList.contains('hidden');
    const containerId = isBurn ? 'burn-presets-container' : 'presets-container';
    const container = document.getElementById(containerId);
    if (!container) return;

    const relevant = chartPresets.filter(p => !!p.isBurn === isBurn);
    if (relevant.length === 0) {
        container.innerHTML = `
            <div class="empty-state !p-5 w-full">
                <div class="empty-state-icon !w-11 !h-11 !rounded-2xl">
                    <i data-lucide="bookmark" class="w-5 h-5"></i>
                </div>
                <div class="empty-state-title !text-[13px]">Zatiaľ nemáš uložené pohľady</div>
                <div class="empty-state-text">Ulož si aktuálne nastavenie filtrov a grafu pre rýchly návrat.</div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = relevant.map(p => `
        <div onclick="applyPreset('${p.id}')" class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl cursor-pointer text-[9px] font-bold shrink-0">
            <span>${p.name}</span>
            <button type="button" onclick="deletePreset('${p.id}', event)" class="text-slate-400 hover:text-red-500"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>
    `).join('');
    lucide.createIcons();
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
            selectedMonths = [curMonth, (curMonth - 1 + 12) % 12, (curMonth - 2 + 12) % 12];
        } else if (selectedChartPeriod === '6m') {
            selectedMonths = [];
            for (let i = 0; i < 6; i++) selectedMonths.push((curMonth - i + 12) % 12);
        } else if (selectedChartPeriod === 'year' || selectedChartPeriod === 'all') {
            selectedMonths = [0,1,2,3,4,5,6,7,8,9,10,11];
        }
    }

    showScreen('home');
    renderMonthChips();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateAnalytics() {
    if (document.getElementById('screen-analytics').classList.contains('hidden')) return;

    const chartType = document.getElementById('chart-type').value;
    const levelMode = document.getElementById('chart-level-mode').value;
    const dataMode = document.getElementById('chart-data-mode').value;
    const userFilter = document.getElementById('chart-user-filter').value;

    let filtered = getAnalyticsDataForPeriod();
    if (userFilter !== 'all') {
        filtered = filtered.filter(i => (i.user || 'Lukáš') === userFilter);
    }

    const sums = {};
    filtered.forEach(item => {
        if (dataMode === 'expense' && item.type !== 'expense') return;
        if (dataMode === 'income' && item.type !== 'income') return;

        let key = item.category;
        if (levelMode === 'sub') {
            key = item.sub ? `${item.category} / ${item.sub}` : `${item.category} / Nezaradené`;
        }

        const val = parseFloat(item.amount);
        if (!sums[key]) sums[key] = 0;
        if (dataMode === 'balance') sums[key] += item.type === 'income' ? val : -val;
        else sums[key] += val;
    });

    const labels = Object.keys(sums).sort((a, b) => Math.abs(sums[b]) - Math.abs(sums[a]));
    const data = labels.map(k => sums[k]);
    const total = data.reduce((a, b) => a + b, 0);

    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
        '#06b6d4', '#f97316', '#84cc16', '#64748b', '#d946ef'
    ];

    const statsContainer = document.getElementById('chart-stats-summary');

    if (labels.length === 0) {
        if (analyticsChartInstance) {
            analyticsChartInstance.destroy();
            analyticsChartInstance = null;
        }
        statsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="pie-chart" class="w-6 h-6"></i>
                </div>
                <div class="empty-state-title">Žiadne dáta pre graf</div>
                <div class="empty-state-text">Skús zmeniť obdobie, osobu alebo typ dát. Keď pribudnú transakcie, graf sa zobrazí automaticky.</div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const ctx = document.getElementById('analyticsChart').getContext('2d');
    if (analyticsChartInstance) analyticsChartInstance.destroy();

    analyticsChartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: chartType === 'doughnut',
                    position: 'bottom',
                    labels: { font: { size: 10 } }
                }
            }
        }
    });

    if (statsContainer) {
        statsContainer.innerHTML = labels.map((l, idx) => {
            const val = sums[l];
            const pct = total !== 0 ? ((val / total) * 100).toFixed(1) : '0';
            const [cat, sub] = l.split(' / ');
            return `
                <div onclick="filterFromStats('${cat}', ${sub ? `'${sub}'` : 'null'})" class="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <div class="flex items-center gap-2">
                        <div class="w-2.5 h-2.5 rounded-full" style="background:${colors[idx % colors.length]}"></div>
                        <span class="text-xs font-bold">${l}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-extrabold">${val.toFixed(2)} €</div>
                        <div class="text-[9px] font-bold text-slate-400">${pct}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function updateBurnRateTab() {
    if (document.getElementById('screen-burnrate').classList.contains('hidden')) return;

    const chartType = document.getElementById('burn-chart-type').value;
    const levelMode = document.getElementById('burn-level-mode').value;
    const dataMode = document.getElementById('burn-data-mode').value;
    const userFilter = document.getElementById('burn-user-filter').value;

    let filtered = getAnalyticsDataForPeriod();
    if (userFilter !== 'all') {
        filtered = filtered.filter(i => (i.user || 'Lukáš') === userFilter);
    }

    const daysCount = getDaysCountForPeriod(filtered);
    const sums = {};

    filtered.forEach(item => {
        if (dataMode === 'expense' && item.type !== 'expense') return;
        if (dataMode === 'income' && item.type !== 'income') return;

        let key = item.category;
        if (levelMode === 'sub') {
            key = item.sub ? `${item.category} / ${item.sub}` : `${item.category} / Nezaradené`;
        }

        const val = parseFloat(item.amount);
        if (!sums[key]) sums[key] = 0;
        if (dataMode === 'balance') sums[key] += item.type === 'income' ? val : -val;
        else sums[key] += val;
    });

    const labels = Object.keys(sums).sort((a, b) => Math.abs(sums[b]) - Math.abs(sums[a]));
    const data = labels.map(k => sums[k]);
    const total = data.reduce((a, b) => a + b, 0);
    const dailyAvgTotal = total / daysCount;
    const monthlyForecastTotal = dailyAvgTotal * 30.5;

    const cardsContainer = document.getElementById('burn-metrics-cards');
    const breakdownContainer = document.getElementById('burn-stats-breakdown');

    if (labels.length === 0) {
        if (burnRateTabChartInstance) {
            burnRateTabChartInstance.destroy();
            burnRateTabChartInstance = null;
        }

        if (cardsContainer) cardsContainer.innerHTML = '';
        if (breakdownContainer) {
            breakdownContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="flame" class="w-6 h-6"></i>
                    </div>
                    <div class="empty-state-title">Žiadne dáta pre burn rate</div>
                    <div class="empty-state-text">Pre zvolený výber sa nenašli žiadne transakcie. Skús zmeniť filtre alebo počkaj na nové dáta.</div>
                </div>
            `;
            lucide.createIcons();
        }
        return;
    }

    if (cardsContainer) {
        cardsContainer.innerHTML = `
            <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
                <span class="text-[8px] font-black text-amber-500 uppercase tracking-wider block mb-1">Celkom</span>
                <span class="text-sm font-extrabold text-amber-500">${total.toFixed(2)} €</span>
            </div>
            <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                <span class="text-[8px] font-black text-emerald-500 uppercase tracking-wider block mb-1">Denný Priemer</span>
                <span class="text-sm font-extrabold text-emerald-500">${dailyAvgTotal.toFixed(2)} €</span>
            </div>
            <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center">
                <span class="text-[8px] font-black text-blue-500 uppercase tracking-wider block mb-1">Mesačný Odhad</span>
                <span class="text-sm font-extrabold text-blue-500">${monthlyForecastTotal.toFixed(2)} €</span>
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
                data: data,
                backgroundColor: '#f59e0b',
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    if (breakdownContainer) {
        breakdownContainer.innerHTML = labels.map(l => {
            const val = sums[l];
            const dailyAvg = val / daysCount;
            const monthlyForecast = dailyAvg * 30.5;
            const [cat, sub] = l.split(' / ');

            return `
                <div onclick="filterFromStats('${cat}', ${sub ? `'${sub}'` : 'null'})" class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-amber-500/50 transition-all space-y-1.5">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-extrabold">${l}</span>
                        <span class="text-xs font-black text-amber-500">${val.toFixed(2)} €</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-[9px] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div>
                            <span class="text-slate-400 block font-bold">Denný priemer</span>
                            <span class="font-extrabold text-slate-700 dark:text-slate-300">${dailyAvg.toFixed(2)} €/deň</span>
                        </div>
                        <div class="text-right">
                            <span class="text-slate-400 block font-bold">Predpoklad / mesiac</span>
                            <span class="font-extrabold text-slate-700 dark:text-slate-300">${monthlyForecast.toFixed(2)} €</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
