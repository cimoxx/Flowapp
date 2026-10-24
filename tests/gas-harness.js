/* Načíta Google Apps Script (.gs) do Node kontextu so simulovaným Google Sheets.
 *
 * Simulácia zámerne kopíruje nepríjemné správanie Sheets: text v tvare YYYY-MM zapísaný do bunky,
 * ktorá nemá textový formát, sa zmení na dátum (polnoc v časovej zóne tabuľky) a getValues() ho
 * vráti ako Date. Presne to rozbíjalo porovnania odhad vs. skutočnosť po refreshi.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const TZ = 'Europe/Bratislava';
const GAS_DIR = path.resolve(__dirname, '..', 'google-apps-script');

function tzOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(date).reduce((o, p) => (o[p.type] = p.value, o), {});
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Polnoc 1. dňa mesiaca v časovej zóne tabuľky (ako ju vytvorí Sheets pri parsovaní „2026-09“). */
function sheetsMidnight(year, month1) {
    const guess = new Date(Date.UTC(year, month1 - 1, 1));
    return new Date(guess.getTime() - tzOffsetMs(guess, TZ));
}

class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.formats = new Map(); this.maxRows = 20000; this.maxCols = 30; this.calls = 0; }
    getLastRow() { let n = 0; this.rows.forEach((r, i) => { if (r && r.some(v => v !== '' && v !== undefined && v !== null)) n = i + 1; }); return n; }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return this.maxCols; }
    insertRows() {}
    insertColumnsAfter() {}
    setFrozenRows() {}
    appendRow(values) { this.getRange(this.getLastRow() + 1, 1, 1, values.length).setValues([values]); }
    _convert(row, col, value) {
        if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && this.formats.get(`${row}:${col}`) !== '@') {
            const [y, m] = value.split('-').map(Number);
            return sheetsMidnight(y, m);
        }
        return value;
    }
    getRange(row, col, numRows = 1, numCols = 1) {
        const sheet = this;
        return {
            getValues() {
                sheet.calls++;
                const out = [];
                for (let i = 0; i < numRows; i++) {
                    const r = sheet.rows[row - 1 + i] || [];
                    out.push(Array.from({ length: numCols }, (_, j) => (r[col - 1 + j] === undefined ? '' : r[col - 1 + j])));
                }
                return out;
            },
            setValues(values) {
                sheet.calls++;
                values.forEach((vals, i) => {
                    const r = sheet.rows[row - 1 + i] || (sheet.rows[row - 1 + i] = []);
                    vals.forEach((v, j) => { r[col - 1 + j] = sheet._convert(row + i, col + j, v); });
                });
            },
            setValue(v) { this.setValues([[v]]); },
            getValue() { return this.getValues()[0][0]; },
            setNumberFormat(format) {
                sheet.calls++;
                for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) sheet.formats.set(`${row + i}:${col + j}`, format);
            },
            getNumberFormat() { return sheet.formats.get(`${row}:${col}`) || 'General'; }
        };
    }
    getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), this.rows.reduce((m, r) => Math.max(m, (r || []).length), 1)); }
}

function createGas(file = 'Flowapp-Google-Apps-Script-v2.54.2.gs') {
    const code = fs.readFileSync(path.join(GAS_DIR, file), 'utf8');
    const sheets = {};
    const ss = {
        getSheetByName: name => sheets[name] || null,
        insertSheet: name => (sheets[name] = new Sheet(name)),
        getId: () => 'test-sheet',
        getSpreadsheetTimeZone: () => TZ
    };
    sheets.Sheet1 = new Sheet('Sheet1');
    sheets.Categories = new Sheet('Categories');
    const props = {}, cache = {};
    const ctx = {
        SpreadsheetApp: { getActiveSpreadsheet: () => ss },
        ContentService: { createTextOutput: t => ({ t, setMimeType() { return JSON.parse(this.t); } }), MimeType: { JSON: 'json' } },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => (props[k] = v), deleteProperty: k => delete props[k] }) },
        CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => (cache[k] = v), remove: k => delete cache[k] }) },
        Session: { getScriptTimeZone: () => TZ },
        Utilities: {
            getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
            computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => (b > 127 ? b - 256 : b)),
            formatDate(date, timeZone, format) {
                const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).reduce((o, x) => (o[x.type] = x.value, o), {});
                return format.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day);
            }
        },
        UrlFetchApp: { fetch: () => ({ getResponseCode: () => 400, getContentText: () => '{}' }) },
        Logger: { log() {} },
        console, Date, JSON, Math, Set, Map, Number, String, Boolean, Array, Object, Error, RegExp, Intl,
        encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    const token = vm.runInContext('FLOW_API_TOKEN', ctx);

    return {
        ctx, sheets, ss, token,
        /** Počet volaní Sheets od posledného resetu (v skutočnom Apps Script je každé pomalé, rádovo 0,05 až 0,3 s). */
        apiCalls: () => Object.values(sheets).reduce((n, sh) => n + sh.calls, 0),
        resetApiCalls: () => Object.values(sheets).forEach(sh => (sh.calls = 0)),
        get: parameter => ctx.doGet({ parameter: { token, ...parameter } }),
        post: body => ctx.doPost({ postData: { contents: JSON.stringify({ token, ...body }) } }),
        run: expr => vm.runInContext(expr, ctx)
    };
}

/** Prepojí fetch() v appke s Apps Scriptom (ako keby appka volala skutočný backend). */
function connectApp(app, gas, { online = () => true } = {}) {
    app.run(`function flowAuthToken() { return ${JSON.stringify(gas.token)}; }`);
    const reply = body => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) });
    app.sandbox.fetch = async (url, init = {}) => {
        if (!online()) throw new TypeError('Failed to fetch');
        if (init.method === 'POST') return reply(gas.ctx.doPost({ postData: { contents: init.body } }));
        const parameter = {};
        new URL(url).searchParams.forEach((v, k) => (parameter[k] = v));
        return reply(gas.ctx.doGet({ parameter }));
    };
}

module.exports = { createGas, connectApp, Sheet, sheetsMidnight, TZ };
