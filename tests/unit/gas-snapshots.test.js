'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas, sheetsMidnight } = require('../gas-harness');

const OLD = 'Flowapp-Google-Apps-Script-v2.51.0.gs';
const archiveRow = (id, targetMonth, extra = {}) => ({ id, targetMonth, category: 'Strava', forecastAmount: 100, budgetAmount: 110, actualAmount: 0, modelVersion: 'M1', generatedAt: '2026-09-15T10:00:00.000Z', ...extra });
const snapshot = (monthKey, extra = {}) => ({
    version: 1, monthKey, source: 'snapshot', modelVersion: 'M1', createdAt: '2026-10-01T08:00:00.000Z',
    total: { budget: 1000, forecast: 950, actual: 970, budgetDelta: 30, forecastDelta: -20 },
    categories: [{ category: 'Strava', budget: 500, forecast: 480, actual: 490, budgetDelta: 10, forecastDelta: -10 }],
    income: { plan: 2000, forecast: 2000, actual: 2100, planDelta: -100, forecastDelta: -100 },
    ...extra
});

test('normalizeMonthKey_: text, dátum z hárku aj ISO časová značka dajú YYYY-MM', () => {
    const gas = createGas();
    assert.equal(gas.run('normalizeMonthKey_("2026-09")'), '2026-09');
    assert.equal(gas.run('normalizeMonthKey_("2026-09-15")'), '2026-09');
    assert.equal(gas.run('normalizeMonthKey_("2015-06-30T22:00:00.000Z")'), '2015-07'); // 1. 7. 2015 00:00 v Bratislave
    assert.equal(gas.run('normalizeMonthKey_("2015-10-31T23:00:00.000Z")'), '2015-11'); // zimný čas
    gas.ctx.__d = sheetsMidnight(2026, 9);
    assert.equal(gas.run('normalizeMonthKey_(__d)'), '2026-09');
    assert.equal(gas.run('normalizeMonthKey_("")'), '');
});

test('regresia: starý script (2.51.0) vráti mesiac z archívu ako ISO časovú značku, nový ako YYYY-MM', () => {
    const rows = [archiveRow('fa1', '2026-09')];
    const oldGas = createGas(OLD);
    oldGas.post({ action: 'archiveForecasts', rows });
    const oldMonth = oldGas.get({ get: 'planning', archiveModel: 'M1' }).archive[0].targetMonth;
    assert.notEqual(oldMonth, '2026-09', `starý script vrátil ${oldMonth}`);
    assert.match(String(oldMonth), /T\d\d:00:00/);

    const newGas = createGas();
    newGas.post({ action: 'archiveForecasts', rows });
    assert.equal(newGas.get({ get: 'planning', archiveModel: 'M1' }).archive[0].targetMonth, '2026-09');
    assert.equal(newGas.sheets.FlowForecastArchive.rows[1][1], '2026-09', 'v bunke musí ostať text');
});

test('už poškodený archív (dátumy aj ISO text ako na screenshote) sa číta správne a dá sa opraviť', () => {
    const gas = createGas();
    gas.post({ action: 'archiveForecasts', rows: [archiveRow('fa0', '2026-01')] }); // vytvorí hárok a hlavičku
    const sheet = gas.sheets.FlowForecastArchive;
    const headers = sheet.rows[0];
    const blank = id => Object.assign(headers.map(() => ''), { 0: id, 2: 'Strava', 3: 100, 4: 110, 6: 'M1' });
    const dateCell = blank('fa_date'); dateCell[1] = sheetsMidnight(2015, 7);          // dátumová bunka (zarovnaná doprava)
    const isoText = blank('fa_iso'); isoText[1] = '2015-06-30T22:00:00.000Z';           // ISO text (zarovnaný doľava)
    const plain = blank('fa_plain'); plain[1] = '2015-07';
    sheet.rows.push(dateCell, isoText, plain);

    const months = gas.get({ get: 'planning', archiveModel: 'M1' }).archive.map(r => r.targetMonth);
    assert.deepEqual(months.slice(1), ['2015-07', '2015-07', '2015-07']);

    const result = gas.run('repairForecastArchiveMonths()');
    assert.equal(result.repaired, 2);
    sheet.rows.slice(1).forEach(r => assert.equal(typeof r[1], 'string'));
    assert.deepEqual(sheet.rows.slice(2).map(r => r[1]), ['2015-07', '2015-07', '2015-07']);
});

test('savePlanSnapshots: uloží, druhýkrát už nič neprepíše (nemennosť)', () => {
    const gas = createGas();
    const first = gas.post({ action: 'savePlanSnapshots', items: [snapshot('2026-09')] });
    assert.equal(first.results[0].status, 'saved');

    const changed = snapshot('2026-09', { total: { budget: 1, forecast: 1, actual: 1, budgetDelta: 0, forecastDelta: 0 } });
    const second = gas.post({ action: 'savePlanSnapshots', items: [changed] });
    assert.equal(second.results[0].status, 'already_saved');
    assert.equal(second.results[0].snapshot.total.actual, 970, 'pôvodná snímka ostáva');
    assert.equal(gas.sheets.FlowMonthSnapshots.getLastRow(), 2, 'iba hlavička + 1 riadok');
});

test('savePlanSnapshots: spätne dopočítaná sa smie nahradiť snímkou z mesiaca, opačne nie', () => {
    const gas = createGas();
    gas.post({ action: 'savePlanSnapshots', items: [snapshot('2026-08', { source: 'backtest' })] });
    const up = gas.post({ action: 'savePlanSnapshots', items: [snapshot('2026-08', { source: 'snapshot', total: { budget: 5, forecast: 6, actual: 7, budgetDelta: -2, forecastDelta: -1 } })] });
    assert.equal(up.results[0].status, 'upgraded');
    assert.equal(up.results[0].snapshot.source, 'snapshot');
    const down = gas.post({ action: 'savePlanSnapshots', items: [snapshot('2026-08', { source: 'backtest' })] });
    assert.equal(down.results[0].status, 'already_saved');
    assert.equal(down.results[0].snapshot.total.actual, 7);
});

test('snímky sa vrátia cez planning aj po konverzii Sheets na dátum; kľúč ostáva text', () => {
    const gas = createGas();
    gas.post({ action: 'savePlanSnapshots', items: [snapshot('2026-09'), snapshot('2026-08')] });
    gas.sheets.FlowMonthSnapshots.rows.forEach((r, i) => { if (i > 0) assert.equal(typeof r[0], 'string'); });
    const out = gas.get({ get: 'planning', archiveModel: 'M1' });
    assert.deepEqual(out.snapshots.map(s => s.monthKey).sort(), ['2026-08', '2026-09']);
    const s = out.snapshots.find(x => x.monthKey === '2026-09');
    assert.equal(s.categories[0].category, 'Strava');
    assert.equal(s.income.actual, 2100);
});

test('savePlanSnapshots: neplatná položka sa odmietne a nič nezapíše', () => {
    const gas = createGas();
    const r = gas.post({ action: 'savePlanSnapshots', items: [{ monthKey: 'nie-mesiac', total: {} }, null] });
    assert.deepEqual(r.results.map(x => x.status), ['error', 'error']);
    assert.ok(!gas.sheets.FlowMonthSnapshots || gas.sheets.FlowMonthSnapshots.getLastRow() <= 1);
});

test('snímky vyžadujú platné prihlásenie (token)', () => {
    const gas = createGas();
    const res = gas.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'savePlanSnapshots', token: 'zly', items: [snapshot('2026-09')] }) } });
    assert.equal(res.status, 'error');
    assert.equal(res.code, 'unauthorized');
});
