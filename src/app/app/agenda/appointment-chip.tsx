"use client";

import { getStatusMeta, STATUS_CLASSES } from "@/lib/appointment-status";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Service } from "@/lib/api/generated/model/service";

/** Bloque de turno dentro de la grilla, coloreado por estado y posicionado por hora. */
export function AppointmentChip({
  appointment,
  service,
  top,
  height,
  personName,
  onClick,
  compact,
}: {
  appointment: Appointment;
  service?: Service;
  top: number;
  height: number;
  personName: string;
  onClick: () => void;
  compact?: boolean;
}) {
  const { uiKey } = getStatusMeta(appointment.status);
  const visualKey =
    appointment.isProvisional && uiKey === "waiting" ? "cancelled" : uiKey;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ top, height: Math.max(height, 22) }}
      className={cn(
        "absolute left-1 right-1 overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left transition-shadow hover:shadow-md",
        STATUS_CLASSES[visualKey],
      )}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">
        {formatTime(appointment.startAt)} · {personName}
      </p>
      {!compact && height > 34 && service && (
        <p className="truncate text-[11px] leading-tight opacity-80">{service.name}</p>
      )}
    </button>
  );
}
