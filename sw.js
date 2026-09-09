const CACHE_NAME = 'flow-v20-cache-v2.49.6';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css?v=2.49.6',
  './assets/js/config.js?v=2.49.6',
  './assets/js/utils.js?v=2.49.6',
  './assets/js/sync.js?v=2.49.6',
  './assets/js/ui.js?v=2.49.6',
  './assets/js/categories.js?v=2.49.6',
  './assets/js/transactions.js?v=2.49.6',
  './assets/js/analytics.js?v=2.49.6',
  './assets/js/budget.js?v=2.49.6',
  './assets/js/planning.js?v=2.49.6',
  './assets/js/cockpit.js?v=2.49.6',
  './assets/js/app.js?v=2.49.6'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      LOCAL_ASSETS.map(url => cache.add(url).catch(() => null))
    ))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  const sameOrigin=url.origin===self.location.origin;

  // Always prefer fresh application code after a deploy.
  if(sameOrigin || request.mode==='navigate'){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response && response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached || caches.match('./index.html')))
    );
    return;
  }

  // External libraries are network-only; a CDN problem must not prevent SW update.
  event.respondWith(fetch(request));
});
