'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'styles.css'), 'utf8');
// Iba formulár Nová transakcia (od prekrytia po tlačidlo Zmazať).
const modal = html.slice(html.indexOf('id="modal-overlay"'), html.indexOf('id="del-btn"'));

test('formulár má všetky prvky, ktoré používa kód appky', () => {
    for (const id of ['entry-form', 'entry-id', 'f-amount', 't-ex', 't-in', 'quick-picks', 'quick-picks-list', 'cat-grid', 'sub-section', 'sub-grid',
        'f-note', 'f-date', 'f-recurring', 'recurring-options', 'f-frequency', 'save-trigger', 'modal-title', 'modal-subtitle']) {
        assert.ok(modal.includes(`id="${id}"`), `chýba #${id}`);
    }
    assert.ok(html.includes('id="del-btn"'));
});

test('karta „Predvolené hodnoty“ je preč (HTML aj štýly)', () => {
    assert.ok(!modal.includes('modal-helper'), 'markup');
    assert.ok(!modal.includes('Predvolené hodnoty'));
    assert.ok(!/modal-helper/.test(css), 'štýly');
});

test('poznámka a dátum sú vedľa seba v jednom riadku', () => {
    const row = /<div class="([^"]*)">\s*<input type="text" id="f-note"[^>]*>\s*<input type="date" id="f-date"[^>]*>\s*<\/div>/.exec(modal);
    assert.ok(row, 'poznámka a dátum musia byť súrodenci v jednom kontajneri');
    assert.match(row[1], /\bgrid\b/);
    assert.match(row[1], /grid-cols-\[[^\]]+\]/, 'dva stĺpce vždy, nielen od šírky sm');
    assert.ok(!/grid-cols-1\b/.test(row[1]), 'nie jeden stĺpec na telefóne');
    assert.match(modal, /id="f-note"[^>]*class="[^"]*min-w-0/, 'pole sa smie zúžiť');
    assert.match(modal, /id="f-date"[^>]*class="[^"]*min-w-0/);
});

test('pravidelná platba je jeden riadok a vysvetlenie je až v rozbalených možnostiach', () => {
    const options = /<div id="recurring-options"[\s\S]*?<\/select>/.exec(modal);
    assert.ok(options, 'možnosti pravidelnej platby');
    assert.match(options[0], /preniesť aj do ďalších období/, 'vysvetlenie je v možnostiach');
    const beforeOptions = modal.slice(modal.indexOf('id="recurring-card"'), modal.indexOf('id="recurring-options"'));
    assert.ok(!/preniesť aj do ďalších období/.test(beforeOptions), 'v zbalenom riadku nemá byť dlhý text');
    assert.match(beforeOptions, /id="f-recurring"/);
});

test('formulár je kompaktný: užšie medzery, menšia suma, nižšie dlaždice, bez podnadpisu', () => {
    assert.match(modal, /<form id="entry-form"[^>]*class="space-y-3"/);
    assert.match(modal, /id="f-amount"[^>]*class="[^"]*\btext-4xl\b/);
    assert.match(css, /#modal-subtitle\s*\{\s*display:\s*none;?\s*\}/);
    assert.match(/\.cat-tile\s*\{[^}]*\}/.exec(css)[0], /min-height:\s*56px/);
});
