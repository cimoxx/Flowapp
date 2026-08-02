self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('flow-v20-cache').then((cache) => {
            return cache.addAll([
                'index.html',
                'styles.css',
                'manifest.json',
                'js/app.js',
                'js/config.js',
                'js/storage.js',
                'js/utils.js',
                'js/transactions.js',
                'js/render.js',
                'js/filters.js',
                'js/swipe.js',
                'js/analytics.js',
                'js/burnrate.js',
                'js/settings.js',
                'js/categories.js',
                'js/ui.js'
            ]);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
