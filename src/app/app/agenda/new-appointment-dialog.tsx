"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { customInstance } from "@/lib/api/axios-instance";
import { formatDateLong, formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { Service } from "@/lib/api/generated/model/service";

/** Crea un turno desde la agenda (carga manual del profesional). */
export function NewAppointmentDialog({
  date,
  staff,
  services,
  onClose,
  onCreated,
}: {
  date: Date;
  staff: Staff[];
  services: Service[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [time, setTime] = useState("10:00");
  const [fullName, setFullName] = useState("");

  const service = services.find((s) => s.id === serviceId);

  const startAt = useMemo(() => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h || 10, m || 0, 0, 0);
    return d;
  }, [date, time]);

  const create = useMutation({
    mutationFn: () =>
      customInstance({
        url: "/appointments",
        method: "POST",
        data: {
          fullName: fullName.trim() || "Cliente sin nombre",
          staffId,
          serviceId,
          startAt: startAt.toISOString(),
        },
      }),
    onSuccess: onCreated,
  });

  const canSubmit = !!serviceId && !!staffId && !!time;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo turno</DialogTitle>
          <DialogDescription className="capitalize">
            {formatDateLong(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          {/* Servicio */}
          <div>
            <Label>Servicio</Label>
            <div className="mt-1.5 space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    serviceId === s.id
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50",
                  )}
                >
                  <span>
                    {s.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDuration(s.durationMinutes)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(s.priceCents)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Staff + hora */}
          <div className="grid grid-cols-2 gap-3">
            {staff.length > 1 && (
              <div>
                <Label htmlFor="na-staff">Profesional</Label>
                <select
                  id="na-staff"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={staff.length > 1 ? "" : "col-span-2"}>
              <Label htmlFor="na-time">Hora</Label>
              <Input
                id="na-time"
                type="time"
                className="mt-1.5"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Cliente */}
          <div>
            <Label htmlFor="na-name">Cliente</Label>
            <Input
              id="na-name"
              className="mt-1.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </div>

          {create.isError && (
            <p className="text-sm text-destructive">No pudimos crear el turno. Probá de nuevo.</p>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button
            className="w-full"
            disabled={!canSubmit || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Spinner /> : null}
            Crear turno{service ? ` · ${formatMoney(service.priceCents)}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
