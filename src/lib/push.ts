/**
 * Web Push en el navegador: permiso, registro del service worker y suscripción.
 * Solo corre en el cliente. La parte de servidor (a quién y qué avisar) vive en el back.
 */

export type PushSupport = "ok" | "unsupported" | "denied";

const SW_URL = "/push-sw.js";
// Scope propio: no choca con el service worker de MSW (modo mocks), que usa la raíz.
const SW_SCOPE = "/push-sw/";

/** ¿Este navegador puede recibir push? En iPhone solo si la web está instalada en la pantalla de inicio. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : "ok";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registra el service worker y espera a que esté activo (ready no sirve con scope propio). */
async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (reg.active) return reg;
  const sw = reg.installing ?? reg.waiting;
  if (!sw) return reg;
  await new Promise<void>((resolve) => {
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") resolve();
    });
  });
  return reg;
}

export class PushPermissionDenied extends Error {
  constructor() {
    super("permission-denied");
  }
}

/**
 * Pide permiso (tiene que ser desde un gesto del usuario: un clic) y suscribe este
 * navegador. Devuelve la suscripción lista para mandar al back.
 */
export async function subscribeBrowser(publicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushPermissionDenied();
  const reg = await registerWorker();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  return sub.toJSON();
}

/** Endpoint de la suscripción actual de este navegador, si hay. */
export async function currentEndpoint(): Promise<string | null> {
  if (pushSupport() === "unsupported") return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

export async function unsubscribeBrowser(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}
