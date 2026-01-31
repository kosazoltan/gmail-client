// ZMail Service Worker
// Network-first stratégia - mindig friss tartalom, cache csak offline fallback
const CACHE_NAME = 'zmail-offline-v1';
const OFFLINE_URL = '/offline.html';

// Csak az offline fallback fájlokat cache-eljük
const OFFLINE_ASSETS = [
  '/offline.html',
  '/icons/icon-192x192.png',
];

// Install event - csak offline fallback cache
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching offline assets only');
      return cache.addAll(OFFLINE_ASSETS);
    })
  );
  // Azonnal aktiválódjon
  self.skipWaiting();
});

// Activate event - töröljük az ÖSSZES régi cache-t
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker - clearing all caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Töröljük az összes cache-t kivéve az offline-t
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Azonnal átveszi az irányítást
  self.clients.claim();
});

// Fetch event - NETWORK FIRST, csak offline esetén cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API hívások - mindig network
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline - nincs internetkapcsolat' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Minden más - NETWORK FIRST (mindig friss tartalom)
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Sikeres network response - visszaadjuk közvetlenül
          return networkResponse;
        })
        .catch(async () => {
          // Offline - próbáljuk a cache-ből (csak navigate esetén)
          if (request.mode === 'navigate') {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(OFFLINE_URL);
            if (cachedResponse) {
              return cachedResponse;
            }
          }
          // Ha nincs cache, hibaüzenet
          return new Response('Offline', { status: 503 });
        })
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

  event.waitUntil(
    self.registration.showNotification(data.title || 'ZMail', options)
  );
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
    })
  );
});

console.log('[SW] Service Worker loaded - Network First mode');
