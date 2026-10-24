'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, NOW } = require('../helpers');

const app = createApp({ now: NOW });

test('escHtml neutralizuje HTML a úvodzovky', () => {
    const out = app.run(`escHtml('<img src=x onerror="a()">&\\'')`);
    assert.ok(!/[<>"']/.test(out), out);
    assert.equal(app.run('escHtml(null)'), '');
});

test('jsArg vloží hodnotu do inline handlera bezpečne (apostrof, úvodzovky, HTML)', () => {
    for (const value of ["O'Neil", 'a"b', '<b>x</b>', "'); alert(1); ('", '\\']) {
        const attr = app.run(`jsArg(${JSON.stringify(value)})`);
        assert.ok(!/["<>]/.test(attr), `v atribúte nesmú ostať " < > : ${attr}`);
        // Prehliadač dekóduje atribút a výsledok má byť platný JS reťazec s pôvodnou hodnotou.
        const decoded = attr.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        assert.equal(JSON.parse(decoded), value);
    }
});
