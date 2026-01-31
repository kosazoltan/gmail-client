// ZMail Service Worker
const CACHE_NAME = 'zmail-cache-v1';
const OFFLINE_URL = '/offline.html';

// Statikus fájlok cache-elése
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/zmail-logo.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - cache statikus fájlokat
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Azonnal aktiválódjon
  self.skipWaiting();
});

// Activate event - töröljük a régi cache-eket
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Azonnal átveszi az irányítást
  self.clients.claim();
});

// Fetch event - network first, cache fallback stratégia
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API hívások - mindig network, nem cache-elünk
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Ha offline, visszaadunk egy JSON hibát
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

  // Statikus fájlok - stale-while-revalidate stratégia
  if (request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Próbáljuk a cache-ből
        const cachedResponse = await cache.match(request);

        // Háttérben frissítjük
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Csak sikeres válaszokat cache-elünk
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Ha offline és nincs cache, offline oldalt mutatunk
            if (!cachedResponse && request.mode === 'navigate') {
              return cache.match(OFFLINE_URL);
            }
            return null;
          });

        // Cache-ből azonnal visszaadjuk, ha van
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Push notification kezelés (jövőbeli feature)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Új üzenet érkezett',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
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

// Background sync (jövőbeli feature - offline email küldés)
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-email') {
    event.waitUntil(
      // Itt lenne az offline sorba állított emailek küldése
      console.log('[SW] Background sync: send-email')
    );
  }
});

console.log('[SW] Service Worker loaded');
