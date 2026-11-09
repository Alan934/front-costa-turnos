"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, ChevronLeft, ChevronRight, Eye, Lock } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ErrorState, EmptyState, SkeletonList } from "@/components/state-views";
import { useComercioTeamMetrics } from "@/lib/api/comercios";
import { formatMoney, titleCaseName } from "@/lib/format";
import { pct, periodRangeLabel, periodTitle, plural, type MetricsRangeUi } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { TeamMemberMetricsDto } from "@/lib/api/generated/model/teamMemberMetricsDto";

/**
 * Métricas del equipo para el dueño del comercio. La actividad de cada profesional se ve
 * siempre; la plata solo de quienes eligieron compartirla (el back manda `null` para el resto).
 */
export function TeamMetricsSection({ comercioId }: { comercioId: string }) {
  const [range, setRange] = useState<MetricsRangeUi>("week");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, isFetching, refetch } = useComercioTeamMetrics(comercioId, range, offset);
  const vs = range === "week" ? "vs. semana anterior" : "vs. mes anterior";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <BarChart3 className="size-4" />
          </span>
          <h2 className="font-display text-lg font-semibold tracking-tight">Métricas del equipo</h2>
        </div>
        <div className="flex items-center rounded-lg border border-border p-0.5 text-sm font-medium">
          {(["week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setOffset(0);
              }}
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

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={range === "week" ? "Semana anterior" : "Mes anterior"}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 px-1">
          <p className="text-sm font-semibold">{periodTitle(range, offset)}</p>
          <p className="text-xs text-muted-foreground">
            {data ? periodRangeLabel(data.period, range) : " "}
            {isFetching && !isLoading && <span className="ml-1.5">· actualizando…</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label={range === "week" ? "Semana siguiente" : "Mes siguiente"}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {isLoading && <SkeletonList rows={3} />}
      {isError && !data && <ErrorState message="No pudimos cargar las métricas del equipo." onRetry={() => refetch()} />}
      {data && data.members.length === 0 && (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="Todavía no hay profesionales activos"
          message="Cuando se sumen profesionales al comercio, acá vas a ver cómo le va a cada uno."
        />
      )}
      {data && data.members.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <Tile
              label="Atendidos"
              value={String(data.team.attended)}
              delta={<Delta current={data.team.attended} previous={data.team.previousAttended} />}
              vs={vs}
            />
            <Tile
              label="Agenda ocupada"
              value={data.team.occupancyRate == null ? "—" : pct(data.team.occupancyRate)}
            />
            <Tile label="Ausencias" value={pct(data.team.noShowRate)} />
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Cada profesional decide si comparte sus ingresos con el comercio.{" "}
              {data.team.sharingCount === 0
                ? "Por ahora nadie los compartió: ves solo la actividad."
                : `${data.team.sharingCount} de ${data.members.length} los comparten.`}
            </span>
          </p>

          <ul className="space-y-2.5">
            {data.members.map((m) => (
              <MemberRow key={m.membershipId} m={m} vs={vs} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MemberRow({ m, vs }: { m: TeamMemberMetricsDto; vs: string }) {
  const name = titleCaseName(m.professionalName);
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {m.topServiceName ? `Más pedido: ${m.topServiceName}` : "Sin atenciones en este período"}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Atendidos" value={String(m.attended)}>
          <Delta current={m.attended} previous={m.previousAttended} />
          <span className="sr-only"> {vs}</span>
        </Stat>
        <Stat label="Ausencias" value={pct(m.noShowRate)}>
          {m.noShow > 0 && <span>{plural(m.noShow, "no vino", "no vinieron")}</span>}
        </Stat>
        <Stat label="Agenda ocupada" value={m.occupancyRate == null ? "—" : pct(m.occupancyRate)} />
      </dl>

      <div className="mt-3 border-t border-border pt-3">
        {m.sharesIncome ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Cobrado" value={formatMoney(m.incomeCents ?? 0)} />
            <Stat label="Facturado" value={formatMoney(m.billedCents ?? 0)} />
            <Stat label="Ticket promedio" value={formatMoney(m.averageTicketCents ?? 0)} />
            <p className="col-span-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Eye className="size-3" /> Comparte sus ingresos con el comercio
            </p>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> No comparte sus ingresos
          </p>
        )}
      </div>
    </li>
  );
}

function Tile({ label, value, delta, vs }: { label: string; value: string; delta?: React.ReactNode; vs?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {delta && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground">
          {delta}
          <span className="hidden sm:inline">{vs}</span>
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div>
      <dd className="font-display text-base font-semibold tabular-nums">{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      {children && <div className="text-[11px] text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Diferencia de atendidos contra el período anterior (+3 / −2 / Igual). */
function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return <span className="font-medium">Igual</span>;
  const Icon = diff > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", diff > 0 ? "text-success" : "text-destructive")}>
      <Icon className="size-3" />
      {Math.abs(diff)}
    </span>
  );
}
