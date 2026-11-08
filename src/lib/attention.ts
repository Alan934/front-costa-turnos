/**
 * Avisos "dentro de la página" para cuando las notificaciones del navegador no están disponibles
 * (permiso bloqueado, navegador sin soporte, iPhone sin instalar la web). No necesitan ningún
 * permiso: sonido, vibración y pantalla encendida mientras la página siga abierta.
 *
 * Los navegadores no dejan reproducir audio hasta que la persona toca la página, por eso
 * `armAttention()` se llama desde un clic ("Activar sonido") y deja el audio listo para después.
 * A propósito NO mantiene la pantalla encendida: gastaría la batería del celular del cliente.
 */

const STORAGE_KEY = "turnerito.attention-armed";

let ctx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Un "ding-dong" corto hecho con osciladores: no hace falta ningún archivo de audio. */
function playChime() {
  const c = getContext();
  if (!c || c.state !== "running") return;
  const notes = [880, 660];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t0 = c.currentTime + i * 0.28;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  });
}

/** Se llama desde un clic: destraba el audio y pide mantener la pantalla encendida. */
export async function armAttention(): Promise<boolean> {
  const c = getContext();
  if (!c) return false;
  try {
    await c.resume();
  } catch {
    return false;
  }
  if (c.state !== "running") return false;
  playChime(); // confirmación audible: la persona sabe que va a escuchar el aviso
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* modo privado: no es crítico */
  }
  return true;
}

/** ¿Ya se destrabó el audio en esta pestaña? */
export function isAttentionArmed(): boolean {
  return !!ctx && ctx.state === "running";
}

export function wasAttentionArmed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Suena y vibra repetidamente hasta que se llame al `stop` que devuelve. */
export function startRinging(pattern: number[] = [300, 150, 300, 150, 300]): () => void {
  stopRinging();
  const fire = () => {
    playChime();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  };
  fire();
  ringTimer = setInterval(fire, 3500);
  return stopRinging;
}

export function stopRinging(): void {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
}

/** Un solo aviso corto (avance en la fila, alguien se anotó). */
export function beep(): void {
  playChime();
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
}
