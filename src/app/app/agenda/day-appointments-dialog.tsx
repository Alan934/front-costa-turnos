"use client";

import { CalendarX2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { personDisplayName, isSameLocalDay } from "@/lib/agenda";
import { formatDateLong, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Service } from "@/lib/api/generated/model/service";

/**
 * Lista compacta de todos los turnos de un día, ordenada por hora. Pensada para no tener que
 * scrollear la grilla horaria. Tocar un turno abre su detalle; también permite crear uno.
 */
export function DayAppointmentsDialog({
  date,
  appointments,
  services,
  onClose,
  onSelect,
  onCreate,
}: {
  date: Date;
  appointments: Appointment[];
  services: Service[];
  onClose: () => void;
  onSelect: (a: Appointment) => void;
  onCreate: () => void;
}) {
  const items = appointments
    .filter((a) => isSameLocalDay(new Date(a.startAt), date))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">{formatDateLong(date)}</DialogTitle>
          <DialogDescription>
            {items.length === 0
              ? "Sin turnos este día"
              : `${items.length} ${items.length === 1 ? "turno" : "turnos"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto px-6 pb-2">
          {items.length === 0 ? (
            <EmptyState
              icon={<CalendarX2 className="size-5" />}
              title="Día libre"
              message="No hay turnos cargados para este día."
            />
          ) : (
            <ul className="space-y-2">
              {items.map((a) => {
                const service = services.find((s) => s.id === a.serviceId);
                const cancelled = a.status === "cancelled";
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(a)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-accent",
                        cancelled && "opacity-60",
                      )}
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="font-display text-sm font-semibold tabular-nums">
                          {formatTime(a.startAt)}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {formatTime(a.endAt)}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{personDisplayName(a.personId)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {service?.name ?? "Servicio"}
                        </p>
                      </div>
                      <AppointmentStatusBadge status={a.status} isProvisional={a.isProvisional} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button variant="outline" className="w-full" onClick={onCreate}>
            <Plus className="size-4" />
            Nuevo turno este día
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
