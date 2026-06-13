"use client";

import { useState } from "react";
import { Plus, Trash2, CalendarOff, Coffee, Briefcase, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorState, EmptyState } from "@/components/state-views";
import { useActiveComercio } from "@/components/comercio-context";
import { useComercioServices } from "@/lib/api/catalog";
import {
  useComercioSchedule,
  useCreateComercioScheduleRule,
  useDeleteComercioScheduleRule,
  useComercioTimeOff,
  useCreateComercioTimeOff,
  useDeleteComercioTimeOff,
} from "@/lib/api/availability-comercio";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { Service } from "@/lib/api/generated/model/service";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ScheduleManager() {
  const { active, activeId, loading: comercioLoading } = useActiveComercio();

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Horarios</h1>
        <p className="text-sm text-muted-foreground">
          Definí cuándo atendés{active && !active.isPersonal ? ` en ${active.name}` : ""} y cargá
          descansos, feriados o vacaciones.
        </p>
      </div>

      {comercioLoading && <Skeleton className="mt-6 h-64 w-full rounded-xl" />}

      {!comercioLoading && !activeId && (
        <EmptyState
          className="mt-6"
          icon={<Building2 className="size-5" />}
          title="Elegí un comercio"
          message="Seleccioná el comercio donde querés configurar tus horarios."
        />
      )}

      {activeId && <ComercioSchedule key={activeId} comercioId={activeId} />}
    </div>
  );
}

function ComercioSchedule({ comercioId }: { comercioId: string }) {
  const schedule = useComercioSchedule(comercioId);
  const timeOff = useComercioTimeOff(comercioId);
  // Servicios del comercio: para elegir a cuáles aplica cada franja y mostrarlo en los chips.
  const services = (useComercioServices(comercioId).data ?? []).filter((s) => s.isActive);

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
                comercioId={comercioId}
                day={day}
                rules={(schedule.data ?? []).filter((r) => r.dayOfWeek === day)}
                services={services}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Bloqueos / ausencias */}
      <TimeOffSection
        comercioId={comercioId}
        list={timeOff.data ?? []}
        loading={timeOff.isLoading}
      />
    </div>
  );
}

function DayRow({
  comercioId,
  day,
  rules,
  services,
}: {
  comercioId: string;
  day: number;
  rules: ScheduleRule[];
  services: Service[];
}) {
  const create = useCreateComercioScheduleRule(comercioId);
  const del = useDeleteComercioScheduleRule(comercioId);
  const works = rules.filter((r) => r.kind === ScheduleRuleKind.work);
  const [addingWork, setAddingWork] = useState(false);

  function addBreak() {
    create.mutate({ dayOfWeek: day, startTime: "13:00", endTime: "14:00", kind: ScheduleRuleKind.break });
  }
  function remove(id: string) {
    del.mutate(id);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-medium">{DAYS[day]}</span>
        {rules.length === 0 ? (
          <span className="text-xs text-muted-foreground">Cerrado</span>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setAddingWork(true)} disabled={create.isPending}>
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
          onClick={() => setAddingWork(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <Plus className="size-3.5" />
          Agregar horario de atención
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {rules
            .slice()
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((r) => (
              <RuleChip key={r.id} rule={r} services={services} onRemove={() => remove(r.id)} />
            ))}
        </div>
      )}

      {addingWork && (
        <AddWorkDialog
          day={day}
          services={services}
          pending={create.isPending}
          onClose={() => setAddingWork(false)}
          onSubmit={(startTime, endTime, serviceIds) =>
            create.mutate(
              { dayOfWeek: day, startTime, endTime, kind: ScheduleRuleKind.work, serviceIds },
              { onSuccess: () => setAddingWork(false) },
            )
          }
        />
      )}
    </div>
  );
}

/** Chip de una regla: horario + (para franjas de trabajo) a qué servicios aplica. */
function RuleChip({
  rule,
  services,
  onRemove,
}: {
  rule: ScheduleRule;
  services: Service[];
  onRemove: () => void;
}) {
  const isWork = rule.kind === ScheduleRuleKind.work;
  // serviceIds vacío = aplica a todos. Si trae ids, mostramos los nombres (los que conocemos).
  const targeted = isWork && rule.serviceIds.length > 0;
  const names = targeted
    ? rule.serviceIds
        .map((id) => services.find((s) => s.id === id)?.name)
        .filter((n): n is string => !!n)
    : [];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
        isWork
          ? "border-status-done-foreground/30 bg-status-done text-status-done-foreground"
          : "border-status-waiting-foreground/30 bg-status-waiting text-status-waiting-foreground",
      )}
    >
      {isWork ? <Briefcase className="size-3" /> : <Coffee className="size-3" />}
      {rule.startTime}–{rule.endTime}
      {isWork && (
        <span className="opacity-80">
          ·{" "}
          {targeted
            ? names.length > 0
              ? names.join(", ")
              : `${rule.serviceIds.length} servicio${rule.serviceIds.length > 1 ? "s" : ""}`
            : "Todos los servicios"}
        </span>
      )}
      <button
        type="button"
        aria-label="Quitar"
        onClick={onRemove}
        className="ml-0.5 opacity-60 hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>
    </span>
  );
}

/** Diálogo para agregar una franja de trabajo: horario + a qué servicios aplica. */
function AddWorkDialog({
  day,
  services,
  pending,
  onClose,
  onSubmit,
}: {
  day: number;
  services: Service[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (startTime: string, endTime: string, serviceIds: string[]) => void;
}) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  // "all" = todos los servicios (serviceIds vacío); "some" = solo los marcados.
  const [scope, setScope] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const validRange = start < end;
  const canSubmit = validRange && (scope === "all" || selected.length > 0) && !pending;

  function submit() {
    onSubmit(start, end, scope === "all" ? [] : selected);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar franja — {DAYS[day]}</DialogTitle>
          <DialogDescription>
            Elegí el horario y a qué servicios aplica esta franja de atención.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aw-start">Desde</Label>
              <Input id="aw-start" type="time" className="mt-1.5" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="aw-end">Hasta</Label>
              <Input id="aw-end" type="time" className="mt-1.5" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {!validRange && (
            <p className="text-xs text-destructive">La hora de fin debe ser posterior a la de inicio.</p>
          )}

          <div>
            <Label>¿A qué servicios aplica?</Label>
            <div className="mt-1.5 space-y-2">
              <ScopeOption
                checked={scope === "all"}
                onSelect={() => setScope("all")}
                title="Todos los servicios"
                hint="La franja sirve para cualquier servicio que ofrezcas."
              />
              <ScopeOption
                checked={scope === "some"}
                onSelect={() => setScope("some")}
                title="Solo algunos servicios"
                hint="Elegí en qué servicios se puede reservar en esta franja."
                disabled={services.length === 0}
              />
            </div>

            {scope === "some" && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-border p-2.5">
                {services.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no tenés servicios en este comercio.
                  </p>
                ) : (
                  services.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {s.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit} onClick={submit}>
            {pending ? <Spinner /> : null}
            Agregar franja
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  checked,
  onSelect,
  title,
  hint,
  disabled,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
        checked ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
          checked ? "border-accent" : "border-muted-foreground",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function TimeOffSection({
  comercioId,
  list,
  loading,
}: {
  comercioId: string;
  list: TimeOff[];
  loading: boolean;
}) {
  const create = useCreateComercioTimeOff(comercioId);
  const del = useDeleteComercioTimeOff(comercioId);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  function add() {
    create.mutate(
      {
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          setAdding(false);
          setStart("");
          setEnd("");
          setReason("");
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
                <p className="text-sm font-medium">{t.reason || "Bloqueo"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(t.startAt)} → {formatDateTime(t.endAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Quitar bloqueo"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => del.mutate(t.id)}
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
