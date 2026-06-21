"use client";

import { useState } from "react";
import { Plus, Trash2, CalendarOff, Coffee, Briefcase, Building2, Pencil } from "lucide-react";
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
  useUpdateComercioScheduleRule,
  useDeleteComercioScheduleRule,
  useComercioTimeOff,
  useCreateComercioTimeOff,
  useDeleteComercioTimeOff,
} from "@/lib/api/availability-comercio";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { formatDateTime, formatDateLong, titleCaseName, TIME_ZONE } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";
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
  const update = useUpdateComercioScheduleRule(comercioId);
  const del = useDeleteComercioScheduleRule(comercioId);
  const works = rules.filter((r) => r.kind === ScheduleRuleKind.work);
  // null = cerrado; `kind` = qué se crea (work/break); `rule` = si viene, editamos esa regla.
  const [dialog, setDialog] = useState<{ rule?: ScheduleRule; kind: ScheduleRuleKind } | null>(null);

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialog({ kind: ScheduleRuleKind.work })}
              disabled={create.isPending}
            >
              <Briefcase className="size-3.5" />
              Franja
            </Button>
            {works.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialog({ kind: ScheduleRuleKind.break })}
                disabled={create.isPending}
              >
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
          onClick={() => setDialog({ kind: ScheduleRuleKind.work })}
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
              <RuleChip
                key={r.id}
                rule={r}
                services={services}
                onEdit={() => setDialog({ rule: r, kind: r.kind })}
                onRemove={() => remove(r.id)}
              />
            ))}
        </div>
      )}

      {dialog && (
        <RuleDialog
          day={day}
          kind={dialog.kind}
          services={services}
          rule={dialog.rule}
          pending={create.isPending || update.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(startTime, endTime, serviceIds) => {
            const editing = dialog.rule;
            if (editing) {
              update.mutate(
                { id: editing.id, data: { startTime, endTime, serviceIds } },
                { onSuccess: () => setDialog(null) },
              );
            } else {
              create.mutate(
                { dayOfWeek: day, startTime, endTime, kind: dialog.kind, serviceIds },
                { onSuccess: () => setDialog(null) },
              );
            }
          }}
        />
      )}
    </div>
  );
}

/** Chip de una regla: horario + (para franjas de trabajo) a qué servicios aplica. */
function RuleChip({
  rule,
  services,
  onEdit,
  onRemove,
}: {
  rule: ScheduleRule;
  services: Service[];
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const isWork = rule.kind === ScheduleRuleKind.work;
  // serviceIds vacío = aplica a todos. Si trae ids, mostramos los nombres (los que conocemos).
  const targeted = rule.serviceIds.length > 0;
  const names = targeted
    ? rule.serviceIds
        .map((id) => services.find((s) => s.id === id)?.name)
        .filter((n): n is string => !!n)
        .map(titleCaseName)
    : [];
  // Las franjas de trabajo siempre indican alcance ("Todos"/nombres). Los descansos solo
  // lo muestran cuando afectan a servicios puntuales (sin ids = descanso total, sin etiqueta).
  const scopeLabel = targeted
    ? names.length > 0
      ? names.join(", ")
      : `${rule.serviceIds.length} servicio${rule.serviceIds.length > 1 ? "s" : ""}`
    : isWork
      ? "Todos los servicios"
      : null;

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
      {scopeLabel && <span className="opacity-80">· {scopeLabel}</span>}
      {onEdit && (
        <button
          type="button"
          aria-label="Editar franja"
          onClick={onEdit}
          className="ml-0.5 opacity-60 hover:opacity-100"
        >
          <Pencil className="size-3" />
        </button>
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

/**
 * Diálogo para agregar/editar una regla del día. `kind` define si es una franja de trabajo
 * (work) o un descanso (break): ambos eligen horario y a qué servicios aplican/afectan.
 * Para una franja, los servicios marcan dónde se puede reservar; para un descanso, qué
 * servicios quedan bloqueados (sin marcar = todos → descanso total).
 */
function RuleDialog({
  day,
  kind,
  services,
  rule,
  pending,
  onClose,
  onSubmit,
}: {
  day: number;
  kind: ScheduleRuleKind;
  services: Service[];
  /** Si viene, editamos esa regla (precargada); si no, creamos una nueva del `kind` dado. */
  rule?: ScheduleRule;
  pending: boolean;
  onClose: () => void;
  onSubmit: (startTime: string, endTime: string, serviceIds: string[]) => void;
}) {
  const editing = !!rule;
  const isBreak = kind === ScheduleRuleKind.break;
  const noun = isBreak ? "descanso" : "franja";
  // Default según el tipo: descanso típico de mediodía vs. jornada de trabajo.
  const [start, setStart] = useState(rule?.startTime ?? (isBreak ? "13:00" : "09:00"));
  const [end, setEnd] = useState(rule?.endTime ?? (isBreak ? "14:00" : "18:00"));
  // "all" = todos los servicios (serviceIds vacío); "some" = solo los marcados.
  const [scope, setScope] = useState<"all" | "some">(
    rule && rule.serviceIds.length > 0 ? "some" : "all",
  );
  const [selected, setSelected] = useState<string[]>(rule?.serviceIds ?? []);

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
          <DialogTitle>
            {editing ? `Editar ${noun}` : isBreak ? "Agregar descanso" : "Agregar franja"} —{" "}
            {DAYS[day]}
          </DialogTitle>
          <DialogDescription>
            {isBreak
              ? "Elegí el horario del descanso y a qué servicios afecta."
              : "Elegí el horario y a qué servicios aplica esta franja de atención."}
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
            <Label>{isBreak ? "¿A qué servicios afecta?" : "¿A qué servicios aplica?"}</Label>
            <div className="mt-1.5 space-y-2">
              <ScopeOption
                checked={scope === "all"}
                onSelect={() => setScope("all")}
                title="Todos los servicios"
                hint={
                  isBreak
                    ? "Durante el descanso no se podrá reservar ningún servicio."
                    : "La franja sirve para cualquier servicio que ofrezcas."
                }
              />
              <ScopeOption
                checked={scope === "some"}
                onSelect={() => setScope("some")}
                title="Solo algunos servicios"
                hint={
                  isBreak
                    ? "Solo se bloquean los servicios que elijas en ese rango."
                    : "Elegí en qué servicios se puede reservar en esta franja."
                }
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
                      {titleCaseName(s.name)}
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
            {editing ? "Guardar cambios" : isBreak ? "Agregar descanso" : "Agregar franja"}
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

/**
 * Offset fijo de Argentina (UTC-3, sin horario de verano). Lo usamos para construir el ISO
 * de un bloqueo tomando la fecha/hora como hora LOCAL de AR, sin que `new Date("yyyy-mm-dd")`
 * lo interprete como UTC (que correría el día). Ver TIME_ZONE en lib/format.
 */
const AR_OFFSET = "-03:00";

/** Convierte "2026-06-27" + "HH:mm" (hora de AR) a un ISO absoluto. */
function arDateTimeToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00${AR_OFFSET}`).toISOString();
}

/** "2026-06-27" → "2026-06-28" (día siguiente, en calendario). Para el fin exclusivo de un bloqueo por días. */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00${AR_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** ¿El bloqueo abarca días completos? (arranca 00:00 y termina 00:00 de AR). */
function isAllDay(startAt: string, endAt: string): boolean {
  return (
    formatInTimeZone(new Date(startAt), TIME_ZONE, "HH:mm") === "00:00" &&
    formatInTimeZone(new Date(endAt), TIME_ZONE, "HH:mm") === "00:00"
  );
}

/** Etiqueta del rango de un bloqueo, distinta para días completos vs. horas de un día. */
function timeOffLabel(startAt: string, endAt: string): string {
  if (isAllDay(startAt, endAt)) {
    // endAt es el inicio (00:00) del día SIGUIENTE al último bloqueado → restamos un día para mostrarlo.
    const lastDay = new Date(endAt);
    lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    const startLabel = formatDateLong(startAt);
    const endLabel = formatDateLong(lastDay);
    return startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`;
  }
  return `${formatDateTime(startAt)} → ${formatDateTime(endAt)}`;
}

type TimeOffMode = "days" | "hours";

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
  const [mode, setMode] = useState<TimeOffMode>("days");
  // Días completos: solo fechas (rango inclusivo de día a día).
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  // Horas de un día: una fecha + rango horario.
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");

  function reset() {
    setAdding(false);
    setMode("days");
    setFromDay("");
    setToDay("");
    setDay("");
    setStartTime("09:00");
    setEndTime("13:00");
    setReason("");
  }

  // Validación según el modo.
  const daysValid = mode === "days" && !!fromDay && !!toDay && fromDay <= toDay;
  const hoursValid = mode === "hours" && !!day && startTime < endTime;
  const canSubmit = (daysValid || hoursValid) && !create.isPending;

  function add() {
    let startAt: string;
    let endAt: string;
    if (mode === "days") {
      // Rango de días COMPLETOS: del 00:00 del primer día al 00:00 del día siguiente al último (fin exclusivo).
      startAt = arDateTimeToISO(fromDay, "00:00");
      endAt = arDateTimeToISO(nextDay(toDay), "00:00");
    } else {
      startAt = arDateTimeToISO(day, startTime);
      endAt = arDateTimeToISO(day, endTime);
    }
    create.mutate(
      { startAt, endAt, reason: reason || undefined },
      { onSuccess: reset },
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">
          Bloqueos, feriados y vacaciones
        </h2>
        <Button variant="outline" size="sm" onClick={() => (adding ? reset() : setAdding(true))}>
          <Plus className="size-4" />
          Bloquear
        </Button>
      </div>

      {adding && (
        <div className="mb-3 space-y-3 rounded-xl border border-border bg-card p-4">
          {/* Selector de modo: por días (default) u horas de un día. */}
          <div className="grid grid-cols-2 gap-2">
            <ModeOption
              checked={mode === "days"}
              onSelect={() => setMode("days")}
              title="Días completos"
              hint="Vacaciones o feriados (sin elegir horas)."
            />
            <ModeOption
              checked={mode === "hours"}
              onSelect={() => setMode("hours")}
              title="Horas de un día"
              hint="Bloquear solo un rango horario."
            />
          </div>

          {mode === "days" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="to-from">Desde el día</Label>
                <Input
                  id="to-from"
                  type="date"
                  className="mt-1.5"
                  value={fromDay}
                  onChange={(e) => {
                    setFromDay(e.target.value);
                    // Si "hasta" quedó vacío o antes del nuevo "desde", lo igualamos.
                    if (!toDay || toDay < e.target.value) setToDay(e.target.value);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="to-to">Hasta el día</Label>
                <Input
                  id="to-to"
                  type="date"
                  className="mt-1.5"
                  min={fromDay || undefined}
                  value={toDay}
                  onChange={(e) => setToDay(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="to-day">Día</Label>
                <Input
                  id="to-day"
                  type="date"
                  className="mt-1.5"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="to-start">Desde</Label>
                  <Input id="to-start" type="time" className="mt-1.5" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="to-end">Hasta</Label>
                  <Input id="to-end" type="time" className="mt-1.5" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              {!!day && startTime >= endTime && (
                <p className="text-xs text-destructive">La hora de fin debe ser posterior a la de inicio.</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="to-reason">Motivo (opcional)</Label>
            <Input id="to-reason" className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, feriado…" />
          </div>
          <Button size="sm" onClick={add} disabled={!canSubmit}>
            {create.isPending ? <Spinner /> : null}
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
                <p className="text-xs text-muted-foreground">{timeOffLabel(t.startAt, t.endAt)}</p>
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

/** Opción de modo de bloqueo (días completos vs. horas), estilo radio compacto. */
function ModeOption({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
        checked ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
