const CACHE_NAME = 'quinielas-jr-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copia));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  const destinosCacheables = new Set(['script', 'style', 'image', 'font', 'manifest']);
  if (!destinosCacheables.has(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response.ok || response.type !== 'basic') return response;
      const copia = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
      return response;
    })),
  );
});
