// v2: navigation caching removed. The network-first fetch handler that
// briefly lived here broke page loads in Safari ("This page couldn't
// load" on first navigation, fine after a refresh) - a SW intercepting
// navigations is riskier than the offline nicety was worth. This worker
// only handles push notifications; activate cleans up the old cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
