"use client";

import { useState } from "react";
import {
  Banknote,
  Clock,
  Check,
  CalendarCheck2,
  CircleDollarSign,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/state-views";
import { useCashClosing, type CashClosingRange } from "@/lib/api/cash-closing";
import { useMarkPaymentPaid, useMarkPaymentDeferred } from "@/lib/api/billing";
import { useAppointmentsComplete } from "@/lib/api/generated/endpoints/appointments/appointments";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney, formatDateLong, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PendingCashDto } from "@/lib/api/generated/model/pendingCashDto";

export function CashClosingView() {
  const [range, setRange] = useState<CashClosingRange>("week");
  const { data, isLoading, isError, refetch } = useCashClosing(range);

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Cierre de caja</h1>
          <p className="text-sm text-muted-foreground">
            Turnos sin cerrar y efectivo pendiente de cobro
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border p-0.5 text-sm font-medium">
          {(["week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                range === r ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <CajaSkeleton />}
      {isError && (
        <ErrorState
          className="mt-6"
          message="No pudimos cargar el cierre de caja."
          onRetry={() => refetch()}
        />
      )}
      {data && (
        <div className="mt-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              icon={<CircleDollarSign className="size-4" />}
              value={formatMoney(data.pendingCashCents)}
              label="pendiente de cobro"
              tone="warning"
            />
            <Kpi
              icon={<Wallet className="size-4" />}
              value={formatMoney(data.collected.totalCents)}
              label={`cobrado · ${data.collected.count} ${data.collected.count === 1 ? "pago" : "pagos"}`}
              tone="success"
            />
          </div>

          {/* Turnos sin marcar como atendidos */}
          <Section
            title="Turnos sin cerrar"
            hint="Pasaron y siguen sin marcarse como atendidos."
            count={data.pendingCompletion.length}
            emptyLabel="No tenés turnos pendientes de cerrar."
          >
            {data.pendingCompletion.map((p) => (
              <PendingCompletionRow key={p.appointmentId} item={p} />
            ))}
          </Section>

          {/* Efectivo sin cobrar */}
          <Section
            title="Efectivo pendiente"
            hint="Clientes que todavía no pagaron o quedaron en un pagaré."
            count={data.pendingCash.length}
            emptyLabel="No tenés efectivo pendiente de cobro."
          >
            {data.pendingCash.map((p) => (
              <PendingCashRow key={p.paymentId} item={p} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function PendingCompletionRow({
  item,
}: {
  item: { appointmentId: string; personName: string; serviceName: string; startAt: string };
}) {
  const complete = useAppointmentsComplete();
  const qc = useQueryClient();

  function markDone() {
    complete.mutate(
      { id: item.appointmentId, data: {} },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["cash-closing"] });
          qc.invalidateQueries({ queryKey: ["appointments"] });
        },
      },
    );
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
        <CalendarCheck2 className="size-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.personName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.serviceName} · {formatDateLong(item.startAt)} · {formatTime(item.startAt)}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={markDone} disabled={complete.isPending}>
        {complete.isPending ? <Spinner /> : <Check className="size-4" />}
        Atendido
      </Button>
    </li>
  );
}

function PendingCashRow({ item }: { item: PendingCashDto }) {
  const markPaid = useMarkPaymentPaid();
  const markDeferred = useMarkPaymentDeferred();
  const [deferring, setDeferring] = useState(false);
  const [note, setNote] = useState("");
  const busy = markPaid.isPending || markDeferred.isPending;

  const isDeferred = item.status === "deferred";

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            isDeferred ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {isDeferred ? <Clock className="size-4" /> : <Banknote className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.personName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.serviceName}
            {item.appointmentStartAt ? ` · ${formatDateLong(item.appointmentStartAt)}` : ""}
            {isDeferred ? " · pagaré" : ""}
          </p>
          {item.note && (
            <p className="mt-0.5 truncate text-xs italic text-muted-foreground">“{item.note}”</p>
          )}
        </div>
        <span className="shrink-0 font-display text-sm font-semibold tabular-nums">
          {formatMoney(item.amountCents)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 pl-12">
        <Button
          size="sm"
          variant="outline"
          onClick={() => markPaid.mutate(item.paymentId)}
          disabled={busy}
        >
          {markPaid.isPending ? <Spinner /> : <Check className="size-4" />}
          Cobré
        </Button>
        {!isDeferred && !deferring && (
          <Button size="sm" variant="ghost" onClick={() => setDeferring(true)} disabled={busy}>
            <Clock className="size-4" />
            Pagaré
          </Button>
        )}
      </div>

      {deferring && !isDeferred && (
        <div className="mt-2 space-y-2 pl-12">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional): ej. paga la semana que viene"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeferring(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                markDeferred.mutate(
                  { id: item.paymentId, note: note.trim() || undefined },
                  { onSuccess: () => setDeferring(false) },
                )
              }
              disabled={busy}
            >
              {markDeferred.isPending ? <Spinner /> : null}
              Marcar pagaré
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  hint,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {count > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {count === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">{children}</ul>
      )}
    </div>
  );
}

function Kpi({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone: "warning" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg",
          tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success",
        )}
      >
        {icon}
      </span>
      <p className="mt-2.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function CajaSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}
