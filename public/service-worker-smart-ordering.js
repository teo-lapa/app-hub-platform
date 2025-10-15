/**
 * Service Worker for LAPA Smart Ordering
 *
 * Features:
 * - Offline mode support
 * - Cache API responses
 * - Background sync for order creation
 * - Push notifications for critical alerts
 */

const CACHE_VERSION = 'smart-ordering-v1';
const CACHE_URLS = [
  '/ordini-smart',
  '/api/smart-ordering/data',
  '/_next/static/css/',
  '/_next/static/js/'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Smart Ordering Service Worker...');

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_URLS);
    })
  );

  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Smart Ordering Service Worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone response to cache
        const responseClone = response.clone();

        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', request.url);
            return cachedResponse;
          }

          // No cache, return offline page
          return new Response('Offline - no cached data available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Background sync for order creation
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  try {
    // Get pending orders from IndexedDB
    const pendingOrders = await getPendingOrders();

    if (pendingOrders.length === 0) {
      console.log('[SW] No pending orders to sync');
      return;
    }

    console.log(`[SW] Syncing ${pendingOrders.length} pending orders...`);

    for (const order of pendingOrders) {
      try {
        const response = await fetch('/api/smart-ordering/create-orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(order)
        });

        if (response.ok) {
          // Remove from pending
          await removePendingOrder(order.id);
          console.log('[SW] Order synced:', order.id);
        }
      } catch (error) {
        console.error('[SW] Error syncing order:', error);
      }
    }

    // Notify user
    self.registration.showNotification('LAPA Smart Ordering', {
      body: `${pendingOrders.length} ordini sincronizzati con successo`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    });
  } catch (error) {
    console.error('[SW] Error in syncOrders:', error);
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Nuove notifiche disponibili',
    icon: data.icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Apri'
      },
      {
        action: 'close',
        title: 'Chiudi'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LAPA Smart Ordering', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/ordini-smart')
    );
  }
});

// Helper: Get pending orders from IndexedDB
async function getPendingOrders() {
  // TODO: Implement IndexedDB read
  return [];
}

// Helper: Remove pending order from IndexedDB
async function removePendingOrder(orderId) {
  // TODO: Implement IndexedDB delete
}

console.log('[SW] Smart Ordering Service Worker loaded');
