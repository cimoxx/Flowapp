/* FLOW v2.37 - Multi-year data-aware annual planning and forecasting. */

let flowRecurringPlans = JSON.parse(localStorage.getItem('flow_recurring_plans_v235') || '[]');
let flowPlannedEvents = JSON.parse(localStorage.getItem('flow_planned_events_v235') || '[]');
let flowBudgetOverrides = JSON.parse(localStorage.getItem('flow_budget_overrides_v235') || '[]');
// Forecast archive is cloud-first. Do not keep the full archive in localStorage;
// multi-year walk-forward history can exceed browser storage quotas.
let flowForecastArchive = [];
try { localStorage.removeItem('flow_forecast_archive_v235'); } catch (_) {}
let flowModelState = JSON.parse(localStorage.getItem('flow_model_state_v235') || '{}');
let planningLoaded = false;

const FLOW_MODEL_VERSION = '2.42.0-category-champions-v1';
if (flowModelState?.forecastModelVersion !== FLOW_MODEL_VERSION) {
    flowModelState = {...(flowModelState || {}), forecastModelVersion:FLOW_MODEL_VERSION, champions:{}};
}

// Fast month/category index. It is rebuilt only when transaction data changes.
let flowForecastIndex = null;
let flowForecastIndexSignature = '';
let flowForecastIndexDirty = true;
let flowChampionCache = new Map();
let flowChampionStateCache = new Map();

function markForecastIndexDirty() {
    flowForecastIndexDirty = true;
    flowChampionCache.clear();
    flowChampionStateCache.clear();
}

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

    const index = { months: Object.create(null), years: Object.create(null), incomeMonths: Object.create(null) };
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
        if (!index.months[key][category]) index.months[key][category] = { variableExpense: 0, recurringExpense: 0, income: 0, recurringIncome: 0, variableIncome: 0, totalExpense: 0, count: 0 };
        const bucket = index.months[key][category];
        if (item.type === 'income') {
            bucket.income += amount;
            if (item.isRecurring) bucket.recurringIncome += amount;
            else bucket.variableIncome += amount;

            if (!index.incomeMonths[key]) index.incomeMonths[key] = { total:0, recurring:0, variable:0, bySub:Object.create(null) };
            const incomeMonth = index.incomeMonths[key];
            const sub = String(item.sub || 'Ine').trim() || 'Ine';
            if (!incomeMonth.bySub[sub]) incomeMonth.bySub[sub] = { total:0, recurring:0, variable:0, count:0 };
            incomeMonth.total += amount;
            if (item.isRecurring) incomeMonth.recurring += amount;
            else incomeMonth.variable += amount;
            incomeMonth.bySub[sub].total += amount;
            if (item.isRecurring) incomeMonth.bySub[sub].recurring += amount;
            else incomeMonth.bySub[sub].variable += amount;
            incomeMonth.bySub[sub].count += 1;
        } else if (item.type === 'expense') {
            bucket.totalExpense += amount;
            if (item.isRecurring) bucket.recurringExpense += amount;
            else bucket.variableExpense += amount;
            bucket.count += 1;
        }
        if (!index.years[year]) index.years[year] = { monthsWithCategory: Object.create(null), totals: Object.create(null), observedMonths: new Set() };
        index.years[year].observedMonths.add(month);
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

function getIndexedIncomeRecurring(year, month) {
    return Number(rebuildForecastIndex().incomeMonths[getMonthKey(year,month)]?.recurring) || 0;
}

function getIndexedIncomeVariable(year, month) {
    return Number(rebuildForecastIndex().incomeMonths[getMonthKey(year,month)]?.variable) || 0;
}

function getIndexedIncomeBySub(year, month, sub) {
    const wanted = normalizeIncomeSub(sub);
    const bySub = rebuildForecastIndex().incomeMonths[getMonthKey(year,month)]?.bySub || {};
    let total = 0;
    Object.entries(bySub).forEach(([key,b]) => {
        if (normalizeIncomeSub(key) === wanted) total += Number(b?.total) || 0;
    });
    return total;
}

function normalizeIncomeSub(value) {
    return String(value || 'Ine').trim().toLocaleLowerCase('sk-SK').normalize('NFD').replace(/[\u0300-\u036f]/g,'') || 'ine';
}

function getIndexedIncomeExcludingSubs(year, month, excludedSubs = new Set()) {
    const monthData = rebuildForecastIndex().incomeMonths[getMonthKey(year,month)];
    if (!monthData) return 0;
    let total = 0;
    Object.entries(monthData.bySub || {}).forEach(([sub,b]) => {
        if (!excludedSubs.has(normalizeIncomeSub(sub))) total += Number(b?.total) || 0;
    });
    return total;
}

const MONTH_NAMES_SK = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];

function planningPersist() {
    localStorage.setItem('flow_recurring_plans_v235', JSON.stringify(flowRecurringPlans));
    localStorage.setItem('flow_planned_events_v235', JSON.stringify(flowPlannedEvents));
    localStorage.setItem('flow_budget_overrides_v235', JSON.stringify(flowBudgetOverrides));
    localStorage.setItem('flow_model_state_v235', JSON.stringify(flowModelState));
}

function planningGetUrl() {
    const token = encodeURIComponent(typeof getSyncToken === 'function' ? getSyncToken() : '');
    return `${GOOGLE_URL}?get=planning&token=${token}&archiveModel=${encodeURIComponent(FLOW_MODEL_VERSION)}`;
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


function getHistoricalYearSeasonalityFromRows(historical, targetYear, targetMonth) {
    const rows = Array.isArray(historical) ? historical : [];
    const byYear = new Map();
    rows.forEach(r => {
        if (!Number.isFinite(Number(r?.year)) || !Number.isFinite(Number(r?.month))) return;
        const list = byYear.get(Number(r.year)) || [];
        list.push({ year:Number(r.year), month:Number(r.month), value:Number(r.value)||0 });
        byYear.set(Number(r.year), list);
    });
    const out = [];
    [...byYear.entries()].forEach(([year, yearRows]) => {
        const observed = new Map(yearRows.map(r => [r.month, Number(r.value)||0]));
        if (observed.size < 4) return;
        let total = 0;
        observed.forEach(v => total += v);
        if (total <= 0) return;
        const annualAverage = total / observed.size;
        const targetValue = observed.has(targetMonth) ? observed.get(targetMonth) : 0;
        const ratio = annualAverage > 0 ? targetValue / annualAverage : 0;
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 8) return;
        const yearAge = Math.max(0, Number(targetYear) - Number(year));
        const weight = Math.max(0.25, Math.pow(0.82, yearAge));
        out.push({ year, value:targetValue, ratio, weight, annualAverage, months:observed.size });
    });
    return out.sort((a,b)=>a.year-b.year);
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

function monthSerial(year, month) {
    return Number(year) * 12 + Number(month);
}

function robustBlend(values, meanWeight = 0.55) {
    const nums = (Array.isArray(values) ? values : []).map(Number).filter(v => Number.isFinite(v) && v >= 0);
    if (!nums.length) return 0;
    const mean = nums.reduce((s,v)=>s+v,0) / nums.length;
    const med = median(nums);
    return mean * meanWeight + med * (1 - meanWeight);
}

function getCategoryPatternStats(category, targetYear, targetMonth, historical = null) {
    const rows = historical || getHistoricalCategorySpend(category, targetYear, targetMonth);
    const chronological = [...rows].sort((a,b)=>monthSerial(a.year,a.month)-monthSerial(b.year,b.month));
    const nonZero = chronological.filter(r => Number(r.value) > 0);
    const totalMonths = chronological.length;
    const activeMonths = nonZero.length;
    const activeRatio = totalMonths ? activeMonths / totalMonths : 0;
    const dataYears = new Set(chronological.map(r=>r.year)).size;

    const monthActive = Array(12).fill(0);
    const monthObserved = Array(12).fill(0);
    const monthAmounts = Array(12).fill(0);
    chronological.forEach(r => {
        monthObserved[r.month] += 1;
        if ((Number(r.value)||0) > 0) {
            monthActive[r.month] += 1;
            monthAmounts[r.month] += Number(r.value)||0;
        }
    });

    const activeByYear = new Map();
    nonZero.forEach(r => activeByYear.set(r.year, (activeByYear.get(r.year)||0) + 1));
    const observedYears = [...new Set(chronological.map(r=>r.year))];
    const activeMonthsPerYear = observedYears.map(y=>activeByYear.get(y)||0);
    const medianActiveMonthsPerYear = median(activeMonthsPerYear);

    const totalActive = monthActive.reduce((s,v)=>s+v,0);
    const totalAmount = monthAmounts.reduce((s,v)=>s+v,0);
    const top3OccurrenceShare = totalActive ? [...monthActive].sort((a,b)=>b-a).slice(0,3).reduce((s,v)=>s+v,0) / totalActive : 0;
    const top3AmountShare = totalAmount ? [...monthAmounts].sort((a,b)=>b-a).slice(0,3).reduce((s,v)=>s+v,0) / totalAmount : 0;
    const concentration = Math.max(top3OccurrenceShare, top3AmountShare);

    const occurrenceRates = monthObserved.map((n,m)=>n ? monthActive[m] / n : 0);
    const maxOccurrenceRate = Math.max(0, ...occurrenceRates);
    const repeatedMonthEvents = monthActive.reduce((s,n)=>s+(n>=2?n:0),0);
    const repeatedMonthShare = totalActive ? repeatedMonthEvents / totalActive : 0;
    const exactOccurrence = occurrenceRates[targetMonth] || 0;
    const prevOccurrence = occurrenceRates[(targetMonth+11)%12] || 0;
    const nextOccurrence = occurrenceRates[(targetMonth+1)%12] || 0;
    // A small adjacent-month allowance helps categories that drift by a few weeks
    // between years (holidays, annual insurance, school expenses...).
    const calendarAffinity = clamp(exactOccurrence*0.70 + prevOccurrence*0.15 + nextOccurrence*0.15, 0, 1);

    const sameMonthPositive = chronological.filter(r=>r.month===targetMonth && Number(r.value)>0);
    const windowPositive = chronological.filter(r=>{
        if ((Number(r.value)||0) <= 0) return false;
        const d = Math.min((r.month-targetMonth+12)%12, (targetMonth-r.month+12)%12);
        return d <= 1;
    });

    const positiveSerials = nonZero.map(r=>monthSerial(r.year,r.month));
    const gaps = [];
    for (let i=1;i<positiveSerials.length;i++) {
        const gap = positiveSerials[i]-positiveSerials[i-1];
        if (gap > 0) gaps.push(gap);
    }
    const medianGap = median(gaps);
    const lastPositive = nonZero.length ? nonZero[nonZero.length-1] : null;
    const monthsSinceLast = lastPositive ? monthSerial(targetYear,targetMonth)-monthSerial(lastPositive.year,lastPositive.month) : null;
    let dueScore = activeRatio;
    if (medianGap > 0 && monthsSinceLast !== null && monthsSinceLast >= 0) {
        const ratio = monthsSinceLast / medianGap;
        // Peaks around the typical interval and falls when far too early/late.
        dueScore = clamp(1 - Math.abs(ratio-1)*0.75, 0, 1);
    }

    let patternType = 'variable';
    if (activeRatio >= 0.65) patternType = 'dense';
    else if (dataYears >= 3 && medianActiveMonthsPerYear <= 5 && concentration >= 0.55 && (repeatedMonthShare >= 0.50 || maxOccurrenceRate >= 0.45)) patternType = 'sparse-seasonal';
    else if (activeRatio <= 0.42 || medianActiveMonthsPerYear <= 4) patternType = 'intermittent';

    return {
        patternType, totalMonths, activeMonths, activeRatio, dataYears,
        medianActiveMonthsPerYear, concentration, exactOccurrence, calendarAffinity,
        maxOccurrenceRate, repeatedMonthShare, sameMonthPositive, windowPositive, nonZero, medianGap, monthsSinceLast, dueScore,
        occurrenceRates
    };
}

function getAmountTrendFactor(nonZero) {
    const byYear = new Map();
    nonZero.forEach(r=>{
        const cur=byYear.get(r.year)||[];
        cur.push(Number(r.value)||0);
        byYear.set(r.year,cur);
    });
    const yearly=[...byYear.entries()].map(([year,values])=>({year,level:robustBlend(values,0.50)})).filter(x=>x.level>0).sort((a,b)=>a.year-b.year);
    let trendFactor=1;
    if(yearly.length>=2){
        const recent=yearly[yearly.length-1].level;
        const olderMedian=median(yearly.slice(0,-1).map(x=>x.level));
        if(olderMedian>0) trendFactor=clamp(recent/olderMedian,0.78,1.28);
    }
    return {trendFactor, yearly};
}

function getIntermittentForecast(category, year, month, historical, pattern) {
    const nonZero = pattern.nonZero;
    const {trendFactor} = getAmountTrendFactor(nonZero);

    const globalRecent = nonZero.map((r,idx)=>({...r,weight:Math.pow(0.94, Math.max(0, nonZero.length-1-idx))}));
    const globalMean = weightedMean(globalRecent,'value');
    const globalMedian = median(nonZero.map(r=>Number(r.value)||0));
    const globalEventAmount = globalMean*0.55 + globalMedian*0.45;

    const directPool = pattern.sameMonthPositive.length >= 2 ? pattern.sameMonthPositive : pattern.windowPositive;
    const directRows = directPool.map(r=>({ ...r, weight: Math.max(0.30, Math.pow(0.86, Math.max(0, year-r.year))) }));
    const directMean = directRows.length ? weightedMean(directRows,'value') : 0;
    const directMedian = directRows.length ? median(directRows.map(r=>Number(r.value)||0)) : 0;
    const directAmount = directRows.length ? directMean*0.60 + directMedian*0.40 : globalEventAmount;

    const eventAmount = clamp((directAmount*0.65 + globalEventAmount*0.35) * (0.88 + 0.12*trendFactor), 0, Math.max(directAmount,globalEventAmount,1)*1.6);
    const overallOccurrence = pattern.activeRatio;

    let occurrenceProbability;
    let method;
    if (pattern.patternType === 'sparse-seasonal') {
        const sampleWeight = clamp(pattern.dataYears / 5, 0.30, 1);
        const seasonalP = pattern.calendarAffinity;
        occurrenceProbability = clamp(seasonalP*sampleWeight + overallOccurrence*(1-sampleWeight), 0, 1);
        method = 'sparse-seasonal-hurdle';
    } else {
        // Intermittent demand: combine month-of-year information with an event
        // interval/hazard signal. This is related to Croston-style forecasting,
        // but keeps a zero forecast when an event is not currently likely.
        occurrenceProbability = clamp(pattern.calendarAffinity*0.35 + pattern.dueScore*0.40 + overallOccurrence*0.25, 0, 1);
        method = 'intermittent-hazard';
    }

    // Central forecast answers "what is most likely to happen this month?" rather
    // than smearing every occasional expense across all months. Budget still keeps
    // a probability-weighted reserve for uncertain events.
    let expected = 0;
    // For absolute-error metrics (MAE/WAPE), the statistically sensible point
    // forecast for a zero-vs-event process is the most likely state. Therefore we
    // predict the event only above 50% probability; otherwise the central forecast
    // stays at zero. The budget can still reserve the probability-weighted amount.
    if (occurrenceProbability >= 0.50) expected = eventAmount;

    const reserveExpected = pattern.patternType === 'intermittent'
        ? eventAmount * (pattern.medianGap > 0 ? Math.min(1, 0.95 / pattern.medianGap) : overallOccurrence)
        : eventAmount * occurrenceProbability;
    const eventValues = nonZero.map(r=>Number(r.value)||0);
    const med = median(eventValues) || eventAmount;
    const mad = median(eventValues.map(v=>Math.abs(v-med)));
    const volatility = med>0 ? mad/med : 0;
    const buffer = clamp(0.04 + volatility*0.16, 0.04, 0.14);
    const budgetBase = Math.max(expected, reserveExpected);
    const value = budgetBase * (1 + buffer);

    let confidence='low';
    if(pattern.dataYears>=5 && directPool.length>=4) confidence='high';
    else if(pattern.dataYears>=3 || nonZero.length>=6) confidence='medium';

    return {
        value:round2(value), expected:round2(expected), bufferPct:round2(buffer*100), confidence,
        method, patternType:pattern.patternType, dataMonths:nonZero.length, dataYears:pattern.dataYears,
        seasonalYears:new Set(pattern.sameMonthPositive.map(r=>r.year)).size,
        seasonalIndex:round2(pattern.calendarAffinity), seasonalOccurrence:round2(pattern.calendarAffinity*100),
        seasonalStrength:round2(pattern.concentration), seasonalDirect:round2(directAmount), trendFactor:round2(trendFactor),
        occurrenceProbability:round2(occurrenceProbability*100), activeRatio:round2(pattern.activeRatio*100),
        concentration:round2(pattern.concentration*100), medianGap:round2(pattern.medianGap||0),
        monthsSinceLast:pattern.monthsSinceLast===null?null:round2(pattern.monthsSinceLast), eventAmount:round2(eventAmount)
    };
}

function getDenseVariableForecast(category, year, month, historical, pattern, seasonalRowsOverride = null) {
    const nonZero = historical.filter(x=>x.value>0);
    const recentRows = historical.map((r,idx)=>({...r,weight:Math.pow(0.965,idx)}));
    const recentLevel = weightedMean(recentRows,'value');

    const seasonalRows = Array.isArray(seasonalRowsOverride) ? seasonalRowsOverride : getHistoricalYearSeasonality(category,year,month);
    let seasonalIndex = 1;
    let seasonalDirect = 0;
    let seasonalOccurrence = 0;
    let seasonalStrength = 0;
    if(seasonalRows.length>=2){
        const weightedRatio = weightedMean(seasonalRows,'ratio');
        const medianRatio = median(seasonalRows.map(r=>r.ratio));
        seasonalIndex = clamp((weightedRatio*0.60)+(medianRatio*0.40),0.25,3.5);
        const directMean = weightedMean(seasonalRows,'value');
        const directMedian = median(seasonalRows.map(r=>Number(r.value)||0));
        seasonalDirect = directMean*0.60+directMedian*0.40;
        seasonalOccurrence = seasonalRows.filter(r=>(Number(r.value)||0)>0).length / seasonalRows.length;
        const indexDistance = Math.min(1, Math.abs(Math.log(Math.max(0.05, seasonalIndex))) / Math.log(3));
        const sampleStrength = Math.min(1, seasonalRows.length / 5);
        seasonalStrength = clamp((seasonalOccurrence*0.55 + indexDistance*0.45) * sampleStrength, 0, 1);
    }

    const {trendFactor, yearly}=getAmountTrendFactor(nonZero);
    let expected=recentLevel*seasonalIndex;
    if(yearly.length>=2) expected*=0.82+0.18*trendFactor;
    if(seasonalRows.length>=3){
        const directWeight=clamp(0.08+seasonalStrength*0.45,0.08,0.55);
        const adjustedDirect=seasonalDirect*(yearly.length>=2?(0.88+0.12*trendFactor):1);
        expected=expected*(1-directWeight)+adjustedDirect*directWeight;
    }

    const values=nonZero.map(x=>x.value);
    const med=median(values)||expected;
    const mad=median(values.map(v=>Math.abs(v-med)));
    const volatility=med>0?mad/med:0;
    const buffer=clamp(0.02+volatility*0.20,0.02,0.10);
    const value=expected*(1+buffer);
    const dataYears=new Set(nonZero.map(x=>x.year)).size;
    const seasonalYears=seasonalRows.length;
    let confidence='low';
    if(dataYears>=5&&nonZero.length>=18&&seasonalYears>=4) confidence='high';
    else if(dataYears>=2||nonZero.length>=4) confidence='medium';

    return {value:round2(value),expected:round2(expected),bufferPct:round2(buffer*100),confidence,
        method:pattern.patternType==='dense'?'dense-seasonal-trend':'variable-multiyear', patternType:pattern.patternType,
        dataMonths:nonZero.length,dataYears,seasonalYears,seasonalIndex:round2(seasonalIndex),
        seasonalOccurrence:round2(seasonalOccurrence*100),seasonalStrength:round2(seasonalStrength),
        seasonalDirect:round2(seasonalDirect),trendFactor:round2(trendFactor),
        occurrenceProbability:round2(pattern.activeRatio*100), activeRatio:round2(pattern.activeRatio*100),
        concentration:round2(pattern.concentration*100), medianGap:round2(pattern.medianGap||0),
        monthsSinceLast:pattern.monthsSinceLast===null?null:round2(pattern.monthsSinceLast)
    };
}

function getCategoryAdaptiveLegacyForecast(category, year, month, historicalOverride = null) {
    const historical = Array.isArray(historicalOverride) ? historicalOverride : getHistoricalCategorySpend(category, year, month);
    const nonZero = historical.filter(x=>x.value>0);
    if(!nonZero.length) return {value:0,expected:0,confidence:'low',method:'no-data',patternType:'no-data',dataMonths:0,dataYears:0,seasonalYears:0,seasonalIndex:1,trendFactor:1,occurrenceProbability:0};

    const pattern = getCategoryPatternStats(category, year, month, historical);
    if(pattern.patternType==='sparse-seasonal' || pattern.patternType==='intermittent') {
        return getIntermittentForecast(category, year, month, historical, pattern);
    }
    const seasonalRows = getHistoricalYearSeasonalityFromRows(historical, year, month);
    return getDenseVariableForecast(category, year, month, historical, pattern, seasonalRows);
}


function rowsChronological(rows) {
    return (Array.isArray(rows) ? rows : [])
        .map(r=>({year:Number(r.year),month:Number(r.month),value:Math.max(0,Number(r.value)||0)}))
        .filter(r=>Number.isFinite(r.year)&&Number.isFinite(r.month))
        .sort((a,b)=>monthSerial(a.year,a.month)-monthSerial(b.year,b.month));
}

function getCandidateBuffer(values, expected, min = 0.02, max = 0.12) {
    const nums=(Array.isArray(values)?values:[]).map(Number).filter(v=>Number.isFinite(v)&&v>=0);
    if(!nums.length || expected<=0) return min;
    const med=median(nums);
    const scale=Math.max(med, expected, 1);
    const mad=median(nums.map(v=>Math.abs(v-med)));
    return clamp(min + (mad/scale)*0.18, min, max);
}

function makeCandidateResult(expected, budget, method, rows, extra = {}) {
    const nonZero=(Array.isArray(rows)?rows:[]).filter(r=>(Number(r.value)||0)>0);
    const dataYears=new Set(nonZero.map(r=>r.year)).size;
    return {
        expected:round2(Math.max(0,Number(expected)||0)),
        value:round2(Math.max(0,Number(budget)||0)),
        method,
        confidence:dataYears>=4&&nonZero.length>=12?'high':dataYears>=2&&nonZero.length>=4?'medium':'low',
        patternType:extra.patternType||method,
        dataMonths:nonZero.length,
        dataYears,
        seasonalYears:extra.seasonalYears||0,
        seasonalIndex:extra.seasonalIndex??1,
        trendFactor:extra.trendFactor??1,
        occurrenceProbability:extra.occurrenceProbability??0,
        ...extra
    };
}

function predictRecentRobust(rows, year, month) {
    const all=rowsChronological(rows);
    const recent=all.slice(-18).reverse();
    if(!recent.length) return makeCandidateResult(0,0,'recent-robust',rows);
    const weighted=recent.map((r,i)=>({...r,weight:Math.pow(0.88,i)}));
    const mean=weightedMean(weighted,'value');
    const med=median(recent.map(r=>r.value));
    const expected=mean*0.72+med*0.28;
    const buffer=getCandidateBuffer(recent.map(r=>r.value),expected,0.02,0.10);
    return makeCandidateResult(expected,expected*(1+buffer),'recent-robust',rows,{bufferPct:round2(buffer*100)});
}

function predictSameMonth(rows, year, month) {
    const same=rowsChronological(rows).filter(r=>r.month===month).sort((a,b)=>b.year-a.year);
    if(!same.length) return makeCandidateResult(0,0,'same-month',rows,{seasonalYears:0});
    const weighted=same.map(r=>({...r,weight:Math.max(0.25,Math.pow(0.80,Math.max(0,year-r.year)))}));
    const mean=weightedMean(weighted,'value');
    const med=median(same.map(r=>r.value));
    let expected=mean*0.68+med*0.32;
    const positive=same.filter(r=>r.value>0);
    if(positive.length>=2){
        const newest=positive[0].value;
        const older=median(positive.slice(1).map(r=>r.value));
        if(older>0) expected*=0.88+0.12*clamp(newest/older,0.75,1.30);
    }
    const buffer=getCandidateBuffer(same.map(r=>r.value),expected,0.03,0.12);
    return makeCandidateResult(expected,expected*(1+buffer),'same-month',rows,{seasonalYears:same.length,bufferPct:round2(buffer*100)});
}

function predictSeasonalWindow(rows, year, month) {
    const all=rowsChronological(rows);
    const selected=[];
    all.forEach(r=>{
        const d=Math.min((r.month-month+12)%12,(month-r.month+12)%12);
        if(d>1)return;
        const monthWeight=d===0?1:0.22;
        const yearWeight=Math.max(0.25,Math.pow(0.82,Math.max(0,year-r.year)));
        selected.push({...r,weight:monthWeight*yearWeight});
    });
    if(!selected.length) return makeCandidateResult(0,0,'seasonal-window',rows);
    const mean=weightedMean(selected,'value');
    const direct=selected.filter(r=>r.month===month);
    const directMed=direct.length?median(direct.map(r=>r.value)):mean;
    const expected=mean*0.55+directMed*0.45;
    const buffer=getCandidateBuffer(selected.map(r=>r.value),expected,0.03,0.12);
    return makeCandidateResult(expected,expected*(1+buffer),'seasonal-window',rows,{seasonalYears:new Set(selected.map(r=>r.year)).size,bufferPct:round2(buffer*100)});
}

function predictLastYear(rows, year, month) {
    const same=rowsChronological(rows).filter(r=>r.month===month&&r.year<year).sort((a,b)=>b.year-a.year);
    if(!same.length) return makeCandidateResult(0,0,'last-year',rows);
    const latest=same[0];
    let expected=latest.value;
    if(same.length>=3){
        const older=median(same.slice(1,4).map(r=>r.value));
        if(older>0 && latest.value>0) expected*=0.92+0.08*clamp(latest.value/older,0.75,1.30);
    }
    const buffer=getCandidateBuffer(same.slice(0,4).map(r=>r.value),expected,0.02,0.10);
    return makeCandidateResult(expected,expected*(1+buffer),'last-year',rows,{seasonalYears:same.length,bufferPct:round2(buffer*100)});
}

function predictSeasonalIndex(rows, year, month) {
    const all=rowsChronological(rows);
    if(!all.length) return makeCandidateResult(0,0,'seasonal-index',rows);
    const recent=all.slice(-18).reverse().map((r,i)=>({...r,weight:Math.pow(0.90,i)}));
    const level=weightedMean(recent,'value');
    const seasonalRows=getHistoricalYearSeasonalityFromRows(all,year,month);
    if(!seasonalRows.length) return predictRecentRobust(rows,year,month);
    const ratio=clamp(weightedMean(seasonalRows,'ratio')*0.65+median(seasonalRows.map(r=>r.ratio))*0.35,0,3.2);
    const direct=weightedMean(seasonalRows,'value');
    const expected=(level*ratio)*0.70+direct*0.30;
    const buffer=getCandidateBuffer(seasonalRows.map(r=>r.value),expected,0.03,0.11);
    return makeCandidateResult(expected,expected*(1+buffer),'seasonal-index',rows,{seasonalYears:seasonalRows.length,seasonalIndex:round2(ratio),bufferPct:round2(buffer*100)});
}

function predictEventCalendar(rows, year, month) {
    const all=rowsChronological(rows);
    if(!all.some(r=>r.value>0)) return makeCandidateResult(0,0,'event-calendar',rows);
    const pattern=getCategoryPatternStats('',year,month,all);
    const directPool=pattern.sameMonthPositive.length>=2?pattern.sameMonthPositive:pattern.windowPositive;
    const positives=directPool.length?directPool:pattern.nonZero;
    const eventAmount=robustBlend(positives.map(r=>r.value),0.45);
    const p=clamp(pattern.calendarAffinity*0.70+pattern.activeRatio*0.15+pattern.dueScore*0.15,0,1);
    const expected=p>=0.52?eventAmount:0;
    const reserve=eventAmount*p;
    const buffer=getCandidateBuffer(positives.map(r=>r.value),Math.max(expected,reserve),0.03,0.10);
    return makeCandidateResult(expected,Math.max(expected,reserve)*(1+buffer),'event-calendar',rows,{
        seasonalYears:new Set(pattern.sameMonthPositive.map(r=>r.year)).size,
        occurrenceProbability:round2(p*100), patternType:pattern.patternType,
        eventAmount:round2(eventAmount), bufferPct:round2(buffer*100)
    });
}


function predictMultiYearTrend(rows, year, month) {
    const historical=rowsChronological(rows).slice().reverse(); // newest first, like v2.38.2
    const nonZero=historical.filter(r=>(Number(r.value)||0)>0);
    if(!nonZero.length) return makeCandidateResult(0,0,'multi-year-trend',rows);

    // Proven v2.38.2 level model: all observed months contribute with recency decay.
    const recentRows=historical.map((r,idx)=>({...r,weight:Math.pow(0.965,idx)}));
    const recentLevel=weightedMean(recentRows,'value');

    // Seasonal index by historical year. Require at least 4 positive months in the
    // year so a partial/very sparse year does not create a fake seasonal pattern.
    const byYear=new Map();
    historical.forEach(r=>{
        const list=byYear.get(Number(r.year))||[];
        list.push({year:Number(r.year),month:Number(r.month),value:Number(r.value)||0});
        byYear.set(Number(r.year),list);
    });
    const seasonalRows=[];
    [...byYear.entries()].forEach(([histYear,yearRows])=>{
        const observed=new Map(yearRows.map(r=>[r.month,Number(r.value)||0]));
        const positiveMonths=[...observed.values()].filter(v=>v>0).length;
        if(observed.size<4 || positiveMonths<4) return;
        let total=0; observed.forEach(v=>total+=v);
        if(total<=0) return;
        const annualAverage=total/observed.size;
        const targetValue=observed.has(month)?observed.get(month):0;
        const ratio=annualAverage>0?targetValue/annualAverage:0;
        if(!Number.isFinite(ratio)||ratio<0||ratio>8) return;
        const yearAge=Math.max(0,Number(year)-histYear);
        seasonalRows.push({year:histYear,value:targetValue,ratio,weight:Math.max(0.25,Math.pow(0.82,yearAge))});
    });
    let seasonalIndex=1;
    if(seasonalRows.length>=2){
        seasonalIndex=clamp(weightedMean(seasonalRows,'ratio')*0.65+median(seasonalRows.map(r=>r.ratio))*0.35,0.35,3.5);
    }

    // Conservative trend from historical yearly category levels.
    const levels=new Map();
    nonZero.forEach(r=>{
        const cur=levels.get(Number(r.year))||{sum:0,count:0};
        cur.sum+=Number(r.value)||0; cur.count++;
        levels.set(Number(r.year),cur);
    });
    const yearly=[...levels.entries()]
        .map(([histYear,v])=>({year:histYear,avg:v.count>=4?v.sum/v.count:null}))
        .filter(x=>x.avg!==null)
        .sort((a,b)=>a.year-b.year);
    let trendFactor=1;
    if(yearly.length>=2){
        const recentYear=yearly[yearly.length-1].avg;
        const olderMedian=median(yearly.slice(0,-1).map(x=>x.avg));
        if(olderMedian>0) trendFactor=clamp(recentYear/olderMedian,0.85,1.20);
    }

    let expected=recentLevel*seasonalIndex;
    if(yearly.length>=2) expected*=0.80+0.20*trendFactor;
    const buffer=getCandidateBuffer(nonZero.map(r=>r.value),expected,0.02,0.12);
    return makeCandidateResult(expected,expected*(1+buffer),'multi-year-trend',rows,{
        seasonalYears:seasonalRows.length,
        seasonalIndex:round2(seasonalIndex),
        trendFactor:round2(trendFactor),
        bufferPct:round2(buffer*100)
    });
}

function predictLegacyAdaptive(rows, category, year, month) {
    const result=getCategoryAdaptiveLegacyForecast(category,year,month,rows);
    return {...result,method:'legacy-adaptive'};
}

const FLOW_FORECAST_CANDIDATES = ['legacy-adaptive','recent-robust','multi-year-trend','same-month','seasonal-window','last-year','seasonal-index','event-calendar','zero-baseline'];

// Priors derived from the accumulated walk-forward scenario archive.
// They are category-level anchors, not permanent hard locks. A challenger may
// replace the prior only when the category's own validation data shows a clear,
// sustained improvement. This avoids the month-level overfitting seen in v2.41.
const FLOW_CATEGORY_CHAMPION_PRIORS = {
    'strava':'recent-robust',
    'zabava / dovolenky / dovolenky':'legacy-adaptive',
    'doprava':'legacy-adaptive',
    'osobna starostlivost':'recent-robust',
    'darceky':'multi-year-trend',
    'domacnost':'multi-year-trend',
    'ine':'recent-robust',
    'deti':'multi-year-trend',
    'domace zvierata':'multi-year-trend',
    'poistenie':'last-year',
    'dane':'seasonal-index',
    'uspory':'legacy-adaptive'
};

function normalizeForecastCategory(value) {
    return String(value||'').trim().toLocaleLowerCase('sk-SK').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function getCategoryChampionPrior(category) {
    return FLOW_CATEGORY_CHAMPION_PRIORS[normalizeForecastCategory(category)] || null;
}


function predictForecastCandidate(candidate, rows, category, year, month) {
    if(candidate==='legacy-adaptive') return predictLegacyAdaptive(rows,category,year,month);
    if(candidate==='recent-robust') return predictRecentRobust(rows,year,month);
    if(candidate==='multi-year-trend') return predictMultiYearTrend(rows,year,month);
    if(candidate==='same-month') return predictSameMonth(rows,year,month);
    if(candidate==='seasonal-window') return predictSeasonalWindow(rows,year,month);
    if(candidate==='last-year') return predictLastYear(rows,year,month);
    if(candidate==='seasonal-index') return predictSeasonalIndex(rows,year,month);
    if(candidate==='event-calendar') return predictEventCalendar(rows,year,month);
    if(candidate==='zero-baseline') return makeCandidateResult(0,0,'zero-baseline',rows);
    return predictLegacyAdaptive(rows,category,year,month);
}

function candidateStatMetrics(st, typicalPositive) {
    const denom=st.actual>0?st.actual:typicalPositive*Math.max(st.weight,1);
    const wape=st.abs/Math.max(denom,1)*100;
    const budgetWape=st.budgetAbs/Math.max(denom,1)*100;
    const meanBias=st.weight?st.signed/st.weight:0;
    const biasPct=Math.abs(meanBias)/Math.max(typicalPositive,1)*100;
    const score=wape*0.72+budgetWape*0.23+biasPct*0.05;
    return {...st,wape:round2(wape),budgetWape:round2(budgetWape),bias:round2(meanBias),score:round2(score)};
}

function evaluateForecastCandidates(category, targetYear, targetMonth, historical) {
    const chronological=rowsChronological(historical);
    const minTrainingMonths=12;
    const eligible=[];
    for(let i=minTrainingMonths;i<chronological.length;i++) eligible.push(i);
    const validation=eligible.slice(-30);
    if(validation.length<8){
        return {candidate:'legacy-adaptive',reason:'insufficient-validation',validationCount:validation.length,ranking:[]};
    }

    const makeStats=()=>new Map(FLOW_FORECAST_CANDIDATES.map(c=>[c,{candidate:c,abs:0,budgetAbs:0,signed:0,actual:0,weight:0,count:0,positiveCount:0}]));
    const stats=makeStats();
    const monthStats=makeStats();

    validation.forEach((idx,pos)=>{
        const target=chronological[idx];
        const train=chronological.slice(0,idx);
        const recencyWeight=Math.pow(0.94,validation.length-1-pos);
        FLOW_FORECAST_CANDIDATES.forEach(candidate=>{
            const pred=predictForecastCandidate(candidate,train,category,target.year,target.month);
            const forecast=Math.max(0,Number(pred?.expected)||0);
            const budget=Math.max(0,Number(pred?.value)||0);
            const actual=Math.max(0,Number(target.value)||0);
            const st=stats.get(candidate);
            st.abs+=Math.abs(forecast-actual)*recencyWeight;
            st.budgetAbs+=Math.abs(budget-actual)*recencyWeight;
            st.signed+=(forecast-actual)*recencyWeight;
            st.actual+=actual*recencyWeight;
            st.weight+=recencyWeight; st.count++; if(actual>0)st.positiveCount++;
        });
    });

    // Calendar-month evidence is deliberately shrunk toward the category score.
    // The scenario archive showed that month-specific selection helps, but only
    // after at least two prior observations; with little data it must not overfit.
    const monthEligible=eligible.filter(idx=>chronological[idx].month===targetMonth).slice(-8);
    monthEligible.forEach((idx,pos)=>{
        const target=chronological[idx];
        const train=chronological.slice(0,idx);
        const recencyWeight=Math.pow(0.90,monthEligible.length-1-pos);
        FLOW_FORECAST_CANDIDATES.forEach(candidate=>{
            const pred=predictForecastCandidate(candidate,train,category,target.year,target.month);
            const forecast=Math.max(0,Number(pred?.expected)||0);
            const budget=Math.max(0,Number(pred?.value)||0);
            const actual=Math.max(0,Number(target.value)||0);
            const st=monthStats.get(candidate);
            st.abs+=Math.abs(forecast-actual)*recencyWeight;
            st.budgetAbs+=Math.abs(budget-actual)*recencyWeight;
            st.signed+=(forecast-actual)*recencyWeight;
            st.actual+=actual*recencyWeight;
            st.weight+=recencyWeight; st.count++; if(actual>0)st.positiveCount++;
        });
    });

    const typicalPositive=median(chronological.filter(r=>r.value>0).map(r=>r.value))||1;
    const ranking=[...stats.values()].map(st=>{
        const base=candidateStatMetrics(st,typicalPositive);
        const ms=candidateStatMetrics(monthStats.get(st.candidate),typicalPositive);
        const monthCount=monthStats.get(st.candidate).count;
        const monthWeight=monthCount>=2 ? monthCount/(monthCount+8) : 0;
        const selectionScore=base.score*(1-monthWeight)+ms.score*monthWeight;
        return {...base,monthWape:ms.wape,monthCount,monthWeight:round2(monthWeight),selectionScore:round2(selectionScore)};
    }).sort((a,b)=>a.selectionScore-b.selectionScore);

    const baseline=ranking.find(r=>r.candidate==='legacy-adaptive')||ranking[0];
    let winner=ranking[0]||baseline;
    if(winner && baseline && winner.candidate!=='legacy-adaptive'){
        const required=baseline.selectionScore*0.97;
        if(!(winner.selectionScore<required)) winner=baseline;
    }
    if(winner?.candidate==='zero-baseline'){
        const positive=ranking.find(r=>r.candidate!=='zero-baseline'&&r.positiveCount>=2);
        if(positive && winner.selectionScore>positive.selectionScore*0.90) winner=positive;
    }
    return {
        candidate:winner?.candidate||'legacy-adaptive',
        validationCount:validation.length,
        validationWape:winner?.wape??null,
        validationBudgetWape:winner?.budgetWape??null,
        validationBias:winner?.bias??null,
        monthValidationCount:winner?.monthCount||0,
        monthValidationWape:winner?.monthWape??null,
        baselineWape:baseline?.wape??null,
        baselineScore:baseline?.selectionScore??baseline?.score??null,
        winnerScore:winner?.selectionScore??winner?.score??null,
        improvementPct:baseline&&winner&&baseline.selectionScore>0?round2((baseline.selectionScore-winner.selectionScore)/baseline.selectionScore*100):0,
        ranking:ranking.slice(0,4).map(r=>({candidate:r.candidate,wape:r.wape,monthWape:r.monthWape,monthCount:r.monthCount,budgetWape:r.budgetWape,score:r.selectionScore}))
    };
}


function createEmptyCandidateStats() {
    return Object.fromEntries(FLOW_FORECAST_CANDIDATES.map(c=>[c,{candidate:c,abs:0,budgetAbs:0,signed:0,actual:0,weight:0,count:0,positiveCount:0}]));
}

function createOnlineChampionState() {
    return {
        history: [],
        validationCount: 0,
        stats: createEmptyCandidateStats(),
        monthStats: Array.from({length:12},()=>createEmptyCandidateStats())
    };
}

function rankOnlineChampionState(state) {
    const positives=state.history.filter(r=>r.value>0).map(r=>r.value);
    const typicalPositive=median(positives)||1;
    return Object.values(state.stats)
        .map(st=>{
            const base=candidateStatMetrics(st,typicalPositive);
            return {...base,selectionScore:base.score};
        })
        .sort((a,b)=>a.selectionScore-b.selectionScore);
}

function selectOnlineChampion(state, category) {
    const priorCandidate=getCategoryChampionPrior(category);
    const fallbackCandidate=priorCandidate && FLOW_FORECAST_CANDIDATES.includes(priorCandidate)
        ? priorCandidate
        : 'legacy-adaptive';

    // Use the scenario-derived category prior until we have enough true
    // walk-forward evidence to challenge it. This is deliberately category-wide:
    // v2.41 showed that month-specific winners were too easy to overfit.
    if(state.validationCount<12 || state.history.length<18){
        return {
            candidate:fallbackCandidate,
            priorCandidate:fallbackCandidate,
            reason:'category-prior',
            validationCount:state.validationCount,
            ranking:[]
        };
    }

    const ranking=rankOnlineChampionState(state);
    const prior=ranking.find(r=>r.candidate===fallbackCandidate)
        || ranking.find(r=>r.candidate==='legacy-adaptive')
        || ranking[0];
    let winner=ranking[0]||prior;

    // A challenger must beat the established category prior by a meaningful margin.
    // With 36+ validation months 5% is enough; with less evidence demand 8%.
    const minImprovement=state.validationCount>=36 ? 0.05 : 0.08;
    if(winner && prior && winner.candidate!==prior.candidate){
        if(!(winner.selectionScore < prior.selectionScore*(1-minImprovement))) winner=prior;
    }

    // Do not allow a zero model to win merely because a sparse category contains
    // many zeros, unless it is decisively better than the best positive model.
    if(winner?.candidate==='zero-baseline'){
        const positive=ranking.find(r=>r.candidate!=='zero-baseline'&&r.positiveCount>=3);
        if(positive && !(winner.selectionScore < positive.selectionScore*0.82)) winner=positive;
    }

    return {
        candidate:winner?.candidate||fallbackCandidate,
        priorCandidate:fallbackCandidate,
        reason:winner?.candidate===fallbackCandidate?'category-prior-confirmed':'category-challenger',
        validationCount:state.validationCount,
        validationWape:winner?.wape??null,
        validationBudgetWape:winner?.budgetWape??null,
        validationBias:winner?.bias??null,
        monthValidationCount:0,
        monthValidationWape:null,
        baselineWape:prior?.wape??null,
        baselineScore:prior?.selectionScore??prior?.score??null,
        winnerScore:winner?.selectionScore??winner?.score??null,
        improvementPct:prior&&winner&&prior.selectionScore>0
            ? round2((prior.selectionScore-winner.selectionScore)/prior.selectionScore*100)
            : 0,
        ranking:ranking.slice(0,5).map(r=>({
            candidate:r.candidate,
            wape:r.wape,
            budgetWape:r.budgetWape,
            bias:r.bias,
            count:r.count,
            score:r.selectionScore
        }))
    };
}

function updateOnlineChampionState(state, category, year, month, actual) {
    const history=state.history;
    if(history.length>=12){
        const decay=0.94;
        Object.values(state.stats).forEach(st=>{
            st.abs*=decay; st.budgetAbs*=decay; st.signed*=decay; st.actual*=decay; st.weight*=decay;
        });
        const monthBucket=state.monthStats[month];
        Object.values(monthBucket).forEach(st=>{
            st.abs*=0.90; st.budgetAbs*=0.90; st.signed*=0.90; st.actual*=0.90; st.weight*=0.90;
        });
        FLOW_FORECAST_CANDIDATES.forEach(candidate=>{
            const pred=predictForecastCandidate(candidate,history,category,year,month);
            const forecast=Math.max(0,Number(pred?.expected)||0);
            const budget=Math.max(0,Number(pred?.value)||0);
            [state.stats[candidate],monthBucket[candidate]].forEach(st=>{
                st.abs+=Math.abs(forecast-actual);
                st.budgetAbs+=Math.abs(budget-actual);
                st.signed+=forecast-actual;
                st.actual+=Math.abs(actual);
                st.weight+=1; st.count++; if(actual>0)st.positiveCount++;
            });
        });
        state.validationCount++;
    }
    history.push({year,month,value:Math.max(0,Number(actual)||0)});
}

function getChampionSelection(category, year, month, historical) {
    const cutoffMs=getDataCutoffForTarget(year,month);
    const cutoffDate=new Date(cutoffMs);
    const cutoffKey=`${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}`;
    const cacheKey=`${category}|${cutoffKey}`;
    if(flowChampionCache.has(cacheKey)) return flowChampionCache.get(cacheKey);

    const signature=getForecastIndexSignature();
    const championKey=String(category);
    const stored=flowModelState?.champions?.[championKey];
    if(stored && stored.cutoff===cutoffKey && stored.signature===signature && FLOW_FORECAST_CANDIDATES.includes(stored.candidate)){
        const restored={...stored};
        flowChampionCache.set(cacheKey,restored);
        return restored;
    }

    const stateKey=`${String(category)}|${cutoffKey}|${signature}`;
    let state=flowChampionStateCache.get(stateKey);
    if(!state){
        state=createOnlineChampionState();
        rowsChronological(historical).forEach(r=>updateOnlineChampionState(state,category,r.year,r.month,Number(r.value)||0));
        flowChampionStateCache.set(stateKey,state);
    }

    const selection=selectOnlineChampion(state,category);
    flowChampionCache.set(cacheKey,selection);
    flowModelState.champions=flowModelState.champions||{};
    flowModelState.champions[championKey]={...selection,cutoff:cutoffKey,signature,updatedAt:new Date().toISOString()};
    try { localStorage.setItem('flow_model_state_v235', JSON.stringify(flowModelState)); } catch (_) {}
    return selection;
}

function getVariableForecast(category, year, month) {
    const historical=getHistoricalCategorySpend(category,year,month);
    const nonZero=historical.filter(x=>x.value>0);
    if(!nonZero.length) return {value:0,expected:0,confidence:'low',method:'no-data',patternType:'no-data',dataMonths:0,dataYears:0,seasonalYears:0,seasonalIndex:1,trendFactor:1,occurrenceProbability:0,championCandidate:'no-data'};

    const selection=getChampionSelection(category,year,month,historical);
    const result=predictForecastCandidate(selection.candidate,historical,category,year,month);
    const confidence=selection.validationCount>=18&&selection.validationWape!==null&&selection.validationWape<45?'high':selection.validationCount>=10?'medium':result.confidence;
    return {
        ...result,
        confidence,
        method:`champion-${selection.candidate}`,
        championCandidate:selection.candidate,
        validationCount:selection.validationCount,
        validationWape:selection.validationWape,
        validationBudgetWape:selection.validationBudgetWape,
        validationBias:selection.validationBias,
        monthValidationCount:selection.monthValidationCount,
        monthValidationWape:selection.monthValidationWape,
        baselineWape:selection.baselineWape,
        challengerImprovement:selection.improvementPct,
        challengerRanking:selection.ranking
    };
}

function expensesForCategoryExcludingRecurring(year,month,category){
    return getExpenseItemsForMonth(year,month).filter(x=>x.category===category&&!x.isRecurring);
}

function getHistoricalIncomeRows(targetYear, targetMonth) {
    const index = rebuildForecastIndex();
    const cutoff = getDataCutoffForTarget(targetYear,targetMonth);
    const keys = Object.keys(index.months || {}).sort();
    const rows = [];
    if (!keys.length) return rows;
    const [startYear,startM1] = keys[0].split('-').map(Number);
    if (!Number.isFinite(startYear) || !Number.isFinite(startM1)) return rows;
    let cursor = new Date(startYear,startM1-1,1);
    while (cursor.getTime() < cutoff) {
        const year=cursor.getFullYear(), month=cursor.getMonth();
        const key=getMonthKey(year,month);
        const src = index.incomeMonths[key] || {};
        const bySub = Object.create(null);
        Object.entries(src.bySub || {}).forEach(([sub,b]) => {
            bySub[sub] = {
                total:Number(b?.total)||0,
                recurring:Number(b?.recurring)||0,
                variable:Number(b?.variable)||0
            };
        });
        rows.push({year,month,total:Number(src.total)||0,recurring:Number(src.recurring)||0,variable:Number(src.variable)||0,bySub});
        cursor = new Date(year,month+1,1);
    }
    return rows;
}

function forecastIncomeStream(series, targetMonth) {
    const rows = Array.isArray(series) ? series : [];
    if (!rows.length) return {value:0,method:'no-data',activeRatio:0,confidence:'low'};
    const firstPositive = rows.findIndex(r => Number(r.value) > 0);
    if (firstPositive < 0) return {value:0,method:'no-data',activeRatio:0,confidence:'low'};
    const active = rows.slice(firstPositive);
    const positive = active.filter(r=>Number(r.value)>0);
    if (!positive.length) return {value:0,method:'no-data',activeRatio:0,confidence:'low'};

    const activeRatio = positive.length / Math.max(active.length,1);
    const posValues = positive.map(r=>Number(r.value)||0);
    const targetSamples = active.filter(r=>r.month===targetMonth);
    const targetPositive = targetSamples.filter(r=>Number(r.value)>0);
    const sameMonthRatio = targetSamples.length ? targetPositive.length / targetSamples.length : 0;
    const sameMonthAmount = targetPositive.length ? robustBlend(targetPositive.map(r=>Number(r.value)||0),0.45) : 0;

    if (activeRatio >= 0.65 && positive.length >= 4) {
        const recentPositive = positive.slice(-6);
        const last3 = recentPositive.slice(-3).map(r=>Number(r.value)||0);
        const last6 = recentPositive.map(r=>Number(r.value)||0);
        // Stable income is usually a step-like series (salary changes), not a value
        // that should be aggressively extrapolated. The recent median already
        // absorbs a raise, so trend is deliberately only a very small nudge.
        let level = (median(last3)||median(last6)||0) * 0.75 + (median(last6)||0) * 0.25;

        if (recentPositive.length >= 6) {
            const prev3 = recentPositive.slice(-6,-3).map(r=>Number(r.value)||0);
            const cur3 = recentPositive.slice(-3).map(r=>Number(r.value)||0);
            const prev = median(prev3)||0, cur = median(cur3)||0;
            if (prev>0 && cur>0) {
                const relativeChange = clamp((cur-prev)/prev,-0.20,0.20);
                level *= clamp(1 + relativeChange*0.12,0.975,1.025);
            }
        }
        // Same-month seasonality is intentionally weak for stable income. Large
        // annual bonuses should ideally be a separate income stream, not inflate
        // the normal monthly salary forecast.
        if (targetPositive.length >= 2 && sameMonthAmount > 0) level = level*0.92 + sameMonthAmount*0.08;
        return {value:round2(Math.max(0,level)),method:'stable-income',activeRatio:round2(activeRatio*100),sameMonthRatio:round2(sameMonthRatio*100),confidence:positive.length>=9?'high':'medium'};
    }

    const amount = sameMonthAmount > 0 ? sameMonthAmount : robustBlend(posValues.slice(-10),0.45);
    const calendarWeight = targetSamples.length >= 2 ? 0.72 : 0.35;
    const probability = clamp(sameMonthRatio*calendarWeight + activeRatio*(1-calendarWeight),0,1);

    const threshold = activeRatio < 0.25 ? 0.56 : 0.50;
    const value = probability >= threshold ? amount : 0;
    return {
        value:round2(Math.max(0,value)),
        method:activeRatio<0.25?'sparse-income':'variable-income',
        activeRatio:round2(activeRatio*100),
        sameMonthRatio:round2(sameMonthRatio*100),
        occurrenceProbability:round2(probability*100),
        confidence:targetSamples.length>=3?'medium':'low'
    };
}

function getHistoricalIncomeForecast(targetYear, targetMonth, options = {}) {
    const rows = getHistoricalIncomeRows(targetYear,targetMonth);
    if (!rows.length) return {value:0,confidence:'low',method:'income-no-data',components:[],dataMonths:0};
    const excluded = options.excludeSubs instanceof Set ? options.excludeSubs : new Set();
    const subs = new Set();
    rows.forEach(r => Object.keys(r.bySub || {}).forEach(sub => subs.add(sub)));

    const components = [];
    let value = 0;
    subs.forEach(sub => {
        if (excluded.has(normalizeIncomeSub(sub))) return;
        const series = rows.map(r=>({year:r.year,month:r.month,value:Number(r.bySub?.[sub]?.total)||0}));
        const forecast = forecastIncomeStream(series,targetMonth);
        value += Number(forecast.value)||0;
        components.push({sub,value:round2(forecast.value),method:forecast.method,activeRatio:forecast.activeRatio,sameMonthRatio:forecast.sameMonthRatio,occurrenceProbability:forecast.occurrenceProbability,confidence:forecast.confidence});
    });
    const high = components.filter(c=>c.confidence==='high').length;
    const confidence = components.length && high/components.length>=0.5 ? 'high' : rows.length>=9 ? 'medium' : 'low';
    return {value:round2(value),confidence,method:'income-stream-meta',components,dataMonths:rows.length};
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
            const variableActual = getIndexedCategoryValue(year, month, cat.id, 'variableExpense');
            const recurringActual = getIndexedCategoryValue(year, month, cat.id, 'recurringExpense');
            const recurringAmount = recurring.filter(p => p.category === cat.id && p.type === 'expense').reduce((s,p) => s + getPlanMonthlyAmount(p,year,month), 0);
            // Closed months are already known. Using actuals here avoids expensive and
            // conceptually unnecessary re-forecasting of history every time Annual Plan opens.
            const variable = closed
                ? {value:variableActual,expected:variableActual,confidence:'actual',method:'actual-closed',dataMonths:0}
                : getVariableForecast(cat.id, year, month);
            const override = getBudgetOverride(cat.id, year, month);
            const base = Math.max(recurringAmount, 0) + Math.max(variable.value, 0);
            const budget = override ? Number(override.amount) || 0 : (closed ? round2(actual) : round2(base));
            const now = new Date();
            const isCurrent = year === now.getFullYear() && month === now.getMonth();
            let forecast = actual;
            if (!closed) {
                const remainingVariable = Math.max(0, (variable.expected ?? variable.value) - variableActual);
                const remainingRecurring = Math.max(0, recurringAmount - recurringActual);
                forecast = round2(actual + remainingVariable + remainingRecurring);
                if (!isCurrent) forecast = round2(base);
            }
            return { category: cat.id, icon: cat.icon || 'circle', actual, recurring: closed?recurringActual:recurringAmount, variable: variable.value, expected: variable.expected ?? variable.value, budget, forecast, confidence: variable.confidence, method: variable.method, dataMonths: variable.dataMonths, overridden: Boolean(override) };
        });

        const eventExpense = events.filter(e => e.type === 'expense').reduce((s,e) => s + Math.abs(Number(e.amount) || 0), 0);
        const eventIncome = events.filter(e => e.type === 'income').reduce((s,e) => s + Math.abs(Number(e.amount) || 0), 0);
        const recurringExpense = recurring.filter(p => p.type === 'expense').reduce((s,p) => s + getPlanMonthlyAmount(p,year,month), 0);
        const incomePlans = recurring.filter(p => p.type === 'income');
        const recurringIncome = incomePlans.reduce((s,p) => s + getPlanMonthlyAmount(p,year,month), 0);
        const coveredIncomeSubs = new Set(incomePlans.map(p=>normalizeIncomeSub(p.sub || 'Vyplata')));
        const variableBudget = categoryRows.reduce((s,r) => s + Math.max(0, r.budget - r.recurring), 0);
        const budget = closed ? round2(actualExpenses) : round2(recurringExpense + variableBudget + eventExpense);
        const forecast = closed ? actualExpenses : round2(categoryRows.reduce((s,r) => s + r.forecast, 0) + eventExpense);

        // Explicit recurring income plans replace the historical model for the same
        // income stream. This prevents a salary from being counted once in history
        // and a second time as a recurring plan.
        const incomeForecast = getHistoricalIncomeForecast(year, month, {excludeSubs:coveredIncomeSubs});
        let plannedIncome = actualIncome;
        if (!closed) {
            const isCurrentMonth = month === new Date().getMonth() && year === new Date().getFullYear();
            if (isCurrentMonth) {
                let coveredActual = 0;
                incomePlans.forEach(p => { coveredActual += getIndexedIncomeBySub(year,month,p.sub || 'Vyplata'); });
                const nonCoveredActual = getIndexedIncomeExcludingSubs(year,month,coveredIncomeSubs);
                const remainingRecurringIncome = Math.max(0, recurringIncome - coveredActual);
                const remainingModeledIncome = Math.max(0, incomeForecast.value - nonCoveredActual);
                plannedIncome = round2(actualIncome + remainingRecurringIncome + remainingModeledIncome + eventIncome);
            } else {
                plannedIncome = round2(recurringIncome + incomeForecast.value + eventIncome);
            }
        }
        const plannedBalance = round2(plannedIncome - forecast);

        result.push({ key, year, month, monthName: MONTH_NAMES_SK[month], isCurrent, closed, actualExpenses, actualIncome, recurringExpense, recurringIncome, variableBudget, eventExpense, eventIncome, budget, forecast, plannedIncome, plannedBalance, incomeForecast, categoryRows, events, recurring });
    }
    return result;
}

function isIncomeArchiveRow(row) {
    return String(row?.category || '') === '__INCOME__';
}

function getUniqueEvaluatedBacktestRows() {
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

function getEvaluatedBacktestRows() {
    // Expense accuracy remains comparable with previous model versions.
    return getUniqueEvaluatedBacktestRows().filter(row=>!isIncomeArchiveRow(row));
}

function getEvaluatedIncomeBacktestRows() {
    return getUniqueEvaluatedBacktestRows().filter(isIncomeArchiveRow);
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
    const incomeRows = getEvaluatedIncomeBacktestRows();
    const overall = summarizeForecastRows(rows);
    const incomeOverall = summarizeForecastRows(incomeRows);
    const byCategory = groupForecastDiagnostics(rows, r => String(r.category || ''), key => key)
        .filter(x => x.count >= 2)
        .sort((a,b) => b.wape - a.wape);
    const byMonth = groupForecastDiagnostics(rows, r => Number(String(r.targetMonth || '').slice(5,7)), key => MONTH_NAMES_SK[Math.max(0, Number(key)-1)] || String(key))
        .sort((a,b) => b.wape - a.wape);
    const byYear = groupForecastDiagnostics(rows, r => String(r.targetMonth || '').slice(0,4), key => String(key))
        .map(x => ({...x, reliable:x.count >= 24}))
        .sort((a,b) => Number(a.key) - Number(b.key));
    const byMethod = groupForecastDiagnostics(rows, r => String(r.method || 'unknown'), key => {
        const labels = {
            'champion-legacy-adaptive':'Champion · pôvodný adaptívny',
            'champion-recent-robust':'Champion · recent robust',
            'champion-multi-year-trend':'Champion · multi-year trend',
            'champion-same-month':'Champion · rovnaký mesiac',
            'champion-seasonal-window':'Champion · sezónne okno ±1 mesiac',
            'champion-last-year':'Champion · minulý rok',
            'champion-seasonal-index':'Champion · sezónny index',
            'champion-event-calendar':'Champion · kalendár udalostí',
            'champion-zero-baseline':'Champion · nulový baseline',
            'dense-seasonal-trend':'Stabilné / husté',
            'variable-multiyear':'Variabilné',
            'sparse-seasonal-hurdle':'Riedke sezónne',
            'intermittent-hazard':'Nepravidelné / intervalové',
            'no-data':'Bez dát'
        };
        return labels[key] || key;
    }).filter(x => x.count >= 3).sort((a,b)=>a.wape-b.wape);
    const byStructure = groupForecastDiagnostics(rows, r => {
        const forecast = Math.abs(Number(r.forecastAmount) || 0);
        const recurring = Math.abs(Number(r.recurringBaseline) || 0);
        const ratio = forecast > 0 ? recurring / forecast : 0;
        if (ratio >= 0.70) return 'recurring';
        if (ratio <= 0.15) return 'variable';
        return 'mixed';
    }, key => ({recurring:'Prevažne pravidelné', variable:'Prevažne variabilné', mixed:'Zmiešané'}[key] || key));
    return { overall, incomeOverall, byCategory, byMonth, byYear, byMethod, byStructure, rows, incomeRows };
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
    return rows.slice(0, limit).map(r => {
        const lowSample = r.reliable === false;
        return `<div class="forecast-diagnostic-row"><span>${escPlanning(r.label)}</span><b>${lowSample ? 'málo dát' : r.wape + '%'}</b><small>${r.count} vzoriek · MAE ${formatCurrency(r.mae)}</small></div>`;
    }).join('') || '<div class="planning-muted">Zatiaľ nie je dosť dát.</div>';
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
      <div class="forecast-diagnostic-section"><h4>Predikcia príjmov</h4>
        <div class="forecast-diagnostic-summary">
          <div><span>Income WAPE</span><b>${d.incomeOverall.count ? d.incomeOverall.wape + '%' : '—'}</b><small>${d.incomeOverall.count ? forecastQualityLabel(d.incomeOverall.wape) : 'Vyhodnoť históriu'}</small></div>
          <div><span>Income MAE</span><b>${d.incomeOverall.count ? formatCurrency(d.incomeOverall.mae) : '—'}</b><small>${d.incomeOverall.count} mesačných backtestov</small></div>
          <div><span>Income Bias</span><b>${d.incomeOverall.count ? formatCurrency(d.incomeOverall.bias) : '—'}</b><small>${d.incomeOverall.bias > 0 ? 'Príjem skôr nadhodnocuje' : d.incomeOverall.bias < 0 ? 'Príjem skôr podhodnocuje' : 'Bez biasu'}</small></div>
          <div><span>Income Accuracy</span><b>${d.incomeOverall.count ? Math.max(0,100-d.incomeOverall.wape).toFixed(1)+'%' : '—'}</b><small>Orientačne 100 − WAPE</small></div>
        </div>
        <div class="planning-helper">Príjem sa vyhodnocuje samostatne od výdavkov. Stabilné zdroje (napr. výplata) sa modelujú robustným trendom, nepravidelné príjmy podľa pravdepodobnosti a sezónnosti. Pravidelný príjem z plánu nahrádza rovnaký historický stream, aby sa nezapočítal dvakrát.</div>
      </div>
      <div class="forecast-diagnostic-section"><h4>Najväčší priestor na zlepšenie</h4>${diagnosticRowsHtml(worstCategories)}</div>
      <div class="forecast-diagnostic-section"><h4>Najpresnejšie kategórie</h4>${diagnosticRowsHtml(bestCategories)}</div>
      <div class="forecast-diagnostic-section"><h4>Najťažšie mesiace</h4>${diagnosticRowsHtml(worstMonths)}</div>
      <div class="forecast-diagnostic-section"><h4>Presnosť podľa typu výdavkov</h4>${diagnosticRowsHtml(d.byStructure)}</div>
      <div class="forecast-diagnostic-section"><h4>Presnosť podľa použitého modelu</h4>${diagnosticRowsHtml(d.byMethod)}</div>
      <div class="forecast-diagnostic-section"><h4>Vývoj podľa rokov</h4>${diagnosticRowsHtml(d.byYear, 20)}</div>
      <div class="forecast-diagnostic-section"><h4>Ako čítať metriky</h4><div class="planning-helper"><b>WAPE</b> = celková percentuálna chyba vzhľadom na objem skutočných výdavkov. Čím menej, tým lepšie.<br><b>MAE</b> = priemerná absolútna chyba jednej predikcie v eurách.<br><b>Bias</b> = smer chyby. Záporný znamená, že model skôr podhodnocuje; kladný, že skôr nadhodnocuje.</div></div>
      <div class="planning-helper">Diagnostika používa iba unikátne walk-forward backtesty. Výdavkový model má stabilného championa pre každú kategóriu; challenger ho nahradí iba pri jasnom zlepšení na vlastnej historickej validácii kategórie. Príjmový model je nezmenený a backtestuje sa samostatne. Roky s menej než 24 výdavkovými vzorkami sú označené ako „málo dát“.</div>`;
    showPlanningModal('Diagnostika forecastu', `Model ${FLOW_MODEL_VERSION}`, body);
}

function getHistoricalRecurringBaseline(category,targetYear,targetMonth){
    const historical=getHistoricalCategorySpend(category,targetYear,targetMonth);
    const values=historical.map(r=>getIndexedCategoryValue(r.year,r.month,category,'recurringExpense')).filter(v=>v>0);
    return values.length?median(values):0;
}

async function buildForecastArchiveBackfill(onProgress = null) {
    // Linear category-champion walk-forward backtest. Each category keeps one
    // online validation state and one stable champion. This preserves strict
    // no-leakage while avoiding month-level model switching/overfitting.
    const now = new Date();
    const historicalYears = getHistoricalDataYears();
    const startYear = historicalYears.length ? Math.min(...historicalYears) : now.getFullYear();
    const rows = [];
    const expenseCategories = categories.filter(c => c.id !== 'Prijem');
    const existing = new Set(flowForecastArchive.filter(r => String(r.backtest || '') === 'walk-forward').map(r => `${r.targetMonth}|${r.category}|${r.modelVersion}`));
    const periods=[];
    for(let y=startYear;y<=now.getFullYear();y++){
        for(let m=0;m<12;m++){
            if(new Date(y,m,1) >= new Date(now.getFullYear(),now.getMonth()+1,1)) continue;
            periods.push([y,m]);
        }
    }
    const onlineStates=new Map(expenseCategories.map(cat=>[String(cat.id),createOnlineChampionState()]));

    let done=0;
    for (const [y,m] of periods) {
        const keyMonth = getMonthKey(y,m);
        for (const cat of expenseCategories) {
            const state=onlineStates.get(String(cat.id));
            const selection=selectOnlineChampion(state,cat.id);
            const basePrediction=predictForecastCandidate(selection.candidate,state.history,cat.id,y,m);
            const variable={
                ...basePrediction,
                method:`champion-${selection.candidate}`,
                championCandidate:selection.candidate,
                validationCount:selection.validationCount,
                validationWape:selection.validationWape,
                validationBudgetWape:selection.validationBudgetWape,
                validationBias:selection.validationBias,
                monthValidationCount:selection.monthValidationCount,
                monthValidationWape:selection.monthValidationWape,
                baselineWape:selection.baselineWape,
                challengerImprovement:selection.improvementPct,
                challengerRanking:selection.ranking
            };
            const recurringBaseline = getHistoricalRecurringBaseline(cat.id, y, m);
            const forecast = round2((variable.expected ?? variable.value) + recurringBaseline);
            const budget = round2(variable.value + recurringBaseline);
            const actual = getIndexedCategoryValue(y,m,cat.id,'totalExpense');
            const actualVariable = getIndexedCategoryValue(y,m,cat.id,'variableExpense');
            const key = `${keyMonth}|${cat.id}|${FLOW_MODEL_VERSION}`;

            if (!existing.has(key) && !(actual <= 0 && forecast <= 0)) {
                rows.push({
                    id:createUid('fa'), targetMonth:keyMonth, category:cat.id,
                    forecastAmount:forecast, budgetAmount:budget, actualAmount:actual,
                    actualVariableAmount:actualVariable, recurringBaseline:round2(recurringBaseline),
                    modelVersion:FLOW_MODEL_VERSION, generatedAt:new Date(y,m,1).toISOString(),
                    dataMonths:variable.dataMonths, dataYears:variable.dataYears, seasonalYears:variable.seasonalYears,
                    confidence:variable.confidence, method:variable.method,
                    inputsJson:JSON.stringify({variableExpected:variable.expected, variableBudget:variable.value, recurringBaseline, patternType:variable.patternType, occurrenceProbability:variable.occurrenceProbability, seasonalIndex:variable.seasonalIndex, trendFactor:variable.trendFactor, championCandidate:variable.championCandidate, validationCount:variable.validationCount, validationWape:variable.validationWape, validationBudgetWape:variable.validationBudgetWape, monthValidationCount:variable.monthValidationCount, monthValidationWape:variable.monthValidationWape, baselineWape:variable.baselineWape, challengerImprovement:variable.challengerImprovement, challengerRanking:variable.challengerRanking}),
                    evaluatedAt:new Date(y,m+1,1).toISOString(), backtest:'walk-forward'
                });
            }
            // Update candidate scores only after the prediction for this month has
            // been frozen, so actual data from the target month cannot leak into it.
            updateOnlineChampionState(state,cat.id,y,m,actualVariable);
        }

        const incomeForecast = getHistoricalIncomeForecast(y,m);
        const incomeActual = getIndexedIncome(y,m);
        const incomeKey = `${keyMonth}|__INCOME__|${FLOW_MODEL_VERSION}`;
        if (!existing.has(incomeKey) && !(incomeActual <= 0 && incomeForecast.value <= 0)) {
            rows.push({
                id:createUid('fa'), targetMonth:keyMonth, category:'__INCOME__',
                forecastAmount:round2(incomeForecast.value), budgetAmount:round2(incomeForecast.value), actualAmount:round2(incomeActual),
                actualVariableAmount:round2(getIndexedIncomeVariable(y,m)), recurringBaseline:round2(getIndexedIncomeRecurring(y,m)),
                modelVersion:FLOW_MODEL_VERSION, generatedAt:new Date(y,m,1).toISOString(),
                dataMonths:incomeForecast.dataMonths||0, dataYears:0, seasonalYears:0,
                confidence:incomeForecast.confidence, method:incomeForecast.method,
                inputsJson:JSON.stringify({type:'income',components:incomeForecast.components}),
                evaluatedAt:new Date(y,m+1,1).toISOString(), backtest:'walk-forward'
            });
        }
        done++;
        if(typeof onProgress==='function') onProgress(done,periods.length,keyMonth,rows.length);
        if(done%2===0) await new Promise(resolve=>setTimeout(resolve,0));
    }
    return rows;
}

async function archiveForecastRows(rows, options = {}) {
    if (!rows.length) return { saved:0, failed:0 };
    const chunkSize = Math.max(25, Math.min(150, Number(options.chunkSize) || 100));
    rows.forEach(row => flowForecastArchive.push(row));
    planningPersist();

    let saved = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        try {
            const result = await planningPost({ action: 'archiveForecasts', rows: chunk });
            saved += Number(result?.saved) || chunk.length;
        } catch (error) {
            failed += chunk.length;
            console.warn('Forecast archive cloud save failed:', error);
        }
        if (typeof options.onProgress === 'function') {
            options.onProgress(Math.min(rows.length, i + chunk.length), rows.length, saved, failed);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { saved, failed };
}

async function archiveCurrentForecastSnapshot() {
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth(); const key=getMonthKey(y,m);
    const existing=flowForecastArchive.some(r=>r.targetMonth===key && r.modelVersion===FLOW_MODEL_VERSION && String(r.generatedAt||'').slice(0,10)===getTodayStr());
    if(existing)return;
    const plan=getAnnualPlan(y)[m]; if(!plan)return;
    const rows=plan.categoryRows.filter(r=>r.forecast>0||r.budget>0).map(r=>({
        id:createUid('fa'),targetMonth:key,category:r.category,forecastAmount:r.forecast,budgetAmount:r.budget,actualAmount:r.actual,
        modelVersion:FLOW_MODEL_VERSION,generatedAt:new Date().toISOString(),dataMonths:r.dataMonths,confidence:r.confidence,method:r.method,
        inputsJson:JSON.stringify({expected:r.expected,bufferPct:r.budget>0&&r.expected>0?round2((r.budget-r.recurring-r.expected)/r.expected*100):0,recurring:r.recurring,method:r.method}),
        evaluatedAt:''
    }));
    rows.push({
        id:createUid('fa'),targetMonth:key,category:'__INCOME__',forecastAmount:plan.plannedIncome,budgetAmount:plan.plannedIncome,actualAmount:plan.actualIncome,
        modelVersion:FLOW_MODEL_VERSION,generatedAt:new Date().toISOString(),dataMonths:0,confidence:'live',method:'income-live-plan',
        inputsJson:JSON.stringify({type:'income',plannedIncome:plan.plannedIncome,eventIncome:plan.eventIncome}),evaluatedAt:''
    });
    await archiveForecastRows(rows);
}

async function refreshArchiveEvaluations() {
    const changed=[];
    flowForecastArchive.forEach(row=>{
        const [y,m1]=String(row.targetMonth||'').split('-').map(Number);
        if(!y || !m1) return;
        const periodEnd=new Date(y,m1,1);
        if(periodEnd>new Date()) return;
        const actual=isIncomeArchiveRow(row)
            ? getIndexedIncome(y,m1-1)
            : getIndexedCategoryValue(y,m1-1,row.category,'totalExpense');
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
    const button = document.querySelector('[data-forecast-backfill-btn]');
    const originalText = button?.textContent || 'Vyhodnotiť históriu';
    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Pripravujem…';
            button.classList.add('opacity-70','cursor-wait');
        }
        showToast?.({ type:'info', title:'Vyhodnocujem históriu', text:'Pripravujem walk-forward backtest.' });
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

        await refreshArchiveEvaluations();
        const rows = await buildForecastArchiveBackfill((done,total,keyMonth,count) => {
            if (button) button.textContent = `Počítam ${done}/${total}`;
        });
        if (!rows.length) {
            showToast?.({ type:'success', title:'Vyhodnotenie histórie hotové', text:'Historický backtest je aktuálny.' });
        } else {
            if (button) button.textContent = `Ukladám 0/${rows.length}`;
            const result = await archiveForecastRows(rows, {
                chunkSize: 100,
                onProgress: (done,total) => { if (button) button.textContent = `Ukladám ${done}/${total}`; }
            });
            const suffix = result.failed ? `, ${result.failed} sa nepodarilo uložiť do cloudu` : '';
            showToast?.({ type:result.failed?'warning':'success', title:'Vyhodnotenie histórie hotové', text:`Doplnených ${rows.length} historických predikcií${suffix}.` });
        }
        renderPlanningScreens();
        setTimeout(() => openForecastDiagnostics(), 0);
    } catch (error) {
        console.error('Forecast backfill failed:', error);
        showToast?.({ type:'error', title:'Vyhodnotenie zlyhalo', text:String(error?.message || error) });
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
            button.classList.remove('opacity-70','cursor-wait');
        }
    }
}

function getPlanningSignedClass(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return 'result-positive';
    if (amount < 0) return 'result-negative';
    return 'result-neutral';
}

function getPlanningSignedSurfaceClass(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return 'result-surface-positive';
    if (amount < 0) return 'result-surface-negative';
    return 'result-surface-neutral';
}

function getPlanningSignedStatus(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return 'V pluse';
    if (amount < 0) return 'V mínuse';
    return 'Na nule';
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
        <div class="annual-hero-card balance-result-card tone-${totalBalance >= 0 ? 'good':'danger'} ${getPlanningSignedSurfaceClass(totalBalance)}"><div class="annual-label">Očakávaný zostatok</div><div class="annual-value ${getPlanningSignedClass(totalBalance)}">${formatCurrency(totalBalance)}</div><div class="balance-status ${getPlanningSignedClass(totalBalance)}"><span class="balance-status-dot"></span>${getPlanningSignedStatus(totalBalance)}</div><div class="annual-sub">Príjem mínus forecast</div></div>
      </div>
      <div class="planning-info-card"><div><strong>Model ${FLOW_MODEL_VERSION}</strong><div class="planning-muted">Výdavky používajú stabilného championa pre každú kategóriu; challenger ho nahradí iba pri jasnom zlepšení. Príjmový model zostáva nezmenený.</div></div><button type="button" onclick="runForecastBackfill()" data-forecast-backfill-btn class="planning-small-btn">Vyhodnotiť históriu</button></div>
      <button type="button" class="planning-metrics-row planning-metrics-button" onclick="openForecastDiagnostics()" title="Zobraziť diagnostiku presnosti"><span>Backtest: <b>${metrics.count}</b></span><span>Forecast WAPE: <b>${metrics.count ? metrics.wape + ' %' : '—'}</b></span><span>Budget WAPE: <b>${metrics.count ? metrics.budgetWape + ' %' : '—'}</b></span><span>MAE: <b>${metrics.count ? formatCurrency(metrics.mae) : '—'}</b></span><span>Detail ›</span></button>
      <div class="annual-month-list">
      ${months.map(m => `
        <div class="annual-month-card ${m.isCurrent ? 'current':''}">
          <div class="annual-month-top"><div><div class="annual-month-name">${m.monthName}</div><div class="planning-muted">${m.closed ? 'Uzavretý mesiac' : m.isCurrent ? 'Aktuálny mesiac' : 'Forecast'}</div></div><div class="annual-month-total">${formatCurrency(m.budget)}</div></div>
          <div class="annual-month-grid"><div><span>Forecast</span><b>${formatCurrency(m.forecast)}</b></div><div><span>Príjem</span><b>${formatCurrency(m.plannedIncome)}</b></div><div class="balance-result-cell ${getPlanningSignedSurfaceClass(m.plannedBalance)}"><span>Zostatok</span><b class="${getPlanningSignedClass(m.plannedBalance)}">${formatCurrency(m.plannedBalance)}</b></div></div>
          ${m.events.length ? `<div class="annual-event-list">${m.events.map(e=>`<div class="annual-event-chip"><span>${escPlanning(e.title)}</span><b>${e.type==='income'?'+':'−'}${formatCurrency(Math.abs(e.amount))}</b></div>`).join('')}</div>`:''}
          <div class="annual-month-actions"><button type="button" onclick="openPlanningEventModal('${m.key}')">＋ Udalosť</button><button type="button" onclick="openMonthPlanDetail('${m.key}')">Detail mesiaca</button></div>
        </div>`).join('')}
      </div>`;
}

function renderRecurringScreen() {
    const el = document.getElementById('recurring-plan-content');
    if (!el) return;
    const active = flowRecurringPlans.filter(p=>p.active);
    const now = new Date();
    const monthlyExpense = active.filter(p=>p.type!=='income').reduce((sum,p)=>sum+getPlanMonthlyAmount(p,now.getFullYear(),now.getMonth()),0);
    const monthlyIncome = active.filter(p=>p.type==='income').reduce((sum,p)=>sum+getPlanMonthlyAmount(p,now.getFullYear(),now.getMonth()),0);
    el.innerHTML = `
      <div class="annual-hero-grid">
        <div class="annual-hero-card"><div class="annual-label">Mesačné záväzky</div><div class="annual-value">${formatCurrency(monthlyExpense)}</div><div class="annual-sub">Pravidelné výdavky v aktuálnom mesiaci</div></div>
        <div class="annual-hero-card"><div class="annual-label">Pravidelné príjmy</div><div class="annual-value">${formatCurrency(monthlyIncome)}</div><div class="annual-sub">Známe príjmy podľa aktívnych plánov</div></div>
      </div>
      <div class="planning-section-head"><div><div class="budget-section-label">Plány</div><h3 class="budget-section-title">Pravidelné platby a príjmy</h3></div><button type="button" onclick="openRecurringPlanModal()" class="planning-primary-btn">＋ Pridať</button></div>
      <div class="recurring-list">${active.length ? active.map(renderRecurringCard).join('') : `<div class="empty-state"><div class="empty-state-title">Zatiaľ nemáš pravidelné položky</div><div class="empty-state-text">Pridaj elektrinu, poistku, výplatu alebo inú opakovanú položku.</div></div>`}</div>`;
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
    const isIncome = p.type === 'income';
    return `<div class="recurring-card"><div class="recurring-card-top"><div class="recurring-icon"><i data-lucide="${isIncome?'wallet':'repeat'}"></i></div><div class="min-w-0 flex-1"><div class="recurring-name">${escPlanning(p.name || cat)}</div><div class="planning-muted">${isIncome?'Príjem':'Výdavok'} · ${escPlanning(cat)}${p.sub ? ' / '+escPlanning(p.sub):''} · ${freq}</div></div><div class="recurring-amount ${isIncome?'text-emerald-600':''}">${isIncome?'+':''}${formatCurrency(p.amount)}</div></div><div class="recurring-meta"><span>Ďalšia podľa plánu: deň ${p.dayOfMonth || 1}.</span><span>${p.amountMode==='variable'?'Premenlivá':'Fixná'} suma</span></div><div class="annual-month-actions"><button type="button" onclick="openRecurringPlanModal('${p.id}')">Upraviť</button><button type="button" onclick="pauseRecurringPlan('${p.id}')">Pozastaviť</button><button type="button" class="text-rose-600" onclick="openRecurringDeleteChoice('${p.id}')">Odstrániť</button></div></div>`;
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

function recurringCategoryOptions(type, selected) {
    const list = type==='income' ? categories.filter(c=>c.id==='Prijem') : categories.filter(c=>c.id!=='Prijem');
    return list.map(c=>`<option value="${escPlanning(c.id)}" ${String(selected)===String(c.id)?'selected':''}>${escPlanning(c.id)}</option>`).join('');
}

function recurringSubOptions(category, selected, type='expense') {
    const cat = categories.find(c=>String(c.id)===String(category));
    const subs = Array.isArray(cat?.subs) ? cat.subs : [];
    const chosen = selected || (type==='income' ? (subs[0] || 'Vyplata') : '');
    return [`<option value="" ${chosen?'':'selected'}>Bez podkategórie</option>`]
        .concat(subs.map(sub=>`<option value="${escPlanning(sub)}" ${String(chosen)===String(sub)?'selected':''}>${escPlanning(sub)}</option>`)).join('');
}

function refreshRecurringPlanFormFields() {
    const typeEl=document.getElementById('rp-type');
    const catEl=document.getElementById('rp-category');
    const subEl=document.getElementById('rp-sub');
    if(!typeEl||!catEl||!subEl)return;
    const type=typeEl.value;
    const previousCat=catEl.value;
    const previousSub=subEl.value;
    const allowed = type==='income' ? categories.filter(c=>c.id==='Prijem') : categories.filter(c=>c.id!=='Prijem');
    const nextCat = allowed.some(c=>String(c.id)===String(previousCat)) ? previousCat : (allowed[0]?.id || '');
    catEl.innerHTML=recurringCategoryOptions(type,nextCat);
    catEl.value=nextCat;
    subEl.innerHTML=recurringSubOptions(nextCat, type==='income' ? (previousSub || 'Vyplata') : previousSub, type);
}

function refreshRecurringSubField() {
    const type=document.getElementById('rp-type')?.value || 'expense';
    const cat=document.getElementById('rp-category')?.value || '';
    const subEl=document.getElementById('rp-sub');
    if(!subEl)return;
    const previous=subEl.value;
    subEl.innerHTML=recurringSubOptions(cat,previous,type);
}

function openRecurringPlanModal(id=null) {
    const p = id ? flowRecurringPlans.find(x=>String(x.id)===String(id)) : null;
    const type = p?.type || 'expense';
    const defaultCategory = type==='income' ? 'Prijem' : (p?.category || categories.find(c=>c.id!=='Prijem')?.id || '');
    showPlanningModal(p ? 'Upraviť pravidelnú položku' : 'Nová pravidelná položka', 'Pravidelné', `
      <form id="recurring-plan-form" class="space-y-4" onsubmit="submitRecurringPlanForm(event, '${p?.id || ''}')">
        <div><label class="planning-form-label">Názov</label><input id="rp-name" required class="planning-form-input" value="${escPlanning(p?.name || '')}" placeholder="${type==='income'?'Výplata':'Elektrina'}"></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="planning-form-label">Typ</label><select id="rp-type" class="planning-form-input" onchange="refreshRecurringPlanFormFields()"><option value="expense" ${type==='expense'?'selected':''}>Výdavok</option><option value="income" ${type==='income'?'selected':''}>Príjem</option></select></div><div><label class="planning-form-label">Suma</label><input id="rp-amount" required type="number" min="0" step="0.01" class="planning-form-input" value="${p?.amount ?? ''}"></div></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="planning-form-label">Deň</label><input id="rp-day" required type="number" min="1" max="31" class="planning-form-input" value="${p?.dayOfMonth || 1}"></div><div><label class="planning-form-label">Frekvencia</label><select id="rp-frequency" class="planning-form-input"><option value="monthly" ${p?.frequency==='monthly'?'selected':''}>Mesačne</option><option value="quarterly" ${p?.frequency==='quarterly'?'selected':''}>Štvrťročne</option><option value="yearly" ${p?.frequency==='yearly'?'selected':''}>Ročne</option><option value="weekly" ${p?.frequency==='weekly'?'selected':''}>Týždenne</option></select></div></div>
        <div><label class="planning-form-label">Typ sumy</label><select id="rp-mode" class="planning-form-input"><option value="fixed" ${p?.amountMode!=='variable'?'selected':''}>Fixná</option><option value="variable" ${p?.amountMode==='variable'?'selected':''}>Premenlivá</option></select></div>
        <div><label class="planning-form-label">Kategória</label><select id="rp-category" class="planning-form-input" onchange="refreshRecurringSubField()">${recurringCategoryOptions(type,defaultCategory)}</select></div>
        <div><label class="planning-form-label">Podkategória / zdroj</label><select id="rp-sub" class="planning-form-input">${recurringSubOptions(defaultCategory,p?.sub || '',type)}</select></div>
        <div><label class="planning-form-label">Začiatok</label><input id="rp-start" required type="date" class="planning-form-input" value="${p?.startDate || getTodayStr()}"></div>
        <div class="planning-helper">${type==='income'?'Pravidelný príjem má pri predikcii prednosť pred historickým odhadom rovnakého zdroja, takže sa výplata nezapočíta dvakrát.':'Pravidelná platba je plán. Jednotlivé transakcie sa z neho vytvárajú samostatne.'} Automatické transakcie sa generujú maximálne 12 mesiacov dopredu.</div>
        <button class="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase">Uložiť</button>
      </form>`);
}

async function submitRecurringPlanForm(event, id) {
    event.preventDefault();
    const old = id ? flowRecurringPlans.find(x=>String(x.id)===String(id)) : null;
    const category=document.getElementById('rp-category').value;
    const updated = {
        ...(old || {}), id:id || createUid('rp'),
        name:document.getElementById('rp-name').value.trim(),
        amount:Number(document.getElementById('rp-amount').value)||0,
        dayOfMonth:Number(document.getElementById('rp-day').value)||1,
        frequency:document.getElementById('rp-frequency').value,
        amountMode:document.getElementById('rp-mode').value,
        category,
        categoryId:getCategoryUidByName(category),
        sub:document.getElementById('rp-sub').value || '',
        startDate:document.getElementById('rp-start').value,
        active:true,
        type:document.getElementById('rp-type').value,
        version:(Number(old?.version)||0)+1
    };
    if (old && (Number(old.amount)!==updated.amount || old.frequency!==updated.frequency || old.dayOfMonth!==updated.dayOfMonth || old.type!==updated.type || old.category!==updated.category || (old.sub||'')!==(updated.sub||''))) {
        showRecurringChangeChoice(old, updated);
        return;
    }
    await savePlanningEntity('recurring', updated);
    closePlanningModal();
}

function showRecurringChangeChoice(oldPlan, newPlan) {
    const body=document.getElementById('planning-modal-body');
    body.innerHTML=`<div class="space-y-3"><div class="planning-change-summary"><b>${escPlanning(oldPlan.name)}</b><span>${formatCurrency(oldPlan.amount)} → ${formatCurrency(newPlan.amount)}</span></div><div class="planning-muted">Ako zmeníš pravidelnú položku, Flow môže zmenu použiť iba na plán alebo aj na už vytvorené transakcie.</div><button type="button" class="planning-choice-btn" onclick="applyRecurringChange('${oldPlan.id}','future')"><b>Táto a všetky budúce</b><span>Od dneška sa budúce plánované položky prepočítajú.</span></button><button type="button" class="planning-choice-btn" onclick="applyRecurringChange('${oldPlan.id}','all')"><b>Aj historické</b><span>Prepíše aj existujúce transakcie. Použi len ak história nemá zostať pôvodná.</span></button><button type="button" class="planning-choice-btn" onclick="applyRecurringChange('${oldPlan.id}','plan')"><b>Iba pravidelný plán</b><span>Existujúce transakcie sa nemenia.</span></button></div>`;
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
        tx.amount=newPlan.amount; tx.frequency=newPlan.frequency; tx.category=newPlan.category; tx.categoryId=newPlan.categoryId; tx.sub=newPlan.sub||''; tx.type=newPlan.type||tx.type; tx.note=newPlan.name||tx.note||''; tx.recurringPlanId=newPlan.id; tx.updatedAt=new Date().toISOString(); tx.version=(Number(tx.version)||1)+1; queueMutation(tx);
    });
    saveData(false); processSyncQueue();
    window._pendingRecurringChange=null; closePlanningModal(); renderList(); renderPlanningScreens(); updateBudgetScreen?.();
    showToast?.({type:'success',title:'Pravidelná položka upravená',text:scope==='all'?'Zmenené aj historické transakcie.':scope==='future'?'Zmenené budúce transakcie.':'Zmenený iba plán.'});
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
    showPlanningModal('Odstrániť pravidelnú položku','Pravidelné',`
      <div class="space-y-3">
        <div class="planning-change-summary"><b>${escPlanning(p.name || p.category)}</b><span>${formatCurrency(p.amount)}</span></div>
        <div class="planning-muted">Vyber, čo sa má odstrániť. História sa štandardne nemení, pokiaľ to výslovne nezvolíš.</div>
        <button type="button" class="planning-choice-btn" onclick="applyRecurringDelete('${p.id}','one')"><b>Iba jedna platba</b><span>Odstráni jednu najbližšiu budúcu transakciu. Pravidlo zostane aktívne.</span></button>
        <button type="button" class="planning-choice-btn" onclick="applyRecurringDelete('${p.id}','future')"><b>Táto a všetky budúce</b><span>Odstráni budúce vygenerované položky a ukončí pravidelný plán. Minulé zostanú.</span></button>
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
    showToast?.({type:'success',title:'Pravidelná položka odstránená',text:scope==='one'?'Odstránená jedna budúca položka.':scope==='future'?'Odstránené budúce položky a plán bol ukončený.':'Odstránené všetky položky a plán.'});
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
    showPlanningModal(`${plan.monthName} ${year}`,'Detail mesiaca',`<div class="space-y-4"><div class="planning-detail-grid"><div><span>Budget</span><b>${formatCurrency(plan.budget)}</b></div><div><span>Forecast</span><b>${formatCurrency(plan.forecast)}</b></div><div><span>Príjem</span><b>${formatCurrency(plan.plannedIncome)}</b></div></div><div class="planning-helper"><b>Príjem:</b> známe pravidelné ${formatCurrency(plan.recurringIncome||0)} · historický model ${formatCurrency(plan.incomeForecast?.value||0)} · plánované udalosti ${formatCurrency(plan.eventIncome||0)}. Pri aktuálnom mesiaci Flow odpočíta príjmy, ktoré už eviduje.</div><div class="space-y-2">${plan.categoryRows.filter(r=>r.budget>0).sort((a,b)=>b.budget-a.budget).map(r=>`<div class="planning-category-row"><div><b>${escPlanning(r.category)}</b><small>${r.overridden?'Ručná úprava':'Model'} · forecast ${formatCurrency(r.forecast)}</small></div><strong>${formatCurrency(r.budget)}</strong><button type="button" onclick="openBudgetOverrideModal('${key}','${escPlanning(r.category)}',${r.budget})" class="planning-edit-icon"><i data-lucide="pencil"></i></button></div>`).join('')}</div></div>`);
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

