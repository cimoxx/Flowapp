'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, NOW } = require('../helpers');

const CATS = [
    { id: 'Strava', icon: 'utensils', subs: ['Potraviny'] },
    { id: 'Doprava', icon: 'car', subs: ['Tankovanie'] },
    { id: 'Príjmy', icon: 'hand-coins', subs: ['Gastrace', 'Iné', 'Lukáš', 'Zdenka', 'VšZP'] }
];

function appWith(categories, transactions = []) {
    const app = createApp({ now: NOW });
    app.setData({ categories, transactions });
    return app;
}
const options = (app, type, selected = '') => app.run(`recurringCategoryOptions(${JSON.stringify(type)}, ${JSON.stringify(selected)})`);
const values = html => [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]);

test('pravidelný príjem ponúka kategóriu „Príjmy“ (regresia: zoznam bol prázdny)', () => {
    const app = appWith(CATS);
    assert.deepEqual(values(options(app, 'income')), ['Príjmy']);
});

test('pravidelný výdavok už nenúka kategóriu príjmov', () => {
    const app = appWith(CATS);
    assert.deepEqual(values(options(app, 'expense')), ['Strava', 'Doprava']);
});

test('názov kategórie príjmov sa pozná bez diakritiky a veľkosti písmen', () => {
    for (const name of ['Prijem', 'Príjmy', 'Príjem', 'prijmy', 'PRIJMY', 'Príjmy z práce']) {
        const app = appWith([{ id: 'Strava', icon: 'x', subs: [] }, { id: name, icon: 'x', subs: ['Výplata'] }]);
        assert.deepEqual(values(options(app, 'income')), [name], name);
        assert.deepEqual(values(options(app, 'expense')), ['Strava'], name);
    }
});

test('vlastný názov kategórie sa nájde podľa príjmových transakcií', () => {
    const tx = { id: 'ID-1', date: '2026-10-01', category: 'Peniaze', sub: 'Mzda', amount: 1000, type: 'income', note: '', processed: true, version: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
    const app = appWith([{ id: 'Strava', icon: 'x', subs: [] }, { id: 'Peniaze', icon: 'x', subs: ['Mzda'] }], [tx]);
    assert.deepEqual(values(options(app, 'income')), ['Peniaze']);
});

test('zoznam kategórií pri príjme nikdy nie je prázdny', () => {
    const app = appWith([{ id: 'Strava', icon: 'x', subs: [] }, { id: 'Doprava', icon: 'x', subs: [] }]);
    assert.deepEqual(values(options(app, 'income')), ['Strava', 'Doprava']);
});

test('uložená kategória, ktorá už v zozname nie je (stará „Prijem“), sa pri úprave nestratí', () => {
    const app = appWith(CATS);
    const html = options(app, 'income', 'Prijem');
    assert.deepEqual(values(html), ['Príjmy', 'Prijem']);
    assert.match(html, /<option value="Prijem" selected>/);
});

test('podkategórie kategórie „Príjmy“ sa ponúknu', () => {
    const app = appWith(CATS);
    assert.deepEqual(values(app.run(`recurringSubOptions('Príjmy', 'Lukáš', 'income')`)), ['', 'Gastrace', 'Iné', 'Lukáš', 'Zdenka', 'VšZP']);
    assert.match(app.run(`recurringSubOptions('Príjmy', 'Lukáš', 'income')`), /<option value="Lukáš" selected>/);
});

/** Falošný formulár: prvky s `value` a `innerHTML`. */
function fakeForm(app, { type, category, sub }) {
    const els = { 'rp-type': { value: type }, 'rp-category': { value: category, innerHTML: '' }, 'rp-sub': { value: sub, innerHTML: '' } };
    app.sandbox.document.getElementById = id => els[id] || null;
    return els;
}

test('prepnutie Výdavok → Príjem vo formulári nastaví kategóriu „Príjmy“ a jej podkategórie bez prenesenia cudzej podkategórie', () => {
    const app = appWith(CATS);
    const els = fakeForm(app, { type: 'income', category: 'Strava', sub: 'Potraviny' });
    app.run('refreshRecurringPlanFormFields()');
    assert.deepEqual(values(els['rp-category'].innerHTML), ['Príjmy']);
    assert.equal(els['rp-category'].value, 'Príjmy');
    assert.ok(values(els['rp-sub'].innerHTML).includes('Lukáš'));
    assert.doesNotMatch(els['rp-sub'].innerHTML, /Potraviny/);
});

test('prepnutie Príjem → Výdavok vráti výdavkové kategórie', () => {
    const app = appWith(CATS);
    const els = fakeForm(app, { type: 'expense', category: 'Príjmy', sub: 'Lukáš' });
    app.run('refreshRecurringPlanFormFields()');
    assert.deepEqual(values(els['rp-category'].innerHTML), ['Strava', 'Doprava']);
    assert.equal(els['rp-category'].value, 'Strava');
});

test('formulár novej pravidelnej položky typu príjem má predvolenú kategóriu „Príjmy“ a podkategórie', () => {
    const app = appWith(CATS);
    const modal = { innerHTML: '', textContent: '', classList: { add() {}, remove() {} } };
    app.sandbox.document.getElementById = id => (id.startsWith('planning-modal') ? modal : null);
    app.run(`flowRecurringPlans = [{ id: 'RP1', name: 'Výplata', type: 'income', category: 'Príjmy', sub: 'Lukáš', amount: 1500, frequency: 'monthly', dayOfMonth: 5, startDate: '2026-01-01', active: true }]`);
    app.run(`openRecurringPlanModal('RP1')`);
    const html = modal.innerHTML;
    assert.match(html, /<select id="rp-category"[^>]*><option value="Príjmy" selected>/);
    assert.match(html, /<option value="Lukáš" selected>/);
});
