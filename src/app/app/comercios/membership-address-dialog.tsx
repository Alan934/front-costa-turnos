"use client";

import { useState } from "react";
import { MapPin, Clock3, CalendarRange, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateMyMembership } from "@/lib/api/comercios";
import type { AxiosError } from "axios";

/**
 * Edita la configuración propia del profesional en un comercio (Fase 3 / membresía):
 * - **Ubicación** (`address`): dónde atiende; vacío vuelve a usar la dirección del comercio (fallback).
 * - **Anticipación mínima** (`minBookingHours`): horas que un cliente debe reservar por adelantado;
 *   0 = sin restricción. El back filtra los slots y rechaza reservas demasiado próximas (400).
 * - **Anticipación máxima** (`maxBookingDays`): días hacia el futuro que un cliente puede reservar;
 *   0 = sin límite. El back filtra los slots y rechaza reservas demasiado lejanas (400).
 * - **Reserva provisional** (`allowProvisionalBookings`): si está ON, un turno sin seña puede ser
 *   tomado por otro cliente que pague la seña; OFF (default) = el turno sin seña queda firme.
 */

/** Presets rápidos para la ventana máxima de reserva (en días). 0 = sin límite. */
const MAX_DAYS_PRESETS = [
  { value: 0, label: "Sin límite" },
  { value: 7, label: "1 semana" },
  { value: 14, label: "2 semanas" },
  { value: 30, label: "1 mes" },
  { value: 90, label: "3 meses" },
] as const;

export function MembershipAddressDialog({
  comercioId,
  comercioName,
  comercioAddress,
  currentAddress,
  currentMinBookingHours,
  currentMaxBookingDays,
  currentAllowProvisionalBookings,
  onClose,
}: {
  comercioId: string;
  comercioName: string;
  comercioAddress: string | null;
  currentAddress: string | null;
  currentMinBookingHours: number;
  currentMaxBookingDays: number;
  currentAllowProvisionalBookings: boolean;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(currentAddress ?? "");
  const [minBookingHours, setMinBookingHours] = useState(String(currentMinBookingHours));
  const [maxBookingDays, setMaxBookingDays] = useState(String(currentMaxBookingDays));
  const [allowProvisional, setAllowProvisional] = useState(currentAllowProvisionalBookings);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateMyMembership(comercioId);

  const trimmed = address.trim();
  // null limpia la dirección propia (el back vuelve al fallback del comercio).
  const usesFallback = trimmed.length === 0;

  // Vacío = 0 (sin restricción). Solo dígitos: el input es numérico no negativo.
  const hoursRaw = minBookingHours.trim();
  const hoursNum = hoursRaw === "" ? 0 : Number(hoursRaw);
  const hoursValid = Number.isInteger(hoursNum) && hoursNum >= 0;

  // Vacío = 0 (sin límite). Entero 0–730 (límite del back).
  const daysRaw = maxBookingDays.trim();
  const daysNum = daysRaw === "" ? 0 : Number(daysRaw);
  const daysValid = Number.isInteger(daysNum) && daysNum >= 0 && daysNum <= 730;

  function submit() {
    setError(null);
    if (!hoursValid) {
      setError("La anticipación mínima debe ser un número de horas igual o mayor a 0.");
      return;
    }
    if (!daysValid) {
      setError("La anticipación máxima debe ser un número entero de días entre 0 y 730.");
      return;
    }
    update.mutate(
      {
        address: usesFallback ? null : trimmed,
        minBookingHours: hoursNum,
        maxBookingDays: daysNum,
        allowProvisionalBookings: allowProvisional,
      },
      {
        onSuccess: onClose,
        onError: (err) => {
          const status = (err as AxiosError).response?.status;
          setError(
            status === 403
              ? "No tenés una membresía activa en este comercio."
              : "No pudimos guardar tu configuración. Probá de nuevo.",
          );
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tu configuración en {comercioName}</DialogTitle>
          <DialogDescription>
            Ajustá cómo te ven y reservan tus clientes cuando trabajás en este comercio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div>
            <Label htmlFor="ma-address">Tu ubicación</Label>
            <Input
              id="ma-address"
              className="mt-1.5"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setError(null); }}
              placeholder="Ej: A domicilio (zona centro)"
              autoFocus
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              {usesFallback
                ? comercioAddress
                  ? `Sin tu propia dirección, se usa la del comercio: ${comercioAddress}.`
                  : "Sin tu propia dirección, se usa la del comercio."
                : "Dejá el campo vacío para volver a usar la dirección del comercio."}
            </p>
          </div>

          <div>
            <Label htmlFor="ma-min-hours">Anticipación mínima (horas)</Label>
            <Input
              id="ma-min-hours"
              className="mt-1.5"
              value={minBookingHours}
              onChange={(e) => {
                // Solo dígitos; permitimos vacío mientras escribe.
                const v = e.target.value.replace(/[^\d]/g, "");
                setMinBookingHours(v);
                setError(null);
              }}
              inputMode="numeric"
              placeholder="0"
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="mt-0.5 size-3.5 shrink-0" />
              {hoursValid && hoursNum > 0
                ? `Tus clientes solo podrán reservar turnos que empiecen al menos ${hoursNum} ${hoursNum === 1 ? "hora" : "horas"} en el futuro.`
                : "0 = sin restricción: pueden reservar para cualquier horario disponible, incluso hoy."}
            </p>
          </div>

          <div>
            <Label htmlFor="ma-max-days">Anticipación máxima (días)</Label>
            <Input
              id="ma-max-days"
              className="mt-1.5"
              value={maxBookingDays}
              onChange={(e) => {
                // Solo dígitos; permitimos vacío mientras escribe.
                const v = e.target.value.replace(/[^\d]/g, "");
                setMaxBookingDays(v);
                setError(null);
              }}
              inputMode="numeric"
              placeholder="0"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MAX_DAYS_PRESETS.map((p) => {
                const active = daysNum === p.value && daysRaw !== "";
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setMaxBookingDays(String(p.value));
                      setError(null);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
              {daysValid && daysNum > 0
                ? `Tus clientes podrán reservar como máximo con ${daysNum} ${daysNum === 1 ? "día" : "días"} de anticipación.`
                : "0 = sin límite: pueden reservar para cualquier fecha disponible hacia adelante."}
            </p>
          </div>

          <div>
            <Label>Reserva provisional</Label>
            <label
              className={`mt-1.5 flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                allowProvisional ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
              }`}
            >
              <input
                type="checkbox"
                checked={allowProvisional}
                onChange={(e) => { setAllowProvisional(e.target.checked); setError(null); }}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="size-3.5 shrink-0" />
                  Permitir que un turno sin seña pueda ser tomado por otro cliente que pague la seña
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {allowProvisional
                    ? "Un turno reservado sin seña queda provisional: si otro cliente paga la seña para ese horario, lo desplaza."
                    : "Apagado: los turnos sin seña quedan firmes y nadie los puede desplazar pagando la seña."}
                </span>
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button className="w-full" disabled={update.isPending} onClick={submit}>
            {update.isPending ? <Spinner /> : null}
            Guardar configuración
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
