'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appWith } = require('../helpers');

/** Chyba kandidáta v % pre mesiace od 18. po posledný (každý mesiac sa odhaduje iba z predchádzajúcich). */
function candidateWape(app, candidate, category) {
    return app.run(`(() => {
        const asc = rowsChronological(getHistoricalCategorySpend(${JSON.stringify(category)}, new Date().getFullYear(), new Date().getMonth()));
        let err = 0, act = 0;
        for (let i = 18; i < asc.length; i++) {
            const t = asc[i];
            const p = Math.max(0, predictForecastCandidate(${JSON.stringify(candidate)}, asc.slice(0, i), ${JSON.stringify(category)}, t.year, t.month).expected || 0);
            err += Math.abs(p - t.value); act += t.value;
        }
        return err / act * 100;
    })()`);
}

test('na stabilných dátach sa každý kandidát (okrem nulového) mýli menej než 15 %', () => {
    const app = appWith();
    const candidates = app.run('FLOW_FORECAST_CANDIDATES').filter(c => c !== 'zero-baseline');
    for (const category of ['Strava', 'Doprava', 'Domácnosť']) {
        for (const candidate of candidates) {
            const wape = candidateWape(app, candidate, category);
            assert.ok(wape < 15, `${candidate} / ${category}: ${wape.toFixed(1)} % (očakávané < 15 %)`);
        }
    }
});

test('regresia v2.53: nepozorovaný mesiac v rozbehnutom roku sa nepočíta ako nulový výdavok', () => {
    const app = appWith();
    // Rok 2026 má pozorované mesiace jan–sep, október (cieľ) ešte nie.
    const rows = app.run(`rowsChronological(getHistoricalCategorySpend('Strava', 2026, 9))`);
    const seasonal = app.run(`getHistoricalYearSeasonalityFromRows(${JSON.stringify(rows)}, 2026, 9)`);
    assert.ok(seasonal.every(r => r.year !== 2026), 'rok 2026 nemá mať v sezónnosti pre október záznam');
    assert.ok(seasonal.length >= 2);
    assert.ok(seasonal.every(r => r.ratio > 0.7 && r.ratio < 1.3), 'pomery majú byť okolo 1: ' + seasonal.map(r => r.ratio.toFixed(2)));
});

test('sezónnosť sa zachytí: december s 4× vyššími darčekmi sa predpovedá výrazne vyššie', () => {
    const app = appWith({ seasonal: { Darčeky: { 11: 4 } }, months: 60 });
    // Odhad na december 2026 z celej dostupnej histórie.
    const dec = app.run(`predictForecastCandidate('multi-year-trend', rowsChronological(getHistoricalCategorySpend('Darčeky', 2026, 11)), 'Darčeky', 2026, 11).expected`);
    const jun = app.run(`predictForecastCandidate('multi-year-trend', rowsChronological(getHistoricalCategorySpend('Darčeky', 2026, 11)), 'Darčeky', 2026, 5).expected`);
    assert.ok(dec > jun * 2, `december ${dec} má byť aspoň 2× jún ${jun}`);
});

test('pre stabilnú kategóriu je odhad v ročnom pláne blízko obvyklej sumy', () => {
    const app = appWith();
    const plan = app.run('getAnnualPlan(2026)');
    // Budúce mesiace (nov, dec) nesmú byť stiahnuté k nule rozbehnutým rokom.
    for (const month of [10, 11]) {
        const row = plan[month].categoryRows.find(r => r.category === 'Strava');
        assert.ok(row.forecast > 420 && row.forecast < 600, `Strava ${month + 1}. mesiac: ${row.forecast}`);
    }
});
