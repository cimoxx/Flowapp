const CACHE_NAME = 'flow-v20-cache-v2.49.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css?v=2.49.1',
  './assets/js/config.js',
  './assets/js/utils.js',
  './assets/js/sync.js',
  './assets/js/ui.js',
  './assets/js/categories.js',
  './assets/js/transactions.js',
  './assets/js/analytics.js',
  './assets/js/budget.js',
  './assets/js/cockpit.js',
  './assets/js/planning.js',
  './assets/js/app.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
