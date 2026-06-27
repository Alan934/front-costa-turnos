"use client";

import { useEffect, useMemo } from "react";
import { CalendarX2, Sunrise, Sun, Moon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import {
  formatDayChip,
  formatTime,
  isSameDay,
  timeBand,
  type TimeBand,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayAvailabilityDto } from "@/lib/api/generated/model/dayAvailabilityDto";
import { DayAvailabilityStatus } from "@/lib/api/generated/model/dayAvailabilityStatus";
import { TimeOffType } from "@/lib/api/generated/model/timeOffType";
import type { Slot } from "@/mocks/contract-extensions";

/** Clave local (YYYY-MM-DD) para cruzar un día con la disponibilidad del back. */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Estado visual de un día en el selector. El back solo distingue
 * available/closed/time_off/full; "almost" lo inferimos contando huecos libres y, dentro de
 * time_off, separamos feriado/vacaciones/bloqueo leyendo el `reason` cargado por el profesional.
 */
export type DayKind =
  | "available"
  | "almost"
  | "full"
  | "block"
  | "holiday"
  | "vacation"
  | "closed";

/** ¿En este estado el cliente puede elegir el día? */
export function isBookableKind(kind: DayKind): boolean {
  return kind === "available" || kind === "almost";
}

/**
 * Subtipo de un día bloqueado (time_off). Usa el `timeOffType` tipado del back;
 * si no viene (back anterior), cae al texto libre `reason` como respaldo.
 */
function timeOffKind(
  type: TimeOffType | null | undefined,
  reason: string | null | undefined,
): DayKind {
  if (type === TimeOffType.holiday) return "holiday";
  if (type === TimeOffType.vacation) return "vacation";
  if (type === TimeOffType.block) return "block";
  const r = (reason ?? "").toLowerCase();
  if (/vacac/.test(r)) return "vacation";
  if (/feriad/.test(r)) return "holiday";
  return "block";
}

/** Clases (chip y punto de leyenda) + etiqueta de cada estado de día. */
const DAY_KIND_STYLE: Record<DayKind, { chip: string; dot: string; label: string }> = {
  available: {
    chip: "border-cal-available-foreground/20 bg-cal-available/60 text-cal-available-foreground hover:bg-cal-available",
    dot: "bg-cal-available-foreground",
    label: "Disponible",
  },
  almost: {
    chip: "border-cal-almost-foreground/25 bg-cal-almost/70 text-cal-almost-foreground hover:bg-cal-almost",
    dot: "bg-cal-almost-foreground",
    label: "Quedan pocos",
  },
  full: {
    chip: "border-cal-full-foreground/25 bg-cal-full/60 text-cal-full-foreground",
    dot: "bg-cal-full-foreground",
    label: "Completo",
  },
  block: {
    chip: "border-cal-block-foreground/25 bg-cal-block/55 text-cal-block-foreground",
    dot: "bg-cal-block-foreground",
    label: "Bloqueado",
  },
  holiday: {
    chip: "border-cal-holiday-foreground/25 bg-cal-holiday/55 text-cal-holiday-foreground",
    dot: "bg-cal-holiday-foreground",
    label: "Feriado",
  },
  vacation: {
    chip: "border-cal-vacation-foreground/25 bg-cal-vacation/55 text-cal-vacation-foreground",
    dot: "bg-cal-vacation-foreground",
    label: "Vacaciones",
  },
  closed: {
    chip: "bg-off border-cal-closed-foreground/20 bg-cal-closed/60 text-cal-closed-foreground",
    dot: "bg-cal-closed-foreground",
    label: "No atiende",
  },
};

/** Franjas horarias para agrupar y colorear los turnos de un día. */
const TIME_BANDS: { key: TimeBand; label: string; icon: typeof Sun; slotChip: string }[] = [
  {
    key: "morning",
    label: "Mañana",
    icon: Sunrise,
    slotChip:
      "border-cal-morning-foreground/25 bg-cal-morning/50 text-cal-morning-foreground hover:bg-cal-morning hover:border-cal-morning-foreground/45",
  },
  {
    key: "afternoon",
    label: "Tarde",
    icon: Sun,
    slotChip:
      "border-cal-afternoon-foreground/25 bg-cal-afternoon/50 text-cal-afternoon-foreground hover:bg-cal-afternoon hover:border-cal-afternoon-foreground/45",
  },
  {
    key: "evening",
    label: "Noche",
    icon: Moon,
    slotChip:
      "border-cal-evening-foreground/25 bg-cal-evening/50 text-cal-evening-foreground hover:bg-cal-evening hover:border-cal-evening-foreground/45",
  },
];

// Ocupación ≥80% (dato exacto del back) ⇒ "quedan pocos".
const ALMOST_THRESHOLD = 0.8;

interface DaySlotPickerProps {
  /** Días candidatos (orden de izquierda a derecha). */
  days: Date[];
  /** Slots reservables del rango (cualquier día); el componente filtra por día activo. */
  slots: Slot[] | undefined;
  /** Disponibilidad por día del back (colores + conteos). Vacío ⇒ se infiere desde los slots. */
  availability: DayAvailabilityDto[] | undefined;
  activeDay: Date;
  onActiveDayChange: (d: Date) => void;
  onPickSlot: (slot: Slot) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Oculta este horario exacto de la grilla (reprogramación: el turno actual). */
  excludeStartAt?: string;
  /** Deshabilita los botones de slot mientras hay una mutación en curso. */
  pickDisabled?: boolean;
}

/**
 * Selector de día + horario compartido entre la reserva pública y la reprogramación del cliente.
 * Colorea cada día según la disponibilidad del back (disponible / quedan pocos / completo /
 * feriado / vacaciones / bloqueo / no atiende), informa cuántos turnos quedan, deshabilita los
 * días no reservables y agrupa los horarios del día activo por franja (mañana/tarde/noche).
 */
export function DaySlotPicker({
  days,
  slots,
  availability,
  activeDay,
  onActiveDayChange,
  onPickSlot,
  isLoading,
  isError,
  onRetry,
  excludeStartAt,
  pickDisabled,
}: DaySlotPickerProps) {
  const availByDate = useMemo(() => {
    const map = new Map<string, DayAvailabilityDto>();
    for (const a of availability ?? []) map.set(a.date, a);
    return map;
  }, [availability]);

  const slotsLoaded = slots != null;

  // Estado visual de cada día (color + etiqueta) a partir de la disponibilidad del back:
  // status + ocupación exacta (occupancyRatio) + tipo de ausencia (timeOffType).
  const dayInfos = useMemo(() => {
    return days.map((d) => {
      const a = availByDate.get(localDateKey(d));
      if (a) {
        let kind: DayKind;
        switch (a.status) {
          case DayAvailabilityStatus.full:
            kind = "full";
            break;
          case DayAvailabilityStatus.closed:
            kind = "closed";
            break;
          case DayAvailabilityStatus.time_off:
            kind = timeOffKind(a.timeOffType, a.reason);
            break;
          default: // available
            kind = a.occupancyRatio >= ALMOST_THRESHOLD ? "almost" : "available";
        }
        return { d, a, free: a.freeSlots, total: a.totalSlots, kind };
      }
      // Fallback (back sin day-availability): inferimos desde los huecos libres.
      const free = slotsLoaded ? (slots ?? []).filter((s) => isSameDay(s.startAt, d)).length : 0;
      const kind: DayKind = !slotsLoaded ? "available" : free === 0 ? "closed" : "available";
      return { d, a: undefined, free, total: free, kind };
    });
  }, [days, availByDate, slots, slotsLoaded]);

  const activeInfo = dayInfos.find((di) => isSameDay(di.d, activeDay));

  // Estados realmente presentes en el rango, en orden, para armar una leyenda relevante.
  const presentKinds = useMemo(() => {
    const order: DayKind[] = [
      "available",
      "almost",
      "full",
      "block",
      "holiday",
      "vacation",
      "closed",
    ];
    const set = new Set(dayInfos.map((di) => di.kind));
    return order.filter((k) => set.has(k));
  }, [dayInfos]);

  const daySlots = (slots ?? []).filter(
    (s) => isSameDay(s.startAt, activeDay) && s.startAt !== excludeStartAt,
  );

  // Huecos del día activo agrupados por franja (mañana/tarde/noche).
  const groupedSlots = useMemo(() => {
    const g: Record<TimeBand, Slot[]> = { morning: [], afternoon: [], evening: [] };
    for (const s of daySlots) g[timeBand(s.startAt)].push(s);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, activeDay, excludeStartAt]);

  // Si el día activo no es reservable (cerrado/completo/ausencia), saltamos al primero que sí lo sea.
  useEffect(() => {
    if (availByDate.size === 0) return;
    if (activeInfo && isBookableKind(activeInfo.kind)) return;
    const firstOpen = dayInfos.find((di) => isBookableKind(di.kind));
    if (firstOpen) onActiveDayChange(firstOpen.d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayInfos]);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dayInfos.map(({ d, a, free, total, kind }) => {
          const chip = formatDayChip(d);
          const active = isSameDay(d, activeDay);
          const bookable = isBookableKind(kind);
          const style = DAY_KIND_STYLE[kind];
          const subLabel =
            kind === "available"
              ? "Libre"
              : kind === "almost"
                ? `${free} libre${free === 1 ? "" : "s"}`
                : kind === "block"
                  ? a?.reason?.trim() || style.label
                  : style.label;
          // En días reservables informamos la ocupación exacta (dato del back) como tooltip.
          const occupancyTitle = bookable && total > 0 ? `Quedan ${free} de ${total} turnos` : null;
          const ariaLabel =
            `${chip.weekday} ${chip.day} — ${occupancyTitle ?? subLabel}` +
            (active ? " (seleccionado)" : "");
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => bookable && onActiveDayChange(d)}
              disabled={!bookable}
              aria-label={ariaLabel}
              title={occupancyTitle ?? (kind === "block" && a?.reason ? a.reason : style.label)}
              className={cn(
                "relative flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 transition-colors",
                style.chip,
                !bookable && "cursor-not-allowed",
                active && "ring-2 ring-accent ring-offset-2 ring-offset-background",
              )}
            >
              <span className="text-[11px] uppercase">{chip.weekday}</span>
              <span className="font-display text-base font-semibold tabular-nums">{chip.day}</span>
              <span className="mt-0.5 max-w-[5rem] truncate text-[9px] font-medium uppercase tracking-wide">
                {subLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leyenda: qué significa cada color de día. */}
      {presentKinds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5">
          {presentKinds.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className={cn("size-2.5 rounded-full", DAY_KIND_STYLE[k].dot)} aria-hidden />
              {DAY_KIND_STYLE[k].label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5">
        {isLoading && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar los horarios." onRetry={onRetry} />}
        {!isLoading &&
          !isError &&
          daySlots.length === 0 &&
          (() => {
            const kind = activeInfo?.kind;
            const blocked = kind != null && !isBookableKind(kind);
            const title = blocked
              ? kind === "block"
                ? activeInfo?.a?.reason?.trim() || "Bloqueado"
                : DAY_KIND_STYLE[kind].label
              : "Sin horarios este día";
            const message =
              kind === "vacation" || kind === "holiday" || kind === "block"
                ? "Ese día el profesional no atiende. Probá con otra fecha de la lista."
                : kind === "full"
                  ? "Todos los turnos de ese día ya están reservados. Probá con otra fecha."
                  : "Probá con otra fecha de la lista.";
            return (
              <EmptyState icon={<CalendarX2 className="size-5" />} title={title} message={message} />
            );
          })()}
        {!isLoading && !isError && daySlots.length > 0 && (
          <div className="space-y-5">
            {TIME_BANDS.map((band) => {
              const items = groupedSlots[band.key];
              if (items.length === 0) return null;
              const Icon = band.icon;
              return (
                <div key={band.key}>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="size-3.5" />
                    <span>{band.label}</span>
                    <span className="text-muted-foreground/60">
                      · {items.length} {items.length === 1 ? "turno" : "turnos"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {items.map((slot) => (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => onPickSlot(slot)}
                        disabled={pickDisabled}
                        className={cn(
                          "rounded-lg border py-2.5 font-display text-sm font-medium tabular-nums transition-colors focus-visible:border-accent disabled:opacity-50",
                          band.slotChip,
                        )}
                      >
                        {formatTime(slot.startAt)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
