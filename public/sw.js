// v3: conservative static-asset caching + push. We deliberately do NOT
// intercept navigations - a navigation fetch handler previously broke first
// page loads in Safari ("This page couldn't load"), and iOS is our main
// platform, so it's not worth the risk. This worker only caches same-origin
// STATIC sub-resources (Next's hashed JS/CSS, images, fonts, the icon), which
// speeds up repeat loads and survives flaky arena wifi for anything already
// fetched. Hashed filenames mean a new deploy simply misses the cache and
// hits the network, so users are never stuck on a stale build.
const CACHE = "static-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for static sub-resources only. Navigations, cross-origin
// requests, and non-GET requests fall through to the browser untouched.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") return; // never intercept page loads

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const cacheable =
    ["style", "script", "image", "font"].includes(request.destination) ||
    url.pathname === "/icon" ||
    url.pathname.startsWith("/_next/static/");
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Only cache clean, complete same-origin responses.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "OKTAGON GARÁŽ Tipovačka", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "OKTAGON GARÁŽ Tipovačka";
  const options = {
    body: data.body || "",
    icon: "/icon",
    badge: "/icon",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        // Match on the exact path, not a substring - "/events/x" must
        // not focus a window sitting on "/admin/events/x".
        if (new URL(client.url).pathname === url.split("?")[0] && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
