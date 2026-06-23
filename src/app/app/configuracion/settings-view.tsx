"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { ImageUpload } from "@/components/image-upload";
import { PublicPageLink } from "@/components/public-page-link";
import { useProfessional, useUpdateProfessional, useSubscription } from "@/lib/api/professional";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
import { subscriptionEndInfo } from "@/lib/subscription";
import { formatMoney, formatDateLong } from "@/lib/format";
import type { PublicPageBranding } from "@/mocks/contract-extensions";

export function SettingsView() {
  const pro = useProfessional();

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Configuración</h1>
      <p className="text-sm text-muted-foreground">Tu negocio, tu página pública y tu suscripción</p>

      {pro.isLoading && (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}
      {pro.isError && <ErrorState className="mt-6" onRetry={() => pro.refetch()} />}

      {pro.data && (
        <div className="mt-7 space-y-8">
          <BusinessSection professional={pro.data} />
          <Separator />
          <VatSection professional={pro.data} />
          <Separator />
          <BrandingSection professional={pro.data} />
          <Separator />
          <SubscriptionSection />
        </div>
      )}
    </div>
  );
}

function BusinessSection({
  professional,
}: {
  professional: {
    businessName: string;
    cancellationWindowHours: number;
    rescheduleWindowHours: number;
    address?: string | null;
  };
}) {
  const update = useUpdateProfessional();
  const [name, setName] = useState(professional.businessName);
  const [address, setAddress] = useState(professional.address ?? "");
  const [window, setWindow] = useState(String(professional.cancellationWindowHours));
  const [rescheduleWindow, setRescheduleWindow] = useState(
    String(professional.rescheduleWindowHours),
  );
  const [saved, setSaved] = useState(false);

  function save() {
    update.mutate(
      {
        businessName: name.trim(),
        address: address.trim(),
        cancellationWindowHours: Number(window),
        rescheduleWindowHours: Number(rescheduleWindow),
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Negocio</h2>
      <div className="space-y-4">
        <div>
          <Label htmlFor="biz-name">Nombre del negocio</Label>
          <Input id="biz-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="biz-address">Dirección</Label>
          <Input id="biz-address" className="mt-1.5" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Belgrano 245, Costa de Araujo, Mendoza" />
          <p className="mt-1 text-xs text-muted-foreground">Se muestra en tu página pública y en el turno del cliente.</p>
        </div>
        <div>
          <Label htmlFor="biz-window">Cancelación: hasta cuántas horas antes</Label>
          <Input id="biz-window" type="number" min={0} className="mt-1.5" value={window} onChange={(e) => setWindow(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Tus clientes pueden cancelar online hasta {window || 0} h antes del turno.
          </p>
        </div>
        <div>
          <Label htmlFor="biz-reschedule-window">Reprogramación: hasta cuántas horas antes</Label>
          <Input id="biz-reschedule-window" type="number" min={0} className="mt-1.5" value={rescheduleWindow} onChange={(e) => setRescheduleWindow(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Tus clientes pueden reprogramar online hasta {rescheduleWindow || 0} h antes del turno.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Guardado" : "Guardar"}
        </Button>
      </div>
    </section>
  );
}

/**
 * IVA por defecto del profesional. Solo afecta a los pagos por Mercado Pago: cubre la comisión de
 * acreditación de Checkout (que varía según el plazo de cobro). Cada servicio puede tener su propio
 * IVA; si no, hereda este valor. Efectivo y transferencia nunca llevan IVA.
 */
function VatSection({
  professional,
}: {
  professional: { defaultVatPercent: number; vatChargedToClient: boolean };
}) {
  const update = useUpdateProfessional();
  const [vat, setVat] = useState(String(professional.defaultVatPercent));
  const [chargedToClient, setChargedToClient] = useState(professional.vatChargedToClient);
  const [saved, setSaved] = useState(false);

  const vatNum = Number(vat);
  const vatOk = vat.trim() !== "" && vatNum >= 0 && vatNum <= 100;

  function save() {
    update.mutate(
      { defaultVatPercent: vatNum, vatChargedToClient: chargedToClient },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">IVA en pagos online</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        El IVA cubre la comisión de acreditación de Mercado Pago Checkout (varía según en cuántos días
        recibís la plata). Solo se aplica a los pagos por Mercado Pago; en efectivo o transferencia no
        hay IVA. Es el valor por defecto: cada servicio puede tener el suyo.
      </p>
      <div className="space-y-4">
        <div>
          <Label htmlFor="vat-percent">IVA por defecto (%)</Label>
          <Input
            id="vat-percent"
            type="number"
            min={0}
            max={100}
            step={0.5}
            className="mt-1.5 w-32"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
          />
          {!vatOk && <p className="mt-1.5 text-xs text-destructive">Ingresá un valor entre 0 y 100.</p>}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={chargedToClient}
            onChange={(e) => setChargedToClient(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">
            Cobrarle el IVA al cliente
            <span className="block text-xs text-muted-foreground">
              Si lo destildás, el IVA lo absorbés vos: el cliente paga el precio sin recargo.
            </span>
          </span>
        </label>
        <Button size="sm" onClick={save} disabled={update.isPending || !vatOk}>
          {update.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Guardado" : "Guardar"}
        </Button>
      </div>
    </section>
  );
}

function BrandingSection({
  professional,
}: {
  professional: { id: string; slug: string; publicPageSettings: Record<string, unknown> };
}) {
  const update = useUpdateProfessional();
  const initial = professional.publicPageSettings as PublicPageBranding;
  const [bio, setBio] = useState(initial.bio ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setBio(initial.bio ?? "");
    setPhone(initial.phone ?? "");
  }, [initial.bio, initial.phone]);

  function save() {
    setSaveError(null);
    update.mutate(
      { publicPageSettings: { ...initial, bio, phone } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: () => setSaveError("No pudimos guardar los cambios. Probá de nuevo."),
      },
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Página pública</h2>

      {/* Link público */}
      <PublicPageLink slug={professional.slug} className="mb-4" />

      <div className="space-y-4">
        <div>
          <Label>Logo del negocio</Label>
          <ImageUpload
            className="mt-1.5"
            ownerType="professional_logo"
            ownerId={professional.id}
            fileId={initial.logoFileId}
            label="Subir logo"
            onUploaded={(file) => {
              setLogoError(null);
              update.mutate(
                { publicPageSettings: { ...initial, logoFileId: file.id } },
                {
                  onError: () =>
                    setLogoError("No pudimos guardar el logo. Probá de nuevo."),
                },
              );
            }}
            onRemoved={() => {
              setLogoError(null);
              const rest = { ...initial };
              delete rest.logoFileId;
              update.mutate(
                { publicPageSettings: rest },
                {
                  onError: () =>
                    setLogoError("No pudimos quitar el logo. Probá de nuevo."),
                },
              );
            }}
          />
          {logoError && <p className="mt-1.5 text-xs text-destructive">{logoError}</p>}
        </div>
        <div>
          <Label htmlFor="br-bio">Descripción</Label>
          <textarea
            id="br-bio"
            rows={2}
            className="mt-1.5 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Contale a tus clientes qué hacés y cómo atendés."
          />
        </div>
        <div>
          <Label htmlFor="br-phone">Teléfono / WhatsApp</Label>
          <Input id="br-phone" className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div>
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "Guardado" : "Guardar"}
          </Button>
          {saveError && <p className="mt-1.5 text-xs text-destructive">{saveError}</p>}
        </div>
      </div>
    </section>
  );
}

const SUB_STATUS: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "default" }> = {
  [SubscriptionStatus.trial]: { label: "Prueba", variant: "default" },
  [SubscriptionStatus.active]: { label: "Activa", variant: "success" },
  [SubscriptionStatus.past_due]: { label: "Pago pendiente", variant: "warning" },
  [SubscriptionStatus.grace]: { label: "En gracia", variant: "warning" },
  [SubscriptionStatus.blocked]: { label: "Bloqueada", variant: "warning" },
  [SubscriptionStatus.cancelled]: { label: "Cancelada", variant: "warning" },
};

function SubscriptionSection() {
  const sub = useSubscription();

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Suscripción</h2>
      {sub.isLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : sub.isError || !sub.data ? (
        <ErrorState message="No pudimos cargar tu suscripción." onRetry={() => sub.refetch()} />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-display font-semibold">Plan profesional</p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(sub.data.amountCents)} / mes
                </p>
              </div>
            </div>
            <Badge variant={SUB_STATUS[sub.data.status].variant}>
              {SUB_STATUS[sub.data.status].label}
            </Badge>
          </div>
          <Separator className="my-4" />
          {(() => {
            const end = subscriptionEndInfo(sub.data!);
            return (
              <p className="text-sm text-muted-foreground">
                {end.label}:{" "}
                <span className="font-medium capitalize text-foreground">
                  {end.date ? formatDateLong(end.date) : "—"}
                </span>
              </p>
            );
          })()}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/suscripcion">Administrar suscripción</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ajustes/pagos">Cobros (MercadoPago)</Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
