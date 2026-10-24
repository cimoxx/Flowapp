'use strict';
const { createApp, buildHousehold } = require('./harness');

const NOW = new Date(2026, 9, 24, 12); // sobota 24. 10. 2026, 24. deň z 31

const CATEGORIES = [
    { id: 'Strava', icon: 'utensils', subs: ['Potraviny'] },
    { id: 'Doprava', icon: 'car', subs: ['Tankovanie'] },
    { id: 'Domácnosť', icon: 'home', subs: ['Energie'] },
    { id: 'Darčeky', icon: 'gift', subs: ['Hanka'] },
    { id: 'Príjmy', icon: 'hand-coins', subs: ['Lukáš'] }
];
const CONFIG = {
    Strava: { mean: 500, sub: 'Potraviny' },
    Doprava: { mean: 150, sub: 'Tankovanie' },
    'Domácnosť': { mean: 300, sub: 'Energie' },
    'Darčeky': { mean: 60, sub: 'Hanka' }
};

/** Appka so zmrazeným časom a syntetickou domácnosťou. */
function appWith({ spentFraction = 0.5, now = NOW, months = 37, seasonal = {}, noise = 0.1, categories = CATEGORIES, config = CONFIG, extra = [] } = {}) {
    const app = createApp({ now });
    const transactions = buildHousehold({ now, months, spentFraction, seasonal, noise, categories: config }).concat(extra);
    app.setData({ categories, transactions });
    return app;
}

module.exports = { NOW, CATEGORIES, CONFIG, appWith, createApp, buildHousehold };
