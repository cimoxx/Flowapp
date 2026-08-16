/* FLOW v2.37 - Multi-year data-aware annual planning and forecasting. */

let flowRecurringPlans = JSON.parse(localStorage.getItem('flow_recurring_plans_v235') || '[]');
let flowPlannedEvents = JSON.parse(localStorage.getItem('flow_planned_events_v235') || '[]');
let flowBudgetOverrides = JSON.parse(localStorage.getItem('flow_budget_overrides_v235') || '[]');
let flowForecastArchive = JSON.parse(localStorage.getItem('flow_forecast_archive_v235') || '[]');
let flowModelState = JSON.parse(localStorage.getItem('flow_model_state_v235') || '{}');
let planningLoaded = false;

const FLOW_MODEL_VERSION = '2.38.2-multi-year-walkforward';

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

function monthStart(year, month) {
    return new Date(year, month, 1).getTime();
}

function getDataCutoffForTarget(targetYear, targetMonth) {
    const now = new Date();
    const currentMonthStart = monthStart(now.getFullYear(), now.getMonth());
    const targetMonthStart = monthStart(targetYear, targetMonth);
    return Math.min(currentMonthStart, targetMonthStart);
}

function isHistoricalMonthAvailable(year, month, targetYear, targetMonth) {
    return monthStart(year, month) < getDataCutoffForTarget(targetYear, targetMonth);
}

function getHistoricalCategorySpend(category, targetYear, targetMonth) {
    const index = rebuildForecastIndex();
    const rows = [];
    const cutoff = getDataCutoffForTarget(targetYear, targetMonth);
    Object.keys(index.months).forEach(key => {
        const [y, m1] = key.split('-').map(Number);
        const m = m1 - 1;
        if (!Number.isFinite(y) || !Number.isFinite(m)) return;
        if (monthStart(y, m) >= cutoff) return;
        const value = getIndexedCategoryValue(y, m, category, 'variableExpense');
        rows.push({ year:y, month:m, value });
    });
    rows.sort((a,b) => monthStart(b.year,b.month) - monthStart(a.year,a.month));
    return rows;
}

function getHistoricalDataYears() {
    const currentYear = new Date().getFullYear();
    return getTransactionDataYears().filter(y => y <= currentYear).sort((a,b)=>a-b);
}

function getHistoricalYearSeasonality(category, targetYear, targetMonth) {
    const index = rebuildForecastIndex();
    const years = getHistoricalDataYears();
    const rows = [];

    years.forEach(year => {
        if (!isHistoricalMonthAvailable(year, targetMonth, targetYear, targetMonth)) return;
        // A historical year should only contribute if it has enough observations
        // to establish a stable annual baseline. Partial current years are allowed
        // only when the target is in the future and the data is already available.
        const months = index.years[year]?.monthsWithCategory?.[String(category)];
        if (!months || months.size < 4) return;

        let annualTotal = 0;
        let annualMonths = 0;
        for (let m = 0; m < 12; m++) {
            if (!isHistoricalMonthAvailable(year, m, targetYear, targetMonth)) continue;
            annualTotal += getIndexedCategoryValue(year, m, category, 'variableExpense');
            annualMonths++;
        }
        if (annualMonths < 4 || annualTotal <= 0) return;

        const annualAverage = annualTotal / annualMonths;
        const targetValue = isHistoricalMonthAvailable(year, targetMonth, targetYear, targetMonth)
            ? getIndexedCategoryValue(year, targetMonth, category, 'variableExpense')
            : 0;
        const ratio = targetValue / annualAverage;
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 8) return;

        const yearAge = Math.max(0, new Date().getFullYear() - year);
        // Every available year contributes; recent years are more informative.
        const weight = Math.max(0.25, Math.pow(0.82, yearAge));
        rows.push({ year, value:targetValue, ratio, weight, annualAverage, months:annualMonths });
    });
    return rows;
}

function median(values) {
    const nums = (Array.isArray(values) ? values : [])
        .map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    if (!nums.length) return 0;
    const mid=Math.floor(nums.length/2);
    return nums.length%2 ? nums[mid] : (nums[mid-1]+nums[mid])/2;
}

function weightedMean(rows, valueKey='value') {
    let total=0, weight=0;
    rows.forEach(r=>{
        const v=Number(r?.[valueKey]), w=Number(r?.weight ?? 1);
        if(Number.isFinite(v)&&Number.isFinite(w)&&w>0){total+=v*w;weight+=w;}
    });
    return weight?total/weight:0;
}

function clamp(value,min,max){return Math.min(max,Math.max(min,value));}

function getVariableForecast(category, year, month) {
    const historical = getHistoricalCategorySpend(category, year, month);
    const nonZero = historical.filter(x=>x.value>0);
    if(!nonZero.length) return {value:0,expected:0,confidence:'low',method:'no-data',dataMonths:0,dataYears:0,seasonalYears:0,seasonalIndex:1,trendFactor:1};

    // Multi-year level: all available observations contribute, with exponential
    // recency weighting. This lets 5-7 years of data improve the estimate without
    // allowing very old spending to dominate recent behaviour.
    const recentRows = historical.map((r,idx)=>({...r,weight:Math.pow(0.965,idx)}));
    const recentLevel = weightedMean(recentRows,'value');

    // Seasonal component: compare the target month across every available year
    // with that year's own annual level. A weighted median/mean blend is robust to
    // one-off events while retaining the long-term seasonal signal.
    const seasonalRows = getHistoricalYearSeasonality(category,year,month);
    let seasonalIndex = 1;
    if(seasonalRows.length>=2){
        const weightedRatio = weightedMean(seasonalRows,'ratio');
        const medianRatio = median(seasonalRows.map(r=>r.ratio));
        seasonalIndex = clamp((weightedRatio*0.65)+(medianRatio*0.35),0.35,3.5);
    }

    // Trend from yearly category levels. Use all available years, but only compare
    // years with sufficient data so partial years cannot create artificial growth.
    const byYear = new Map();
    nonZero.forEach(r=>{
        const cur=byYear.get(r.year)||{sum:0,count:0};
        cur.sum+=r.value; cur.count++;
        byYear.set(r.year,cur);
    });
    const yearly = [...byYear.entries()].map(([y,v])=>({year:y,avg:v.count>=4?v.sum/v.count:null})).filter(x=>x.avg!=null).sort((a,b)=>a.year-b.year);
    let trendFactor=1;
    if(yearly.length>=2){
        const recentYear=yearly[yearly.length-1].avg;
        const older=yearly.slice(0,-1).map(x=>x.avg);
        const olderMedian=median(older);
        if(olderMedian>0) trendFactor=clamp(recentYear/olderMedian,0.85,1.20);
    }

    let expected=recentLevel*seasonalIndex;
    if(yearly.length>=2) expected*=0.80+0.20*trendFactor;

    const values=nonZero.map(x=>x.value);
    const med=median(values)||expected;
    const mad=median(values.map(v=>Math.abs(v-med)));
    const volatility=med>0?mad/med:0;
    // Buffer is deliberately modest; central forecast remains the expected value.
    const buffer=Math.min(0.12,Math.max(0.02,volatility*0.25));
    const value=expected*(1+buffer);
    const dataYears=new Set(nonZero.map(x=>x.year)).size;
    const seasonalYears=seasonalRows.length;
    let confidence='low';
    if(dataYears>=5&&nonZero.length>=18&&seasonalYears>=4) confidence='high';
    else if(dataYears>=2||nonZero.length>=4) confidence='medium';

    return {value:round2(value),expected:round2(expected),bufferPct:round2(buffer*100),confidence,
        method:seasonalYears>=2?'multi-year-level-seasonal-trend':'multi-year-level-trend',
        dataMonths:nonZero.length,dataYears,seasonalYears,seasonalIndex:round2(seasonalIndex),trendFactor:round2(trendFactor)};
}

function expensesForCategoryExcludingRecurring(year,month,category){
    return getExpenseItemsForMonth(year,month).filter(x=>x.category===category&&!x.isRecurring);
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

function getEvaluatedBacktestRows() {
    // Accuracy metrics must measure one historical prediction per category/month.
    // Live snapshots are intentionally excluded because several snapshots of the
    // same month would overweight that period and distort WAPE.
    const unique = new Map();
    flowForecastArchive.forEach(row => {
        if (String(row.modelVersion || '') !== String(FLOW_MODEL_VERSION)) return;
        if (String(row.backtest || '') !== 'walk-forward') return;
        if (row.actualAmount === '' || row.actualAmount === null || row.actualAmount === undefined || !Number.isFinite(Number(row.actualAmount))) return;
        const key = `${row.targetMonth}|${row.category}|${row.modelVersion}`;
        const previous = unique.get(key);
        if (!previous || String(row.generatedAt || '') < String(previous.generatedAt || '')) unique.set(key, row);
    });
    return [...unique.values()];
}

function summarizeForecastRows(rows) {
    if (!rows.length) return { count:0, mae:0, wape:0, bias:0, accuracy:null, budgetMae:0, budgetWape:0, actualTotal:0 };
    let absoluteError = 0, signedError = 0, actualTotal = 0;
    let budgetAbsoluteError = 0, budgetActualTotal = 0, budgetCount = 0;
    rows.forEach(r => {
        const actual = Number(r.actualAmount) || 0;
        const forecast = Number(r.forecastAmount) || 0;
        const error = forecast - actual;
        absoluteError += Math.abs(error);
        signedError += error;
        actualTotal += Math.abs(actual);
        if (r.budgetAmount !== '' && r.budgetAmount !== null && r.budgetAmount !== undefined && Number.isFinite(Number(r.budgetAmount))) {
            budgetAbsoluteError += Math.abs(Number(r.budgetAmount) - actual);
            budgetActualTotal += Math.abs(actual);
            budgetCount++;
        }
    });
    const wape = actualTotal > 0 ? absoluteError / actualTotal * 100 : 0;
    return {
        count: rows.length,
        mae: round2(absoluteError / rows.length),
        wape: round2(wape),
        bias: round2(signedError / rows.length),
        accuracy: round2(Math.max(0, 100 - wape)),
        budgetMae: round2(budgetCount ? budgetAbsoluteError / budgetCount : 0),
        budgetWape: round2(budgetActualTotal ? budgetAbsoluteError / budgetActualTotal * 100 : 0),
        actualTotal: round2(actualTotal)
    };
}

function calculateForecastMetrics() {
    return summarizeForecastRows(getEvaluatedBacktestRows());
}

function groupForecastDiagnostics(rows, keyFn, labelFn) {
    const groups = new Map();
    rows.forEach(row => {
        const key = keyFn(row);
        if (key === null || key === undefined || key === '') return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    });
    return [...groups.entries()].map(([key, groupRows]) => ({
        key,
        label: labelFn ? labelFn(key, groupRows) : String(key),
        ...summarizeForecastRows(groupRows)
    }));
}

function getForecastDiagnostics() {
    const rows = getEvaluatedBacktestRows();
    const overall = summarizeForecastRows(rows);
    const byCategory = groupForecastDiagnostics(rows, r => String(r.category || ''), key => key)
        .filter(x => x.count >= 2)
        .sort((a,b) => b.wape - a.wape);
    const byMonth = groupForecastDiagnostics(rows, r => Number(String(r.targetMonth || '').slice(5,7)), key => MONTH_NAMES_SK[Math.max(0, Number(key)-1)] || String(key))
        .sort((a,b) => b.wape - a.wape);
    const byYear = groupForecastDiagnostics(rows, r => String(r.targetMonth || '').slice(0,4), key => String(key))
        .sort((a,b) => Number(a.key) - Number(b.key));
    const byStructure = groupForecastDiagnostics(rows, r => {
        const forecast = Math.abs(Number(r.forecastAmount) || 0);
        const recurring = Math.abs(Number(r.recurringBaseline) || 0);
        const ratio = forecast > 0 ? recurring / forecast : 0;
        if (ratio >= 0.70) return 'recurring';
        if (ratio <= 0.15) return 'variable';
        return 'mixed';
    }, key => ({recurring:'Prevažne pravidelné', variable:'Prevažne variabilné', mixed:'Zmiešané'}[key] || key));
    return { overall, byCategory, byMonth, byYear, byStructure, rows };
}

function forecastQualityLabel(wape) {
    const n = Number(wape);
    if (!Number.isFinite(n)) return 'Bez dát';
    if (n <= 10) return 'Výborná';
    if (n <= 20) return 'Dobrá';
    if (n <= 35) return 'Stredná';
    return 'Slabá';
}

function diagnosticRowsHtml(rows, limit = 6) {
    return rows.slice(0, limit).map(r => `<div class="forecast-diagnostic-row"><span>${escPlanning(r.label)}</span><b>${r.wape}%</b><small>${r.count} vzoriek · MAE ${formatCurrency(r.mae)}</small></div>`).join('') || '<div class="planning-muted">Zatiaľ nie je dosť dát.</div>';
}

function openForecastDiagnostics() {
    const d = getForecastDiagnostics();
    const bestCategories = [...d.byCategory].sort((a,b)=>a.wape-b.wape);
    const worstCategories = d.byCategory;
    const worstMonths = d.byMonth;
    const body = `
      <div class="forecast-diagnostic-summary">
        <div><span>Forecast WAPE</span><b>${d.overall.count ? d.overall.wape + '%' : '—'}</b><small>${forecastQualityLabel(d.overall.wape)}</small></div>
        <div><span>Budget WAPE</span><b>${d.overall.count ? d.overall.budgetWape + '%' : '—'}</b><small>${d.overall.count} unikátnych backtestov</small></div>
        <div><span>MAE</span><b>${d.overall.count ? formatCurrency(d.overall.mae) : '—'}</b><small>Priemerná absolútna chyba</small></div>
        <div><span>Bias</span><b>${d.overall.count ? formatCurrency(d.overall.bias) : '—'}</b><small>${d.overall.bias > 0 ? 'Model skôr nadhodnocuje' : d.overall.bias < 0 ? 'Model skôr podhodnocuje' : 'Bez systematického biasu'}</small></div>
      </div>
      <div class="forecast-diagnostic-section"><h4>Najväčší priestor na zlepšenie</h4>${diagnosticRowsHtml(worstCategories)}</div>
      <div class="forecast-diagnostic-section"><h4>Najpresnejšie kategórie</h4>${diagnosticRowsHtml(bestCategories)}</div>
      <div class="forecast-diagnostic-section"><h4>Najťažšie mesiace</h4>${diagnosticRowsHtml(worstMonths)}</div>
      <div class="forecast-diagnostic-section"><h4>Presnosť podľa typu výdavkov</h4>${diagnosticRowsHtml(d.byStructure)}</div>
      <div class="forecast-diagnostic-section"><h4>Vývoj podľa rokov</h4>${diagnosticRowsHtml(d.byYear, 20)}</div>
      <div class="planning-helper">Diagnostika používa iba unikátne walk-forward backtesty. Priebežné live snapshoty sa do WAPE nezapočítavajú, aby jeden mesiac nemal väčšiu váhu len preto, že bol archivovaný viackrát.</div>`;
    showPlanningModal('Diagnostika forecastu', `Model ${FLOW_MODEL_VERSION}`, body);
}

function getHistoricalRecurringBaseline(category,targetYear,targetMonth){
    const historical=getHistoricalCategorySpend(category,targetYear,targetMonth);
    const values=historical.map(r=>getIndexedCategoryValue(r.year,r.month,category,'recurringExpense')).filter(v=>v>0);
    return values.length?median(values):0;
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
    await refreshArchiveEvaluations();
    const rows = buildForecastArchiveBackfill();
    if (rows.length) await archiveForecastRows(rows);
    showToast?.({ type:'success', title:'Vyhodnotenie histórie hotové', text: rows.length ? `Doplnených ${rows.length} historických predikcií.` : 'Historický backtest je aktuálny.' });
    renderPlanningScreens();
    setTimeout(() => openForecastDiagnostics(), 0);
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
      <button type="button" class="planning-metrics-row planning-metrics-button" onclick="openForecastDiagnostics()" title="Zobraziť diagnostiku presnosti"><span>Backtest: <b>${metrics.count}</b></span><span>Forecast WAPE: <b>${metrics.count ? metrics.wape + ' %' : '—'}</b></span><span>Budget WAPE: <b>${metrics.count ? metrics.budgetWape + ' %' : '—'}</b></span><span>MAE: <b>${metrics.count ? formatCurrency(metrics.mae) : '—'}</b></span><span>Detail ›</span></button>
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

window.addEventListener('flow:data-changed', ()=>{ markForecastIndexDirty(); if(document.getElementById('screen-plan')?.classList.contains('hidden') && document.getElementById('screen-recurring')?.classList.contains('hidden')) return; renderPlanningScreens(); });

