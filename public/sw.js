const CACHE_NAME = "wacrm-pwa-static-v1";
const CACHE_PREFIX = "wacrm-pwa-";
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/apple-icon",
  "/pwa/icon-192",
  "/pwa/icon-512",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldCache(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (request.mode === "navigate") return false;

  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/opus/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/icon"
  );
}

self.addEventListener("fetch", (event) => {
  if (!shouldCache(event.request)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      });
    }),
  );
});
