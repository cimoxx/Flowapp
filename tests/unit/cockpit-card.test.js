'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appWith } = require('../helpers');

const month = app => app.run('getAnnualPlan(2026)')[9];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.02, `${msg}: ${a} vs ${b}`);

/** Vykreslí kartu Prehľad mesiaca do falošného koreňa a vráti jej HTML. */
function renderCard(app) {
    const root = { innerHTML: '' };
    const original = app.sandbox.document.getElementById;
    app.sandbox.document.getElementById = id => (id === 'financial-cockpit' ? root : original(id));
    app.run('renderFinancialCockpit()');
    return root.innerHTML;
}

test('„Z príjmu mesiaca ostáva“ = očakávaný príjem − minuté − pravidelné platby, ktoré prídu − plánované udalosti', () => {
    const plan = month(appWith({ spentFraction: 0.6 }));
    const b = plan.freeBreakdown;
    assert.ok(Number.isFinite(b.incomeLeft) && b.income > 0);
    near(b.income, plan.plannedIncome, 'príjem v rozpise je plánovaný príjem mesiaca');
    near(b.incomeLeft, b.income - b.spent - b.remainingRecurring - b.pendingEvents, 'rozpis sedí');
});

test('príjem sa nepremieta do rezervy v rozpočte: ostáva rovnaká pri inom príjme', () => {
    const base = month(appWith({ spentFraction: 0.5 })).freeToSpend;
    const app = appWith({ spentFraction: 0.5 });
    // Ručne upravený plánovaný príjem mesiaca (override s kategóriou __INCOME__).
    app.setData({
        categories: require('../helpers').CATEGORIES, transactions: app.run('db'),
        overrides: [{ id: 'ov1', monthKey: '2026-10', category: '__INCOME__', amount: 9000, version: 1, updatedAt: '2026-10-20T00:00:00.000Z', createdAt: '2026-10-20T00:00:00.000Z' }]
    });
    const plan = month(app);
    near(plan.plannedIncome, 9000, 'ručný príjem sa použil');
    near(plan.freeToSpend, base, 'rezerva v rozpočte sa nezmenila');
    assert.ok(plan.freeBreakdown.incomeLeft > 7000, 'zo zvýšeného príjmu ostáva viac');
});

test('„Z príjmu ostáva“ klesá, keď sa viac míňa', () => {
    const left = fraction => month(appWith({ spentFraction: fraction })).freeBreakdown.incomeLeft;
    assert.ok(left(0.2) > left(0.6) && left(0.6) > left(1.2));
});

test('uzavretý mesiac nemá „Z príjmu ostáva“', () => {
    const plan = appWith().run('getAnnualPlan(2026)')[8];
    assert.equal(plan.freeBreakdown, null);
});

test('karta ukazuje riadok „Z príjmu mesiaca ostáva“ aj s rozpisom', () => {
    const html = renderCard(appWith({ spentFraction: 0.5 }));
    assert.match(html, /Koľko ešte môžem minúť\?/);
    assert.match(html, /safe-spend-income/);
    assert.equal((html.match(/<span>Z príjmu mesiaca ostáva<\/span>/g) || []).length, 2, 'riadok pod číslom a výsledok v rozpise');
    assert.match(html, /Očakávaný príjem mesiaca/);
});

test('sekcia „Čo je dobré vedieť“ už v karte nie je', () => {
    const html = renderCard(appWith({ spentFraction: 0.5 }));
    assert.doesNotMatch(html, /Čo je dobré vedieť/);
    assert.doesNotMatch(html, /smart-insight/);
    assert.match(html, /Čerpanie rozpočtu/, 'ostatné časti karty ostali');
});

test('záporný zvyšok z príjmu sa vykreslí so znamienkom a označením', () => {
    const html = renderCard(appWith({ spentFraction: 3 }));
    assert.match(html, /safe-spend-income is-negative/);
});

test('nezaplatená pravidelná platba a plánovaná udalosť znižujú „Z príjmu ostáva“ o svoju sumu', () => {
    const { CATEGORIES } = require('../helpers');
    const base = appWith({ spentFraction: 0.5 });
    const transactions = base.run('db');
    const without = month(base).freeBreakdown;

    const recurring = [{ id: 'RP1', name: 'Poistenie', category: 'Doprava', sub: 'Tankovanie', amount: 100, type: 'expense', frequency: 'monthly', dayOfMonth: 28, startDate: '2026-01-01', active: true, amountMode: 'fixed' }];
    const events = [{ id: 'EV1', date: '2026-10-29', title: 'Servis', amount: 250, type: 'expense', category: 'Doprava', sub: 'Tankovanie', status: 'planned' }];
    base.setData({ categories: CATEGORIES, transactions, recurring, events });
    const withBoth = month(base).freeBreakdown;

    near(withBoth.remainingRecurring, 100, 'pravidelná platba ešte príde');
    near(withBoth.pendingEvents, 250, 'udalosť je v rozpise');
    near(without.incomeLeft - withBoth.incomeLeft, 350, 'rozdiel = 100 + 250');
    near(withBoth.incomeLeft, withBoth.income - withBoth.spent - 100 - 250, 'rozpis sedí');
});
