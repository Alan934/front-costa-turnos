"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { customInstance } from "@/lib/api/axios-instance";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Slot } from "@/mocks/contract-extensions";

/**
 * Elección de la hora de un turno para un día: entre los horarios libres de ese día (para el
 * servicio y quien atiende) o una tipeada a mano ("Otro horario": sobreturno, fuera del horario
 * habitual). La usan "Nuevo turno" y "Cambiar horario".
 */
export function useTimeChoice(
  date: Date,
  staffId: string,
  serviceId: string,
  /** Hora preferida "HH:mm" (p. ej. la del último turno del cliente): se elige si está libre. */
  preferredTime?: string | null,
) {
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState(false);
  const [time, setTime] = useState("10:00");

  const dayRange = useMemo(() => {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(date);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [date]);

  const slots = useQuery({
    queryKey: ["agenda-free-slots", staffId, serviceId, dayRange.from],
    queryFn: ({ signal }) =>
      customInstance<Slot[]>({
        url: "/v1/availability/slots",
        method: "GET",
        params: { staffId, serviceId, from: dayRange.from, to: dayRange.to },
        signal,
      }),
    enabled: !!staffId && !!serviceId,
    // Siempre al día: si se acaba de mover o cancelar un turno, ese horario ya tiene que
    // aparecer libre (el default de 30 s mostraba la lista vieja).
    staleTime: 0,
  });
  // No se ofrecen horarios que ya pasaron (si el turno es para hoy).
  const freeSlots = (slots.data ?? []).filter((s) => +new Date(s.startAt) > Date.now());
  const useManual = manualTime || slots.isError;

  // Hora preferida: al cargar los horarios del día, si está libre queda elegida.
  const preferredSlot = preferredTime
    ? freeSlots.find((s) => formatTime(s.startAt) === preferredTime)
    : undefined;
  useEffect(() => {
    if (preferredSlot && !slotStart) setSlotStart(preferredSlot.startAt);
    // Solo al cambiar el slot encontrado (otro día u otro servicio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredSlot?.startAt]);
  /** La hora preferida no está libre ese día (para avisar). */
  const preferredMissing = !!preferredTime && slots.isSuccess && !preferredSlot;

  const startAt = useMemo(() => {
    if (!useManual) return slotStart ? new Date(slotStart) : null;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }, [useManual, slotStart, time, date]);

  return {
    slots,
    freeSlots,
    useManual,
    manualTime,
    setManualTime,
    time,
    setTime,
    slotStart,
    setSlotStart,
    startAt,
    preferredMissing,
    /** Los horarios libres dependen del día, el servicio y quien atiende: al cambiar, se borra. */
    reset: () => setSlotStart(null),
  };
}

export type TimeChoice = ReturnType<typeof useTimeChoice>;

export function TimeField({
  choice,
  inputId,
  error,
}: {
  choice: TimeChoice;
  inputId: string;
  error?: string;
}) {
  const { slots, freeSlots, useManual, manualTime, setManualTime, time, setTime, slotStart } =
    choice;
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={useManual ? inputId : undefined}>
          Hora <span className="text-destructive">*</span>
        </Label>
        {!slots.isError && (
          <button
            type="button"
            onClick={() => setManualTime((v) => !v)}
            className="text-xs font-medium text-accent hover:underline"
          >
            {manualTime ? "Ver horarios libres" : "Otro horario"}
          </button>
        )}
      </div>

      {useManual ? (
        <>
          <Input
            id={inputId}
            type="time"
            className={cn("mt-1.5", error && "border-destructive")}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cargás la hora a mano. Si se pisa con otro turno, te avisamos al guardar.
          </p>
        </>
      ) : slots.isLoading ? (
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Buscando horarios libres…
        </p>
      ) : freeSlots.length === 0 ? (
        <p className="mt-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          No quedan horarios libres este día para ese servicio. Usá{" "}
          <button
            type="button"
            onClick={() => setManualTime(true)}
            className="font-medium text-accent hover:underline"
          >
            otro horario
          </button>{" "}
          para cargar uno a mano.
        </p>
      ) : (
        <div className="mt-1.5 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {freeSlots.map((s) => (
            <button
              key={s.startAt}
              type="button"
              onClick={() => choice.setSlotStart(s.startAt)}
              aria-pressed={slotStart === s.startAt}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                slotStart === s.startAt
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:border-accent/50",
              )}
            >
              {formatTime(s.startAt)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** "2026-11-21" (fecha local) para un `<input type="date">`. */
export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha local a partir del valor de un `<input type="date">` (null si está vacío). */
export function fromDateInputValue(value: string): Date | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
