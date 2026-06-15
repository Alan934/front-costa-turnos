"use client";

import { CalendarX2, CalendarOff } from "lucide-react";
import { EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import {
  isSameLocalDay,
  closedWeekdays,
  dayOffStatus,
} from "@/lib/agenda";
import type { PersonInfo } from "@/lib/api/clients";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";
import type { Appointment } from "@/lib/api/generated/model/appointment";

/**
 * Vista del día como lista de tarjetas, ordenada por hora. Reemplaza a la grilla horaria para
 * que el profesional vea todos los turnos de un vistazo, sin scrollear las horas.
 */
export function DayList({
  date,
  appointments,
  services,
  staff,
  scheduleRules,
  timeOff,
  lookupPerson,
  onSelect,
}: {
  date: Date;
  appointments: Appointment[];
  services: Service[];
  staff: Staff[];
  scheduleRules: ScheduleRule[];
  timeOff: TimeOff[];
  lookupPerson: (personId: string, embeddedName?: string) => PersonInfo;
  onSelect: (a: Appointment) => void;
}) {
  const items = appointments
    .filter((a) => isSameLocalDay(new Date(a.startAt), date))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  const multiStaff = staff.length > 1;
  const active = items.filter((a) => a.status !== "cancelled").length;
  const off = dayOffStatus(date, closedWeekdays(scheduleRules), timeOff);

  // Día sin atención y sin turnos: solo el aviso de por qué no se atiende.
  if (off && items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <EmptyState
          icon={<CalendarOff className="size-5" />}
          title={off.kind === "timeoff" ? off.reason : "No atendés este día"}
          message={
            off.kind === "timeoff"
              ? "Este día está bloqueado en tus horarios."
              : "Este día figura como cerrado en tus horarios. Igual podés crear un turno con “Nuevo turno”."
          }
        />
      </div>
    );
  }

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
      {off && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <CalendarOff className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">No atendés este día</span>
            <span className="text-muted-foreground"> · {off.reason}</span>
            {items.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                — hay turnos cargados de todas formas.
              </span>
            )}
          </p>
        </div>
      )}
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{active}</span>{" "}
        {active === 1 ? "turno" : "turnos"} este día
      </p>
      <ul className="space-y-2">
        {items.map((a) => {
          const service = services.find((s) => s.id === a.serviceId);
          const staffName = staff.find((s) => s.id === a.staffId)?.displayName;
          const person = lookupPerson(a.personId, a.personName);
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
                  <p className="truncate font-medium">{person.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {service?.name ?? "Servicio"}
                    {person.phone ? ` · ${person.phone}` : ""}
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
