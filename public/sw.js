/*
 * CouplesCalendar service worker.
 *
 * Its whole job is to receive a push and show it, which is what makes a
 * notification arrive when the calendar is closed — a page can only be told
 * things while it is open.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "CouplesCalendar", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "CouplesCalendar";
  const options = {
    body: payload.body || "",
    icon: "/logo-mark.png",
    badge: "/logo-mark.png",
    tag: payload.tag || undefined,
    // Stay on screen until dismissed: a shared event is worth a decision.
    requireInteraction: payload.requireInteraction ?? true,
    data: { url: payload.url || "/calendar" },
    actions: [
      { action: "open", title: "See it in my calendar" },
      { action: "dismiss", title: "Later" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const target = (event.notification.data && event.notification.data.url) || "/calendar";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse a tab that is already open rather than piling up windows.
      for (const client of clients) {
        if (client.url.includes("/calendar") && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
