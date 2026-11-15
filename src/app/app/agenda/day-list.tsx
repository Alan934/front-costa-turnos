"use client";

import { CalendarX2, CalendarOff, CheckCheck, Clock, Plus } from "lucide-react";
import { EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import {
  isSameLocalDay,
  closedWeekdays,
  dayOffStatus,
  partialTimeOffsForDay,
  freeGapsForDay,
  type FreeGap,
} from "@/lib/agenda";
import type { PersonInfo, EmbeddedPerson } from "@/lib/api/clients";
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
  onCreateAt,
}: {
  date: Date;
  appointments: Appointment[];
  services: Service[];
  staff: Staff[];
  scheduleRules: ScheduleRule[];
  timeOff: TimeOff[];
  lookupPerson: (personId: string, embedded?: EmbeddedPerson) => PersonInfo;
  onSelect: (a: Appointment) => void;
  /** Tocar un hueco libre: carga un turno para esa persona a esa hora. */
  onCreateAt?: (staffId: string, start: Date) => void;
}) {
  const items = appointments
    .filter((a) => isSameLocalDay(new Date(a.startAt), date))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  const multiStaff = staff.length > 1;
  const active = items.filter((a) => a.status !== "cancelled").length;
  const off = dayOffStatus(date, closedWeekdays(scheduleRules), timeOff);
  // Bloqueos por horas: se listan como aviso, sin cerrar el día entero.
  const partials = off ? [] : partialTimeOffsForDay(date, timeOff);
  // Huecos libres (hoy desde ahora, o días futuros) para cargar un turno ahí con un toque.
  const gaps =
    off || !onCreateAt
      ? []
      : freeGapsForDay(date, staff.map((s) => s.id), scheduleRules, appointments, timeOff);
  const rows: Row[] = [
    ...items.map((a): Row => ({ kind: "appt", at: +new Date(a.startAt), appt: a })),
    ...gaps.map((g): Row => ({ kind: "gap", at: +g.start, gap: g })),
  ].sort((x, y) => x.at - y.at || (x.kind === "appt" ? -1 : 1));

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

  if (items.length === 0 && gaps.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        {partials.length > 0 && <PartialBlocksNotice blocks={partials} />}
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
      {partials.length > 0 && <PartialBlocksNotice blocks={partials} />}
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
        {rows.map((row) => {
          if (row.kind === "gap") {
            const g = row.gap;
            const who = multiStaff ? staff.find((s) => s.id === g.staffId)?.displayName : null;
            return (
              <li key={`gap-${g.staffId}-${+g.start}`}>
                <button
                  type="button"
                  onClick={() => onCreateAt?.(g.staffId, g.start)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <span className="w-14 shrink-0 text-center font-display font-semibold tabular-nums">
                    {formatTime(g.start)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    Libre hasta las {formatTime(g.end)} · {gapLength(g)}
                    {who ? ` · ${who}` : ""}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">
                    <Plus className="size-3.5" />
                    Cargar turno
                  </span>
                </button>
              </li>
            );
          }
          const a = row.appt;
          const service = services.find((s) => s.id === a.serviceId);
          const staffName = staff.find((s) => s.id === a.staffId)?.displayName;
          const person = lookupPerson(a.personId, {
            name: a.personName,
            phone: a.personPhone,
            email: a.personEmail,
          });
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
                {a.clientConfirmedAt && !cancelled && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success"
                    title="El cliente confirmó que viene"
                  >
                    <CheckCheck className="size-3.5" />
                    <span className="hidden sm:inline">Confirmó</span>
                  </span>
                )}
                <AppointmentStatusBadge status={a.status} isProvisional={a.isProvisional} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Row =
  | { kind: "appt"; at: number; appt: Appointment }
  | { kind: "gap"; at: number; gap: FreeGap };

/** "45 min", "1 h", "2 h 30 min". */
function gapLength(g: FreeGap): string {
  const min = Math.round((+g.end - +g.start) / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Aviso de los bloqueos por horas del día (no cierran el día entero, solo ese rango). */
function PartialBlocksNotice({ blocks }: { blocks: TimeOff[] }) {
  return (
    <div className="mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CalendarOff className="size-4 shrink-0 text-warning" />
        {blocks.length === 1 ? "Tenés un bloqueo este día" : "Tenés bloqueos este día"}
      </p>
      <ul className="mt-1.5 space-y-1 text-muted-foreground">
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              {formatTime(b.startAt)}–{formatTime(b.endAt)}
            </span>
            {b.reason && <span className="truncate">· {b.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
