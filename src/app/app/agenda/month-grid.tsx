"use client";

import { CalendarOff } from "lucide-react";
import {
  monthGridDays,
  countByDay,
  loadLevel,
  dayKey,
  isToday,
  closedWeekdays,
  dayOffStatus,
  partialTimeOffsForDay,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Tinte de fondo según qué tan cargado está el día (0 = vacío … 4 = muy cargado).
const LOAD_BG = [
  "bg-card",
  "bg-accent/10",
  "bg-accent/20",
  "bg-accent/35",
  "bg-accent/50",
] as const;

/**
 * Vista mensual tipo calendario. Cada día muestra cuántos turnos tiene y un tinte que indica
 * qué tan cargado está. Un click va al día en la vista diaria; doble click abre la lista de
 * turnos de ese día (sin tener que scrollear las horas).
 */
export function MonthGrid({
  date,
  appointments,
  scheduleRules,
  timeOff,
  onPickDay,
  onOpenDay,
}: {
  date: Date;
  appointments: Appointment[];
  scheduleRules: ScheduleRule[];
  timeOff: TimeOff[];
  onPickDay: (d: Date) => void;
  onOpenDay: (d: Date) => void;
}) {
  const days = monthGridDays(date);
  const counts = countByDay(appointments);
  const closed = closedWeekdays(scheduleRules);
  const month = date.getMonth();

  return (
    <div className="p-3 sm:p-5">
      <div className="mx-auto max-w-4xl">
        <div className="grid grid-cols-7 gap-1.5 pb-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs font-medium text-muted-foreground">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const inMonth = d.getMonth() === month;
            const count = counts[dayKey(d)] ?? 0;
            const level = loadLevel(count);
            const today = isToday(d);
            const off = dayOffStatus(d, closed, timeOff);
            // Bloqueos por horas: marca puntual, sin cerrar el día entero.
            const hasPartialBlock = !off && partialTimeOffsForDay(d, timeOff).length > 0;

            const title = off
              ? `No atiende: ${off.reason}`
              : hasPartialBlock
                ? `Bloqueo por horas${count > 0 ? ` · ${count} ${count === 1 ? "turno" : "turnos"}` : ""}`
                : count > 0
                  ? `${count} ${count === 1 ? "turno" : "turnos"} · doble click para ver`
                  : "Sin turnos";

            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => onPickDay(d)}
                onDoubleClick={() => onOpenDay(d)}
                title={title}
                className={cn(
                  "flex min-h-[68px] flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-[92px]",
                  // Días sin atención: fondo a rayas atenuado en vez del tinte de carga.
                  off ? "bg-off bg-muted/40 text-muted-foreground" : LOAD_BG[level],
                  today
                    ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-background"
                    : "border-border hover:border-accent/50",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "font-display tabular-nums",
                    today
                      ? "grid size-7 place-items-center rounded-full bg-accent text-base font-bold text-accent-foreground shadow-sm"
                      : "text-sm font-semibold",
                  )}
                >
                  {d.getDate()}
                </span>

                {off ? (
                  <span className="mt-auto flex items-center gap-1 self-start text-[10px] font-medium leading-tight sm:text-[11px]">
                    <CalendarOff className="size-3 shrink-0" />
                    <span className="truncate">{off.reason}</span>
                  </span>
                ) : (
                  (count > 0 || hasPartialBlock) && (
                    <span className="mt-auto flex items-center gap-1 self-start rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
                      {hasPartialBlock && (
                        <CalendarOff className="size-3 shrink-0 text-warning" />
                      )}
                      {count > 0 && (
                        <>
                          <span className="size-1.5 rounded-full bg-accent" />
                          {count}
                        </>
                      )}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Menos</span>
          {LOAD_BG.map((bg, i) => (
            <span key={i} className={cn("size-4 rounded border border-border", bg)} aria-hidden />
          ))}
          <span>Más cargado</span>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Doble click en un día para ver todos sus turnos.
        </p>
      </div>
    </div>
  );
}
