"use client";

import { useEffect, useState } from "react";

/**
 * La fecha de "hoy" que se actualiza sola al pasar la medianoche (y al volver a la pestaña).
 * Para pantallas que quedan abiertas todo el día, como una tablet en el local: sin esto, el Inicio
 * seguía mostrando el día anterior.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refresh = () =>
      setToday((prev) => (new Date().toDateString() === prev.toDateString() ? prev : new Date()));

    // Un toque después de la próxima medianoche local.
    const next = new Date(today);
    next.setHours(24, 0, 5, 0);
    const timer = setTimeout(refresh, next.getTime() - Date.now());

    // Si la pestaña estuvo en segundo plano (el navegador demora los timers), se revisa al volver.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [today]);

  return today;
}
