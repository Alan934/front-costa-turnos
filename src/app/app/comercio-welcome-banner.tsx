"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PartyPopper, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Banner de bienvenida tras aceptar una invitación a un comercio. La landing de invitación
 * redirige a `/app?bienvenido=<NombreComercio>` (o `=1` si no se conoce el nombre). Aparece
 * una sola vez: al montar limpiamos el query param para que un refresh/back no lo reviva, y
 * el botón cerrar lo descarta. El nombre del comercio ya viene normalizado (titleCase).
 */
export function ComercioWelcomeBanner() {
  const router = useRouter();
  const params = useSearchParams();
  // Capturamos el valor inicial una sola vez; luego limpiamos la URL.
  const [comercio] = useState(() => params.get("bienvenido"));
  const [visible, setVisible] = useState(!!comercio);

  useEffect(() => {
    if (comercio) router.replace("/app");
  }, [comercio, router]);

  if (!visible) return null;

  const named = comercio && comercio !== "1";

  return (
    <div className="mb-8 flex items-start gap-4 rounded-2xl border border-accent/25 bg-accent/5 px-5 py-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
        <PartyPopper className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {named ? <>¡Bienvenido/a a {comercio}!</> : "¡Bienvenido/a al equipo!"}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ya formás parte del equipo. Vas a poder ver y configurar los comercios a los que
          pertenecés en cualquier momento.
        </p>
        <Button variant="outline" size="sm" asChild className="mt-3">
          <Link href="/app/comercios">
            Ver mis comercios
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => setVisible(false)}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
