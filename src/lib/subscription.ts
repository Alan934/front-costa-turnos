import type { Subscription } from "@/lib/api/generated/model/subscription";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";

export type SubSeverity = "ok" | "info" | "warning" | "danger";

export interface SubInfo {
  status: SubscriptionStatus;
  severity: SubSeverity;
  /** Bloquea la escritura (no puede crear/editar). El back devuelve 403 igual. */
  blocked: boolean;
  /** Título corto para banner/pantalla. */
  title: string;
  /** Detalle (días restantes, etc.). */
  detail: string;
  /** Días restantes hasta el hito relevante (prueba/gracia/cobro). */
  daysLeft: number | null;
  /** Conviene mostrar un aviso persistente. */
  showBanner: boolean;
}

/** Días enteros entre hoy y una fecha ISO (puede ser negativo si ya pasó). */
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/**
 * Fecha "fin" relevante según el estado, con su etiqueta. En trial el `currentPeriodEnd`
 * suele venir null, así que mostramos el fin de la prueba; en gracia, el fin de la gracia.
 */
export function subscriptionEndInfo(sub: Subscription): { label: string; date: string | null } {
  if (sub.status === SubscriptionStatus.trial) {
    return { label: "Prueba hasta", date: sub.trialEndsAt ?? sub.currentPeriodEnd ?? null };
  }
  if (sub.status === SubscriptionStatus.grace) {
    return { label: "Gracia hasta", date: sub.graceEndsAt ?? sub.currentPeriodEnd ?? null };
  }
  return { label: "Próximo cobro", date: sub.currentPeriodEnd ?? null };
}

const plural = (n: number, s: string, p = `${s}s`) => (n === 1 ? s : p);

/** Resume el estado de la suscripción para la UI (banner, gate y pantalla de pago). */
export function describeSubscription(sub: Subscription): SubInfo {
  const status = sub.status;

  if (status === SubscriptionStatus.trial) {
    const d = daysUntil(sub.trialEndsAt) ?? 0;
    return {
      status,
      severity: d <= 3 ? "warning" : "info",
      blocked: false,
      title: "Estás en período de prueba",
      detail:
        d > 0
          ? `Te ${plural(d, "queda", "quedan")} ${d} ${plural(d, "día")} de prueba gratis.`
          : "Tu prueba gratis termina hoy.",
      daysLeft: d,
      showBanner: true,
    };
  }

  if (status === SubscriptionStatus.grace) {
    const d = daysUntil(sub.graceEndsAt) ?? 0;
    return {
      status,
      severity: "danger",
      blocked: false,
      title: "Tu pago está pendiente",
      detail:
        d > 0
          ? `Tenés ${d} ${plural(d, "día")} de gracia antes de que se bloquee la agenda. Aboná para no cortar el servicio.`
          : "Hoy vence la gracia. Aboná para no perder el acceso.",
      daysLeft: d,
      showBanner: true,
    };
  }

  if (status === SubscriptionStatus.past_due) {
    return {
      status,
      severity: "warning",
      blocked: false,
      title: "No pudimos cobrar tu suscripción",
      detail: "Revisá tu medio de pago y volvé a abonar para mantener todo activo.",
      daysLeft: null,
      showBanner: true,
    };
  }

  if (status === SubscriptionStatus.blocked) {
    return {
      status,
      severity: "danger",
      blocked: true,
      title: "Tu suscripción está vencida",
      detail:
        "La agenda está bloqueada: podés ver pero no crear ni editar. Aboná para reactivarla.",
      daysLeft: null,
      showBanner: true,
    };
  }

  if (status === SubscriptionStatus.cancelled) {
    return {
      status,
      severity: "danger",
      blocked: true,
      title: "Tu suscripción está dada de baja",
      detail: "Reactivá tu plan para volver a usar el sistema.",
      daysLeft: null,
      showBanner: true,
    };
  }

  // active
  const d = daysUntil(sub.currentPeriodEnd);
  return {
    status,
    severity: "ok",
    blocked: false,
    title: "Suscripción activa",
    detail: d != null ? `Próximo cobro en ${d} ${plural(d, "día")}.` : "Tu plan está al día.",
    daysLeft: d,
    showBanner: false,
  };
}
