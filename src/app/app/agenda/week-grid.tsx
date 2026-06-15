"use client";

import { CalendarOff } from "lucide-react";
import {
  gridHours,
  positionAppointment,
  weekDays,
  isSameLocalDay,
  isToday,
  closedWeekdays,
  dayOffStatus,
  HOUR_PX,
  DAY_START_HOUR,
  DAY_END_HOUR,
} from "@/lib/agenda";
import { formatDayChip } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppointmentChip } from "./appointment-chip";
import type { Service } from "@/lib/api/generated/model/service";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";
import type { PersonInfo } from "@/lib/api/clients";
import type { Appointment } from "@/lib/api/generated/model/appointment";

/** Vista de semana: 7 columnas (lun-dom) para un staff. */
export function WeekGrid({
  date,
  appointments,
  services,
  scheduleRules,
  timeOff,
  staffName,
  lookupPerson,
  onSelect,
}: {
  date: Date;
  appointments: Appointment[];
  services: Service[];
  scheduleRules: ScheduleRule[];
  timeOff: TimeOff[];
  staffName: string;
  lookupPerson: (personId: string, embeddedName?: string) => PersonInfo;
  onSelect: (a: Appointment) => void;
}) {
  const hours = gridHours();
  const days = weekDays(date);
  const closed = closedWeekdays(scheduleRules);
  const totalHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;

  return (
    <div className="min-w-fit">
      {staffName && (
        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground sm:px-6">
          Mostrando la agenda de <span className="font-medium text-foreground">{staffName}</span>
        </div>
      )}
      <div className="flex min-w-fit">
        {/* Columna de horas */}
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-background">
          <div className="h-12 border-b border-border" />
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

        {/* Columnas por día */}
        <div className="flex flex-1">
          {days.map((day) => {
            const chip = formatDayChip(day);
            const today = isToday(day);
            const off = dayOffStatus(day, closed, timeOff);
            const cols = appointments.filter((a) =>
              isSameLocalDay(new Date(a.startAt), day),
            );
            return (
              <div
                key={day.toISOString()}
                className="min-w-[120px] flex-1 border-r border-border last:border-r-0"
              >
                <div
                  className={cn(
                    "sticky top-0 z-10 flex h-12 flex-col items-center justify-center border-b border-border bg-background",
                    today && "text-accent",
                  )}
                  title={off ? `No atiende: ${off.reason}` : undefined}
                >
                  <span className="text-[11px] uppercase">{chip.weekday}</span>
                  <span
                    className={cn(
                      "font-display text-sm font-semibold tabular-nums",
                      today &&
                        "grid size-6 place-items-center rounded-full bg-accent text-accent-foreground",
                    )}
                  >
                    {chip.day}
                  </span>
                </div>
                <div
                  className={cn("relative", off && "bg-off")}
                  style={{ height: totalHeight }}
                >
                  {off && (
                    <div className="pointer-events-none absolute inset-x-0 top-2 z-[1] flex flex-col items-center gap-1 px-1 text-center text-muted-foreground">
                      <CalendarOff className="size-3.5" />
                      <span className="text-[10px] font-medium leading-tight">{off.reason}</span>
                    </div>
                  )}
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-border/60"
                      style={{ top: i * HOUR_PX }}
                    />
                  ))}
                  {cols.map((a) => {
                    const pos = positionAppointment(a);
                    return (
                      <AppointmentChip
                        key={a.id}
                        appointment={a}
                        service={services.find((sv) => sv.id === a.serviceId)}
                        top={pos.top}
                        height={pos.height}
                        personName={lookupPerson(a.personId, a.personName).name}
                        onClick={() => onSelect(a)}
                        compact
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
