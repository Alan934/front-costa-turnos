"use client";

import { useState } from "react";
import { CreditCard, Check, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ErrorState, EmptyState } from "@/components/state-views";
import {
  useSubscription,
  useSubscriptionPayments,
  useSubscriptionCheckout,
} from "@/lib/api/billing";
import { describeSubscription, type SubSeverity } from "@/lib/subscription";
import { formatMoney, formatDateLong } from "@/lib/format";
import type { Subscription } from "@/lib/api/generated/model/subscription";

const BADGE: Record<SubSeverity, "success" | "warning" | "default" | "muted"> = {
  ok: "success",
  info: "default",
  warning: "warning",
  danger: "warning",
};

export function SubscriptionView() {
  const sub = useSubscription();

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Suscripción</h1>
      <p className="text-sm text-muted-foreground">Tu plan de Costa Turnos y tus pagos</p>

      {sub.isLoading && <Skeleton className="mt-6 h-44 w-full rounded-2xl" />}
      {sub.isError && (
        <ErrorState className="mt-6" message="No pudimos cargar tu suscripción." onRetry={() => sub.refetch()} />
      )}
      {sub.data && (
        <div className="mt-6 space-y-6">
          <StatusCard sub={sub.data} />
          <PaymentsHistory />
        </div>
      )}
    </div>
  );
}

function StatusCard({ sub }: { sub: Subscription }) {
  const info = describeSubscription(sub);
  const checkout = useSubscriptionCheckout();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    checkout.mutate(undefined, {
      onSuccess: (res) => {
        if (res?.initPoint) window.location.href = res.initPoint;
        else setError("No pudimos abrir el checkout. Probá de nuevo.");
      },
      onError: () => setError("No pudimos iniciar el pago. Probá de nuevo."),
    });
  }

  const Icon = info.severity === "info" ? Sparkles : info.severity === "ok" ? CreditCard : AlertTriangle;
  const upToDate = info.severity === "ok";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Plan profesional</p>
            <p className="text-sm text-muted-foreground">{formatMoney(sub.amountCents)} / mes</p>
          </div>
        </div>
        <Badge variant={BADGE[info.severity]}>{info.title.replace(/^Tu |^Estás en /, "")}</Badge>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{info.detail}</p>

      <Separator className="my-4" />

      <div className="grid grid-cols-2 gap-3 text-sm">
        {sub.status === "trial" && sub.trialEndsAt && (
          <Field label="Prueba hasta" value={formatDateLong(sub.trialEndsAt)} />
        )}
        {sub.graceEndsAt && <Field label="Gracia hasta" value={formatDateLong(sub.graceEndsAt)} />}
        <Field label="Período actual hasta" value={formatDateLong(sub.currentPeriodEnd)} />
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <Button className="mt-5 w-full sm:w-auto" onClick={pay} disabled={checkout.isPending}>
        {checkout.isPending ? <Spinner /> : <CreditCard className="size-4" />}
        {upToDate ? "Renovar por adelantado" : "Pagar con MercadoPago"}
      </Button>
      {upToDate && (
        <p className="mt-2 text-xs text-muted-foreground">Tu plan está al día, no hace falta que hagas nada.</p>
      )}
    </div>
  );
}

function PaymentsHistory() {
  const { data, isLoading, isError, refetch } = useSubscriptionPayments();

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Historial de pagos</h2>
      {isLoading && <Skeleton className="h-24 w-full rounded-2xl" />}
      {isError && <ErrorState message="No pudimos cargar los pagos." onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<CreditCard className="size-5" />}
          title="Todavía no hay pagos"
          message="Cuando abones tu suscripción vas a verlo acá."
        />
      )}
      {data && data.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {data.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium tabular-nums">{formatMoney(p.amountCents)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateLong(p.paidAt ?? p.createdAt)}
                  {p.method ? ` · ${p.method === "cash" ? "Efectivo" : "MercadoPago"}` : ""}
                </p>
              </div>
              {p.status === "paid" ? (
                <Badge variant="success">
                  <Check className="size-3" /> Pagado
                </Badge>
              ) : (
                <Badge variant="warning">Fallido</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
