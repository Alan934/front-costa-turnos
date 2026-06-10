"use client";

import { useState } from "react";
import { Search, Banknote, ExternalLink, Building2, MoreVertical, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import { useAdminProfessionals, useMarkCashPaid } from "@/lib/api/admin";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
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

  const list = (data ?? []).filter((row) => {
    const t = q.toLowerCase();
    return (
      row.professional.businessName.toLowerCase().includes(t) ||
      row.professional.slug.toLowerCase().includes(t)
    );
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Profesionales</h1>
        <p className="text-sm text-muted-foreground">Negocios en la plataforma y su estado de pago</p>
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
    </div>
  );
}

function ProfessionalRow({ row }: { row: AdminProfessionalRow }) {
  const { professional: pro, subscription: sub } = row;
  const markCash = useMarkCashPaid();
  const [menu, setMenu] = useState(false);
  const [paid, setPaid] = useState(false);
  const meta = SUB_LABELS[sub.status];

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
            <span>Período hasta {formatDateShort(sub.currentPeriodEnd)}</span>
            {sub.status === "trial" && sub.trialEndsAt && (
              <span>Prueba hasta {formatDateShort(sub.trialEndsAt)}</span>
            )}
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
                  disabled={markCash.isPending}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted")}
                >
                  {markCash.isPending ? <Spinner /> : <Banknote className="size-4" />}
                  Registré pago en efectivo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
