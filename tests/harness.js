/* Načíta skutočné skripty appky do izolovaného Node kontextu (bez prehliadača).
 * Čas je zmrazený, aby výpočty boli opakovateľné.
 *
 * Použitie:
 *   const { createApp } = require('./harness');
 *   const app = createApp({ now: new Date(2026, 9, 24, 12) });
 *   app.setData({ categories, transactions });
 *   app.run('getAnnualPlan(2026)')
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
// Poradie ako v index.html (bez auth.js a app.js, ktoré potrebujú DOM a prihlásenie).
const SCRIPTS = ['version', 'config', 'utils', 'sync', 'ui', 'categories', 'transactions', 'analytics', 'budget', 'planning', 'cockpit'];

function createApp({ now = new Date(2026, 9, 24, 12), storage = new Map(), fetch = null } = {}) {
    const RealDate = Date;
    const FIXED = now.getTime();
    class FakeDate extends RealDate {
        constructor(...args) { if (args.length === 0) super(FIXED); else super(...args); }
        static now() { return FIXED; }
    }

    const store = storage; // zdieľané úložisko = „refresh“ appky v teste
    const noop = () => {};
    const element = () => new Proxy(function () {}, {
        get: (_, prop) => {
            if (prop === 'classList') return { add: noop, remove: noop, toggle: noop, contains: () => false };
            if (prop === 'style' || prop === 'dataset') return {};
            if (prop === 'value') return '';
            if (prop === 'querySelectorAll') return () => [];
            if (prop === Symbol.toPrimitive) return () => '';
            return element();
        },
        set: () => true,
        apply: () => element()
    });

    const sandbox = {
        Date: FakeDate, Math, JSON, Intl, Set, Map, WeakMap, Promise, Symbol, Number, String, Boolean, Array, Object, RegExp, Error, TypeError,
        parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, setTimeout: (fn) => setTimeout(fn, 0), clearTimeout, requestAnimationFrame: noop,
        console: { log: noop, warn: noop, error: noop, info: noop },
        localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
        document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: element, documentElement: element(), body: element() },
        navigator: {},
        location: { search: '', pathname: '/', hash: '' },
        history: { replaceState: noop },
        fetch: fetch || (() => Promise.reject(new Error('fetch is disabled in tests'))),
        alert: noop, confirm: () => true
    };
    sandbox.addEventListener = noop;
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);

    SCRIPTS.forEach(name => {
        const file = path.join(ROOT, 'assets', 'js', `${name}.js`);
        vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    });

    const app = {
        sandbox,
        storage: store,
        run: code => vm.runInContext(code, sandbox),
        /** Nastaví kategórie a transakcie a zneplatní vypočítané indexy. */
        setData({ categories, transactions, recurring = [], events = [], overrides = [] }) {
            sandbox.__input = { categories, transactions, recurring, events, overrides };
            vm.runInContext(`
                categories = __input.categories.map(c => ({ ...c }));
                db = __input.transactions.map(t => ({ ...t }));
                flowRecurringPlans = __input.recurring;
                flowPlannedEvents = __input.events;
                flowBudgetOverrides = __input.overrides;
                normalizeCategories();
                markForecastIndexDirty();
            `, sandbox);
        }
    };
    return app;
}

/** Deterministický generátor (aby testy dávali vždy rovnaké čísla). */
function seededRandom(seed = 7) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Syntetická domácnosť: každá kategória má obvyklú mesačnú sumu so šumom a voliteľnou sezónnosťou.
 * Aktuálny mesiac je rozbehnutý: minulo sa `spentFraction` obvyklej sumy.
 */
function buildHousehold({ now, months = 37, spentFraction = 0.5, noise = 0.1, seed = 7, categories, seasonal = {} }) {
    const rnd = seededRandom(seed);
    const y0 = now.getFullYear(), m0 = now.getMonth(), today = now.getDate();
    const txs = [];
    let n = 0;
    const add = (y, m, d, category, sub, amount, type = 'expense') => txs.push({
        id: `ID-${++n}`, date: ymd(y, m, d), category, sub, amount: Math.round(amount * 100) / 100, type, note: '', processed: true,
        version: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    });
    for (let back = months - 1; back >= 0; back--) {
        const dt = new Date(y0, m0 - back, 1);
        const y = dt.getFullYear(), m = dt.getMonth();
        Object.entries(categories).forEach(([category, { mean, sub }]) => {
            const season = (seasonal[category] && seasonal[category][m]) || 1;
            const total = mean * season * (1 - noise + 2 * noise * rnd());
            for (let k = 0; k < 4; k++) {
                if (back === 0) add(y, m, Math.max(1, Math.min(today, 1 + k * Math.floor(today / 4))), category, sub, total * spentFraction / 4);
                else add(y, m, 3 + k * 7, category, sub, total / 4);
            }
        });
        add(y, m, 1, 'Príjmy', 'Lukáš', 2000, 'income');
    }
    return txs;
}

module.exports = { createApp, buildHousehold, seededRandom, ymd };
