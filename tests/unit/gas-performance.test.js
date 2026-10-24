'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas, connectApp, sheetsMidnight } = require('../gas-harness');
const { createApp, buildHousehold, NOW, CATEGORIES, CONFIG } = require('../helpers');

const row = (i, extra = {}) => ({ id: `fa_${String(i).padStart(5, '0')}`, targetMonth: `2026-0${1 + (i % 9)}`, category: `Cat${i % 12}`, forecastAmount: 100 + i, budgetAmount: 110 + i, actualAmount: 0, modelVersion: 'M', generatedAt: '2026-01-01T00:00:00.000Z', ...extra });
const seed = n => Array.from({ length: n }, (_, i) => row(i));

test('archiveForecasts: počet volaní Sheets nezávisí od počtu riadkov (regresia: 2 volania na riadok držali zámok minúty)', () => {
    const gas = createGas();
    gas.post({ action: 'archiveForecasts', rows: seed(1600) });
    gas.resetApiCalls();
    const res = gas.post({ action: 'archiveForecasts', rows: seed(1600).map(r => ({ ...r, actualAmount: 123, errorAmount: 5 })) });
    assert.equal(res.saved, 1600);
    assert.ok(gas.apiCalls() <= 10, `volaní Sheets: ${gas.apiCalls()}`);
    const sheet = gas.sheets.FlowForecastArchive;
    const headers = sheet.rows[0];
    const actual = headers.indexOf('actualAmount');
    assert.equal(sheet.getLastRow(), 1601, 'počet riadkov sa nezmenil');
    assert.ok(sheet.rows.slice(1).every(r => r[actual] === 123), 'všetky aktualizované');
});

test('archiveForecasts: aktualizácie aj nové riadky v jednej požiadavke, nedotknuté riadky ostanú', () => {
    const gas = createGas();
    gas.post({ action: 'archiveForecasts', rows: seed(50) });
    gas.resetApiCalls();
    const rows = [row(10, { forecastAmount: 999 }), row(30, { forecastAmount: 888 }), row(900), row(901)];   // 2 aktualizácie + 2 nové
    const res = gas.post({ action: 'archiveForecasts', rows });
    assert.equal(res.saved, 4);
    assert.ok(gas.apiCalls() <= 10);
    const sheet = gas.sheets.FlowForecastArchive;
    const headers = sheet.rows[0];
    const byId = id => sheet.rows.slice(1).find(r => r[0] === id);
    const f = headers.indexOf('forecastAmount');
    assert.equal(byId('fa_00010')[f], 999);
    assert.equal(byId('fa_00030')[f], 888);
    assert.equal(byId('fa_00020')[f], 120, 'riadok medzi aktualizovanými ostal');
    assert.equal(byId('fa_00000')[f], 100, 'riadok pred blokom ostal');
    assert.ok(byId('fa_00900') && byId('fa_00901'));
    assert.equal(sheet.getLastRow(), 53);
});

test('archiveForecasts: mesiac ostáva text aj v nezmenených riadkoch zapísaného bloku a poškodené sa opravia', () => {
    const gas = createGas();
    gas.post({ action: 'archiveForecasts', rows: seed(5) });
    const sheet = gas.sheets.FlowForecastArchive;
    const month = sheet.rows[0].indexOf('targetMonth');
    sheet.rows[2][month] = sheetsMidnight(2026, 3);               // dátumová bunka v strede bloku
    sheet.rows[3][month] = '2026-02-28T23:00:00.000Z';            // ISO text
    gas.post({ action: 'archiveForecasts', rows: [row(0, { actualAmount: 1 }), row(4, { actualAmount: 2 })] });   // blok pokrýva riadky 0 až 4
    sheet.rows.slice(1).forEach(r => assert.equal(typeof r[month], 'string'));
    assert.equal(sheet.rows[2][month], '2026-03');
    assert.equal(sheet.rows[3][month], '2026-03');
});

test('archiveForecasts: opakované odoslanie toho istého nič nezmení', () => {
    const gas = createGas();
    gas.post({ action: 'archiveForecasts', rows: seed(40) });
    gas.post({ action: 'archiveForecasts', rows: seed(40) });
    const before = JSON.stringify(gas.sheets.FlowForecastArchive.rows);
    gas.post({ action: 'archiveForecasts', rows: seed(40) });
    assert.equal(JSON.stringify(gas.sheets.FlowForecastArchive.rows), before);
    assert.equal(gas.sheets.FlowForecastArchive.getLastRow(), 41);
});

test('appka posiela vyhodnotenie archívu v dávkach po najviac 100 riadkoch', async () => {
    const gas = createGas();
    const app = createApp({ now: NOW });
    app.setData({ categories: CATEGORIES, transactions: buildHousehold({ now: NOW, months: 30, spentFraction: 0.5, categories: CONFIG }) });
    connectApp(app, gas);
    const inner = app.sandbox.fetch;
    const sizes = [];
    app.sandbox.fetch = async (url, init = {}) => {
        if (init.method === 'POST') { const b = JSON.parse(init.body); if (b.action === 'archiveForecasts') sizes.push(b.rows.length); }
        return inner(url, init);
    };
    const version = app.run('FLOW_MODEL_VERSION');
    // 250 riadkov archívu s nesprávnou skutočnosťou, vyhodnotenie ich všetky opraví
    const rows = Array.from({ length: 250 }, (_, i) => ({ id: `fa_x${i}`, targetMonth: `2026-0${1 + (i % 9)}`, category: ['Strava', 'Doprava', 'Domácnosť', 'Darčeky'][i % 4], forecastAmount: 100, budgetAmount: 110, actualAmount: 999999, modelVersion: version, generatedAt: '2026-01-01T00:00:00.000Z', backtest: 'walk-forward' }));
    app.sandbox.__rows = rows;
    app.run('flowForecastArchive = __rows; markForecastIndexDirty();');
    await app.run('refreshArchiveEvaluations()');
    assert.ok(sizes.length >= 3, `dávky: ${sizes}`);
    assert.ok(sizes.every(n => n <= 100), `dávky: ${sizes}`);
    assert.equal(sizes.reduce((a, b) => a + b, 0), 250);
});
