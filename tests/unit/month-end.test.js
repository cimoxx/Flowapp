'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appWith, NOW } = require('../helpers');

const currentMonth = app => app.run('getAnnualPlan(2026)')[9];

test('projectVariableMonthEnd: na tempe ≈ model, pod tempom nižšie, nad tempom vyššie', () => {
    const app = appWith();
    const f = (expected, actual, progress) => app.run(`projectVariableMonthEnd(${expected}, ${actual}, ${progress})`);
    const p = 0.75;
    const onPace = f(1000, 750, p), under = f(1000, 400, p), over = f(1000, 1100, p);
    assert.ok(Math.abs(onPace - 1000) < 40, `na tempe ${onPace}`);
    assert.ok(under < onPace - 100, `pod tempom ${under}`);
    assert.ok(over > onPace + 100, `nad tempom ${over}`);
});

test('projectVariableMonthEnd: nikdy pod už minuté, bez modelu sa neextrapoluje, tempo má strop 2× model', () => {
    const app = appWith();
    const f = (expected, actual, progress) => app.run(`projectVariableMonthEnd(${expected}, ${actual}, ${progress})`);
    for (const progress of [0.05, 0.3, 0.6, 1]) {
        for (const actual of [0, 100, 900, 3000]) assert.ok(f(1000, actual, progress) >= actual);
    }
    assert.equal(f(0, 250, 0.5), 250);
    assert.ok(f(300, 300, 0.1) < 300 * 1.1, 'nákup hneď na začiatku mesiaca nemá odhad nafúknuť');
    assert.ok(f(100, 1e6, 0.5) <= 1e6 * 1.0001);
});

test('projectVariableMonthEnd: rastie s doterajšími výdavkami (monotónne)', () => {
    const app = appWith();
    let prev = -Infinity;
    for (let actual = 0; actual <= 2000; actual += 100) {
        const v = app.run(`projectVariableMonthEnd(1000, ${actual}, 0.6)`);
        assert.ok(v >= prev, `pokles pri ${actual}`);
        prev = v;
    }
});

test('rezerva „koľko ešte môžem minúť“ reaguje na tempo (regresia: predtým bola vždy rovnaká)', () => {
    const free = fraction => currentMonth(appWith({ spentFraction: fraction })).freeToSpend;
    const f20 = free(0.2), f50 = free(0.5), f77 = free(0.77), f100 = free(1.0), f130 = free(1.3);
    assert.ok(f20 > f50 && f50 > f77 && f77 > f100 && f100 > f130, [f20, f50, f77, f100, f130].join(' > '));
    assert.ok(f20 > 0 && f130 < 0);
});

test('rezerva sedí s rozpisom: rozpočet − minuté − pravidelné − udalosti', () => {
    const plan = currentMonth(appWith({ spentFraction: 0.6 }));
    const b = plan.freeBreakdown;
    const expected = b.budget - b.spent - b.remainingRecurring - b.pendingEvents;
    assert.ok(Math.abs(plan.freeToSpend - expected) < 0.02, `${plan.freeToSpend} vs ${expected}`);
});

test('odhad na koniec mesiaca reaguje na tempo oboma smermi a nikdy nie je pod minutým', () => {
    const run = fraction => currentMonth(appWith({ spentFraction: fraction }));
    const low = run(0.3), onPace = run(0.77), high = run(1.3);
    // Regresia: starý odhad dopĺňal kategóriu vždy na obvyklú sumu, takže pomalšie míňanie odhad nezmenilo.
    assert.ok(low.forecast < onPace.forecast - 100, `pomalé míňanie ${low.forecast} vs na tempe ${onPace.forecast}`);
    assert.ok(high.forecast > onPace.forecast + 100, `rýchle míňanie ${high.forecast} vs na tempe ${onPace.forecast}`);
    for (const p of [low, onPace, high]) assert.ok(p.forecast >= p.actualExpenses);
});

test('na tempe vychádza odhad blízko rozpočtu (rozpočet je model + rezerva 2 až 12 %)', () => {
    const plan = currentMonth(appWith({ spentFraction: 0.77 }));
    assert.ok(Math.abs(plan.forecast - plan.budget) / plan.budget < 0.08, `${plan.forecast} vs ${plan.budget}`);
});

test('rozpätie: spodok ≤ odhad ≤ vrch a spodok nie je pod už minutým', () => {
    const plan = currentMonth(appWith({ spentFraction: 0.5 }));
    const r = plan.forecastRange;
    assert.ok(r, 'rozpätie má existovať');
    assert.ok(r.low <= plan.forecast && plan.forecast <= r.high, `${r.low} ≤ ${plan.forecast} ≤ ${r.high}`);
    assert.ok(r.low >= plan.actualExpenses);
});

test('rozpätie sa s postupom mesiaca zužuje', () => {
    const early = currentMonth(appWith({ now: new Date(2026, 9, 6, 12), spentFraction: 0.2 })).forecastRange;
    const late = currentMonth(appWith({ now: new Date(2026, 9, 28, 12), spentFraction: 0.9 })).forecastRange;
    assert.ok(early.sigma > late.sigma * 1.5, `začiatok ${early.sigma} vs koniec ${late.sigma}`);
});

test('uzavretý mesiac nemá rozpätie ani rezervu', () => {
    const app = appWith();
    const september = app.run('getAnnualPlan(2026)')[8];
    assert.equal(september.closed, true);
    assert.equal(september.forecastRange, null);
    assert.equal(september.freeToSpend, null);
});

test('plánované udalosti znižujú rezervu, ale po splnení ju neznižujú druhýkrát', () => {
    const base = appWith({ spentFraction: 0.5 });
    const without = currentMonth(base).freeToSpend;
    const event = { id: 'EV1', date: '2026-10-28', title: 'Servis', amount: 200, type: 'expense', category: 'Doprava', sub: 'Tankovanie', status: 'planned' };
    base.setData({ categories: require('../helpers').CATEGORIES, transactions: base.run('db'), events: [event] });
    const withEvent = currentMonth(base).freeToSpend;
    assert.ok(Math.abs((without - withEvent) - 200) < 0.02, `rozdiel ${without - withEvent}`);
});
