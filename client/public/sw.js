// ZMail Service Worker
// Network-first stratégia - mindig friss tartalom, cache csak offline fallback
const CACHE_NAME = 'zmail-offline-v2';
const APP_SHELL_CACHE = 'zmail-app-shell-v1';
const OFFLINE_URL = '/offline.html';

// App shell assets to cache for offline access
const APP_SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-72x72.png',
  '/manifest.json',
];

// Install event - cache app shell + offline fallback
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching offline fallback');
        return cache.addAll([OFFLINE_URL]);
      }),
      caches.open(APP_SHELL_CACHE).then((cache) => {
        console.log('[SW] Caching app shell assets');
        return cache.addAll(APP_SHELL_ASSETS);
      }),
    ]),
  );
  // Azonnal aktiválódjon
  self.skipWaiting();
});

// Activate event - töröljük a régi cache-eket
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker - cleaning old caches...');
  const currentCaches = new Set([CACHE_NAME, APP_SHELL_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.has(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  // Azonnal átveszi az irányítást
  self.clients.claim();
});

// Fetch event - NETWORK FIRST, app shell cache fallback for offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API hívások — NE intercept-áljuk, engedjük át a böngészőnek közvetlenül
  // Cross-origin (api.mindenes.org) hívásokat a SW amúgy sem kezelheti megbízhatóan
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return;
  }

  // Minden más - NETWORK FIRST, offline fallback cache-ből
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache the response for offline use (app shell assets + JS/CSS bundles)
          if (networkResponse.ok && (
            url.pathname === '/' ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.html') ||
            url.pathname.startsWith('/assets/') ||
            url.pathname.startsWith('/icons/')
          )) {
            const responseClone = networkResponse.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline - try cache first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // For navigation requests, serve the cached index.html (SPA)
          if (request.mode === 'navigate') {
            const cachedIndex = await caches.match('/');
            if (cachedIndex) {
              return cachedIndex;
            }
            // Last resort: offline page
            const offlinePage = await caches.match(OFFLINE_URL);
            if (offlinePage) {
              return offlinePage;
            }
          }

          // If nothing in cache, return error
          return new Response('Offline', { status: 503 });
        }),
    );
  }
});

// Push notification kezelés
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Új üzenet érkezett',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    tag: data.tag,
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Megnyitás' },
      { action: 'close', title: 'Bezárás' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'ZMail', options));
});

// Notification click kezelés
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ha már van nyitott ablak, fókuszáljunk rá
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Ha nincs, nyissunk újat
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

console.log('[SW] Service Worker loaded - Network First mode with app shell caching');
