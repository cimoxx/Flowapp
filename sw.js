// Verzia (a tým aj názov cache) pochádza z jedného miesta: assets/js/version.js.
// Prehliadač pri kontrole aktualizácie sleduje aj importované skripty, takže zmena verzie vyvolá nový install.
importScripts('./assets/js/version.js');
const CACHE_NAME = `flow-v20-cache-v${APP_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/version.js',
  './assets/js/changelog.js',
  './assets/js/config.js',
  './assets/js/auth.js',
  './assets/js/utils.js',
  './assets/js/sync.js',
  './assets/js/ui.js',
  './assets/js/categories.js',
  './assets/js/transactions.js',
  './assets/js/analytics.js',
  './assets/js/budget.js',
  './assets/js/cockpit.js',
  './assets/js/planning.js',
  './assets/js/app.js'
];
// Knižnice z CDN majú pevnú verziu (musí sedieť s index.html), aby sa appka nerozbila
// pri ich novom vydaní. Výpadok CDN nesmie zhodiť inštaláciu vlastných súborov.
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@1.58.0/dist/umd/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all([
      cache.addAll(ASSETS),
      ...CDN_ASSETS.map(url => cache.add(url).catch(err => console.warn('CDN cache skipped:', url, err)))
    ]))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
