function setAnalyticsDataMode(scope, mode) {
    if (scope === 'chart') {
        const input = document.getElementById('chart-data-mode');
        if (input) input.value = mode;

        ['expense', 'income', 'balance'].forEach(m => {
            const btn = document.getElementById(`chart-data-${m}`);
            if (btn) btn.classList.toggle('active', m === mode);
        });

        updateAnalytics();
        return;
    }

    const input = document.getElementById('burn-data-mode');
    if (input) input.value = mode;

    ['expense', 'income', 'balance'].forEach(m => {
        const btn = document.getElementById(`burn-data-${m}`);
        if (btn) btn.classList.toggle('active', m === mode);
    });

    updateBurnRateTab();
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

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

function getAnalyticsDataForPeriod(periodOverride = null, monthsOverride = null) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const activePeriod = periodOverride || selectedChartPeriod;
    const activeMonths = monthsOverride || selectedChartMonths;

    return db.filter(d => {
        const cleanD = getCleanDateStr(d.date);
        const parts = cleanD.split('-');
        if (parts.length !== 3) return false;

        const itemYear = parseInt(parts[0], 10);
        const itemMonth = parseInt(parts[1], 10) - 1;
        const itemDate = new Date(itemYear, itemMonth, parseInt(parts[2], 10));

        if (activeMonths.length > 0) {
            // Month chips represent months within the currently selected year.
            // Without the year check, selecting e.g. Jan would aggregate Jan
            // from every year in the database.
            const yearEl = document.getElementById('filter-year');
            const selectedYear = parseInt(yearEl?.value || curYear, 10);
            return itemYear === selectedYear && activeMonths.includes(itemMonth);
        }

        if (activePeriod === 'current_month') {
            return itemYear === curYear && itemMonth === curMonth;
        }

        if (activePeriod === '3m') {
            const cutoff = new Date();
            cutoff.setMonth(now.getMonth() - 3);
            return itemDate >= cutoff;
        }

        if (activePeriod === '6m') {
            const cutoff = new Date();
            cutoff.setMonth(now.getMonth() - 6);
            return itemDate >= cutoff;
        }

        if (activePeriod === 'year') {
            return itemYear === curYear;
        }

        return true;
    });
}

function getPreviousPeriodData() {
    const now = new Date();
    const curMonth = now.getMonth();

    if (selectedChartMonths.length > 0) {
        const prevMonths = selectedChartMonths
            .map(m => (m - 1 + 12) % 12)
            .filter((m, idx, arr) => arr.indexOf(m) === idx);

        return getAnalyticsDataForPeriod(selectedChartPeriod, prevMonths);
    }

    if (selectedChartPeriod === 'current_month') {
        return db.filter(d => {
            const cleanD = getCleanDateStr(d.date);
            const parts = cleanD.split('-');
            if (parts.length !== 3) return false;

            const itemYear = parseInt(parts[0], 10);
            const itemMonth = parseInt(parts[1], 10) - 1;
            const prevMonth = (curMonth - 1 + 12) % 12;
            const prevYear = curMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();

            return itemYear === prevYear && itemMonth === prevMonth;
        });
    }

    if (selectedChartPeriod === '3m') {
        const prevEnd = new Date();
        prevEnd.setMonth(now.getMonth() - 3);
        const prevStart = new Date();
        prevStart.setMonth(now.getMonth() - 6);

        return db.filter(d => {
            const itemDate = new Date(getCleanDateStr(d.date));
            return itemDate >= prevStart && itemDate < prevEnd;
        });
    }

    if (selectedChartPeriod === '6m') {
        const prevEnd = new Date();
        prevEnd.setMonth(now.getMonth() - 6);
        const prevStart = new Date();
        prevStart.setMonth(now.getMonth() - 12);

        return db.filter(d => {
            const itemDate = new Date(getCleanDateStr(d.date));
            return itemDate >= prevStart && itemDate < prevEnd;
        });
    }

    if (selectedChartPeriod === 'year') {
        const prevYear = now.getFullYear() - 1;
        return db.filter(d => {
            const cleanD = getCleanDateStr(d.date);
            const parts = cleanD.split('-');
            return parts.length === 3 && parseInt(parts[0], 10) === prevYear;
        });
    }

    return [];
}

function getDaysCountForPeriod(filteredItems) {
    const now = new Date();

    if (selectedChartMonths.length > 0) return selectedChartMonths.length * 30.5;
    if (selectedChartPeriod === 'current_month') return Math.max(1, now.getDate());
    if (selectedChartPeriod === '3m') return 90;
    if (selectedChartPeriod === '6m') return 180;

    if (selectedChartPeriod === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diffTime = Math.abs(now - startOfYear);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    if (selectedChartPeriod === 'all') {
        if (filteredItems.length === 0) return 1;

        const timestamps = filteredItems
            .map(i => new Date(getCleanDateStr(i.date)).getTime())
            .filter(t => !isNaN(t));

        if (timestamps.length === 0) return 1;

        const minDate = new Date(Math.min(...timestamps));
        const diffTime = Math.abs(now - minDate);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return 30;
}

function filterFromStats(cat, sub = null) {
    activeCategoryFilter = cat;
    window.activeSubFilter = sub;

    if (selectedChartMonths.length > 0) {
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
        } else {
            selectedMonths = [0,1,2,3,4,5,6,7,8,9,10,11];
        }
    }

    showScreen('home');
    renderMonthChips();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildAggregateData(filtered, dataMode, levelMode) {
    const sums = {};

    filtered.forEach(item => {
        if (dataMode === 'expense' && item.type !== 'expense') return;
        if (dataMode === 'income' && item.type !== 'income') return;

        let key = item.category || 'Nezaradené';
        if (levelMode === 'sub') {
            key = item.sub ? `${item.category} / ${item.sub}` : `${item.category} / Nezaradené`;
        }

        const val = parseFloat(item.amount) || 0;
        if (!sums[key]) sums[key] = 0;

        if (dataMode === 'balance') {
            sums[key] += item.type === 'income' ? val : -val;
        } else {
            sums[key] += val;
        }
    });

    return { working: [...filtered], sums };
}

function buildNestedBreakdown(filtered, dataMode) {
    const result = {};

    filtered.forEach(item => {
        if (dataMode === 'expense' && item.type !== 'expense') return;
        if (dataMode === 'income' && item.type !== 'income') return;

        const cat = item.category || 'Nezaradené';
        const sub = item.sub || 'Nezaradené';
        const amount = parseFloat(item.amount) || 0;

        if (!result[cat]) result[cat] = { total: 0, subs: {} };
        if (!result[cat].subs[sub]) result[cat].subs[sub] = 0;

        const signedValue = dataMode === 'balance'
            ? (item.type === 'income' ? amount : -amount)
            : amount;

        result[cat].total += signedValue;
        result[cat].subs[sub] += signedValue;
    });

    return result;
}

function toggleBreakdownGroup(scope, cat) {
    if (scope === 'analytics') {
        analyticsBreakdownExpanded[cat] = !analyticsBreakdownExpanded[cat];
        updateAnalytics();
        return;
    }

    burnBreakdownExpanded[cat] = !burnBreakdownExpanded[cat];
    updateBurnRateTab();
}

function renderTreeBreakdown(containerId, nestedData, accentColors, scope = 'analytics') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stateObj = scope === 'analytics' ? analyticsBreakdownExpanded : burnBreakdownExpanded;
    const catEntries = Object.entries(nestedData).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));

    if (catEntries.length === 0) {
        container.innerHTML = '';
        return;
    }

    const grandTotal = catEntries.reduce((sum, [, val]) => sum + Math.abs(val.total), 0);

    catEntries.forEach(([cat]) => {
        if (typeof stateObj[cat] === 'undefined') {
            stateObj[cat] = true;
        }
    });

    container.innerHTML = `
        <div class="tree-breakdown-card">
            <div class="tree-breakdown-header">
                <span>Kategória / Podkategória</span>
                <span>Suma / Podiel</span>
            </div>

            ${catEntries.map(([cat, data], idx) => {
                const catTotalAbs = Math.abs(data.total);
                const catPct = grandTotal > 0 ? (catTotalAbs / grandTotal) * 100 : 0;
                const color = accentColors[idx % accentColors.length];
                const subEntries = Object.entries(data.subs).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
                const expanded = !!stateObj[cat];

                return `
                    <div class="tree-group">
                        <div class="tree-top-row tree-clickable" onclick="toggleBreakdownGroup('${scope}', '${String(cat).replace(/'/g, "\\'")}')">
                            <div class="tree-cat-left">
                                <div class="tree-cat-name-row">
                                    <span class="tree-color-dot" style="background:${color}"></span>
                                    <span class="tree-cat-name">${cat}</span>
                                    <span class="tree-expand-indicator">${expanded ? '−' : '+'}</span>
                                </div>
                                <div class="tree-progress">
                                    <div class="tree-progress-bar" style="width:${catPct.toFixed(1)}%; background:${color}"></div>
                                </div>
                            </div>

                            <div class="tree-cat-right">
                                <span class="tree-cat-share">${catPct.toFixed(0)}%</span>
                                <span class="tree-cat-amount">${data.total.toFixed(2)} €</span>
                            </div>
                        </div>

                        ${expanded ? `
                            <div class="tree-sub-list">
                                ${subEntries.map(([sub, subVal]) => {
                                    const subPct = catTotalAbs > 0 ? (Math.abs(subVal) / catTotalAbs) * 100 : 0;
                                    return `
                                        <div class="tree-sub-row" onclick="filterFromStats('${String(cat).replace(/'/g, "\\'")}', '${String(sub).replace(/'/g, "\\'")}')">
                                            <div class="tree-sub-left">
                                                <span class="tree-branch">└─</span>
                                                <span class="tree-sub-name">${sub}</span>
                                            </div>
                                            <div class="tree-sub-right">
                                                <span class="tree-sub-share">${subPct.toFixed(0)}% z kat.</span>
                                                <span class="tree-sub-amount">${subVal.toFixed(2)} €</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderAnalyticsSummaryCards(filtered, sums, dataMode) {
    const container = document.getElementById('analytics-summary-cards');
    if (!container) return;

    const labels = Object.keys(sums).sort((a, b) => Math.abs(sums[b]) - Math.abs(sums[a]));
    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const topCategory = labels[0] || '—';

    let transactionCount = filtered.length;
    if (dataMode === 'expense') transactionCount = filtered.filter(i => i.type === 'expense').length;
    if (dataMode === 'income') transactionCount = filtered.filter(i => i.type === 'income').length;

    const avg = transactionCount > 0 ? total / transactionCount : 0;

    container.innerHTML = `
        <div class="summary-insight-card">
            <div class="summary-insight-label">Celková suma</div>
            <div class="summary-insight-value">${total.toFixed(2)} €</div>
            <div class="summary-insight-sub">${dataMode === 'balance' ? 'Výsledná bilancia za zvolené obdobie.' : 'Súčet zvolených dát za aktuálny pohľad.'}</div>
        </div>
        <div class="summary-insight-card">
            <div class="summary-insight-label">Top kategória</div>
            <div class="summary-insight-value">${topCategory}</div>
            <div class="summary-insight-sub">${topCategory !== '—' ? `${Math.abs(sums[topCategory]).toFixed(2)} €` : 'Bez dostupných dát.'}</div>
        </div>
        <div class="summary-insight-card">
            <div class="summary-insight-label">Počet transakcií</div>
            <div class="summary-insight-value">${transactionCount}</div>
            <div class="summary-insight-sub">Počet záznamov započítaných do grafu.</div>
        </div>
        <div class="summary-insight-card">
            <div class="summary-insight-label">Priemer / transakciu</div>
            <div class="summary-insight-value">${avg.toFixed(2)} €</div>
            <div class="summary-insight-sub">Priemerná hodnota jednej položky.</div>
        </div>
    `;
}

function updateAnalytics() {
    if (document.getElementById('screen-analytics').classList.contains('hidden')) return;

    try {
        const chartType = document.getElementById('chart-type').value;
        const levelMode = document.getElementById('chart-level-mode').value;
        const dataMode = document.getElementById('chart-data-mode').value;

        ['expense', 'income', 'balance'].forEach(m => {
            const btn = document.getElementById(`chart-data-${m}`);
            if (btn) btn.classList.toggle('active', m === dataMode);
        });

        const filtered = getAnalyticsDataForPeriod();
        const { working, sums } = buildAggregateData(filtered, dataMode, levelMode);
        const nested = buildNestedBreakdown(filtered, dataMode);

        const labels = Object.keys(sums).sort((a, b) => Math.abs(sums[b]) - Math.abs(sums[a]));
        const data = labels.map(k => sums[k]);
        const total = data.reduce((a, b) => a + b, 0);

        const colors = [
            '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
            '#06b6d4', '#f97316', '#84cc16', '#64748b', '#d946ef'
        ];

        const statsContainer = document.getElementById('chart-stats-summary');
        const summaryCards = document.getElementById('analytics-summary-cards');
        const subStatsContainer = document.getElementById('chart-sub-stats-summary');

        if (labels.length === 0) {
            if (analyticsChartInstance) {
                analyticsChartInstance.destroy();
                analyticsChartInstance = null;
            }
            if (summaryCards) summaryCards.innerHTML = '';
            if (subStatsContainer) subStatsContainer.innerHTML = '';

            statsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="pie-chart" class="w-6 h-6"></i>
                    </div>
                    <div class="empty-state-title">Žiadne dáta pre graf</div>
                    <div class="empty-state-text">Skús zmeniť obdobie alebo typ dát. Keď pribudnú transakcie, graf sa zobrazí automaticky.</div>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        renderAnalyticsSummaryCards(working, sums, dataMode);
        renderTreeBreakdown('chart-sub-stats-summary', nested, colors, 'analytics');

        const canvas = document.getElementById('analyticsChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (analyticsChartInstance) analyticsChartInstance.destroy();

        analyticsChartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels,
                datasets: [{
                    data,
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

        statsContainer.innerHTML = labels.map((label, idx) => {
            const val = sums[label];
            const pct = total !== 0 ? ((val / total) * 100).toFixed(1) : '0';
            const [cat, sub] = label.split(' / ');

            return `
                <div onclick="filterFromStats('${String(cat).replace(/'/g, "\\'")}', ${sub ? `'${String(sub).replace(/'/g, "\\'")}'` : 'null'})" class="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <div class="flex items-center gap-2">
                        <div class="w-2.5 h-2.5 rounded-full" style="background:${colors[idx % colors.length]}"></div>
                        <span class="text-xs font-bold">${label}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-extrabold">${val.toFixed(2)} €</div>
                        <div class="text-[9px] font-bold text-slate-400">${pct}%</div>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Analytics render error:', err);
    }
}

function renderBurnInsightCards(total, previousTotal, forecast, daysLeft) {
    const container = document.getElementById('burn-insight-cards');
    if (!container) return;

    const diff = total - previousTotal;
    const diffPct = previousTotal !== 0 ? ((diff / previousTotal) * 100) : 0;

    let diffClass = 'burn-compare-neutral';
    if (diff > 0) diffClass = 'burn-compare-negative';
    if (diff < 0) diffClass = 'burn-compare-positive';

    container.innerHTML = `
        <div class="summary-insight-card">
            <div class="summary-insight-label">Porovnanie</div>
            <div class="summary-insight-value ${diffClass}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)} €</div>
            <div class="summary-insight-sub">Rozdiel oproti predošlému obdobiu (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%).</div>
        </div>
        <div class="summary-insight-card">
            <div class="summary-insight-label">Odhad do konca</div>
            <div class="summary-insight-value">${forecast.toFixed(2)} €</div>
            <div class="summary-insight-sub">Predpoklad pri zachovaní aktuálneho tempa čerpania.</div>
        </div>
        <div class="summary-insight-card">
            <div class="summary-insight-label">Zostáva dní</div>
            <div class="summary-insight-value">${daysLeft}</div>
            <div class="summary-insight-sub">Počet dní do konca aktuálneho mesiaca.</div>
        </div>
        <div class="summary-insight-card">
            <div class="summary-insight-label">Predošlé obdobie</div>
            <div class="summary-insight-value">${previousTotal.toFixed(2)} €</div>
            <div class="summary-insight-sub">Referenčná suma pre porovnanie trendu.</div>
        </div>
    `;
}

function updateBurnRateTab() {
    if (document.getElementById('screen-burnrate').classList.contains('hidden')) return;

    try {
        const chartType = document.getElementById('burn-chart-type').value;
        const levelMode = document.getElementById('burn-level-mode').value;
        const dataMode = document.getElementById('burn-data-mode').value;

        ['expense', 'income', 'balance'].forEach(m => {
            const btn = document.getElementById(`burn-data-${m}`);
            if (btn) btn.classList.toggle('active', m === dataMode);
        });

        const filtered = getAnalyticsDataForPeriod();
        const previousPeriod = getPreviousPeriodData();

        const { sums } = buildAggregateData(filtered, dataMode, levelMode);
        const previousAggregate = buildAggregateData(previousPeriod, dataMode, levelMode);
        const nested = buildNestedBreakdown(filtered, dataMode);

        const daysCount = getDaysCountForPeriod(filtered);
        const labels = Object.keys(sums).sort((a, b) => Math.abs(sums[b]) - Math.abs(sums[a]));
        const data = labels.map(k => sums[k]);
        const total = data.reduce((a, b) => a + b, 0);
        const previousTotal = Object.values(previousAggregate.sums).reduce((a, b) => a + b, 0);

        const dailyAvgTotal = total / daysCount;
        const monthlyForecastTotal = dailyAvgTotal * 30.5;

        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysLeft = Math.max(0, endOfMonth.getDate() - now.getDate());

        const cardsContainer = document.getElementById('burn-metrics-cards');
        const breakdownContainer = document.getElementById('burn-stats-breakdown');
        const insightContainer = document.getElementById('burn-insight-cards');
        const subBreakdownContainer = document.getElementById('burn-sub-stats-breakdown');

        const burnColors = [
            '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6',
            '#06b6d4', '#f97316', '#84cc16', '#64748b', '#d946ef'
        ];

        if (labels.length === 0) {
            if (burnRateTabChartInstance) {
                burnRateTabChartInstance.destroy();
                burnRateTabChartInstance = null;
            }

            if (cardsContainer) cardsContainer.innerHTML = '';
            if (insightContainer) insightContainer.innerHTML = '';
            if (subBreakdownContainer) subBreakdownContainer.innerHTML = '';

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
            return;
        }

        renderBurnInsightCards(total, previousTotal, monthlyForecastTotal, daysLeft);
        renderTreeBreakdown('burn-sub-stats-breakdown', nested, burnColors, 'burn');

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

        const canvas = document.getElementById('burnRateTabChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (burnRateTabChartInstance) burnRateTabChartInstance.destroy();

        burnRateTabChartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels,
                datasets: [{
                    data,
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

        breakdownContainer.innerHTML = labels.map(label => {
            const val = sums[label];
            const dailyAvg = val / daysCount;
            const monthlyForecast = dailyAvg * 30.5;
            const [cat, sub] = label.split(' / ');

            return `
                <div onclick="filterFromStats('${String(cat).replace(/'/g, "\\'")}', ${sub ? `'${String(sub).replace(/'/g, "\\'")}'` : 'null'})" class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-amber-500/50 transition-all space-y-1.5">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-extrabold">${label}</span>
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

        lucide.createIcons();
    } catch (err) {
        console.error('Burn rate render error:', err);
    }
}
