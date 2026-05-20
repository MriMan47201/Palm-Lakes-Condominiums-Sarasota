/**
 * Palm Lakes PWA — Service Worker
 *
 * Strategy: Cache-First for static frontend assets only.
 *
 * IMPORTANT: This worker deliberately does NOT cache:
 *   - /api/* requests (live property data — always fetched from the network)
 *   - AsyncStorage / IndexedDB entries (personal notes live exclusively in
 *     the browser's local storage APIs, completely outside this cache)
 *   - Any request that is not a GET for a same-origin static asset
 */

const CACHE_NAME = "palm-lakes-v1";

/** Static shell assets to pre-cache on install */
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// ---------------------------------------------------------------------------
// Install — pre-cache the app shell
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  console.log("[SW] Installing and pre-caching static shell…");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log("[SW] Static shell cached successfully.");
        return self.skipWaiting();
      })
      .catch((err) => console.error("[SW] Pre-cache failed:", err))
  );
});

// ---------------------------------------------------------------------------
// Activate — purge stale caches from older SW versions
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating and clearing old caches…");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
      .catch((err) => console.error("[SW] Activation error:", err))
  );
});

// ---------------------------------------------------------------------------
// Fetch — intercept requests
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // --- BYPASS: API calls --- never cache dynamic property data or user data
  if (url.pathname.startsWith("/api")) {
    // Let the request go straight to the network with no SW involvement
    return;
  }

  // --- BYPASS: cross-origin requests (CDNs, fonts, etc.) ---
  if (url.origin !== self.location.origin) {
    return;
  }

  // --- Cache-First for same-origin static assets ---
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          // Only cache valid 200 responses
          if (!response || response.status !== 200) {
            return response;
          }
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
            .catch((err) => console.warn("[SW] Cache put failed:", err));
          return response;
        })
        .catch(() => {
          // Offline fallback — return the cached root for navigation requests
          if (request.mode === "navigate") {
            console.warn("[SW] Offline — serving cached root for:", url.pathname);
            return caches.match("/");
          }
        });
    })
  );
});
