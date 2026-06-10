"use client";

import { useState } from "react";
import { Plus, Trash2, CalendarOff, Coffee, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ErrorState, EmptyState } from "@/components/state-views";
import { useListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import {
  useListSchedule,
  useCreateScheduleRule,
  useDeleteScheduleRule,
  useListTimeOff,
  useCreateTimeOff,
  useDeleteTimeOff,
} from "@/lib/api/generated/endpoints/availability/availability";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ScheduleManager() {
  const staffQuery = useListStaff();
  const staffList = (staffQuery.data ?? []).filter((s: Staff) => s.isActive);
  const [activeId, setActiveId] = useState<string | null>(null);
  const staffId = activeId ?? staffList[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Horarios</h1>
      <p className="text-sm text-muted-foreground">
        Definí cuándo atiende cada profesional y cargá descansos, feriados o vacaciones.
      </p>

      {staffQuery.isLoading && <Skeleton className="mt-5 h-10 w-48 rounded-full" />}
      {staffQuery.isError && (
        <ErrorState className="mt-5" message="No pudimos cargar tu equipo." onRetry={() => staffQuery.refetch()} />
      )}

      {staffList.length > 0 && (
        <>
          {staffList.length > 1 && (
            <div className="mt-5 flex gap-2 overflow-x-auto">
              {staffList.map((s: Staff) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    s.id === staffId
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}
                >
                  {s.displayName}
                </button>
              ))}
            </div>
          )}

          {staffId && <StaffSchedule key={staffId} staffId={staffId} />}
        </>
      )}
    </div>
  );
}

function StaffSchedule({ staffId }: { staffId: string }) {
  const schedule = useListSchedule(staffId);
  const timeOff = useListTimeOff(staffId);

  return (
    <div className="mt-6 space-y-8">
      {/* Jornada semanal */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
          Jornada semanal
        </h2>
        {schedule.isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : schedule.isError ? (
          <ErrorState message="No pudimos cargar el horario." onRetry={() => schedule.refetch()} />
        ) : (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <DayRow
                key={day}
                staffId={staffId}
                day={day}
                rules={(schedule.data ?? []).filter((r) => r.dayOfWeek === day)}
                onChanged={() => schedule.refetch()}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Bloqueos / ausencias */}
      <TimeOffSection
        staffId={staffId}
        list={timeOff.data ?? []}
        loading={timeOff.isLoading}
        onChanged={() => timeOff.refetch()}
      />
    </div>
  );
}

function DayRow({
  staffId,
  day,
  rules,
  onChanged,
}: {
  staffId: string;
  day: number;
  rules: ScheduleRule[];
  onChanged: () => void;
}) {
  const create = useCreateScheduleRule();
  const del = useDeleteScheduleRule();
  const works = rules.filter((r) => r.kind === ScheduleRuleKind.work);

  function addWork() {
    create.mutate(
      { staffId, data: { dayOfWeek: day, startTime: "09:00", endTime: "18:00", kind: ScheduleRuleKind.work } },
      { onSuccess: onChanged },
    );
  }
  function addBreak() {
    create.mutate(
      { staffId, data: { dayOfWeek: day, startTime: "13:00", endTime: "14:00", kind: ScheduleRuleKind.break } },
      { onSuccess: onChanged },
    );
  }
  function remove(id: string) {
    del.mutate({ staffId, id }, { onSuccess: onChanged });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-medium">{DAYS[day]}</span>
        {rules.length === 0 ? (
          <span className="text-xs text-muted-foreground">Cerrado</span>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={addWork} disabled={create.isPending}>
              <Briefcase className="size-3.5" />
              Franja
            </Button>
            {works.length > 0 && (
              <Button variant="ghost" size="sm" onClick={addBreak} disabled={create.isPending}>
                <Coffee className="size-3.5" />
                Descanso
              </Button>
            )}
          </div>
        )}
      </div>

      {rules.length === 0 ? (
        <button
          type="button"
          onClick={addWork}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <Plus className="size-3.5" />
          Agregar horario de atención
        </button>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {rules
            .slice()
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((r) => (
              <span
                key={r.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
                  r.kind === ScheduleRuleKind.work
                    ? "border-status-done-foreground/30 bg-status-done text-status-done-foreground"
                    : "border-status-waiting-foreground/30 bg-status-waiting text-status-waiting-foreground",
                )}
              >
                {r.kind === ScheduleRuleKind.break ? (
                  <Coffee className="size-3" />
                ) : (
                  <Briefcase className="size-3" />
                )}
                {r.startTime}–{r.endTime}
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() => remove(r.id)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function TimeOffSection({
  staffId,
  list,
  loading,
  onChanged,
}: {
  staffId: string;
  list: TimeOff[];
  loading: boolean;
  onChanged: () => void;
}) {
  const create = useCreateTimeOff();
  const del = useDeleteTimeOff();
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  function add() {
    create.mutate(
      {
        staffId,
        data: {
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          reason: reason || undefined,
        },
      },
      {
        onSuccess: () => {
          setAdding(false);
          setStart("");
          setEnd("");
          setReason("");
          onChanged();
        },
      },
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">
          Bloqueos, feriados y vacaciones
        </h2>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" />
          Bloquear
        </Button>
      </div>

      {adding && (
        <div className="mb-3 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="to-start">Desde</Label>
              <Input id="to-start" type="datetime-local" className="mt-1.5" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to-end">Hasta</Label>
              <Input id="to-end" type="datetime-local" className="mt-1.5" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="to-reason">Motivo (opcional)</Label>
            <Input id="to-reason" className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, feriado…" />
          </div>
          <Button size="sm" onClick={add} disabled={!start || !end || create.isPending}>
            Guardar bloqueo
          </Button>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="size-5" />}
          title="Sin bloqueos cargados"
          message="Agregá feriados, vacaciones o bloqueos puntuales."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <CalendarOff className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {(t.reason as unknown as string) || "Bloqueo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(t.startAt)} → {formatDateTime(t.endAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Quitar bloqueo"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => del.mutate({ staffId, id: t.id }, { onSuccess: onChanged })}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
