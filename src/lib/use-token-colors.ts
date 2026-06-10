"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

/**
 * Lee colores de los tokens CSS (oklch resuelto) para pasárselos a Recharts, que no
 * entiende variables CSS en algunas props. Se recalcula al cambiar de tema.
 */
export function useTokenColors() {
  const { resolved } = useTheme();
  const [colors, setColors] = useState({
    accent: "#16707a",
    foreground: "#1a1a1a",
    muted: "#8a8a8a",
    border: "#e5e5e5",
    serving: "#3aa18f",
    waiting: "#c08a3c",
    done: "#6f9a55",
    cancelled: "#b85a72",
  });

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    setColors({
      accent: v("--accent", "#16707a"),
      foreground: v("--foreground", "#1a1a1a"),
      muted: v("--muted-foreground", "#8a8a8a"),
      border: v("--border", "#e5e5e5"),
      serving: v("--status-serving-foreground", "#3aa18f"),
      waiting: v("--status-waiting-foreground", "#c08a3c"),
      done: v("--status-done-foreground", "#6f9a55"),
      cancelled: v("--status-cancelled-foreground", "#b85a72"),
    });
  }, [resolved]);

  return colors;
}
