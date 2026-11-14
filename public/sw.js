/**
 * FieldAssist Service Worker — PWA & Full Offline Support
 * Enables complete offline application loading, static asset caching,
 * and resilient network degradation.
 */

const CACHE_NAME = 'fieldassist-offline-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
];

// Install Event: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[FieldAssist ServiceWorker] Pre-caching offline app shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[FieldAssist ServiceWorker] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-First for static assets, Network-First for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (POST/PATCH/DELETE handled by app LocalStorage queue)
  if (request.method !== 'GET') {
    return;
  }

  // 2. API or Supabase requests: Network-First with catch fallback
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ offline: true, message: 'Device is currently offline. Data served from local cache.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // 3. Navigation requests (HTML): Network-First, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/index.html') || await cache.match('/');
        return cachedIndex || new Response('<h1>FieldAssist Offline</h1><p>Please reconnect to the network.</p>', {
          headers: { 'Content-Type': 'text/html' },
        });
      })
    );
    return;
  }

  // 4. Static assets (JS, CSS, images, Leaflet CDN): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
