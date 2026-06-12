"use client";

import Link from "next/link";
import { AlertTriangle, Sparkles, CreditCard } from "lucide-react";
import { useSubscription } from "@/lib/api/billing";
import { describeSubscription, type SubSeverity } from "@/lib/subscription";
import { cn } from "@/lib/utils";

const STYLES: Record<Exclude<SubSeverity, "ok">, { card: string; accent: string }> = {
  info: { card: "border-accent/40", accent: "text-accent" },
  warning: { card: "border-warning/50", accent: "text-warning-foreground" },
  danger: { card: "border-destructive/50", accent: "text-destructive" },
};

/**
 * Aviso del estado de la suscripción (prueba/gracia/pago pendiente/bloqueo). No se muestra
 * cuando está al día. Va como tarjeta flotante FIJA al pie: sigue el scroll y queda siempre
 * visible (antes quedaba arriba y se perdía al scrollear). Deja pasar los clics alrededor.
 */
export function SubscriptionBanner() {
  const { data } = useSubscription();
  if (!data) return null;

  const info = describeSubscription(data);
  if (!info.showBanner || info.severity === "ok") return null;

  const Icon =
    info.severity === "info" ? Sparkles : info.severity === "warning" ? CreditCard : AlertTriangle;
  const style = STYLES[info.severity];

  return (
    <>
      {/* Reserva espacio al pie para que la tarjeta fija no tape el contenido final. */}
      <div aria-hidden className="h-24" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-3 sm:p-4">
        <div
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-xl border bg-card p-3.5 shadow-lg",
            style.card,
          )}
          role="status"
        >
          <div className="flex items-start gap-2.5">
            <Icon className={cn("mt-0.5 size-5 shrink-0", style.accent)} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", style.accent)}>{info.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{info.detail}</p>
              <Link
                href="/app/suscripcion"
                className="mt-2.5 inline-block rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
              >
                {info.blocked ? "Reactivar" : "Abonar"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
