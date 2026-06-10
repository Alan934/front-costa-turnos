"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  CalendarCheck2,
  DollarSign,
  UserPlus,
  UserX,
  FileDown,
  Sheet,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { useMetrics } from "@/lib/api/metrics";
import { useTokenColors } from "@/lib/use-token-colors";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetricsOverview } from "@/mocks/contract-extensions";

type Range = "week" | "month";

export function MetricsView() {
  const [range, setRange] = useState<Range>("week");
  const { data, isLoading, isError, refetch } = useMetrics(range);

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground">Cómo viene tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <FileDown className="size-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => data && exportCsv(data)}>
            <Sheet className="size-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>
      </div>

      {isLoading && <MetricsSkeleton />}
      {isError && <ErrorState className="mt-6" message="No pudimos cargar las métricas." onRetry={() => refetch()} />}
      {data && <MetricsContent data={data} />}
    </div>
  );
}

function MetricsContent({ data }: { data: MetricsOverview }) {
  const c = useTokenColors();

  return (
    <div className="mt-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<CalendarCheck2 className="size-4" />} value={String(data.totals.appointments)} label="turnos atendidos" />
        <Kpi icon={<DollarSign className="size-4" />} value={formatMoney(data.totals.incomeCents)} label="ingresos" />
        <Kpi icon={<UserPlus className="size-4" />} value={String(data.totals.newClients)} label="clientes nuevos" />
        <Kpi icon={<UserX className="size-4" />} value={`${Math.round(data.totals.noShowRate * 100)}%`} label="no-show" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Atención por día */}
        <Card title="Atención por período">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.attendanceByDay} barCategoryGap={range_gap(data)}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="label" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: c.border, opacity: 0.3 }} />
              <Bar dataKey="atendidos" name="Atendidos" fill={c.done} radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelados" name="Cancelados" fill={c.cancelled} radius={[4, 4, 0, 0]} />
              <Bar dataKey="noShow" name="No vino" fill={c.waiting} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Ingresos por día */}
        <Card title="Ingresos">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.incomeByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="label" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={c.muted}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v) => `$${Math.round((v as number) / 100000)}k`}
              />
              <Tooltip content={<ChartTooltip money />} />
              <Line type="monotone" dataKey="cents" name="Ingresos" stroke={c.accent} strokeWidth={2.5} dot={{ r: 3, fill: c.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Nuevos vs recurrentes */}
        <Card title="Nuevos vs. recurrentes">
          <div className="flex items-center gap-4">
            <div className="h-[200px] w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Recurrentes", value: data.newVsReturning.recurrentes },
                      { name: "Nuevos", value: data.newVsReturning.nuevos },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    <Cell fill={c.accent} />
                    <Cell fill={c.waiting} />
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              <Legend color={c.accent} label="Recurrentes" value={data.newVsReturning.recurrentes} />
              <Legend color={c.waiting} label="Nuevos" value={data.newVsReturning.nuevos} />
              <p className="pt-1 text-xs text-muted-foreground">
                {Math.round(
                  (data.newVsReturning.recurrentes /
                    (data.newVsReturning.recurrentes + data.newVsReturning.nuevos)) *
                    100,
                )}
                % vuelve
              </p>
            </div>
          </div>
        </Card>

        {/* Horarios pico */}
        <Card title="Horarios pico">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="hour" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: c.border, opacity: 0.3 }} />
              <Bar dataKey="turnos" name="Turnos" fill={c.serving} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Clientes que no vuelven */}
      <Card title="Clientes que no vuelven">
        {data.atRiskClients.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">¡Todos tus clientes están al día!</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.atRiskClients.map((cl) => (
              <li key={cl.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-muted">
                  <UserMinus className="size-4 text-muted-foreground" />
                </span>
                <span className="flex-1 text-sm font-medium">{cl.fullName}</span>
                <span className="text-xs text-muted-foreground">Última visita {cl.lastVisitLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function range_gap(data: MetricsOverview) {
  return data.attendanceByDay.length > 10 ? "10%" : "30%";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-display text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <p className="mt-2.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-3 rounded-sm" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-display font-semibold tabular-nums">{value}</span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  money?: boolean;
}
function ChartTooltip({ active, payload, label, money }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium">{money ? formatMoney(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Exporta el resumen a CSV (abrible en Excel). */
function exportCsv(data: MetricsOverview) {
  const rows: string[] = ["Período,Atendidos,Cancelados,No vino,Ingresos"];
  data.attendanceByDay.forEach((d, i) => {
    const income = (data.incomeByDay[i]?.cents ?? 0) / 100;
    rows.push(`${d.label},${d.atendidos},${d.cancelados},${d.noShow},${income}`);
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metricas-${data.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
