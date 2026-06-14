"use client";

import { useState } from "react";
import { MapPin, Clock3 } from "lucide-react";
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
 */
export function MembershipAddressDialog({
  comercioId,
  comercioName,
  comercioAddress,
  currentAddress,
  currentMinBookingHours,
  onClose,
}: {
  comercioId: string;
  comercioName: string;
  comercioAddress: string | null;
  currentAddress: string | null;
  currentMinBookingHours: number;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(currentAddress ?? "");
  const [minBookingHours, setMinBookingHours] = useState(String(currentMinBookingHours));
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateMyMembership(comercioId);

  const trimmed = address.trim();
  // null limpia la dirección propia (el back vuelve al fallback del comercio).
  const usesFallback = trimmed.length === 0;

  // Vacío = 0 (sin restricción). Solo dígitos: el input es numérico no negativo.
  const hoursRaw = minBookingHours.trim();
  const hoursNum = hoursRaw === "" ? 0 : Number(hoursRaw);
  const hoursValid = Number.isInteger(hoursNum) && hoursNum >= 0;

  function submit() {
    setError(null);
    if (!hoursValid) {
      setError("La anticipación mínima debe ser un número de horas igual o mayor a 0.");
      return;
    }
    update.mutate(
      { address: usesFallback ? null : trimmed, minBookingHours: hoursNum },
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
