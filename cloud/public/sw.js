// Service Worker for Jarvis Bob Web Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Jarvis Bob", body: event.data.text() };
    }
  }

  const title = data.title || "⚠️ Jarvis precisa da sua aprovação";
  const options = {
    body: data.body || "Uma ferramenta solicitou autorização no seu Mac.",
    icon: "/pwa-icon/192",
    badge: "/pwa-icon/192",
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || "/aprovacoes",
    },
    tag: data.tag || "jarvis-approval",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/aprovacoes";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
