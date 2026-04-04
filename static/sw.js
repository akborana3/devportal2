const CACHE_NAME = 'devportal-v1';
const urlsToCache = [
  '/',
  '/static/css/variables.css',
  '/static/css/layout.css',
  '/static/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only cache GET requests for static assets, dynamic API calls should always go to network.
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
