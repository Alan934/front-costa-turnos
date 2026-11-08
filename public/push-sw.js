/* Service worker de Web Push de Costa Turnos.
 *
 * Solo maneja notificaciones: no intercepta fetch ni cachea nada. Se registra con un
 * scope propio ("/push-sw/") para no pisar al service worker de MSW (modo mocks), que
 * ocupa el scope raíz: Web Push funciona igual sin importar el scope. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Costa Turnos";
  const isCall = data.tag === "sala-llamado";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // Misma tag = la notificación nueva reemplaza a la anterior (no se apilan "estás segundo").
      tag: data.tag,
      renotify: Boolean(data.tag),
      vibrate: data.vibrate,
      icon: "/logo-mark.svg",
      badge: "/logo-badge.svg",
      // El llamado no debe desaparecer solo: la persona puede tardar unos segundos en mirar.
      requireInteraction: isCall,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Si ya tiene la pantalla abierta, se la trae al frente en vez de abrir otra pestaña.
      for (const w of windows) {
        if (w.url === target && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
