const CACHE_NAME = 'flow-v20-cache-v2.34.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/utils.js',
  './assets/js/sync.js',
  './assets/js/ui.js',
  './assets/js/categories.js',
  './assets/js/transactions.js',
  './assets/js/analytics.js',
  './assets/js/budget.js',
  './assets/js/app.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
