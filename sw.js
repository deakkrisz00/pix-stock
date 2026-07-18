// Service Worker – Pix Stock PWA v2
const CACHE_NAME = 'pix-stock-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// Install – cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate – clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch – network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip Supabase API calls – always network
  if (url.hostname.includes('supabase.co')) {
    return;
  }
  
  // Cache-first for same-origin assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Background sync support
self.addEventListener('sync', (event) => {
  if (event.tag === 'pix-sync') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  // Will be handled by the main app via postMessage
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_NEEDED' }));
}
