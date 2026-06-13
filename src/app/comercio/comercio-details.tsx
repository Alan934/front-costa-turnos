"use client";

import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateComercio } from "@/lib/api/comercios";
import type { AxiosError } from "axios";
import type { Comercio } from "@/lib/api/generated/model/comercio";

const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (centro/este)" },
  { value: "America/Argentina/Mendoza", label: "Mendoza" },
  { value: "America/Argentina/Cordoba", label: "Córdoba" },
  { value: "America/Argentina/Salta", label: "Salta / NOA" },
  { value: "America/Argentina/Tucuman", label: "Tucumán" },
  { value: "America/Argentina/Ushuaia", label: "Ushuaia / Sur" },
];

/** Datos del comercio (nombre, dirección, zona horaria) editables por el comercial. */
export function ComercioDetails({ comercio }: { comercio: Comercio }) {
  const update = useUpdateComercio(comercio.id);
  const [name, setName] = useState(comercio.name);
  const [address, setAddress] = useState(comercio.address ?? "");
  const [timezone, setTimezone] = useState(comercio.timezone);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Al cambiar de comercio (selector), recargamos el formulario.
  useEffect(() => {
    setName(comercio.name);
    setAddress(comercio.address ?? "");
    setTimezone(comercio.timezone);
    setError(null);
    setSavedOk(false);
  }, [comercio.id, comercio.name, comercio.address, comercio.timezone]);

  const dirty =
    name.trim() !== comercio.name ||
    address.trim() !== (comercio.address ?? "") ||
    timezone !== comercio.timezone;
  const canSave = dirty && name.trim().length > 1 && !update.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedOk(false);
    update.mutate(
      { name: name.trim(), address: address.trim() || undefined, timezone },
      {
        onSuccess: () => setSavedOk(true),
        onError: (err) => {
          const status = (err as AxiosError).response?.status;
          setError(
            status === 403
              ? "No tenés permisos para editar este comercio."
              : "No pudimos guardar los cambios. Probá de nuevo.",
          );
        },
      },
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
          <Store className="size-4" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">Datos del comercio</h2>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <Label htmlFor="cm-name">Nombre</Label>
          <Input
            id="cm-name"
            className="mt-1.5"
            value={name}
            onChange={(e) => { setName(e.target.value); setSavedOk(false); }}
            placeholder="Peluquería Centro"
          />
        </div>
        <div>
          <Label htmlFor="cm-address">
            Dirección <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="cm-address"
            className="mt-1.5"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSavedOk(false); }}
            placeholder="Belgrano 245, Costa de Araujo"
          />
        </div>
        <div>
          <Label htmlFor="cm-tz">Zona horaria</Label>
          <select
            id="cm-tz"
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSavedOk(false); }}
          >
            {TIMEZONES.every((t) => t.value !== timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          Tu enlace público es <span className="font-medium text-foreground">/r/{comercio.slug}</span>{" "}
          (no se puede cambiar).
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!canSave}>
            {update.isPending ? <Spinner /> : null}
            Guardar cambios
          </Button>
          {savedOk && !dirty && (
            <span className="text-sm text-success">Cambios guardados.</span>
          )}
        </div>
      </form>
    </section>
  );
}
