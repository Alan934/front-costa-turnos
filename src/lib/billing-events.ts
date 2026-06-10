/**
 * Bus mínimo para avisar a la UI que el backend rechazó una escritura por suscripción
 * vencida (403 con mensaje de suscripción). Lo emite el interceptor de axios y lo escucha
 * <SubscriptionGate>. Se mantiene fuera de React para poder dispararlo desde el mutator.
 */
type Listener = (message: string) => void;

const listeners = new Set<Listener>();

/** Heurística: distingue el 403 de suscripción del 403 de permisos por el mensaje. */
export function isSubscriptionForbidden(status?: number, message?: string): boolean {
  if (status !== 403) return false;
  const m = (message ?? "").toLowerCase();
  return m.includes("suscrip") || m.includes("prueba") || m.includes("agenda no esta disponible");
}

export function emitSubscriptionBlocked(message: string) {
  for (const l of listeners) l(message);
}

export function onSubscriptionBlocked(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
