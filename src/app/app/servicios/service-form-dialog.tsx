"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wallet, ImagePlus, X, Loader2 } from "lucide-react";
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
import { useMyMemberships } from "@/lib/api/comercios";
import {
  uploadFile,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  uploadErrorMessage,
} from "@/lib/api/files";
import { cn } from "@/lib/utils";
import type { AxiosError } from "axios";
import type { Service } from "@/lib/api/generated/model/service";

/** Máximo de imágenes de ejemplo por servicio (lo valida también el back con 400). */
const MAX_IMAGES = 3;

/**
 * Imagen del servicio dentro del formulario. "saved" ya está persistida (su `key` viaja en
 * imageKeys); "new" se eligió en esta sesión y se sube recién al guardar (necesita el serviceId).
 */
type ServiceImage =
  | { kind: "saved"; key: string; url?: string }
  | { kind: "new"; localId: string; file: File; url: string };

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
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [price, setPrice] = useState(service ? String(service.priceCents / 100) : "");

  // Imágenes de ejemplo. Las ya guardadas traen su URL firmada si el back la incluye
  // (`imageUrls`, paralelo a `imageKeys`); si no, se muestran como tiles sin miniatura.
  const [images, setImages] = useState<ServiceImage[]>(() => {
    const urls = (service as (Service & { imageUrls?: string[] }) | undefined)?.imageUrls;
    return (service?.imageKeys ?? []).map((key, i) => ({
      kind: "saved" as const,
      key,
      url: urls?.[i],
    }));
  });

  // Formas de pago habilitadas (el profesional puede elegir varias).
  const [allowNoPayment, setAllowNoPayment] = useState(service ? service.allowNoPayment : true);
  const [allowDeposit, setAllowDeposit] = useState(service?.allowDeposit ?? false);
  const [allowFullPayment, setAllowFullPayment] = useState(service?.allowFullPayment ?? false);
  // Efectivo: cobra el precio completo del servicio (sin IVA/recargo) y NO requiere MercadoPago,
  // porque el pago se recibe en persona. El turno queda confirmado al reservar.
  const [allowCash, setAllowCash] = useState(service?.allowCash ?? false);
  const [depositAmount, setDepositAmount] = useState(
    service?.depositAmountCents ? String(service.depositAmountCents / 100) : "",
  );
  const [capacity, setCapacity] = useState(String(service?.capacity ?? 1));

  const create = useCreateComercioService(comercioId);
  const update = useUpdateComercioService(comercioId);
  // El guardado abarca subida de imágenes + create/patch, así que llevamos nuestro propio flag.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = saving || create.isPending || update.isPending;

  // Membresía propia en este comercio: necesaria para asignar el profesional al crear.
  const memberships = useMyMemberships();
  const myMembershipId = memberships.data?.find((m) => m.comercioId === comercioId)?.id;

  // Las formas de pago online (seña / pago completo) requieren MercadoPago conectado:
  // el cobro del cliente entra a la cuenta del profesional. Sin conexión no se ofrecen.
  const mp = useMpStatus();
  const mpConnected = mp.data?.connected ?? false;
  const paidLocked = !mp.isLoading && !mpConnected;

  const anyOption = allowNoPayment || allowDeposit || allowFullPayment || allowCash;
  const depositOk = !allowDeposit || Number(depositAmount) > 0;
  // No permitir guardar opciones pagas si no hay MP (defensa: pudieron venir marcadas de antes).
  const paidOk = mpConnected || (!allowDeposit && !allowFullPayment);
  const capacityNum = Number(capacity);
  const canSubmit =
    name.trim().length > 1 &&
    Number(duration) > 0 &&
    Number(price) >= 0 &&
    anyOption &&
    depositOk &&
    paidOk &&
    capacityNum >= 1;

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

  async function submit() {
    setSaveError(null);
    // Sin MP conectado nunca se persisten opciones de cobro online.
    const deposit = allowDeposit && mpConnected;
    const fullPayment = allowFullPayment && mpConnected;
    const base = {
      name: name.trim(),
      // Se manda siempre (string): vacío permite borrar la descripción existente.
      description: description.trim(),
      durationMinutes: Number(duration),
      priceCents: Math.round(Number(price) * 100),
      allowNoPayment,
      allowDeposit: deposit,
      allowFullPayment: fullPayment,
      allowCash,
      depositAmountCents: deposit ? Math.round(Number(depositAmount) * 100) : undefined,
      capacity: capacityNum,
    };

    setSaving(true);
    try {
      // Las imágenes se suben a /files con ownerId = serviceId, así que para un servicio
      // nuevo primero lo creamos (con descripción, sin imágenes) y luego subimos + PATCH.
      const serviceId = editing
        ? service!.id
        : (
            await create.mutateAsync({
              ...base,
              ...(myMembershipId ? { membershipIds: [myMembershipId] } : {}),
            })
          ).id;

      // Subimos las imágenes nuevas y resolvemos el orden final de object_keys.
      const newImages = images.filter((i): i is Extract<ServiceImage, { kind: "new" }> => i.kind === "new");
      const uploadedByLocalId = new Map<string, string>();
      for (const img of newImages) {
        const uploaded = await uploadFile({ file: img.file, ownerType: "service", ownerId: serviceId });
        uploadedByLocalId.set(img.localId, uploaded.objectKey);
      }
      const imageKeys = images
        .map((i) => (i.kind === "saved" ? i.key : uploadedByLocalId.get(i.localId)))
        .filter((k): k is string => !!k);

      // En edición parcheamos siempre. En alta, solo si hay imágenes (el create ya guardó el resto):
      // un PATCH con imageKeys que omita una key previa hace que el back borre ese objeto de MinIO.
      if (editing) {
        await update.mutateAsync({ id: serviceId, data: { ...base, imageKeys } });
      } else if (imageKeys.length > 0) {
        await update.mutateAsync({ id: serviceId, data: { imageKeys } });
      }
      onClose();
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      setSaveError(uploadErrorMessage(status));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div>
            <Label htmlFor="sf-name">Nombre</Label>
            <Input id="sf-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte + barba" />
          </div>

          <div>
            <Label htmlFor="sf-desc">
              Descripción <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <textarea
              id="sf-desc"
              rows={3}
              maxLength={600}
              className={cn(
                "mt-1.5 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué incluye el servicio o qué se realiza."
            />
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

          <div>
            <Label htmlFor="sf-capacity">Cupos por turno</Label>
            <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
              Cuántos clientes pueden reservar el mismo horario. Por defecto 1.
            </p>
            <Input
              id="sf-capacity"
              type="number"
              min={1}
              step={1}
              className="w-32"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="1"
            />
            {capacityNum < 1 && capacity !== "" && (
              <p className="mt-1.5 text-xs text-destructive">Mínimo 1 cupo.</p>
            )}
          </div>

          {/* Imágenes de ejemplo (hasta 3) */}
          <div>
            <Label>
              Imágenes de ejemplo <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Hasta {MAX_IMAGES} fotos de lo que ofrecés. JPG, PNG o WebP · hasta 10 MB.
            </p>
            <ServiceImagesField images={images} onChange={setImages} disabled={pending} />
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
              <OptionToggle
                checked={allowCash}
                onChange={setAllowCash}
                title="Aceptar efectivo"
                hint="Reserva confirmada; paga el precio completo en persona (sin IVA)."
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
          {saveError && <p className="text-center text-xs text-destructive">{saveError}</p>}
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

/** Galería editable de imágenes de ejemplo (hasta MAX_IMAGES). */
function ServiceImagesField({
  images,
  onChange,
  disabled,
}: {
  images: ServiceImage[];
  onChange: (next: ServiceImage[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Liberamos los object URLs de los previews locales al desmontar.
  useEffect(() => {
    return () => {
      for (const img of images) if (img.kind === "new") URL.revokeObjectURL(img.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (files.length === 0) return;
    setError(null);

    const room = MAX_IMAGES - images.length;
    const next: ServiceImage[] = [];
    for (const file of files.slice(0, room)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setError("Formato no permitido. Usá JPG, PNG o WebP.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError("Cada imagen debe pesar menos de 10 MB.");
        continue;
      }
      next.push({
        kind: "new",
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
      });
    }
    if (files.length > room) setError(`Solo se permiten ${MAX_IMAGES} imágenes.`);
    if (next.length > 0) onChange([...images, ...next]);
  }

  function removeAt(index: number) {
    const img = images[index];
    if (img.kind === "new") URL.revokeObjectURL(img.url);
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {images.map((img, i) => (
          <div
            key={img.kind === "new" ? img.localId : img.key}
            className="relative size-20 overflow-hidden rounded-xl border border-border bg-muted/40"
          >
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-muted-foreground">
                <ImagePlus className="size-6" />
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              disabled={disabled}
              aria-label="Quitar imagen"
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-card/90 text-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={cn(
              "grid size-20 place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-accent hover:text-accent",
              disabled && "pointer-events-none opacity-50",
            )}
            aria-label="Agregar imagen"
          >
            {disabled ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-6" />}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={onPick}
        aria-label="Agregar imagen"
      />
    </div>
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
