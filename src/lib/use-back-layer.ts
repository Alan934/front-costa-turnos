"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Integra pasos y modales con el botón "atrás" del navegador / del celular.
 *
 * Problema: los pasos de un flujo (p.ej. la reserva pública) y los modales son estado de React,
 * no navegaciones. Sin esto, "atrás" sale de la página — y si se entró desde un link de WhatsApp,
 * cierra el navegador.
 *
 * Solución: cada "capa" (un modal abierto, un paso más adentro de un flujo) agrega una entrada al
 * historial mientras está activa. Al tocar "atrás" el navegador vuelve a la entrada anterior y la
 * capa se cierra (llama a `onBack`). Si la capa se cierra por otro medio (la X, "Volver", Escape,
 * terminar el flujo), su entrada se saca sola del historial para no dejar "atrás" que no hacen nada.
 *
 * Las entradas se marcan en `history.state` con la pila de capas abiertas; el resto del estado
 * (incluido el interno de Next.js, `__NA` / árbol) se copia tal cual, así Next las trata como
 * entradas de la misma página.
 */

const LAYERS_KEY = "__backLayers";

type HistoryState = Record<string, unknown>;

function historyState(): HistoryState {
  const s: unknown = window.history.state;
  return s && typeof s === "object" ? (s as HistoryState) : {};
}

/** Capas abiertas según la entrada actual del historial (de abajo hacia arriba). */
function layerStack(): string[] {
  const v = historyState()[LAYERS_KEY];
  return Array.isArray(v) ? (v as string[]) : [];
}

/** Capas montadas y activas ahora mismo. */
const liveLayers = new Set<string>();

/**
 * Retroceso que dispara la app sola (para sacar entradas de capas ya cerradas). Lo ocultamos de
 * Next y del resto de los listeners: la entrada a la que volvemos es la misma página con el mismo
 * estado, y si Next lo viera como un "atrás" del usuario podría cancelar una navegación en curso
 * (p.ej. cerrar un modal y hacer router.push en el mismo click).
 */
let silentPop: { at: number; href: string } | null = null;
let swallowInstalled = false;

function installSwallow() {
  if (swallowInstalled) return;
  swallowInstalled = true;
  // En captura: en el propio `window` los listeners de captura corren antes que los demás.
  window.addEventListener(
    "popstate",
    (e) => {
      const pending = silentPop;
      if (!pending) return;
      silentPop = null;
      if (Date.now() - pending.at < 1500 && window.location.href === pending.href) {
        e.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
}

function silentGo(delta: number) {
  installSwallow();
  silentPop = { at: Date.now(), href: window.location.href };
  window.history.go(delta);
}

let unwindScheduled = false;

/**
 * Saca del historial las entradas de las capas de arriba que ya no están activas. En un microtask:
 * agrupa cierres simultáneos (modal + sub-vista) y tolera el desmontaje/montaje de StrictMode.
 */
function scheduleUnwind() {
  if (unwindScheduled) return;
  unwindScheduled = true;
  queueMicrotask(() => {
    unwindScheduled = false;
    const stack = layerStack();
    let dead = 0;
    for (let i = stack.length - 1; i >= 0 && !liveLayers.has(stack[i]); i--) dead++;
    if (dead > 0) silentGo(-dead);
  });
}

/**
 * Mientras `active` sea true, el botón "atrás" llama a `onBack` en vez de salir de la página.
 *
 * - Modales: `useBackLayer(open, () => setOpen(false))` (ya integrado en `<Dialog>`).
 * - Pasos: una capa por nivel, p.ej. `useBackLayer(step >= 2, () => setStep(1))`.
 *
 * `onBack` debe dejar `active` en false (o la entrada se pierde y la capa queda abierta).
 */
export function useBackLayer(active: boolean, onBack: () => void) {
  const id = useId();
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    liveLayers.add(id);
    const stack = layerStack();
    if (!stack.includes(id)) {
      window.history.pushState({ ...historyState(), [LAYERS_KEY]: [...stack, id] }, "");
    }

    const onPop = () => {
      if (!layerStack().includes(id)) onBackRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      liveLayers.delete(id);
      scheduleUnwind();
    };
  }, [active, id]);
}
