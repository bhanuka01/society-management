// ═══════════════════════════════════════════════════
// ADSS Ruhuna — Service Worker (PWA)
// Cache-first for app shell, network-first for API
// ═══════════════════════════════════════════════════

const CACHE_VERSION = 'adss-v1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// App shell resources to pre-cache on install
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/logo_dark.png',
  '/logo_light.png',
  '/logo_trans_dark.png',
  '/logo_trans_light.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Domains / paths that should always go network-first (API calls, auth)
const NETWORK_FIRST_PATTERNS = [
  /supabase\.co/,
  /supabase\.in/,
  /googleapis\.com/,
  /gstatic\.com/,
  /cdn\.tailwindcss\.com/,
];

// ─── Install: Pre-cache app shell ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to be replaced
  self.skipWaiting();
});

// ─── Activate: Clean up old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ─── Fetch: Strategy router ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE — e.g., Supabase mutations)
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // Network-first for API / external CDN requests
  if (NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.href))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for app shell & static assets
  event.respondWith(cacheFirst(request));
});

// ─── Strategy: Cache-first (with network fallback) ───
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    // Cache successful responses for future offline use
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If both cache and network fail, return the offline fallback
    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;

    return new Response('Offline — please check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ─── Strategy: Network-first (with cache fallback) ───
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache successful GET responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response('Offline — please check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
