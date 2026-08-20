// Service Worker for NightWave PWA — v2
// Strategy:
//   - App shell (HTML/JS/CSS/icons): Cache-first, fallback to network
//   - API requests (/api/*): Network-only (never cache audio/search)
//   - YouTube iframe: Network-only (cross-origin, not cacheable)
//   - Navigation: Serve cached index.html for offline support

const CACHE_NAME = "nightwave-v2";

// Core app shell assets to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.svg",
];

// ── Install: pre-cache app shell ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: route requests intelligently ─────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept API calls — always go to network
  if (url.pathname.startsWith("/api/")) {
    return; // fall through to browser default (network)
  }

  // 2. Never intercept cross-origin requests (YouTube, Google Fonts, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Navigation requests — serve app shell (enables offline + PWA install)
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then(
        (cached) => cached || fetch(request)
      )
    );
    return;
  }

  // 4. App shell assets — cache-first, fallback to network, then cache response
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResponse) => {
        // Only cache successful same-origin GET responses
        if (
          networkResponse.ok &&
          request.method === "GET" &&
          !url.pathname.startsWith("/api/")
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(request, responseClone)
          );
        }
        return networkResponse;
      });
    })
  );
});
