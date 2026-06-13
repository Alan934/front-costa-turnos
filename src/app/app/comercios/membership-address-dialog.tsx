"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
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
 * Edita la ubicación propia del profesional en un comercio (Fase 3).
 * Dejar el campo vacío la limpia: vuelve a usar la dirección del comercio (fallback).
 */
export function MembershipAddressDialog({
  comercioId,
  comercioName,
  comercioAddress,
  currentAddress,
  onClose,
}: {
  comercioId: string;
  comercioName: string;
  comercioAddress: string | null;
  currentAddress: string | null;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(currentAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateMyMembership(comercioId);

  const trimmed = address.trim();
  // null limpia la dirección propia (el back vuelve al fallback del comercio).
  const usesFallback = trimmed.length === 0;

  function submit() {
    setError(null);
    update.mutate(
      { address: usesFallback ? null : trimmed },
      {
        onSuccess: onClose,
        onError: (err) => {
          const status = (err as AxiosError).response?.status;
          setError(
            status === 403
              ? "No tenés una membresía activa en este comercio."
              : "No pudimos guardar tu ubicación. Probá de nuevo.",
          );
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tu ubicación en {comercioName}</DialogTitle>
          <DialogDescription>
            Es la dirección que ven tus clientes al reservar con vos en este comercio. Por ejemplo,
            si atendés a domicilio o en otra sucursal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-2">
          <div>
            <Label htmlFor="ma-address">Dirección</Label>
            <Input
              id="ma-address"
              className="mt-1.5"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setError(null); }}
              placeholder="Ej: A domicilio (zona centro)"
              autoFocus
            />
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {usesFallback
              ? comercioAddress
                ? `Sin tu propia dirección, se usa la del comercio: ${comercioAddress}.`
                : "Sin tu propia dirección, se usa la del comercio."
              : "Dejá el campo vacío para volver a usar la dirección del comercio."}
          </p>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button className="w-full" disabled={update.isPending} onClick={submit}>
            {update.isPending ? <Spinner /> : null}
            {usesFallback ? "Usar la dirección del comercio" : "Guardar mi ubicación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
