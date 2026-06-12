"use client";

import { CalendarX2 } from "lucide-react";
import { EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { personDisplayName, isSameLocalDay } from "@/lib/agenda";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Service } from "@/lib/api/generated/model/service";
import type { Staff } from "@/lib/api/generated/model/staff";

/**
 * Vista del día como lista de tarjetas, ordenada por hora. Reemplaza a la grilla horaria para
 * que el profesional vea todos los turnos de un vistazo, sin scrollear las horas.
 */
export function DayList({
  date,
  appointments,
  services,
  staff,
  onSelect,
}: {
  date: Date;
  appointments: Appointment[];
  services: Service[];
  staff: Staff[];
  onSelect: (a: Appointment) => void;
}) {
  const items = appointments
    .filter((a) => isSameLocalDay(new Date(a.startAt), date))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  const multiStaff = staff.length > 1;
  const active = items.filter((a) => a.status !== "cancelled").length;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <EmptyState
          icon={<CalendarX2 className="size-5" />}
          title="Día libre"
          message="No hay turnos cargados para este día. Creá uno con “Nuevo turno”."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{active}</span>{" "}
        {active === 1 ? "turno" : "turnos"} este día
      </p>
      <ul className="space-y-2">
        {items.map((a) => {
          const service = services.find((s) => s.id === a.serviceId);
          const staffName = staff.find((s) => s.id === a.staffId)?.displayName;
          const cancelled = a.status === "cancelled";
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-accent",
                  cancelled && "opacity-60",
                )}
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="font-display text-base font-semibold tabular-nums">
                    {formatTime(a.startAt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatTime(a.endAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{personDisplayName(a.personId)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {service?.name ?? "Servicio"}
                    {multiStaff && staffName ? ` · ${staffName}` : ""}
                  </p>
                </div>
                <AppointmentStatusBadge status={a.status} isProvisional={a.isProvisional} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
