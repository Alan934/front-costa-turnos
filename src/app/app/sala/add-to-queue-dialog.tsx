"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, Check } from "lucide-react";
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
import { useClients } from "@/lib/api/clients";
import { useAppointmentsWalkIn } from "@/lib/api/generated/endpoints/appointments/appointments";
import {
  getApiErrorMessage,
  getApiValidationMessages,
  matchFieldErrors,
} from "@/lib/api/error-message";
import { formatDuration, formatMoney, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";
import type { EnrichedClient } from "@/mocks/contract-extensions";

/**
 * Agrega a la fila a alguien que llegó sin turno. Dos caminos en la misma
 * pantalla: buscarlo en la cartera (un tap, sin tipear datos) o darlo de alta
 * en el momento con el nombre. El teléfono es opcional pero es lo que permite
 * reconocerlo la próxima vez.
 */
export function AddToQueueDialog({
  staffId,
  services,
  onClose,
  onAdded,
}: {
  staffId: string;
  services: Service[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EnrichedClient | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");

  const clientsQuery = useClients();
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return (clientsQuery.data ?? [])
      .filter((c) => c.status === "active")
      .filter(
        (c) =>
          (c.fullName ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q),
      )
      .slice(0, 6);
  }, [clientsQuery.data, query]);

  const add = useAppointmentsWalkIn();

  const fieldErrors = add.isError
    ? matchFieldErrors(getApiValidationMessages(add.error), ["fullName", "phone", "serviceId"])
    : {};
  const canSubmit = !!serviceId && (!!selected || fullName.trim().length > 0);

  function submit() {
    add.mutate(
      {
        data: {
          staffId,
          serviceId,
          ...(selected
            ? { personId: selected.personId }
            : { fullName: fullName.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) }),
        },
      },
      { onSuccess: onAdded },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar a la fila</DialogTitle>
          <DialogDescription>
            Para alguien que llegó sin turno. Entra al final de la cola con su número.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div>
            <Label htmlFor="walkin-search">Buscar en tus clientes</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="walkin-search"
                className="pl-9"
                placeholder="Nombre o teléfono"
                value={selected ? (selected.fullName ?? "") : query}
                onChange={(e) => {
                  setSelected(null);
                  setQuery(e.target.value);
                }}
                autoComplete="off"
              />
            </div>

            {selected ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-accent">
                <Check className="size-4" />
                {titleCaseName(selected.fullName ?? "Cliente")}
                <button
                  type="button"
                  className="ml-1 text-xs text-muted-foreground underline"
                  onClick={() => setSelected(null)}
                >
                  cambiar
                </button>
              </p>
            ) : (
              matches.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(c);
                          setFullName("");
                          setPhone("");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-accent/60"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {titleCaseName(c.fullName ?? "Cliente")}
                        </span>
                        {c.phone && (
                          <span className="text-xs text-muted-foreground">{c.phone}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          {!selected && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UserPlus className="size-3.5" />
                Cliente nuevo
              </p>
              <div className="mt-2.5 space-y-3">
                <div>
                  <Label htmlFor="walkin-name">Nombre</Label>
                  <Input
                    id="walkin-name"
                    className={cn("mt-1.5", fieldErrors.fullName && "border-destructive")}
                    placeholder="Juan García"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.fullName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="walkin-phone">Teléfono (opcional)</Label>
                  <Input
                    id="walkin-phone"
                    className={cn("mt-1.5", fieldErrors.phone && "border-destructive")}
                    placeholder="2612465120"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-xs text-destructive">Revisá el número de teléfono.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Servicio</Label>
            {services.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                No tenés servicios activos en este comercio.
              </p>
            ) : (
              <ul className="mt-1.5 grid gap-1.5">
                {services.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
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
          </div>

          {add.isError && Object.keys(fieldErrors).length === 0 && (
            <p className="text-sm text-destructive">{getApiErrorMessage(add.error)}</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={submit} disabled={!canSubmit || add.isPending}>
              {add.isPending ? <Spinner /> : <UserPlus className="size-4" />}
              Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
