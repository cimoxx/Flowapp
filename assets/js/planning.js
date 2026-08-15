/* FLOW v2.37 - Multi-year data-aware annual planning and forecasting. */

let flowRecurringPlans = JSON.parse(localStorage.getItem('flow_recurring_plans_v235') || '[]');
let flowPlannedEvents = JSON.parse(localStorage.getItem('flow_planned_events_v235') || '[]');
let flowBudgetOverrides = JSON.parse(localStorage.getItem('flow_budget_overrides_v235') || '[]');
let flowForecastArchive = JSON.parse(localStorage.getItem('flow_forecast_archive_v235') || '[]');
let flowModelState = JSON.parse(localStorage.getItem('flow_model_state_v235') || '{}');
let planningLoaded = false;

const FLOW_MODEL_VERSION = '2.38-multi-year-backtest-v2';

// Fast month/category index. It is rebuilt only when transaction data changes.
let flowForecastIndex = null;
let flowForecastIndexSignature = '';
let flowForecastIndexDirty = true;

function markForecastIndexDirty() { flowForecastIndexDirty = true; }

function getForecastIndexSignature() {
    const rows = Array.isArray(db) ? db : [];
    let latest = '';
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const stamp = String(r?.updatedAt || r?.createdAt || r?.date || '');
        if (stamp > latest) latest = stamp;
    }
    return `${rows.length}|${latest}`;
}

function rebuildForecastIndex(force = false) {
    // saveData()/sync marks the index dirty. Do not scan the whole DB on every forecast call.
    if (!force && !flowForecastIndexDirty && flowForecastIndex) return flowForecastIndex;
    const signature = getForecastIndexSignature();

    const index = { months: Object.create(null), years: Object.create(null) };
    const rows = Array.isArray(db) ? db : [];
    rows.forEach(item => {
        if (!item || item.deleted) return;
        const clean = getCleanDateStr(item.date);
        const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(clean || '');
        if (!match) return;
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        if (year < 2000 || month < 0 || month > 11) return;
        const key = `${year}-${String(month + 1).padStart(2,'0')}`;
        const category = String(item.category || '');
        const amount = Number(item.amount) || 0;
        if (!index.months[key]) index.months[key] = Object.create(null);
        if (!index.months[key][category]) index.months[key][category] = { variableExpense: 0, recurringExpense: 0, income: 0, totalExpense: 0, count: 0 };
        const bucket = index.months[key][category];
        if (item.type === 'income') {
            bucket.income += amount;
        } else if (item.type === 'expense') {
            bucket.totalExpense += amount;
            if (item.isRecurring) bucket.recurringExpense += amount;
            else bucket.variableExpense += amount;
            bucket.count += 1;
        }
        if (!index.years[year]) index.years[year] = { monthsWithCategory: Object.create(null), totals: Object.create(null) };
        if (!index.years[year].monthsWithCategory[category]) index.years[year].monthsWithCategory[category] = new Set();
        if (item.type === 'expense' && !item.isRecurring && amount > 0) index.years[year].monthsWithCategory[category].add(month);
        if (item.type === 'expense' && !item.isRecurring) {
            index.years[year].totals[category] = (index.years[year].totals[category] || 0) + amount;
        }
    });
    flowForecastIndex = index;
    flowForecastIndexSignature = signature;
    flowForecastIndexDirty = false;
    return index;
}

function getIndexedCategoryValue(year, month, category, field = 'variableExpense') {
    const index = rebuildForecastIndex();
    const bucket = index.months[getMonthKey(year, month)]?.[String(category)];
    return bucket ? Number(bucket[field]) || 0 : 0;
}

function getIndexedIncome(year, month, category = null) {
    const index = rebuildForecastIndex();
    const monthData = index.months[getMonthKey(year, month)] || {};
    if (category !== null) return Number(monthData[String(category)]?.income) || 0;
    return Object.values(monthData).reduce((s,b) => s + (Number(b.income)||0), 0);
}

const MONTH_NAMES_SK = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];

function planningPersist() {
    localStorage.setItem('flow_recurring_plans_v235', JSON.stringify(flowRecurringPlans));
    localStorage.setItem('flow_planned_events_v235', JSON.stringify(flowPlannedEvents));
    localStorage.setItem('flow_budget_overrides_v235', JSON.stringify(flowBudgetOverrides));
    localStorage.setItem('flow_forecast_archive_v235', JSON.stringify(flowForecastArchive));
    localStorage.setItem('flow_model_state_v235', JSON.stringify(flowModelState));
}

function planningGetUrl() {
    const token = encodeURIComponent(typeof getSyncToken === 'function' ? getSyncToken() : '');
    return `${GOOGLE_URL}?get=planning&token=${token}`;
}

async function loadPlanningData() {
    try {
        const res = await fetch(planningGetUrl());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (payload && payload.status === 'error') throw new Error(payload.message || 'Planning error');

        if (Array.isArray(payload.recurring)) flowRecurringPlans = payload.recurring;
        if (Array.isArray(payload.events)) flowPlannedEvents = payload.events;
        if (Array.isArray(payload.overrides)) flowBudgetOverrides = payload.overrides;
        if (Array.isArray(payload.archive)) flowForecastArchive = payload.archive;
        if (payload.modelState && typeof payload.modelState === 'object') flowModelState = payload.modelState;

        planningLoaded = true;
        planningPersist();
        migrateLegacyRecurringPlans();
        renderPlanningScreens();
        if (typeof processRecurringPayments === 'function') processRecurringPayments();
        return true;
    } catch (error) {
        console.warn('Planning data load failed; local data retained.', error);
        planningLoaded = true;
        migrateLegacyRecurringPlans();
        renderPlanningScreens();
        if (typeof processRecurringPayments === 'function') processRecurringPayments();
        return false;
    }
}

async function planningPost(body) {
    const payload = { ...body, token: typeof getSyncToken === 'function' ? getSyncToken() : '', userId: FLOW_USER_ID };
    const res = await fetch(GOOGLE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.status === 'error') throw new Error(data.message || 'Planning server error');
    return data;
}

async function savePlanningEntity(type, entity) {
    const now = new Date().toISOString();
    const normalized = { ...entity, updatedAt: now, createdAt: entity.createdAt || now, version: Math.max(1, Number(entity.version) || 1) };
    const list = type === 'recurring' ? flowRecurringPlans : type === 'event' ? flowPlannedEvents : flowBudgetOverrides;
    const idx = list.findIndex(x => String(x.id) === String(normalized.id));
    if (idx > -1) list[idx] = normalized; else list.push(normalized);
    planningPersist();
    try {
        await planningPost({ action: 'savePlanning', type, entity: normalized });
    } catch (error) {
        console.warn('Planning save queued locally:', error);
        showToast?.({ type: 'warning', title: 'Uložené lokálne', text: 'Cloud sa zosynchronizuje pri ďalšom pokuse.' });
    }
    renderPlanningScreens();
}

async function deletePlanningEntity(type, id) {
    const list = type === 'recurring' ? flowRecurringPlans : type === 'event' ? flowPlannedEvents : flowBudgetOverrides;
    const idx = list.findIndex(x => String(x.id) === String(id));
    if (idx < 0) return;
    const entity = { ...list[idx], deleted: true, updatedAt: new Date().toISOString(), version: (Number(list[idx].version) || 1) + 1 };
    list.splice(idx, 1);
    planningPersist();
    try { await planningPost({ action: 'deletePlanning', type, entity }); } catch (error) { console.warn(error); }
    renderPlanningScreens();
}

function migrateLegacyRecurringPlans() {
    const recurring = db.filter(x => x.isRecurring && !x.deleted);
    if (!recurring.length) return;

    const existingKeys = new Set(flowRecurringPlans.map(p => `${p.categoryId}|${p.sub || ''}|${p.frequency || 'monthly'}|${p.type || 'expense'}`));
    const groups = new Map();

    recurring.forEach(item => {
        const key = `${item.categoryId || getCategoryUidByName(item.category)}|${item.sub || ''}|${item.frequency || 'monthly'}|${item.type || 'expense'}`;
        const current = groups.get(key);
        if (!current || String(item.date) > String(current.date)) groups.set(key, item);
    });

    let created = false;
    groups.forEach((latest, key) => {
        if (existingKeys.has(key)) return;
        const members = recurring.filter(x => `${x.categoryId || getCategoryUidByName(x.category)}|${x.sub || ''}|${x.frequency || 'monthly'}|${x.type || 'expense'}` === key);
        const start = members.map(x => getCleanDateStr(x.date)).filter(Boolean).sort()[0] || getTodayStr();
        const plan = {
            id: createUid('rp'),
            name: latest.note || `${latest.category}${latest.sub ? ' / ' + latest.sub : ''}`,
            category: latest.category,
            categoryId: latest.categoryId || getCategoryUidByName(latest.category),
            sub: latest.sub || '',
            amount: Number(latest.amount) || 0,
            type: latest.type || 'expense',
            frequency: latest.frequency || 'monthly',
            dayOfMonth: Number((getCleanDateStr(latest.date) || getTodayStr()).slice(8, 10)) || 1,
            startDate: start,
            endDate: '',
            active: true,
            amountMode: 'fixed',
            notes: 'Migrované zo staršej verzie Flow.',
            createdAt: latest.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };
        flowRecurringPlans.push(plan);
        members.forEach(tx => { tx.recurringPlanId = plan.id; tx.updatedAt = new Date().toISOString(); tx.version = (Number(tx.version)||1)+1; queueMutation(tx); });
        created = true;
        savePlanningEntity('recurring', plan);
    });

    if (created) { planningPersist(); saveData(false); }
}

function getPlanMonthlyAmount(plan, year, month) {
    if (!plan || !plan.active) return 0;
    const key = getMonthKey(year, month);
    const start = String(plan.startDate || '').slice(0, 7);
    const end = String(plan.endDate || '').slice(0, 7);
    if (start && key < start) return 0;
    if (end && key > end) return 0;

    if (plan.frequency === 'yearly') {
        const startMonth = Number(String(plan.startDate || '').slice(5, 7)) - 1;
        return month === startMonth ? Number(plan.amount) || 0 : 0;
    }
    if (plan.frequency === 'quarterly') {
        const startDate = new Date(plan.startDate || `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`);
        const diff = (year - startDate.getFullYear()) * 12 + month - startDate.getMonth();
        return diff >= 0 && diff % 3 === 0 ? Number(plan.amount) || 0 : 0;
    }
    if (plan.frequency === 'weekly') {
        return (Number(plan.amount) || 0) * 4.345;
    }
    return Number(plan.amount) || 0;
}

function getRecurringForMonth(year, month) {
    return flowRecurringPlans.filter(p => p.active && getPlanMonthlyAmount(p, year, month) > 0);
}

function getPlannedEventsForMonth(year, month) {
    const key = getMonthKey(year, month);
    return flowPlannedEvents.filter(e => !e.deleted && String(e.date || '').slice(0, 7) === key);
}

function getBudgetOverride(category, year, month) {
    const key = getMonthKey(year, month);
    return flowBudgetOverrides.find(o => !o.deleted && o.monthKey === key && String(o.category || '') === String(category));
}

function getHistoricalCategorySpend(category, targetYear, targetMonth, maxMonths = 12) {
    const rows = [];
    let y = targetYear, m = targetMonth - 1;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    for (let i = 0; i < maxMonths; i++) {
        if (m < 0) { m = 11; y--; }
        const isFutureOrCurrent = y > currentYear || (y === currentYear && m >= currentMonth);
        const value = isFutureOrCurrent ? 0 : getIndexedCategoryValue(y, m, category, 'variableExpense');
        rows.push({ year: y, month: m, value });
        m--;
    }
    return rows;
}

function getHistoricalDataYears() {
    const currentYear = new Date().getFullYear();
    return getTransactionDataYears().filter(y => y <= currentYear);
}

function getHistoricalYearSeasonality(category, targetYear, targetMonth) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const index = rebuildForecastIndex();
    const years = getHistoricalDataYears()
        .filter(y => y < targetYear || (targetYear <= currentYear && y < currentYear))
        .sort((a,b) => b-a);
    const rows = [];

    years.forEach((year, yearRank) => {
        if (year === currentYear && targetMonth >= currentMonth) return;
        const months = index.years[year]?.monthsWithCategory?.[String(category)];
        if (!months || months.size < 3) return;
        let annualTotal = 0;
        for (let m = 0; m < 12; m++) annualTotal += getIndexedCategoryValue(year, m, category, 'variableExpense');
        const annualMonthlyAverage = annualTotal / 12;
        const targetValue = getIndexedCategoryValue(year, targetMonth, category, 'variableExpense');
        if (annualMonthlyAverage <= 0) return;
        const ratio = targetValue / annualMonthlyAverage;
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 8) return;
        // More recent years matter more, but every available year contributes.
        const weight = Math.max(0.35, 1 - yearRank * 0.12);
        rows.push({ year, value: targetValue, ratio, weight });
    });
    return rows;
}

function weightedMean(rows, valueKey = 'value') {
    let total = 0, weight = 0;
    rows.forEach(r => {
        const v = Number(r?.[valueKey]);
        const w = Number(r?.weight ?? 1);
        if (Number.isFinite(v) && Number.isFinite(w) && w > 0) { total += v*w; weight += w; }
    });
    return weight ? total/weight : 0;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function getVariableForecast(category, year, month) {
    const historical = getHistoricalCategorySpend(category, year, month, 12);
    const nonZero = historical.filter(x => x.value > 0);
    if (!nonZero.length) return { value: 0, expected: 0, confidence: 'low', method: 'no-data', dataMonths: 0, dataYears: 0, seasonalIndex: 1, trendFactor: 1 };

    const recentRows = historical.map((r, idx) => ({ ...r, weight: Math.pow(0.86, idx) })).filter(r => r.value > 0);
    const recent = weightedMean(recentRows);

    const seasonalRows = getHistoricalYearSeasonality(category, year, month);
    const seasonalIndex = seasonalRows.length >= 2 ? clamp(weightedMean(seasonalRows, 'ratio'), 0.35, 3.5) : 1;

    // Estimate the level change between the most recent 6 months and the preceding 6 months.
    const recent6 = historical.slice(0,6).filter(r=>r.value>0).map(r=>r.value);
    const prior6 = historical.slice(6,12).filter(r=>r.value>0).map(r=>r.value);
    const recentAvg = recent6.length ? recent6.reduce((a,b)=>a+b,0)/recent6.length : recent;
    const priorAvg = prior6.length ? prior6.reduce((a,b)=>a+b,0)/prior6.length : recentAvg;
    const trendFactor = priorAvg > 0 ? clamp(recentAvg / priorAvg, 0.80, 1.25) : 1;

    let expected = recent * seasonalIndex;
    // If we have enough history, apply a restrained trend adjustment.
    if (nonZero.length >= 6) expected *= (0.75 + 0.25 * trendFactor);

    // Robust safety buffer based on median absolute deviation. It is a budget buffer,
    // not part of the central forecast.
    const values = nonZero.map(x => x.value);
    const med = median(values) || expected;
    const mad = median(values.map(v => Math.abs(v - med)));
    const volatility = med > 0 ? mad / med : 0;
    const buffer = Math.min(0.15, Math.max(0.03, volatility * 0.35));
    const value = expected * (1 + buffer);
    const dataYears = new Set(nonZero.map(x => x.year)).size;
    const seasonalYears = seasonalRows.length;
    let confidence = 'low';
    if (dataYears >= 4 && nonZero.length >= 10 && seasonalYears >= 3) confidence = 'high';
    else if (dataYears >= 2 || nonZero.length >= 4) confidence = 'medium';

    return {
        value: round2(value), expected: round2(expected), bufferPct: round2(buffer*100), confidence,
        method: seasonalYears >= 2 ? 'multi-year-seasonal-trend' : 'weighted-12m-trend',
        dataMonths: nonZero.length, dataYears, seasonalYears,
        seasonalIndex: round2(seasonalIndex), trendFactor: round2(trendFactor)
    };
}

function expensesForCategoryExcludingRecurring(year, month, category) {
    return getExpenseItemsForMonth(year, month).filter(x => x.category === category && !x.isRecurring);
}

function getHistoricalIncomeForecast(targetYear, targetMonth) {
    const values = [];
    let y = targetYear, m = targetMonth - 1;
    const now = new Date();
    const currentYear = now.getFullYear(), currentMonth = now.getMonth();
    for (let i=0;i<12;i++) {
        if(m<0){m=11;y--;}
        const isFutureOrCurrent = y > currentYear || (y === currentYear && m >= currentMonth);
        if (!isFutureOrCurrent) {
            const v = getIndexedIncome(y,m);
            if(v>0) values.push(v);
        }
        m--;
    }
    if(!values.length) return {value:0,confidence:'low'};
    const recent = values.reduce((s,v)=>s+v,0)/values.length;
    return {value:round2(recent),confidence:values.length>=9?'high':values.length>=5?'medium':'low'};
}

function getAnnualPlan(year) {
    const result = [];
    const expenseCategories = categories.filter(c => c.id !== 'Prijem');

    for (let month = 0; month < 12; month++) {
        const key = getMonthKey(year, month);
        const isCurrent = year === new Date().getFullYear() && month === new Date().getMonth();
        const closed = new Date(year, month + 1, 0) < new Date(new Date().setHours(0,0,0,0));
        const actualExpenses = Object.values(rebuildForecastIndex().months[getMonthKey(year,month)] || {}).reduce((sum,b)=>sum + (Number(b.totalExpense)||0), 0);
        const actualIncome = getIndexedIncome(year, month);
        const recurring = getRecurringForMonth(year, month);
        const events = getPlannedEventsForMonth(year, month);

        const categoryRows = expenseCategories.map(cat => {
            const actual = getIndexedCategoryValue(year, month, cat.id, 'totalExpense');
            const recurringAmount = recurring.filter(p => p.category === cat.id && p.type === 'expense').reduce((s,p) => s + getPlanMonthlyAmount(p,year,month), 0);
            const variable = getVariableForecast(cat.id, year, month);
            const override = getBudgetOverride(cat.id, year, month);
            const base = Math.max(recurringAmount, 0) + Math.max(variable.value, 0);
            const budget = override ? Number(override.amount) || 0 : round2(base);
            const now = new Date();
            const isCurrent = year === now.getFullYear() && month === now.getMonth();
            const variableActual = getIndexedCategoryValue(year, month, cat.id, 'variableExpense');
            const recurringActual = getIndexedCategoryValue(year, month, cat.id, 'recurringExpense');
            let forecast = actual;
            if (!closed) {
                const remainingVariable = Math.max(0, (variable.expected ?? variable.value) - variableActual);
                const remainingRecurring = Math.max(0, recurringAmount - recurringActual);
                forecast = round2(actual + remainingVariable + remainingRecurring);
                if (!isCurrent) forecast = round2(base);
            }
            return { category: cat.id, icon: cat.icon || 'circle', actual, recurring: recurringAmount, variable: variable.value, expected: variable.expected ?? variable.value, budget, forecast, confidence: variable.confidence, method: variable.method, dataMonths: variable.dataMonths, overridden: Boolean(override) };
        });

        const eventExpense = events.filter(e => e.type === 'expense').reduce((s,e) => s + Math.abs(Number(e.amount) || 0), 0);
        const eventIncome = events.filter(e => e.type === 'income').reduce((s,e) => s + Math.abs(Number(e.amount) || 0), 0);
        const recurringExpense = recurring.filter(p => p.type === 'expense').reduce((s,p) => s + getPlanMonthlyAmount(p,year,month), 0);
        const recurringIncome = recurring.filter(p => p.type === 'income').reduce((s,p) => s + getPlanMonthlyAmount(p,year,month), 0);
        const variableBudget = categoryRows.reduce((s,r) => s + Math.max(0, r.budget - r.recurring), 0);
        const budget = round2(recurringExpense + variableBudget + eventExpense);
        const forecast = closed ? actualExpenses : round2(categoryRows.reduce((s,r) => s + r.forecast, 0) + eventExpense);
        const incomeForecast = getHistoricalIncomeForecast(year, month);
        const variableIncomeActual = getIndexedIncome(year, month);
        let plannedIncome = actualIncome;
        if (!closed) {
            const variableIncomeRemaining = Math.max(0, incomeForecast.value - variableIncomeActual);
            plannedIncome = round2(actualIncome + variableIncomeRemaining + Math.max(0, recurringIncome) + eventIncome);
            if (month !== new Date().getMonth() || year !== new Date().getFullYear()) plannedIncome = round2(incomeForecast.value + recurringIncome + eventIncome);
        }
        const plannedBalance = round2(plannedIncome - forecast);

        result.push({ key, year, month, monthName: MONTH_NAMES_SK[month], isCurrent, closed, actualExpenses, actualIncome, recurringExpense, variableBudget, eventExpense, eventIncome, budget, forecast, plannedIncome, plannedBalance, categoryRows, events, recurring });
    }
    return result;
}

function calculateForecastMetrics() {
    const rows = flowForecastArchive.filter(r => String(r.modelVersion || '') === String(FLOW_MODEL_VERSION) && r.actualAmount !== '' && r.actualAmount !== null && r.actualAmount !== undefined && Number.isFinite(Number(r.actualAmount)));
    if (!rows.length) return { count: 0, mae: 0, wape: 0, bias: 0, accuracy: null, budgetMae:0, budgetWape:0 };
    const abs = rows.map(r => Math.abs(Number(r.forecastAmount) - Number(r.actualAmount)));
    const errors = rows.map(r => Number(r.forecastAmount) - Number(r.actualAmount));
    const actualTotal = rows.reduce((s,r) => s + Math.abs(Number(r.actualAmount)), 0);
    const mae = abs.reduce((s,v) => s + v, 0) / rows.length;
    const wape = actualTotal > 0 ? abs.reduce((s,v) => s + v, 0) / actualTotal * 100 : 0;
    const bias = errors.reduce((s,v) => s + v, 0) / rows.length;
    const budgetRows = rows.filter(r => r.budgetAmount !== '' && Number.isFinite(Number(r.budgetAmount)));
    const budgetAbs = budgetRows.map(r=>Math.abs(Number(r.budgetAmount)-Number(r.actualAmount)));
    const budgetTotal = budgetRows.reduce((s,r)=>s+Math.abs(Number(r.actualAmount)),0);
    return { count: rows.length, mae: round2(mae), wape: round2(wape), bias: round2(bias), accuracy: round2(Math.max(0, 100 - wape)), budgetMae:round2(budgetRows.length?budgetAbs.reduce((s,v)=>s+v,0)/budgetRows.length:0), budgetWape:round2(budgetTotal?budgetAbs.reduce((s,v)=>s+v,0)/budgetTotal*100:0) };
}

function getHistoricalRecurringBaseline(category, targetYear, targetMonth) {
    const historical = getHistoricalCategorySpend(category, targetYear, targetMonth, 12);
    const values = [];
    historical.forEach(r => {
        if (r.value > 0) values.push(getIndexedCategoryValue(r.year, r.month, category, 'recurringExpense'));
    });
    return values.length ? median(values) : 0;
}

function buildForecastArchiveBackfill() {
    // True walk-forward backtest: when target is YYYY-MM, the model only sees
    // transactions strictly before that month. Current recurring plans are NOT used.
    const now = new Date();
    const historicalYears = getHistoricalDataYears();
    const startYear = historicalYears.length ? Math.min(...historicalYears) : now.getFullYear();
    const rows = [];
    const existing = new Set(flowForecastArchive.map(r => `${r.targetMonth}|${r.category}|${r.modelVersion}`));

    for (let y = startYear; y <= now.getFullYear(); y++) {
        for (let m = 0; m < 12; m++) {
            const targetDate = new Date(y, m, 1);
            if (targetDate >= new Date(now.getFullYear(), now.getMonth() + 1, 1)) continue;
            const keyMonth = getMonthKey(y,m);
            categories.filter(c => c.id !== 'Prijem').forEach(cat => {
                const key = `${keyMonth}|${cat.id}|${FLOW_MODEL_VERSION}`;
                if (existing.has(key)) return;
                const variable = getVariableForecast(cat.id, y, m);
                const recurringBaseline = getHistoricalRecurringBaseline(cat.id, y, m);
                const forecast = round2((variable.expected ?? variable.value) + recurringBaseline);
                const budget = round2(variable.value + recurringBaseline);
                const actual = getIndexedCategoryValue(y,m,cat.id,'totalExpense');
                const actualVariable = getIndexedCategoryValue(y,m,cat.id,'variableExpense');
                if (actual <= 0 && forecast <= 0) return;
                rows.push({
                    id:createUid('fa'), targetMonth:keyMonth, category:cat.id,
                    forecastAmount:forecast, budgetAmount:budget, actualAmount:actual,
                    actualVariableAmount:actualVariable, recurringBaseline:round2(recurringBaseline),
                    modelVersion:FLOW_MODEL_VERSION, generatedAt:new Date(y,m,1).toISOString(),
                    dataMonths:variable.dataMonths, dataYears:variable.dataYears, seasonalYears:variable.seasonalYears,
                    confidence:variable.confidence, method:variable.method,
                    inputsJson:JSON.stringify({variableExpected:variable.expected, variableBudget:variable.value, recurringBaseline, seasonalIndex:variable.seasonalIndex, trendFactor:variable.trendFactor}),
                    evaluatedAt:new Date(y,m+1,1).toISOString(), backtest:'walk-forward'
                });
            });
        }
    }
    return rows;
}

async function archiveForecastRows(rows) {
    if (!rows.length) return;
    rows.forEach(row => flowForecastArchive.push(row));
    planningPersist();
    try {
        await planningPost({ action: 'archiveForecasts', rows });
    } catch (error) {
        console.warn('Forecast archive cloud save failed:', error);
    }
}

async function archiveCurrentForecastSnapshot() {
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth(); const key=getMonthKey(y,m);
    const existing=flowForecastArchive.some(r=>r.targetMonth===key && r.modelVersion===FLOW_MODEL_VERSION && String(r.generatedAt||'').slice(0,10)===getTodayStr());
    if(existing)return;
    const plan=getAnnualPlan(y)[m]; if(!plan)return;
    const rows=plan.categoryRows.filter(r=>r.forecast>0||r.budget>0).map(r=>({
        id:createUid('fa'),targetMonth:key,category:r.category,forecastAmount:r.forecast,budgetAmount:r.budget,actualAmount:r.actual,
        modelVersion:FLOW_MODEL_VERSION,generatedAt:new Date().toISOString(),dataMonths:r.dataMonths,confidence:r.confidence,method:r.method,
        inputsJson:JSON.stringify({expected:r.expected,bufferPct:r.budget>0&&r.expected>0?round2((r.budget-r.recurring-r.expected)/r.expected*100):0,recurring:r.recurring}),
        evaluatedAt:''
    }));
    await archiveForecastRows(rows);
}

async function refreshArchiveEvaluations() {
    const changed=[];
    flowForecastArchive.forEach(row=>{
        const [y,m1]=String(row.targetMonth||'').split('-').map(Number);
        if(!y || !m1) return;
        const periodEnd=new Date(y,m1,1);
        if(periodEnd>new Date()) return;
        const actual=getIndexedCategoryValue(y,m1-1,row.category,'totalExpense');
        const previous=Number(row.actualAmount)||0;
        if(Math.abs(previous-actual)<0.005 && row.errorAmount!==undefined) return;
        const forecast=Number(row.forecastAmount)||0;
        const error=round2(forecast-actual);
        const abs=round2(Math.abs(error));
        const pct=actual>0?round2(error/actual*100):'';
        row.actualAmount=actual; row.errorAmount=error; row.absoluteError=abs; row.errorPct=pct; row.evaluatedAt=new Date().toISOString();
        changed.push(row);
    });
    if(changed.length){ planningPersist(); try{ await planningPost({action:'archiveForecasts',rows:changed}); }catch(e){console.warn('Archive evaluation sync failed',e);} }
}

async function runForecastBackfill() {
    const rows = buildForecastArchiveBackfill();
    if (!rows.length) return;
    await archiveForecastRows(rows);
    showToast?.({ type:'success', title:'Forecast archív aktualizovaný', text:`Vyhodnotených ${rows.length} historických predikcií.` });
    renderPlanningScreens();
}

function escPlanning(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderAnnualPlanScreen() {
    const el = document.getElementById('annual-plan-content');
    if (!el) return;
    const year = parseInt(document.getElementById('annual-plan-year')?.value || new Date().getFullYear(),10);
    const months = getAnnualPlan(year);
    const totalBudget = months.reduce((s,m)=>s+m.budget,0);
    const totalForecast = months.reduce((s,m)=>s+m.forecast,0);
    const totalIncome = months.reduce((s,m)=>s+m.plannedIncome,0);
    const totalBalance = round2(totalIncome-totalForecast);
    const metrics = calculateForecastMetrics();

    el.innerHTML = `
      <div class="annual-hero-grid">
        <div class="annual-hero-card"><div class="annual-label">Ročný budget</div><div class="annual-value">${formatCurrency(totalBudget)}</div><div class="annual-sub">Plán výdavkov na ${year}</div></div>
        <div class="annual-hero-card"><div class="annual-label">Forecast</div><div class="annual-value">${formatCurrency(totalForecast)}</div><div class="annual-sub">Priebežne prepočítavaný</div></div>
        <div class="annual-hero-card"><div class="annual-label">Príjem</div><div class="annual-value">${formatCurrency(totalIncome)}</div><div class="annual-sub">Dostupné dáta + plán</div></div>
        <div class="annual-hero-card tone-${totalBalance >= 0 ? 'good':'danger'}"><div class="annual-label">Očakávaný zostatok</div><div class="annual-value">${formatCurrency(totalBalance)}</div><div class="annual-sub">Príjem mínus forecast</div></div>
      </div>
      <div class="planning-info-card"><div><strong>Model ${FLOW_MODEL_VERSION}</strong><div class="planning-muted">Kombinuje pravidelné záväzky, historický trend, sezónnosť, plánované udalosti a manuálne úpravy.</div></div><button type="button" onclick="runForecastBackfill()" class="planning-small-btn">Vyhodnotiť históriu</button></div>
      <div class="planning-metrics-row"><span>Archív: <b>${metrics.count}</b></span><span>Forecast WAPE: <b>${metrics.count ? metrics.wape + ' %' : '—'}</b></span><span>Budget WAPE: <b>${metrics.count ? metrics.budgetWape + ' %' : '—'}</b></span><span>Priem. chyba: <b>${metrics.count ? formatCurrency(metrics.mae) : '—'}</b></span></div>
      <div class="annual-month-list">
      ${months.map(m => `
        <div class="annual-month-card ${m.isCurrent ? 'current':''}">
          <div class="annual-month-top"><div><div class="annual-month-name">${m.monthName}</div><div class="planning-muted">${m.closed ? 'Uzavretý mesiac' : m.isCurrent ? 'Aktuálny mesiac' : 'Forecast'}</div></div><div class="annual-month-total">${formatCurrency(m.budget)}</div></div>
          <div class="annual-month-grid"><div><span>Forecast</span><b>${formatCurrency(m.forecast)}</b></div><div><span>Príjem</span><b>${formatCurrency(m.plannedIncome)}</b></div><div><span>Zostatok</span><b class="${m.plannedBalance >= 0 ? 'text-emerald-600':'text-rose-500'}">${formatCurrency(m.plannedBalance)}</b></div></div>
          ${m.events.length ? `<div class="annual-event-list">${m.events.map(e=>`<div class="annual-event-chip"><span>${escPlanning(e.title)}</span><b>${e.type==='income'?'+':'−'}${formatCurrency(Math.abs(e.amount))}</b></div>`).join('')}</div>`:''}
          <div class="annual-month-actions"><button type="button" onclick="openPlanningEventModal('${m.key}')">＋ Udalosť</button><button type="button" onclick="openMonthPlanDetail('${m.key}')">Detail mesiaca</button></div>
        </div>`).join('')}
      </div>`;
}

function renderRecurringScreen() {
    const el = document.getElementById('recurring-plan-content');
    if (!el) return;
    const active = flowRecurringPlans.filter(p=>p.active);
    const monthly = active.filter(p=>p.type==='expense').reduce((s,p)=>s+getPlanMonthlyAmount(p,new Date().getFullYear(),new Date().getMonth()),0);
    const annualized = active.filter(p=>p.type==='expense').reduce((s,p)=>s+monthlyEquivalent(p),0);
    el.innerHTML = `
      <div class="annual-hero-grid"><div class="annual-hero-card"><div class="annual-label">Mesačné záväzky</div><div class="annual-value">${formatCurrency(monthly)}</div><div class="annual-sub">Podľa aktuálneho mesiaca</div></div><div class="annual-hero-card"><div class="annual-label">Priemer / mesiac</div><div class="annual-value">${formatCurrency(annualized)}</div><div class="annual-sub">Ročné a štvrťročné rozpočítané</div></div></div>
      <div class="planning-section-head"><div><div class="budget-section-label">Plány</div><h3 class="budget-section-title">Pravidelné platby</h3></div><button type="button" onclick="openRecurringPlanModal()" class="planning-primary-btn">＋ Pridať</button></div>
      <div class="recurring-list">${active.length ? active.map(renderRecurringCard).join('') : `<div class="empty-state"><div class="empty-state-title">Zatiaľ nemáš pravidelné platby</div><div class="empty-state-text">Pridaj elektrinu, internet, poistku alebo inú opakovanú platbu.</div></div>`}</div>`;
}

function monthlyEquivalent(plan) {
    const amount=Number(plan.amount)||0;
    if(plan.frequency==='yearly') return amount/12;
    if(plan.frequency==='quarterly') return amount/3;
    if(plan.frequency==='weekly') return amount*4.345;
    return amount;
}

function renderRecurringCard(p) {
    const cat = p.category || 'Nezaradené';
    const freq = {monthly:'mesačne',quarterly:'štvrťročne',yearly:'ročne',weekly:'týždenne'}[p.frequency] || p.frequency;
    return `<div class="recurring-card"><div class="recurring-card-top"><div class="recurring-icon"><i data-lucide="repeat"></i></div><div class="min-w-0 flex-1"><div class="recurring-name">${escPlanning(p.name || cat)}</div><div class="planning-muted">${escPlanning(cat)}${p.sub ? ' / '+escPlanning(p.sub):''} · ${freq}</div></div><div class="recurring-amount">${formatCurrency(p.amount)}</div></div><div class="recurring-meta"><span>Ďalšia podľa plánu: deň ${p.dayOfMonth || 1}.</span><span>${p.amountMode==='variable'?'Premenlivá':'Fixná'} suma</span></div><div class="annual-month-actions"><button type="button" onclick="openRecurringPlanModal('${p.id}')">Upraviť</button><button type="button" onclick="pauseRecurringPlan('${p.id}')">Pozastaviť</button><button type="button" class="text-rose-600" onclick="openRecurringDeleteChoice('${p.id}')">Odstrániť</button></div></div>`;
}

function closePlanningModal() {
    const el = document.getElementById('planning-modal');
    if (el) el.classList.add('hidden');
}

function showPlanningModal(title, kicker, html) {
    document.getElementById('planning-modal-kicker').textContent = kicker || 'Plánovanie';
    document.getElementById('planning-modal-title').textContent = title || 'Plánovanie';
    document.getElementById('planning-modal-body').innerHTML = html;
    document.getElementById('planning-modal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function openRecurringPlanModal(id=null) {
    const p = id ? flowRecurringPlans.find(x=>String(x.id)===String(id)) : null;
    showPlanningModal(p ? 'Upraviť pravidelnú platbu' : 'Nová pravidelná platba', 'Pravidelné', `
      <form id="recurring-plan-form" class="space-y-4" onsubmit="submitRecurringPlanForm(event, '${p?.id || ''}')">
        <div><label class="planning-form-label">Názov</label><input id="rp-name" required class="planning-form-input" value="${escPlanning(p?.name || '')}" placeholder="Elektrina"></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="planning-form-label">Suma</label><input id="rp-amount" required type="number" min="0" step="0.01" class="planning-form-input" value="${p?.amount ?? ''}"></div><div><label class="planning-form-label">Deň</label><input id="rp-day" required type="number" min="1" max="31" class="planning-form-input" value="${p?.dayOfMonth || 1}"></div></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="planning-form-label">Frekvencia</label><select id="rp-frequency" class="planning-form-input"><option value="monthly" ${p?.frequency==='monthly'?'selected':''}>Mesačne</option><option value="quarterly" ${p?.frequency==='quarterly'?'selected':''}>Štvrťročne</option><option value="yearly" ${p?.frequency==='yearly'?'selected':''}>Ročne</option><option value="weekly" ${p?.frequency==='weekly'?'selected':''}>Týždenne</option></select></div><div><label class="planning-form-label">Typ sumy</label><select id="rp-mode" class="planning-form-input"><option value="fixed" ${p?.amountMode!=='variable'?'selected':''}>Fixná</option><option value="variable" ${p?.amountMode==='variable'?'selected':''}>Premenlivá</option></select></div></div>
        <div><label class="planning-form-label">Kategória</label><select id="rp-category" class="planning-form-input">${categories.filter(c=>c.id!=='Prijem').map(c=>`<option value="${escPlanning(c.id)}" ${p?.category===c.id?'selected':''}>${escPlanning(c.id)}</option>`).join('')}</select></div>
        <div><label class="planning-form-label">Začiatok</label><input id="rp-start" required type="date" class="planning-form-input" value="${p?.startDate || getTodayStr()}"></div>
        <div class="planning-helper">Pravidelná platba je plán. Jednotlivé transakcie sa z neho vytvárajú samostatne. Zmena sumy môže upraviť aj budúce transakcie.</div>
        <button class="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase">Uložiť</button>
      </form>`);
}

async function submitRecurringPlanForm(event, id) {
    event.preventDefault();
    const old = id ? flowRecurringPlans.find(x=>String(x.id)===String(id)) : null;
    const updated = {
        ...(old || {}), id:id || createUid('rp'),
        name:document.getElementById('rp-name').value.trim(),
        amount:Number(document.getElementById('rp-amount').value)||0,
        dayOfMonth:Number(document.getElementById('rp-day').value)||1,
        frequency:document.getElementById('rp-frequency').value,
        amountMode:document.getElementById('rp-mode').value,
        category:document.getElementById('rp-category').value,
        categoryId:getCategoryUidByName(document.getElementById('rp-category').value),
        startDate:document.getElementById('rp-start').value,
        active:true,
        type:'expense',
        version:(Number(old?.version)||0)+1
    };
    if (old && (Number(old.amount)!==updated.amount || old.frequency!==updated.frequency || old.dayOfMonth!==updated.dayOfMonth)) {
        showRecurringChangeChoice(old, updated);
        return;
    }
    await savePlanningEntity('recurring', updated);
    closePlanningModal();
}

function showRecurringChangeChoice(oldPlan, newPlan) {
    const body=document.getElementById('planning-modal-body');
    body.innerHTML=`<div class="space-y-3"><div class="planning-change-summary"><b>${escPlanning(oldPlan.name)}</b><span>${formatCurrency(oldPlan.amount)} → ${formatCurrency(newPlan.amount)}</span></div><div class="planning-muted">Ako zmeníš pravidelnú platbu, Flow môže zmenu použiť iba na plán alebo aj na už vytvorené transakcie.</div><button type="button" class="planning-choice-btn" onclick="applyRecurringChange('${oldPlan.id}','future')"><b>Táto a všetky budúce</b><span>Od dneška sa budúce plánované platby prepočítajú.</span></button><button type="button" class="planning-choice-btn" onclick="applyRecurringChange('${oldPlan.id}','all')"><b>Aj historické</b><span>Prepíše aj existujúce transakcie. Použi len ak história nemá zostať pôvodná.</span></button><button type="button" class="planning-choice-btn" onclick="applyRecurringChange('${oldPlan.id}','plan')"><b>Iba pravidelný plán</b><span>Existujúce transakcie sa nemenia.</span></button></div>`;
    window._pendingRecurringChange={old:oldPlan,newPlan:newPlan};
}

async function applyRecurringChange(id, scope) {
    const pending=window._pendingRecurringChange;
    if(!pending || String(pending.old.id)!==String(id))return;
    const {old,newPlan}=pending;
    await savePlanningEntity('recurring',newPlan);
    const today=getTodayStr();
    const affected=db.filter(tx=>!tx.deleted && (tx.recurringPlanId===old.id || (tx.isRecurring && tx.category===old.category && (tx.sub||'')===(old.sub||'') && tx.type===old.type)));
    affected.forEach(tx=>{
        const txDate=getCleanDateStr(tx.date);
        const allowed=scope==='all' || (scope==='future' && txDate>=today);
        if(!allowed)return;
        tx.amount=newPlan.amount; tx.frequency=newPlan.frequency; tx.category=newPlan.category; tx.categoryId=newPlan.categoryId; tx.sub=newPlan.sub||''; tx.note=newPlan.name||tx.note||''; tx.recurringPlanId=newPlan.id; tx.updatedAt=new Date().toISOString(); tx.version=(Number(tx.version)||1)+1; queueMutation(tx);
    });
    saveData(false); processSyncQueue();
    window._pendingRecurringChange=null; closePlanningModal(); renderList(); renderPlanningScreens(); updateBudgetScreen?.();
    showToast?.({type:'success',title:'Pravidelná platba upravená',text:scope==='all'?'Zmenené aj historické transakcie.':scope==='future'?'Zmenené budúce transakcie.':'Zmenený iba plán.'});
}

function pauseRecurringPlan(id) {
    const p=flowRecurringPlans.find(x=>String(x.id)===String(id));
    if(!p)return;
    p.active=false;p.version=(Number(p.version)||1)+1;p.updatedAt=new Date().toISOString();
    savePlanningEntity('recurring',p);
}

function openRecurringDeleteChoice(id) {
    const p = flowRecurringPlans.find(x=>String(x.id)===String(id));
    if (!p) return;
    window._pendingRecurringDelete = p;
    showPlanningModal('Odstrániť pravidelnú platbu','Pravidelné',`
      <div class="space-y-3">
        <div class="planning-change-summary"><b>${escPlanning(p.name || p.category)}</b><span>${formatCurrency(p.amount)}</span></div>
        <div class="planning-muted">Vyber, čo sa má odstrániť. História sa štandardne nemení, pokiaľ to výslovne nezvolíš.</div>
        <button type="button" class="planning-choice-btn" onclick="applyRecurringDelete('${p.id}','one')"><b>Iba jedna platba</b><span>Odstráni jednu najbližšiu budúcu transakciu. Pravidlo zostane aktívne.</span></button>
        <button type="button" class="planning-choice-btn" onclick="applyRecurringDelete('${p.id}','future')"><b>Táto a všetky budúce</b><span>Odstráni budúce vygenerované platby a ukončí pravidelný plán. Minulé zostanú.</span></button>
        <button type="button" class="planning-choice-btn" onclick="applyRecurringDelete('${p.id}','all')"><b>Všetky vrátane minulých</b><span>Odstráni všetky transakcie vytvorené týmto pravidelným plánom a ukončí ho.</span></button>
      </div>`);
}

async function applyRecurringDelete(id, scope) {
    const plan = flowRecurringPlans.find(x=>String(x.id)===String(id));
    if (!plan) return;
    const today = getTodayStr();
    let affected = db.filter(tx => !tx.deleted && String(tx.recurringPlanId || '') === String(plan.id));
    affected.sort((a,b) => String(a.date).localeCompare(String(b.date)));

    if (scope === 'one') {
        const one = affected.find(tx => getCleanDateStr(tx.date) >= today);
        if (one) markRecurringTransactionDeleted(one);
    } else if (scope === 'future') {
        affected.filter(tx => getCleanDateStr(tx.date) >= today).forEach(markRecurringTransactionDeleted);
        plan.active = false;
        plan.endDate = today;
        plan.version = (Number(plan.version)||1) + 1;
        plan.updatedAt = new Date().toISOString();
        await savePlanningEntity('recurring', plan);
    } else if (scope === 'all') {
        affected.forEach(markRecurringTransactionDeleted);
        plan.active = false;
        plan.deleted = true;
        plan.endDate = today;
        plan.version = (Number(plan.version)||1) + 1;
        plan.updatedAt = new Date().toISOString();
        await savePlanningEntity('recurring', plan);
        const idx = flowRecurringPlans.findIndex(x=>String(x.id)===String(plan.id));
        if (idx > -1) flowRecurringPlans.splice(idx,1);
        planningPersist();
    }

    saveData(false);
    processSyncQueue();
    closePlanningModal();
    renderList();
    renderPlanningScreens();
    updateAnalytics();
    updateBurnRateTab();
    if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    showToast?.({type:'success',title:'Pravidelná platba odstránená',text:scope==='one'?'Odstránená jedna budúca platba.':scope==='future'?'Odstránené budúce platby a plán bol ukončený.':'Odstránené všetky platby a plán.'});
    window._pendingRecurringDelete = null;
}

function markRecurringTransactionDeleted(tx) {
    tx.deleted = true;
    tx.action = 'delete';
    tx.updatedAt = new Date().toISOString();
    tx.version = (Number(tx.version)||1) + 1;
    queueMutation(tx);
}

function openPlanningEventModal(monthKey='') {
    const defaultDate = monthKey ? `${monthKey}-15` : getTodayStr();
    showPlanningModal('Naplánovať udalosť','Ročný plán',`<form id="event-plan-form" class="space-y-4" onsubmit="submitPlanningEvent(event)">
      <div><label class="planning-form-label">Názov</label><input id="evt-title" required class="planning-form-input" value="" placeholder="Dovolenka, bonus, servis..."></div>
      <div class="grid grid-cols-2 gap-2"><div><label class="planning-form-label">Suma</label><input id="evt-amount" required type="number" min="0" step="0.01" class="planning-form-input"></div><div><label class="planning-form-label">Typ</label><select id="evt-type" class="planning-form-input"><option value="expense">Výdavok</option><option value="income">Príjem</option></select></div></div>
      <div><label class="planning-form-label">Dátum</label><input id="evt-date" required type="date" class="planning-form-input" value="${defaultDate}"></div>
      <div><label class="planning-form-label">Kategória</label><select id="evt-category" class="planning-form-input">${categories.map(c=>`<option value="${escPlanning(c.id)}">${escPlanning(c.id)}</option>`).join('')}</select></div>
      <div><label class="planning-form-label">Poznámka</label><textarea id="evt-notes" class="planning-form-input min-h-[80px]" placeholder="Prečo túto udalosť plánuješ?"></textarea></div>
      <div class="planning-helper">Udalosť je iba plán. Nevytvorí automaticky transakciu a neovplyvní historické dáta.</div>
      <button class="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase">Pridať do plánu</button>
    </form>`);
}

async function submitPlanningEvent(event){
    event.preventDefault();
    const category=document.getElementById('evt-category').value;
    const entity={id:createUid('evt'),date:document.getElementById('evt-date').value,title:document.getElementById('evt-title').value.trim(),type:document.getElementById('evt-type').value,amount:Math.abs(Number(document.getElementById('evt-amount').value)||0),category,categoryId:getCategoryUidByName(category),sub:'',notes:document.getElementById('evt-notes').value.trim(),version:1,createdAt:new Date().toISOString()};
    await savePlanningEntity('event',entity); closePlanningModal();
}

function openMonthPlanDetail(key) {
    const [year,month1]=key.split('-').map(Number); const month=month1-1; const plan=getAnnualPlan(year)[month]; if(!plan)return;
    showPlanningModal(`${plan.monthName} ${year}`,'Detail mesiaca',`<div class="space-y-4"><div class="planning-detail-grid"><div><span>Budget</span><b>${formatCurrency(plan.budget)}</b></div><div><span>Forecast</span><b>${formatCurrency(plan.forecast)}</b></div><div><span>Príjem</span><b>${formatCurrency(plan.plannedIncome)}</b></div></div><div class="space-y-2">${plan.categoryRows.filter(r=>r.budget>0).sort((a,b)=>b.budget-a.budget).map(r=>`<div class="planning-category-row"><div><b>${escPlanning(r.category)}</b><small>${r.overridden?'Ručná úprava':'Model'} · forecast ${formatCurrency(r.forecast)}</small></div><strong>${formatCurrency(r.budget)}</strong><button type="button" onclick="openBudgetOverrideModal('${key}','${escPlanning(r.category)}',${r.budget})" class="planning-edit-icon"><i data-lucide="pencil"></i></button></div>`).join('')}</div></div>`);
}

function openBudgetOverrideModal(key, category, current) {
    showPlanningModal('Upraviť budget','Ročný plán',`<form class="space-y-4" onsubmit="submitBudgetOverride(event,'${key}','${escPlanning(category)}')"><div class="planning-change-summary"><b>${escPlanning(category)}</b><span>Model: ${formatCurrency(current)}</span></div><div><label class="planning-form-label">Tvoj budget</label><input id="override-amount" required type="number" min="0" step="0.01" class="planning-form-input" value="${current}"></div><div><label class="planning-form-label">Poznámka</label><textarea id="override-note" class="planning-form-input min-h-[70px]" placeholder="Prečo upravuješ plán?"></textarea></div><button class="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase">Uložiť úpravu</button></form>`);
}

async function submitBudgetOverride(event,key,category){
    event.preventDefault();
    const old=flowBudgetOverrides.find(o=>!o.deleted&&o.monthKey===key&&o.category===category);
    const entity={...(old||{}),id:old?.id||createUid('bo'),monthKey:key,category,amount:Number(document.getElementById('override-amount').value)||0,notes:document.getElementById('override-note').value.trim(),version:(Number(old?.version)||0)+1,createdAt:old?.createdAt||new Date().toISOString()};
    await savePlanningEntity('override',entity); closePlanningModal();
}

function renderPlanningScreens() {
    // Do not calculate the entire 12-month model while another tab is visible.
    const planScreen = document.getElementById('screen-plan');
    if (planScreen && !planScreen.classList.contains('hidden')) renderAnnualPlanScreen();
    const recurringScreen = document.getElementById('screen-recurring');
    if (recurringScreen && !recurringScreen.classList.contains('hidden')) renderRecurringScreen();
    if(window.lucide) lucide.createIcons();
}

function initPlanning() {
    if (typeof refreshYearSelectors === 'function') refreshYearSelectors();
    markForecastIndexDirty();
    planningPersist();
    // Planning data is loaded in the background. Historical backfill is explicit
    // (button) so first app open remains fast.
    loadPlanningData().then(()=>{
        // Re-evaluate only after the app has become idle; never block first paint.
        const runIdle = window.requestIdleCallback || (cb => setTimeout(cb, 1200));
        runIdle(async()=>{
            await refreshArchiveEvaluations();
            if (document.visibilityState !== 'hidden') renderPlanningScreens();
        });
    });
}

window.addEventListener('flow:data-changed', ()=>{ markForecastIndexDirty(); renderPlanningScreens(); });

