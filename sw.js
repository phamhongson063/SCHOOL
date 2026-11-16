const ASSETS = {};
const CACHE = 'assets';
const scope = new URL(self.registration.scope);

const keyOf = (path) => new URL(`${path}?v=${ASSETS[path]}`, scope).href;

async function prune() {
  const wanted = new Set(Object.keys(ASSETS).map(keyOf));
  const cache = await caches.open(CACHE);
  const stale = (await cache.keys()).filter((request) => !wanted.has(request.url));
  await Promise.all(stale.map((request) => cache.delete(request)));
}

async function fromCache(event, key) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(event.request.url, { cache: 'no-cache' });
  if (response.ok && response.type === 'basic') event.waitUntil(cache.put(key, response.clone()));
  return response;
}

function assetPath(request) {
  if (request.method !== 'GET' || request.headers.has('range')) return null;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null;
  const path = url.pathname.slice(scope.pathname.length);
  return Object.hasOwn(ASSETS, path) ? path : null;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([self.clients.claim(), prune().catch(() => {})])));
self.addEventListener('fetch', (event) => {
  const path = assetPath(event.request);
  if (path) event.respondWith(fromCache(event, keyOf(path)).catch(() => fetch(event.request)));
});
