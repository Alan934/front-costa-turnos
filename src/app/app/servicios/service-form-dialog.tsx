"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
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
import { useCreateComercioService, useUpdateComercioService } from "@/lib/api/catalog";
import { useMpStatus } from "@/lib/api/billing";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";

export function ServiceFormDialog({
  comercioId,
  service,
  onClose,
}: {
  comercioId: string;
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

  const create = useCreateComercioService(comercioId);
  const update = useUpdateComercioService(comercioId, service?.id ?? "");
  const pending = create.isPending || update.isPending;

  // Las formas de pago online (seña / pago completo) requieren MercadoPago conectado:
  // el cobro del cliente entra a la cuenta del profesional. Sin conexión no se ofrecen.
  const mp = useMpStatus();
  const mpConnected = mp.data?.connected ?? false;
  const paidLocked = !mp.isLoading && !mpConnected;

  const anyOption = allowNoPayment || allowDeposit || allowFullPayment;
  const depositOk = !allowDeposit || Number(depositAmount) > 0;
  // No permitir guardar opciones pagas si no hay MP (defensa: pudieron venir marcadas de antes).
  const paidOk = mpConnected || (!allowDeposit && !allowFullPayment);
  const canSubmit =
    name.trim().length > 1 &&
    Number(duration) > 0 &&
    Number(price) >= 0 &&
    anyOption &&
    depositOk &&
    paidOk;

  // Motivo por el que el botón está deshabilitado, para no dejar al usuario sin pistas.
  const blockReason = (() => {
    if (name.trim().length <= 1) return "Completá el nombre del servicio.";
    if (!(Number(duration) > 0)) return "La duración debe ser mayor a 0.";
    if (!(Number(price) >= 0)) return "Ingresá un precio válido.";
    if (!anyOption) return "Marcá al menos una forma de reservar.";
    if (!depositOk) return "Ingresá un monto de seña mayor a 0.";
    if (!paidOk) return "Conectá MercadoPago para cobrar seña o pago completo.";
    return null;
  })();

  function submit() {
    // Sin MP conectado nunca se persisten opciones de cobro online.
    const deposit = allowDeposit && mpConnected;
    const fullPayment = allowFullPayment && mpConnected;
    const payload = {
      name: name.trim(),
      durationMinutes: Number(duration),
      priceCents: Math.round(Number(price) * 100),
      allowNoPayment,
      allowDeposit: deposit,
      allowFullPayment: fullPayment,
      depositAmountCents: deposit ? Math.round(Number(depositAmount) * 100) : undefined,
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
                checked={allowDeposit && mpConnected}
                onChange={setAllowDeposit}
                disabled={paidLocked}
                title="Con seña"
                hint="Paga una parte para asegurar el turno."
              />
              {allowDeposit && mpConnected && (
                <div className="pl-8">
                  <Label htmlFor="sf-deposit">Monto de la seña ($)</Label>
                  <Input id="sf-deposit" type="number" min={0} step={100} className="mt-1.5" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="4000" />
                  {!depositOk && (
                    <p className="mt-1.5 text-xs text-destructive">Ingresá un monto de seña mayor a 0.</p>
                  )}
                </div>
              )}
              <OptionToggle
                checked={allowFullPayment && mpConnected}
                onChange={setAllowFullPayment}
                disabled={paidLocked}
                title="Pago completo"
                hint="Paga el total al reservar."
              />
            </div>
            {paidLocked && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                <Wallet className="mt-0.5 size-4 shrink-0" />
                <span>
                  Para cobrar seña o pago completo necesitás conectar tu cuenta de MercadoPago.{" "}
                  <Link href="/ajustes/pagos" className="font-medium underline underline-offset-2">
                    Conectar cobros
                  </Link>
                  .
                </span>
              </div>
            )}
            {!anyOption && (
              <p className="mt-2 text-xs text-destructive">Marcá al menos una forma de reservar.</p>
            )}
          </div>
        </div>

        <div className="space-y-2 p-6 pt-3">
          {blockReason && !pending && (
            <p className="text-center text-xs text-muted-foreground">{blockReason}</p>
          )}
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
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 transition-colors",
        disabled
          ? "cursor-not-allowed border-border opacity-60"
          : "cursor-pointer",
        !disabled && (checked ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"),
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[var(--color-accent)] disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
