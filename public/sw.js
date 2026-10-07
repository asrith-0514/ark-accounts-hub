const CACHE_NAME = "ark-cache-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/favicon.png",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Non-fatal pre-cache so network/SSR issues never abort SW installation
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[SW] Cache pre-fetch warning:", err);
      });
    })
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass-through to network, fallback to cache if offline
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response("Offline - Service Unavailable", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain" }
        });
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let title = "ARK Accounts Hub";
  let body = "You have a new update in ARK Accounts Hub.";
  let icon = "/favicon.png";
  let url = "/notifications";
  let tag = "ark-notification-" + Date.now();

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.icon) icon = data.icon;
      if (data.url) url = data.url;
      if (data.tag) tag = data.tag;
    } catch {
      try {
        const text = event.data.text();
        if (text) body = text;
      } catch (e) {
        console.warn("[SW] Could not parse push payload as text:", e);
      }
    }
  }

  const options = {
    body,
    icon,
    tag,
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      url,
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification failed:", err);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
