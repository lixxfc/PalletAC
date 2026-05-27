// Pallet OS minimal service worker.
//
// Purpose:
//   1. Satisfy the PWA installability requirement (browsers want a registered SW
//      before they show the "Add to Home Screen" prompt with full app metadata).
//   2. Cache the app shell (HTML + manifest + icons) so the app opens instantly
//      from the home-screen icon, even on a slow / spotty connection.
//
// NOT cached:
//   - Supabase API calls (must always be live so the user sees the truth)
//   - External CDN scripts (Chart.js etc. — let the browser handle these)
//
// Strategy:
//   - app shell (HTML + manifest + icons): cache-first, refreshed in background
//   - everything else (Supabase API, CDN, etc.): network-only

const CACHE_NAME = 'palletac-personal-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-120.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch((err) => {
      // Don't fail installation if a single asset is missing (e.g. older deploy)
      console.warn('[sw] shell precache partial:', err);
    })
  );
  // Activate this worker immediately so updates take effect on next reload
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only GET; everything else hits the network directly
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppShellOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.endsWith('.supabase.co');
  const isCDN = url.hostname.includes('cdn.') || url.hostname.includes('jsdelivr') || url.hostname.includes('cloudflare') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic') || url.hostname.includes('unpkg') || url.hostname.includes('cdnjs');

  // Hands-off: Supabase and external CDNs — always go to network
  if (isSupabase || isCDN || !isAppShellOrigin) return;

  // Same-origin: cache-first with background revalidation (stale-while-revalidate)
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: false });
    const networkPromise = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (cached) {
      // Refresh in background — user gets the fast cached copy now
      networkPromise.catch(() => {});
      return cached;
    }
    const fresh = await networkPromise;
    return fresh || new Response('Offline — try again when online.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
