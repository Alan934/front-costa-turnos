"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Building2, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { useAdminMetrics } from "@/lib/api/admin";
import { useTokenColors } from "@/lib/use-token-colors";
import { formatMoney } from "@/lib/format";
import type { AdminMetrics } from "@/mocks/contract-extensions";

export function AdminMetricsView() {
  const { data, isLoading, isError, refetch } = useAdminMetrics();

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Métricas de la plataforma</h1>
      <p className="text-sm text-muted-foreground">Cómo viene Costa Turnos</p>

      {isLoading && <AdminSkeleton />}
      {isError && <ErrorState className="mt-6" message="No pudimos cargar las métricas." onRetry={() => refetch()} />}
      {data && <Content data={data} />}
    </div>
  );
}

function Content({ data }: { data: AdminMetrics }) {
  const c = useTokenColors();

  return (
    <div className="mt-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Building2 className="size-4" />} value={String(data.totals.activeProfessionals)} label="profesionales activos" />
        <Kpi icon={<DollarSign className="size-4" />} value={formatMoney(data.totals.mrrCents)} label="ingresos / mes (MRR)" />
        <Kpi icon={<TrendingUp className="size-4" />} value={`+${data.totals.newThisMonth}`} label="altas este mes" />
        <Kpi icon={<TrendingDown className="size-4" />} value={`-${data.totals.churnThisMonth}`} label="bajas este mes" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activos por mes */}
        <Card title="Profesionales activos">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.activeByMonth}>
              <defs>
                <linearGradient id="adminActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="label" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="activos" name="Activos" stroke={c.accent} strokeWidth={2.5} fill="url(#adminActive)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* MRR por mes */}
        <Card title="Ingresos mensuales (MRR)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.mrrByMonth}>
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
              <Tooltip content={<TT money />} />
              <Line type="monotone" dataKey="cents" name="MRR" stroke={c.serving} strokeWidth={2.5} dot={{ r: 3, fill: c.serving }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Altas vs bajas */}
      <Card title="Altas vs. bajas">
        <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.growthByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
            <XAxis dataKey="label" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip content={<TT />} cursor={{ fill: c.border, opacity: 0.3 }} />
            <Bar dataKey="altas" name="Altas" fill={c.done} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="bajas" name="Bajas" fill={c.cancelled} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
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
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</span>
      <p className="mt-2.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface TTProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  money?: boolean;
}
function TT({ active, payload, label, money }: TTProps) {
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

function AdminSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
