"use client";

import { useEffect, useState } from "react";
import { Link2, Save, Check, ExternalLink, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { useProfessional, useUpdateProfessional, useSubscription } from "@/lib/api/professional";
import { DepositMode } from "@/lib/api/generated/model/depositMode";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
import { formatMoney, formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
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
          <BrandingSection professional={pro.data} />
          <Separator />
          <SubscriptionSection />
        </div>
      )}
    </div>
  );
}

const DEPOSIT_LABELS: Record<DepositMode, string> = {
  [DepositMode.none]: "Sin seña",
  [DepositMode.hybrid]: "Híbrida",
  [DepositMode.required]: "Obligatoria",
};

function BusinessSection({ professional }: { professional: { businessName: string; cancellationWindowHours: number; defaultDepositMode: DepositMode } }) {
  const update = useUpdateProfessional();
  const [name, setName] = useState(professional.businessName);
  const [window, setWindow] = useState(String(professional.cancellationWindowHours));
  const [deposit, setDeposit] = useState<DepositMode>(professional.defaultDepositMode);
  const [saved, setSaved] = useState(false);

  function save() {
    update.mutate(
      {
        businessName: name.trim(),
        cancellationWindowHours: Number(window),
        defaultDepositMode: deposit,
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
          <Label htmlFor="biz-window">Cancelación: hasta cuántas horas antes</Label>
          <Input id="biz-window" type="number" min={0} className="mt-1.5" value={window} onChange={(e) => setWindow(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Tus clientes pueden cancelar online hasta {window || 0} h antes del turno.
          </p>
        </div>
        <div>
          <Label>Seña por defecto en servicios nuevos</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(Object.values(DepositMode) as DepositMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDeposit(m)}
                className={cn(
                  "rounded-lg border py-2 text-sm font-medium transition-colors",
                  deposit === m ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/50",
                )}
              >
                {DEPOSIT_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Guardado" : "Guardar"}
        </Button>
      </div>
    </section>
  );
}

function BrandingSection({ professional }: { professional: { slug: string; publicPageSettings: Record<string, unknown> } }) {
  const update = useUpdateProfessional();
  const initial = professional.publicPageSettings as PublicPageBranding;
  const [bio, setBio] = useState(initial.bio ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBio(initial.bio ?? "");
    setAddress(initial.address ?? "");
    setPhone(initial.phone ?? "");
  }, [initial.bio, initial.address, initial.phone]);

  function save() {
    update.mutate(
      { publicPageSettings: { ...initial, bio, address, phone } },
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
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Página pública</h2>

      {/* Link público */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
        <Link2 className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-sm">costaturnos.com.ar/r/{professional.slug}</span>
        <Button variant="outline" size="sm" asChild>
          <a href={`/r/${professional.slug}`} target="_blank" rel="noreferrer">
            Ver
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>

      <div className="space-y-4">
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
          <Label htmlFor="br-address">Dirección</Label>
          <Input id="br-address" className="mt-1.5" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="br-phone">Teléfono / WhatsApp</Label>
          <Input id="br-phone" className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Guardado" : "Guardar"}
        </Button>
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
          <p className="text-sm text-muted-foreground">
            Próximo cobro: <span className="font-medium capitalize text-foreground">{formatDateLong(sub.data.currentPeriodEnd)}</span>
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Administrar pago
          </Button>
        </div>
      )}
    </section>
  );
}
