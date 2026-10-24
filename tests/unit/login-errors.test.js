'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, NOW } = require('../helpers');
const { createGas } = require('../gas-harness');

// --- Apps Script: každá chyba má kód, ping hovorí o verzii bez tokenu ---

test('ping bez tokenu vráti verziu backendu a nič z dát', () => {
    const gas = createGas();
    const res = gas.ctx.doGet({ parameter: { get: 'ping' } });
    assert.equal(res.status, 'success');
    assert.match(res.backendVersion, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(Object.keys(res).sort(), ['backend', 'backendVersion', 'loginSupported', 'status']);
});

test('ostatné čítanie bez tokenu ostáva zamknuté', () => {
    const gas = createGas();
    for (const get of ['transactions', 'planning', 'categories_meta', 'whoami']) {
        const res = gas.ctx.doGet({ parameter: { get } });
        assert.equal(res.code, 'unauthorized', get);
    }
});

test('neznáma akcia má kód unknown_action', () => {
    const gas = createGas();
    assert.equal(gas.post({ action: 'neexistuje' }).code, 'unknown_action');
});

test('neočakávaná chyba servera má kód server_error a skrátený text (nie holú odpoveď bez kódu)', () => {
    const gas = createGas();
    const res = gas.ctx.doPost({ postData: { contents: '{nie je json' } });
    assert.equal(res.status, 'error');
    assert.equal(res.code, 'server_error');
    assert.ok(res.message.length > 0 && res.message.length <= 400);
});

test('zaneprázdnený zámok má kód busy', () => {
    const gas = createGas();
    gas.ctx.LockService = { getScriptLock: () => ({ waitLock() { throw new Error('Lock timeout: another process was holding the lock for too long.'); }, releaseLock() {} }) };
    const res = gas.post({ action: 'googleLogin', credential: 'x' });
    assert.equal(res.code, 'busy');
});

test('chyby overenia prihlásenia majú vlastné kódy (nie server_error)', () => {
    const gas = createGas();
    assert.equal(gas.post({ action: 'googleLogin', credential: 'nonsense' }).code, 'login_failed');
});

// --- Appka: hláška podľa odpovede servera ---

function authApp(fetch = null) {
    const app = createApp({ now: NOW, extraScripts: ['auth'], fetch });
    const elements = {};
    app.sandbox.document.getElementById = id => (elements[id] = elements[id] || { textContent: '', dataset: {} });
    app.status = () => (elements['auth-status'] || {}).textContent;
    return app;
}
const message = (app, result, ping) => app.run(`flowAuthLoginFailureMessage(${JSON.stringify(result)}, ${JSON.stringify(ping)})`);

test('hláška: nepovolený účet a zlyhané overenie ukazujú text servera', () => {
    const app = authApp();
    assert.equal(message(app, { code: 'not_allowed', message: 'Účet x nemá povolený prístup do Flow.' }, null), 'Účet x nemá povolený prístup do Flow.');
    assert.equal(message(app, { code: 'login_failed', message: 'Neplatný Google Client ID' }, null), 'Neplatný Google Client ID');
});

test('hláška: busy, unknown_action a server_error sú pomenované', () => {
    const app = authApp();
    assert.match(message(app, { code: 'busy' }, null), /zaneprázdnený/);
    assert.match(message(app, { code: 'unknown_action' }, null), /Nasaď Google Apps Script/);
    assert.match(message(app, { code: 'server_error', message: 'Exception: boom' }, null), /Chyba na strane servera: Exception: boom/);
});

test('hláška bez kódu: s pingom ukáže verziu a text chyby, bez pingu radí skontrolovať nasadenie', () => {
    const app = authApp();
    const withPing = message(app, { status: 'error', message: 'TypeError: Cannot read properties of null' }, { backendVersion: '2.54.2' });
    assert.match(withPing, /v2\.54\.2/);
    assert.match(withPing, /TypeError/);
    assert.match(message(app, { status: 'error', message: 'Unauthorized' }, null), /Manage deployments/);
});

test('dlhý text chyby sa skráti, aby sa zmestil na obrazovku', () => {
    const app = authApp();
    const text = message(app, { code: 'server_error', message: 'x'.repeat(2000) }, null);
    assert.ok(text.length < 260, String(text.length));
});

test('prihlásenie: odpoveď servera sa premietne do hlášky na obrazovke', async () => {
    const run = async (loginResponse, pingResponse) => {
        const fakeFetch = async (url, init = {}) => ({
            ok: true, status: 200,
            json: async () => JSON.parse(JSON.stringify(init.method === 'POST' ? loginResponse : (pingResponse || { status: 'error', message: 'Unauthorized' })))
        });
        const app = authApp(fakeFetch);   // flowAuthRawFetch sa viaže pri načítaní skriptu
        await app.run(`flowAuthOnCredential({ credential: 'x' })`);
        return app.status();
    };
    assert.match(await run({ status: 'error', code: 'server_error', message: 'Exception: boom' }), /Chyba na strane servera: Exception: boom/);
    assert.match(await run({ status: 'error', message: 'Unknown action' }, { status: 'success', backendVersion: '2.54.2' }), /v2\.54\.2/);
    assert.match(await run({ status: 'error', message: 'Unauthorized' }), /Manage deployments/);
    assert.match(await run({ status: 'error', code: 'not_allowed', message: 'Účet nemá prístup.' }), /Účet nemá prístup/);
});
