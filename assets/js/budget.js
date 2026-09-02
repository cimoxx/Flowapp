function getBudgetTargetMonthYear() {
    const yearEl = document.getElementById('filter-year');
    const selectedYear = parseInt(yearEl?.value || new Date().getFullYear(), 10);
    const selectedMonth = Array.isArray(selectedMonths) && selectedMonths.length > 0
        ? selectedMonths[0]
        : new Date().getMonth();

    return { month: selectedMonth, year: selectedYear };
}

function getMonthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getExpenseItemsForMonth(year, month) {
    return db.filter(item => {
        const clean = getCleanDateStr(item.date);
        if (!clean) return false;
        const d = new Date(clean + 'T00:00:00');
        if (isNaN(d.getTime())) return false;
        return d.getFullYear() === year && d.getMonth() === month && item.type === 'expense';
    });
}

function getIncomeItemsForMonth(year, month) {
    return db.filter(item => {
        const clean = getCleanDateStr(item.date);
        if (!clean) return false;
        const d = new Date(clean + 'T00:00:00');
        if (isNaN(d.getTime())) return false;
        return d.getFullYear() === year && d.getMonth() === month && item.type === 'income';
    });
}

function sumAmount(items) {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
}

function getPastClosedMonths(targetYear, targetMonth, count = 3) {
    const months = [];
    let y = targetYear;
    let m = targetMonth - 1;

    for (let i = 0; i < count; i++) {
        if (m < 0) {
            m = 11;
            y -= 1;
        }
        months.push({ year: y, month: m });
        m -= 1;
    }

    return months;
}

function getCategoryMonthlyExpense(year, month, categoryId) {
    if (typeof getIndexedCategoryValue === 'function') return getIndexedCategoryValue(year, month, categoryId, 'totalExpense');
    return getExpenseItemsForMonth(year, month)
        .filter(item => item.category === categoryId)
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
}

function getWeightedRecommendedBudget(categoryId, targetYear, targetMonth) {
    const months = getPastClosedMonths(targetYear, targetMonth, 3);
    const weights = [0.5, 0.3, 0.2];
    const values = months.map(m => getCategoryMonthlyExpense(m.year, m.month, categoryId));
    const monthsWithData = values.filter(v => v > 0).length;

    let weighted = 0;
    let usedWeight = 0;

    values.forEach((value, idx) => {
        if (value > 0) {
            weighted += value * weights[idx];
            usedWeight += weights[idx];
        }
    });

    let base = usedWeight > 0 ? (weighted / usedWeight) : 0;

    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const spread = max - min;

    let bufferPct = 0.05;
    if (avg > 0) {
        const volatility = spread / Math.max(avg, 1);
        if (volatility > 0.8) bufferPct = 0.15;
        else if (volatility > 0.4) bufferPct = 0.1;
    }

    if (base > 0) {
        base = base * (1 + bufferPct);
    }

    let confidence = 'low';
    if (monthsWithData >= 3) confidence = 'high';
    else if (monthsWithData >= 2) confidence = 'medium';

    return {
        recommended: round2(base),
        average: round2(avg),
        monthsWithData,
        confidence,
        values
    };
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getMonthProgressRatio(year, month) {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

    if (!isCurrentMonth) return 1;

    const today = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return Math.min(1, Math.max(0.05, today / daysInMonth));
}

function getForecastForCategory(categoryId, targetYear, targetMonth, currentSpent, recommendedBudget) {
    const progress = getMonthProgressRatio(targetYear, targetMonth);
    let projected = currentSpent;

    if (progress < 1) {
        const paceProjection = currentSpent / progress;
        projected = Math.max(currentSpent, paceProjection * 0.65 + recommendedBudget * 0.35);
    }

    projected = Math.max(projected, currentSpent);
    return round2(projected);
}

function getBudgetStatus(spent, recommended, forecast) {
    if (recommended <= 0 && spent <= 0) {
        return { tone: 'neutral', label: 'Bez dát' };
    }
    if (forecast > recommended * 1.08) {
        return { tone: 'danger', label: 'Riziko prekročenia' };
    }
    if (spent > recommended) {
        return { tone: 'danger', label: 'Nad rozpočtom' };
    }
    if (spent > recommended * 0.85) {
        return { tone: 'warn', label: 'Pozor' };
    }
    return { tone: 'good', label: 'V norme' };
}

function formatConfidence(confidence) {
    if (confidence === 'high') return 'Vysoká istota';
    if (confidence === 'medium') return 'Stredná istota';
    return 'Málo dát';
}

function getBudgetDataset() {
    const { month, year } = getBudgetTargetMonthYear();
    const expenses = getExpenseItemsForMonth(year, month);
    const incomes = getIncomeItemsForMonth(year, month);

    // v2.37: if the planning engine is available, Budget uses the same annual
    // model as the yearly planner so the two screens cannot drift apart.
    if (typeof getAnnualPlan === 'function') {
        const annual = getAnnualPlan(year);
        const monthPlan = annual[month];
        if (monthPlan) {
            const categoryRows = monthPlan.categoryRows.map(row => {
                const safe = round2(row.budget - row.forecast);
                const progressPct = row.budget > 0 ? Math.min(160, (row.actual / row.budget) * 100) : 0;
                return {
                    ...row,
                    spent: row.actual,
                    recommended: row.budget,
                    forecast: row.forecast,
                    safe,
                    progressPct: round2(progressPct),
                    confidenceLabel: formatConfidence(row.confidence),
                    status: getBudgetStatus(row.actual, row.budget, row.forecast),
                    avg: row.variable
                };
            });
            const totalRecommended = round2(monthPlan.budget);
            const totalSpent = round2(monthPlan.actualExpenses);
            const totalIncome = round2(monthPlan.plannedIncome);
            const totalOdhad = round2(monthPlan.forecast);
            return {
                month, year, categoryRows, totalRecommended, totalSpent,
                totalIncome, totalForecast,
                safeToSpend: round2(totalRecommended - totalForecast),
                recurringExpense: monthPlan.recurringExpense,
                eventExpense: monthPlan.eventExpense,
                plannedBalance: monthPlan.plannedBalance,
                modelVersion: typeof FLOW_MODEL_VERSION !== 'undefined' ? FLOW_MODEL_VERSION : 'v2.35'
            };
        }
    }

    const expenseCategories = categories.filter(c => c.id !== 'Prijem');

    const categoryRows = expenseCategories.map(cat => {
        const spent = round2(
            expenses
                .filter(item => item.category === cat.id)
                .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
        );

        const rec = getWeightedRecommendedBudget(cat.id, year, month);
        const forecast = getForecastForCategory(cat.id, year, month, spent, rec.recommended);
        const safe = round2(rec.recommended - forecast);
        const progressPct = rec.recommended > 0 ? Math.min(160, (spent / rec.recommended) * 100) : 0;
        const status = getBudgetStatus(spent, rec.recommended, forecast);

        return {
            category: cat.id,
            icon: cat.icon || 'circle',
            spent,
            recommended: rec.recommended,
            forecast,
            safe,
            progressPct: round2(progressPct),
            confidence: rec.confidence,
            confidenceLabel: formatConfidence(rec.confidence),
            status,
            avg: rec.average
        };
    });

    const totalRecommended = round2(categoryRows.reduce((sum, row) => sum + row.recommended, 0));
    const totalSpent = round2(sumAmount(expenses));
    const totalIncome = round2(sumAmount(incomes));
    const totalOdhad = round2(categoryRows.reduce((sum, row) => sum + row.forecast, 0));
    const safeToSpend = round2(totalRecommended - totalForecast);

    return {
        month,
        year,
        categoryRows,
        totalRecommended,
        totalSpent,
        totalIncome,
        totalForecast,
        safeToSpend
    };
}

function buildBudgetInsights(data) {
    const insights = [];

    const over = data.categoryRows
        .filter(row => row.forecast > row.recommended && row.recommended > 0)
        .sort((a, b) => (b.forecast - b.recommended) - (a.forecast - a.recommended));

    const highPace = data.categoryRows
        .filter(row => row.spent > 0 && row.recommended > 0 && row.progressPct >= 75 && row.progressPct < 100)
        .sort((a, b) => b.progressPct - a.progressPct);

    if (data.safeToSpend < 0) {
        insights.push({
            tone: 'danger',
            icon: 'triangle-alert',
            title: 'Pozor, tento mesiac môže byť drahší',
            text: `Ak budeš pokračovať podobne, výdavky môžu byť asi o ${formatCurrency(Math.abs(data.safeToSpend))} vyššie než rozpočet.`
        });
    } else {
        insights.push({
            tone: 'good',
            icon: 'shield-check',
            title: 'Mesiac zatiaľ vyzerá dobre',
            text: `Podľa dnešného odhadu máš ešte približne ${formatCurrency(data.safeToSpend)} rezervu do rozpočtu.`
        });
    }

    if (over.length > 0) {
        const top = over[0];
        insights.push({
            tone: 'warn',
            icon: 'flame',
            title: `Najviac si daj pozor na ${top.category}`,
            text: `Do konca mesiaca tu odhadujeme ${formatCurrency(top.forecast)}. Rozpočet je ${formatCurrency(top.recommended)}.`
        });
    }

    if (highPace.length > 0) {
        const top = highPace[0];
        insights.push({
            tone: 'info',
            icon: 'gauge',
            title: `${top.category}: míňaš rýchlejšie`,
            text: `Už si minul ${Math.round(top.progressPct)} % rozpočtu tejto kategórie.`
        });
    }

    if (data.totalIncome > 0) {
        const leftover = round2(data.totalIncome - data.totalForecast);
        insights.push({
            tone: leftover >= 0 ? 'good' : 'warn',
            icon: leftover >= 0 ? 'wallet' : 'badge-alert',
            title: 'Ako môže mesiac skončiť',
            text: leftover >= 0
                ? `Ak sa odhad naplní, po výdavkoch by malo zostať približne ${formatCurrency(leftover)}.`
                : `Ak sa odhad naplní, výdavky môžu byť približne o ${formatCurrency(Math.abs(leftover))} vyššie než príjmy.`
        });
    }

    return insights.slice(0, 4);
}

function getBudgetRiskSummary(data) {
    const dangerCount = data.categoryRows.filter(r => r.status.tone === 'danger').length;
    const warnCount = data.categoryRows.filter(r => r.status.tone === 'warn').length;

    if (dangerCount > 0) {
        return {
            tone: 'danger',
            text: `Pozor: ${dangerCount} kategórie smerujú k prekročeniu budgetu a ${warnCount} si pýtajú zvýšenú pozornosť.`
        };
    }

    if (warnCount > 0) {
        return {
            tone: 'warn',
            text: `Mesiac je zatiaľ stabilný, ale ${warnCount} kategórie sa už blížia k hranici odporúčaného budgetu.`
        };
    }

    return {
        tone: 'good',
        text: 'Budget vyzerá stabilne. Väčšina kategórií sa drží v bezpečnom pásme.'
    };
}

function getSignedResultClass(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return 'result-positive';
    if (amount < 0) return 'result-negative';
    return 'result-neutral';
}

function getSignedResultSurfaceClass(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return 'result-surface-positive';
    if (amount < 0) return 'result-surface-negative';
    return 'result-surface-neutral';
}

function getSignedResultStatus(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return 'V pluse';
    if (amount < 0) return 'V mínuse';
    return 'Na nule';
}

function renderBudgetHeroCards(data) {
    const el = document.getElementById('budget-hero-cards');
    if (!el) return;
    const remaining = round2(data.totalRecommended - data.totalSpent);
    const progress = data.totalRecommended > 0 ? Math.max(0, (data.totalSpent / data.totalRecommended) * 100) : 0;
    const forecastDelta = round2(data.totalRecommended - data.totalForecast);
    el.className = 'budget-overview-card';
    el.innerHTML = `
        <div class="budget-overview-top">
            <div><span class="budget-overview-eyebrow">Mesačný rozpočet</span><strong>${formatCurrency(data.totalRecommended)}</strong></div>
            <div class="budget-overview-remaining ${getSignedResultClass(remaining)}"><span>Zostáva</span><strong>${formatCurrency(remaining)}</strong></div>
        </div>
        <div class="budget-overview-progress"><div style="width:${Math.min(progress,100)}%" class="${progress > 100 ? 'is-over' : progress > 85 ? 'is-warning' : ''}"></div></div>
        <div class="budget-overview-meta"><span>${formatCurrency(data.totalSpent)} minuté · ${Math.round(progress)} % rozpočtu</span><span>Odhad ${formatCurrency(data.totalForecast)}</span></div>
        <details class="budget-overview-details"><summary>Detail mesiaca</summary><div class="budget-overview-detail-grid">
            <div><span>Rozpočet</span><b>${formatCurrency(data.totalRecommended)}</b></div>
            <div><span>Minuté</span><b>${formatCurrency(data.totalSpent)}</b></div>
            <div><span>Odhad</span><b>${formatCurrency(data.totalForecast)}</b></div>
            <div><span>Rezerva podľa odhadu</span><b class="${getSignedResultClass(forecastDelta)}">${formatCurrency(forecastDelta)}</b></div>
        </div></details>`;
}
function renderBudgetRiskSummary(data) {
    const el = document.getElementById('budget-risk-summary');
    if (!el) return;

    const summary = getBudgetRiskSummary(data);
    el.className = `budget-risk-summary tone-${summary.tone}`;
    el.innerHTML = `
        <div class="budget-risk-title">Mesačný stav</div>
        <div class="budget-risk-text">${summary.text}</div>
    `;
    el.classList.remove('hidden');
}

function renderBudgetCategoryList(data) {
    const el = document.getElementById('budget-category-list');
    if (!el) return;
    if (!data.categoryRows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-title">Zatiaľ nie sú dáta</div><div class="empty-state-text">Pridaj viac transakcií a budget tabu začne zobrazovať odporúčania.</div></div>`;
        return;
    }
    el.innerHTML = data.categoryRows.map(row => {
        const remaining = round2(row.recommended - row.spent);
        const pct = row.recommended > 0 ? Math.max(0,(row.spent/row.recommended)*100) : 0;
        return `<div class="budget-cat-card budget-cat-simple">
            <div class="budget-cat-top"><div class="budget-cat-left"><div class="budget-cat-icon"><i data-lucide="${row.icon}"></i></div><div class="min-w-0"><div class="budget-cat-name">${row.category}</div><div class="budget-cat-compact-line">${formatCurrency(row.spent)} / ${formatCurrency(row.recommended)}</div></div></div><div class="budget-cat-status tone-${row.status.tone}">${row.status.label}</div></div>
            <div class="budget-progress-wrap compact"><div class="budget-progress-bar"><div class="budget-progress-fill tone-${row.status.tone}" style="width:${Math.min(pct,100)}%"></div></div><div class="budget-progress-head"><span>${Math.round(pct)} % vyčerpané</span><strong class="${getSignedResultClass(remaining)}">${remaining >= 0 ? 'Zostáva' : 'Nad rozpočtom'} ${formatCurrency(Math.abs(remaining))}</strong></div></div>
            <details class="budget-cat-details"><summary>Detail kategórie</summary><div class="budget-cat-values grid grid-cols-3 gap-2"><div class="budget-mini-stat"><div class="budget-mini-label">Budget</div><div class="budget-mini-value">${formatCurrency(row.recommended)}</div></div><div class="budget-mini-stat"><div class="budget-mini-label">Minuté</div><div class="budget-mini-value">${formatCurrency(row.spent)}</div></div><div class="budget-mini-stat"><div class="budget-mini-label">Forecast</div><div class="budget-mini-value">${formatCurrency(row.forecast)}</div></div></div><div class="budget-cat-confidence">${row.confidenceLabel}</div></details>
        </div>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
}
function renderBudgetForecastList(data) {
    const el = document.getElementById('budget-forecast-list');
    if (!el) return;

    const rows = data.categoryRows
        .filter(row => row.forecast > 0 || row.spent > 0 || row.recommended > 0)
        .sort((a, b) => b.forecast - a.forecast)
        .slice(0, 6);

    if (!rows.length) {
        el.innerHTML = `<div class="text-sm text-slate-400 font-semibold">Odhad sa zobrazí, keď budú v dátach aspoň základné výdavky.</div>`;
        return;
    }

    el.innerHTML = rows.map(row => `
        <div class="forecast-row">
            <div class="forecast-row-left">
                <div class="forecast-row-name">${row.category}</div>
                <div class="forecast-row-sub">Rozpočet ${formatCurrency(row.recommended)}</div>
            </div>
            <div class="forecast-row-right">
                <div class="forecast-row-value">${formatCurrency(row.forecast)}</div>
                <div class="forecast-row-state tone-${row.status.tone}">${row.status.label}</div>
            </div>
        </div>
    `).join('');
}

function renderBudgetInsights(data) {
    const el = document.getElementById('budget-insights-list');
    if (!el) return;

    const insights = buildBudgetInsights(data);

    el.innerHTML = insights.map(item => `
        <div class="budget-insight-card tone-${item.tone}">
            <div class="budget-insight-icon">
                <i data-lucide="${item.icon}"></i>
            </div>
            <div class="budget-insight-content">
                <div class="budget-insight-title">${item.title}</div>
                <div class="budget-insight-text">${item.text}</div>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function updateBudgetPeriodTitle(data) {
    const el = document.getElementById('budget-period-title');
    if (!el) return;

    const monthName = new Date(data.year, data.month, 1).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
    el.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

function updateBudgetScreen() {
    const screen = document.getElementById('screen-budget');
    if (!screen) return;

    const data = getBudgetDataset();
    updateBudgetPeriodTitle(data);
    renderBudgetHeroCards(data);
    renderBudgetRiskSummary(data);
    renderBudgetCategoryList(data);
    renderBudgetForecastList(data);
    renderBudgetInsights(data);
}
