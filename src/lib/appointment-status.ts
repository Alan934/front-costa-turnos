import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";

/** Categorías visibles en la UI (el brief pide 5; el contrato tiene 6 estados). */
export type StatusUiKey = "waiting" | "serving" | "done" | "noshow" | "cancelled";

interface StatusMeta {
  uiKey: StatusUiKey;
  label: string;
}

/**
 * Mapeo único contrato → etiqueta UI. `requested` y `confirmed` comparten "Esperando";
 * el matiz provisional vs. confirmado se resuelve con el flag `isProvisional` aparte.
 */
const STATUS_META: Record<AppointmentStatus, StatusMeta> = {
  [AppointmentStatus.requested]: { uiKey: "waiting", label: "Esperando" },
  [AppointmentStatus.confirmed]: { uiKey: "waiting", label: "Esperando" },
  [AppointmentStatus.in_progress]: { uiKey: "serving", label: "En atención" },
  [AppointmentStatus.done]: { uiKey: "done", label: "Atendido" },
  [AppointmentStatus.no_show]: { uiKey: "noshow", label: "No vino" },
  [AppointmentStatus.cancelled]: { uiKey: "cancelled", label: "Cancelado" },
};

export function getStatusMeta(status: AppointmentStatus): StatusMeta {
  return STATUS_META[status] ?? { uiKey: "waiting", label: status };
}

/** Clases de token por categoría (fondo suave + texto). */
export const STATUS_CLASSES: Record<StatusUiKey, string> = {
  waiting: "bg-status-waiting text-status-waiting-foreground",
  serving: "bg-status-serving text-status-serving-foreground",
  done: "bg-status-done text-status-done-foreground",
  noshow: "bg-status-noshow text-status-noshow-foreground",
  cancelled: "bg-status-cancelled text-status-cancelled-foreground",
};
