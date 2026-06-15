"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve `value` con un retraso de `delayMs`: solo se actualiza cuando el valor de
 * entrada se mantiene estable ese tiempo. Útil para no disparar un fetch por cada tecla
 * en un buscador (las listas de admin filtran server-side por `q`).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
