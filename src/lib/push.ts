/**
 * Web Push en el navegador: permiso, registro del service worker y suscripción.
 * Solo corre en el cliente. La parte de servidor (a quién y qué avisar) vive en el back.
 */

export type PushSupport = "ok" | "unsupported" | "denied";

/** Por qué falló la activación: de eso depende qué le mostramos a la persona. */
export type PushFailureReason =
  /** Bloqueadas (ahora o desde antes): solo se arreglan desde los ajustes del navegador/celular. */
  | "denied"
  /** Cerró el cuadro de permiso sin elegir: se puede volver a pedir. */
  | "dismissed"
  /** El navegador no puede recibir push (iPhone sin instalar, navegador interno de una app, etc.). */
  | "unsupported"
  /** No se pudo registrar el service worker. */
  | "worker"
  /** El navegador rechazó la suscripción (servicio de push inaccesible, claves distintas, etc.). */
  | "subscribe";

export class PushError extends Error {
  constructor(
    readonly reason: PushFailureReason,
    cause?: unknown,
  ) {
    super(`push-${reason}`, { cause });
  }
}

const SW_URL = "/push-sw.js";
// Scope propio: no choca con el service worker de MSW (modo mocks), que usa la raíz.
const SW_SCOPE = "/push-sw/";
const SW_ACTIVATE_TIMEOUT_MS = 10_000;

/** ¿Este navegador puede recibir push? En iPhone solo si la web está instalada en la pantalla de inicio. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : "ok";
}

export type PushPlatform = "ios" | "android" | "desktop";
export type PushBrowser = "chrome" | "safari" | "firefox" | "edge" | "samsung" | "other";

export interface PushEnv {
  platform: PushPlatform;
  browser: PushBrowser;
  /** Navegador interno de otra app (Instagram, WhatsApp, Facebook…): casi nunca permite push. */
  inApp: boolean;
  /** La web está instalada en la pantalla de inicio (en iPhone es lo que habilita el push). */
  standalone: boolean;
}

/** Dónde estamos corriendo, para explicar el camino exacto a los ajustes de cada navegador. */
export function detectEnv(): PushEnv {
  // En Node 21+ `navigator` existe en el servidor pero `window` no: se chequean los dos.
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: "desktop", browser: "other", inApp: false, standalone: false };
  }
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const platform: PushPlatform = ios ? "ios" : android ? "android" : "desktop";

  const inApp =
    /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|MicroMessenger|Twitter|LinkedInApp/i.test(ua) ||
    (android && /; wv\)/.test(ua));

  const browser: PushBrowser = /SamsungBrowser/i.test(ua)
    ? "samsung"
    : /Edg(e|A|iOS)?\//.test(ua)
      ? "edge"
      : /Firefox|FxiOS/.test(ua)
        ? "firefox"
        : /Chrome|CriOS/.test(ua)
          ? "chrome"
          : /Safari/.test(ua)
            ? "safari"
            : "other";

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return { platform, browser, inApp, standalone };
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return true; // no se puede comparar: se asume igual
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((b, i) => b === key[i]);
}

/**
 * Registra el service worker y espera a que esté activo (`ready` no sirve con scope propio).
 * Revisa el estado ya al empezar: si se activó entre el `register` y el listener, el evento
 * `statechange` no vuelve a llegar y la espera quedaba colgada para siempre.
 */
async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (reg.active) return reg;
  const sw = reg.installing ?? reg.waiting;
  if (!sw) return reg;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("sw-timeout")), SW_ACTIVATE_TIMEOUT_MS);
    const check = () => {
      if (sw.state === "activated") {
        clearTimeout(timer);
        resolve();
      } else if (sw.state === "redundant") {
        clearTimeout(timer);
        reject(new Error("sw-redundant"));
      }
    };
    sw.addEventListener("statechange", check);
    check();
  });
  return reg;
}

/** `requestPermission` con callback (Safari viejo) o promesa (el resto). */
function requestPermission(): Promise<NotificationPermission> {
  return new Promise((resolve, reject) => {
    try {
      const result = Notification.requestPermission(resolve);
      if (result && typeof result.then === "function") result.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Pide permiso (tiene que ser desde un gesto del usuario: un clic) y suscribe este
 * navegador. Devuelve la suscripción lista para mandar al back. Si ya había permiso no vuelve a
 * preguntar, así que también sirve para completar la activación apenas se desbloquea desde los
 * ajustes. Los fallos salen como {@link PushError} con el motivo.
 */
export async function subscribeBrowser(publicKey: string): Promise<PushSubscriptionJSON> {
  if (pushSupport() === "unsupported") throw new PushError("unsupported");

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await requestPermission();
    } catch (e) {
      throw new PushError("unsupported", e);
    }
  }
  if (permission === "denied") throw new PushError("denied");
  if (permission !== "granted") throw new PushError("dismissed");

  let reg: ServiceWorkerRegistration;
  try {
    reg = await registerWorker();
  } catch (e) {
    throw new PushError("worker", e);
  }

  try {
    const key = urlBase64ToUint8Array(publicKey);
    let sub = await reg.pushManager.getSubscription();
    // Una suscripción hecha con otras claves VAPID no sirve: hay que rehacerla.
    if (sub && !sameKey(sub, key)) {
      await sub.unsubscribe();
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    return sub.toJSON();
  } catch (e) {
    // Chrome responde "permission denied" acá si el permiso se bloqueó mientras tanto.
    if (Notification.permission === "denied") throw new PushError("denied", e);
    throw new PushError("subscribe", e);
  }
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

/**
 * Quita de la bandeja las notificaciones con esas `tag`. El "¡Es tu turno!" es permanente
 * (`requireInteraction`): si no se cierra, queda ahí aunque la persona ya esté siendo atendida.
 */
export async function closeNotifications(tags: string[]): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const shown = (await reg?.getNotifications()) ?? [];
    for (const n of shown) if (tags.includes(n.tag)) n.close();
  } catch {
    /* no es crítico: la notificación se va sola o con el próximo toque */
  }
}

/**
 * Avisa cuando cambia el permiso de notificaciones, para retomar la activación apenas la persona
 * lo habilita desde los ajustes y vuelve a la pestaña (sin que tenga que tocar nada más).
 * Devuelve la función que deja de escuchar.
 */
export function watchPermission(onChange: () => void): () => void {
  let status: PermissionStatus | null = null;
  let cancelled = false;
  navigator.permissions
    ?.query({ name: "notifications" })
    .then((s) => {
      if (cancelled) return;
      status = s;
      s.addEventListener("change", onChange);
    })
    .catch(() => {
      /* Safari viejo: nos quedan focus y visibilitychange */
    });
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    cancelled = true;
    status?.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}
