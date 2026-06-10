"use client";

import Link from "next/link";
import { AlertTriangle, Sparkles, CreditCard } from "lucide-react";
import { useSubscription } from "@/lib/api/billing";
import { describeSubscription, type SubSeverity } from "@/lib/subscription";
import { cn } from "@/lib/utils";

const STYLES: Record<Exclude<SubSeverity, "ok">, string> = {
  info: "border-accent/40 bg-accent/10 text-foreground",
  warning: "border-warning/45 bg-warning/10 text-warning-foreground",
  danger: "border-destructive/45 bg-destructive/10 text-destructive",
};

/**
 * Aviso persistente del estado de la suscripción (prueba/gracia/pago pendiente/bloqueo).
 * No se muestra cuando la suscripción está al día. Va arriba del panel del profesional.
 */
export function SubscriptionBanner() {
  const { data } = useSubscription();
  if (!data) return null;

  const info = describeSubscription(data);
  if (!info.showBanner || info.severity === "ok") return null;

  const Icon =
    info.severity === "info" ? Sparkles : info.severity === "warning" ? CreditCard : AlertTriangle;

  return (
    <div className={cn("border-b px-5 py-2.5 sm:px-8", STYLES[info.severity])}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5">
        <Icon className="size-4 shrink-0" />
        <p className="text-sm">
          <span className="font-medium">{info.title}.</span>{" "}
          <span className="opacity-90">{info.detail}</span>
        </p>
        <Link
          href="/app/suscripcion"
          className="ml-auto shrink-0 rounded-lg bg-foreground/90 px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          {info.blocked ? "Reactivar" : "Abonar"}
        </Link>
      </div>
    </div>
  );
}
