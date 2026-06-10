import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { getStatusMeta, STATUS_CLASSES } from "@/lib/appointment-status";

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
  /**
   * Turno sin seña en modo híbrido: provisional, puede ser tomado por quien abone.
   * Solo aplica cuando el estado es "Esperando".
   */
  isProvisional?: boolean;
  className?: string;
}

/**
 * Único punto que traduce un estado del contrato a su etiqueta + color de token.
 * Incluye el matiz "provisional" para el modo de seña híbrido (clave del brief).
 */
export function AppointmentStatusBadge({
  status,
  isProvisional = false,
  className,
}: AppointmentStatusBadgeProps) {
  const { uiKey, label } = getStatusMeta(status);
  const showProvisional = isProvisional && uiKey === "waiting";
  // El turno provisional toma el tono "cancelled" (rosa) para distinguirse del
  // "Esperando" confirmado, sin inventar un color nuevo.
  const visualKey = showProvisional ? "cancelled" : uiKey;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[visualKey],
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-70"
      />
      {showProvisional ? "Provisional" : label}
    </span>
  );
}
