'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, buildHousehold, NOW, CATEGORIES, CONFIG } = require('../helpers');
const { createGas, connectApp, sheetsMidnight } = require('../gas-harness');

const CLOSED = '2026-09';       // september 2026 je v testovom „dnes“ (24. 10. 2026) ukončený
const TRANSACTIONS = () => buildHousehold({ now: NOW, months: 30, spentFraction: 0.5, categories: CONFIG });

/** Živé snímky odhadu počas mesiaca (to, čo robí archiveCurrentForecastSnapshot): 1. deň plán, neskôr odhad. */
function liveRows(monthKey, { generatedDays = ['2026-09-05', '2026-09-20'] } = {}) {
    const rows = [];
    generatedDays.forEach((day, d) => {
        Object.entries(CONFIG).forEach(([category, { mean }]) => rows.push({
            id: `fa_${monthKey}_${category}_${day}`, targetMonth: monthKey, category,
            budgetAmount: Math.round(mean * 1.05), forecastAmount: Math.round(mean * (d ? 1.0 : 0.97)), actualAmount: 0,
            modelVersion: 'FLOW_MODEL', generatedAt: `${day}T10:00:00.000Z`, backtest: ''
        }));
        rows.push({ id: `fa_${monthKey}_inc_${day}`, targetMonth: monthKey, category: '__INCOME__', budgetAmount: 2000, forecastAmount: d ? 2000 : 1900, actualAmount: 0, modelVersion: 'FLOW_MODEL', generatedAt: `${day}T10:00:00.000Z`, backtest: '' });
    });
    return rows;
}

/** Nová „inštancia appky“ s rovnakým cloudom. Ak sa odovzdá `storage`, je to refresh na tom istom zariadení. */
function openApp(gas, { storage = new Map(), online = () => true, transactions = TRANSACTIONS() } = {}) {
    const app = createApp({ now: NOW, storage });
    app.setData({ categories: CATEGORIES, transactions });
    connectApp(app, gas, { online });
    const version = app.run('FLOW_MODEL_VERSION');
    // modelVersion v testovacích riadkoch = skutočná verzia modelu appky
    app.liveRows = (key, opts) => liveRows(key, opts).map(r => ({ ...r, modelVersion: version }));
    return app;
}

const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))); // objekty z vm majú iný prototyp
const comparison = (app, key = CLOSED) => {
    const [y, m] = key.split('-').map(Number);
    return plain(app.run(`getAnnualPlan(${y})[${m - 1}]`).archiveComparison);
};

async function seedArchive(app, gas, key = CLOSED) {
    // Rovnako ako appka: riadky idú cez archiveForecastRows do cloudu.
    app.sandbox.__rows = app.liveRows(key);
    await app.run('archiveForecastRows(__rows)');
}

test('hlavný scenár: vytvoriť porovnanie → refresh → ostalo (aj na novom zariadení)', async () => {
    const gas = createGas();
    const storage = new Map();
    const app1 = openApp(gas, { storage });
    await app1.run('loadPlanningData()');
    await seedArchive(app1, gas);
    const result = await app1.run('ensureClosedMonthSnapshots()');
    assert.ok(result.created >= 1);

    const before = comparison(app1);
    assert.equal(before.stored, true);
    assert.equal(before.source, 'snapshot');
    assert.ok(before.forecast > 0 && before.actual > 0);

    // Refresh na tom istom zariadení: nová inštancia, rovnaký localStorage. Cloud ešte nebol načítaný.
    const app2 = openApp(gas, { storage });
    assert.deepEqual(comparison(app2), before, 'ihneď po štarte, ešte pred načítaním cloudu');
    await app2.run('loadPlanningData()');
    assert.deepEqual(comparison(app2), before, 'po načítaní cloudu');

    // Nové zariadenie: prázdne úložisko, snímka príde z Google Sheets.
    const app3 = openApp(gas);
    assert.equal(comparison(app3), null, 'pred načítaním cloudu nič nemá');
    await app3.run('loadPlanningData()');
    assert.deepEqual(comparison(app3), before);
});

test('snímka obsahuje odhad, skutočnosť a rozdiel po kategóriách aj celkovo, súčty sedia', async () => {
    const gas = createGas();
    const app = openApp(gas);
    await app.run('loadPlanningData()');
    await seedArchive(app, gas);
    await app.run('ensureClosedMonthSnapshots()');
    const snap = JSON.parse(JSON.stringify(app.run(`getStoredMonthSnapshot('${CLOSED}')`)));

    assert.ok(snap.categories.length >= 3);
    const sum = f => Math.round(snap.categories.reduce((s, c) => s + c[f], 0) * 100) / 100;
    for (const f of ['budget', 'forecast', 'actual']) assert.equal(sum(f), snap.total[f], `súčet ${f}`);
    for (const c of snap.categories) {
        assert.equal(c.forecastDelta, Math.round((c.forecast - c.actual) * 100) / 100);
        assert.equal(c.budgetDelta, Math.round((c.budget - c.actual) * 100) / 100);
    }
    assert.equal(snap.total.forecastDelta, Math.round((snap.total.forecast - snap.total.actual) * 100) / 100);
    assert.ok(snap.income && snap.income.actual > 0, 'príjem sa ukladá tiež');
    // Skutočnosť v snímke = skutočnosť z transakcií za ten mesiac.
    assert.equal(snap.total.actual, app.run(`getAnnualPlan(2026)[8].actualExpenses`));
});

test('súčty snímky sa zhodujú s doterajším výpočtom porovnania (výpočty sa nezmenili)', async () => {
    const gas = createGas();
    const app = openApp(gas);
    await app.run('loadPlanningData()');
    await seedArchive(app, gas);
    const legacy = comparison(app); // zatiaľ bez snímky = pôvodný výpočet z archívu
    assert.equal(legacy.stored, undefined);
    await app.run('ensureClosedMonthSnapshots()');
    const stored = comparison(app);
    assert.equal(stored.budget, legacy.budget);
    assert.equal(stored.forecast, legacy.forecast);
    assert.equal(stored.source, legacy.source);
});

test('uložená snímka sa už neprepočítava: neskoršia úprava transakcií ju nezmení', async () => {
    const gas = createGas();
    const app = openApp(gas);
    await app.run('loadPlanningData()');
    await seedArchive(app, gas);
    await app.run('ensureClosedMonthSnapshots()');
    const before = comparison(app);

    // Dodatočne zapísaná veľká transakcia do septembra.
    app.sandbox.__tx = { id: 'ID-LATE', date: '2026-09-12', category: 'Strava', sub: 'Potraviny', amount: 999, type: 'expense', note: '', processed: true, version: 1, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' };
    app.run('db.push(__tx); markForecastIndexDirty();');
    assert.ok(app.run(`getAnnualPlan(2026)[8].actualExpenses`) > before.actual + 900, 'živá skutočnosť sa zmenila');
    assert.deepEqual(comparison(app), before, 'snímka ostala rovnaká');
    await app.run('ensureClosedMonthSnapshots()');
    assert.deepEqual(comparison(app), before, 'ani opakovaný štart ju neprepíše');
});

test('bez siete sa snímka uloží lokálne a do cloudu sa odošle neskôr', async () => {
    const gas = createGas();
    let online = true;
    const storage = new Map();
    const app = openApp(gas, { storage, online: () => online });
    await app.run('loadPlanningData()');
    await seedArchive(app, gas);

    online = false;
    const offline = await app.run('ensureClosedMonthSnapshots()');
    assert.ok(offline.created >= 1);
    assert.ok(!gas.sheets.FlowMonthSnapshots || gas.sheets.FlowMonthSnapshots.getLastRow() <= 1, 'v cloude zatiaľ nič');
    const local = JSON.parse(storage.get('flow_month_snapshots_v254'));
    assert.ok(local.items.length >= 1 && local.items.every(x => !x.synced));

    // Refresh bez siete: snímka stále je.
    const refreshed = openApp(gas, { storage, online: () => false });
    assert.equal(comparison(refreshed).stored, true);

    // Sieť sa vráti: odošle sa.
    online = true;
    await app.run('uploadPendingMonthSnapshots()');
    assert.ok(gas.sheets.FlowMonthSnapshots.getLastRow() >= 2);
    assert.ok(JSON.parse(storage.get('flow_month_snapshots_v254')).items.every(x => x.synced));
});

test('archív poškodený Google Sheets (dátumy, ISO text) sa spáruje správne a snímka vznikne za správny mesiac', async () => {
    const gas = createGas();
    // Riadky zapísané tak, ako ich videl používateľ: časť ako dátumová bunka, časť ako ISO text.
    gas.post({ action: 'archiveForecasts', rows: [{ id: 'seed', targetMonth: '2026-01', category: 'Strava', forecastAmount: 1, budgetAmount: 1, modelVersion: 'x' }] });
    const sheet = gas.sheets.FlowForecastArchive;
    const app = openApp(gas);
    const rows = app.liveRows(CLOSED);
    const headers = sheet.rows[0];
    rows.forEach((r, i) => {
        const row = headers.map(h => (h === 'targetMonth' ? (i % 2 ? '2026-08-31T22:00:00.000Z' : sheetsMidnight(2026, 9)) : (r[h] === undefined ? '' : r[h])));
        sheet.rows.push(row);
    });
    await app.run('loadPlanningData()');
    const loaded = app.run('flowForecastArchive').filter(r => r.id.startsWith('fa_2026-09'));
    assert.ok(loaded.length > 0 && loaded.every(r => r.targetMonth === '2026-09'), 'všetky riadky patria do 2026-09');
    await app.run('ensureClosedMonthSnapshots()');
    assert.equal(comparison(app).stored, true);
    assert.equal(app.run(`getStoredMonthSnapshot('2026-09')`).monthKey, '2026-09');
});

test('klient si poradí aj so starým Apps Scriptom, ktorý vracia mesiac ako ISO časovú značku', async () => {
    const gas = createGas('Flowapp-Google-Apps-Script-v2.51.0.gs');
    const app = openApp(gas);
    gas.post({ action: 'archiveForecasts', rows: app.liveRows(CLOSED) });
    const raw = gas.get({ get: 'planning', archiveModel: app.run('FLOW_MODEL_VERSION') }).archive[0].targetMonth;
    assert.notEqual(raw, CLOSED, 'starý script naozaj vracia nesprávny formát');
    await app.run('loadPlanningData()');
    // Aj ostatné časti appky (diagnostika, prepočet histórie, vyhodnotenie) čítajú mesiac priamo z archívu.
    const months = plain(app.run('flowForecastArchive')).map(r => r.targetMonth);
    assert.ok(months.length > 0 && months.every(m => m === CLOSED), `archív po načítaní: ${[...new Set(months)]}`);
    await app.run('ensureClosedMonthSnapshots()');
    assert.equal(comparison(app).stored, true, 'snímka sa lokálne vytvorila aj bez nového scriptu');
});

test('keď sa cloud nepodarilo načítať, snímky sa nevytvárajú (aby sa nezmrazilo horšie číslo)', async () => {
    const gas = createGas();
    const app = openApp(gas, { online: () => false });
    app.sandbox.__rows = app.liveRows(CLOSED);
    app.run('flowForecastArchive = __rows');
    await app.run('loadPlanningData()');
    const r = await app.run('ensureClosedMonthSnapshots()');
    assert.equal(r.skipped, 'cloud-not-loaded');
    assert.equal(comparison(app).stored, undefined);
});

test('snímky vznikajú iba pre ukončené mesiace, aktuálny mesiac ostáva živý', async () => {
    const gas = createGas();
    const app = openApp(gas);
    await app.run('loadPlanningData()');
    await seedArchive(app, gas, '2026-10');            // aktuálny mesiac (október 2026)
    await seedArchive(app, gas, CLOSED);
    await app.run('ensureClosedMonthSnapshots()');
    assert.equal(app.run(`getStoredMonthSnapshot('2026-10')`), null);
    assert.ok(app.run(`getStoredMonthSnapshot('${CLOSED}')`));
    assert.equal(app.run('getAnnualPlan(2026)[9].archiveComparison'), null);
});

test('mesiac bez archívu odhadov sa nevymýšľa (nevznikne snímka)', async () => {
    const gas = createGas();
    const app = openApp(gas);
    await app.run('loadPlanningData()');
    await seedArchive(app, gas, CLOSED);
    await app.run('ensureClosedMonthSnapshots()');
    assert.equal(app.run(`getStoredMonthSnapshot('2026-07')`), null);
    assert.equal(comparison(app, '2026-07'), null);
});

test('prvá uložená snímka v cloude vyhráva: druhé zariadenie ju nepreskočí', async () => {
    const gas = createGas();
    const a = openApp(gas);
    await a.run('loadPlanningData()');
    await seedArchive(a, gas);
    await a.run('ensureClosedMonthSnapshots()');
    const first = comparison(a);

    // Druhé zariadenie s iným (lokálnym) stavom archívu: nemá povolené prepísať cloud.
    const b = openApp(gas);
    await b.run('loadPlanningData()');
    assert.deepEqual(comparison(b), first);
    b.run(`flowMonthSnapshots.find(x => x.monthKey === '${CLOSED}').total.forecast = 1; flowMonthSnapshots.find(x => x.monthKey === '${CLOSED}').synced = false;`);
    await b.run('uploadPendingMonthSnapshots()');
    assert.deepEqual(comparison(b), first, 'cloudová verzia sa vrátila');
    assert.equal(gas.get({ get: 'planning', archiveModel: '' }).snapshots.find(s => s.monthKey === CLOSED).total.forecast, first.forecast);
});

test('spätne dopočítaná snímka sa nahradí živou, keď sa nájde', async () => {
    const gas = createGas();
    const app = openApp(gas);
    await app.run('loadPlanningData()');
    const version = app.run('FLOW_MODEL_VERSION');
    const backtest = app.liveRows(CLOSED).map(r => ({ ...r, backtest: 'walk-forward', modelVersion: version, id: 'bt_' + r.id }));
    app.sandbox.__rows = backtest;
    await app.run('archiveForecastRows(__rows)');
    await app.run('ensureClosedMonthSnapshots()');
    assert.equal(comparison(app).source, 'backtest');

    await seedArchive(app, gas);                        // neskôr sa nájdu živé riadky
    const r = await app.run('ensureClosedMonthSnapshots()');
    assert.equal(r.upgraded, 1);
    assert.equal(comparison(app).source, 'snapshot');
    assert.equal(gas.get({ get: 'planning', archiveModel: '' }).snapshots.find(s => s.monthKey === CLOSED).source, 'snapshot');
});

test('normalizeMonthKey (klient) vráti správny mesiac v ľubovoľnej časovej zóne zariadenia', () => {
    const { createApp } = require('../helpers');
    const original = process.env.TZ;
    try {
        for (const tz of ['Europe/Bratislava', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Auckland']) {
            process.env.TZ = tz;
            const app = createApp({ now: NOW });
            const f = v => app.run(`normalizeMonthKey(${JSON.stringify(v)})`);
            assert.equal(f('2026-08-31T22:00:00.000Z'), '2026-09', `${tz}: letný čas (UTC+2)`);
            assert.equal(f('2015-10-31T23:00:00.000Z'), '2015-11', `${tz}: zimný čas (UTC+1)`);
            assert.equal(f('2026-09-01T00:00:00.000Z'), '2026-09', `${tz}: tabuľka v UTC`);
            assert.equal(f('2026-09'), '2026-09');
            assert.equal(f('2026-09-15'), '2026-09');
            assert.equal(f(''), '');
        }
    } finally {
        if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
    }
});

// --- v2.54.1: duplicitné kópie v archíve (opakovaný prepočet histórie) a už uložené chybné snímky ---

test('duplicitné kópie odhadu v archíve sa nesčítavajú (regresia: 6 kópií dalo 6× vyššie sumy)', async () => {
    const totals = {};
    for (const n of [1, 6]) {
        const gas = createGas();
        const app = openApp(gas);
        // Backtest riadky majú generatedAt = začiatok mesiaca, všetky kópie padnú do tej istej skupiny.
        const rows = [];
        for (let i = 0; i < n; i++) rows.push(...app.liveRows(CLOSED, { generatedDays: ['2026-09-01'] }).map(r => ({ ...r, backtest: 'walk-forward', id: `bt${i}_${r.id}`, generatedAt: '2026-09-01T00:00:00.000Z' })));
        gas.post({ action: 'archiveForecasts', rows });
        await app.run('loadPlanningData()');
        const legacy = comparison(app);                                  // ešte bez snímky
        await app.run('ensureClosedMonthSnapshots()');
        const stored = comparison(app);
        assert.equal(stored.budget, legacy.budget, 'snímka sa zhoduje s výpočtom z archívu');
        assert.equal(stored.forecast, legacy.forecast);
        totals[n] = { budget: stored.budget, forecast: stored.forecast };
    }
    assert.deepEqual(totals[6], totals[1], 'šesť kópií musí dať rovnaké čísla ako jedna');
});

test('z duplicitných kópií sa berie najnovšia (podľa času vzniku, potom id)', async () => {
    const gas = createGas();
    const app = openApp(gas);
    const version = app.run('FLOW_MODEL_VERSION');
    const row = (id, forecast, generatedAt) => ({ id, targetMonth: CLOSED, category: 'Strava', budgetAmount: forecast + 10, forecastAmount: forecast, modelVersion: version, generatedAt, backtest: 'walk-forward' });
    app.sandbox.__rows = [row('fa_aaa', 100, '2026-09-01T00:00:00.000Z'), row('fa_zzz', 300, '2026-09-01T00:00:00.000Z'), row('fa_mmm', 200, '2026-09-01T00:00:00.000Z')];
    app.run('flowForecastArchive = __rows; markForecastIndexDirty();');
    const snap = plain(app.run(`buildMonthSnapshot('${CLOSED}')`));
    assert.equal(snap.categories.find(c => c.category === 'Strava').forecast, 300);
});

test('už uložená chybná snímka (verzia 1, násobne vyššie sumy) sa nezobrazí a prepočíta sa; cloud sa opraví', async () => {
    const gas = createGas();
    const storage = new Map();
    const app = openApp(gas, { storage });
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push(...app.liveRows(CLOSED, { generatedDays: ['2026-09-01'] }).map(r => ({ ...r, backtest: 'walk-forward', id: `bt${i}_${r.id}`, generatedAt: '2026-09-01T00:00:00.000Z' })));
    gas.post({ action: 'archiveForecasts', rows });

    // Chybná snímka tak, ako ju uložila verzia 2.54.0: sčítané kópie, verzia 1, už odoslaná do cloudu.
    const bad = { monthKey: CLOSED, source: 'backtest', modelVersion: app.run('FLOW_MODEL_VERSION'), createdAt: '2026-10-25T08:00:00.000Z',
        total: { budget: 6366, forecast: 6060, actual: 1037.4, budgetDelta: 5328.6, forecastDelta: 5022.6 }, categories: [], income: null };
    gas.post({ action: 'savePlanSnapshots', items: [bad] });
    storage.set('flow_month_snapshots_v254', JSON.stringify({ version: 1, items: [{ ...bad, synced: true }] }));

    const restarted = openApp(gas, { storage });
    const beforeCloud = comparison(restarted);
    assert.ok(beforeCloud === null || beforeCloud.forecast < 2000, 'chybná snímka sa nesmie zobraziť');
    await restarted.run('loadPlanningData()');
    const shown = comparison(restarted);
    assert.ok(shown.forecast < 2000 && shown.budget < 2000, `zobrazené ${shown.budget} / ${shown.forecast}`);
    const result = await restarted.run('ensureClosedMonthSnapshots()');
    assert.ok(result.upgraded >= 1);

    const fixed = comparison(restarted);
    assert.ok(fixed.stored && fixed.forecast < 2000 && fixed.budget < 2000);
    const inCloud = gas.get({ get: 'planning', archiveModel: '' }).snapshots.find(s => s.monthKey === CLOSED);
    assert.equal(inCloud.version, 2, 'cloud má opravenú verziu');
    assert.ok(inCloud.total.forecast < 2000);

    // Druhé zariadenie vidí už len opravenú snímku.
    const other = openApp(gas);
    await other.run('loadPlanningData()');
    assert.deepEqual(comparison(other), comparison(restarted));
});

test('keď cloud ešte nemá nový script, lokálna opravená snímka ostane a staršia cloudová ju neprepíše', async () => {
    const gas = createGas('Flowapp-Google-Apps-Script-v2.54.0.gs');   // script bez výmeny verzie snímky
    const storage = new Map();
    const app = openApp(gas, { storage });
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push(...app.liveRows(CLOSED, { generatedDays: ['2026-09-01'] }).map(r => ({ ...r, backtest: 'walk-forward', id: `bt${i}_${r.id}`, generatedAt: '2026-09-01T00:00:00.000Z' })));
    gas.post({ action: 'archiveForecasts', rows });
    const bad = { version: 1, monthKey: CLOSED, source: 'backtest', modelVersion: app.run('FLOW_MODEL_VERSION'), createdAt: '2026-10-25T08:00:00.000Z',
        total: { budget: 6366, forecast: 6060, actual: 1037.4, budgetDelta: 5328.6, forecastDelta: 5022.6 }, categories: [], income: null };
    gas.post({ action: 'savePlanSnapshots', items: [bad] });

    await app.run('loadPlanningData()');
    await app.run('ensureClosedMonthSnapshots()');
    const local = comparison(app);
    assert.ok(local.stored && local.forecast < 2000, 'lokálne je správna hodnota');
    assert.equal(plain(app.run(`findMonthSnapshotRaw('${CLOSED}')`)).synced, false, 'čaká na nový script');
    await app.run('uploadPendingMonthSnapshots()');
    assert.deepEqual(comparison(app), local, 'staršia cloudová verzia ju neprepísala');
});
