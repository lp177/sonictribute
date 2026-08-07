/**
 * BOLT — Chrono Rush service worker.
 *
 * The VERSION and PRECACHE constants below are substituted at build time by the
 * plugin in vite.config.ts (see src/pwa/buildSw.ts), so the precache list
 * always matches the exact content-hashed filenames Rolldown emitted.
 *
 * Policy, in one line: serve from cache so the game is instant and playable
 * offline, but always ask the network whether a newer build exists — and let
 * the player decide when to take it, so a version never swaps mid-run.
 */

const VERSION = '75432175';
const CACHE = `bolt-${VERSION}`;
const PRECACHE = [
  "assets/index-BfJhXYWT.css",
  "assets/index-CY6BZtMJ.js",
  "favicon.svg",
  "index.html",
  "manifest.webmanifest"
];

/**
 * Resolve against the worker's own location, which is the deploy root. This is
 * what keeps the build location-independent (`/`, `/sonictribute/`, any
 * sub-path) exactly like Vite's `base: './'`.
 */
const at = (path) => new URL(path, self.location.href).href;
const INDEX = at('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(at))),
  );
  // Deliberately NO skipWaiting(): the new worker waits until the player
  // accepts the update, so the running game is never swapped underneath them.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every previous version's cache. Names are prefixed so a cache
      // belonging to another app on the same origin is never touched.
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('bolt-') && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Immutable by construction: a new build means a new hashed filename. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Instant from cache, refreshed in the background for the next load. */
function staleWhileRevalidate(event) {
  const request = event.request;
  return caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(request);
    const net = fetch(request)
      .then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => hit);
    // Keep the worker alive for the refresh even though we answered from cache.
    if (hit) event.waitUntil(net.catch(() => {}));
    return hit || net;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation asks for the directory ("/sonictribute/"), which never matches
  // the cached "index.html" entry by URL — so answer it explicitly. This is the
  // line that fixes "refresh gives me a stale game": the shell now comes from
  // our cache under our version control, not from whatever the CDN held.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(INDEX)) || fetch(request);
      })(),
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});

self.addEventListener('message', (event) => {
  // The page asks for the waiting worker to take over once the player accepts.
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
