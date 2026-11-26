// ZGESTOR - Service Worker PWA (Instalação e Suporte Mobile Offline)
const CACHE_NAME = 'zgestor-pwa-v1.4.3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icone-zioto.png',
  './assets/logo-zioto.png',
  './src/app.js',
  './src/lib/dbEngine.js',
  './src/ui/views.js',
  './src/ui/reports.js',
  './src/data/seedData.js',
  './src/data/carteiraOficial.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia Network-First: Sempre busca o código mais recente da Vercel; se estiver offline, responde do cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Não intercepta chamadas de API externas do Supabase ou CDNs de terceiros
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

