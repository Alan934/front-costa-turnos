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
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";

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
  const [price, setPrice] = useState(service ? String(service.priceCents / 100) : "");

  // Formas de pago habilitadas (el profesional puede elegir varias).
  const [allowNoPayment, setAllowNoPayment] = useState(service ? service.allowNoPayment : true);
  const [allowDeposit, setAllowDeposit] = useState(service?.allowDeposit ?? false);
  const [allowFullPayment, setAllowFullPayment] = useState(service?.allowFullPayment ?? false);
  const [depositAmount, setDepositAmount] = useState(
    service?.depositAmountCents ? String(service.depositAmountCents / 100) : "",
  );

  const create = useCreateService();
  const update = useUpdateService(service?.id ?? "");
  const pending = create.isPending || update.isPending;

  const anyOption = allowNoPayment || allowDeposit || allowFullPayment;
  const depositOk = !allowDeposit || Number(depositAmount) > 0;
  const canSubmit =
    name.trim().length > 1 && Number(duration) > 0 && Number(price) >= 0 && anyOption && depositOk;

  function submit() {
    const payload = {
      name: name.trim(),
      durationMinutes: Number(duration),
      priceCents: Math.round(Number(price) * 100),
      allowNoPayment,
      allowDeposit,
      allowFullPayment,
      depositAmountCents: allowDeposit ? Math.round(Number(depositAmount) * 100) : undefined,
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

          {/* Formas de pago para reservar (varias a la vez) */}
          <div>
            <Label>Cómo se puede reservar</Label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Elegí una o varias. El cliente verá solo las que marques.
            </p>
            <div className="space-y-2">
              <OptionToggle
                checked={allowNoPayment}
                onChange={setAllowNoPayment}
                title="Sin pago"
                hint="Reserva directa, sin abonar."
              />
              <OptionToggle
                checked={allowDeposit}
                onChange={setAllowDeposit}
                title="Con seña"
                hint="Paga una parte para asegurar el turno."
              />
              {allowDeposit && (
                <div className="pl-8">
                  <Label htmlFor="sf-deposit">Monto de la seña ($)</Label>
                  <Input id="sf-deposit" type="number" min={0} step={100} className="mt-1.5" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="4000" />
                </div>
              )}
              <OptionToggle
                checked={allowFullPayment}
                onChange={setAllowFullPayment}
                title="Pago completo"
                hint="Paga el total al reservar."
              />
            </div>
            {!anyOption && (
              <p className="mt-2 text-xs text-destructive">Marcá al menos una forma de reservar.</p>
            )}
          </div>
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

function OptionToggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
        checked ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
