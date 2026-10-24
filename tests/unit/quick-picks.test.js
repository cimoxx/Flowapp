'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, CATEGORIES, NOW } = require('../helpers');
const { ymd } = require('../harness');

const daysAgo = n => { const d = new Date(NOW.getTime() - n * 86400000); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); };
let seq = 0;
const tx = o => ({ id: `ID-${++seq}`, amount: 10, type: 'expense', sub: '', note: '', processed: false, version: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...o });

function picks(transactions) {
    const app = createApp({ now: NOW });
    app.setData({ categories: CATEGORIES, transactions });
    return JSON.parse(JSON.stringify(app.run('getQuickPicks()'))); // vm vytvára polia z iného kontextu
}

test('okno je 30 dní: 29 dní staré sa počíta, 31 dní staré nie', () => {
    const r = picks([tx({ date: daysAgo(29), category: 'Strava', sub: 'Potraviny', note: 'Billa' }), tx({ date: daysAgo(31), category: 'Strava', sub: 'Potraviny', note: 'Lidl' })]);
    assert.deepEqual(r.map(p => p.note), ['Billa']);
});

test('radí podľa počtu použití, potom najnovšie; veľkosť písmen a medzery v poznámke sa ignorujú', () => {
    const r = picks([
        tx({ date: daysAgo(10), category: 'Strava', sub: 'Potraviny', note: 'Billa' }), tx({ date: daysAgo(8), category: 'Strava', sub: 'Potraviny', note: ' billa ' }), tx({ date: daysAgo(2), category: 'Strava', sub: 'Potraviny', note: 'BILLA' }),
        tx({ date: daysAgo(1), category: 'Doprava', sub: 'Tankovanie', note: 'Slovnaft' }),
        tx({ date: daysAgo(5), category: 'Doprava', sub: 'Tankovanie', note: 'Shell' })
    ]);
    assert.equal(r[0].count, 3);
    assert.deepEqual(r.slice(1).map(p => p.note), ['Slovnaft', 'Shell']);
});

test('preskočí pravidelné platby, zmazané, historický import a neexistujúcu kategóriu', () => {
    const r = picks([
        tx({ date: daysAgo(3), category: 'Strava', note: 'Pravidelná', isRecurring: true }),
        tx({ date: daysAgo(3), category: 'Strava', note: 'Plán', recurringPlanId: 'P1' }),
        tx({ id: 'RPOCC_P1_2026-10-01', date: daysAgo(3), category: 'Strava', note: 'Generovaná' }),
        tx({ id: 'HIST-1', date: daysAgo(3), category: 'Strava', note: 'Import' }),
        tx({ date: daysAgo(3), category: 'Strava', note: 'Zmazaná', deleted: true }),
        tx({ date: daysAgo(3), category: 'Neexistuje', note: 'Cudzia' }),
        tx({ date: daysAgo(3), category: 'Strava', note: 'Platná' })
    ]);
    assert.deepEqual(r.map(p => p.note), ['Platná']);
});

test('podkategória, ktorá v kategórii už neexistuje, sa z návrhu vynechá', () => {
    const r = picks([tx({ date: daysAgo(3), category: 'Strava', sub: 'Stará podkategória', note: 'Nákup' })]);
    assert.equal(r[0].sub, '');
});

test('príjem a výdavok sa nezlievajú a návrhov je najviac 6', () => {
    const many = Array.from({ length: 10 }, (_, i) => tx({ date: daysAgo(i + 1), category: 'Strava', sub: 'Potraviny', note: `Obchod ${i}` }));
    const r = picks(many.concat(tx({ date: daysAgo(2), type: 'income', category: 'Príjmy', sub: 'Lukáš', note: 'Obchod 0' })));
    assert.equal(r.length, 6);
    const same = picks([tx({ date: daysAgo(2), category: 'Strava', note: 'X' }), tx({ date: daysAgo(3), type: 'income', category: 'Príjmy', note: 'X' })]);
    assert.equal(same.length, 2);
});
