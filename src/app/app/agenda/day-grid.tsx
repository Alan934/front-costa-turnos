"use client";

import { EmptyState } from "@/components/state-views";
import {
  gridHours,
  positionAppointment,
  isSameLocalDay,
  personDisplayName,
  HOUR_PX,
  DAY_START_HOUR,
  DAY_END_HOUR,
} from "@/lib/agenda";
import { AppointmentChip } from "./appointment-chip";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Service } from "@/lib/api/generated/model/service";
import type { Staff } from "@/lib/api/generated/model/staff";

/** Vista de día: columna de horas + una columna por staff (multi-sillón). */
export function DayGrid({
  date,
  staff,
  appointments,
  services,
  onSelect,
}: {
  date: Date;
  staff: Staff[];
  appointments: Appointment[];
  services: Service[];
  onSelect: (a: Appointment) => void;
}) {
  const hours = gridHours();
  const totalHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;
  const dayAppts = appointments.filter((a) => isSameLocalDay(new Date(a.startAt), date));

  if (staff.length === 0) {
    return <EmptyState title="Sin profesionales" className="m-6" />;
  }

  return (
    <div className="flex min-w-fit">
      {/* Columna de horas */}
      <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-background">
        <div className="h-10 border-b border-border" />
        <div className="relative" style={{ height: totalHeight }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
              style={{ top: i * HOUR_PX }}
            >
              {h}:00
            </div>
          ))}
        </div>
      </div>

      {/* Columnas por staff */}
      <div className="flex flex-1">
        {staff.map((s) => {
          const cols = dayAppts.filter((a) => a.staffId === s.id);
          return (
            <div
              key={s.id}
              className="min-w-[180px] flex-1 border-r border-border last:border-r-0"
            >
              <div className="sticky top-0 z-10 flex h-10 items-center justify-center border-b border-border bg-background px-2 text-sm font-medium">
                {s.displayName}
              </div>
              <div className="relative" style={{ height: totalHeight }}>
                {/* Líneas de hora */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: i * HOUR_PX }}
                  />
                ))}
                {/* Turnos */}
                {cols.map((a) => {
                  const pos = positionAppointment(a);
                  return (
                    <AppointmentChip
                      key={a.id}
                      appointment={a}
                      service={services.find((sv) => sv.id === a.serviceId)}
                      top={pos.top}
                      height={pos.height}
                      personName={personDisplayName(a.personId)}
                      onClick={() => onSelect(a)}
                    />
                  );
                })}
                {cols.length === 0 && (
                  <p className="absolute inset-x-0 top-6 text-center text-xs text-muted-foreground">
                    Sin turnos
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
