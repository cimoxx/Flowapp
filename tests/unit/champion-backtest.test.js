'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appWith, CATEGORIES } = require('../helpers');

test('backtest šampiónov: štruktúra výsledku a nezáporné chyby', () => {
    const r = appWith({ months: 48 }).run('runChampionBacktest()');
    assert.ok(r.categories >= 3);
    assert.ok(['champions-better', 'similar', 'simple-better'].includes(r.verdict));
    for (const row of r.rows) {
        assert.ok(row.champion >= 0 && row.months > 0);
        for (const v of Object.values(row.baselines)) assert.ok(v >= 0);
    }
    assert.ok(r.rows.every(row => row.category !== 'Príjmy'), 'príjmy sa v backteste výdavkov nehodnotia');
});

test('na stabilných dátach šampióni nie sú výrazne horší než jednoduchý model', () => {
    const r = appWith({ months: 48 }).run('runChampionBacktest()');
    assert.notEqual(r.verdict, 'simple-better', `šampión ${r.overall.champion} % vs ${JSON.stringify(r.overall.baselines)}`);
});

test('na sezónnych dátach šampión zachytí sezónnosť, ktorú jednoduchý model nevie', () => {
    const app = appWith({ months: 60, seasonal: { Darčeky: { 11: 4 } } });
    const r = app.run('runChampionBacktest()');
    const row = r.rows.find(x => x.category === 'Darčeky');
    assert.ok(row.champion < row.baselines['recent-robust'] * 0.6, `šampión ${row.champion} vs jednoduchý ${row.baselines['recent-robust']}`);
});

test('s krátkou históriou sa nič nehodnotí a výsledok je „insufficient“', () => {
    const r = appWith({ months: 14 }).run('runChampionBacktest()');
    assert.equal(r.verdict, 'insufficient');
    assert.equal(r.rows.length, 0);
});
