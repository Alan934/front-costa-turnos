"use client";

import { monthGridDays, countByDay, loadLevel, dayKey, isToday } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api/generated/model/appointment";

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
  onPickDay,
  onOpenDay,
}: {
  date: Date;
  appointments: Appointment[];
  onPickDay: (d: Date) => void;
  onOpenDay: (d: Date) => void;
}) {
  const days = monthGridDays(date);
  const counts = countByDay(appointments);
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

            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => onPickDay(d)}
                onDoubleClick={() => onOpenDay(d)}
                title={count > 0 ? `${count} ${count === 1 ? "turno" : "turnos"} · doble click para ver` : "Sin turnos"}
                className={cn(
                  "flex min-h-[68px] flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-[92px]",
                  LOAD_BG[level],
                  today ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/50",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "font-display text-sm font-semibold tabular-nums",
                    today && "grid size-6 place-items-center rounded-full bg-accent text-accent-foreground",
                  )}
                >
                  {d.getDate()}
                </span>

                {count > 0 && (
                  <span className="mt-auto flex items-center gap-1 self-start rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {count}
                  </span>
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
