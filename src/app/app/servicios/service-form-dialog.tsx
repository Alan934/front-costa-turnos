"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useCreateService, useUpdateService } from "@/lib/api/catalog";
import { DepositMode } from "@/lib/api/generated/model/depositMode";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";

const DEPOSIT_OPTIONS: { value: DepositMode; label: string; hint: string }[] = [
  { value: DepositMode.none, label: "Sin seña", hint: "Reserva directa" },
  { value: DepositMode.hybrid, label: "Híbrida", hint: "Sin seña queda provisional" },
  { value: DepositMode.required, label: "Obligatoria", hint: "Hay que abonar para reservar" },
];

export function ServiceFormDialog({
  service,
  onClose,
}: {
  service?: Service;
  onClose: () => void;
}) {
  const editing = !!service;
  const [name, setName] = useState(service?.name ?? "");
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [price, setPrice] = useState(
    service ? String(service.priceCents / 100) : "",
  );
  const [depositMode, setDepositMode] = useState<DepositMode>(
    service?.depositMode ?? DepositMode.none,
  );
  const [depositAmount, setDepositAmount] = useState(
    service?.depositAmountCents ? String(service.depositAmountCents / 100) : "",
  );

  const create = useCreateService();
  const update = useUpdateService(service?.id ?? "");
  const pending = create.isPending || update.isPending;

  const needsAmount = depositMode !== DepositMode.none;
  const canSubmit =
    name.trim().length > 1 &&
    Number(duration) > 0 &&
    Number(price) >= 0 &&
    (!needsAmount || Number(depositAmount) > 0);

  function submit() {
    const payload = {
      name: name.trim(),
      durationMinutes: Number(duration),
      priceCents: Math.round(Number(price) * 100),
      depositMode,
      depositAmountCents: needsAmount ? Math.round(Number(depositAmount) * 100) : undefined,
    };
    if (editing) update.mutate(payload, { onSuccess: onClose });
    else create.mutate(payload, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div>
            <Label htmlFor="sf-name">Nombre</Label>
            <Input id="sf-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte + barba" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sf-dur">Duración (min)</Label>
              <Input id="sf-dur" type="number" min={5} step={5} className="mt-1.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sf-price">Precio ($)</Label>
              <Input id="sf-price" type="number" min={0} step={100} className="mt-1.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="8000" />
            </div>
          </div>

          {/* Modo de seña */}
          <div>
            <Label>Seña</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {DEPOSIT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setDepositMode(o.value)}
                  className={cn(
                    "rounded-lg border p-2.5 text-center text-xs transition-colors",
                    depositMode === o.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}
                >
                  <span className="block font-semibold">{o.label}</span>
                  <span className="mt-0.5 block leading-tight">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {needsAmount && (
            <div>
              <Label htmlFor="sf-deposit">Monto de la seña ($)</Label>
              <Input id="sf-deposit" type="number" min={0} step={100} className="mt-1.5" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="4000" />
            </div>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit || pending} onClick={submit}>
            {pending ? <Spinner /> : null}
            {editing ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
