"use client";

import { useState } from "react";
import { Search, Banknote, ExternalLink, Building2, MoreVertical, Check, Plus, Ban, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorState, EmptyState } from "@/components/state-views";
import {
  useAdminProfessionals,
  useMarkCashPaid,
  useCreateProfessionalAccount,
  useBlockAccount,
  useActivateAccount,
} from "@/lib/api/admin";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
import { subscriptionEndInfo } from "@/lib/subscription";
import { formatMoney, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminProfessionalRow } from "@/mocks/contract-extensions";

const SUB_LABELS: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "muted" | "default" }> = {
  [SubscriptionStatus.trial]: { label: "Prueba", variant: "default" },
  [SubscriptionStatus.active]: { label: "Al día", variant: "success" },
  [SubscriptionStatus.past_due]: { label: "Pago pendiente", variant: "warning" },
  [SubscriptionStatus.grace]: { label: "En gracia", variant: "warning" },
  [SubscriptionStatus.blocked]: { label: "Bloqueada", variant: "warning" },
  [SubscriptionStatus.cancelled]: { label: "Baja", variant: "muted" },
};

export function ProfessionalsAdmin() {
  const { data, isLoading, isError, refetch } = useAdminProfessionals();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const list = (data ?? []).filter((row) => {
    const t = q.toLowerCase();
    return (
      row.professional.businessName.toLowerCase().includes(t) ||
      row.professional.slug.toLowerCase().includes(t)
    );
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profesionales</h1>
          <p className="text-sm text-muted-foreground">Negocios en la plataforma y su estado de pago</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo profesional</span>
        </Button>
      </div>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio o slug…" />
      </div>

      <div className="mt-5">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar los profesionales." onRetry={() => refetch()} />}
        {data && list.length === 0 && (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={q ? "Sin resultados" : "Todavía no hay profesionales"}
            message={q ? "Probá otra búsqueda." : "Los profesionales se registran solos desde la web."}
          />
        )}
        {list.length > 0 && (
          <ul className="space-y-2.5">
            {list.map((row) => (
              <ProfessionalRow key={row.professional.id} row={row} />
            ))}
          </ul>
        )}
      </div>

      {creating && <NewProfessionalDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ProfessionalRow({ row }: { row: AdminProfessionalRow }) {
  const { professional: pro, subscription: sub } = row;
  const markCash = useMarkCashPaid();
  const block = useBlockAccount();
  const activate = useActivateAccount();
  const [menu, setMenu] = useState(false);
  const [paid, setPaid] = useState(false);
  const meta = SUB_LABELS[sub.status];
  const busy = markCash.isPending || block.isPending || activate.isPending;

  function registerCash() {
    markCash.mutate(pro.id, {
      onSuccess: () => {
        setPaid(true);
        setMenu(false);
        setTimeout(() => setPaid(false), 2500);
      },
    });
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted font-display text-sm font-semibold">
          {pro.businessName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{pro.businessName}</p>
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {paid && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <Check className="size-3.5" /> Pago registrado
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">/r/{pro.slug}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span>{formatMoney(sub.amountCents)}/mes</span>
            {(() => {
              const end = subscriptionEndInfo(sub);
              return end.date ? <span>{end.label} {formatDateShort(end.date)}</span> : null;
            })()}
          </p>
        </div>

        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Acciones" onClick={() => setMenu((v) => !v)}>
            <MoreVertical className="size-4" />
          </Button>
          {menu && (
            <>
              <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
                <a
                  href={`/r/${pro.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                >
                  <ExternalLink className="size-4" />
                  Ver página pública
                </a>
                <button
                  type="button"
                  onClick={registerCash}
                  disabled={busy}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted")}
                >
                  {markCash.isPending ? <Spinner /> : <Banknote className="size-4" />}
                  Registré pago en efectivo
                </button>
                <button
                  type="button"
                  onClick={() => activate.mutate(pro.accountId, { onSuccess: () => setMenu(false) })}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-success hover:bg-muted"
                >
                  {activate.isPending ? <Spinner /> : <CircleCheck className="size-4" />}
                  Activar cuenta
                </button>
                <button
                  type="button"
                  onClick={() => block.mutate(pro.accountId, { onSuccess: () => setMenu(false) })}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                >
                  {block.isPending ? <Spinner /> : <Ban className="size-4" />}
                  Bloquear cuenta
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function NewProfessionalDialog({ onClose }: { onClose: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProfessionalAccount();

  const effectiveSlug = slugTouched ? slug : toSlug(businessName);
  const canSubmit = businessName.trim().length > 1 && effectiveSlug.length > 1 && email.includes("@");

  function submit() {
    setError(null);
    create.mutate(
      { email: email.trim(), businessName: businessName.trim(), slug: effectiveSlug },
      {
        onSuccess: onClose,
        onError: () => setError("No pudimos crear el profesional. ¿El email o el enlace ya existen?"),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo profesional</DialogTitle>
          <DialogDescription>
            Se crea la cuenta + el negocio con prueba gratis y se le envía un email para que
            active su cuenta y elija su contraseña.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 px-6 pb-2">
          <div>
            <Label htmlFor="np-biz">Nombre del negocio</Label>
            <Input
              id="np-biz"
              className="mt-1.5"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Barbería Don Carlos"
            />
          </div>
          <div>
            <Label htmlFor="np-slug">Enlace público</Label>
            <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="select-none text-sm text-muted-foreground">/r/</span>
              <input
                id="np-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(toSlug(e.target.value));
                }}
                placeholder="barberia-don-carlos"
                className="h-10 w-full bg-transparent px-2 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="np-email">Email del dueño</Label>
            <Input
              id="np-email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carlos@email.com"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit} loading={create.isPending} onClick={submit}>
            Crear y enviar activación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
