"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PushError,
  pushSupport,
  subscribeBrowser,
  watchPermission,
  type PushFailureReason,
  type PushSupport,
} from "@/lib/push";

/** Qué salió mal: un motivo del navegador, o `server` si el aviso no se pudo guardar en el back. */
export type PushProblem = PushFailureReason | "server";

/**
 * Activación de avisos push compartida por el cliente (sala) y el profesional.
 *
 * - Si las notificaciones están bloqueadas o el navegador no puede, abre la guía (`helpOpen`) en
 *   lugar de mostrar un error genérico.
 * - Mientras espera que la persona las habilite desde los ajustes, retoma sola la activación
 *   apenas vuelve a la pestaña con el permiso concedido: no tiene que tocar nada más.
 */
export function usePushActivation({
  publicKey,
  save,
}: {
  publicKey: string | undefined;
  /** Guarda la suscripción en el back. Si lanza, se informa como `server`. */
  save: (sub: PushSubscriptionJSON) => Promise<unknown>;
}) {
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<PushProblem | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [done, setDone] = useState(false);

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const busyRef = useRef(false);
  /** Mostramos la guía de "desbloquear": al volver con permiso hay que terminar solos. */
  const waitingUnblock = useRef(false);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!publicKey || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const sub = await subscribeBrowser(publicKey);
      try {
        await saveRef.current(sub);
      } catch {
        setProblem("server");
        return false;
      }
      waitingUnblock.current = false;
      setHelpOpen(false);
      setDone(true);
      return true;
    } catch (e) {
      const reason = e instanceof PushError ? e.reason : "subscribe";
      setSupport(pushSupport());
      setProblem(reason);
      if (reason === "denied" || reason === "unsupported") {
        waitingUnblock.current = reason === "denied";
        setHelpOpen(true);
      }
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [publicKey]);

  useEffect(() => {
    setSupport(pushSupport());
    return watchPermission(() => {
      const next = pushSupport();
      setSupport(next);
      if (!waitingUnblock.current || next !== "ok") return;
      if (Notification.permission === "granted") {
        void enable();
      } else {
        // Lo dejó en "preguntar": ya no está bloqueado, el próximo toque vuelve a pedir permiso.
        waitingUnblock.current = false;
        setProblem(null);
        setHelpOpen(false);
      }
    });
  }, [enable]);

  return {
    support,
    busy,
    problem,
    /** `true` apenas se activó en esta sesión (el estado "ya suscripto" lo sabe el back). */
    done,
    helpOpen,
    openHelp: () => {
      waitingUnblock.current = support === "denied";
      setHelpOpen(true);
    },
    closeHelp: () => setHelpOpen(false),
    enable,
  };
}
