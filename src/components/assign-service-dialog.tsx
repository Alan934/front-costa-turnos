"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAppointmentsAssignService } from "@/lib/api/generated/endpoints/appointments/appointments";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { formatDuration, formatMoney, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";

/**
 * Le pone servicio a quien se anotó en la sala sin elegir uno (o corrige el que tenía). Define el
 * precio al cobrar y el tiempo estimado de la fila, así que se pide cuando importa: al atenderlo
 * o al cobrarlo. `onAssigned` recibe el id elegido por si hay que seguir (p. ej. terminar y cobrar).
 */
export function AssignServiceDialog({
  appointmentId,
  clientName,
  services,
  currentServiceId,
  onClose,
  onAssigned,
}: {
  appointmentId: string;
  clientName: string;
  services: Service[];
  currentServiceId?: string | null;
  onClose: () => void;
  onAssigned: (serviceId: string) => void;
}) {
  const [serviceId, setServiceId] = useState(currentServiceId ?? "");
  const assign = useAppointmentsAssignService();

  function submit() {
    assign.mutate(
      { id: appointmentId, data: { serviceId } },
      { onSuccess: () => onAssigned(serviceId) },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !assign.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué servicio es?</DialogTitle>
          <DialogDescription>
            {clientName ? `${clientName} se anotó sin elegir servicio. ` : ""}
            Con esto se calcula el precio y el tiempo de espera.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenés servicios activos en este comercio.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {services.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      s.id === serviceId
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{titleCaseName(s.name)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(s.durationMinutes)} · {formatMoney(s.priceCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {assign.isError && (
            <p className="text-sm text-destructive">{getApiErrorMessage(assign.error)}</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={assign.isPending}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={submit}
              disabled={!serviceId || assign.isPending}
            >
              {assign.isPending ? <Spinner /> : <Check className="size-4" />}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
