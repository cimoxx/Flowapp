'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, NOW } = require('../helpers');

/** Appka s falošným DOM pre jeden riadok zoznamu a so záznamom volaní openModal. */
function rowApp() {
    const app = createApp({ now: NOW });
    const el = { classList: { add() {}, remove() {} }, style: {} };
    const bg = { style: {}, className: '' };
    app.sandbox.document.getElementById = id => (id === 'item-T1' ? el : id === 'bg-T1' ? bg : null);
    app.sandbox.getComputedStyle = () => ({ transform: 'none' });
    app.sandbox.WebKitCSSMatrix = class { constructor() { this.m41 = 0; } };
    app.run(`var __opened = []; openModal = function (id) { __opened.push(id); };`);
    app.run(`hideSwipeHintForever = function () {}; toggleProcessed = function () {}; handleDelete = function () {};`);
    app.opened = () => JSON.parse(JSON.stringify(app.run('__opened')));
    return app;
}
const touchEnd = (app, { dx = 0, dy = 0, swiping = false } = {}) => {
    app.run(`touchStartX = 100; touchStartY = 100; isSwiping = ${swiping};`);
    app.sandbox.__e = { changedTouches: [{ clientX: 100 + dx, clientY: 100 + dy }] };
    app.run(`handleSwipeEnd(__e, 'T1')`);
};
const click = (app, target = {}) => { app.sandbox.__c = { target }; app.run(`handleRowClick(__c, 'T1')`); };

test('zdvihnutie prsta po klepnutí už neotvára úpravu (regresia: kliknutie potom prepínalo kategóriu)', () => {
    const app = rowApp();
    touchEnd(app);
    assert.deepEqual(app.opened(), []);
});

test('klik na riadok otvorí úpravu', () => {
    const app = rowApp();
    click(app);
    assert.deepEqual(app.opened(), ['T1']);
});

test('klik na odškrtávacie kolečko úpravu neotvorí', () => {
    const app = rowApp();
    click(app, { closest: sel => (sel === '.tx-check' ? {} : null) });
    assert.deepEqual(app.opened(), []);
});

test('po potiahnutí sa klik na riadok krátko ignoruje', () => {
    const app = rowApp();
    touchEnd(app, { dx: 60, swiping: true });
    click(app);
    assert.deepEqual(app.opened(), []);
});

test('po posune prsta (aj bez potiahnutia) sa klik na riadok ignoruje', () => {
    const app = rowApp();
    touchEnd(app, { dy: 20 });
    click(app);
    assert.deepEqual(app.opened(), []);
});

test('po uplynutí krátkej doby sa klik na riadok opäť berie', () => {
    const app = rowApp();
    touchEnd(app, { dx: 60, swiping: true });
    app.run('rowClickSuppressedUntil = Date.now() - 1');
    click(app);
    assert.deepEqual(app.opened(), ['T1']);
});

test('poistka: krátko po otvorení formulára sa kliky vo formulári ignorujú, mimo formulára a neskôr nie', () => {
    const app = createApp({ now: NOW });
    const inModal = { closest: sel => (sel === '#modal-overlay' ? {} : null) };
    const outside = { closest: () => null };
    const swallow = target => app.run(`shouldSwallowGhostClick(${JSON.stringify({})})`) && false || (() => { app.sandbox.__e = { target }; return app.run('shouldSwallowGhostClick(__e)'); })();

    app.run('modalOpenedAt = Date.now()');
    assert.equal(swallow(inModal), true, 'tesne po otvorení, vo formulári');
    assert.equal(swallow(outside), false, 'tesne po otvorení, mimo formulára');
    app.run('modalOpenedAt = Date.now() - 1000');
    assert.equal(swallow(inModal), false, 'o sekundu neskôr');
    app.run('modalOpenedAt = 0');
    assert.equal(swallow(inModal), false, 'formulár ešte nebol otvorený');
});
