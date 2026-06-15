"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { env } from "@/lib/env";

/**
 * Arranca MSW en el navegador cuando NEXT_PUBLIC_API_MOCKING === "enabled".
 * Mientras el worker se registra mostramos un splash de marca (no pantalla en blanco).
 * Si MSW tarda demasiado (o falla), desbloqueamos igual a los 2.5s: preferimos mostrar
 * la UI a quedarnos colgados; las queries reintentanán contra el worker ya activo.
 */
export function MswProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!env.mockingEnabled);

  useEffect(() => {
    if (!env.mockingEnabled) return;
    let active = true;
    const fallback = setTimeout(() => active && setReady(true), 1500);

    (async () => {
      try {
        const { worker } = await import("@/mocks/browser");
        await worker.start({ onUnhandledRequest: "bypass", quiet: true });
      } catch {
        // Si el worker no arranca, seguimos contra la API real / dejamos pasar.
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
      clearTimeout(fallback);
    };
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LogoMark size="xl" className="animate-pulse shadow-md" />
          <p className="font-display text-lg tracking-tight">Costa Turnos</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
