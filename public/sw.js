const CACHE_NAME = "tipovacka-v1";
const OFFLINE_FALLBACK = "/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for page navigations, falling back to the last cached
// copy of that page (arena wifi/data tends to die mid-gala). Only GET
// navigations are handled - API calls, Supabase, and assets keep their
// default behavior.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached ?? caches.match(OFFLINE_FALLBACK);
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
