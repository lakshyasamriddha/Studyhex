// StudyReck service worker — caches the static app shell so the app
// opens instantly even on a slow connection. API calls (/api/...) always
// go to the network, since that data has to stay live.

const CACHE_NAME = "studyreck-shell-v1";

const SHELL_FILES = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/profile.html",
  "/leaderboard.html",
  "/forum.html",
  "/css/style.css",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always hit the network for live data.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Static shell files: cache-first, falling back to network.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Cache newly-fetched static files for next time.
          if (event.request.method === "GET" && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    })
  );
});
